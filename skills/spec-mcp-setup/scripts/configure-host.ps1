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
$ToolsJson = Get-Content -Raw (Join-Path $SkillDir 'mcp-tools.json') | ConvertFrom-Json
$HostInfo = & (Join-Path $ScriptDir 'detect-host.ps1') | ConvertFrom-Json
$DetectedHost = $HostInfo.host
$ConfigPath = $HostInfo.config_path
$ToolDef = @($ToolsJson.tools | Where-Object { $_.id -eq $Tool })[0]
if ($null -eq $ToolDef) {
  throw "未知工具: $Tool"
}
$HostConfig = $ToolDef.host_config.$DetectedHost
if ($null -eq $HostConfig) {
  throw "未找到 $Tool 的 host_config.$DetectedHost"
}

function Get-TomlSectionText {
  param([string]$Path, [string]$SectionName)
  if (-not (Test-Path $Path)) { return '' }
  $header = "[mcp_servers.$SectionName]"
  $lines = Get-Content $Path
  $capturing = $false
  $buffer = New-Object System.Collections.Generic.List[string]
  foreach ($line in $lines) {
    if ($line -eq $header) { $capturing = $true; continue }
    if ($capturing -and $line -match '^\[mcp_servers\..+\]$') { break }
    if ($capturing) { $buffer.Add($line) }
  }
  $buffer -join "`n"
}

function Test-ToolConfigured {
  if (-not (Test-Path $ConfigPath)) { return $false }
  switch ($ToolDef.detection.kind) {
    'host_config_exact' {
      if ($DetectedHost -eq 'claude') {
        $config = Get-Content -Raw $ConfigPath | ConvertFrom-Json
        $server = $config.mcpServers.PSObject.Properties[$ToolDef.detection.key].Value
        if ($null -eq $server) { return $false }
        if ($server.command -ne $HostConfig.command) { return $false }
        $serverArgs = @($server.args)
        $expectedArgs = @($HostConfig.args)
        if ($serverArgs.Count -ne $expectedArgs.Count) { return $false }
        for ($i = 0; $i -lt $expectedArgs.Count; $i++) {
          if ($serverArgs[$i] -ne $expectedArgs[$i]) { return $false }
        }
        return $true
      }
      $section = Get-TomlSectionText -Path $ConfigPath -SectionName $ToolDef.detection.key
      if ([string]::IsNullOrWhiteSpace($section)) { return $false }
      if (-not $section.Contains("command = `"$($HostConfig.command)`"")) { return $false }
      foreach ($arg in @($HostConfig.args)) {
        if (-not $section.Contains($arg)) { return $false }
      }
      return $true
    }
    'host_config_key_only' {
      if ($DetectedHost -eq 'claude') {
        $config = Get-Content -Raw $ConfigPath | ConvertFrom-Json
        return $null -ne $config.mcpServers.PSObject.Properties[$ToolDef.detection.key]
      }
      return [bool](Select-String -Path $ConfigPath -SimpleMatch "[mcp_servers.$($ToolDef.detection.key)]" -Quiet)
    }
    default { return $false }
  }
}

function Write-ClaudeConfig {
  param([hashtable]$ResolvedConfig)
  $config = if (Test-Path $ConfigPath) {
    try { Get-Content -Raw $ConfigPath | ConvertFrom-Json -AsHashtable } catch { @{} }
  } else {
    @{}
  }
  if (-not $config.ContainsKey('mcpServers')) { $config['mcpServers'] = @{} }
  $config['mcpServers'][$Tool] = $ResolvedConfig
  $config | ConvertTo-Json -Depth 8 | Set-Content -Encoding utf8 $ConfigPath
}

function Write-CodexConfig {
  param([hashtable]$ResolvedConfig)
  $command = $ResolvedConfig.command
  $argsJson = @($ResolvedConfig.args) | ConvertTo-Json -Compress
  $timeoutLine = if ($ResolvedConfig.ContainsKey('startup_timeout_sec')) { "`nstartup_timeout_sec = $($ResolvedConfig.startup_timeout_sec)" } else { '' }
  $section = "[mcp_servers.$Tool]`ncommand = `"$command`"`nargs = $argsJson$timeoutLine`n"
  $text = if (Test-Path $ConfigPath) { Get-Content -Raw $ConfigPath } else { '' }
  $pattern = "(?ms)^\[mcp_servers\.$([regex]::Escape($Tool))\]`r?`n.*?(?=^\[mcp_servers\.|\z)"
  if ([regex]::IsMatch($text, $pattern)) {
    $text = [regex]::Replace($text, $pattern, $section + "`n")
  } else {
    if ($text -and -not $text.EndsWith("`n")) { $text += "`n" }
    $text += ($text ? "`n" : '') + $section + "`n"
  }
  Set-Content -Encoding utf8 $ConfigPath $text
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

if (Test-ToolConfigured) {
  return
}

$resolvedArgs = @($HostConfig.args)
$ResolvedConfig = [ordered]@{ command = $HostConfig.command; args = $resolvedArgs }
if ($null -ne $HostConfig.PSObject.Properties['startup_timeout_sec']) {
  $ResolvedConfig['startup_timeout_sec'] = [int]$HostConfig.startup_timeout_sec
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
    Write-ClaudeConfig -ResolvedConfig $ResolvedConfig
  } else {
    Write-CodexConfig -ResolvedConfig $ResolvedConfig
  }

  if (-not (Test-ToolConfigured)) {
    throw "$Tool 配置后仍未检测到有效宿主配置"
  }

  if ($backupPath -ne '__missing__' -and (Test-Path $backupPath)) {
    Remove-Item -Force $backupPath
  }
} catch {
  Restore-Backup -BackupPath $backupPath
  throw
}
