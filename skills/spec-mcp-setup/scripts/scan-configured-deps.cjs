#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { loadHelperRegistry, helperById } = require('../../../src/cli/helpers/setup-facts');
const { resolveProfileChecks, validateProfileObject } = require('../../../src/verification/profile-loader');

function parseArgs(argv) {
  // repoRoot 默认空串：缺 --repo-root 时由 main() 的 required 检查拒绝，
  // 不静默回退 process.cwd()（多仓 workspace 下回退 cwd 会扫错仓库）。
  const parsed = { repoRoot: '', factsFile: '' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--repo-root') {
      parsed.repoRoot = argv[index + 1] || '';
      index += 1;
    } else if (arg === '--facts-file') {
      parsed.factsFile = argv[index + 1] || '';
      index += 1;
    }
  }
  return parsed;
}

function readJsonIfPresent(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_error) {
    return null;
  }
}

function readJsonState(filePath) {
  if (!fs.existsSync(filePath)) return { status: 'missing', value: null, errors: [] };
  try {
    return { status: 'read', value: JSON.parse(fs.readFileSync(filePath, 'utf8')), errors: [] };
  } catch (error) {
    return { status: 'unreadable', value: null, errors: [error.message] };
  }
}

function commandName(command) {
  if (!command || typeof command !== 'string') return '';
  const trimmed = command.trim();
  if (!trimmed) return '';
  const withoutEnv = trimmed.replace(/^(env\s+)?([A-Za-z_][A-Za-z0-9_]*=[^\s]+\s+)*/, '');
  const first = withoutEnv.split(/\s+/)[0] || '';
  return path.basename(first);
}

function argsShape(command) {
  if (!command || typeof command !== 'string') return 'none';
  const parts = command.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return 'none';
  return parts.slice(1).map((part) => {
    if (/^--?[A-Za-z0-9][\w-]*(=.*)?$/.test(part)) return 'flag';
    if (/^[A-Za-z_][A-Za-z0-9_]*=.*/.test(part)) return 'env';
    return 'arg';
  }).join(',');
}

function declaredLookup() {
  // registry 恒取 spec-first 自身的 helper-tools.json（描述 spec-first harness helper），
  // 不读被扫描目标仓的 registry —— 故不接收 repoRoot 形参。
  const { registry } = loadHelperRegistry(path.resolve(__dirname, '..', '..', '..'));
  const helpers = helperById(registry);
  const commands = new Map();
  for (const helper of helpers.values()) {
    if (helper.detection && helper.detection.command) {
      commands.set(helper.detection.command, helper.id);
    }
  }
  commands.set('node', 'node');
  commands.set('npm', 'npm');
  commands.set('npx', 'npx');
  commands.set('git', 'git');
  commands.set('rg', 'rg');
  commands.set('bash', 'bash');
  commands.set('sh', 'sh');
  commands.set('pwsh', 'pwsh');
  commands.set('powershell', 'powershell');
  commands.set('spec-first', 'spec-first');
  return { helpers, commands };
}

function dependencyStatus(command) {
  if (!command) return 'unknown';
  if (command === 'spec-first') return 'ready';
  const paths = String(process.env.PATH || '').split(path.delimiter);
  const candidates = process.platform === 'win32'
    ? [command, `${command}.exe`, `${command}.cmd`, `${command}.ps1`]
    : [command];
  for (const dir of paths) {
    for (const candidate of candidates) {
      if (fs.existsSync(path.join(dir, candidate))) return 'ready';
    }
  }
  return 'missing';
}

function makeEntry({ kind, sourcePath, command, idSuffix }, lookup) {
  const cmd = commandName(command);
  if (!cmd) return null;
  const declaredToolId = lookup.commands.get(cmd) || null;
  const depStatus = dependencyStatus(cmd);
  const undeclared = !declaredToolId;
  return {
    id: `${kind}:${idSuffix || cmd}`,
    kind,
    source_path: sourcePath,
    command: cmd,
    args_shape: argsShape(command),
    declared_tool_id: declaredToolId,
    declared_status: undeclared ? 'undeclared' : 'declared',
    dependency_status: depStatus,
    configured_status: 'configured',
    result: undeclared ? 'action-required' : (depStatus === 'ready' ? 'ready' : 'action-required'),
    reason_code: undeclared
      ? 'configured-dependency-undeclared'
      : (depStatus === 'ready' ? 'configured-dependency-ready' : 'configured-dependency-missing'),
  };
}

