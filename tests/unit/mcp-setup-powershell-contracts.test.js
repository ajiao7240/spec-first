const fs = require('fs');
const path = require('path');
const { spawnSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '../..');
const configureHostPs1 = path.join(repoRoot, 'skills/spec-mcp-setup/scripts/configure-host.ps1');
const checkHealthPs1 = path.join(repoRoot, 'skills/spec-mcp-setup/scripts/check-health.ps1');
const checkDepsPs1 = path.join(repoRoot, 'skills/spec-mcp-setup/scripts/check-deps.ps1');
const detectHostPs1 = path.join(repoRoot, 'skills/spec-mcp-setup/scripts/detect-host.ps1');
const detectToolsPs1 = path.join(repoRoot, 'skills/spec-mcp-setup/scripts/detect-tools.ps1');
const resolveProjectTargetPs1 = path.join(repoRoot, 'skills/spec-mcp-setup/scripts/resolve-project-target.ps1');
const verifyToolsPs1 = path.join(repoRoot, 'skills/spec-mcp-setup/scripts/verify-tools.ps1');
const writeProviderConfigPs1 = path.join(repoRoot, 'skills/spec-mcp-setup/scripts/write-provider-config.ps1');
const repairInstallPs1 = path.join(repoRoot, 'skills/spec-mcp-setup/scripts/repair-install.ps1');
const installMcpPs1 = path.join(repoRoot, 'skills/spec-mcp-setup/scripts/install-mcp.ps1');
const uninstallMcpPs1 = path.join(repoRoot, 'skills/spec-mcp-setup/scripts/uninstall-mcp.ps1');
const installMcpSh = path.join(repoRoot, 'skills/spec-mcp-setup/scripts/install-mcp.sh');
const bootstrapProvidersPs1 = path.join(repoRoot, 'skills/spec-graph-bootstrap/scripts/bootstrap-providers.ps1');
const resolveWorkspaceGraphTargetsPs1 = path.join(repoRoot, 'skills/spec-graph-bootstrap/scripts/resolve-workspace-graph-targets.ps1');
const bootstrapProjectConfigPs1 = path.join(repoRoot, 'skills/spec-mcp-setup/scripts/bootstrap-project-config.ps1');
const installHelpersPs1 = path.join(repoRoot, 'skills/spec-mcp-setup/scripts/install-helpers.ps1');
const installHelpersSh = path.join(repoRoot, 'skills/spec-mcp-setup/scripts/install-helpers.sh');
const libTomlPs1 = path.join(repoRoot, 'skills/spec-mcp-setup/scripts/lib-toml.ps1');
const mcpSetupSkillPath = path.join(repoRoot, 'skills/spec-mcp-setup/SKILL.md');

