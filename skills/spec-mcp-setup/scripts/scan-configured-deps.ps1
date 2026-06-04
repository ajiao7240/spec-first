param(
  [string]$RepoRoot,
  [string]$FactsFile
)

$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$argsList = @()
if (-not [string]::IsNullOrWhiteSpace($RepoRoot)) {
  $argsList += @('--repo-root', $RepoRoot)
}
if (-not [string]::IsNullOrWhiteSpace($FactsFile)) {
  $argsList += @('--facts-file', $FactsFile)
}
node (Join-Path $ScriptDir 'scan-configured-deps.cjs') @argsList
