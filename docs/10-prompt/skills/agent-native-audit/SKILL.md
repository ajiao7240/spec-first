---
name: agent-native-audit
description: 使用评分原则运行全面的代理本机架构审查
argument-hint: "[optional: specific principle to audit]"
disable-model-invocation: true
---
# Agent-Native 架构审计

根据代理本机架构原则对代码库进行全面审查，为每个原则启动并行子代理并生成评分报告。

## 审计的核心原则

1. **动作对等** - “用户能做的，代理也能做”
2. **工具作为原语** - “工具提供能力，而不是行为”
3. **上下文注入** - “系统提示包含有关应用程序状态的动态上下文”
4. **共享工作空间** - “代理和用户在同一数据空间中工作”
5. **CRUD 完整性** - “每个实体都有完整的 CRUD（创建、读取、更新、删除）”
6. **UI 集成** - “代理操作立即反映在 UI 中”
7. **能力发现** - “用户可以发现代理可以做什么”
8. **提示原生功能** - “功能是定义结果的提示，而不是代码”

## 工作流程

### 第 1 步：加载 Agent-Native 技能

首先，调用代理原生架构技能来理解所有原理：
```
/agent-native-architecture
```
选择选项 7（操作奇偶校验）以加载完整的参考材料。

### 第 2 步：启动并行子代理

使用带有 `subagent_type: Explore` 的任务工具启动 8 个并行子代理，每个原则一个。每个代理人应该：

1. 枚举代码库中的所有实例（用户操作、工具、上下文、数据存储等）
2.检查是否符合原则
3. 提供具体分数，例如“Y 中的 X（百分比%）”
4. 列出具体差距和建议

<子代理>

**代理 1：行动平等**
```
Audit for ACTION PARITY - "Whatever the user can do, the agent can do."

Tasks:
1. Enumerate ALL user actions in frontend (API calls, button clicks, form submissions)
   - Search for API service files, fetch calls, form handlers
   - Check routes and components for user interactions
2. Check which have corresponding agent tools
   - Search for agent tool definitions
   - Map user actions to agent capabilities
3. Score: "Agent can do X out of Y user actions"

Format:
## Action Parity Audit
### User Actions Found
| Action | Location | Agent Tool | Status |
### Score: X/Y (percentage%)
### Missing Agent Tools
### Recommendations
```
**代理 2：作为原语的工具**
```
Audit for TOOLS AS PRIMITIVES - "Tools provide capability, not behavior."

Tasks:
1. Find and read ALL agent tool files
2. Classify each as:
   - PRIMITIVE (good): read, write, store, list - enables capability without business logic
   - WORKFLOW (bad): encodes business logic, makes decisions, orchestrates steps
3. Score: "X out of Y tools are proper primitives"

Format:
## Tools as Primitives Audit
### Tool Analysis
| Tool | File | Type | Reasoning |
### Score: X/Y (percentage%)
### Problematic Tools (workflows that should be primitives)
### Recommendations
```
**代理 3：上下文注入**
```
Audit for CONTEXT INJECTION - "System prompt includes dynamic context about app state"

Tasks:
1. Find context injection code (search for "context", "system prompt", "inject")
2. Read agent prompts and system messages
3. Enumerate what IS injected vs what SHOULD be:
   - Available resources (files, drafts, documents)
   - User preferences/settings
   - Recent activity
   - Available capabilities listed
   - Session history
   - Workspace state

Format:
## Context Injection Audit
### Context Types Analysis
| Context Type | Injected? | Location | Notes |
### Score: X/Y (percentage%)
### Missing Context
### Recommendations
```
**代理 4：共享工作空间**
```
Audit for SHARED WORKSPACE - "Agent and user work in the same data space"

Tasks:
1. Identify all data stores/tables/models
2. Check if agents read/write to SAME tables or separate ones
3. Look for sandbox isolation anti-pattern (agent has separate data space)

Format:
## Shared Workspace Audit
### Data Store Analysis
| Data Store | User Access | Agent Access | Shared? |
### Score: X/Y (percentage%)
### Isolated Data (anti-pattern)
### Recommendations
```
**代理 5：CRUD 完整性**
```
Audit for CRUD COMPLETENESS - "Every entity has full CRUD"

Tasks:
1. Identify all entities/models in the codebase
2. For each entity, check if agent tools exist for:
   - Create
   - Read
   - Update
   - Delete
3. Score per entity and overall

Format:
## CRUD Completeness Audit
### Entity CRUD Analysis
| Entity | Create | Read | Update | Delete | Score |
### Overall Score: X/Y entities with full CRUD (percentage%)
### Incomplete Entities (list missing operations)
### Recommendations
```
**代理 6：UI 集成**
```
Audit for UI INTEGRATION - "Agent actions immediately reflected in UI"

Tasks:
1. Check how agent writes/changes propagate to frontend
2. Look for:
   - Streaming updates (SSE, WebSocket)
   - Polling mechanisms
   - Shared state/services
   - Event buses
   - File watching
3. Identify "silent actions" anti-pattern (agent changes state but UI doesn't update)

Format:
## UI Integration Audit
### Agent Action → UI Update Analysis
| Agent Action | UI Mechanism | Immediate? | Notes |
### Score: X/Y (percentage%)
### Silent Actions (anti-pattern)
### Recommendations
```
**代理 7：能力发现**
```
Audit for CAPABILITY DISCOVERY - "Users can discover what the agent can do"

Tasks:
1. Check for these 7 discovery mechanisms:
   - Onboarding flow showing agent capabilities
   - Help documentation
   - Capability hints in UI
   - Agent self-describes in responses
   - Suggested prompts/actions
   - Empty state guidance
   - Slash commands (/help, /tools)
2. Score against 7 mechanisms

Format:
## Capability Discovery Audit
### Discovery Mechanism Analysis
| Mechanism | Exists? | Location | Quality |
### Score: X/7 (percentage%)
### Missing Discovery
### Recommendations
```
**代理 8：提示本地功能**
```
Audit for PROMPT-NATIVE FEATURES - "Features are prompts defining outcomes, not code"

Tasks:
1. Read all agent prompts
2. Classify each feature/behavior as defined in:
   - PROMPT (good): outcomes defined in natural language
   - CODE (bad): business logic hardcoded
3. Check if behavior changes require prompt edit vs code change

Format:
## Prompt-Native Features Audit
### Feature Definition Analysis
| Feature | Defined In | Type | Notes |
### Score: X/Y (percentage%)
### Code-Defined Features (anti-pattern)
### Recommendations
```
</子代理>

