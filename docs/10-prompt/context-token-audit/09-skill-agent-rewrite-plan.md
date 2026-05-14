# Skill / Agent Rewrite Plan

## P0: 立即修

| id | title | target files | current token problem | proposed change | expected token saving | quality risk | acceptance criteria | priority | changelog_required |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P0-CTX-001 | Runtime audit artifacts exclusion | `skills/*/SKILL.md`, future context router docs | `.spec-first/audits` 多份 60 万 token JSON 会被误扫 | 明确默认排除 `.spec-first/audits/**`，只有 audit workflow explicit read | very high | 低 | workflow docs 声明 runtime audit path-only；tests/lint 覆盖 | P0 | yes |
| P0-CTX-002 | Shrink `spec-code-review` core | `skills/spec-code-review/SKILL.md`, refs | 24k token 高频入口 | core orchestrator + selected refs | high | 中 | core <5k 或有 documented exception；review behavior tests pass | P0 | yes |
| P0-CTX-003 | Add reviewer budget | `skills/spec-code-review/*`, `skills/spec-doc-review/*` | multi-agent fanout 乘法放大 | max reviewers by scale/sensitivity；max findings per reviewer | high | 中 | tiny diff minimum set；sensitive still expands | P0 | yes |
| P0-CTX-004 | Replace full-document doc-review fanout | `skills/spec-doc-review/SKILL.md`, refs | full document 给每个 reviewer | section map + selected section bundle | high | 中 | each reviewer receives reasoned context slice | P0 | yes |
| P0-CTX-005 | Shrink `spec-work` core | `skills/spec-work/SKILL.md` | 10.5k 高频执行入口 | task-pack/branch/shipping/subagent refs | medium-high | 中 | ordinary work loads only core + current ref | P0 | yes |
| P0-CTX-006 | Shrink `using-spec-first` router | `skills/using-spec-first/SKILL.md` | 每次 substantial work 前加载 5.4k | route table compact + detailed rationale refs | medium | 低 | guide output unchanged | P0 | yes |
| P0-CTX-007 | Skill-audit summary default | `skills/spec-skill-audit/scripts/write-audit-artifacts.js`, `skills/spec-skill-audit/SKILL.md` | 默认写/保留 full JSON | summary default, full opt-in, retention cap | high | 中 | latest summary sufficient for ordinary audit | P0 | yes |
| P0-CTX-008 | Compound lightweight default | `skills/spec-compound/SKILL.md` | full mode 多 subagent/history | lightweight default；full explicit | medium-high | 低中 | no raw session history unless opted in | P0 | yes |
| P0-CTX-009 | Changelog latest-window consumption | changelog helper/release notes workflows | `CHANGELOG.md` 约 82k tokens | latest N entries + version index | medium | 低 | release notes still cite correct entries | P0 | yes |
| P0-CTX-010 | Shared context budget policy | `docs/contracts/**`, skills | 没有全局预算 | 新增 budget thresholds and failure modes | systemic | 低 | all high-frequency workflows reference policy | P0 | yes |

## P1: 重要优化

| id | title | target files | current token problem | proposed change | expected token saving | quality risk | acceptance criteria | priority | changelog_required |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P1-CTX-011 | `spec-plan` progressive split | `skills/spec-plan/SKILL.md`, refs | 14.6k plan core | research/examples/artifact refs | high | 低中 | generated plan quality unchanged | P1 | yes |
| P1-CTX-012 | `spec-mcp-setup` repair refs | `skills/spec-mcp-setup/SKILL.md` | setup recipes in core | provider-specific repair refs | medium | 中 | setup degraded messages still actionable | P1 | yes |
| P1-CTX-013 | graph compact readiness | `skills/spec-graph-bootstrap/scripts/*` | diagnostics/raw logs can be long | compact status + raw log path | medium | 低 | provider failures still diagnosable | P1 | yes |
| P1-CTX-014 | `artifact-summary.v1` | docs/contracts, producers | full artifact handoff | summary + path + evidence refs | high | 中 | plan/task/review/compound produce summaries | P1 | yes |
| P1-CTX-015 | shared `review-finding.v1` | code/doc/app review | local schemas not unified | common minimum envelope | medium | 中 | domain extensions preserved | P1 | yes |
| P1-CTX-016 | Broad researcher budget | researcher agent files | broad agents read too much | max sources, max refs, compact digest | medium | 低中 | no long prose by default | P1 | yes |
| P1-CTX-017 | App-audit selected expert budget | `skills/spec-app-consistency-audit/*` | multi-source, multi-expert | planner selected experts + issue cap | medium | 中 | confirmed issue quality preserved | P1 | yes |
| P1-CTX-018 | Session digest schema | `skills/spec-sessions/*` | synthesis may be long | digest schema + answer budget | medium | 低 | no raw transcript, max 5 sessions retained | P1 | yes |
| P1-CTX-019 | Compound index | `docs/solutions`, compound skills | full solution docs repeatedly read | `docs/solutions/index.md/json` | medium | 低 | related docs search returns summaries first | P1 | yes |
| P1-CTX-020 | Optimize leaderboard | `skills/spec-optimize/*` | experiments output large | leaderboard + top deltas + failures | medium | 中 | metric rigor preserved | P1 | yes |

## P2: 长期优化

| id | title | target files | current token problem | proposed change | expected token saving | quality risk | acceptance criteria | priority | changelog_required |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P2-CTX-021 | Context Router MVP | `src/cli/`, `docs/contracts/`, skills | ad hoc context reads | `context-request` -> `context-bundle` | very high | 中 | 3 workflows consume bundle | P2 | yes |
| P2-CTX-022 | Context budget CI | tests/unit, scripts | budgets not enforced | linter for high-frequency skill size and forbidden runtime scans | high | 低 | CI flags regressions | P2 | yes |
| P2-CTX-023 | Tool result clearing | workflows/scripts | tool outputs remain in context | summarize then clear raw content/path-only | medium | 中 | final reports cite summary and raw path | P2 | yes |
| P2-CTX-024 | Runtime artifact retention | `.spec-first` producers | historical artifacts accumulate | keep latest + configurable retention | high disk/context | 中 | no source artifact lost; explicit archive possible | P2 | yes |
| P2-CTX-025 | Agent profile standardization | `agents/*.md` | broad/overlapping outputs | standard Role/Trigger/Inputs/Output schema | medium | 低 | every agent has output contract | P2 | yes |
| P2-CTX-026 | Context telemetry | future CLI/workflows | no measured token usage | estimated tokens per bundle/run | learning | 低 | telemetry is advisory, local, privacy-safe | P2 | yes |
