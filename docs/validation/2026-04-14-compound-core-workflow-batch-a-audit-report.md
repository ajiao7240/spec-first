# Compound Core Workflow 批次 A 最终审查报告

- 审查日期：`2026-04-14`
- 分支：`feat/sync-compound-core-workflow-updates`
- 计划文件：[docs/plans/2026-04-13-006-feat-sync-compound-core-workflow-updates-plan.md](/Users/kuang/xiaobu/spec-first/docs/plans/2026-04-13-006-feat-sync-compound-core-workflow-updates-plan.md)
- 上游基线：`/Users/kuang/xiaobu/compound-engineering-plugin/plugins/compound-engineering`
- 审查范围：批次 A `Unit A1` 到 `Unit A4`

## 1. 总结结论

本轮已完成批次 A 的实现与全量审查，结论如下：

1. `spec-review`、`document-review`、`resolve-pr-feedback`、`spec-ideate` 以及 A4 覆盖的 agent 文件，均已按“逐文件核实、非抽样”方式与上游当前基线对照。
2. A4 范围内 22 个 agent 文件现已与“上游文本 + spec-first 命名空间映射”完全一致；`agents/workflow/bug-reproduction-validator.md` 因上游缺失而明确保留当前实现。
3. 本地演化中有价值的分叉已保留，没有发生机械回退：
   - `spec-review` 不引入上游 `headless`
   - `document-review` 保留本地 `batch_confirm`、`Promote Residual Concerns`、`Resolve Contradictions`、`Route by Autofix Class`
4. 共享约束 `949bdef` 已在批次 A 范围内闭环：agent hygiene 已收口，`spec-review` / `spec-work` / `spec-work-beta` 的 subagent permission-mode 约束已补齐；A 批次负责 shared 语义裁决与 A 范围内真实文件落点，C/D 后续按 file-affinity 消费 handoff。`spec-work` / `spec-work-beta` 主 `SKILL.md` 中原有的调用层硬编码 `mode:autofix` 指导已移除，但 shipping reference 仍保留显式 `mode:autofix` 的 review 指导，且这与上游当前文本一致。

## 2. 对上游项目意图的理解

结合 `compound-engineering-plugin` 当前更新，本轮确认其核心意图不是“增加更多能力入口”，而是对核心工作流做三类收敛：

1. 协议与输出收敛：让 `review` / `document-review` / `pr-feedback` 的输出契约更稳定，减少格式漂移、减少 token 浪费、降低多 agent 合并成本。
2. 安全与 orchestration 收敛：把不可信输入边界、cluster gate、cross-invocation 模式、permission-mode 等 orchestration 约束写清楚，避免 prompt 注入、并行冲突和权限模式被调用方写死。
3. agent hygiene 收敛：删除 self-referencing examples，改成直接面向真实任务的 agent 指令，减少无效上下文和递归误导。

换句话说，上游这轮更新的重点不是新增 feature surface，而是提升核心链路的稳定性、可组合性和执行确定性。这与当前 `spec-first` 的主链路定位是一致的，因此批次 A 适合高保真同步。

## 3. 审查方法

本轮不是按 commit message 粗粒度迁移，而是按“主题组 -> 文件组 -> 实际落点”逐个核实：

1. 先按计划拆到 `Unit A1-A4`
2. 对每个 Unit 的目标文件逐个与上游对照
3. 对共享 commit 采用“owner 定语义，file-affinity 落地”的责任制，不在 shared-batch 做重复裁决
4. 对 A4 agent 文件逐个检查是否仅存在 example/hygiene 差异，还是包含真实语义增量
5. 完成代码修改后再做批次 A 的整体一致性审查

附加质量动作：

- 批量同步时曾发现一次命名空间机械替换误伤普通英文单词的风险，已通过“异常字符串扫描 -> 重新按正则约束重写 -> 再次逐文件比对”完全收口。
- 全程未对 `tests/` 目录做同步，遵从本轮范围约束。

