const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { inspectInstalledAssets, listBundledCommands, loadPluginManifest } = require('../plugin');
const { readDeveloperFile, getProjectDeveloperPath } = require('../developer');
const { isLegacyManagedState, readState, readStateFileRaw } = require('../state');
const { getAdapter, getSupportedPlatforms } = require('../adapters');
const { inspectInstructionBootstrap } = require('../instruction-bootstrap');
const { inspectManagedSessionStartHook } = require('../claude-settings');
const VERIFICATION_EVIDENCE_PATH = path.join('.spec-first', 'runtime', 'verification-evidence.json');

function runDoctor(argv) {
  const args = [...argv];
  const parsed = parseDoctorArgs(args);

  if (parsed.help) {
    printHelp();
    return 0;
  }

  if (parsed.unknown.length > 0) {
    console.error('Usage: spec-first doctor [--claude|--codex] [--json]');
    return 1;
  }

  const projectRoot = process.cwd();

  // 确定要检查的平台
  let platforms = [];
  if (parsed.claude) platforms.push('claude');
  if (parsed.codex) platforms.push('codex');

  // 无参数时自动检测
  if (platforms.length === 0) {
    platforms = detectPlatforms(projectRoot);
  }

  if (platforms.length === 0) {
    if (parsed.json) {
      printDoctorJson(buildDoctorReport({ projectRoot, platforms }));
      return 0;
    }

    console.log('No spec-first platform detected in this project.');
    console.log('Run `spec-first init --claude` or `spec-first init --codex` to initialize.');
    return 0;
  }

  const report = buildDoctorReport({ projectRoot, platforms });

  if (parsed.json) {
    printDoctorJson(report);
    return report.has_error ? 1 : 0;
  }

  for (const check of report.common_checks) {
    const label = check.level.toUpperCase().padEnd(7);
    console.log(`${label} ${check.name}: ${check.message}`);
    if (check.fix) {
      console.log(`         Fix: ${check.fix}`);
    }
  }

  // 平台特定检查
  let hasError = report.has_error;

  for (const platform of platforms) {
    console.log(`\n=== ${platform.toUpperCase()} Platform ===`);
    const platformChecks = report.platform_checks[platform] || [];

    for (const check of platformChecks) {
      const label = check.level.toUpperCase().padEnd(7);
      console.log(`${label} ${check.name}: ${check.message}`);
      if (check.fix) {
        console.log(`         Fix: ${check.fix}`);
      }
    }

    if (platformChecks.some((check) => check.level === 'ERROR')) {
      hasError = true;
    }
  }

  return hasError ? 1 : 0;
}

function checkNodeVersion() {
  const version = process.version;
  const major = Number.parseInt(version.slice(1).split('.')[0], 10);
  if (Number.isFinite(major) && major >= 20) {
    return { level: 'PASS', name: 'Node.js', message: version };
  }

  return {
    level: 'ERROR',
    name: 'Node.js',
    message: version,
    fix: 'Install Node.js 20 or newer.',
  };
}

function checkGit() {
  const result = spawnSync('git', ['--version'], { encoding: 'utf8' });
  if (result.status === 0) {
    return {
      level: 'PASS',
      name: 'Git',
      message: result.stdout.trim(),
    };
  }

  return {
    level: 'ERROR',
    name: 'Git',
    message: 'not found',
    fix: 'Install Git and ensure it is on PATH.',
  };
}

function checkPlatformCli(platform) {
  const command = platform === 'codex' ? 'codex' : 'claude';
  const displayName = platform === 'codex' ? 'Codex' : 'Claude Code';
  // Note: Codex CLI may not be available yet - this is expected during MVP phase
  const result = spawnSync(command, ['--version'], { encoding: 'utf8' });
  if (result.status === 0) {
    return {
      level: 'PASS',
      name: displayName,
      message: result.stdout.trim() || 'available',
    };
  }

  if (result.error && result.error.code === 'ENOENT') {
    return {
      level: 'WARNING',
      name: displayName,
      message: 'not found on PATH',
      fix: `Install ${displayName} CLI and restart your shell.`,
    };
  }

  return {
    level: 'WARNING',
    name: displayName,
    message: 'could not verify version',
    fix: `Run \`${command} --version\` manually to confirm the CLI works.`,
  };
}

