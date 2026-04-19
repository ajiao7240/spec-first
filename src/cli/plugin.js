const fs = require('node:fs');
const path = require('node:path');
const {
  buildEmptyOperationPlan,
  buildFileWriteOperation: buildSharedFileWriteOperation,
  buildRelativeOperation,
  mergeOperationPlans,
  normalizeOperationPath,
  summarizeOperationPlan,
} = require('./state');

const REPO_ROOT = path.join(__dirname, '..', '..');
const MANIFEST_PATH = path.join(REPO_ROOT, '.claude-plugin', 'plugin.json');
const GOVERNANCE_PATH = path.join(
  REPO_ROOT,
  'src',
  'cli',
  'contracts',
  'dual-host-governance',
  'skills-governance.json',
);
const SUPPORTED_PLATFORM_IDS = ['claude', 'codex'];
const SUPPORTED_PLATFORMS = new Set(SUPPORTED_PLATFORM_IDS);
const ENTRY_SURFACES = new Set(['workflow_command', 'standalone_skill', 'internal_only']);
const HOST_SCOPES = new Set(['dual_host', 'host_exclusive', 'target_host_maintenance']);
const HOST_DELIVERIES = new Set(['command', 'skill', 'internal', 'none']);
const TEXT_FILE_EXTENSIONS = new Set([
  '.md',
  '.json',
  '.yaml',
  '.yml',
  '.sh',
  '.rb',
  '.py',
  '.mjs',
  '.txt',
]);
const CANONICAL_AGENT_NAME_PATTERN = /\bspec-first:[a-z-]+:[a-z-]+\b/;
const CODEX_UNREWRITTEN_PATH_PATTERNS = [
  /\.claude\/commands\/spec\/[a-z-]+\.md/,
  /\.claude\/spec-first\/workflows\//,
  /\.claude\/skills\//,
  /\.claude\/agents\//,
  CANONICAL_AGENT_NAME_PATTERN,
];
const HIGH_VALUE_SKILL_ANCHORS = {
  'spec-plan': [
    'selected_assets / fallback_reason / level / skipped_rules',
    'verifier_dispatch',
    'verification_gate_state',
    'stage0-context --stage plan --workflow spec-plan --format json',
  ],
  'spec-work': [
    'required_verifications',
    'verifier_dispatch',
    'verification_gate_state',
    'stage0-context --stage work --workflow spec-work --format json',
  ],
  'spec-work-beta': [
    'required_verifications',
    'verifier_dispatch',
    'verification_gate_state',
    'stage0-context --stage work --workflow spec-work-beta --format json',
  ],
  'spec-review': [
    'verification summary',
    'verifier_dispatch',
    'verification_gate_state',
    'stage0-context --stage review --workflow spec-review --format json',
  ],
  'spec-graph-bootstrap': [
    'Runs Phase 0–4',
    'fact-inventory.json',
    'risk-signals.json',
    'test-surface.json',
  ],
};

function loadPluginManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    throw new Error(`Bundled plugin manifest not found: ${MANIFEST_PATH}`);
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  validateManifest(manifest);
  return manifest;
}

function validateManifest(manifest) {
  if (!manifest || typeof manifest !== 'object') {
    throw new Error('Bundled plugin manifest must be a JSON object.');
  }

  if (!Array.isArray(manifest.commands)) {
    throw new Error('Bundled plugin manifest is missing a valid commands array.');
  }

  if (!manifest.directories || typeof manifest.directories !== 'object') {
    throw new Error('Bundled plugin manifest is missing directories metadata.');
  }

  for (const field of ['commands', 'skills', 'agents']) {
    if (typeof manifest.directories[field] !== 'string' || manifest.directories[field].length === 0) {
      throw new Error(`Bundled plugin manifest is missing directories.${field}.`);
    }
  }
}

function getManifestPath() {
  return MANIFEST_PATH;
}

function getSkillsGovernancePath() {
  return GOVERNANCE_PATH;
}

function getBundledPath(kind) {
  const manifest = loadPluginManifest();
  return path.join(REPO_ROOT, manifest.directories[kind]);
}

function loadSkillsGovernance() {
  if (!fs.existsSync(GOVERNANCE_PATH)) {
    throw new Error(`Bundled skills governance truth source not found: ${GOVERNANCE_PATH}`);
  }

  const governance = JSON.parse(fs.readFileSync(GOVERNANCE_PATH, 'utf8'));
  validateSkillsGovernance(governance);

  return {
    schemaVersion: governance.schemaVersion,
    skills: governance.skills
      .map((record) => ({
        skill_name: record.skill_name,
        entry_surface: record.entry_surface,
        command_name: record.command_name,
        host_scope: record.host_scope,
        owner_host: record.owner_host,
        host_delivery: {
          claude: record.host_delivery.claude,
          codex: record.host_delivery.codex,
        },
      }))
      .sort((a, b) => a.skill_name.localeCompare(b.skill_name)),
  };
}

