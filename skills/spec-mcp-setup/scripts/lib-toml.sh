#!/bin/bash
# Shared Codex TOML helpers for MCP server sections.

set -euo pipefail

toml_table_key() {
  local key="$1"
  if printf '%s' "$key" | grep -Eq '^[A-Za-z0-9_]+$'; then
    printf 'mcp_servers.%s' "$key"
  else
    local escaped="${key//\"/\\\"}"
    printf 'mcp_servers."%s"' "$escaped"
  fi
}

toml_legacy_table_key() {
  local key="$1"
  printf 'mcp_servers.%s' "$key"
}

extract_toml_mcp_section() {
  local config_path="$1"
  local key="$2"
  [ -f "$config_path" ] || return 0

  python3 - "$config_path" "$key" <<'PY'
import re
import sys
from pathlib import Path

path = Path(sys.argv[1])
key = sys.argv[2]
text = path.read_text(encoding="utf-8") if path.exists() else ""
headers = [
    f"mcp_servers.{key}",
    'mcp_servers."' + key.replace('"', '\\"') + '"',
]

for header in headers:
    pattern = rf'(?ms)^[ \t]*\[{re.escape(header)}\][ \t]*\r?\n(.*?)(?=^[ \t]*\[|\Z)'
    match = re.search(pattern, text)
    if match:
        sys.stdout.write(match.group(1).strip())
        if match.group(1).strip():
            sys.stdout.write("\n")
        break
PY
}

remove_toml_mcp_section() {
  local config_path="$1"
  local key="$2"
  local tmp="$3"

  python3 - "$config_path" "$key" "$tmp" <<'PY'
import re
import sys
from pathlib import Path

path = Path(sys.argv[1])
key = sys.argv[2]
out = Path(sys.argv[3])
text = path.read_text(encoding="utf-8") if path.exists() else ""
headers = [
    f"mcp_servers.{key}",
    'mcp_servers."' + key.replace('"', '\\"') + '"',
]

for header in headers:
    pattern = rf'(?ms)^[ \t]*\[{re.escape(header)}\][ \t]*\r?\n.*?(?=^[ \t]*\[|\Z)'
    text = re.sub(pattern, "", text)

text = re.sub(r'\n{3,}', '\n\n', text).strip()
out.write_text((text + "\n") if text else "", encoding="utf-8")
PY
}

toml_mcp_section_matches_exact() {
  local config_path="$1"
  local key="$2"
  local expected_command="$3"
  local expected_args_json="$4"
  [ -f "$config_path" ] || return 1

  python3 - "$config_path" "$key" "$expected_command" "$expected_args_json" <<'PY'
import ast
import json
import re
import sys
from pathlib import Path

path = Path(sys.argv[1])
key = sys.argv[2]
expected_command = sys.argv[3]
expected_args = json.loads(sys.argv[4])
text = path.read_text(encoding="utf-8") if path.exists() else ""
headers = [
    f"mcp_servers.{key}",
    'mcp_servers."' + key.replace('"', '\\"') + '"',
]


def extract_section():
    for header in headers:
        pattern = rf'(?ms)^[ \t]*\[{re.escape(header)}\][ \t]*\r?\n(.*?)(?=^[ \t]*\[|\Z)'
        match = re.search(pattern, text)
        if match:
            return match.group(1).strip()
    return ""


def load_with_tomllib(section):
    try:
        import tomllib  # Python 3.11+
    except Exception:
        return None
    try:
        return tomllib.loads("[server]\n" + section).get("server", {})
    except Exception:
        return None


def strip_comment(value):
    result = []
    in_single = False
    in_double = False
    escaped = False
    for ch in value:
        if escaped:
            result.append(ch)
            escaped = False
            continue
        if ch == "\\" and in_double:
            result.append(ch)
            escaped = True
            continue
        if ch == "'" and not in_double:
            in_single = not in_single
            result.append(ch)
            continue
        if ch == '"' and not in_single:
            in_double = not in_double
            result.append(ch)
            continue
        if ch == "#" and not in_single and not in_double:
            break
        result.append(ch)
    return "".join(result).strip()


def fallback_value(section, name):
    lines = section.splitlines()
    for index, line in enumerate(lines):
        match = re.match(rf"^\s*{re.escape(name)}\s*=\s*(.*)$", line)
        if not match:
            continue
        value = match.group(1)
        if name != "args":
            return strip_comment(value)

        balance = value.count("[") - value.count("]")
        cursor = index + 1
        while balance > 0 and cursor < len(lines):
            value += "\n" + lines[cursor]
            balance += lines[cursor].count("[") - lines[cursor].count("]")
            cursor += 1
        return strip_comment(value)
    return None


def parse_string(raw):
    if raw is None:
        return None
    raw = strip_comment(raw)
    if raw.startswith('"') and raw.endswith('"'):
        try:
            return json.loads(raw)
        except Exception:
            return None
    if raw.startswith("'") and raw.endswith("'"):
        return raw[1:-1]
    return raw


def parse_args(raw):
    if raw is None:
        return None
    raw = strip_comment(raw)
    try:
        parsed = json.loads(raw)
    except Exception:
        try:
            parsed = ast.literal_eval(raw)
        except Exception:
            return None
    return parsed if isinstance(parsed, list) else None


section = extract_section()
if not section:
    sys.exit(1)

parsed = load_with_tomllib(section)
if parsed is not None:
    actual_command = parsed.get("command")
    actual_args = parsed.get("args", [])
else:
    actual_command = parse_string(fallback_value(section, "command"))
    actual_args = parse_args(fallback_value(section, "args"))

if actual_command == expected_command and actual_args == expected_args:
    sys.exit(0)
sys.exit(1)
PY
}

write_toml_mcp_section() {
  local config_path="$1"
  local key="$2"
  local section_body="$3"
  local tmp="$4"

  local table_key
  table_key="$(toml_table_key "$key")"
  local remove_tmp
  remove_tmp="$(mktemp "${TMPDIR:-/tmp}/spec-mcp-toml.XXXXXX")"
  remove_toml_mcp_section "$config_path" "$key" "$remove_tmp"

  {
    if [ -s "$remove_tmp" ]; then
      cat "$remove_tmp"
      printf '\n'
    fi
    printf '[%s]\n%s\n' "$table_key" "$section_body"
  } > "$tmp"

  rm -f "$remove_tmp"
}
