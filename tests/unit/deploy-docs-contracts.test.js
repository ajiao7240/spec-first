'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SKILL_PATH = path.join(REPO_ROOT, 'skills/deploy-docs/SKILL.md');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('deploy-docs contracts', () => {
  test('skill preserves upstream GitHub Pages deployment workflow contract', () => {
    const skill = read(SKILL_PATH);

    expect(skill).toContain('## Step 1: Validate Documentation');
    expect(skill).toContain('## Step 2: Check for Uncommitted Changes');
    expect(skill).toContain('## Step 3: Deployment Instructions');
    expect(skill).toContain('permissions:');
    expect(skill).toContain('pages: write');
    expect(skill).toContain('id-token: write');
    expect(skill).toContain('actions/upload-pages-artifact@v3');
    expect(skill).toContain('## Step 4: Report Status');
  });

  test('skill targets the current repo root instead of stale plugin mirror paths', () => {
    const skill = read(SKILL_PATH);

    expect(skill).toContain("find agents -maxdepth 1 -name '*.md'");
    expect(skill).toContain("find skills -mindepth 1 -maxdepth 1 -type d");
    expect(skill).toContain('cat .claude-plugin/plugin.json');
    expect(skill).toContain('docs/05-用户手册/README.md');
    expect(skill).toContain('docs/10-prompt/README.md');
    expect(skill).toContain('git status --porcelain docs/ .claude-plugin/plugin.json');
    expect(skill).toContain("      - 'docs/**'");
    expect(skill).toContain("      - '.claude-plugin/plugin.json'");
    expect(skill).toContain("path: 'docs'");
    expect(skill).toContain("Check deployment at the repository's configured GitHub Pages URL");

    expect(skill).not.toContain('plugins/compound-engineering/');
    expect(skill).not.toContain('plugins/spec-first/');
    expect(skill).not.toContain('https://everyinc.github.io/spec-first-plugin/');
  });
});
