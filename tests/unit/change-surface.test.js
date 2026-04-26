'use strict';

const { summarizeChangeSurface } = require('../../src/crg/changes');

describe('change surface verification recommendation', () => {
  test('web runtime 改动会收敛出 web 平台与对应验证建议', () => {
    const summary = summarizeChangeSurface({
      repoRoot: '/repo',
      changedFiles: ['src/app/home/page.tsx'],
      verificationProfile: {
        platforms: ['web', 'backend'],
        required_gates: [
          { id: 'unit-tests', scope: 'repository' },
          { id: 'integration-tests', scope: 'cross-module' },
          { id: 'browser-smoke', scope: 'web-surface' },
        ],
        optional_gates: [
          { id: 'browser-evidence', scope: 'web-surface' },
          { id: 'contract-tests', scope: 'shared-contract' },
        ],
      },
    });

    expect(summary.impacted_modules).toContain('src/app/');
    expect(summary.impacted_languages).toEqual(['typescript']);
    expect(summary.impacted_platforms).toEqual(['web']);
    expect(summary.recommended_required_verifications).toEqual([
      'unit-tests',
      'integration-tests',
      'browser-smoke',
    ]);
    expect(summary.recommended_optional_verifications).toEqual(['browser-evidence']);
    expect(summary.confidence).toBe('high');
  });

  test('docs-only 改动不会伪造验证建议，并显式降级为 low confidence', () => {
    const summary = summarizeChangeSurface({
      repoRoot: '/repo',
      changedFiles: ['docs/guide.md', 'CHANGELOG.md'],
      verificationProfile: {
        platforms: ['web'],
        required_gates: [
          { id: 'browser-smoke', scope: 'web-surface' },
        ],
        optional_gates: [
          { id: 'browser-evidence', scope: 'web-surface' },
        ],
      },
    });

    expect(summary.impacted_modules).toEqual(['CHANGELOG.md', 'docs/']);
    expect(summary.impacted_languages).toEqual(['markdown']);
    expect(summary.impacted_platforms).toEqual([]);
    expect(summary.recommended_required_verifications).toEqual([]);
    expect(summary.recommended_optional_verifications).toEqual([]);
    expect(summary.confidence).toBe('low');
  });

  test('混合 web 与 cli 改动会合并两个平台，并补全对应验证建议', () => {
    const summary = summarizeChangeSurface({
      repoRoot: '/repo',
      changedFiles: ['src/app/home/page.tsx', 'src/crg/changes.js'],
      verificationProfile: {
        platforms: ['web', 'cli'],
        required_gates: [
          { id: 'unit-tests', scope: 'repository' },
          { id: 'browser-smoke', scope: 'web-surface' },
          { id: 'cli-smoke', scope: 'cli-surface' },
        ],
        optional_gates: [],
      },
    });

    expect(summary.impacted_modules).toEqual(['src/app/', 'src/crg/']);
    expect(summary.impacted_languages).toEqual(['javascript', 'typescript']);
    expect(summary.impacted_platforms).toEqual(['web', 'cli']);
    expect(summary.recommended_required_verifications).toEqual([
      'unit-tests',
      'browser-smoke',
      'cli-smoke',
    ]);
    expect(summary.confidence).toBe('high');
  });

  test('changedFiles 顺序变化不会改变平台推断结果', () => {
    const verificationProfile = {
      platforms: ['web', 'cli'],
      required_gates: [
        { id: 'unit-tests', scope: 'repository' },
        { id: 'browser-smoke', scope: 'web-surface' },
        { id: 'cli-smoke', scope: 'cli-surface' },
      ],
      optional_gates: [],
    };
    const left = summarizeChangeSurface({
      repoRoot: '/repo',
      changedFiles: ['src/app/home/page.tsx', 'src/crg/changes.js'],
      verificationProfile,
    });
    const right = summarizeChangeSurface({
      repoRoot: '/repo',
      changedFiles: ['src/crg/changes.js', 'src/app/home/page.tsx'],
      verificationProfile,
    });

    expect(right).toEqual(left);
  });
});
