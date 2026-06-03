'use strict';

const fs = require('node:fs');
const path = require('node:path');

const CONCEPTS_PATH = path.join(__dirname, '..', '..', 'CONCEPTS.md');

describe('CONCEPTS advisory vocabulary contract', () => {
  test('defines spec-first vocabulary without becoming a source-of-truth override', () => {
    const text = fs.readFileSync(CONCEPTS_PATH, 'utf8');

    expect(text).toContain('Shared advisory vocabulary for this repository');
    expect(text).toContain('not a PRD, ADR, workflow contract, product roadmap, or source-of-truth override');
    expect(text).toContain('A downstream project does not need this file for `spec-first` to work');
    expect(text).toContain('An AI coding harness');
    expect(text).toContain('context, spec, plan, tasks, code, review, and knowledge');
    expect(text).toContain('Skill');
    expect(text).toContain('Agent');
    expect(text).toContain('Tool');
    expect(text).toContain('Script');
    expect(text).toContain('Source Of Truth');
    expect(text).toContain('Generated Runtime');
    expect(text).toContain('Direct Evidence');
    expect(text).toContain('Advisory Evidence');
    expect(text).toContain('Learning');
    expect(text).toContain('Pattern Doc');
    expect(text).toContain('Compound');
    expect(text).not.toContain('ce-compound');
    expect(text).not.toContain('Marketplace');
    expect(text).not.toContain('Converter');
  });
});
