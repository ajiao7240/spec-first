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

# setup-plan-renderer.cjs 一次性算出全部 helper 的 install plan（含 safety_result）。
# 为避免按 helper 重复 fork node，caller 应在主循环前于父 shell 调用
# helper_registry_prewarm_install_plan 预热全局 SETUP_INSTALL_PLAN_JSON；
# helper_registry_safety_result 优先从该全局变量用 jq 查表（jq fork ~8ms ≪ node 冷启 ~38ms）。
# 注意：命令替换 $(...) 子 shell 无法回写父 shell 变量，故预热必须发生在父 shell 主流程，
# 而非依赖 lib 内惰性赋值。未预热时回退单次 node（兜底，仍正确但较慢）。bash 3.2 兼容。
SETUP_INSTALL_PLAN_JSON=""

helper_registry_prewarm_install_plan() {
  SETUP_INSTALL_PLAN_JSON="$(node "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/setup-plan-renderer.cjs" 2>/dev/null || printf '{"planned_operations":[]}')"
}

helper_registry_safety_result() {
  local id="$1"
  local plan_json="$SETUP_INSTALL_PLAN_JSON"
  if [ -z "$plan_json" ]; then
    plan_json="$(node "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/setup-plan-renderer.cjs" 2>/dev/null || printf '{"planned_operations":[]}')"
  fi
  printf '%s' "$plan_json" \
    | jq -r --arg id "$id" '.planned_operations[] | select(.id == $id) | .safety_result // "unknown"'
}
