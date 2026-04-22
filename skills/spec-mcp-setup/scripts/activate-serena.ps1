param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = try { git rev-parse --show-toplevel } catch { (Get-Location).Path }
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$skillDir = Split-Path -Parent $scriptDir
$toolsJson = Get-Content -Raw (Join-Path $skillDir 'mcp-tools.json') | ConvertFrom-Json
$serenaTool = @($toolsJson.tools | Where-Object { $_.id -eq 'serena' })[0]
$projectDir = Join-Path $repoRoot '.serena'
$projectFile = Join-Path $projectDir 'project.yml'
$readyMarkerFile = if ($null -ne $serenaTool.project_bootstrap.ready_marker_file) { $serenaTool.project_bootstrap.ready_marker_file } else { '.serena/index-ready.json' }
$readyMarkerPath = Join-Path $repoRoot $readyMarkerFile
New-Item -ItemType Directory -Force -Path $projectDir | Out-Null
if (-not (Test-Path $projectFile)) {
  @(
    "project_root: `"$repoRoot`"",
    'created_by: spec-mcp-setup'
  ) | Set-Content -Encoding utf8 $projectFile
}
if (Test-Path $readyMarkerPath) {
  Remove-Item -Force $readyMarkerPath
}

$indexCommand = $serenaTool.project_bootstrap.index_command.command
$indexArgs = @($serenaTool.project_bootstrap.index_command.args)
& $indexCommand @indexArgs | Out-Null
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $readyMarkerPath) | Out-Null
[ordered]@{
  project_root = $repoRoot
  index_status = 'ready'
  indexed_at = [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ')
} | ConvertTo-Json -Depth 4 | Set-Content -Encoding utf8 $readyMarkerPath
if (-not (Test-Path $readyMarkerPath)) {
  throw 'Serena index ready marker 写入失败'
}
