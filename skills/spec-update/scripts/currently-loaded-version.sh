#!/bin/bash
# Print the version segment of the skill's own location when it matches the
# marketplace cache layout `~/.claude/plugins/cache/<marketplace>/spec-first/<version>/skills/spec-update`,
# or the literal sentinel `__SPEC_UPDATE_NOT_MARKETPLACE__` otherwise.

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
skill_dir="$(dirname "$script_dir")"

version=$(printf '%s\n' "$skill_dir" | sed -nE 's|.*/plugins/cache/[^/]+/spec-first/([^/]+)/skills/spec-update/?$|\1|p')

if [ -n "$version" ]; then
  echo "$version"
else
  echo '__SPEC_UPDATE_NOT_MARKETPLACE__'
fi
