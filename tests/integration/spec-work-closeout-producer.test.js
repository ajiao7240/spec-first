'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { runInternal } = require('../../src/cli/commands/internal');
const { validateAgainstSchema } = require('../../src/contracts/schema-validator');

const REPO_ROOT = path.join(__dirname, '..', '..');
const FIXTURE_DIR = path.join(REPO_ROOT, 'tests', 'fixtures', 'spec-work-closeout', 'trigger-task-pack');
const SCHEMA_PATH = path.join(REPO_ROOT, 'docs', 'contracts', 'workflows', 'spec-work-run-artifact.schema.json');

function makeRepo() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-work-closeout-producer-'));
  execFileSync('git', ['init', '-q'], { cwd: repo });
  execFileSync('git', ['config', 'user.name', 'Spec First Test'], { cwd: repo });
  execFileSync('git', ['config', 'user.email', 'spec-first-test@example.invalid'], { cwd: repo });
  execFileSync('git', ['config', 'core.hooksPath', '/dev/null'], { cwd: repo });
  return repo;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
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

describe('spec-work closeout producer integration', () => {
  test('trigger-task-pack closeout payload writes workflow-integrated run evidence', () => {
    const repo = makeRepo();
    try {
      const inputPath = path.join(FIXTURE_DIR, 'payload.json');
      const expected = readJson(path.join(FIXTURE_DIR, 'expected.json'));
      const schema = readJson(SCHEMA_PATH);

      const { code, stdout } = captureStdout(() => runInternal([
        'spec-work-run-artifact',
        'write',
        '--input',
        inputPath,
        '--run-id',
        'trigger-task-pack',
        '--target-repo',
        repo,
      ]));
      const output = JSON.parse(stdout);

      expect(code).toBe(0);
      expect(output).toEqual(expect.objectContaining({
        status: expected.status,
        schema_version: expected.schema_version,
        producer_available: true,
        workflow_integrated: true,
      }));
      expect(output.artifact_path).toMatch(/^\.spec-first\/workflows\/spec-work\/spec-work-closeout-producer-[a-z0-9]+\/trigger-task-pack\/run\.json$/);

      const artifact = readJson(path.join(repo, output.artifact_path));
      expect(artifact.producer).toEqual(expected.producer);
      expect(artifact.plan_path).toBe(expected.plan_path);
      expect(artifact.task_pack_path).toBe(expected.task_pack_path);
      expect(validateAgainstSchema(schema, artifact).errors).toEqual([]);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });
});
