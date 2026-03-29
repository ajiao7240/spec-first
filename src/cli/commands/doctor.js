const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { inspectInstalledAssets, listBundledCommands, loadPluginManifest } = require('../plugin');
const { readState } = require('../state');

function runDoctor(argv) {
  const args = [...argv];

  if (args.includes('-h') || args.includes('--help')) {
    printHelp();
    return 0;
  }

  if (args.length > 0) {
    console.error('Usage: spec-first doctor');
    return 1;
  }

  const projectRoot = process.cwd();
  const checks = [
    checkNodeVersion(),
    checkGit(),
    checkClaude(),
    checkPluginManifest(),
    checkManagedState(projectRoot),
    checkGeneratedCommands(projectRoot),
    checkInstalledSkills(projectRoot),
    checkInstalledAgents(projectRoot),
  ];

  for (const check of checks) {
    const label = check.level.toUpperCase().padEnd(7);
    console.log(`${label} ${check.name}: ${check.message}`);
    if (check.fix) {
      console.log(`         Fix: ${check.fix}`);
    }
  }

  return checks.some((check) => check.level === 'ERROR') ? 1 : 0;
}

function checkNodeVersion() {
  const version = process.version;
  const major = Number.parseInt(version.slice(1).split('.')[0], 10);
  if (Number.isFinite(major) && major >= 20) {
    return { level: 'PASS', name: 'Node.js', message: version };
  }

  return {
    level: 'ERROR',
    name: 'Node.js',
    message: version,
    fix: 'Install Node.js 20 or newer.',
  };
}

function checkGit() {
  const result = spawnSync('git', ['--version'], { encoding: 'utf8' });
  if (result.status === 0) {
    return {
      level: 'PASS',
      name: 'Git',
      message: result.stdout.trim(),
    };
  }

  return {
    level: 'ERROR',
    name: 'Git',
    message: 'not found',
    fix: 'Install Git and ensure it is on PATH.',
  };
}

function checkClaude() {
  const result = spawnSync('claude', ['--version'], { encoding: 'utf8' });
  if (result.status === 0) {
    return {
      level: 'PASS',
      name: 'Claude Code',
      message: result.stdout.trim() || 'available',
    };
  }

  if (result.error && result.error.code === 'ENOENT') {
    return {
      level: 'WARNING',
      name: 'Claude Code',
      message: 'not found on PATH',
      fix: 'Install Claude Code CLI and restart your shell.',
    };
  }

  return {
    level: 'WARNING',
    name: 'Claude Code',
    message: 'could not verify version',
    fix: 'Run `claude --version` manually to confirm the CLI works.',
  };
}

function checkGeneratedCommands(projectRoot) {
  let commandStatus;
  try {
    commandStatus = inspectInstalledAssets(projectRoot).commands;
  } catch (error) {
    return {
      level: 'ERROR',
      name: '.claude/commands/spec',
      message: error instanceof Error ? error.message : String(error),
      fix: 'Reinstall the spec-first package so bundled command templates are available.',
    };
  }

  if (!fs.existsSync(commandStatus.targetRoot)) {
    return {
      level: 'WARNING',
      name: '.claude/commands/spec',
      message: 'missing',
      fix: 'Run `spec-first init --claude` in this project.',
    };
  }

  if (commandStatus.missing.length === 0) {
    return {
      level: 'PASS',
      name: '.claude/commands/spec',
      message: `found ${commandStatus.entries.length} command file(s)`,
    };
  }

  return {
    level: 'WARNING',
    name: '.claude/commands/spec',
    message: `missing ${commandStatus.missing.map((entry) => entry.filename).join(', ')}`,
    fix: 'Run `spec-first init --claude` to regenerate the missing files.',
  };
}

