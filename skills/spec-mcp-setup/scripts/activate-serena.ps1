param(
  [switch]$Refresh,
  [switch]$VerifyOnly,
  [string]$Repo = '',
  [string[]]$Language = @()
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$skillDir = Split-Path -Parent $scriptDir
$toolsJson = Get-Content -Raw (Join-Path $skillDir 'mcp-tools.json') | ConvertFrom-Json
$resolverParams = @{ Format = 'json' }
if (-not [string]::IsNullOrWhiteSpace($Repo)) { $resolverParams.Repo = $Repo }
$targetFacts = (& (Join-Path $scriptDir 'resolve-project-target.ps1') @resolverParams) | ConvertFrom-Json
if (-not [bool]$targetFacts.state_write_allowed) {
  [pscustomobject]@{
    schema_version = 'serena-project-bootstrap.v1'
    overall_status = 'action-required'
    reason_code = if ([string]::IsNullOrWhiteSpace([string]$targetFacts.reason_code)) { 'workspace-target-required' } else { [string]$targetFacts.reason_code }
    workspace_root = $targetFacts.workspace_root
    next_action = $targetFacts.next_action
  } | ConvertTo-Json -Compress
  exit 1
}
$repoRoot = [string]$targetFacts.selected_repo_root
$serenaTool = @($toolsJson.tools | Where-Object { $_.id -eq 'serena' })[0]
$projectDir = Join-Path $repoRoot '.serena'
$projectFile = Join-Path $projectDir 'project.yml'
$projectLocalFile = Join-Path $projectDir 'project.local.yml'
$readyMarkerFile = if ($null -ne $serenaTool.project_bootstrap.ready_marker_file) { $serenaTool.project_bootstrap.ready_marker_file } else { '.serena/index-ready.json' }
$readyMarkerPath = Join-Path $repoRoot $readyMarkerFile
$indexCommand = $serenaTool.project_bootstrap.index_command
$command = $indexCommand.command

function Get-NonNegativeIntEnv {
  param(
    [string]$Name,
    [int]$Default
  )
  $raw = [Environment]::GetEnvironmentVariable($Name)
  [int]$parsed = 0
  if ([int]::TryParse($raw, [ref]$parsed) -and $parsed -ge 0) { return $parsed }
  return $Default
}

$stageTimeoutSeconds = Get-NonNegativeIntEnv -Name 'SPEC_FIRST_STAGE_TIMEOUT_SECONDS' -Default 900

function Get-PathSizeBytes {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) { return 0 }
  $total = 0L
  if (Test-Path -LiteralPath $Path -PathType Leaf) {
    return ([System.IO.FileInfo]$Path).Length
  }
  Get-ChildItem -LiteralPath $Path -Recurse -Force -ErrorAction SilentlyContinue | ForEach-Object {
    if (-not $_.PSIsContainer) { $total += [int64]$_.Length }
  }
  return $total
}

function Get-SerenaCacheStatus {
  $cacheDir = Join-Path $projectDir 'cache'
  if (-not (Test-Path -LiteralPath $cacheDir -PathType Container)) { return 'not-found' }
  if (Test-Path -LiteralPath $readyMarkerPath -PathType Leaf) { return 'ready' }
  return 'incomplete'
}

function Get-SerenaCacheWarning {
  param([int64]$SizeBytes)
  if ($SizeBytes -ge 1073741824) { return 'large-cache-high' }
  if ($SizeBytes -ge 536870912) { return 'large-cache' }
  return $null
}

function Get-SerenaSafeIgnoredPaths {
  @(
    '**/node_modules/',
    '**/.pnpm-store/',
    '**/.yarn/',
    '**/dist/',
    '**/build/',
    '**/coverage/',
    '**/.next/',
    '**/.nuxt/',
    '**/.turbo/',
    '**/.cache/',
    '**/__pycache__/',
    '**/.pytest_cache/',
    '**/.ruff_cache/',
    '**/.mypy_cache/',
    '**/.venv/',
    '**/venv/',
    '**/env/',
    '**/.tox/',
    '.spec-first/',
    '.claude/',
    '.codex/',
    '.agents/skills/',
    '.serena/cache/'
  )
}

