'use strict';

describe('crg review-context hunks', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('hunk_hit 只包含真正落在变更行范围内的节点', () => {
    const outputSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

    jest.isolateModules(() => {
      jest.doMock('../../src/crg/cli/open-db', () => ({
        openDb: () => ({
          repoRoot: '/repo',
          db: {
            prepare: jest.fn((sql) => {
              if (sql.includes("WHERE file_path = ? AND kind != 'module'")) {
                return {
                  all: jest.fn(() => [
                    {
                      id: 'src/a.js#function#touched#L1',
                      name: 'touched',
                      file_path: 'src/a.js',
                      kind: 'function',
                      line_start: 1,
                      line_end: 3,
                      is_test: 0,
                    },
                    {
                      id: 'src/a.js#function#untouched#L10',
                      name: 'untouched',
                      file_path: 'src/a.js',
                      kind: 'function',
                      line_start: 10,
                      line_end: 12,
                      is_test: 0,
                    },
                  ]),
                };
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
          file: 'src/a.js',
          risk_level: 'Medium',
          hunks: [{ start: 2, end: 2 }],
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
      run(['--repo=/repo', '--since=HEAD~1']);
    });

    const payload = JSON.parse(outputSpy.mock.calls[0][0]);
    expect(payload.data.hunk_hit).toEqual([
      expect.objectContaining({ id: 'src/a.js#function#touched#L1' }),
    ]);
    outputSpy.mockRestore();
  });
});