function spawnPwsh(args, options = {}) {
  const result = spawnSync('pwsh', args, options);
  if (result.error && result.error.code === 'ENOENT') {
    return null;
  }
  return result;
}

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
    expect(source).toContain('function ConvertFrom-JsonCompat');
    expect(source).toContain('ConvertFrom-JsonCompat -Json (Get-Content -Raw $ConfigPath) -AsHashtable');
    expect(source).not.toContain('| ConvertFrom-JsonCompat -AsHashtable');
    expect(source).toContain('[System.Collections.IDictionary]$FinalConfig');
    expect(source).toContain("if (-not $config.Contains('mcpServers'))");
    expect(source).toContain('Set-TextFileAtomic -Path $ConfigPath -Value ($config | ConvertTo-Json -Depth 8)');
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
    const skillSource = fs.readFileSync(mcpSetupSkillPath, 'utf8');
    const combined = `${detectSource}\n${verifySource}`;

    expect(combined).not.toContain(`${retiredGraph}.`);
    expect(combined).not.toContain(nativeModules);
    expect(combined).not.toContain(sqliteDep);
    expect(combined).not.toContain(parserDep);
    expect(combined).toContain(providerKey);
    expect(verifySource).toContain("schema_version = 'v2'");
    expect(verifySource).toContain('Required Harness Runtime status (grouped):');
    expect(verifySource).toContain("title = 'Execution result'");
    expect(verifySource).toContain('Graph readiness');
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
    expect(verifySource).toContain("headers = @('Name', 'Role', 'Dependency', 'Host', 'Query', 'Bootstrap', 'Next')");
    expect(verifySource).toContain('function Format-Bootstrap');
    expect(verifySource).toContain('function Get-ProviderNamesByQueryReady');
    expect(verifySource).toContain("headers = @('Name', 'Type', 'Result', 'Dependency', 'Install', 'Skill', 'Next')");
    expect(verifySource).toContain("headers = @('Artifact', 'Project', 'Next')");
    expect(verifySource).toContain('Format-Remark');
    expect(verifySource).toContain('回复“继续完成”');
    expect(verifySource).toContain('现在可以运行 $graphCommand');
    expect(verifySource).toContain('按用户意图进入 plan/work/review/debug 等下游 workflow');
    expect(verifySource).toContain('graph readiness 已就绪');
    expect(verifySource).toContain('如果已经有明确任务，可以在新会话直接描述目标');
    expect(skillSource).toContain('handoff guidance to graph bootstrap or the user-intent workflow');
    expect(skillSource).toContain('when graph readiness is already ready, route by user intent into plan/work/review/debug');
    expect(skillSource).not.toContain('parent workspace, that standards handoff batches child-local baselines for discovered child repos by default');
    expect(skillSource).not.toContain('parent advisory standards artifacts require `spec-' + 'standards --workspace`');
    expect(skillSource).not.toContain('setup does not write those artifacts itself');
    expect(skillSource).toContain('`spec-mcp-setup` owns setup projection, not graph readiness refresh');
    expect(skillSource).toContain('must not write canonical `.spec-first/graph/*`, `.spec-first/providers/*`, or `.spec-first/impact/*`');
    expect(skillSource).toContain('provider fingerprint mismatch');
    expect(skillSource).toContain('hand off to `$spec-graph-bootstrap` / `/spec:graph-bootstrap`');
    expect(skillSource).toContain('branch/pull/rebase-triggered refresh');
    expect(verifySource).toContain('live MCP probe 前需要');
    expect(verifySource).toContain('graph_bootstrap_required');
    expect(verifySource).toContain('$spec-graph-bootstrap');
    expect(verifySource).toContain("if ($overallStatus -ne 'ready') { exit 1 }");
    expect(verifySource).not.toContain('$spec-' + 'standards');
  });

  test('PowerShell project target resolver matches workspace target contract', () => {
    const resolverSource = fs.readFileSync(resolveProjectTargetPs1, 'utf8');
    const detectSource = fs.readFileSync(detectToolsPs1, 'utf8');
    const verifySource = fs.readFileSync(verifyToolsPs1, 'utf8');
    const writeProviderSource = fs.readFileSync(writeProviderConfigPs1, 'utf8');
    const installMcpSource = fs.readFileSync(installMcpPs1, 'utf8');
    const projectConfigSource = fs.readFileSync(bootstrapProjectConfigPs1, 'utf8');
    const graphBootstrapSource = fs.readFileSync(bootstrapProvidersPs1, 'utf8');

    expect(resolverSource).toContain("schema_version = 'project-target.v1'");
    expect(resolverSource).toContain("[ValidateSet('json', 'env')]");
    expect(resolverSource).toContain("[string]$Folder = ''");
    expect(resolverSource).toContain('state_write_allowed');
    expect(resolverSource).toContain('workspace-multi-repo');
    expect(resolverSource).toContain('workspace-single-candidate');
    expect(resolverSource).toContain('workspace-target-required');
    expect(resolverSource).toContain('repo-target-outside-workspace');
    expect(resolverSource).toContain('repo-target-not-git');
    expect(resolverSource).toContain('folder-target-not-found');
    expect(resolverSource).toContain('folder-target-outside-workspace');
    expect(resolverSource).toContain('folder-target-is-git-repo');
    expect(resolverSource).toContain("'non-git-folder'");
    expect(resolverSource).toContain('selected_folder_root');
    expect(resolverSource).toContain('target_root');
    expect(resolverSource).toContain("'child_git_repo'");
    expect(resolverSource).toContain("'.git', 'node_modules', 'vendor', '.claude', '.codex', '.agents', '.spec-first'");
    expect(detectSource).toContain("Join-Path $ScriptDir 'resolve-project-target.ps1'");
    expect(detectSource).toContain('[string]$Folder');
    expect(detectSource).toContain('$resolverParams.Folder = $Folder');
    expect(detectSource).toContain('selected_folder_root');
    expect(detectSource).toContain('target_kind');
    expect(detectSource).toContain('target_candidate_count');
    expect(verifySource).toContain('[string]$Folder');
    expect(verifySource).toContain('$detectParams.Repo = $Repo');
    expect(verifySource).toContain('$detectParams.Folder = $Folder');
    expect(verifySource).toContain('[switch]$AllRepos');
    expect(verifySource).toContain('use either -AllRepos or -Folder');
    expect(verifySource).toContain('workspace-mcp-verify-summary.v1');
    expect(verifySource).toContain('mcp-verify-summary.json');
    expect(verifySource).toContain('all-repos-requires-parent-workspace');
    expect(verifySource).toContain('all-repos-conflicts-with-repo');
    expect(verifySource).toContain('parent_writes_repo_local_artifacts');
    expect(verifySource).toContain('workspace-default-all-repos');
    expect(verifySource).toContain('explicit-all-repos');
    expect(verifySource).toContain('function Invoke-ChildScriptCaptured');
    expect(verifySource).toContain('2> $stderrPath 6> $informationPath');
    expect(verifySource).not.toContain('$PSCommandPath -Repo ([string]$child.workspace_relative_path) 2>&1');
    expect(verifySource).toContain('workspace-summary-symlink-escape');
    expect(verifySource).toContain('$providerActionRequired = @($combined.repo_config_status, $combined.runtime_capabilities_status, $combined.provider_artifacts_status)');
    expect(verifySource).toContain('choose a child repo and rerun with --repo <child>');
    expect(verifySource).toContain("[string]$combined.target_kind -ne 'non-git-folder'");
    expect(writeProviderSource).toContain('$targetWriteAllowed');
    expect(writeProviderSource).toContain("$script:TargetKind -ne 'non-git-folder'");
    expect(writeProviderSource).toContain("bootstrap = @('npx', '-y', $GitNexusPackageSpec, 'analyze', '--skip-git', '--force', '--skip-agents-md', '--no-stats')");
    expect(writeProviderSource).toContain("if ($property.Name -ne 'gitnexus')");
    expect(writeProviderSource).toContain('Get-FolderContentFingerprint');
    expect(writeProviderSource).toContain('graph_bootstrap_required = $true');
    expect(writeProviderSource).toContain('project-config-symlink-escape');
    expect(writeProviderSource).toContain('Test-SymlinkPath $outDir');
    expect(installMcpSource).toContain('[string]$Folder');
    expect(installMcpSource).toContain('[switch]$AllRepos');
    expect(installMcpSource).toContain('$resolverParams.Folder = $Folder');
    expect(installMcpSource).toContain('use either -AllRepos or -Folder');
    expect(installMcpSource).not.toContain('Se' + 'rena');
    expect(installMcpSource).not.toContain('se' + 'rena');
    expect(installMcpSource).toContain('workspace-mcp-setup-summary.v1');
    expect(installMcpSource).toContain('mcp-setup-summary.json');
    expect(installMcpSource).toContain('function Invoke-ChildJsonScript');
    expect(installMcpSource).toContain('2> $stderrPath 6> $informationPath');
    expect(installMcpSource).toContain('workspace-default-all-repos');
    expect(installMcpSource).toContain('explicit-all-repos');
    expect(installMcpSource).toContain("if ($overallStatus -ne 'ready') { exit 1 }");
    expect(installMcpSource).toContain('workspace-summary-symlink-escape');
    expect(installMcpSource).toContain('$OnlyArray = @(Parse-List $Only)');
    expect(installMcpSource).toContain('results = @($results.ToArray())');
    expect(graphBootstrapSource).toContain("if ($overallStatus -ne 'ready') { exit 1 }");
    expect(graphBootstrapSource).toContain('workspace-summary-symlink-escape');
    expect(installMcpSource).not.toContain('$PSCommandPath @childParams 2>&1');
    expect(projectConfigSource).toContain('[string]$Repo');
    expect(projectConfigSource).toContain('[string]$Folder');
    expect(projectConfigSource).toContain('[switch]$AllRepos');
    expect(projectConfigSource).toContain('use either -AllRepos or -Folder');
    expect(projectConfigSource).toContain('resolve-project-target.ps1');
    expect(projectConfigSource).toContain("if ($script:targetKind -eq 'non-git-folder')");
    expect(projectConfigSource).toContain('not-applicable-non-git-folder');
    expect(projectConfigSource).toContain('workspace-project-config-bootstrap-summary.v1');
    expect(projectConfigSource).toContain('project-config-bootstrap-summary.json');
    expect(projectConfigSource).toContain('workspace-default-all-repos');
    expect(projectConfigSource).toContain('explicit-all-repos');
    expect(projectConfigSource).toContain('parent_writes_repo_local_artifacts');
    expect(projectConfigSource).toContain('function Invoke-ChildJsonScript');
    expect(projectConfigSource).toContain('all-repos-requires-parent-workspace');
    expect(projectConfigSource).toContain('all-repos-conflicts-with-repo');
    expect(projectConfigSource).toContain("if ($overallStatus -ne 'ready') { exit 1 }");
    expect(projectConfigSource).toContain('workspace-summary-symlink-escape');
    expect(projectConfigSource).toContain('project-config-symlink-escape');
    expect(projectConfigSource).toContain('gitignore-symlink-escape');
    expect(graphBootstrapSource).toContain('resolve-project-target.ps1');
    expect(graphBootstrapSource).toContain('[string]$Folder');
    expect(graphBootstrapSource).toContain('$resolverParams.Folder = $Folder');
    expect(graphBootstrapSource).toContain('incremental-non-git-folder-unsupported');
    expect(graphBootstrapSource).toContain('Get-FolderContentFingerprint');
    expect(graphBootstrapSource).toContain("'non_git_folder_no_git_diff', 'non_git_folder_no_commit_freshness', 'non_git_folder_no_incremental'");
    expect(graphBootstrapSource).toContain("GetEnvironmentVariable('SPEC_FIRST_PROJECT_TARGET_RESOLVER')");
    expect(graphBootstrapSource).toContain('$resolverPath = $resolverOverride');
    expect(graphBootstrapSource).toContain('workspace-target-required');
    expect(graphBootstrapSource).toContain('candidates = @($targetFacts.candidates)');
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
    expect(libTomlSource).toContain('function Set-TextFileAtomic');
    expect(libTomlSource).toContain('Test-Path -LiteralPath $Path');
    expect(libTomlSource).toContain('Get-Content -Raw -LiteralPath $Path');
    expect(libTomlSource).toContain('Set-Content -Encoding utf8 -LiteralPath $tmp');
    expect(libTomlSource).toContain('Move-Item -Force -LiteralPath $tmp -Destination $Path');
    expect(libTomlSource).toContain('Set-TextFileAtomic -Path $Path -Value $text');
  });

  test('TOML helpers preserve literal paths with wildcard characters', () => {
    const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'spec-ps-literal-'));
    const bracketDir = path.join(tmpDir, 'repo [win64]');
    const configPath = path.join(bracketDir, 'config.toml');
    fs.mkdirSync(bracketDir, { recursive: true });

    try {
      const script = [
        `. '${libTomlPs1.replace(/'/g, "''")}'`,
        '$body = "command = `"node`"`nargs = [`"--version`"]"',
        'Write-TomlMcpSection -Path $env:SPEC_FIRST_TOML_PATH -Key "agent-browser" -Body $body',
        '$section = Get-TomlMcpSection -Path $env:SPEC_FIRST_TOML_PATH -Key "agent-browser"',
        'if ($section -notmatch "command =") { exit 7 }',
      ].join('; ');
      const result = spawnPwsh(['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], {
        cwd: repoRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          SPEC_FIRST_TOML_PATH: configPath,
        },
      });
      if (!result) return;

      expect(result.status).toBe(0);
      expect(fs.readFileSync(configPath, 'utf8')).toContain('[mcp_servers."agent-browser"]');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('mcp-tools template helper expands graph-provider pins from package + version fields', () => {
    const libTemplatePs1 = path.join(repoRoot, 'skills/spec-mcp-setup/scripts/lib-template.ps1');
    const libTemplateSource = fs.readFileSync(libTemplatePs1, 'utf8');
    expect(libTemplateSource).toContain('function Get-ToolField');
    expect(libTemplateSource).toContain('function Expand-ToolTemplate');
    expect(libTemplateSource).toContain('function Expand-ToolArgs');
    expect(libTemplateSource).toContain(".Replace('{{package}}', [string]$package)");
    expect(libTemplateSource).toContain(".Replace('{{version}}', [string]$version)");
    expect(libTemplateSource).not.toContain("-replace '\\{\\{package\\}\\}'");
    expect(libTemplateSource).not.toContain("-replace '\\{\\{version\\}\\}'");
    expect(libTemplateSource).toContain("if ($null -eq $package) { $package = '' }");
    expect(libTemplateSource).toContain("if ($null -eq $version) { $version = '' }");

    const installSource = fs.readFileSync(installMcpPs1, 'utf8');
    const configureSource = fs.readFileSync(configureHostPs1, 'utf8');
    const detectSource = fs.readFileSync(detectToolsPs1, 'utf8');
    expect(installSource).toContain(". (Join-Path $ScriptDir 'lib-template.ps1')");
    expect(configureSource).toContain(". (Join-Path $ScriptDir 'lib-template.ps1')");
    expect(detectSource).toContain(". (Join-Path $ScriptDir 'lib-template.ps1')");
    expect(fs.readFileSync(uninstallMcpPs1, 'utf8')).toContain(". (Join-Path $ScriptDir 'lib-template.ps1')");
    expect(installSource).toContain('Expand-ToolArgs -Tool $Tool -Args $step.args');
    expect(configureSource).toContain('Expand-ToolArgs -Tool $ToolDef -Args $HostConfig.args');
    expect(detectSource).toContain('Expand-ToolArgs -Tool $Tool -Args $hostConfig.args');
    expect(configureSource).toContain("Get-ToolField -Tool $target -Name 'exists'");
    expect(configureSource).toContain("Get-ToolField -Tool $target -Name 'precedence'");
    expect(configureSource).toContain("Get-ToolField -Tool $target -Name 'config_path'");
    expect(detectSource).toContain("Get-ToolField -Tool $target -Name 'exists'");
    expect(detectSource).toContain("Get-ToolField -Tool $target -Name 'precedence'");
    expect(detectSource).toContain("Get-ToolField -Tool $target -Name 'config_path'");
    expect(configureSource).not.toContain('$target.exists');
    expect(detectSource).not.toContain('$target.exists');
    expect(fs.readFileSync(uninstallMcpPs1, 'utf8')).toContain("Get-ToolField -Tool $target -Name 'config_path'");
    expect(fs.readFileSync(uninstallMcpPs1, 'utf8')).not.toContain('$target.config_path');

    const toolsJson = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'skills/spec-mcp-setup/mcp-tools.json'), 'utf8'),
    );
    expect(toolsJson.schema_version).toBe('6');
    const gitnexus = toolsJson.tools.find((t) => t.id === 'gitnexus');
    expect(gitnexus.package).toBe('gitnexus');
    expect(gitnexus.version).toBe('1.6.5');
    expect(gitnexus.installation.unix.args).toEqual(['-y', '{{package}}@{{version}}', '--help']);
    expect(gitnexus.installation.windows.args).toEqual(['-y', '{{package}}@{{version}}', '--help']);
    expect(gitnexus.host_config.claude.args).toEqual(['-y', '{{package}}@{{version}}', 'mcp']);
    expect(gitnexus.host_config.codex.args).toEqual(['-y', '{{package}}@{{version}}', 'mcp']);
    expect(Object.keys(gitnexus.provider_config.native_capabilities).sort()).toEqual([
      'context',
      'cypher',
      'impact',
      'query',
      'repo_registry',
      'route_api_evidence',
      'shape_check',
      'tool_map',
      'workspace_group',
    ]);
    for (const capability of Object.values(gitnexus.provider_config.native_capabilities)) {
      expect(Object.keys(capability).sort()).toEqual([
        'fallback_posture',
        'meaning',
        'mutation_boundary',
        'native_resources',
        'native_tools',
        'source_tags',
      ]);
      expect(capability.source_tags).toEqual(['checked-in-baseline', 'provider-pin']);
    }
    expect(gitnexus.provider_config.native_capabilities.workspace_group.mutation_boundary).toBe('read-only');
    expect(gitnexus.provider_config.native_capabilities.workspace_group.native_tools).toEqual(['group_list']);
    expect(gitnexus.provider_config.native_capabilities.workspace_group.native_resources).toContain('gitnexus://group/{name}/status');
    const codeReviewGraph = toolsJson.tools.find((t) => t.id === 'code-review-graph');
    expect(codeReviewGraph).toBeUndefined();
  });

  test('PowerShell install-mcp caches successful package warmups by resolved command hash', () => {
    const installSource = fs.readFileSync(installMcpPs1, 'utf8');

    expect(installSource).toContain('$script:WarmupCacheRoot');
    expect(installSource).toContain('function Get-WarmupCommandHash');
    expect(installSource).toContain('function Test-WarmupCacheHit');
    expect(installSource).toContain('function Write-WarmupCache');
    expect(installSource).toContain("'mcp-warmup-cache.v1'");
    expect(installSource).toContain('SPEC_FIRST_FORCE_WARMUP');
    expect(installSource).toContain('SPEC_FIRST_DISABLE_WARMUP_CACHE');
    expect(installSource).toContain("Get-NonNegativeIntEnv -Name 'SPEC_FIRST_WARMUP_LATEST_TTL_SECONDS' -Default 86400");
    expect(installSource).toContain("Get-ToolField -Tool $cache -Name 'schema_version'");
    expect(installSource).toContain("Get-ToolField -Tool $cache -Name 'command_hash'");
    expect(installSource).toContain("$exitCodeValue = Get-ToolField -Tool $cache -Name 'exit_code'");
    expect(installSource).toContain("$lastSuccessEpochValue = Get-ToolField -Tool $cache -Name 'last_success_epoch'");
    expect(installSource).toContain('[int]::TryParse([string]$exitCodeValue, [ref]$exitCode)');
    expect(installSource).toContain('[int64]::TryParse([string]$lastSuccessEpochValue, [ref]$lastSuccessEpoch)');
    expect(installSource).not.toContain('$cache.schema_version');
    expect(installSource).not.toContain('$cache.exit_code');
    expect(installSource).not.toContain('$cache.last_success_epoch');
    expect(installSource).toContain('$tmp = $null');
    expect(installSource).toContain('Remove-Item -Force -LiteralPath $tmp -ErrorAction SilentlyContinue');
    expect(installSource).toContain('Set-Content -Encoding utf8 -LiteralPath $tmp');
    expect(installSource).toContain('Move-Item -Force -LiteralPath $tmp -Destination $cachePath');
    expect(installSource).toContain("$lastAction = 'warmup-cache-hit'");
    expect(installSource).toContain('Write-WarmupCache -Tool $tool -Command $warmupStep.command -Arguments $warmupArgs -CommandHash $warmupHash');
  });

  test('PowerShell install-mcp serializes empty filtered results as JSON array', () => {
    const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'spec-ps-install-empty-'));
    const fakeHome = path.join(tmpDir, 'home');
    const repo = path.join(tmpDir, 'repo');
    fs.mkdirSync(repo, { recursive: true });
    spawnSync('git', ['init', '-q'], { cwd: repo });

    try {
      const result = spawnPwsh(
        ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', installMcpPs1, '-Only', '__no_such_tool__'],
        {
          cwd: repo,
          encoding: 'utf8',
          env: { ...process.env, HOME: fakeHome, MCP_SETUP_HOST: 'codex' },
        },
      );
      if (!result) return;

      expect(result.status).toBe(0);
      const payload = JSON.parse(result.stdout);
      expect(Array.isArray(payload.results)).toBe(true);
      expect(payload.results).toHaveLength(0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('PowerShell external command runners keep Windows PowerShell 5.1 ProcessStartInfo fallback', () => {
    const installSource = fs.readFileSync(installMcpPs1, 'utf8');
    const graphBootstrapSource = fs.readFileSync(bootstrapProvidersPs1, 'utf8');

    for (const source of [installSource, graphBootstrapSource]) {
      expect(source).toContain('function Join-WindowsProcessArguments');
      expect(source).toContain('function Set-ProcessArgumentsCompat');
      expect(source).toContain("$ProcessInfo.PSObject.Properties.Name -contains 'ArgumentList'");
      expect(source).toContain('[void]$ProcessInfo.ArgumentList.Add([string]$argument)');
      expect(source).toContain('$ProcessInfo.Arguments = Join-WindowsProcessArguments -Arguments $Arguments');
      expect(source).toContain('Set-ProcessArgumentsCompat -ProcessInfo $processInfo');
    }
  });

  test('PowerShell host detection supports Unix parity test overrides', () => {
    const detectHostSource = fs.readFileSync(detectHostPs1, 'utf8');

    expect(detectHostSource).toContain('function Resolve-TargetPathOverride');
    expect(detectHostSource).toContain('function Get-MapValue');
    expect(detectHostSource).toContain('function ConvertTo-BoolValue');
    expect(detectHostSource).toContain('[System.Collections.IDictionary]$McpHostContract');
    expect(detectHostSource.indexOf('function ConvertFrom-JsonCompat')).toBeLessThan(
      detectHostSource.indexOf('$ToolsJson = Read-McpToolsJson'),
    );
    expect(detectHostSource).toContain(". (Join-Path $ScriptDir 'lib-template.ps1')");
    expect(detectHostSource).toContain("$ToolsJson = Read-McpToolsJson -Path (Join-Path $SkillDir 'mcp-tools.json') -AsHashtable");
    expect(detectHostSource).toContain('Assert-McpToolsSchemaVersion -ToolsJson $ToolsJson');
    expect(detectHostSource).toContain('return (ConvertFrom-JsonCompat -Json $uniqueContracts[0] -AsHashtable)');
    expect(detectHostSource).not.toContain('| ConvertFrom-JsonCompat -AsHashtable');
    expect(detectHostSource).toContain('$hasIsWindows = $null -ne (Get-Variable -Name IsWindows -ErrorAction SilentlyContinue)');
    expect(detectHostSource).toContain('MCP_SETUP_CLAUDE_MANAGED_PATH_OVERRIDE');
    expect(detectHostSource).toContain('MCP_SETUP_CODEX_SYSTEM_PATH_OVERRIDE');
    expect(detectHostSource).toContain('Resolve-TargetPathOverride -HostName $detectedHost -TargetKey $TargetKey');
    expect(detectHostSource).toContain("Get-MapValue -Object $selectedTarget -Name 'exists'");
    expect(detectHostSource).toContain("Get-MapValue -Object $selectedTarget -Name 'writable'");
    expect(detectHostSource).not.toContain('[bool]$selectedTarget.exists');
    expect(detectHostSource).not.toContain('[bool]$selectedTarget.writable');
    expect(detectHostSource).not.toContain('$McpHostContract.targets[$TargetKey]');
    expect(detectHostSource).not.toMatch(/\[string\]\$Host\b/);
  });

  test('PowerShell host detection serializes Codex higher-precedence targets as a JSON array', () => {
    const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'spec-ps-detect-host-'));
    const fakeHome = path.join(tmpDir, 'home');
    const systemConfig = path.join(tmpDir, 'system-codex.toml');
    fs.mkdirSync(path.join(fakeHome, '.codex'), { recursive: true });
    fs.writeFileSync(systemConfig, '# system codex config\n');

    try {
      const result = spawnPwsh(['-NoLogo', '-NoProfile', '-NonInteractive', '-File', detectHostPs1], {
        cwd: repoRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          HOME: fakeHome,
          MCP_SETUP_HOST: 'codex',
          MCP_SETUP_CODEX_SYSTEM_PATH_OVERRIDE: systemConfig,
        },
      });
      if (!result) return;
      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
      const payload = JSON.parse(result.stdout);
      expect(payload.precedence_blocked).toBe(true);
      expect(Array.isArray(payload.higher_precedence_targets)).toBe(true);
      expect(payload.higher_precedence_targets[0]).toMatchObject({
        key: 'system',
        config_path: systemConfig,
        precedence: 100,
      });
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('PowerShell setup scripts avoid load-time parameter hazards', () => {
    const automaticVariables = new Set([
      'args',
      'error',
      'host',
      'input',
      'matches',
      'myinvocation',
      'pid',
      'profile',
      'pshome',
      'psscriptroot',
      'shellid',
      'stacktrace',
      'this',
    ]);
    const ps1Paths = [
      configureHostPs1,
      checkDepsPs1,
      detectHostPs1,
      detectToolsPs1,
      resolveProjectTargetPs1,
      verifyToolsPs1,
      writeProviderConfigPs1,
      repairInstallPs1,
      installMcpPs1,
      bootstrapProjectConfigPs1,
      installHelpersPs1,
      bootstrapProvidersPs1,
      resolveWorkspaceGraphTargetsPs1,
    ];

    for (const filePath of ps1Paths) {
      const source = fs.readFileSync(filePath, 'utf8');
      const relativePath = path.relative(repoRoot, filePath);
      const lines = source.split(/\r?\n/);
      for (let index = 0; index < lines.length; index += 1) {
        const aliasMatch = lines[index].match(/\[Alias\(([^)]*)\)\]/);
        if (!aliasMatch) continue;
        const nextParamLine = lines.slice(index + 1).find((line) => /\$[A-Za-z_][A-Za-z0-9_]*/.test(line));
        expect(nextParamLine).toBeTruthy();
        const paramName = nextParamLine.match(/\$([A-Za-z_][A-Za-z0-9_]*)/)[1].toLowerCase();
        const aliases = [...aliasMatch[1].matchAll(/'([^']+)'|"([^"]+)"/g)].map((match) => (match[1] || match[2]).toLowerCase());
        expect({ relativePath, line: index + 1, paramName, aliases }).not.toEqual(
          expect.objectContaining({ aliases: expect.arrayContaining([paramName]) }),
        );
      }

      const parameterNames = [...source.matchAll(/param\s*\(([\s\S]*?)\)/g)]
        .flatMap((match) => [...match[1].matchAll(/\$([A-Za-z_][A-Za-z0-9_]*)/g)].map((nameMatch) => nameMatch[1].toLowerCase()));
      const reservedHits = parameterNames.filter((name) => automaticVariables.has(name));
      expect({ relativePath, reservedHits }).toEqual({ relativePath, reservedHits: [] });
      expect({ relativePath, source }).not.toEqual(
        expect.objectContaining({ source: expect.stringMatching(/\[ordered\]\s*\$[A-Za-z_][A-Za-z0-9_]*/) }),
      );
      expect({ relativePath, source }).not.toEqual(
        expect.objectContaining({ source: expect.stringContaining('| ConvertFrom-JsonCompat -AsHashtable') }),
      );
    }
  });

  test('provider projection writer is semantically idempotent', () => {
    const writeProviderSource = fs.readFileSync(writeProviderConfigPs1, 'utf8');
    const verifySource = fs.readFileSync(verifyToolsPs1, 'utf8');

    expect(writeProviderSource).toContain('function ConvertTo-ComparableProjectionJson');
    expect(writeProviderSource).toContain("PSObject.Properties.Name -contains 'generated_at'");
    expect(writeProviderSource).toContain('$Payload.generated_at = $existing.generated_at');
    expect(writeProviderSource).toContain("'.{0}.{1}.tmp'");
    expect(writeProviderSource).toContain('Move-Item -Force -LiteralPath $tmp -Destination $Path');
    expect(writeProviderSource).toContain('runtime-capabilities.v1');
    expect(writeProviderSource).toContain('provider-artifacts.v1');
    expect(writeProviderSource).toContain('derived_readiness');
    expect(writeProviderSource).toContain('$gitNexusNativeCapabilities');
    expect(writeProviderSource).toContain('Get-GitNexusNativeCapabilityProjection');
    expect(writeProviderSource).toContain('native_capabilities');
    expect(writeProviderSource).toContain('gitnexus_capability_discovery');
    expect(writeProviderSource).toContain('setup-inferred availability only; not query-ready graph evidence.');
    expect(writeProviderSource).toContain('policy-blocked surfaces such as group_sync');
    expect(writeProviderSource).toContain('native_tools');
    expect(writeProviderSource).toContain('native_resources');
    expect(writeProviderSource).toContain('function Get-NativeCapabilityArrayField');
    expect(writeProviderSource).toContain("throw ('invalid_gitnexus_{0}:not-array' -f $FieldName)");
    expect(writeProviderSource).toContain("PSObject.Properties.Name -contains 'source_tags'");
    expect(writeProviderSource).toContain('$sourceTagsValue = $Metadata.PSObject.Properties[\'source_tags\'].Value');
    expect(writeProviderSource).toContain("throw 'invalid_gitnexus_source_tags:not-array'");
    expect(writeProviderSource).toContain("$allowedRegistryTags = @('checked-in-baseline', 'provider-pin')");
    expect(writeProviderSource).toContain('invalid_gitnexus_source_tag:$tagValue');
    expect(writeProviderSource).toContain("'setup-projection'");
    expect(writeProviderSource).toContain('source_tags = @(Get-NativeCapabilitySourceTags -Metadata $metadata)');
    expect(writeProviderSource).not.toContain('capability_metadata_freshness');
    expect(writeProviderSource).toContain('generated_at is audit metadata only');
    expect(writeProviderSource).toContain('function Test-ProviderReady');
    expect(writeProviderSource).toContain('[bool]$Provider.enabled_for_bootstrap');
    expect(writeProviderSource).toContain("if (($Status -eq 'available' -or $Status -eq 'mutation-gated') -and (Test-ProviderReady -Provider $Provider)) { return 'configured-and-detected' }");
    expect(writeProviderSource).toContain('host_ledger_pointer');
    expect(writeProviderSource).toContain("$toolsJsonPath = Join-Path $skillDir 'mcp-tools.json'");
    expect(writeProviderSource).toContain("$gitNexusPackage = if ($null -ne $gitNexusEntry.PSObject.Properties['package']) { [string]$gitNexusEntry.package } else { '' }");
    expect(writeProviderSource).toContain("$gitNexusVersion = if ($null -ne $gitNexusEntry.PSObject.Properties['version']) { [string]$gitNexusEntry.version } else { '' }");
    expect(writeProviderSource).toContain('$gitNexusPackageSpec = "$gitNexusPackage@$gitNexusVersion"');
    expect(writeProviderSource).not.toContain('$codeReviewGraphEntry');
    expect(writeProviderSource).not.toContain('$codeReviewGraphPackageSpec');
    expect(writeProviderSource).not.toContain('[string]$CodeReviewGraphPackageSpec');
    expect(writeProviderSource).toContain("bootstrap = @('npx', '-y', $GitNexusPackageSpec, 'analyze', '--force', '--skip-agents-md', '--no-stats')");
    expect(writeProviderSource).toContain("status = @('npx', '-y', $GitNexusPackageSpec, 'status')");
    expect(writeProviderSource).toContain("impact_probe = @('npx', '-y', $GitNexusPackageSpec, 'impact', [string]$GitNexusQueryProbePolicy.token, '--repo', $GitNexusRepoName, '--include-tests', '--depth', '2')");
    expect(writeProviderSource).not.toContain("bootstrap = @('uvx', $CodeReviewGraphPackageSpec, 'build')");
    expect(writeProviderSource).not.toContain("status = @('uvx', $CodeReviewGraphPackageSpec, 'status')");
    expect(writeProviderSource).toContain('function Get-GitNexusRepoName');
    expect(writeProviderSource).toContain('function Get-GitNexusRepoNameFromRemoteUrl');
    expect(writeProviderSource).toContain('function Get-GitRemoteUrl');
    expect(writeProviderSource).toContain("remote.origin.url");
    expect(writeProviderSource).toContain("Join-Path $RepoRoot '.gitnexus/meta.json'");
    expect(writeProviderSource).toContain("remoteUrl");
    expect(writeProviderSource).toContain("query_probe = @('npx', '-y', $GitNexusPackageSpec, 'query', [string]$GitNexusQueryProbePolicy.token, '--repo', $GitNexusRepoName)");
    expect(writeProviderSource).toContain("impact_probe = '.spec-first/providers/gitnexus/raw/impact.log'");
    expect(writeProviderSource).toContain("impact_capabilities = '.spec-first/providers/gitnexus/normalized/impact-capabilities.json'");
    expect(verifySource).not.toContain('gitnexus analyze');
    expect(verifySource).not.toContain('gitnexus status');
    expect(verifySource).not.toContain('gitnexus query');
    expect(verifySource).not.toContain('group_sync');
    expect(writeProviderSource).toContain('function Get-GitNexusQueryProbePolicy');
    expect(writeProviderSource).toContain('function Test-GitNexusProbeLowSignalToken');
    expect(writeProviderSource).toContain('function Test-GitNexusProbeWorkflowSignalToken');
    expect(writeProviderSource).toContain('function Test-GitNexusProbeEntrySignalToken');
    expect(writeProviderSource).toContain('function Test-GitNexusProbeWeakProofToken');
    expect(writeProviderSource).toContain('function Test-GitNexusProbeInfrastructureToken');
    expect(writeProviderSource).toContain('function Test-GitNexusProbeDisplaySignalToken');
    expect(writeProviderSource).toContain('function Test-GitNexusProbeMethodSignalToken');
    expect(writeProviderSource).toContain('function Get-GitNexusProbeMethodTokensFromPath');
    expect(writeProviderSource).toContain('workflow_method');
    expect(writeProviderSource).toContain('src_method');
    expect(writeProviderSource).toContain('git-ls-files-source-symbol');
    expect(writeProviderSource).toContain('Health|Ping|Actuator|Status|Info|Error|Metrics');
    expect(writeProviderSource).toContain("'^(Ad|Ads)$'");
    expect(writeProviderSource).toContain("'^(Advertise|Advertisement|Splash|Guide|Intro|Onboarding)[A-Za-z0-9_]*'");
    expect(writeProviderSource).not.toContain('Trade[A-Za-z0-9_]*Activity');
    expect(writeProviderSource).toContain('entrypoint_named');
    expect(writeProviderSource).toContain('workflow_named');
    expect(writeProviderSource).toContain('workflow_display_named');
    expect(writeProviderSource).toContain('src_high_signal');
    expect(writeProviderSource).toContain('candidates = @($candidates.ToArray())');
    expect(writeProviderSource).toContain('postinstall|preinstall');
    expect(writeProviderSource).toContain('git-ls-files-code-basename');
    expect(writeProviderSource).toContain('query_probe_policy = if ($property.Name -eq');
    expect(writeProviderSource).toContain('$gitNexusRepoName = Get-GitNexusRepoName -RepoRoot $repoRoot -Facts $facts');
    expect(writeProviderSource).toContain('Get-ProviderCommands -Provider $property.Name -RepoRoot $repoRoot -GitNexusPackageSpec $gitNexusPackageSpec -GitNexusQueryProbePolicy $gitNexusQueryProbePolicy -GitNexusRepoName $gitNexusRepoName');
    expect(writeProviderSource).toContain("incremental = @('npx', '-y', $GitNexusPackageSpec, 'analyze', '--skip-agents-md', '--no-stats')");
    expect(writeProviderSource).not.toContain("incremental = @('uvx', $CodeReviewGraphPackageSpec, 'update', '--base', '__SPEC_FIRST_LAST_INDEXED_COMMIT__')");
    expect(writeProviderSource).not.toContain("query_probe = @('uvx', $CodeReviewGraphPackageSpec, 'status', '--repo', $RepoRoot)");
    expect(writeProviderSource).toContain('function Test-CanonicalProviderFreshForCurrent');
    expect(writeProviderSource).toContain('function Get-GitPorcelainStatusText');
    expect(writeProviderSource).toContain('function Get-ProviderCommandHashForCommands');
    expect(writeProviderSource).toContain('$status.bootstrap_fingerprint.provider');
    expect(writeProviderSource).toContain('[string]$fingerprint.command_hash -eq $CurrentCommandHash');
    expect(writeProviderSource).toContain('[bool]$Provider.enabled_for_bootstrap');
    expect(writeProviderSource).toContain("$currentSourceRevision = Invoke-GitConfigValue -RepoRoot $repoRoot -GitArguments @('rev-parse', '--verify', 'HEAD^{commit}')");
    expect(writeProviderSource).toContain('$currentWorktreeStatusHash = Get-StatusHash -Text $currentWorktreeStatus');
    expect(writeProviderSource).toContain('$canonicalGraphSourceRevisionCurrent');
    expect(writeProviderSource).toContain('$canonicalGraphWorktreeCurrent');
    expect(writeProviderSource).toContain('$canonicalArtifactsAvailable');
    expect(writeProviderSource).toContain('$canonicalArtifactsCurrent');
    expect(writeProviderSource).toContain('graph_bootstrap_required = ($providerBootstrapRequired -or $canonicalWorkflowMode -ne');
    expect(writeProviderSource).toContain('support_level');
    expect(writeProviderSource).toContain('project_graph_readiness');
    expect(writeProviderSource).toContain("$repoConfigStatus = 'ready'");
    expect(writeProviderSource).toContain('repo_config_status = $providerStatus');
  });

  test('PowerShell provider projection enforces GitNexus capability array registry shapes at runtime', () => {
    const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'spec-ps-capability-arrays-'));

    function runGit(args, cwd) {
      const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
      expect(result.status).toBe(0);
    }

    function runProjectionCase(name, mutateGitNexus, mutateFacts = null) {
      const skillCopy = path.join(tmpDir, `${name}-spec-mcp-setup`);
      const repoDir = path.join(tmpDir, `${name}-repo`);
      fs.cpSync(path.join(repoRoot, 'skills/spec-mcp-setup'), skillCopy, { recursive: true });

      const toolsJsonPath = path.join(skillCopy, 'mcp-tools.json');
      const toolsJson = JSON.parse(fs.readFileSync(toolsJsonPath, 'utf8'));
      const gitnexus = toolsJson.tools.find((tool) => tool.id === 'gitnexus');
      mutateGitNexus(gitnexus, toolsJson);
      fs.writeFileSync(toolsJsonPath, `${JSON.stringify(toolsJson, null, 2)}\n`);

      fs.mkdirSync(repoDir, { recursive: true });
      runGit(['init', '-q'], repoDir);
      runGit(['config', 'user.name', 'Spec First Test'], repoDir);
      runGit(['config', 'user.email', 'spec-first-test@example.invalid'], repoDir);
      runGit(['config', 'core.hooksPath', '/dev/null'], repoDir);
      fs.writeFileSync(path.join(repoDir, 'README.md'), `${name} fixture\n`);
      fs.mkdirSync(path.join(repoDir, 'src'), { recursive: true });
      fs.writeFileSync(path.join(repoDir, 'src', 'PaymentWorkflow.js'), 'function PaymentWorkflow() { return true; }\n');
      runGit(['add', 'README.md', 'src/PaymentWorkflow.js'], repoDir);
      runGit(['commit', '-q', '-m', `Add ${name} fixture`], repoDir);

      const factsPath = path.join(tmpDir, `${name}-facts.json`);
      const facts = {
        schema_version: 'v2',
        host: 'claude',
        platform: 'windows',
        repo_status: 'git-repo',
        repo_root: repoDir,
        selected_repo_root: repoDir,
        target: {
          state_write_allowed: true,
          reason_code: '',
          next_action: '',
          candidates: [],
        },
        baseline_ready: true,
        host_runtime_ready: true,
        host_ledger_pointer: { path: '.spec-first/host-readiness.json' },
        tools: {},
        helper_tools: {},
        graph_providers: {
          gitnexus: {
            configured: true,
            enabled_for_bootstrap: true,
            required: true,
            role: 'global_knowledge',
            access_mode: 'live_mcp',
            host_config_required: true,
            dependency_status: 'ready',
            host_config_status: 'ready',
            capabilities: [],
          },
        },
      };
      if (mutateFacts) {
        mutateFacts(facts);
      }
      fs.writeFileSync(factsPath, `${JSON.stringify(facts, null, 2)}\n`);

      return {
        providerConfigPath: path.join(repoDir, '.spec-first/config/graph-providers.json'),
        runtimeCapabilitiesPath: path.join(repoDir, '.spec-first/config/runtime-capabilities.json'),
        result: spawnPwsh(
          ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', path.join(skillCopy, 'scripts/write-provider-config.ps1'), '-FactsFile', factsPath],
          { cwd: repoRoot, encoding: 'utf8' },
        ),
      };
    }

    try {
      const valid = runProjectionCase('valid-source-tags', (gitnexus) => {
        gitnexus.provider_config.native_capabilities.query.source_tags = ['checked-in-baseline', 'provider-pin', 'checked-in-baseline'];
      });
      if (!valid.result) return;
      expect(valid.result.status).toBe(0);
      expect(valid.result.stderr).toBe('');
      const providerConfig = JSON.parse(fs.readFileSync(valid.providerConfigPath, 'utf8'));
      expect(providerConfig.providers.gitnexus.native_capabilities.query.source_tags).toEqual([
        'checked-in-baseline',
        'provider-pin',
        'setup-projection',
      ]);
      expect(providerConfig.providers.gitnexus.native_capabilities.query.native_tools).toEqual(['query']);
      expect(Array.isArray(providerConfig.providers.gitnexus.native_capabilities.query.native_resources)).toBe(true);
      const runtimeCapabilities = JSON.parse(fs.readFileSync(valid.runtimeCapabilitiesPath, 'utf8'));
      expect(runtimeCapabilities.fallback_tools['ast-grep'].support_level).toBe('none');
      expect(runtimeCapabilities.fallback_tools['ast-grep'].capabilities).toEqual(['structural_search', 'safe_rewrite']);
      expect(runtimeCapabilities.fallback_tools['ast-grep'].limitations).toEqual(['ast-grep helper is not ready.']);
      expect(runtimeCapabilities.fallback_capabilities.context_selection.providers).toEqual([]);
      expect(runtimeCapabilities.fallback_capabilities.impact_radius.providers).toEqual([]);
      expect(runtimeCapabilities.fallback_capabilities.review_support.providers).toEqual([]);

      const readyAstGrep = runProjectionCase(
        'ready-ast-grep-runtime-arrays',
        () => {},
        (facts) => {
          facts.helper_tools['ast-grep'] = { result: 'ready' };
        },
      );
      expect(readyAstGrep.result.status).toBe(0);
      const readyAstGrepRuntime = JSON.parse(fs.readFileSync(readyAstGrep.runtimeCapabilitiesPath, 'utf8'));
      expect(readyAstGrepRuntime.fallback_tools['ast-grep'].limitations).toEqual([]);
      expect(readyAstGrepRuntime.fallback_capabilities.context_selection.providers).toEqual(['ast-grep']);
      expect(readyAstGrepRuntime.fallback_capabilities.impact_radius.providers).toEqual(['ast-grep']);
      expect(readyAstGrepRuntime.fallback_capabilities.review_support.providers).toEqual(['ast-grep']);

      const disabledProvider = runProjectionCase(
        'disabled-provider-provenance',
        () => {},
        (facts) => {
          facts.graph_providers.gitnexus.enabled_for_bootstrap = false;
        },
      );
      expect(disabledProvider.result.status).toBe(0);
      const disabledConfig = JSON.parse(fs.readFileSync(disabledProvider.providerConfigPath, 'utf8'));
      expect(disabledConfig.providers.gitnexus.native_capabilities.query.status).toBe('unavailable');
      expect(disabledConfig.providers.gitnexus.native_capabilities.query.source_provenance).toBe('configured-not-verified');

      const invalidLive = runProjectionCase('invalid-live-tag', (gitnexus) => {
        gitnexus.provider_config.native_capabilities.query.source_tags = ['checked-in-baseline', 'live-mcp-tool'];
      });
      expect(invalidLive.result.status).not.toBe(0);
      expect(`${invalidLive.result.stderr}\n${invalidLive.result.stdout}`).toContain('invalid_gitnexus_source_tag:live-mcp-tool');
      expect(fs.existsSync(invalidLive.providerConfigPath)).toBe(false);

      const scalarTag = runProjectionCase('scalar-source-tag', (gitnexus) => {
        gitnexus.provider_config.native_capabilities.query.source_tags = 'checked-in-baseline';
      });
      expect(scalarTag.result.status).not.toBe(0);
      expect(`${scalarTag.result.stderr}\n${scalarTag.result.stdout}`).toContain('invalid_gitnexus_source_tags:not-array');
      expect(fs.existsSync(scalarTag.providerConfigPath)).toBe(false);

      const emptyTag = runProjectionCase('empty-source-tags', (gitnexus) => {
        gitnexus.provider_config.native_capabilities.query.source_tags = [];
      });
      expect(emptyTag.result.status).not.toBe(0);
      expect(`${emptyTag.result.stderr}\n${emptyTag.result.stdout}`).toContain('invalid_gitnexus_source_tags:missing-baseline');
      expect(fs.existsSync(emptyTag.providerConfigPath)).toBe(false);

      const missingTag = runProjectionCase('missing-source-tags', (gitnexus) => {
        delete gitnexus.provider_config.native_capabilities.query.source_tags;
      });
      expect(missingTag.result.status).not.toBe(0);
      expect(`${missingTag.result.stderr}\n${missingTag.result.stdout}`).toContain('invalid_gitnexus_source_tags:missing-field');
      expect(fs.existsSync(missingTag.providerConfigPath)).toBe(false);

      const missingMeaning = runProjectionCase('missing-meaning', (gitnexus) => {
        delete gitnexus.provider_config.native_capabilities.query.meaning;
      });
      expect(missingMeaning.result.status).not.toBe(0);
      expect(`${missingMeaning.result.stderr}\n${missingMeaning.result.stdout}`).toContain('invalid_gitnexus_meaning:missing-field');
      expect(fs.existsSync(missingMeaning.providerConfigPath)).toBe(false);

      const missingFallbackPosture = runProjectionCase('missing-fallback-posture', (gitnexus) => {
        delete gitnexus.provider_config.native_capabilities.query.fallback_posture;
      });
      expect(missingFallbackPosture.result.status).not.toBe(0);
      expect(`${missingFallbackPosture.result.stderr}\n${missingFallbackPosture.result.stdout}`).toContain('invalid_gitnexus_fallback_posture:missing-field');
      expect(fs.existsSync(missingFallbackPosture.providerConfigPath)).toBe(false);

      const blankFallbackPosture = runProjectionCase('blank-fallback-posture', (gitnexus) => {
        gitnexus.provider_config.native_capabilities.query.fallback_posture = ' ';
      });
      expect(blankFallbackPosture.result.status).not.toBe(0);
      expect(`${blankFallbackPosture.result.stderr}\n${blankFallbackPosture.result.stdout}`).toContain('invalid_gitnexus_fallback_posture:invalid-entry');
      expect(fs.existsSync(blankFallbackPosture.providerConfigPath)).toBe(false);

      const schemaV5 = runProjectionCase('schema-v5', (_gitnexus, toolsJson) => {
        toolsJson.schema_version = '5';
      });
      expect(schemaV5.result.status).not.toBe(0);
      expect(`${schemaV5.result.stderr}\n${schemaV5.result.stdout}`).toContain('invalid_mcp_tools_schema_version:5');
      expect(fs.existsSync(schemaV5.providerConfigPath)).toBe(false);

      const scalarTools = runProjectionCase('scalar-native-tools', (gitnexus) => {
        gitnexus.provider_config.native_capabilities.query.native_tools = 'query';
      });
      expect(scalarTools.result.status).not.toBe(0);
      expect(`${scalarTools.result.stderr}\n${scalarTools.result.stdout}`).toContain('invalid_gitnexus_native_tools:not-array');
      expect(fs.existsSync(scalarTools.providerConfigPath)).toBe(false);

      const scalarResources = runProjectionCase('scalar-native-resources', (gitnexus) => {
        gitnexus.provider_config.native_capabilities.query.native_resources = 'gitnexus://repo/{name}/status';
      });
      expect(scalarResources.result.status).not.toBe(0);
      expect(`${scalarResources.result.stderr}\n${scalarResources.result.stdout}`).toContain('invalid_gitnexus_native_resources:not-array');
      expect(fs.existsSync(scalarResources.providerConfigPath)).toBe(false);

      const objectTools = runProjectionCase('object-native-tools', (gitnexus) => {
        gitnexus.provider_config.native_capabilities.query.native_tools = [{ name: 'query' }];
      });
      expect(objectTools.result.status).not.toBe(0);
      expect(`${objectTools.result.stderr}\n${objectTools.result.stdout}`).toContain('invalid_gitnexus_native_tools:invalid-entry');
      expect(fs.existsSync(objectTools.providerConfigPath)).toBe(false);

      const blankResources = runProjectionCase('blank-native-resources', (gitnexus) => {
        gitnexus.provider_config.native_capabilities.query.native_resources = [' '];
      });
      expect(blankResources.result.status).not.toBe(0);
      expect(`${blankResources.result.stderr}\n${blankResources.result.stdout}`).toContain('invalid_gitnexus_native_resources:invalid-entry');
      expect(fs.existsSync(blankResources.providerConfigPath)).toBe(false);

      const missingTools = runProjectionCase('missing-native-tools', (gitnexus) => {
        delete gitnexus.provider_config.native_capabilities.query.native_tools;
      });
      expect(missingTools.result.status).not.toBe(0);
      expect(`${missingTools.result.stderr}\n${missingTools.result.stdout}`).toContain('invalid_gitnexus_native_tools:missing-field');
      expect(fs.existsSync(missingTools.providerConfigPath)).toBe(false);

      const missingResources = runProjectionCase('missing-native-resources', (gitnexus) => {
        delete gitnexus.provider_config.native_capabilities.query.native_resources;
      });
      expect(missingResources.result.status).not.toBe(0);
      expect(`${missingResources.result.stderr}\n${missingResources.result.stdout}`).toContain('invalid_gitnexus_native_resources:missing-field');
      expect(fs.existsSync(missingResources.providerConfigPath)).toBe(false);

      const legacySurfaces = runProjectionCase('legacy-native-surfaces', (gitnexus) => {
        delete gitnexus.provider_config.native_capabilities.query.native_tools;
        gitnexus.provider_config.native_capabilities.query.native_surfaces = ['query'];
      });
      expect(legacySurfaces.result.status).not.toBe(0);
      expect(`${legacySurfaces.result.stderr}\n${legacySurfaces.result.stdout}`).toContain('invalid_gitnexus_native_surfaces:retired-field');
      expect(fs.existsSync(legacySurfaces.providerConfigPath)).toBe(false);

      const emptySurfaces = runProjectionCase('empty-native-surfaces', (gitnexus) => {
        gitnexus.provider_config.native_capabilities.query.native_tools = [];
        gitnexus.provider_config.native_capabilities.query.native_resources = [];
      });
      expect(emptySurfaces.result.status).not.toBe(0);
      expect(`${emptySurfaces.result.stderr}\n${emptySurfaces.result.stdout}`).toContain('invalid_gitnexus_native_capability:no-surfaces');
      expect(fs.existsSync(emptySurfaces.providerConfigPath)).toBe(false);

      const policyBlocked = runProjectionCase('policy-blocked-boundary', (gitnexus) => {
        gitnexus.provider_config.native_capabilities.query.mutation_boundary = 'policy-blocked';
      });
      expect(policyBlocked.result.status).toBe(0);
      const policyBlockedConfig = JSON.parse(fs.readFileSync(policyBlocked.providerConfigPath, 'utf8'));
      expect(policyBlockedConfig.providers.gitnexus.native_capabilities.query.status).toBe('mutation-gated');
      expect(policyBlockedConfig.providers.gitnexus.native_capabilities.query.mutation_boundary).toBe('policy-blocked');
      expect(policyBlockedConfig.providers.gitnexus.native_capabilities.query.limitations.join(' ')).toContain('must not run in setup or Plan');

      const invalidBoundary = runProjectionCase('invalid-mutation-boundary', (gitnexus) => {
        gitnexus.provider_config.native_capabilities.query.mutation_boundary = 'dangerous-write';
      });
      expect(invalidBoundary.result.status).not.toBe(0);
      expect(`${invalidBoundary.result.stderr}\n${invalidBoundary.result.stdout}`).toContain('invalid_gitnexus_mutation_boundary:dangerous-write');
      expect(fs.existsSync(invalidBoundary.providerConfigPath)).toBe(false);

      const missingBoundary = runProjectionCase('missing-mutation-boundary', (gitnexus) => {
        delete gitnexus.provider_config.native_capabilities.query.mutation_boundary;
      });
      expect(missingBoundary.result.status).not.toBe(0);
      expect(`${missingBoundary.result.stderr}\n${missingBoundary.result.stdout}`).toContain('invalid_gitnexus_mutation_boundary:missing-field');
      expect(fs.existsSync(missingBoundary.providerConfigPath)).toBe(false);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('PowerShell mcp-tools schema v6 gate covers host detection, setup, repair, and uninstall entrypoints', () => {
    const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'spec-ps-schema-gate-'));
    try {
      const skillCopy = path.join(tmpDir, 'spec-mcp-setup');
      const fakeHome = path.join(tmpDir, 'home');
      fs.cpSync(path.join(repoRoot, 'skills/spec-mcp-setup'), skillCopy, { recursive: true });
      fs.mkdirSync(fakeHome, { recursive: true });

      const toolsJsonPath = path.join(skillCopy, 'mcp-tools.json');
      const toolsJson = JSON.parse(fs.readFileSync(toolsJsonPath, 'utf8'));
      toolsJson.schema_version = '5';
      fs.writeFileSync(toolsJsonPath, `${JSON.stringify(toolsJson, null, 2)}\n`);

      const factsPath = path.join(tmpDir, 'facts.json');
      fs.writeFileSync(
        factsPath,
        `${JSON.stringify(
          {
            schema_version: 'v2',
            repo_status: 'not-git-repo',
            repo_root: tmpDir,
            target: { state_write_allowed: false },
          },
          null,
          2,
        )}\n`,
      );

      const cases = [
        ['detect-host', ['-File', path.join(skillCopy, 'scripts/detect-host.ps1')]],
        ['detect-tools', ['-File', path.join(skillCopy, 'scripts/detect-tools.ps1')]],
        ['configure-host', ['-File', path.join(skillCopy, 'scripts/configure-host.ps1'), '-Tool', 'context7']],
        ['repair-install', ['-File', path.join(skillCopy, 'scripts/repair-install.ps1'), '-Tool', 'context7']],
        ['uninstall-mcp', ['-File', path.join(skillCopy, 'scripts/uninstall-mcp.ps1'), '-Tool', 'context7']],
        ['install-mcp', ['-File', path.join(skillCopy, 'scripts/install-mcp.ps1'), '-Only', 'context7']],
        ['write-provider-config', ['-File', path.join(skillCopy, 'scripts/write-provider-config.ps1'), '-FactsFile', factsPath]],
      ];

      for (const [name, args] of cases) {
        const result = spawnPwsh(['-NoLogo', '-NoProfile', '-NonInteractive', ...args], {
          cwd: repoRoot,
          encoding: 'utf8',
          env: { ...process.env, HOME: fakeHome, MCP_SETUP_HOST: 'codex' },
        });
        if (!result) return;
        expect({ name, status: result.status }).not.toEqual(expect.objectContaining({ status: 0 }));
        expect(`${result.stderr}\n${result.stdout}`).toContain('invalid_mcp_tools_schema_version:5');
      }
      expect(fs.existsSync(path.join(fakeHome, '.codex', 'config.toml'))).toBe(false);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('PowerShell provider command hash uses command keys, not OrderedDictionary metadata', () => {
    const writeProviderSource = fs.readFileSync(writeProviderConfigPs1, 'utf8');
    const start = writeProviderSource.indexOf('function Get-ProviderCommandHashForCommands');
    const end = writeProviderSource.indexOf('function ConvertTo-ComparableProjectionJson');
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const functionSource = writeProviderSource.slice(start, end);
    expect(functionSource).toContain('$Commands -is [System.Collections.IDictionary]');
    expect(functionSource).toContain('$Commands.Keys | Sort-Object');
    expect(functionSource).toContain("$_.MemberType -eq 'NoteProperty'");

    const script = `
function Get-StatusHash {
  param([string]$Text)
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
    $hash = $sha.ComputeHash($bytes)
    return 'sha256:' + ([BitConverter]::ToString($hash).Replace('-', '').ToLowerInvariant())
  } finally {
    $sha.Dispose()
  }
}
${functionSource}
$commands = [ordered]@{
  bootstrap = @('npx', '-y', 'gitnexus@1.6.5', 'analyze', '--force', '--skip-agents-md', '--no-stats')
  incremental = @('npx', '-y', 'gitnexus@1.6.5', 'analyze', '--skip-agents-md', '--no-stats')
  status = @('npx', '-y', 'gitnexus@1.6.5', 'status')
  query_probe = @('npx', '-y', 'gitnexus@1.6.5', 'query', 'TradeLoginActivity', '--repo', '/repo')
}
$actual = Get-ProviderCommandHashForCommands -Commands $commands
$ordered = [ordered]@{}
foreach ($name in @($commands.Keys | Sort-Object)) {
  $ordered[[string]$name] = @($commands[$name])
}
$canonicalJson = $ordered | ConvertTo-Json -Depth 20 -Compress
$expected = Get-StatusHash -Text $canonicalJson
$expectedWithTrailingLf = Get-StatusHash -Text ($canonicalJson + [string][char]10)
if ($actual -ne $expected) {
  Write-Error "hash mismatch: $actual != $expected"
}
if ($actual -eq $expectedWithTrailingLf) {
  Write-Error "hash unexpectedly includes trailing LF"
}
if (($ordered.Keys -join ',') -ne 'bootstrap,incremental,query_probe,status') {
  Write-Error "unexpected command keys: $($ordered.Keys -join ',')"
}
if (($commands.PSObject.Properties.Name | Sort-Object) -contains 'Count') {
  Write-Output 'metadata-present'
}
`;
    const result = spawnPwsh(['-NoLogo', '-NoProfile', '-Command', script], {
      cwd: repoRoot,
      encoding: 'utf8',
    });
    if (!result) return;
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('metadata-present');
  });

  test('graph bootstrap PowerShell exposes compiler contract and command safety', () => {
    const source = fs.readFileSync(bootstrapProvidersPs1, 'utf8');

    expect(source).toContain('runtime-capabilities.v1');
    expect(source).toContain('provider-artifacts.v1');
    expect(source).toContain('graph-providers.v1');
    expect(source).toContain('host_ledger_pointer');
    expect(source).toContain('readiness-conflict');
    expect(source).toContain('function Test-ProviderArtifactContractSupported');
    expect(source).toContain('provider artifact path contract drifted');
    expect(source).toContain('unsupported-provider-command');
    expect(source).toContain('query-unverified');
    expect(source).toContain('degraded-fallback');
    expect(source).toContain('graph-facts.v1');
    expect(source).toContain("HEAD^{commit}");
    expect(source).toContain('repo-snapshot-unavailable');
    expect(source).toContain('bootstrap-impact-capabilities.v1');
    expect(source).toContain('.spec-first/providers/$provider/raw/');
    expect(source).toContain("'analyze.log'");
    expect(source).toContain("'build.log'");
    expect(source).toContain('function Test-CommandShapeSupported');
    expect(source).toContain('[switch]$AllRepos');
    expect(source).toContain('workspace-graph-bootstrap-summary.v1');
    expect(source).toContain('all-repos-requires-parent-workspace');
    expect(source).toContain('all-repos-conflicts-with-repo');
    expect(source).toContain('all-repos-degraded-fallback');
    expect(source).toContain('workspace-default-all-repos');
    expect(source).toContain('explicit-all-repos');
    expect(source).toContain('graph-bootstrap-summary.json');
    expect(source).toContain('parent_writes_repo_local_artifacts');
    expect(source).toContain('parent_writes_host_instruction_files');
    expect(source).toContain('parent_host_instruction_normalization');
    expect(source).toContain('all-repos-gitnexus-provider-not-bootstrapped');
    expect(source).toContain('Normalize-GitNexusInstructionBlockViaCli -RepoRoot ([string]$TargetFacts.workspace_root)');
    expect(source).toContain('run_id = $runId');
    expect(source).toContain('parent_run_id = $runId');
    expect(source).toContain('all-repos child $childIndex');
    expect(source).toContain('function Invoke-ChildJsonScript');
    expect(source).toContain('function Resolve-ChildPowerShellExecutable');
    expect(source).toContain('$currentCommandName = if ($currentEdition -eq \'Core\') { \'pwsh\' } else { \'powershell\' }');
    expect(source).toContain('Get-Command powershell -ErrorAction SilentlyContinue');
    expect(source).toContain("@('-NoProfile', '-File', $ScriptPath)");
    expect(source).toContain('$stdout = @(& $powerShellExe @childArgs 2> $stderrPath 6> $informationPath)');
    expect(source).toContain('2> $stderrPath 6> $informationPath');
    expect(source).not.toContain('$stdout = @(& $ScriptPath @Arguments 2> $stderrPath 6> $informationPath)');
    expect(source).not.toContain('$script:BootstrapProvidersScript -Repo ([string]$child.workspace_relative_path) 2>&1');
    expect(source).toContain("'^gitnexus(@[A-Za-z0-9._~+:-]+)?$'");
    expect(source).not.toContain("'^code-review-graph@[0-9][0-9A-Za-z._+!-]*$'");
    expect(source).not.toContain("'--upgrade'");
    expect(source).toContain('function Write-NormalizedArtifacts');
    expect(source).toContain('provider-normalized-envelope.v1');
    expect(source).toContain("command_source = '.spec-first/config/graph-providers.json'");
    expect(source).toContain('fallback_support');
    expect(source).toContain('primary_providers');
    expect(source).toContain('skipped_primary_providers');
    expect(source).toContain('disabled-for-bootstrap');
    expect(source).toContain('function Test-GitNexusQueryProbeVerified');
    expect(source).toContain('function Get-GitNexusQueryProbeCandidates');
    expect(source).toContain('function Get-GitNexusQueryProbeCandidateCount');
    expect(source).toContain('function Test-GitNexusQueryProbeExpectedHit');
    expect(source).toContain('function Invoke-GitNexusQueryProbeCandidate');
    expect(source).toContain('function Get-GitNexusRepoLabelMismatchFailureInfo');
    expect(source).toContain('gitnexus-repo-label-mismatch');
    expect(source).toContain('provider-projection-stale');
    expect(source).toContain('function Get-UtcTimestamp');
    expect(source).toContain('function Get-EpochMilliseconds');
    expect(source).toContain('duration_ms');
    expect(source).toContain('function ConvertTo-CanonicalJsonValue');
    expect(source).toContain('function ConvertFrom-JsonWithoutDateCoercion');
    expect(source).toContain("ConvertFrom-Json -DateKind String");
    expect(source).toContain("$Value -is [DateTime]");
    expect(source).toContain("$Value -is [DateTimeOffset]");
    expect(source).toContain("$_.MemberType -eq 'NoteProperty'");
    expect(source).not.toContain("_.MemberType -eq 'Property'");
    expect(source).toContain('ConvertTo-Json -Depth 100 -Compress');
    expect(source).toContain('function Get-BootstrapFingerprint');
    expect(source).toContain('graph-bootstrap-fingerprint.v1');
    expect(source).toContain('bootstrap_fingerprint = $bootstrapFingerprint');
    expect(source).toContain('function Get-ProviderReuseDecision');
    expect(source).not.toContain('function Get-BundledCodeReviewGraphPackageSpec');
    expect(source).toContain('function Get-ProviderCommandPackageSpec');
    expect(source).toContain("mixed-provider-command-packages:$($packages -join ',')");
    expect(source).toContain("ConvertTo-CanonicalJsonValue -Value $ProviderConfig.providers.$Provider.commands");
    expect(source).toContain('reuse_eligible');
    expect(source).toContain('reuse_ineligible_reason');
    expect(source).toContain('readiness_source');
    expect(source).toContain('function Get-GitNexusProviderProjectionStaleFailureInfo');
    expect(source).not.toContain('function Get-CodeReviewGraphProviderProjectionStaleFailureInfo');
    expect(source).not.toContain('function Get-CodeReviewGraphProviderVersionUnverifiableFailureInfo');
    expect(source).toContain('function Get-ProviderProjectionStaleFailureInfo');
    expect(source).toContain('function Get-ProviderDisplayName');
    expect(source).toContain('gitnexus-provider-projection-stale');
    expect(source).not.toContain('code-review-graph-provider-projection-stale');
    expect(source).not.toContain('code-review-graph-provider-version-unverifiable');
    expect(source).toContain('provider-version-unverifiable');
    expect(source).toContain('stale-provider-projection');
    expect(source).toContain('preflight-blocked');
    expect(source).toContain('version_policy = $VersionPolicy');
    expect(source).toContain('function Test-QueryProbePolicySupported');
    expect(source).toContain('GitNexusQueryProbeCandidateLimit = 5');
    expect(source).toContain('Cannot execute write operations in a read-only database');
    expect(source).toContain('missing[ -]index');
    expect(source).toContain("'analyze' -and");
    expect(source).toContain("'--force'");
    expect(source).toContain('BM25/process query results');
    expect(source).toContain('definitions-only evidence');
    expect(source).toContain('query_verification_reason');
    expect(source).toContain('query_probe_attempts');
    expect(source).toContain('query_probe_candidate_limit');
    expect(source).toContain('query_probe_candidates_truncated');
    expect(source).toContain('impact_probe');
    expect(source).toContain('Test-GitNexusImpactProbeHasRelatedTests');
    expect(source).toContain('related-tests-supported');
    expect(source).toContain('related-tests-unproven');
    expect(source).toContain('$gitNexusRelatedTestsSupported');
    expect(source).toContain("impact_context_status = if ($gitNexusReady -and $gitNexusRelatedTestsSupported");
    expect(source).toContain("$queryOnlyGitNexusReady = ($targetKind -eq 'non-git-folder' -or $gitNexusDefinitionsOnlyReady)");
    expect(source).toContain("related_tests_status = if ($queryOnlyGitNexusReady) { 'unavailable' } elseif ($gitNexusRelatedTestsSupported) { 'supported' } elseif ($gitNexusReady) { 'candidate-only' } else { 'unavailable' }");
    expect(source).toContain('query-not-applicable');
    expect(source).toContain('not_applicable');
    expect(source).toContain('winning_query_probe_log');
    expect(source).toContain('query-');
    expect(source).toContain('query_global_graph');
    expect(source).toContain('impact_context');
    expect(source).toContain('System.Collections.Generic.List[psobject]');
    expect(source).not.toContain('System.Collections.Generic.List[object]');
    expect(source).toContain('staleness_hints');
    expect(source).toContain("compare_source_revision = ($targetKind -ne 'non-git-folder')");
    expect(source).toContain('function Get-StatusHash');
    expect(source).toContain("worktree_status_hash = if ($targetKind -eq 'non-git-folder') { $null } else { $worktreeStatusHash }");
    expect(source).toContain('Probe Token');
    expect(source).toContain('function Get-ProviderFailureInfo');
    expect(source).toContain('function Invoke-SpecFirstCli');
    expect(source).toContain('function Invoke-SpecFirstCliCaptured');
    expect(source).toContain('function Resolve-SpecFirstCliInvocation');
    expect(source).toContain('function Normalize-GitNexusInstructionBlockViaCli');
    expect(source).toContain('gitnexus-instruction');
    expect(source).toContain("'--json'");
    expect(source).toContain('host_instruction_normalization');
    expect(source).toContain('advisory = $true');
    expect(source).toContain('gitnexus-instruction-normalizer-failed');
    expect(source).toContain('gitnexus-instruction-normalizer-timeout');
    expect(source).toContain('Invoke-ExternalCommandWithTimeout -Exe $exe');
    expect(source).toContain('timed_out = [bool]$result.timed_out');
    expect(source).toContain("$overallStatus -eq 'partial'");
    expect(source).toContain("if ($provider -eq 'gitnexus' -and $bootstrap.exit_code -eq 0 -and $targetKind -ne 'non-git-folder')");
    const resolveStart = source.indexOf('function Resolve-SpecFirstCliInvocation');
    const resolveEnd = source.indexOf('function Normalize-GitNexusInstructionBlockViaCli');
    const resolveSource = source.slice(resolveStart, resolveEnd);
    expect(resolveSource.indexOf('Test-Path -LiteralPath $sourceCli')).toBeGreaterThanOrEqual(0);
    expect(resolveSource.indexOf('Get-Command spec-first')).toBeGreaterThanOrEqual(0);
    expect(resolveSource.indexOf('Test-Path -LiteralPath $sourceCli')).toBeLessThan(resolveSource.indexOf('Get-Command spec-first'));
    expect(source).toContain('gitnexus-analyze-sigsegv');
    expect(source).toContain('gitnexus-analyze-storage-write-failed');
    expect(source).toContain('provider-storage-write-failed');
    expect(source).toContain('Cannot open file');
    expect(source).toContain('.gitnexus/lbug');
    expect(source).toContain('provider-network-unavailable');
    expect(source).toContain('provider-cache-permission-denied');
    expect(source).not.toContain('provider-package-not-found');
    expect(source).not.toContain('provider-package-resolution-failed');
    expect(source).not.toContain('Unset UV_INDEX_URL/PIP_INDEX_URL');
    expect(source).toContain('ProviderCommandTimeoutSeconds');
    expect(source).toContain("Name 'SPEC_FIRST_PROVIDER_COMMAND_TIMEOUT_SECONDS'");
    expect(source).toContain("Get-NonNegativeIntEnv -Name 'SPEC_FIRST_STAGE_TIMEOUT_SECONDS' -Default 900");
    expect(source).toContain('function Invoke-ExternalCommandWithTimeout');
    expect(source).toContain('provider-command-timeout');
    expect(source).toContain('provider-timeout');
    expect(source).toContain('Provider package registry or network resolution failed');
    expect(source).toContain('dependencies may download on first use');
    expect(source).toContain('graph_ready = $graphReady');
    expect(source).toContain('function Write-JsonFileAtomic');
    expect(source).toContain('Move-Item -Force -LiteralPath');
    expect(source).toContain('Set-Content -Encoding utf8 -LiteralPath');
    expect(source).toContain('function Ensure-Directory');
    expect(source).toContain('[System.IO.Directory]::CreateDirectory($entry)');
    const atomicWriteStart = source.indexOf('function Write-TextFileAtomic');
    const atomicWriteEnd = source.indexOf('function Invoke-SpecFirstCli');
    expect(atomicWriteStart).toBeGreaterThanOrEqual(0);
    expect(atomicWriteEnd).toBeGreaterThan(atomicWriteStart);
    const atomicWriteSource = source.slice(atomicWriteStart, atomicWriteEnd);
    expect(atomicWriteSource).not.toContain('New-Item -ItemType Directory -Force -LiteralPath');
    expect(source).not.toContain('Move-Item -Force -Path');
    expect(source).not.toContain('Set-Content -Encoding utf8 -Path');
    expect(source).toContain('Invoke-ExternalCommandWithTimeout -Exe $exe');
    expect(source).not.toContain('Invoke-Expression');
    expect(source).not.toContain('bash -c');
    expect(source).not.toContain('sh -c');
  });

  test('graph bootstrap PowerShell resolves Windows command shims before CreateProcess', () => {
    const source = fs.readFileSync(bootstrapProvidersPs1, 'utf8');

    expect(source).toContain('function Resolve-ProcessExecutable');
    expect(source).toContain('Get-Command $Exe -All -ErrorAction SilentlyContinue');
    expect(source).toContain("$_.CommandType -eq 'Application'");
    expect(source).toContain("$_.CommandType -eq 'ExternalScript'");
    expect(source).toContain('function Test-WindowsHost');
    expect(source).toContain('$isWindowsVariable = Get-Variable -Name IsWindows -ValueOnly -ErrorAction SilentlyContinue');
    expect(source).toContain('return ([bool]$isWindowsVariable -or [System.Environment]::OSVersion.Platform -eq [System.PlatformID]::Win32NT)');
    expect(source).toContain('if ((Test-WindowsHost) -and [System.IO.Path]::GetExtension($scriptPath)');
    expect(source).toContain(".Equals('.ps1', [System.StringComparison]::OrdinalIgnoreCase)");
    expect(source).toContain("foreach ($extension in @('.cmd', '.exe', '.bat', '.com'))");
    expect(source).toContain('$resolvedExe = Resolve-ProcessExecutable -Exe $Exe');
    expect(source).toContain('$processInfo.FileName = $resolvedExe');
    expect(source).not.toContain('$processInfo.FileName = $Exe');
  });

  test('graph bootstrap PowerShell keeps raw log paths repo-relative across platforms', () => {
    const source = fs.readFileSync(bootstrapProvidersPs1, 'utf8');

    expect(source).toContain('function ConvertTo-RepoRelativePath');
    expect(source).toContain("[System.IO.Path]::GetFullPath($Path).Replace('\\', '/')");
    expect(source).toContain("[System.IO.Path]::GetFullPath($RepoRoot).Replace('\\', '/').TrimEnd('/')");
    expect(source).toContain('$comparison = if (Test-WindowsHost) { [System.StringComparison]::OrdinalIgnoreCase } else { [System.StringComparison]::Ordinal }');
    expect(source).toContain('return $normalizedPath.Substring($prefix.Length)');
    expect(source).toContain('raw_log = ConvertTo-RepoRelativePath -Path $LogPath -RepoRoot $RepoRoot');
    expect(source).not.toContain('raw_log = $LogPath.Replace("$RepoRoot/", \'\')');
  });

  test('graph bootstrap PowerShell precomputes normalized artifact fields', () => {
    const source = fs.readFileSync(bootstrapProvidersPs1, 'utf8');
    const normalizedStart = source.indexOf('function Write-NormalizedArtifacts');
    const fallbackStart = source.indexOf('function Get-FallbackCapability');
    const normalizedSource = source.slice(normalizedStart, fallbackStart);

    expect(normalizedSource).toContain('$winningQueryProbeLog = if ($winningLogs.Count -gt 0)');
    expect(normalizedSource).toContain("$availableQuerySurfaces = if ($QueryReady) { @('status', 'query') } else { @() }");
    expect(normalizedSource).toContain('$isQueryOnlyTarget = ($isNonGitFolder -or $definitionsOnlyEvidence)');
    expect(normalizedSource).toContain("$impactSurfaces = if ($QueryReady -and $isQueryOnlyTarget) { @('query', 'context') } elseif ($QueryReady) { @('query', 'context', 'impact', 'detect_changes', 'route_map', 'api_impact', 'shape_check') } else { @() }");
    expect(normalizedSource).toContain("$impactEvidenceSurfaces = if ($QueryReady -and -not $isQueryOnlyTarget) { @('detect_changes', 'impact', 'query', 'route_map', 'api_impact', 'shape_check') } else { @() }");
    expect(normalizedSource).not.toMatch(/^\s+winning_query_probe_log = if \(/m);
    expect(normalizedSource).not.toMatch(/^\s+available_query_surfaces = if \(/m);
    expect(normalizedSource).not.toMatch(/^\s+confidence = if \(/m);
    expect(normalizedSource).not.toMatch(/^\s+limitations = if \(/m);
  });

  test('PowerShell workspace graph target resolver exposes advisory multi-repo contract', () => {
    const source = fs.readFileSync(resolveWorkspaceGraphTargetsPs1, 'utf8');

    expect(source).toContain('workspace-graph-targets.v1');
    expect(source).toContain('resolve-project-target.ps1');
    expect(source).toContain('git_root_topology');
    expect(source).toContain("'single-repo'");
    expect(source).toContain("'multi-repo-workspace'");
    expect(source).toContain('refresh_eligibility');
    expect(source).toContain('index_snapshot');
    expect(source).toContain('query_usability');
    expect(source).toContain('working_tree_overlay');
    expect(source).toContain('query_usability_counts');
    expect(source).toContain("'fresh-primary'");
    expect(source).toContain("'stale-advisory'");
    expect(source).toContain("'definitions-pointer'");
    expect(source).toContain('last_indexed_commit');
    expect(source).toContain('graph-providers.v1');
    expect(source).toContain('runtime-capabilities.v1');
    expect(source).toContain('provider-artifacts.v1');
    expect(source).toContain('graph-facts.json');
    expect(source).toContain('bootstrap-impact-capabilities.json');
    expect(source).toContain('provider-status.json');
    expect(source).toContain('dirty-uncertain');
    expect(source).toContain('worktree_status_hash');
    expect(source).toContain('setup-ready-bootstrap-required');
    expect(source).toContain('parent_writes_repo_local_artifacts');
    expect(source).toContain('.spec-first/workspace');
    expect(source).toContain('graph-targets.json');
    expect(source).toContain('[System.IO.Directory]::CreateDirectory($workspaceDir)');
    expect(source).toContain("$summaryPath.$([guid]::NewGuid().ToString('N')).tmp");
    expect(source).toContain('Move-Item -Force -LiteralPath $tmpPath -Destination $summaryPath');
    expect(source).toContain('workspace-summary-symlink-escape');
    expect(source).toContain('workspace-graph-targets-no-source');
    expect(source).toContain('No code-bearing graph target is available');
    expect(source).toContain('GitNexus-first');
    expect(source).toContain("$legacyToken = Get-PropertyValue -Object $queryProbePolicy -Name 'token' -Default ''");
    expect(source).toContain("Get-PropertyValue -Object $queryProbePolicy -Name 'source' -Default 'legacy-token'");
  });

  test('helper verify-only is marker-based and does not install browser runtime', () => {
    const installHelpersSource = fs.readFileSync(installHelpersPs1, 'utf8');
    const verifySource = fs.readFileSync(verifyToolsPs1, 'utf8');

    expect(installHelpersSource).toContain('.agent-browser/spec-first-install.json');
    expect(installHelpersSource).toContain('baseline_blocking');
    expect(installHelpersSource).toContain("$agentBrowserStatus = 'degraded'");
    expect(installHelpersSource).toContain("$agentBrowserStatus = 'skipped'");
    expect(installHelpersSource).toContain('$agentBrowserBaselineBlocking = $false');
    expect(installHelpersSource).toContain('SPEC_FIRST_BROWSER_HELPER_REQUIRED');
    expect(installHelpersSource).toContain('browser_capability_demand_signals');
    expect(installHelpersSource).toContain('AGENT_BROWSER_EXECUTABLE_PATH');
    expect(verifySource).toContain('baseline_blocking');
    expect(verifySource).toContain("$nonBlockingResult = (-not $baselineBlocking) -and @('degraded', 'skipped') -contains $property.Value.result");
    expect(verifySource).toContain("$property.Value.result -ne 'ready' -and -not $nonBlockingResult");
    expect(installHelpersSource).toContain('Write-AgentBrowserInstallMarker');
    expect(installHelpersSource).toContain('agent-browser install');
    expect(installHelpersSource).toContain('agent-browser install --with-deps');
    expect(installHelpersSource).toContain('Invoke-NpmGlobalInstallWithOptionalSudo');
    expect(installHelpersSource).toContain("function Get-AgentBrowserInstallCommand");
    expect(installHelpersSource).toContain("$env:CI=''true''; npm install -g agent-browser@latest");
    expect(installHelpersSource).toContain('if ($LASTEXITCODE -eq 0) { ');
    expect(installHelpersSource).not.toContain("return 'CI=true npm install -g agent-browser@latest");
    expect(installHelpersSource).toContain('sudo -n');
    expect(installHelpersSource).toContain('NPM_CONFIG_REGISTRY');
    expect(installHelpersSource).toContain('npm_config_registry');
    expect(installHelpersSource).not.toContain('npm_config_registry = $value');
    expect(installHelpersSource).toContain("'gh', 'jq', 'vhs', 'silicon', 'ffmpeg', 'ast-grep'");
    expect(installHelpersSource).toContain("$demoOnlyHelpers = @('vhs', 'silicon', 'ffmpeg')");
    expect(installHelpersSource).toContain('$isDemoOnly = $demoOnlyHelpers -contains $helper');
    expect(installHelpersSource).toContain('$baselineBlocking = -not $isDemoOnly');
    expect(installHelpersSource).toContain("optional helper for feature-video skill");
    const installHelpersShSource = fs.readFileSync(installHelpersSh, 'utf8');
    expect(installHelpersShSource).toContain('vhs|silicon|ffmpeg) process_cli_helper "$helper" "$OS" "false"');
    expect(installHelpersShSource).toContain('local baseline_blocking="${3:-true}"');
    expect(installHelpersShSource).toContain('SPEC_FIRST_BROWSER_HELPER_REQUIRED');
    expect(installHelpersShSource).toContain('browser_capability_demand_signals');
    expect(installHelpersShSource).toContain('optional helper for feature-video skill');
    expect(installHelpersSource).toContain('npx -y skills@latest add ast-grep/agent-skill -g -y');
    expect(installHelpersSource).toContain("'ast-grep-skill'");
    expect(installHelpersSource).toContain('$hasIsWindows = $null -ne (Get-Variable -Name IsWindows -ErrorAction SilentlyContinue)');
    expect(installHelpersSource).not.toContain('Get-Variable -Name IsWindows -ValueOnly');
    expect(installHelpersSource).toContain('winget upgrade --id $PackageId -e --silent --accept-package-agreements --accept-source-agreements');
    expect(installHelpersSource).toContain('winget install --id $PackageId -e --silent --accept-package-agreements --accept-source-agreements');
    expect(installHelpersSource).toContain("Get-WingetLatestInstallCommand -PackageId 'GitHub.cli'");
    expect(installHelpersSource).toContain("Get-WingetLatestInstallCommand -PackageId 'jqlang.jq'");
    expect(installHelpersSource).toContain("Get-WingetLatestInstallCommand -PackageId 'Gyan.FFmpeg'");
    expect(installHelpersSource).toContain("Test-CommandExists 'dnf'");
    expect(installHelpersSource).toContain("Test-CommandExists 'pacman'");
    expect(installHelpersSource).toContain("Test-CommandExists 'apk'");
    expect(installHelpersSource).toContain("sudo pacman -Syu --needed $PacmanPackage");
    expect(installHelpersSource).toContain("'pacman' @('-Syu', '--needed', '--noconfirm', $PacmanPackage)");
    expect(installHelpersSource).not.toContain("sudo pacman -Sy --noconfirm $PacmanPackage");
    expect(installHelpersSource).not.toContain("'pacman' @('-Sy', '--noconfirm', $PacmanPackage)");
    expect(installHelpersSource).toContain('Install gh from https://cli.github.com');
    expect(installHelpersSource).toContain('npm install -g @ast-grep/cli@latest');
    expect(installHelpersSource).toContain("Test-GlobalSkill 'agent-browser'");
    expect(installHelpersSource).toContain(".codex/skills/$Name/SKILL.md");
    expect(installHelpersShSource).toContain('$HOME/.codex/skills/$skill_name/SKILL.md');
    expect(installHelpersSource).toContain("$agentBrowserNextAction = 'agent-browser CLI not found after npm install'");
    expect(installHelpersSource).toContain("$agentBrowserStatus = 'ready'\n        $agentBrowserNextAction = ''");
    expect(installHelpersSource).toContain('Start-ParallelCommandTask');
    expect(installHelpersSource).toContain('Wait-ParallelCommandTasks');
    expect(installHelpersSource).toContain('Wait-Job -Job $entry.Value.job -Timeout $TimeoutSeconds');
    expect(installHelpersSource).toContain('Stop-Job -Job $entry.Value.job -Force');
    expect(installHelpersSource).not.toContain('agent-browser doctor');
    expect(installHelpersSource).not.toContain('doctor --fix');
    expect(installHelpersSource).toContain("$mode -eq 'verify-only' -and $agentBrowserDependencyStatus -eq 'ready' -and $agentBrowserSkillStatus -eq 'action-required'");
  });

  test('helper install paths fall back to Chinese mirrors when official source fails', () => {
    const installHelpersSource = fs.readFileSync(installHelpersPs1, 'utf8');
    const installHelpersShSource = fs.readFileSync(installHelpersSh, 'utf8');

    expect(installHelpersSource).toContain("npm    = 'https://registry.npmmirror.com'");
    expect(installHelpersSource).toContain("uv     = 'https://mirrors.tuna.tsinghua.edu.cn/pypi/simple'");
    expect(installHelpersSource).toContain("chrome = 'https://npmmirror.com/mirrors/chrome-for-testing'");
    expect(installHelpersSource).toContain('function Invoke-WithMirrorFallback');
    expect(installHelpersSource).toContain('function Get-NpmMirrorEnv');
    expect(installHelpersSource).toContain("$script:LastInstallProvenance = [ordered]@{ install_source = 'mirror'; mirror_used = $true }");
    expect(installHelpersSource).toContain("$script:LastInstallProvenance = [ordered]@{ install_source = 'both-failed'; mirror_used = $true }");
    expect(installHelpersSource).toContain('--fetch-timeout=30000 --fetch-retries=1');
    expect(installHelpersSource).toContain('Invoke-WithMirrorFallback -Action $action -MirrorEnv (Get-NpmMirrorEnv)');
    expect(installHelpersSource).toContain('Invoke-WithMirrorFallback -Action { Invoke-HelperCommand { npx -y skills@latest add ast-grep/agent-skill -g -y } } -MirrorEnv (Get-NpmMirrorEnv)');
    expect(installHelpersSource).toContain('install_source = $InstallSource');
    expect(installHelpersSource).toContain('mirror_used = [bool]$MirrorUsed');
    expect(installHelpersSource).toContain('mirror_endpoints = $script:MirrorEndpoints');
    expect(installHelpersSource).toContain('recommended_environment_variables = [ordered]@{');
    expect(installHelpersSource).toContain("Get-NonNegativeIntEnv -Name 'SPEC_FIRST_STAGE_TIMEOUT_SECONDS' -Default 900");

    expect(installHelpersShSource).toContain('NPM_MIRROR_ENDPOINT="https://registry.npmmirror.com"');
    expect(installHelpersShSource).toContain('UV_MIRROR_ENDPOINT="https://mirrors.tuna.tsinghua.edu.cn/pypi/simple"');
    expect(installHelpersShSource).toContain('CHROME_MIRROR_ENDPOINT="https://npmmirror.com/mirrors/chrome-for-testing"');
    expect(installHelpersShSource).toContain('run_with_mirror_fallback()');
    expect(installHelpersShSource).toContain('npm_mirror_env_pairs()');
    expect(installHelpersShSource).toContain('LAST_INSTALL_SOURCE="mirror"');
    expect(installHelpersShSource).toContain('LAST_INSTALL_SOURCE="both-failed"');
    expect(installHelpersShSource).toContain('--fetch-timeout=30000 --fetch-retries=1');
    expect(installHelpersShSource).toContain('run_with_mirror_fallback "${mirror_pairs[@]}" -- run_npm_global_install_attempt "$@"');
    expect(installHelpersShSource).toContain('run_with_mirror_fallback "${mirror_pairs[@]}" -- npx -y skills@latest add ast-grep/agent-skill -g -y');
    expect(installHelpersShSource).toContain('install_source: $install_source');
    expect(installHelpersShSource).toContain('mirror_used: $mirror_used');
    expect(installHelpersShSource).toContain('LAST_INSTALL_PROVENANCE_FILE');
    expect(installHelpersShSource).toContain('recommended_environment_variables: {');
  });

  test('PowerShell dependency and repair paths are Windows-safe', () => {
    const checkDepsSource = fs.readFileSync(checkDepsPs1, 'utf8');
    const repairSource = fs.readFileSync(repairInstallPs1, 'utf8');

    expect(checkDepsSource).toContain('^(uv|uvx):windows$');
    expect(checkDepsSource).toContain('Get-LinuxPackageInstallCommand');
    expect(checkDepsSource).toContain("Get-Variable -Name IsWindows -ValueOnly -ErrorAction SilentlyContinue");
	    expect(checkDepsSource).toContain("if ((Get-Content -LiteralPath '/proc/version' -Raw) -match 'microsoft') { return 'wsl' }");
	    expect(checkDepsSource).toContain("Test-CommandExists 'dnf'");
	    expect(checkDepsSource).toContain("sudo pacman -Syu --needed $PacmanPackage");
	    expect(checkDepsSource).not.toContain("sudo pacman -Sy --noconfirm $PacmanPackage");
    expect(checkDepsSource).toContain("Get-LinuxPackageInstallCommand -AptPackage 'nodejs' -DnfPackage 'nodejs' -YumPackage 'nodejs' -PacmanPackage 'nodejs' -ApkPackage 'nodejs'");
    expect(checkDepsSource).toContain("Get-LinuxPackageInstallCommand -AptPackage 'npm' -DnfPackage 'npm' -YumPackage 'npm' -PacmanPackage 'npm' -ApkPackage 'npm'");
    expect(checkDepsSource).toContain("sudo apk update && sudo apk add --upgrade $ApkPackage");
    expect(checkDepsSource).not.toContain("python3 = New-DependencyFact 'python3' $true $os");
    expect(checkDepsSource).not.toContain("jq = New-DependencyFact 'jq' $true $os");
    expect(checkDepsSource).toContain('Invoke-WebRequest -Uri https://astral.sh/uv/install.ps1 -OutFile $script');
    expect(checkDepsSource).toContain('Invoke-WebRequest -Uri https://astral.sh/uv/install.sh -OutFile $script');
    expect(checkDepsSource).toContain('Join-Path ([System.IO.Path]::GetTempPath())');
    expect(checkDepsSource).toContain('Write-Output "Review $script, then run:');
    expect(checkDepsSource).not.toContain('install.ps1 | iex');
    expect(checkDepsSource).not.toContain('curl -LsSf https://astral.sh/uv/install.sh | sh');
    expect(checkDepsSource).not.toContain('tmp=$(mktemp)');
    expect(checkDepsSource).not.toContain('less "$tmp"');
    expect(checkDepsSource).not.toContain('notepad $script');
    expect(repairSource).toContain("& (Join-Path $ScriptDir 'configure-host.ps1') -Tool $Tool");
    expect(repairSource).not.toContain('| Out-Null');
  });

  test('setup skill documents host-specific pipeline dependencies', () => {
    const skillSource = fs.readFileSync(path.join(repoRoot, 'skills/spec-mcp-setup/SKILL.md'), 'utf8');

    expect(skillSource).toContain('Unix shell path (`*.sh`) requires `node`, `npm`, `npx`, `uv`, `uvx`, `jq`, and `python3`.');
    expect(skillSource).toContain('Windows PowerShell 7 path (`*.ps1`) requires `node`, `npm`, and `npx`; `git` remains optional.');
    expect(skillSource).toContain('It does not require `jq` or `python3` because JSON/TOML handling and bounded process execution are implemented with native PowerShell/.NET');
    expect(skillSource).toContain('`uv` / `uvx` are not required by the current GitNexus-only setup registry.');
  });

  test('setup scripts no longer carry project bootstrap cache facts for retired MCP tools', () => {
    const detectSource = fs.readFileSync(detectToolsPs1, 'utf8');

    expect(detectSource).not.toContain('Se' + 'rena');
    expect(detectSource).not.toContain('se' + 'rena');
  });

  test('Unix setup timeouts terminate child process groups', () => {
    const installMcpSource = fs.readFileSync(installMcpSh, 'utf8');
    const installHelpersSource = fs.readFileSync(installHelpersSh, 'utf8');

    for (const source of [installMcpSource, installHelpersSource]) {
      expect(source).toContain('start_new_session=True');
      expect(source).toContain('def terminate_process_tree(process):');
      expect(source).toContain('os.killpg(process.pid, signal.SIGTERM)');
      expect(source).toContain('os.killpg(process.pid, signal.SIGKILL)');
    }
  });

  test('PowerShell install-mcp keeps warmup timeout and all-repos behavior without project bootstrap flags', () => {
    const installMcpSource = fs.readFileSync(installMcpPs1, 'utf8');

    expect(installMcpSource).toContain("Get-NonNegativeIntEnv -Name 'SPEC_FIRST_STAGE_TIMEOUT_SECONDS' -Default 900");
    expect(installMcpSource).toContain("Get-NonNegativeIntEnv -Name 'SPEC_FIRST_WARMUP_LATEST_TTL_SECONDS' -Default 86400");
    expect(installMcpSource).toContain('$processInfo.UseShellExecute = $false');
    expect(installMcpSource).toContain('$process.WaitForExit($script:StageTimeoutSeconds * 1000)');
    expect(installMcpSource).toContain('$process.Kill($true)');
    expect(installMcpSource).toContain('timed out after $($script:StageTimeoutSeconds)s');
    expect(installMcpSource).toContain("@('/d', '/c', $command) + @($args)");
    expect(installMcpSource).toContain('Write-WorkspaceMcpSetupSummaryAndExit');
    expect(installMcpSource).not.toContain('Se' + 'rena');
    expect(installMcpSource).not.toContain('se' + 'rena');
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

  test('PowerShell check-health provides native Win64 preflight instead of requiring Git Bash or WSL', () => {
    const skill = fs.readFileSync(mcpSetupSkillPath, 'utf8');
    const source = fs.readFileSync(checkHealthPs1, 'utf8');

    expect(skill).toContain('pwsh -File skills/spec-mcp-setup/scripts/check-health.ps1');
    expect(skill).toContain('prefer the native PowerShell script');
    expect(skill).toContain('do not replace Win64-native PowerShell validation');
    expect(skill).not.toContain('On Windows, run `check-health` from Git Bash or WSL');
    expect(source).toContain("schema_version = 'spec-mcp-setup-preflight.v2'");
    expect(source).toContain("if ($Json)");
    expect(source).toContain("dependency_ready = (Test-CommandExists 'agent-browser')");
    expect(source).toContain('$effectiveDependencyReady');
    expect(source).toContain("id = 'jq'; required = $false");
    expect(source).toContain("Test-Path -LiteralPath");
    expect(source).not.toContain('Invoke-Expression');
    expect(source).not.toContain('bash -c');
  });

  test('PowerShell check-health JSON is parseable under pwsh', () => {
    const result = spawnPwsh(['-NoLogo', '-NoProfile', '-NonInteractive', '-File', checkHealthPs1, '-Json'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });
    if (!result) return;

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    const payload = JSON.parse(result.stdout);
    expect(payload.schema_version).toBe('spec-mcp-setup-preflight.v2');
    expect(Array.isArray(payload.tools)).toBe(true);
    expect(Array.isArray(payload.skills)).toBe(true);
    expect(payload.project).toHaveProperty('inside_git_repo');
    expect(payload.legacy).toHaveProperty('compound_engineering_markdown_status');
    expect(payload.tools.find((tool) => tool.id === 'jq')).toMatchObject({
      required: false,
      host_config_status: 'not-applicable',
    });
    const agentBrowser = payload.tools.find((tool) => tool.id === 'agent-browser');
    if (agentBrowser.dependency_status === 'ready' && agentBrowser.result === 'skipped') {
      expect(agentBrowser.next_action).toContain('SPEC_FIRST_BROWSER_HELPER_REQUIRED=1');
    }
  });

  test('setup skill runs bounded setup autonomously after explicit invocation', () => {
    const skill = fs.readFileSync(mcpSetupSkillPath, 'utf8');
    const installHelpersSource = fs.readFileSync(installHelpersSh, 'utf8');

    expect(skill).toContain('## Autonomy And Permissions');
    expect(skill).toContain('authorization to complete the required setup workflow without intermediate confirmation prompts');
    expect(skill).toContain('Do not stop to ask before running deterministic, bounded setup actions');
    expect(skill).toContain('creating or refreshing `.spec-first/config.local.example.yaml`');
    expect(skill).toContain('creating `.spec-first/config.local.yaml` only when it does not already exist');
    expect(skill).toContain('If a setup command fails because the host sandbox or OS denies permission');
    expect(skill).toContain('non-interactive sudo/package-manager path');
    expect(skill).toContain('Do not pass `--delete-legacy-markdown`');
    expect(skill).not.toContain('ask the user before changing files');
    expect(skill).not.toContain('asks before deleting `compound-engineering.local.md`');

    expect(installHelpersSource).toContain('run_npm_global_install_with_optional_sudo');
    expect(installHelpersSource).toContain('sudo -n env CI=true');
    expect(installHelpersSource).toContain('NPM_CONFIG_REGISTRY');
  });
});