function checkGeneratedCommands(projectRoot, adapter) {
  let commandStatus;
  try {
    commandStatus = inspectInstalledAssets(projectRoot, adapter).commands;
  } catch (error) {
    return {
      level: 'ERROR',
      name: `${adapter.commandRoot}`,
      message: error instanceof Error ? error.message : String(error),
      fix: 'Reinstall the spec-first package so bundled command templates are available.',
    };
  }

  if (!fs.existsSync(commandStatus.targetRoot)) {
    return {
      level: 'WARNING',
      name: `${adapter.commandRoot}`,
      message: 'missing',
      fix: `Run \`spec-first init --${adapter.id}\` in this project.`,
    };
  }

  if (commandStatus.missing.length === 0) {
    return {
      level: 'PASS',
      name: `${adapter.commandRoot}`,
      message: `found ${commandStatus.entries.length} command file(s)`,
    };
  }

  return {
    level: 'WARNING',
    name: `${adapter.commandRoot}`,
    message: `missing ${commandStatus.missing.map((entry) => entry.filename).join(', ')}`,
    fix: `Run \`spec-first init --${adapter.id}\` to regenerate the missing files.`,
  };
}

function checkInstalledSkills(projectRoot, adapter) {
  let skillStatus;
  try {
    skillStatus = inspectInstalledAssets(projectRoot, adapter).skills;
  } catch (error) {
    return {
      level: 'ERROR',
      name: `${adapter.skillsRoot}`,
      message: error instanceof Error ? error.message : String(error),
      fix: 'Reinstall the spec-first package so bundled skills are available.',
    };
  }

  if (!fs.existsSync(skillStatus.targetRoot)) {
    return {
      level: 'WARNING',
      name: `${adapter.skillsRoot}`,
      message: 'missing',
      fix: `Run \`spec-first init --${adapter.id}\` in this project to install bundled skills.`,
    };
  }

  if (skillStatus.missing.length === 0) {
    return {
      level: 'PASS',
      name: `${adapter.skillsRoot}`,
      message: `found ${skillStatus.entries.length} skill directory(ies)`,
    };
  }

  return {
    level: 'WARNING',
    name: `${adapter.skillsRoot}`,
    message: `out of sync (${skillStatus.entries.length - skillStatus.missing.length}/${skillStatus.entries.length} installed)`,
    fix: `Run \`spec-first init --${adapter.id}\` in this project to resync bundled skills.`,
  };
}

function checkInstalledAgents(projectRoot, adapter) {
  let agentStatus;
  try {
    agentStatus = inspectInstalledAssets(projectRoot, adapter).agents;
  } catch (error) {
    return {
      level: 'ERROR',
      name: `${adapter.agentsRoot}`,
      message: error instanceof Error ? error.message : String(error),
      fix: 'Reinstall the spec-first package so bundled agents are available.',
    };
  }

  if (!fs.existsSync(agentStatus.targetRoot)) {
    return {
      level: 'WARNING',
      name: `${adapter.agentsRoot}`,
      message: 'missing',
      fix: `Run \`spec-first init --${adapter.id}\` in this project to install bundled agents.`,
    };
  }

  if (agentStatus.missing.length === 0) {
    return {
      level: 'PASS',
      name: `${adapter.agentsRoot}`,
      message: `found ${agentStatus.entries.length} agent file(s)`,
    };
  }

  return {
    level: 'WARNING',
    name: `${adapter.agentsRoot}`,
    message: `out of sync (${agentStatus.entries.length - agentStatus.missing.length}/${agentStatus.entries.length} installed)`,
    fix: `Run \`spec-first init --${adapter.id}\` in this project to resync bundled agents.`,
  };
}

