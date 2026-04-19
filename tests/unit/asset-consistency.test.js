'use strict';

const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.join(__dirname, '..', '..');

function walkFiles(rootDir, skipNames = new Set(['.git', 'node_modules', '.spec-first', '.claude', '.codex', '.agents'])) {
  const results = [];

  function walk(currentDir) {
    if (!fs.existsSync(currentDir)) return;
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      if (skipNames.has(entry.name)) continue;
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(absolutePath);
        continue;
      }
      if (entry.isFile()) {
        results.push(absolutePath);
      }
    }
  }

  walk(rootDir);
  return results;
}

function isTextFile(filePath) {
  return /\.(cjs|js|json|md|sh|txt|yaml|yml)$/i.test(filePath);
}

describe('asset consistency governance', () => {
  test('every source skill has a prompt docs mirror', () => {
    const skillsRoot = path.join(repoRoot, 'skills');
    const mirrorRoot = path.join(repoRoot, 'docs', '10-prompt', 'skills');
    const missing = fs.readdirSync(skillsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((skillName) => !fs.existsSync(path.join(mirrorRoot, skillName, 'SKILL.md')));

    expect(missing).toEqual([]);
  });

  test('package version and plugin manifest version stay aligned', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
    const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, '.claude-plugin', 'plugin.json'), 'utf8'));

    expect(manifest.version).toBe(pkg.version);
  });

  test('retired bootstrap entrypoints do not reappear in source assets or docs', () => {
    const retiredSkill = ['spec', 'bootstrap'].join('-');
    const retiredClaudeEntry = ['/spec', 'bootstrap'].join(':');
    const retiredCodexEntry = `$${retiredSkill}`;
    const forbidden = [retiredSkill, retiredClaudeEntry, retiredCodexEntry];
    const searchRoots = [
      'README.md',
      'README.zh-CN.md',
      'docs',
      'skills',
      'templates',
      'src',
      'tests',
    ];

    const hits = [];
    for (const relativeRoot of searchRoots) {
      const absoluteRoot = path.join(repoRoot, relativeRoot);
      const files = fs.existsSync(absoluteRoot) && fs.statSync(absoluteRoot).isDirectory()
        ? walkFiles(absoluteRoot)
        : [absoluteRoot];

      for (const filePath of files.filter(isTextFile)) {
        const content = fs.readFileSync(filePath, 'utf8');
        for (const token of forbidden) {
          if (content.includes(token)) {
            hits.push(`${path.relative(repoRoot, filePath)} -> ${token}`);
          }
        }
      }
    }

    expect(hits).toEqual([]);
  });
});
