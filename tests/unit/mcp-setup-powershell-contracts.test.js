const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../..');
const configureHostPs1 = path.join(repoRoot, 'skills/spec-mcp-setup/scripts/configure-host.ps1');
const checkDepsPs1 = path.join(repoRoot, 'skills/spec-mcp-setup/scripts/check-deps.ps1');
const detectHostPs1 = path.join(repoRoot, 'skills/spec-mcp-setup/scripts/detect-host.ps1');
const detectToolsPs1 = path.join(repoRoot, 'skills/spec-mcp-setup/scripts/detect-tools.ps1');
const verifyToolsPs1 = path.join(repoRoot, 'skills/spec-mcp-setup/scripts/verify-tools.ps1');
const writeProviderConfigPs1 = path.join(repoRoot, 'skills/spec-mcp-setup/scripts/write-provider-config.ps1');
const repairInstallPs1 = path.join(repoRoot, 'skills/spec-mcp-setup/scripts/repair-install.ps1');
const activateSerenaPs1 = path.join(repoRoot, 'skills/spec-mcp-setup/scripts/activate-serena.ps1');
const installMcpPs1 = path.join(repoRoot, 'skills/spec-mcp-setup/scripts/install-mcp.ps1');
const bootstrapProvidersPs1 = path.join(repoRoot, 'skills/spec-graph-bootstrap/scripts/bootstrap-providers.ps1');
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
    expect(verifySource).toContain('Required Harness Runtime status (grouped):');
    expect(verifySource).toContain('graph-providers.json');
    expect(verifySource).toContain('runtime-capabilities.json');
    expect(verifySource).toContain('provider-artifacts.json');
    expect(verifySource).toContain('host_ledger_pointer');
    expect(verifySource).toContain("Get-Command node -ErrorAction SilentlyContinue");
    expect(verifySource).toContain('Graph providers are query-ready.');
    expect(verifySource).toContain('if ($combined.graph_bootstrap_required)');
    expect(verifySource.indexOf('Required Harness Runtime status (grouped):')).toBeLessThan(
      verifySource.indexOf("Write-Host '下一步:'"),
    );
    expect(verifySource).toContain("Join-Path $ScriptDir 'render-status-block.cjs'");
    expect(verifySource).toContain('function Write-StatusBlock');
    expect(verifySource).toContain('$LASTEXITCODE -ne 0');
    expect(verifySource).toContain('render-status-block.cjs failed with exit code');
    expect(verifySource).toContain("headers = @('Name', 'Role', 'Dependency', 'Host', 'Project', 'Next')");
    expect(verifySource).toContain("headers = @('Name', 'Role', 'Dependency', 'Host', 'Query', 'Next')");
    expect(verifySource).toContain("headers = @('Name', 'Type', 'Result', 'Dependency', 'Install', 'Skill', 'Next')");
    expect(verifySource).toContain("headers = @('Artifact', 'Project', 'Next')");
    expect(verifySource).toContain('Format-Remark');
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
    expect(writeProviderSource).toContain('$Payload.generated_at = $existing.generated_at');
    expect(writeProviderSource).toContain('runtime-capabilities.v1');
    expect(writeProviderSource).toContain('provider-artifacts.v1');
    expect(writeProviderSource).toContain('derived_readiness');
    expect(writeProviderSource).toContain('host_ledger_pointer');
    expect(writeProviderSource).toContain("$toolsJsonPath = Join-Path $skillDir 'mcp-tools.json'");
    expect(writeProviderSource).toContain('$gitNexusPackageSpec = [string]$gitNexusTool[0].installation.unix.args[1]');
    expect(writeProviderSource).toContain("bootstrap = @('npx', '-y', $GitNexusPackageSpec, 'analyze')");
    expect(writeProviderSource).toContain("query_probe = @('npx', '-y', $GitNexusPackageSpec, 'query', 'main src build README package', '--repo', $repoName)");
    expect(writeProviderSource).toContain('Get-ProviderCommands -Provider $property.Name -RepoRoot $facts.repo_root -GitNexusPackageSpec $gitNexusPackageSpec');
    expect(writeProviderSource).toContain("query_probe = @('uvx', '--upgrade', 'code-review-graph', 'status', '--repo', $RepoRoot)");
    expect(writeProviderSource).toContain('[bool]$Provider.enabled_for_bootstrap');
    expect(writeProviderSource).toContain('$canonicalArtifactsAvailable');
    expect(writeProviderSource).toContain('$canonicalArtifactsCurrent');
    expect(writeProviderSource).toContain('graph_bootstrap_required = ($canonicalWorkflowMode -ne');
    expect(writeProviderSource).toContain('support_level');
    expect(writeProviderSource).toContain('project_graph_readiness');
    expect(writeProviderSource).toContain("$repoConfigStatus = 'ready'");
    expect(writeProviderSource).toContain('repo_config_status = $providerStatus');
  });

  test('graph bootstrap PowerShell exposes compiler contract and command safety', () => {
    const source = fs.readFileSync(bootstrapProvidersPs1, 'utf8');

    expect(source).toContain('runtime-capabilities.v1');
    expect(source).toContain('provider-artifacts.v1');
    expect(source).toContain('graph-providers.v1');
    expect(source).toContain('host_ledger_pointer');
    expect(source).toContain('readiness-conflict');
    expect(source).toContain('unsupported-provider-command');
    expect(source).toContain('query-unverified');
    expect(source).toContain('degraded-fallback');
    expect(source).toContain('graph-facts.v1');
    expect(source).toContain('bootstrap-impact-capabilities.v1');
    expect(source).toContain('.spec-first/providers/$provider/raw/');
    expect(source).toContain("'analyze.log'");
    expect(source).toContain("'build.log'");
    expect(source).toContain('function Test-CommandShapeSupported');
    expect(source).toContain("'^gitnexus(@[A-Za-z0-9._~+:-]+)?$'");
    expect(source).toContain("'code-review-graph'");
    expect(source).toContain("'--upgrade'");
    expect(source).toContain('function Write-NormalizedArtifacts');
    expect(source).toContain('provider-normalized-envelope.v1');
    expect(source).toContain("command_source = '.spec-first/config/graph-providers.json'");
    expect(source).toContain('fallback_support');
    expect(source).toContain('primary_providers');
    expect(source).toContain('skipped_primary_providers');
    expect(source).toContain('disabled-for-bootstrap');
    expect(source).toContain('function Test-GitNexusQueryProbeVerified');
    expect(source).toContain('Cannot execute write operations in a read-only database');
    expect(source).toContain('missing[ -]index');
    expect(source).toContain('graph_ready = $graphReady');
    expect(source).toContain('function Write-JsonFileAtomic');
    expect(source).toContain('Move-Item -Force');
    expect(source).toContain('& $exe @args');
    expect(source).not.toContain('Invoke-Expression');
    expect(source).not.toContain('bash -c');
    expect(source).not.toContain('sh -c');
  });

  test('helper verify-only is marker-based and does not install browser runtime', () => {
    const installHelpersSource = fs.readFileSync(installHelpersPs1, 'utf8');

    expect(installHelpersSource).toContain('.agent-browser/spec-first-install.json');
    expect(installHelpersSource).toContain('Write-AgentBrowserInstallMarker');
    expect(installHelpersSource).toContain('agent-browser install');
    expect(installHelpersSource).toContain("'gh', 'jq', 'vhs', 'silicon', 'ffmpeg', 'ast-grep'");
    expect(installHelpersSource).toContain('npx -y skills@latest add ast-grep/agent-skill -g -y');
    expect(installHelpersSource).toContain("'ast-grep-skill'");
    expect(installHelpersSource).toContain("if ($IsWindows) { return 'windows' }");
    expect(installHelpersSource).toContain('winget upgrade --id $PackageId -e --silent --accept-package-agreements --accept-source-agreements');
    expect(installHelpersSource).toContain('winget install --id $PackageId -e --silent --accept-package-agreements --accept-source-agreements');
    expect(installHelpersSource).toContain("Get-WingetLatestInstallCommand -PackageId 'GitHub.cli'");
    expect(installHelpersSource).toContain("Get-WingetLatestInstallCommand -PackageId 'jqlang.jq'");
    expect(installHelpersSource).toContain("Get-WingetLatestInstallCommand -PackageId 'Gyan.FFmpeg'");
    expect(installHelpersSource).toContain("Test-CommandExists 'dnf'");
    expect(installHelpersSource).toContain("Test-CommandExists 'pacman'");
    expect(installHelpersSource).toContain("Test-CommandExists 'apk'");
    expect(installHelpersSource).toContain('Install gh from https://cli.github.com');
    expect(installHelpersSource).toContain('npm install -g @ast-grep/cli@latest');
    expect(installHelpersSource).toContain("Test-GlobalSkill 'agent-browser'");
    expect(installHelpersSource).toContain("$nextAction = 'agent-browser CLI not found after npm install'");
    expect(installHelpersSource).toContain("$status = 'ready'\n        $nextAction = ''");
    expect(installHelpersSource).not.toContain('agent-browser doctor');
    expect(installHelpersSource).not.toContain('doctor --fix');
    expect(installHelpersSource).toContain("$mode -eq 'verify-only' -and -not (Test-Path $agentBrowserInstallMarker)");
  });

  test('PowerShell dependency and repair paths are Windows-safe', () => {
    const checkDepsSource = fs.readFileSync(checkDepsPs1, 'utf8');
    const repairSource = fs.readFileSync(repairInstallPs1, 'utf8');

    expect(checkDepsSource).toContain('^(uv|uvx):windows$');
    expect(checkDepsSource).toContain('irm https://astral.sh/uv/install.ps1 | iex');
    expect(checkDepsSource).toContain('curl -LsSf https://astral.sh/uv/install.sh | sh');
    expect(repairSource).toContain("& (Join-Path $ScriptDir 'configure-host.ps1') -Tool $Tool");
    expect(repairSource).not.toContain('| Out-Null');
  });

  test('Serena bootstrap is idempotent and recoverable', () => {
    const activateSerenaSource = fs.readFileSync(activateSerenaPs1, 'utf8');

    expect(activateSerenaSource).toContain('[switch]$Refresh');
    expect(activateSerenaSource).toContain('[string[]]$Language = @()');
    expect(activateSerenaSource).toContain('function Get-SerenaProjectLanguages');
    expect(activateSerenaSource).toContain('function Normalize-LanguageValues');
    expect(activateSerenaSource).toContain('$effectiveLanguages = @(Normalize-LanguageValues -Values $Language)');
    expect(activateSerenaSource).toContain('Serena refresh requires -Language');
    expect(activateSerenaSource).toContain('function New-IndexArgs');
    expect(activateSerenaSource).toContain('function New-LanguageAttempts');
    expect(activateSerenaSource).toContain("$args.Add('--language')");
    expect(activateSerenaSource).toContain('foreach ($language in @($Languages))');
    expect(activateSerenaSource).toContain('single-language:$language');
    expect(activateSerenaSource).toContain('Test-Path -LiteralPath $projectFile -PathType Leaf');
    expect(activateSerenaSource).toContain('-not $Refresh');
    expect(activateSerenaSource).toContain('function Restore-ExistingState');
    expect(activateSerenaSource).toContain('Restore-ExistingState');
    expect(activateSerenaSource).toContain('$serenaOutput = @(& $command @indexArgArray 2>&1)');
    expect(activateSerenaSource).toContain('Serena bootstrap failed for all language attempts');
    expect(activateSerenaSource).toContain('Move-Item -Force $tmpMarker $readyMarkerPath');
    expect(activateSerenaSource).not.toContain('serena-project-facts.ps1');
  });

  test('PowerShell install-mcp forwards LLM-selected Serena languages', () => {
    const installMcpSource = fs.readFileSync(installMcpPs1, 'utf8');

    expect(installMcpSource).toContain("[Alias('SerenaLanguages')]");
    expect(installMcpSource).toContain('[string[]]$SerenaLanguage = @()');
    expect(installMcpSource).toContain('function Normalize-LanguageValues');
    expect(installMcpSource).toContain('$filteredSerenaLanguages = @(Normalize-LanguageValues -Values $SerenaLanguage)');
    expect(installMcpSource).toContain('$activateParams.Language = @($filteredSerenaLanguages)');
    expect(installMcpSource).toContain("activate-serena.ps1') @activateParams");
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
