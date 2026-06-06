param(
  [string]$Only,
  [string]$Repo = '',
  [string]$Folder = '',
  [switch]$AllRepos
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SkillDir = Split-Path -Parent $ScriptDir
. (Join-Path $ScriptDir 'lib-template.ps1')
$ToolsJsonPath = Join-Path $SkillDir 'mcp-tools.json'
$ToolsJson = Read-McpToolsJson -Path $ToolsJsonPath
Assert-McpToolsSchemaVersion -ToolsJson $ToolsJson
$HostInfo = & (Join-Path $ScriptDir 'detect-host.ps1') | ConvertFrom-Json
$DetectedHost = $HostInfo.host
$HostDisplayName = $HostInfo.display_name
$Platform = $HostInfo.platform

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

$script:StageTimeoutSeconds = Get-NonNegativeIntEnv -Name 'SPEC_FIRST_STAGE_TIMEOUT_SECONDS' -Default 900
$script:WarmupCacheRoot = if (-not [string]::IsNullOrWhiteSpace($env:SPEC_FIRST_WARMUP_CACHE_DIR)) { $env:SPEC_FIRST_WARMUP_CACHE_DIR } else { [System.IO.Path]::Combine($HOME, '.spec-first', 'cache', 'mcp-warmup') }
$script:WarmupLatestTtlSeconds = Get-NonNegativeIntEnv -Name 'SPEC_FIRST_WARMUP_LATEST_TTL_SECONDS' -Default 86400
$resolverParams = @{ Format = 'json' }
if (-not $AllRepos -and -not [string]::IsNullOrWhiteSpace($Repo)) { $resolverParams.Repo = $Repo }
if (-not $AllRepos -and -not [string]::IsNullOrWhiteSpace($Folder)) { $resolverParams.Folder = $Folder }
if (-not [string]::IsNullOrWhiteSpace($Repo) -and -not [string]::IsNullOrWhiteSpace($Folder)) {
  throw 'install-mcp.ps1: use either -Repo or -Folder, not both'
}
if ($AllRepos -and -not [string]::IsNullOrWhiteSpace($Folder)) {
  throw 'install-mcp.ps1: use either -AllRepos or -Folder, not both'
}
$TargetFacts = (& (Join-Path $ScriptDir 'resolve-project-target.ps1') @resolverParams) | ConvertFrom-Json
$ResolvedRepoRoot = if (-not [string]::IsNullOrWhiteSpace([string]$TargetFacts.target_root)) {
  [string]$TargetFacts.target_root
} elseif (-not [string]::IsNullOrWhiteSpace([string]$TargetFacts.selected_repo_root)) {
  [string]$TargetFacts.selected_repo_root
} elseif (-not [string]::IsNullOrWhiteSpace([string]$TargetFacts.selected_folder_root)) {
  [string]$TargetFacts.selected_folder_root
} else {
  [string]$TargetFacts.workspace_root
}

function Parse-List {
  param([string]$Value)
  if ([string]::IsNullOrWhiteSpace($Value)) { return @() }
  @($Value -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ })
}

function Write-JsonFileAtomic {
  param(
    [string]$Path,
    [object]$Payload,
    [int]$Depth = 30
  )
  function Test-SymlinkPath {
    param([string]$CandidatePath)
    if ([string]::IsNullOrWhiteSpace($CandidatePath)) { return $false }
    $item = Get-Item -LiteralPath $CandidatePath -Force -ErrorAction SilentlyContinue
    return ($null -ne $item -and (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0))
  }
  $dir = Split-Path -Parent $Path
  $specDir = Split-Path -Parent $dir
  if ((Split-Path -Leaf $dir) -ne 'workspace' -or (Split-Path -Leaf $specDir) -ne '.spec-first') {
    throw 'workspace-summary-path-outside-contract'
  }
  if ((Test-SymlinkPath $specDir) -or (Test-SymlinkPath $dir)) {
    throw 'workspace-summary-symlink-escape'
  }
  [System.IO.Directory]::CreateDirectory($dir) | Out-Null
  if ((Test-SymlinkPath $specDir) -or (Test-SymlinkPath $dir) -or (Test-SymlinkPath $Path)) {
    throw 'workspace-summary-symlink-escape'
  }
  $tmp = Join-Path $dir ('.{0}.{1}.tmp' -f (Split-Path -Leaf $Path), ([guid]::NewGuid().ToString('N')))
  try {
    $Payload | ConvertTo-Json -Depth $Depth | Set-Content -Encoding utf8 -LiteralPath $tmp
    if ((Test-SymlinkPath $specDir) -or (Test-SymlinkPath $dir) -or (Test-SymlinkPath $Path)) {
      throw 'workspace-summary-symlink-escape'
    }
    Move-Item -Force -LiteralPath $tmp -Destination $Path
  } catch {
    Remove-Item -Force -LiteralPath $tmp -ErrorAction SilentlyContinue
    throw
  }
}

