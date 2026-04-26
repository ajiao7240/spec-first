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
    skills: normalizeStringArray([
      ...(Array.isArray(syncedAssets.skills) ? syncedAssets.skills : []),
      ...(Array.isArray(syncedAssets.internalSkills) ? syncedAssets.internalSkills : []),
    ]),
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

function buildEmptyOperationPlan() {
  return {
    operations: [],
    summary: {},
  };
}

function normalizeOperationPath(filePath) {
  return String(filePath || '').replace(/\\/g, '/');
}

function mergeOperationPlans(...plans) {
  const merged = buildEmptyOperationPlan();
  const seen = new Set();

  for (const plan of plans) {
    if (!plan || !Array.isArray(plan.operations)) {
      continue;
    }

    for (const operation of plan.operations) {
      const key = `${operation.kind}:${operation.path}`;
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      merged.operations.push({ ...operation });
    }
  }

  merged.summary = summarizeOperations(merged.operations);
  return merged;
}

function summarizeOperations(operations) {
  const summary = {};
  for (const operation of operations) {
    summary[operation.kind] = (summary[operation.kind] || 0) + 1;
  }
  return summary;
}

function summarizeOperationPlan(operations) {
  return summarizeOperations(operations);
}

function buildRelativeOperation(kind, relativePath, reason, extra = {}) {
  return {
    kind,
    path: normalizeOperationPath(relativePath),
    reason,
    ...extra,
  };
}

function buildOperation(kind, absolutePath, projectRoot, reason) {
  return buildRelativeOperation(kind, toRelativeProjectPath(absolutePath, projectRoot), reason);
}

function toRelativeProjectPath(absolutePath, projectRoot) {
  const relative = path.relative(projectRoot, absolutePath);
  return normalizeOperationPath(relative.length > 0 ? relative : '.');
}

function buildFileWriteOperation(projectRoot, absolutePath, contents, reason, mode, encoding) {
  const extra = { contents };
  if (typeof mode === 'number') {
    extra.mode = mode;
  }
  if (encoding) {
    extra.encoding = encoding;
  }

  return buildRelativeOperation(
    fs.existsSync(absolutePath) ? 'update_file' : 'write_file',
    toRelativeProjectPath(absolutePath, projectRoot),
    reason,
    extra,
  );
}

function planManagedAssetRemoval(projectRoot, managedState, adapter) {
  const state = normalizeState(managedState);
  const operations = [];

  for (const commandFile of state.commands) {
    operations.push(
      buildOperation(
        'remove_file',
        path.join(projectRoot, adapter.commandRoot, commandFile),
        projectRoot,
        'managed_command',
      ),
    );
  }

  for (const skillName of state.skills) {
    operations.push(
      buildOperation(
        'remove_dir',
        path.join(projectRoot, adapter.skillsRoot, skillName),
        projectRoot,
        'managed_skill',
      ),
    );
  }

  for (const skillName of state.workflowSkills) {
    operations.push(
      buildOperation(
        'remove_dir',
        path.join(projectRoot, adapter.workflowsRoot, skillName),
        projectRoot,
        'managed_workflow_skill',
      ),
    );
  }

  for (const agentPath of state.agents) {
    operations.push(
      buildOperation(
        'remove_file',
        path.join(projectRoot, adapter.agentsRoot, agentPath),
        projectRoot,
        'managed_agent',
      ),
    );
  }

  for (const supportPath of state.agentSupportFiles) {
    operations.push(
      buildOperation(
        'remove_file',
        path.join(projectRoot, adapter.agentsRoot, supportPath),
        projectRoot,
        'managed_agent_support_file',
      ),
    );
  }

  if (state.developer && state.developer.path) {
    operations.push(
      buildOperation(
        'remove_file',
        path.join(projectRoot, state.developer.path),
        projectRoot,
        'managed_developer_profile',
      ),
    );
  } else {
    operations.push(
      buildOperation(
        'remove_file',
        path.join(projectRoot, adapter.developerFile),
        projectRoot,
        'managed_developer_profile',
      ),
    );
  }

  return {
    operations,
    summary: summarizeOperations(operations),
  };
}

