---
name: tech-center-six-harness-capabilities
title: spec-first 技术中心分享：六层 AI Coding Harness 能力详解
description: 面向技术中心分享的讲稿型文档，解释 spec-first 的 Context、Execution、Evidence、Review、Knowledge、Governance 六层 Harness 如何让 AI Coding 从一次性流程变成越用越聪明的工程闭环。
metadata:
  type: sharing-notes
  audience: tech-center
  status: draft
  created_at: 2026-06-04
---

# spec-first 六层 AI Coding Harness 能力详解

这份文档用于技术中心内部分享。主线不是"多一套流程"，也不是"接入 Graph 工具"，而是：

> spec-first 是 AI Coding Harness：把不稳定的 AI 推理，放进可重复、可观察、可验证、可沉淀、可进化的工程闭环里。

Graph 是其中的 Context Harness 能力之一。它让 AI 更快知道"该看哪里"，但系统真正越用越聪明，靠的是六层 Harness 共同产生的飞轮：

```text
Context -> Execution -> Evidence -> Review -> Knowledge -> Governance
      ^                                                       |
      |                                                       v
      +------------------- Better Context <-------------------+
```

每次任务结束时，spec-first 不只交付代码，还会留下需求理解、计划拆解、验证证据、审查结论、复用知识和治理边界。下一次 AI Coding 会消费这些资产，因此不再从零开始。

## 一页总览

| Harness 层 | 解决的问题 | spec-first 中的体现 | 产出的可复用资产 |
| --- | --- | --- | --- |
| Context Harness | AI 不知道应该相信什么上下文 | source read、context bundle、Graph | 相关路径、影响面、上下文摘要、provider limitation |
| Execution Harness | AI 执行过程容易漂移 | spec、plan、tasks、work | requirements、plan、task pack、work handoff |
| Evidence Harness | AI 容易宣称"已验证"但没有证据 | tests、logs、doctor、closeout | verification summary、run artifact、not-run reason |
| Review Harness | 风险、回归和边界破坏难以前置发现 | code-review、doc-review | findings、residual risks、review handoff |
| Knowledge Harness | 问题解决后经验随会话消失 | docs/solutions、RCA、决策记录 | reusable learning、RCA、architecture pattern |
| Governance Harness | source、runtime、provider、artifact 容易混成一团 | source/runtime/provider/artifact contract | 边界规则、readiness facts、degraded mode |

## 1. Context Harness：给 AI 正确上下文，不给无限上下文

### 它解决什么问题

AI Coding 的第一个失败点通常不是代码能力，而是上下文输入质量。

常见问题包括：

- AI 靠文件名和关键词猜相关代码；
- 把过期文档、generated runtime mirror、provider dump 当成事实；
- 读了很多材料，但没有读到当前任务真正相关的 source、diff、tests；
- Graph 或 MCP 给了候选路径后，AI 没有回到源码确认。

Context Harness 的目标不是"把仓库都塞给 AI"，而是让 AI 拿到有边界、相关、可追溯的决策输入。

### spec-first 怎么做

Context Harness 由几类输入组成：

| 输入 | 作用 | 边界 |
| --- | --- | --- |
| bounded source read | 读取当前任务相关源码、测试、配置 | 这是确认事实的主路径 |
| `rg` / ast-grep | 快速定位文本或结构化代码模式 | 负责发现候选，不替代语义判断 |
| context bundle | 把相关路径、证据摘要、排除原因打包 | 不广播整个 repo |
| Graph | 提供 symbol、调用链、依赖边界、影响面候选 | Graph 输出是 candidate，不是最终结论 |
| `docs/solutions` | 召回历史解决方案和经验 | 旧知识必须检查适用性和 freshness |

Graph 在这一层的定位很关键：

```text
Graph 告诉 AI 应该去哪里看；
source read 确认那里到底是什么；
LLM 判断这件事对当前任务意味着什么。
```

这让 AI 从"猜相关文件"变成"带候选证据定位相关文件"。

### 输入与输出

输入：

- 用户请求；
- 当前 diff / changed files；
- 相关 source / tests / configs；
- Graph 候选路径、调用链、影响面；
- 历史 solutions 和上下文摘要。

输出：

- `related_paths`；
- `evidence_paths`；
- `excluded_context` 和 reason code；
- provider freshness / limitation；
- 下一阶段 spec、plan、work、review 可消费的上下文包。

### 关键原则

- 正确上下文优先于更多上下文；
- source-of-truth 优先于 generated runtime；
- provider facts 默认是 advisory；
- Graph 结果必须带 freshness、limitations 和 source-read requirement；
- 上下文超预算时显式记录，不静默截断。

