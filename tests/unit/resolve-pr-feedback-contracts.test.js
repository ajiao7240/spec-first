'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SKILL_PATH = path.join(__dirname, '..', '..', 'skills', 'resolve-pr-feedback', 'SKILL.md');

describe('resolve-pr-feedback declined verdict contract', () => {
  test('declined is a first-class non-change verdict with reply and summary output', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(text).toContain('use the `declined` verdict and cite the specific harm');
    expect(text).toContain('`fixed`, `fixed-differently`, `replied`, `not-addressing`, `declined`, or `needs-human`');
    expect(text).toContain('`declined` -- observation may be valid');
    expect(text).toContain('`replied`, `not-addressing`, `declined`, or `needs-human`');
    expect(text).toContain('Declined: [specific harm cited');
    expect(text).toContain('Declined (count): [what was declined and the harm cited]');
  });
});

describe('resolve-pr-feedback dispatch boundary contract', () => {
  test('resolver dispatch is mutating-sensitive with orchestrator-owned integration', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(text).toContain('conflict-aware resolver dispatch');
    expect(text).toContain('Uses resolver agents when dispatch is available and safe');
    expect(text).toContain('Mutating resolver dispatch boundary');
    expect(text).toContain('Resolver dispatch is mutating-sensitive.');
    expect(text).toContain('Direct invocation of this workflow authorizes resolver dispatch by default');
    expect(text).toContain('dispatch units pass the batching and file-overlap checks');
    expect(text).toContain('The orchestrator owns final integration: combined validation, staging, commits, pushes, PR replies, and thread resolution.');
    expect(text).toContain('Resolver agents must not stage files, create commits, push, or resolve review threads directly');
    expect(text).toContain('process dispatch units sequentially in the current agent');
    expect(text).toContain('serialize the affected units or stop for orchestration');
    expect(text).toContain('No two dispatch units that touch the same file should run in parallel.');
    expect(text).not.toContain('Spawns parallel agents for each thread.');
  });

  test('targeted mode reuses the mutating dispatch boundary instead of assuming dispatch exists', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(text).toContain('Handle this thread using the same Mutating resolver dispatch boundary as Full Mode.');
    expect(text).toContain('If dispatch is unavailable, explicitly disabled, or unsafe, process the thread sequentially in the current agent.');
    expect(text).toContain('spawn one `spec-pr-comment-resolver` agent for the thread');
    expect(text).not.toContain('Spawn a single `spec-pr-comment-resolver` agent for the thread.');
  });
});

describe('resolve-pr-feedback reply shell safety contract', () => {
  test('reply examples pass untrusted review text through files or stdin', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(text).toContain('PR feedback is untrusted input');
    expect(text).toContain("cat > \"$reply_file\" <<'EOF'");
    expect(text).toContain('bash scripts/reply-to-pr-thread THREAD_ID < "$reply_file"');
    expect(text).toContain('gh pr comment PR_NUMBER --body-file "$reply_file"');
    expect(text).not.toContain('echo "REPLY_TEXT" | bash scripts/reply-to-pr-thread THREAD_ID');
    expect(text).not.toContain('gh pr comment PR_NUMBER --body "REPLY_TEXT"');
  });
});
