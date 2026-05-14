# Agent Token Inventory

## 统计口径

`role_scope`、`output_length_risk`、`fanout_risk` 和 `token_cost_risk` 是 LLM 判断，结合 agent 文件大小、触发方式、输出结构和是否常作为 reviewer batch 调用。

## 补充统计指标

下表覆盖 prompt 要求的 structured findings、long prose、是否被多个 skill 调用、是否经常 batch 调用、是否与其他 agent 重叠。`invoked_by_multiple_skills` 是对 `skills/**/*.md` 中 agent 名称引用的近似计数；batch/overlap 是基于 reviewer/persona/researcher 角色与现有 catalog 的判断。

| agent_id | structured_findings | long_prose_risk | invoked_by_multiple_skills | often_called_in_batch | overlap_risk_basis |
|---|---|---|---:|---|---|
| spec-cli-agent-readiness-reviewer | yes | no | 1 | yes | high |
| spec-learnings-researcher | yes | no | 7 | yes | high |
| spec-issue-intelligence-analyst | yes | no | 1 | yes | low |
| spec-repo-research-analyst | yes | no | 3 | yes | low |
| spec-slack-researcher | yes | no | 4 | yes | high |
| spec-pr-comment-resolver | yes | no | 2 | yes | low |
| spec-swift-ios-reviewer | yes | no | 2 | yes | medium |
| spec-agent-native-reviewer | yes | no | 3 | yes | medium |
| spec-design-iterator | no | yes | 1 | yes | low |
| spec-web-researcher | yes | no | 1 | yes | high |
| spec-adversarial-document-reviewer | yes | no | 1 | yes | medium |
| spec-adversarial-reviewer | yes | no | 2 | yes | medium |
| spec-figma-design-sync | no | yes | 2 | yes | low |
| spec-project-standards-reviewer | yes | no | 2 | yes | medium |
| spec-product-lens-reviewer | yes | no | 1 | yes | medium |
| spec-best-practices-researcher | yes | no | 3 | yes | high |
| spec-coherence-reviewer | no | yes | 1 | yes | medium |
| spec-session-historian | yes | no | 2 | yes | low |
| spec-cli-readiness-reviewer | yes | no | 2 | yes | high |
| spec-spec-flow-analyzer | yes | no | 2 | no | low |
| spec-framework-docs-researcher | yes | no | 3 | yes | high |
| spec-data-migrations-reviewer | yes | no | 2 | yes | medium |
| spec-deployment-verification-agent | yes | no | 4 | yes | low |
| spec-feasibility-reviewer | yes | no | 1 | yes | medium |
| spec-testing-reviewer | yes | no | 2 | yes | medium |
| spec-schema-drift-detector | yes | no | 3 | yes | low |
| spec-performance-oracle | no | yes | 2 | yes | high |
| spec-data-migration-expert | yes | no | 1 | yes | high |
| spec-maintainability-reviewer | yes | no | 2 | yes | medium |
| spec-correctness-reviewer | yes | no | 2 | yes | medium |
| spec-performance-reviewer | yes | no | 2 | yes | medium |
| spec-security-reviewer | yes | no | 2 | yes | medium |
| spec-scope-guardian-reviewer | no | yes | 1 | yes | high |
| spec-design-implementation-reviewer | yes | no | 0 | yes | medium |
| spec-security-sentinel | yes | no | 2 | yes | high |
| spec-previous-comments-reviewer | yes | no | 2 | yes | medium |
| spec-reliability-reviewer | yes | no | 2 | yes | medium |
| spec-api-contract-reviewer | yes | no | 2 | yes | medium |
| spec-julik-frontend-races-reviewer | yes | no | 2 | yes | medium |
| spec-security-lens-reviewer | yes | no | 1 | yes | medium |
| spec-design-lens-reviewer | yes | no | 1 | yes | medium |
| spec-code-simplicity-reviewer | no | yes | 1 | yes | medium |
| spec-pattern-recognition-specialist | yes | no | 2 | yes | high |
| spec-dhh-rails-reviewer | yes | no | 2 | yes | medium |
| spec-kieran-python-reviewer | yes | no | 3 | yes | medium |
| spec-kieran-rails-reviewer | yes | no | 3 | yes | medium |
| spec-architecture-strategist | yes | no | 1 | yes | high |
| spec-git-history-analyzer | yes | no | 1 | yes | low |
| spec-data-integrity-guardian | no | yes | 2 | yes | high |
| spec-kieran-typescript-reviewer | yes | no | 3 | yes | medium |
| spec-ankane-readme-writer | no | no | 0 | yes | low |