### 反模式

- 把 `.claude/`、`.codex/`、`.agents/skills/` 当 source 读；
- 把 Graph 输出直接写成 root cause；
- 把 MCP dump 原样塞进长期文档；
- 每次 workflow 都重新广播所有治理文档；
- 读了很多背景材料，却没有读当前任务的源码和测试。

### 分享话术

> Context Harness 的价值不是让 AI 看更多，而是让 AI 更早站在正确事实上判断。Graph 是这个层里的增强能力，但它只负责指路，不能替代源码确认。

## 2. Execution Harness：把任务执行变成可跟踪流程

### 它解决什么问题

AI 一次性执行任务时，经常出现三种漂移：

- 需求漂移：做着做着改了用户没有要求的东西；
- 计划漂移：中途发现问题后扩大范围，但没有重新确认；
- 完成口径漂移：代码改了，但不知道是否满足原始目标。

Execution Harness 的目标是把需求、计划、任务和实现连接起来，让 AI 的每一步都有来源和边界。

### spec-first 怎么做

Execution Harness 覆盖这条链路：

```text
Spec -> Plan -> Tasks -> Work
```

对应能力：

| 节点 | 作用 | 典型产物 |
| --- | --- | --- |
| `spec-brainstorm` / `spec-prd` | 明确 WHAT、goals、non-goals、success criteria | requirements / PRD |
| `spec-plan` | 决定 HOW，拆 implementation units | plan |
| `spec-write-tasks` | 把计划编译成可执行任务包 | task pack |
| `spec-work` | 按 scope 执行、验证、收尾 | diff、verification、handoff |

这不是要把研发变成强状态机。真正要固化的是 scope、handoff 和 evidence，而不是把每个判断写死。

### 输入与输出

输入：

- requirements / PRD；
- plan；
- task pack；
- context bundle；
- 当前 repo / target repo 边界；
- scope boundaries 和 non-goals。

输出：

- 变更 diff；
- work summary；
- focused verification；
- review handoff；
- completion closeout；
- 需要 compound 的候选 learning。

### 关键原则

- WHAT 不清楚时先 spec，不直接 work；
- HOW 不清楚时先 plan，不边做边猜；
- task pack 是可执行边界，不是灵感清单；
- scope 扩大时停下来，而不是静默扩张；
- 每个实现切片都尽量有反馈环。

### 反模式

- 用户给一句话需求，AI 直接大改；
- plan 写成愿望清单，没有 implementation boundary；
- task 执行时发现新问题后顺手扩大范围；
- work closeout 只说"完成了"，不说明改了什么、验证了什么、没验证什么。

### 分享话术

> Execution Harness 让 AI 不只是"会写代码"，而是能沿着需求、计划、任务和验证边界交付。它控制的不是模型能力，而是任务不会在执行中失控。

## 3. Evidence Harness：让结论必须有证据来源

### 它解决什么问题

AI Coding 最大的信任问题之一，是它很容易说：

```text
已验证。
测试通过。
问题已修复。
```

但实际上可能没有运行测试，或者运行的是不相关测试，或者命令失败了但被自然语言掩盖。

Evidence Harness 的目标是让每个关键结论都能回答：

- 证据来自哪里？
- 命令真的运行了吗？
- exit code 是什么？
- 失败或未运行的原因是什么？
- 这个证据是否足够支撑当前结论？

### spec-first 怎么做

Evidence Harness 使用确定性事实支撑语义判断：

| 证据类型 | 例子 | 作用 |
| --- | --- | --- |
| source evidence | focused source read、diff、schema | 确认实现事实 |
| verification evidence | tests、typecheck、lint、CLI output | 确认可运行性 |
| setup evidence | `doctor`、readiness facts、tool facts | 确认环境和依赖状态 |
| closeout evidence | run summary、honest closeout、not-run reason | 防止虚假完成 |
| log evidence | raw log ref、exit code、stderr summary | 支撑失败分析 |

这里的边界是：

```text
脚本负责记录事实；
LLM 负责解释事实是否足够。
```

例如，测试通过是 deterministic fact；这个测试是否覆盖了用户目标，是 LLM judgment。

### 输入与输出

输入：

- verification profile；
- 测试命令；
- CLI / script output；
- `doctor` 输出；
- tool readiness；
- setup facts；
- source diff。

输出：

- verification run summary；
- closeout verdict；
- not-run / skipped / degraded reason；
- evidence refs；
- residual risk。

### 关键原则

