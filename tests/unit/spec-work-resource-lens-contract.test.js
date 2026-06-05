'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SHIPPING_PATH = path.join(__dirname, '..', '..', 'skills', 'spec-work', 'references', 'shipping-workflow.md');

describe('spec-work resource lens contract', () => {
  test('shipping closeout consumes resource advisories as non-blocking facts', () => {
    const text = fs.readFileSync(SHIPPING_PATH, 'utf8');

    expect(text).toContain('spec-first internal resource-governance-lens');
    expect(text).toContain('large files, generated output, raw logs, owner hints, and staging-scope risks');
    expect(text).toContain('subject_path');
    expect(text).toContain('evidence_ref');
    expect(text).toContain('Resource advisories are reported beside honest-closeout results');
    expect(text).toContain('they do not block closeout, `git add`, commit, or review');
    expect(text).toContain('a non-blocking degraded posture, not a fast-fail signal');
  });
});
