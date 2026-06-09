---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: a88644969371398a873cabeac0a028ab_9c96b91263e711f196be5254006c9bbf
    ReservedCode1: 3tg7tsxE3proStYZ2P7TG/Ld0V+w1/W9DUdUx7JVppm2687ixAW15WoL9AIhh4mOYYw5F5EpKXmJ9q4SHOXRz/SFsGdRGoxJemxO7MKkXeQULDOBZJfyFPDkRHDdfsVDZS7OXB5Qal+swDLEONZNW+BIpBtrtLFGtOUVNpRPT4gCkxmTCX6SsBWZe18=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: a88644969371398a873cabeac0a028ab_9c96b91263e711f196be5254006c9bbf
    ReservedCode2: 3tg7tsxE3proStYZ2P7TG/Ld0V+w1/W9DUdUx7JVppm2687ixAW15WoL9AIhh4mOYYw5F5EpKXmJ9q4SHOXRz/SFsGdRGoxJemxO7MKkXeQULDOBZJfyFPDkRHDdfsVDZS7OXB5Qal+swDLEONZNW+BIpBtrtLFGtOUVNpRPT4gCkxmTCX6SsBWZe18=
---

# Code Review Skill 测试决策单补充分析

> 基于 [Alan の测试 06: 我把测试平台做成一堆工具后，才发现用户真正要的是一张测试决策单](https://mp.weixin.qq.com/s/9twiLwgBfdwdXQLSF7jbMg)
> 分析日期: 2026-06-09

## 一、文章核心方法论

文章的核心命题是一个产品设计洞察：**平台的价值不在工具数量，而在于能否把判断过程压缩为一张可执行决策单**。

关键论点：

1. **用户不要工具箱，要决策单**——智能问答受欢迎不是因为技术最复杂，而是使用路径最短。用户不需要学习每个工具的边界就能拿到结果
2. **判断负担不能留在用户身上**——工具多了但用户的判断负担没有减少，等于只是把信息集中到一个页面里
3. **主流程缺失是致命伤**——平台能不能在 5 分钟内回答"今天这个版本应该怎么测、哪里最可能出问题、有限时间该先花在哪"
4. **产品不是功能陈列柜，是用户完成任务的路径**

目标输出结构（"测试决策单"）：

```
一句话结论（能不能测？风险高不高？）
  ↓
变更影响范围
  ↓
重点风险点
  ↓
必跑回归 → 建议回归 → 可选回归
  ↓
缺失测试点
  ↓
测试执行清单
```

## 二、spec-code-review 当前决策结构对照

### 已有能力

| 文章概念 | spec-code-review 现状 | 匹配度 |
|---------|----------------------|-------|
| 风险识别 | `severity` (P0/P1/P2/P3) + `confidence` (0/25/50/75/100) + `residual_risks` | 已有，但分散 |
| 缺失测试点 | `testing_gaps` (字符串数组) | 已有，但无分级 |
| 变更影响 | 无结构化字段，散落在各 finding 的 `why_it_matters` | **缺失** |
| 回归推荐 | 无 | **完全缺失** |
| 一句话结论 | 无 | **完全缺失** |
| 测试执行清单 | 无 | **完全缺失** |
| 证据链追溯 | `evidence` 字段（per-finding，snippets） | 单层，无溯因链 |

### 已有但 "工具箱化" 的问题

当前 findings-schema.json 的输出结构本质是一个 "问题清单 + 测试缺口 + 残余风险"，而非一张决策单：

```json
{
  "reviewer": "...",
  "findings": [...],      // 问题列表
  "residual_risks": [...], // 未确认的风险
  "testing_gaps": [...]    // 缺失的测试
}
```

问题：这三个字段之间**没有决策关联**。用户拿到后还是需要自己拼——哪个风险对应哪个回归建议？哪些测试缺失是因为哪些代码变更导致的？P0 问题和必跑回归之间是什么关系？

## 三、应补充的决策逻辑

### 3.1 测试决策分级（核心缺失）

当前 `testing_gaps` 是扁平字符串数组，需要扩展为分层结构：

```json
"testing_plan": {
  "verdict": {
    "testable": true,
    "risk_level": "high",
    "summary": "本次变更涉及支付核心路径重构，高风险，建议完成必跑回归后再合并"
  },
  "change_impact": {
    "affected_modules": ["payment", "order", "notification"],
    "blast_radius": "wide",
    "reasoning": "PaymentService 重构影响下单、退款、通知三条链路"
  },
  "regression_tiers": {
    "must_run": [
      {"test": "PaymentFlowIntegrationTest", "reason": "覆盖重构后的支付核心路径，P0 finding #3 直接关联"},
      {"test": "RefundLifecycleE2E", "reason": "退款状态机变更，confidence=100 的 P0 finding #1"}
    ],
    "suggested": [
      {"test": "NotificationDelayTest", "reason": "通知模块间接触及，residual_risk #2"}
    ],
    "optional": [
      {"test": "PaymentReportExportTest", "reason": "仅报表查询触及，低风险"}
    ]
  },
  "missing_coverage": [
    {"area": "并发支付幂等性", "risk": "P1", "reason": "新增分布式锁逻辑无并发测试"}
  ]
}
```

### 3.2 从 "finding → 测试行动" 的决策链路

每个 finding 应能追溯到一个具体的测试行动，当前缺失这个关联：

| Finding | 当前的决策链 | 应补充的链 |
|---------|------------|----------|
| `severity=P0, confidence=100` → 支付状态机 bug | 用户自己判断该跑什么回归 | 自动映射到 `must_run` tier + 给出具体的回归测试名 |
| `residual_risk` → "通知模块可能受影响" | 用户需要自己决定要不要测 | 映射到 `suggested` tier + 给出风险-测试的推理链 |
| `testing_gaps` → "缺并发测试" | 仅陈述缺口，无优先级 | 带上 risk level + 建议的测试框架/模式 |

### 3.3 新增字段清单

| 新增字段 | 类型 | 说明 | 优先级 |
|---------|------|------|-------|
| `testing_plan.verdict` | object | 一句话结论 + 风险等级 + 可否测试 | P0 |
| `testing_plan.change_impact` | object | 影响范围 + 波及半径 + 推理 | P0 |
| `testing_plan.regression_tiers` | object | 必跑/建议/可选三级回归 + 理由 | P0 |
| `testing_plan.missing_coverage` | array | 缺失测试点 + 风险等级 + 建议框架 | P1 |
| `findings[].regression_link` | string | 该 finding 映射到哪条回归建议 | P1 |
| `testing_plan.execution_checklist` | array | 扁平可执行清单（用于直接跑） | P2 |

### 3.4 对 `findings-schema.json` 的改动范围

- **新增**: 顶层 `testing_plan` 对象（必填），包含 `verdict`、`change_impact`、`regression_tiers`、`missing_coverage`
- **修改**: `findings[].why_it_matters` → 改为结构化对象 `{impact, affected_flows, regression_candidates}`
- **新增**: `findings[].regression_link` → 指向 `testing_plan.regression_tiers` 中的条目
- **保留**: `residual_risks` 和 `testing_gaps` 作为向后兼容的扁平字段，但 `testing_plan` 为 authoritative

### 3.5 对 persona 的影响

- `spec-testing-reviewer` (testing persona)：当前 focus 是 "Coverage gaps, weak assertions, brittle tests, missing edge case tests"——需要扩展为"产出分级回归建议 + 可执行清单"
- 新增 persona 建议：`spec-regression-strategist` —— 专门负责从所有 reviewer 的 findings 中合成 `testing_plan`，类似于 orchestrator 的角色但聚焦测试决策

## 四、与文章方法论的深层映射

文章的核心洞察对 spec-code-review 有三个层面的借鉴：

| 文章层面 | spec-code-review 启示 |
|---------|---------------------|
| **产品定位**: 从"功能陈列柜"收敛为"决策单" | code-review 的输出应从"问题清单 + 测试缺口"收敛为"合并决策 + 测试执行计划" |
| **主流程**: 用户不应该在多个工具之间跳转拼证据 | 用户不应该在 findings / residual_risks / testing_gaps 三个字段之间手动拼决策 |
| **证据追溯**: 用户能顺着结论追溯到证据 | `regression_tiers` 中每条回归应可追溯到具体的 finding 或 residual_risk |

最深层的映射：文章说"AI 的价值是把原来需要测试人员在多个系统之间完成的判断过程，压缩成一条可解释、可复核、可执行的工作流"。spec-code-review 的并行 persona 审查已经是"压缩"的一部分，但压缩的终点是 findings —— 还需要再压缩一步到 testing_plan。

## 五、实施建议

### 第一阶段（P0）：最小决策单

在 findings-schema.json 中新增 `testing_plan` 顶层字段，仅包含：
- `verdict`（一句话结论 + 风险等级）
- `change_impact`（影响模块 + 波及半径）
- `regression_tiers.must_run`（必跑回归 + 理由）

这三点是"5 分钟回答"的底线，不需要新增 persona，由 orchestrator 在合并各 reviewer 结果后合成。

### 第二阶段（P1）：完整决策链

- `regression_tiers` 扩展三级（must_run / suggested / optional）
- `missing_coverage` 加入 risk level
- `findings[].regression_link` 建立追溯链

### 第三阶段（P2）：可执行清单

- `execution_checklist` 扁平化，可直接导入测试运行器
- 可选：新增 `spec-regression-strategist` persona

## 六、总结

spec-code-review 的审查引擎（18 个 persona + 并行派发 + 置信度门控 + 合并去重）已经很强，但它产出的是一份**审查报告**，而不是一份**测试决策单**。用户拿到 findings 后仍需要自己完成"这个该不该测、先测哪个、为什么"的判断。

文章的启示不是要削弱审查引擎，而是在引擎的输出层加一层**决策压缩**——把 18 个 reviewer 的 findings 压缩为一张分级回归清单，让用户从"读报告再判断"变成"拿清单就能执行"。
*（内容由AI生成，仅供参考）*
