---
name: skillmesh
description: 帮助用户在当前工作区里搜索、安装公司各部门发布的知识库（Domain）。当用户提到"skillmesh"、"知识库"、"domain"，或想知道公司有没有某个领域的现成知识库时使用。
---

# SkillMesh

`skillmesh` 是一个内部 CLI 工具，让公司各部门/业务领域沉淀的 AI 知识库（称为 Domain）可以像安装
软件包一样被发现和使用。这份 SKILL 描述了当前实际可用的命令，帮助你（{{AGENT_NAME}}）在用户请求
相关操作时知道该调用哪个命令、怎么解读结果。

## 当前可用命令

### `skillmesh domain search [关键词...]`

在公司已发布的 Domain 知识库中搜索。

- 不带关键词：列出当前全部已发布、可安装的 Domain。
- 带关键词：对每个 Domain 的名称、描述、标签做不区分大小写的匹配；多个词直接用空格分隔即可，
  不需要加引号（如 `skillmesh domain search commerce foundation`）。
- 输出是给人看的卡片格式（名称/描述/标签/版本/团队），不是 JSON；如果需要在脚本里解析结果，
  应该解析 stdout 文本内容而不是依赖退出码——退出码 `0` 同时代表"找到了"和"没找到但命令本身没
  出错"。

**什么时候用这个命令**：用户想知道"公司是否已经有人做过某个领域的知识库"、想在安装前先确认有没有
相关内容时。

### `skillmesh domain add <id> [--tag <版本>]`

把一个 Domain 知识库真正装进当前工作区——按 `id`（用 `domain search` 先查到）从中心目录拿到来源
仓库和默认版本，拉取该仓库的知识描述文件，生成 Claude Code 和 Cursor 都能读的技能文档，分别写入
`.claude/skills/<id>-knowledge/SKILL.md` 和 `.cursor/skills/<id>-knowledge/SKILL.md`，并在工作区
安装记录里留痕。

- 必须先执行过 `skillmesh init`；当前目录不在工作区里会报错并提示先初始化。
- `<id>` 必须是 `domain search` 能搜到的真实 id，不存在的 id 会报错提示"未找到该 Domain"。
- 不带 `--tag`：装中心目录记录的默认版本；带 `--tag <版本号>`：显式指定安装某个历史版本。
- 执行前会有交互式确认，展示即将安装的名称、版本、写入路径；这是一个需要人在终端里手动确认的
  命令，不支持非交互跳过。
- 同一个 `id` 只能装一次——已经装过的 domain 再次执行会直接报错"已经安装过"，不会覆盖；如果用户
  想重装或换版本，先用 `domain remove <id>` 卸载再重新安装（`update` 命令本身还没有实现）。
- 一次只能装一个 id，不支持批量安装。

**什么时候用这个命令**：用户已经用 `domain search` 确认某个 Domain 存在、并明确表示要把它装进当前
工作区时；如果用户还没确认过要装哪个 Domain，先引导用户用 `domain search` 查。

### `skillmesh domain remove <id>`

从当前工作区卸载一个已安装的 Domain 知识库——按 `id` 在工作区安装记录里找到对应内容，删除
`.claude/skills/<id>-knowledge/` 与 `.cursor/skills/<id>-knowledge/` 下的技能文档，并清除该 id
的安装记录。全程不需要网络访问。

- `<id>` 必须是当前工作区已经用 `domain add` 装过的 id；没装过会报错提示"未安装"。
- 执行前会有交互式确认，逐条列出即将删除的具体文件路径；这是一个需要人在终端里手动确认的命令，
  不支持非交互跳过，也没有 `--force`/`--yes` 之类的快捷参数。
- 卸载是真删除，不做回收站/恢复设计；卸载后可以用 `domain add <id>` 重新安装同一个 id。
- 一次只能卸载一个 id，不支持批量卸载或"卸载全部"。

**什么时候用这个命令**：用户明确表示"不要这个知识库了""想重装/换个版本"时；先确认用户说的是
Domain 知识库层面的卸载，不要和 `skillmesh install`（卸载 CLI 自身用 `npm uninstall -g skillmesh`）
混淆。

### `skillmesh init [名称]`

初始化一个本地工作区（类似 `git init`），是使用 `skillmesh` 其他功能的前提。

- 不带名称：把当前目录变成工作区根。
- 带名称：在当前目录下新建一个同名子目录作为工作区根。
- 执行前会有交互式确认，展示即将创建的路径和文件清单；这是一个需要人在终端里手动确认的命令，
  不支持非交互跳过。
- 已经初始化过的目录会拒绝重复初始化，不会覆盖已有内容。

**什么时候用这个命令**：用户提到"还没有工作区"“第一次用 skillmesh"，或者其他命令报错提示"请先执行
`skillmesh init`"时。

## 尚未实现的命令（不要假装它们存在）

`domain update`（原地升级到新版本）、`skill add`（安装真正的技能包）等命令**目前还没有实现**，
属于后续规划。如果用户想执行这类操作（如"换个版本但不想先卸载"），如实告知"这个功能还在开发中，
目前 skillmesh 支持 `domain search`（搜索）、`domain add`（安装）、`domain remove`（卸载）和
`init`（初始化工作区）；想换版本可以先 `domain remove` 再 `domain add`"，不要编造这些命令的用法
或假装帮用户执行了它们。

## 使用建议

- 帮用户判断"要不要装某个 Domain"时，先用 `domain search` 查，把搜到的名称、描述、标签原样告诉
  用户，不要替用户做主观判断"这个适不适合"；用户确认要装之后再用 `domain add <id>`。
- 如果用户想执行 `domain add`/`domain remove`，而当前目录看起来还没有 `.skillmesh/` 标记，提醒
  用户先运行 `skillmesh init`。
- 帮用户执行 `domain remove` 前，如实告知这是真删除、不会保留副本，让用户自己确认要删的是哪个
  Domain，不要替用户做"要不要删"这个决定。
