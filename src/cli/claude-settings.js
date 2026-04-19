const fs = require('node:fs');
const path = require('node:path');

const SETTINGS_RELATIVE_PATH = '.claude/settings.json';
const SESSION_START_MATCHER = 'startup|resume|clear|compact';
const SESSION_START_COMMAND = '"$CLAUDE_PROJECT_DIR"/.claude/hooks/session-start';
const MANAGED_HOOK_PATH_PATTERN = /(^|[^A-Za-z0-9_])\.claude\/hooks\/session-start(\s|"|$)/;

function buildManagedSessionStartMatcher() {
  return {
    matcher: SESSION_START_MATCHER,
    hooks: [
      {
        type: 'command',
        command: SESSION_START_COMMAND,
      },
    ],
  };
}

function isSpecFirstManagedHook(hook) {
  return !!hook &&
    typeof hook === 'object' &&
    hook.type === 'command' &&
    typeof hook.command === 'string' &&
    MANAGED_HOOK_PATH_PATTERN.test(hook.command);
}

function upsertManagedSessionStartHook(projectRoot) {
  const rendered = renderManagedSessionStartHookUpsert(projectRoot);
  writeRenderedSettings(projectRoot, rendered);
  return true;
}

function renderManagedSessionStartHookUpsert(projectRoot) {
  const filePath = getClaudeSettingsPath(projectRoot);
  const settings = readSettingsFile(filePath);
  const next = removeManagedHookEntries(settings);

  if (!next.hooks || typeof next.hooks !== 'object' || Array.isArray(next.hooks)) {
    next.hooks = {};
  }

  const sessionStart = Array.isArray(next.hooks.SessionStart) ? [...next.hooks.SessionStart] : [];
  sessionStart.push(buildManagedSessionStartMatcher());
  next.hooks.SessionStart = sessionStart;

  return {
    filePath,
    existsAfter: true,
    contents: `${JSON.stringify(next, null, 2)}\n`,
  };
}

function validateClaudeSettingsFile(projectRoot) {
  readSettingsFile(getClaudeSettingsPath(projectRoot));
}

function removeManagedSessionStartHook(projectRoot) {
  const rendered = renderManagedSessionStartHookRemoval(projectRoot);
  if (!rendered) {
    return false;
  }

  writeRenderedSettings(projectRoot, rendered);
  return true;
}

function renderManagedSessionStartHookRemoval(projectRoot) {
  const filePath = getClaudeSettingsPath(projectRoot);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const settings = readSettingsFile(filePath);
  const next = removeManagedHookEntries(settings);

  if (Object.keys(next).length === 0) {
    return {
      filePath,
      existsAfter: false,
      contents: null,
    };
  }

  return {
    filePath,
    existsAfter: true,
    contents: `${JSON.stringify(next, null, 2)}\n`,
  };
}

function inspectManagedSessionStartHook(projectRoot) {
  const filePath = getClaudeSettingsPath(projectRoot);
  if (!fs.existsSync(filePath)) {
    return {
      status: 'missing',
      message: 'settings file missing',
    };
  }

  let settings;
  try {
    settings = readSettingsFile(filePath);
  } catch (error) {
    return {
      status: 'partial',
      message: error instanceof Error ? error.message : String(error),
    };
  }

  if (!settings.hooks || typeof settings.hooks !== 'object' || Array.isArray(settings.hooks)) {
    return {
      status: 'missing',
      message: '`hooks` object missing',
    };
  }

  const sessionStart = settings.hooks.SessionStart;
  if (!Array.isArray(sessionStart)) {
    return {
      status: 'missing',
      message: '`hooks.SessionStart` array missing',
    };
  }

  const managedMatchers = sessionStart.filter((matcher) => matcherContainsManagedHook(matcher));
  if (managedMatchers.length === 0) {
    return {
      status: 'missing',
      message: 'managed SessionStart matcher missing',
    };
  }

  if (managedMatchers.length !== 1) {
    return {
      status: 'drifted',
      message: `expected 1 managed SessionStart matcher, found ${managedMatchers.length}`,
    };
  }

  if (!isManagedMatcherEqual(managedMatchers[0], buildManagedSessionStartMatcher())) {
    return {
      status: 'drifted',
      message: 'managed SessionStart matcher drifted from the bundled template',
    };
  }

  return {
    status: 'installed',
    message: 'managed SessionStart matcher present',
  };
}

function getClaudeSettingsPath(projectRoot) {
  return path.join(projectRoot, SETTINGS_RELATIVE_PATH);
}

function readSettingsFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Claude settings must be a JSON object');
  }
  return parsed;
}