function checkInstalledAgentSupportFiles(projectRoot, adapter) {
  let supportStatus;
  try {
    supportStatus = inspectInstalledAssets(projectRoot, adapter).agentSupportFiles;
  } catch (error) {
    return {
      level: 'ERROR',
      name: `${adapter.agentsRoot} support assets`,
      message: error instanceof Error ? error.message : String(error),
      fix: 'Reinstall the spec-first package so bundled agent support assets are available.',
    };
  }

  if (supportStatus.entries.length === 0) {
    return {
      level: 'PASS',
      name: `${adapter.agentsRoot} support assets`,
      message: 'no bundled support assets',
    };
  }

  if (!fs.existsSync(supportStatus.targetRoot)) {
    return {
      level: 'WARNING',
      name: `${adapter.agentsRoot} support assets`,
      message: 'missing',
      fix: `Run \`spec-first init --${adapter.id}\` in this project to install bundled agent support assets.`,
    };
  }

  if (supportStatus.missing.length === 0) {
    return {
      level: 'PASS',
      name: `${adapter.agentsRoot} support assets`,
      message: `found ${supportStatus.entries.length} support file(s)`,
    };
  }

  return {
    level: 'WARNING',
    name: `${adapter.agentsRoot} support assets`,
    message: `out of sync (${supportStatus.entries.length - supportStatus.missing.length}/${supportStatus.entries.length} installed)`,
    fix: `Run \`spec-first init --${adapter.id}\` in this project to resync bundled agent support assets.`,
  };
}

function checkPluginManifest() {
  try {
    const manifest = loadPluginManifest();
    const commandCount = listBundledCommands().length;
    return {
      level: 'PASS',
      name: '.claude-plugin/plugin.json',
      message: `${manifest.name}@${manifest.version} with ${commandCount} command definition(s)`,
    };
  } catch (error) {
    return {
      level: 'ERROR',
      name: '.claude-plugin/plugin.json',
      message: error instanceof Error ? error.message : String(error),
      fix: 'Restore the bundled plugin manifest and reinstall the package.',
    };
  }
}

function checkCrgNativeModules() {
  // 检查 CRG CLI 路由器是否可执行
  const cli = spawnSync('spec-first', ['crg', '--help'], { encoding: 'utf8', timeout: 5000 });
  if (cli.status !== 0) {
    return {
      level: 'WARNING',
      name: 'CRG CLI',
      message: 'spec-first crg unavailable',
      fix: 'Reinstall spec-first to ensure CRG subsystem is available.',
    };
  }

  // 检查 better-sqlite3 原生模块
  const sqlite = spawnSync('node', ['-e', "try{require('better-sqlite3')}catch{process.exit(1)}"], { timeout: 5000 });
  if (sqlite.status !== 0) {
    return {
      level: 'WARNING',
      name: 'CRG (better-sqlite3)',
      message: 'native module not loadable',
      fix: 'Run: npm rebuild better-sqlite3 (requires C++ build tools)',
    };
  }

  // 检查 tree-sitter 原生模块
  const ts = spawnSync('node', ['-e', "try{require('tree-sitter')}catch{process.exit(1)}"], { timeout: 5000 });
  if (ts.status !== 0) {
    return {
      level: 'WARNING',
      name: 'CRG (tree-sitter)',
      message: 'native module not loadable',
      fix: 'Run: npm rebuild tree-sitter (requires C++ build tools)',
    };
  }

  return {
    level: 'PASS',
    name: 'CRG',
    message: 'CLI + native modules ready',
  };
}

