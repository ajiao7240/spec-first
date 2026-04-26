'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SKILL_PATH = path.join(__dirname, '..', '..', 'skills', 'spec-code-review', 'SKILL.md');

describe('spec-code-review CRG hook contract', () => {
  test('uses before-review CRG anchor and keeps findings reviewer-owned', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');
    expect(text).toContain('spec-first crg hook before-review --since=<base>');
    expect(text).toContain('spec-first crg hook before-review --work-run=<id>');
    expect(text).toContain('prioritize review, not to replace reviewer judgment');
    expect(text).not.toContain('stage0-context');
    expect(text).not.toContain('selected_assets');
  });
});
