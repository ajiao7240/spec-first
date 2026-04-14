param(
  [string]$Install,
  [string]$Skip
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SkillDir = Split-Path -Parent $ScriptDir
$ToolsJsonPath = Join-Path $SkillDir 'mcp-tools.json'
$ToolsJson = Get-Content -Raw $ToolsJsonPath | ConvertFrom-Json
$HostInfo = & (Join-Path $ScriptDir 'detect-host.ps1') | ConvertFrom-Json
$DetectedHost = $HostInfo.host
$HostDisplayName = $HostInfo.display_name
$CliCommand = $HostInfo.cli_command
$ConfigPath = $HostInfo.config_path
$LockFile = "$ConfigPath.lock"
$ConfigDir = Split-Path -Parent $ConfigPath
$HostContext = if ($DetectedHost -eq 'codex') { 'codex' } else { 'ide-assistant' }

New-Item -ItemType Directory -Force -Path $ConfigDir | Out-Null

$env:PATH = "$HOME/.cargo/bin;$HOME/.fnm/aliases/default/bin;$HOME/.local/bin;$env:PATH"

function Parse-List {
  param([string]$Value)
  if ([string]::IsNullOrWhiteSpace($Value)) { return @() }
  return @($Value -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ })
}

$InstallArray = Parse-List $Install
$SkipArray = Parse-List $Skip

function Should-Install {
  param(
    [string]$ToolId,
    [string]$Category
  )

  if ($SkipArray -contains $ToolId) {
    return $false
  }

  if ($InstallArray.Count -gt 0) {
    return $InstallArray -contains $ToolId
  }

  return $Category -eq 'required'
}

function Backup-Config {
  if (Test-Path $ConfigPath) {
    $timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
    $backup = "$ConfigPath.backup.$timestamp"
    Copy-Item $ConfigPath $backup -Force
    return $backup
  }
  return $null
}

function Acquire-Lock {
  $LockDir = "${LockFile}.d"
  $PidFile = Join-Path $LockDir 'pid'
  $Attempts = 100

  for ($i = 0; $i -lt $Attempts; $i++) {
    # 不使用 -Force：目录已存在时 New-Item 会抛异常，锁才能生效
    $created = $null
    try {
      $created = New-Item -ItemType Directory -Path $LockDir -ErrorAction Stop
    } catch {
      $created = $null
    }

    if ($created) {
      Set-Content -Path $PidFile -Value $PID -NoNewline
      return $true
    }

    # Stale lock check: 检查持有锁的进程是否已死亡
    if (Test-Path $PidFile) {
      $lockPid = Get-Content $PidFile -ErrorAction SilentlyContinue
      if ($lockPid -and -not (Get-Process -Id $lockPid -ErrorAction SilentlyContinue)) {
        Remove-Item $LockDir -Recurse -Force -ErrorAction SilentlyContinue
        continue
      }
    }
    Start-Sleep -Milliseconds 100
  }
  Write-Host "⚠️  锁超时 (10s)" -ForegroundColor Yellow
  return $false
}

function Release-Lock {
  $LockDir = "${LockFile}.d"
  Remove-Item $LockDir -Recurse -Force -ErrorAction SilentlyContinue
}

function Tool-IsConfigured {
  param([string]$ToolId)

  if (-not (Test-Path $ConfigPath)) {
    return $false
  }

  if ($DetectedHost -eq 'claude') {
    try {
      $config = Get-Content -Raw $ConfigPath | ConvertFrom-Json
      $toolConfig = $config.mcpServers.PSObject.Properties[$ToolId].Value
      if ($null -eq $toolConfig) {
        return $false
      }

      if ($ToolId -eq 'serena') {
        return $toolConfig.command -eq 'uvx' -and ($toolConfig.args -contains $HostContext)
      }

      return $true
    } catch {
      return $false
    }
  }

  if ($ToolId -eq 'serena') {
    $section = Get-TomlSectionText -Path $ConfigPath -SectionName $ToolId
    return [bool]($section -and $section -match 'command = "uvx"' -and $section -match '"--context", "' + [regex]::Escape($HostContext) + '"')
  }

  return [bool](Select-String -Path $ConfigPath -SimpleMatch "[mcp_servers.$ToolId]" -Quiet)
}