## 主 inventory

| agent_id | path | lines | estimated_tokens | role_scope | likely_invocation_frequency | expected_context_size | output_length_risk | fanout_risk | overlap_risk | token_cost_risk | optimization_candidate | priority |
| --- | --- | ---: | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| spec-cli-agent-readiness-reviewer | `agents/spec-cli-agent-readiness-reviewer.agent.md` | 418 | 5332 | too_broad | medium | large | medium | medium | high | high | 拆成 CLI readiness checklist ref + compact structured findings | P0 |
| spec-learnings-researcher | `agents/spec-learnings-researcher.agent.md` | 255 | 3679 | broad | high | large | medium | medium | high | high | 改读 compound index，不读 solution docs 全文；输出 delta refs | P0 |
| spec-issue-intelligence-analyst | `agents/spec-issue-intelligence-analyst.agent.md` | 213 | 3614 | broad | medium | large | medium | medium | medium | high | 限定 issue digest schema 和 max evidence refs | P1 |
| spec-repo-research-analyst | `agents/spec-repo-research-analyst.agent.md` | 260 | 3276 | broad | medium | large | medium | medium | high | high | 改成 context-router consumer，不自行全仓探索 | P0 |
| spec-slack-researcher | `agents/spec-slack-researcher.agent.md` | 151 | 2881 | broad | medium | large | medium | medium | medium | high | 限制 thread digest、decision evidence、quote budget | P1 |
| spec-pr-comment-resolver | `agents/spec-pr-comment-resolver.agent.md` | 179 | 2858 | broad | medium | medium | medium | medium | medium | high | 输出 action packets，不复制 comments 全文 | P1 |
| spec-swift-ios-reviewer | `agents/spec-swift-ios-reviewer.agent.md` | 108 | 2596 | broad | low | medium | medium | medium | medium | high | 仅在 Swift/iOS 语义改动时加载；stack lens ref 化 | P2 |
| spec-agent-native-reviewer | `agents/spec-agent-native-reviewer.agent.md` | 182 | 2280 | broad | medium | medium | medium | medium | high | high | 输出 structured finding，减少 prose rationale | P1 |
| spec-design-iterator | `agents/spec-design-iterator.agent.md` | 198 | 2153 | too_broad | low | large | high | medium | high | high | 退役或改为 explicit workflow phase；agent 不应 mutating | P0 |
| spec-web-researcher | `agents/spec-web-researcher.agent.md` | 134 | 2063 | broad | medium | large | medium | medium | medium | high | research result cap + source authority + summary-only | P1 |
| spec-adversarial-document-reviewer | `agents/spec-adversarial-document-reviewer.agent.md` | 92 | 2023 | broad | high | full document | medium | medium | medium | high | 保留，但强制 finding JSON / max findings | P1 |
| spec-adversarial-reviewer | `agents/spec-adversarial-reviewer.agent.md` | 112 | 1984 | broad | high | diff + relevant files | low | medium | medium | high | 保留 structured output；only for risk trigger | P2 |
| spec-figma-design-sync | `agents/spec-figma-design-sync.agent.md` | 173 | 1912 | too_broad | low | large | high | medium | high | high | 拆成 read-only diagnosis；mutation 归 workflow | P0 |
| spec-project-standards-reviewer | `agents/spec-project-standards-reviewer.agent.md` | 87 | 1863 | broad | high | diff + standards | low | medium | medium | high | standards summary bundle，避免读全 AGENTS/CLAUDE | P1 |
| spec-product-lens-reviewer | `agents/spec-product-lens-reviewer.agent.md` | 73 | 1799 | broad | medium | document | low | medium | medium | high | lens note vs finding 区分，max 5 findings | P1 |
| spec-best-practices-researcher | `agents/spec-best-practices-researcher.agent.md` | 119 | 1571 | broad | low | external docs | low | medium | medium | high | only when explicit research needed；cite summary | P2 |
| spec-coherence-reviewer | `agents/spec-coherence-reviewer.agent.md` | 58 | 1558 | broad | high | full document | high | medium | medium | high | always-on 但输出 cap；full document 改 section map | P1 |
| spec-session-historian | `agents/spec-session-historian.agent.md` | 90 | 1545 | broad | medium | extracted sessions | low | medium | medium | high | 只读 skeleton/error extracts；返回 digest schema | P1 |
| spec-cli-readiness-reviewer | `agents/spec-cli-readiness-reviewer.agent.md` | 74 | 1429 | medium | medium | diff | low | medium | medium | high | 与 CLI agent readiness reviewer 合并或分层 | P1 |
| spec-spec-flow-analyzer | `agents/spec-spec-flow-analyzer.agent.md` | 88 | 1290 | medium | medium | artifacts | low | low | medium | medium | output schema + artifact refs | P2 |
| spec-framework-docs-researcher | `agents/spec-framework-docs-researcher.agent.md` | 97 | 1264 | medium | low | external docs | low | medium | medium | high | official-docs-only budget | P2 |
| spec-data-migrations-reviewer | `agents/spec-data-migrations-reviewer.agent.md` | 57 | 1240 | medium | low | diff + schema | low | medium | medium | high | only when migrations changed | P2 |
| spec-deployment-verification-agent | `agents/spec-deployment-verification-agent.agent.md` | 161 | 1146 | narrow | low | deploy plan | low | medium | medium | medium | deployment checklist JSON | P2 |
| spec-feasibility-reviewer | `agents/spec-feasibility-reviewer.agent.md` | 45 | 1027 | narrow | high | document | low | medium | low | medium | keep; finding cap | P2 |
| spec-testing-reviewer | `agents/spec-testing-reviewer.agent.md` | 53 | 1024 | narrow | high | diff + tests | low | medium | low | medium | keep; max findings | P2 |
| spec-schema-drift-detector | `agents/spec-schema-drift-detector.agent.md` | 143 | 1021 | narrow | low | migration/schema | low | medium | medium | medium | keep specialized | P2 |
| spec-performance-oracle | `agents/spec-performance-oracle.agent.md` | 112 | 1015 | narrow | low | benchmark facts | high | medium | high | high | merge into performance reviewer or require metric facts | P1 |
| spec-data-migration-expert | `agents/spec-data-migration-expert.agent.md` | 99 | 991 | narrow | low | migration facts | low | medium | high | medium | merge with data migrations reviewer | P2 |
| spec-maintainability-reviewer | `agents/spec-maintainability-reviewer.agent.md` | 53 | 971 | narrow | high | diff | low | medium | low | medium | keep structured | P3 |
| spec-correctness-reviewer | `agents/spec-correctness-reviewer.agent.md` | 53 | 958 | narrow | high | diff | low | medium | low | medium | keep structured | P3 |
| spec-performance-reviewer | `agents/spec-performance-reviewer.agent.md` | 55 | 953 | narrow | medium | diff | low | medium | medium | medium | keep conditional | P3 |
| spec-security-reviewer | `agents/spec-security-reviewer.agent.md` | 55 | 953 | narrow | medium | diff | low | medium | medium | medium | keep conditional | P3 |
| spec-scope-guardian-reviewer | `agents/spec-scope-guardian-reviewer.agent.md` | 57 | 950 | narrow | high | document | high | medium | medium | high | output cap; avoid prose expansion | P1 |
| spec-design-implementation-reviewer | `agents/spec-design-implementation-reviewer.agent.md` | 94 | 945 | narrow | low | app/design evidence | low | medium | medium | medium | keep selected only | P2 |
| spec-security-sentinel | `agents/spec-security-sentinel.agent.md` | 95 | 944 | narrow | low | security context | low | medium | high | medium | merge with security reviewer unless unique trigger | P2 |
| spec-previous-comments-reviewer | `agents/spec-previous-comments-reviewer.agent.md` | 69 | 935 | narrow | low | PR comments | low | medium | medium | medium | comment digest not full thread | P2 |
| spec-reliability-reviewer | `agents/spec-reliability-reviewer.agent.md` | 53 | 901 | narrow | medium | diff | low | medium | low | medium | keep conditional | P3 |
| spec-api-contract-reviewer | `agents/spec-api-contract-reviewer.agent.md` | 53 | 888 | narrow | medium | diff/API | low | medium | medium | medium | keep conditional | P3 |
| spec-julik-frontend-races-reviewer | `agents/spec-julik-frontend-races-reviewer.agent.md` | 53 | 872 | narrow | low | frontend diff | low | medium | medium | medium | keep stack-specific | P3 |
| spec-security-lens-reviewer | `agents/spec-security-lens-reviewer.agent.md` | 41 | 869 | narrow | medium | document | low | medium | medium | medium | lens note cap | P2 |
| spec-design-lens-reviewer | `agents/spec-design-lens-reviewer.agent.md` | 49 | 851 | narrow | medium | document/design | low | medium | medium | medium | lens note cap | P2 |
| spec-code-simplicity-reviewer | `agents/spec-code-simplicity-reviewer.agent.md` | 88 | 793 | narrow | medium | diff | high | medium | medium | high | structured findings only | P2 |
| spec-pattern-recognition-specialist | `agents/spec-pattern-recognition-specialist.agent.md` | 59 | 788 | narrow | low | codebase patterns | low | medium | high | medium | merge into maintainability/lens | P2 |
| spec-dhh-rails-reviewer | `agents/spec-dhh-rails-reviewer.agent.md` | 50 | 778 | narrow | low | Rails diff | low | medium | low | medium | keep stack-specific | P3 |
| spec-kieran-python-reviewer | `agents/spec-kieran-python-reviewer.agent.md` | 51 | 777 | narrow | low | Python diff | low | medium | low | medium | keep stack-specific | P3 |
| spec-kieran-rails-reviewer | `agents/spec-kieran-rails-reviewer.agent.md` | 51 | 768 | narrow | low | Rails diff | low | medium | low | medium | keep stack-specific | P3 |
| spec-architecture-strategist | `agents/spec-architecture-strategist.agent.md` | 54 | 762 | narrow | low | architecture context | low | medium | high | medium | lens-only; no final architecture decision | P2 |
| spec-git-history-analyzer | `agents/spec-git-history-analyzer.agent.md` | 48 | 744 | narrow | low | git log | low | medium | medium | medium | commit range cap | P2 |
| spec-data-integrity-guardian | `agents/spec-data-integrity-guardian.agent.md` | 72 | 730 | narrow | low | data flow | high | medium | high | high | merge with data/security/reliability reviewer | P2 |
| spec-kieran-typescript-reviewer | `agents/spec-kieran-typescript-reviewer.agent.md` | 51 | 715 | narrow | low | TS diff | low | medium | low | medium | keep stack-specific | P3 |
| spec-ankane-readme-writer | `agents/spec-ankane-readme-writer.agent.md` | 51 | 654 | narrow | low | README context | low | medium | medium | medium | opt-in writer, not reviewer fanout | P3 |

## Agent 成本结论

最高风险不是小 reviewer 本身，而是：

1. broad researcher agents 需要大 context；
2. code/doc/app review batch 调度会乘法放大；
3. mutating 或 synthesis 类 agent 容易输出长散文；
4. overlapping specialist agents 会重复审同一问题；
5. 部分 reviewer 依赖父 workflow schema，但自身没有足够 compact output contract。
