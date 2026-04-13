param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$HostInfo = & (Join-Path $ScriptDir 'detect-host.ps1') | ConvertFrom-Json
$DetectedHost = $HostInfo.host
$ConfigPath = $HostInfo.config_path
$HostSetupFile = $HostInfo.marker_path
$HostSetupDir = Split-Path -Parent $HostSetupFile
$HostContext = if ($DetectedHost -eq 'codex') { 'codex' } else { 'ide-assistant' }

function Get-ExpectedToolConfig {
  param([object]$Tool)

  $toolsJson = Get-Content -Raw (Join-Path $ScriptDir '..' 'mcp-tools.json') | ConvertFrom-Json
  $toolDef = $toolsJson.tools | Where-Object { $_.id -eq $Tool }
  $args = @()
  foreach ($arg in @($toolDef.mcp_config.args)) {
    if ($arg -eq '__HOST_CONTEXT__') {
      $args += $HostContext
    } else {
      $args += $arg
    }
  }

  return @{
    command = $toolDef.mcp_config.command
    args = $args
  }
}

function Check-McpConfigured {
  param([string]$Tool)
  $expected = Get-ExpectedToolConfig -Tool $Tool

  if (-not (Test-Path $ConfigPath)) {
    return $false
  }

  if ($DetectedHost -eq 'claude') {
    try {
      $config = Get-Content -Raw $ConfigPath | ConvertFrom-Json
      $server = $config.mcpServers.PSObject.Properties[$Tool].Value
      if ($null -eq $server) {
        return $false
      }

      $serverArgs = @($server.args)
      if ($server.command -ne $expected.command -or $serverArgs.Count -ne $expected.args.Count) {
        return $false
      }

      for ($i = 0; $i -lt $expected.args.Count; $i++) {
        if ($serverArgs[$i] -ne $expected.args[$i]) {
          return $false
        }
      }

      return $true
    } catch {
      return $false
    }
  }

  if (-not (Select-String -Path $ConfigPath -SimpleMatch "[mcp_servers.$Tool]" -Quiet)) {
    return $false
  }

  $section = Get-Content $ConfigPath
  $inSection = $false
  $sectionLines = New-Object System.Collections.Generic.List[string]

  foreach ($line in $section) {
    if ($line -eq "[mcp_servers.$Tool]") {
      $inSection = $true
      continue
    }

    if ($inSection -and $line -match '^\[mcp_servers\..+\]$') {
      break
    }

    if ($inSection) {
      $sectionLines.Add($line)
    }
  }

  $sectionText = ($sectionLines -join "`n")
  if (-not $sectionText.Contains("command = `"$($expected.command)`"")) {
    return $false
  }

  foreach ($expectedArg in $expected.args) {
    if (-not $sectionText.Contains($expectedArg)) {
      return $false
    }
  }

  return $true
}

$serenaConfigured = Check-McpConfigured 'serena'
$context7Configured = Check-McpConfigured 'context7'
$sequentialThinkingConfigured = Check-McpConfigured 'sequential-thinking'
$playwrightConfigured = Check-McpConfigured 'playwright'

# CRG readiness check
$crgCliAvailable = $false
$crgNativeModules = 'unchecked'

$specFirstCmd = Get-Command spec-first -ErrorAction SilentlyContinue
if ($specFirstCmd) {
  try {
    $proc = Start-Process -FilePath 'spec-first' -ArgumentList 'crg','--help' -NoNewWindow -Wait -PassThru -RedirectStandardOutput NUL -RedirectStandardError NUL
    if ($proc -and $proc.ExitCode -eq 0) {
      $crgCliAvailable = $true
    }
  } catch {
    # CLI not functional
  }
}

if ($crgCliAvailable) {
  $crgNativeModules = 'ok'
  try {
    $proc = Start-Process -FilePath 'node' -ArgumentList '-e','try{require(''better-sqlite3'')}catch{process.exit(1)}' -NoNewWindow -Wait -PassThru -RedirectStandardOutput NUL -RedirectStandardError NUL
    if ($proc -and $proc.ExitCode -ne 0) { $crgNativeModules = 'missing' }
  } catch { $crgNativeModules = 'missing' }

  if ($crgNativeModules -eq 'ok') {
    try {
      $proc = Start-Process -FilePath 'node' -ArgumentList '-e','try{require(''tree-sitter'')}catch{process.exit(1)}' -NoNewWindow -Wait -PassThru -RedirectStandardOutput NUL -RedirectStandardError NUL
      if ($proc -and $proc.ExitCode -ne 0) { $crgNativeModules = 'missing' }
    } catch { $crgNativeModules = 'missing' }
  }
}

$crgCheckedAt = [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ')

$setupSuccess = $serenaConfigured -and $context7Configured -and $sequentialThinkingConfigured

Write-Host "🔎 正在核对当前宿主的基础 MCP 配置..."
Write-Host "  serena: $serenaConfigured"
Write-Host "  context7: $context7Configured"
Write-Host "  sequential-thinking: $sequentialThinkingConfigured"
Write-Host "  playwright: $playwrightConfigured"
Write-Host "  crg: $crgCliAvailable (native_modules: $crgNativeModules)"

New-Item -ItemType Directory -Force -Path $HostSetupDir | Out-Null

$completedAt = [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ')
$tempFile = Join-Path $HostSetupDir ("host-setup.{0}.tmp" -f ([guid]::NewGuid().ToString('N')))

$payload = [ordered]@{
  version = '5'
  host = $DetectedHost
  completed_at = $completedAt
  setup_success = [bool]$setupSuccess
  tools = [ordered]@{
    serena = @{ configured = [bool]$serenaConfigured }
    context7 = @{ configured = [bool]$context7Configured }
    'sequential-thinking' = @{ configured = [bool]$sequentialThinkingConfigured }
    playwright = @{ configured = [bool]$playwrightConfigured }
  }
  crg = [ordered]@{
    cli_available = [bool]$crgCliAvailable
    native_modules = $crgNativeModules
    checked_at = $crgCheckedAt
  }
}

$payload | ConvertTo-Json -Depth 6 | Set-Content -Encoding utf8 $tempFile
Move-Item -Force $tempFile $HostSetupFile
Write-Host "📝 宿主就绪标记已更新: $HostSetupFile"
Write-Host "✅ 当前宿主的基础 MCP 配置已完成校验"