function Get-TomlSectionText {
  param(
    [string]$Path,
    [string]$SectionName
  )

  if (-not (Test-Path $Path)) {
    return ''
  }

  $header = "[mcp_servers.$SectionName]"
  $lines = Get-Content $Path
  $capturing = $false
  $buffer = New-Object System.Collections.Generic.List[string]

  foreach ($line in $lines) {
    if ($line -eq $header) {
      $capturing = $true
      continue
    }

    if ($capturing -and $line -match '^\[.*\]$') {
      break
    }

    if ($capturing) {
      $buffer.Add($line)
    }
  }

  return ($buffer -join "`n")
}

function Add-ToolConfig {
  param([string]$ToolId)

  $tool = $ToolsJson.tools | Where-Object { $_.id -eq $ToolId } | Select-Object -First 1
  if (-not $tool) {
    throw "未知工具：$ToolId"
  }

  $command = $tool.mcp_config.command

  if ($DetectedHost -eq 'claude') {
    $resolvedArgs = @($tool.mcp_config.args | ForEach-Object {
      if ($_ -eq '__HOST_CONTEXT__') { $HostContext } else { $_ }
    })
    $configJson = [ordered]@{
      command = $tool.mcp_config.command
      args = $resolvedArgs
    } | ConvertTo-Json -Compress -Depth 6
    & $CliCommand mcp add-json --scope user $ToolId $configJson
    return
  }

  $toolArgs = @()
  foreach ($arg in $tool.mcp_config.args) {
    if ($arg -eq '__HOST_CONTEXT__') {
      $toolArgs += $HostContext
    } else {
      $toolArgs += $arg
    }
  }

  & $CliCommand mcp add $ToolId -- $command @toolArgs
}

function Ensure-CodexStartupTimeout {
  param([string]$ToolId)

  if ($DetectedHost -ne 'codex') {
    return $true
  }

  $tool = $ToolsJson.tools | Where-Object { $_.id -eq $ToolId } | Select-Object -First 1
  if (-not $tool) {
    return $false
  }

  $timeoutProp = $tool.mcp_config.PSObject.Properties['startup_timeout_sec']
  if ($null -eq $timeoutProp) {
    return $true
  }

  $timeoutSec = [int]$timeoutProp.Value

  if (-not (Test-Path $ConfigPath)) {
    Write-Host "  ❌ $ToolId: codex 配置文件不存在，无法写入 startup_timeout_sec" -ForegroundColor Red
    return $false
  }

  $sectionText = Get-TomlSectionText -Path $ConfigPath -SectionName $ToolId
  if ([string]::IsNullOrWhiteSpace($sectionText)) {
    Write-Host "  ❌ $ToolId: 未找到 [mcp_servers.$ToolId]，无法写入 startup_timeout_sec" -ForegroundColor Red
    return $false
  }

  $existingTimeout = [double]::NaN
  if ($sectionText -match '(?m)^\s*startup_timeout_sec\s*=\s*([0-9]+(?:\.[0-9]+)?)') {
    $existingTimeout = [double]$Matches[1]
    if ($existingTimeout -ge $timeoutSec) {
      return $true
    }
  }

  $header = "[mcp_servers.$ToolId]"
  $lines = Get-Content $ConfigPath
  $newLines = New-Object System.Collections.Generic.List[string]
  $inSection = $false
  $hasTimeout = $false

  foreach ($line in $lines) {
    if ($line -eq $header) {
      $inSection = $true
      $newLines.Add($line)
      continue
    }

    if ($inSection -and $line -match '^\s*startup_timeout_sec\s*=') {
      $lineTimeout = [double]::NaN
      if ($line -match '^\s*startup_timeout_sec\s*=\s*([0-9]+(?:\.[0-9]+)?)') {
        $lineTimeout = [double]$Matches[1]
      }

      if (-not [double]::IsNaN($lineTimeout) -and $lineTimeout -ge $timeoutSec) {
        $newLines.Add($line)
      } else {
        $newLines.Add("startup_timeout_sec = $timeoutSec")
      }
      $hasTimeout = $true
      continue
    }

    if ($inSection -and $line -match '^\[mcp_servers\..+\]$') {
      if (-not $hasTimeout) {
        $newLines.Add("startup_timeout_sec = $timeoutSec")
        $hasTimeout = $true
      }
      $inSection = $false
    }

    $newLines.Add($line)
  }

  if ($inSection -and -not $hasTimeout) {
    $newLines.Add("startup_timeout_sec = $timeoutSec")
  }

  $content = ($newLines -join "`n") + "`n"
  Set-Content -Path $ConfigPath -Value $content -Encoding utf8
  return $true
}

