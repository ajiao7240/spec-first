# Skills 改造详细指南

## 1. 概述

本文档提供每个 skill 从 Every 基座改造为 spec-first 的详细步骤。

> 现状说明：本文档是早期迁移指南，保留了 `.claude/tasks/<task-id>/task.yaml`
> 与 `task-manager.sh` / `stage-gate.sh` / `review-judge.sh` 的历史示例。当前
> spec-first 不再依赖这条 legacy shell e2e 链；现行 skill / workflow 改造以
> `skills/*/SKILL.md`、`src/cli/`、`docs/contracts/workflows/**` 和 focused Jest
> contract tests 为 source-of-truth。

## 2. 通用改造流程

### 2.1 文件复制

```bash
# 从基座复制 skill
cp -r /Users/kuang/xiaobu/compound-engineering-plugin/plugins/compound-engineering/skills/ce-<name> \
      skills/spec-<name>
```

### 2.2 通用修改点

历史迁移草案中曾需要修改以下内容：

**1. Skill 名称**
- 文件名：`ce-<name>` → `spec-<name>`
- 内部引用：所有 `ce-<name>` → `spec-<name>`

**2. 输出路径**
- 原路径：`docs/plans/` 或其他
- 当前 source-first 路径：`docs/plans/`、`docs/validation/`、`.spec-first/workflows/**`
  或 workflow 自身声明的 artifact；不要把 generated runtime mirror 当 source。

**3. 增加输入与证据边界**
在 skill 开头明确：
```markdown
## 输入与证据边界

执行以下检查：
1. 读取用户指定 artifact、plan 或 task-pack 的 source refs
2. 区分 source-of-truth 与 generated runtime
3. 区分 script-owned facts 与 LLM-owned judgment
4. 记录验证命令、limitations 与 next action
```

**4. 增加 closeout 证据**
在 skill 结尾增加：
```markdown
## Closeout

1. 列出 changed files / generated artifacts
2. 列出已运行验证和未运行原因
3. 给出 review / compound / release handoff
```

## 3. spec-brainstorm 改造

### 3.1 复制文件

```bash
cp -r /Users/kuang/xiaobu/compound-engineering-plugin/plugins/compound-engineering/skills/ce-brainstorm \
      skills/spec-brainstorm
```

### 3.2 修改 skill 名称

**文件**：`skills/spec-brainstorm/skill.md`

**修改**：
```markdown
---
name: spec-brainstorm  # 原：ce-brainstorm
description: 思路发散、方案探索
---
```

### 3.3 增加阶段契约检查

在 skill.md 开头增加：

```markdown
## 阶段契约检查

1. 检查或创建任务目录
   - 如果 --task-id 未指定，自动生成
   - 创建 .claude/tasks/<task-id>/

2. 初始化或读取 legacy task.yaml
   - 如果不存在，legacy 示例使用 task-manager.sh create
   - 如果存在，legacy 示例使用 task-manager.sh read

3. 决策 level
   - 如果 --level 未指定，根据任务描述分析
   - 提示用户可覆盖

4. 验证输入
   - 确认问题定义、背景、目标已提供
```

### 3.4 修改输出路径

**原输出**：可能是 `docs/plans/` 或其他位置

**新输出**：`.claude/tasks/<task-id>/01-brainstorm.md`

**修改位置**：在生成输出的部分，修改文件路径

### 3.5 增加 rationale capture

在输出模板中增加章节：

```markdown
## 推荐方案与理由

### 为什么选择这个方案
[说明选择理由]

### 为什么不选其他方案
[说明排除理由]

### 适用边界
[说明适用场景和限制]
```

### 3.6 增加状态更新

在 skill.md 结尾增加：

```markdown
## 状态更新

1. 生成 01-brainstorm.md 到 .claude/tasks/<task-id>/
2. legacy 示例使用 task-manager.sh update --stage brainstorm --status completed
3. 推进 current_stage 到 plan
```

### 3.7 保留内容

**完全保留**：
- 原有的 prompt 正文
- agents 调用逻辑
- 核心工作流程

## 4. spec-plan 改造

### 4.1 复制文件

```bash
cp -r /Users/kuang/xiaobu/compound-engineering-plugin/plugins/compound-engineering/skills/ce-plan \
      skills/spec-plan
```

### 4.2 修改 skill 名称

**文件**：`skills/spec-plan/skill.md`

**修改**：
```markdown
---
name: spec-plan  # 原：ce-plan
description: 规划制定、方案细化
---
```

### 4.3 增加阶段契约检查

在 skill.md 开头增加：

```markdown
## 阶段契约检查

1. legacy 示例使用 stage-gate.sh 检查上游产物
   - 验证 01-brainstorm.md 存在
   - 验证 01-brainstorm.md 非空
   - 验证 legacy task.yaml 中 brainstorm 阶段已完成

2. 读取 legacy task.yaml
   - legacy 示例使用 task-manager.sh read
   - 获取 task_id, role, level

3. 验证输入完整性
   - 确认推荐方案已明确
   - 确认技术选型已确定
```

### 4.4 修改输出路径

