'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { validateAgainstSchema } = require('../../src/bootstrap-compiler/schema-loader');

const REPO_ROOT = path.join(__dirname, '..', '..');
const POLICY_SCHEMA_PATH = path.join(
  REPO_ROOT,
  'src',
  'cli',
  'contracts',
  'quality-gates',
  'branch-protection-policy.schema.json'
);
const POLICY_PATH = path.join(
  REPO_ROOT,
  'src',
  'cli',
  'contracts',
  'quality-gates',
  'branch-protection-policy.json'
);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('branch protection policy contracts', () => {
  test('policy stays machine-readable and advisory-only', () => {
    const schema = readJson(POLICY_SCHEMA_PATH);
    const policy = readJson(POLICY_PATH);

    expect(validateAgainstSchema(schema, policy).errors).toEqual([]);
    expect(policy).toMatchObject({
      schemaVersion: 1,
      provider: 'github',
      mode: 'advisory',
      protected_branches: [
        expect.objectContaining({
          pattern: 'main',
        }),
      ],
    });
    expect(policy.non_goals).toEqual(expect.arrayContaining([
      'does_not_modify_github_branch_settings',
      'does_not_infer_workflow_state',
    ]));
  });

  test('policy-required checks stay aligned with actual GitHub workflows', () => {
    const policy = readJson(POLICY_PATH);
    const requiredChecks = policy.protected_branches[0].required_checks;

    for (const check of requiredChecks) {
      const workflow = readText(path.join(REPO_ROOT, check.workflow_path));

      expect(workflow).toContain(`name: ${check.workflow_name}`);
      expect(workflow).toContain(`${check.job_name}:`);
      expect(workflow).toContain(check.command);

      for (const coveredPath of check.covers_paths) {
        if (!coveredPath.startsWith('.github/workflows/')) {
          expect(workflow).toContain(coveredPath);
        }
      }
    }
  });
});
