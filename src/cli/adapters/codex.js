const fs = require('node:fs');
const path = require('node:path');

const PlatformAdapter = require('./base');

/**
 * Codex platform adapter
 *
 * Codex support is project-scoped:
 * - user-visible workflow entrypoints are discovered from `.agents/skills/`
 * - `.codex/commands/spec/` is treated as a legacy compatibility layer cleanup target only
 * - reusable reviewer/research agent profiles live in `.codex/agents/`
 * - spec-first state remains under `.codex/spec-first/`
 */
class CodexAdapter extends PlatformAdapter {
  get id() {
    return 'codex';
  }

  get runtimeRoot() {
    return '.codex';
  }

  get managedRoot() {
    return '.codex/spec-first';
  }

  get hasCommands() {
    return false;
  }

  get commandRoot() {
    return '.codex/commands/spec';
  }

  get skillsRoot() {
    return '.agents/skills';
  }

  get workflowsRoot() {
    return '.agents/skills';
  }

  get agentsRoot() {
    return '.codex/agents';
  }

  get stateFile() {
    return '.codex/spec-first/state.json';
  }

  get developerFile() {
    return '.codex/spec-first/.developer';
  }

  get instructionFile() {
    return 'AGENTS.md';
  }

  get legacyCommandRoot() {
    return '.codex/spec-first/commands';
  }

  get legacyCodexSkillsRoot() {
    return '.codex/skills';
  }

  get legacyMarketplaceRoot() {
    return '.agents/plugins';
  }

  get legacyPluginRoot() {
    return 'plugins/spec';
  }

  get legacyPluginRootAlt() {
    return 'plugins/spec-first';
  }

  transformSkillContent(content, context = {}) {
    const transformed = rewriteSkillName(
      transformCodexContent(rewriteSharedPaths(content)),
      codexRuntimeSkillName(context),
    );
    return context.skillName === 'using-spec-first'
      ? preserveUsingSpecFirstHostInstallNotes(transformed)
      : transformed;
  }

  transformAgentContent(content) {
    return transformCodexContent(rewriteSharedPaths(content));
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
      commands: this.hasCommands ? fs.existsSync(commandDir) : false,
      skills: fs.existsSync(skillsDir),
      agents: fs.existsSync(agentsDir),
      state: fs.existsSync(stateFilePath),
      developer: fs.existsSync(developerFilePath),
    };
  }

  planRuntimeFilesSync() {
    const operations = buildRuntimeCleanupOperations(this);

    return {
      operations,
      summary: {
        remove_dir: operations.length,
      },
    };
  }

  planRuntimeFilesRemoval() {
    const operations = buildRuntimeCleanupOperations(this);
    return {
      operations,
      summary: {
        remove_dir: operations.length,
      },
    };
  }

  inspectRuntimeFiles() {
    return [];
  }

  removeRuntimeFiles(projectRoot) {
    removeManagedDirectory(path.join(projectRoot, this.commandRoot), projectRoot);
    removeManagedDirectory(path.join(projectRoot, this.legacyCommandRoot), projectRoot);
    removeManagedDirectory(path.join(projectRoot, this.legacyCodexSkillsRoot), projectRoot);
    removeManagedDirectory(path.join(projectRoot, this.legacyMarketplaceRoot), projectRoot);
    removeManagedDirectory(path.join(projectRoot, this.legacyPluginRoot), projectRoot);
    removeManagedDirectory(path.join(projectRoot, this.legacyPluginRootAlt), projectRoot);
  }
}

module.exports = CodexAdapter;

function rewriteSharedPaths(content) {
  return content
    .replace(/\.claude\/commands\/spec\/([a-z-]+)\.md/g, (_match, commandName) => {
      return `.agents/skills/spec-${commandName}/SKILL.md`;
    })
    .replace(/\.codex\/commands\/spec\/([a-z-]+)\.md/g, (_match, commandName) => {
      return `.agents/skills/spec-${commandName}/SKILL.md`;
    })
    .replace(/\.claude\/spec-first\/workflows\//g, '.agents/skills/')
    .replace(/\.claude\/skills\//g, '.agents/skills/')
    .replace(/\.codex\/skills\//g, '.agents/skills/')
    .replace(/\.claude\/agents\//g, '.codex/agents/')
    .replace(/\.codex\/agents\//g, '.codex/agents/')
    .replace(/--claude\b/g, '--codex')
    .replace(
      /(spec-first\s+(?:init|clean)\s+--codex\s+#\s*)Claude 运行时/g,
      '$1Codex 运行时',
    )
    .replace(
      /(spec-first\s+(?:init|clean)\s+--codex\s+#\s*)Claude runtime/gi,
      '$1Codex runtime',
    )
    .replace(
      /^(spec-first\s+(?:init|clean)\s+--codex\s+#\s*Codex 运行时)\n(?:spec-first\s+(?:init|clean)\s+--codex\s+#\s*Codex 运行时)$/gm,
      '$1',
    )
    .replace(
      /^(spec-first\s+(?:init|clean)\s+--codex\s+#\s*Codex runtime)\n(?:spec-first\s+(?:init|clean)\s+--codex\s+#\s*Codex runtime)$/gm,
      '$1',
    );
}

function preserveUsingSpecFirstHostInstallNotes(content) {
  return content.replace(
    'Claude Code installs it as `.agents/skills/using-spec-first/SKILL.md`',
    'Claude Code installs it as `.claude/skills/using-spec-first/SKILL.md`',
  );
}

function transformCodexContent(content) {
  let transformed = content;

  transformed = transformed.replace(
    /^(\s*-?\s*)Task\s+(spec-[a-z0-9-]+)\((.*)\)\s*$/gm,
    (_match, prefix, agentName, args) => {
      const summary = args.trim();
      const agentPath = `.codex/agents/${agentName}.agent.md`;
      return summary
        ? `${prefix}Read \`${agentPath}\` and apply that agent profile to: ${summary}`
        : `${prefix}Read \`${agentPath}\` and apply that agent profile`;
    },
  );

  transformed = transformed.replace(
    /`(spec-[a-z0-9-]+(?:agent|reviewer|researcher|analyst|specialist|oracle|sentinel|guardian|strategist|expert|detector|sync|resolver|historian|writer))`/g,
    (_match, agentName) => `\`.codex/agents/${agentName}.agent.md\``,
  );

  return transformed;
}

function rewriteSkillName(content, skillName) {
  if (!skillName) {
    return content;
  }

  return content.replace(/^name:\s*.+$/m, `name: ${skillName}`);
}

function codexRuntimeSkillName(context = {}) {
  const skillName = context.skillName;
  if (context.isWorkflowSkill || typeof skillName !== 'string' || !skillName.startsWith('spec-')) {
    return skillName;
  }

  return skillName.replace(/^spec-/, '');
}

function buildRuntimeCleanupOperations(adapter) {
  return [
    adapter.commandRoot,
    adapter.legacyCommandRoot,
    adapter.legacyCodexSkillsRoot,
    adapter.legacyMarketplaceRoot,
    adapter.legacyPluginRoot,
    adapter.legacyPluginRootAlt,
  ].map((relativePath) => ({
    kind: 'remove_dir',
    path: relativePath,
    reason: 'managed_runtime_cleanup',
  }));
}

function removeManagedDirectory(directoryPath, projectRoot) {
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

    if (fs.readdirSync(current).length > 0) {
      break;
    }

    fs.rmdirSync(current);
    current = path.dirname(current);
  }
}
