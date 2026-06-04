#!/bin/bash

helper_registry_path() {
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  printf '%s\n' "$(dirname "$script_dir")/helper-tools.json"
}

helper_registry_ids() {
  jq -r '.helpers[].id' "$(helper_registry_path)"
}

helper_registry_cli_ids() {
  jq -r '.helpers[] | select(.kind == "cli" or .kind == "browser-helper") | .id' "$(helper_registry_path)"
}

helper_registry_skill_ids() {
  jq -r '.helpers[] | select(.kind == "global-skill") | .id' "$(helper_registry_path)"
}

helper_registry_baseline_blocking() {
  local id="$1"
  jq -r --arg id "$id" '.helpers[] | select(.id == $id) | .baseline_blocking' "$(helper_registry_path)"
}

helper_registry_kind() {
  local id="$1"
  jq -r --arg id "$id" '.helpers[] | select(.id == $id) | .kind' "$(helper_registry_path)"
}

helper_registry_skill_name() {
  local id="$1"
  jq -r --arg id "$id" '.helpers[] | select(.id == $id) | .detection.skill_name // empty' "$(helper_registry_path)"
}

helper_registry_profile() {
  local id="$1"
  jq -r --arg id "$id" '.helpers[] | select(.id == $id) | (.profiles[0] // "minimal")' "$(helper_registry_path)"
}

helper_registry_safety_result() {
  local id="$1"
  node "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/setup-plan-renderer.cjs" \
    | jq -r --arg id "$id" '.planned_operations[] | select(.id == $id) | .safety_result // "unknown"'
}
