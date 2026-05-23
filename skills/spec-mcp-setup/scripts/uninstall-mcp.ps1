param(
  [string]$Tool
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SkillDir = Split-Path -Parent $ScriptDir
. (Join-Path $ScriptDir 'lib-toml.ps1')
. (Join-Path $ScriptDir 'lib-template.ps1')

function ConvertFrom-JsonCompat {
  param(
    [string]$Json,
    [switch]$AsHashtable
  )
  if ($AsHashtable -and $PSVersionTable.PSVersion.Major -ge 6) {
    return $Json | ConvertFrom-Json -AsHashtable
  }
  return $Json | ConvertFrom-Json
}

$ToolsJson = Read-McpToolsJson -Path (Join-Path $SkillDir 'mcp-tools.json') -AsHashtable
Assert-McpToolsSchemaVersion -ToolsJson $ToolsJson
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
  $backupPath = '{0}.backup.{1}' -f $ConfigPath, ([guid]::NewGuid().ToString('N'))
  Copy-Item -LiteralPath $ConfigPath -Destination $backupPath -Force
  try {
    $parsed = ConvertFrom-JsonCompat -Json (Get-Content -Raw $ConfigPath) -AsHashtable
    $config = ConvertTo-MutableHashtable -Object $parsed
    if ($config.Contains('mcpServers')) {
      $null = $config['mcpServers'].Remove($ToolId)
    }
    Set-TextFileAtomic -Path $ConfigPath -Value ($config | ConvertTo-Json -Depth 8)
    Remove-Item -Force $backupPath -ErrorAction SilentlyContinue
  } catch {
    Copy-Item -LiteralPath $backupPath -Destination $ConfigPath -Force
    Remove-Item -Force $backupPath -ErrorAction SilentlyContinue
    throw
  }
}

function Remove-CodexEntry {
  param([string]$ConfigPath, [string]$DetectKey)
  if (-not (Test-Path $ConfigPath)) { return }
  $backupPath = '{0}.backup.{1}' -f $ConfigPath, ([guid]::NewGuid().ToString('N'))
  Copy-Item -LiteralPath $ConfigPath -Destination $backupPath -Force
  try {
    $text = Get-Content -Raw $ConfigPath
    $text = Remove-TomlMcpSection -Text $text -Key $DetectKey
    Set-TextFileAtomic -Path $ConfigPath -Value ($(if ($text) { $text + "`n" } else { '' }))
    Remove-Item -Force $backupPath -ErrorAction SilentlyContinue
  } catch {
    Copy-Item -LiteralPath $backupPath -Destination $ConfigPath -Force
    Remove-Item -Force $backupPath -ErrorAction SilentlyContinue
    throw
  }
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
    $configPathValue = Get-ToolField -Tool $target -Name 'config_path'
    $rawPath = if ($configPathValue -is [string]) { [string]$configPathValue } else { [string](Get-ToolField -Tool $configPathValue -Name $Platform) }
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
