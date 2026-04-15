'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { loadCases, runContextEfficiencyBenchmark } = require('../../benchmarks/context-efficiency/run-context-efficiency');

describe('context efficiency benchmark smoke', () => {
  test('cases.json 格式正确且 runner 能输出统计', () => {
    const repoRoot = path.join(__dirname, '..', '..');
    const casesPath = path.join(repoRoot, 'benchmarks', 'context-efficiency', 'cases.json');
    const result = runContextEfficiencyBenchmark({ repoRoot, casesPath });

    expect(result.case_count).toBeGreaterThanOrEqual(3);
    expect(result.results[0]).toEqual(expect.objectContaining({
      id: expect.any(String),
      estimated_tokens: expect.any(Number),
    }));
    expect(result.fallback_rate).toEqual(expect.any(Number));
  });

  test('格式错误时显式失败', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'context-efficiency-'));
    const filePath = path.join(tmpDir, 'cases.json');
    fs.writeFileSync(filePath, JSON.stringify([{ id: 'bad' }], null, 2));

    try {
      expect(() => loadCases(filePath)).toThrow(/invalid context efficiency case/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