## 4. Unit 级审查结果

### Unit A1

| 本地文件 | 上游对应 | 处理方式 | 结果 |
|---|---|---|---|
| `skills/spec-review/SKILL.md` | `skills/ce-review/SKILL.md` | 吸收 compact returns、run-id artifact、base resolution 稳态说明；保留本地非 headless 路线 | 已完成 |
| `skills/spec-review/references/findings-schema.json` | `skills/ce-review/references/findings-schema.json` | 同步 findings schema | 已完成 |
| `skills/spec-review/references/persona-catalog.md` | `skills/ce-review/references/persona-catalog.md` | 同步 persona catalog 调整 | 已完成 |
| `skills/spec-review/references/subagent-template.md` | `skills/ce-review/references/subagent-template.md` | 同步 compact reviewer returns 模板 | 已完成 |
| `skills/spec-review/references/review-output-template.md` | `skills/ce-review/references/review-output-template.md` | 同步最终输出模板 | 已完成 |
| `skills/spec-review/references/resolve-base.sh` | `skills/ce-review/references/resolve-base.sh` | 同步 merge-base / review-base 解析稳态修复 | 已完成 |
| `skills/spec-ideate/SKILL.md` | `skills/ce-ideate/SKILL.md` | 吸收 token/latency 优化意图，不回退本地 ideate 结构 | 已完成 |
| `skills/spec-ideate/references/post-ideation-workflow.md` | `skills/ce-ideate/references/post-ideation-workflow.md` | 新增后置流程 reference，用于 token 收敛 | 已完成 |

### Unit A2

| 本地文件 | 上游对应 | 处理方式 | 结果 |
|---|---|---|---|
| `skills/document-review/SKILL.md` | `skills/document-review/SKILL.md` | 吸收 auto route、pattern-resolved、token 收敛；保留本地 synthesis / batch_confirm 分支 | 已完成 |
| `skills/document-review/references/findings-schema.json` | `skills/document-review/references/findings-schema.json` | 同步 findings schema | 已完成 |
| `skills/document-review/references/subagent-template.md` | `skills/document-review/references/subagent-template.md` | 吸收 recursion guard | 已完成 |
| `skills/document-review/references/synthesis-and-presentation.md` | 同名上游 reference | 新增拆分 reference，承接 Phase 3-5 token 收敛 | 已完成 |
| `agents/document-review/adversarial-document-reviewer.md` | 同名上游 agent | 同步 persona 精简和 token 优化 | 已完成 |
| `agents/document-review/design-lens-reviewer.md` | 同名上游 agent | 逐文件审查后确认无需改动 | 已审查，无需修改 |
| `agents/document-review/scope-guardian-reviewer.md` | 同名上游 agent | 逐文件审查后确认无需改动 | 已审查，无需修改 |
| `agents/document-review/security-lens-reviewer.md` | 同名上游 agent | 逐文件审查后确认无需改动 | 已审查，无需修改 |

### Unit A3

| 本地文件 | 上游对应 | 处理方式 | 结果 |
|---|---|---|---|
| `skills/resolve-pr-feedback/SKILL.md` | `skills/resolve-pr-feedback/SKILL.md` | 吸收 actionability filter、cluster gate、cross-invocation、cluster dispatch、bounded re-run 规则 | 已完成 |
| `agents/workflow/pr-comment-resolver.md` | `agents/workflow/pr-comment-resolver.md` | 吸收不可信输入边界、standard/cluster 双模式、cluster assessment 输出 | 已完成 |

### Unit A4

