'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

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

  test('external_actor_fingerprint keeps a narrow provider/runtime regex', () => {
    const match = bashSource.match(/EXTERNAL_ACTOR_FINGERPRINT_IGNORE_REGEX='([^']+)'/);
    expect(match).not.toBeNull();
    expect(match[1]).toContain('\\.spec-first/');
    expect(match[1]).toContain('\\.gitnexus/');
    expect(match[1]).toContain('\\.code-review-graph/');
    expect(match[1]).not.toContain('AGENTS');
    expect(match[1]).not.toContain('CLAUDE');
    expect(match[1]).not.toContain('CHANGELOG');
    expect(match[1]).not.toContain('\\.gitignore');
  });

  test('host instruction fingerprint exclusions are conditional, not regex-wide', () => {
    const fingerprintFunction = extractBashFunction(bashSource, 'external_actor_fingerprint');
    expect(bashSource).toContain('AGENTS.md|CLAUDE.md)');
    expect(fingerprintFunction).toContain('host_instruction_path_was_bootstrap_written');
    expect(bashSource).toContain('bootstrap_owned_host_instruction_hash_mismatch');
    expect(fingerprintFunction).not.toContain('managed_block_file_is_setup_owned');
    expect(ps1Source).toContain('Test-BootstrapOwnedHostInstructionPath -FileName $statusPath');
    expect(ps1Source).toContain('Test-BootstrapOwnedHostInstructionHashMismatch');
    expect(ps1Source).not.toContain(
      'Test-ManagedBlockFileSetupOwned -Path $statusPath -StatusHint',
    );
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

function extractBashFunction(source, funcName) {
  const start = source.indexOf(`${funcName}() {`);
  if (start === -1) {
    throw new Error(`bash function ${funcName} not found`);
  }
  const tail = source.slice(start);
  const end = tail.search(/^\}\s*$/m);
  if (end === -1) {
    throw new Error(`bash function ${funcName} closing brace not found`);
  }
  const closingLineEnd = tail.indexOf('\n', end);
  return tail.slice(0, closingLineEnd === -1 ? end + 1 : closingLineEnd);
}

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function runBash(script, env = {}) {
  return spawnSync('bash', ['-c', script], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

function gitInit(repoRoot) {
  const setup = [
    `git init --quiet "${repoRoot}"`,
    `git -C "${repoRoot}" config user.email test@example.com`,
    `git -C "${repoRoot}" config user.name "Test User"`,
    `git -C "${repoRoot}" config commit.gpgsign false`,
  ].join(' && ');
  const r = spawnSync('bash', ['-c', setup], { encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error(`git init failed: ${r.stderr}`);
  }
}

describe('U1 + U2 fixture-based semantic verification', () => {
  const bashBootstrap = readFile(BOOTSTRAP_SH);
  const bashVerify = readFile(VERIFY_SH);
  const hostInstructionChangeBody = extractBashFunction(
    bashBootstrap,
    'host_instruction_change_is_bootstrap_owned',
  );
  const fingerprintBody = extractBashFunction(bashBootstrap, 'external_actor_fingerprint');
  const reconciliationBody = extractBashFunction(bashVerify, 'compute_host_pointer_reconciliation');

  const tmpDirs = [];
  afterAll(() => {
    for (const dir of tmpDirs) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  });

  function newTmp(prefix) {
    const d = makeTempDir(prefix);
    tmpDirs.push(d);
    return d;
  }

  function fingerprintHash(repoRoot, options = {}) {
    const expectedAgentsHash = options.expectedAgentsHash || '';
    const expectedClaudeHash = options.expectedClaudeHash || '';
    const driver = `
set -euo pipefail
REPO_ROOT="${repoRoot}"
EXTERNAL_ACTOR_FINGERPRINT_IGNORE_REGEX='^(\\.spec-first/|\\.gitnexus/|\\.code-review-graph/)'
HOST_INSTRUCTION_EXPECTED_AGENTS_HASH="${expectedAgentsHash}"
HOST_INSTRUCTION_EXPECTED_CLAUDE_HASH="${expectedClaudeHash}"
hash_file() { shasum -a 256 "$1" 2>/dev/null | awk '{print $1}'; }
${hostInstructionChangeBody}
${fingerprintBody}
hash_text() { shasum -a 256 - 2>/dev/null | awk '{print $1}'; }
external_actor_fingerprint | hash_text
`;
    const r = runBash(driver);
    if (r.status !== 0) {
      throw new Error(`fingerprint driver failed: ${r.stderr}`);
    }
    return r.stdout.trim();
  }

  test('external_actor_fingerprint: provider/runtime path edits do NOT change fingerprint', () => {
    const repo = newTmp('eaf-owned-');
    gitInit(repo);
    fs.writeFileSync(path.join(repo, 'src.txt'), 'baseline');
    spawnSync('bash', ['-c', `git -C "${repo}" add -A && git -C "${repo}" commit --quiet -m baseline`]);

    fs.writeFileSync(path.join(repo, 'src.txt'), 'changed');
    const baseline = fingerprintHash(repo);

    fs.mkdirSync(path.join(repo, '.spec-first'), { recursive: true });
    fs.writeFileSync(path.join(repo, '.spec-first', 'foo.json'), '{}');
    fs.mkdirSync(path.join(repo, '.gitnexus'), { recursive: true });
    fs.writeFileSync(path.join(repo, '.gitnexus', 'a.json'), '{}');
    fs.mkdirSync(path.join(repo, '.code-review-graph'), { recursive: true });
    fs.writeFileSync(path.join(repo, '.code-review-graph', 'b.json'), '{}');

    const afterBootstrapWrites = fingerprintHash(repo);
    expect(afterBootstrapWrites).toBe(baseline);
  });

  test('external_actor_fingerprint: tracked host managed-block edits DO change fingerprint', () => {
    const repo = newTmp('eaf-host-managed-');
    gitInit(repo);
    const agentsPath = path.join(repo, 'AGENTS.md');
    fs.writeFileSync(
      agentsPath,
      [
        '# Instructions',
        '',
        '<!-- spec-first:bootstrap:start -->',
        'old bootstrap block',
        '<!-- spec-first:bootstrap:end -->',
        '',
        'manual text',
        '',
      ].join('\n'),
    );
    spawnSync('bash', ['-c', `git -C "${repo}" add -A && git -C "${repo}" commit --quiet -m baseline`]);

    const before = fingerprintHash(repo);
    fs.writeFileSync(
      agentsPath,
      [
        '# Instructions',
        '',
        '<!-- spec-first:bootstrap:start -->',
        'new bootstrap block',
        '<!-- spec-first:bootstrap:end -->',
        '',
        'manual text',
        '',
      ].join('\n'),
    );
    const after = fingerprintHash(repo);

    expect(after).not.toBe(before);
  });

  test('external_actor_fingerprint: edits to non-bootstrap paths DO change fingerprint', () => {
    const repo = newTmp('eaf-external-');
    gitInit(repo);
    fs.writeFileSync(path.join(repo, 'src.txt'), 'baseline');
    spawnSync('bash', ['-c', `git -C "${repo}" add -A && git -C "${repo}" commit --quiet -m baseline`]);

    fs.writeFileSync(path.join(repo, 'src.txt'), 'changed');
    const before = fingerprintHash(repo);

    fs.writeFileSync(path.join(repo, 'docs.md'), 'new doc');
    const after = fingerprintHash(repo);

    expect(after).not.toBe(before);
  });

  function runReconciliation(currentHost, repoRoot, markerPath, env = {}) {
    const driver = `
set -euo pipefail
${reconciliationBody}
compute_host_pointer_reconciliation "${currentHost}" "${repoRoot}" "${markerPath}"
`;
    return runBash(driver, env);
  }

  test('compute_host_pointer_reconciliation: missing runtime-capabilities returns null', () => {
    const repo = newTmp('hpr-missing-');
    const r = runReconciliation('claude-code', repo, '/tmp/marker.json');
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('null');
  });

  test('compute_host_pointer_reconciliation: same host returns null', () => {
    const repo = newTmp('hpr-same-');
    fs.mkdirSync(path.join(repo, '.spec-first', 'config'), { recursive: true });
    fs.writeFileSync(
      path.join(repo, '.spec-first', 'config', 'runtime-capabilities.json'),
      JSON.stringify({ host_ledger_pointer: { host: 'claude-code', path: '/old/marker.json' } }),
    );
    const r = runReconciliation('claude-code', repo, '/new/marker.json');
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('null');
  });

  test('compute_host_pointer_reconciliation: different host returns event with from/to/marker fields', () => {
    const repo = newTmp('hpr-drift-');
    fs.mkdirSync(path.join(repo, '.spec-first', 'config'), { recursive: true });
    fs.writeFileSync(
      path.join(repo, '.spec-first', 'config', 'runtime-capabilities.json'),
      JSON.stringify({ host_ledger_pointer: { host: 'codex', path: '/codex/marker.json' } }),
    );
    const r = runReconciliation('claude-code', repo, '/claude/marker.json');
    expect(r.status).toBe(0);
    const event = JSON.parse(r.stdout);
    expect(event.schema_version).toBe('host-pointer-reconciliation.v1');
    expect(event.from_host).toBe('codex');
    expect(event.to_host).toBe('claude-code');
    expect(event.from_marker_path).toBe('/codex/marker.json');
    expect(event.to_marker_path).toBe('/claude/marker.json');
    expect(typeof event.reconciled_at).toBe('string');
    expect(event.reconciled_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    expect(event.reason).toMatch(/host marker drift/);
  });

  test('compute_host_pointer_reconciliation: corrupt JSON returns null and writes stderr advisory', () => {
    const repo = newTmp('hpr-corrupt-');
    fs.mkdirSync(path.join(repo, '.spec-first', 'config'), { recursive: true });
    fs.writeFileSync(
      path.join(repo, '.spec-first', 'config', 'runtime-capabilities.json'),
      'not-json-at-all{',
    );
    const r = runReconciliation('claude-code', repo, '/claude/marker.json');
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('null');
    expect(r.stderr).toMatch(/runtime-capabilities\.json/);
    expect(r.stderr).toMatch(/unreadable|host pointer reconciliation skipped/);
  });

  test('compute_host_pointer_reconciliation: empty current host returns null', () => {
    const repo = newTmp('hpr-empty-');
    fs.mkdirSync(path.join(repo, '.spec-first', 'config'), { recursive: true });
    fs.writeFileSync(
      path.join(repo, '.spec-first', 'config', 'runtime-capabilities.json'),
      JSON.stringify({ host_ledger_pointer: { host: 'codex', path: '/x' } }),
    );
    const r = runReconciliation('', repo, '/y');
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('null');
  });

  test('verify-tools.sh resolves repo_root from selected repo/folder target facts', () => {
    expect(bashVerify).toMatch(
      /RECONCILIATION_REPO_ROOT="\$\(jq -r '\.selected_repo_root \/\/ \.selected_folder_root \/\/ \.target\.target_root \/\/ \.repo_root \/\/ empty' <<<"\$FACTS_JSON"\)"/,
    );
    expect(bashVerify).toMatch(
      /HOST_POINTER_RECONCILIATION="\$\(compute_host_pointer_reconciliation "\$RECONCILIATION_HOST" "\$RECONCILIATION_REPO_ROOT" "\$MARKER_PATH"\)"/,
    );
  });

  test('verify-tools.ps1 resolves repo_root from selected repo/folder target facts', () => {
    const verifyPs1 = readFile(VERIFY_PS1);
    expect(verifyPs1).toContain('$reconciliationRepoRoot = if (-not [string]::IsNullOrWhiteSpace([string]$Facts.selected_repo_root))');
    expect(verifyPs1).toContain("[string]$Facts.selected_repo_root");
    expect(verifyPs1).toContain("$Facts.PSObject.Properties['target'] -and -not [string]::IsNullOrWhiteSpace([string]$Facts.target.selected_folder_root)");
    expect(verifyPs1).toContain("[string]$Facts.target.selected_folder_root");
    expect(verifyPs1).toContain("$Facts.PSObject.Properties['target'] -and -not [string]::IsNullOrWhiteSpace([string]$Facts.target.target_root)");
    expect(verifyPs1).toContain("[string]$Facts.target.target_root");
    expect(verifyPs1).toContain("[string]$Facts.repo_root");
    expect(verifyPs1).toContain(
      'Get-HostPointerReconciliation -CurrentHost $reconciliationHost -RepoRoot $reconciliationRepoRoot -MarkerPathArg $MarkerPath',
    );
  });

  test('verify-tools.ps1 surfaces stderr advisory on corrupt runtime-capabilities.json', () => {
    const verifyPs1 = readFile(VERIFY_PS1);
    expect(verifyPs1).toMatch(
      /\[Console\]::Error\.WriteLine\("verify-tools\.ps1: runtime-capabilities\.json at \$runtimePath is unreadable/,
    );
  });
});
