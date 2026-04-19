'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { initDatabase } = require('../../src/crg/migrations');
const { upsertNodes } = require('../../src/crg/graph');
const { computeFlowCriticality } = require('../../src/crg/flows');
const { scoreSecuritySignal } = require('../../src/crg/constants');

describe('crg flow scoring', () => {
  test('criticality 不再把 is_test 占比伪装成测试覆盖缺口', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crg-flow-criticality-'));
    const db = initDatabase(path.join(tmpDir, 'graph.db'));

    try {
      upsertNodes(db, [
        {
          id: 'src/app.js#function#entry#L1',
          file_path: 'src/app.js',
          name: 'entry',
          kind: 'function',
          line_start: 1,
          line_end: 5,
          is_test: 0,
        },
        {
          id: 'src/app.js#function#worker#L10',
          file_path: 'src/app.js',
          name: 'worker',
          kind: 'function',
          line_start: 10,
          line_end: 20,
          is_test: 0,
        },
      ]);

      const flowNodeIds = [
        'src/app.js#function#entry#L1',
        'src/app.js#function#worker#L10',
      ];
      const baseline = computeFlowCriticality(flowNodeIds, db);

      db.prepare("UPDATE nodes SET is_test = 1 WHERE id = 'src/app.js#function#worker#L10'").run();
      const withTestFlag = computeFlowCriticality(flowNodeIds, db);

      expect(withTestFlag).toBe(baseline);
    } finally {
      db.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('安全信号收窄后，不把普通 Web 高频词当安全事实', () => {
    expect(scoreSecuritySignal({
      name: 'handleRequest',
      filePath: 'src/web/request-handler.js',
    })).toBe(0);

    expect(scoreSecuritySignal({
      name: 'validatePayload',
      filePath: 'src/auth/validator.js',
    })).toBe(0.5);

    expect(scoreSecuritySignal({
      name: 'verifyJwtToken',
      filePath: 'src/security/token-service.js',
    })).toBe(1);
  });
});