| 本地文件 | 上游对应 | 处理方式 | 结果 |
|---|---|---|---|
| `agents/review/cli-agent-readiness-reviewer.md` | 同名上游 agent | 删除 self-referencing examples，并吸收“non-interactive 默认结构化输出”审查要求 | 已完成 |
| `agents/design/design-implementation-reviewer.md` | 同名上游 agent | 删除 self-referencing examples | 已完成 |
| `agents/design/design-iterator.md` | 同名上游 agent | 删除 self-referencing examples | 已完成 |
| `agents/design/figma-design-sync.md` | 同名上游 agent | 删除 self-referencing examples | 已完成 |
| `agents/docs/ankane-readme-writer.md` | 同名上游 agent | 删除 self-referencing examples | 已完成 |
| `agents/research/best-practices-researcher.md` | 同名上游 agent | 删除 self-referencing examples | 已完成 |
| `agents/research/framework-docs-researcher.md` | 同名上游 agent | 删除 self-referencing examples | 已完成 |
| `agents/research/git-history-analyzer.md` | 同名上游 agent | 删除 self-referencing examples | 已完成 |
| `agents/research/issue-intelligence-analyst.md` | 同名上游 agent | 删除 self-referencing examples | 已完成 |
| `agents/research/learnings-researcher.md` | 同名上游 agent | 删除 self-referencing examples | 已完成 |
| `agents/research/repo-research-analyst.md` | 同名上游 agent | 删除 self-referencing examples，并吸收“只输出 repo-relative paths”约束 | 已完成 |
| `agents/review/agent-native-reviewer.md` | 同名上游 agent | 删除 self-referencing examples | 已完成 |
| `agents/review/architecture-strategist.md` | 同名上游 agent | 删除 self-referencing examples | 已完成 |
| `agents/review/code-simplicity-reviewer.md` | 同名上游 agent | 删除 self-referencing examples | 已完成 |
| `agents/review/data-integrity-guardian.md` | 同名上游 agent | 删除 self-referencing examples | 已完成 |
| `agents/review/data-migration-expert.md` | 同名上游 agent | 删除 self-referencing examples | 已完成 |
| `agents/review/deployment-verification-agent.md` | 同名上游 agent | 删除 self-referencing examples | 已完成 |
| `agents/review/pattern-recognition-specialist.md` | 同名上游 agent | 删除 self-referencing examples | 已完成 |
| `agents/review/performance-oracle.md` | 同名上游 agent | 删除 self-referencing examples | 已完成 |
| `agents/review/schema-drift-detector.md` | 同名上游 agent | 删除 self-referencing examples | 已完成 |
| `agents/review/security-sentinel.md` | 同名上游 agent | 删除 self-referencing examples | 已完成 |
| `agents/workflow/bug-reproduction-validator.md` | 上游缺失 | 明确保留当前文件，不做覆盖 | 已确认保留 |
| `agents/workflow/pr-comment-resolver.md` | 同名上游 agent | 已在 A3 完成真实语义同步；A4 再审查时确认无额外 hygiene 差异需补 | 已审查，无需额外修改 |
| `agents/workflow/spec-flow-analyzer.md` | 同名上游 agent | 删除 self-referencing examples | 已完成 |
| `skills/spec-review/SKILL.md` | `skills/ce-review/SKILL.md` | 补充 subagent permission-mode 约束，不回退本地 review 模式设计 | 已完成 |
| `skills/document-review/SKILL.md` | `skills/document-review/SKILL.md` | 复核显式 mode 传参，确认当前无额外收口项 | 已审查，无需修改 |
| `skills/spec-work/SKILL.md` | `skills/ce-work/SKILL.md` | 补 permission-mode 约束，并完成 `949bdef` 的 A 侧 shared 语义裁决；主 `SKILL.md` 中移除调用层硬编码 `mode:autofix` 指导，shipping reference 保留显式 review 模式说明 | 已完成 |
| `skills/spec-work-beta/SKILL.md` | `skills/ce-work-beta/SKILL.md` | 补 permission-mode 约束，并完成 `949bdef` 的 A 侧 shared 语义裁决；主 `SKILL.md` 中移除调用层硬编码 `mode:autofix` 指导，shipping reference 保留显式 review 模式说明 | 已完成 |
| `skills/spec-ideate/SKILL.md` | `skills/ce-ideate/SKILL.md` | 复核显式 mode 传参，确认当前无额外收口项 | 已审查，无需修改 |
| `skills/spec-compound-refresh/SKILL.md` | `skills/ce-compound-refresh/SKILL.md` | 复核显式 mode 传参，保留自身 `mode:autofix` 定义，不新增下游硬编码调用 | 已审查，无需修改 |

