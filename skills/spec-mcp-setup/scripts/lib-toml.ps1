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

  if (-not (Test-Path -LiteralPath $Path)) { return '' }

  $text = Get-Content -Raw -LiteralPath $Path
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

function Normalize-NpmLatestArgs {
  param([object[]]$Args)

  $normalized = @()
  foreach ($arg in @($Args)) {
    if ($arg -is [string] -and $arg.EndsWith('@latest', [System.StringComparison]::Ordinal)) {
      $normalized += , $arg.Substring(0, $arg.Length - 7)
    } else {
      $normalized += , $arg
    }
  }
  return , $normalized
}

function Test-ArgsEqual {
  param(
    [object[]]$Actual,
    [object[]]$Expected
  )

  if (@($Actual).Count -ne @($Expected).Count) { return $false }
  for ($i = 0; $i -lt @($Expected).Count; $i++) {
    if ([string]$Actual[$i] -ne [string]$Expected[$i]) { return $false }
  }
  return $true
}

function Test-TomlMcpSectionRegistryArgsDrift {
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
  if (Test-ArgsEqual -Actual $actualArgs -Expected $expectedArgs) { return $false }
  return (Test-ArgsEqual -Actual (Normalize-NpmLatestArgs -Args $actualArgs) -Expected (Normalize-NpmLatestArgs -Args $expectedArgs))
}

function ConvertTo-MutableHashtable {
  param([object]$Object)
  if ($null -eq $Object) { return $null }
  if ($Object -is [string] -or $Object -is [int] -or $Object -is [bool] -or $Object -is [long] -or $Object -is [double]) { return $Object }
  if ($Object -is [System.Collections.IDictionary]) {
    $result = [ordered]@{}
    foreach ($key in $Object.Keys) { $result[$key] = ConvertTo-MutableHashtable -Object $Object[$key] }
    return $result
  }
  if ($Object -is [System.Collections.IList]) {
    $result = New-Object System.Collections.ArrayList
    foreach ($item in $Object) { $null = $result.Add((ConvertTo-MutableHashtable -Object $item)) }
    return $result
  }
  $result = [ordered]@{}
  foreach ($prop in $Object.PSObject.Properties) {
    $result[$prop.Name] = ConvertTo-MutableHashtable -Object $prop.Value
  }
  return $result
}

function Set-TextFileAtomic {
  param(
    [string]$Path,
    [string]$Value
  )

  $dir = Split-Path -Parent $Path
  if (-not [string]::IsNullOrWhiteSpace($dir)) {
    [System.IO.Directory]::CreateDirectory($dir) | Out-Null
  }
  $tmpName = '.{0}.{1}.tmp' -f (Split-Path -Leaf $Path), ([guid]::NewGuid().ToString('N'))
  $tmp = if ([string]::IsNullOrWhiteSpace($dir)) { $tmpName } else { Join-Path $dir $tmpName }
  Set-Content -Encoding utf8 -LiteralPath $tmp -Value $Value
  Move-Item -Force -LiteralPath $tmp -Destination $Path
}

function Write-TomlMcpSection {
  param(
    [string]$Path,
    [string]$Key,
    [string]$Body
  )

  $text = if (Test-Path -LiteralPath $Path) { Get-Content -Raw -LiteralPath $Path } else { '' }
  $text = Remove-TomlMcpSection -Text $text -Key $Key
  $tableKey = Get-TomlTableKey -Key $Key
  $section = "[$tableKey]`n$($Body.Trim())`n"

  if ($text) {
    $text = "$text`n`n$section"
  } else {
    $text = "$section"
  }

  Set-TextFileAtomic -Path $Path -Value $text
}
