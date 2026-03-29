const { getBundledPath, listBundledAgents, syncAgents: syncBundledAgents } = require('./plugin');

function getAgentSourceDir() {
  return getBundledPath('agents');
}

function listAgentPaths() {
  return listBundledAgents();
}

function syncAgents(projectRoot) {
  return syncBundledAgents(projectRoot);
}

module.exports = {
  getAgentSourceDir,
  listAgentPaths,
  syncAgents,
};
