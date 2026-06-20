# Skill / Agent 详细审查报告索引

## 1. 审查说明

本目录基于 `../2026-06-20-全量-skill-agent-优化建议.md` 生成逐项详细审查报告。每份单项报告都按三个视角合议：`$yao-meta-skill`、`$skill-creator:skill-creator`、spec-first 项目架构师，并区分事实、推断、假设和待验证项。

本次审查只写 source 文档，不修改 `skills/`、`agents/`、CLI 或 generated runtime mirrors。

## 2. 报告清单

| 序号 | 类型 | 名称 | 报告文件 | 最终建议 | 优先级 |
|---|---|---|---|---|---|
| 1 | Skill | `agent-native-architecture` | `Skill-01-agent-native-architecture-详细审查报告.md` | 优化 | P2 |
| 2 | Skill | `agent-native-audit` | `Skill-02-agent-native-audit-详细审查报告.md` | 重构 | P1 |
| 3 | Skill | `changelog` | `Skill-03-changelog-详细审查报告.md` | 优化 | P1 |
| 4 | Skill | `feature-video` | `Skill-04-feature-video-详细审查报告.md` | 优化 | P1 |
| 5 | Skill | `frontend-design` | `Skill-05-frontend-design-详细审查报告.md` | 优化 | P1 |
| 6 | Skill | `gemini-imagegen` | `Skill-06-gemini-imagegen-详细审查报告.md` | 优化 | P1 |
| 7 | Skill | `git-clean-gone-branches` | `Skill-07-git-clean-gone-branches-详细审查报告.md` | 优化 | P1 |
| 8 | Skill | `git-commit` | `Skill-08-git-commit-详细审查报告.md` | 优化 | P1 |
| 9 | Skill | `git-commit-push-pr` | `Skill-09-git-commit-push-pr-详细审查报告.md` | 优化 | P1 |
| 10 | Skill | `git-worktree` | `Skill-10-git-worktree-详细审查报告.md` | 优化 | P1 |
| 11 | Skill | `proof` | `Skill-11-proof-详细审查报告.md` | 优化 | P1 |
| 12 | Skill | `report-bug` | `Skill-12-report-bug-详细审查报告.md` | 优化 | P1 |
| 13 | Skill | `resolve-pr-feedback` | `Skill-13-resolve-pr-feedback-详细审查报告.md` | 优化 | P1 |
| 14 | Skill | `spec-app-consistency-audit` | `Skill-14-spec-app-consistency-audit-详细审查报告.md` | 优化 | P1 |
| 15 | Skill | `spec-brainstorm` | `Skill-15-spec-brainstorm-详细审查报告.md` | 优化 | P1 |
| 16 | Skill | `spec-code-review` | `Skill-16-spec-code-review-详细审查报告.md` | 重构 | P1 |
| 17 | Skill | `spec-compound` | `Skill-17-spec-compound-详细审查报告.md` | 重构 | P1 |
| 18 | Skill | `spec-compound-refresh` | `Skill-18-spec-compound-refresh-详细审查报告.md` | 重构 | P1 |
| 19 | Skill | `spec-debug` | `Skill-19-spec-debug-详细审查报告.md` | 优化 | P2 |
| 20 | Skill | `spec-dhh-rails-style` | `Skill-20-spec-dhh-rails-style-详细审查报告.md` | 优化 | P2 |
| 21 | Skill | `spec-doc-review` | `Skill-21-spec-doc-review-详细审查报告.md` | 优化 | P1 |
| 22 | Skill | `spec-ideate` | `Skill-22-spec-ideate-详细审查报告.md` | 优化 | P1 |
| 23 | Skill | `spec-mcp-setup` | `Skill-23-spec-mcp-setup-详细审查报告.md` | 优化 | P1 |
| 24 | Skill | `spec-optimize` | `Skill-24-spec-optimize-详细审查报告.md` | 重构 | P1 |
| 25 | Skill | `spec-plan` | `Skill-25-spec-plan-详细审查报告.md` | 重构 | P1 |
| 26 | Skill | `spec-polish-beta` | `Skill-26-spec-polish-beta-详细审查报告.md` | 优化 | P2 |
| 27 | Skill | `spec-prd` | `Skill-27-spec-prd-详细审查报告.md` | 优化 | P2 |
| 28 | Skill | `spec-release-notes` | `Skill-28-spec-release-notes-详细审查报告.md` | 优化 | P2 |
| 29 | Skill | `spec-sessions` | `Skill-29-spec-sessions-详细审查报告.md` | 优化 | P1 |
| 30 | Skill | `spec-skill-audit` | `Skill-30-spec-skill-audit-详细审查报告.md` | 优化 | P1 |
| 31 | Skill | `spec-slack-research` | `Skill-31-spec-slack-research-详细审查报告.md` | 优化 | P1 |
| 32 | Skill | `spec-work` | `Skill-32-spec-work-详细审查报告.md` | 重构 | P1 |
| 33 | Skill | `spec-write-tasks` | `Skill-33-spec-write-tasks-详细审查报告.md` | 优化 | P2 |
| 34 | Skill | `test-browser` | `Skill-34-test-browser-详细审查报告.md` | 优化 | P1 |
| 35 | Skill | `test-xcode` | `Skill-35-test-xcode-详细审查报告.md` | 优化 | P1 |
| 36 | Skill | `using-spec-first` | `Skill-36-using-spec-first-详细审查报告.md` | 优化 | P2 |
| 37 | Agent | `spec-adversarial-document-reviewer` | `Agent-01-spec-adversarial-document-reviewer-详细审查报告.md` | 优化 | P2 |
| 38 | Agent | `spec-adversarial-reviewer` | `Agent-02-spec-adversarial-reviewer-详细审查报告.md` | 优化 | P2 |
| 39 | Agent | `spec-agent-native-reviewer` | `Agent-03-spec-agent-native-reviewer-详细审查报告.md` | 优化 | P2 |
| 40 | Agent | `spec-ankane-readme-writer` | `Agent-04-spec-ankane-readme-writer-详细审查报告.md` | 废弃 | P1 |
| 41 | Agent | `spec-api-contract-reviewer` | `Agent-05-spec-api-contract-reviewer-详细审查报告.md` | 优化 | P2 |
| 42 | Agent | `spec-architecture-strategist` | `Agent-06-spec-architecture-strategist-详细审查报告.md` | 优化 | P1 |
| 43 | Agent | `spec-best-practices-researcher` | `Agent-07-spec-best-practices-researcher-详细审查报告.md` | 优化 | P1 |
| 44 | Agent | `spec-cli-agent-readiness-reviewer` | `Agent-08-spec-cli-agent-readiness-reviewer-详细审查报告.md` | 重构 | P1 |
| 45 | Agent | `spec-cli-readiness-reviewer` | `Agent-09-spec-cli-readiness-reviewer-详细审查报告.md` | 优化 | P2 |
| 46 | Agent | `spec-code-simplicity-reviewer` | `Agent-10-spec-code-simplicity-reviewer-详细审查报告.md` | 优化 | P2 |
| 47 | Agent | `spec-coherence-reviewer` | `Agent-11-spec-coherence-reviewer-详细审查报告.md` | 优化 | P2 |
| 48 | Agent | `spec-correctness-reviewer` | `Agent-12-spec-correctness-reviewer-详细审查报告.md` | 优化 | P2 |
| 49 | Agent | `spec-data-integrity-guardian` | `Agent-13-spec-data-integrity-guardian-详细审查报告.md` | 优化 | P1 |
| 50 | Agent | `spec-data-migration-expert` | `Agent-14-spec-data-migration-expert-详细审查报告.md` | 优化 | P1 |
| 51 | Agent | `spec-data-migrations-reviewer` | `Agent-15-spec-data-migrations-reviewer-详细审查报告.md` | 优化 | P2 |
| 52 | Agent | `spec-deployment-verification-agent` | `Agent-16-spec-deployment-verification-agent-详细审查报告.md` | 优化 | P1 |
| 53 | Agent | `spec-design-implementation-reviewer` | `Agent-17-spec-design-implementation-reviewer-详细审查报告.md` | 优化 | P1 |
| 54 | Agent | `spec-design-iterator` | `Agent-18-spec-design-iterator-详细审查报告.md` | 优化 | P1 |
| 55 | Agent | `spec-design-lens-reviewer` | `Agent-19-spec-design-lens-reviewer-详细审查报告.md` | 优化 | P2 |
| 56 | Agent | `spec-dhh-rails-reviewer` | `Agent-20-spec-dhh-rails-reviewer-详细审查报告.md` | 优化 | P2 |
| 57 | Agent | `spec-feasibility-reviewer` | `Agent-21-spec-feasibility-reviewer-详细审查报告.md` | 优化 | P2 |
| 58 | Agent | `spec-figma-design-sync` | `Agent-22-spec-figma-design-sync-详细审查报告.md` | 重构 | P1 |
| 59 | Agent | `spec-framework-docs-researcher` | `Agent-23-spec-framework-docs-researcher-详细审查报告.md` | 优化 | P1 |
| 60 | Agent | `spec-git-history-analyzer` | `Agent-24-spec-git-history-analyzer-详细审查报告.md` | 优化 | P2 |
| 61 | Agent | `spec-issue-intelligence-analyst` | `Agent-25-spec-issue-intelligence-analyst-详细审查报告.md` | 优化 | P1 |
| 62 | Agent | `spec-julik-frontend-races-reviewer` | `Agent-26-spec-julik-frontend-races-reviewer-详细审查报告.md` | 优化 | P2 |
| 63 | Agent | `spec-kieran-python-reviewer` | `Agent-27-spec-kieran-python-reviewer-详细审查报告.md` | 优化 | P2 |
| 64 | Agent | `spec-kieran-rails-reviewer` | `Agent-28-spec-kieran-rails-reviewer-详细审查报告.md` | 优化 | P2 |
| 65 | Agent | `spec-kieran-typescript-reviewer` | `Agent-29-spec-kieran-typescript-reviewer-详细审查报告.md` | 优化 | P2 |
| 66 | Agent | `spec-learnings-researcher` | `Agent-30-spec-learnings-researcher-详细审查报告.md` | 优化 | P2 |
| 67 | Agent | `spec-maintainability-reviewer` | `Agent-31-spec-maintainability-reviewer-详细审查报告.md` | 优化 | P2 |
| 68 | Agent | `spec-pattern-recognition-specialist` | `Agent-32-spec-pattern-recognition-specialist-详细审查报告.md` | 合并 | P1 |
| 69 | Agent | `spec-performance-oracle` | `Agent-33-spec-performance-oracle-详细审查报告.md` | 重构 | P1 |
| 70 | Agent | `spec-performance-reviewer` | `Agent-34-spec-performance-reviewer-详细审查报告.md` | 优化 | P2 |
| 71 | Agent | `spec-pr-comment-resolver` | `Agent-35-spec-pr-comment-resolver-详细审查报告.md` | 优化 | P1 |
| 72 | Agent | `spec-previous-comments-reviewer` | `Agent-36-spec-previous-comments-reviewer-详细审查报告.md` | 优化 | P2 |
| 73 | Agent | `spec-product-lens-reviewer` | `Agent-37-spec-product-lens-reviewer-详细审查报告.md` | 优化 | P2 |
| 74 | Agent | `spec-project-standards-reviewer` | `Agent-38-spec-project-standards-reviewer-详细审查报告.md` | 优化 | P2 |
| 75 | Agent | `spec-reliability-reviewer` | `Agent-39-spec-reliability-reviewer-详细审查报告.md` | 优化 | P2 |
| 76 | Agent | `spec-repo-research-analyst` | `Agent-40-spec-repo-research-analyst-详细审查报告.md` | 重构 | P1 |
| 77 | Agent | `spec-schema-drift-detector` | `Agent-41-spec-schema-drift-detector-详细审查报告.md` | 优化 | P1 |
| 78 | Agent | `spec-scope-guardian-reviewer` | `Agent-42-spec-scope-guardian-reviewer-详细审查报告.md` | 优化 | P2 |
| 79 | Agent | `spec-security-lens-reviewer` | `Agent-43-spec-security-lens-reviewer-详细审查报告.md` | 优化 | P2 |
| 80 | Agent | `spec-security-reviewer` | `Agent-44-spec-security-reviewer-详细审查报告.md` | 优化 | P1 |
| 81 | Agent | `spec-security-sentinel` | `Agent-45-spec-security-sentinel-详细审查报告.md` | 合并 | P1 |
| 82 | Agent | `spec-session-historian` | `Agent-46-spec-session-historian-详细审查报告.md` | 优化 | P2 |
| 83 | Agent | `spec-slack-researcher` | `Agent-47-spec-slack-researcher-详细审查报告.md` | 优化 | P1 |
| 84 | Agent | `spec-spec-flow-analyzer` | `Agent-48-spec-spec-flow-analyzer-详细审查报告.md` | 优化 | P2 |
| 85 | Agent | `spec-swift-ios-reviewer` | `Agent-49-spec-swift-ios-reviewer-详细审查报告.md` | 优化 | P2 |
| 86 | Agent | `spec-testing-reviewer` | `Agent-50-spec-testing-reviewer-详细审查报告.md` | 优化 | P2 |
| 87 | Agent | `spec-web-researcher` | `Agent-51-spec-web-researcher-详细审查报告.md` | 重构 | P1 |

## 3. 全局终审报告

- `99-全局终审报告.md`

## 4. 推荐阅读顺序

1. 先读 `00-审查清单.md`，确认覆盖范围和原报告位置。
2. 再读 `99-全局终审报告.md`，理解全局问题分布和路线图。
3. 按 P0/P1 优先读单项报告，尤其是 `spec-skill-audit`、高权限 helper、`spec-code-review`、`spec-plan`、`spec-work` 和 Agent lifecycle 相关对象。
4. 最后读 P2 对象，作为中期 progressive disclosure、eval fixture 和 catalog 清理依据。

## 5. 后续优化建议

- 不要把本目录报告当作已授权 source 修改；每批实施仍需进入相应 workflow。
- P1 修改应同步 `CHANGELOG.md`、focused tests、必要的 fresh-source eval 说明。
- 涉及外部 API/MCP/current docs 的对象，实施前必须浏览官方或 primary source；无法验证的内容保留为待验证项。
- 废弃/合并候选必须先做消费者回源，避免删除仍被 workflow 使用的对象。
