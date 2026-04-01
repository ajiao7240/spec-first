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

echo "4. runCli wiring"
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