function removeManagedAssets(projectRoot, managedState, adapter) {
  applyOperationPlan(projectRoot, planManagedAssetRemoval(projectRoot, managedState, adapter));
}

function planHardResetManagedAssets(projectRoot, managedState, adapter) {
  const operations = [...planManagedAssetRemoval(projectRoot, managedState, adapter).operations];

  if (adapter.hasCommands) {
    operations.push(
      buildOperation(
        'remove_dir',
        path.join(projectRoot, adapter.commandRoot),
        projectRoot,
        'managed_command_root_reset',
      ),
    );
  }

  if (adapter.workflowsRoot !== adapter.skillsRoot) {
    operations.push(
      buildOperation(
        'remove_dir',
        path.join(projectRoot, adapter.workflowsRoot),
        projectRoot,
        'managed_workflow_root_reset',
      ),
    );
  }

  return {
    operations,
    summary: summarizeOperations(operations),
  };
}

function hardResetManagedAssets(projectRoot, managedState, adapter) {
  applyOperationPlan(projectRoot, planHardResetManagedAssets(projectRoot, managedState, adapter));
}

function planObsoleteManagedAssetRemoval(projectRoot, previousState, nextState, adapter) {
  const previous = normalizeState(previousState);
  const next = normalizeState(nextState);
  const operations = [];

  for (const commandFile of previous.commands.filter((entry) => !next.commands.includes(entry))) {
    operations.push(
      buildOperation(
        'remove_file',
        path.join(projectRoot, adapter.commandRoot, commandFile),
        projectRoot,
        'obsolete_managed_command',
      ),
    );
  }

  for (const skillName of previous.skills.filter((entry) => !next.skills.includes(entry))) {
    operations.push(
      buildOperation(
        'remove_dir',
        path.join(projectRoot, adapter.skillsRoot, skillName),
        projectRoot,
        'obsolete_managed_skill',
      ),
    );
  }

  for (const skillName of previous.workflowSkills.filter((entry) => !next.workflowSkills.includes(entry))) {
    operations.push(
      buildOperation(
        'remove_dir',
        path.join(projectRoot, adapter.workflowsRoot, skillName),
        projectRoot,
        'obsolete_workflow_skill',
      ),
    );
  }

  for (const agentPath of previous.agents.filter((entry) => !next.agents.includes(entry))) {
    operations.push(
      buildOperation(
        'remove_file',
        path.join(projectRoot, adapter.agentsRoot, agentPath),
        projectRoot,
        'obsolete_managed_agent',
      ),
    );
  }

  for (const supportPath of previous.agentSupportFiles.filter((entry) => !next.agentSupportFiles.includes(entry))) {
    operations.push(
      buildOperation(
        'remove_file',
        path.join(projectRoot, adapter.agentsRoot, supportPath),
        projectRoot,
        'obsolete_managed_agent_support_file',
      ),
    );
  }

  if (previous.developer && previous.developer.path) {
    const nextDeveloperPath = next.developer && next.developer.path ? next.developer.path : '';
    if (previous.developer.path !== nextDeveloperPath) {
      operations.push(
        buildOperation(
          'remove_file',
          path.join(projectRoot, previous.developer.path),
          projectRoot,
          'obsolete_developer_profile',
        ),
      );
    }
  }

  return {
    operations,
    summary: summarizeOperations(operations),
  };
}

function removeObsoleteManagedAssets(projectRoot, previousState, nextState, adapter) {
  applyOperationPlan(projectRoot, planObsoleteManagedAssetRemoval(projectRoot, previousState, nextState, adapter));
}

function planCommandNamespacePrune(projectRoot, managedCommandFiles, adapter) {
  const commandDir = path.join(projectRoot, adapter.commandRoot);
  if (!fs.existsSync(commandDir)) {
    return buildEmptyOperationPlan();
  }

  const operations = [];
  const allowed = new Set(normalizeStringArray(managedCommandFiles));
  for (const entry of fs.readdirSync(commandDir, { withFileTypes: true })) {
    if (!entry.isFile()) {
      continue;
    }

    if (!allowed.has(entry.name)) {
      operations.push(
        buildOperation(
          'prune_command',
          path.join(commandDir, entry.name),
          projectRoot,
          'namespace_not_managed',
        ),
      );
    }
  }

  return {
    operations,
    summary: summarizeOperations(operations),
  };
}