## 5. 有意保留的本地分叉

以下分叉是经过复核后保留的，不是遗漏：

1. `skills/spec-review/SKILL.md`
   - 不引入上游 `mode:headless`
   - 原因：当前 `spec-first` 的 review 主链路仍以交互 / autofix / report-only 为主，强行接入 headless 会扩大调用面和验证面
2. `skills/document-review/SKILL.md`
   - 保留本地 `batch_confirm`
   - 保留 `Promote Residual Concerns`
   - 保留 `Resolve Contradictions`
   - 保留 `Route by Autofix Class`
   - 原因：这些是本地对 document-review 的实际增强，若机械回退会丢失当前产品化价值
3. `agents/workflow/bug-reproduction-validator.md`
   - 上游已不存在对应文件
   - 原因：当前仓库仍有该入口，不应在没有替代方案的前提下删除

## 6. 验证记录

### 机械验证

已执行并通过：

```bash
git diff --check
jq . skills/spec-review/references/findings-schema.json
jq . skills/document-review/references/findings-schema.json
bash -n skills/spec-review/references/resolve-base.sh
```

### 规则验证

已执行并确认：

1. `resolve-pr-feedback` / `pr-comment-resolver` 中存在：
   - `untrusted input`
   - `cluster-brief`
   - `cross_invocation`
   - `prior-resolutions`
   - `spec-first:workflow:pr-comment-resolver`
2. A4 目标 agent 中已无残留 self-referencing example blocks。
   - 唯一例外：`agents/workflow/bug-reproduction-validator.md`
   - 该例外已明确标记为“上游缺失，本地保留”
3. `skills/spec-work/SKILL.md` 与 `skills/spec-work-beta/SKILL.md` 的主文档中已不再把 `mode:autofix` 作为调用层硬编码指导；`references/shipping-workflow.md` 仍保留显式 `mode:autofix` 的 review 流程说明，这一点已在 shared handoff 中如实记录，且与上游当前文本一致。
4. A4 同步的 22 个 agent 文件已经逐个与“上游文本 + spec-first 命名空间映射”做精确比对，结果均为匹配。

## 7. 风险与后续建议

### 当前剩余风险

1. 批次 B/C/D 尚未进入实施。
   - 当前计划对 B/C/D 仍只有 execution outline，没有展开到 A1-A4 同等粒度。
   - 若直接进入开发，容易退化为“边做边补计划”。
2. `resolve-pr-feedback` 当前保留了少量本地措辞差异（例如安全提示文案用 `PR comment text` 而非更泛化的 `Comment text`）。
   - 这不影响当前语义，但后续若继续追齐上游全文，可在 B/C/D 前做一次文本级精修。

### 建议

1. 以当前批次 A 结果作为新基线，先提交并冻结。
2. 启动批次 B 之前，先把 B 的 outline 展开成与 A 相同粒度的 Unit 级计划，再进入开发。
3. 共享 commit 继续沿用当前“owner 定语义，file-affinity 落地”规则，不要改回“共享 commit 的每个真实文件都由 owner 全包”的重型模式。

## 8. 最终判断

批次 A 已达到“可作为后续同步基线”的质量标准：

- 上游意图已被正确理解
- 目标文件已逐个核实
- 已实现项有验证证据
- 本地分叉是显式保留而非隐性遗漏

如果目标是“先把核心链路同步到稳定、可继续扩展的状态”，本轮已经达成。
如果目标是“把整份计划的 B/C/D 也一次性完成”，则下一步不应直接编码，而应先把 B/C/D 展开成与本报告相同粒度的逐文件实施矩阵。
