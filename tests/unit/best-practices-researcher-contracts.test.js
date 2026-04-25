'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const AGENT_PATH = path.join(REPO_ROOT, 'agents/spec-best-practices-researcher.agent.md');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('best-practices-researcher contracts', () => {
  test('source agent keeps curated skill discovery aligned with current skills and source attribution explicit', () => {
    const agent = read(AGENT_PATH);

    expect(agent).toContain('Rails/Ruby → `dhh-rails-style`');
    expect(agent).toContain('Documentation → `spec-compound`');
    expect(agent).toContain('File operations → `git-worktree`, `feature-video` artifacts');
    expect(agent).toContain('From skill: dhh-rails-style');
    expect(agent).toContain('The dhh-rails-style skill recommends...');
    expect(agent).not.toContain('andrew-kane-gem-writer');
    expect(agent).not.toContain('dspy-ruby');
    expect(agent).not.toContain('every-style-editor');
    expect(agent).not.toContain('rclone');
    expect(agent).not.toContain('The relevant skill recommends...');
  });
});
