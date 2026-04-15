const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const MANIFEST_PATH = path.join(REPO_ROOT, '.claude-plugin', 'plugin.json');
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

function getBundledPath(kind) {
  const manifest = loadPluginManifest();
  return path.join(REPO_ROOT, manifest.directories[kind]);
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

function syncBundledAssets(projectRoot, adapter) {
  const commands = adapter.hasCommands ? syncCommands(projectRoot, adapter) : [];
  const { skills, workflowSkills } = syncSkills(projectRoot, adapter);
  const { agents, agentSupportFiles } = syncAgents(projectRoot, adapter);

  return { commands, skills, workflowSkills, agents, agentSupportFiles };
}

function syncCommands(projectRoot, adapter) {
  const targetRoot = path.join(projectRoot, adapter.commandRoot);
  fs.mkdirSync(targetRoot, { recursive: true });

  const commands = listBundledCommands().map((command) => ({
    ...command,
    filename: adapter.commandFilename(command),
  }));
  for (const command of commands) {
    const content = readBundledCommandTemplate(command.name);
    const transformed = adapter.transformSkillContent(content);
    fs.writeFileSync(
      path.join(targetRoot, command.filename),
      transformed,
      'utf8',
    );
  }

  return commands;
}

function syncSkills(projectRoot, adapter) {
  const manifest = loadPluginManifest();
  const commandSkillNames = new Set(manifest.commands.map((cmd) => cmd.skill));

  const standaloneRoot = path.join(projectRoot, adapter.skillsRoot);
  const workflowRoot = path.join(projectRoot, adapter.workflowsRoot);
  fs.mkdirSync(standaloneRoot, { recursive: true });
  fs.mkdirSync(workflowRoot, { recursive: true });

  const sourceRoot = getBundledPath('skills');
  const skillNames = listBundledSkills();
  const standaloneNames = [];
  const workflowNames = [];

  for (const skillName of skillNames) {
    const isCommandBacking = commandSkillNames.has(skillName);
    const targetDir = isCommandBacking
      ? path.join(workflowRoot, skillName)
      : path.join(standaloneRoot, skillName);

    fs.rmSync(targetDir, { recursive: true, force: true });

    // Migration: remove command-backing skill from the old skillsRoot location if still present
    if (isCommandBacking && workflowRoot !== standaloneRoot) {
      fs.rmSync(path.join(standaloneRoot, skillName), { recursive: true, force: true });
    }

    copyDirectoryWithTransform(path.join(sourceRoot, skillName), targetDir, (content) =>
      adapter.transformSkillContent(content, { skillName }),
    );

    if (!isCommandBacking) {
      standaloneNames.push(skillName);
    } else {
      workflowNames.push(skillName);
    }
  }

  return { skills: standaloneNames, workflowSkills: workflowNames };
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

function inspectInstalledAssets(projectRoot, adapter) {
  const commands = listBundledCommands();
  const skills = listBundledSkills();
  const agents = listBundledAgents();
  const agentSupportFiles = listBundledAgentSupportFiles();

  return {
    commands: adapter.hasCommands
      ? inspectCommands(projectRoot, commands, adapter)
      : { targetRoot: adapter.commandRoot, entries: [], missing: [] },
    skills: inspectSkills(projectRoot, skills, adapter),
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
  return { targetRoot, entries: runtimeCommands, missing };
}

function inspectSkills(projectRoot, skillNames = listBundledSkills(), adapter) {
  const manifest = loadPluginManifest();
  const commandSkillNames = new Set(manifest.commands.map((cmd) => cmd.skill));

  const standaloneRoot = path.join(projectRoot, adapter.skillsRoot);
  const workflowRoot = path.join(projectRoot, adapter.workflowsRoot);

  const missing = skillNames.filter((skillName) => {
    const isCommandBacking = commandSkillNames.has(skillName);
    const targetRoot = isCommandBacking ? workflowRoot : standaloneRoot;
    return !fs.existsSync(path.join(targetRoot, skillName, 'SKILL.md'));
  });
  return { targetRoot: standaloneRoot, entries: skillNames, missing };
}

function inspectAgents(projectRoot, agentPaths = listBundledAgents(), adapter) {
  const targetRoot = path.join(projectRoot, adapter.agentsRoot);
  const missing = agentPaths.filter((agentPath) => !fs.existsSync(path.join(targetRoot, agentPath)));
  return { targetRoot, entries: agentPaths, missing };
}

function inspectAgentSupportFiles(projectRoot, supportPaths = listBundledAgentSupportFiles(), adapter) {
  const targetRoot = path.join(projectRoot, adapter.agentsRoot);
  const missing = supportPaths.filter((supportPath) => !fs.existsSync(path.join(targetRoot, supportPath)));
  return { targetRoot, entries: supportPaths, missing };
}

module.exports = {
  getBundledPath,
  getManifestPath,
  inspectInstalledAssets,
  listBundledAgentSupportFiles,
  listBundledAgents,
  listBundledCommands,
  listBundledSkills,
  loadPluginManifest,
  readBundledCommandTemplate,
  syncAgents,
  syncBundledAssets,
  syncCommands,
  syncSkills,
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

function adaptClaudeRuntimeContent(content) {
  return content.replace(/\bspec-first:([a-z-]+):([a-z-]+)\b/g, '$1:$2');
}
