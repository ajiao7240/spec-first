param(
  [string]$Install,
  [string]$Skip
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SkillDir = Split-Path -Parent $ScriptDir
$ToolsJsonPath = Join-Path $SkillDir 'mcp-tools.json'
$ToolsJson = Get-Content -Raw $ToolsJsonPath | ConvertFrom-Json
$HostInfo = & (Join-Path $ScriptDir 'detect-host.ps1') | ConvertFrom-Json
$DetectedHost = $HostInfo.host
$HostDisplayName = $HostInfo.display_name
$CliCommand = $HostInfo.cli_command
$ConfigPath = $HostInfo.config_path
$LockFile = "$ConfigPath.lock"
$ConfigDir = Split-Path -Parent $ConfigPath

New-Item -ItemType Directory -Force -Path $ConfigDir | Out-Null

$env:PATH = "$HOME/.cargo/bin;$HOME/.fnm/aliases/default/bin;$HOME/.local/bin;$env:PATH"

function Parse-List {
  param([string]$Value)
  if ([string]::IsNullOrWhiteSpace($Value)) { return @() }
  return @($Value -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ })
}

$InstallArray = Parse-List $Install
$SkipArray = Parse-List $Skip

function Should-Install {
  param(
    [string]$ToolId,
    [string]$Category
  )

  if ($SkipArray -contains $ToolId) {
    return $false
  }

  if ($InstallArray.Count -gt 0) {
    return $InstallArray -contains $ToolId
  }

  return $Category -eq 'required'
}

function Backup-Config {
  if (Test-Path $ConfigPath) {
    $timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
    $backup = "$ConfigPath.backup.$timestamp"
    Copy-Item $ConfigPath $backup -Force
    return $backup
  }
  return $null
}

function Acquire-Lock {
  try {
    $script:LockHandle = $null
    $script:LockHandle = [System.IO.File]::Open($LockFile, [System.IO.FileMode]::OpenOrCreate, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
    return $true
  } catch {
    Write-Host "⚠️  无法创建锁文件" -ForegroundColor Yellow
    return $false
  }
}

function Release-Lock {
  if ($script:LockHandle) {
    $script:LockHandle.Close()
    $script:LockHandle.Dispose()
    $script:LockHandle = $null
  }
  Remove-Item $LockFile -Force -ErrorAction SilentlyContinue
}

function Tool-IsConfigured {
  param([string]$ToolId)

  if (-not (Test-Path $ConfigPath)) {
    return $false
  }

  if ($DetectedHost -eq 'claude') {
    try {
      $config = Get-Content -Raw $ConfigPath | ConvertFrom-Json
      return $null -ne $config.mcpServers.PSObject.Properties[$ToolId]
    } catch {
      return $false
    }
  }

  return [bool](Select-String -Path $ConfigPath -SimpleMatch "[mcp_servers.$ToolId]" -Quiet)
}

function Add-ToolConfig {
  param([string]$ToolId)

  $tool = $ToolsJson.tools | Where-Object { $_.id -eq $ToolId } | Select-Object -First 1
  if (-not $tool) {
    throw "未知工具：$ToolId"
  }

  $command = $tool.mcp_config.command

  if ($DetectedHost -eq 'claude') {
    $configJson = $tool.mcp_config | Select-Object command, args | ConvertTo-Json -Compress -Depth 6
    & $CliCommand mcp add-json --scope user $ToolId $configJson
    return
  }

  $toolArgs = @()
  foreach ($arg in $tool.mcp_config.args) {
    $toolArgs += $arg
  }

  & $CliCommand mcp add $ToolId -- $command @toolArgs
}

function Restore-Config {
  param(
    [string]$BackupFile,
    [bool]$CreatedDuringRun
  )

  if ($BackupFile -and (Test-Path $BackupFile)) {
    Copy-Item $BackupFile $ConfigPath -Force
  } elseif ($CreatedDuringRun) {
    Remove-Item $ConfigPath -Force -ErrorAction SilentlyContinue
  }
}

function Configure-Tool {
  param([string]$ToolId)

  if (Tool-IsConfigured $ToolId) {
    Write-Host "  ⏭️  $ToolId: already configured, skipping"
    return $true
  }

  Write-Host "  ⏳ Configuring $ToolId for $HostDisplayName..."
  try {
    Add-ToolConfig $ToolId
  } catch {
    Write-Host "  ❌ $ToolId: configuration failed" -ForegroundColor Red
    return $false
  }

  if (Tool-IsConfigured $ToolId) {
    Write-Host "  ✅ $ToolId: configured"
    return $true
  }

  Write-Host "  ❌ $ToolId: CLI completed but configuration is still missing" -ForegroundColor Red
  return $false
}

$tools = $ToolsJson.tools

$backupFile = $null
$results = New-Object System.Collections.Generic.List[string]
$failed = New-Object System.Collections.Generic.List[string]
$createdDuringRun = -not (Test-Path $ConfigPath)

if (-not (Acquire-Lock)) {
  exit 1
}

try {
  $backupFile = Backup-Config
  if ($backupFile) {
    Write-Host "📦 Backup created: $backupFile"
  }

  Write-Host ""
  Write-Host "🔧 MCP Tools Installation"
  Write-Host "========================"
  Write-Host "Host: $HostDisplayName"
  Write-Host "Config: $ConfigPath"
  Write-Host "🧭 我会先检查当前宿主的配置，再逐个补齐缺失工具。"
  Write-Host ""

  foreach ($tool in $tools) {
    if (-not (Should-Install $tool.id $tool.category)) {
      continue
    }

    Write-Host "Processing: $($tool.id) ($($tool.category))"
    Write-Host "  → 正在为 $HostDisplayName 写入 $($tool.id) 配置"

    if (-not (Configure-Tool $tool.id)) {
      Restore-Config -BackupFile $backupFile -CreatedDuringRun $createdDuringRun
      $failed.Add($tool.id)
      continue
    }

    $results.Add($tool.id)
  }

  Write-Host ""
  Write-Host "========================"
  Write-Host "📋 Installation Summary"
  Write-Host ""

  if ($results.Count -gt 0) {
    Write-Host "✅ Processed: $($results -join ' ')"
  }

  if ($failed.Count -gt 0) {
    Write-Host "❌ Failed: $($failed -join ' ')"
  }

  if (($failed.Count -eq 0) -and $backupFile) {
    Remove-Item $backupFile -Force -ErrorAction SilentlyContinue
    Write-Host "🗑️  Backup removed (all succeeded)"
  } elseif ($backupFile) {
    Write-Host "⚠️  Backup preserved at: $backupFile"
    Write-Host "   To restore: Copy-Item $backupFile $ConfigPath"
  }

  Write-Host ""
  Write-Host "⚠️  Please restart $HostDisplayName for changes to take effect."

  if (($results.Count -eq 0) -and ($failed.Count -eq 0)) {
    Write-Host "✅ 当前宿主已经就绪，没有发现需要补充的 MCP 工具。"
  }

  if ($failed.Count -gt 0) {
    exit 1
  }
} finally {
  Release-Lock
}
