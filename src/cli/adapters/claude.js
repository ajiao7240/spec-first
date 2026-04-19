const fs = require('node:fs');
const path = require('node:path');

const PlatformAdapter = require('./base');
const SESSION_START_TEMPLATE_PATH = path.join(__dirname, '..', '..', '..', 'templates', 'claude', 'hooks', 'session-start');
const SESSION_START_RELATIVE_PATH = path.join('.claude', 'hooks', 'session-start');

/**
 * Claude platform adapter
 */
class ClaudeAdapter extends PlatformAdapter {
  get id() {
    return 'claude';
  }

  get runtimeRoot() {
    return '.claude';
  }

  get managedRoot() {
    return '.claude/spec-first';
  }

  get commandRoot() {
    return '.claude/commands/spec';
  }

  get skillsRoot() {
    return '.claude/skills';
  }

  get workflowsRoot() {
    return '.claude/spec-first/workflows';
  }

  get agentsRoot() {
    return '.claude/agents';
  }

  get stateFile() {
    return '.claude/spec-first/state.json';
  }

  get developerFile() {
    return '.claude/spec-first/.developer';
  }

  get instructionFile() {
    return 'CLAUDE.md';
  }

  transformSkillContent(content) {
    return rewriteCanonicalAgentNamesForSkills(content);
  }

  transformAgentContent(content) {
    return rewriteCanonicalAgentNamesForExecution(content);
  }

  inspect(projectRoot) {
    const runtimeDir = path.join(projectRoot, this.runtimeRoot);
    const commandDir = path.join(projectRoot, this.commandRoot);
    const skillsDir = path.join(projectRoot, this.skillsRoot);
    const agentsDir = path.join(projectRoot, this.agentsRoot);
    const stateFilePath = path.join(projectRoot, this.stateFile);
    const developerFilePath = path.join(projectRoot, this.developerFile);

    return {
      platform: this.id,
      runtimeExists: fs.existsSync(runtimeDir),
      commands: fs.existsSync(commandDir),
      skills: fs.existsSync(skillsDir),
      agents: fs.existsSync(agentsDir),
      state: fs.existsSync(stateFilePath),
      developer: fs.existsSync(developerFilePath),
    };
  }

  inspectRuntimeFiles(projectRoot) {
    const runtimeRoot = path.join(projectRoot, this.runtimeRoot);
    const skillsRoot = path.join(projectRoot, this.skillsRoot);
    const workflowsRoot = path.join(projectRoot, this.workflowsRoot);
    const agentsRoot = path.join(projectRoot, this.agentsRoot);
    const hookCheck = inspectSessionStartHook(projectRoot);

    const checks = [hookCheck];

    if (!fs.existsSync(runtimeRoot) || !fs.existsSync(skillsRoot) || !fs.existsSync(agentsRoot)) {
      return checks;
    }

    const workflowFiles = fs.existsSync(workflowsRoot) ? listMarkdownFiles(workflowsRoot) : [];
    const skillFiles = [...listMarkdownFiles(skillsRoot), ...workflowFiles];
    const markdownFiles = [...skillFiles, ...listMarkdownFiles(agentsRoot)];

    const canonicalMatches = [];
    for (const filePath of skillFiles) {
      const content = fs.readFileSync(filePath, 'utf8');
      if (/\bspec-first:[a-z-]+:[a-z-]+\b/.test(content)) {
        canonicalMatches.push(path.relative(projectRoot, filePath));
      }
    }

    if (canonicalMatches.length > 0) {
      checks.push({
        level: 'ERROR',
        name: 'Claude runtime agent references',
        message: `found canonical spec-first agent names in ${canonicalMatches.slice(0, 3).join(', ')}${canonicalMatches.length > 3 ? ', ...' : ''}`,
        fix: 'Run `spec-first init --claude` to regenerate runtime assets with Claude-compatible agent names.',
      });
    }

    const registeredAgentNames = collectRegisteredAgentNames(agentsRoot);
    const unresolvedTaskRefs = findTaskAgentRefs(markdownFiles)
      .filter((ref) => !registeredAgentNames.has(ref.agentName));

    if (unresolvedTaskRefs.length > 0) {
      const samples = unresolvedTaskRefs
        .slice(0, 3)
        .map((ref) => `${path.relative(projectRoot, ref.filePath)} -> ${ref.agentName}`);
      checks.push({
        level: 'ERROR',
        name: 'Claude Task agent references',
        message: `unresolved Task agent names: ${samples.join(', ')}${unresolvedTaskRefs.length > 3 ? ', ...' : ''}`,
        fix: 'Run `spec-first init --claude` after upgrading the CLI so runtime task references match installed agent names.',
      });
    }

    return checks;
  }