function validateSkillsGovernance(governance) {
  if (!governance || typeof governance !== 'object' || Array.isArray(governance)) {
    throw new Error('Bundled skills governance truth source must be a JSON object.');
  }

  if (governance.schemaVersion !== 1) {
    throw new Error('Bundled skills governance truth source must declare schemaVersion=1.');
  }

  if (!Array.isArray(governance.skills)) {
    throw new Error('Bundled skills governance truth source is missing a valid skills array.');
  }

  const manifest = loadPluginManifest();
  const bundledSkills = listBundledSkills();
  const manifestCommandBySkill = new Map(manifest.commands.map((command) => [command.skill, command.name]));
  const seen = new Set();

  for (const [index, record] of governance.skills.entries()) {
    const prefix = `Bundled skills governance truth source skills[${index}]`;

    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      throw new Error(`${prefix} must be an object.`);
    }

    if (typeof record.skill_name !== 'string' || record.skill_name.length === 0) {
      throw new Error(`${prefix} is missing skill_name.`);
    }

    if (!bundledSkills.includes(record.skill_name)) {
      throw new Error(`${prefix} references unknown bundled skill "${record.skill_name}".`);
    }

    if (seen.has(record.skill_name)) {
      throw new Error(`Bundled skills governance truth source duplicates skill "${record.skill_name}".`);
    }
    seen.add(record.skill_name);

    if (!ENTRY_SURFACES.has(record.entry_surface)) {
      throw new Error(`${prefix} has invalid entry_surface "${record.entry_surface}".`);
    }

    if (!HOST_SCOPES.has(record.host_scope)) {
      throw new Error(`${prefix} has invalid host_scope "${record.host_scope}".`);
    }

    if (!record.host_delivery || typeof record.host_delivery !== 'object' || Array.isArray(record.host_delivery)) {
      throw new Error(`${prefix} is missing host_delivery.`);
    }

    for (const platform of SUPPORTED_PLATFORM_IDS) {
      if (!HOST_DELIVERIES.has(record.host_delivery[platform])) {
        throw new Error(`${prefix} has invalid host_delivery.${platform}="${record.host_delivery[platform]}".`);
      }
    }

    const manifestCommandName = manifestCommandBySkill.get(record.skill_name) || null;
    if (record.entry_surface === 'workflow_command') {
      if (!manifestCommandName) {
        throw new Error(`${prefix} declares workflow_command but manifest has no command for "${record.skill_name}".`);
      }

      if (typeof record.command_name !== 'string' || record.command_name !== manifestCommandName) {
        throw new Error(
          `${prefix} must declare command_name="${manifestCommandName}" for workflow skill "${record.skill_name}".`,
        );
      }
    } else {
      if (manifestCommandName) {
        throw new Error(
          `${prefix} must use entry_surface="workflow_command" because manifest declares "${record.skill_name}" as a command-backed workflow.`,
        );
      }

      if (record.command_name !== null) {
        throw new Error(`${prefix} must set command_name=null for non-workflow skills.`);
      }

      if (record.entry_surface === 'standalone_skill') {
        for (const platform of SUPPORTED_PLATFORM_IDS) {
          if (record.host_delivery[platform] === 'command') {
            throw new Error(`${prefix} cannot deliver standalone skill "${record.skill_name}" as a command.`);
          }
        }
      }
    }

    if (record.host_scope === 'dual_host') {
      if (record.owner_host !== null) {
        throw new Error(`${prefix} must set owner_host=null for dual_host skills.`);
      }

      for (const platform of SUPPORTED_PLATFORM_IDS) {
        if (record.host_delivery[platform] === 'none' || record.host_delivery[platform] === 'internal') {
          throw new Error(`${prefix} must deliver dual_host skill "${record.skill_name}" to ${platform}.`);
        }
      }
    }

    if (record.host_scope === 'host_exclusive') {
      if (!SUPPORTED_PLATFORMS.has(record.owner_host)) {
        throw new Error(`${prefix} must set owner_host for host_exclusive skills.`);
      }

      const activePlatforms = SUPPORTED_PLATFORM_IDS.filter((platform) => (
        record.host_delivery[platform] !== 'none' && record.host_delivery[platform] !== 'internal'
      ));

      if (activePlatforms.length !== 1 || activePlatforms[0] !== record.owner_host) {
        throw new Error(
          `${prefix} must only deliver host_exclusive skill "${record.skill_name}" to owner_host="${record.owner_host}".`,
        );
      }
    }

    if (record.host_scope === 'target_host_maintenance') {
      if (!SUPPORTED_PLATFORMS.has(record.owner_host)) {
        throw new Error(`${prefix} must set owner_host for target_host_maintenance skills.`);
      }

      const activePlatforms = SUPPORTED_PLATFORM_IDS.filter((platform) => (
        record.host_delivery[platform] !== 'none' && record.host_delivery[platform] !== 'internal'
      ));

      if (activePlatforms.length === 0) {
        throw new Error(`${prefix} must expose target_host_maintenance skill "${record.skill_name}" on at least one host.`);
      }

      if (!activePlatforms.includes(record.owner_host)) {
        throw new Error(
          `${prefix} must deliver target_host_maintenance skill "${record.skill_name}" on owner_host="${record.owner_host}".`,
        );
      }

      const nonOwnerPlatforms = activePlatforms.filter((platform) => platform !== record.owner_host);
      if (nonOwnerPlatforms.length === 0) {
        throw new Error(
          `${prefix} must also deliver target_host_maintenance skill "${record.skill_name}" on at least one non-owner host.`,
        );
      }
    }

    if (record.entry_surface === 'internal_only') {
      for (const platform of SUPPORTED_PLATFORM_IDS) {
        if (record.host_delivery[platform] === 'command' || record.host_delivery[platform] === 'skill') {
          throw new Error(`${prefix} cannot expose internal_only skill "${record.skill_name}" as a user-visible delivery.`);
        }
      }
    }
  }

  const missingSkills = bundledSkills.filter((skillName) => !seen.has(skillName));
  if (missingSkills.length > 0) {
    throw new Error(`Bundled skills governance truth source is missing skills: ${missingSkills.join(', ')}`);
  }
}

