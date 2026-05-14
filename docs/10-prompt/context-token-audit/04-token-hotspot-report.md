# Token Hotspot Report

## Top 20 Hotspots

| hotspot_id | location | type | description / why_it_costs_tokens | estimated_impact | affected_workflows | current_behavior | recommended_change | expected_saving | risk | priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| H01 | `.spec-first/audits/skill-audit/*/skill-source-inventory.json` | runtime_mirror_duplication | 多份旧 inventory，每份约 60 万 token；一旦被默认扫描会污染上下文 | very high | skill-audit, sessions, generic repo search | runtime artifact 保留多份 full JSON | `.spec-first/audits` 默认排除；只读 `latest/skill-audit-summary.md` 和 path refs | 20%-40% for audit/search runs | 低，source 不变 | P0 |
| H02 | `skills/spec-code-review/SKILL.md` | huge_skill_md | 约 24k tokens，高频 workflow，每次 review 前加载大正文 | very high | code-review, work shipping review | core + persona + synthesis + fixer + artifact 全在正文 | core 压到 <4k；persona/synthesis/walkthrough refs 按需 | 8k-15k tokens/run | 中，需要保持 review 质量 | P0 |
| H03 | code-review reviewer dispatch | all_agents_fanout | 默认 core + conditional + stack reviewer，diff/context 乘以 reviewer 数 | very high | code-review | 有 scale-aware preflight，但仍可能高 fanout | reviewer budget：tiny 2-3，normal 4-6，sensitive max 8；每 reviewer context slice | 30%-50% review token | 中，漏审风险 | P0 |
| H04 | `skills/spec-plan/SKILL.md` | huge_skill_md | 约 14.6k tokens，计划入口高频，包含 research 和 artifact rules | high | plan, brainstorm handoff | 长正文直接加载 | contract summary + planning refs + examples refs | 5k-8k/run | 低中 | P0 |
| H05 | `skills/spec-work/SKILL.md` | huge_skill_md | 约 10.5k tokens，高频执行入口 | high | work/debug handoff | branch/task-pack/subagent/test/shipping 全量 | task-pack、branch、shipping、subagent 分 refs | 4k-6k/run | 中 | P0 |
| H06 | `skills/spec-doc-review/SKILL.md` + full document per reviewer | repeated_artifact_copy | 每个 persona 都拿 full document，且 persona file/schema/pre-facts 重复 | high | doc-review, plan review | full document fanout | document section map + reviewer-specific slice + shared schema id | 30%-50% doc-review | 中 | P0 |
| H07 | `skills/spec-compound/SKILL.md` full mode | verbose_compound_notes | 默认 full mode 可拉 session history、related docs、parallel agents | high | compound | 用户若选 full，context 快速膨胀 | lightweight 默认；full explicit；compound delta/index | 30%-60% compound | 低中 | P0 |
| H08 | `skills/spec-compound-refresh/SKILL.md` | huge_skill_md | 约 11.2k tokens，且报告要求 full markdown | high | compound-refresh | broad sweep 可能读多个 docs/solutions | narrow scope default；per-action refs；summary + appendix | 4k/run + report size | 低中 | P1 |
| H09 | `.claude/` + `.agents/skills/` runtime mirrors | source_runtime_boundary_confusion | runtime mirror 与 source skills 重复；`.claude` 4.3MB、`.agents/skills` 3.2MB | high | any repo-wide scan | source/runtime 可能同时进入上下文 | context router 默认排除 mirrors；drift workflow 才读取 | 10%-25% generic scans | 低 | P0 |
| H10 | graph-bootstrap provider diagnostics | long_tool_result | provider status 包含 diagnostics、raw logs、query output | medium-high | graph-bootstrap, work/review pre-facts | summary 中仍嵌诊断字符串 | diagnostics cap 500-1000 chars；raw path only；compact readiness | 2k-8k graph runs | 低 | P1 |
| H11 | `CHANGELOG.md` | long_embedded_reference | 约 82k tokens，常被 source scan 排名前列 | medium-high | release, changelog, review | 全量 changelog 易被读入 | changelog latest-window index；release notes summary | 20k-70k when touched | 低 | P1 |
| H12 | historical plans under `docs/plans/` | all_docs_context | 多个单文档 10k-37k tokens，历史 freshness 不一 | medium-high | plan, research, sessions | 搜索命中后可能读全文件 | frontmatter/status index + summary first | 10k+ per doc | 低 | P1 |
| H13 | broad research agents | huge_agent_md | `spec-repo-research-analyst`、`spec-learnings-researcher` 等要读大上下文 | medium-high | plan, compound, sessions | agent 自行探索 | context-request only，max sources/evidence refs | 20%-40% research | 中 | P1 |
| H14 | app-audit multi-source context | no_context_bundle | PRD/Figma/source/rule packs/scripts 多源组合 | medium-high | app-consistency-audit, code-review | 已有 artifacts，但 expert selection 仍复杂 | audit-plan selected experts + issue cap + compact bundle | 20%-40% app audit | 中 | P1 |
| H15 | skill-audit generated reports | no_summary_mode | script 写 full inventory/report/scorecard，多份历史保留 | medium-high | skill-audit | full JSON 持久化 | default summary-only + `--full` opt-in + retention | 50%+ audit artifacts | 中 | P0 |
| H16 | `spec-mcp-setup` scripts and repair recipes | no_reference_file_split | setup skill 约 9k tokens，33 scripts，跨 host 细节多 | medium | mcp-setup, update | 细节集中 | recipes refs + compact setup ladder | 3k-5k/run | 中 | P1 |
| H17 | sessions synthesis | session_history_accumulation | session files 1-7MB，历史恢复天然高风险 | medium | sessions, compound | 已禁止全读，但 output 可长 | max 5 sessions 已有；再加 digest budget和 quote cap | 30% sessions | 低 | P1 |
| H18 | doc-review / code-review synthesis prose | verbose_review_report | 下游通常只需要 findings/verdict，但报告可很长 | medium | doc-review, code-review, work | human-readable report 为主 | `findings.json` + compact envelope；full report debug only | 20%-40% review handoff | 低中 | P1 |
| H19 | examples embedded in high-frequency skills | repeated_examples_in_skill | `spec-code-review` examples/fences 多，`spec-mcp-setup` examples 76 hits | medium | code-review, mcp-setup | examples 与 core 同时加载 | examples-as-context refs，按 eval/fresh-source 才读 | 1k-5k/run | 低 | P2 |
| H20 | missing global context budget | no_context_budget | budget 只局部出现，没有 workflow-wide policy | high systemic | all workflows | 每个 workflow 自行节制 | `token-budget-policy.md` + linter + context router enforcement | 30%-70% long-term | 中 | P0 |

## 最高杠杆组合

优先组合 H01 + H02 + H03 + H05 + H06 + H20。它们覆盖 runtime 污染、高频入口、review fanout 和全局预算四个主因，是最可能快速降低 30% 以上 token 成本的路径。
