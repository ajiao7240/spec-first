'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SKILL_PATH = path.join(REPO_ROOT, 'skills/report-bug/SKILL.md');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('report-bug contracts', () => {
  test('source skill preserves spec-first branding, repo target, and version source', () => {
    const skill = read(SKILL_PATH);

    // Source naming
    expect(skill).toContain('name: report-bug');
    expect(skill).toContain('spec-first');

    // Headless mode prevents token burn on skill load
    expect(skill).toContain('disable-model-invocation: true');

    // Issue target must point to spec-first repo (not compound-engineering-plugin)
    expect(skill).toContain('sunrain520/spec-first');
    expect(skill).not.toContain('EveryInc/compound-engineering-plugin');

    // Issue title and label must use spec-first branding
    expect(skill).toContain('[spec-first] Bug:');
    expect(skill).toContain('bug,spec-first');
    expect(skill).not.toContain('[compound-engineering]');
    expect(skill).not.toContain('bug,compound-engineering');

    // Success message must reference spec-first (not compound-engineering)
    expect(skill).toContain('https://github.com/sunrain520/spec-first/issues/');
    expect(skill).not.toContain('EveryInc/compound-engineering-plugin/issues/');

    // Version source must reference CLI/package metadata, not plugin registry
    expect(skill).toContain('package.json');
    expect(skill).toContain('.claude-plugin/plugin.json');
    expect(skill).not.toContain('installed_plugins.json');
    expect(skill).not.toContain('plugin registry');

    // Footer must reference standalone skill wording, not a fake slash command
    expect(skill).toContain('*Reported via `report-bug` skill*');
    expect(skill).not.toContain('/report-bug');
    expect(skill).not.toContain('/report-bug-ce');

    // No stale upstream maintainer reference
    expect(skill).not.toContain('Kieran Klaassen');
  });
});
