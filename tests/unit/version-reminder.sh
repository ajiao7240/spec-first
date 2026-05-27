#!/bin/bash
# version reminder unit tests
# Tests version comparison, reminder formatting, helper behavior, and CLI wiring

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

pass=0
fail=0

assert() {
  local desc="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    pass=$((pass + 1))
  else
    echo "  ✗ $desc"
    fail=$((fail + 1))
  fi
}

assert_output() {
  local desc="$1"
  local expected="$2"
  local actual="$3"
  if [ "$expected" = "$actual" ]; then
    pass=$((pass + 1))
  else
    echo "  ✗ $desc: expected '$expected', got '$actual'"
    fail=$((fail + 1))
  fi
}

assert_contains() {
  local desc="$1"
  local needle="$2"
  local haystack="$3"
  if printf '%s' "$haystack" | grep -qF -- "$needle"; then
    pass=$((pass + 1))
  else
    echo "  ✗ $desc: '$needle' not found in output"
    fail=$((fail + 1))
  fi
}

assert_not_contains() {
  local desc="$1"
  local needle="$2"
  local haystack="$3"
  if ! printf '%s' "$haystack" | grep -qF -- "$needle"; then
    pass=$((pass + 1))
  else
    echo "  ✗ $desc: '$needle' should not be in output"
    fail=$((fail + 1))
  fi
}

echo "=== version reminder unit tests ==="
echo ""

echo "1. version comparison"
comparison_output="$(
  node - "$REPO_ROOT" <<'EOF'
const path = require('node:path');
const repoRoot = process.argv[2];
const {
  shouldNotifyVersionReminder,
} = require(path.join(repoRoot, 'src/cli/version-reminder'));

process.stdout.write(JSON.stringify({
  equal: shouldNotifyVersionReminder('1.4.0', '1.4.0'),
  older: shouldNotifyVersionReminder('1.4.0', '1.4.1'),
  prerelease: shouldNotifyVersionReminder('1.4.0-beta.1', '1.4.0'),
  invalid: shouldNotifyVersionReminder('invalid', '1.4.0'),
}));
EOF
)"
comparison_equal=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(String(data.equal));" "$comparison_output")
comparison_older=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(String(data.older));" "$comparison_output")
comparison_prerelease=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(String(data.prerelease));" "$comparison_output")
comparison_invalid=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(String(data.invalid));" "$comparison_output")
assert_output "equal versions do not notify" "false" "$comparison_equal"
assert_output "older version notifies" "true" "$comparison_older"
assert_output "prerelease notifies for release" "true" "$comparison_prerelease"
assert_output "invalid version is ignored" "false" "$comparison_invalid"

echo "2. reminder formatting"
formatted_output="$(
  node - "$REPO_ROOT" <<'EOF'
const path = require('node:path');
const repoRoot = process.argv[2];
const { formatVersionReminder } = require(path.join(repoRoot, 'src/cli/version-reminder'));

process.stdout.write(formatVersionReminder({
  packageName: 'spec-first',
  currentVersion: '1.4.0',
  latestVersion: '1.4.1',
}));
EOF
)"
assert_contains "formatted reminder names package" "spec-first" "$formatted_output"
assert_contains "formatted reminder includes current version" "1.4.0" "$formatted_output"
assert_contains "formatted reminder includes latest version" "1.4.1" "$formatted_output"
assert_contains "formatted reminder includes upgrade hint" "npm install -g spec-first@latest" "$formatted_output"

echo "3. maybeShowVersionReminder"
notify_output="$(
  node - "$REPO_ROOT" <<'EOF'
const path = require('node:path');
const repoRoot = process.argv[2];
const { maybeShowVersionReminder } = require(path.join(repoRoot, 'src/cli/version-reminder'));

(async () => {
  let captured = '';
  const printed = await maybeShowVersionReminder({
    packageName: 'spec-first',
    currentVersion: '1.4.0',
    lookupLatestVersion: async () => '1.4.1',
    output: {
      write(chunk) {
        captured += chunk;
      },
    },
  });

  process.stdout.write(JSON.stringify({ printed, captured }));
})();
EOF
)"
notify_printed=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(String(data.printed));" "$notify_output")
notify_captured=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.captured);" "$notify_output")
assert_output "outdated version prints a reminder" "true" "$notify_printed"
assert_contains "outdated reminder has update text" "Update available for spec-first" "$notify_captured"
assert_contains "outdated reminder has upgrade hint" "npm install -g spec-first@latest" "$notify_captured"

skip_output="$(
  node - "$REPO_ROOT" <<'EOF'
const path = require('node:path');
const repoRoot = process.argv[2];
const { maybeShowVersionReminder } = require(path.join(repoRoot, 'src/cli/version-reminder'));

(async () => {
  let captured = '';
  const printed = await maybeShowVersionReminder({
    packageName: 'spec-first',
    currentVersion: '1.4.0',
    lookupLatestVersion: async () => '1.4.0',
    output: {
      write(chunk) {
        captured += chunk;
      },
    },
  });

  process.stdout.write(JSON.stringify({ printed, captured }));
})();
EOF
)"
skip_printed=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(String(data.printed));" "$skip_output")
skip_captured=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.captured);" "$skip_output")
assert_output "current version does not print a reminder" "false" "$skip_printed"
assert_output "current version prints no output" "" "$skip_captured"

echo "4. startup reminder"
startup_output="$(
  node - "$REPO_ROOT" "$TMP_DIR" <<'EOF'
const fs = require('node:fs');
const path = require('node:path');
const repoRoot = process.argv[2];
const tmpDir = process.argv[3];
const { maybeShowStartupVersionReminder } = require(path.join(repoRoot, 'src/cli/version-reminder'));

