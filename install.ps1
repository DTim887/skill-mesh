#Requires -Version 5.1
# skillmesh 一键安装脚本（Windows PowerShell）
#
# 用法：
#   irm https://raw.githubusercontent.com/DTim887/skill-mesh/main/install.ps1 | iex
#   $env:VERSION = "v0.1.0"; irm https://raw.githubusercontent.com/DTim887/skill-mesh/main/install.ps1 | iex
#
# 契约（调用方式/输入/输出/退出码）见 specs/003-install-command/contracts/install-script.md
Set-StrictMode -Version Latest

$Repo = 'DTim887/skill-mesh'
$MinNodeMajor = 20

$ExitOk = 0
$ExitUnclassified = 1
$ExitNodeVersion = 2
$ExitNetwork = 3
$ExitNpmInstall = 4

function Write-Fail {
    param([int]$Code, [string]$Message)
    Write-Host $Message -ForegroundColor Red
    exit $Code
}

function Test-NodeVersion {
    $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
    if (-not $nodeCmd) {
        Write-Fail $ExitNodeVersion "未检测到 Node.js。skillmesh 需要 Node.js >= $MinNodeMajor，请先安装（https://nodejs.org）后重试。"
    }

    $nodeVersionRaw = (node -v).Trim()
    $nodeMajor = [int]($nodeVersionRaw.TrimStart('v').Split('.')[0])

    if ($nodeMajor -lt $MinNodeMajor) {
        Write-Fail $ExitNodeVersion "当前 Node.js 版本为 $nodeVersionRaw，skillmesh 需要 Node.js >= $MinNodeMajor。请升级 Node.js（https://nodejs.org）后重试。"
    }
}

# 返回 [PSCustomObject]@{ Tag = 'v0.1.0'; Url = '<tarball 下载地址>' }
function Get-TargetVersion {
    $version = $env:VERSION
    if ($version) {
        $apiUrl = "https://api.github.com/repos/$Repo/releases/tags/$version"
    } else {
        $apiUrl = "https://api.github.com/repos/$Repo/releases/latest"
    }

    try {
        $release = Invoke-RestMethod -Uri $apiUrl -Headers @{
            'Accept'     = 'application/vnd.github+json'
            'User-Agent' = 'skillmesh-install-script'
        }
    } catch {
        Write-Fail $ExitNetwork "网络连接失败，无法获取 skillmesh 发布信息，请检查是否已连接公司内网/VPN 后重试。"
    }

    $asset = $release.assets | Where-Object { $_.name -like '*.tgz' } | Select-Object -First 1

    if (-not $release.tag_name -or -not $asset) {
        Write-Fail $ExitNetwork "未能获取到可安装的 skillmesh 发布版本，请检查网络连接或稍后重试。"
    }

    [PSCustomObject]@{
        Tag = $release.tag_name
        Url = $asset.browser_download_url
    }
}

# 返回已安装的版本号字符串（不带 v 前缀），未安装时返回 $null
function Get-InstalledVersion {
    $cmd = Get-Command skillmesh -ErrorAction SilentlyContinue
    if (-not $cmd) {
        return $null
    }

    # skillmesh --version 输出形如："skillmesh/0.1.0 win32-x64 node-v20.11.0"
    $versionOutput = (& skillmesh --version) 2>$null
    if (-not $versionOutput) {
        return $null
    }

    ($versionOutput.Split(' ')[0]).Split('/')[1]
}

function Read-Confirm {
    param([string]$Prompt)
    $answer = Read-Host -Prompt $Prompt
    return ($answer -eq 'y' -or $answer -eq 'Y')
}

function Install-SkillMesh {
    param([string]$Url)

    $logFile = Join-Path $env:TEMP "skillmesh-install-$PID.log"
    npm install -g $Url *> $logFile

    if ($LASTEXITCODE -ne 0) {
        Write-Fail $ExitNpmInstall "安装失败，请检查网络连接或全局安装权限。详细日志见：$logFile"
    }

    Remove-Item $logFile -ErrorAction SilentlyContinue
}

function Main {
    Test-NodeVersion
    $target = Get-TargetVersion
    $installedVersion = Get-InstalledVersion
    $targetVersion = $target.Tag.TrimStart('v')

    if (-not $installedVersion) {
        $prompt = "即将安装 skillmesh $($target.Tag)，是否继续？(y/N)"
    } elseif ($installedVersion -eq $targetVersion) {
        Write-Host "已经是最新版本 skillmesh $installedVersion，无需重复安装。"
        exit $ExitOk
    } else {
        $prompt = "检测到已安装 skillmesh v$installedVersion`n将升级为 $($target.Tag)，是否继续？(y/N)"
    }

    if (-not (Read-Confirm $prompt)) {
        Write-Host "`n已取消，未做任何改动"
        exit $ExitOk
    }

    Install-SkillMesh -Url $target.Url

    Write-Host "`n✓ skillmesh $($target.Tag) 安装成功"
    Write-Host "运行 ``skillmesh init`` 开始使用"
}

# 任何未经上述已分类退出码显式处理的异常，统一归一化为 $ExitUnclassified，
# 保持与 contracts/install-script.md 的退出码表一致
try {
    Main
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit $ExitUnclassified
}
