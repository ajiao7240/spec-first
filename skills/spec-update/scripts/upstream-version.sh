#!/bin/bash
# Print the upstream package.json version on main, or the literal sentinel
# `__SPEC_UPDATE_VERSION_FAILED__` if the lookup fails.

set -euo pipefail

version=$(gh api repos/sunrain520/spec-first/contents/package.json --jq '.content | @base64d | fromjson | .version' 2>/dev/null || true)

if [ -n "$version" ]; then
  echo "$version"
else
  echo '__SPEC_UPDATE_VERSION_FAILED__'
fi
