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
