#!/bin/bash
# setup skill unit tests

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SKILL_DIR="$REPO_ROOT/skills/setup"
CHECK_HEALTH="$SKILL_DIR/scripts/check-health"
CONFIG_TEMPLATE="$SKILL_DIR/references/config-template.yaml"
PROMPT_SKILL_MD="$REPO_ROOT/docs/10-prompt/skills/setup/SKILL.md"
CMD_TEMPLATE="$REPO_ROOT/templates/claude/commands/spec/setup.md"
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
  if grep -qF -- "$needle" <<<"$haystack"; then
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
  if ! grep -qF -- "$needle" <<<"$haystack"; then
    pass=$((pass + 1))
  else
    echo "  ✗ $desc: '$needle' should not be in output"
    fail=$((fail + 1))
  fi
}

echo "=== setup skill tests ==="
echo ""

echo "1. File and contract validation"
assert "setup skill exists" test -f "$SKILL_DIR/SKILL.md"
assert "setup prompt doc exists" test -f "$PROMPT_SKILL_MD"
assert "setup command template exists" test -f "$CMD_TEMPLATE"
assert "setup health script exists" test -f "$CHECK_HEALTH"
assert "setup config template exists" test -f "$CONFIG_TEMPLATE"

skill_md="$(cat "$SKILL_DIR/SKILL.md" 2>/dev/null || true)"
prompt_skill_md="$(cat "$PROMPT_SKILL_MD" 2>/dev/null || true)"
cmd_template_md="$(cat "$CMD_TEMPLATE" 2>/dev/null || true)"
config_template_md="$(cat "$CONFIG_TEMPLATE" 2>/dev/null || true)"

assert_contains "source skill keeps setup name" "name: setup" "$skill_md"
assert_not_contains "source skill is no longer placeholder" "Currently a placeholder" "$skill_md"
assert_contains "source skill references spec:setup" "/spec:setup" "$skill_md"
assert_contains "source skill references spec:mcp-setup" "/spec:mcp-setup" "$skill_md"
assert_contains "source skill references local config" ".spec-first/config.local.yaml" "$skill_md"
assert_contains "source skill references health script" "scripts/check-health" "$skill_md"

assert_contains "prompt skill references local config" ".spec-first/config.local.yaml" "$prompt_skill_md"
assert_contains "prompt skill references command entrypoint" "/spec:setup" "$prompt_skill_md"

assert_contains "command template references setup source skill" "skills/setup/SKILL.md" "$cmd_template_md"
assert_not_contains "command template no longer references runtime workflow path" ".claude/spec-first/workflows/setup/SKILL.md" "$cmd_template_md"
assert_not_contains "command template does not point to mcp-setup" "spec-mcp-setup" "$cmd_template_md"

assert_contains "config template includes work_delegate" "work_delegate:" "$config_template_md"
assert_contains "config template includes work_delegate_consent" "work_delegate_consent:" "$config_template_md"
assert_contains "config template includes work_delegate_model" "work_delegate_model:" "$config_template_md"
assert_contains "config template uses .spec-first path comment" ".spec-first/config.local.yaml" "$config_template_md"

echo ""

echo "2. Health script contract"
outside_output="$(bash "$CHECK_HEALTH" --version 1.5.1 2>/dev/null || true)"
assert_contains "health script reports version" "Spec-First version v1.5.1" "$outside_output"
assert_contains "health script prints tools section" "Tools" "$outside_output"

REPO_DIR="$TMP_DIR/repo"
mkdir -p "$REPO_DIR"
git -C "$REPO_DIR" init >/dev/null 2>&1
touch "$REPO_DIR/compound-engineering.local.md"
mkdir -p "$REPO_DIR/.compound-engineering"
cat > "$REPO_DIR/.compound-engineering/config.local.yaml" <<'EOF'
work_delegate: codex
EOF

repo_output="$(
  cd "$REPO_DIR"
  bash "$CHECK_HEALTH" 2>/dev/null || true
)"

assert_contains "repo output flags legacy repo-local markdown" "Outdated Compound Engineering config in this repo" "$repo_output"
assert_contains "repo output flags legacy CE config directory" "Legacy Compound Engineering local config detected" "$repo_output"
assert_contains "repo output flags missing spec-first local config" "Local config missing (.spec-first/config.local.yaml)" "$repo_output"
assert_contains "repo output flags missing example config" "Example config missing (.spec-first/config.local.example.yaml)" "$repo_output"

mkdir -p "$REPO_DIR/.spec-first"
cp "$CONFIG_TEMPLATE" "$REPO_DIR/.spec-first/config.local.yaml"
cp "$CONFIG_TEMPLATE" "$REPO_DIR/.spec-first/config.local.example.yaml"
printf '\n.spec-first/*.local.yaml\n' >> "$REPO_DIR/.gitignore"

repo_output_after="$(
  cd "$REPO_DIR"
  bash "$CHECK_HEALTH" 2>/dev/null || true
)"

assert_not_contains "repo output clears missing local config after bootstrap" "Local config missing (.spec-first/config.local.yaml)" "$repo_output_after"
assert_not_contains "repo output clears missing example config after bootstrap" "Example config missing (.spec-first/config.local.example.yaml)" "$repo_output_after"
assert_not_contains "repo output clears gitignore warning after bootstrap" "Local config not safely gitignored" "$repo_output_after"

echo ""
echo "Passed: $pass"
echo "Failed: $fail"

if [ "$fail" -ne 0 ]; then
  exit 1
fi
