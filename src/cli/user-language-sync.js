'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { writeFileAtomic } = require('./atomic-write');
const {
  USER_LANGUAGE_END,
  USER_LANGUAGE_START,
  buildUserLanguageBlock,
  removeMarkerBlock,
  upsertMarkerBlock,
} = require('./lang-policy');
const {
  effectiveCodexHome,
  resolveClaudeUserInstructionPath,
  samePhysicalPath,
} = require('./helpers/global-config-dir');
const {
  getGlobalDeveloperPath,
  readDeveloperFile,
  writeGlobalDeveloperFile,
} = require('./developer');

const USER_LANGUAGE_SYNC_SCHEMA = 'spec-first-user-language-sync-plan.v1';
const USER_LANGUAGE_HOSTS = ['codex', 'claude'];

function buildUserLanguageSyncPlan({
  projectRoot,
  platforms = [],
  lang = 'zh',
  preference = { value: null, source: 'unset' },
} = {}) {
  const normalizedPreference = normalizePreference(preference);
  const mode = resolveSyncMode(normalizedPreference);
  const targetHosts = mode === 'enable'
    ? normalizeHostList(platforms)
    : (mode === 'disable' ? USER_LANGUAGE_HOSTS : []);

  const operations = targetHosts.map((host) => buildHostOperation({
    host,
    mode,
    projectRoot,
    lang,
  }));
  const profileOperation = shouldPersistPreference(normalizedPreference)
    ? buildProfilePreferenceOperation(normalizedPreference.value)
    : null;

  return {
    schema_version: USER_LANGUAGE_SYNC_SCHEMA,
    mode,
    preference: normalizedPreference,
    lang: lang === 'en' ? 'en' : 'zh',
    operations,
    profileOperation,
  };
}

function applyUserLanguageSyncPlan(plan) {
  const normalized = normalizePlan(plan);
  if (normalized.mode === 'skipped') {
    return {
      exit_code: 0,
      status: 'skipped',
      reason_code: 'user-language-sync-unset',
      operations: [],
      profileOperation: null,
    };
  }

  const operations = normalized.operations.map((operation) => applyHostOperation(operation));
  const blockingOperation = operations.find((operation) => operation.status === 'failed' || operation.status === 'action-required');
  let profileOperation = normalized.profileOperation;
  // Opt-out must be remembered even when cleanup is incomplete so later init runs keep retrying removal.
  const shouldSkipProfileWrite = profileOperation && blockingOperation && normalized.preference.value !== false;
  if (shouldSkipProfileWrite) {
    profileOperation = {
      ...profileOperation,
      action: 'skipped',
      status: 'skipped',
      reason: 'user-language-ops-not-ready',
    };
  } else if (profileOperation) {
    profileOperation = applyProfilePreferenceOperation(profileOperation);
  }

  const failedProfile = profileOperation && profileOperation.status === 'failed';
  const status = blockingOperation || failedProfile ? 'action-required' : 'ready';
  const reasonCode = blockingOperation
    ? blockingOperation.reason
    : (failedProfile ? profileOperation.reason : null);

  return {
    exit_code: status === 'ready' ? 0 : 1,
    status,
    reason_code: reasonCode,
    operations,
    profileOperation,
  };
}

function buildHostOperation({ host, mode, projectRoot, lang }) {
  const target = resolveUserLanguageTarget(host);
  const projectInstructionPath = path.join(
    path.resolve(projectRoot || process.cwd()),
    host === 'claude' ? 'CLAUDE.md' : 'AGENTS.md',
  );
  const baseOperation = {
    host,
    mode,
    action: 'noop',
    status: 'planned',
    reason: '',
    absolutePath: target.absolutePath,
    displayPath: target.displayPath,
    basis: target.basis,
    lang: lang === 'en' ? 'en' : 'zh',
  };

  if (samePhysicalPath(projectInstructionPath, target.absolutePath)) {
    return {
      ...baseOperation,
      action: 'failed',
      status: 'failed',
      reason: 'same-physical-path-collision',
    };
  }

  if (mode === 'enable' && host === 'codex') {
    const override = resolveCodexOverridePath();
    if (isNonEmptyFile(override.absolutePath)) {
      return {
        ...baseOperation,
        action: 'action-required',
        status: 'action-required',
        reason: 'codex-global-override-active',
        overridePath: override.absolutePath,
        overrideDisplayPath: override.displayPath,
      };
    }
  }

  if (mode === 'enable') {
    return buildEnableOperation(baseOperation);
  }

  return buildDisableOperation(baseOperation);
}

