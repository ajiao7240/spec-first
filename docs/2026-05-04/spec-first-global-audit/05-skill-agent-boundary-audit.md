# Skill / Agent / Tool 边界与 Prompt 质量审查

## 结论

当前边界总体健康：workflow skill 负责流程协议，agent 负责局部专家判断，scripts/CLI 负责确定性 facts。风险在于资产数量和部分 workflow 厚度：42 个 skills 与 51 个 agents 会给新维护者带来 prompt/agent collection 的错觉，需要通过治理、文档和 cost note 继续压住。

## Skill / Agent / Tool 边界表

| 对象 | 当前边界 | 是否合理 | 冲突对象 | 问题说明 | 建议调整 |
|---|---|---|---|---|---|
| `spec-mcp-setup` | 安装/检测/config projection，不跑 provider build | 合理 | `spec-graph-bootstrap` | 成功引导与 init/README 不同步 | 统一 next step，setup done 后按 graph status 推荐 bootstrap/standards |
| `spec-graph-bootstrap` | 执行 provider command arrays，编译 graph/impact facts | 合理 | 旧 CRG 文档 | docs 中 retired internal CRG 噪音仍大 | archive 旧文档，强化 current graph provider 说明 |
| `spec-standards` | 编译 project standards/glue baseline，preview-first，不自动写 repo-profile | 合理 | `repo-profile.yaml` 直接写入 | 策略复杂但边界正确 | 加用户级 confirmed/imported/observed 示例 |
| `spec-brainstorm` | WHAT/requirements，不实现代码 | 合理 | `spec-ideate`、`spec-plan` | 与 ideate/plan 的边界靠 prose 和 guide mode 维持 | README 判定表保持 |
| `spec-ideate` | idea generation，不产出 requirements/plan/code | 合理但成本高 | `spec-brainstorm` | 8-9 agent baseline 对简单想法偏重 | 首屏显示 agent count，默认可跳过 |
| `spec-doc-review` | 文档质量审查，可 safe auto/open questions | 合理 | `spec-plan` confidence-first | doc-review 与 plan deepening 都会改进文档，用户可能混淆 | 文档中强调 doc-review 查 clarity/scope，deepening 查 rationale/sequencing |
| `spec-plan` | HOW plan，必须写 plan 并跑 doc-review | 合理 | `spec-work` | plan 不应变执行状态机 | 保持 plan body 不存进度 |
| `spec-write-tasks` | standalone derived handoff，不是 workflow command | 合理 | `$spec-write-tasks` 误写 | standalone 名称和 `spec-*` 前缀让用户误以为是 public command | 继续 lint 禁止 `$spec-write-tasks` 文案 |
| `spec-work` | 执行 plan/task/clear prompt | 合理 | `spec-work-beta`、`lfg` | run artifact 未落地；大任务易现场扩 scope | 实现 run artifact；oversized 回 plan/tasks |
| `spec-work-beta` | experimental delegation | 合理，需 beta | `spec-work` | 默认 guide 若指向 beta 会伤稳定性 | 保持显式 opt-in |
| `spec-debug` | 根因优先、再修复 | 合理 | `spec-work` | bug 被当普通 work 会跳过 causal chain | using-spec-first 对错误/失败优先 debug |
| `spec-optimize` | metric-driven experiments | 合理但成本高 | `spec-work` | 容易把普通改进误作优化循环 | admission/budget gate 必须保留 |
| `spec-polish-beta` | browser-visible polish beta | 合理 | `spec-work` | 不适用无 UI/无 dev server 场景 | 保持 beta |
| `spec-code-review` | 多 persona review，merge/dedupe/safe_auto | 合理但厚 | general work/review agents | artifact tmp-only，默认 reviewer count 成本高 | 添加 cost note、repo-local summary option |
| `spec-app-consistency-audit` | 移动 App 一致性静态审查 | 合理但过厚风险 | `spec-code-review` | 两者都能审查 PR，但 app audit 是 PRD/Figma/source consistency，不是通用 code review | README 明确只在 App/PRD/Figma/source alignment 使用 |
| `spec-compound` | 解决后沉淀 learning | 合理 | `spec-compound-refresh` | 不应每个机械修复都写 docs/solutions | 保持 “可复用 insight 才写” |
| `spec-compound-refresh` | 维护 stale learnings | 合理但副作用大 | `spec-compound` | autofix 可删除 docs | narrow scope + evidence report |
| `spec-sessions` | session history digest | 合理 | internal extract/inventory | 不能暴露 internal helper | 继续 internal-only |
| `spec-slack-research` | 组织上下文研究 digest | 合理 | brainstorm/plan | 外部权限和样本限制 | 输出 limitation |
| `spec-skill-audit` | skill source/runtime governance audit | 合理 | code-review | 不是通用代码审查 | 保持 source-quality auditor 定位 |
| `git-*` internal skills | git side-effect helpers | 合理但危险 | public workflow | push/commit/branch 不能自动暴露 | 保持 internal-only、显式调用 |
| `lfg` | legacy/internal autonomous shim | 有张力 | `spec-work`、`spec-code-review` | 状态机/自动化风格与 light contract 有张力 | 标为 legacy/internal，避免主文档推荐 |
| scripts under `skills/*/scripts` | deterministic facts / validation / filesystem actions | 基本合理 | LLM semantic judgment | app audit scripts 已有较多 contract extraction，但最终 judgement 仍由 LLM | 保持 candidate/advisory metadata |