**原输出**：可能是 `docs/plans/` 或其他位置

**新输出**：`.claude/tasks/<task-id>/02-plan.md`

### 4.5 增加 rationale capture

在输出模板中增加章节：

```markdown
## 方案选择理由

### 为什么采用这个技术栈
[说明技术选型理由]

### 为什么这样拆分任务
[说明任务拆分逻辑]

### 风险与应对
[说明已识别风险和应对措施]
```

### 4.6 增加状态更新

在 skill.md 结尾增加：

```markdown
## 状态更新

1. 生成 02-plan.md 到 .claude/tasks/<task-id>/
2. legacy 示例使用 task-manager.sh update --stage plan --status completed
3. 推进 current_stage 到 work
```

### 4.7 保留内容

**完全保留**：
- 原有的 prompt 正文
- agents 调用逻辑（research/, workflow/）
- 核心规划流程

## 5. spec-work 改造

### 5.1 复制文件

```bash
cp -r /Users/kuang/xiaobu/compound-engineering-plugin/plugins/compound-engineering/skills/ce-work \
      skills/spec-work
```

### 5.2 修改 skill 名称

**文件**：`skills/spec-work/skill.md`

**修改**：
```markdown
---
name: spec-work  # 原：ce-work
description: 执行落地、代码实现
---
```

### 5.3 增加阶段契约检查

在 skill.md 开头增加：

```markdown
## 阶段契约检查

1. legacy 示例使用 stage-gate.sh 检查上游产物
   - 验证 02-plan.md 存在
   - 验证 02-plan.md 非空
   - 验证 legacy task.yaml 中 plan 阶段已完成

2. 读取 legacy task.yaml
   - legacy 示例使用 task-manager.sh read
   - 获取 task_id, role, level

3. 验证输入完整性
   - 确认实施步骤已明确
   - 确认验收标准已定义
```

### 5.4 修改输出路径

**原输出**：可能是 `docs/work/` 或其他位置

**新输出**：`.claude/tasks/<task-id>/03-work.md`

### 5.5 增加状态更新

在 skill.md 结尾增加：

```markdown
## 状态更新

1. 生成 03-work.md 到 .claude/tasks/<task-id>/
2. legacy 示例使用 task-manager.sh update --stage work --status completed
3. 推进 current_stage 到 review
```

### 5.6 保留内容

**完全保留**：
- 原有的 prompt 正文
- agents 调用逻辑（workflow/）
- 核心执行流程
- 代码实现逻辑

## 6. spec-code-review 改造

### 6.1 复制文件

```bash
cp -r /Users/kuang/xiaobu/compound-engineering-plugin/plugins/compound-engineering/skills/ce-review \
      skills/spec-code-review
```

### 6.2 修改 skill 名称

**文件**：`skills/spec-code-review/skill.md`

**修改**：
```markdown
---
name: spec-code-review  # 原：ce-review
description: 质量评审、问题识别
---
```

### 6.3 增加阶段契约检查

在 skill.md 开头增加：

```markdown
## 阶段契约检查

1. legacy 示例使用 stage-gate.sh 检查上游产物
   - 验证 03-work.md 存在
   - 验证 03-work.md 非空
   - 验证 legacy task.yaml 中 work 阶段已完成

2. 读取 legacy task.yaml
   - legacy 示例使用 task-manager.sh read
   - 获取 task_id, role, level

3. 验证输入完整性
   - 确认实施产物已完成
   - 确认可进行评审
```

### 6.4 修改输出路径

**原输出**：可能是 `docs/review/` 或其他位置

**新输出**：`.claude/tasks/<task-id>/04-review.md`

### 6.5 增加双重判定机制（关键改造）

在 skill.md 中增加判定逻辑：

```markdown
## Review 双重判定

### 判定规则

**规则1：关键维度底线**
- correctness < 3 → 不通过
- completeness < 3 → 不通过

**规则2：阻断问题优先**
- blocking_issues > 0 → 默认不通过（需人工确认）

**规则3：总分参考**
- < 12：通常不通过
- 12-15：参考区间，结合具体问题判断
- ≥ 16：通过候选

### 判定流程

1. legacy 示例使用 review-judge.sh 执行判定
2. 生成 pass 字段（true/false）
3. 生成 rework_required 字段
4. 生成 compound_recommended 字段
```

### 6.6 增加 frontmatter + markdown 混合格式

输出模板修改为：

```markdown
---
task_id: <task-id>
stage: review
review_round: 1
reviewer_role: <role>
level: <level>
status: completed

scores:
  correctness: 4
  completeness: 4
  executability: 4
  reusability: 3

summary_score: 15
blocking_issues: 0
major_issues: 1
minor_issues: 2

pass: true
rework_required: false
compound_recommended: true

reviewed_at: <timestamp>
---

# Review Summary

[详细评审内容]
```

### 6.7 增加状态更新

在 skill.md 结尾增加：

```markdown
## 状态更新

1. 生成 04-review.md 到 .claude/tasks/<task-id>/
2. legacy 示例使用 task-manager.sh update --stage review --status completed
3. 根据 pass 字段决定：
   - pass=true：推进 current_stage 到 compound
   - pass=false：保持 current_stage 为 work，设置 status 为 blocked
```

