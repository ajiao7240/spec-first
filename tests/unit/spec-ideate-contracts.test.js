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
const SKILL_PATH = path.join(__dirname, '..', '..', 'skills', 'spec-ideate', 'SKILL.md');
const WEB_RESEARCH_CACHE_PATH = path.join(
  __dirname,
  '..',
  '..',
  'skills',
  'spec-ideate',
  'references',
  'web-research-cache.md',
);

describe('spec-ideate host entrypoint contract', () => {
  test('Proof handoff recommends the current host brainstorm entrypoint', () => {
    const text = fs.readFileSync(POST_IDEATION_PATH, 'utf8');

    expect(text).toContain('current host\'s brainstorm entrypoint');
    expect(text).not.toContain('**recommended next step:** `/spec:brainstorm`');
    expect(text).not.toContain('/spec:brainstorm` on Claude Code');
    expect(text).not.toContain('$spec-brainstorm` on Codex');
  });

  test('scratch paths avoid colon-bearing workflow names', () => {
    const combined = [
      fs.readFileSync(SKILL_PATH, 'utf8'),
      fs.readFileSync(WEB_RESEARCH_CACHE_PATH, 'utf8'),
    ].join('\n');

    expect(combined).toContain('/tmp/spec-first/spec-ideate/<run-id>');
    expect(combined).toContain('SCRATCH_ROOT="/tmp/spec-first/spec-ideate"');
    expect(combined).not.toContain('/tmp/spec-first/spec:ideate');
  });
});