- 安装不是验证；
- 配置不是执行；
- dry-run 不是通过；
- provider 可用不是上下文已确认；
- 未运行必须明说，而不是用"建议运行"掩盖。

### 反模式

- 没跑测试却写"测试通过"；
- 把 `npm install` 成功当成系统验证成功；
- 把 Graph fresh 当成 confirmed context；
- 只在 final response 里自然语言描述验证，没有 artifact 或命令证据；
- 命令失败后继续声称任务完成。

### 分享话术

> Evidence Harness 的作用，是把"AI 说它做完了"变成"我们能看到它到底验证了什么"。这不是不信任 AI，而是把信任建立在可复验事实上。

## 4. Review Harness：把审查变成风险发现和知识生产

### 它解决什么问题

传统 AI 代码审查容易停在风格和建议层面：

- 看到 diff，但不了解需求和计划；
- 发现一些可能问题，但缺少证据路径；
- 对 contract、边界、回归、缺失测试关注不足；
- review 发现没有沉淀，下次还会重复出现。

Review Harness 的目标是让 review 变成工程质量闭环的一部分，而不是最后的形式化检查。

### spec-first 怎么做

Review Harness 覆盖两类审查：

| 审查类型 | 入口 | 关注点 |
| --- | --- | --- |
| 代码审查 | `spec-code-review` | bug、回归、边界破坏、缺失测试、API shape mismatch |
| 文档审查 | `spec-doc-review` | 需求缺口、计划不可执行、scope 不清、证据不足、artifact contract 漂移 |

Review 不只是看 diff，还要关联：

- 原始需求；
- plan / task pack；
- actual changed files；
- Graph 影响面候选；
- source-read confirmation；
- verification evidence；
- prior solutions / known risks。

### 输入与输出

输入：

- diff；
- requirements / plan / task pack；
- changed files；
- context bundle；
- verification evidence；
- Graph impact candidates；
- existing docs / contracts / solutions。

输出：

- finding list；
- severity；
- file / line evidence；
- risk explanation；
- suggested fix；
- residual risk；
- 是否需要 compound 的 learning 候选。

### 关键原则

- findings 必须有文件、行号或直接证据；
- 风险按行为影响排序，不按风格偏好排序；
- Graph 只辅助找影响面，finding 仍需源码证据；
- review 后的高价值经验应进入 Knowledge Harness；
- review 不是阻塞一切，而是提高决策质量。

### 反模式

- review 只输出泛泛建议；
- 没有证据就声明 bug；
- 把旧文档当当前 runtime contract；
- 只看改动文件，不看消费者或调用方；
- 发现同类问题后不沉淀规则或 learning。

### 分享话术

> Review Harness 的价值不是多一个检查环节，而是让风险、回归和隐含边界在合入前被看见，并把有复用价值的经验沉淀下来。

## 5. Knowledge Harness：让每次解决的问题成为下一次输入优势

### 它解决什么问题

如果每次任务结束后只留下代码 diff，AI 下次仍然会从零开始。

常见浪费包括：

- 同一个 bug 反复调查；
- 同一个架构约束反复解释；
- review 发现反复出现；
- 历史决策散落在聊天记录里；
- 团队经验没有进入下次 AI 的上下文。

Knowledge Harness 的目标是把一次性经验变成可发现、可复用、可维护的项目知识。

### spec-first 怎么做

Knowledge Harness 的核心产物是 `docs/solutions/`。

它沉淀的不是流水账，而是 verified learning：

| 知识类型 | 内容 | 下次如何复用 |
| --- | --- | --- |
| Bug track | 症状、根因、失败尝试、修复方式、预防策略 | debug 时跳过无效路径 |
| Knowledge track | 架构模式、边界规则、实践方法 | plan / work / review 时作为项目经验 |
| RCA | root cause、证据、修复、验证 | 类似问题快速定位 |
| Decision record | 为什么选 A 不选 B | 避免重复争论 |
| Pattern | 可复用实现或治理模式 | 新任务复用已有方法 |

Knowledge Harness 和 Context Harness 是闭环关系：

```text
本次任务 -> compound -> docs/solutions -> 下次 context bundle
```

这就是"越用越聪明"的关键。

### 输入与输出

输入：

- 已解决的问题；
- root cause；
- review finding；
- verification evidence；
- failed attempts；
- accepted design decision；
- user-confirmed learning。

输出：

- `docs/solutions/**` learning；
- related docs links；
- when-to-apply；
- what-did-not-work；
- prevention；
- future context refs。

### 关键原则

- 只沉淀已验证、可复用的经验；
- 不把临时猜测写成长期知识；
- learning 要说明适用条件；
- 旧知识需要 refresh，不能永久当真；
- 知识应该 summary-first，避免 raw dump。

