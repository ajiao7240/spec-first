'use strict';

const fs = require('node:fs');
const path = require('node:path');

const POST_IDEATION_PATH = path.join(
  __dirname,
  '..',
  '..',
  'skills',
  'spec-ideate',
  'references',
  'post-ideation-workflow.md',
);

describe('spec-ideate host entrypoint contract', () => {
  test('Proof handoff recommends the current host brainstorm entrypoint', () => {
    const text = fs.readFileSync(POST_IDEATION_PATH, 'utf8');

    expect(text).toContain('current host\'s brainstorm entrypoint');
    expect(text).toContain('/spec:brainstorm` on Claude Code');
    expect(text).toContain('$spec-brainstorm` on Codex');
    expect(text).not.toContain('**recommended next step:** `/spec:brainstorm`');
  });
});
