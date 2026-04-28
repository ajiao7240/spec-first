'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SKILL_PATH = path.join(__dirname, '..', '..', 'skills', 'spec-brainstorm', 'SKILL.md');
const UNIVERSAL_PATH = path.join(
  __dirname,
  '..',
  '..',
  'skills',
  'spec-brainstorm',
  'references',
  'universal-brainstorming.md',
);
const REQUIREMENTS_PATH = path.join(
  __dirname,
  '..',
  '..',
  'skills',
  'spec-brainstorm',
  'references',
  'requirements-capture.md',
);

describe('spec-brainstorm host entrypoint contract', () => {
  test('planning handoffs cover Claude and Codex entrypoints', () => {
    const combined = [
      fs.readFileSync(SKILL_PATH, 'utf8'),
      fs.readFileSync(UNIVERSAL_PATH, 'utf8'),
      fs.readFileSync(REQUIREMENTS_PATH, 'utf8'),
    ].join('\n');

    expect(combined).toContain('current host\'s plan entrypoint');
    expect(combined).toContain('/spec:plan` on Claude Code');
    expect(combined).toContain('$spec-plan` on Codex');
    expect(combined).toContain('current host\'s brainstorm entrypoint');
    expect(combined).toContain('/spec:brainstorm on Claude Code');
    expect(combined).toContain('$spec-brainstorm on Codex');
    expect(combined).not.toContain('precedes `/spec:plan`');
    expect(combined).not.toContain('hand off to `/spec:plan`');
    expect(combined).not.toContain('`-> /spec:plan`');
    expect(combined).not.toContain('`-> Resume /spec:brainstorm`');
  });
});
