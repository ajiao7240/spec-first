#!/bin/bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

echo ""
grep -q '#### 0.1a Current Work Pulse' "skills/spec-brainstorm/SKILL.md"
grep -q '#### 0.3a Scope Decomposition' "skills/spec-brainstorm/SKILL.md"
grep -q '#### 3.4 Preflight Self-Check' "skills/spec-brainstorm/SKILL.md"
grep -q '#### 3.6 User Review Gate' "skills/spec-brainstorm/SKILL.md"
grep -q 'references/decomposition-capture.md' "skills/spec-brainstorm/SKILL.md"

test -f "skills/spec-brainstorm/references/decomposition-capture.md"
grep -q 'type: epic-decomposition' "skills/spec-brainstorm/references/decomposition-capture.md"

grep -q '#### 0.3a Load Epic Decomposition Context When Declared' "skills/spec-plan/SKILL.md"
grep -q 'warn and continue planning without epic context' "skills/spec-plan/SKILL.md"
