const fs = require('node:fs');
const path = require('node:path');

const STATE_DIR = path.join('.claude', 'spec-first');
const STATE_FILE = path.join(STATE_DIR, 'state.json');

function getStateFilePath(projectRoot) {
  return path.join(projectRoot, STATE_FILE);
}

function readState(projectRoot) {
  const statePath = getStateFilePath(projectRoot);
  if (!fs.existsSync(statePath)) {
    return null;
  }

  const parsed = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  return normalizeState(parsed);
}

function writeState(projectRoot, nextState) {
  const statePath = getStateFilePath(projectRoot);
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, `${JSON.stringify(normalizeState(nextState), null, 2)}\n`, 'utf8');
}

function clearState(projectRoot) {
  const statePath = getStateFilePath(projectRoot);
  fs.rmSync(statePath, { force: true });
  removeEmptyParents(path.dirname(statePath), projectRoot);
}

function buildState(manifestVersion, syncedAssets) {
  return normalizeState({
    manifestVersion,
    commands: syncedAssets.commands.map((entry) => entry.filename),
    skills: syncedAssets.skills,
    agents: syncedAssets.agents,
  });
}

function normalizeState(raw) {
  const safe = raw && typeof raw === 'object' ? raw : {};
  return {
    manifestVersion: typeof safe.manifestVersion === 'string' ? safe.manifestVersion : '',
    commands: normalizeStringArray(safe.commands),
    skills: normalizeStringArray(safe.skills),
    agents: normalizeStringArray(safe.agents),
  };
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.filter((entry) => typeof entry === 'string' && entry.length > 0))].sort(
    (a, b) => a.localeCompare(b),
  );
}

function removeManagedAssets(projectRoot, managedState) {
  const state = normalizeState(managedState);

  for (const commandFile of state.commands) {
    removeFile(path.join(projectRoot, '.claude', 'commands', 'spec', commandFile), projectRoot);
  }

  for (const skillName of state.skills) {
    removeDirectory(path.join(projectRoot, '.claude', 'skills', skillName), projectRoot);
  }

  for (const agentPath of state.agents) {
    removeFile(path.join(projectRoot, '.claude', 'agents', agentPath), projectRoot);
  }
}

function removeObsoleteManagedAssets(projectRoot, previousState, nextState) {
  const previous = normalizeState(previousState);
  const next = normalizeState(nextState);

  for (const commandFile of previous.commands.filter((entry) => !next.commands.includes(entry))) {
    removeFile(path.join(projectRoot, '.claude', 'commands', 'spec', commandFile), projectRoot);
  }

  for (const skillName of previous.skills.filter((entry) => !next.skills.includes(entry))) {
    removeDirectory(path.join(projectRoot, '.claude', 'skills', skillName), projectRoot);
  }

  for (const agentPath of previous.agents.filter((entry) => !next.agents.includes(entry))) {
    removeFile(path.join(projectRoot, '.claude', 'agents', agentPath), projectRoot);
  }
}

function pruneCommandNamespace(projectRoot, managedCommandFiles) {
  const commandDir = path.join(projectRoot, '.claude', 'commands', 'spec');
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
