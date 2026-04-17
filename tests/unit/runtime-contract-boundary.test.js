'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const CLI_ROOT = path.join(REPO_ROOT, 'src', 'cli');
const ALLOWED_RUNTIME_GOVERNANCE_OWNERS = new Set([
  path.join('src', 'cli', 'plugin.js'),
]);
const RUNTIME_GOVERNANCE_MARKERS = [
  'skills-governance.json',
  'skills-governance.schema.json',
  'dual-host-governance',
];
const FORBIDDEN_DOCS_SIDE_GOVERNANCE_PATHS = [
  'docs/contracts/dual-host-governance/skills-governance.json',
  'docs/contracts/dual-host-governance/skills-governance.schema.json',
];

function collectJsFiles(currentPath) {
  const files = [];

  for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
    const nextPath = path.join(currentPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectJsFiles(nextPath));
      continue;
    }

    if (entry.isFile() && path.extname(entry.name) === '.js') {
      files.push(nextPath);
    }
  }

  return files.sort((a, b) => a.localeCompare(b));
}

describe('runtime contract boundary', () => {
  test('src/cli runtime code does not reference docs-side machine-readable governance path', () => {
    const offenders = collectJsFiles(CLI_ROOT)
      .filter((filePath) => {
        const content = fs.readFileSync(filePath, 'utf8');
        return FORBIDDEN_DOCS_SIDE_GOVERNANCE_PATHS.some((forbiddenPath) => content.includes(forbiddenPath));
      })
      .map((filePath) => path.relative(REPO_ROOT, filePath));

    expect(offenders).toEqual([]);
  });

  test('runtime governance path ownership stays centralized in plugin.js', () => {
    const owners = collectJsFiles(CLI_ROOT)
      .filter((filePath) => {
        const content = fs.readFileSync(filePath, 'utf8');
        return RUNTIME_GOVERNANCE_MARKERS.some((marker) => content.includes(marker));
      })
      .map((filePath) => path.relative(REPO_ROOT, filePath))
      .sort((a, b) => a.localeCompare(b));

    expect(owners).toEqual([...ALLOWED_RUNTIME_GOVERNANCE_OWNERS].sort((a, b) => a.localeCompare(b)));
  });
});
