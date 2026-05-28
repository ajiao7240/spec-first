param(
  [string]$Repo = '',
  [string]$Folder = '',
  [switch]$AllRepos,
  [switch]$NoInstall
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw 'verify-tools.ps1: node 是必需依赖，请先安装 Node.js'
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not [string]::IsNullOrWhiteSpace($Repo) -and -not [string]::IsNullOrWhiteSpace($Folder)) {
  throw 'verify-tools.ps1: use either -Repo or -Folder, not both'
}
if ($AllRepos -and -not [string]::IsNullOrWhiteSpace($Folder)) {
  throw 'verify-tools.ps1: use either -AllRepos or -Folder, not both'
}
$HostInfo = & (Join-Path $ScriptDir 'detect-host.ps1') | ConvertFrom-Json
$MarkerPath = $HostInfo.marker_path
$MarkerDir = Split-Path -Parent $MarkerPath

# U2 host pointer self-heal: 检测 setup-owned host pointer drift,
# 在 ledger 中记录 reconciliation advisory event。
# Caller 必须在 detect-tools.ps1 给出 facts 后传入 child repo root,
# 以便 -Repo <child> / parent-workspace 路径下也能正确 reconcile。
function Get-HostPointerReconciliation {
  param(
    [string]$CurrentHost,
    [string]$RepoRoot,
    [string]$MarkerPathArg
  )
  if ([string]::IsNullOrWhiteSpace($CurrentHost)) { return $null }
  if ([string]::IsNullOrWhiteSpace($RepoRoot)) { return $null }
  $runtimePath = Join-Path $RepoRoot '.spec-first/config/runtime-capabilities.json'
  if (-not (Test-Path -LiteralPath $runtimePath -PathType Leaf)) { return $null }
  try {
    $runtimeJson = Get-Content -Raw -LiteralPath $runtimePath | ConvertFrom-Json -ErrorAction Stop
  } catch {
    [Console]::Error.WriteLine("verify-tools.ps1: runtime-capabilities.json at $runtimePath is unreadable; host pointer reconciliation skipped (will be rewritten by setup)")
    return $null
  }
  $previousHost = $null
  $previousPath = $null
  if ($runtimeJson -and $runtimeJson.host_ledger_pointer) {
    $previousHost = $runtimeJson.host_ledger_pointer.host
    $previousPath = $runtimeJson.host_ledger_pointer.path
  }
  if ([string]::IsNullOrWhiteSpace($previousHost)) { return $null }
  if ($previousHost -eq $CurrentHost) { return $null }
  return [ordered]@{
    schema_version = 'host-pointer-reconciliation.v1'
    from_host = $previousHost
    to_host = $CurrentHost
    from_marker_path = $previousPath
    to_marker_path = $MarkerPathArg
    reconciled_at = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    reason = 'host marker drift detected between previous setup run and current detect-host'
  }
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

function Write-SetupScenarioFingerprint {
  param(
    [object]$Ledger,
    [string]$LedgerPath
  )

  $stateWriteAllowed = if ($null -ne $Ledger.target) { [bool]$Ledger.target.state_write_allowed } else { $true }
  if (-not $stateWriteAllowed) { return }

  $targetRoot = if (-not [string]::IsNullOrWhiteSpace([string]$Ledger.target_root)) {
    [string]$Ledger.target_root
  } elseif (-not [string]::IsNullOrWhiteSpace([string]$Ledger.selected_repo_root)) {
    [string]$Ledger.selected_repo_root
  } elseif (-not [string]::IsNullOrWhiteSpace([string]$Ledger.workspace_root)) {
    [string]$Ledger.workspace_root
  } else {
    ''
  }
  if ([string]::IsNullOrWhiteSpace($targetRoot) -or -not (Test-Path -LiteralPath $targetRoot -PathType Container)) {
    return
  }

  $output = Join-Path $targetRoot '.spec-first/workspace/scenario-fingerprint-setup.json'
  $repoRoot = Resolve-Path -LiteralPath (Join-Path $ScriptDir '../../..')
  $helper = Join-Path $repoRoot 'src/cli/helpers/scenario-fingerprint.js'
  $stdout = ''
  $stderrPath = Join-Path ([System.IO.Path]::GetTempPath()) ('spec-first-scenario-fingerprint-{0}.log' -f ([guid]::NewGuid().ToString('N')))
  $exitCode = 127
  try {
    $global:LASTEXITCODE = 0
    if (Test-Path -LiteralPath $helper -PathType Leaf) {
      $stdout = (& node $helper --layer setup --ledger $LedgerPath --out $output 2> $stderrPath) -join "`n"
      $exitCode = if ($LASTEXITCODE -is [int]) { $LASTEXITCODE } else { 0 }
    } elseif (-not [string]::IsNullOrWhiteSpace($env:SPEC_FIRST_CLI)) {
      if ((Test-Path -LiteralPath $env:SPEC_FIRST_CLI -PathType Leaf) -and $env:SPEC_FIRST_CLI.EndsWith('.js')) {
        $stdout = (& node $env:SPEC_FIRST_CLI internal compute-scenario-fingerprint --layer setup --ledger $LedgerPath --out $output 2> $stderrPath) -join "`n"
      } else {
        $stdout = (& $env:SPEC_FIRST_CLI internal compute-scenario-fingerprint --layer setup --ledger $LedgerPath --out $output 2> $stderrPath) -join "`n"
      }
      $exitCode = if ($LASTEXITCODE -is [int]) { $LASTEXITCODE } else { 0 }
    } elseif (Get-Command spec-first -ErrorAction SilentlyContinue) {
      $stdout = (& spec-first internal compute-scenario-fingerprint --layer setup --ledger $LedgerPath --out $output 2> $stderrPath) -join "`n"
      $exitCode = if ($LASTEXITCODE -is [int]) { $LASTEXITCODE } else { 0 }
    } else {
      $stdout = 'spec-first CLI unavailable'
    }
  } catch {
    $exitCode = if ($LASTEXITCODE -is [int] -and $LASTEXITCODE -ne 0) { $LASTEXITCODE } else { 1 }
    $stdout = [string]$_.Exception.Message
  }

  $stderr = if (Test-Path -LiteralPath $stderrPath -PathType Leaf) { Get-Content -Raw -LiteralPath $stderrPath } else { '' }
  Remove-Item -Force -LiteralPath $stderrPath -ErrorAction SilentlyContinue
  if ($exitCode -eq 0 -and (Test-Path -LiteralPath $output -PathType Leaf)) {
    $Ledger['scenario_fingerprint_setup'] = [ordered]@{
      status = 'written'
      schema_version = 'developer-scenario-fingerprint-setup.v1'
      path = $output
      advisory = $true
    }
    Write-Host "🧭 setup scenario fingerprint: $output"
  } else {
    $diagnostic = (@($stdout, $stderr) | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) }) -join "`n"
    $Ledger['scenario_fingerprint_setup'] = [ordered]@{
      status = 'failed'
      schema_version = 'developer-scenario-fingerprint-setup.v1'
      advisory = $true
      diagnostic = (($diagnostic -split "`n") | Select-Object -First 6) -join "`n"
    }
    [Console]::Error.WriteLine('verify-tools.ps1: setup scenario fingerprint failed; continuing')
  }
  $Ledger | ConvertTo-Json -Depth 12 | Set-Content -Encoding utf8 $LedgerPath
}