(async () => {
  const projectRoot = path.join(tmpDir, 'startup-codex');
  fs.mkdirSync(path.join(projectRoot, '.codex', 'spec-first'), { recursive: true });
  fs.writeFileSync(
    path.join(projectRoot, '.codex', 'spec-first', 'state.json'),
    `${JSON.stringify({ manifestVersion: '1.6.1' })}\n`,
    'utf8',
  );

  let captured = '';
  const printed = await maybeShowStartupVersionReminder({
    host: 'codex',
    projectRoot,
    homeRoot: path.join(tmpDir, 'home-codex'),
    lookupLatestVersion: async () => '1.6.2',
    output: {
      write(chunk) {
        captured += chunk;
        return true;
      },
    },
  });

  process.stdout.write(JSON.stringify({ printed, captured }));
})();
EOF
)"
startup_printed=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(String(data.printed));" "$startup_output")
startup_captured=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.captured);" "$startup_output")
assert_output "codex startup reminder prints when runtime is stale" "true" "$startup_printed"
assert_contains "codex startup reminder includes current version" "1.6.1" "$startup_captured"
assert_contains "codex startup reminder includes latest version" "1.6.2" "$startup_captured"
assert_contains "codex startup reminder points to update workflow" '$spec-update' "$startup_captured"
assert_contains "codex startup reminder states read-only boundary" "will not install, refresh runtime assets, or restart the host" "$startup_captured"
assert_not_contains "codex startup reminder does not install directly" "npm install -g" "$startup_captured"
assert_not_contains "codex startup reminder does not call plugin update" "claude plugin update" "$startup_captured"
assert_not_contains "codex startup reminder does not refresh runtime directly" "spec-first init" "$startup_captured"

claude_startup_output="$(
  node - "$REPO_ROOT" "$TMP_DIR" <<'EOF'
const fs = require('node:fs');
const path = require('node:path');
const repoRoot = process.argv[2];
const tmpDir = process.argv[3];
const { maybeShowStartupVersionReminder } = require(path.join(repoRoot, 'src/cli/version-reminder'));

(async () => {
  const projectRoot = path.join(tmpDir, 'startup-claude');
  fs.mkdirSync(path.join(projectRoot, '.claude', 'spec-first'), { recursive: true });
  fs.writeFileSync(
    path.join(projectRoot, '.claude', 'spec-first', 'state.json'),
    `${JSON.stringify({ manifestVersion: '1.6.1' })}\n`,
    'utf8',
  );

  let captured = '';
  const printed = await maybeShowStartupVersionReminder({
    host: 'claude',
    projectRoot,
    homeRoot: path.join(tmpDir, 'home-claude'),
    lookupLatestVersion: async () => '1.6.2',
    output: {
      write(chunk) {
        captured += chunk;
        return true;
      },
    },
  });

  process.stdout.write(JSON.stringify({ printed, captured }));
})();
EOF
)"
claude_startup_printed=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(String(data.printed));" "$claude_startup_output")
claude_startup_captured=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.captured);" "$claude_startup_output")
assert_output "claude startup reminder prints when runtime is stale" "true" "$claude_startup_printed"
assert_contains "claude startup reminder points to update workflow" "/spec:update" "$claude_startup_captured"
assert_contains "claude startup reminder states read-only boundary" "will not install, refresh runtime assets, or restart the host" "$claude_startup_captured"
assert_not_contains "claude startup reminder does not install directly" "npm install -g" "$claude_startup_captured"
assert_not_contains "claude startup reminder does not call plugin update" "claude plugin update" "$claude_startup_captured"
assert_not_contains "claude startup reminder does not refresh runtime directly" "spec-first init" "$claude_startup_captured"

unknown_output="$(
  node - "$REPO_ROOT" "$TMP_DIR" <<'EOF'
const fs = require('node:fs');
const path = require('node:path');
const repoRoot = process.argv[2];
const tmpDir = process.argv[3];
const { maybeShowStartupVersionReminder } = require(path.join(repoRoot, 'src/cli/version-reminder'));

(async () => {
  const projectRoot = path.join(tmpDir, 'startup-unknown');
  fs.mkdirSync(path.join(projectRoot, '.codex', 'spec-first'), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, '.agents', 'skills', 'spec-update'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, '.codex', 'spec-first', 'state.json'), '{"manifestVersion":', 'utf8');

  let captured = '';
  const printed = await maybeShowStartupVersionReminder({
    host: 'codex',
    projectRoot,
    homeRoot: path.join(tmpDir, 'home-unknown'),
    lookupLatestVersion: async () => '1.6.2',
    output: {
      write(chunk) {
        captured += chunk;
        return true;
      },
    },
  });

  process.stdout.write(JSON.stringify({ printed, captured }));
})();
EOF
)"
unknown_printed=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(String(data.printed));" "$unknown_output")
unknown_captured=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.captured);" "$unknown_output")
assert_output "malformed runtime state still prints unknown-version reminder" "true" "$unknown_printed"
assert_contains "unknown-version reminder names unknown runtime" "runtime version is unknown" "$unknown_captured"
assert_contains "unknown-version reminder points to update workflow" '$spec-update' "$unknown_captured"

cooldown_output="$(
  node - "$REPO_ROOT" "$TMP_DIR" <<'EOF'
const fs = require('node:fs');
const path = require('node:path');
const repoRoot = process.argv[2];
const tmpDir = process.argv[3];
const {
  clearStartupVersionReminderCooldown,
  maybeShowStartupVersionReminder,
} = require(path.join(repoRoot, 'src/cli/version-reminder'));

function writeState(projectRoot) {
  fs.mkdirSync(path.join(projectRoot, '.codex', 'spec-first'), { recursive: true });
  fs.writeFileSync(
    path.join(projectRoot, '.codex', 'spec-first', 'state.json'),
    `${JSON.stringify({ manifestVersion: '1.6.1' })}\n`,
    'utf8',
  );
}

