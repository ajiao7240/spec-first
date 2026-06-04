#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { loadHelperRegistry, helperById } = require('../../../src/cli/helpers/setup-facts');

function parseArgs(argv) {
  const parsed = { repoRoot: process.cwd(), factsFile: '' };
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

function declaredLookup(repoRoot) {
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
  const profile = readJsonIfPresent(profilePath);
  if (!profile) return [];
  const checks = Array.isArray(profile.checks) ? profile.checks : [];
  return checks
    .map((check, index) => makeEntry({
      kind: 'verification-command',
      sourcePath: profilePath,
      command: check.command,
      idSuffix: check.id || String(index),
    }, lookup))
    .filter(Boolean);
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
  const lookup = declaredLookup(repoRoot);
  const configuredDependencies = [
    ...scanFactsMcp(args.factsFile, lookup),
    ...scanClaudeSettings(repoRoot, lookup),
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
