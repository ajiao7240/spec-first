$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Get-ToolField {
  param($Tool, [string]$Name)
  if ($null -eq $Tool) { return $null }
  if ($Tool -is [System.Collections.IDictionary]) {
    if ($Tool.Contains($Name)) { return $Tool[$Name] }
    return $null
  }
  if ($Tool.PSObject.Properties.Name -contains $Name) {
    return $Tool.$Name
  }
  return $null
}

function Expand-ToolTemplate {
  param(
    [Parameter(Mandatory = $true)]$Tool,
    [Parameter(Mandatory = $true)][AllowEmptyString()][string]$Value
  )
  $result = $Value
  $package = Get-ToolField -Tool $Tool -Name 'package'
  if ($null -eq $package) { $package = '' }
  $result = $result.Replace('{{package}}', [string]$package)
  $version = Get-ToolField -Tool $Tool -Name 'version'
  if ($null -eq $version) { $version = '' }
  $result = $result.Replace('{{version}}', [string]$version)
  return $result
}

function Expand-ToolArgs {
  param(
    [Parameter(Mandatory = $true)]$Tool,
    [Parameter(Mandatory = $true)]$Args
  )
  $expanded = @()
  foreach ($item in @($Args)) {
    $expanded += , (Expand-ToolTemplate -Tool $Tool -Value ([string]$item))
  }
  return , $expanded
}
