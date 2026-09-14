#!/bin/sh
# skillmesh 一键安装脚本（macOS / Linux）
#
# 用法：
#   curl -fsSL https://raw.githubusercontent.com/DTim887/skill-mesh/main/install.sh | sh
#   VERSION=v0.1.0 curl -fsSL https://raw.githubusercontent.com/DTim887/skill-mesh/main/install.sh | sh
#
# 契约（调用方式/输入/输出/退出码）见 specs/003-install-command/contracts/install-script.md
set -eu

REPO="DTim887/skill-mesh"
MIN_NODE_MAJOR=20

EXIT_OK=0
EXIT_UNCLASSIFIED=1
EXIT_NODE_VERSION=2
EXIT_NETWORK=3
EXIT_NPM_INSTALL=4

# 任何未经上述已分类退出码显式处理的失败（如临时文件创建失败等意外情况），统一归一化为
# EXIT_UNCLASSIFIED，保持与 contracts/install-script.md 退出码表一致
normalize_exit_code() {
  code=$?
  case "$code" in
    "$EXIT_OK" | "$EXIT_NODE_VERSION" | "$EXIT_NETWORK" | "$EXIT_NPM_INSTALL") ;;
    *) exit "$EXIT_UNCLASSIFIED" ;;
  esac
}
trap normalize_exit_code EXIT

fail() {
  # $1: 退出码  $2: 面向非技术用户的中文提示
  printf '%s\n' "$2" >&2
  exit "$1"
}

check_node_version() {
  if ! command -v node >/dev/null 2>&1; then
    fail "$EXIT_NODE_VERSION" "未检测到 Node.js。skillmesh 需要 Node.js >= ${MIN_NODE_MAJOR}，请先安装（https://nodejs.org）后重试。"
  fi

  node_version=$(node -v)
  node_major=$(printf '%s' "$node_version" | sed -E 's/^v([0-9]+)\..*/\1/')

  if [ -z "$node_major" ] || [ "$node_major" -lt "$MIN_NODE_MAJOR" ]; then
    fail "$EXIT_NODE_VERSION" "当前 Node.js 版本为 ${node_version}，skillmesh 需要 Node.js >= ${MIN_NODE_MAJOR}。请升级 Node.js（https://nodejs.org）后重试。"
  fi
}

# 设置全局变量 TARGET_TAG（如 v0.1.0）、TARGET_URL（tarball 下载地址）
resolve_target_version() {
  if [ -n "${VERSION:-}" ]; then
    api_url="https://api.github.com/repos/${REPO}/releases/tags/${VERSION}"
  else
    api_url="https://api.github.com/repos/${REPO}/releases/latest"
  fi

  if ! response=$(curl -fsSL -H "Accept: application/vnd.github+json" -H "User-Agent: skillmesh-install-script" "$api_url" 2>/dev/null); then
    fail "$EXIT_NETWORK" "网络连接失败，无法获取 skillmesh 发布信息，请检查是否已连接公司内网/VPN 后重试。"
  fi

  TARGET_TAG=$(printf '%s' "$response" | grep -o '"tag_name"[[:space:]]*:[[:space:]]*"[^"]*"' | head -n1 | sed -E 's/.*"([^"]*)"$/\1/')
  TARGET_URL=$(printf '%s' "$response" | grep -o '"browser_download_url"[[:space:]]*:[[:space:]]*"[^"]*\.tgz"' | head -n1 | sed -E 's/.*"(https:[^"]*)"$/\1/')

  if [ -z "$TARGET_TAG" ] || [ -z "$TARGET_URL" ]; then
    fail "$EXIT_NETWORK" "未能获取到可安装的 skillmesh 发布版本，请检查网络连接或稍后重试。"
  fi
}

# 设置全局变量 INSTALLED_VERSION（未安装时为空字符串，不带 v 前缀）
detect_installed() {
  INSTALLED_VERSION=""
  if command -v skillmesh >/dev/null 2>&1; then
    # skillmesh --version 输出形如："skillmesh/0.1.0 darwin-arm64 node-v20.11.0"
    INSTALLED_VERSION=$(skillmesh --version 2>/dev/null | cut -d ' ' -f1 | cut -d '/' -f2)
  fi
}

# $1: 提示文案（含 "(y/N) " 后缀）；返回 0 表示同意，非 0 表示拒绝
#
# 读取来源固定是 /dev/tty（而非标准输入），确保通过管道执行（curl ... | sh）时确认交互依然生效
# （FR-016）。SKILLMESH_INSTALL_TEST_TTY 是仅供 test/install/install.sh.test.sh 使用的测试专用
# 覆盖点——不是面向真实用户的接口，正常使用时不会设置这个变量，行为与文档一致。
read_confirm() {
  tty_source="${SKILLMESH_INSTALL_TEST_TTY:-/dev/tty}"
  if [ -r "$tty_source" ]; then
    printf '%s' "$1"
    if ! read -r answer < "$tty_source"; then
      answer=""
    fi
  else
    # 无可用真实终端（如脚本被用在非交互自动化场景）：视为非交互环境，按同意继续（FR-016）
    return 0
  fi

  case "$answer" in
    y | Y) return 0 ;;
    *) return 1 ;;
  esac
}

do_install() {
  install_log="${TMPDIR:-/tmp}/skillmesh-install-$$.log"
  if ! npm install -g "$TARGET_URL" >"$install_log" 2>&1; then
    fail "$EXIT_NPM_INSTALL" "安装失败，请检查网络连接或全局安装权限（必要时可尝试加 sudo 重试）。详细日志见：${install_log}"
  fi
  rm -f "$install_log"
}

main() {
  check_node_version
  resolve_target_version
  detect_installed

  target_version=${TARGET_TAG#v}

  if [ -z "$INSTALLED_VERSION" ]; then
    prompt="即将安装 skillmesh ${TARGET_TAG}，是否继续？(y/N) "
  elif [ "$INSTALLED_VERSION" = "$target_version" ]; then
    printf '已经是最新版本 skillmesh %s，无需重复安装。\n' "$INSTALLED_VERSION"
    exit "$EXIT_OK"
  else
    prompt="检测到已安装 skillmesh v${INSTALLED_VERSION}
将升级为 ${TARGET_TAG}，是否继续？(y/N) "
  fi

  if ! read_confirm "$prompt"; then
    printf '\n已取消，未做任何改动\n'
    exit "$EXIT_OK"
  fi

  do_install

  printf '\n✓ skillmesh %s 安装成功\n运行 `skillmesh init` 开始使用\n' "$TARGET_TAG"
}

main "$@"