function buildEnableOperation(baseOperation) {
  const block = buildUserLanguageBlock(baseOperation.lang);
  const read = readExistingUserInstruction(baseOperation.absolutePath);
  if (read.error) {
    return buildUnreadableOperation(baseOperation, read.error);
  }
  const nextContents = upsertMarkerBlock(read.contents, block, USER_LANGUAGE_START, USER_LANGUAGE_END);
  if (read.exists && nextContents === read.contents) {
    return {
      ...baseOperation,
      action: 'noop',
      status: 'ready',
      reason: 'already-current',
    };
  }
  return {
    ...baseOperation,
    action: read.exists ? 'write' : 'create',
    status: 'planned',
    reason: read.exists ? 'managed-block-update' : 'missing-target-create',
    contents: nextContents,
  };
}

function buildDisableOperation(baseOperation) {
  const read = readExistingUserInstruction(baseOperation.absolutePath);
  if (read.error) {
    return buildUnreadableOperation(baseOperation, read.error);
  }
  if (!read.exists) {
    return {
      ...baseOperation,
      action: 'missing/no-op',
      status: 'ready',
      reason: 'missing-target',
    };
  }
  const nextContents = removeMarkerBlock(read.contents, USER_LANGUAGE_START, USER_LANGUAGE_END);
  if (nextContents === read.contents) {
    return {
      ...baseOperation,
      action: 'noop',
      status: 'ready',
      reason: 'managed-block-absent',
    };
  }
  return {
    ...baseOperation,
    action: 'remove',
    status: 'planned',
    reason: 'managed-block-remove',
    contents: nextContents,
  };
}

