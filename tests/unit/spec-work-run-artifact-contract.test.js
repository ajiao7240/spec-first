'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { validateAgainstSchema } = require('../../src/contracts/schema-validator');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SCHEMA_PATH = path.join(
  REPO_ROOT,
  'docs',
  'contracts',
  'workflows',
  'spec-work-run-artifact.schema.json'
);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

describe('spec-work run artifact contract', () => {
  test('schema validates a complete machine-truth run artifact sample', () => {
    const schema = readJson(SCHEMA_PATH);
    const artifact = {
      schema_version: 'v1',
      generated_at: '2026-04-19T15:45:00.000Z',
      workflow: 'spec-work',
      run_id: '20260419-154500-ab12cd34',
      mode: 'interactive',
      plan_path: 'docs/plans/2026-04-19-005-feat-sdd-riper-light-contract-integration-plan.md',
      plan_source: 'explicit',
      workspace_slug: 'spec-first',
      git_branch: 'feat/sdd-riper-light-contracts-u1-u3',
      head_sha: 'abc123def456',
      current_core_goal: '落地 spec-work run artifact contract 并为 review 提供稳定 handoff',
      changes_made: [
        {
          summary: '为 spec-work 增加 run artifact contract 与 schema anchor',
          files: ['skills/spec-work/SKILL.md', 'docs/contracts/workflows/spec-work-run-artifact.schema.json'],
        },
      ],
      plan_deviations: [
        {
          summary: '为保持 stable/beta 一致性，先只让 review 消费 stable spec-work artifact',
          disposition: 'accepted-deviation',
        },
      ],
      verification: {
        status: 'partial',
        summary: '定向 unit tests 已通过，等待更广 smoke/integration',
        evidence_items: [
          {
            label: 'spec-work artifact contract tests',
            status: 'passed',
            artifact_path: '.spec-first/workflows/verification/spec-work-artifact-tests.txt',
          },
        ],
      },
      residual_risks: [
        {
          summary: 'runtime 尚未真正写出 run.json，本轮只固定 contract 与 consumer handoff',
          severity: 'P2',
        },
      ],
      resume_anchor: {
        summary: '下一步扩运行时写入或进一步扩 consumer',
        next_focus: '决定是否进入 CLI/runtime implementation',
        open_questions: ['spec-work-beta 是否在 Unit 3 单独纳入 artifact path'],
      },
      next_recommended_action: '进入 spec-code-review 收口并决定是否继续实现 runtime 写入',
    };

    expect(validateAgainstSchema(schema, artifact).errors).toEqual([]);
  });
});
