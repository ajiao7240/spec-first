'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SKILL_PATH = path.join(REPO_ROOT, 'skills/git-commit-push-pr/SKILL.md');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('git-commit-push-pr contracts', () => {
  test('skill preserves Claude context reuse and description-update workflow as first-class contracts', () => {
    const skill = read(SKILL_PATH);

    expect(skill).toContain('## Context');
    expect(skill).toContain('If you are Claude Code');
    expect(skill).toContain('**Git status:**');
    expect(skill).toContain("!`git status`");
    expect(skill).toContain("!`gh pr view --json url,title,state 2>/dev/null || echo 'NO_OPEN_PR'`");
    expect(skill).toContain('### Context fallback');
    expect(skill).toContain("printf '=== STATUS ===\\n'; git status;");

    expect(skill).toContain('## Description Update workflow');
    expect(skill).toContain('Update the PR description for this branch?');
    expect(skill).toContain('Classify commits');
    expect(skill).toContain('Decide on evidence');
    expect(skill).toContain('current PR description already contains evidence');
    expect(skill).toContain('Compare and confirm');
  });

  test('skill preserves upstream review-writing guidance while keeping spec-first integrations', () => {
    const skill = read(SKILL_PATH);

    expect(skill).toContain('Evidence for PR descriptions');
    expect(skill).toContain('feature-video');
    expect(skill).toContain('test-browser');
    expect(skill).toContain('agent-browser');
    expect(skill).toContain('Classify commits before writing');
    expect(skill).toContain('Frame the narrative before sizing');
    expect(skill).toContain('Writing voice');
    expect(skill).toContain('Visual communication');
    expect(skill).toContain('Spec First badge');
    expect(skill).toContain('Generated with [MODEL] ([CONTEXT] context, [THINKING]) via [HARNESS](HARNESS_URL)');

    expect(skill).not.toContain('Compound Engineering badge');
    expect(skill).not.toContain('Built_with-Compound_Engineering');
    expect(skill).not.toContain('ce-demo-reel');
  });
});
