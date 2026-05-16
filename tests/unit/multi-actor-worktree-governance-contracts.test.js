'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const BOOTSTRAP_SH = path.join(
  REPO_ROOT,
  'skills',
  'spec-graph-bootstrap',
  'scripts',
  'bootstrap-providers.sh',
);
const BOOTSTRAP_PS1 = path.join(
  REPO_ROOT,
  'skills',
  'spec-graph-bootstrap',
  'scripts',
  'bootstrap-providers.ps1',
);
const VERIFY_SH = path.join(
  REPO_ROOT,
  'skills',
  'spec-mcp-setup',
  'scripts',
  'verify-tools.sh',
);
const VERIFY_PS1 = path.join(
  REPO_ROOT,
  'skills',
  'spec-mcp-setup',
  'scripts',
  'verify-tools.ps1',
);
const GRAPH_BOOTSTRAP_SKILL = path.join(
  REPO_ROOT,
  'skills',
  'spec-graph-bootstrap',
  'SKILL.md',
);
const MCP_SETUP_SKILL = path.join(
  REPO_ROOT,
  'skills',
  'spec-mcp-setup',
  'SKILL.md',
);
const PLAN_PATH = path.join(
  REPO_ROOT,
  'docs',
  'plans',
  '2026-05-14-002-feat-multi-actor-worktree-governance-plan.md',
);

const readFile = (p) => fs.readFileSync(p, 'utf8');