function readExistingUserInstruction(filePath) {
  if (!fs.existsSync(filePath)) {
    return {
      exists: false,
      contents: '',
      error: null,
    };
  }
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) {
      return {
        exists: true,
        contents: '',
        error: 'target is not a regular file',
      };
    }
    return {
      exists: true,
      contents: fs.readFileSync(filePath, 'utf8'),
      error: null,
    };
  } catch (error) {
    return {
      exists: true,
      contents: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function buildUnreadableOperation(baseOperation, error) {
  return {
    ...baseOperation,
    action: 'failed',
    status: 'failed',
    reason: 'user-language-target-unreadable',
    error,
  };
}

function applyHostOperation(operation) {
  if (!operation || operation.status === 'failed' || operation.status === 'action-required') {
    return operation;
  }
  if (operation.status === 'ready' || operation.action === 'noop' || operation.action === 'missing/no-op') {
    return {
      ...operation,
      status: 'ready',
    };
  }

  try {
    if (operation.action === 'create' || operation.action === 'write') {
      const contents = buildCurrentEnableContents(operation);
      if (contents.status === 'ready') {
        return {
          ...operation,
          action: 'noop',
          status: 'ready',
          reason: 'already-current',
          contents: contents.contents,
        };
      }
      fs.mkdirSync(path.dirname(operation.absolutePath), { recursive: true });
      writeFileAtomic(operation.absolutePath, contents.contents, 'utf8');
      return {
        ...operation,
        action: contents.existed ? 'write' : 'create',
        contents: contents.contents,
        status: 'ready',
      };
    }
    if (operation.action === 'remove') {
      const contents = buildCurrentDisableContents(operation);
      if (contents.status === 'missing') {
        return {
          ...operation,
          action: 'missing/no-op',
          status: 'ready',
          reason: 'missing-target',
          contents: '',
        };
      }
      if (contents.status === 'ready') {
        return {
          ...operation,
          action: 'noop',
          status: 'ready',
          reason: 'managed-block-absent',
          contents: contents.contents,
        };
      }
      writeFileAtomic(operation.absolutePath, contents.contents, 'utf8');
      return {
        ...operation,
        contents: contents.contents,
        status: 'ready',
      };
    }
  } catch (error) {
    return {
      ...operation,
      status: 'failed',
      reason: operation.action === 'remove' ? 'user-language-cleanup-failed' : 'user-language-write-failed',
      error: error instanceof Error ? error.message : String(error),
    };
  }

  return {
    ...operation,
    status: 'ready',
  };
}

function buildCurrentEnableContents(operation) {
  const exists = fs.existsSync(operation.absolutePath);
  const existing = exists ? fs.readFileSync(operation.absolutePath, 'utf8') : '';
  const block = buildUserLanguageBlock(operation.lang);
  const nextContents = upsertMarkerBlock(existing, block, USER_LANGUAGE_START, USER_LANGUAGE_END);
  if (exists && nextContents === existing) {
    return { status: 'ready', existed: true, contents: existing };
  }
  return { status: 'planned', existed: exists, contents: nextContents };
}

function buildCurrentDisableContents(operation) {
  if (!fs.existsSync(operation.absolutePath)) {
    return { status: 'missing', contents: '' };
  }
  const existing = fs.readFileSync(operation.absolutePath, 'utf8');
  const nextContents = removeMarkerBlock(existing, USER_LANGUAGE_START, USER_LANGUAGE_END);
  if (nextContents === existing) {
    return { status: 'ready', contents: existing };
  }
  return { status: 'planned', contents: nextContents };
}

function buildProfilePreferenceOperation(value) {
  const existing = readDeveloperFile(getGlobalDeveloperPath());
  const existingValue = existing && typeof existing.syncUserLanguage === 'boolean'
    ? existing.syncUserLanguage
    : null;
  const nextDeveloper = {
    ...(existing || {}),
    syncUserLanguage: value,
  };

  return {
    action: existingValue === value ? 'preserve' : 'write',
    status: 'planned',
    reason: existingValue === value ? 'already-current' : 'sync-preference-update',
    globalPath: '~/.spec-first/.developer',
    value,
    developer: nextDeveloper,
  };
}

function applyProfilePreferenceOperation(operation) {
  if (!operation || operation.action === 'preserve') {
    return operation ? { ...operation, status: 'ready' } : null;
  }
  try {
    const existing = readDeveloperFile(getGlobalDeveloperPath());
    const nextDeveloper = {
      ...(operation.developer || {}),
      ...(existing || {}),
      syncUserLanguage: operation.value,
    };
    writeGlobalDeveloperFile(nextDeveloper);
    return {
      ...operation,
      developer: nextDeveloper,
      status: 'ready',
    };
  } catch (error) {
    return {
      ...operation,
      status: 'failed',
      reason: 'user-language-profile-write-failed',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function resolveUserLanguageTarget(host) {
  if (host === 'claude') {
    return resolveClaudeUserInstructionPath();
  }

  const codexHome = effectiveCodexHome();
  return {
    absolutePath: path.join(codexHome, 'AGENTS.md'),
    displayPath: displayCodexPath('AGENTS.md'),
    basis: 'codex-home-agents-md',
  };
}

function resolveCodexOverridePath() {
  return {
    absolutePath: path.join(effectiveCodexHome(), 'AGENTS.override.md'),
    displayPath: displayCodexPath('AGENTS.override.md'),
    basis: 'codex-home-agents-override-md',
  };
}

function displayCodexPath(filename) {
  const fromEnv = process.env.CODEX_HOME;
  if (fromEnv && fromEnv.trim() !== '') {
    return `$CODEX_HOME/${filename}`;
  }
  return `~/.codex/${filename}`;
}

function isNonEmptyFile(filePath) {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile() && fs.readFileSync(filePath, 'utf8').trim().length > 0;
  } catch {
    return false;
  }
}

function normalizePreference(preference) {
  if (!preference || typeof preference !== 'object') {
    return { value: null, source: 'unset' };
  }
  const value = typeof preference.value === 'boolean' ? preference.value : null;
  return {
    value,
    source: preference.source || (value === null ? 'unset' : 'unknown'),
  };
}

function resolveSyncMode(preference) {
  if (preference.value === true) {
    return 'enable';
  }
  if (preference.value === false) {
    return 'disable';
  }
  return 'skipped';
}

function shouldPersistPreference(preference) {
  return typeof preference.value === 'boolean' && ['explicit', 'interactive'].includes(preference.source);
}

function normalizeHostList(platforms) {
  const selected = Array.isArray(platforms) ? platforms : [];
  const supported = selected.filter((host) => USER_LANGUAGE_HOSTS.includes(host));
  return [...new Set(supported)].sort((left, right) => USER_LANGUAGE_HOSTS.indexOf(left) - USER_LANGUAGE_HOSTS.indexOf(right));
}

function normalizePlan(plan) {
  if (!plan || typeof plan !== 'object') {
    return {
      schema_version: USER_LANGUAGE_SYNC_SCHEMA,
      mode: 'skipped',
      preference: { value: null, source: 'unset' },
      operations: [],
      profileOperation: null,
    };
  }
  return {
    schema_version: USER_LANGUAGE_SYNC_SCHEMA,
    mode: plan.mode || 'skipped',
    preference: normalizePreference(plan.preference),
    operations: Array.isArray(plan.operations) ? plan.operations : [],
    profileOperation: plan.profileOperation || null,
  };
}

module.exports = {
  USER_LANGUAGE_HOSTS,
  applyUserLanguageSyncPlan,
  buildUserLanguageSyncPlan,
  resolveCodexOverridePath,
  resolveUserLanguageTarget,
};