function Invoke-ChildScriptCaptured {
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

  $stdoutText = ($stdout -join "`n")
  $diagnosticParts = @($stdoutText, $stderrText, $informationText, $exceptionText) | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) }
  [pscustomobject]@{
    stdout = $stdoutText
    stderr = $stderrText
    information = $informationText
    diagnostic = ($diagnosticParts -join "`n").Trim()
    exit_code = $exitCode
  }
}

function Write-WorkspaceMcpVerifySummaryAndExit {
  param(
    [object]$TargetFacts,
    [string]$SelectionSource = 'explicit-all-repos'
  )

  $workspaceRoot = [string]$TargetFacts.workspace_root
  if (-not [string]::IsNullOrWhiteSpace($Repo)) {
    [pscustomobject]@{
      schema_version = 'workspace-mcp-verify-summary.v1'
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
      schema_version = 'workspace-mcp-verify-summary.v1'
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
    $targetGitHealth = if ($TargetFacts.PSObject.Properties.Name -contains 'git_health') { $TargetFacts.git_health } else { $null }
    $targetGitStatus = if ($targetGitHealth -and $targetGitHealth.PSObject.Properties.Name -contains 'status') { [string]$targetGitHealth.status } else { '' }
    [pscustomobject]@{
      schema_version = 'workspace-mcp-verify-summary.v1'
      overall_status = 'action-required'
      workflow_mode = 'blocked'
      reason_code = if ([string]::IsNullOrWhiteSpace([string]$TargetFacts.reason_code)) { 'workspace-no-git-candidates' } else { [string]$TargetFacts.reason_code }
      workspace_root = $workspaceRoot
      parent_workspace_advisory = [ordered]@{
        git_health = $targetGitHealth
        coverage_gap = if ($TargetFacts.PSObject.Properties.Name -contains 'coverage_gap') { $TargetFacts.coverage_gap } else { $null }
        candidates_diagnostics = if ($TargetFacts.PSObject.Properties.Name -contains 'candidates_diagnostics') { @($TargetFacts.candidates_diagnostics) } else { @() }
        repair_action_available = ($targetGitStatus -eq 'broken-worktree')
        repair_command = if ($targetGitStatus -eq 'broken-worktree') { 'spec-first repair-worktree --dry-run' } else { $null }
        diagnostic_action_available = ($targetGitStatus -eq 'corrupted-gitdir')
        diagnostic_command = if ($targetGitStatus -eq 'corrupted-gitdir') { 'git fsck' } else { $null }
      }
      candidates = @($TargetFacts.candidates)
      advisory = $true
      next_action = if ([string]::IsNullOrWhiteSpace([string]$TargetFacts.next_action)) { 'Run from a parent workspace containing child Git repos.' } else { [string]$TargetFacts.next_action }
    } | ConvertTo-Json -Compress
    exit 1
  }

  New-Item -ItemType Directory -Force -Path $MarkerDir | Out-Null
  $results = @()
  foreach ($child in $children) {
    $childRun = Invoke-ChildScriptCaptured -ScriptPath $PSCommandPath -Arguments @{ Repo = [string]$child.workspace_relative_path }
    $childStatus = [int]$childRun.exit_code
    $childText = [string]$childRun.diagnostic
    if (Test-Path -LiteralPath $MarkerPath -PathType Leaf) {
      try {
        $childLedger = Get-Content -Raw $MarkerPath | ConvertFrom-Json
        $childOverall = if ([bool]$childLedger.baseline_ready) { 'ready' } else { 'action-required' }
        if ($childStatus -ne 0 -and $childOverall -eq 'ready') {
          $childOverall = 'action-required'
        }
        $childReason = if ($childStatus -ne 0 -and [string]::IsNullOrWhiteSpace([string]$childLedger.reason_code)) { 'child-verify-failed' } else { [string]$childLedger.reason_code }
        $childResult = [pscustomobject]@{
          schema_version = 'mcp-verify-child-result.v1'
          baseline_ready = [bool]$childLedger.baseline_ready
          repo_config_status = $childLedger.repo_config_status
          runtime_capabilities_status = $childLedger.runtime_capabilities_status
          provider_artifacts_status = $childLedger.provider_artifacts_status
          graph_bootstrap_required = [bool]$childLedger.graph_bootstrap_required
          reason_code = [string]$childLedger.reason_code
          next_actions = @($childLedger.next_actions)
        }
      } catch {
        $childOverall = 'action-required'
        $childReason = 'child-verify-ledger-unavailable'
        $childResult = [pscustomobject]@{
          schema_version = 'mcp-verify-child-result.v1'
          baseline_ready = $false
          reason_code = 'child-verify-ledger-unavailable'
          diagnostic = $childText
        }
      }
    } else {
      $childOverall = 'action-required'
      $childReason = 'child-verify-ledger-unavailable'
      $childResult = [pscustomobject]@{
        schema_version = 'mcp-verify-child-result.v1'
        baseline_ready = $false
        reason_code = 'child-verify-ledger-unavailable'
        diagnostic = $childText
      }
    }

    $results += [pscustomobject][ordered]@{
      repo_label = [string]$child.repo_label
      workspace_relative_path = [string]$child.workspace_relative_path
      exit_code = $childStatus
      overall_status = $childOverall
      reason_code = if ([string]::IsNullOrWhiteSpace($childReason)) { $null } else { $childReason }
      result = $childResult
    }
  }

  $readyCount = @($results | Where-Object { $_.overall_status -eq 'ready' }).Count
  $actionRequiredCount = @($results | Where-Object { $_.overall_status -ne 'ready' }).Count
  $overallStatus = if ($results.Count -eq 0) { 'action-required' } elseif ($actionRequiredCount -eq 0) { 'ready' } elseif ($readyCount -gt 0) { 'partial' } else { 'action-required' }
  $targetGitHealth = if ($TargetFacts.PSObject.Properties.Name -contains 'git_health') { $TargetFacts.git_health } else { $null }
  $targetGitStatus = if ($targetGitHealth -and $targetGitHealth.PSObject.Properties.Name -contains 'status') { [string]$targetGitHealth.status } else { '' }
  $summary = [ordered]@{
    schema_version = 'workspace-mcp-verify-summary.v1'
    generated_at = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
    advisory = $true
    workflow_mode = 'all-repos'
    selection_source = $SelectionSource
    workspace_root = $workspaceRoot
    parent_workspace_advisory = [ordered]@{
      git_health = $targetGitHealth
      coverage_gap = if ($TargetFacts.PSObject.Properties.Name -contains 'coverage_gap') { $TargetFacts.coverage_gap } else { $null }
      candidates_diagnostics = if ($TargetFacts.PSObject.Properties.Name -contains 'candidates_diagnostics') { @($TargetFacts.candidates_diagnostics) } else { @() }
      repair_action_available = ($targetGitStatus -eq 'broken-worktree')
      repair_command = if ($targetGitStatus -eq 'broken-worktree') { 'spec-first repair-worktree --dry-run' } else { $null }
      diagnostic_action_available = ($targetGitStatus -eq 'corrupted-gitdir')
      diagnostic_command = if ($targetGitStatus -eq 'corrupted-gitdir') { 'git fsck' } else { $null }
    }
    parent_writes_repo_local_artifacts = $false
    results = @($results)
    counts = [ordered]@{
      total = $results.Count
      ready = $readyCount
      action_required = $actionRequiredCount
    }
    overall_status = $overallStatus
    reason_code = if ($actionRequiredCount -eq 0) { $null } else { 'all-repos-partial-or-action-required' }
    next_action = if ($actionRequiredCount -eq 0) { 'All child repos verified Required Harness Runtime readiness.' } else { 'Inspect per-child reason_code and rerun setup/verify for action-required repos.' }
  }

  try {
    Write-JsonFileAtomic -Path (Join-Path $workspaceRoot '.spec-first/workspace/mcp-verify-summary.json') -Payload ([pscustomobject]$summary) -Depth 30
  } catch {
    [pscustomobject]@{
      schema_version = 'workspace-mcp-verify-summary.v1'
      overall_status = 'action-required'
      workflow_mode = 'blocked'
      reason_code = 'workspace-summary-symlink-escape'
      workspace_root = $workspaceRoot
      advisory = $true
      next_action = 'Replace symlinked .spec-first/workspace with a real workspace-local directory and rerun verify.'
    } | ConvertTo-Json -Compress
    exit 1
  }
  [pscustomobject]$summary | ConvertTo-Json -Depth 30 -Compress
  if ($overallStatus -ne 'ready') { exit 1 }
  exit 0
}

if ($AllRepos) {
  $targetFactsForAll = (& (Join-Path $ScriptDir 'resolve-project-target.ps1') -Format json) | ConvertFrom-Json
  Write-WorkspaceMcpVerifySummaryAndExit -TargetFacts $targetFactsForAll -SelectionSource 'explicit-all-repos'
}

if (-not $AllRepos -and [string]::IsNullOrWhiteSpace($Repo) -and [string]::IsNullOrWhiteSpace($Folder)) {
  $targetFactsForDefaultAll = (& (Join-Path $ScriptDir 'resolve-project-target.ps1') -Format json) | ConvertFrom-Json
  $defaultChildren = @($targetFactsForDefaultAll.candidates)
  if ($targetFactsForDefaultAll.mode -ne 'git-repo' -and $defaultChildren.Count -gt 0) {
    Write-WorkspaceMcpVerifySummaryAndExit -TargetFacts $targetFactsForDefaultAll -SelectionSource 'workspace-default-all-repos'
  }
}

$detectParams = @{}
if (-not [string]::IsNullOrWhiteSpace($Repo)) { $detectParams.Repo = $Repo }
if (-not [string]::IsNullOrWhiteSpace($Folder)) { $detectParams.Folder = $Folder }
$Facts = & (Join-Path $ScriptDir 'detect-tools.ps1') @detectParams | ConvertFrom-Json
$HelperFacts = & (Join-Path $ScriptDir 'install-helpers.ps1') -VerifyOnly | ConvertFrom-Json

$reconciliationHost = $Facts.host
$reconciliationRepoRoot = if (-not [string]::IsNullOrWhiteSpace([string]$Facts.selected_repo_root)) {
  [string]$Facts.selected_repo_root
} elseif ($null -ne $Facts.PSObject.Properties['target'] -and -not [string]::IsNullOrWhiteSpace([string]$Facts.target.selected_folder_root)) {
  [string]$Facts.target.selected_folder_root
} elseif ($null -ne $Facts.PSObject.Properties['target'] -and -not [string]::IsNullOrWhiteSpace([string]$Facts.target.target_root)) {
  [string]$Facts.target.target_root
} else {
  [string]$Facts.repo_root
}
$HostPointerReconciliation = Get-HostPointerReconciliation -CurrentHost $reconciliationHost -RepoRoot $reconciliationRepoRoot -MarkerPathArg $MarkerPath

function Test-ToolReady {
  param([object]$Tool)
  $hostReady = (
    ($Tool.PSObject.Properties.Name -contains 'host_config_required' -and -not [bool]$Tool.host_config_required -and $Tool.host_config_status -eq 'not-required') -or
    $Tool.host_config_status -eq 'ready' -or
    $Tool.host_config_status -eq 'fallback-active'
  )
  return (
    $Tool.dependency_status -eq 'ready' -and
    $hostReady -and
    ($Tool.project_status -eq 'ready' -or $Tool.project_status -eq 'not-applicable' -or $Tool.project_status -eq 'workspace-target-required')
  )
}

$toolsReady = $true
foreach ($property in $Facts.tools.PSObject.Properties) {
  if (-not (Test-ToolReady -Tool $property.Value)) {
    $toolsReady = $false
    break
  }
}

$helperTools = $HelperFacts.helper_tools
$helperReady = $true
foreach ($property in $helperTools.PSObject.Properties) {
  $baselineBlocking = if ($property.Value.PSObject.Properties.Name -contains 'baseline_blocking') { [bool]$property.Value.baseline_blocking } else { $true }
  $nonBlockingResult = (-not $baselineBlocking) -and @('degraded', 'skipped') -contains $property.Value.result
  if ($property.Value.result -ne 'ready' -and -not $nonBlockingResult) {
    $helperReady = $false
    break
  }
}
$baselineReady = ($toolsReady -and $helperReady)
$gitHealth = if ($Facts.PSObject.Properties.Name -contains 'git_health') { $Facts.git_health } elseif ($Facts.target -and $Facts.target.PSObject.Properties.Name -contains 'git_health') { $Facts.target.git_health } else { $null }
$gitStatus = if ($gitHealth -and $gitHealth.PSObject.Properties.Name -contains 'status') { [string]$gitHealth.status } else { '' }
$parentWorkspaceAdvisory = [ordered]@{
  git_health = $gitHealth
  coverage_gap = if ($Facts.PSObject.Properties.Name -contains 'coverage_gap') { $Facts.coverage_gap } elseif ($Facts.target -and $Facts.target.PSObject.Properties.Name -contains 'coverage_gap') { $Facts.target.coverage_gap } else { $null }
  candidates_diagnostics = if ($Facts.PSObject.Properties.Name -contains 'candidates_diagnostics') { @($Facts.candidates_diagnostics) } elseif ($Facts.target -and $Facts.target.PSObject.Properties.Name -contains 'candidates_diagnostics') { @($Facts.target.candidates_diagnostics) } else { @() }
  repair_action_available = ($gitStatus -eq 'broken-worktree')
  repair_command = if ($gitStatus -eq 'broken-worktree') { 'spec-first repair-worktree --dry-run' } else { $null }
  diagnostic_action_available = ($gitStatus -eq 'corrupted-gitdir')
  diagnostic_command = if ($gitStatus -eq 'corrupted-gitdir') { 'git fsck' } else { $null }
}

$nextActions = New-Object System.Collections.Generic.List[string]
foreach ($action in @($Facts.next_actions)) {
  if (-not [string]::IsNullOrWhiteSpace($action) -and -not $nextActions.Contains($action)) {
    $nextActions.Add($action)
  }
}
foreach ($property in $helperTools.PSObject.Properties) {
  $helperAction = $property.Value.next_action
  $baselineBlocking = if ($property.Value.PSObject.Properties.Name -contains 'baseline_blocking') { [bool]$property.Value.baseline_blocking } else { $true }
  $nonBlockingResult = (-not $baselineBlocking) -and @('degraded', 'skipped') -contains $property.Value.result
  if (-not $nonBlockingResult -and -not [string]::IsNullOrWhiteSpace($helperAction) -and -not $nextActions.Contains($helperAction)) {
    $nextActions.Add($helperAction)
  }
}
if ($baselineReady -and -not $nextActions.Contains('run spec-graph-bootstrap')) {
  $nextActions.Add('run spec-graph-bootstrap')
}
$factsTargetKind = if ($Facts.PSObject.Properties.Name -contains 'target_kind') { [string]$Facts.target_kind } else { '' }
if ($null -ne $Facts.PSObject.Properties['target'] -and -not [bool]$Facts.target.state_write_allowed -and -not [string]::IsNullOrWhiteSpace([string]$Facts.target.next_action) -and -not $nextActions.Contains([string]$Facts.target.next_action)) {
  $nextActions.Add([string]$Facts.target.next_action)
} elseif ($Facts.repo_status -eq 'not-git-repo' -and $factsTargetKind -ne 'non-git-folder' -and -not $nextActions.Contains('choose a child repo and rerun with --repo <child>')) {
  $nextActions.Add('choose a child repo and rerun with --repo <child>')
}

New-Item -ItemType Directory -Force -Path $MarkerDir | Out-Null
$combined = [ordered]@{
  schema_version = 'v2'
  host = $Facts.host
  platform = $Facts.platform
  repo_root = $Facts.repo_root
  repo_status = $Facts.repo_status
  target = $Facts.target
  target_mode = $Facts.target_mode
  target_kind = $factsTargetKind
  workspace_root = $Facts.workspace_root
  selected_repo_root = $Facts.selected_repo_root
  selected_folder_root = if ($null -ne $Facts.PSObject.Properties['target']) { $Facts.target.selected_folder_root } else { $null }
  target_root = if ($null -ne $Facts.PSObject.Properties['target']) { $Facts.target.target_root } else { $Facts.repo_root }
  parent_workspace_advisory = $parentWorkspaceAdvisory
  target_candidate_count = $Facts.target_candidate_count
  target_candidates = @($Facts.target_candidates)
  reason_code = $Facts.reason_code
  host_ledger_pointer = [ordered]@{
    host = $Facts.host
    path = $MarkerPath
    schema_version = 'v2'
  }
  host_pointer_reconciliation = $HostPointerReconciliation
  repo_config_status = 'pending'
  repo_config_path = $null
  runtime_capabilities_status = 'pending'
  runtime_capabilities_path = $null
  provider_artifacts_status = 'pending'
  provider_artifacts_path = $null
  overall_status = if ($baselineReady) { 'ready' } else { 'action-required' }
  baseline_ready = [bool]$baselineReady
  host_runtime_ready = [bool]$baselineReady
  graph_bootstrap_required = $true
  completed_at = [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ')
  tools = $Facts.tools
  graph_providers = $Facts.graph_providers
  helper_tools = $helperTools
  mirror_endpoints = if ($HelperFacts.PSObject.Properties.Name -contains 'mirror_endpoints') { $HelperFacts.mirror_endpoints } else { $null }
  recommended_environment_variables = if ($HelperFacts.PSObject.Properties.Name -contains 'recommended_environment_variables') { $HelperFacts.recommended_environment_variables } else { $null }
  next_actions = @($nextActions)
}

$combinedTmp = Join-Path $MarkerDir ("readiness-ledger-combined.{0}.tmp" -f ([guid]::NewGuid().ToString('N')))
$finalTmp = Join-Path $MarkerDir ("readiness-ledger.{0}.tmp" -f ([guid]::NewGuid().ToString('N')))
$combined | ConvertTo-Json -Depth 10 | Set-Content -Encoding utf8 $combinedTmp

$providerResult = & (Join-Path $ScriptDir 'write-provider-config.ps1') -FactsFile $combinedTmp | ConvertFrom-Json
$combined.repo_config_status = $providerResult.repo_config_status
$combined.repo_config_path = $providerResult.repo_config_path
$combined.runtime_capabilities_status = if ($providerResult.PSObject.Properties.Name -contains 'runtime_capabilities_status') { $providerResult.runtime_capabilities_status } else { 'unknown' }
$combined.runtime_capabilities_path = if ($providerResult.PSObject.Properties.Name -contains 'runtime_capabilities_path') { $providerResult.runtime_capabilities_path } else { $null }
$combined.provider_artifacts_status = if ($providerResult.PSObject.Properties.Name -contains 'provider_artifacts_status') { $providerResult.provider_artifacts_status } else { 'unknown' }
$combined.provider_artifacts_path = if ($providerResult.PSObject.Properties.Name -contains 'provider_artifacts_path') { $providerResult.provider_artifacts_path } else { $null }
$combined.graph_bootstrap_required = if ($providerResult.PSObject.Properties.Name -contains 'graph_bootstrap_required') { [bool]$providerResult.graph_bootstrap_required } else { $true }
$providerActionRequired = @($combined.repo_config_status, $combined.runtime_capabilities_status, $combined.provider_artifacts_status) | Where-Object { $_ -ne 'ready' -and $_ -ne 'written' }
if ($providerActionRequired.Count -gt 0) {
  $combined.baseline_ready = $false
  $combined.host_runtime_ready = $false
  $combined.overall_status = 'action-required'
}

if ($providerResult.PSObject.Properties.Name -contains 'providers' -and $null -ne $providerResult.providers) {
  foreach ($property in $providerResult.providers.PSObject.Properties) {
    $provider = $property.Value
    if ($combined.tools.PSObject.Properties.Name -contains $property.Name) {
      $tool = $combined.tools.PSObject.Properties[$property.Name].Value
      $tool.query_ready = [bool]$provider.query_ready
      $tool.bootstrap_required = [bool]$provider.bootstrap_required
      $tool.next_action = if ($provider.PSObject.Properties.Name -contains 'next_action') { $provider.next_action } else { '' }
    }
    if ($combined.graph_providers.PSObject.Properties.Name -contains $property.Name) {
      $graphProvider = $combined.graph_providers.PSObject.Properties[$property.Name].Value
      $graphProvider.query_ready = [bool]$provider.query_ready
      $graphProvider.bootstrap_required = [bool]$provider.bootstrap_required
      $graphProvider.next_action = if ($provider.PSObject.Properties.Name -contains 'next_action') { $provider.next_action } else { '' }
    }
  }
}
$filteredNextActions = New-Object System.Collections.Generic.List[string]
$nonBlockingHelperActions = New-Object System.Collections.Generic.List[string]
foreach ($property in $combined.helper_tools.PSObject.Properties) {
  $helper = $property.Value
  $baselineBlocking = if ($helper.PSObject.Properties.Name -contains 'baseline_blocking') { [bool]$helper.baseline_blocking } else { $true }
  if ((-not $baselineBlocking) -and @('degraded', 'skipped') -contains $helper.result -and -not [string]::IsNullOrWhiteSpace([string]$helper.next_action)) {
    $nonBlockingHelperActions.Add([string]$helper.next_action)
  }
}
foreach ($action in @($combined.next_actions)) {
  if (
    -not [string]::IsNullOrWhiteSpace($action) -and
    $action -ne 'run spec-graph-bootstrap' -and
    $action -ne 'enter a git repo and run spec-graph-bootstrap' -and
    -not $nonBlockingHelperActions.Contains([string]$action) -and
    -not $filteredNextActions.Contains($action)
  ) {
    $filteredNextActions.Add($action)
  }
}
if ($null -ne $combined.target -and -not [bool]$combined.target.state_write_allowed -and -not [string]::IsNullOrWhiteSpace([string]$combined.target.next_action) -and -not $filteredNextActions.Contains([string]$combined.target.next_action)) {
  $filteredNextActions.Add([string]$combined.target.next_action)
} elseif ($combined.repo_status -eq 'not-git-repo' -and [string]$combined.target_kind -ne 'non-git-folder' -and -not $filteredNextActions.Contains('choose a child repo and rerun with --repo <child>')) {
  $filteredNextActions.Add('choose a child repo and rerun with --repo <child>')
} elseif ($combined.baseline_ready -and $combined.graph_bootstrap_required -and -not $filteredNextActions.Contains('run spec-graph-bootstrap')) {
  $filteredNextActions.Add('run spec-graph-bootstrap')
}
$combined.next_actions = @($filteredNextActions)

$combined | ConvertTo-Json -Depth 10 | Set-Content -Encoding utf8 $finalTmp
Move-Item -Force $finalTmp $MarkerPath
Remove-Item -Force $combinedTmp -ErrorAction SilentlyContinue
Write-SetupScenarioFingerprint -Ledger $combined -LedgerPath $MarkerPath

function Format-Cell {
  param([object]$Value)
  if ($null -eq $Value) { return 'n/a' }
  $text = [string]$Value
  if ([string]::IsNullOrWhiteSpace($text)) { return 'n/a' }
  if ($text -eq 'not-applicable') { return 'n/a' }
  if ($text -eq 'fallback-active') { return 'fallback' }
  return $text
}

function Format-Required {
  param([object]$Value)
  if ($null -eq $Value) { return 'n/a' }
  if ([bool]$Value) { return 'yes' }
  return 'no'
}

function Format-Query {
  param([object]$Value)
  if ($null -eq $Value) { return 'n/a' }
  if ([bool]$Value) { return 'ready' }
  return 'pending'
}

function Format-Bootstrap {
  param([object]$Value)
  if ($null -eq $Value) { return 'n/a' }
  if ([bool]$Value) { return 'required' }
  return 'done'
}

function Get-ProviderNamesByQueryReady {
  param(
    [object]$Tools,
    [bool]$Ready
  )

  $names = @()
  foreach ($property in $Tools.PSObject.Properties) {
    $tool = $property.Value
    if ($tool.type -ne 'graph-provider') {
      continue
    }
    $queryReady = if ($tool.PSObject.Properties.Name -contains 'query_ready') { [bool]$tool.query_ready } else { $false }
    if ($queryReady -eq $Ready) {
      $names += $property.Name
    }
  }
  if ($names.Count -eq 0) { return 'n/a' }
  return ($names -join ',')
}

function Format-Remark {
  param([string]$Name)
  switch ($Name) {
    'sequential-thinking' { return '反思式推理辅助' }
    'context7' { return '当前框架和库文档' }
    'gitnexus' { return '全局代码知识图谱与影响分析' }
    'agent-browser' { return '浏览器自动化辅助' }
    'gh' { return 'GitHub issue 和 PR 操作' }
    'jq' { return 'JSON 解析与转换' }
    'vhs' { return '终端演示录制' }
    'silicon' { return '代码截图渲染' }
    'ffmpeg' { return '媒体转换与视频合成' }
    'ast-grep' { return '结构化代码搜索和重写' }
    'ast-grep-skill' { return 'ast-grep 使用指引' }
    'graph-providers.json' { return '供 graph bootstrap 消费的 provider 投影' }
    'runtime-capabilities.json' { return '记录 setup-owned 能力事实和 host ledger 指针' }
    'provider-artifacts.json' { return '记录 setup-owned provider 产物与就绪证据' }
    default { return 'MCP 工具' }
  }
}

function Write-StatusBlock {
  param([object[]]$Sections)

  $payload = [ordered]@{
    sections = @($Sections)
  }

  $json = $payload | ConvertTo-Json -Depth 10
  $json | & node (Join-Path $ScriptDir 'render-status-block.cjs')
  if ($LASTEXITCODE -ne 0) {
    throw "render-status-block.cjs failed with exit code $LASTEXITCODE"
  }
}

Write-Host "📝 宿主就绪标记已更新: $MarkerPath"
Write-Host "🔎 当前宿主基线状态: $($combined.overall_status)"
Write-Host "🧭 baseline_ready: $($combined.baseline_ready)"
if ($combined.graph_bootstrap_required) {
  Write-Host '🧩 Graph providers are configured but not query-ready yet.'
} else {
  Write-Host '🧩 Graph providers are query-ready.'
}
Write-Host '✅ readiness ledger v2 已写入'
Write-Host ''
Write-Host 'Required Harness Runtime status (grouped):'
$harnessNext = if ($combined.baseline_ready) { '' } else { 'fix action-required rows' }
$graphSummaryStatus = if ($combined.graph_bootstrap_required) { 'pending' } else { 'ready' }
$graphSummaryNext = if ($combined.graph_bootstrap_required) { 'run spec-graph-bootstrap' } else { '' }
$graphSummaryEvidence = "ready: $(Get-ProviderNamesByQueryReady -Tools $combined.tools -Ready $true); pending: $(Get-ProviderNamesByQueryReady -Tools $combined.tools -Ready $false)"
$summaryRows = @(
  @(
    'Harness runtime',
    $(if ($combined.baseline_ready) { 'ready' } else { 'action-required' }),
    "baseline_ready=$($combined.baseline_ready.ToString().ToLowerInvariant())",
    $harnessNext
  ),
  @(
    'Graph readiness',
    $graphSummaryStatus,
    $graphSummaryEvidence,
    $graphSummaryNext
  )
)

$mcpRows = @(
  foreach ($property in $combined.tools.PSObject.Properties) {
    $tool = $property.Value
    if ($tool.type -ne 'mcp') {
      continue
    }

    ,@(
      (Format-Cell $property.Name),
      (Format-Cell (Format-Remark $property.Name)),
      (Format-Cell $tool.dependency_status),
      (Format-Cell $tool.host_config_status),
      (Format-Cell $tool.project_status),
      (Format-Cell $tool.next_action)
    )
  }
)

$graphRows = @(
  foreach ($property in $combined.tools.PSObject.Properties) {
    $tool = $property.Value
    if ($tool.type -ne 'graph-provider') {
      continue
    }

    ,@(
      (Format-Cell $property.Name),
      (Format-Cell (Format-Remark $property.Name)),
      (Format-Cell $tool.dependency_status),
      (Format-Cell $tool.host_config_status),
      (Format-Query $tool.query_ready),
      (Format-Bootstrap $tool.bootstrap_required),
      (Format-Cell $tool.next_action)
    )
  }
)

$helperRows = @(
  foreach ($property in $combined.helper_tools.PSObject.Properties) {
    $helper = $property.Value
    ,@(
      (Format-Cell $property.Name),
      (Format-Cell $(if ($helper.PSObject.Properties.Name -contains 'type') { $helper.type } else { 'helper' })),
      (Format-Cell $helper.result),
      (Format-Cell $helper.dependency_status),
      (Format-Cell $helper.install_status),
      (Format-Cell $helper.skill_status),
      (Format-Cell $helper.next_action)
    )
  }
)

$targetNext = if ($null -ne $combined.target -and -not [string]::IsNullOrWhiteSpace([string]$combined.target.next_action)) { [string]$combined.target.next_action } else { '' }
$projectionNext = if ($combined.repo_config_status -eq 'ready' -or $combined.repo_config_status -eq 'written') { '' } elseif (-not [string]::IsNullOrWhiteSpace($targetNext)) { $targetNext } else { 'write provider projection' }
$runtimeNext = if ($combined.runtime_capabilities_status -eq 'ready' -or $combined.runtime_capabilities_status -eq 'written') { '' } elseif (-not [string]::IsNullOrWhiteSpace($targetNext)) { $targetNext } else { 'write runtime capabilities' }
$artifactsNext = if ($combined.provider_artifacts_status -eq 'ready' -or $combined.provider_artifacts_status -eq 'written') { '' } elseif (-not [string]::IsNullOrWhiteSpace($targetNext)) { $targetNext } else { 'write provider artifacts' }

$sections = @(
  [ordered]@{
    title = 'Execution result'
    headers = @('Area', 'Status', 'Evidence', 'Next')
    rows = $summaryRows
  }
  [ordered]@{
    title = 'MCP servers'
    headers = @('Name', 'Role', 'Dependency', 'Host', 'Project', 'Next')
    rows = $mcpRows
  }
  [ordered]@{
    title = 'Graph providers'
    headers = @('Name', 'Role', 'Dependency', 'Host', 'Query', 'Bootstrap', 'Next')
    rows = $graphRows
  }
  [ordered]@{
    title = 'Helper tools'
    headers = @('Name', 'Type', 'Result', 'Dependency', 'Install', 'Skill', 'Next')
    rows = $helperRows
  }
  [ordered]@{
    title = 'Project setup facts'
    headers = @('Artifact', 'Project', 'Next')
    rows = @(
      @('graph-providers.json', (Format-Cell $combined.repo_config_status), (Format-Cell $projectionNext)),
      @('runtime-capabilities.json', (Format-Cell $combined.runtime_capabilities_status), (Format-Cell $runtimeNext)),
      @('provider-artifacts.json', (Format-Cell $combined.provider_artifacts_status), (Format-Cell $artifactsNext))
    )
  }
)

Write-StatusBlock -Sections $sections

switch ($combined.host) {
  'claude' {
    $hostDisplay = 'Claude Code'
    $setupCommand = '/spec:mcp-setup'
    $graphCommand = '/spec:graph-bootstrap'
  }
  'codex' {
    $hostDisplay = 'Codex'
    $setupCommand = '$spec-mcp-setup'
    $graphCommand = '$spec-graph-bootstrap'
  }
  default {
    $hostDisplay = 'Claude Code / Codex'
    $setupCommand = '/spec:mcp-setup or $spec-mcp-setup'
    $graphCommand = '/spec:graph-bootstrap or $spec-graph-bootstrap'
  }
}

Write-Host ''
Write-Host '下一步:'
if ($combined.baseline_ready) {
  $targetStateWriteAllowed = if ($null -ne $combined.target) { [bool]$combined.target.state_write_allowed } else { $true }
  $targetNextAction = if ($null -ne $combined.target) { [string]$combined.target.next_action } else { '' }
  if (-not $targetStateWriteAllowed) {
    Write-Host "  1. 选择目标 child repo，并用 --repo 重新运行 $setupCommand / $graphCommand。"
    if (-not [string]::IsNullOrWhiteSpace($targetNextAction)) {
      Write-Host "     $targetNextAction"
    }
  } else {
    if ($combined.graph_bootstrap_required) {
      Write-Host "  1. 现在可以运行 $graphCommand 完成 deterministic graph readiness 编译；也可以在本会话直接回复“继续完成”，让 agent 调用 bootstrap 脚本。"
      Write-Host "  2. 如果只需要 Plan 阶段 live GitNexus evidence，可在当前已可见 MCP surface 下进入 plan；若 setup 刚写入 MCP 配置，先重启 $hostDisplay 或新开会话再 probe。"
      Write-Host "  3. dirty worktree 或 stale durable readiness 不等于 Plan 不能使用 prior/session-local GitNexus evidence；需要 durable readiness 时再运行 $graphCommand。"
      Write-Host '  4. graph readiness 完成后，按用户意图进入 plan/work/review/debug 等下游 workflow；项目指导来自 AGENTS.md、CLAUDE.md、docs/contracts、源码、测试和 graph readiness facts。'
      Write-Host "  5. 重启 $hostDisplay 或新开会话只在下游 workflow 依赖新写入的 MCP 配置或 live MCP probe 前需要。"
    } else {
      Write-Host '  1. graph readiness 已就绪；如果已经有明确任务，可以在新会话直接描述目标，或选择匹配的 plan/work/review/debug workflow。'
      Write-Host '  2. 如果已经有明确任务，可以在新会话直接描述目标；using-spec-first 会按意图选择合适 workflow。'
      Write-Host "  3. 重启 $hostDisplay 或新开会话只在下游 workflow 依赖新写入的 MCP 配置或 live MCP probe 前需要。"
    }
  }
} else {
  Write-Host "  1. 先处理表格中的 action-required 行，然后重新运行 $setupCommand。"
  Write-Host "  2. 全部 ready 后重启 $hostDisplay 或新开会话，让新写入的 MCP 配置被宿主加载。"
}
