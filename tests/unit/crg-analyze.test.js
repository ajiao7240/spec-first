'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { initDatabase } = require('../../src/crg/migrations');
const { upsertNodes, upsertEdges } = require('../../src/crg/graph');
const { surprisingConnections, godNodes } = require('../../src/crg/analyze');

describe('crg analyze', () => {
  test('仅 cross_community 不再单独触发 surprising connection', () => {
    // 锁定 Phase 1a 的刻意收紧：单纯跨社区调用在大仓库里太常见，
    // 必须与 cross_language 或 peripheral_to_hub 共现才算惊喜。
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crg-analyze-'));
    const db = initDatabase(path.join(tmpDir, 'graph.db'));

    try {
      upsertNodes(db, [
        {
          id: 'src/shared.js#function#helper#L1',
          file_path: 'src/shared.js',
          name: 'helper',
          kind: 'function',
          line_start: 1,
          line_end: 3,
          community_id: 'shared',
        },
        {
          id: 'src/auth/a.js#function#entry#L10',
          file_path: 'src/auth/a.js',
          name: 'entry',
          kind: 'function',
          line_start: 10,
          line_end: 20,
          community_id: 'auth',
        },
        {
          id: 'src/payments/b.js#function#targetJs#L30',
          file_path: 'src/payments/b.js',
          name: 'targetJs',
          kind: 'function',
          line_start: 30,
          line_end: 40,
          community_id: 'payments',
        },
        {
          id: 'src/payments/c.py#function#targetPy#L50',
          file_path: 'src/payments/c.py',
          name: 'targetPy',
          kind: 'function',
          line_start: 50,
          line_end: 60,
          community_id: 'payments',
        },
      ]);
      upsertEdges(db, [
        {
          id: 'helper:entry:calls',
          source_id: 'src/shared.js#function#helper#L1',
          target_id: 'src/auth/a.js#function#entry#L10',
          kind: 'calls',
          weight: 1,
        },
        {
          id: 'entry:target-js:calls',
          source_id: 'src/auth/a.js#function#entry#L10',
          target_id: 'src/payments/b.js#function#targetJs#L30',
          kind: 'calls',
          weight: 1,
        },
        {
          id: 'entry:target-py:calls',
          source_id: 'src/auth/a.js#function#entry#L10',
          target_id: 'src/payments/c.py#function#targetPy#L50',
          kind: 'calls',
          weight: 1,
        },
      ]);

      // upsertNodes 硬编码 community_id = NULL（由 writeCommunities 填充），
      // 手动写入 communities + 更新 nodes 模拟 postprocess 完成后状态
      db.prepare(
        'INSERT INTO communities (id, label, file_count, health_status, health_density, health_independence) VALUES (?, ?, ?, ?, ?, ?)'
      ).run('shared', 'shared', 1, 'healthy', 0, 1);
      db.prepare(
        'INSERT INTO communities (id, label, file_count, health_status, health_density, health_independence) VALUES (?, ?, ?, ?, ?, ?)'
      ).run('auth', 'auth', 1, 'healthy', 0, 1);
      db.prepare(
        'INSERT INTO communities (id, label, file_count, health_status, health_density, health_independence) VALUES (?, ?, ?, ?, ?, ?)'
      ).run('payments', 'payments', 2, 'healthy', 0.5, 1);
      db.prepare("UPDATE nodes SET community_id = 'shared' WHERE file_path = 'src/shared.js'").run();
      db.prepare("UPDATE nodes SET community_id = 'auth' WHERE file_path LIKE 'src/auth/%'").run();
      db.prepare("UPDATE nodes SET community_id = 'payments' WHERE file_path LIKE 'src/payments/%'").run();

      const result = surprisingConnections(db);
      const targets = result.map((item) => item.target);

      // targetPy：cross_community + cross_language → F2(30) + F3(30, 门控通过) = 60，应触发
      expect(targets).toContain('src/payments/c.py#function#targetPy#L50');
      // targetJs：仅 cross_community（同语言 js）→ F3 门控不通过，score 不够 30 阈值，不触发
      expect(targets).not.toContain('src/payments/b.js#function#targetJs#L30');
    } finally {
      db.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('in_degree 计算过滤 imports_from/contains/defined_in 结构边', () => {
    // 独立 bug 的守护：历史版本把结构边计入 in_degree，
    // 导致 contains 边给每个函数节点至少 +1，污染 hubThreshold 和 god_nodes 排序。
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crg-analyze-indegree-'));
    const db = initDatabase(path.join(tmpDir, 'graph.db'));

    try {
      upsertNodes(db, [
        {
          id: 'src/mod.js#module#mod#L0',
          file_path: 'src/mod.js',
          name: 'mod',
          kind: 'module',
          line_start: 0,
          line_end: 100,
        },
        {
          id: 'src/mod.js#function#realHub#L10',
          file_path: 'src/mod.js',
          name: 'realHub',
          kind: 'function',
          line_start: 10,
          line_end: 20,
        },
        {
          id: 'src/mod.js#function#structOnly#L30',
          file_path: 'src/mod.js',
          name: 'structOnly',
          kind: 'function',
          line_start: 30,
          line_end: 40,
        },
        {
          id: 'src/mod.js#function#c1#L50',
          file_path: 'src/mod.js',
          name: 'c1',
          kind: 'function',
          line_start: 50,
          line_end: 55,
        },
        {
          id: 'src/mod.js#function#c2#L60',
          file_path: 'src/mod.js',
          name: 'c2',
          kind: 'function',
          line_start: 60,
          line_end: 65,
        },
      ]);

      upsertEdges(db, [
        // structOnly 只有 contains 结构边指向它（来自 module）；in_degree 过滤后应为 0
        {
          id: 'mod:structOnly:contains',
          source_id: 'src/mod.js#module#mod#L0',
          target_id: 'src/mod.js#function#structOnly#L30',
          kind: 'contains',
          weight: 1,
        },
        // realHub 除 contains 外有 2 条 calls 入边；语义 in_degree = 2
        {
          id: 'mod:realHub:contains',
          source_id: 'src/mod.js#module#mod#L0',
          target_id: 'src/mod.js#function#realHub#L10',
          kind: 'contains',
          weight: 1,
        },
        {
          id: 'c1:realHub:calls',
          source_id: 'src/mod.js#function#c1#L50',
          target_id: 'src/mod.js#function#realHub#L10',
          kind: 'calls',
          weight: 1,
        },
        {
          id: 'c2:realHub:calls',
          source_id: 'src/mod.js#function#c2#L60',
          target_id: 'src/mod.js#function#realHub#L10',
          kind: 'calls',
          weight: 1,
        },
      ]);

      const hubs = godNodes(db);
      const hubIds = hubs.map((h) => h.id);

      // realHub 语义 in_degree=2，应入 god_nodes
      expect(hubIds).toContain('src/mod.js#function#realHub#L10');
      // structOnly 仅被 contains 边指向，语义 in_degree=0（被 HAVING in_degree>0 过滤），不应入
      expect(hubIds).not.toContain('src/mod.js#function#structOnly#L30');

      const realHub = hubs.find((h) => h.id === 'src/mod.js#function#realHub#L10');
      expect(realHub.in_degree).toBe(2);
    } finally {
      db.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
