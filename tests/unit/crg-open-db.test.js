'use strict';

const fs = require('fs');
const path = require('path');

describe('CRG open-db configuration', () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, '..', '..', 'src/crg/cli/open-db.js'),
    'utf8'
  );

  test('openDb 以 readonly + fileMustExist 方式打开 graph.db', () => {
    // readonly 保障只读消费者不会误写；fileMustExist 防御未来 writable 场景被复制时自动建库
    expect(source).toMatch(/readonly:\s*true/);
    expect(source).toMatch(/fileMustExist:\s*true/);
  });

  test('openDb 在 new Database 之前已做 existsSync 前置检查', () => {
    // 配合 fileMustExist，errno 不友好时前置检查负责给出人类可读提示
    expect(source).toMatch(/fs\.existsSync\(dbPath\)/);
    const existsIdx = source.indexOf('fs.existsSync(dbPath)');
    const newDbIdx = source.indexOf('new Database(dbPath');
    expect(existsIdx).toBeGreaterThan(-1);
    expect(newDbIdx).toBeGreaterThan(-1);
    expect(existsIdx).toBeLessThan(newDbIdx);
  });
});
