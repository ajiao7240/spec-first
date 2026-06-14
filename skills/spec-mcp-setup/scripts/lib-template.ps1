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
    return Resolve-McpToolsJsonDependencies -ToolsJson ($raw | ConvertFrom-Json -AsHashtable)
  }
  return Resolve-McpToolsJsonDependencies -ToolsJson ($raw | ConvertFrom-Json)
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
    [string]$Expected = '7'
  )
  $schemaVersion = Get-McpToolsSchemaVersion -ToolsJson $ToolsJson
  if ($schemaVersion -ne $Expected) {
    throw "invalid_mcp_tools_schema_version:$schemaVersion"
  }
}

function Set-ToolFieldIfEmpty {
  param($Tool, [string]$Name, [object]$Value)
  if ($null -eq $Tool -or $null -eq $Value -or [string]::IsNullOrWhiteSpace([string]$Value)) { return }
  $current = Get-ToolField -Tool $Tool -Name $Name
  if ($null -ne $current -and -not [string]::IsNullOrWhiteSpace([string]$current)) { return }
  if ($Tool -is [System.Collections.IDictionary]) {
    $Tool[$Name] = $Value
    return
  }
  if ($Tool.PSObject.Properties.Name -contains $Name) {
    $Tool.$Name = $Value
  } else {
    $Tool | Add-Member -NotePropertyName $Name -NotePropertyValue $Value
  }
}

function Get-ExternalDependency {
  param($ToolsJson, [string]$Id)
  if ([string]::IsNullOrWhiteSpace($Id)) { return $null }
  $dependencies = @(Get-ToolField -Tool $ToolsJson -Name 'external_dependencies')
  foreach ($dependency in $dependencies) {
    if ([string](Get-ToolField -Tool $dependency -Name 'id') -eq $Id) {
      return $dependency
    }
  }
  return $null
}

function Resolve-McpToolsJsonDependencies {
  param($ToolsJson)
  if ($null -eq $ToolsJson) { return $ToolsJson }
  $tools = @(Get-ToolField -Tool $ToolsJson -Name 'tools')
  foreach ($tool in $tools) {
    $ref = Get-ToolField -Tool $tool -Name 'dependency_ref'
    if ($null -eq $ref -or [string]::IsNullOrWhiteSpace([string]$ref)) {
      $ref = Get-ToolField -Tool $tool -Name 'id'
    }
    $dependency = Get-ExternalDependency -ToolsJson $ToolsJson -Id ([string]$ref)
    if ($null -eq $dependency) { continue }
    Set-ToolFieldIfEmpty -Tool $tool -Name 'package' -Value (Get-ToolField -Tool $dependency -Name 'package')
    Set-ToolFieldIfEmpty -Tool $tool -Name 'version' -Value (Get-ToolField -Tool $dependency -Name 'version')
  }
  return $ToolsJson
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
