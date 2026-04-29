'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SKILL_PATH = path.join(__dirname, '..', '..', 'skills', 'spec-optimize', 'SKILL.md');

describe('spec-optimize host entrypoint contract', () => {
  test('post-completion options use current host workflow entrypoints', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(text).toContain('current host\'s code-review entrypoint');
    expect(text).toContain('current host\'s compound entrypoint');
    expect(text).not.toContain('**Run `/spec:code-review`**');
    expect(text).not.toContain('**Run `/spec:compound`**');
    expect(text).not.toContain('/spec:code-review` on Claude Code');
    expect(text).not.toContain('$spec-code-review` on Codex');
    expect(text).not.toContain('/spec:compound` on Claude Code');
    expect(text).not.toContain('$spec-compound` on Codex');
  });

  test('uses valid workflow scratch path and skill-relative helper scripts', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(text).toContain('mkdir -p .spec-first/workflows/spec-optimize/<spec-name>/');
    expect(text).not.toContain('.spec-first/workflowsspec-optimize');
    expect(text).toContain('Resolve `scripts/measure.sh`, `scripts/parallel-probe.sh`, and `scripts/experiment-worktree.sh` relative to this skill');
  });
});
