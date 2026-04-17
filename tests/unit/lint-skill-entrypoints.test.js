'use strict';

const path = require('node:path');

const {
  analyzeContent,
  buildRules,
  loadConfig,
} = require('../../scripts/lint-skill-entrypoints');

const config = loadConfig();
const rules = buildRules(config);
const FIXTURE_PATH = path.join(process.cwd(), 'skills', 'fixture-skill', 'SKILL.md');

describe('lint-skill-entrypoints', () => {
  test('detects invalid Codex /spec:* entrypoint text', () => {
    const findings = analyzeContent(
      '**Codex entry point:** `/spec:plan [doc]`',
      FIXTURE_PATH,
      { config, rules },
    );

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'codex-entrypoint-spec',
          severity: 'error',
        }),
      ]),
    );
  });

  test('detects standalone skill slash commands but not valid workflow or file paths', () => {
    const findings = analyzeContent(
      [
        'Use `/todo-resolve` after triage.',
        'Claude workflow entry: `/spec:plan [doc]`.',
        'Existing MP4: `.spec-first/workflows/feature-video/171/videos/demo.mp4`.',
      ].join('\n'),
      FIXTURE_PATH,
      { config, rules },
    );

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'standalone-slash-command',
          severity: 'error',
          line: 1,
        }),
      ]),
    );
    expect(findings).toHaveLength(1);
  });

  test('ignores internal DSL lines and still catches slash-heading drift', () => {
    const findings = analyzeContent(
      [
        'Skill(todo-resolve)',
        'skill: todo-resolve',
        '# /compound',
      ].join('\n'),
      FIXTURE_PATH,
      { config, rules },
    );

    expect(findings).toEqual([
      expect.objectContaining({
        ruleId: 'heading-leading-slash',
        severity: 'error',
        line: 3,
      }),
    ]);
  });
});
