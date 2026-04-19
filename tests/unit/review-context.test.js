'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { runBootstrap } = require('../../src/bootstrap-compiler/run-bootstrap');

describe('crg review-context verification recommendation', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
  });

  test('输出 impacted_* 与 recommended_* verification 字段', () => {
    const outputSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

    jest.isolateModules(() => {
      jest.doMock('../../src/crg/cli/open-db', () => ({
        openDb: () => ({
          repoRoot: '/repo',
          db: {
            prepare: jest.fn((sql) => {
              if (sql.includes("WHERE file_path = ? AND kind != 'module'")) {
                return { all: jest.fn(() => []) };
              }
              if (sql.includes("SELECT DISTINCT file_path FROM nodes WHERE is_test = 1")) {
                return { all: jest.fn(() => []) };
              }
              if (sql.includes("SELECT source_id, target_id FROM edges WHERE kind = 'calls'")) {
                return { all: jest.fn(() => []) };
              }
              if (sql.includes("SELECT id, name, line_end FROM nodes WHERE file_path = ? AND kind = 'module'")) {
                return { get: jest.fn(() => null) };
              }
              if (sql.includes('WHERE id IN')) {
                return { all: jest.fn(() => []) };
              }
              return { all: jest.fn(() => []), get: jest.fn(() => ({ cnt: 0 })) };
            }),
          },
        }),
      }));
      jest.doMock('../../src/crg/changes', () => ({
        detectChanges: () => [{
          file: 'src/app/home/page.tsx',
          risk_level: 'Medium',
          hunks: [],
          review_priorities: [],
          test_gaps: [],
        }],
        assessNodeRiskBatch: () => new Map(),
      }));
      jest.doMock('../../src/crg/input-convergence', () => ({
        isSensitiveFile: () => false,
      }));
      jest.doMock('../../src/crg/retrieval/api', () => ({
        retrieveContext: () => ({ ranked_context: [] }),
      }));
      jest.doMock('../../src/context-routing/loader', () => ({
        loadBootstrapRuntimeState: () => ({
          verificationProfile: {
            platforms: ['web'],
            required_gates: [
              { id: 'unit-tests', scope: 'repository' },
              { id: 'browser-smoke', scope: 'web-surface' },
            ],
            optional_gates: [
              { id: 'browser-evidence', scope: 'web-surface' },
            ],
          },
        }),
      }));

      const { run } = require('../../src/crg/commands/review-context');
      run(['--repo=/repo', '--since=HEAD~1']);
    });

    const payload = JSON.parse(outputSpy.mock.calls[0][0]);
    expect(payload.data.impacted_modules).toEqual(['src/app/']);
    expect(payload.data.impacted_languages).toEqual(['typescript']);
    expect(payload.data.impacted_platforms).toEqual(['web']);
    expect(payload.data.recommended_required_verifications).toEqual([
      'unit-tests',
      'browser-smoke',
    ]);
    expect(payload.data.recommended_optional_verifications).toEqual(['browser-evidence']);
    expect(payload.data.confidence).toBe('high');
    expect(payload.data.review_guidance).toEqual(
      expect.arrayContaining([
        expect.stringContaining('RECOMMENDED_REQUIRED: unit-tests, browser-smoke'),
      ])
    );
    outputSpy.mockRestore();
  });

  test('workspace child repo 会读取 workspace 锚定的 verification-profile', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'review-context-workspace-child-'));
    const workspaceRoot = path.join(tmpDir, 'workspace');
    const repoA = path.join(workspaceRoot, 'packages', 'repo-a');
    const repoB = path.join(workspaceRoot, 'packages', 'repo-b');
    const outputSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

    try {
      fs.mkdirSync(path.join(repoA, '.git'), { recursive: true });
      fs.mkdirSync(path.join(repoB, '.git'), { recursive: true });
      fs.writeFileSync(path.join(repoA, 'package.json'), JSON.stringify({
        name: 'repo-a',
        scripts: {
          'test:unit': 'jest',
          'test:integration': 'jest',
        },
        dependencies: {
          jest: '^29.0.0',
        },
      }, null, 2));
      fs.mkdirSync(path.join(repoA, 'src', 'app', 'home'), { recursive: true });
      fs.writeFileSync(path.join(repoA, 'src', 'app', 'home', 'page.tsx'), 'export default function Page() { return null; }\n');
      fs.writeFileSync(path.join(repoB, 'package.json'), JSON.stringify({ name: 'repo-b' }, null, 2));

      runBootstrap({
        repoRoot: workspaceRoot,
        generatedAt: '2026-04-17T00:00:00.000Z',
        repoRoots: [repoA, repoB],
      });

      jest.unmock('../../src/context-routing/loader');
      jest.isolateModules(() => {
        jest.doMock('../../src/crg/cli/open-db', () => ({
          openDb: () => ({
            repoRoot: repoA,
            db: {
              prepare: jest.fn((sql) => {
                if (sql.includes("WHERE file_path = ? AND kind != 'module'")) {
                  return { all: jest.fn(() => []) };
                }
                if (sql.includes("SELECT DISTINCT file_path FROM nodes WHERE is_test = 1")) {
                  return { all: jest.fn(() => []) };
                }
                if (sql.includes("SELECT source_id, target_id FROM edges WHERE kind = 'calls'")) {
                  return { all: jest.fn(() => []) };
                }
                if (sql.includes("SELECT id, name, line_end FROM nodes WHERE file_path = ? AND kind = 'module'")) {
                  return { get: jest.fn(() => null) };
                }
                if (sql.includes('WHERE id IN')) {
                  return { all: jest.fn(() => []) };
                }
                return { all: jest.fn(() => []), get: jest.fn(() => ({ cnt: 0 })) };
              }),
            },
          }),
        }));
        jest.doMock('../../src/crg/changes', () => ({
          detectChanges: () => [{
            file: 'src/app/home/page.tsx',
            risk_level: 'Medium',
            hunks: [],
            review_priorities: [],
            test_gaps: [],
          }],
          assessNodeRiskBatch: () => new Map(),
        }));
        jest.doMock('../../src/crg/input-convergence', () => ({
          isSensitiveFile: () => false,
        }));
        jest.doMock('../../src/crg/retrieval/api', () => ({
          retrieveContext: () => ({ ranked_context: [] }),
        }));

        const { run } = require('../../src/crg/commands/review-context');
        run([`--repo=${repoA}`, '--since=HEAD~1']);
      });

      const payload = JSON.parse(outputSpy.mock.calls[0][0]);
      expect(payload.data.impacted_modules).toEqual(['src/app/']);
      expect(payload.data.impacted_languages).toEqual(['typescript']);
      expect(payload.data.impacted_platforms).toEqual(['web']);
      expect(payload.data.recommended_required_verifications).toEqual([
        'unit-tests',
        'integration-tests',
      ]);
      expect(payload.data.recommended_optional_verifications).toEqual([]);
      expect(payload.data.confidence).toBe('high');
    } finally {
      outputSpy.mockRestore();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
