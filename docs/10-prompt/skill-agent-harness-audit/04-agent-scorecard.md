# Agent Scorecard

Agent scoring is heuristic and source-backed. It checks for role clarity, trigger, non-goals, required inputs, review focus, evidence rules, output format, confidence policy, escalation policy, and forbidden behaviors.

| agent_id | score | rating | strengths | P0_findings | P1_findings | P2_findings | orchestration_overreach | overlap_with_other_agents | output_format_issue | suggested_rewrite | whether_should_remain_agent | whether_should_become_lens | whether_should_merge_with_other_agent |
| --- | ---: | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- | --- | --- | --- |
| spec-adversarial-document-reviewer | 57 | 建议重写 | evidence, confidence | 0 | 1 | 0 | none | 同类型 agent/lens 触发边界需复核 | high | 补 Trigger/Non-goals/Required Inputs/Evidence/Output/Confidence/Forbidden | yes | maybe | none |
| spec-adversarial-reviewer | 93 | 标杆 | evidence, confidence, output | 0 | 0 | 0 | none | 同类型 agent/lens 触发边界需复核 | low | 补 Trigger/Non-goals/Required Inputs/Evidence/Output/Confidence/Forbidden | yes | maybe | none |
| spec-agent-native-reviewer | 65 | 需要重构 | evidence, confidence, output | 0 | 1 | 0 | none | 同类型 agent/lens 触发边界需复核 | low | 补 Trigger/Non-goals/Required Inputs/Evidence/Output/Confidence/Forbidden | yes | maybe | none |
| spec-ankane-readme-writer | 35 | 建议重写 | role prose | 0 | 1 | 0 | none | 同类型 agent/lens 触发边界需复核 | high | 补 Trigger/Non-goals/Required Inputs/Evidence/Output/Confidence/Forbidden | yes | maybe | none |
| spec-api-contract-reviewer | 93 | 标杆 | evidence, confidence, output | 0 | 0 | 0 | none | 同类型 agent/lens 触发边界需复核 | low | 补 Trigger/Non-goals/Required Inputs/Evidence/Output/Confidence/Forbidden | yes | maybe | none |
| spec-architecture-strategist | 44 | 建议重写 | role prose | 0 | 1 | 0 | none | 同类型 agent/lens 触发边界需复核 | high | 补 Trigger/Non-goals/Required Inputs/Evidence/Output/Confidence/Forbidden | yes | maybe | none |
| spec-best-practices-researcher | 57 | 建议重写 | evidence | 0 | 1 | 0 | none | 同类型 agent/lens 触发边界需复核 | high | 补 Trigger/Non-goals/Required Inputs/Evidence/Output/Confidence/Forbidden | yes | maybe | none |
| spec-cli-agent-readiness-reviewer | 59 | 建议重写 | evidence, output | 0 | 1 | 0 | none | 同类型 agent/lens 触发边界需复核 | low | 补 Trigger/Non-goals/Required Inputs/Evidence/Output/Confidence/Forbidden | yes | maybe | none |
| spec-cli-readiness-reviewer | 93 | 标杆 | evidence, confidence, output | 0 | 0 | 0 | none | 同类型 agent/lens 触发边界需复核 | low | 补 Trigger/Non-goals/Required Inputs/Evidence/Output/Confidence/Forbidden | yes | maybe | none |
| spec-code-simplicity-reviewer | 47 | 建议重写 | evidence, output | 0 | 1 | 0 | none | 同类型 agent/lens 触发边界需复核 | low | 补 Trigger/Non-goals/Required Inputs/Evidence/Output/Confidence/Forbidden | yes | maybe | none |
| spec-coherence-reviewer | 75 | 能跑但 Harness 契约不足 | evidence, confidence | 0 | 0 | 1 | candidate | 同类型 agent/lens 触发边界需复核 | high | 补 Trigger/Non-goals/Required Inputs/Evidence/Output/Confidence/Forbidden | yes | maybe | none |
| spec-correctness-reviewer | 93 | 标杆 | evidence, confidence, output | 0 | 0 | 0 | none | 同类型 agent/lens 触发边界需复核 | low | 补 Trigger/Non-goals/Required Inputs/Evidence/Output/Confidence/Forbidden | yes | maybe | none |
| spec-data-integrity-guardian | 36 | 建议重写 | role prose | 0 | 1 | 0 | none | 同类型 agent/lens 触发边界需复核 | high | 补 Trigger/Non-goals/Required Inputs/Evidence/Output/Confidence/Forbidden | yes | maybe | 同族 reviewer/lens 边界复核 |
| spec-data-migration-expert | 49 | 建议重写 | evidence, output | 0 | 1 | 0 | none | 同类型 agent/lens 触发边界需复核 | low | 补 Trigger/Non-goals/Required Inputs/Evidence/Output/Confidence/Forbidden | yes | maybe | 同族 reviewer/lens 边界复核 |
| spec-data-migrations-reviewer | 85 | 可用 | evidence, confidence, output | 0 | 0 | 0 | none | 同类型 agent/lens 触发边界需复核 | low | 补 Trigger/Non-goals/Required Inputs/Evidence/Output/Confidence/Forbidden | yes | maybe | 同族 reviewer/lens 边界复核 |
| spec-deployment-verification-agent | 36 | 建议重写 | output | 0 | 1 | 0 | none | 同类型 agent/lens 触发边界需复核 | low | 补 Trigger/Non-goals/Required Inputs/Evidence/Output/Confidence/Forbidden | yes | maybe | none |
| spec-design-implementation-reviewer | 49 | 建议重写 | evidence | 0 | 1 | 0 | none | 同类型 agent/lens 触发边界需复核 | high | 补 Trigger/Non-goals/Required Inputs/Evidence/Output/Confidence/Forbidden | yes | maybe | 同族 reviewer/lens 边界复核 |
| spec-design-iterator | 36 | P0：退役或迁入 workflow | output | 1 | 1 | 0 | high | 同类型 agent/lens 触发边界需复核 | low | 取消 proactive mutating agent 形态；如保留，改为 parent workflow 明确拥有输入、写入、停止条件与验证 | no | no | move into explicit workflow phase |
| spec-design-lens-reviewer | 65 | 需要重构 | evidence, confidence, output | 0 | 1 | 0 | candidate | 同类型 agent/lens 触发边界需复核 | low | 补 Trigger/Non-goals/Required Inputs/Evidence/Output/Confidence/Forbidden | maybe | yes | 同族 reviewer/lens 边界复核 |
| spec-dhh-rails-reviewer | 77 | 能跑但 Harness 契约不足 | evidence, confidence, output | 0 | 0 | 1 | none | 同类型 agent/lens 触发边界需复核 | low | 补 Trigger/Non-goals/Required Inputs/Evidence/Output/Confidence/Forbidden | yes | maybe | none |
| spec-feasibility-reviewer | 65 | 需要重构 | evidence, confidence | 0 | 1 | 0 | candidate | 同类型 agent/lens 触发边界需复核 | high | 补 Trigger/Non-goals/Required Inputs/Evidence/Output/Confidence/Forbidden | yes | maybe | none |
| spec-figma-design-sync | 36 | P0：退役或拆分 | role prose | 1 | 1 | 0 | high | 同类型 agent/lens 触发边界需复核 | high | 拆成 read-only Figma/browser diagnosis 与 workflow-owned implementation；agent 不直接拥有代码修改/完成判断 | no | maybe | split into diagnosis + workflow mutation |
| spec-framework-docs-researcher | 56 | 建议重写 | output | 0 | 1 | 0 | none | 同类型 agent/lens 触发边界需复核 | low | 补 Trigger/Non-goals/Required Inputs/Evidence/Output/Confidence/Forbidden | yes | maybe | none |
| spec-git-history-analyzer | 59 | 建议重写 | evidence | 0 | 1 | 0 | none | 同类型 agent/lens 触发边界需复核 | high | 补 Trigger/Non-goals/Required Inputs/Evidence/Output/Confidence/Forbidden | yes | maybe | none |
| spec-issue-intelligence-analyst | 69 | 需要重构 | evidence, confidence, output | 0 | 1 | 0 | candidate | 同类型 agent/lens 触发边界需复核 | low | 补 Trigger/Non-goals/Required Inputs/Evidence/Output/Confidence/Forbidden | yes | maybe | none |
| spec-julik-frontend-races-reviewer | 85 | 可用 | evidence, confidence, output | 0 | 0 | 0 | none | 同类型 agent/lens 触发边界需复核 | low | 补 Trigger/Non-goals/Required Inputs/Evidence/Output/Confidence/Forbidden | yes | maybe | none |
| spec-kieran-python-reviewer | 85 | 可用 | evidence, confidence, output | 0 | 0 | 0 | none | 同类型 agent/lens 触发边界需复核 | low | 补 Trigger/Non-goals/Required Inputs/Evidence/Output/Confidence/Forbidden | yes | maybe | 同族 reviewer/lens 边界复核 |
| spec-kieran-rails-reviewer | 85 | 可用 | evidence, confidence, output | 0 | 0 | 0 | none | 同类型 agent/lens 触发边界需复核 | low | 补 Trigger/Non-goals/Required Inputs/Evidence/Output/Confidence/Forbidden | yes | maybe | 同族 reviewer/lens 边界复核 |
| spec-kieran-typescript-reviewer | 77 | 能跑但 Harness 契约不足 | evidence, confidence, output | 0 | 0 | 1 | none | 同类型 agent/lens 触发边界需复核 | low | 补 Trigger/Non-goals/Required Inputs/Evidence/Output/Confidence/Forbidden | yes | maybe | 同族 reviewer/lens 边界复核 |
| spec-learnings-researcher | 69 | 需要重构 | evidence, confidence, output | 0 | 1 | 0 | candidate | 同类型 agent/lens 触发边界需复核 | low | 补 Trigger/Non-goals/Required Inputs/Evidence/Output/Confidence/Forbidden | yes | maybe | none |
| spec-maintainability-reviewer | 85 | 可用 | evidence, confidence, output | 0 | 0 | 0 | none | 同类型 agent/lens 触发边界需复核 | low | 补 Trigger/Non-goals/Required Inputs/Evidence/Output/Confidence/Forbidden | yes | maybe | none |
| spec-pattern-recognition-specialist | 36 | 建议重写 | role prose | 0 | 1 | 0 | none | 同类型 agent/lens 触发边界需复核 | high | 补 Trigger/Non-goals/Required Inputs/Evidence/Output/Confidence/Forbidden | yes | maybe | none |
| spec-performance-oracle | 42 | 建议重写 | output | 0 | 1 | 0 | none | 同类型 agent/lens 触发边界需复核 | low | 补 Trigger/Non-goals/Required Inputs/Evidence/Output/Confidence/Forbidden | yes | maybe | 同族 reviewer/lens 边界复核 |
| spec-performance-reviewer | 93 | 标杆 | evidence, confidence, output | 0 | 0 | 0 | none | 同类型 agent/lens 触发边界需复核 | low | 补 Trigger/Non-goals/Required Inputs/Evidence/Output/Confidence/Forbidden | yes | maybe | 同族 reviewer/lens 边界复核 |
| spec-pr-comment-resolver | 45 | 建议重写 | evidence | 0 | 1 | 0 | candidate | 同类型 agent/lens 触发边界需复核 | high | 补 Trigger/Non-goals/Required Inputs/Evidence/Output/Confidence/Forbidden | yes | maybe | none |
| spec-previous-comments-reviewer | 85 | 可用 | evidence, confidence, output | 0 | 0 | 0 | none | 同类型 agent/lens 触发边界需复核 | low | 补 Trigger/Non-goals/Required Inputs/Evidence/Output/Confidence/Forbidden | yes | maybe | none |
| spec-product-lens-reviewer | 55 | 建议重写 | evidence, confidence | 0 | 1 | 0 | candidate | 同类型 agent/lens 触发边界需复核 | high | 补 Trigger/Non-goals/Required Inputs/Evidence/Output/Confidence/Forbidden | maybe | yes | none |
| spec-project-standards-reviewer | 85 | 可用 | evidence, confidence, output | 0 | 0 | 0 | none | 同类型 agent/lens 触发边界需复核 | low | 补 Trigger/Non-goals/Required Inputs/Evidence/Output/Confidence/Forbidden | yes | maybe | none |
| spec-reliability-reviewer | 85 | 可用 | evidence, confidence, output | 0 | 0 | 0 | none | 同类型 agent/lens 触发边界需复核 | low | 补 Trigger/Non-goals/Required Inputs/Evidence/Output/Confidence/Forbidden | yes | maybe | none |
| spec-repo-research-analyst | 59 | 建议重写 | evidence, output | 0 | 1 | 0 | none | 同类型 agent/lens 触发边界需复核 | low | 补 Trigger/Non-goals/Required Inputs/Evidence/Output/Confidence/Forbidden | yes | maybe | none |
| spec-schema-drift-detector | 54 | 建议重写 | output | 0 | 1 | 0 | none | 同类型 agent/lens 触发边界需复核 | low | 补 Trigger/Non-goals/Required Inputs/Evidence/Output/Confidence/Forbidden | yes | maybe | none |
| spec-scope-guardian-reviewer | 55 | 建议重写 | evidence, confidence | 0 | 1 | 0 | candidate | 同类型 agent/lens 触发边界需复核 | high | 补 Trigger/Non-goals/Required Inputs/Evidence/Output/Confidence/Forbidden | yes | maybe | none |
| spec-security-lens-reviewer | 55 | 建议重写 | evidence, confidence | 0 | 1 | 0 | candidate | 同类型 agent/lens 触发边界需复核 | high | 补 Trigger/Non-goals/Required Inputs/Evidence/Output/Confidence/Forbidden | maybe | yes | 同族 reviewer/lens 边界复核 |
| spec-security-reviewer | 93 | 标杆 | evidence, confidence, output | 0 | 0 | 0 | none | 同类型 agent/lens 触发边界需复核 | low | 补 Trigger/Non-goals/Required Inputs/Evidence/Output/Confidence/Forbidden | yes | maybe | 同族 reviewer/lens 边界复核 |
| spec-security-sentinel | 60 | 需要重构 | role prose | 0 | 1 | 0 | none | 同类型 agent/lens 触发边界需复核 | high | 补 Trigger/Non-goals/Required Inputs/Evidence/Output/Confidence/Forbidden | yes | maybe | 同族 reviewer/lens 边界复核 |
| spec-session-historian | 59 | 建议重写 | evidence, confidence, output | 0 | 1 | 0 | candidate | 同类型 agent/lens 触发边界需复核 | low | 补 Trigger/Non-goals/Required Inputs/Evidence/Output/Confidence/Forbidden | yes | maybe | none |
| spec-slack-researcher | 52 | 建议重写 | output | 0 | 1 | 0 | candidate | 同类型 agent/lens 触发边界需复核 | low | 补 Trigger/Non-goals/Required Inputs/Evidence/Output/Confidence/Forbidden | yes | maybe | none |
| spec-spec-flow-analyzer | 54 | 建议重写 | output | 0 | 1 | 0 | none | 同类型 agent/lens 触发边界需复核 | low | 补 Trigger/Non-goals/Required Inputs/Evidence/Output/Confidence/Forbidden | yes | maybe | none |
| spec-swift-ios-reviewer | 85 | 可用 | evidence, confidence, output | 0 | 0 | 0 | candidate | 同类型 agent/lens 触发边界需复核 | low | 补 Trigger/Non-goals/Required Inputs/Evidence/Output/Confidence/Forbidden | yes | maybe | none |
| spec-testing-reviewer | 85 | 可用 | evidence, confidence, output | 0 | 0 | 0 | none | 同类型 agent/lens 触发边界需复核 | low | 补 Trigger/Non-goals/Required Inputs/Evidence/Output/Confidence/Forbidden | yes | maybe | none |
| spec-web-researcher | 65 | 需要重构 | evidence, output | 0 | 1 | 0 | candidate | 同类型 agent/lens 触发边界需复核 | low | 补 Trigger/Non-goals/Required Inputs/Evidence/Output/Confidence/Forbidden | yes | maybe | none |

## Agent Scorecard Notes

- The best reusable agent template is the code-review persona pattern: trigger in frontmatter, what to hunt for, confidence anchors, what not to flag, JSON output.
- The weakest agents are mostly older expert profiles with broad prose and no stable finding schema.
- Lens-like document reviewers should either declare themselves as lenses with freeform synthesis owned by `spec-doc-review`, or adopt the shared review-finding schema. The dangerous middle is a persona that emits unstructured final judgment while the parent skill expects mergeable findings.
- The two P0 agent findings are not “low-score cleanup.” They violate the role contract: agents are local expert judgment roles, not workflow orchestrators or source-mutating completion engines.