(async () => {
  const firstProject = path.join(tmpDir, 'cooldown-a');
  const secondProject = path.join(tmpDir, 'cooldown-b');
  const homeRoot = path.join(tmpDir, 'home-cooldown');
  writeState(firstProject);
  writeState(secondProject);

  let first = '';
  const firstPrinted = await maybeShowStartupVersionReminder({
    host: 'codex',
    projectRoot: firstProject,
    homeRoot,
    lookupLatestVersion: async () => '1.6.2',
    output: { write(chunk) { first += chunk; return true; } },
  });

  let second = '';
  const secondPrinted = await maybeShowStartupVersionReminder({
    host: 'codex',
    projectRoot: secondProject,
    homeRoot,
    lookupLatestVersion: async () => '1.6.2',
    output: { write(chunk) { second += chunk; return true; } },
  });

  let newer = '';
  const newerPrinted = await maybeShowStartupVersionReminder({
    host: 'codex',
    projectRoot: secondProject,
    homeRoot,
    lookupLatestVersion: async () => '1.6.3',
    output: { write(chunk) { newer += chunk; return true; } },
  });

  clearStartupVersionReminderCooldown({ host: 'codex', homeRoot });

  let third = '';
  const thirdPrinted = await maybeShowStartupVersionReminder({
    host: 'codex',
    projectRoot: secondProject,
    homeRoot,
    lookupLatestVersion: async () => '1.6.2',
    output: { write(chunk) { third += chunk; return true; } },
  });

  process.stdout.write(JSON.stringify({
    firstPrinted,
    secondPrinted,
    newerPrinted,
    thirdPrinted,
    first,
    second,
    newer,
    third,
  }));
})();
EOF
)"
cooldown_first=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(String(data.firstPrinted));" "$cooldown_output")
cooldown_second=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(String(data.secondPrinted));" "$cooldown_output")
cooldown_newer=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(String(data.newerPrinted));" "$cooldown_output")
cooldown_third=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(String(data.thirdPrinted));" "$cooldown_output")
assert_output "first host/version startup reminder prints" "true" "$cooldown_first"
assert_output "same host/version startup reminder is suppressed across projects" "false" "$cooldown_second"
assert_output "newer latest version bypasses existing cooldown" "true" "$cooldown_newer"
assert_output "reset clears startup reminder cooldown" "true" "$cooldown_third"

future_cooldown_output="$(
  node - "$REPO_ROOT" "$TMP_DIR" <<'EOF'
const fs = require('node:fs');
const path = require('node:path');
const repoRoot = process.argv[2];
const tmpDir = process.argv[3];
const { maybeShowStartupVersionReminder } = require(path.join(repoRoot, 'src/cli/version-reminder'));

(async () => {
  const projectRoot = path.join(tmpDir, 'future-cooldown');
  const homeRoot = path.join(tmpDir, 'home-future-cooldown');
  fs.mkdirSync(path.join(projectRoot, '.codex', 'spec-first'), { recursive: true });
  fs.writeFileSync(
    path.join(projectRoot, '.codex', 'spec-first', 'state.json'),
    `${JSON.stringify({ manifestVersion: '1.6.1' })}\n`,
    'utf8',
  );
  fs.mkdirSync(path.join(homeRoot, '.codex', 'spec-first'), { recursive: true });
  fs.writeFileSync(
    path.join(homeRoot, '.codex', 'spec-first', 'startup-version-reminder.json'),
    `${JSON.stringify({
      reminders: {
        'codex|1.6.1|1.6.2': {
          host: 'codex',
          currentVersion: '1.6.1',
          latestVersion: '1.6.2',
          shownAt: '2999-01-01T00:00:00.000Z',
        },
      },
    })}\n`,
    'utf8',
  );

  let captured = '';
  const printed = await maybeShowStartupVersionReminder({
    host: 'codex',
    projectRoot,
    homeRoot,
    nowMs: Date.parse('2026-04-30T00:00:00.000Z'),
    lookupLatestVersion: async () => '1.6.2',
    output: { write(chunk) { captured += chunk; return true; } },
  });
  process.stdout.write(JSON.stringify({ printed, captured }));
})();
EOF
)"
future_cooldown_printed=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(String(data.printed));" "$future_cooldown_output")
future_cooldown_captured=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.captured);" "$future_cooldown_output")
assert_output "future-dated cooldown does not suppress stale reminder" "true" "$future_cooldown_printed"
assert_contains "future-dated cooldown reminder still names update workflow" '$spec-update' "$future_cooldown_captured"

generic_host_dirs_output="$(
  node - "$REPO_ROOT" "$TMP_DIR" <<'EOF'
const fs = require('node:fs');
const path = require('node:path');
const repoRoot = process.argv[2];
const tmpDir = process.argv[3];
const { maybeShowStartupVersionReminder } = require(path.join(repoRoot, 'src/cli/version-reminder'));

(async () => {
  const codexOnly = path.join(tmpDir, 'generic-codex-only');
  const claudeOnly = path.join(tmpDir, 'generic-claude-only');
  const agentsOnly = path.join(tmpDir, 'generic-agents-only');
  fs.mkdirSync(path.join(codexOnly, '.codex'), { recursive: true });
  fs.mkdirSync(path.join(claudeOnly, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(claudeOnly, '.claude', 'settings.json'), '{}\n', 'utf8');
  fs.mkdirSync(path.join(agentsOnly, '.agents', 'skills', 'custom-tool'), { recursive: true });
  fs.writeFileSync(path.join(agentsOnly, '.agents', 'skills', 'custom-tool', 'SKILL.md'), 'name: custom-tool\n', 'utf8');

  const results = [];
  for (const [host, projectRoot] of [
    ['codex', codexOnly],
    ['claude', claudeOnly],
    ['codex', agentsOnly],
  ]) {
    let captured = '';
    const printed = await maybeShowStartupVersionReminder({
      host,
      projectRoot,
      homeRoot: path.join(tmpDir, `home-${host}-${results.length}`),
      lookupLatestVersion: async () => '1.6.2',
      output: { write(chunk) { captured += chunk; return true; } },
    });
    results.push({ host, printed, captured });
  }

  process.stdout.write(JSON.stringify(results));
})();
EOF
)"
generic_host_dirs_printed=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.map((entry) => String(entry.printed)).join(','));" "$generic_host_dirs_output")
generic_host_dirs_output_text=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.map((entry) => entry.captured).join('\\n'));" "$generic_host_dirs_output")
assert_output "generic host directories do not count as spec-first runtime" "false,false,false" "$generic_host_dirs_printed"
assert_output "generic host directories produce no startup reminder" "" "$generic_host_dirs_output_text"

startup_equal_output="$(
  node - "$REPO_ROOT" "$TMP_DIR" <<'EOF'
const fs = require('node:fs');
const path = require('node:path');
const repoRoot = process.argv[2];
const tmpDir = process.argv[3];
const { maybeShowStartupVersionReminder } = require(path.join(repoRoot, 'src/cli/version-reminder'));