### 反模式

- 每次任务都机械写文档；
- 把未验证推理写成团队规范；
- 只记录"怎么做"，不记录"为什么这样做"和"什么没用"；
- 重复创建相似 solution，不检查已有知识；
- 长期知识没有适用条件，导致后续误用。

### 分享话术

> Knowledge Harness 是 spec-first 自我进化的核心。没有它，每次 AI Coding 都只是一次性对话；有了它，每次解决问题都会让下一次更快、更准。

## 6. Governance Harness：守住边界，防止系统越用越乱

### 它解决什么问题

当 AI Coding 规模化后，最大风险不是少做一步，而是边界混乱：

- source 和 generated runtime 混成多个真相源；
- provider 输出被当成 confirmed truth；
- 脚本开始替 LLM 做语义判断；
- LLM 又开始假装跑过确定性校验；
- runtime、artifact、contract、workflow 之间互相污染；
- 为了自动化引入重状态机，反而降低可维护性。

Governance Harness 的目标是让系统在变聪明的同时不失控。

### spec-first 怎么做

Governance Harness 主要守住四组边界：

| 边界 | 规则 |
| --- | --- |
| source/runtime | 修改 `skills/`、`agents/`、`templates/`、`src/cli/`、`docs/`；不手改 `.claude/`、`.codex/`、`.agents/skills/` |
| script/LLM | 脚本产出 deterministic facts；LLM 做语义判断 |
| provider/evidence | Graph、MCP、browser、external tools 先是 advisory；确认必须回到 source/test/log/contract/user evidence |
| artifact/state | artifact 是证据和 handoff，不是隐藏 workflow state 或审批状态 |

它背后的核心哲学是：

```text
Light contract
Explicit boundaries
Scripts prepare, LLM decides
```

治理不是为了增加流程，而是为了让沉淀出来的资产可信、可维护、可复用。

### 输入与输出

输入：

- source files；
- generated runtime assets；
- provider readiness；
- workflow artifacts；
- contract schemas；
- setup / doctor facts；
- changelog / release evidence。

输出：

- source-of-truth 边界；
- provider readiness / freshness；
- reason codes；
- degraded mode；
- explicit next action；
- contract / changelog 记录。

### 关键原则

- source-first，不 runtime patch；
- preview-first，不 silent write；
- advisory facts 不冒充 confirmed truth；
- required 不等于 baseline blocking；
- minimal 默认可用，optional capability 显式启用；
- 每个新机制必须服务核心链路。

### 反模式

- 为了修行为直接改 generated runtime mirror；
- 用 provider 内部实现细节定义 workflow contract；
- 让脚本判断架构优先级；
- 让 LLM 编造命令结果；
- 新增大量规则但没有实际 consumer；
- 用中心化状态机替代工程判断。

### 分享话术

> Governance Harness 不是"管住 AI"，而是让 AI、脚本、provider、artifact 各自站在正确边界内工作。边界清楚，知识沉淀才不会变成污染源。

## 六层如何形成自我进化飞轮

可以用一条任务链来解释六层协作：

```text
1. Context Harness 找到当前任务应该相信的上下文
2. Execution Harness 把需求拆成可执行路径
3. Evidence Harness 记录真实验证结果
4. Review Harness 发现风险、回归和缺失证据
5. Knowledge Harness 把高价值经验沉淀成 reusable learning
6. Governance Harness 保证这些资产边界清晰、来源可信
7. 下一次任务从更好的 Context 开始
```

这就是 spec-first 的核心：

> 不是完成一次任务，而是让每一次任务都增强下一次 AI Coding。

## 技术中心分享建议

### 建议讲法

1. 先讲问题：AI Coding 每次像从零开始；
2. 再讲 Harness：模型负责推理，Harness 负责上下文、流程、证据、知识和边界；
3. 然后讲六层：每层解决一个信任缺口；
4. 特别强调 Knowledge -> Better Context 的回流；
5. 最后讲 Graph：Graph 是 Context Harness 的重要能力，但不是主线本身。

### 一句话定位

```text
spec-first = AI Coding Harness

Workflow 让过程可控
Graph 让上下文更准
Evidence 让结论可信
Review 让风险前置
Knowledge 让经验复用
Governance 让系统不失控
```

### 结束页文案

> spec-first 的价值不是让 AI 多写一点代码，而是让每一次 AI Coding 都留下可复用的工程资产。
> 用得越多，项目上下文越清楚，验证证据越完整，团队经验越可复用，下一次协作也就越聪明。
