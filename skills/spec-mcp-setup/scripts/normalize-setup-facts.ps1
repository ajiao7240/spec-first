param(
  [string]$FactsFile
)

$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
node (Join-Path $ScriptDir 'normalize-setup-facts.cjs') --facts-file $FactsFile
