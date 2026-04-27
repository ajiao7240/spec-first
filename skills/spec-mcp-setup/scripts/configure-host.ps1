param(
  [string]$Tool
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($Tool)) {
  throw '缺少 -Tool 参数'
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SkillDir = Split-Path -Parent $ScriptDir
. (Join-Path $ScriptDir 'lib-toml.ps1')
$ToolsJson = Get-Content -Raw (Join-Path $SkillDir 'mcp-tools.json') | ConvertFrom-Json
$HostInfo = & (Join-Path $ScriptDir 'detect-host.ps1') | ConvertFrom-Json
$DetectedHost = $HostInfo.host
$SelectedScope = $HostInfo.selected_scope
$ConfigPath = $HostInfo.config_path
$ToolDef = @($ToolsJson.tools | Where-Object { $_.id -eq $Tool })[0]
if ($null -eq $ToolDef) {
  throw "未知工具: $Tool"
}
if ([string]::IsNullOrWhiteSpace($SelectedScope)) {
  throw '未找到可用宿主配置目标'
}
$HostConfig = $ToolDef.host_config.$DetectedHost
if ($null -eq $HostConfig) {
  throw "未找到 $Tool 的 host_config.$DetectedHost"
}

$resolvedArgs = @($HostConfig.args)
$ResolvedConfig = [ordered]@{ command = $HostConfig.command; args = $resolvedArgs; scope = $SelectedScope }
if ($null -ne $HostConfig.PSObject.Properties['startup_timeout_sec']) {
  $ResolvedConfig['startup_timeout_sec'] = [int]$HostConfig.startup_timeout_sec
}
$FallbackApplied = ($DetectedHost -eq 'claude' -and $SelectedScope -ne 'managed')

function Test-ToolConfigured {
  if (-not (Test-Path $ConfigPath)) { return $false }
  switch ($ToolDef.detection.kind) {
    'host_config_exact' {
      if ($DetectedHost -eq 'claude') {
        $config = Get-Content -Raw $ConfigPath | ConvertFrom-Json
        $server = $config.mcpServers.PSObject.Properties[$ToolDef.detection.key].Value
        if ($null -eq $server) { return $false }
        if ($server.command -ne $ResolvedConfig.command) { return $false }
        $serverArgs = @($server.args)
        $expectedArgs = @($ResolvedConfig.args)
        if ($serverArgs.Count -ne $expectedArgs.Count) { return $false }
        for ($i = 0; $i -lt $expectedArgs.Count; $i++) {
          if ($serverArgs[$i] -ne $expectedArgs[$i]) { return $false }
        }
        return $true
      }
      $section = Get-TomlMcpSection -Path $ConfigPath -Key $ToolDef.detection.key
      if ([string]::IsNullOrWhiteSpace($section)) { return $false }
      if (-not $section.Contains("command = `"$($ResolvedConfig.command)`"")) { return $false }
      foreach ($arg in @($ResolvedConfig.args)) {
        if (-not $section.Contains($arg)) { return $false }
      }
      return $true
    }
    'host_config_key_only' {
      if ($DetectedHost -eq 'claude') {
        $config = Get-Content -Raw $ConfigPath | ConvertFrom-Json
        return $null -ne $config.mcpServers.PSObject.Properties[$ToolDef.detection.key]
      }
      return -not [string]::IsNullOrWhiteSpace((Get-TomlMcpSection -Path $ConfigPath -Key $ToolDef.detection.key))
    }
    default { return $false }
  }
}

function Write-ClaudeConfig {
  param([hashtable]$FinalConfig)
  $config = if (Test-Path $ConfigPath) {
    try { Get-Content -Raw $ConfigPath | ConvertFrom-Json -AsHashtable } catch { @{} }
  } else {
    @{}
  }
  if (-not $config.ContainsKey('mcpServers')) { $config['mcpServers'] = @{} }
  $config['mcpServers'][$ToolDef.detection.key] = $FinalConfig
  $config | ConvertTo-Json -Depth 8 | Set-Content -Encoding utf8 $ConfigPath
}

function Write-CodexConfig {
  param([hashtable]$FinalConfig)
  $command = $FinalConfig.command
  $argsJson = @($FinalConfig.args) | ConvertTo-Json -Compress
  $timeoutLine = if ($FinalConfig.ContainsKey('startup_timeout_sec')) { "`nstartup_timeout_sec = $($FinalConfig.startup_timeout_sec)" } else { '' }
  $sectionBody = "command = `"$command`"`nargs = $argsJson$timeoutLine"
  Write-TomlMcpSection -Path $ConfigPath -Key $ToolDef.detection.key -Body $sectionBody
}

function Restore-Backup {
  param([string]$BackupPath)
  if ([string]::IsNullOrWhiteSpace($BackupPath)) { return }
  if ($BackupPath -eq '__missing__') {
    if (Test-Path $ConfigPath) { Remove-Item -Force $ConfigPath }
    return
  }
  if (Test-Path $BackupPath) {
    Move-Item -Force $BackupPath $ConfigPath
  }
}

function Acquire-ConfigLock {
  $LockPath = "$ConfigPath.lock"
  $lockDir = Split-Path -Parent $LockPath
  if (-not (Test-Path $lockDir)) {
    New-Item -ItemType Directory -Force -Path $lockDir | Out-Null
  }

  $deadline = (Get-Date).AddSeconds(10)
  while ((Get-Date) -lt $deadline) {
    try {
      return [System.IO.File]::Open($LockPath, [System.IO.FileMode]::OpenOrCreate, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
    } catch {
      Start-Sleep -Milliseconds 100
    }
  }
  throw "无法获取配置锁: $LockPath"
}

function Release-ConfigLock {
  param($LockHandle)
  if ($null -ne $LockHandle) {
    $LockHandle.Dispose()
  }
}

$ConfigDir = Split-Path -Parent $ConfigPath
if (-not (Test-Path $ConfigDir)) {
  New-Item -ItemType Directory -Force -Path $ConfigDir | Out-Null
}

$ConfigLock = $null
try {
  $ConfigLock = Acquire-ConfigLock

  if (Test-ToolConfigured) {
    [pscustomobject]@{
      tool_id = $Tool
      configured_path = $ConfigPath
      selected_scope = $SelectedScope
      fallback_applied = [bool]$FallbackApplied
    } | ConvertTo-Json -Compress
    return
  }

  $backupPath = if (Test-Path $ConfigPath) {
    $path = '{0}.backup.{1}' -f $ConfigPath, ([guid]::NewGuid().ToString('N'))
    Copy-Item $ConfigPath $path
    $path
  } else {
    '__missing__'
  }

  try {
    if ($DetectedHost -eq 'claude') {
      Write-ClaudeConfig -FinalConfig $ResolvedConfig
    } else {
      Write-CodexConfig -FinalConfig $ResolvedConfig
    }

    if (-not (Test-ToolConfigured)) {
      throw "$Tool 配置后仍未检测到有效宿主配置"
    }

    if ($backupPath -ne '__missing__' -and (Test-Path $backupPath)) {
      Remove-Item -Force $backupPath
    }

    [pscustomobject]@{
      tool_id = $Tool
      configured_path = $ConfigPath
      selected_scope = $SelectedScope
      fallback_applied = [bool]$FallbackApplied
    } | ConvertTo-Json -Compress
  } catch {
    Restore-Backup -BackupPath $backupPath
    throw
  }
} finally {
  Release-ConfigLock -LockHandle $ConfigLock
}
