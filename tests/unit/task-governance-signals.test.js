'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { runInternal } = require('../../src/cli/commands/internal');
const {
  collectTaskGovernanceSignals,
  validateOutput,
} = require('../../src/cli/helpers/task-governance-signals');

function makeRepo() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'task-governance-signals-'));
  execFileSync('git', ['init', '-q'], { cwd: repo });
  execFileSync('git', ['config', 'user.name', 'Spec First Test'], { cwd: repo });
  execFileSync('git', ['config', 'user.email', 'spec-first-test@example.invalid'], { cwd: repo });
  fs.writeFileSync(path.join(repo, 'README.md'), 'base\n');
  execFileSync('git', ['add', 'README.md'], { cwd: repo });
  execFileSync('git', ['commit', '--no-verify', '-m', 'initial', '-q'], { cwd: repo });
  return repo;
}

function captureStdout(fn) {
  const outputSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  try {
    const code = fn();
    const stdout = outputSpy.mock.calls.map((call) => String(call[0])).join('');
    return { code, stdout };
  } finally {
    outputSpy.mockRestore();
  }
}

describe('task governance signals', () => {
  test('plan-declared source uses planning context and no score or confidence', () => {
    const output = collectTaskGovernanceSignals({
      source: 'plan-declared',
      inputPath: writeJson({
        request: '新增 workflow contract，并同步中文治理说明',
        origin_text: '涉及 schema、双宿主、generated runtime 边界',
        candidate_paths: ['skills/spec-plan/SKILL.md', 'docs/contracts/governance/task-governance-signals.schema.json'],
        source_refs: ['docs/10-prompt/结构化项目角色契约.md'],
      }),
    });

    expect(validateOutput(output).errors).toEqual([]);
    expect(output.signals.signal_source).toBe('plan-declared');
    expect(output.signals.declared_path_count).toBe(2);
    expect(output.signals.source_ref_count).toBe(1);
    expect(output.signals.cross_module).toBe(true);
    expect(output.signals.keyword_hits).toEqual(expect.arrayContaining([
      expect.objectContaining({ keyword: 'schema' }),
      expect.objectContaining({ keyword: '双宿主' }),
    ]));
    expect(output.candidate_level).not.toBe('S');
    expect(output).not.toHaveProperty('score');
    expect(output).not.toHaveProperty('confidence');
  });

  test('git-diff source produces candidate facts and validates schema', () => {
    const repo = makeRepo();
    try {
      fs.mkdirSync(path.join(repo, 'skills', 'spec-plan'), { recursive: true });
      fs.writeFileSync(path.join(repo, 'skills', 'spec-plan', 'SKILL.md'), 'contract\nworkflow\n');
      execFileSync('git', ['add', '-N', 'skills/spec-plan/SKILL.md'], { cwd: repo });
      const output = collectTaskGovernanceSignals({
        source: 'git-diff',
        targetRepo: repo,
      });

      expect(validateOutput(output).errors).toEqual([]);
      expect(output.signals.signal_source).toBe('git-diff');
      expect(output.signals.file_count).toBe(1);
      expect(output.signals.critical_path_hits).toContain('skills/spec-plan/SKILL.md');
      expect(output.reason_codes).toEqual(expect.arrayContaining(['git-diff-collected', 'critical-path-hit']));
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test('internal subcommand emits JSON', () => {
    const inputPath = writeJson({
      request: '小文案修改',
      candidate_paths: ['README.md'],
    });
    const result = captureStdout(() => runInternal([
      'task-governance-signals',
      '--source',
      'plan-declared',
      '--input',
      inputPath,
      '--json',
    ]));
    const output = JSON.parse(result.stdout);

    expect(result.code).toBe(0);
    expect(output.schema_version).toBe('task-governance-signals.v1');
    expect(output.candidate_level).toBe('lightweight');
  });

  test('classifies deep and standard buckets reproducibly', () => {
    const deep = collectTaskGovernanceSignals({
      source: 'plan-declared',
      inputPath: writeJson({
        candidate_paths: ['skills/spec-plan/SKILL.md', 'src/contracts/schema-validator.js'],
        source_refs: ['docs/contracts/governance/task-governance-signals.schema.json', 'agents/x.md'],
      }),
    });
    expect(deep.candidate_level).toBe('deep');
    expect(deep.reason_codes).toEqual(expect.arrayContaining(['critical-path-hit', 'candidate-deep']));

    const standard = collectTaskGovernanceSignals({
      source: 'plan-declared',
      inputPath: writeJson({
        request: '调整工作流文案',
        candidate_paths: ['README.md', 'CONTRIBUTING.md', 'docs/guide.md'],
      }),
    });
    expect(standard.candidate_level).toBe('standard');
  });

  test('unreadable plan-declared input degrades with reason_code instead of faking lightweight', () => {
    const output = collectTaskGovernanceSignals({
      source: 'plan-declared',
      inputPath: '/tmp/task-governance-missing-input-xyz.json',
    });
    expect(output.reason_codes).toContain('planning-context-unreadable');
    expect(output.collection_status).toBe('degraded');
  });

  test('collection_status separates a real failure from a trustworthy empty result', () => {
    const notRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'task-governance-not-repo-'));
    const repo = makeRepo();
    try {
      const failed = collectTaskGovernanceSignals({ source: 'git-diff', targetRepo: notRepo });
      expect(failed.collection_status).toBe('unavailable');
      expect(failed.candidate_level).toBe('lightweight');
      expect(validateOutput(failed).errors).toEqual([]);

      const empty = collectTaskGovernanceSignals({ source: 'git-diff', targetRepo: repo });
      expect(empty.collection_status).toBe('ok');
      expect(empty.candidate_level).toBe('lightweight');
    } finally {
      fs.rmSync(notRepo, { recursive: true, force: true });
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test('non-git git-diff target exits 0 with unavailable collection_status (advisory, never-blocking)', () => {
    const notRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'task-governance-exit-'));
    try {
      const result = captureStdout(() => runInternal([
        'task-governance-signals', '--source', 'git-diff', '--target-repo', notRepo, '--json',
      ]));
      const output = JSON.parse(result.stdout);
      expect(result.code).toBe(0);
      expect(output.collection_status).toBe('unavailable');
      expect(output.reason_codes).toContain('not-a-repo');
    } finally {
      fs.rmSync(notRepo, { recursive: true, force: true });
    }
  });

  test('rejects --base-ref starting with "-" and --input with --source git-diff', () => {
    const injected = captureStdout(() => runInternal([
      'task-governance-signals', '--source', 'git-diff', '--target-repo', os.tmpdir(),
      '--base-ref', '-x', '--json',
    ]));
    expect(injected.code).toBe(2);
    expect(JSON.parse(injected.stdout).reason_code).toBe('invalid-arguments');

    const mutual = captureStdout(() => runInternal([
      'task-governance-signals', '--source', 'git-diff', '--target-repo', os.tmpdir(),
      '--input', 'x.json', '--json',
    ]));
    expect(mutual.code).toBe(2);
    expect(JSON.parse(mutual.stdout).errors).toEqual(
      expect.arrayContaining(['--input is not used with --source git-diff']),
    );
  });

  test('reports a clear error when a value flag is missing its value', () => {
    const result = captureStdout(() => runInternal([
      'task-governance-signals', '--source', '--json',
    ]));
    expect(result.code).toBe(2);
    expect(JSON.parse(result.stdout).errors).toEqual(
      expect.arrayContaining(['--source requires a value']),
    );
  });
});

function writeJson(value) {
  const filePath = path.join(os.tmpdir(), `task-governance-${Date.now()}-${Math.random()}.json`);
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
  return filePath;
}
