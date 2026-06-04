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

function Read-McpToolsJson {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [switch]$AsHashtable
  )
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw "mcp-tools.json not found: $Path"
  }
  $raw = Get-Content -Raw -LiteralPath $Path
  if ($AsHashtable -and $PSVersionTable.PSVersion.Major -ge 6) {
    return $raw | ConvertFrom-Json -AsHashtable
  }
  return $raw | ConvertFrom-Json
}

function Get-McpToolsSchemaVersion {
  param([Parameter(Mandatory = $true)]$ToolsJson)
  $schemaVersion = Get-ToolField -Tool $ToolsJson -Name 'schema_version'
  if ($null -eq $schemaVersion -or [string]::IsNullOrWhiteSpace([string]$schemaVersion)) {
    return 'missing'
  }
  return [string]$schemaVersion
}

function Assert-McpToolsSchemaVersion {
  param(
    [Parameter(Mandatory = $true)]$ToolsJson,
    [string]$Expected = '6'
  )
  $schemaVersion = Get-McpToolsSchemaVersion -ToolsJson $ToolsJson
  if ($schemaVersion -ne $Expected) {
    throw "invalid_mcp_tools_schema_version:$schemaVersion"
  }
}

function New-StringList {
  param([object[]]$Values = @())
  $list = New-Object 'System.Collections.Generic.List[string]'
  foreach ($value in @($Values)) {
    if ($null -eq $value) { continue }
    $text = [string]$value
    if ($text.Length -eq 0) { continue }
    $list.Add($text) | Out-Null
  }
  return , $list
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
  return $expanded
}
