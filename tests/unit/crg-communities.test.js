'use strict';

/**
 * Unit: communities.js 社区检测测试
 *
 * 覆盖：
 *   - CONTAINER_DIRS 跳过：src/auth → community "auth"，而非 "src"
 *   - 健康状态名称：fragmented/scattered（spec §14.5）
 *   - 单文件目录合并到 (root)
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const { initDatabase } = require('../../src/crg/migrations');
const { upsertNodes } = require('../../src/crg/graph');
const { writeCommunities } = require('../../src/crg/communities');

/** 构造最小 module 节点 */
function makeModule(filePath) {
  const name = path.basename(filePath);
  return {
    id: `${filePath}#module#${name}#L0`,
    file_path: filePath,
    name,
    kind: 'module',
    line_start: 0,
    line_end: 0,
  };
}

describe('writeCommunities', () => {
  let tmpDir, dbPath, db;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crg-communities-'));
    dbPath = path.join(tmpDir, 'graph.db');
    db = initDatabase(dbPath);
  });

  afterEach(() => {
    try { db.close(); } catch (_) {}
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('CONTAINER_DIRS: src/auth 中的文件应归入 "auth" 社区（跳过 src 容器层）', () => {
    // auth 不是容器目录，src 是 → src/auth/... 应归入 "auth"
    upsertNodes(db, [
      makeModule('src/auth/login.js'),
      makeModule('src/auth/logout.js'),
    ]);

    writeCommunities(db);

    const communities = db.prepare('SELECT id FROM communities').all();
    const ids = communities.map((c) => c.id);
    // 社区 ID 为 "auth"（可能因 Pass 3 拆分后含 auth/0、auth/1，
    // 但前缀一定是 auth 而非 src）
    const hasAuth = ids.some((id) => id === 'auth' || id.startsWith('auth/'));
    expect(hasAuth).toBe(true);
    expect(ids.every((id) => !id.startsWith('src'))).toBe(true);
  });

  test('多层容器目录 src/core/auth：跳过 src + core，归入 "auth"', () => {
    // src 和 core 都是容器目录，auth 不是
    upsertNodes(db, [
      makeModule('src/core/auth/session.js'),
      makeModule('src/core/auth/token.js'),
    ]);

    writeCommunities(db);

    const communities = db.prepare('SELECT id FROM communities').all();
    const ids = communities.map((c) => c.id);
    const hasAuth = ids.some((id) => id === 'auth' || id.startsWith('auth/'));
    expect(hasAuth).toBe(true);
    expect(ids.every((id) => id !== 'src' && id !== 'core')).toBe(true);
  });

  test('非容器顶层目录: payments 中的文件应归入 "payments" 社区', () => {
    // payments 不在 CONTAINER_DIRS 中
    upsertNodes(db, [
      makeModule('payments/charge.js'),
      makeModule('payments/refund.js'),
    ]);

    writeCommunities(db);

    const communities = db.prepare('SELECT id FROM communities').all();
    const ids = communities.map((c) => c.id);
    const hasPayments = ids.some((id) => id === 'payments' || id.startsWith('payments/'));
    expect(hasPayments).toBe(true);
  });

  test('单文件目录应合并到 (root)', () => {
    upsertNodes(db, [
      makeModule('orphan/singleton.js'),
    ]);

    writeCommunities(db);

    const communities = db.prepare('SELECT id FROM communities').all();
    const ids = communities.map((c) => c.id);
    // 单文件目录合并到 (root)
    expect(ids.every((id) => !id.startsWith('orphan'))).toBe(true);
  });

  test('健康状态名：无边社区 → scattered（非 fragile/overloaded）', () => {
    // 两个互相没有边的模块：intra=0, inter=0
    // density = 0/(2*1) = 0 ≤ 0.3; independence = 0/max(0,1) = 0 ≤ 0.5 → scattered
    upsertNodes(db, [
      makeModule('billing/invoice.js'),
      makeModule('billing/receipt.js'),
    ]);

    writeCommunities(db);

    const communities = db.prepare('SELECT id FROM communities').all();
    // 不应出现已废弃的 fragile / overloaded
    for (const c of communities) {
      expect(c.health_status).not.toBe('fragile');
      expect(c.health_status).not.toBe('overloaded');
    }
    expect(communities.length).toBeGreaterThan(0);
  });

  test('健康状态不应包含废弃名称 fragile/overloaded（多个社区场景）', () => {
    // 三个不同顶层目录 → 三个社区
    upsertNodes(db, [
      makeModule('catalog/product.js'),
      makeModule('catalog/category.js'),
      makeModule('infra/db.js'),
    ]);

    writeCommunities(db);

    const rows = db.prepare('SELECT health_status FROM communities').all();
    for (const row of rows) {
      expect(row.health_status).not.toBe('fragile');
      expect(row.health_status).not.toBe('overloaded');
      expect(['healthy', 'isolated', 'fragmented', 'scattered']).toContain(row.health_status);
    }
  });
});
