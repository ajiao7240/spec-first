'use strict';

describe('crg cli handlers', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('handlers 打开的 DB 路径不含旧目录 .spec-first-graph（negative guard）', () => {
    const openedPaths = [];
    const outputSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const handlersToTest = [
      { modulePath: '../../src/crg/cli/query', fn: 'run', argv: ['--pattern=similar_to', '--symbol=node-1', '--repo=/repo'] },
      { modulePath: '../../src/crg/cli/context', fn: 'run', argv: ['--repo=/repo'] },
      { modulePath: '../../src/crg/cli/build', fn: 'runStats', argv: ['--repo=/repo'] },
    ];

    for (const handlerDef of handlersToTest) {
      jest.isolateModules(() => {
        jest.doMock('better-sqlite3', () => jest.fn());
        jest.doMock('../../src/crg/migrations', () => ({
          initDatabase: (dbPath) => {
            openedPaths.push(dbPath);
            return {
              close: jest.fn(),
              prepare: jest.fn((sql) => {
                if (sql.includes('SELECT COUNT(*) as c FROM nodes')) return { get: () => ({ c: 1 }) };
                if (sql.includes('SELECT COUNT(*) as c FROM edges')) return { get: () => ({ c: 1 }) };
                if (sql.includes('SUM(line_end - line_start)')) return { get: () => ({ total: 10 }) };
                if (sql.includes('SELECT last_built, unresolved_edge_count')) {
                  return { get: () => ({ last_built: '2026-04-11T00:00:00.000Z', unresolved_edge_count: 0 }) };
                }
                if (sql.includes('SELECT file_path, sha256 FROM fingerprints')) return { all: () => [] };
                if (sql.includes('FROM communities') && sql.includes('FROM nodes') && sql.includes('AS node_count')) {
                  return { get: () => ({ node_count: 0, edge_count: 0, community_count: 0, flow_count: 0 }) };
                }
                if (sql.includes('FROM communities')) return { all: () => [] };
                if (sql.includes('FROM flows')) return { all: () => [] };
                if (sql.includes('FROM nodes')) return { all: () => [], get: () => ({}) };
                return { all: () => [], get: () => ({}) };
              }),
            };
          },
        }));
        jest.doMock('../../src/crg/analyze', () => ({
          godNodes: () => [],
          surprisingConnections: () => [],
          analyzeGraph: () => ({ hubs: [], surprising: [] }),
        }));
        jest.doMock('../../src/crg/search', () => ({
          rebuildFTS: () => ({ indexed_count: 0, skipped_count: 0 }),
        }));
        jest.doMock('../../src/crg/flows', () => ({
          detectFlows: () => ({ flow_count: 0 }),
        }));
        jest.doMock('../../src/crg/communities', () => ({
          writeCommunities: () => ({ community_count: 0 }),
        }));
        jest.doMock('../../src/crg/incremental', () => ({
          computeFileSHA: () => ({ sha: 'same' }),
        }));
        jest.doMock('fs', () => {
          const actual = jest.requireActual('fs');
          return { ...actual, existsSync: () => true };
        });

        const handler = require(handlerDef.modulePath);
        handler[handlerDef.fn](handlerDef.argv);
      });
    }

    // None of the DB paths opened should contain the old directory name
    const oldPaths = openedPaths.filter((p) => p.includes('spec-first-graph'));
    expect(oldPaths).toHaveLength(0);

    // All DB paths should use the new .spec-first/graph/ directory
    expect(openedPaths.length).toBeGreaterThan(0);
    openedPaths.forEach((p) => {
      expect(p).toContain('.spec-first/graph/');
    });

    outputSpy.mockRestore();
  });

  test('query/context/postprocess/runStats 均会关闭数据库连接', () => {
    const handlers = [
      { modulePath: '../../src/crg/cli/query', fn: 'run', argv: ['--pattern=similar_to', '--symbol=node-1', '--repo=/repo'] },
      { modulePath: '../../src/crg/cli/context', fn: 'run', argv: ['--repo=/repo'] },
      { modulePath: '../../src/crg/cli/postprocess', fn: 'run', argv: ['--repo=/repo'] },
      { modulePath: '../../src/crg/cli/build', fn: 'runStats', argv: ['--repo=/repo'] },
    ];

    for (const handlerDef of handlers) {
      const closeSpy = jest.fn();
      const outputSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

      jest.isolateModules(() => {
        jest.doMock('better-sqlite3', () => jest.fn());
        jest.doMock('../../src/crg/migrations', () => ({
          initDatabase: () => ({
            close: closeSpy,
            prepare: jest.fn((sql) => {
              if (sql.includes('SELECT COUNT(*) as c FROM nodes')) return { get: () => ({ c: 1 }) };
              if (sql.includes('SELECT COUNT(*) as c FROM edges')) return { get: () => ({ c: 1 }) };
              if (sql.includes('SUM(line_end - line_start)')) return { get: () => ({ total: 10 }) };
              if (sql.includes('SELECT last_built, unresolved_edge_count')) {
                return { get: () => ({ last_built: '2026-04-11T00:00:00.000Z', unresolved_edge_count: 0 }) };
              }
              if (sql.includes('SELECT file_path, sha256 FROM fingerprints')) return { all: () => [] };
              if (sql.includes('FROM communities') && sql.includes('FROM nodes') && sql.includes('AS node_count')) {
                return { get: () => ({ node_count: 0, edge_count: 0, community_count: 0, flow_count: 0 }) };
              }
              if (sql.includes('FROM communities')) return { all: () => [] };
              if (sql.includes('FROM flows')) return { all: () => [] };
              if (sql.includes('FROM nodes')) return { all: () => [], get: () => ({}) };
              return { all: () => [], get: () => ({}) };
            }),
          }),
        }));
        jest.doMock('../../src/crg/analyze', () => ({
          godNodes: () => [],
          surprisingConnections: () => [],
          analyzeGraph: () => ({ hubs: [], surprising: [] }),
        }));
        jest.doMock('../../src/crg/search', () => ({
          rebuildFTS: () => ({ indexed_count: 0, skipped_count: 0 }),
        }));
        jest.doMock('../../src/crg/flows', () => ({
          detectFlows: () => ({ flow_count: 0 }),
        }));
        jest.doMock('../../src/crg/communities', () => ({
          writeCommunities: () => ({ community_count: 0 }),
        }));
        jest.doMock('../../src/crg/incremental', () => ({
          computeFileSHA: () => ({ sha: 'same' }),
        }));
        jest.doMock('fs', () => {
          const actual = jest.requireActual('fs');
          return {
            ...actual,
            existsSync: () => true,
          };
        });

        const handler = require(handlerDef.modulePath);
        handler[handlerDef.fn](handlerDef.argv);
      });

      expect(closeSpy).toHaveBeenCalledTimes(1);
      outputSpy.mockRestore();
    }
  });
});
