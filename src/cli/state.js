const fs = require('node:fs');
const path = require('node:path');

function getStateFilePath(projectRoot, adapter) {
  return path.join(projectRoot, adapter.stateFile);
}

function readState(projectRoot, adapter) {
  const statePath = getStateFilePath(projectRoot, adapter);
  if (!fs.existsSync(statePath)) {
    return null;
  }

  const parsed = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  return normalizeState(parsed);
}

function writeState(projectRoot, nextState, adapter) {
  const statePath = getStateFilePath(projectRoot, adapter);
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, `${JSON.stringify(normalizeState(nextState), null, 2)}\n`, 'utf8');
}

function clearState(projectRoot, adapter) {
  const statePath = getStateFilePath(projectRoot, adapter);
  fs.rmSync(statePath, { force: true });
  removeEmptyParents(path.dirname(statePath), projectRoot);
}

function buildState(manifestVersion, syncedAssets) {
  const developer = syncedAssets.developer ? normalizeDeveloper(syncedAssets.developer) : null;
  return normalizeState({
    manifestVersion,
    platform: syncedAssets.platform || '',
    developer,
    commands: syncedAssets.commands.map((entry) => entry.filename),
    skills: syncedAssets.skills,
    agents: syncedAssets.agents,
  });
}

function normalizeState(raw) {
  const safe = raw && typeof raw === 'object' ? raw : {};
  return {
    manifestVersion: typeof safe.manifestVersion === 'string' ? safe.manifestVersion : '',
    platform: typeof safe.platform === 'string' ? safe.platform : '',
    developer: normalizeDeveloper(safe.developer),
    commands: normalizeStringArray(safe.commands),
    skills: normalizeStringArray(safe.skills),
    agents: normalizeStringArray(safe.agents),
  };
}

function normalizeDeveloper(value) {
  const safe = value && typeof value === 'object' ? value : null;
  if (!safe) {
    return null;
  }

  const developer = {
    path: typeof safe.path === 'string' && safe.path.length > 0 ? safe.path : '',
    name: typeof safe.name === 'string' && safe.name.length > 0 ? safe.name : '',
    lang: typeof safe.lang === 'string' && safe.lang.length > 0 ? safe.lang : '',
    initializedAt:
      typeof safe.initializedAt === 'string' && safe.initializedAt.length > 0
        ? safe.initializedAt
        : typeof safe.initialized_at === 'string' && safe.initialized_at.length > 0
          ? safe.initialized_at
        : '',
    version: typeof safe.version === 'string' && safe.version.length > 0 ? safe.version : '',
  };

  if (
    !developer.path &&
    !developer.name &&
    !developer.lang &&
    !developer.initializedAt &&
    !developer.version
  ) {
    return null;
  }

  return developer;
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.filter((entry) => typeof entry === 'string' && entry.length > 0))].sort(
    (a, b) => a.localeCompare(b),
  );
}

function removeManagedAssets(projectRoot, managedState, adapter) {
  const state = normalizeState(managedState);

  for (const commandFile of state.commands) {
    removeFile(path.join(projectRoot, adapter.commandRoot, commandFile), projectRoot);
  }

  for (const skillName of state.skills) {
    removeDirectory(path.join(projectRoot, adapter.skillsRoot, skillName), projectRoot);
  }

  removeDirectory(path.join(projectRoot, adapter.workflowsRoot), projectRoot);

  for (const agentPath of state.agents) {
    removeFile(path.join(projectRoot, adapter.agentsRoot, agentPath), projectRoot);
  }

  if (state.developer && state.developer.path) {
    removeFile(path.join(projectRoot, state.developer.path), projectRoot);
  } else {
    removeFile(path.join(projectRoot, adapter.developerFile), projectRoot);
  }
}

function removeObsoleteManagedAssets(projectRoot, previousState, nextState, adapter) {
  const previous = normalizeState(previousState);
  const next = normalizeState(nextState);

  for (const commandFile of previous.commands.filter((entry) => !next.commands.includes(entry))) {
    removeFile(path.join(projectRoot, adapter.commandRoot, commandFile), projectRoot);
  }

  for (const skillName of previous.skills.filter((entry) => !next.skills.includes(entry))) {
    removeDirectory(path.join(projectRoot, adapter.skillsRoot, skillName), projectRoot);
  }

  for (const agentPath of previous.agents.filter((entry) => !next.agents.includes(entry))) {
    removeFile(path.join(projectRoot, adapter.agentsRoot, agentPath), projectRoot);
  }

  if (previous.developer && previous.developer.path) {
    const nextDeveloperPath = next.developer && next.developer.path ? next.developer.path : '';
    if (previous.developer.path !== nextDeveloperPath) {
      removeFile(path.join(projectRoot, previous.developer.path), projectRoot);
    }
  }
}

function pruneCommandNamespace(projectRoot, managedCommandFiles, adapter) {
  const commandDir = path.join(projectRoot, adapter.commandRoot);
  if (!fs.existsSync(commandDir)) {
    return;
  }

  const allowed = new Set(normalizeStringArray(managedCommandFiles));
  for (const entry of fs.readdirSync(commandDir, { withFileTypes: true })) {
    if (!entry.isFile()) {
      continue;
    }

    if (!allowed.has(entry.name)) {
      removeFile(path.join(commandDir, entry.name), projectRoot);
    }
  }
}

function removeFile(filePath, projectRoot) {
  fs.rmSync(filePath, { force: true });
  removeEmptyParents(path.dirname(filePath), projectRoot);
}

function removeDirectory(directoryPath, projectRoot) {
  fs.rmSync(directoryPath, { recursive: true, force: true });
  removeEmptyParents(path.dirname(directoryPath), projectRoot);
}

function removeEmptyParents(startPath, stopRoot) {
  let current = startPath;
  while (current.startsWith(stopRoot) && current !== stopRoot) {
    if (!fs.existsSync(current)) {
      current = path.dirname(current);
      continue;
    }

    const entries = fs.readdirSync(current);
    if (entries.length > 0) {
      break;
    }

    fs.rmdirSync(current);
    current = path.dirname(current);
  }
}

module.exports = {
  buildState,
  clearState,
  getStateFilePath,
  pruneCommandNamespace,
  readState,
  removeManagedAssets,
  removeObsoleteManagedAssets,
  writeState,
};
