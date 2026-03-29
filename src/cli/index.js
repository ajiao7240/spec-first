const fs = require('node:fs');
const path = require('node:path');
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
    '  init --claude  Generate .claude/commands/spec/*, .claude/skills/*, and .claude/agents/* from the bundled plugin assets',
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
  console.log(pkg.version);
}

module.exports = {
  runCli,
};
