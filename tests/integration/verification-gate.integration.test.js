'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const PACKAGE_PATH = path.join(REPO_ROOT, 'package.json');
const AI_GATE_WORKFLOW_PATH = path.join(REPO_ROOT, '.github', 'workflows', 'ai-dev-quality-gate.yml');
const CRG_GATE_WORKFLOW_PATH = path.join(REPO_ROOT, '.github', 'workflows', 'crg-quality-gate.yml');
const BRANCH_POLICY_PATH = path.join(REPO_ROOT, 'src', 'cli', 'contracts', 'quality-gates', 'branch-protection-policy.json');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('AI dev quality gate integration', () => {
  test('package scripts expose a dedicated AI dev gate and run its workflow contract in integration', () => {
    const pkg = JSON.parse(read(PACKAGE_PATH));

    expect(pkg.scripts['test:ai-dev:gate']).toBe('node scripts/run-ai-dev-quality-gate.js');

    expect(pkg.scripts['test:integration']).toContain('tests/integration/verification-gate.integration.test.js');
  });

  test('AI dev quality gate workflow triggers on Stage-0 verification contract surfaces, calls dedicated script, and uploads result artifact', () => {
    const workflow = read(AI_GATE_WORKFLOW_PATH);

    expect(workflow).toContain('name: AI Dev Quality Gate');
    expect(workflow).toContain("src/cli/contracts/quality-gates/**");
    expect(workflow).toContain("src/bootstrap-compiler/**");
    expect(workflow).toContain("src/context-routing/**");
    expect(workflow).toContain("src/cli/commands/stage0-context.js");
    expect(workflow).toContain("docs/contracts/spec-graph-bootstrap/**");
    expect(workflow).toContain("docs/contracts/verifiers/**");
    expect(workflow).toContain("docs/contracts/quality-gates/**");
    expect(workflow).toContain("skills/spec-plan/**");
    expect(workflow).toContain("skills/spec-work/**");
    expect(workflow).toContain("skills/spec-work-beta/**");
    expect(workflow).toContain("skills/spec-code-review/**");
    expect(workflow).toContain(".github/workflows/ai-dev-quality-gate.yml");
    expect(workflow).toContain("tests/unit/branch-protection-policy.test.js");
    expect(workflow).toContain("tests/unit/quality-feedback.test.js");
    expect(workflow).toContain("docs/10-prompt/skills/spec-plan/**");
    expect(workflow).toContain("docs/10-prompt/skills/spec-work/**");
    expect(workflow).toContain("docs/10-prompt/skills/spec-work-beta/**");
    expect(workflow).toContain("docs/10-prompt/skills/spec-code-review/**");
    expect(workflow).toContain("tests/integration/verification-gate.integration.test.js");
    expect(workflow).toContain('npm run test:ai-dev:gate');
    expect(workflow).toContain('actions/upload-artifact@v4');
    expect(workflow).toContain('.spec-first/workflows/quality-gates/ai-dev-quality-gate/');
  });

  test('branch protection policy keeps required checks aligned with the remaining AI dev quality gate workflow', () => {
    const policy = JSON.parse(read(BRANCH_POLICY_PATH));
    const requiredChecks = policy.protected_branches[0].required_checks;

    expect(requiredChecks).toEqual([
      expect.objectContaining({
        workflow_name: 'AI Dev Quality Gate',
        workflow_path: '.github/workflows/ai-dev-quality-gate.yml',
        job_name: 'ai-dev-gate',
        command: 'npm run test:ai-dev:gate',
      }),
    ]);
  });
});
