# Skill Token Inventory

## 统计口径

字段按 `docs/10-prompt/审查token.md` 要求输出。`estimated_tokens` 为近似估算，`size_level` 使用 prompt 建议阈值：

- `small`: `< 1,500`
- `medium`: `1,500-4,000`
- `large`: `4,000-8,000`
- `huge`: `> 8,000`

`likely_loaded_frequency` 基于 workflow 入口频率、高频链路位置和当前 repo usage 判断；`context_cost_risk` 同时考虑 size、触发频率、默认上下文读取和 fanout。

## 补充统计指标

下表覆盖 prompt 要求的 section、examples、embedded long text、references、scripts、progressive disclosure、context policy、token budget、compact output mode 和 artifact reference mode。`embedded_long_text` 近似统计 20 行以上 fenced block 与超长段落。

| skill_id | sections | examples | embedded_long_text | references | scripts | progressive_disclosure | context_policy | token_budget | compact_output_mode | artifact_reference_mode |
|---|---:|---:|---:|---:|---:|---|---|---|---|---|
| spec-code-review | 59 | 45 | 28 | 9 | 1 | yes | yes | yes | yes | yes |
| spec-plan | 59 | 11 | 11 | 6 | 0 | yes | yes | no | yes | yes |
| spec-compound-refresh | 47 | 14 | 5 | 3 | 1 | yes | yes | no | yes | yes |
| spec-work-beta | 21 | 16 | 11 | 3 | 0 | yes | yes | no | yes | yes |
| spec-work | 29 | 16 | 11 | 3 | 0 | yes | yes | no | yes | yes |
| spec-ideate | 18 | 4 | 6 | 3 | 0 | yes | yes | yes | yes | yes |
| spec-mcp-setup | 23 | 76 | 10 | 2 | 33 | yes | yes | no | yes | yes |
| spec-optimize | 47 | 38 | 2 | 7 | 3 | yes | yes | yes | yes | yes |
| spec-compound | 33 | 25 | 7 | 2 | 1 | yes | yes | no | yes | yes |
| spec-graph-bootstrap | 18 | 26 | 9 | 5 | 4 | yes | yes | no | yes | yes |
| spec-write-tasks | 28 | 2 | 6 | 7 | 0 | yes | yes | no | yes | yes |
| spec-debug | 20 | 2 | 0 | 3 | 0 | yes | yes | no | yes | yes |
| spec-brainstorm | 19 | 1 | 3 | 5 | 0 | yes | yes | no | yes | yes |
| using-spec-first | 26 | 5 | 4 | 1 | 0 | no | yes | no | yes | yes |
| spec-doc-review | 29 | 5 | 3 | 10 | 0 | yes | yes | no | yes | yes |
| spec-standards | 28 | 16 | 2 | 0 | 4 | yes | yes | yes | yes | yes |
| git-commit-push-pr | 19 | 18 | 1 | 2 | 0 | yes | yes | no | yes | yes |
| proof | 27 | 28 | 5 | 1 | 0 | yes | no | no | yes | yes |
| frontend-design | 28 | 3 | 0 | 0 | 0 | yes | yes | no | no | yes |
| feature-video | 13 | 10 | 1 | 5 | 1 | yes | yes | no | yes | yes |
| agent-native-architecture | 11 | 12 | 2 | 15 | 0 | yes | yes | no | yes | yes |
| spec-app-consistency-audit | 19 | 22 | 2 | 3 | 21 | yes | yes | no | yes | yes |
| spec-sessions | 16 | 19 | 3 | 0 | 7 | yes | yes | yes | yes | yes |
| test-browser | 35 | 35 | 5 | 0 | 0 | yes | no | no | yes | yes |
| spec-release-notes | 10 | 19 | 1 | 0 | 3 | yes | yes | no | yes | yes |
| agent-native-audit | 53 | 20 | 4 | 0 | 0 | yes | yes | no | yes | yes |
| spec-update | 9 | 30 | 0 | 0 | 3 | no | no | no | yes | yes |
| git-commit | 9 | 6 | 0 | 0 | 0 | no | yes | no | yes | no |
| lfg | 1 | 4 | 0 | 1 | 0 | yes | yes | no | yes | yes |
| test-xcode | 25 | 11 | 1 | 0 | 0 | no | no | no | yes | yes |
| spec-skill-audit | 11 | 10 | 0 | 14 | 19 | yes | yes | no | yes | yes |
| gemini-imagegen | 39 | 24 | 1 | 0 | 10 | yes | no | no | no | no |
| git-worktree | 8 | 7 | 0 | 0 | 1 | yes | yes | no | no | yes |
| spec-dhh-rails-style | 11 | 10 | 1 | 6 | 0 | yes | yes | no | no | no |
| changelog | 19 | 2 | 0 | 0 | 0 | yes | yes | no | yes | yes |
| report-bug | 16 | 10 | 1 | 0 | 0 | no | yes | no | yes | yes |
| resolve-pr-feedback | 6 | 0 | 0 | 2 | 4 | yes | yes | no | yes | yes |
| spec-polish-beta | 9 | 2 | 0 | 11 | 4 | yes | yes | no | yes | yes |
| git-clean-gone-branches | 5 | 6 | 0 | 0 | 1 | no | no | no | no | yes |
| spec-slack-research | 4 | 5 | 0 | 0 | 0 | no | yes | no | no | no |

