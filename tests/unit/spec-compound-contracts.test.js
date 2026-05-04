'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SKILL_PATH = path.join(__dirname, '..', '..', 'skills', 'spec-compound', 'SKILL.md');
const COMPOUND_REFRESH_SKILL_PATH = path.join(
  __dirname,
  '..',
  '..',
  'skills',
  'spec-compound-refresh',
  'SKILL.md',
);

describe('spec-compound host entrypoint contract', () => {
  test('usage and follow-up guidance use current-host entrypoint wording', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(text).toContain('current host\'s compound entrypoint');
    expect(text).toContain('current host\'s compound entrypoint with brief context');
    expect(text).toContain('current host\'s compound entrypoint');
    expect(text).not.toContain('Use /spec:compound [context]');
    expect(text).not.toContain('re-run /spec:compound in a fresh session');
    expect(text).not.toContain('- `/spec:plan` - Planning workflow');
    expect(text).not.toContain('/spec:compound` on Claude Code');
    expect(text).not.toContain('$spec-compound` on Codex');
    expect(text).not.toContain('/spec:plan` on Claude Code');
    expect(text).not.toContain('$spec-plan` on Codex');
  });

  test('compound-refresh checks inbound links before deleting solution docs', () => {
    const text = fs.readFileSync(COMPOUND_REFRESH_SKILL_PATH, 'utf8');

    expect(text).toContain('Delete when the code is gone, and only after checking for inbound links');
    expect(text).toContain('Inbound links inform classification, not cleanup');
    expect(text).toContain('decorative');
    expect(text).toContain('substantive');
    expect(text).toContain('Search the filename slug (without `.md`)');
    expect(text).toContain('Auto-delete only when all three hold');
    expect(text).toContain('Inbound links are absent or unambiguously decorative');
    expect(text).toContain('Before unlinking the file, run a final inbound-link check');
    expect(text).not.toContain('Auto-delete only when both the implementation AND the problem domain are gone');
  });
});
