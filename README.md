skillmesh
=================

A new CLI for SHDR generated with oclif


[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)


<!-- toc -->
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
# Usage

`skillmesh` 不发布在公共 npm registry 上（`skillmesh` 这个包名已被无关的第三方项目占用），完整安装
方式（一键脚本 / 手动安装 / 常见问题排查 / 卸载）见 [docs/install.md](./docs/install.md)。

macOS / Linux 一键安装：

```sh-session
$ curl -fsSL https://raw.githubusercontent.com/DTim887/skill-mesh/main/install.sh | sh
$ skillmesh COMMAND
running command...
$ skillmesh (--version)
skillmesh/0.0.0 darwin-arm64 node-v24.20.0
$ skillmesh --help [COMMAND]
USAGE
  $ skillmesh COMMAND
...
```

Windows（PowerShell）一键安装：

```powershell
irm https://raw.githubusercontent.com/DTim887/skill-mesh/main/install.ps1 | iex
```
# Commands
<!-- commands -->
* [`skillmesh domain search [KEYWORD]`](#skillmesh-domain-search-keyword)
* [`skillmesh help [COMMAND]`](#skillmesh-help-command)
* [`skillmesh init [NAME]`](#skillmesh-init-name)

## `skillmesh domain search [KEYWORD]`

在公司各部门/业务领域发布的知识库中搜索。

```
USAGE
  $ skillmesh domain search [KEYWORD...]

ARGUMENTS
  [KEYWORD...]  搜索关键词，可包含多个词（用空格分隔，无需加引号）；不提供时列出全部已发布的知识库

DESCRIPTION
  在公司各部门/业务领域发布的知识库中搜索。

  不带关键词时列出全部当前已发布、可安装的知识库。

EXAMPLES
  搜索名称、描述或标签中包含"增长"的知识库

    $ skillmesh domain search 增长

  列出全部已发布的知识库

    $ skillmesh domain search
```

_See code: [src/commands/domain/search.ts](https://github.com/DTim887/skill-mesh/blob/v0.0.1/src/commands/domain/search.ts)_

## `skillmesh help [COMMAND]`

Display help for skillmesh.

```
USAGE
  $ skillmesh help [COMMAND...] [-n]

ARGUMENTS
  [COMMAND...]  Command to show help for.

FLAGS
  -n, --nested-commands  Include all nested commands in the output.

DESCRIPTION
  Display help for skillmesh.
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/6.3.0/src/commands/help.ts)_

## `skillmesh init [NAME]`

初始化一个 skillmesh 工作区（类似 git init）。

```
USAGE
  $ skillmesh init [NAME]

ARGUMENTS
  [NAME]  在当前目录下创建的子目录名，作为工作区根；不提供时以当前目录本身作为工作区根

DESCRIPTION
  初始化一个 skillmesh 工作区（类似 git init）。

  不带参数时以当前目录为工作区根；带参数时在当前目录下新建一个同名子目录作为工作区根。
  执行前会展示即将写入的路径与文件清单，并等待交互式确认。

EXAMPLES
  以当前目录为工作区根初始化

    $ skillmesh init

  在当前目录下新建 myworkspace 子目录作为工作区根

    $ skillmesh init myworkspace
```

_See code: [src/commands/init.ts](https://github.com/DTim887/skill-mesh/blob/v0.0.1/src/commands/init.ts)_
<!-- commandsstop -->