## 主 inventory

| skill_id | path | lines | estimated_tokens | size_level | likely_loaded_frequency | context_cost_risk | primary_cost_reason | optimization_candidate | priority |
| --- | --- | ---: | ---: | --- | --- | --- | --- | --- | --- |
| spec-code-review | `skills/spec-code-review/SKILL.md` | 1042 | 24056 | huge | high | high | 高频 review workflow，正文包含完整 dispatch、schema、synthesis、autofix、artifact 和 routing 规则 | 拆成 core orchestrator + persona catalog + synthesis refs + mode refs；默认只读 compact catalog | P0 |
| spec-plan | `skills/spec-plan/SKILL.md` | 712 | 14576 | huge | high | high | 计划 workflow 同时承载需求解析、research、review、artifact、handoff | 拆分 planning core、research refs、artifact contract、examples；生成 plan summary | P0 |
| spec-compound-refresh | `skills/spec-compound-refresh/SKILL.md` | 631 | 11201 | huge | high | high | learning refresh 涉及搜索、分类、更新、合并、删除、commit 和 discoverability | 强制 narrow scope，action-specific refs 按需加载，full report 改 summary-first | P0 |
| spec-work-beta | `skills/spec-work-beta/SKILL.md` | 517 | 11092 | huge | high | high | beta execution + delegation + staging 安全规则密集 | 收敛为 thin wrapper，复用 stable work refs，beta-only 内容按需加载 | P1 |
| spec-work | `skills/spec-work/SKILL.md` | 483 | 10479 | huge | high | high | 高频执行 workflow，包含 task-pack、branch、subagent、test、commit 全流程 | core 执行规则压缩，task-pack validator / branch / shipping refs 懒加载 | P0 |
| spec-ideate | `skills/spec-ideate/SKILL.md` | 367 | 9654 | huge | medium | high | 发散/收敛、research、critique、scoring、output contract 聚合在正文 | 将 ideation methods、rubrics、examples 拆 refs；默认输出短列表 | P1 |
| spec-mcp-setup | `skills/spec-mcp-setup/SKILL.md` | 662 | 9083 | huge | high | high | setup workflow 加 33 个 scripts，跨 host/runtime/provider 规则多 | core 只保留 setup ladder；provider details、repair recipes 拆 refs | P0 |
| spec-optimize | `skills/spec-optimize/SKILL.md` | 687 | 8988 | huge | high | high | metric loop、experiments、worktree、safety、measurement 全量内联 | 预算化 experiment context，reference-driven safety，compact result schema | P1 |
| spec-compound | `skills/spec-compound/SKILL.md` | 543 | 7531 | large | high | high | 默认 full mode 多 subagent、session history、related docs、solution writer | lightweight 默认化，session/related docs opt-in，compound delta + index | P0 |
| spec-graph-bootstrap | `skills/spec-graph-bootstrap/SKILL.md` | 341 | 6428 | large | high | high | graph readiness 和 provider status 边界复杂，scripts 输出多 raw log | 默认 consumption summary；raw/provider details path-only；bootstrap result compact | P1 |
| spec-write-tasks | `skills/spec-write-tasks/SKILL.md` | 373 | 6053 | large | medium | medium | task-pack contract 和 validation 细节较多 | contract.yaml + JSON schema ref；SKILL 只保留生成姿态和 handoff | P1 |
| spec-debug | `skills/spec-debug/SKILL.md` | 270 | 5667 | large | high | high | debug loop 容易读取 logs、tests、history、source | context budget by failure class；tool output summary-first | P1 |
| spec-brainstorm | `skills/spec-brainstorm/SKILL.md` | 235 | 5425 | large | high | high | 需求探索易扩大上下文和历史背景 | 默认不读全仓；仅根据问题请求 context bundle；examples 拆 refs | P1 |
| using-spec-first | `skills/using-spec-first/SKILL.md` | 290 | 5409 | large | high | high | 每次 substantial work 前加载，route map 细节多 | 压成 router table + failure modes；长 routing rationale 拆 refs | P0 |
| spec-doc-review | `skills/spec-doc-review/SKILL.md` | 285 | 5305 | large | high | high | 默认 persona dispatch，全 document 传给每个 reviewer | document slicing/bundle；persona prompt only selected lens；structured findings cap | P0 |
| spec-standards | `skills/spec-standards/SKILL.md` | 434 | 4922 | large | medium | medium | standards/glue/readiness 规则较多 | preview-first summary，confirmed standards index，details on demand | P1 |
| git-commit-push-pr | `skills/git-commit-push-pr/SKILL.md` | 235 | 4178 | large | medium | high | shipping helper 容易串联 commit/push/PR 大上下文 | 保持 internal helper，description-only 默认，PR body 从 summaries 生成 | P1 |
| proof | `skills/proof/SKILL.md` | 316 | 4015 | large | medium | medium | proof 方法和 examples 较多 | examples 拆 references，proof packet schema 化 | P2 |
| frontend-design | `skills/frontend-design/SKILL.md` | 259 | 3592 | medium | medium | medium | UI guidance 密集 | domain-specific refs；default checklist 压缩 | P2 |
| feature-video | `skills/feature-video/SKILL.md` | 187 | 3201 | medium | medium | high | 可能读取大量 visual/browser context | browser evidence summary，asset refs path-only | P2 |
| agent-native-architecture | `skills/agent-native-architecture/SKILL.md` | 259 | 3157 | medium | medium | medium | references 多 | reference index + decision summary | P2 |
| spec-app-consistency-audit | `skills/spec-app-consistency-audit/SKILL.md` | 302 | 3064 | medium | high | medium | 21 scripts、PRD/Figma/source/rule-pack 多源输入 | 已有 artifacts；进一步引入 selected experts 和 issue cap | P1 |
| spec-sessions | `skills/spec-sessions/SKILL.md` | 204 | 2775 | medium | high | high | session files 1-7MB，虽然已有 extraction guard | 保持 no full session rule；增加 answer budget 和 digest schema | P1 |
| test-browser | `skills/test-browser/SKILL.md` | 361 | 2703 | medium | medium | high | browser evidence + possible fix flow，内部 helper 边界风险 | 改成 evidence-only helper；输出 screenshot/log summary | P1 |
| spec-release-notes | `skills/spec-release-notes/SKILL.md` | 175 | 2398 | medium | medium | medium | release history summarization | changelog index + latest window cap | P2 |
| agent-native-audit | `skills/agent-native-audit/SKILL.md` | 283 | 2100 | medium | medium | medium | checklist 密集 | checklist refs 按需加载 | P2 |
| spec-update | `skills/spec-update/SKILL.md` | 253 | 2012 | medium | high | medium | update/runtime repair 规则 | startup reminder 和 repair recipes 分离 | P1 |
| git-commit | `skills/git-commit/SKILL.md` | 112 | 1727 | medium | medium | medium | commit helper | summary-only diff intake | P2 |
| lfg | `skills/lfg/SKILL.md` | 71 | 1567 | medium | medium | medium | legacy orchestration 风险大于 token 大小 | retire/hard-hide，不进入默认上下文 | P0 |
| test-xcode | `skills/test-xcode/SKILL.md` | 209 | 1566 | medium | medium | medium | simulator evidence + possible fix flow | evidence-only helper；runtime output summary | P2 |
| spec-skill-audit | `skills/spec-skill-audit/SKILL.md` | 209 | 1439 | small | high | medium | 19 scripts，默认产物可能巨大 | 默认 summary-only；large JSON path-only；retention cap | P0 |
| gemini-imagegen | `skills/gemini-imagegen/SKILL.md` | 239 | 1429 | small | medium | low | scripts 多但核心小 | keep small；asset metadata summary | P3 |
| git-worktree | `skills/git-worktree/SKILL.md` | 87 | 1429 | small | medium | low | internal helper | keep small；no default loading outside delegated use | P3 |
| spec-dhh-rails-style | `skills/spec-dhh-rails-style/SKILL.md` | 186 | 1369 | small | medium | low | references 多 | keep as opt-in style lens | P3 |
| changelog | `skills/changelog/SKILL.md` | 145 | 1201 | small | medium | low | changelog helper | keep small | P3 |
| report-bug | `skills/report-bug/SKILL.md` | 160 | 1109 | small | medium | low | issue reporting | keep small | P3 |
| resolve-pr-feedback | `skills/resolve-pr-feedback/SKILL.md` | 62 | 902 | small | medium | low | scripts/ref small | keep small | P3 |
| spec-polish-beta | `skills/spec-polish-beta/SKILL.md` | 92 | 888 | small | medium | low | references/scripts carry browser work | keep SKILL small，browser logs summary | P2 |
| git-clean-gone-branches | `skills/git-clean-gone-branches/SKILL.md` | 64 | 607 | small | medium | medium | git operation helper，边界比 token 更重要 | keep opt-in and bounded | P3 |
| spec-slack-research | `skills/spec-slack-research/SKILL.md` | 42 | 589 | small | medium | low | small orchestrator | keep small；research digest cap | P2 |

## 最高成本 skill 判断

最高成本不是单纯按 `estimated_tokens` 排序，而是 `size * loaded_frequency * fanout`：

1. `spec-code-review`
2. `spec-doc-review`
3. `spec-work`
4. `using-spec-first`
5. `spec-plan`
6. `spec-compound`
7. `spec-mcp-setup`
8. `spec-graph-bootstrap`
9. `spec-sessions`
10. `spec-skill-audit`
