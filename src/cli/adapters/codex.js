const PlatformAdapter = require('./base');

/**
 * Codex platform adapter
 * MVP: Reuses Claude transformation logic, paths point to .codex/
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

  get commandRoot() {
    return '.codex/commands/spec';
  }

  get skillsRoot() {
    return '.codex/skills';
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

  transformSkillContent(content) {
    // MVP: Same as Claude, adjust when Codex conventions are confirmed
    return content.replace(/\bspec-first:([a-z-]+):([a-z-]+)\b/g, '$1:$2');
  }

  transformAgentContent(content) {
    // MVP: Same as Claude, adjust when Codex conventions are confirmed
    return content.replace(/\bspec-first:([a-z-]+):([a-z-]+)\b/g, '$1:$2');
  }

  inspect(projectRoot) {
    const fs = require('node:fs');
    const path = require('node:path');

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
}

module.exports = CodexAdapter;