function Restore-Config {
  param(
    [string]$BackupFile,
    [bool]$CreatedDuringRun
  )

  if ($BackupFile -and (Test-Path $BackupFile)) {
    Copy-Item $BackupFile $ConfigPath -Force
  } elseif ($CreatedDuringRun) {
    Remove-Item $ConfigPath -Force -ErrorAction SilentlyContinue
  }
}

function Configure-Tool {
  param([string]$ToolId)

  if (Tool-IsConfigured $ToolId) {
    if (-not (Ensure-CodexStartupTimeout $ToolId)) {
      return $false
    }
    Write-Host "  ⏭️  $ToolId: already configured, skipping"
    return $true
  }

  Write-Host "  ⏳ Configuring $ToolId for $HostDisplayName..."
  try {
    Add-ToolConfig $ToolId
  } catch {
    Write-Host "  ❌ $ToolId: configuration failed" -ForegroundColor Red
    return $false
  }

  if (-not (Ensure-CodexStartupTimeout $ToolId)) {
    Write-Host "  ❌ $ToolId: startup_timeout_sec update failed" -ForegroundColor Red
    return $false
  }

  if (Tool-IsConfigured $ToolId) {
    Write-Host "  ✅ $ToolId: configured"
    return $true
  }

  Write-Host "  ❌ $ToolId: CLI completed but configuration is still missing" -ForegroundColor Red
  return $false
}

function Install-Feishu {
  if (Tool-IsConfigured 'feishu') {
    Write-Host "  ⏭️  feishu: already configured, skipping"
    return $true
  }

  Write-Host ""
  Write-Host "=== 飞书 MCP 配置引导 ==="
  Write-Host "需要飞书开放平台应用凭据。若尚未创建，请前往："
  Write-Host "  https://open.feishu.cn/app"
  Write-Host ""

  $feishuAppId = Read-Host -Prompt "请输入 Feishu App ID"
  $feishuAppSecret = Read-Host -Prompt "请输入 Feishu App Secret"

  if ([string]::IsNullOrWhiteSpace($feishuAppId) -or [string]::IsNullOrWhiteSpace($feishuAppSecret)) {
    Write-Host "  ⚠️  feishu: 凭据为空，跳过配置。可后续手动配置或重新运行 spec-mcp-setup。"
    return $true
  }

  Write-Host "  ⏳ Configuring feishu for $HostDisplayName..."

  if ($DetectedHost -eq 'claude') {
    $feishuConfig = [pscustomobject]@{
      command = 'npx'
      args    = @('-y', '@larksuiteoapi/lark-mcp', 'mcp', '--app-id', $feishuAppId, '--app-secret', $feishuAppSecret, '--language', 'zh')
    } | ConvertTo-Json -Compress -Depth 4
    try {
      & $CliCommand mcp add-json --scope user feishu $feishuConfig
      Write-Host "  ✅ feishu: configured"
      $configAfter = Get-Content -Raw $ConfigPath | ConvertFrom-Json -ErrorAction Stop
      if ($null -eq $configAfter.mcpServers.PSObject.Properties['feishu']) {
        Write-Host "  ❌ feishu: post-configure verification failed" -ForegroundColor Red
        return $false
      }
      return $true
    } catch {
      Write-Host "  ❌ feishu: configuration failed" -ForegroundColor Red
      return $false
    }
  } elseif ($DetectedHost -eq 'codex') {
    try {
      & $CliCommand mcp add feishu -- npx -y '@larksuiteoapi/lark-mcp' mcp --app-id $feishuAppId --app-secret $feishuAppSecret --language zh
      Write-Host "  ✅ feishu: configured"
      if (-not (Select-String -Path $ConfigPath -SimpleMatch '[mcp_servers.feishu]' -Quiet)) {
        Write-Host "  ❌ feishu: post-configure verification failed" -ForegroundColor Red
        return $false
      }
      return $true
    } catch {
      Write-Host "  ❌ feishu: configuration failed" -ForegroundColor Red
      return $false
    }
  }

  return $true
}

