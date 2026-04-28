'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SKILL_PATH = path.join(__dirname, '..', '..', 'skills', 'spec-compound', 'SKILL.md');

describe('spec-compound host entrypoint contract', () => {
  test('usage and follow-up guidance cover Claude and Codex entrypoints', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(text).toContain('# Claude Code');
    expect(text).toContain('/spec:compound                    # Document the most recent fix');
    expect(text).toContain('# Codex');
    expect(text).toContain('$spec-compound                    # Document the most recent fix');
    expect(text).toContain('current host\'s compound entrypoint');
    expect(text).toContain('/spec:compound` on Claude Code');
    expect(text).toContain('$spec-compound` on Codex');
    expect(text).toContain('/spec:plan` on Claude Code');
    expect(text).toContain('$spec-plan` on Codex');
    expect(text).not.toContain('Use /spec:compound [context]');
    expect(text).not.toContain('re-run /spec:compound in a fresh session');
    expect(text).not.toContain('- `/spec:plan` - Planning workflow');
  });
});
