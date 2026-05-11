# 2026-05-12 plan lifecycle cleanup

## 目标

本记录用于说明本次 plan lifecycle cleanup 的状态分流依据。清理范围限定为：

- `docs/plans/2026-05-03-001-feat-workspace-graph-query-router-plan.md`
- `docs/plans/2026-05-06-001-feat-init-gitignore-policy-plan.md`
- 仍保留 `status: active` frontmatter 的 2026-04 历史计划

本次只更新计划生命周期状态，不修改 generated runtime，不新增 workflow 行为，不把历史计划重新解释为当前执行状态。

## 分流规则

- `completed`: 当前源码、文档和测试中已有可复验落地证据，计划无需继续留在 active 队列。
- `superseded`: 计划主题已被后续 completed 计划、当前 source contract 或新的治理方案覆盖；如需继续演进，应从后续计划进入。
- `backlog`: 主题仍可能有价值，但当前没有足够高频痛点进入近期主线。

## Completed

| Plan | 状态依据 |
| --- | --- |
| `2026-04-09-001-feat-spec-graph-bootstrap-stage1-plan.md` | `spec-graph-bootstrap` 已形成当前 source skill、bootstrap scripts、provider readiness tests 和用户手册说明；早期 stage1 安装集成不再是 active 工作。 |
| `2026-04-10-001-feat-crg-mcp-setup-integration-plan.md` | `code-review-graph` 已在 `spec-mcp-setup` provider registry、setup tests 和后续 uvx pin 计划中落地。 |
| `2026-04-19-001-refactor-remove-legacy-bootstrap-plan.md` | 旧 setup/bootstrap 入口已由当前 `spec-mcp-setup`、`spec-graph-bootstrap` 与 runtime boundary 取代。 |
| `2026-04-20-012-feat-init-coding-guidelines-plan.md` | `AGENTS.md` / `CLAUDE.md` managed coding guidelines、source templates 与 tests 已存在。 |
| `2026-04-22-003-refactor-rebuild-mcp-setup-installer-plan.md` | 当前 `spec-mcp-setup` installer、provider config、all-repos 维护和 tests 已覆盖该重建目标。 |
| `2026-04-26-002-feat-unified-spec-id-plan.md` | `spec_id`、`source_plan_hash`、`spec-first tasks hash/validate`、task-pack validation 和 workflow contract tests 已落地。 |
| `2026-04-27-003-refactor-crg-external-code-review-graph-plan.md` | internal CRG runtime 已退役，外部 `code-review-graph` provider 与 pin 治理已进入 setup/bootstrap 路径；review 默认 preflight 后续由 2026-05-07-003 承接。 |
| `2026-04-28-004-refactor-readme-structural-reorganization-plan.md` | README / README.zh-CN 已完成 progressive disclosure、用户入口和 runtime capability 说明更新。 |
| `2026-05-03-001-feat-workspace-graph-query-router-plan.md` | `workspace-graph-targets.v1`、`resolve-workspace-graph-targets.{sh,ps1}`、`dirty-uncertain`、`--all-repos` 和下游 workflow/user manual references 已落地。 |
| `2026-05-06-001-feat-init-gitignore-policy-plan.md` | `src/cli/gitignore-policy.js`、init dry-run/apply path、managed `.gitignore` block、README/user manual 和 unit/smoke tests 已落地。 |

## Superseded

| Plan | 后续承接 |
| --- | --- |
| `2026-04-14-010-feat-spec-compound-hard-cut-consistency-plan.md` | 已由 compound core sync、当前 `spec-compound` source 和 `2026-05-12-001` compound trigger checklist 继续承接。 |
| `2026-04-15-001-spec-graph-bootstrap-goal-closure-optimization-plan.md` | 已被 graph readiness compiler、workspace graph router、provider consumption contract 和 2026-05 graph evidence/fast-reuse 计划覆盖。 |
| `2026-04-16-014-refactor-unified-crg-stage0-execution-plan.md` | internal CRG / Stage-0 路线已退役；外部 provider、graph-bootstrap 和 code-review preflight 后续计划承接。 |
| `2026-04-18-002-feat-stage0-verification-profile-integration-plan.md` | Stage-0 verification profile 已被当前 graph readiness、setup/bootstrap readiness 和 workflow handoff contracts 吸收。 |
| `2026-04-18-004-refactor-karpathy-guidelines-skill-decomposition-plan.md` | 已由当前 coding guidelines、spec-work execution contract、review discipline 和 2026-05 workflow-quality 计划吸收。 |
| `2026-04-19-006-next-top3-runtime-truth-plan.md` | 已由 runtime tool boundary、runtime capability catalog、release/package evidence 和 dual-host governance tests 取代。 |
| `2026-04-19-007-next-phase-runtime-contract-followup-plan.md` | 已由 runtime tool instruction index、runtime tool boundary 和后续 release/catalog guard 计划取代。 |
| `2026-04-21-001-refactor-bootstrap-database-evidence-contract-plan.md` | 已由 database doc/compound dual-view hardening 与当前 bootstrap evidence contracts 覆盖。 |
| `2026-04-21-002-cli-only-database-routing-handoff-plan.md` | 已由 database doc routing 和 CLI/runtime boundary 收缩结果覆盖。 |
| `2026-04-22-002-fix-graph-bootstrap-boundary-contract-plan.md` | 已由 graph provider consumption contract、graph evidence policy 和 current graph-bootstrap source boundary 覆盖。 |
| `2026-04-26-004-sync-ce-e8c118e2-workflow-updates-plan.md` | 已被后续 CE sync completed plans 和当前 workflow source 吸收。 |

## Backlog

| Plan | 保留原因 |
| --- | --- |
| `2026-04-19-005-feat-sdd-riper-light-contract-integration-plan.md` | SDD/RIPER 轻量约束仍可能作为方法论输入，但当前没有足够高频痛点进入核心路径；如重启，应先从当前角色契约和 workflow-quality 计划重新裁剪。 |

## 未纳入本轮

以下仍保持其原有状态：

- 2026-05-07 之后的 graph/review/governance 主线计划。
- 已经是 `completed`、`superseded`、`draft` 或 `approved` 的计划。
- `2026-04-26-002` 文档正文中的 YAML 示例代码块；它不是 frontmatter lifecycle truth。