### 6.8 保留内容

**完全保留**：
- 原有的 prompt 正文
- agents 调用逻辑（review/, spec-doc-review/）
- 核心评审流程
- 评审维度定义

## 7. spec-compound 改造

### 7.1 复制文件

```bash
cp -r /Users/kuang/xiaobu/compound-engineering-plugin/plugins/compound-engineering/skills/ce-compound \
      skills/spec-compound
```

### 7.2 修改 skill 名称

**文件**：`skills/spec-compound/skill.md`

**修改**：
```markdown
---
name: spec-compound  # 原：ce-compound
description: 知识沉淀、资产提取
---
```

### 7.3 增加阶段契约检查

在 skill.md 开头增加：

```markdown
## 阶段契约检查

1. legacy 示例使用 stage-gate.sh 检查上游产物
   - 验证 04-review.md 存在
   - 验证 04-review.md 非空
   - **验证 pass=true**（关键检查）
   - 验证 legacy task.yaml 中 review 阶段已完成

2. 读取 legacy task.yaml
   - legacy 示例使用 task-manager.sh read
   - 获取 task_id, role, level

3. 验证沉淀条件
   - 确认 review 通过
   - 确认满足沉淀门槛
```

### 7.4 修改输出路径

**原输出**：可能是 `docs/compound/` 或其他位置

**新输出**：
- 主产物：`.claude/tasks/<task-id>/05-compound.md`
- 资产迁移：`.claude/assets/{prompts,workflows,domain,cases}/`

### 7.5 增加资产迁移逻辑

在 skill.md 中增加迁移章节：

```markdown
## 资产迁移

### 迁移条件判断

1. 重复出现3次以上
2. 可跨角色复用
3. 明显提升效率

### 迁移目标目录

- **prompts/**：提示词模板、角色指令
- **workflows/**：任务 SOP、标准流程
- **domain/**：领域知识卡片、术语表
- **cases/**：优秀案例、失败案例

### 资产文件格式

每个资产文件必须包含 frontmatter：

```yaml
---
source_task_id: <task-id>
source_role: <role>
source_stage: compound
created_at: <timestamp>
tags: [tag1, tag2, tag3]
---
```

### 迁移执行

调用 migrate-assets.sh 执行迁移
```

### 7.6 增加 rationale capture

在输出模板中增加章节：

```markdown
## 沉淀决策理由

### 为什么沉淀这些内容
[说明沉淀价值]

### 为什么不沉淀其他内容
[说明排除理由]

### 复用场景
[说明预期复用场景]
```

### 7.7 增加状态更新

在 skill.md 结尾增加：

```markdown
## 状态更新

1. 生成 05-compound.md 到 .claude/tasks/<task-id>/
2. 执行资产迁移到 .claude/assets/
3. legacy 示例使用 task-manager.sh update --stage compound --status completed
4. 设置 legacy task.yaml 的 status 为 completed
```

### 7.8 保留内容

**完全保留**：
- 原有的 prompt 正文
- agents 调用逻辑（research/, docs/）
- 核心沉淀流程
- 知识提取逻辑

## 8. 改造验证清单

### 8.1 文件结构验证

- [ ] 5 个 skills 目录已创建
- [ ] 每个 skill 包含 skill.md
- [ ] 每个 skill 包含 templates/ 目录

### 8.2 命名验证

- [ ] 所有 ce-* 已替换为 spec-*
- [ ] 内部引用已更新
- [ ] 文档引用已更新

### 8.3 路径验证

- [ ] 输出路径指向 .claude/tasks/<task-id>/
- [ ] 资产路径指向 .claude/assets/
- [ ] task.yaml 路径正确

### 8.4 机制验证

- [ ] 阶段契约检查已增加
- [ ] task.yaml 读写已增加
- [ ] 状态更新已增加
- [ ] review 双重判定已增加
- [ ] rationale capture 已增加

### 8.5 依赖验证

- [ ] agents 调用路径正确
- [ ] 上游产物检查正确
- [ ] 状态流转逻辑正确

## 9. 改造注意事项

### 9.1 保持原有质量

- 不修改 Every 的 prompt 正文
- 不修改核心工作流逻辑
- 不修改 agents 实现

### 9.2 最小化改动

- 只改必须改的部分
- 避免过度设计
- 保持简单可控

### 9.3 测试验证

- 每个 skill 改造后立即测试
- 验证阶段流转正常
- 验证产物生成正确

## 10. 总结

本文档提供了 5 个核心 skills 从 Every 基座改造为 spec-first 的详细步骤。

**改造原则**：
- 复用 Every 的 prompt 正文
- 最小化改动
- 增加必需的新机制

**改造重点**：
- 命名空间（ce: → spec:）
- 输出路径（适配 .claude/tasks/）
- 阶段契约机制
- Review 双重判定
- 资产迁移逻辑

**预期结果**：
- 5 个 skills 完成改造
- 保持 Every 的高质量 prompt
- 符合 spec-first 设计
- 可正常运行
