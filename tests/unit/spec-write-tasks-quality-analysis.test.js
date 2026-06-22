'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { analyzeTaskPackQuality } = require('../../scripts/spec-write-tasks/analyze-task-pack-quality');

const REPO_ROOT = path.join(__dirname, '..', '..');
const VALID_TASK_PACK = path.join(REPO_ROOT, 'tests', 'fixtures', 'spec-write-tasks', 'valid', 'task-pack.md');
const ANALYZER_PATH = path.join(REPO_ROOT, 'scripts', 'spec-write-tasks', 'analyze-task-pack-quality.js');

function tempTaskPack(content) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-write-tasks-quality-analysis-'));
  const taskPackPath = path.join(tempRoot, 'task-pack.md');
  fs.writeFileSync(taskPackPath, content, 'utf8');
  return { tempRoot, taskPackPath };
}

describe('spec-write-tasks task-pack quality analyzer', () => {
  test('valid fixture produces advisory metadata and no review-required findings', () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-write-tasks-quality-analysis-out-'));
    try {
      const result = analyzeTaskPackQuality({
        repoRoot: REPO_ROOT,
        taskPackPath: VALID_TASK_PACK,
        outputDir,
      });

      expect(result.report.advisory_only).toBe(true);
      expect(result.report.input_readiness.status).toBe('readable');
      expect(result.report.rollback_boundary).toContain('task_pack_quality_analysis');
      expect(result.report.validator_boundary.deterministic_handoff).toBe(true);
      expect(result.report.findings.filter((entry) => entry.severity === 'review_required')).toEqual([]);
      expect(result.report.disabled_checks[0].reason_code).toBe('large-plan-threshold-deferred');
      expect(fs.existsSync(result.jsonPath)).toBe(true);
      expect(fs.existsSync(result.mdPath)).toBe(true);
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  test('whole-plan-only context refs produce warning but do not override validator truth', () => {
    const original = fs.readFileSync(VALID_TASK_PACK, 'utf8');
    const mutated = original.replace(
      '"requirement_refs": ["R1"],',
      '"requirement_refs": ["R1"],\n      "context_refs": ["tests/fixtures/spec-write-tasks/valid/source-plan.md"],',
    );
    const { tempRoot, taskPackPath } = tempTaskPack(mutated);
    const outputDir = path.join(tempRoot, 'out');

    try {
      const result = analyzeTaskPackQuality({ repoRoot: REPO_ROOT, taskPackPath, outputDir });

      expect(result.report.validator_boundary.deterministic_handoff).toBe(true);
      expect(result.report.validator_boundary.cannot_override_validator).toBe(true);
      expect(result.report.findings).toContainEqual(expect.objectContaining({
        severity: 'warning',
        reason_code: 'whole-plan-only-context-refs',
        task_id: 'T001',
      }));
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test('documented quality smells produce advisory findings', () => {
    const original = fs.readFileSync(VALID_TASK_PACK, 'utf8');
    const contract = {
      schema_version: 'task-pack/v1',
      execution_waves: [
        { wave: 1, tasks: ['T001', 'T002'] },
      ],
      tasks: [
        {
          task_id: 'T001',
          goal: 'Exercise quality smell detection.',
          dependencies: [],
          files: ['src/cli/task-pack.js'],
          test_focus: 'Analyzer warning output.',
          done_signal: 'code is done',
          wave: 1,
          review_gate: 'required',
          stop_if: 'if unsure',
        },
        {
          task_id: 'T002',
          source_unit: 'U1',
          requirement_refs: ['R1'],
          goal: 'Exercise additional subjective signals.',
          dependencies: [],
          files: ['tests/unit/task-pack-command.test.js'],
          test_focus: 'Analyzer warning output.',
          done_signal: 'works normally',
          wave: 1,
          review_gate: 'required',
          stop_if: 'if scope changes',
        },
      ],
    };
    const mutated = original.replace(
      /```json\n[\s\S]*?\n```/,
      `\`\`\`json\n${JSON.stringify(contract, null, 2)}\n\`\`\``,
    );
    const { tempRoot, taskPackPath } = tempTaskPack(mutated);
    const outputDir = path.join(tempRoot, 'out');

    try {
      const result = analyzeTaskPackQuality({ repoRoot: REPO_ROOT, taskPackPath, outputDir });
      const reasonCodes = result.report.findings.map((entry) => entry.reason_code);

      expect(result.report.advisory_only).toBe(true);
      expect(result.report.validator_boundary.cannot_override_validator).toBe(true);
      expect(reasonCodes).toEqual(expect.arrayContaining([
        'validator-not-valid',
        'missing-source-anchor',
        'subjective-done-signal',
        'vague-stop-if',
        'all-tasks-review-gate-required',
      ]));
      expect(result.report.findings.filter((entry) => entry.reason_code === 'subjective-done-signal')).toHaveLength(2);
      expect(result.report.findings.filter((entry) => entry.reason_code === 'vague-stop-if')).toHaveLength(2);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test('generated runtime file ownership is review-required advisory evidence', () => {
    const original = fs.readFileSync(VALID_TASK_PACK, 'utf8');
    const mutated = original.replace('"src/cli/task-pack.js"', '".codex/generated.md"');
    const { tempRoot, taskPackPath } = tempTaskPack(mutated);
    const outputDir = path.join(tempRoot, 'out');

    try {
      const result = analyzeTaskPackQuality({ repoRoot: REPO_ROOT, taskPackPath, outputDir });

      expect(result.report.validator_boundary.deterministic_handoff).toBe(false);
      expect(result.report.findings).toEqual(expect.arrayContaining([
        expect.objectContaining({ reason_code: 'validator-not-valid', severity: 'review_required' }),
        expect.objectContaining({ reason_code: 'generated-runtime-file-ownership', severity: 'review_required' }),
      ]));
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test('large-plan and wide-source-unit checks stay deferred', () => {
    const result = analyzeTaskPackQuality({
      repoRoot: REPO_ROOT,
      taskPackPath: VALID_TASK_PACK,
      outputDir: fs.mkdtempSync(path.join(os.tmpdir(), 'spec-write-tasks-quality-analysis-deferred-')),
    });
    try {
      const reasonCodes = result.report.findings.map((entry) => entry.reason_code);
      expect(reasonCodes.join('\n')).not.toContain('large-plan');
      expect(reasonCodes.join('\n')).not.toContain('wide-source-unit');
      expect(result.report.disabled_checks).toContainEqual(expect.objectContaining({
        reason_code: 'large-plan-threshold-deferred',
      }));
    } finally {
      fs.rmSync(path.dirname(result.jsonPath), { recursive: true, force: true });
    }
  });

  test('missing task pack is an invocation failure with concrete reason code', () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-write-tasks-quality-analysis-missing-'));
    try {
      const proc = spawnSync(process.execPath, [
        ANALYZER_PATH,
        '/tmp/definitely-missing-task-pack.md',
        '--output-dir',
        outputDir,
      ], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
      });

      expect(proc.status).toBe(1);
      const stdout = JSON.parse(proc.stdout);
      expect(stdout.ok).toBe(false);
      expect(stdout.reason_code).toBe('task-pack-missing');
      const report = JSON.parse(fs.readFileSync(path.join(outputDir, 'task_pack_quality_analysis.json'), 'utf8'));
      expect(report.input_readiness).toEqual(expect.objectContaining({
        status: 'failed',
        reason_code: 'task-pack-missing',
      }));
      expect(report.findings).toContainEqual(expect.objectContaining({
        reason_code: 'task-pack-missing',
      }));
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });
});
