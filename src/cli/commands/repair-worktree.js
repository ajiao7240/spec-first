'use strict';

const path = require('node:path');
const { spawnSyncWithTimeout } = require('../external-command');

function runRepairWorktree(argv) {
  const args = Array.isArray(argv) ? [...argv] : [];
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    return 0;
  }

  const scriptPath = path.join(
    __dirname,
    '..',
    '..',
    '..',
    'skills',
    'spec-mcp-setup',
    'scripts',
    process.platform === 'win32' ? 'repair-worktree.ps1' : 'repair-worktree.sh',
  );
  const command = process.platform === 'win32' ? 'pwsh' : 'bash';
  const commandArgs = process.platform === 'win32'
    ? ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, ...toPowerShellArgs(args)]
    : [scriptPath, ...args];

  const result = spawnSyncWithTimeout(command, commandArgs, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 10000,
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) {
    console.error(`repair-worktree failed to start: ${result.error.message}`);
    return 1;
  }
  return typeof result.status === 'number' ? result.status : 1;
}

function toPowerShellArgs(args) {
  return args.map((arg) => {
    if (arg === '--dry-run') return '-DryRun';
    if (arg === '--apply') return '-Apply';
    if (arg === '--unlink') return '-Unlink';
    return arg;
  });
}

function printHelp() {
  process.stdout.write(`Usage: spec-first repair-worktree [--dry-run]\n\nPreview broken Git worktree pointer repair guidance. This command never deletes .git.\n`);
}

module.exports = {
  runRepairWorktree,
};