(async () => {
  const projectRoot = path.join(tmpDir, 'startup-equal');
  fs.mkdirSync(path.join(projectRoot, '.codex', 'spec-first'), { recursive: true });
  fs.writeFileSync(
    path.join(projectRoot, '.codex', 'spec-first', 'state.json'),
    `${JSON.stringify({ manifestVersion: '1.6.1' })}\n`,
    'utf8',
  );
  let captured = '';
  const printed = await maybeShowStartupVersionReminder({
    host: 'codex',
    projectRoot,
    homeRoot: path.join(tmpDir, 'home-equal'),
    lookupLatestVersion: async () => '1.6.1',
    output: { write(chunk) { captured += chunk; return true; } },
  });
  process.stdout.write(JSON.stringify({ printed, captured }));
})();
EOF
)"
startup_equal_printed=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(String(data.printed));" "$startup_equal_output")
startup_equal_captured=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.captured);" "$startup_equal_output")
assert_output "current runtime startup reminder does not print" "false" "$startup_equal_printed"
assert_output "current runtime startup reminder produces no output" "" "$startup_equal_captured"

graph_snapshot_output="$(
  node - "$REPO_ROOT" "$TMP_DIR" <<'EOF'
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const repoRoot = process.argv[2];
const tmpDir = process.argv[3];
const {
  buildStartupGraphReadinessSnapshot,
} = require(path.join(repoRoot, 'src/cli/version-reminder'));

