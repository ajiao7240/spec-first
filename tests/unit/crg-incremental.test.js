'use strict';

/**
 * Unit 5: 增量检测纯函数测试
 *
 * 依赖 better-sqlite3 的测试（detectChangedFiles / updateFingerprints）
 * 需要 npm install 后才能运行，此处以 test.todo 占位。
 */

const { computeFileSHA } = require('../../src/crg/incremental');
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

  describe('detectChangedFiles（需要 SQLite，todo）', () => {
    test.todo('初次构建 → 所有文件入 changed，fingerprints 全量写入');
    test.todo('二次构建无变更 → changed=[], unchanged=all');
    test.todo('单文件修改 → 只有该文件在 changed，其他在 unchanged');
    test.todo('文件删除 → 出现在 deleted，对应 fingerprint 从表中移除');
    test.todo('文件读取失败（ENOENT）→ 不抛出，该文件移入 deleted');
    test.todo('超过 CHUNK_SIZE=900 的批量文件列表能正确分片查询');
  });

  describe('updateFingerprints（需要 SQLite，todo）', () => {
    test.todo('changed 文件在事务中被 UPSERT');
    test.todo('deleted 文件在事务中被 DELETE');
    test.todo('事务失败时不写入任何记录');
  });
});