$tools = $ToolsJson.tools

$backupFile = $null
$results = New-Object System.Collections.Generic.List[string]
$failed = New-Object System.Collections.Generic.List[string]
$createdDuringRun = -not (Test-Path $ConfigPath)

if (-not (Acquire-Lock)) {
  exit 1
}

try {
  $backupFile = Backup-Config
  if ($backupFile) {
    Write-Host "📦 Backup created: $backupFile"
  }

  Write-Host ""
  Write-Host "🔧 MCP Tools Installation"
  Write-Host "========================"
  Write-Host "Host: $HostDisplayName"
  Write-Host "Config: $ConfigPath"
  Write-Host "🧭 我会先检查当前宿主的配置，再逐个补齐缺失工具。"
  Write-Host ""

  foreach ($tool in $tools) {
    if (-not (Should-Install $tool.id $tool.category)) {
      continue
    }

    Write-Host "Processing: $($tool.id) ($($tool.category))"
    Write-Host "  → 正在为 $HostDisplayName 写入 $($tool.id) 配置"

    if ($tool.id -eq 'feishu') {
      if (-not (Install-Feishu)) {
        Write-Host "  ⚠️  feishu: 可选工具安装失败，继续其余步骤。"
        $failed.Add('feishu')
      } else {
        $results.Add('feishu')
      }
      continue
    }

    if (-not (Configure-Tool $tool.id)) {
      Restore-Config -BackupFile $backupFile -CreatedDuringRun $createdDuringRun
      $failed.Add($tool.id)
      $results.Clear()
      break
    }

    $results.Add($tool.id)
  }

  Write-Host ""
  Write-Host "========================"
  Write-Host "📋 Installation Summary"
  Write-Host ""

  if ($results.Count -gt 0) {
    Write-Host "✅ Processed: $($results -join ' ')"
  }

  if ($failed.Count -gt 0) {
    Write-Host "❌ Failed: $($failed -join ' ')"
  }

  if (($failed.Count -eq 0) -and $backupFile) {
    Remove-Item $backupFile -Force -ErrorAction SilentlyContinue
    Write-Host "🗑️  Backup removed (all succeeded)"
  } elseif ($backupFile) {
    Write-Host "⚠️  Backup preserved at: $backupFile"
    Write-Host "   To restore: Copy-Item $backupFile $ConfigPath"
  }

  Write-Host ""
  Write-Host "⚠️  Please restart $HostDisplayName for changes to take effect."

  if (($results.Count -eq 0) -and ($failed.Count -eq 0)) {
    Write-Host "✅ 当前宿主已经就绪，没有发现需要补充的 MCP 工具。"
  }

  if ($failed.Count -gt 0) {
    exit 1
  }
} finally {
  Release-Lock
}