function Invoke-ChildJsonScript {
  param(
    [string]$ScriptPath,
    [hashtable]$Arguments
  )

  $stderrPath = Join-Path ([System.IO.Path]::GetTempPath()) ('spec-first-child-stderr-{0}.log' -f ([guid]::NewGuid().ToString('N')))
  $informationPath = Join-Path ([System.IO.Path]::GetTempPath()) ('spec-first-child-information-{0}.log' -f ([guid]::NewGuid().ToString('N')))
  $stdout = @()
  $exitCode = 0
  $exceptionText = ''
  try {
    $global:LASTEXITCODE = 0
    $stdout = @(& $ScriptPath @Arguments 2> $stderrPath 6> $informationPath)
    if ($LASTEXITCODE -is [int]) { $exitCode = $LASTEXITCODE }
  } catch {
    $exitCode = if ($LASTEXITCODE -is [int] -and $LASTEXITCODE -ne 0) { $LASTEXITCODE } else { 1 }
    $exceptionText = [string]$_.Exception.Message
  }

  $stderrText = if (Test-Path -LiteralPath $stderrPath -PathType Leaf) { Get-Content -Raw -LiteralPath $stderrPath } else { '' }
  $informationText = if (Test-Path -LiteralPath $informationPath -PathType Leaf) { Get-Content -Raw -LiteralPath $informationPath } else { '' }
  Remove-Item -Force -ErrorAction SilentlyContinue -LiteralPath $stderrPath, $informationPath

  $diagnosticParts = @($stderrText, $informationText, $exceptionText) | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) }
  [pscustomobject]@{
    stdout = ($stdout -join "`n")
    stderr = $stderrText
    information = $informationText
    diagnostic = ($diagnosticParts -join "`n").Trim()
    exit_code = $exitCode
  }
}

