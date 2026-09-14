#!/bin/sh
# install.sh 自建断言测试——不引入 bats-core，用 PATH-shim 的假 curl/node/npm/skillmesh 覆盖
# 各行为分支（见 specs/003-install-command/research.md 决策 1）。
#
# 运行方式：npm run test:install-sh（package.json 已配置为 `sh test/install/install.sh.test.sh`）
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
INSTALL_SH="$REPO_ROOT/install.sh"
FIXTURES="$SCRIPT_DIR/fixtures"
SYSTEM_PATH="$PATH"

pass_count=0
fail_count=0
WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT

assert_contains() {
  # $1: 用例描述  $2: haystack  $3: needle
  case "$2" in
    *"$3"*)
      pass_count=$((pass_count + 1))
      ;;
    *)
      fail_count=$((fail_count + 1))
      printf 'FAIL: %s\n  期望输出包含: %s\n  实际输出:\n%s\n' "$1" "$3" "$2" >&2
      ;;
  esac
}

assert_not_contains() {
  # $1: 用例描述  $2: haystack  $3: 不应出现的 needle
  case "$2" in
    *"$3"*)
      fail_count=$((fail_count + 1))
      printf 'FAIL: %s\n  期望输出不包含: %s\n  实际输出:\n%s\n' "$1" "$3" "$2" >&2
      ;;
    *)
      pass_count=$((pass_count + 1))
      ;;
  esac
}

assert_exit_code() {
  # $1: 用例描述  $2: 实际退出码  $3: 期望退出码
  if [ "$2" -eq "$3" ]; then
    pass_count=$((pass_count + 1))
  else
    fail_count=$((fail_count + 1))
    printf 'FAIL: %s\n  期望退出码: %s\n  实际退出码: %s\n' "$1" "$3" "$2" >&2
  fi
}

assert_file_missing() {
  # $1: 用例描述  $2: 文件路径（存在即失败，用于断言 npm 未被调用）
  if [ -e "$2" ]; then
    fail_count=$((fail_count + 1))
    printf 'FAIL: %s\n  期望文件不存在: %s\n' "$1" "$2" >&2
  else
    pass_count=$((pass_count + 1))
  fi
}

# 运行 install.sh 一次，把输出写到 $WORKDIR/output、退出码写到 $WORKDIR/exit_code
# 调用方在此之前自行设置好所需的 FAKE_*/SKILLMESH_INSTALL_TEST_TTY/VERSION 等环境变量
run_install() {
  set +e
  sh "$INSTALL_SH" >"$WORKDIR/output" 2>&1
  echo "$?" > "$WORKDIR/exit_code"
  set -e
}

output() { cat "$WORKDIR/output"; }
exit_code() { cat "$WORKDIR/exit_code"; }

reset_env() {
  unset VERSION FAKE_CURL_FAIL FAKE_CURL_RESPONSE_FILE FAKE_NODE_VERSION \
    FAKE_NPM_FAIL FAKE_NPM_CALL_LOG FAKE_SKILLMESH_INSTALLED_VERSION \
    SKILLMESH_INSTALL_TEST_TTY 2>/dev/null || true
  PATH="$FIXTURES/bin:$SYSTEM_PATH"
  export PATH
  FAKE_NODE_VERSION="v20.11.0"
  FAKE_CURL_RESPONSE_FILE="$FIXTURES/json/release-v0.2.0.json"
  FAKE_NPM_CALL_LOG="$WORKDIR/npm-calls.log"
  export FAKE_NODE_VERSION FAKE_CURL_RESPONSE_FILE FAKE_NPM_CALL_LOG
  rm -f "$WORKDIR/npm-calls.log"
}

# ---- 用例 1：Node 版本不足 ----
reset_env
FAKE_NODE_VERSION="v18.19.0"
export FAKE_NODE_VERSION
run_install
assert_exit_code "Node 版本不足时退出码为 2" "$(exit_code)" 2
assert_contains "Node 版本不足时提示包含 Node.js 字样" "$(output)" "Node.js"
assert_file_missing "Node 版本不足时不应调用 npm" "$WORKDIR/npm-calls.log"

# ---- 用例 2：网络请求失败 ----
reset_env
FAKE_CURL_FAIL=1
export FAKE_CURL_FAIL
run_install
assert_exit_code "网络请求失败时退出码为 3" "$(exit_code)" 3
assert_contains "网络请求失败时提示面向非技术用户" "$(output)" "网络连接失败"
assert_file_missing "网络请求失败时不应调用 npm" "$WORKDIR/npm-calls.log"

# ---- 用例 3：未安装场景，确认同意，安装成功 ----
reset_env
echo "y" > "$WORKDIR/tty-yes"
SKILLMESH_INSTALL_TEST_TTY="$WORKDIR/tty-yes"
export SKILLMESH_INSTALL_TEST_TTY
run_install
assert_exit_code "未安装场景同意确认后退出码为 0" "$(exit_code)" 0
assert_contains "未安装场景提示文案正确" "$(output)" "即将安装 skillmesh v0.2.0"
assert_contains "安装成功后打印版本号与下一步引导" "$(output)" "skillmesh v0.2.0 安装成功"
assert_contains "安装成功提示运行 skillmesh init" "$(output)" "skillmesh init"
assert_contains "npm 收到正确的 tarball 下载地址" "$(cat "$WORKDIR/npm-calls.log")" "skillmesh-0.2.0.tgz"

