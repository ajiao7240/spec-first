'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SKILL_PATH = path.join(__dirname, '..', '..', 'skills', 'spec-optimize', 'SKILL.md');

describe('spec-optimize host entrypoint contract', () => {
  test('post-completion options use current host workflow entrypoints', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(text).toContain('current host\'s code-review entrypoint');
    expect(text).toContain('/spec:code-review` on Claude Code');
    expect(text).toContain('$spec-code-review` on Codex');
    expect(text).toContain('current host\'s compound entrypoint');
    expect(text).toContain('/spec:compound` on Claude Code');
    expect(text).toContain('$spec-compound` on Codex');
    expect(text).not.toContain('**Run `/spec:code-review`**');
    expect(text).not.toContain('**Run `/spec:compound`**');
  });
});