function runGit(projectRoot, args) {
  return execFileSync('git', ['-C', projectRoot, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
}

function writeJson(projectRoot, relativePath, value) {
  const filePath = path.join(projectRoot, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeRuntime(projectRoot) {
  writeJson(projectRoot, '.codex/spec-first/state.json', { manifestVersion: '1.6.1' });
}

function writeGraphArtifacts(projectRoot, revision) {
  const cleanHash = `sha256:${crypto.createHash('sha256').update('').digest('hex')}`;
  writeJson(projectRoot, '.spec-first/graph/provider-status.json', {
    schema_version: 'graph-provider-status.v1',
    ready_primary_providers: ['gitnexus'],
    providers: [
      {
        provider: 'gitnexus',
        query_ready: true,
        limitations: ['definitions_only_no_process_graph'],
      },
    ],
  });
  writeJson(projectRoot, '.spec-first/graph/graph-facts.json', {
    schema_version: 'graph-facts.v1',
    source_revision: revision,
    worktree_dirty: false,
    worktree_status_hash: cleanHash,
    provider_summary: {
      ready_primary_providers: ['gitnexus'],
    },
    capabilities: {
      query_global_graph: true,
      impact_context_limitations: [
        'definitions_only_no_impact_evidence',
      ],
    },
  });
  writeJson(projectRoot, '.spec-first/impact/bootstrap-impact-capabilities.json', {
    schema_version: 'bootstrap-impact-capabilities.v1',
    capabilities: {
      context_selection: { support_level: 'full' },
      impact_radius: {
        support_level: 'none',
        limitations: ['definitions_only_no_impact_evidence'],
      },
      review_support: {
        support_level: 'none',
        limitations: ['definitions_only_no_related_tests'],
      },
    },
  });
}

const projectRoot = path.join(tmpDir, 'graph-snapshot');
fs.mkdirSync(projectRoot, { recursive: true });
runGit(projectRoot, ['init']);
runGit(projectRoot, ['config', 'user.email', 'tests@example.invalid']);
runGit(projectRoot, ['config', 'user.name', 'Tests']);
runGit(projectRoot, ['config', 'commit.gpgsign', 'false']);
fs.writeFileSync(path.join(projectRoot, '.gitignore'), [
  '.codex/',
  '.claude/',
  '.agents/',
  '.spec-first/',
  '',
].join('\n'), 'utf8');
fs.writeFileSync(path.join(projectRoot, 'src.js'), 'module.exports = 1;\n', 'utf8');
runGit(projectRoot, ['add', '.gitignore', 'src.js']);
runGit(projectRoot, ['commit', '--no-verify', '-m', 'initial']);
const revision = runGit(projectRoot, ['rev-parse', '--verify', 'HEAD^{commit}']).trim();
writeRuntime(projectRoot);
writeGraphArtifacts(projectRoot, revision);

const fresh = buildStartupGraphReadinessSnapshot({ host: 'codex', projectRoot });
fs.writeFileSync(path.join(projectRoot, 'src.js'), 'module.exports = 2;\n', 'utf8');
const stale = buildStartupGraphReadinessSnapshot({ host: 'codex', projectRoot });

const unavailableRoot = path.join(tmpDir, 'graph-snapshot-unavailable');
writeRuntime(unavailableRoot);
const unavailable = buildStartupGraphReadinessSnapshot({
  host: 'codex',
  projectRoot: unavailableRoot,
});

// R15c: query_ready=false fixture (canonical present but provider not ready)
const queryUnavailableRoot = path.join(tmpDir, 'graph-snapshot-query-unavailable');
fs.mkdirSync(queryUnavailableRoot, { recursive: true });
runGit(queryUnavailableRoot, ['init']);
runGit(queryUnavailableRoot, ['config', 'user.email', 'tests@example.invalid']);
runGit(queryUnavailableRoot, ['config', 'user.name', 'Tests']);
runGit(queryUnavailableRoot, ['config', 'commit.gpgsign', 'false']);
fs.writeFileSync(path.join(queryUnavailableRoot, '.gitignore'), '.codex/\n.spec-first/\n', 'utf8');
fs.writeFileSync(path.join(queryUnavailableRoot, 'src.js'), 'module.exports = 1;\n', 'utf8');
runGit(queryUnavailableRoot, ['add', '.gitignore', 'src.js']);
runGit(queryUnavailableRoot, ['commit', '--no-verify', '-m', 'initial']);
const queryUnavailableRevision = runGit(queryUnavailableRoot, ['rev-parse', '--verify', 'HEAD^{commit}']).trim();
writeRuntime(queryUnavailableRoot);
writeJson(queryUnavailableRoot, '.spec-first/graph/provider-status.json', {
  schema_version: 'graph-provider-status.v1',
  ready_primary_providers: [],
  providers: [{ provider: 'gitnexus', query_ready: false, limitations: ['provider_query_unavailable'] }],
});
writeJson(queryUnavailableRoot, '.spec-first/graph/graph-facts.json', {
  schema_version: 'graph-facts.v1',
  source_revision: queryUnavailableRevision,
  worktree_dirty: false,
  worktree_status_hash: `sha256:${crypto.createHash('sha256').update('').digest('hex')}`,
  provider_summary: { ready_primary_providers: [] },
  capabilities: { query_global_graph: false },
});
writeJson(queryUnavailableRoot, '.spec-first/impact/bootstrap-impact-capabilities.json', {
  schema_version: 'bootstrap-impact-capabilities.v1',
  capabilities: {
    context_selection: { support_level: 'none' },
    impact_radius: { support_level: 'none' },
    review_support: { support_level: 'none' },
  },
});
const queryUnavailable = buildStartupGraphReadinessSnapshot({
  host: 'codex',
  projectRoot: queryUnavailableRoot,
});

// R15c: partial impact fixture (process-results-ish capability matrix)
const partialImpactRoot = path.join(tmpDir, 'graph-snapshot-partial-impact');
fs.mkdirSync(partialImpactRoot, { recursive: true });
runGit(partialImpactRoot, ['init']);
runGit(partialImpactRoot, ['config', 'user.email', 'tests@example.invalid']);
runGit(partialImpactRoot, ['config', 'user.name', 'Tests']);
runGit(partialImpactRoot, ['config', 'commit.gpgsign', 'false']);
fs.writeFileSync(path.join(partialImpactRoot, '.gitignore'), '.codex/\n.spec-first/\n', 'utf8');
fs.writeFileSync(path.join(partialImpactRoot, 'src.js'), 'module.exports = 1;\n', 'utf8');
runGit(partialImpactRoot, ['add', '.gitignore', 'src.js']);
runGit(partialImpactRoot, ['commit', '--no-verify', '-m', 'initial']);
const partialRevision = runGit(partialImpactRoot, ['rev-parse', '--verify', 'HEAD^{commit}']).trim();
writeRuntime(partialImpactRoot);
writeJson(partialImpactRoot, '.spec-first/graph/provider-status.json', {
  schema_version: 'graph-provider-status.v1',
  ready_primary_providers: ['gitnexus'],
  providers: [{ provider: 'gitnexus', query_ready: true, limitations: [] }],
});
writeJson(partialImpactRoot, '.spec-first/graph/graph-facts.json', {
  schema_version: 'graph-facts.v1',
  source_revision: partialRevision,
  worktree_dirty: false,
  worktree_status_hash: `sha256:${crypto.createHash('sha256').update('').digest('hex')}`,
  provider_summary: { ready_primary_providers: ['gitnexus'] },
  capabilities: { query_global_graph: true },
});
writeJson(partialImpactRoot, '.spec-first/impact/bootstrap-impact-capabilities.json', {
  schema_version: 'bootstrap-impact-capabilities.v1',
  capabilities: {
    context_selection: { support_level: 'full' },
    impact_radius: { support_level: 'partial' },
    review_support: { support_level: 'partial' },
  },
});
const partialImpact = buildStartupGraphReadinessSnapshot({
  host: 'codex',
  projectRoot: partialImpactRoot,
});

process.stdout.write(JSON.stringify({
  fresh: fresh ? fresh.message : '',
  stale: stale ? stale.message : '',
  unavailable: unavailable ? unavailable.message : '',
  queryUnavailable: queryUnavailable ? queryUnavailable.message : '',
  partialImpact: partialImpact ? partialImpact.message : '',
}));
EOF
)"
graph_snapshot_fresh=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.fresh);" "$graph_snapshot_output")
graph_snapshot_stale=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.stale);" "$graph_snapshot_output")
graph_snapshot_unavailable=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.unavailable);" "$graph_snapshot_output")
graph_snapshot_query_unavailable=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.queryUnavailable);" "$graph_snapshot_output")
graph_snapshot_partial_impact=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.partialImpact);" "$graph_snapshot_output")
assert_contains "graph snapshot reports query readiness" "query_ready=true" "$graph_snapshot_fresh"
assert_contains "graph snapshot reports fresh readiness" "freshness=fresh" "$graph_snapshot_fresh"
assert_contains "graph snapshot reports capabilities" "query/context=full, impact=none, review=none" "$graph_snapshot_fresh"
assert_contains "graph snapshot reports stale readiness" "freshness=stale" "$graph_snapshot_stale"
assert_contains "graph snapshot reports dirty worktree" "dirty=dirty" "$graph_snapshot_stale"
assert_contains "graph snapshot reports snapshot mismatch limitation" "snapshot_mismatch" "$graph_snapshot_stale"
assert_contains "graph snapshot reports missing artifacts" "freshness=unavailable" "$graph_snapshot_unavailable"
assert_contains "graph snapshot reports unavailable query" "query_ready=false" "$graph_snapshot_unavailable"
# R15c: query unavailable (canonical present but query_ready=false) keeps capabilities collapsed.
assert_contains "graph snapshot reports unavailable query when canonical present" "query_ready=false" "$graph_snapshot_query_unavailable"
assert_contains "graph snapshot collapses capabilities when query unavailable" "query/context=none, impact=none, review=none" "$graph_snapshot_query_unavailable"
# R15c: partial impact mirrors capabilities matrix.
assert_contains "graph snapshot surfaces partial impact capability" "impact=partial" "$graph_snapshot_partial_impact"
assert_contains "graph snapshot surfaces partial review capability" "review=partial" "$graph_snapshot_partial_impact"

startup_cli_output="$(
  node - "$REPO_ROOT" "$TMP_DIR" <<'EOF'
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const repoRoot = process.argv[2];
const tmpDir = process.argv[3];