function makeEntryWithStatus({ kind, sourcePath, command, idSuffix, configuredStatus }, lookup) {
  const entry = makeEntry({ kind, sourcePath, command, idSuffix }, lookup);
  if (!entry) return null;
  return {
    ...entry,
    configured_status: configuredStatus || entry.configured_status,
  };
}

function bashPermissionCommand(pattern) {
  if (typeof pattern !== 'string') return '';
  const match = pattern.match(/\bBash\(([^)]*)\)/);
  return match ? match[1] : '';
}

function scanClaudeSettings(repoRoot, lookup) {
  const settingsPath = path.join(repoRoot, '.claude', 'settings.json');
  const settings = readJsonIfPresent(settingsPath);
  if (!settings) return [];
  const entries = [];
  const mcpServers = settings.mcpServers && typeof settings.mcpServers === 'object'
    ? settings.mcpServers
    : {};
  for (const [serverName, serverConfig] of Object.entries(mcpServers)) {
    const command = serverConfig && typeof serverConfig === 'object' ? serverConfig.command : '';
    const entry = makeEntry({
      kind: 'mcp-config',
      sourcePath: settingsPath,
      command,
      idSuffix: serverName,
    }, lookup);
    if (entry) entries.push({ ...entry, server: serverName });
  }

  const hooks = settings.hooks && typeof settings.hooks === 'object' ? settings.hooks : {};
  for (const [hookName, hookEntries] of Object.entries(hooks)) {
    const list = Array.isArray(hookEntries) ? hookEntries : [];
    list.forEach((hook, hookIndex) => {
      const matchers = Array.isArray(hook.matcher) ? hook.matcher : [hook.matcher];
      const commands = Array.isArray(hook.hooks) ? hook.hooks : [];
      commands.forEach((candidate, commandIndex) => {
        const command = typeof candidate === 'string' ? candidate : candidate && candidate.command;
        const entry = makeEntry({
          kind: 'hook',
          sourcePath: settingsPath,
          command,
          idSuffix: `${hookName}:${hookIndex}:${commandIndex}`,
        }, lookup);
        if (entry) entries.push({ ...entry, hook: hookName, matcher_count: matchers.filter(Boolean).length });
      });
    });
  }

  const permissions = settings.permissions && typeof settings.permissions === 'object'
    ? settings.permissions
    : {};
  for (const permissionKey of ['allow', 'deny']) {
    const permissionEntries = Array.isArray(permissions[permissionKey]) ? permissions[permissionKey] : [];
    permissionEntries.forEach((permission, index) => {
      const command = bashPermissionCommand(permission);
      const entry = makeEntryWithStatus({
        kind: 'permission-allowlist',
        sourcePath: settingsPath,
        command,
        idSuffix: `${permissionKey}:${index}`,
        configuredStatus: permissionKey === 'allow' ? 'allowed' : 'denied',
      }, lookup);
      if (entry) entries.push({ ...entry, permission: permissionKey });
    });
  }

  return entries;
}

function scanCodexConfig(repoRoot, lookup) {
  // Codex host configured surface（Req18 双宿主 parity）：读 .codex/hooks.json 的
  // hooks.<event>[].hooks[].command。只提取命令名与来源，不执行 hook。
  const hooksPath = path.join(repoRoot, '.codex', 'hooks.json');
  const config = readJsonIfPresent(hooksPath);
  if (!config) return [];
  const entries = [];
  const hooks = config.hooks && typeof config.hooks === 'object' ? config.hooks : {};
  for (const [hookName, hookEntries] of Object.entries(hooks)) {
    const list = Array.isArray(hookEntries) ? hookEntries : [];
    list.forEach((hook, hookIndex) => {
      const commands = Array.isArray(hook.hooks) ? hook.hooks : [];
      commands.forEach((candidate, commandIndex) => {
        const command = typeof candidate === 'string' ? candidate : candidate && candidate.command;
        const entry = makeEntry({
          kind: 'hook',
          sourcePath: hooksPath,
          command,
          idSuffix: `codex:${hookName}:${hookIndex}:${commandIndex}`,
        }, lookup);
        if (entry) entries.push({ ...entry, hook: hookName, host: 'codex' });
      });
    });
  }
  return entries;
}