  planRuntimeFilesSync(projectRoot) {
    const targetPath = path.join(projectRoot, SESSION_START_RELATIVE_PATH);
    return {
      operations: [
        {
          kind: fs.existsSync(targetPath) ? 'update_file' : 'write_file',
          path: SESSION_START_RELATIVE_PATH.replace(/\\/g, '/'),
          reason: 'managed_runtime_hook',
          contents: fs.readFileSync(SESSION_START_TEMPLATE_PATH, 'utf8'),
          mode: 0o755,
        },
      ],
      summary: {
        [fs.existsSync(targetPath) ? 'update_file' : 'write_file']: 1,
      },
    };
  }

  removeRuntimeFiles(projectRoot) {
    removeManagedFile(path.join(projectRoot, SESSION_START_RELATIVE_PATH), projectRoot);
  }
}

module.exports = ClaudeAdapter;

function rewriteCanonicalAgentNamesForSkills(content) {
  return rewriteCanonicalAgentNamesForExecution(
    content.replace(/\bspec-first:([a-z-]+):([a-z-]+)\b/g, '$2'),
  ).replace(
    /Use fully-qualified agent names inside Task calls\./g,
    'Use bare agent names inside Task calls.',
  );
}

function rewriteCanonicalAgentNamesForExecution(content) {
  return content
    .replace(/Task\s+spec-first:([a-z-]+):([a-z-]+)\(/g, 'Task $2(')
    .replace(/subagent_type:\s*"spec-first:([a-z-]+):([a-z-]+)"/g, 'subagent_type: "$2"');
}

function listMarkdownFiles(rootPath) {
  const results = [];

  function walk(currentPath) {
    for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
      const entryPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        walk(entryPath);
        continue;
      }

      if (entry.isFile() && entry.name.endsWith('.md')) {
        results.push(entryPath);
      }
    }
  }

  walk(rootPath);
  return results;
}

function collectRegisteredAgentNames(agentsRoot) {
  const names = new Set();

  for (const filePath of listMarkdownFiles(agentsRoot)) {
    const content = fs.readFileSync(filePath, 'utf8');
    const match = content.match(/^name:\s*(.+)$/m);
    if (match) {
      names.add(match[1].trim());
    }
  }

  return names;
}

function findTaskAgentRefs(filePaths) {
  const refs = [];

  for (const filePath of filePaths) {
    const content = fs.readFileSync(filePath, 'utf8');
    const matches = content.matchAll(/Task\s+([a-z0-9:-]+)\(/g);
    for (const match of matches) {
      refs.push({ filePath, agentName: match[1] });
    }
  }

  return refs;
}

function inspectSessionStartHook(projectRoot) {
  const targetPath = path.join(projectRoot, SESSION_START_RELATIVE_PATH);
  if (!fs.existsSync(targetPath)) {
    return {
      level: 'WARNING',
      name: SESSION_START_RELATIVE_PATH,
      message: 'missing',
      fix: 'Run `spec-first init --claude` in this project to install the managed SessionStart hook.',
    };
  }

  const actual = fs.readFileSync(targetPath, 'utf8');
  const expected = fs.readFileSync(SESSION_START_TEMPLATE_PATH, 'utf8');
  if (actual !== expected) {
    return {
      level: 'WARNING',
      name: SESSION_START_RELATIVE_PATH,
      message: 'drifted from bundled template',
      fix: 'Run `spec-first init --claude` in this project to restore the managed SessionStart hook.',
    };
  }

  return {
    level: 'PASS',
    name: SESSION_START_RELATIVE_PATH,
    message: 'managed SessionStart hook present',
  };
}

function removeManagedFile(filePath, projectRoot) {
  fs.rmSync(filePath, { force: true });
  removeEmptyParents(path.dirname(filePath), projectRoot);
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
