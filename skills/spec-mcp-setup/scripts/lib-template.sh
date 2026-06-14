#!/bin/bash
# Shared mcp-tools.json template helpers.
# Provides jq prelude for resolving dependency refs and expanding package/version templates.

set -euo pipefail

SPEC_FIRST_JQ_TEMPLATE_PRELUDE='
def hydrate_tool($t):
  . as $root
  | (first(($root.external_dependencies // [])[]? | select(.id == ($t.dependency_ref // $t.id))) // {}) as $dep
  | $t + {
      package: ($t.package // $dep.package // ""),
      version: ($t.version // $dep.version // "")
    };
def tool_by_id($id):
  . as $root
  | (first($root.tools[]? | select(.id == $id)) // {}) as $t
  | $root | hydrate_tool($t);
def expand_tpl($t):
  gsub("\\{\\{package\\}\\}"; ($t.package // ""))
  | gsub("\\{\\{version\\}\\}"; ($t.version // ""));
'

require_mcp_tools_schema_version() {
  local expected="${1:-7}"
  local tools_path="${2:-${TOOLS_JSON:-}}"
  local schema_version
  [ -n "$tools_path" ] || { echo "mcp-tools.json path not set" >&2; exit 1; }
  [ -f "$tools_path" ] || { echo "mcp-tools.json not found: $tools_path" >&2; exit 1; }
  schema_version="$(jq -r '.schema_version // "missing"' "$tools_path")"
  [ "$schema_version" = "$expected" ] || { echo "invalid_mcp_tools_schema_version:$schema_version" >&2; exit 1; }
}

# Expand a single string against a tool's package/version fields read from $TOOLS_JSON.
# Usage: expand_tool_string <tool_id> <raw>
expand_tool_string() {
  local tool_id="$1" raw="$2"
  local package version
  package="$(jq -r --arg id "$tool_id" "$SPEC_FIRST_JQ_TEMPLATE_PRELUDE"'tool_by_id($id) | .package // ""' "$TOOLS_JSON")"
  version="$(jq -r --arg id "$tool_id" "$SPEC_FIRST_JQ_TEMPLATE_PRELUDE"'tool_by_id($id) | .version // ""' "$TOOLS_JSON")"
  raw="${raw//\{\{package\}\}/$package}"
  raw="${raw//\{\{version\}\}/$version}"
  printf '%s' "$raw"
}
