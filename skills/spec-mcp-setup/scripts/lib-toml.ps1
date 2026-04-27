$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Get-TomlTableKey {
  param([string]$Key)

  if ($Key -match '^[A-Za-z0-9_]+$') {
    return "mcp_servers.$Key"
  }

  $escaped = $Key.Replace('"', '\"')
  return "mcp_servers.`"$escaped`""
}

function Get-TomlMcpSection {
  param(
    [string]$Path,
    [string]$Key
  )

  if (-not (Test-Path $Path)) { return '' }

  $text = Get-Content -Raw $Path
  $headers = @(
    "mcp_servers.$Key",
    ('mcp_servers."{0}"' -f $Key.Replace('"', '\"'))
  )

  foreach ($header in $headers) {
    $pattern = "(?ms)^\[$([regex]::Escape($header))\]\r?\n(.*?)(?=^\[mcp_servers\.|\z)"
    $match = [regex]::Match($text, $pattern)
    if ($match.Success) {
      return $match.Groups[1].Value.Trim()
    }
  }

  return ''
}

function Remove-TomlMcpSection {
  param(
    [string]$Text,
    [string]$Key
  )

  $headers = @(
    "mcp_servers.$Key",
    ('mcp_servers."{0}"' -f $Key.Replace('"', '\"'))
  )

  foreach ($header in $headers) {
    $pattern = "(?ms)^\[$([regex]::Escape($header))\]\r?\n.*?(?=^\[mcp_servers\.|\z)"
    $Text = [regex]::Replace($Text, $pattern, '')
  }

  return ([regex]::Replace($Text, "`n{3,}", "`n`n")).Trim()
}

function Write-TomlMcpSection {
  param(
    [string]$Path,
    [string]$Key,
    [string]$Body
  )

  $text = if (Test-Path $Path) { Get-Content -Raw $Path } else { '' }
  $text = Remove-TomlMcpSection -Text $text -Key $Key
  $tableKey = Get-TomlTableKey -Key $Key
  $section = "[$tableKey]`n$($Body.Trim())`n"

  if ($text) {
    $text = "$text`n`n$section"
  } else {
    $text = "$section"
  }

  Set-Content -Encoding utf8 $Path $text
}