function Write-WorkspaceMcpSetupSummaryAndExit {
  param(
    [object]$TargetFacts,
    [string]$SelectionSource = 'explicit-all-repos'
  )

  $workspaceRoot = [string]$TargetFacts.workspace_root
  if (-not [string]::IsNullOrWhiteSpace($Repo)) {
    [pscustomobject]@{
      schema_version = 'workspace-mcp-setup-summary.v1'
      overall_status = 'action-required'
      workflow_mode = 'blocked'
      reason_code = 'all-repos-conflicts-with-repo'
      workspace_root = $workspaceRoot
      advisory = $true
      next_action = 'Use either -AllRepos from a parent workspace or -Repo <child>, not both.'
    } | ConvertTo-Json -Compress
    exit 1
  }

  if ($TargetFacts.mode -eq 'git-repo') {
    [pscustomobject]@{
      schema_version = 'workspace-mcp-setup-summary.v1'
      overall_status = 'action-required'
      workflow_mode = 'blocked'
      reason_code = 'all-repos-requires-parent-workspace'
      workspace_root = $workspaceRoot
      advisory = $true
      next_action = 'Run -AllRepos from a parent workspace containing child Git repos, or omit -AllRepos in a single Git repo.'
    } | ConvertTo-Json -Compress
    exit 1
  }

  $children = @($TargetFacts.candidates)
  if ($children.Count -eq 0) {
    [pscustomobject]@{
      schema_version = 'workspace-mcp-setup-summary.v1'
      overall_status = 'action-required'
      workflow_mode = 'blocked'
      reason_code = if ([string]::IsNullOrWhiteSpace([string]$TargetFacts.reason_code)) { 'workspace-no-git-candidates' } else { [string]$TargetFacts.reason_code }
      workspace_root = $workspaceRoot
      candidates = @($TargetFacts.candidates)
      advisory = $true
      next_action = if ([string]::IsNullOrWhiteSpace([string]$TargetFacts.next_action)) { 'Run from a parent workspace containing child Git repos.' } else { [string]$TargetFacts.next_action }
    } | ConvertTo-Json -Compress
    exit 1
  }

  $results = @()
  foreach ($child in $children) {
    $childParams = @{ Repo = [string]$child.workspace_relative_path }
    if (-not [string]::IsNullOrWhiteSpace($Only)) { $childParams.Only = $Only }
    $childRun = Invoke-ChildJsonScript -ScriptPath $PSCommandPath -Arguments $childParams
    $childStatus = [int]$childRun.exit_code
    $childText = [string]$childRun.stdout
    try {
      $childResult = $childText | ConvertFrom-Json
    } catch {
      $diagnostic = (@($childText, [string]$childRun.diagnostic) | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) }) -join "`n"
      $childResult = [pscustomobject]@{ host = 'unknown'; display_name = 'unknown'; platform = 'unknown'; results = @(); diagnostic = $diagnostic }
    }
    $childResults = @($childResult.results)
    $childOverall = if ($childResults.Count -eq 0) {
      'action-required'
    } elseif (@($childResults | Where-Object { $_.status -eq 'action-required' }).Count -gt 0) {
      'action-required'
    } elseif (@($childResults | Where-Object { $_.status -eq 'partial' }).Count -gt 0) {
      'partial'
    } else {
      'ready'
    }
    $childReason = @($childResults | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_.reason_code) } | Select-Object -First 1 | ForEach-Object { [string]$_.reason_code })
    $results += [pscustomobject][ordered]@{
      repo_label = [string]$child.repo_label
      workspace_relative_path = [string]$child.workspace_relative_path
      exit_code = $childStatus
      overall_status = $childOverall
      reason_code = if ($childReason.Count -gt 0) { $childReason[0] } else { $null }
      result = $childResult
    }
  }

  $readyCount = @($results | Where-Object { $_.overall_status -eq 'ready' }).Count
  $partialCount = @($results | Where-Object { $_.overall_status -eq 'partial' }).Count
  $actionRequiredCount = @($results | Where-Object { $_.overall_status -eq 'action-required' }).Count
  $overallStatus = if ($results.Count -eq 0) { 'action-required' } elseif ($actionRequiredCount -gt 0 -and ($readyCount + $partialCount) -eq 0) { 'action-required' } elseif (($partialCount + $actionRequiredCount) -gt 0) { 'partial' } else { 'ready' }
  $summary = [ordered]@{
    schema_version = 'workspace-mcp-setup-summary.v1'
    generated_at = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
    advisory = $true
    workflow_mode = 'all-repos'
    selection_source = $SelectionSource
    workspace_root = $workspaceRoot
    parent_writes_repo_local_artifacts = $false
    results = @($results)
    counts = [ordered]@{
      total = $results.Count
      ready = $readyCount
      partial = $partialCount
      action_required = $actionRequiredCount
    }
    overall_status = $overallStatus
    reason_code = if (($partialCount + $actionRequiredCount) -eq 0) { $null } else { 'all-repos-partial-or-action-required' }
    next_action = if (($partialCount + $actionRequiredCount) -gt 0) { 'Inspect per-child reason_code and rerun setup for action-required repos.' } else { 'All child repos completed MCP setup.' }
  }

  try {
    Write-JsonFileAtomic -Path (Join-Path $workspaceRoot '.spec-first/workspace/mcp-setup-summary.json') -Payload ([pscustomobject]$summary) -Depth 30
  } catch {
    [pscustomobject]@{
      schema_version = 'workspace-mcp-setup-summary.v1'
      overall_status = 'action-required'
      workflow_mode = 'blocked'
      reason_code = 'workspace-summary-symlink-escape'
      workspace_root = $workspaceRoot
      advisory = $true
      next_action = 'Replace symlinked .spec-first/workspace with a real workspace-local directory and rerun setup.'
    } | ConvertTo-Json -Compress
    exit 1
  }
  [pscustomobject]$summary | ConvertTo-Json -Depth 30 -Compress
  if ($overallStatus -ne 'ready') { exit 1 }
  exit 0
}

$OnlyArray = @(Parse-List $Only)

if ($AllRepos) {
  Write-WorkspaceMcpSetupSummaryAndExit -TargetFacts $TargetFacts -SelectionSource 'explicit-all-repos'
}

