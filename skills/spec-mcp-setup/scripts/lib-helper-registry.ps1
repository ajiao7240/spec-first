function Get-HelperRegistryPath {
  $scriptDir = $PSScriptRoot
  if ([string]::IsNullOrWhiteSpace($scriptDir)) {
    $scriptDir = Split-Path -Parent $PSCommandPath
  }
  return (Join-Path (Split-Path -Parent $scriptDir) 'helper-tools.json')
}

function Get-HelperRegistry {
  return (Get-Content -Raw -LiteralPath (Get-HelperRegistryPath) | ConvertFrom-Json)
}