## Prompt / Skill 文档质量表

| Skill/Prompt | 当前质量 | 主要问题 | 是否过重 | 是否缺少关键约束 | 优化建议 |
|---|---|---|---|---|---|
| `using-spec-first` | 高 | 需要持续防止被误写为 command-backed workflow | 否 | 否 | 保持入口治理与 guide mode tests |
| `spec-mcp-setup` | 高 | 长度和脚本矩阵较大；next step 需跨 init/README 同步 | 中 | 否 | 把 execution examples 下沉 reference |
| `spec-graph-bootstrap` | 高 | 历史 CRG 概念对读者有干扰 | 中 | 否 | 增 “current vs retired graph” 摘要 |
| `spec-standards` | 中高 | 状态枚举多，用户心智成本高 | 中 | 否 | 增最小 happy path 与 confirmed-only examples |
| `spec-ideate` | 中 | 多模式、多 agents、多 Proof 分支，token 成本高 | 是 | 有成本提示，但 artifact catalog 缺位 | 继续 progressive references，默认简化路径 |
| `spec-brainstorm` | 高 | 产品级 rigor probes 较多 | 中 | 否 | 保持 right-size，不把所有 brainstorm 做 deep |
| `spec-doc-review` | 中高 | persona/synthesis 复杂，可能污染原文 | 中 | 否 | 可选 machine-readable report，Open Questions 写入需更克制 |
| `spec-plan` | 高 | 文档很长，但职责重 | 中 | 否 | 保持 Graph Readiness block 和 mandatory doc-review |
| `spec-write-tasks` | 高 | standalone 与 command 入口易混 | 中 | 否 | README/contract tests 继续约束 |
| `spec-work` | 中高 | run artifact contract 未实现；shipping workflow 默认 code-review 成本高 | 中 | 部分缺 runtime artifact | 实现 run artifact 或降级承诺 |
| `spec-debug` | 高 | 询问是否修复的交互在某些默认执行场景可能多一步 | 中 | 否 | 保持 causal chain gate |
| `spec-optimize` | 中高 | 高成本 workflow，长上下文 | 是 | admission gate 完整 | 首次运行默认 serial/low budget |
| `spec-code-review` | 高但成本高 | 默认 6+ reviewers，tmp artifact | 是 | 已有 fallback 约束 | 加 cost budget 和 repo-local summary |
| `spec-app-consistency-audit` | 中高 | prompt/scripts/schemas 很多，orchestration 不够单命令 | 是 | 约束完整 | 增 top-level runner 与 quick mode |
| `spec-compound` | 高 | 依赖 subagents，轻量模式可能 overlap | 中 | 否 | 强化 “不是每个 bug 都 compound” |
| `spec-compound-refresh` | 中高 | 删除/替换规则很强，autofix 副作用 | 是 | 约束较完整 | 默认要求 scope hint，不做 broad sweep |
| `spec-skill-audit` | 高 | 输出多，score 易被误作 gate | 中 | 否 | 文档继续强调 score signal not gate |
| app audit prompts | 中高 | 专家 prompts 多，维护成本高 | 是 | 大多有 schema/rule pack | 保持 rule pack 与 prompt versioning |
| code-review reviewer agents | 高 | reviewer 数量多，token 成本高 | 是 | 已有 schema/gating | 对小 diff 提供更清晰 reviewer selection rationale |

