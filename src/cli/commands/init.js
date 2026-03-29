const fs = require('node:fs');
const path = require('node:path');
const { COMMANDS } = require('../spec-commands');
const { readTemplate } = require('../templates');

function runInit(argv) {
  const args = [...argv];

  if (args.includes('-h') || args.includes('--help')) {
    printHelp();
    return 0;
  }

  const allowed = new Set(['--claude', '--force']);
  const unknown = args.filter((arg) => !allowed.has(arg));
  if (unknown.length > 0 || !args.includes('--claude')) {
    console.error('Usage: spec-first init --claude');
    return 1;
  }

  const projectRoot = process.cwd();
  const commandDir = path.join(projectRoot, '.claude', 'commands', 'spec');
  fs.mkdirSync(commandDir, { recursive: true });

  const written = [];

  for (const command of COMMANDS) {
    const destination = path.join(commandDir, command.filename);
    const content = readTemplate(command.name);

    fs.writeFileSync(destination, content, 'utf8');
    written.push(command.filename);
  }

  console.log(`Generated ${written.length} command file(s) in ${path.relative(projectRoot, commandDir)}`);
  for (const file of written) {
    console.log(`  - ${file}`);
  }

  console.log('');
  console.log('Restart Claude Code after generation so it can pick up the new /spec:* commands.');
  return 0;
}

function printHelp() {
  console.log('Usage: spec-first init --claude');
}

module.exports = {
  runInit,
};