# ---- 用例 4：未安装场景，拒绝确认，不执行安装 ----
reset_env
echo "n" > "$WORKDIR/tty-no"
SKILLMESH_INSTALL_TEST_TTY="$WORKDIR/tty-no"
export SKILLMESH_INSTALL_TEST_TTY
run_install
assert_exit_code "拒绝确认后退出码为 0（非错误）" "$(exit_code)" 0
assert_contains "拒绝确认后提示已取消" "$(output)" "已取消"
assert_file_missing "拒绝确认后不应调用 npm" "$WORKDIR/npm-calls.log"

# ---- 用例 5：拒绝确认（空输入，直接回车） ----
reset_env
printf '\n' > "$WORKDIR/tty-empty"
SKILLMESH_INSTALL_TEST_TTY="$WORKDIR/tty-empty"
export SKILLMESH_INSTALL_TEST_TTY
run_install
assert_exit_code "空输入视为拒绝，退出码为 0" "$(exit_code)" 0
assert_contains "空输入提示已取消" "$(output)" "已取消"
assert_file_missing "空输入不应调用 npm" "$WORKDIR/npm-calls.log"

# ---- 用例 6：无可用真实终端（/dev/tty 不可用）时按同意继续（FR-016） ----
# 用一个父目录都不存在的路径，确保 `exec 3<>` 真的打开失败（而不是像 `<>` 对普通文件那样
# 顺手把它创建出来，见 install.sh 里 read_confirm 的说明）。
reset_env
SKILLMESH_INSTALL_TEST_TTY="$WORKDIR/no-such-dir/tty"
export SKILLMESH_INSTALL_TEST_TTY
run_install
assert_exit_code "无可用终端时按同意继续，退出码为 0" "$(exit_code)" 0
assert_contains "无可用终端时仍完成安装" "$(output)" "安装成功"
assert_contains "无可用终端时 npm 仍被调用" "$(cat "$WORKDIR/npm-calls.log")" "skillmesh-0.2.0.tgz"

# ---- 用例 7：已安装旧版本，确认同意，完成升级 ----
reset_env
PATH="$FIXTURES/installed-bin:$PATH"
export PATH
FAKE_SKILLMESH_INSTALLED_VERSION="0.1.0"
export FAKE_SKILLMESH_INSTALLED_VERSION
echo "y" > "$WORKDIR/tty-yes2"
SKILLMESH_INSTALL_TEST_TTY="$WORKDIR/tty-yes2"
export SKILLMESH_INSTALL_TEST_TTY
run_install
assert_exit_code "升级场景同意确认后退出码为 0" "$(exit_code)" 0
assert_contains "升级提示包含当前版本" "$(output)" "检测到已安装 skillmesh v0.1.0"
assert_contains "升级提示包含目标版本" "$(output)" "将升级为 v0.2.0"
assert_contains "升级成功后打印新版本号" "$(output)" "skillmesh v0.2.0 安装成功"

# ---- 用例 8：已安装版本已是最新，不重复安装（FR-006） ----
reset_env
PATH="$FIXTURES/installed-bin:$PATH"
export PATH
FAKE_SKILLMESH_INSTALLED_VERSION="0.2.0"
export FAKE_SKILLMESH_INSTALLED_VERSION
run_install
assert_exit_code "已是最新版本时退出码为 0" "$(exit_code)" 0
assert_contains "已是最新版本时提示正确" "$(output)" "已经是最新版本 skillmesh 0.2.0"
assert_file_missing "已是最新版本时不应调用 npm" "$WORKDIR/npm-calls.log"

# ---- 用例 9：VERSION 环境变量覆盖，跳过查询最新（FR-004） ----
reset_env
VERSION="v0.1.0"
FAKE_CURL_RESPONSE_FILE="$FIXTURES/json/release-v0.1.0.json"
export VERSION FAKE_CURL_RESPONSE_FILE
echo "y" > "$WORKDIR/tty-yes3"
SKILLMESH_INSTALL_TEST_TTY="$WORKDIR/tty-yes3"
export SKILLMESH_INSTALL_TEST_TTY
run_install
assert_exit_code "版本覆盖场景同意确认后退出码为 0" "$(exit_code)" 0
assert_contains "版本覆盖提示安装指定版本" "$(output)" "即将安装 skillmesh v0.1.0"
assert_contains "npm 收到指定版本的 tarball 地址" "$(cat "$WORKDIR/npm-calls.log")" "skillmesh-0.1.0.tgz"

# ---- 用例 10：npm install 本身失败 ----
reset_env
FAKE_NPM_FAIL=1
export FAKE_NPM_FAIL
echo "y" > "$WORKDIR/tty-yes4"
SKILLMESH_INSTALL_TEST_TTY="$WORKDIR/tty-yes4"
export SKILLMESH_INSTALL_TEST_TTY
run_install
assert_exit_code "npm install 失败时退出码为 4" "$(exit_code)" 4
assert_contains "npm install 失败时提示面向非技术用户" "$(output)" "安装失败"
assert_not_contains "npm install 失败时不直接展示裸错误堆栈" "$(output)" "npm ERR!"

printf '\n%s passed, %s failed\n' "$pass_count" "$fail_count"
if [ "$fail_count" -gt 0 ]; then
  exit 1
fi
