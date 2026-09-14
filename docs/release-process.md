# 发布流程（维护者向）

`skillmesh` 不通过 CI 自动发布——发布到公共 npm registry 会撞上已被第三方占用的 `skillmesh` 包名，
`npm install -g github:...` 直装也因为仓库不提交编译产物而实际装不起来（详见
`docs/decisions/0001-cli-tech-stack.md`）。因此发布路径是"维护者本地手动构建 + 挂到 GitHub Release
的 tarball"，全程不依赖 `.github/workflows/` 下的任何自动化。

## 前置条件

- 本地已安装 [GitHub CLI（`gh`）](https://cli.github.com/) 并完成 `gh auth login`
- 本地 Node.js 版本满足 `package.json` 的 `engines.node`（`>=20.0.0`）
- 工作区干净（`git status` 无未提交改动），且已切到要发布的提交

## 步骤

### 1. 确认版本号已 bump

```bash
node -p "require('./package.json').version"
```

版本号变更用 `npm version <patch|minor|major>` 完成（会同时创建 git commit 与 tag，不要手改
`package.json` 里的 `version` 字段）：

```bash
npm version patch   # 或 minor / major，按变更内容选择
```

### 2. 本地构建

```bash
npm run build
```

产出 `dist/`。

### 3. 本地打包

```bash
npm pack
```

产出的 tarball 文件名遵循 npm 默认规则：`skillmesh-<version>.tgz`（**不带** `v` 前缀，例如版本号
`0.1.0` 对应 `skillmesh-0.1.0.tgz`）。可选：先跑 `npm pack --dry-run` 确认内容包含
`dist/`、`resources/`、`bin/`、`oclif.manifest.json`。

### 4. 创建 GitHub Release

```bash
git push && git push --tags   # 确保 npm version 产生的 commit/tag 已推送
gh release create vX.Y.Z --generate-notes
```

`vX.Y.Z` 使用带 `v` 前缀的 tag 名（如 `v0.1.0`），与第 1 步的 `package.json` 版本号对应。这一步只是
本地 `gh` CLI 命令，不触发任何 GitHub Actions workflow。

### 5. 上传 tarball 到 Release

```bash
gh release upload vX.Y.Z skillmesh-<version>.tgz
```

例如：`gh release upload v0.1.0 skillmesh-0.1.0.tgz`。

### 6. 验证

用一键脚本或手动命令实际装一遍，确认版本号符合预期：

```bash
curl -fsSL https://raw.githubusercontent.com/DTim887/skill-mesh/main/install.sh | sh
skillmesh --version
```

或指定版本安装（跳过"查最新"这一步，适合验证非最新的历史版本）：

```bash
VERSION=vX.Y.Z curl -fsSL https://raw.githubusercontent.com/DTim887/skill-mesh/main/install.sh | sh
```

## 关于既有 GitHub Actions workflow

`.github/workflows/onRelease.yml`（release 触发 → `npm publish` 到公共 npm registry）已删除——它
的目标包名 `skillmesh` 已被无关第三方占用，发布必然失败，且这条自动发布链路已被上述手动流程取代。

`.github/workflows/onPushToMain.yml`（"push 到 main 时自动创建空 GitHub Release"，附带一个被同一个
失败步骤阻塞、从未真正跑起来过的 README 自动提交步骤）已整体删除——保留它会与本流程第 4 步"手动创建
带 tarball 的 Release"冲突（同一个 tag 会先被自动创建成一个没有任何安装产物的空 Release）；其中的
README 自动同步能力此前也从未真正生效过（被同一个因缺少 `GH_EMAIL`/`GH_USERNAME` secret 而失败的
"Setup git"步骤挡在前面），不属于本次安装能力需求的范围，一并删除而非单独修好。`test.yml`（跨平台
单元测试矩阵）不受影响，继续按原样运行。

如果未来希望重新引入自动化发布或 README 自动同步，需要先解决包名撞车问题（改名或迁移到 scoped 包名/
私有 registry）、补齐所需 secret，届时应作为独立的需求重新设计，而不是恢复这两个已删除的 workflow。