function listBundledCommands() {
  const manifest = loadPluginManifest();
  return manifest.commands.map((command) => {
    if (!command || typeof command !== 'object') {
      throw new Error('Bundled plugin manifest contains an invalid command entry.');
    }

    for (const field of ['name', 'filename', 'description', 'argumentHint', 'skill']) {
      if (typeof command[field] !== 'string' || command[field].length === 0) {
        throw new Error(`Bundled plugin manifest command is missing ${field}.`);
      }
    }

    return { ...command };
  });
}

function listBundledSkills() {
  const sourceDir = getBundledPath('skills');
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Bundled skills directory not found: ${sourceDir}`);
  }

  return fs
    .readdirSync(sourceDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

function listBundledAgents() {
  const sourceDir = getBundledPath('agents');
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Bundled agents directory not found: ${sourceDir}`);
  }

  return fs
    .readdirSync(sourceDir, { withFileTypes: true })
    .flatMap((entry) => walkAgentEntries(path.join(sourceDir, entry.name), entry.name))
    .sort((a, b) => a.localeCompare(b));
}

function listBundledAgentSupportFiles() {
  const sourceDir = getBundledPath('agents');
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Bundled agents directory not found: ${sourceDir}`);
  }

  return fs
    .readdirSync(sourceDir, { withFileTypes: true })
    .flatMap((entry) => walkAgentSupportEntries(path.join(sourceDir, entry.name), entry.name))
    .sort((a, b) => a.localeCompare(b));
}

function walkAgentEntries(absolutePath, relativePath) {
  const stat = fs.statSync(absolutePath);
  if (stat.isDirectory()) {
    return fs
      .readdirSync(absolutePath, { withFileTypes: true })
      .flatMap((entry) =>
        walkAgentEntries(
          path.join(absolutePath, entry.name),
          path.join(relativePath, entry.name),
        ),
      );
  }

  return relativePath.endsWith('.md') ? [relativePath] : [];
}

function walkAgentSupportEntries(absolutePath, relativePath) {
  const stat = fs.statSync(absolutePath);
  if (stat.isDirectory()) {
    return fs
      .readdirSync(absolutePath, { withFileTypes: true })
      .flatMap((entry) =>
        walkAgentSupportEntries(
          path.join(absolutePath, entry.name),
          path.join(relativePath, entry.name),
        ),
      );
  }

  return relativePath.endsWith('.md') ? [] : [relativePath];
}

function readBundledCommandTemplate(commandName) {
  const command = listBundledCommands().find((entry) => entry.name === commandName);
  if (!command) {
    throw new Error(`Unknown bundled command template: ${commandName}`);
  }

  return fs.readFileSync(path.join(getBundledPath('commands'), command.filename), 'utf8');
}

function buildFilteredAssetSet(platformOrAdapter) {
  const platform = resolvePlatformId(platformOrAdapter);
  const governance = loadSkillsGovernance();
  const commandBySkill = new Map(listBundledCommands().map((command) => [command.skill, { ...command }]));
  const workflowSkills = [];
  const skills = [];
  const commands = [];
  const skipped = [];

  for (const record of governance.skills) {
    const delivery = record.host_delivery[platform];
    const reason = `${record.entry_surface} excluded on ${platform} because host_delivery.${platform}=${delivery}`;

    if (record.entry_surface === 'workflow_command') {
      if (delivery === 'command') {
        const command = commandBySkill.get(record.skill_name);
        if (!command) {
          throw new Error(`Missing bundled command definition for governed workflow skill: ${record.skill_name}`);
        }

        workflowSkills.push(record.skill_name);
        commands.push(command);
        continue;
      }

      if (delivery === 'skill') {
        workflowSkills.push(record.skill_name);
        continue;
      }

      skipped.push({
        skillName: record.skill_name,
        platform,
        reason,
      });
      continue;
    }

    if (record.entry_surface === 'standalone_skill' && delivery === 'skill') {
      skills.push(record.skill_name);
      continue;
    }

    skipped.push({
      skillName: record.skill_name,
      platform,
      reason,
    });
  }

  return {
    platform,
    commands: commands.sort((a, b) => a.name.localeCompare(b.name)),
    workflowSkills: workflowSkills.sort((a, b) => a.localeCompare(b)),
    skills: skills.sort((a, b) => a.localeCompare(b)),
    agents: listBundledAgents(),
    agentSupportFiles: listBundledAgentSupportFiles(),
    skipped: skipped.sort((a, b) => a.skillName.localeCompare(b.skillName)),
  };
}

function resolvePlatformId(platformOrAdapter) {
  const platform = typeof platformOrAdapter === 'string'
    ? platformOrAdapter
    : platformOrAdapter && typeof platformOrAdapter.id === 'string'
      ? platformOrAdapter.id
      : '';

  if (!SUPPORTED_PLATFORMS.has(platform)) {
    throw new Error(`Unknown platform for filtered asset set: ${platform}`);
  }

  return platform;
}

function syncBundledAssets(projectRoot, adapter) {
  const filteredAssetSet = buildFilteredAssetSet(adapter.id);
  const commands = adapter.hasCommands ? syncCommands(projectRoot, adapter, filteredAssetSet.commands) : [];
  const { skills, workflowSkills } = syncSkills(projectRoot, adapter, filteredAssetSet);
  const { agents, agentSupportFiles } = syncAgents(projectRoot, adapter);

  return { commands, skills, workflowSkills, agents, agentSupportFiles, skipped: filteredAssetSet.skipped };
}

function planBundledAssetSync(projectRoot, adapter, filteredAssetSet = buildFilteredAssetSet(adapter.id)) {
  const commandPlan = adapter.hasCommands
    ? planCommandsSync(projectRoot, adapter, filteredAssetSet.commands)
    : { plan: emptyPlan(), runtimeCommands: [] };
  const skillsPlan = planSkillsSync(projectRoot, adapter, filteredAssetSet);
  const agentsPlan = planAgentsSync(projectRoot, adapter);

  return {
    plan: mergeOperationPlans(commandPlan.plan, skillsPlan.plan, agentsPlan.plan),
    syncedAssets: {
      commands: commandPlan.runtimeCommands,
      skills: skillsPlan.skills,
      workflowSkills: skillsPlan.workflowSkills,
      agents: agentsPlan.agents,
      agentSupportFiles: agentsPlan.agentSupportFiles,
      skipped: filteredAssetSet.skipped,
    },
  };
}

function syncCommands(projectRoot, adapter, commands = listBundledCommands()) {
  const targetRoot = path.join(projectRoot, adapter.commandRoot);
  fs.mkdirSync(targetRoot, { recursive: true });

  const runtimeCommands = commands.map((command) => ({
    ...command,
    filename: adapter.commandFilename(command),
  }));

  for (const command of runtimeCommands) {
    const content = readBundledCommandTemplate(command.name);
    const transformed = adapter.transformSkillContent(content);
    fs.writeFileSync(
      path.join(targetRoot, command.filename),
      transformed,
      'utf8',
    );
  }

  return runtimeCommands;
}

function planCommandsSync(projectRoot, adapter, commands = listBundledCommands()) {
  const targetRoot = path.join(projectRoot, adapter.commandRoot);
  const runtimeCommands = commands.map((command) => ({
    ...command,
    filename: adapter.commandFilename(command),
  }));
  const operations = [buildPlanOperation('ensure_dir', adapter.commandRoot, 'managed_command_root')];

  for (const command of runtimeCommands) {
    const content = readBundledCommandTemplate(command.name);
    const transformed = adapter.transformSkillContent(content, { skillName: command.skill });
    operations.push(buildFileWriteOperation(
      projectRoot,
      path.join(targetRoot, command.filename),
      transformed,
      'managed_command',
    ));
  }

  return {
    plan: {
      operations,
      summary: summarizeOperationPlan(operations),
    },
    runtimeCommands,
  };
}

function syncSkills(projectRoot, adapter, filteredAssetSet = buildFilteredAssetSet(adapter.id)) {
  const standaloneRoot = path.join(projectRoot, adapter.skillsRoot);
  const workflowRoot = path.join(projectRoot, adapter.workflowsRoot);
  fs.mkdirSync(standaloneRoot, { recursive: true });
  fs.mkdirSync(workflowRoot, { recursive: true });

  const sourceRoot = getBundledPath('skills');
  const standaloneNames = [...filteredAssetSet.skills];
  const workflowNames = [...filteredAssetSet.workflowSkills];
  const workflowNameSet = new Set(workflowNames);
  const skillNames = [...new Set([...standaloneNames, ...workflowNames])].sort((a, b) =>
    a.localeCompare(b),
  );

  for (const skillName of skillNames) {
    const isWorkflowSkill = workflowNameSet.has(skillName);
    const targetDir = isWorkflowSkill
      ? path.join(workflowRoot, skillName)
      : path.join(standaloneRoot, skillName);

    fs.rmSync(targetDir, { recursive: true, force: true });

    if (isWorkflowSkill && workflowRoot !== standaloneRoot) {
      fs.rmSync(path.join(standaloneRoot, skillName), { recursive: true, force: true });
    }

    copyDirectoryWithTransform(path.join(sourceRoot, skillName), targetDir, (content) =>
      adapter.transformSkillContent(content, { skillName }),
    );
  }

  return { skills: standaloneNames, workflowSkills: workflowNames };
}

function planSkillsSync(projectRoot, adapter, filteredAssetSet = buildFilteredAssetSet(adapter.id)) {
  const standaloneRoot = path.join(projectRoot, adapter.skillsRoot);
  const workflowRoot = path.join(projectRoot, adapter.workflowsRoot);
  const sourceRoot = getBundledPath('skills');
  const standaloneNames = [...filteredAssetSet.skills];
  const workflowNames = [...filteredAssetSet.workflowSkills];
  const workflowNameSet = new Set(workflowNames);
  const skillNames = [...new Set([...standaloneNames, ...workflowNames])].sort((a, b) =>
    a.localeCompare(b),
  );
  const operations = [
    buildPlanOperation('ensure_dir', adapter.skillsRoot, 'managed_skills_root'),
  ];

  if (adapter.workflowsRoot !== adapter.skillsRoot) {
    operations.push(buildPlanOperation('ensure_dir', adapter.workflowsRoot, 'managed_workflows_root'));
  }

  for (const skillName of skillNames) {
    const isWorkflowSkill = workflowNameSet.has(skillName);
    const targetDir = isWorkflowSkill
      ? path.join(workflowRoot, skillName)
      : path.join(standaloneRoot, skillName);

    operations.push(buildPlanOperation(
      'remove_dir',
      toRelativeProjectPath(targetDir, projectRoot),
      isWorkflowSkill ? 'managed_workflow_skill_reset' : 'managed_skill_reset',
    ));

    if (isWorkflowSkill && workflowRoot !== standaloneRoot) {
      operations.push(buildPlanOperation(
        'remove_dir',
        normalizePathForContent(path.join(adapter.skillsRoot, skillName)),
        'managed_workflow_skill_standalone_cleanup',
      ));
    }

    operations.push(...planDirectoryWithTransform({
      projectRoot,
      sourceDir: path.join(sourceRoot, skillName),
      targetDir,
      reason: isWorkflowSkill ? 'managed_workflow_skill' : 'managed_skill',
      transformText: (content) => adapter.transformSkillContent(content, { skillName }),
    }));
  }

  return {
    plan: {
      operations,
      summary: summarizeOperationPlan(operations),
    },
    skills: standaloneNames,
    workflowSkills: workflowNames,
  };
}

function syncAgents(projectRoot, adapter) {
  const targetRoot = path.join(projectRoot, adapter.agentsRoot);
  fs.mkdirSync(targetRoot, { recursive: true });

  const sourceRoot = getBundledPath('agents');
  const agentPaths = listBundledAgents();
  const agentSupportFiles = listBundledAgentSupportFiles();

  for (const agentPath of agentPaths) {
    const sourcePath = path.join(sourceRoot, agentPath);
    const targetPath = path.join(targetRoot, agentPath);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    copyFileWithTransform(sourcePath, targetPath, (content) =>
      adapter.transformAgentContent(content),
    );
  }

  for (const supportPath of agentSupportFiles) {
    const sourcePath = path.join(sourceRoot, supportPath);
    const targetPath = path.join(targetRoot, supportPath);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    copyFileWithTransform(sourcePath, targetPath, (content) => content);
  }

  return { agents: agentPaths, agentSupportFiles };
}

function planAgentsSync(projectRoot, adapter) {
  const targetRoot = path.join(projectRoot, adapter.agentsRoot);
  const sourceRoot = getBundledPath('agents');
  const agentPaths = listBundledAgents();
  const agentSupportFiles = listBundledAgentSupportFiles();
  const operations = [
    buildPlanOperation('ensure_dir', adapter.agentsRoot, 'managed_agents_root'),
  ];

  for (const agentPath of agentPaths) {
    operations.push(...planFileCopyWithTransform({
      projectRoot,
      sourcePath: path.join(sourceRoot, agentPath),
      targetPath: path.join(targetRoot, agentPath),
      reason: 'managed_agent',
      transformText: (content) => adapter.transformAgentContent(content),
    }));
  }

  for (const supportPath of agentSupportFiles) {
    operations.push(...planFileCopyWithTransform({
      projectRoot,
      sourcePath: path.join(sourceRoot, supportPath),
      targetPath: path.join(targetRoot, supportPath),
      reason: 'managed_agent_support_file',
      transformText: (content) => content,
    }));
  }

  return {
    plan: {
      operations,
      summary: summarizeOperationPlan(operations),
    },
    agents: agentPaths,
    agentSupportFiles,
  };
}

function inspectInstalledAssets(projectRoot, adapter) {
  const filteredAssetSet = buildFilteredAssetSet(adapter.id);
  const agents = listBundledAgents();
  const agentSupportFiles = listBundledAgentSupportFiles();

  return {
    commands: adapter.hasCommands
      ? inspectCommands(projectRoot, filteredAssetSet.commands, adapter)
      : { targetRoot: adapter.commandRoot, entries: [], missing: [] },
    skills: inspectSkills(projectRoot, filteredAssetSet, adapter),
    agents: inspectAgents(projectRoot, agents, adapter),
    agentSupportFiles: inspectAgentSupportFiles(projectRoot, agentSupportFiles, adapter),
  };
}

function inspectCommands(projectRoot, commands = listBundledCommands(), adapter) {
  const targetRoot = path.join(projectRoot, adapter.commandRoot);
  const runtimeCommands = commands.map((command) => ({
    ...command,
    filename: adapter.commandFilename(command),
  }));
  const missing = runtimeCommands.filter((command) => !fs.existsSync(path.join(targetRoot, command.filename)));
  const drifted = runtimeCommands
    .filter((command) => fs.existsSync(path.join(targetRoot, command.filename)))
    .map((command) => inspectCommandIntegrity(projectRoot, command, adapter))
    .filter(Boolean);
  return { targetRoot, entries: runtimeCommands, missing, drifted };
}

function inspectSkills(projectRoot, filteredAssetSet, adapter) {
  const standaloneRoot = path.join(projectRoot, adapter.skillsRoot);
  const workflowRoot = path.join(projectRoot, adapter.workflowsRoot);
  const workflowNames = [...(filteredAssetSet && filteredAssetSet.workflowSkills ? filteredAssetSet.workflowSkills : [])];
  const standaloneNames = [...(filteredAssetSet && filteredAssetSet.skills ? filteredAssetSet.skills : [])];
  const workflowNameSet = new Set(workflowNames);
  const skillNames = [...new Set([...standaloneNames, ...workflowNames])].sort((a, b) =>
    a.localeCompare(b),
  );

  const missing = skillNames.filter((skillName) => {
    const targetRoot = workflowNameSet.has(skillName) ? workflowRoot : standaloneRoot;
    return !fs.existsSync(path.join(targetRoot, skillName, 'SKILL.md'));
  });
  const drifted = skillNames
    .filter((skillName) => !missing.includes(skillName))
    .map((skillName) => inspectSkillIntegrity({
      projectRoot,
      adapter,
      skillName,
      isWorkflowSkill: workflowNameSet.has(skillName),
      standaloneRoot,
      workflowRoot,
    }))
    .filter(Boolean);
  return { targetRoot: standaloneRoot, entries: skillNames, missing, drifted };
}

function inspectAgents(projectRoot, agentPaths = listBundledAgents(), adapter) {
  const targetRoot = path.join(projectRoot, adapter.agentsRoot);
  const missing = agentPaths.filter((agentPath) => !fs.existsSync(path.join(targetRoot, agentPath)));
  const drifted = agentPaths
    .filter((agentPath) => !missing.includes(agentPath))
    .map((agentPath) => inspectAgentIntegrity(projectRoot, agentPath, adapter))
    .filter(Boolean);
  return { targetRoot, entries: agentPaths, missing, drifted };
}

function inspectAgentSupportFiles(projectRoot, supportPaths = listBundledAgentSupportFiles(), adapter) {
  const targetRoot = path.join(projectRoot, adapter.agentsRoot);
  const missing = supportPaths.filter((supportPath) => !fs.existsSync(path.join(targetRoot, supportPath)));
  const drifted = supportPaths
    .filter((supportPath) => !missing.includes(supportPath))
    .map((supportPath) => inspectAgentSupportFileIntegrity(projectRoot, supportPath, adapter))
    .filter(Boolean);
  return { targetRoot, entries: supportPaths, missing, drifted };
}

module.exports = {
  buildFilteredAssetSet,
  getBundledPath,
  getManifestPath,
  getSkillsGovernancePath,
  inspectInstalledAssets,
  listBundledAgentSupportFiles,
  listBundledAgents,
  listBundledCommands,
  listBundledSkills,
  loadPluginManifest,
  loadSkillsGovernance,
  planBundledAssetSync,
  readBundledCommandTemplate,
  syncAgents,
  syncBundledAssets,
  syncCommands,
  syncSkills,
  validateSkillsGovernance,
};

function copyDirectoryWithTransform(sourceDir, targetDir, transformText) {
  fs.mkdirSync(targetDir, { recursive: true });

  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      copyDirectoryWithTransform(sourcePath, targetPath, transformText);
      continue;
    }

    if (entry.isFile()) {
      copyFileWithTransform(sourcePath, targetPath, transformText);
    }
  }
}

function copyFileWithTransform(sourcePath, targetPath, transformText) {
  const stat = fs.statSync(sourcePath);
  if (isTextFile(sourcePath)) {
    const original = fs.readFileSync(sourcePath, 'utf8');
    const transformed = transformText(original);
    fs.writeFileSync(targetPath, transformed, 'utf8');
    fs.chmodSync(targetPath, stat.mode);
    return;
  }

  fs.copyFileSync(sourcePath, targetPath);
  fs.chmodSync(targetPath, stat.mode);
}

function isTextFile(filePath) {
  return TEXT_FILE_EXTENSIONS.has(path.extname(filePath));
}

function emptyPlan() {
  return buildEmptyOperationPlan();
}

function buildPlanOperation(kind, relativePath, reason, extra = {}) {
  return buildRelativeOperation(kind, relativePath, reason, extra);
}

function toRelativeProjectPath(absolutePath, projectRoot) {
  return normalizeOperationPath(path.relative(projectRoot, absolutePath));
}

function buildFileWriteOperation(projectRoot, absolutePath, contents, reason, mode) {
  return buildSharedFileWriteOperation(projectRoot, absolutePath, contents, reason, mode);
}

function planDirectoryWithTransform({
  projectRoot,
  sourceDir,
  targetDir,
  reason,
  transformText,
}) {
  const operations = [
    buildPlanOperation('ensure_dir', toRelativeProjectPath(targetDir, projectRoot), `${reason}_dir`),
  ];

  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const nextTargetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      operations.push(...planDirectoryWithTransform({
        projectRoot,
        sourceDir: sourcePath,
        targetDir: nextTargetPath,
        reason,
        transformText,
      }));
      continue;
    }

    if (entry.isFile()) {
      operations.push(...planFileCopyWithTransform({
        projectRoot,
        sourcePath,
        targetPath: nextTargetPath,
        reason,
        transformText,
      }));
    }
  }

  return operations;
}

function planFileCopyWithTransform({
  projectRoot,
  sourcePath,
  targetPath,
  reason,
  transformText,
}) {
  const operations = [
    buildPlanOperation(
      'ensure_dir',
      toRelativeProjectPath(path.dirname(targetPath), projectRoot),
      `${reason}_parent_dir`,
    ),
  ];
  const stat = fs.statSync(sourcePath);

  if (!isTextFile(sourcePath)) {
    operations.push(buildPlanOperation(
      fs.existsSync(targetPath) ? 'update_file' : 'write_file',
      toRelativeProjectPath(targetPath, projectRoot),
      reason,
      {
        contents: fs.readFileSync(sourcePath),
        encoding: 'buffer',
        mode: stat.mode,
      },
    ));
    return operations;
  }

  const original = fs.readFileSync(sourcePath, 'utf8');
  const transformed = transformText(original);
  operations.push(buildFileWriteOperation(projectRoot, targetPath, transformed, reason, stat.mode));
  return operations;
}

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function normalizePathForContent(filePath) {
  return normalizeOperationPath(filePath);
}

function normalizedWorkflowSkillRuntimePath(adapter, skillName) {
  return normalizePathForContent(path.posix.join(normalizePathForContent(adapter.workflowsRoot), skillName, 'SKILL.md'));
}

function inspectCommandIntegrity(projectRoot, command, adapter) {
  const targetPath = path.join(projectRoot, adapter.commandRoot, command.filename);
  const expectedContent = adapter.transformSkillContent(readBundledCommandTemplate(command.name), { skillName: command.skill });
  const actualContent = fs.readFileSync(targetPath, 'utf8');
  const issues = unique([
    ...commandIntegrityIssues(actualContent, command, adapter),
    ...(actualContent === expectedContent ? [] : ['content_mismatch']),
  ]);

  if (issues.length === 0) return null;
  return {
    filename: command.filename,
    commandName: command.name,
    issues,
  };
}

function inspectSkillIntegrity({
  projectRoot,
  adapter,
  skillName,
  isWorkflowSkill,
  standaloneRoot,
  workflowRoot,
}) {
  const runtimeRoot = isWorkflowSkill ? workflowRoot : standaloneRoot;
  const targetPath = path.join(runtimeRoot, skillName, 'SKILL.md');
  const sourcePath = path.join(getBundledPath('skills'), skillName, 'SKILL.md');
  const expectedContent = adapter.transformSkillContent(fs.readFileSync(sourcePath, 'utf8'), { skillName });
  const actualContent = fs.readFileSync(targetPath, 'utf8');
  const issues = unique([
    ...skillIntegrityIssues(actualContent, skillName, adapter),
    ...(actualContent === expectedContent ? [] : ['content_mismatch']),
  ]);

  if (issues.length === 0) return null;
  return {
    skillName,
    issues,
  };
}

function inspectAgentIntegrity(projectRoot, agentPath, adapter) {
  const targetPath = path.join(projectRoot, adapter.agentsRoot, agentPath);
  const sourcePath = path.join(getBundledPath('agents'), agentPath);
  const expectedContent = adapter.transformAgentContent(fs.readFileSync(sourcePath, 'utf8'));
  const actualContent = fs.readFileSync(targetPath, 'utf8');
  const issues = unique([
    ...transformedContentIntegrityIssues(actualContent, adapter, { kind: 'agent' }),
    ...(actualContent === expectedContent ? [] : ['content_mismatch']),
  ]);

  if (issues.length === 0) return null;
  return {
    agentPath,
    issues,
  };
}

function inspectAgentSupportFileIntegrity(projectRoot, supportPath, adapter) {
  const targetPath = path.join(projectRoot, adapter.agentsRoot, supportPath);
  const sourcePath = path.join(getBundledPath('agents'), supportPath);
  if (!isTextFile(sourcePath)) {
    return null;
  }

  const expectedContent = fs.readFileSync(sourcePath, 'utf8');
  const actualContent = fs.readFileSync(targetPath, 'utf8');
  if (actualContent === expectedContent) {
    return null;
  }

  return {
    supportPath,
    issues: ['content_mismatch'],
  };
}

function commandIntegrityIssues(actualContent, command, adapter) {
  const issues = [];
  const workflowPath = normalizedWorkflowSkillRuntimePath(adapter, command.skill);

  if (!actualContent.includes(workflowPath)) {
    issues.push('workflow_skill_path_mismatch');
  }

  if (adapter.id === 'claude' && !actualContent.includes(`You are running the \`spec:${command.name}\` workflow.`)) {
    issues.push('workflow_title_anchor_missing');
  }

  return issues;
}

function skillIntegrityIssues(actualContent, skillName, adapter) {
  const anchorIssues = (HIGH_VALUE_SKILL_ANCHORS[skillName] || [])
    .filter((anchor) => !actualContent.includes(anchor))
    .map((anchor) => `missing_anchor:${anchor}`);

  return unique([
    ...anchorIssues,
    ...transformedContentIntegrityIssues(actualContent, adapter, { kind: 'skill', skillName }),
  ]);
}

function transformedContentIntegrityIssues(actualContent, adapter, { kind, skillName } = {}) {
  const issues = [];

  if (adapter.id === 'claude' && CANONICAL_AGENT_NAME_PATTERN.test(actualContent)) {
    issues.push('canonical_agent_reference_drift');
  }

  if (adapter.id === 'codex' && CODEX_UNREWRITTEN_PATH_PATTERNS.some((pattern) => pattern.test(actualContent))) {
    issues.push('codex_path_rewrite_drift');
  }

  if (adapter.id === 'codex' && kind === 'skill' && skillName && !actualContent.includes(`name: ${skillName}`)) {
    issues.push('skill_name_rewrite_drift');
  }

  return issues;
}