## Agent 职责审查

| Agent 群 | 当前职责 | 风险 | 建议 |
|---|---|---|---|
| code-review personas | correctness/security/testing/maintainability/spec-first 等多视角审查 | 容易抢 workflow 控制权或产生成本膨胀 | 保持只读返回 JSON，orchestrator 合并；小 diff 说明成本 |
| doc-review personas | 文档 clarity/scope/implementation 等审查 | findings 可能过度细碎 | confidence gate 与 safe_auto 继续保留 |
| app audit expert prompts | PRD/Figma/source/KMP/analytics/i18n/industry 等 lenses | App audit 变成专家集合而非 workflow | orchestrator 只汇总到 issue schema，不让专家直接改源码 |
| learnings/session/slack researchers | 提供历史和组织上下文 | context pollution | 只输出 digest，标注 freshness/limits |
| internal git helpers | commit/push/pr/worktree | 副作用高 | 不作为 public workflow entry |

## 是否存在重复能力

| 能力 | 重复对象 | 判断 | 建议 |
|---|---|---|---|
| 文档审查 | `spec-doc-review` vs `spec-plan` confidence-first | 不重复，侧重点不同 | 文档中明确差异 |
| 代码审查 | `spec-code-review` vs `spec-app-consistency-audit` | 不重复，前者 diff correctness，后者 App consistency | README 加使用条件 |
| 知识维护 | `compound` vs `compound-refresh` | 不重复，写新 learning vs 刷旧 learning | 保持 narrow refresh |
| 执行 | `work` vs `work-beta` vs `lfg` | `work-beta` 是 opt-in beta，`lfg` 是 internal/legacy | 不让 guide 默认指向 beta/lfg |
| 想法探索 | `ideate` vs `brainstorm` | 不重复，ideate 发散候选，brainstorm 收敛 requirements | README 判定表保持 |

## scripts prepare / LLM decides 审查

| 领域 | 当前脚本行为 | 是否越界 | 说明 |
|---|---|---|---|
| mcp setup | 检测依赖、安装、写 provider projection、reason_code | 基本不越界 | GitNexus probe candidate 是 heuristic，但输出 candidate/reason_code，bootstrap 再验证 |
| graph bootstrap | 执行 provider commands、写 status/facts/capabilities | 不越界 | query_ready 以证据 gate 判断，仍是 readiness fact，不做业务语义 |
| task pack validator | 校验 hash/spec_id/JSON structure/path | 不越界 | 明确不判断语义质量 |
| app audit scripts | 提取 contracts、preflight、merge issues | 边缘但可接受 | 需要确保 findings 仍有 evidence gate 和 candidate status |
| skill audit scripts | 收集 score/report/security signals | 不越界 | score 是 signal not gate |

## 主要边界修复建议

1. 把 `.claude-plugin/plugin.json` 从所有 source truth 文档中移除，改为动态 manifest 真源。
2. 为 code-review 增 repo-local summary handoff，或在 docs 中明确 `/tmp` 是 transient。
3. 为 app audit 增最小 headless runner，避免 workflow 使用者手工串联 20+ scripts。
4. 为 42 skills / 51 agents 增 runtime catalog 和 “public vs internal vs beta” 导航，降低 marketplace 感。
5. 为 high-cost workflows 增 `cost/agent count` 提示，保护 token budget。
