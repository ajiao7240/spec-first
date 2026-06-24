# spec-prd Grill-First Clarification Fresh-Source Eval

```yaml
fresh_source_eval:
  schema_version: fresh-source-eval-record.v1
  producer: spec-work
  freshness: current-worktree
  authority_level: advisory
  reason_code: fresh-source-eval-dispatched
  consumer: spec-prd contract tests and work closeout
  status: passed
  source_paths:
    - skills/spec-prd/SKILL.md
    - skills/spec-prd/references/domain-language-and-decision-ledger.md
    - skills/spec-prd/references/evidence-and-topology.md
    - skills/spec-prd/references/grill-with-docs-integration.md
    - skills/spec-prd/references/prd-output-template.md
    - skills/spec-prd/references/prd-readiness-lens.md
    - skills/spec-prd/evals/examples.json
    - tests/unit/spec-prd-contracts.test.js
    - docs/05-用户手册/22-PRD需求文档质量增强流程.md
  runtime_paths_checked: []
  changed_behavior: "spec-prd targeted rough inputs now default to source-first grill-first clarification; fixed owner-question count is no longer the stop condition, and each owner question must close or narrow a named gap with source attempt, PRD write target, and closure state."
  reviewer_context: "fresh read-only Codex subagents were dispatched with explicit user authorization for multi-agent review; reviewers read current on-disk source and did not invoke or simulate the cached spec-prd skill."
  checks:
    no_fixed_cap: passed
    docs_consistency: passed
    trigger_precision: passed
    source_runtime_boundary: passed
    artifact_topology: passed
    tests_evals_coverage: passed
  findings: []
  not_run_reason: null
```

## 审查链

- 第一轮 fresh-source reviewer 返回 `concerns`: 用户手册仍有 3 处 “超过 3 个 load-bearing gaps” active wording；`CHANGELOG.md` 的旧 cap 语境仅为历史记录，不要求修改。
- 已修复用户手册三处 active wording，改为“多个相互影响的 load-bearing gaps / owner decision set / 下一问无法关闭或缩窄命名 gap”的 progress-based 语义。
- 第二轮 fresh-source reviewer 返回 `passed`: 未发现 active source 中残留 `1-3`、`more than 3`、`超过 3 个 load-bearing gaps`、`normal cap` 作为停止条件；tests/evals/docs 覆盖 no-fixed-cap、owner-question avoidance、direct route-out、run-local map、lazy context/ADR 与 source/runtime boundary。

## 直接证据

- `rg -n "超过 3|1-3|more than 3|question cap|normal cap|over-cap|capped|owner_question_count" docs/05-用户手册/22-PRD需求文档质量增强流程.md skills/spec-prd tests/unit/spec-prd-contracts.test.js README.md README.zh-CN.md` 只剩 `README.md` 中无关的 raw tool output `excerpt cap` 安全术语。
- `npx jest tests/unit/eval-fixture-contracts.test.js tests/unit/spec-prd-contracts.test.js --runInBand` 通过：2 suites / 31 tests。
- `node skills/spec-prd/scripts/run-evals.js --json` 通过：`status=passed`, `case_count=80`, `reason_code=eval_fixture_passed`。
- `node bin/spec-first.js init --claude --codex -y --lang zh` 通过 generator 刷新 Claude/Codex runtime mirrors；未手改 `.claude/**`、`.codex/**` 或 `.agents/skills/**`。
- Post-init dry-run 仍报告 repo-level `skills_drifted` advisory；直接 diff 确认 `skills/spec-prd/SKILL.md`、`skills/spec-prd/references/grill-with-docs-integration.md` 和 `skills/spec-prd/evals/examples.json` 与 `.agents/skills/spec-prd/` 对应 mirror 一致。本记录只声明本次 `spec-prd` runtime projection 已刷新，不声明全仓 runtime drift 清零。

## Runtime Matrix

| Runtime mirror | 状态 | 证据 |
| --- | --- | --- |
| `.claude/**` | refreshed; repo-level dry-run still reports advisory drift | `node bin/spec-first.js init --claude --codex -y --lang zh` 生成 18 个 command、4 个 skill 目录、51 个 agent 文件；后续 dry-run 仍提示 `skills_drifted` |
| `.codex/**` | refreshed; repo-level dry-run still reports advisory drift | 同一命令安装 Codex SessionStart hook 并生成 51 个 Codex agent 文件；后续 dry-run 仍提示 `skills_drifted` |
| `.agents/skills/**` | refreshed for `spec-prd` mirror | 同一命令生成 22 个 skill 目录；`skills/spec-prd/**` 与 `.agents/skills/spec-prd/**` 关键文件 diff clean |

## 多 Agent 代码审查摘要

- Reviewer A（workflow/source-runtime boundary）未发现 `$spec-prd` public workflow、artifact topology 或 script/LLM 边界阻塞问题；提醒新增 fresh-source eval/PRD/plan artifact 必须随同提交，避免 changelog dead reference。
- Reviewer B（tests/eval/documentation coverage）确认 R8/R9 主覆盖到位；提出补 retired old-cap anchor 负向测试，已在 `tests/unit/spec-prd-contracts.test.js` 落地并通过。
- Reviewer C（adversarial risk）发现两份 protected PRD artifact 曾被误删，已恢复；要求 direct route-out 用户手册说明补齐 bypass reason、handoff target、downstream 不 invent WHAT，已修复。
- 审查后无剩余 P1/P2/P3 actionable finding；未跟踪新增 artifact 仍需在提交时一并纳入。

## 边界说明

- Fresh-source eval 读取 source-of-truth 文件，不把 generated runtime mirrors 当作 source。
- Contract tests 和 eval fixtures 只锁定 source anchors、fixture shape 和 deterministic facts；PRD semantic readiness 仍由 LLM 基于 source/owner/assumption/blocker/route-out evidence 判断。
- 本记录不新增 public workflow、schema、interview transcript artifact 或第二套 PRD topology。