### 第 3 步：编写总结报告

所有代理完成后，使用以下内容编译摘要：
```markdown
## Agent-Native Architecture Review: [Project Name]

### Overall Score Summary

| Core Principle | Score | Percentage | Status |
|----------------|-------|------------|--------|
| Action Parity | X/Y | Z% | ✅/⚠️/❌ |
| Tools as Primitives | X/Y | Z% | ✅/⚠️/❌ |
| Context Injection | X/Y | Z% | ✅/⚠️/❌ |
| Shared Workspace | X/Y | Z% | ✅/⚠️/❌ |
| CRUD Completeness | X/Y | Z% | ✅/⚠️/❌ |
| UI Integration | X/Y | Z% | ✅/⚠️/❌ |
| Capability Discovery | X/Y | Z% | ✅/⚠️/❌ |
| Prompt-Native Features | X/Y | Z% | ✅/⚠️/❌ |

**Overall Agent-Native Score: X%**

### Status Legend
- ✅ Excellent (80%+)
- ⚠️ Partial (50-79%)
- ❌ Needs Work (<50%)

### Top 10 Recommendations by Impact

| Priority | Action | Principle | Effort |
|----------|--------|-----------|--------|

### What's Working Excellently

[List top 5 strengths]
```
## 成功标准

- [ ] 8 个分代理全部完成审核
- [ ] 每个原则都有一个特定的数字分数（X/Y 格式）
- [ ] 汇总表显示所有分数和状态指标
- [ ] 前 10 条建议按影响优先排序
- [ ] 报告指出了优势和差距

## 可选：单一原则审核

如果 $ARGUMENTS 指定单个原则（例如“操作奇偶校验”），则仅运行该子代理并单独提供该原则的详细结果。

有效参数：
- `action parity` 或 `1`
- `tools` 或 `primitives` 或 `2`
- `context` 或 `injection` 或 `3`
- `shared` 或 `workspace` 或 `4`
- `crud` 或 `5`
- `ui` 或 `integration` 或 `6`
- `discovery` 或 `7`
- `prompt` 或 `features` 或 `8`
