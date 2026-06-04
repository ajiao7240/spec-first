'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { validateAgainstSchema } = require('../contracts/schema-validator');
const { resolveTargetRepoRoot } = require('../cli/helpers/target-repo');

const PROFILE_SCHEMA_VERSION = 'verification-profile.v1';
const PROFILE_SCHEMA_PATH = path.join(__dirname, '..', '..', 'docs', 'contracts', 'verification', 'verification-profile.schema.json');
const EXPLICIT_PROFILE_PATH = 'spec-first.verification.json';
const LOCAL_PROFILE_PATH = path.join('.spec-first', 'verification-profile.local.json');
const LOCAL_CONFIG_ALIAS_PATH = path.join('.spec-first', 'config.local.yaml');
const INFERRED_SCRIPT_NAMES = [
  'typecheck',
  'test',
  'test:unit',
  'test:smoke',
  'test:integration',
  'test:e2e',
  'lint',
  'build',
];

let cachedSchema = null;

function loadVerificationProfile({ targetRepo } = {}) {
  const target = resolveTargetRepoRoot(targetRepo);
  if (!target.ok) {
    return {
      status: 'rejected',
      reason_code: 'target-repo-not-found',
      errors: target.errors,
      profile_source: 'missing',
      checks: [],
    };
  }
  const repoRoot = target.root;

  const configuredProfilePath = resolveConfiguredProfilePath(repoRoot);
  if (configuredProfilePath) {
    return loadProfileFile(repoRoot, configuredProfilePath.relativePath, configuredProfilePath.profileSource);
  }

  const explicitPath = path.join(repoRoot, EXPLICIT_PROFILE_PATH);
  if (fs.existsSync(explicitPath)) {
    return loadProfileFile(repoRoot, EXPLICIT_PROFILE_PATH, 'explicit');
  }

  return inferProfileFromPackageJson(repoRoot);
}

function resolveConfiguredProfilePath(repoRoot) {
  const localProfilePath = path.join(repoRoot, LOCAL_PROFILE_PATH);
  if (fs.existsSync(localProfilePath)) {
    return { relativePath: LOCAL_PROFILE_PATH, profileSource: 'local' };
  }

  const aliasPath = path.join(repoRoot, LOCAL_CONFIG_ALIAS_PATH);
  if (!fs.existsSync(aliasPath)) return null;

  let raw;
  try {
    raw = fs.readFileSync(aliasPath, 'utf8');
  } catch (_error) {
    return null;
  }

  const alias = parseLocalYamlProfileAlias(raw);
  if (!alias) return null;
  return { relativePath: alias, profileSource: 'local' };
}

function parseLocalYamlProfileAlias(raw) {
  const lines = String(raw || '').split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*verification_profile_path\s*:\s*(.+?)\s*$/);
    if (!match) continue;
    const value = match[1].replace(/^['"]|['"]$/g, '').trim();
    if (value === LOCAL_PROFILE_PATH) return value;
  }
  return '';
}

function loadProfileFile(repoRoot, relativePath, profileSource) {
  const absolutePath = path.join(repoRoot, relativePath);
  let profile;
  try {
    profile = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  } catch (error) {
    return {
      status: 'invalid',
      reason_code: 'profile-unreadable',
      profile_source: profileSource,
      profile_path: relativePath,
      errors: [error.message],
      checks: [],
    };
  }

  const schemaValidation = validateProfileObject(profile);
  if (schemaValidation.errors.length > 0) {
    return {
      status: 'invalid',
      reason_code: 'profile-schema-invalid',
      profile_source: profileSource,
      profile_path: relativePath,
      errors: schemaValidation.errors,
      checks: [],
    };
  }

  const resolved = resolveProfileChecks(profile);
  if (resolved.errors.length > 0) {
    return {
      status: 'invalid',
      reason_code: resolved.reason_code,
      profile_source: profileSource,
      profile_path: relativePath,
      errors: resolved.errors,
      checks: [],
      profile,
    };
  }

  return {
    status: 'configured',
    reason_code: 'profile-loaded',
    profile_source: profileSource,
    profile_path: relativePath,
    default_profile: profile.default_profile,
    profile,
    checks: resolved.checks,
  };
}

function validateProfileObject(profile) {
  const result = validateAgainstSchema(getProfileSchema(), profile);
  return result.valid ? { errors: [] } : { errors: result.errors };
}