function buildDoctorReport({ projectRoot, platforms }) {
  const commonChecks = [
    checkNodeVersion(),
    checkGit(),
    checkPluginManifest(),
    checkCrgNativeModules(),
  ];
  const platformChecksByPlatform = {};
  const runtimeChecksByPlatform = {};
  const hostChecksByPlatform = {};

  for (const platform of platforms) {
    const adapter = getAdapter(platform);
    const platformCliCheck = checkPlatformCli(platform);
    const runtimeFileChecks = adapter.inspectRuntimeFiles(projectRoot);
    const commandChecks = adapter.hasCommands ? [checkGeneratedCommands(projectRoot, adapter)] : [];
    const hostSpecificChecks = buildHostSpecificChecks(projectRoot, adapter);
    const coreRuntimeChecks = [
      checkProjectDeveloper(projectRoot, adapter),
      checkManagedState(projectRoot, adapter),
      checkInstructionBootstrap(projectRoot, adapter),
      ...runtimeFileChecks,
      ...commandChecks,
    ];
    const inventoryChecks = [
      checkInstalledSkills(projectRoot, adapter),
      checkInstalledAgents(projectRoot, adapter),
      checkInstalledAgentSupportFiles(projectRoot, adapter),
    ];
    const runtimeChecks = [
      ...coreRuntimeChecks,
      ...inventoryChecks,
    ];
    const hostChecks = [
      platformCliCheck,
      ...hostSpecificChecks,
    ];

    runtimeChecksByPlatform[platform] = runtimeChecks;
    hostChecksByPlatform[platform] = hostChecks;
    platformChecksByPlatform[platform] = [
      platformCliCheck,
      ...coreRuntimeChecks,
      ...hostSpecificChecks,
      ...inventoryChecks,
    ];
  }

  const installHealth = summarizeChecks(commonChecks);
  const runtimeAssetHealth = platforms.length === 0
    ? 'not_applicable'
    : summarizeChecks(Object.values(runtimeChecksByPlatform).flat());
  const hostReadiness = platforms.length === 0
    ? 'not_applicable'
    : summarizeChecks(Object.values(hostChecksByPlatform).flat());
  const workflowRunnability = computeWorkflowRunnability({
    projectRoot,
    platforms,
    runtimeAssetHealth,
    hostReadiness,
    runtimeChecksByPlatform,
  });
  const allChecks = [
    ...commonChecks,
    ...Object.values(platformChecksByPlatform).flat(),
  ];

  return {
    schema_version: 'v1',
    platforms,
    install_health: installHealth,
    runtime_asset_health: runtimeAssetHealth,
    host_readiness: hostReadiness,
    decision_input_health: 'not_checked',
    workflow_runnability: workflowRunnability.status,
    workflow_runnability_basis: workflowRunnability.basis,
    common_checks: commonChecks,
    platform_checks: platformChecksByPlatform,
    checks: allChecks,
    warnings: allChecks.filter((check) => check.level === 'WARNING'),
    has_error: allChecks.some((check) => check.level === 'ERROR'),
  };
}

function summarizeChecks(checks) {
  if (!Array.isArray(checks) || checks.length === 0) return 'not_applicable';
  if (checks.some((check) => check.level === 'ERROR')) return 'error';
  if (checks.some((check) => check.level === 'WARNING')) return 'warn';
  return 'pass';
}

function printDoctorJson(report) {
  console.log(JSON.stringify({
    schema_version: report.schema_version,
    platforms: report.platforms,
    install_health: report.install_health,
    runtime_asset_health: report.runtime_asset_health,
    host_readiness: report.host_readiness,
    decision_input_health: report.decision_input_health,
    workflow_runnability: report.workflow_runnability,
    workflow_runnability_basis: report.workflow_runnability_basis,
    checks: report.checks,
    common_checks: report.common_checks,
    platform_checks: report.platform_checks,
    warnings: report.warnings,
  }, null, 2));
}

function computeWorkflowRunnability({
  projectRoot,
  platforms,
  runtimeAssetHealth,
  hostReadiness,
  runtimeChecksByPlatform,
}) {
  const evidence = readWorkflowVerificationEvidence(projectRoot);
  const basis = {
    runtime_assets_ready: runtimeAssetHealth === 'pass',
    host_readiness_ready: hostReadiness !== 'error' && hostReadiness !== 'not_applicable',
    managed_state_present: false,
    workflow_surface_resolved: false,
    execution_evidence_present: evidence.present,
    evidence_path: evidence.path,
    reason: '',
  };

  if (platforms.length === 0) {
    basis.reason = 'No initialized platform detected, so workflow runnability is not verified.';
    return {
      status: 'not_verified',
      basis,
    };
  }

  basis.managed_state_present = platforms.every((platform) => {
    const adapter = getAdapter(platform);
    return hasPassingCheck(runtimeChecksByPlatform[platform], adapter.stateFile);
  });

  basis.workflow_surface_resolved = platforms.every((platform) => {
    const adapter = getAdapter(platform);
    const requiredChecks = [
      adapter.stateFile,
      adapter.developerFile,
      adapter.skillsRoot,
      adapter.agentsRoot,
    ];

    if (adapter.hasCommands) {
      requiredChecks.push(adapter.commandRoot);
    }

    return requiredChecks.every((checkName) => hasPassingCheck(runtimeChecksByPlatform[platform], checkName));
  });

  if (
    basis.runtime_assets_ready &&
    basis.host_readiness_ready &&
    basis.managed_state_present &&
    basis.workflow_surface_resolved
  ) {
    if (basis.execution_evidence_present) {
      basis.reason = hostReadiness === 'warn'
        ? 'Runtime assets and workflow surfaces are ready, host readiness only has non-blocking warnings, and execution evidence is recorded.'
        : 'Runtime assets, host readiness, and workflow surfaces are ready, and execution evidence is recorded.';
      return {
        status: 'verified',
        basis,
      };
    }

    basis.reason = hostReadiness === 'warn'
      ? 'Runtime assets and workflow surfaces are ready, host readiness only has non-blocking warnings, but no execution evidence is recorded.'
      : 'Runtime assets and workflow surfaces are ready, but no execution evidence is recorded.';
    return {
      status: 'simulated',
      basis,
    };
  }

  basis.reason = 'Workflow runnability remains unverified because runtime assets or workflow surfaces are incomplete.';
  return {
    status: 'not_verified',
    basis,
  };
}