describe('U1: bootstrap-providers concurrent-write fingerprint', () => {
  const bashSource = readFile(BOOTSTRAP_SH);
  const ps1Source = readFile(BOOTSTRAP_PS1);
  const skill = readFile(GRAPH_BOOTSTRAP_SKILL);

  test('bash samples worktree status hash before the critical write window', () => {
    expect(bashSource).toContain('WORKTREE_STATUS_HASH="$(printf');
    expect(bashSource).toContain('EXTERNAL_ACTOR_FINGERPRINT_BEFORE=');
    expect(bashSource).toContain('external_actor_fingerprint');
  });

  test('bash samples worktree status hash after the critical write window', () => {
    expect(bashSource).toContain('EXTERNAL_ACTOR_FINGERPRINT_AFTER=');
    expect(bashSource).toMatch(
      /EXTERNAL_ACTOR_FINGERPRINT_AFTER" != "\$EXTERNAL_ACTOR_FINGERPRINT_BEFORE/,
    );
  });

  test('external_actor_fingerprint excludes bootstrap-owned paths', () => {
    expect(bashSource).toMatch(/\.spec-first\//);
    expect(bashSource).toMatch(/AGENTS\\\.md/);
    expect(bashSource).toMatch(/CLAUDE\\\.md/);
  });

  test('bash sets concurrent-write-detected reason_code and disables canonical preservation on mismatch', () => {
    expect(bashSource).toContain('concurrent-write-detected');
    const segment = bashSource.slice(
      bashSource.indexOf('EXTERNAL_ACTOR_FINGERPRINT_AFTER" != "$EXTERNAL_ACTOR_FINGERPRINT_BEFORE'),
    );
    const window = segment.slice(0, 600);
    expect(window).toContain('reason_code="concurrent-write-detected"');
    expect(window).toContain('WORKFLOW_MODE="blocked"');
    expect(window).toContain('PRESERVE_CANONICAL_FRESHNESS=false');
    expect(window).toContain('EXIT_CODE=1');
  });

  test('powershell samples external-actor fingerprint after the critical write window', () => {
    expect(ps1Source).toContain('Get-ExternalActorFingerprint');
    expect(ps1Source).toContain('$externalActorFingerprintBefore');
    expect(ps1Source).toContain('$externalActorFingerprintAfter');
    expect(ps1Source).toMatch(
      /\$externalActorFingerprintAfter -ne \$externalActorFingerprintBefore/,
    );
  });

  test('powershell sets concurrent-write-detected and disables canonical preservation on mismatch', () => {
    const segment = ps1Source.slice(
      ps1Source.indexOf('$externalActorFingerprintAfter -ne $externalActorFingerprintBefore'),
    );
    const window = segment.slice(0, 700);
    expect(window).toContain("concurrent-write-detected");
    expect(window).toContain("$workflowMode = 'blocked'");
    expect(window).toContain('$preserveCanonicalFreshness = $false');
    expect(window).toContain('$exitCode = 1');
  });

  test('SKILL.md documents concurrent-write-detected reason_code with bootstrap-owned filter', () => {
    expect(skill).toContain('concurrent-write-detected');
    expect(skill).toContain('canonical_artifacts_preserved=false');
    expect(skill).toContain('git status --porcelain');
    expect(skill).toMatch(/excludes paths bootstrap itself writes/);
  });
});

describe('U2: spec-mcp-setup host pointer self-heal', () => {
  const verifySh = readFile(VERIFY_SH);
  const verifyPs1 = readFile(VERIFY_PS1);
  const bashBootstrap = readFile(BOOTSTRAP_SH);
  const ps1Bootstrap = readFile(BOOTSTRAP_PS1);
  const setupSkill = readFile(MCP_SETUP_SKILL);
  const graphBootstrapSkill = readFile(GRAPH_BOOTSTRAP_SKILL);

  test('verify-tools.sh reads previous host_ledger_pointer and emits reconciliation advisory', () => {
    expect(verifySh).toContain('compute_host_pointer_reconciliation');
    expect(verifySh).toContain('host-pointer-reconciliation.v1');
    expect(verifySh).toContain('runtime-capabilities.json');
    expect(verifySh).toMatch(
      /previous_host[\s\S]*?\$current_host[\s\S]*?host marker drift/,
    );
  });

  test('verify-tools.sh injects host_pointer_reconciliation into ledger', () => {
    expect(verifySh).toContain(
      "--argjson host_pointer_reconciliation \"$HOST_POINTER_RECONCILIATION\"",
    );
    expect(verifySh).toContain(
      'host_pointer_reconciliation: $host_pointer_reconciliation',
    );
  });

  test('verify-tools.ps1 reads previous host_ledger_pointer and emits reconciliation advisory', () => {
    expect(verifyPs1).toContain('Get-HostPointerReconciliation');
    expect(verifyPs1).toContain('host-pointer-reconciliation.v1');
    expect(verifyPs1).toContain('runtime-capabilities.json');
    expect(verifyPs1).toContain('host_pointer_reconciliation = $HostPointerReconciliation');
  });

  test('reconciliation event includes from_host, to_host, marker paths, and reconciled_at', () => {
    for (const source of [verifySh, verifyPs1]) {
      expect(source).toMatch(/from_host/);
      expect(source).toMatch(/to_host/);
      expect(source).toMatch(/from_marker_path/);
      expect(source).toMatch(/to_marker_path/);
      expect(source).toMatch(/reconciled_at/);
    }
  });

  test('bootstrap-providers.sh no longer fail-closes on runtime/ledger baseline disagreement', () => {
    expect(bashBootstrap).not.toMatch(
      /Rerun spec-mcp-setup; runtime capabilities and host ledger disagree\./,
    );
    expect(bashBootstrap).not.toContain('RUNTIME_BASELINE');
    expect(bashBootstrap).toContain('Host pointer drift');
  });

  test('bootstrap-providers.ps1 no longer fail-closes on runtime/ledger baseline disagreement', () => {
    expect(ps1Bootstrap).not.toMatch(
      /Rerun spec-mcp-setup; runtime capabilities and host ledger disagree\./,
    );
    expect(ps1Bootstrap).not.toMatch(
      /\$runtimeCapabilities\.baseline_summary\.baseline_ready -ne \$ledger\.baseline_ready/,
    );
    expect(ps1Bootstrap).toContain('Host pointer drift');
  });

  test('spec-mcp-setup SKILL.md documents host_pointer_reconciliation advisory event', () => {
    expect(setupSkill).toContain('host_pointer_reconciliation');
    expect(setupSkill).toMatch(/from_host[\s\S]*?to_host/);
  });

  test('spec-graph-bootstrap SKILL.md notes host pointer drift is reconciled by setup', () => {
    expect(graphBootstrapSkill).toContain('host_pointer_reconciliation');
    expect(graphBootstrapSkill).toMatch(
      /Host pointer drift[\s\S]*?spec-mcp-setup/,
    );
  });
});

describe('plan documents U1 + U2 implementation requirements', () => {
  const plan = readFile(PLAN_PATH);

  test('plan declares concurrent-write-detected reason_code requirement', () => {
    expect(plan).toContain('concurrent-write-detected');
  });

  test('plan declares host pointer reconciliation requirement', () => {
    expect(plan).toContain('host_pointer_reconciliation');
    expect(plan).toMatch(/host-pointer-reconciled|host_pointer_reconciliation/);
  });
});