function resolveProfileChecks(profile, options = {}) {
  const profileName = options.profileName || profile.default_profile;
  const profileConfig = profile.profiles && profile.profiles[profileName];
  if (!profileConfig) {
    return {
      errors: [`default profile is not defined: ${profileName}`],
      reason_code: 'profile-default-missing',
      checks: [],
    };
  }

  const checks = [];
  const errors = [];
  for (const serviceId of profileConfig.services || []) {
    const service = profile.services && profile.services[serviceId];
    if (!service) {
      errors.push(`profile service is not defined: ${serviceId}`);
      continue;
    }
    const stack = profile.stacks && profile.stacks[service.stack];
    if (!stack) {
      errors.push(`service stack is not defined: ${service.stack}`);
      continue;
    }
    for (const checkId of profileConfig.checks || []) {
      const command = stack.commands && stack.commands[checkId];
      if (!command) {
        errors.push(`stack ${service.stack} does not define command for check ${checkId}`);
        continue;
      }
      const runnerKind = stack.runner_kind && stack.runner_kind[checkId];
      if (!runnerKind) {
        errors.push(`stack ${service.stack} does not define runner_kind for check ${checkId}`);
        continue;
      }
      const requiredTools = stack.required_tools && stack.required_tools[checkId];
      if (!Array.isArray(requiredTools)) {
        errors.push(`stack ${service.stack} does not define required_tools for check ${checkId}`);
        continue;
      }
      checks.push({
        id: checkId,
        profile: profileName,
        service: serviceId,
        service_path: service.path,
        service_required: service.required,
        stack: service.stack,
        runner_kind: runnerKind,
        command,
        required_tools: requiredTools,
      });
    }
  }

  return {
    errors,
    reason_code: errors.length > 0 ? 'profile-resolution-invalid' : 'profile-resolved',
    checks,
  };
}

function inferProfileFromPackageJson(repoRoot) {
  const packageJsonPath = path.join(repoRoot, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    return notConfigured('package-json-missing');
  }

  let packageJson;
  try {
    packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  } catch (error) {
    return {
      status: 'invalid',
      reason_code: 'package-json-unreadable',
      profile_source: 'inferred',
      profile_path: 'package.json',
      errors: [error.message],
      checks: [],
    };
  }

  const scripts = packageJson && packageJson.scripts && typeof packageJson.scripts === 'object'
    ? packageJson.scripts
    : {};
  const commands = {};
  for (const scriptName of INFERRED_SCRIPT_NAMES) {
    if (Object.prototype.hasOwnProperty.call(scripts, scriptName)) {
      commands[scriptName] = `npm run ${scriptName}`;
    }
  }

  if (Object.keys(commands).length === 0) {
    return notConfigured('verification-scripts-missing');
  }

  const runnerKind = {};
  const requiredTools = {};
  for (const checkId of Object.keys(commands)) {
    runnerKind[checkId] = 'npm-script';
    requiredTools[checkId] = ['node', 'npm'];
  }

  const profile = {
    schema_version: PROFILE_SCHEMA_VERSION,
    default_profile: 'inferred',
    profiles: {
      inferred: {
        services: ['root'],
        checks: Object.keys(commands),
      },
    },
    services: {
      root: {
        path: '.',
        stack: 'package-scripts',
        required: true,
      },
    },
    stacks: {
      'package-scripts': {
        detect: ['package.json'],
        runner_kind: runnerKind,
        required_tools: requiredTools,
        commands,
      },
    },
  };
  const resolved = resolveProfileChecks(profile);
  return {
    status: 'configured',
    reason_code: 'profile-inferred',
    profile_source: 'inferred',
    profile_path: 'package.json',
    default_profile: profile.default_profile,
    profile,
    checks: resolved.checks,
  };
}

function notConfigured(reasonCode) {
  return {
    status: 'not-configured',
    reason_code: reasonCode,
    profile_source: 'missing',
    profile_path: null,
    checks: [],
  };
}

function getProfileSchema() {
  if (!cachedSchema) {
    cachedSchema = JSON.parse(fs.readFileSync(PROFILE_SCHEMA_PATH, 'utf8'));
  }
  return cachedSchema;
}

module.exports = {
  EXPLICIT_PROFILE_PATH,
  INFERRED_SCRIPT_NAMES,
  LOCAL_CONFIG_ALIAS_PATH,
  LOCAL_PROFILE_PATH,
  PROFILE_SCHEMA_VERSION,
  inferProfileFromPackageJson,
  loadVerificationProfile,
  parseLocalYamlProfileAlias,
  resolveProfileChecks,
  validateProfileObject,
};