(async () => {
  const projectRoot = path.join(tmpDir, 'startup-cli');
  const homeRoot = path.join(tmpDir, 'home-cli');
  fs.mkdirSync(path.join(projectRoot, '.codex', 'spec-first'), { recursive: true });
  fs.writeFileSync(
    path.join(projectRoot, '.codex', 'spec-first', 'state.json'),
    `${JSON.stringify({ manifestVersion: '1.6.1' })}\n`,
    'utf8',
  );

  let stdout = '';
  let stderr = '';
  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  const originalStderrWrite = process.stderr.write.bind(process.stderr);
  const originalCwd = process.cwd();
  const originalLatest = process.env.SPEC_FIRST_VERSION_REMINDER_LATEST;
  const originalUserInfo = os.userInfo;
  const originalHomedir = os.homedir;
  process.stdout.write = (chunk) => {
    stdout += chunk;
    return true;
  };
  process.stderr.write = (chunk) => {
    stderr += chunk;
    return true;
  };
  process.env.SPEC_FIRST_VERSION_REMINDER_LATEST = '1.6.2';
  os.userInfo = () => ({ homedir: homeRoot });
  os.homedir = () => homeRoot;
  const { runCli } = require(path.join(repoRoot, 'src/cli'));
  process.chdir(projectRoot);

  const exitCode = await runCli(['startup-reminder', '--codex']);
  const statePath = path.join(homeRoot, '.codex', 'spec-first', 'startup-version-reminder.json');
  const state = fs.existsSync(statePath) ? fs.readFileSync(statePath, 'utf8') : '';

  process.chdir(originalCwd);
  if (originalLatest === undefined) {
    delete process.env.SPEC_FIRST_VERSION_REMINDER_LATEST;
  } else {
    process.env.SPEC_FIRST_VERSION_REMINDER_LATEST = originalLatest;
  }
  os.userInfo = originalUserInfo;
  os.homedir = originalHomedir;
  process.stdout.write = originalStdoutWrite;
  process.stderr.write = originalStderrWrite;
  process.stdout.write(JSON.stringify({ exitCode, stdout, stderr, state }));
})();
EOF
)"
startup_cli_exit=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(String(data.exitCode));" "$startup_cli_output")
startup_cli_stdout=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.stdout);" "$startup_cli_output")
startup_cli_stderr=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.stderr);" "$startup_cli_output")
startup_cli_state=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.state);" "$startup_cli_output")
assert_output "hidden startup reminder exits successfully" "0" "$startup_cli_exit"
assert_contains "hidden startup reminder writes stdout" '$spec-update' "$startup_cli_stdout"
assert_output "hidden startup reminder writes no stderr" "" "$startup_cli_stderr"
assert_contains "hidden startup reminder writes cooldown under HOME" '"codex|1.6.1|1.6.2"' "$startup_cli_state"
assert_not_contains "hidden startup reminder state does not persist project root" "startup-cli" "$startup_cli_state"

startup_cli_graph_only_output="$(
  node - "$REPO_ROOT" "$TMP_DIR" <<'EOF'
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const repoRoot = process.argv[2];
const tmpDir = process.argv[3];

