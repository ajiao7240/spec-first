param(
  [string]$Repo = '',
  [ValidateSet('json', 'env')]
  [string]$Format = 'json',
  [int]$ScanDepth = 3
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function ConvertTo-CanonicalPath {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) {
    throw "path not found: $Path"
  }
  return (Resolve-Path -LiteralPath $Path).ProviderPath
}

function ConvertTo-AbsolutePath {
  param([string]$Path)
  if ([System.IO.Path]::IsPathRooted($Path)) { return $Path }
  return [System.IO.Path]::GetFullPath((Join-Path (Get-Location).Path $Path))
}

function Test-PathWithin {
  param(
    [string]$Child,
    [string]$Parent
  )
  $normalizedChild = $Child.TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
  $normalizedParent = $Parent.TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
  if ($normalizedChild -eq $normalizedParent) { return $true }
  return $normalizedChild.StartsWith($normalizedParent + [System.IO.Path]::DirectorySeparatorChar)
}

function Get-RelativeToWorkspace {
  param(
    [string]$Path,
    [string]$Root
  )
  if ($Path -eq $Root) { return '.' }
  if (Test-PathWithin -Child $Path -Parent $Root) {
    return $Path.Substring($Root.TrimEnd([System.IO.Path]::DirectorySeparatorChar).Length + 1)
  }
  return $Path
}

function Get-GitRoot {
  param([string]$Path)
  $root = git -C $Path rev-parse --show-toplevel 2>$null
  if ([string]::IsNullOrWhiteSpace($root)) { return '' }
  return ConvertTo-CanonicalPath -Path $root
}

function Add-Candidate {
  param(
    [System.Collections.Generic.List[string]]$Candidates,
    [string]$Root
  )
  foreach ($existing in @($Candidates)) {
    if ($existing -eq $Root) { return }
    if (Test-PathWithin -Child $Root -Parent $existing) { return }
  }
  $Candidates.Add($Root)
}

function Find-ChildGitRepos {
  param(
    [string]$Root,
    [int]$MaxDepth
  )
  $excluded = @('.git', 'node_modules', 'vendor', '.claude', '.codex', '.agents', '.spec-first', '.cache', '.direnv', '.venv')
  $queue = New-Object System.Collections.Generic.Queue[object]
  $candidates = New-Object System.Collections.Generic.List[string]
  $queue.Enqueue([pscustomobject]@{ depth = 0; path = $Root })
  while ($queue.Count -gt 0) {
    $current = $queue.Dequeue()
    foreach ($child in @(Get-ChildItem -LiteralPath $current.path -Directory -Force -ErrorAction SilentlyContinue)) {
      if ($excluded -contains $child.Name) { continue }
      if (Test-Path -LiteralPath (Join-Path $child.FullName '.git')) {
        $gitRoot = Get-GitRoot -Path $child.FullName
        if (-not [string]::IsNullOrWhiteSpace($gitRoot) -and (Test-PathWithin -Child $gitRoot -Parent $Root)) {
          Add-Candidate -Candidates $candidates -Root $gitRoot
        }
        continue
      }
      if ([int]$current.depth -lt $MaxDepth) {
        $queue.Enqueue([pscustomobject]@{ depth = ([int]$current.depth + 1); path = $child.FullName })
      }
    }
  }
  @($candidates.ToArray() | Sort-Object)
}

$invocationCwd = ConvertTo-CanonicalPath -Path (Get-Location).Path
$cwdGitRoot = Get-GitRoot -Path $invocationCwd
$result = [ordered]@{
  schema_version = 'project-target.v1'
  mode = ''
  repo_status = 'not-git-repo'
  selection_source = ''
  state_write_allowed = $false
  invocation_cwd = $invocationCwd
  workspace_root = $invocationCwd
  selected_repo_root = $null
  repo_label = ''
  candidates = @()
  reason_code = ''
  next_action = ''
}
$exitCode = 0

