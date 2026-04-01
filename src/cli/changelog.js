const fs = require('node:fs');
const path = require('node:path');

/**
 * Bootstrap CHANGELOG.md at projectRoot if it does not already exist.
 *
 * Creates the file with a format header and one initial entry. If the file
 * already exists, this is a no-op — CHANGELOG.md is user-owned once created.
 *
 * @param {string} projectRoot
 * @param {{ name: string, version: string }} developer
 * @returns {boolean} true if the file was created, false if it already existed
 */
function bootstrapChangelog(projectRoot, developer) {
  const filePath = path.join(projectRoot, 'CHANGELOG.md');

  if (fs.existsSync(filePath)) {
    return false;
  }

  const today = new Date().toISOString().slice(0, 10);
  const name = developer.name || '';
  const version = developer.version || '';

  const content = buildInitialChangelog(today, name, version);
  fs.writeFileSync(filePath, content, 'utf8');
  return true;
}

/**
 * Build the initial CHANGELOG.md content.
 * Exported for unit testing.
 *
 * @param {string} today    - YYYY-MM-DD
 * @param {string} name     - developer name
 * @param {string} version  - spec-first version
 * @returns {string}
 */
function buildInitialChangelog(today, name, version) {
  const versionSuffix = version ? ` v${version}` : '';
  return `# Changelog

Entry format: \`- YYYY-MM-DD author: summary [(user-visible)]\`
Release sections: \`## vX.Y.Z - YYYY-MM-DD\`

## [Unreleased]

- ${today} ${name}: Initialize project with spec-first${versionSuffix}
`;
}

module.exports = {
  bootstrapChangelog,
  buildInitialChangelog,
};
