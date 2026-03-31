const fs = require('node:fs');
const path = require('node:path');
const { runClean } = require('./commands/clean');
const { runDoctor } = require('./commands/doctor');
const { runInit } = require('./commands/init');

function runCli(argv) {
  const args = [...argv];
  const cmd = args[0];

  if (!cmd || cmd === '--help' || cmd === '-h') {
    printHelp();
    return Promise.resolve(0);
  }

  if (cmd === '--version' || cmd === '-v') {
    printVersion();
    return Promise.resolve(0);
  }

  if (cmd === 'doctor') {
    return Promise.resolve(runDoctor(args.slice(1)));
  }

  if (cmd === 'init') {
    return Promise.resolve(runInit(args.slice(1)));
  }

  if (cmd === 'clean') {
    return Promise.resolve(runClean(args.slice(1)));
  }

  console.error(`Unknown command: ${cmd}`);
  printHelp(true);
  return Promise.resolve(1);
}

function printHelp(withErrorPrefix = false) {
  const lines = [
    'Usage: spec-first <command> [options]',
    '',
    'Commands:',
    '  doctor         Check the local environment plus bundled plugin manifest, commands, skills, and agents',
    '  init (--claude|--codex)  Generate platform-specific commands, skills, agents, and developer profile',
    '  clean (--claude|--codex) Remove spec-first managed assets from the current project',
    '',
    'Global options:',
    '  -h, --help     Show help',
    '  -v, --version  Show version',
  ];

  if (withErrorPrefix) {
    console.error(lines.join('\n'));
    return;
  }

  console.log(lines.join('\n'));
}

function printVersion() {
  const pkgPath = path.join(__dirname, '..', '..', 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🚀 Spec-First v${pkg.version}                                  ║
║                                                            ║
║   📦 Harness Engineering for Claude Code & Codex         ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝

✨ Quick Start:

  1️⃣  Initialize in your project:
     $ cd your-project
     $ spec-first init --claude
     $ spec-first init --codex

  2️⃣  Start with ideation or your first spec workflow:
     $ /spec:ideate
     $ /spec:brainstorm

  3️⃣  Learn more:
     📖 Docs: https://github.com/sunrain520/spec-first
     💡 Help: spec-first --help

🎯 Core Commands:
  /spec:ideate      - Explore and rank improvement ideas
  /spec:brainstorm  - Clarify requirements
  /spec:plan        - Design solution
  /spec:work        - Execute implementation
  /spec:review      - Structured review
  /spec:compound    - Knowledge accumulation
`);
}

module.exports = {
  runCli,
};