$defaultChildren = @($TargetFacts.candidates)
if (-not $AllRepos -and [string]::IsNullOrWhiteSpace($Repo) -and $TargetFacts.mode -ne 'git-repo' -and $defaultChildren.Count -gt 0) {
  Write-WorkspaceMcpSetupSummaryAndExit -TargetFacts $TargetFacts -SelectionSource 'workspace-default-all-repos'
}

function Should-Install {
  param([object]$Tool)
  if ($OnlyArray.Count -gt 0) { return $OnlyArray -contains $Tool.id }
  return $true
}

function Test-OptionalToolAllowed {
  param([object]$Tool)
  if ([bool]$Tool.required) { return $true }
  if ($OnlyArray.Count -eq 0) { return $false }
  if ($null -eq $Tool.PSObject.Properties['opt_in']) { return $false }
  if ($null -eq $Tool.opt_in.PSObject.Properties['explicit_consent_required']) { return $false }
  return [bool]$Tool.opt_in.explicit_consent_required
}

function Get-ProjectBootstrapState {
  param([object]$Tool)
  if ($null -eq $Tool.PSObject.Properties['project_bootstrap']) { return 'not-applicable' }
  if ($Tool.project_bootstrap.kind -eq 'none' -or -not [bool]$Tool.project_bootstrap.required) {
    return 'not-applicable'
  }
  if (-not [bool]$TargetFacts.state_write_allowed) {
    return 'target-action-required'
  }
  $projectFile = [string]$Tool.project_bootstrap.project_file
  if (-not [string]::IsNullOrWhiteSpace($projectFile) -and (Test-Path -LiteralPath (Join-Path $ResolvedRepoRoot $projectFile) -PathType Leaf)) {
    return 'ready'
  }
  return 'pending'
}

function Get-Sha256Hex {
  param([string]$Text)
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
    return ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant()
  } finally {
    $sha.Dispose()
  }
}

function Get-WarmupCommandHash {
  param(
    [string]$Command,
    [string[]]$Arguments
  )
  $payload = New-Object System.Text.StringBuilder
  [void]$payload.AppendLine("command=$Command")
  foreach ($argument in @($Arguments)) {
    [void]$payload.AppendLine("arg=$argument")
  }
  Get-Sha256Hex -Text $payload.ToString()
}

function Get-WarmupCachePath {
  param([object]$Tool)
  [System.IO.Path]::Combine($script:WarmupCacheRoot, [string]$DetectedHost, [string]$Platform, "$($Tool.id).json")
}

function Get-WarmupCacheTtlSeconds {
  param(
    [string]$Command,
    [string[]]$Arguments
  )
  $joined = (@($Command) + @($Arguments)) -join ' '
  if ($joined.Contains('@latest') -or $joined.Contains(' --upgrade ')) {
    return $script:WarmupLatestTtlSeconds
  }
  0
}

