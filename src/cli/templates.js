const { getBundledPath, readBundledCommandTemplate } = require('./plugin');

function getTemplateDir() {
  return getBundledPath('commands');
}

function readTemplate(commandName) {
  return readBundledCommandTemplate(commandName);
}

module.exports = {
  getTemplateDir,
  readTemplate,
};