function pruneCommandNamespace(projectRoot, managedCommandFiles, adapter) {
  applyOperationPlan(projectRoot, planCommandNamespacePrune(projectRoot, managedCommandFiles, adapter));
}

function planEmptyManagedRootCleanup(projectRoot, adapter) {
  const relativePaths = [adapter.skillsRoot, adapter.agentsRoot];
  if (adapter.hasCommands) {
    relativePaths.unshift(adapter.commandRoot);
  }

  const operations = [];
  for (const relativePath of relativePaths) {
    const absolutePath = path.join(projectRoot, relativePath);
    if (!fs.existsSync(absolutePath)) {
      continue;
    }

    if (fs.readdirSync(absolutePath).length === 0) {
      operations.push(
        buildOperation(
          'remove_empty_root',
          absolutePath,
          projectRoot,
          'empty_managed_root',
        ),
      );
    }
  }

  return {
    operations,
    summary: summarizeOperations(operations),
  };
}

function applyOperationPlan(projectRoot, plan) {
  if (!plan || !Array.isArray(plan.operations)) {
    return;
  }

  for (const operation of plan.operations) {
    const targetPath = path.join(projectRoot, operation.path);

    if (operation.kind === 'ensure_dir') {
      ensureDirectory(targetPath);
      continue;
    }

    if (operation.kind === 'write_file' || operation.kind === 'update_file') {
      writeManagedFile(targetPath, operation.contents, operation.mode, operation.encoding);
      continue;
    }

    if (operation.kind === 'remove_file' || operation.kind === 'prune_command') {
      removeFile(targetPath, projectRoot);
      continue;
    }

    if (operation.kind === 'remove_dir') {
      removeDirectory(targetPath, projectRoot);
      continue;
    }

    if (operation.kind === 'remove_empty_root') {
      removeEmptyRoot(targetPath, projectRoot);
    }
  }
}

function ensureDirectory(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

function writeManagedFile(filePath, contents, mode, encoding) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (encoding === 'buffer' && Buffer.isBuffer(contents)) {
    fs.writeFileSync(filePath, contents);
  } else {
    fs.writeFileSync(filePath, contents || '', 'utf8');
  }
  if (typeof mode === 'number') {
    fs.chmodSync(filePath, mode);
  }
}

function removeEmptyRoot(directoryPath, projectRoot) {
  if (!fs.existsSync(directoryPath)) {
    return;
  }

  if (fs.readdirSync(directoryPath).length > 0) {
    return;
  }

  fs.rmdirSync(directoryPath);
  removeEmptyParents(path.dirname(directoryPath), projectRoot);
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
  // path.resolve 统一分隔符，path.relative 做包含性判断（比 startsWith 更健壮，
  // 避免 Windows 下大小写不一致或混用分隔符导致的误判）
  const stopResolved = path.resolve(stopRoot);
  let current = path.resolve(startPath);
  while (current !== stopResolved) {
    const rel = path.relative(stopResolved, current);
    if (!rel || rel.startsWith('..')) break;

    if (!fs.existsSync(current)) {
      current = path.dirname(current);
      continue;
    }

    const entries = fs.readdirSync(current);
    if (entries.length > 0) break;

    fs.rmdirSync(current);
    current = path.dirname(current);
  }
}

module.exports = {
  applyOperationPlan,
  buildEmptyOperationPlan,
  buildFileWriteOperation,
  buildRelativeOperation,
  buildState,
  clearState,
  getStateFilePath,
  hardResetManagedAssets,
  isLegacyManagedState,
  mergeOperationPlans,
  normalizeOperationPath,
  planCommandNamespacePrune,
  planEmptyManagedRootCleanup,
  planHardResetManagedAssets,
  planManagedAssetRemoval,
  planObsoleteManagedAssetRemoval,
  pruneCommandNamespace,
  readStateFileRaw,
  readState,
  removeManagedAssets,
  removeObsoleteManagedAssets,
  summarizeOperationPlan,
  writeState,
};