function hasPassingCheck(checks, name) {
  return Array.isArray(checks) && checks.some((check) => check.name === name && check.level === 'PASS');
}

function readWorkflowVerificationEvidence(projectRoot) {
  const evidencePath = path.join(projectRoot, VERIFICATION_EVIDENCE_PATH);
  if (!fs.existsSync(evidencePath)) {
    return {
      present: false,
      path: VERIFICATION_EVIDENCE_PATH,
    };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
    if (
      parsed &&
      typeof parsed === 'object' &&
      parsed.schema_version === 'v1' &&
      Array.isArray(parsed.evidence_items) &&
      parsed.evidence_items.length > 0
    ) {
      return {
        present: true,
        path: VERIFICATION_EVIDENCE_PATH,
      };
    }
  } catch (_error) {
    return {
      present: false,
      path: VERIFICATION_EVIDENCE_PATH,
    };
  }

  return {
    present: false,
    path: VERIFICATION_EVIDENCE_PATH,
  };
}

function checkProjectDeveloper(projectRoot, adapter) {
  const developerPath = getProjectDeveloperPath(projectRoot, adapter);
  if (!fs.existsSync(developerPath)) {
    return {
      level: 'WARNING',
      name: `${adapter.developerFile}`,
      message: 'missing',
      fix: `Run \`spec-first init --${adapter.id}\` in this project to write the project developer profile.`,
    };
  }

  const developer = readDeveloperFile(developerPath);
  if (!developer) {
    return {
      level: 'ERROR',
      name: `${adapter.developerFile}`,
      message: 'invalid or empty',
      fix: `Run \`spec-first init --${adapter.id} -u <name> --lang <zh|en>\` to regenerate the project developer profile.`,
    };
  }

  const packageVersion = require('../../../package.json').version;
  if (
    typeof developer.name !== 'string' ||
    developer.name.length === 0 ||
    typeof developer.lang !== 'string' ||
    (developer.lang !== 'zh' && developer.lang !== 'en') ||
    typeof developer.initializedAt !== 'string' ||
    developer.initializedAt.length === 0 ||
    typeof developer.version !== 'string' ||
    developer.version.length === 0
  ) {
    return {
      level: 'ERROR',
      name: `${adapter.developerFile}`,
      message: 'invalid or incomplete',
      fix: `Run \`spec-first init --${adapter.id} -u <name> --lang <zh|en>\` to regenerate the project developer profile.`,
    };
  }

  if (developer.version !== packageVersion) {
    return {
      level: 'WARNING',
      name: `${adapter.developerFile}`,
      message: `recorded ${developer.version}, bundled ${packageVersion}`,
      fix: `Run \`spec-first init --${adapter.id}\` in this project to refresh the project developer profile after upgrading.`,
    };
  }

  return {
    level: 'PASS',
    name: `${adapter.developerFile}`,
    message: `${developer.name} (${developer.lang}) ${developer.version}`,
  };
}

