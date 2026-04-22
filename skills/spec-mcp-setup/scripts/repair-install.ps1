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
$ToolDef = @($ToolsJson.tools | Where-Object { $_.id -eq $Tool })[0]
if ($null -eq $ToolDef) {
  throw "未知工具: $Tool"
}

foreach ($dep in @($ToolDef.dependencies)) {
  if (-not (Get-Command $dep -ErrorAction SilentlyContinue)) {
    throw "repair_failed:missing_dependency:$dep"
  }
}

& (Join-Path $ScriptDir 'configure-host.ps1') -Tool $Tool | Out-Null
