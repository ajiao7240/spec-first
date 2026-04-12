'use strict';

/**
 * Unit 5: 增量检测纯函数测试
 *
 * 覆盖：
 *   - computeFileSHA: 纯函数，无 SQLite 依赖
 *   - detectChangedFiles: 需要 SQLite，覆盖 changedShas 返回
 *   - updateFingerprints: 覆盖 changedShas 复用（无二次读取）
 */

const fs = require('fs');
const os = require('os');

const { computeFileSHA, detectChangedFiles, updateFingerprints } = require('../../src/crg/incremental');
const path = require('path');

/** 测试用 fixture 文件的绝对路径（Unit 4 已创建） */
const FIXTURE_JS = path.join(__dirname, '../fixtures/parser/js/basic.js');

describe('incremental', () => {
  describe('computeFileSHA', () => {
    test('成功读取文件返回 { sha, bytes }', () => {
      const result = computeFileSHA(FIXTURE_JS);
      expect(result).not.toBeNull();
      // SHA256 为 64 位十六进制字符串
      expect(result.sha).toMatch(/^[a-f0-9]{64}$/);
      // bytes 是 Buffer
      expect(Buffer.isBuffer(result.bytes)).toBe(true);
    });

    test('文件不存在返回 null', () => {
      const result = computeFileSHA('/nonexistent/__crg_test_no_such_file__.js');
      expect(result).toBeNull();
    });

    test('同一文件两次调用 SHA 相同（幂等）', () => {
      const r1 = computeFileSHA(FIXTURE_JS);
      const r2 = computeFileSHA(FIXTURE_JS);
      expect(r1).not.toBeNull();
      expect(r2).not.toBeNull();
      expect(r1.sha).toBe(r2.sha);
    });

    test('bytes 内容与文件实际内容一致', () => {
      const fs = require('fs');
      const result = computeFileSHA(FIXTURE_JS);
      expect(result).not.toBeNull();
      const expected = fs.readFileSync(FIXTURE_JS);
      expect(result.bytes.equals(expected)).toBe(true);
    });
  });

  describe('detectChangedFiles', () => {
    test('初次构建：所有可读文件进入 changed，changedShas 包含其 SHA', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crg-incr-'));
      const { initDatabase } = require('../../src/crg/migrations');
      const dbPath = require('path').join(tmpDir, 'graph.db');
      const db = initDatabase(dbPath);
      const filePath = require('path').join(tmpDir, 'a.js');
      fs.writeFileSync(filePath, 'const x = 1;\n');

      try {
        const { changed, unchanged, deleted, changedShas } = detectChangedFiles(
          db, ['a.js'], tmpDir
        );

        expect(changed).toEqual(['a.js']);
        expect(unchanged).toHaveLength(0);
        expect(deleted).toHaveLength(0);
        // changedShas 应包含 a.js 的 SHA（64 位十六进制）
        expect(changedShas.has('a.js')).toBe(true);
        expect(changedShas.get('a.js')).toMatch(/^[a-f0-9]{64}$/);
      } finally {
        db.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    test('二次构建无变更：unchanged=all，changedShas 为空 Map', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crg-incr-'));
      const { initDatabase } = require('../../src/crg/migrations');
      const dbPath = require('path').join(tmpDir, 'graph.db');
      const db = initDatabase(dbPath);
      const filePath = require('path').join(tmpDir, 'b.js');
      fs.writeFileSync(filePath, 'const y = 2;\n');

      try {
        // 第一次：写入 fingerprint
        const first = detectChangedFiles(db, ['b.js'], tmpDir);
        updateFingerprints(db, first.changed, first.deleted, tmpDir, first.changedShas);

        // 第二次：文件未变
        const { changed, unchanged, changedShas } = detectChangedFiles(db, ['b.js'], tmpDir);
        expect(changed).toHaveLength(0);
        expect(unchanged).toEqual(['b.js']);
        expect(changedShas.size).toBe(0);
      } finally {
        db.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    test('文件删除 → 出现在 deleted，对应 fingerprint 从表中移除', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crg-incr-'));
      const { initDatabase } = require('../../src/crg/migrations');
      const dbPath = require('path').join(tmpDir, 'graph.db');
      const db = initDatabase(dbPath);
      const filePath = require('path').join(tmpDir, 'gone.js');
      fs.writeFileSync(filePath, 'const gone = true;\n');

      try {
        const first = detectChangedFiles(db, ['gone.js'], tmpDir);
        updateFingerprints(db, first.changed, first.deleted, tmpDir, first.changedShas);

        fs.rmSync(filePath, { force: true });

        const second = detectChangedFiles(db, [], tmpDir);
        expect(second.deleted).toContain('gone.js');

        updateFingerprints(db, second.changed, second.deleted, tmpDir, second.changedShas);
        const row = db.prepare('SELECT sha256 FROM fingerprints WHERE file_path = ?').get('gone.js');
        expect(row).toBeUndefined();
      } finally {
        db.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    test('文件读取失败（ENOENT）→ 不抛出，该文件移入 deleted', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crg-incr-'));
      const { initDatabase } = require('../../src/crg/migrations');
      const dbPath = require('path').join(tmpDir, 'graph.db');
      const db = initDatabase(dbPath);
      const filePath = require('path').join(tmpDir, 'enoent.js');
      fs.writeFileSync(filePath, 'const alive = true;\n');

      try {
        const first = detectChangedFiles(db, ['enoent.js'], tmpDir);
        updateFingerprints(db, first.changed, first.deleted, tmpDir, first.changedShas);

        fs.rmSync(filePath, { force: true });

        expect(() => detectChangedFiles(db, ['enoent.js'], tmpDir)).not.toThrow();
        const second = detectChangedFiles(db, ['enoent.js'], tmpDir);
        expect(second.changed).toEqual([]);
        expect(second.deleted).toContain('enoent.js');
      } finally {
        db.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    test('超过 CHUNK_SIZE=900 的批量文件列表能正确分片查询', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crg-incr-'));
      const { initDatabase } = require('../../src/crg/migrations');
      const dbPath = require('path').join(tmpDir, 'graph.db');
      const db = initDatabase(dbPath);

      try {
        const filePaths = [];
        for (let i = 0; i < 905; i++) {
          const rel = `chunk/file-${i}.js`;
          const abs = path.join(tmpDir, rel);
          fs.mkdirSync(path.dirname(abs), { recursive: true });
          fs.writeFileSync(abs, `const n${i} = ${i};\n`);
          filePaths.push(rel);
        }

        const first = detectChangedFiles(db, filePaths, tmpDir);
        expect(first.changed).toHaveLength(905);
        updateFingerprints(db, first.changed, first.deleted, tmpDir, first.changedShas);

        const second = detectChangedFiles(db, filePaths, tmpDir);
        expect(second.changed).toHaveLength(0);
        expect(second.unchanged).toHaveLength(905);
        expect(second.deleted).toHaveLength(0);
      } finally {
        db.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe('updateFingerprints', () => {
    test('提供 changedShas 时不重新读取文件（SHA 与首次一致）', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crg-incr-'));
      const { initDatabase } = require('../../src/crg/migrations');
      const dbPath = require('path').join(tmpDir, 'graph.db');
      const db = initDatabase(dbPath);
      const filePath = require('path').join(tmpDir, 'c.js');
      fs.writeFileSync(filePath, 'const z = 3;\n');

      try {
        const { changed, deleted, changedShas } = detectChangedFiles(db, ['c.js'], tmpDir);
        const expectedSha = changedShas.get('c.js');

        // 文件写入后立即覆盖（模拟内容变更），但 changedShas 中保存的是旧 SHA
        fs.writeFileSync(filePath, 'const z = 999;\n');

        // 使用 changedShas：写入的应是 changedShas 里的旧 SHA，而非新文件的 SHA
        updateFingerprints(db, changed, deleted, tmpDir, changedShas);

        const row = db.prepare('SELECT sha256 FROM fingerprints WHERE file_path = ?').get('c.js');
        expect(row).not.toBeNull();
        expect(row.sha256).toBe(expectedSha);
      } finally {
        db.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    test('不提供 changedShas 时回退到重新读取文件', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crg-incr-'));
      const { initDatabase } = require('../../src/crg/migrations');
      const dbPath = require('path').join(tmpDir, 'graph.db');
      const db = initDatabase(dbPath);
      const filePath = require('path').join(tmpDir, 'd.js');
      fs.writeFileSync(filePath, 'const d = 4;\n');

      try {
        updateFingerprints(db, ['d.js'], [], tmpDir /* no changedShas */);

        const row = db.prepare('SELECT sha256 FROM fingerprints WHERE file_path = ?').get('d.js');
        expect(row).not.toBeNull();
        expect(row.sha256).toMatch(/^[a-f0-9]{64}$/);
      } finally {
        db.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    test('事务失败时不写入任何记录', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crg-incr-'));
      const { initDatabase } = require('../../src/crg/migrations');
      const dbPath = require('path').join(tmpDir, 'graph.db');
      const db = initDatabase(dbPath);
      const filePath = require('path').join(tmpDir, 'txn.js');
      fs.writeFileSync(filePath, 'const txn = true;\n');

      const originalPrepare = db.prepare.bind(db);
      const originalTransaction = db.transaction.bind(db);

      try {
        db.prepare = jest.fn((sql) => {
          const stmt = originalPrepare(sql);
          if (sql.includes('INSERT INTO fingerprints')) {
            return {
              ...stmt,
              run: () => {
                throw new Error('boom');
              },
            };
          }
          return stmt;
        });

        db.transaction = (fn) => originalTransaction(() => fn());

        expect(() => updateFingerprints(db, ['txn.js'], [], tmpDir)).toThrow('boom');
        const rows = db.prepare('SELECT file_path FROM fingerprints').all();
        expect(rows).toEqual([]);
      } finally {
        db.prepare = originalPrepare;
        db.transaction = originalTransaction;
        db.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });
});
