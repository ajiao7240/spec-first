'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { runOutputEvals } = require('../../scripts/spec-write-tasks/run-output-evals');

const REPO_ROOT = path.join(__dirname, '..', '..');
const RECORDED_DIR = path.join(REPO_ROOT, 'docs', 'validation', 'spec-write-tasks', 'recorded-output');
const RUNNER_PATH = path.join(REPO_ROOT, 'scripts', 'spec-write-tasks', 'run-output-evals.js');

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

describe('spec-write-tasks output eval runner', () => {
  test('runs deterministic fixture assertions and records adjudicated output hashes', () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-write-tasks-output-evals-'));

    try {
      const result = runOutputEvals({ repoRoot: REPO_ROOT, outputDir });

      expect(result.ok).toBe(true);
      expect(result.scorecard.command).toBe('node scripts/spec-write-tasks/run-output-evals.js');
      expect(result.scorecard.owner).toBe('spec-first maintainers');
      expect(result.scorecard.review_cadence).toContain('在有意义的 spec-write-tasks');
      expect(result.scorecard.output_contract).toContain('执行 deterministic assertions');
      expect(result.scorecard.summary.case_count).toBeGreaterThanOrEqual(5);
      expect(result.scorecard.summary.deterministic_failed).toBe(0);
      expect(result.scorecard.summary.structural_errors).toBe(0);
      expect(result.scorecard.summary.recorded_outputs).toBe(1);
      expect(result.scorecard.recorded_outputs[0].hash_status).toBe('matched');
      expect(result.scorecard.recorded_outputs[0].source_plan_hash_status).toBe('matched');
      expect(result.scorecard.recorded_outputs[0].adjudication.status).toBe('model-adjudicated');
      expect(result.scorecard.cases[0].baseline_risks.length).toBeGreaterThan(0);
      expect(result.scorecard.cases[0].with_skill_expectations.length).toBeGreaterThan(0);
      expect(result.scorecard.cases[0].expected_outcome).toBeTruthy();
      expect(fs.existsSync(result.jsonPath)).toBe(true);
      expect(fs.existsSync(result.mdPath)).toBe(true);
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  test('custom output directory still reads the default recorded-output evidence', () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-write-tasks-output-evals-cli-'));
    try {
      const proc = spawnSync(process.execPath, [RUNNER_PATH, '--output-dir', outputDir], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
      });
      expect(proc.status).toBe(0);
      const report = JSON.parse(fs.readFileSync(path.join(outputDir, 'output_quality_scorecard.json'), 'utf8'));
      expect(report.summary.recorded_outputs).toBe(1);
      expect(report.summary.adjudicated_outputs).toBe(1);
      expect(report.command).toBe('node scripts/spec-write-tasks/run-output-evals.js --output-dir <external-path>');
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  test('missing input files fail structurally with a clear reason', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-write-tasks-output-evals-missing-'));
    const casesPath = path.join(tempRoot, 'cases.json');
    const outputDir = path.join(tempRoot, 'out');
    writeJson(casesPath, {
      schema_version: 'spec-first.spec-write-tasks-output-quality-cases.v1',
      skill: 'spec-write-tasks',
      cases: [
        {
          id: 'missing-input',
          input: 'Missing input.',
          input_files: [{ path: 'missing.md', evidence: 'file-backed fixture' }],
          baseline_risks: ['risk'],
          with_skill_expectations: ['expectation'],
          objective_assertions: ['review only'],
          deterministic_assertions: [],
          expected_outcome: 'missing evidence',
        },
      ],
    });

    try {
      const result = runOutputEvals({ repoRoot: REPO_ROOT, casesPath, outputDir });

      expect(result.ok).toBe(false);
      expect(result.scorecard.structural_errors).toContainEqual(expect.objectContaining({
        reason_code: 'input_file_missing',
        path: 'missing.md',
      }));
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test('deterministic assertion failures make the run fail', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-write-tasks-output-evals-failed-'));
    const casesPath = path.join(tempRoot, 'cases.json');
    const outputDir = path.join(tempRoot, 'out');
    writeJson(casesPath, {
      schema_version: 'spec-first.spec-write-tasks-output-quality-cases.v1',
      skill: 'spec-write-tasks',
      cases: [
        {
          id: 'failed-assertion',
          input: 'Failed assertion.',
          input_files: [{ path: 'skills/spec-write-tasks/SKILL.md', evidence: 'file-backed fixture' }],
          baseline_risks: ['risk'],
          with_skill_expectations: ['expectation'],
          objective_assertions: ['review only'],
          deterministic_assertions: [
            {
              id: 'missing-text',
              kind: 'file_contains',
              target_file: 'skills/spec-write-tasks/SKILL.md',
              expected: 'this text is intentionally absent from spec-write-tasks',
            },
          ],
          expected_outcome: 'deterministic failure',
        },
      ],
    });

    try {
      const result = runOutputEvals({ repoRoot: REPO_ROOT, casesPath, outputDir });

      expect(result.ok).toBe(false);
      expect(result.scorecard.summary.deterministic_failed).toBe(1);
      expect(result.scorecard.cases[0].deterministic_assertions.results[0]).toEqual(expect.objectContaining({
        id: 'missing-text',
        status: 'failed',
      }));
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test('recorded output hash and source hash mismatches fail structurally', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-write-tasks-output-evals-hash-'));
    const recordedDir = path.join(tempRoot, 'recorded-output');
    const outputDir = path.join(tempRoot, 'out');
    fs.cpSync(RECORDED_DIR, recordedDir, { recursive: true });
    const adjudicationPath = path.join(recordedDir, 'valid-task-pack.adjudication.json');
    const adjudication = JSON.parse(fs.readFileSync(adjudicationPath, 'utf8'));
    adjudication.output_hash = `sha256:${'0'.repeat(64)}`;
    adjudication.source_plan_hash = `sha256:${'1'.repeat(64)}`;
    writeJson(adjudicationPath, adjudication);

    try {
      const result = runOutputEvals({ repoRoot: REPO_ROOT, outputDir, recordedOutputDir: recordedDir });

      expect(result.ok).toBe(false);
      expect(result.scorecard.structural_errors).toEqual(expect.arrayContaining([
        expect.objectContaining({ reason_code: 'recorded_output_hash_mismatch' }),
        expect.objectContaining({ reason_code: 'recorded_output_source_plan_hash_mismatch' }),
      ]));
      expect(result.scorecard.recorded_outputs[0].hash_status).toBe('mismatch');
      expect(result.scorecard.recorded_outputs[0].source_plan_hash_status).toBe('mismatch');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test('pending adjudication is not counted as adjudicated evidence', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-write-tasks-output-evals-pending-'));
    const recordedDir = path.join(tempRoot, 'recorded-output');
    const outputDir = path.join(tempRoot, 'out');
    fs.cpSync(RECORDED_DIR, recordedDir, { recursive: true });
    const adjudicationPath = path.join(recordedDir, 'valid-task-pack.adjudication.json');
    const adjudication = JSON.parse(fs.readFileSync(adjudicationPath, 'utf8'));
    adjudication.adjudication.status = 'adjudication-pending';
    writeJson(adjudicationPath, adjudication);

    try {
      const result = runOutputEvals({ repoRoot: REPO_ROOT, outputDir, recordedOutputDir: recordedDir });

      expect(result.ok).toBe(false);
      expect(result.scorecard.summary.adjudicated_outputs).toBe(0);
      expect(result.scorecard.summary.pending_or_unknown_adjudications).toBe(1);
      expect(result.scorecard.structural_errors).toContainEqual(expect.objectContaining({
        reason_code: 'recorded_output_adjudication_not_complete',
        adjudication_status: 'adjudication-pending',
      }));
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test('missing recorded output evidence fails explicitly', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-write-tasks-output-evals-missing-recorded-'));
    const outputDir = path.join(tempRoot, 'out');
    const recordedDir = path.join(tempRoot, 'empty-recorded-output');
    fs.mkdirSync(recordedDir, { recursive: true });

    try {
      const result = runOutputEvals({ repoRoot: REPO_ROOT, outputDir, recordedOutputDir: recordedDir });

      expect(result.ok).toBe(false);
      expect(result.scorecard.summary.recorded_outputs).toBe(0);
      expect(result.scorecard.structural_errors).toContainEqual(expect.objectContaining({
        reason_code: 'recorded_output_missing',
      }));
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test('objective assertions remain reviewer narrative, not deterministic passes', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-write-tasks-output-evals-prose-'));
    const casesPath = path.join(tempRoot, 'cases.json');
    const outputDir = path.join(tempRoot, 'out');
    writeJson(casesPath, {
      schema_version: 'spec-first.spec-write-tasks-output-quality-cases.v1',
      skill: 'spec-write-tasks',
      cases: [
        {
          id: 'prose-only',
          input: 'Review prose.',
          input_files: [{ path: 'skills/spec-write-tasks/SKILL.md', evidence: 'file-backed fixture' }],
          baseline_risks: ['risk'],
          with_skill_expectations: ['expectation'],
          objective_assertions: ['This should be reviewed by a person or model.'],
          deterministic_assertions: [],
          expected_outcome: 'review narrative only',
        },
      ],
    });

    try {
      const result = runOutputEvals({ repoRoot: REPO_ROOT, casesPath, outputDir });

      expect(result.ok).toBe(true);
      expect(result.scorecard.summary.deterministic_assertions).toBe(0);
      expect(result.scorecard.cases[0].objective_assertions_count).toBe(1);
      expect(result.scorecard.cases[0].evidence_modes).not.toEqual(expect.arrayContaining([
        'model-executed',
        'human-adjudicated',
      ]));
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
