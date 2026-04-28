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

function Get-SerenaProjectLanguages {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return @() }

  $languages = New-Object System.Collections.Generic.List[string]
  $inLanguages = $false
  foreach ($line in Get-Content -LiteralPath $Path) {
    if ($line -match '^\s*languages:\s*$') {
      $inLanguages = $true
      continue
    }
    if ($inLanguages -and $line -match '^\s*-\s*(.+?)\s*(?:#.*)?$') {
      $value = $Matches[1].Trim().Trim('"').Trim("'")
      if (-not [string]::IsNullOrWhiteSpace($value)) {
        $languages.Add($value)
      }
      continue
    }
    if ($inLanguages -and $line -match '^\S') { break }
  }
  @($languages)
}

function Normalize-LanguageValues {
  param([string[]]$Values)
  $normalized = New-Object System.Collections.Generic.List[string]
  foreach ($value in @($Values)) {
    if ([string]::IsNullOrWhiteSpace($value)) { continue }
    foreach ($language in @($value -split ',')) {
      $trimmed = $language.Trim()
      if (-not [string]::IsNullOrWhiteSpace($trimmed)) {
        $normalized.Add($trimmed)
      }
    }
  }
  @($normalized)
}

$effectiveLanguages = @(Normalize-LanguageValues -Values $Language)
if ($Refresh -and $effectiveLanguages.Count -eq 0) {
  $effectiveLanguages = @(Get-SerenaProjectLanguages -Path $projectFile)
  if ($effectiveLanguages.Count -eq 0) {
    throw 'Serena refresh requires -Language when no existing project languages are available. Let the LLM inspect project evidence and pass explicit values, for example: -Language kotlin,java'
  }
}

function New-IndexArgs {
  param([string[]]$Languages)
  $args = New-Object System.Collections.Generic.List[string]
  foreach ($arg in @($indexCommand.args)) {
    $args.Add([string]$arg)
  }
  if (@($indexCommand.args) -notcontains '--language') {
    foreach ($language in @($Languages)) {
      if (-not [string]::IsNullOrWhiteSpace($language)) {
        $args.Add('--language')
        $args.Add([string]$language)
      }
    }
  }
  @($args.ToArray())
}

function New-LanguageAttempts {
  param([string[]]$Languages)
  $attempts = New-Object System.Collections.Generic.List[object]
  $attempts.Add([pscustomobject]@{ name = 'all-languages'; languages = @($Languages) })
  if (@($Languages).Count -gt 1) {
    foreach ($language in @($Languages)) {
      $attempts.Add([pscustomobject]@{ name = "single-language:$language"; languages = @($language) })
    }
  }
  @($attempts)
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
  $attemptErrors = New-Object System.Collections.Generic.List[string]
  $bootstrapSucceeded = $false
  foreach ($attempt in @(New-LanguageAttempts -Languages $effectiveLanguages)) {
    Remove-Item -Force $readyMarkerPath -ErrorAction SilentlyContinue
    Remove-Item -Force $projectFile -ErrorAction SilentlyContinue
    Push-Location $repoRoot
    try {
      $global:LASTEXITCODE = 0
      $indexArgArray = @(New-IndexArgs -Languages @($attempt.languages))
      $serenaOutput = @(& $command @indexArgArray 2>&1)
      if ($LASTEXITCODE -is [int] -and $LASTEXITCODE -eq 0) {
        $bootstrapSucceeded = $true
        break
      }
      $summary = (($serenaOutput | ForEach-Object { [string]$_ }) -join "`n").Trim()
      if ($summary.Length -gt 2000) { $summary = $summary.Substring($summary.Length - 2000) }
      $attemptErrors.Add("attempt=$($attempt.name) exit=$LASTEXITCODE`n$summary")
    } catch {
      $attemptErrors.Add("attempt=$($attempt.name) exit=1`n$($_.Exception.Message)")
    } finally {
      Pop-Location
    }
  }
  if (-not $bootstrapSucceeded) {
    $summary = (($attemptErrors.ToArray()) -join "`n---`n").Trim()
    if ($summary.Length -gt 5000) { $summary = $summary.Substring($summary.Length - 5000) }
    throw "Serena bootstrap failed for all language attempts.`n$summary"
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
