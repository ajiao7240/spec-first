const { listBundledCommands } = require('./plugin');

const COMMANDS = listBundledCommands();

function commandNames() {
  return COMMANDS.map((command) => command.name);
}

module.exports = {
  COMMANDS,
  commandNames,
};
