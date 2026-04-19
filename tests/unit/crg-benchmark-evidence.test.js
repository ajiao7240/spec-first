'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { ARTIFACT_KIND, runCrgBenchmarkEvidence } = require('../../scripts/run-crg-benchmark-evidence');

const REPO_ROOT = path.join(__dirname, '..', '..');

describe('crg benchmark evidence', () => {
  test('runner 输出轻量 benchmark evidence artifact，而不是新 gate 状态', () => {
    const result = runCrgBenchmarkEvidence({ repoRoot: REPO_ROOT });

    expect(result).toEqual({
      schema_version: 'v1',
      generated_at: expect.any(String),
      artifact_kind: ARTIFACT_KIND,
      benchmarks: expect.arrayContaining([
        expect.objectContaining({
          benchmark_id: 'review',
          benchmark_contract_version: 'v1',
          analyzer_revision: expect.any(String),
          input_digest: expect.any(String),
          artifact_path: '.spec-first/workflows/quality-gates/crg-benchmark-evidence/review-benchmark.json',
        }),
        expect.objectContaining({
          benchmark_id: 'repo-qa',
          benchmark_contract_version: 'v1',
          analyzer_revision: expect.any(String),
          input_digest: expect.any(String),
          artifact_path: '.spec-first/workflows/quality-gates/crg-benchmark-evidence/repo-qa-benchmark.json',
        }),
        expect.objectContaining({
          benchmark_id: 'context-efficiency',
          benchmark_contract_version: 'v1',
          analyzer_revision: expect.any(String),
          input_digest: expect.any(String),
          artifact_path: '.spec-first/workflows/quality-gates/crg-benchmark-evidence/context-efficiency-benchmark.json',
        }),
      ]),
      artifact_path: '.spec-first/workflows/quality-gates/crg-benchmark-evidence/crg-benchmark-evidence.json',
    });
  });

  test('workflow 暴露 benchmark evidence job 与 artifact 上传', () => {
    const workflow = fs.readFileSync(path.join(REPO_ROOT, '.github', 'workflows', 'crg-quality-gate.yml'), 'utf8');
    const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'));

    expect(pkg.scripts['test:crg:benchmark-evidence']).toBe('node scripts/run-crg-benchmark-evidence.js');
    expect(workflow).toContain('benchmark-evidence:');
    expect(workflow).toContain('npm run test:crg:benchmark-evidence');
    expect(workflow).toContain('actions/upload-artifact@v4');
    expect(workflow).toContain('.spec-first/workflows/quality-gates/crg-benchmark-evidence/');
  });
});