function checkManagedState(projectRoot, adapter) {
  const statePath = path.join(projectRoot, adapter.stateFile);
  if (!fs.existsSync(statePath)) {
    return {
      level: 'WARNING',
      name: `${adapter.stateFile}`,
      message: 'missing',
      fix: `Run \`spec-first init --${adapter.id}\` in this project to record managed assets.`,
    };
  }

  try {
    const state = readState(projectRoot, adapter);
    const manifest = loadPluginManifest();
    if (!state || !state.manifestVersion) {
      return {
        level: 'WARNING',
        name: `${adapter.stateFile}`,
        message: 'invalid or empty',
        fix: `Run \`spec-first init --${adapter.id}\` in this project to regenerate the managed asset state.`,
      };
    }

    if (state.manifestVersion !== manifest.version) {
      return {
        level: 'WARNING',
        name: `${adapter.stateFile}`,
        message: `recorded ${state.manifestVersion}, bundled ${manifest.version}`,
        fix: `Run \`spec-first init --${adapter.id}\` in this project to resync managed assets after upgrading.`,
      };
    }

    return {
      level: 'PASS',
      name: `${adapter.stateFile}`,
      message: `recorded ${state.commands.length} commands, ${state.skills.length} standalone skills, ${state.workflowSkills.length} workflow skills, ${state.agents.length} agents, ${state.agentSupportFiles.length} support files`,
    };
  } catch (error) {
    const rawState = tryReadRawManagedState(projectRoot, adapter);
    if (isLegacyManagedState(rawState)) {
      return {
        level: 'WARNING',
        name: `${adapter.stateFile}`,
        message: `legacy managed state detected (${error instanceof Error ? error.message : String(error)})`,
        fix: `Run \`spec-first init --${adapter.id}\` in this project to perform a managed hard reset and rebuild the current runtime.`,
      };
    }

    return {
      level: 'WARNING',
      name: `${adapter.stateFile}`,
      message: error instanceof Error ? error.message : String(error),
      fix: `Run \`spec-first init --${adapter.id}\` in this project to regenerate the managed asset state.`,
    };
  }
}

function checkInstructionBootstrap(projectRoot, adapter) {
  const status = inspectInstructionBootstrap(projectRoot, adapter);
  if (status.status === 'installed') {
    return {
      level: 'PASS',
      name: `${adapter.instructionFile} using-spec-first bootstrap`,
      message: status.message,
    };
  }

  return {
    level: 'WARNING',
    name: `${adapter.instructionFile} using-spec-first bootstrap`,
    message: status.message,
    fix: `Run \`spec-first init --${adapter.id}\` in this project to restore the managed bootstrap block.`,
  };
}

function buildHostSpecificChecks(projectRoot, adapter) {
  if (adapter.id !== 'claude') {
    return [];
  }

  const status = inspectManagedSessionStartHook(projectRoot);
  if (status.status === 'installed') {
    return [{
      level: 'PASS',
      name: '.claude/settings.json SessionStart',
      message: status.message,
    }];
  }

  return [{
    level: 'WARNING',
    name: '.claude/settings.json SessionStart',
    message: status.message,
    fix: 'Run `spec-first init --claude` in this project to restore the managed SessionStart matcher.',
  }];
}

function printHelp() {
  console.log('Usage: spec-first doctor [--claude|--codex] [--json]');
}

function detectPlatforms(projectRoot) {
  return getSupportedPlatforms().filter(platform => {
    const adapter = getAdapter(platform);
    return fs.existsSync(path.join(projectRoot, adapter.runtimeRoot));
  });
}

function parseDoctorArgs(argv) {
  const parsed = {
    help: false,
    claude: false,
    codex: false,
    json: false,
    unknown: [],
  };

  for (const arg of argv) {
    if (arg === '-h' || arg === '--help') {
      parsed.help = true;
    } else if (arg === '--claude') {
      parsed.claude = true;
    } else if (arg === '--codex') {
      parsed.codex = true;
    } else if (arg === '--json') {
      parsed.json = true;
    } else {
      parsed.unknown.push(arg);
    }
  }

  return parsed;
}

function tryReadRawManagedState(projectRoot, adapter) {
  try {
    return readStateFileRaw(projectRoot, adapter);
  } catch (_error) {
    return null;
  }
}

module.exports = {
  runDoctor,
};