function ConvertTo-YamlDoubleQuoted {
  param([string]$Value)
  $escaped = $Value.Replace('\', '\\').Replace('"', '\"')
  return '"' + $escaped + '"'
}

function Get-IgnoredPathScalar {
  param([string]$Value)
  $cleaned = ($Value -replace '#.*$', '').Trim().Trim('"').Trim("'").Trim()
  if ([string]::IsNullOrWhiteSpace($cleaned)) { return $null }
  return $cleaned
}

function Get-InlineIgnoredPathValues {
  param([string]$Value)
  $trimmed = $Value.Trim()
  if ([string]::IsNullOrWhiteSpace($trimmed) -or $trimmed -eq '[]') { return @() }
  if ($trimmed.StartsWith('[') -and $trimmed.EndsWith(']')) {
    $items = New-Object System.Collections.Generic.List[string]
    foreach ($item in @($trimmed.Substring(1, $trimmed.Length - 2) -split ',')) {
      $cleaned = Get-IgnoredPathScalar -Value $item
      if (-not [string]::IsNullOrWhiteSpace($cleaned)) { $items.Add($cleaned) }
    }
    return @($items)
  }
  $single = Get-IgnoredPathScalar -Value $trimmed
  if ([string]::IsNullOrWhiteSpace($single)) { return @() }
  return @($single)
}

function New-IgnoredPathsBlock {
  param([string[]]$Values)
  $lines = New-Object System.Collections.Generic.List[string]
  $seen = New-Object 'System.Collections.Generic.HashSet[string]'
  $lines.Add('ignored_paths:')
  foreach ($value in @($Values)) {
    if ([string]::IsNullOrWhiteSpace($value)) { continue }
    if ($seen.Add($value)) {
      $lines.Add('  - ' + (ConvertTo-YamlDoubleQuoted -Value $value))
    }
  }
  @($lines)
}

function Ensure-SerenaLocalIgnoredPaths {
  param([string]$Path)
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Path) | Out-Null
  $defaults = @(Get-SerenaSafeIgnoredPaths)
  $lines = if (Test-Path -LiteralPath $Path -PathType Leaf) {
    @(Get-Content -LiteralPath $Path)
  } else {
    @(
      '# This file allows spec-first and local development to keep Serena indexing bounded.',
      '# It is local runtime configuration and should not be committed.',
      ''
    )
  }

  $start = -1
  $existing = New-Object System.Collections.Generic.List[string]
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match '^ignored_paths:\s*(.*?)\s*$') {
      $start = $i
      foreach ($value in @(Get-InlineIgnoredPathValues -Value $Matches[1])) { $existing.Add($value) }
      break
    }
  }

  if ($start -lt 0) {
    $output = New-Object System.Collections.Generic.List[string]
    foreach ($line in @($lines)) { $output.Add($line) }
    if ($output.Count -gt 0 -and -not [string]::IsNullOrWhiteSpace($output[$output.Count - 1])) { $output.Add('') }
    foreach ($line in @(New-IgnoredPathsBlock -Values $defaults)) { $output.Add($line) }
    $output | Set-Content -Encoding utf8 $Path
    return
  }

  $end = $start + 1
  while ($end -lt $lines.Count) {
    $line = $lines[$end]
    if ($line -match '^\S' -and -not $line.TrimStart().StartsWith('#')) { break }
    if ($line -match '^\s*-\s*(.+)$') {
      $value = Get-IgnoredPathScalar -Value $Matches[1]
      if (-not [string]::IsNullOrWhiteSpace($value)) { $existing.Add($value) }
    }
    $end += 1
  }

  $merged = @($existing) + $defaults
  $newBlock = @(New-IgnoredPathsBlock -Values $merged)
  $before = if ($start -gt 0) { @($lines[0..($start - 1)]) } else { @() }
  $after = if ($end -lt $lines.Count) { @($lines[$end..($lines.Count - 1)]) } else { @() }
  @($before + $newBlock + $after) | Set-Content -Encoding utf8 $Path
}

function Clear-IncompleteSerenaCache {
  $cacheDir = Join-Path $projectDir 'cache'
  if ((Test-Path -LiteralPath $cacheDir -PathType Container) -and -not (Test-Path -LiteralPath $readyMarkerPath -PathType Leaf)) {
    Remove-Item -Recurse -Force $cacheDir -ErrorAction SilentlyContinue
  }
}

function Test-WindowsHost {
  $isWindowsVariable = Get-Variable -Name IsWindows -ValueOnly -ErrorAction SilentlyContinue
  return ([bool]$isWindowsVariable -or [System.Environment]::OSVersion.Platform -eq [System.PlatformID]::Win32NT)
}

