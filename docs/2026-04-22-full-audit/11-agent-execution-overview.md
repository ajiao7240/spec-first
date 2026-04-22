# 11 Agent Execution Overview

## 目标

本次审计采用多 Agent 协作模式，以提高覆盖完整度，但坚持单一真相源：**代码与已读仓库资产为第一事实来源**。

## Agent 配置

### Agent 1：代码事实审查 Agent
- 职责：覆盖 `src/cli`、`src/bootstrap-compiler`、`src/context-routing`、`src/crg` 的代码事实、分层职责、关键调用链与热点模块
- 边界：只做事实层与架构判断，不做最终路线图裁决

### Agent 2：工程质量与可维护性 Agent
- 职责：覆盖 `package.json`、`bin/`、`scripts/`、`tests/`、`doctor/init/clean/release/postinstall` 链路
- 边界：只做工程质量事实与成熟度判断，不替代哲学裁决

### Agent 3：workflow / 资产治理 Agent
- 职责：覆盖 `skills/`、`agents/`、`templates/`、`docs/contracts/`、`docs/solutions/`、`docs/contexts/`、`.claude-plugin/`
- 边界：只负责 source-of-truth / mirror / runtime copy / generated artifact 边界，不替代 CLI/CRG 代码审计

### Agent 4：外部研究与对标 Agent
- 职责：研究与 spec-first 相近的问题域，提炼可吸收的能力，而不是照搬 feature
- 边界：只输出能力抽象与兼容性判断，不直接裁决仓库代码优劣

### Agent 5：最佳实践辩论与系统哲学 Agent
- 职责：组织多角色辩论，判断哪些地方接近最佳实践、哪些只是当前可用、哪些存在跑偏风险
- 边界：不得脱离代码事实空谈理念

### Agent 6：主裁决 Agent（由主协调器承担）
- 职责：汇总事实层、辩论层、外部研究层结果，处理冲突并形成最终路线图与裁决理由
- 边界：不得篡改事实层结论，只能基于证据做取舍

## 执行顺序

### Phase 1：事实建立
- 代码事实审查 Agent
- 工程质量与可维护性 Agent
- workflow / 资产治理 Agent
- 主协调器补充亲读关键热点文件

### Phase 2：判断与对标
- 外部研究与对标 Agent
- 最佳实践辩论与系统哲学 Agent

### Phase 3：裁决与文档输出
- 主协调器整合所有 agent 输出
- 生成 15 份审计文档草案

## 冲突处理机制

1. 事实层优先于判断层
2. 代码事实优先于 README/CLAUDE 叙述
3. 当 agent 之间结论冲突时：
   - 先回到具体文件/模块证据
   - 再做哲学与演化层裁决
4. 对外部实践只吸收“能力”，不做 feature copy

## 单一真相源原则

- 代码事实：主协调器亲读关键文件复核
- agent 输出：作为压缩后的结构化观察，不直接替代代码证据
- 文档结论：必须区分“代码事实 / 判断 / 建议动作”
