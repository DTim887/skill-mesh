# 安装 skillmesh

`skillmesh` 不发布在公共 npm registry 上（`skillmesh` 这个包名已被无关的第三方项目占用），而是通过
GitHub Release 分发。你不需要了解 npm/Git/GitHub Release 的细节，用下面任意一种方式装上即可。

## 一键安装（推荐）

### macOS / Linux

```bash
curl -fsSL https://raw.githubusercontent.com/DTim887/skill-mesh/main/install.sh | sh
```

### Windows（PowerShell）

```powershell
irm https://raw.githubusercontent.com/DTim887/skill-mesh/main/install.ps1 | iex
```

脚本会自动检测你是否已经装过 `skillmesh`：没装过会提示即将安装的版本号，已装过旧版本会提示当前
版本号和即将升级到的版本号，输入 `y` 确认即可；已经是最新版本时会直接告诉你，不会重复安装。

### 安装指定版本

不想装最新版本时，可以显式指定：

```bash
# macOS / Linux
VERSION=v0.1.0 curl -fsSL https://raw.githubusercontent.com/DTim887/skill-mesh/main/install.sh | sh
```

```powershell
# Windows
$env:VERSION = "v0.1.0"; irm https://raw.githubusercontent.com/DTim887/skill-mesh/main/install.ps1 | iex
```

## 手动安装（不想执行远程脚本时）

1. 打开 [Releases 页面](https://github.com/DTim887/skill-mesh/releases)，找到想要的版本，复制该版本
   下 `skillmesh-*.tgz` 资源的下载地址。
2. 执行：

   ```bash
   npm install -g <上一步复制的下载地址> --allow-remote=all
   ```

   > `--allow-remote=all` 是必需的：npm 12 起默认拒绝安装任何跟当前 registry 不同主机名的 tarball
   > URL（我们的安装包挂在 `github.com` 的 Release 资源上），不加这个参数会报
   > `EALLOWREMOTE`/"Refusing to fetch" 错误。

## 卸载

```bash
npm uninstall -g skillmesh
```

## 常见问题排查

### 提示"未检测到 Node.js"或"Node.js 版本过低"

`skillmesh` 需要 Node.js 20 及以上版本。去 [nodejs.org](https://nodejs.org) 下载安装（或用
`nvm`/`fnm` 等版本管理工具切换到符合要求的版本）后重新执行安装命令即可，脚本不会替你自动安装
Node.js。

### 提示"网络连接失败"

安装脚本需要能访问 `github.com`（下载安装包）和 `api.github.com`（查询版本信息）。如果你在公司
内网环境，请确认已连接内网/VPN 后重试；如果问题持续，可以联系 IT 支持确认这两个域名是否被防火墙
拦截。

### 安装时提示权限不足

`npm install -g` 默认会往系统全局目录写入文件，某些机器上的当前用户可能没有这个权限。可以尝试：

- 在命令前加 `sudo`（macOS/Linux）：`sudo npm install -g <下载地址> --allow-remote=all`
- 或参考 npm 官方文档配置一个当前用户有写权限的全局安装目录

### 装完之后，命令行找不到 `skillmesh`

大概率是全局 npm bin 目录不在你的 `PATH` 里，或者你用 `nvm` 之类的工具管理多个 Node.js 版本、当前
激活的版本和装 `skillmesh` 时用的版本不是同一个。检查 `npm bin -g` 输出的路径是否在 `PATH` 中，或
重新在当前激活的 Node.js 版本下执行一次安装命令。

## 下一步

安装完成后，运行：

```bash
skillmesh init
```

初始化你的第一个 skillmesh 工作区。