function runGit(projectRoot, args) {
  return execFileSync('git', ['-C', projectRoot, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
}

function writeJson(projectRoot, relativePath, value) {
  const filePath = path.join(projectRoot, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

(async () => {
  const projectRoot = path.join(tmpDir, 'startup-cli-graph-only');
  const homeRoot = path.join(tmpDir, 'home-cli-graph-only');
  fs.mkdirSync(projectRoot, { recursive: true });
  runGit(projectRoot, ['init']);
  runGit(projectRoot, ['config', 'user.email', 'tests@example.invalid']);
  runGit(projectRoot, ['config', 'user.name', 'Tests']);
  runGit(projectRoot, ['config', 'commit.gpgsign', 'false']);
  fs.writeFileSync(path.join(projectRoot, '.gitignore'), '.codex/\n.spec-first/\n', 'utf8');
  fs.writeFileSync(path.join(projectRoot, 'src.js'), 'module.exports = 1;\n', 'utf8');
  runGit(projectRoot, ['add', '.gitignore', 'src.js']);
  runGit(projectRoot, ['commit', '--no-verify', '-m', 'initial']);
  const revision = runGit(projectRoot, ['rev-parse', '--verify', 'HEAD^{commit}']).trim();
  const cleanHash = `sha256:${crypto.createHash('sha256').update('').digest('hex')}`;
  writeJson(projectRoot, '.codex/spec-first/state.json', { manifestVersion: '1.6.1' });
  writeJson(projectRoot, '.spec-first/graph/provider-status.json', {
    ready_primary_providers: ['gitnexus'],
    providers: [{ provider: 'gitnexus', query_ready: true }],
  });
  writeJson(projectRoot, '.spec-first/graph/graph-facts.json', {
    source_revision: revision,
    worktree_dirty: false,
    worktree_status_hash: cleanHash,
    provider_summary: { ready_primary_providers: ['gitnexus'] },
    capabilities: { query_global_graph: true },
  });
  writeJson(projectRoot, '.spec-first/impact/bootstrap-impact-capabilities.json', {
    capabilities: {
      context_selection: { support_level: 'full' },
      impact_radius: { support_level: 'none' },
      review_support: { support_level: 'none' },
    },
  });

  let stdout = '';
  let stderr = '';
  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  const originalStderrWrite = process.stderr.write.bind(process.stderr);
  const originalCwd = process.cwd();
  const originalLatest = process.env.SPEC_FIRST_VERSION_REMINDER_LATEST;
  const originalUserInfo = os.userInfo;
  const originalHomedir = os.homedir;
  process.stdout.write = (chunk) => { stdout += chunk; return true; };
  process.stderr.write = (chunk) => { stderr += chunk; return true; };
  process.env.SPEC_FIRST_VERSION_REMINDER_LATEST = '1.6.1';
  os.userInfo = () => ({ homedir: homeRoot });
  os.homedir = () => homeRoot;
  const { runCli } = require(path.join(repoRoot, 'src/cli'));
  process.chdir(projectRoot);

  const exitCode = await runCli(['startup-reminder', '--codex']);

  process.chdir(originalCwd);
  if (originalLatest === undefined) delete process.env.SPEC_FIRST_VERSION_REMINDER_LATEST;
  else process.env.SPEC_FIRST_VERSION_REMINDER_LATEST = originalLatest;
  os.userInfo = originalUserInfo;
  os.homedir = originalHomedir;
  process.stdout.write = originalStdoutWrite;
  process.stderr.write = originalStderrWrite;
  process.stdout.write(JSON.stringify({ exitCode, stdout, stderr }));
})();
EOF
)"
startup_cli_graph_only_exit=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(String(data.exitCode));" "$startup_cli_graph_only_output")
startup_cli_graph_only_stdout=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.stdout);" "$startup_cli_graph_only_output")
startup_cli_graph_only_stderr=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.stderr);" "$startup_cli_graph_only_output")
assert_output "startup reminder graph-only exits successfully" "0" "$startup_cli_graph_only_exit"
assert_contains "startup reminder graph-only prints graph snapshot" "GitNexus graph: query_ready=true" "$startup_cli_graph_only_stdout"
assert_contains "startup reminder graph-only prints fresh status" "freshness=fresh" "$startup_cli_graph_only_stdout"
assert_not_contains "startup reminder graph-only does not print update workflow" '$spec-update' "$startup_cli_graph_only_stdout"
assert_output "startup reminder graph-only writes no stderr" "" "$startup_cli_graph_only_stderr"

startup_cli_reset_output="$(
  node - "$REPO_ROOT" "$TMP_DIR" <<'EOF'
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const repoRoot = process.argv[2];
const tmpDir = process.argv[3];

function writeRuntime(projectRoot, host) {
  fs.mkdirSync(path.join(projectRoot, `.${host}`, 'spec-first'), { recursive: true });
  fs.writeFileSync(
    path.join(projectRoot, `.${host}`, 'spec-first', 'state.json'),
    `${JSON.stringify({ manifestVersion: '1.6.1' })}\n`,
    'utf8',
  );
}

(async () => {
  const projectRoot = path.join(tmpDir, 'startup-cli-reset');
  const homeRoot = path.join(tmpDir, 'home-cli-reset');
  writeRuntime(projectRoot, 'codex');
  writeRuntime(projectRoot, 'claude');

  let stdout = '';
  let stderr = '';
  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  const originalStderrWrite = process.stderr.write.bind(process.stderr);
  const originalCwd = process.cwd();
  const originalLatest = process.env.SPEC_FIRST_VERSION_REMINDER_LATEST;
  const originalUserInfo = os.userInfo;
  const originalHomedir = os.homedir;
  process.stdout.write = (chunk) => { stdout += chunk; return true; };
  process.stderr.write = (chunk) => { stderr += chunk; return true; };
  process.env.SPEC_FIRST_VERSION_REMINDER_LATEST = '1.6.2';
  os.userInfo = () => ({ homedir: homeRoot });
  os.homedir = () => homeRoot;
  const { runCli } = require(path.join(repoRoot, 'src/cli'));
  process.chdir(projectRoot);

  const firstCodex = await runCli(['startup-reminder', '--codex']);
  const suppressedCodex = await runCli(['startup-reminder', '--codex']);
  const resetCodex = await runCli(['startup-reminder', '--codex', '--reset']);
  const afterResetCodex = await runCli(['startup-reminder', '--codex']);
  const firstClaude = await runCli(['startup-reminder', '--claude']);
  const resetClaude = await runCli(['startup-reminder', '--claude', '--reset']);
  const afterResetClaude = await runCli(['startup-reminder', '--claude']);

  process.chdir(originalCwd);
  if (originalLatest === undefined) delete process.env.SPEC_FIRST_VERSION_REMINDER_LATEST;
  else process.env.SPEC_FIRST_VERSION_REMINDER_LATEST = originalLatest;
  os.userInfo = originalUserInfo;
  os.homedir = originalHomedir;
  process.stdout.write = originalStdoutWrite;
  process.stderr.write = originalStderrWrite;
  process.stdout.write(JSON.stringify({
    firstCodex,
    suppressedCodex,
    resetCodex,
    afterResetCodex,
    firstClaude,
    resetClaude,
    afterResetClaude,
    stdout,
    stderr,
  }));
})();
EOF
)"
startup_cli_reset_codes=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write([data.firstCodex,data.suppressedCodex,data.resetCodex,data.afterResetCodex,data.firstClaude,data.resetClaude,data.afterResetClaude].join(','));" "$startup_cli_reset_output")
startup_cli_reset_stdout=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.stdout);" "$startup_cli_reset_output")
startup_cli_reset_stderr=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.stderr);" "$startup_cli_reset_output")
assert_output "hidden startup reminder reset commands exit successfully" "0,0,0,0,0,0,0" "$startup_cli_reset_codes"
assert_contains "codex reset allows reminder to print again" '$spec-update' "$startup_cli_reset_stdout"
assert_contains "claude reset allows reminder to print again" "/spec:update" "$startup_cli_reset_stdout"
assert_output "hidden startup reminder reset writes no stderr" "" "$startup_cli_reset_stderr"

startup_cli_invalid_output="$(
  node - "$REPO_ROOT" <<'EOF'
const path = require('node:path');
const repoRoot = process.argv[2];
const { runCli } = require(path.join(repoRoot, 'src/cli'));

(async () => {
  let stderr = '';
  const originalStderrWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = (chunk) => { stderr += chunk; return true; };
  const missing = await runCli(['startup-reminder']);
  const bogus = await runCli(['startup-reminder', '--bogus']);
  const invalidHost = await runCli(['startup-reminder', '--host=bad']);
  const conflict = await runCli(['startup-reminder', '--claude', '--codex']);
  process.stderr.write = originalStderrWrite;
  process.stdout.write(JSON.stringify({ missing, bogus, invalidHost, conflict, stderr }));
})();
EOF
)"
startup_cli_invalid_codes=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write([data.missing,data.bogus,data.invalidHost,data.conflict].join(','));" "$startup_cli_invalid_output")
startup_cli_invalid_stderr=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.stderr);" "$startup_cli_invalid_output")
assert_output "invalid startup reminder flags return usage errors" "2,2,2,2" "$startup_cli_invalid_codes"
assert_contains "invalid startup reminder flags write terse stderr" "startup-reminder:" "$startup_cli_invalid_stderr"

echo "5. runCli wiring"
help_output="$(
  SPEC_FIRST_VERSION_REMINDER_LATEST="9.9.9" node - "$REPO_ROOT" <<'EOF'
