'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SKILL_PATH = path.join(REPO_ROOT, 'skills/spec-optimize/SKILL.md');
const README_PATH = path.join(REPO_ROOT, 'skills/spec-optimize/README.md');
const USAGE_GUIDE_PATH = path.join(REPO_ROOT, 'skills/spec-optimize/references/usage-guide.md');
const SCHEMA_PATH = path.join(REPO_ROOT, 'skills/spec-optimize/references/optimize-spec-schema.yaml');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('spec-optimize contracts', () => {
  test('source skill preserves optimization loop and spec-first state paths', () => {
    const skill = read(SKILL_PATH);

    expect(skill).toContain('name: spec-optimize');
    expect(skill).toContain('.spec-first/workflows/spec-optimize/<spec-name>/');
    expect(skill).toContain('spec-first:research:learnings-researcher');
    expect(skill).toContain('spec-first:research:repo-research-analyst');
    expect(skill).toContain('/spec:review');
    expect(skill).toContain('/spec:compound');
    expect(skill).not.toContain('.context/compound-engineering/ce-optimize/');
    expect(skill).not.toContain('compound-engineering:research');
  });

  test('readme and references use spec-optimize naming', () => {
    const readme = read(README_PATH);
    const usageGuide = read(USAGE_GUIDE_PATH);
    const schema = read(SCHEMA_PATH);

    expect(readme).toContain('`spec-optimize`');
    expect(usageGuide).toContain('`spec-optimize`');
    expect(schema).toContain('spec-optimize run');
    expect(readme).not.toContain('ce-optimize');
    expect(usageGuide).not.toContain('/ce-optimize');
    expect(schema).not.toContain('/ce-optimize');
  });
});
