const fs = require('node:fs');
const path = require('node:path');

const REQUIRED_MANAGED_STATE_ARRAY_FIELDS = [
  'commands',
  'skills',
  'workflowSkills',
  'agents',
  'agentSupportFiles',
];

function getStateFilePath(projectRoot, adapter) {
  return path.join(projectRoot, adapter.stateFile);
}

function readState(projectRoot, adapter) {
  const statePath = getStateFilePath(projectRoot, adapter);
  if (!fs.existsSync(statePath)) {
    return null;
  }

  const parsed = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  validateManagedStateShape(parsed);
  return normalizeState(parsed);
}

function readStateFileRaw(projectRoot, adapter) {
  const statePath = getStateFilePath(projectRoot, adapter);
  if (!fs.existsSync(statePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(statePath, 'utf8'));
}

function writeState(projectRoot, nextState, adapter) {
  const statePath = getStateFilePath(projectRoot, adapter);
  const normalized = normalizeState(nextState);
  validateManagedStateShape(normalized);
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
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
    workflowSkills: syncedAssets.workflowSkills,
    agents: syncedAssets.agents,
    agentSupportFiles: syncedAssets.agentSupportFiles,
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
    workflowSkills: normalizeStringArray(safe.workflowSkills),
    agents: normalizeStringArray(safe.agents),
    agentSupportFiles: normalizeStringArray(safe.agentSupportFiles),
  };
}

function validateManagedStateShape(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Invalid managed state: expected a JSON object');
  }

  if (typeof raw.manifestVersion !== 'string' || raw.manifestVersion.length === 0) {
    throw new Error('Invalid managed state: missing required string field "manifestVersion"');
  }

  for (const field of REQUIRED_MANAGED_STATE_ARRAY_FIELDS) {
    if (!(field in raw)) {
      throw new Error(`Invalid managed state: missing required array field "${field}"`);
    }

    if (!Array.isArray(raw[field])) {
      throw new Error(`Invalid managed state: field "${field}" must be an array`);
    }

    const invalidEntry = raw[field].find((entry) => typeof entry !== 'string' || entry.length === 0);
    if (invalidEntry !== undefined) {
      throw new Error(`Invalid managed state: field "${field}" must contain only non-empty strings`);
    }
  }
}

function isLegacyManagedState(raw) {
  return !!raw && typeof raw === 'object' && !Array.isArray(raw) && (
    REQUIRED_MANAGED_STATE_ARRAY_FIELDS.some((field) => !Array.isArray(raw[field]))
  );
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

  for (const skillName of state.workflowSkills) {
    removeDirectory(path.join(projectRoot, adapter.workflowsRoot, skillName), projectRoot);
  }

  for (const agentPath of state.agents) {
    removeFile(path.join(projectRoot, adapter.agentsRoot, agentPath), projectRoot);
  }

  for (const supportPath of state.agentSupportFiles) {
    removeFile(path.join(projectRoot, adapter.agentsRoot, supportPath), projectRoot);
  }

  if (state.developer && state.developer.path) {
    removeFile(path.join(projectRoot, state.developer.path), projectRoot);
  } else {
    removeFile(path.join(projectRoot, adapter.developerFile), projectRoot);
  }
}

function hardResetManagedAssets(projectRoot, managedState, adapter) {
  const state = normalizeState(managedState);
  removeManagedAssets(projectRoot, state, adapter);

  if (adapter.hasCommands) {
    removeDirectory(path.join(projectRoot, adapter.commandRoot), projectRoot);
  }

  if (adapter.workflowsRoot !== adapter.skillsRoot) {
    removeDirectory(path.join(projectRoot, adapter.workflowsRoot), projectRoot);
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

  for (const skillName of previous.workflowSkills.filter((entry) => !next.workflowSkills.includes(entry))) {
    removeDirectory(path.join(projectRoot, adapter.workflowsRoot, skillName), projectRoot);
  }

  for (const agentPath of previous.agents.filter((entry) => !next.agents.includes(entry))) {
    removeFile(path.join(projectRoot, adapter.agentsRoot, agentPath), projectRoot);
  }

  for (const supportPath of previous.agentSupportFiles.filter((entry) => !next.agentSupportFiles.includes(entry))) {
    removeFile(path.join(projectRoot, adapter.agentsRoot, supportPath), projectRoot);
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
  hardResetManagedAssets,
  isLegacyManagedState,
  pruneCommandNamespace,
  readStateFileRaw,
  readState,
  removeManagedAssets,
  removeObsoleteManagedAssets,
  writeState,
};
