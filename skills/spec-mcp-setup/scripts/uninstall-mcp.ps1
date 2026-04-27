param(
  [string]$Tool
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SkillDir = Split-Path -Parent $ScriptDir
. (Join-Path $ScriptDir 'lib-toml.ps1')
$ToolsJson = Get-Content -Raw (Join-Path $SkillDir 'mcp-tools.json') | ConvertFrom-Json -AsHashtable
$HostInfo = & (Join-Path $ScriptDir 'detect-host.ps1') | ConvertFrom-Json
$DetectedHost = $HostInfo.host
$Platform = $HostInfo.platform

function Resolve-PathTemplate {
  param([string]$Template)
  if ($Template.StartsWith('$HOME')) {
    return $HOME + $Template.Substring(5)
  }
  return $Template
}

function Remove-ClaudeEntry {
  param([string]$ConfigPath, [string]$ToolId)
  if (-not (Test-Path $ConfigPath)) { return }
  $config = try { Get-Content -Raw $ConfigPath | ConvertFrom-Json -AsHashtable } catch { @{} }
  if ($config.ContainsKey('mcpServers')) {
    $null = $config['mcpServers'].Remove($ToolId)
  }
  $config | ConvertTo-Json -Depth 8 | Set-Content -Encoding utf8 $ConfigPath
}

function Remove-CodexEntry {
  param([string]$ConfigPath, [string]$DetectKey)
  if (-not (Test-Path $ConfigPath)) { return }
  $text = Get-Content -Raw $ConfigPath
  $text = Remove-TomlMcpSection -Text $text -Key $DetectKey
  Set-Content -Encoding utf8 $ConfigPath ($(if ($text) { $text + "`n" } else { '' }))
}

$toolIds = if ([string]::IsNullOrWhiteSpace($Tool)) {
  @($ToolsJson.tools | ForEach-Object { $_.id })
} else {
  @($Tool)
}

foreach ($toolId in $toolIds) {
  $toolDef = @($ToolsJson.tools | Where-Object { $_.id -eq $toolId })[0]
  if ($null -eq $toolDef) { continue }
  $detectKey = $toolDef.detection.key
  foreach ($targetKey in @($toolDef.host_config[$DetectedHost].uninstall_targets)) {
    $target = $toolDef.host_config[$DetectedHost].targets[$targetKey]
    $rawPath = if ($target.config_path -is [hashtable]) { $target.config_path[$Platform] } else { $target.config_path }
    if ([string]::IsNullOrWhiteSpace($rawPath)) { continue }
    $configPath = Resolve-PathTemplate $rawPath
    if ($DetectedHost -eq 'claude') {
      Remove-ClaudeEntry -ConfigPath $configPath -ToolId $detectKey
    } else {
      Remove-CodexEntry -ConfigPath $configPath -DetectKey $detectKey
    }
  }
}

$refreshStatus = 'ready'
try {
  & (Join-Path $ScriptDir 'verify-tools.ps1') *> $null
  if ($LASTEXITCODE -is [int] -and $LASTEXITCODE -ne 0) {
    $refreshStatus = 'failed'
  }
} catch {
  $refreshStatus = 'failed'
}

[pscustomobject]@{
  host = $DetectedHost
  platform = $Platform
  removed_tools = @($toolIds)
  readiness_refresh = $refreshStatus
} | ConvertTo-Json -Compress
