'use strict';

describe('crg build/stats cli', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('build 会删除已被输入收敛排除的历史节点路径', async () => {
    const outputSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const deleteStaleNodes = jest.fn();
    const updateFingerprints = jest.fn();

    jest.isolateModules(() => {
      jest.doMock('better-sqlite3', () => jest.fn());
      jest.doMock('fs', () => {
        const actual = jest.requireActual('fs');
        return {
          ...actual,
          statSync: () => ({ isDirectory: () => true }),
          existsSync: () => true,
          mkdirSync: jest.fn(),
          writeFileSync: jest.fn(),
        };
      });
      jest.doMock('../../src/crg/migrations', () => ({
        initDatabase: () => ({
          close: jest.fn(),
          prepare: jest.fn((sql) => {
            if (sql.includes('SELECT file_path FROM nodes')) {
              return {
                all: () => [
                  { file_path: '.claude/skills/demo/runtime.js' },
                  { file_path: 'src/index.js' },
                ],
              };
            }
            if (sql.includes('SELECT COUNT(*) as c FROM nodes')) return { get: () => ({ c: 1 }) };
            if (sql.includes('SELECT COUNT(*) as c FROM edges')) return { get: () => ({ c: 0 }) };
            if (sql.includes('UPDATE graph_meta SET last_built')) return { run: jest.fn() };
            if (sql.includes('DELETE FROM fingerprints')) return { run: jest.fn() };
            return { get: () => ({}), all: () => [], run: jest.fn() };
          }),
        }),
      }));
      jest.doMock('../../src/crg/input-convergence', () => ({
        collectInputFiles: async () => ({
          finalInputs: ['src/index.js'],
          stats: { ignored_files_by_rule: {} },
        }),
      }));
      jest.doMock('../../src/crg/parser', () => ({
        inferLanguage: () => 'javascript',
        parseFile: () => ({ nodes: [], rawEdges: [], skipped: false }),
      }));
      jest.doMock('../../src/crg/incremental', () => ({
        detectChangedFiles: () => ({
          changed: [],
          deleted: [],
          changedShas: new Map(),
        }),
        updateFingerprints,
      }));
      jest.doMock('../../src/crg/graph', () => ({
        upsertNodes: jest.fn(),
        upsertEdges: jest.fn(),
        deleteStaleNodes,
        resolveEdges: () => ({ resolved: [], unresolvedCount: 0 }),
        setUnresolvedEdgeCount: jest.fn(),
      }));
      jest.doMock('../../src/crg/cli/postprocess', () => ({
        runPostprocess: jest.fn(),
      }));

      const { run } = require('../../src/crg/cli/build');
      run(['--repo=/repo']);
    });

    await new Promise((resolve) => setImmediate(resolve));

    expect(deleteStaleNodes).toHaveBeenCalledWith(
      expect.any(Object),
      ['.claude/skills/demo/runtime.js']
    );
    expect(updateFingerprints).toHaveBeenCalledWith(
      expect.any(Object),
      [],
      ['.claude/skills/demo/runtime.js'],
      '/repo'
    );
    outputSpy.mockRestore();
  });

  test('build 只对可解析图输入做增量指纹检测，避免 .gitignore 等无效路径进入 fingerprints', async () => {
    const outputSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const detectChangedFiles = jest.fn(() => ({
      changed: [],
      deleted: [],
      changedShas: new Map(),
    }));

    jest.isolateModules(() => {
      jest.doMock('better-sqlite3', () => jest.fn());
      jest.doMock('fs', () => {
        const actual = jest.requireActual('fs');
        return {
          ...actual,
          statSync: () => ({ isDirectory: () => true }),
          existsSync: () => true,
          mkdirSync: jest.fn(),
          writeFileSync: jest.fn(),
        };
      });
      jest.doMock('../../src/crg/migrations', () => ({
        initDatabase: () => ({
          close: jest.fn(),
          prepare: jest.fn((sql) => {
            if (sql.includes('SELECT file_path FROM nodes')) return { all: () => [] };
            if (sql.includes('SELECT COUNT(*) as c FROM nodes')) return { get: () => ({ c: 1 }) };
            if (sql.includes('SELECT COUNT(*) as c FROM edges')) return { get: () => ({ c: 0 }) };
            if (sql.includes('UPDATE graph_meta SET last_built')) return { run: jest.fn() };
            return { get: () => ({}), all: () => [], run: jest.fn() };
          }),
        }),
      }));
      jest.doMock('../../src/crg/input-convergence', () => ({
        collectInputFiles: async () => ({
          finalInputs: ['src/index.js', '.gitignore', '.playwright-mcp'],
          stats: { ignored_files_by_rule: {} },
        }),
      }));
      jest.doMock('../../src/crg/parser', () => ({
        inferLanguage: (filePath) => (filePath === 'src/index.js' ? 'javascript' : null),
        parseFile: () => ({ nodes: [], rawEdges: [], skipped: false }),
      }));
      jest.doMock('../../src/crg/incremental', () => ({
        detectChangedFiles,
        updateFingerprints: jest.fn(),
      }));
      jest.doMock('../../src/crg/graph', () => ({
        upsertNodes: jest.fn(),
        upsertEdges: jest.fn(),
        deleteStaleNodes: jest.fn(),
        resolveEdges: () => ({ resolved: [], unresolvedCount: 0 }),
        setUnresolvedEdgeCount: jest.fn(),
      }));
      jest.doMock('../../src/crg/cli/postprocess', () => ({
        runPostprocess: jest.fn(),
      }));

      const { run } = require('../../src/crg/cli/build');
      run(['--repo=/repo']);
    });

    await new Promise((resolve) => setImmediate(resolve));

    expect(detectChangedFiles).toHaveBeenCalledWith(
      expect.any(Object),
      ['src/index.js'],
      '/repo'
    );
    outputSpy.mockRestore();
  });

  test('build 对解析阶段 skipped 的文件会清理 fingerprints，避免留下脏账', async () => {
    const outputSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const updateFingerprints = jest.fn();

    jest.isolateModules(() => {
      jest.doMock('better-sqlite3', () => jest.fn());
      jest.doMock('fs', () => {
        const actual = jest.requireActual('fs');
        return {
          ...actual,
          statSync: () => ({ isDirectory: () => true }),
          existsSync: () => true,
          mkdirSync: jest.fn(),
          writeFileSync: jest.fn(),
        };
      });
      jest.doMock('../../src/crg/migrations', () => ({
        initDatabase: () => ({
          close: jest.fn(),
          prepare: jest.fn((sql) => {
            if (sql.includes('SELECT file_path FROM nodes')) return { all: () => [] };
            if (sql.includes('SELECT COUNT(*) as c FROM nodes')) return { get: () => ({ c: 0 }) };
            if (sql.includes('SELECT COUNT(*) as c FROM edges')) return { get: () => ({ c: 0 }) };
            if (sql.includes('UPDATE graph_meta SET last_built')) return { run: jest.fn() };
            return { get: () => ({}), all: () => [], run: jest.fn() };
          }),
        }),
      }));
      jest.doMock('../../src/crg/input-convergence', () => ({
        collectInputFiles: async () => ({
          finalInputs: ['src/header.h'],
          stats: { ignored_files_by_rule: {} },
        }),
      }));
      jest.doMock('../../src/crg/parser', () => ({
        inferLanguage: () => 'c',
        parseFile: () => ({ nodes: [], rawEdges: [], skipped: true, reason: 'unsupported_lang' }),
      }));
      jest.doMock('../../src/crg/incremental', () => ({
        detectChangedFiles: () => ({
          changed: ['src/header.h'],
          deleted: [],
          changedShas: new Map([['src/header.h', 'sha-header']]),
        }),
        updateFingerprints,
      }));
      jest.doMock('../../src/crg/graph', () => ({
        upsertNodes: jest.fn(),
        upsertEdges: jest.fn(),
        deleteStaleNodes: jest.fn(),
        resolveEdges: () => ({ resolved: [], unresolvedCount: 0 }),
        setUnresolvedEdgeCount: jest.fn(),
      }));
      jest.doMock('../../src/crg/cli/postprocess', () => ({
        runPostprocess: jest.fn(),
      }));

      const { run } = require('../../src/crg/cli/build');
      run(['--repo=/repo']);
    });

    await new Promise((resolve) => setImmediate(resolve));

    expect(updateFingerprints).toHaveBeenNthCalledWith(
      1,
      expect.any(Object),
      [],
      [],
      '/repo'
    );
    expect(updateFingerprints).toHaveBeenNthCalledWith(
      2,
      expect.any(Object),
      [],
      ['src/header.h'],
      '/repo',
      expect.any(Map)
    );
    outputSpy.mockRestore();
  });

  test('runStats 在 fingerprints 与磁盘不一致时输出 stale warning', () => {
    const outputSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

    jest.isolateModules(() => {
      jest.doMock('better-sqlite3', () => jest.fn());
      jest.doMock('../../src/crg/migrations', () => ({
        initDatabase: () => ({
          close: jest.fn(),
          prepare: jest.fn((sql) => {
            if (sql.includes('SELECT COUNT(*) as c FROM nodes')) return { get: () => ({ c: 3 }) };
            if (sql.includes('SELECT COUNT(*) as c FROM edges')) return { get: () => ({ c: 2 }) };
            if (sql.includes('SUM(line_end - line_start)')) return { get: () => ({ total: 42 }) };
            if (sql.includes('SELECT last_built, unresolved_edge_count')) {
              return { get: () => ({ last_built: '2026-04-11T00:00:00.000Z', unresolved_edge_count: 1 }) };
            }
            if (sql.includes('SELECT file_path, sha256 FROM fingerprints')) {
              return { all: () => [{ file_path: 'src/a.js', sha256: 'old-sha' }] };
            }
            return { get: () => ({}), all: () => [] };
          }),
        }),
      }));
      jest.doMock('../../src/crg/incremental', () => ({
        computeFileSHA: () => ({ sha: 'new-sha' }),
      }));
      jest.doMock('fs', () => {
        const actual = jest.requireActual('fs');
        return {
          ...actual,
          existsSync: () => true,
        };
      });

      const { runStats } = require('../../src/crg/cli/build');
      runStats(['--repo=/repo']);
    });

    const payload = JSON.parse(outputSpy.mock.calls[0][0]);
    expect(payload.warnings).toEqual([
      expect.objectContaining({
        type: 'stale',
        stale_files: ['src/a.js'],
      }),
    ]);
    outputSpy.mockRestore();
  });
});
