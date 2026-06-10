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
const PROJECT_EXAMPLE_PATH = path.join(
  __dirname,
  '..',
  '..',
  '.spec-first',
  'config.local.example.yaml',
);
const CHECK_HEALTH_PATH = path.join(
  __dirname,
  '..',
  '..',
  'skills',
  'spec-mcp-setup',
  'scripts',
  'check-health',
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

  test('local config example mirrors the source template when present', () => {
    const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
    const projectExample = fs.existsSync(PROJECT_EXAMPLE_PATH)
      ? fs.readFileSync(PROJECT_EXAMPLE_PATH, 'utf8')
      : template;

    expect(projectExample).toBe(template);
  });

  test('check-health treats local config as optional and reports example repair action', () => {
    const text = fs.readFileSync(CHECK_HEALTH_PATH, 'utf8');

    expect(text).toContain('Optional local config not created (.spec-first/config.local.yaml)');
    expect(text).not.toContain('warn "Local config missing (.spec-first/config.local.yaml)"');
    expect(text).toContain('Example config outdated (.spec-first/config.local.example.yaml)');
    expect(text).toContain('bootstrap-project-config.sh\\" --repo \\"$repo_root\\" --refresh-example');
  });
});
