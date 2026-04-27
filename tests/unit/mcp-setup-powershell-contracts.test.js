const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../..');
const configureHostPs1 = path.join(repoRoot, 'skills/spec-mcp-setup/scripts/configure-host.ps1');
const detectHostPs1 = path.join(repoRoot, 'skills/spec-mcp-setup/scripts/detect-host.ps1');
const detectToolsPs1 = path.join(repoRoot, 'skills/spec-mcp-setup/scripts/detect-tools.ps1');
const verifyToolsPs1 = path.join(repoRoot, 'skills/spec-mcp-setup/scripts/verify-tools.ps1');
const writeProviderConfigPs1 = path.join(repoRoot, 'skills/spec-mcp-setup/scripts/write-provider-config.ps1');
const bootstrapProjectConfigPs1 = path.join(repoRoot, 'skills/spec-mcp-setup/scripts/bootstrap-project-config.ps1');
const installHelpersPs1 = path.join(repoRoot, 'skills/spec-mcp-setup/scripts/install-helpers.ps1');
const libTomlPs1 = path.join(repoRoot, 'skills/spec-mcp-setup/scripts/lib-toml.ps1');

describe('spec-mcp-setup PowerShell host config contract', () => {
  const source = fs.readFileSync(configureHostPs1, 'utf8');

  test('serializes writes with a config-path scoped lock', () => {
    expect(source).toContain('function Acquire-ConfigLock');
    expect(source).toContain('function Release-ConfigLock');
    expect(source).toContain('$LockPath = "$ConfigPath.lock"');
    expect(source).toContain('[System.IO.FileShare]::None');
    expect(source).toContain('$ConfigLock = Acquire-ConfigLock');
    expect(source).toContain('finally');
    expect(source).toContain('Release-ConfigLock -LockHandle $ConfigLock');
  });

  test('keeps backup, verify, and rollback before reporting success', () => {
    expect(source).toContain('Copy-Item $ConfigPath $path');
    expect(source).toContain('function Restore-Backup');
    expect(source).toContain('Restore-Backup -BackupPath $backupPath');
    expect(source).toContain('if (-not (Test-ToolConfigured))');
    expect(source).toContain('Get-Content -Raw $ConfigPath | ConvertFrom-Json -AsHashtable');
    expect(source).not.toContain('catch { @{} }');
    expect(source.indexOf('if (-not (Test-ToolConfigured))')).toBeLessThan(source.indexOf('ConvertTo-Json -Compress', source.indexOf('if (-not (Test-ToolConfigured))')));
  });

  test('readiness ledger does not expose retired graph runtime facts', () => {
    const retiredGraph = 'cr' + 'g';
    const nativeModules = 'native' + '_modules_status';
    const sqliteDep = 'better' + '-sqlite3';
    const parserDep = 'tree' + '-sitter';
    const providerKey = 'graph' + '_providers';
    const detectSource = fs.readFileSync(detectToolsPs1, 'utf8');
    const verifySource = fs.readFileSync(verifyToolsPs1, 'utf8');
    const combined = `${detectSource}\n${verifySource}`;

    expect(combined).not.toContain(`${retiredGraph}.`);
    expect(combined).not.toContain(nativeModules);
    expect(combined).not.toContain(sqliteDep);
    expect(combined).not.toContain(parserDep);
    expect(combined).toContain(providerKey);
    expect(verifySource).toContain("schema_version = 'v2'");
    expect(verifySource).toContain('Required Harness Runtime status:');
    expect(verifySource).toContain('graph-providers.json');
    expect(verifySource).toContain('Graph providers are query-ready.');
    expect(verifySource).toContain('if ($combined.graph_bootstrap_required)');
    expect(verifySource.indexOf('Required Harness Runtime status:')).toBeLessThan(
      verifySource.indexOf("Write-Host '下一步:'"),
    );
    expect(verifySource).toContain('| Name | Type | Required | Dependency | Host | Project | Query | Next |');
    expect(verifySource).toContain('回复“继续完成”');
    expect(verifySource).toContain('建议先重启 $hostDisplay');
    expect(verifySource).toContain('graph_bootstrap_required');
    expect(verifySource).toContain('$spec-graph-bootstrap');
  });

  test('uses shared TOML helpers for quoted Codex MCP keys', () => {
    const configureSource = fs.readFileSync(configureHostPs1, 'utf8');
    const detectSource = fs.readFileSync(detectToolsPs1, 'utf8');
    const libTomlSource = fs.readFileSync(libTomlPs1, 'utf8');

    expect(configureSource).toContain("Join-Path $ScriptDir 'lib-toml.ps1'");
    expect(configureSource).toContain('Write-TomlMcpSection -Path $ConfigPath -Key $ToolDef.detection.key');
    expect(configureSource).toContain('Test-TomlMcpSectionExact -Path $ConfigPath -Key $ToolDef.detection.key');
    expect(configureSource).toContain('function Get-CodexHigherPrecedenceStatus');
    expect(configureSource).toContain('被更高优先级 Codex MCP 配置覆盖');
    expect(configureSource).toContain('function Get-ClaudeMcpServer');
    expect(configureSource).toContain("if ($null -eq $Config.PSObject.Properties['mcpServers']) { return $null }");
    expect(configureSource).not.toContain('command = $HostConfig.command; args = $resolvedArgs; scope = $SelectedScope');
    expect(configureSource).not.toContain('.Contains($arg)');
    expect(detectSource).toContain("Join-Path $ScriptDir 'lib-toml.ps1'");
    expect(detectSource).toContain('Get-TomlMcpSection -Path $ConfigPath -Key $Tool.detection.key');
    expect(detectSource).toContain('Test-TomlMcpSectionExact -Path $ConfigPath -Key $Tool.detection.key');
    expect(detectSource).toContain('precedence-blocked');
    expect(detectSource).toContain('$HostInfo.targets.PSObject.Properties');
    expect(detectSource).toContain('function Get-ClaudeMcpServer');
    expect(detectSource).not.toContain('.Contains($arg)');
    expect(libTomlSource).toContain('(?=^[ `t]*\\[|\\z)');
    expect(libTomlSource).toContain('function Test-TomlMcpSectionExact');
    expect(libTomlSource).toContain('function Remove-TomlLineComment');
  });

  test('PowerShell host detection supports Unix parity test overrides', () => {
    const detectHostSource = fs.readFileSync(detectHostPs1, 'utf8');

    expect(detectHostSource).toContain('function Resolve-TargetPathOverride');
    expect(detectHostSource).toContain('MCP_SETUP_CLAUDE_MANAGED_PATH_OVERRIDE');
    expect(detectHostSource).toContain('MCP_SETUP_CODEX_SYSTEM_PATH_OVERRIDE');
    expect(detectHostSource).toContain('Resolve-TargetPathOverride -Host $detectedHost -TargetKey $TargetKey');
  });

  test('provider projection writer is semantically idempotent', () => {
    const writeProviderSource = fs.readFileSync(writeProviderConfigPs1, 'utf8');

    expect(writeProviderSource).toContain('function ConvertTo-ComparableProjectionJson');
    expect(writeProviderSource).toContain("PSObject.Properties.Name -contains 'generated_at'");
    expect(writeProviderSource).toContain("$payload['generated_at'] = $existingGeneratedAt");
    expect(writeProviderSource).toContain("$payload['last_updated_by'] = $existing.last_updated_by");
    expect(writeProviderSource).toContain("$payload['last_bootstrapped_at'] = $existing.last_bootstrapped_at");
    expect(writeProviderSource).toContain("$repoConfigStatus = 'ready'");
    expect(writeProviderSource).toContain('repo_config_status = $repoConfigStatus');
  });

  test('helper verify-only is marker-based and does not install browser runtime', () => {
    const installHelpersSource = fs.readFileSync(installHelpersPs1, 'utf8');

    expect(installHelpersSource).toContain('.agent-browser/spec-first-install.json');
    expect(installHelpersSource).toContain('Write-AgentBrowserInstallMarker');
    expect(installHelpersSource).toContain('agent-browser install');
    expect(installHelpersSource).toContain("'gh', 'jq', 'vhs', 'silicon', 'ffmpeg', 'ast-grep'");
    expect(installHelpersSource).toContain('npx skills add ast-grep/agent-skill -g -y');
    expect(installHelpersSource).toContain("'ast-grep-skill'");
    expect(installHelpersSource).toContain("if ($IsWindows) { return 'windows' }");
    expect(installHelpersSource).toContain('winget install --id GitHub.cli -e --silent');
    expect(installHelpersSource).toContain('npm install -g @ast-grep/cli');
    expect(installHelpersSource).toContain('Test-Path $globalAgentBrowserSkill');
    expect(installHelpersSource).toContain("$nextAction = 'agent-browser CLI not found after npm install'");
    expect(installHelpersSource).toContain("$status = 'ready'\n        $nextAction = ''");
    expect(installHelpersSource).not.toContain('agent-browser doctor');
    expect(installHelpersSource).not.toContain('doctor --fix');
    expect(installHelpersSource).toContain("$mode -eq 'verify-only' -and -not (Test-Path $agentBrowserInstallMarker)");
  });

  test('Serena bootstrap is idempotent and recoverable', () => {
    const activateSerenaSource = fs.readFileSync(path.join(repoRoot, 'skills/spec-mcp-setup/scripts/activate-serena.ps1'), 'utf8');

    expect(activateSerenaSource).toContain('Test-Path -LiteralPath $projectFile -PathType Leaf');
    expect(activateSerenaSource).toContain('function Restore-ExistingState');
    expect(activateSerenaSource).toContain('Restore-ExistingState');
    expect(activateSerenaSource).toContain('Move-Item -Force $tmpMarker $readyMarkerPath');
  });

  test('project config bootstrap keeps local setup outside readiness ledger', () => {
    const bootstrapSource = fs.readFileSync(bootstrapProjectConfigPs1, 'utf8');

    expect(bootstrapSource).toContain('[switch]$RefreshExample');
    expect(bootstrapSource).toContain('[switch]$CreateLocal');
    expect(bootstrapSource).toContain('[switch]$EnsureGitignore');
    expect(bootstrapSource).toContain('[switch]$DeleteLegacyMarkdown');
    expect(bootstrapSource).toContain('project-config-bootstrap.v1');
    expect(bootstrapSource).toContain('.spec-first');
    expect(bootstrapSource).toContain('.spec-first/*.local.yaml');
    expect(bootstrapSource).toContain('compound-engineering.local.md');
    expect(bootstrapSource).not.toContain('baseline_ready');
  });
});
