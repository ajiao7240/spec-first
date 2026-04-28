param(
  [switch]$Refresh,
  [string[]]$Language = @()
)

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
$indexCommand = $serenaTool.project_bootstrap.index_command
$command = $indexCommand.command
$indexArgs = New-Object System.Collections.Generic.List[string]
foreach ($arg in @($indexCommand.args)) {
  $indexArgs.Add([string]$arg)
}
if (@($indexCommand.args) -notcontains '--language') {
  foreach ($language in @($Language)) {
    if (-not [string]::IsNullOrWhiteSpace($language)) {
      $indexArgs.Add('--language')
      $indexArgs.Add([string]$language)
    }
  }
}

if (-not $Refresh -and (Test-Path -LiteralPath $projectFile -PathType Leaf) -and (Test-Path -LiteralPath $readyMarkerPath -PathType Leaf)) {
  exit 0
}

New-Item -ItemType Directory -Force -Path $projectDir | Out-Null
$backupDir = Join-Path ([System.IO.Path]::GetTempPath()) ('spec-serena-bootstrap.' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
$projectBackup = ''
$markerBackup = ''

function Restore-ExistingState {
  if (-not [string]::IsNullOrWhiteSpace($projectBackup) -and (Test-Path -LiteralPath $projectBackup -PathType Leaf)) {
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $projectFile) | Out-Null
    Copy-Item -LiteralPath $projectBackup -Destination $projectFile -Force
  }
  if (-not [string]::IsNullOrWhiteSpace($markerBackup) -and (Test-Path -LiteralPath $markerBackup -PathType Leaf)) {
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $readyMarkerPath) | Out-Null
    Copy-Item -LiteralPath $markerBackup -Destination $readyMarkerPath -Force
  }
}

if (Test-Path $readyMarkerPath) {
  $markerBackup = Join-Path $backupDir 'index-ready.json'
  Copy-Item -LiteralPath $readyMarkerPath -Destination $markerBackup -Force
  Remove-Item -Force $readyMarkerPath
}
if (Test-Path $projectFile) {
  $projectBackup = Join-Path $backupDir 'project.yml'
  Copy-Item -LiteralPath $projectFile -Destination $projectBackup -Force
  Remove-Item -Force $projectFile
}

try {
  Push-Location $repoRoot
  try {
    $global:LASTEXITCODE = 0
    $indexArgArray = @($indexArgs.ToArray())
    & $command @indexArgArray | Out-Null
    if ($LASTEXITCODE -is [int] -and $LASTEXITCODE -ne 0) {
      throw "Serena bootstrap command failed with exit code $LASTEXITCODE"
    }
  } finally {
    Pop-Location
  }
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $readyMarkerPath) | Out-Null
  $tmpMarker = Join-Path (Split-Path -Parent $readyMarkerPath) ('index-ready.' + [guid]::NewGuid().ToString('N') + '.tmp')
  [ordered]@{
    project_root = $repoRoot
    index_status = 'ready'
    indexed_at = [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ')
  } | ConvertTo-Json -Depth 4 | Set-Content -Encoding utf8 $tmpMarker
  Move-Item -Force $tmpMarker $readyMarkerPath
  if (-not ((Test-Path -LiteralPath $projectFile -PathType Leaf) -and (Test-Path -LiteralPath $readyMarkerPath -PathType Leaf))) {
    throw 'Serena project 或 index ready marker 写入失败'
  }
} catch {
  Restore-ExistingState
  throw
} finally {
  Remove-Item -Recurse -Force $backupDir -ErrorAction SilentlyContinue
}
