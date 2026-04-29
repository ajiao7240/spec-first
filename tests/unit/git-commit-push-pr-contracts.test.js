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

    expect(text).toContain('"write/draft/refresh/rewrite PR description"');
    expect(text).toContain('"describe this PR"');
    expect(text).toContain('generate a description without touching git state');
    expect(text).toContain('Description-only generation');
    expect(text).toContain('skip Steps 4-5 AND Step 1\'s decision tree');
    expect(text).toContain('pass it to Step 6 as the PR ref so Pre-A resolves the right commit range');
    expect(text).toContain('Print the result back to the user');
  });

  test('keeps PR description writing inside git-commit-push-pr after CE deletion', () => {
    const text = read(SKILL_PATH);
    const reference = read(WRITING_REFERENCE_PATH);

    expect(text).toContain('**Read `references/pr-description-writing.md` once now**');
    expect(text).toContain('Run Step Pre-A from the reference');
    expect(text).toContain('Step 6 walks through it in order (Pre-A through H)');
    expect(text).toContain('the Spec-First badge');
    expect(text).toContain('BODY_FILE=$(mktemp "${TMPDIR:-/tmp}/spec-pr-body.XXXXXX")');
    expect(text).toContain("__SPEC_PR_BODY_END__");
    expect(text).toContain('gh pr create --title "<TITLE>" --body-file "$BODY_FILE"');
    expect(text).toContain('gh pr edit --title "<TITLE>" --body-file "$BODY_FILE"');
    expect(text).not.toContain('--body "$(cat "$BODY_FILE")"');
    expect(text).toContain('feature-video');
    expect(reference).toContain('## Step Pre-A: Resolve the PR commit range and diff');
    expect(reference).toContain('Spec-First badge');
    expect(reference).toContain('Built_with-Spec_First');
    expect(text).not.toContain('ce-pr-description');
    expect(text).not.toContain('spec-pr-description');
    expect(text).not.toContain('__CE_PR_BODY_END__');
    expect(text).not.toContain('ce-pr-body');
    expect(text).not.toContain('ce-demo-reel');
    expect(reference).not.toContain('ce-commit-push-pr');
    expect(reference).not.toContain('Compound Engineering');
    expect(reference).not.toContain('ce-demo-reel');
    expect(text).not.toContain('ask_user` in Gemini');
    expect(text).not.toContain('ask_user` in Pi');
    expect(text).not.toContain('Compound Engineering badge');
  });

  test('standalone spec-pr-description workflow is removed', () => {
    expect(fs.existsSync(PR_DESCRIPTION_SKILL_PATH)).toBe(false);
    expect(fs.existsSync(PR_DESCRIPTION_COMMAND_PATH)).toBe(false);
  });
});
