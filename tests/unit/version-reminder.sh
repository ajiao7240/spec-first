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
assert_not_contains "codex startup reminder does not install directly" "npm install -g" "$startup_captured"

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
    thirdPrinted,
    first,
    second,
    third,
  }));
})();
EOF
)"
cooldown_first=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(String(data.firstPrinted));" "$cooldown_output")
cooldown_second=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(String(data.secondPrinted));" "$cooldown_output")
cooldown_third=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(String(data.thirdPrinted));" "$cooldown_output")
assert_output "first host/version startup reminder prints" "true" "$cooldown_first"
assert_output "same host/version startup reminder is suppressed across projects" "false" "$cooldown_second"
assert_output "reset clears startup reminder cooldown" "true" "$cooldown_third"

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

startup_cli_output="$(
  node - "$REPO_ROOT" "$TMP_DIR" <<'EOF'
const fs = require('node:fs');
const path = require('node:path');
const repoRoot = process.argv[2];
const tmpDir = process.argv[3];
const { runCli } = require(path.join(repoRoot, 'src/cli'));

(async () => {
  const projectRoot = path.join(tmpDir, 'startup-cli');
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
  const originalHome = process.env.SPEC_FIRST_VERSION_REMINDER_HOME;
  process.stdout.write = (chunk) => {
    stdout += chunk;
    return true;
  };
  process.stderr.write = (chunk) => {
    stderr += chunk;
    return true;
  };
  process.env.SPEC_FIRST_VERSION_REMINDER_LATEST = '1.6.2';
  process.env.SPEC_FIRST_VERSION_REMINDER_HOME = path.join(tmpDir, 'home-cli');
  process.chdir(projectRoot);

  const exitCode = await runCli(['startup-reminder', '--codex']);

  process.chdir(originalCwd);
  if (originalLatest === undefined) {
    delete process.env.SPEC_FIRST_VERSION_REMINDER_LATEST;
  } else {
    process.env.SPEC_FIRST_VERSION_REMINDER_LATEST = originalLatest;
  }
  if (originalHome === undefined) {
    delete process.env.SPEC_FIRST_VERSION_REMINDER_HOME;
  } else {
    process.env.SPEC_FIRST_VERSION_REMINDER_HOME = originalHome;
  }
  process.stdout.write = originalStdoutWrite;
  process.stderr.write = originalStderrWrite;
  process.stdout.write(JSON.stringify({ exitCode, stdout, stderr }));
})();
EOF
)"
startup_cli_exit=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(String(data.exitCode));" "$startup_cli_output")
startup_cli_stdout=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.stdout);" "$startup_cli_output")
startup_cli_stderr=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.stderr);" "$startup_cli_output")
assert_output "hidden startup reminder exits successfully" "0" "$startup_cli_exit"
assert_contains "hidden startup reminder writes stdout" '$spec-update' "$startup_cli_stdout"
assert_output "hidden startup reminder writes no stderr" "" "$startup_cli_stderr"

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

  const exitCode = await runCli(['init', '--claude', '-u', 'kuang', '--lang', 'en']);

  console.log = originalLog;
  process.stderr.write = originalStderrWrite;
  process.stdout.write(JSON.stringify({ exitCode, stdout, stderr }));
})();
EOF
)"
init_exit=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(String(data.exitCode));" "$init_output")
init_stdout=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.stdout);" "$init_output")
init_stderr=$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(data.stderr);" "$init_output")
assert_output "init exits successfully" "0" "$init_exit"
assert_contains "init prints reminder" "Update available for spec-first" "$init_stderr"
assert_contains "init still reports generation" "Wrote project developer profile" "$init_stdout"

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
