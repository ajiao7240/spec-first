'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SKILL_PATH = path.join(REPO_ROOT, 'skills', 'git-commit-push-pr', 'SKILL.md');
const PR_DESCRIPTION_SKILL_PATH = path.join(REPO_ROOT, 'skills', 'spec-pr-description', 'SKILL.md');
const PR_DESCRIPTION_COMMAND_PATH = path.join(REPO_ROOT, 'templates', 'claude', 'commands', 'spec', 'pr-description.md');
const WRITING_REFERENCE_PATH = path.join(
  REPO_ROOT,
  'skills',
  'git-commit-push-pr',
  'references',
  'pr-description-writing.md',
);

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('git-commit-push-pr PR description contracts', () => {
  test('description-only intent does not run commit or push gates', () => {
    const text = read(SKILL_PATH);

    expect(text).toContain('"rewrite the PR body"');
    expect(text).toContain('"write a PR description"');
    expect(text).toContain('"draft a PR description"');
    expect(text).toContain('"describe this PR"');
    expect(text).toContain('generate a description without touching git state');
    expect(text).toContain('Description-only generation');
    expect(text).toContain('skip Steps 4-5 and Step 1\'s decision tree');
    expect(text).toContain('Print the title/body path result back to the user');
  });

  test('keeps PR description writing inside git-commit-push-pr after CE deletion', () => {
    const text = read(SKILL_PATH);
    const reference = read(WRITING_REFERENCE_PATH);

    expect(text).toContain('compose using `references/pr-description-writing.md`');
    expect(text).toContain('Generate title and body using the PR description writing reference');
    expect(text).toContain('Spec-First badge footer');
    expect(reference).toContain('## Step Pre-A: Resolve the PR commit range and diff');
    expect(reference).toContain('Spec-First badge');
    expect(reference).toContain('Built_with-Spec_First');
    expect(text).not.toContain('ce-pr-description');
    expect(text).not.toContain('spec-pr-description');
    expect(reference).not.toContain('ce-commit-push-pr');
    expect(reference).not.toContain('Compound Engineering');
    expect(text).not.toContain('ask_user` in Gemini');
    expect(text).not.toContain('ask_user` in Pi');
    expect(text).not.toContain('Compound Engineering badge');
  });

  test('standalone spec-pr-description workflow is removed', () => {
    expect(fs.existsSync(PR_DESCRIPTION_SKILL_PATH)).toBe(false);
    expect(fs.existsSync(PR_DESCRIPTION_COMMAND_PATH)).toBe(false);
  });
});
