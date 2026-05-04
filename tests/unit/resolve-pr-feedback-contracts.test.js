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
    expect(text).toContain('Uses resolver agents when dispatch is safe and authorized');
    expect(text).toContain('Mutating resolver dispatch boundary');
    expect(text).toContain('Resolver dispatch is mutating-sensitive.');
    expect(text).toContain('dispatch units pass the batching and file-overlap checks');
    expect(text).toContain('The orchestrator owns final integration: combined validation, staging, commits, pushes, PR replies, and thread resolution.');
    expect(text).toContain('Resolver agents must not stage files, create commits, push, or resolve review threads directly');
    expect(text).toContain('process dispatch units sequentially in the current agent');
    expect(text).toContain('serialize the affected units or stop for orchestration');
    expect(text).toContain('No two dispatch units that touch the same file should run in parallel.');
    expect(text).not.toContain('Spawns parallel agents for each thread.');
  });
});