const path = require('node:path');
const repoRoot = process.argv[2];
const { runCli } = require(path.join(repoRoot, 'src/cli'));

(async () => {
  let stdout = '';
  let stderr = '';
  const originalLog = console.log;
  const originalStderrWrite = process.stderr.write.bind(process.stderr);
  console.log = (...args) => {
    stdout += `${args.join(' ')}\n`;
  };
  process.stderr.write = (chunk) => {
    stderr += chunk;
    return true;
  };

  const exitCode = await runCli(['--help']);

  console.log = originalLog;
  process.stderr.write = originalStderrWrite;
  process.stdout.write(JSON.stringify({ exitCode, stdout, stderr }));
})();
EOF
)"
help_exit=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(String(data.exitCode));" "$help_output")
help_stderr=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.stderr);" "$help_output")
assert_output "help exits successfully" "0" "$help_exit"
assert_output "help does not print reminder" "" "$help_stderr"

version_output="$(
  SPEC_FIRST_VERSION_REMINDER_LATEST="9.9.9" node - "$REPO_ROOT" <<'EOF'
const path = require('node:path');
const repoRoot = process.argv[2];
const { runCli } = require(path.join(repoRoot, 'src/cli'));

(async () => {
  let stdout = '';
  let stderr = '';
  const originalLog = console.log;
  const originalStderrWrite = process.stderr.write.bind(process.stderr);
  console.log = (...args) => {
    stdout += `${args.join(' ')}\n`;
  };
  process.stderr.write = (chunk) => {
    stderr += chunk;
    return true;
  };

  const exitCode = await runCli(['--version']);

  console.log = originalLog;
  process.stderr.write = originalStderrWrite;
  process.stdout.write(JSON.stringify({ exitCode, stdout, stderr }));
})();
EOF
)"
version_exit=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(String(data.exitCode));" "$version_output")
version_stderr=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.stderr);" "$version_output")
assert_output "version exits successfully" "0" "$version_exit"
assert_output "version does not print reminder" "" "$version_stderr"

project_dir="$TMP_DIR/project"
mkdir -p "$project_dir"

doctor_output="$(
  cd "$project_dir"
  SPEC_FIRST_VERSION_REMINDER_LATEST="9.9.9" node - "$REPO_ROOT" <<'EOF'
const path = require('node:path');
const repoRoot = process.argv[2];
const { runCli } = require(path.join(repoRoot, 'src/cli'));

(async () => {
  let stdout = '';
  let stderr = '';
  const originalLog = console.log;
  const originalStderrWrite = process.stderr.write.bind(process.stderr);
  console.log = (...args) => {
    stdout += `${args.join(' ')}\n`;
  };
  process.stderr.write = (chunk) => {
    stderr += chunk;
    return true;
  };

  const exitCode = await runCli(['doctor']);

  console.log = originalLog;
  process.stderr.write = originalStderrWrite;
  process.stdout.write(JSON.stringify({ exitCode, stdout, stderr }));
})();
EOF
)"
doctor_exit=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(String(data.exitCode));" "$doctor_output")
doctor_stdout=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.stdout);" "$doctor_output")
doctor_stderr=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.stderr);" "$doctor_output")
assert_output "doctor exits successfully" "0" "$doctor_exit"
assert_contains "doctor still reports missing platform" "No spec-first platform detected in this project." "$doctor_stdout"
assert_contains "doctor prints reminder" "Update available for spec-first" "$doctor_stderr"

init_output="$(
  cd "$project_dir"
  SPEC_FIRST_VERSION_REMINDER_LATEST="9.9.9" node - "$REPO_ROOT" <<'EOF'
const path = require('node:path');
const repoRoot = process.argv[2];
const { runCli } = require(path.join(repoRoot, 'src/cli'));

(async () => {
  let stdout = '';
  let stderr = '';
  const originalLog = console.log;
  const originalStderrWrite = process.stderr.write.bind(process.stderr);
  console.log = (...args) => {
    stdout += `${args.join(' ')}\n`;
  };
  process.stderr.write = (chunk) => {
    stderr += chunk;
    return true;
  };

  const exitCode = await runCli(['init', '--dry-run']);

  console.log = originalLog;
  process.stderr.write = originalStderrWrite;
  process.stdout.write(JSON.stringify({ exitCode, stdout, stderr }));
})();
EOF
)"
init_exit=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(String(data.exitCode));" "$init_output")
init_stdout=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.stdout);" "$init_output")
init_stderr=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.stderr);" "$init_output")
assert_output "init exits 2 for unsupported flags" "2" "$init_exit"
assert_contains "init prints reminder" "Update available for spec-first" "$init_stderr"
assert_contains "init rejects unsupported flags" "unknown option --dry-run" "$init_stderr"
assert_output "init does not generate runtime assets from unsupported flags" "" "$init_stdout"

clean_output="$(
  cd "$project_dir"
  SPEC_FIRST_VERSION_REMINDER_LATEST="9.9.9" node - "$REPO_ROOT" <<'EOF'
const path = require('node:path');
const repoRoot = process.argv[2];
const { runCli } = require(path.join(repoRoot, 'src/cli'));

(async () => {
  let stdout = '';
  let stderr = '';
  const originalLog = console.log;
  const originalStderrWrite = process.stderr.write.bind(process.stderr);
  console.log = (...args) => {
    stdout += `${args.join(' ')}\n`;
  };
  process.stderr.write = (chunk) => {
    stderr += chunk;
    return true;
  };

  const exitCode = await runCli(['clean', '--claude']);

  console.log = originalLog;
  process.stderr.write = originalStderrWrite;
  process.stdout.write(JSON.stringify({ exitCode, stdout, stderr }));
})();
EOF
)"
clean_exit=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(String(data.exitCode));" "$clean_output")
clean_stderr=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.stderr);" "$clean_output")
assert_output "clean exits successfully" "0" "$clean_exit"
assert_contains "clean prints reminder" "Update available for spec-first" "$clean_stderr"

echo ""
echo "=== Results ==="
echo "  Passed: $pass"
echo "  Failed: $fail"
echo ""

if [ $fail -gt 0 ]; then
  echo "=== version reminder unit tests FAILED ==="
  exit 1
else
  echo "=== version reminder unit tests PASSED ==="
fi