function writeSettingsFile(filePath, settings) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
  fs.renameSync(tmpPath, filePath);
}

function writeRenderedSettings(projectRoot, rendered) {
  if (!rendered) {
    return;
  }

  if (!rendered.existsAfter) {
    fs.rmSync(rendered.filePath, { force: true });
    removeEmptyParents(path.dirname(rendered.filePath), projectRoot);
    return;
  }

  fs.mkdirSync(path.dirname(rendered.filePath), { recursive: true });
  const tmpPath = `${rendered.filePath}.tmp`;
  fs.writeFileSync(tmpPath, rendered.contents || '', 'utf8');
  fs.renameSync(tmpPath, rendered.filePath);
}

function removeManagedHookEntries(settings) {
  const next = cloneJson(settings);
  const hooksRoot = next.hooks;
  if (!hooksRoot || typeof hooksRoot !== 'object' || Array.isArray(hooksRoot)) {
    return next;
  }

  const sessionStart = hooksRoot.SessionStart;
  if (!Array.isArray(sessionStart)) {
    return next;
  }

  const remainingMatchers = [];
  for (const matcher of sessionStart) {
    if (!matcher || typeof matcher !== 'object' || Array.isArray(matcher) || !Array.isArray(matcher.hooks)) {
      remainingMatchers.push(matcher);
      continue;
    }

    const remainingHooks = matcher.hooks.filter((hook) => !isSpecFirstManagedHook(hook));
    if (remainingHooks.length === 0) {
      continue;
    }

    if (remainingHooks.length === matcher.hooks.length) {
      remainingMatchers.push(matcher);
      continue;
    }

    remainingMatchers.push({
      ...matcher,
      hooks: remainingHooks,
    });
  }

  if (remainingMatchers.length > 0) {
    hooksRoot.SessionStart = remainingMatchers;
  } else {
    delete hooksRoot.SessionStart;
  }

  if (Object.keys(hooksRoot).length === 0) {
    delete next.hooks;
  }

  return next;
}

function matcherContainsManagedHook(matcher) {
  return !!matcher &&
    typeof matcher === 'object' &&
    !Array.isArray(matcher) &&
    Array.isArray(matcher.hooks) &&
    matcher.hooks.some((hook) => isSpecFirstManagedHook(hook));
}

function isManagedMatcherEqual(actual, expected) {
  return !!actual &&
    typeof actual === 'object' &&
    !Array.isArray(actual) &&
    actual.matcher === expected.matcher &&
    Array.isArray(actual.hooks) &&
    actual.hooks.length === 1 &&
    !!actual.hooks[0] &&
    typeof actual.hooks[0] === 'object' &&
    !Array.isArray(actual.hooks[0]) &&
    actual.hooks[0].type === expected.hooks[0].type &&
    actual.hooks[0].command === expected.hooks[0].command &&
    Object.keys(actual).length === Object.keys(expected).length &&
    Object.keys(actual.hooks[0]).length === Object.keys(expected.hooks[0]).length;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function removeEmptyParents(startPath, stopRoot) {
  let current = startPath;
  while (current.startsWith(stopRoot) && current !== stopRoot) {
    if (!fs.existsSync(current)) {
      current = path.dirname(current);
      continue;
    }

    if (fs.readdirSync(current).length > 0) {
      break;
    }

    fs.rmdirSync(current);
    current = path.dirname(current);
  }
}

module.exports = {
  SESSION_START_COMMAND,
  SESSION_START_MATCHER,
  buildManagedSessionStartMatcher,
  getClaudeSettingsPath,
  inspectManagedSessionStartHook,
  isSpecFirstManagedHook,
  removeManagedSessionStartHook,
  renderManagedSessionStartHookRemoval,
  renderManagedSessionStartHookUpsert,
  upsertManagedSessionStartHook,
  validateClaudeSettingsFile,
};