function Test-WarmupCacheHit {
  param(
    [object]$Tool,
    [string]$CommandHash,
    [int]$TtlSeconds
  )
  if ($env:SPEC_FIRST_FORCE_WARMUP -eq '1' -or $env:SPEC_FIRST_DISABLE_WARMUP_CACHE -eq '1') { return $false }
  $cachePath = Get-WarmupCachePath -Tool $Tool
  if (-not (Test-Path -LiteralPath $cachePath -PathType Leaf)) { return $false }
  try {
    $cache = Get-Content -Raw $cachePath | ConvertFrom-Json
  } catch {
    return $false
  }
  if ([string](Get-ToolField -Tool $cache -Name 'schema_version') -ne 'mcp-warmup-cache.v1') { return $false }
  if ([string](Get-ToolField -Tool $cache -Name 'tool_id') -ne [string]$Tool.id) { return $false }
  if ([string](Get-ToolField -Tool $cache -Name 'host') -ne [string]$DetectedHost) { return $false }
  if ([string](Get-ToolField -Tool $cache -Name 'platform') -ne [string]$Platform) { return $false }
  if ([string](Get-ToolField -Tool $cache -Name 'command_hash') -ne [string]$CommandHash) { return $false }
  [int]$exitCode = 1
  $exitCodeValue = Get-ToolField -Tool $cache -Name 'exit_code'
  if (-not [int]::TryParse([string]$exitCodeValue, [ref]$exitCode)) { return $false }
  if ($exitCode -ne 0) { return $false }
  if ($TtlSeconds -gt 0) {
    [int64]$lastSuccessEpoch = 0
    $lastSuccessEpochValue = Get-ToolField -Tool $cache -Name 'last_success_epoch'
    if ($null -ne $lastSuccessEpochValue) {
      if (-not [int64]::TryParse([string]$lastSuccessEpochValue, [ref]$lastSuccessEpoch)) { return $false }
    }
    $now = [int64]([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())
    if (($lastSuccessEpoch + $TtlSeconds) -lt $now) { return $false }
  }
  $true
}

function Write-WarmupCache {
  param(
    [object]$Tool,
    [string]$Command,
    [string[]]$Arguments,
    [string]$CommandHash
  )
  $tmp = $null
  try {
    $cachePath = Get-WarmupCachePath -Tool $Tool
    $cacheDir = Split-Path -Parent $cachePath
    if (-not (Test-Path -LiteralPath $cacheDir)) {
      New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null
    }
    $packageSpec = ''
    if ($null -ne $Tool.PSObject.Properties['package'] -and $null -ne $Tool.PSObject.Properties['version']) {
      if (-not [string]::IsNullOrWhiteSpace([string]$Tool.package) -and -not [string]::IsNullOrWhiteSpace([string]$Tool.version)) {
        $packageSpec = "$($Tool.package)@$($Tool.version)"
      }
    }
    $tmp = '{0}.{1}.tmp' -f $cachePath, ([guid]::NewGuid().ToString('N'))
    [ordered]@{
      schema_version = 'mcp-warmup-cache.v1'
      tool_id = $Tool.id
      host = $DetectedHost
      platform = $Platform
      command = $Command
      args = @($Arguments)
      command_hash = $CommandHash
      package_spec = $packageSpec
      last_success_at = [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ')
      last_success_epoch = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
      exit_code = 0
    } | ConvertTo-Json -Depth 8 | Set-Content -Encoding utf8 -LiteralPath $tmp
    Move-Item -Force -LiteralPath $tmp -Destination $cachePath
  } catch {
    if (-not [string]::IsNullOrWhiteSpace([string]$tmp)) {
      Remove-Item -Force -LiteralPath $tmp -ErrorAction SilentlyContinue
    }
  }
}

function Invoke-Captured {
  param(
    [scriptblock]$Script,
    [int]$Limit = 1000
  )

  $output = New-Object System.Collections.Generic.List[string]
  $exitCode = 0
  $captured = @()
  try {
    $global:LASTEXITCODE = 0
    $captured = & $Script 2>&1
    if ($null -ne $captured) {
      foreach ($line in @($captured)) {
        $output.Add([string]$line)
      }
    }
    if ($LASTEXITCODE -is [int] -and $LASTEXITCODE -ne 0) {
      $exitCode = $LASTEXITCODE
      throw "Command exited with code $exitCode"
    }
  } catch {
    if ($exitCode -eq 0) {
      $exitCode = if ($LASTEXITCODE -is [int] -and $LASTEXITCODE -ne 0) { $LASTEXITCODE } else { 1 }
    }
    $output.Add([string]$_.Exception.Message)
    $summary = (($output -join ' ') -replace '\s+', ' ').Trim()
    if ($summary.Length -gt $Limit) { $summary = $summary.Substring(0, $Limit) }
    return [pscustomobject]@{ ok = $false; exit_code = $exitCode; stdout = ($captured -join "`n"); diagnostic_summary = $summary }
  }

  $summary = (($output -join ' ') -replace '\s+', ' ').Trim()
  if ($summary.Length -gt $Limit) { $summary = $summary.Substring(0, $Limit) }
  [pscustomobject]@{ ok = $true; exit_code = 0; stdout = ($captured -join "`n"); diagnostic_summary = $summary }
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

function Invoke-Warmup {
  param([object]$Tool)
  $platformKey = if ($Platform -eq 'windows') { 'windows' } else { 'unix' }
  $step = $Tool.installation.$platformKey
  if ($null -eq $step) { return }
  $command = $step.command
  $args = @(Expand-ToolArgs -Tool $Tool -Args $step.args)
  $exe = $command
  $commandArgs = @($args)
  if ($Platform -eq 'windows' -and $command -eq 'npx') {
    $exe = if (-not [string]::IsNullOrWhiteSpace($env:ComSpec)) { $env:ComSpec } else { 'cmd.exe' }
    $commandArgs = @('/d', '/c', $command) + @($args)
  }

  $processInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $processInfo.FileName = $exe
  Set-ProcessArgumentsCompat -ProcessInfo $processInfo -Arguments $commandArgs
  $processInfo.RedirectStandardOutput = $true
  $processInfo.RedirectStandardError = $true
  $processInfo.UseShellExecute = $false

  $process = [System.Diagnostics.Process]::new()
  $process.StartInfo = $processInfo
  try {
    [void]$process.Start()
    $stdoutTask = $process.StandardOutput.ReadToEndAsync()
    $stderrTask = $process.StandardError.ReadToEndAsync()
    $timedOut = -not $process.WaitForExit($script:StageTimeoutSeconds * 1000)
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
    if ($timedOut) {
      $outputParts += "timed out after $($script:StageTimeoutSeconds)s"
    }
    foreach ($line in @($outputParts)) {
      Write-Output $line
    }
    $global:LASTEXITCODE = if ($timedOut) { 124 } else { [int]$process.ExitCode }
  } catch {
    Write-Output ([string]$_.Exception.Message)
    $global:LASTEXITCODE = 127
  } finally {
    $process.Dispose()
  }
}

$results = New-Object System.Collections.Generic.List[object]
foreach ($tool in @($ToolsJson.tools)) {
  if (-not (Should-Install $tool)) { continue }

  if (-not [bool]$tool.required -and $OnlyArray.Count -eq 0) {
    continue
  }

  if (-not [bool]$tool.required -and -not (Test-OptionalToolAllowed -Tool $tool)) {
    $results.Add([pscustomobject]@{
      tool_id = $tool.id
      status = 'action-required'
      last_action = 'failed'
      install_kind = $tool.installation.kind
      reason_code = 'registry_not_required'
      next_action = 'optional MCP tools require explicit opt-in metadata and -Only <tool-id>'
      configured_path = ''
      selected_scope = ''
      fallback_applied = $false
      exit_code = $null
      diagnostic_summary = ''
      repair_diagnostic_summary = ''
    })
    continue
  }

  $status = 'ready'
  $lastAction = 'installed'
  $reasonCode = ''
  $nextAction = ''
  $configuredPath = ''
  $selectedScope = ''
  $fallbackApplied = $false
  $exitCode = $null
  $diagnosticSummary = ''
  $repairDiagnosticSummary = ''

  foreach ($dep in @($tool.dependencies)) {
    if (-not (Get-Command $dep -ErrorAction SilentlyContinue)) {
      $status = 'action-required'
      $lastAction = 'failed'
      $reasonCode = 'missing_dependency'
      $nextAction = "安装依赖: $dep"
      $diagnosticSummary = "missing dependency: $dep"
      break
    }
  }

  if ($status -eq 'ready' -and $tool.installation.kind -eq 'warmup') {
    $platformKey = if ($Platform -eq 'windows') { 'windows' } else { 'unix' }
    $warmupStep = $tool.installation.$platformKey
    $warmupArgs = @(Expand-ToolArgs -Tool $tool -Args $warmupStep.args)
    $warmupHash = Get-WarmupCommandHash -Command $warmupStep.command -Arguments $warmupArgs
    $warmupTtlSeconds = Get-WarmupCacheTtlSeconds -Command $warmupStep.command -Arguments $warmupArgs
    if (Test-WarmupCacheHit -Tool $tool -CommandHash $warmupHash -TtlSeconds $warmupTtlSeconds) {
      $lastAction = 'warmup-cache-hit'
    } else {
      $warmupResult = Invoke-Captured { Invoke-Warmup -Tool $tool }
      if (-not $warmupResult.ok) {
        $status = 'action-required'
        $lastAction = 'failed'
        $reasonCode = 'warmup_failed'
        $nextAction = '检查工具 warmup 命令与网络可达性'
        $exitCode = $warmupResult.exit_code
        $diagnosticSummary = $warmupResult.diagnostic_summary
      } else {
        Write-WarmupCache -Tool $tool -Command $warmupStep.command -Arguments $warmupArgs -CommandHash $warmupHash
      }
    }
    if ($status -ne 'ready') {
      $status = 'action-required'
      $lastAction = 'failed'
      $reasonCode = 'warmup_failed'
      $nextAction = '检查工具 warmup 命令与网络可达性'
    }
  }

  $hostConfigRequired = if ($null -ne $tool.PSObject.Properties['host_config_required']) { [bool]$tool.host_config_required } else { $true }

  if ($status -eq 'ready' -and $hostConfigRequired) {
    $configureRun = Invoke-Captured { & (Join-Path $ScriptDir 'configure-host.ps1') -Tool $tool.id }
    if ($configureRun.ok) {
      $configureResult = $configureRun.stdout | ConvertFrom-Json
      $configuredPath = $configureResult.configured_path
      $selectedScope = $configureResult.selected_scope
      $fallbackApplied = [bool]$configureResult.fallback_applied
    } else {
      $exitCode = $configureRun.exit_code
      $diagnosticSummary = $configureRun.diagnostic_summary
      $repairRun = Invoke-Captured { & (Join-Path $ScriptDir 'repair-install.ps1') -Tool $tool.id }
      if ($repairRun.ok) {
        $repairResult = $repairRun.stdout | ConvertFrom-Json
        $lastAction = 'repaired'
        $configuredPath = $repairResult.configured_path
        $selectedScope = $repairResult.selected_scope
        $fallbackApplied = [bool]$repairResult.fallback_applied
      } else {
        $status = 'action-required'
        $lastAction = 'failed'
        $reasonCode = 'configure_failed'
        $nextAction = '检查宿主 CLI、依赖与配置写入权限'
        $repairDiagnosticSummary = $repairRun.diagnostic_summary
      }
    }
  } elseif ($status -eq 'ready') {
    $lastAction = 'host-config-skipped'
    $nextAction = ''
    $diagnosticSummary = 'host MCP config is not required for this tool'
  }

  $projectState = Get-ProjectBootstrapState -Tool $tool
  if ($status -eq 'ready' -and $projectState -eq 'target-action-required') {
    $status = 'action-required'
    $lastAction = 'failed'
    $reasonCode = 'project_target_required'
    $nextAction = if ([string]::IsNullOrWhiteSpace([string]$TargetFacts.next_action)) { '选择目标 repo 后重跑 setup' } else { [string]$TargetFacts.next_action }
    $diagnosticSummary = 'project bootstrap requires a writable target repo'
  } elseif ($status -eq 'ready' -and $projectState -eq 'pending') {
    $platformKey = if ($Platform -eq 'windows') { 'windows' } else { 'unix' }
    $bootstrapStep = $tool.project_bootstrap.$platformKey
    $bootstrapArgs = @(Expand-ToolArgs -Tool $tool -Args $bootstrapStep.args)
    $bootstrapRun = Invoke-Captured {
      Push-Location $ResolvedRepoRoot
      try {
        if ($Platform -eq 'windows' -and $bootstrapStep.command -eq 'npx') {
          & cmd.exe /d /c $bootstrapStep.command @bootstrapArgs
        } else {
          & $bootstrapStep.command @bootstrapArgs
        }
      } finally {
        Pop-Location
      }
    }
    if ($bootstrapRun.ok) {
      $lastAction = 'project-bootstrapped'
    } else {
      $status = 'action-required'
      $lastAction = 'failed'
      $reasonCode = 'project_bootstrap_failed'
      $nextAction = '检查 project_bootstrap 命令、网络和 repo 写入权限'
      $exitCode = $bootstrapRun.exit_code
      $diagnosticSummary = $bootstrapRun.diagnostic_summary
    }
  } elseif ($status -eq 'ready' -and $projectState -eq 'ready') {
    $lastAction = 'project-bootstrap-cache-hit'
  }

  $results.Add([pscustomobject]@{
    tool_id = $tool.id
    status = $status
    last_action = $lastAction
    install_kind = $tool.installation.kind
    reason_code = $reasonCode
    next_action = $nextAction
    configured_path = $configuredPath
    selected_scope = $selectedScope
    fallback_applied = [bool]$fallbackApplied
    exit_code = $exitCode
    diagnostic_summary = $diagnosticSummary
    repair_diagnostic_summary = $repairDiagnosticSummary
  })
}

[pscustomobject]@{
  host = $DetectedHost
  display_name = $HostDisplayName
  platform = $Platform
  results = @($results.ToArray())
} | ConvertTo-Json -Depth 6 -Compress
