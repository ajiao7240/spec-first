'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { initDatabase } = require('../../src/crg/migrations');
const { upsertNodes } = require('../../src/crg/graph');
const { resolveTsconfigImport, stripJsonComments } = require('../../src/crg/resolvers/tsconfig');

describe('crg tsconfig resolver', () => {
  test('解析 JSONC comments', () => {
    expect(JSON.parse(stripJsonComments('{"compilerOptions": {// comment\n"baseUrl":"."}}'))).toEqual({
      compilerOptions: { baseUrl: '.' },
    });
  });

  test('按 nearest tsconfig paths 和 extension probing 解析 alias', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'crg-tsconfig-'));
    const db = initDatabase(path.join(repoRoot, 'graph.db'));

    try {
      fs.mkdirSync(path.join(repoRoot, 'packages/app'), { recursive: true });
      fs.writeFileSync(path.join(repoRoot, 'packages/app/tsconfig.json'), JSON.stringify({
        compilerOptions: {
          baseUrl: '.',
          paths: {
            '@app/*': ['src/*'],
          },
        },
      }));
      upsertNodes(db, [
        { id: 'packages/app/src/util.ts#module#util.ts#L0', file_path: 'packages/app/src/util.ts', name: 'util.ts', kind: 'module' },
      ]);

      const result = resolveTsconfigImport(db, {
        repoRoot,
        sourceFile: 'packages/app/src/main.ts',
        specifier: '@app/util',
      });

      expect(result).toEqual(expect.objectContaining({
        target_id: 'packages/app/src/util.ts#module#util.ts#L0',
        resolution_method: 'tsconfig_paths',
      }));
    } finally {
      db.close();
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });
});
