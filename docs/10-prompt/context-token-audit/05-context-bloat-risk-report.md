# Context Bloat Risk Report

## High Risk List

| risk_id | area | risk | evidence | fix |
| --- | --- | --- | --- | --- |
| R-H01 | runtime artifacts | `.spec-first/audits/skill-audit` 多份 50k-600k token JSON 被误读 | `.spec-first` 约 93MB，top files 几乎全是旧 audit JSON | 默认排除 `.spec-first/audits/**`，只允许 explicit audit workflow 读 summary/path |
| R-H02 | code-review | reviewer fanout 乘法放大 diff/context | persona catalog 最多 default core + conditional + stack-specific | selective dispatch + reviewer budget + context slice |
| R-H03 | doc-review | full document 传给每个 reviewer | `spec-doc-review` 明确 pass full document | section map + selected section bundle |
| R-H04 | high-frequency skill core | `spec-code-review`、`spec-plan`、`spec-work` 过大 | top 3 高频 `SKILL.md` 均 >10k tokens | core/ref 拆分 |
| R-H05 | source/runtime duplication | `.claude` / `.agents/skills` mirror 与 source 同时存在 | runtime mirrors 共约 7.9MB | context router 默认 source-only，drift workflow exception |
| R-H06 | skill-audit outputs | `write-audit-artifacts.js` 默认写 full inventory/report/scorecard/latest | script lines show full JSON outputs | summary-only default、`--full` opt-in、retention cap |
| R-H07 | compound knowledge | full mode 可拉 session history + related docs + review agents | `spec-compound` full mode parallel tasks | lightweight default，compound delta/index |
| R-H08 | sessions | session files 1-7MB，历史上下文天然大 | `spec-sessions` 自身 guard 明确此风险 | 保持 scripts extraction，增加 answer schema budget |
| R-H09 | changelog/docs | `CHANGELOG.md` 约 82k tokens，历史计划多份 >20k | source top file stats | changelog window/index，historical docs summary |
| R-H10 | graph/tool output | diagnostics/raw/provider outputs 可长 | graph-bootstrap scripts 写 raw logs 和 diagnostics | compact readiness + raw log path |

## Medium Risk List

| risk_id | area | risk | fix |
| --- | --- | --- | --- |
| R-M01 | app-consistency-audit | PRD/Figma/source/rule packs 多源重复 | audit planner 选择 experts，issue cap |
| R-M02 | broad researchers | repo/web/slack/learnings agents 需要大输入 | source authority + max evidence refs |
| R-M03 | examples/checklists | 高频 skills 内嵌长 examples | examples/checklists refs 按需 |
| R-M04 | artifact handoff | 下游可能读 full report | summary + path + ids |
| R-M05 | standards/glue | standards 可能演化为 rules engine | confirmed standards index + advisory flags |
| R-M06 | optimize experiments | 多实验输出重复 | leaderboard + top deltas |
| R-M07 | polish/browser logs | screenshots/logs 多 | screenshot index + issue summary |
| R-M08 | release notes | changelog/release docs 大 | latest version window |

## Low Risk List

| risk_id | area | risk | reason |
| --- | --- | --- | --- |
| R-L01 | templates | 仅约 92KB | 体量小，主要关注 source/runtime projection |
| R-L02 | small reviewer agents | 单个 <1k tokens | 只在 fanout 下成为问题 |
| R-L03 | `spec-polish-beta` SKILL.md | core 小 | browser evidence 才是主要成本 |
| R-L04 | `spec-slack-research` SKILL.md | core 小 | research result 需要预算 |

## Quick Win Fixes

1. 为所有 workflow 明确：默认不要读取 `.spec-first/audits/**`、`.claude/**`、`.codex/**`、`.agents/skills/**`。
2. 将 `spec-code-review`、`spec-work`、`spec-plan`、`using-spec-first` 的长分支规则拆到 references。
3. 给 code/doc review 添加 reviewer count budget 和 finding count budget。
4. 将 review/doc/app audit 下游 handoff 统一为 compact envelope。
5. 将 `CHANGELOG.md` 消费改为 latest window，而非全文。
6. `spec-skill-audit` 默认只生成/读取 summary，full JSON opt-in。
7. graph-bootstrap/tool output 默认只给 reason_code、status、artifact path。

## Structural Fixes

1. 建立 Context Router MVP。
2. 定义 `context-request.v1` 与 `context-bundle.v1`。
3. 定义 shared `review-finding.v1` 最小 envelope。
4. 定义 `artifact-summary.v1`，所有 durable artifacts 必须有 summary。
5. 建立 `compound-index.json` / `docs/solutions/index.md`。
6. 建立 context budget lint：高频 `SKILL.md` 超阈值必须解释。
7. 建立 runtime artifact retention policy。

## Must Not Do

1. 不为省 token 删除 evidence 要求。
2. 不删除 degraded mode / reason_code。
3. 不把 reviewer 输出降级为泛泛点评。
4. 不让 agent 凭经验猜代码事实。
5. 不取消 graph readiness。
6. 不手改 generated runtime mirror。
7. 不把 context router 做成强状态机。
8. 不把所有历史 docs 删除或隐藏；应 index + summary + freshness 标注。
