#!/bin/bash
# Shared mcp-tools.json template helpers.
# Provides jq prelude for expanding {{package}} / {{version}} placeholders against a tool object.

set -euo pipefail

SPEC_FIRST_JQ_TEMPLATE_PRELUDE='def expand_tpl($t): gsub("\\{\\{package\\}\\}"; ($t.package // "")) | gsub("\\{\\{version\\}\\}"; ($t.version // ""));'

# Expand a single string against a tool's package/version fields read from $TOOLS_JSON.
# Usage: expand_tool_string <tool_id> <raw>
expand_tool_string() {
  local tool_id="$1" raw="$2"
  local package version
  package="$(jq -r --arg id "$tool_id" '.tools[] | select(.id == $id) | .package // ""' "$TOOLS_JSON")"
  version="$(jq -r --arg id "$tool_id" '.tools[] | select(.id == $id) | .version // ""' "$TOOLS_JSON")"
  raw="${raw//\{\{package\}\}/$package}"
  raw="${raw//\{\{version\}\}/$version}"
  printf '%s' "$raw"
}
