const fs = require('node:fs');
const path = require('node:path');
const { COMMANDS } = require('./spec-commands');

function getTemplateDir() {
  return path.join(__dirname, '..', '..', 'templates', 'claude', 'commands', 'spec');
}

function readTemplate(commandName) {
  const command = COMMANDS.find((entry) => entry.name === commandName);
  if (!command) {
    throw new Error(`Unknown command template: ${commandName}`);
  }

  const templatePath = path.join(getTemplateDir(), command.filename);
  return fs.readFileSync(templatePath, 'utf8');
}

module.exports = {
  getTemplateDir,
  readTemplate,
};
