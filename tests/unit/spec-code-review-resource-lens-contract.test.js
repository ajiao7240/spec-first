'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SKILL_PATH = path.join(__dirname, '..', '..', 'skills', 'spec-code-review', 'SKILL.md');

describe('spec-code-review resource lens contract', () => {
  test('Stage 3 and Stage 6 carry resource advisory facts', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(text).toContain('spec-first internal resource-governance-lens');
    expect(text).toContain('Record `resource_lens_status`, advisory dimensions, and `reason_codes`');
    expect(text).toContain('Resource lens facts are advisory');
    expect(text).toContain('do not treat generated runtime paths as `evidence_ref` values');
    expect(text).toContain('**Resource Advisory.**');
    expect(text).toContain('Do not convert resource advisories into blocking findings');
    expect(text).toContain('resource lens status/reason codes');
    expect(text).toContain('a non-blocking degraded posture, not a fast-fail signal');
  });
});
