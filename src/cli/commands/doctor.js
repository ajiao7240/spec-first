const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { COMMANDS } = require('../spec-commands');

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
    checkGeneratedCommands(projectRoot),
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
  const commandDir = path.join(projectRoot, '.claude', 'commands', 'spec');
  if (!fs.existsSync(commandDir)) {
    return {
      level: 'WARNING',
      name: '.claude/commands/spec',
      message: 'missing',
      fix: 'Run `spec-first init --claude` in this project.',
    };
  }

  const missing = COMMANDS.filter((command) => {
    const filePath = path.join(commandDir, command.filename);
    return !fs.existsSync(filePath);
  });

  if (missing.length === 0) {
    return {
      level: 'PASS',
      name: '.claude/commands/spec',
      message: `found ${COMMANDS.length} command file(s)`,
    };
  }

  return {
    level: 'WARNING',
    name: '.claude/commands/spec',
    message: `missing ${missing.map((entry) => entry.filename).join(', ')}`,
    fix: 'Run `spec-first init --claude` to regenerate the missing files.',
  };
}

function printHelp() {
  console.log('Usage: spec-first doctor');
}

module.exports = {
  runDoctor,
};
