param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$HostInfo = & (Join-Path $ScriptDir 'detect-host.ps1') | ConvertFrom-Json
$DetectedHost = $HostInfo.host
$ConfigPath = $HostInfo.config_path
$HostSetupFile = $HostInfo.marker_path
$HostSetupDir = Split-Path -Parent $HostSetupFile

function Check-McpConfigured {
  param([string]$Tool)

  if (-not (Test-Path $ConfigPath)) {
    return $false
  }

  if ($DetectedHost -eq 'claude') {
    try {
      $config = Get-Content -Raw $ConfigPath | ConvertFrom-Json
      return $null -ne $config.mcpServers.PSObject.Properties[$Tool]
    } catch {
      return $false
    }
  }

  return [bool](Select-String -Path $ConfigPath -SimpleMatch "[mcp_servers.$Tool]" -Quiet)
}

$serenaConfigured = Check-McpConfigured 'serena'
$context7Configured = Check-McpConfigured 'context7'
$sequentialThinkingConfigured = Check-McpConfigured 'sequential-thinking'

$setupSuccess = $serenaConfigured -and $context7Configured -and $sequentialThinkingConfigured

Write-Host "🔎 正在核对当前宿主的基础 MCP 配置..."
Write-Host "  serena: $serenaConfigured"
Write-Host "  context7: $context7Configured"
Write-Host "  sequential-thinking: $sequentialThinkingConfigured"

New-Item -ItemType Directory -Force -Path $HostSetupDir | Out-Null

$completedAt = [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ')
$tempFile = Join-Path $HostSetupDir ("host-setup.{0}.tmp" -f ([guid]::NewGuid().ToString('N')))

$payload = [ordered]@{
  version = '4'
  host = $DetectedHost
  completed_at = $completedAt
  setup_success = [bool]$setupSuccess
  tools = [ordered]@{
    serena = @{ configured = [bool]$serenaConfigured }
    context7 = @{ configured = [bool]$context7Configured }
    'sequential-thinking' = @{ configured = [bool]$sequentialThinkingConfigured }
  }
}

$payload | ConvertTo-Json -Depth 6 | Set-Content -Encoding utf8 $tempFile
Move-Item -Force $tempFile $HostSetupFile
Write-Host "📝 宿主就绪标记已更新: $HostSetupFile"
Write-Host "✅ 当前宿主的基础 MCP 配置已完成校验"
