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
    $pattern = "(?ms)^[ `t]*\[$([regex]::Escape($header))\][ `t]*\r?\n(.*?)(?=^[ `t]*\[|\z)"
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
    $pattern = "(?ms)^[ `t]*\[$([regex]::Escape($header))\][ `t]*\r?\n.*?(?=^[ `t]*\[|\z)"
    $Text = [regex]::Replace($Text, $pattern, '')
  }

  return ([regex]::Replace($Text, "`n{3,}", "`n`n")).Trim()
}

function Remove-TomlLineComment {
  param([string]$Text)

  $result = New-Object System.Text.StringBuilder
  $inSingle = $false
  $inDouble = $false
  $escaped = $false

  foreach ($char in $Text.ToCharArray()) {
    if ($escaped) {
      [void]$result.Append($char)
      $escaped = $false
      continue
    }
    if ($char -eq '\' -and $inDouble) {
      [void]$result.Append($char)
      $escaped = $true
      continue
    }
    if ($char -eq "'" -and -not $inDouble) {
      $inSingle = -not $inSingle
      [void]$result.Append($char)
      continue
    }
    if ($char -eq '"' -and -not $inSingle) {
      $inDouble = -not $inDouble
      [void]$result.Append($char)
      continue
    }
    if ($char -eq '#' -and -not $inSingle -and -not $inDouble) {
      break
    }
    [void]$result.Append($char)
  }

  return $result.ToString().Trim()
}

function Get-TomlMcpFieldValue {
  param(
    [string]$Section,
    [string]$Name
  )

  $lines = $Section -split "`r?`n"
  for ($index = 0; $index -lt $lines.Count; $index++) {
    $match = [regex]::Match($lines[$index], "^\s*$([regex]::Escape($Name))\s*=\s*(.*)$")
    if (-not $match.Success) { continue }

    $value = $match.Groups[1].Value
    if ($Name -ne 'args') {
      return (Remove-TomlLineComment -Text $value)
    }

    $balance = ([regex]::Matches($value, '\[').Count - [regex]::Matches($value, '\]').Count)
    $cursor = $index + 1
    while ($balance -gt 0 -and $cursor -lt $lines.Count) {
      $value = "$value`n$($lines[$cursor])"
      $balance += ([regex]::Matches($lines[$cursor], '\[').Count - [regex]::Matches($lines[$cursor], '\]').Count)
      $cursor += 1
    }
    return (Remove-TomlLineComment -Text $value)
  }

  return $null
}

function ConvertFrom-TomlStringValue {
  param([string]$Raw)

  if ($null -eq $Raw) { return $null }
  $value = (Remove-TomlLineComment -Text $Raw)
  if ($value.StartsWith('"') -and $value.EndsWith('"')) {
    try { return ($value | ConvertFrom-Json) } catch { return $null }
  }
  if ($value.StartsWith("'") -and $value.EndsWith("'")) {
    return $value.Substring(1, $value.Length - 2)
  }
  return $value
}

function ConvertFrom-TomlArgsValue {
  param([string]$Raw)

  if ($null -eq $Raw) { return $null }
  $value = (Remove-TomlLineComment -Text $Raw)
  try {
    return @($value | ConvertFrom-Json)
  } catch {
    return $null
  }
}

function Test-TomlMcpSectionExact {
  param(
    [string]$Path,
    [string]$Key,
    [string]$Command,
    [object[]]$Args
  )

  $section = Get-TomlMcpSection -Path $Path -Key $Key
  if ([string]::IsNullOrWhiteSpace($section)) { return $false }

  $actualCommand = ConvertFrom-TomlStringValue -Raw (Get-TomlMcpFieldValue -Section $section -Name 'command')
  $actualArgs = @(ConvertFrom-TomlArgsValue -Raw (Get-TomlMcpFieldValue -Section $section -Name 'args'))
  $expectedArgs = @($Args)

  if ($actualCommand -ne $Command) { return $false }
  if ($actualArgs.Count -ne $expectedArgs.Count) { return $false }
  for ($i = 0; $i -lt $expectedArgs.Count; $i++) {
    if ($actualArgs[$i] -ne $expectedArgs[$i]) { return $false }
  }
  return $true
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
