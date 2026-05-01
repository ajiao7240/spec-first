'use strict';

const HOST_COMPARATIVE_RUNTIME_SKILLS = new Set([
  'spec-update',
]);

const CODEX_ALLOWED_OTHER_HOST_PATHS = {
  'spec-update': [
    '.claude/commands/spec/update.md',
  ],
};

function isHostComparativeRuntimeSkill(skillName) {
  return HOST_COMPARATIVE_RUNTIME_SKILLS.has(skillName);
}

function maskAllowedCodexOtherHostPaths(content, skillName) {
  let masked = content;
  for (const allowedPath of CODEX_ALLOWED_OTHER_HOST_PATHS[skillName] || []) {
    masked = masked.split(allowedPath).join(`[allowed ${skillName} other-host path]`);
  }
  return masked;
}

module.exports = {
  isHostComparativeRuntimeSkill,
  maskAllowedCodexOtherHostPaths,
};
