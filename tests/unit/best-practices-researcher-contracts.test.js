'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const AGENT_PATH = path.join(REPO_ROOT, 'agents/research/best-practices-researcher.md');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('best-practices-researcher contracts', () => {
  test('source agent keeps Ruby/Rails curated skill discovery complete and source attribution explicit', () => {
    const agent = read(AGENT_PATH);

    expect(agent).toContain('Rails/Ruby → `dhh-rails-style`, `andrew-kane-gem-writer`, `dspy-ruby`');
    expect(agent).toContain('Documentation → `spec-compound`, `every-style-editor`');
    expect(agent).toContain('From skill: <skill-name>');
    expect(agent).toContain('The <skill-name> skill recommends...');
    expect(agent).not.toContain('Documentation → `spec:compound`, `every-style-editor`');
    expect(agent).not.toContain('Documentation → `ce:compound`, `every-style-editor`');
    expect(agent).not.toContain('The relevant skill recommends...');
  });
});