function scanPackageSetupScripts(repoRoot, lookup) {
  const packageJsonPath = path.join(repoRoot, 'package.json');
  const packageJson = readJsonIfPresent(packageJsonPath);
  if (!packageJson || !packageJson.scripts || typeof packageJson.scripts !== 'object') return [];
  return Object.entries(packageJson.scripts)
    .filter(([scriptName]) => /(^|:)(setup|bootstrap|prepare|postinstall|install)(:|$)/.test(scriptName))
    .map(([scriptName, command]) => makeEntry({
      kind: 'setup-script',
      sourcePath: packageJsonPath,
      command: String(command || ''),
      idSuffix: scriptName,
    }, lookup))
    .filter(Boolean);
}

function scanVerificationProfile(repoRoot, lookup) {
  const profilePath = path.join(repoRoot, 'spec-first.verification.json');
  const profileState = readJsonState(profilePath);
  if (profileState.status === 'missing') return [];
  if (profileState.status === 'unreadable') {
    return [makeProfileProblemEntry(profilePath, 'profile-unreadable', profileState.errors)];
  }
  const profile = profileState.value;
  const schemaValidation = validateProfileObject(profile);
  if (schemaValidation.errors.length > 0) {
    return [makeProfileProblemEntry(profilePath, 'profile-schema-invalid', schemaValidation.errors)];
  }
  const resolved = resolveProfileChecks(profile);
  if (resolved.errors.length > 0) {
    return [makeProfileProblemEntry(profilePath, resolved.reason_code || 'profile-resolution-invalid', resolved.errors)];
  }
  const entries = [];
  for (const check of resolved.checks) {
    const commandEntry = makeEntry({
      kind: 'verification-command',
      sourcePath: profilePath,
      command: check.command,
      idSuffix: check.id,
    }, lookup);
    if (commandEntry) entries.push(commandEntry);
    for (const tool of check.required_tools || []) {
      const toolEntry = makeEntry({
        kind: 'verification-required-tool',
        sourcePath: profilePath,
        command: tool,
        idSuffix: `${check.id}:${tool}`,
      }, lookup);
      if (toolEntry) entries.push(toolEntry);
    }
  }
  return entries;
}

function makeProfileProblemEntry(profilePath, reasonCode, errors) {
  return {
    id: 'verification-profile:spec-first.verification.json',
    kind: 'verification-profile',
    source_path: profilePath,
    command: 'spec-first.verification.json',
    args_shape: 'profile',
    declared_tool_id: null,
    declared_status: 'declared',
    dependency_status: 'unknown',
    configured_status: 'invalid',
    result: 'action-required',
    reason_code: reasonCode,
    errors,
  };
}

function scanFactsMcp(factsFile, lookup) {
  const facts = factsFile ? readJsonIfPresent(factsFile) : null;
  if (!facts || !facts.tools || typeof facts.tools !== 'object') return [];
  return Object.entries(facts.tools).map(([id, value]) => ({
    id,
    value,
  })).map(({ id, value }) => {
    const dependency = value.dependency_status || (value.status === 'ready' ? 'ready' : 'unknown');
    const configured = value.host_config_status || (value.status === 'ready' ? 'ready' : 'unknown');
    const result = dependency === 'ready' && ['ready', 'fallback-active', 'not-required', undefined].includes(value.host_config_status)
      ? 'ready'
      : (dependency === 'ready' && configured === 'registry-args-drift' ? 'degraded' : 'action-required');
    const reasonCode = configured === 'registry-args-drift'
      ? 'host-config-version-drift'
      : 'configured-dependency-from-mcp-registry';
    return {
      id: `mcp-config:${id}`,
      kind: 'mcp-config',
      source_path: factsFile,
      command: id,
      args_shape: 'registry',
      declared_tool_id: id,
      declared_status: 'declared',
      dependency_status: dependency,
      configured_status: configured,
      result,
      reason_code: reasonCode,
    };
  });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.repoRoot) {
    console.error('scan-configured-deps: --repo-root required');
    process.exit(2);
  }
  const repoRoot = path.resolve(args.repoRoot);
  if (!fs.existsSync(repoRoot)) {
    console.error(`scan-configured-deps: --repo-root does not exist: ${repoRoot}`);
    process.exit(2);
  }
  const lookup = declaredLookup();
  const configuredDependencies = [
    ...scanFactsMcp(args.factsFile, lookup),
    ...scanClaudeSettings(repoRoot, lookup),
    ...scanCodexConfig(repoRoot, lookup),
    ...scanPackageSetupScripts(repoRoot, lookup),
    ...scanVerificationProfile(repoRoot, lookup),
  ];
  process.stdout.write(`${JSON.stringify({
    schema_version: 'configured-dependency-scan.v1',
    repo_root: repoRoot,
    configured_dependencies: configuredDependencies,
  }, null, 2)}\n`);
}

main();
