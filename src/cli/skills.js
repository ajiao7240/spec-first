const { getBundledPath, inspectInstalledAssets, listBundledSkills, syncSkills: syncBundledSkills } = require('./plugin');

function getSkillSourceDir() {
  return getBundledPath('skills');
}

function listSkillNames() {
  return listBundledSkills();
}

function syncSkills(projectRoot) {
  return syncBundledSkills(projectRoot);
}

function checkInstalledSkills(projectRoot) {
  const result = inspectInstalledAssets(projectRoot).skills;
  return {
    skillNames: result.entries,
    targetRoot: result.targetRoot,
    missing: result.missing,
  };
}

module.exports = {
  checkInstalledSkills,
  getSkillSourceDir,
  listSkillNames,
  syncSkills,
};
