param(
  [switch]$DryRun,
  [switch]$Apply,
  [switch]$Unlink
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ($Apply -or $Unlink) {
  [Console]::Error.WriteLine('reason_code=repair-worktree-apply-deferred')
  [Console]::Error.WriteLine('repair-worktree only supports -DryRun in this release. Deleting .git is deferred to a follow-up design with dry-run fingerprint binding.')
  exit 1
}

function Get-GitHealth {
  param([string]$Path)
  $gitEntry = Join-Path $Path '.git'
  $health = [ordered]@{
    status = 'not-git'
    reason_code = 'not-git'
    git_entry_type = 'missing'
  }
  if (-not (Test-Path -LiteralPath $gitEntry)) {
    $root = git -C $Path rev-parse --show-toplevel 2>$null
    if (-not [string]::IsNullOrWhiteSpace($root)) {
      $health.status = 'ok'
      $health.reason_code = 'git-ok'
      $health.git_entry_type = 'ancestor'
    }
    return $health
  }
  if (Test-Path -LiteralPath $gitEntry -PathType Leaf) {
    $health.status = 'corrupted-gitdir'
    $health.reason_code = 'gitdir-file-unparseable'
    $health.git_entry_type = 'file'
    $firstLine = ([System.IO.File]::ReadAllText($gitEntry) -split "`n", 2)[0].TrimEnd("`r")
    if ($firstLine -like 'gitdir:*') {
      $rawPointer = $firstLine.Substring('gitdir:'.Length).Trim()
      $pointerPath = if ([System.IO.Path]::IsPathRooted($rawPointer)) {
        $rawPointer
      } else {
        [System.IO.Path]::GetFullPath((Join-Path $Path $rawPointer))
      }
      if (Test-Path -LiteralPath (Split-Path -Parent $pointerPath)) {
        $pointerPath = Join-Path (Resolve-Path -LiteralPath (Split-Path -Parent $pointerPath)).ProviderPath (Split-Path -Leaf $pointerPath)
      }
      $pointerExists = Test-Path -LiteralPath $pointerPath
      $health.status = if ($pointerExists) { 'ok' } else { 'broken-worktree' }
      $health.reason_code = if ($pointerExists) { 'git-ok' } else { 'broken-worktree' }
      $health.worktree_pointer = [ordered]@{
        raw = $rawPointer
        path = $pointerPath.Replace('\', '/')
        exists = [bool]$pointerExists
      }
    }
    return $health
  }
  if (Test-Path -LiteralPath $gitEntry -PathType Container) {
    $health.git_entry_type = 'directory'
    $root = git -C $Path rev-parse --show-toplevel 2>$null
    if ([string]::IsNullOrWhiteSpace($root)) {
      $health.status = 'corrupted-gitdir'
      $health.reason_code = 'gitdir-directory-invalid'
    } else {
      $health.status = 'ok'
      $health.reason_code = 'git-ok'
    }
    return $health
  }
  $health.status = 'corrupted-gitdir'
  $health.reason_code = 'gitdir-entry-invalid'
  $health.git_entry_type = 'other'
  return $health
}

$targetDir = (Resolve-Path -LiteralPath (Get-Location).Path).ProviderPath
$health = Get-GitHealth -Path $targetDir
if ($health.status -ne 'broken-worktree') {
  [Console]::Error.WriteLine('reason_code=repair-worktree-not-broken-worktree')
  [Console]::Error.WriteLine("repair-worktree is only available when the current directory has a broken .git worktree pointer. Current status: $($health.status).")
  exit 1
}

$gitFile = Join-Path $targetDir '.git'
$timestamp = [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ')
@"
repair_worktree_dry_run=true
generated_at=$timestamp
reason_code=broken-worktree

Broken worktree pointer:
  git_file: $gitFile
  pointer_raw: $($health.worktree_pointer.raw)
  pointer_path: $($health.worktree_pointer.path)
  pointer_exists: $($health.worktree_pointer.exists.ToString().ToLowerInvariant())

Unlink preview:
  This command will not delete files.
  Manual command, if you decide this stale worktree pointer is safe to remove:
    Remove-Item -LiteralPath "$gitFile"

Manual repair guidance:
  If this directory should become a normal Git repo, remove the stale .git pointer yourself, then run git init or restore the correct repository metadata.
  If this directory should remain a parent workspace, leave repo-local artifacts advisory-only and select child repos with -Repo <child>.

Workaround:
  For explicit non-git folder indexing, run the relevant setup/bootstrap flow with -Folder .
"@
