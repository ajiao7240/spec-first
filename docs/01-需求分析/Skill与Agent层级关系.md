# Skill 与 Agent 层级关系

## 层级架构

```
用户（User）
    ↓ 调用命令
┌─────────────────────────────────────┐
│  Skill（编排层 / Orchestrator）      │
│  - 用户直接调用的入口                │
│  - 负责流程编排和决策                │
│  - 选择和调度 agents                 │
└─────────────────────────────────────┘
    ↓ 调用 Agent 工具
┌─────────────────────────────────────┐
│  Agents（执行层 / Specialists）      │
│  - 被 skill 调用的专家               │
│  - 专注单一领域的任务                │
│  - 返回结构化结果                    │
└─────────────────────────────────────┘
    ↓ 使用工具
┌─────────────────────────────────────┐
│  Tools（工具层）                     │
│  - Read, Write, Bash, Grep 等        │
└─────────────────────────────────────┘
```

## 驱动关系：Skill 驱动 Agents

### 1. Skill = 指挥官

**职责：**
- 接收用户请求
- 理解任务目标
- 制定执行策略
- 选择合适的 agents
- 协调多个 agents 并行/串行执行
- 汇总结果并呈现给用户

**示例：`/ce:review` skill**

```markdown
## Phase 1: 分析变更
- 读取 git diff
- 识别变更类型（auth/database/API/etc）

## Phase 2: 选择评审团队
- Always-on: correctness, testing, maintainability
- Conditional:
  - 发现 auth 代码 → 添加 security-reviewer
  - 发现数据库查询 → 添加 performance-reviewer

## Phase 3: 并行调用 agents
- 使用 Agent 工具调用每个 reviewer
- 传递 diff 和上下文

## Phase 4: 汇总反馈
- 收集所有 agent 的输出
- 合并为统一报告
- 呈现给用户
```

### 2. Agent = 专家

**职责：**
- 接收 skill 传递的任务
- 专注执行单一领域的分析
- 使用工具（Read/Grep/Bash）获取信息
- 返回结构化结果给 skill

**示例：`correctness-reviewer` agent**

```markdown
## 输入（来自 skill）
- git diff
- 文件路径
- 审查上下文

## 执行
1. 使用 Read 工具读取相关文件
2. 分析逻辑错误
3. 检查边界条件
4. 识别状态管理问题

## 输出（返回给 skill）
{
  "reviewer": "correctness",
  "findings": [...],
  "residual_risks": [...],
  "testing_gaps": [...]
}
```

## 具体执行流程示例

### 场景：用户执行 `/ce:review`

```
Step 1: 用户调用
用户: /ce:review

Step 2: Skill 启动（ce-review）
ce-review skill:
  ├─ 读取 git diff
  ├─ 分析变更内容
  │   - 发现修改了 auth_controller.rb
  │   - 发现修改了 users 表查询
  │   - 发现修改了 API 路由
  └─ 决定启用的 agents:
      ├─ correctness-reviewer (always-on)
      ├─ testing-reviewer (always-on)
      ├─ security-reviewer (因为改了 auth)
      ├─ performance-reviewer (因为改了查询)
      └─ api-contract-reviewer (因为改了 API)

Step 3: 并行调用 Agents
ce-review skill 使用 Agent 工具:
  ├─ Agent(correctness-reviewer, diff, context)
  ├─ Agent(testing-reviewer, diff, context)
  ├─ Agent(security-reviewer, diff, context)
  ├─ Agent(performance-reviewer, diff, context)
  └─ Agent(api-contract-reviewer, diff, context)

Step 4: Agents 执行
correctness-reviewer:
  ├─ Read(auth_controller.rb)
  ├─ 分析逻辑错误
  └─ 返回 JSON 结果

security-reviewer:
  ├─ Read(auth_controller.rb)
  ├─ 检查安全漏洞
  └─ 返回 JSON 结果

... (其他 agents 并行执行)

Step 5: Skill 汇总结果
ce-review skill:
  ├─ 收集所有 agent 返回的 JSON
  ├─ 合并为统一报告
  ├─ 按严重程度排序
  └─ 生成 Markdown 报告

Step 6: 呈现给用户
输出完整的代码审查报告
```

## 关键特征

### Skill 的特征
- ✅ 用户可见（出现在命令列表）
- ✅ 有完整的用户交互流程
- ✅ 可以调用多个 agents
- ✅ 负责结果的整合和呈现

### Agent 的特征
- ❌ 用户不直接调用
- ✅ 只被 skill 调用
- ✅ 专注单一任务
- ✅ 返回结构化数据
- ✅ 可以被多个 skills 复用

## 类比理解

**餐厅模式：**
- **用户** = 顾客
- **Skill** = 服务员（接单、协调、上菜）
- **Agents** = 厨师团队（主厨、配菜师、甜点师）
- **Tools** = 厨具（刀、锅、烤箱）

顾客不会直接找厨师，而是通过服务员。服务员根据订单决定需要哪些厨师参与。

## 对 Spec-First 的应用

```
/spec:brainstorm (skill)
    ↓ 驱动
    ├─ Agent(requirement-analyzer)  # 分析需求
    ├─ Agent(constraint-checker)    # 检查约束
    └─ Agent(approach-generator)    # 生成方案

/spec:review (skill)
    ↓ 驱动
    ├─ Agent(logic-reviewer)        # 逻辑审查
    ├─ Agent(completeness-checker)  # 完整性检查
    └─ Agent(risk-assessor)         # 风险评估
```

## 总结

**Skill 是指挥官，Agents 是士兵。用户指挥 Skill，Skill 调度 Agents。**

### Agents 目录的设计模式

**agents/ 下的多个实现 = 不同场景的专业评审员**

这不是"选择实现"，而是**动态组合多个专家**来完成复杂任务。

一个 skill 可以：
- 调用多个 agents
- 根据场景动态选择 agents
- 并行或串行执行 agents
- 汇总所有 agents 的结果

这种设计实现了**可扩展的专家系统**。

