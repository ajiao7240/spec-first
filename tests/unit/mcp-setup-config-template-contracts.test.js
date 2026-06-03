'use strict';

const fs = require('node:fs');
const path = require('node:path');

const TEMPLATE_PATH = path.join(
  __dirname,
  '..',
  '..',
  'skills',
  'spec-mcp-setup',
  'references',
  'config-template.yaml',
);

describe('spec-mcp-setup config template contract', () => {
  test('document rendering hints stay inactive and spec-first scoped', () => {
    const text = fs.readFileSync(TEMPLATE_PATH, 'utf8');

    expect(text).toContain('Copy to .spec-first/config.local.yaml in your project root.');
    expect(text).toContain('# --- Document rendering ---');
    expect(text).toContain('Current spec-first workflows write markdown canonical artifacts.');
    expect(text).toContain('reserved future hints only');
    expect(text).toContain('optional sidecar');
    expect(text).toContain('focused HTML consumer tests');
    expect(text).toContain('# plan_output: html');
    expect(text).toContain('# brainstorm_output: html');
    expect(text).not.toMatch(/^plan_output:/m);
    expect(text).not.toMatch(/^brainstorm_output:/m);
    expect(text).not.toContain('.compound-engineering');
    expect(text).not.toMatch(/\bce-[a-z]/);
    expect(text).not.toContain('exclusive format');
  });
});