function Resolve-ProcessExecutable {
  param([string]$Exe)

  if ([string]::IsNullOrWhiteSpace($Exe)) { return $Exe }
  if ([System.IO.Path]::IsPathRooted($Exe) -or $Exe.Contains('\') -or $Exe.Contains('/')) { return $Exe }

  $commands = @(Get-Command $Exe -All -ErrorAction SilentlyContinue)
  $application = @($commands | Where-Object { $_.CommandType -eq 'Application' } | Select-Object -First 1)
  if ($application.Count -gt 0 -and -not [string]::IsNullOrWhiteSpace([string]$application[0].Path)) {
    return [string]$application[0].Path
  }

  $externalScript = @($commands | Where-Object { $_.CommandType -eq 'ExternalScript' } | Select-Object -First 1)
  if ($externalScript.Count -gt 0 -and -not [string]::IsNullOrWhiteSpace([string]$externalScript[0].Path)) {
    $scriptPath = [string]$externalScript[0].Path
    if ((Test-WindowsHost) -and [System.IO.Path]::GetExtension($scriptPath).Equals('.ps1', [System.StringComparison]::OrdinalIgnoreCase)) {
      $basePath = [System.IO.Path]::Combine([System.IO.Path]::GetDirectoryName($scriptPath), [System.IO.Path]::GetFileNameWithoutExtension($scriptPath))
      foreach ($extension in @('.cmd', '.exe', '.bat', '.com')) {
        $candidate = "${basePath}${extension}"
        if (Test-Path -LiteralPath $candidate -PathType Leaf) { return $candidate }
      }
    }
    return $scriptPath
  }

  return $Exe
}

function Join-WindowsProcessArguments {
  param([object[]]$Arguments)

  $quoted = foreach ($argument in @($Arguments)) {
    $value = [string]$argument
    if ($value.Length -eq 0) { '""'; continue }
    if ($value -notmatch '[\s"]') { $value; continue }

    $builder = New-Object System.Text.StringBuilder
    [void]$builder.Append('"')
    $backslashes = 0
    foreach ($char in $value.ToCharArray()) {
      if ($char -eq '\') {
        $backslashes += 1
        continue
      }
      if ($char -eq '"') {
        if ($backslashes -gt 0) { [void]$builder.Append(('\' * ($backslashes * 2))) }
        [void]$builder.Append('\"')
        $backslashes = 0
        continue
      }
      if ($backslashes -gt 0) {
        [void]$builder.Append(('\' * $backslashes))
        $backslashes = 0
      }
      [void]$builder.Append($char)
    }
    if ($backslashes -gt 0) { [void]$builder.Append(('\' * ($backslashes * 2))) }
    [void]$builder.Append('"')
    $builder.ToString()
  }

  return ($quoted -join ' ')
}

function Set-ProcessArgumentsCompat {
  param(
    [System.Diagnostics.ProcessStartInfo]$ProcessInfo,
    [object[]]$Arguments
  )

  if ($ProcessInfo.PSObject.Properties.Name -contains 'ArgumentList') {
    foreach ($argument in @($Arguments)) {
      [void]$ProcessInfo.ArgumentList.Add([string]$argument)
    }
    return
  }

  $ProcessInfo.Arguments = Join-WindowsProcessArguments -Arguments $Arguments
}

function Invoke-ExternalCommandWithTimeout {
  param(
    [string]$Exe,
    [object[]]$CommandArguments,
    [string]$WorkingDirectory,
    [int]$TimeoutSeconds
  )

  $processInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $processInfo.FileName = Resolve-ProcessExecutable -Exe $Exe
  Set-ProcessArgumentsCompat -ProcessInfo $processInfo -Arguments $CommandArguments
  $processInfo.WorkingDirectory = $WorkingDirectory
  $processInfo.RedirectStandardOutput = $true
  $processInfo.RedirectStandardError = $true
  $processInfo.UseShellExecute = $false

  $process = [System.Diagnostics.Process]::new()
  $process.StartInfo = $processInfo
  try {
    [void]$process.Start()
    $stdoutTask = $process.StandardOutput.ReadToEndAsync()
    $stderrTask = $process.StandardError.ReadToEndAsync()
    $timedOut = -not $process.WaitForExit($TimeoutSeconds * 1000)
    if ($timedOut) {
      try {
        $process.Kill($true)
      } catch {
        try { $process.Kill() } catch {}
      }
      $process.WaitForExit()
    }
    $stdoutTask.Wait()
    $stderrTask.Wait()
    $outputParts = @($stdoutTask.Result, $stderrTask.Result) | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) }
    if ($timedOut) { $outputParts += "command timed out after ${TimeoutSeconds}s" }
    return [pscustomobject]@{
      exit_code = if ($timedOut) { 124 } else { [int]$process.ExitCode }
      output = ($outputParts -join [Environment]::NewLine)
      timed_out = $timedOut
    }
  } catch {
    return [pscustomobject]@{
      exit_code = 127
      output = [string]$_.Exception.Message
      timed_out = $false
    }
  } finally {
    $process.Dispose()
  }
}

if ($VerifyOnly) {
  $ready = (Test-Path -LiteralPath $projectFile -PathType Leaf) -and (Test-Path -LiteralPath $readyMarkerPath -PathType Leaf)
  $cacheDir = Join-Path $projectDir 'cache'
  $cacheSizeBytes = [int64](Get-PathSizeBytes -Path $cacheDir)
  $cacheStatus = Get-SerenaCacheStatus
  $cacheWarning = Get-SerenaCacheWarning -SizeBytes $cacheSizeBytes
  [pscustomobject]@{
    schema_version = 'serena-project-bootstrap.v1'
    overall_status = if ($ready) { 'ready' } else { 'action-required' }
    reason_code = if ($ready) { $null } else { 'serena-project-not-ready' }
    repo_root = $repoRoot
    project_file = '.serena/project.yml'
    ready_marker = $readyMarkerFile
    cache = [ordered]@{
      path = '.serena/cache'
      status = $cacheStatus
      size_bytes = $cacheSizeBytes
      warning = $cacheWarning
    }
    next_action = if ($ready) { '' } elseif ($cacheStatus -eq 'incomplete') { 'Remove incomplete .serena/cache and rerun spec-mcp-setup.' } else { 'Run spec-mcp-setup to activate Serena for the selected repo.' }
  } | ConvertTo-Json -Compress
  exit 0
}

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

if (-not $Refresh -and (Test-Path -LiteralPath $projectFile -PathType Leaf) -and (Test-Path -LiteralPath $readyMarkerPath -PathType Leaf)) {
  exit 0
}

$effectiveLanguages = @(Normalize-LanguageValues -Values $Language)
if ($effectiveLanguages.Count -eq 0 -and (Test-Path -LiteralPath $projectFile -PathType Leaf)) {
  $effectiveLanguages = @(Get-SerenaProjectLanguages -Path $projectFile)
}
if ($effectiveLanguages.Count -eq 0) {
  if ($Refresh) {
    throw 'Serena refresh requires -Language when no existing project languages are available. Let the LLM inspect project evidence and pass supported Serena languages, for example: -Language typescript or -Language kotlin,java'
  }
  throw 'Serena first-time bootstrap requires -Language for non-interactive setup. Let the LLM inspect project evidence and pass supported Serena languages, for example: -Language typescript or -Language kotlin,java'
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

New-Item -ItemType Directory -Force -Path $projectDir | Out-Null
Ensure-SerenaLocalIgnoredPaths -Path $projectLocalFile
Clear-IncompleteSerenaCache
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
    Remove-Item -Recurse -Force (Join-Path $projectDir 'cache') -ErrorAction SilentlyContinue
    Push-Location $repoRoot
    try {
      $global:LASTEXITCODE = 0
      $indexArgArray = @(New-IndexArgs -Languages @($attempt.languages))
      $indexRun = Invoke-ExternalCommandWithTimeout -Exe $command -CommandArguments $indexArgArray -WorkingDirectory $repoRoot -TimeoutSeconds $stageTimeoutSeconds
      $global:LASTEXITCODE = [int]$indexRun.exit_code
      $serenaOutput = @($indexRun.output)
      if ($indexRun.exit_code -eq 0) {
        $bootstrapSucceeded = $true
        break
      }
      $summary = (($serenaOutput | ForEach-Object { [string]$_ }) -join "`n").Trim()
      if ($summary.Length -gt 2000) { $summary = $summary.Substring($summary.Length - 2000) }
      $attemptErrors.Add("attempt=$($attempt.name) exit=$($indexRun.exit_code)`n$summary")
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