function checkInstalledSkills(projectRoot) {
  let skillStatus;
  try {
    skillStatus = inspectInstalledAssets(projectRoot).skills;
  } catch (error) {
    return {
      level: 'ERROR',
      name: '.claude/skills',
      message: error instanceof Error ? error.message : String(error),
      fix: 'Reinstall the spec-first package so bundled skills are available.',
    };
  }

  if (!fs.existsSync(skillStatus.targetRoot)) {
    return {
      level: 'WARNING',
      name: '.claude/skills',
      message: 'missing',
      fix: 'Run `spec-first init --claude` in this project to install bundled skills.',
    };
  }

  if (skillStatus.missing.length === 0) {
    return {
      level: 'PASS',
      name: '.claude/skills',
      message: `found ${skillStatus.entries.length} skill directory(ies)`,
    };
  }

  return {
    level: 'WARNING',
    name: '.claude/skills',
    message: `out of sync (${skillStatus.entries.length - skillStatus.missing.length}/${skillStatus.entries.length} installed)`,
    fix: 'Run `spec-first init --claude` in this project to resync bundled skills.',
  };
}

function checkInstalledAgents(projectRoot) {
  let agentStatus;
  try {
    agentStatus = inspectInstalledAssets(projectRoot).agents;
  } catch (error) {
    return {
      level: 'ERROR',
      name: '.claude/agents',
      message: error instanceof Error ? error.message : String(error),
      fix: 'Reinstall the spec-first package so bundled agents are available.',
    };
  }

  if (!fs.existsSync(agentStatus.targetRoot)) {
    return {
      level: 'WARNING',
      name: '.claude/agents',
      message: 'missing',
      fix: 'Run `spec-first init --claude` in this project to install bundled agents.',
    };
  }

  if (agentStatus.missing.length === 0) {
    return {
      level: 'PASS',
      name: '.claude/agents',
      message: `found ${agentStatus.entries.length} agent file(s)`,
    };
  }

  return {
    level: 'WARNING',
    name: '.claude/agents',
    message: `out of sync (${agentStatus.entries.length - agentStatus.missing.length}/${agentStatus.entries.length} installed)`,
    fix: 'Run `spec-first init --claude` in this project to resync bundled agents.',
  };
}

function checkPluginManifest() {
  try {
    const manifest = loadPluginManifest();
    const commandCount = listBundledCommands().length;
    return {
      level: 'PASS',
      name: '.claude-plugin/plugin.json',
      message: `${manifest.name}@${manifest.version} with ${commandCount} command definition(s)`,
    };
  } catch (error) {
    return {
      level: 'ERROR',
      name: '.claude-plugin/plugin.json',
      message: error instanceof Error ? error.message : String(error),
      fix: 'Restore the bundled plugin manifest and reinstall the package.',
    };
  }
}

function checkManagedState(projectRoot) {
  const statePath = path.join(projectRoot, '.claude', 'spec-first', 'state.json');
  if (!fs.existsSync(statePath)) {
    return {
      level: 'WARNING',
      name: '.claude/spec-first/state.json',
      message: 'missing',
      fix: 'Run `spec-first init --claude` in this project to record managed assets.',
    };
  }

  try {
    const state = readState(projectRoot);
    const manifest = loadPluginManifest();
    if (!state || !state.manifestVersion) {
      return {
        level: 'WARNING',
        name: '.claude/spec-first/state.json',
        message: 'invalid or empty',
        fix: 'Run `spec-first init --claude` in this project to regenerate the managed asset state.',
      };
    }

    if (state.manifestVersion !== manifest.version) {
      return {
        level: 'WARNING',
        name: '.claude/spec-first/state.json',
        message: `recorded ${state.manifestVersion}, bundled ${manifest.version}`,
        fix: 'Run `spec-first init --claude` in this project to resync managed assets after upgrading.',
      };
    }

    return {
      level: 'PASS',
      name: '.claude/spec-first/state.json',
      message: `recorded ${state.commands.length} commands, ${state.skills.length} skills, ${state.agents.length} agents`,
    };
  } catch (error) {
    return {
      level: 'WARNING',
      name: '.claude/spec-first/state.json',
      message: error instanceof Error ? error.message : String(error),
      fix: 'Run `spec-first init --claude` in this project to regenerate the managed asset state.',
    };
  }
}

function printHelp() {
  console.log('Usage: spec-first doctor');
}

module.exports = {
  runDoctor,
};