if (-not [string]::IsNullOrWhiteSpace($Repo)) {
  $rawTarget = ConvertTo-AbsolutePath -Path $Repo
  if (-not (Test-Path -LiteralPath $rawTarget)) {
    $result.mode = 'invalid-target'
    $result.reason_code = 'repo-target-not-found'
    $result.next_action = 'Choose an existing child Git repo and rerun with --repo <path>.'
    $exitCode = 1
  } else {
    $canonicalTarget = ConvertTo-CanonicalPath -Path $rawTarget
    if (-not [string]::IsNullOrWhiteSpace($cwdGitRoot)) {
      $result.workspace_root = $cwdGitRoot
    }
    if (-not (Test-PathWithin -Child $canonicalTarget -Parent $result.workspace_root)) {
      $result.mode = 'invalid-target'
      $result.reason_code = 'repo-target-outside-workspace'
      $result.next_action = 'Choose a child Git repo inside the current workspace.'
      $exitCode = 1
    } else {
      $targetGitRoot = Get-GitRoot -Path $canonicalTarget
      if ([string]::IsNullOrWhiteSpace($targetGitRoot)) {
        $result.mode = 'invalid-target'
        $result.reason_code = 'repo-target-not-git'
        $result.next_action = 'Choose a path inside a child Git repo and rerun with --repo <path>.'
        $exitCode = 1
      } elseif (-not (Test-PathWithin -Child $targetGitRoot -Parent $result.workspace_root)) {
        $result.mode = 'invalid-target'
        $result.reason_code = 'repo-target-outside-workspace'
        $result.next_action = 'Choose a child Git repo inside the current workspace.'
        $exitCode = 1
      } elseif (-not [string]::IsNullOrWhiteSpace($cwdGitRoot) -and $targetGitRoot -ne $cwdGitRoot) {
        $result.mode = 'invalid-target'
        $result.reason_code = 'repo-target-outside-workspace'
        $result.next_action = 'Run from the target repo or invoke from its parent workspace.'
        $exitCode = 1
      } else {
        $result.mode = 'git-repo'
        $result.repo_status = 'git-repo'
        $result.selection_source = 'explicit-repo'
        $result.state_write_allowed = $true
        $result.selected_repo_root = $targetGitRoot
        $result.repo_label = Get-RelativeToWorkspace -Path $targetGitRoot -Root $result.workspace_root
      }
    }
  }
} elseif (-not [string]::IsNullOrWhiteSpace($cwdGitRoot)) {
  $result.mode = 'git-repo'
  $result.repo_status = 'git-repo'
  $result.selection_source = 'cwd-git-root'
  $result.state_write_allowed = $true
  $result.workspace_root = $cwdGitRoot
  $result.selected_repo_root = $cwdGitRoot
  $result.repo_label = Split-Path -Leaf $cwdGitRoot
} else {
  $candidateRoots = @(Find-ChildGitRepos -Root $result.workspace_root -MaxDepth $ScanDepth)
  $result.candidates = @($candidateRoots | ForEach-Object {
    [ordered]@{
      repo_label = Get-RelativeToWorkspace -Path $_ -Root $result.workspace_root
      git_root = $_
      workspace_relative_path = Get-RelativeToWorkspace -Path $_ -Root $result.workspace_root
      relationship = 'child_git_repo'
    }
  })
  if ($candidateRoots.Count -eq 0) {
    $result.mode = 'workspace-no-git-candidates'
    $result.reason_code = 'workspace-no-git-candidates'
    $result.next_action = 'Run from a Git repo or pass --repo <child> after creating one.'
  } elseif ($candidateRoots.Count -eq 1) {
    $result.mode = 'workspace-single-candidate'
    $result.reason_code = 'workspace-target-required'
    $result.next_action = "Rerun with --repo $($result.candidates[0].workspace_relative_path)."
  } else {
    $result.mode = 'workspace-multi-repo'
    $result.reason_code = 'workspace-target-required'
    $result.next_action = 'Choose a child Git repo and rerun with --repo <child>.'
  }
}

if ($Format -eq 'env') {
  foreach ($key in @('schema_version','mode','repo_status','selection_source','state_write_allowed','invocation_cwd','workspace_root','selected_repo_root','repo_label','reason_code','next_action')) {
    $value = $result[$key]
    if ($null -eq $value) { $value = '' }
    $escaped = ([string]$value).Replace("'", "''")
    Write-Output "$key='$escaped'"
  }
} else {
  [pscustomobject]$result | ConvertTo-Json -Depth 10 -Compress
}

exit $exitCode
