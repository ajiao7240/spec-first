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
if (Test-Path $readyMarkerPath) {
  Remove-Item -Force $readyMarkerPath
}
if (Test-Path $projectFile) {
  Remove-Item -Force $projectFile
}

& uvx --from git+https://github.com/oraios/serena serena project create $repoRoot --language typescript --language vue --language markdown --language yaml --language bash --index | Out-Null
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $readyMarkerPath) | Out-Null
[ordered]@{
  project_root = $repoRoot
  index_status = 'ready'
  indexed_at = [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ')
} | ConvertTo-Json -Depth 4 | Set-Content -Encoding utf8 $readyMarkerPath
if (-not (Test-Path $readyMarkerPath)) {
  throw 'Serena index ready marker 写入失败'
}
