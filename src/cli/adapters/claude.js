const fs = require('node:fs');
const path = require('node:path');

const PlatformAdapter = require('./base');

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
    const agentsRoot = path.join(projectRoot, this.agentsRoot);

    if (!fs.existsSync(runtimeRoot) || !fs.existsSync(skillsRoot) || !fs.existsSync(agentsRoot)) {
      return [];
    }

    const checks = [];
    const skillFiles = listMarkdownFiles(skillsRoot);
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
