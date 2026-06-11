---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: a88644969371398a873cabeac0a028ab_6819d81664d011f1a4b9525400d9a7a1
    ReservedCode1: LJ7IV3N8huseu1nzhSNoTKpsB/Qp2hlmYEJE0IMzup9GSXuq0rMh8ZQLLr+1x8ZHwZLghBPAR0Z+Tfr3nuXs2XBgyAaCVbRpQmQ0b27b3BfpV3LJiwDRRge0AWMyEd9c8hlR/xhoDDKsJxMagt2IZdfTzolesjUl1nEjr7W0ZSltep2yqYARCdwD3mU=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: a88644969371398a873cabeac0a028ab_6819d81664d011f1a4b9525400d9a7a1
    ReservedCode2: LJ7IV3N8huseu1nzhSNoTKpsB/Qp2hlmYEJE0IMzup9GSXuq0rMh8ZQLLr+1x8ZHwZLghBPAR0Z+Tfr3nuXs2XBgyAaCVbRpQmQ0b27b3BfpV3LJiwDRRge0AWMyEd9c8hlR/xhoDDKsJxMagt2IZdfTzolesjUl1nEjr7W0ZSltep2yqYARCdwD3mU=
---

# AI 不缺智商缺纪律：一场 Harness 工程化实践 —— 深度分析报告

> 生成日期：2026-06-10
> 分析对象：微信公众号文章「AI 不缺智商缺纪律：一场 Harness 工程化实践」
> 交叉引用：前序 Harness Engineering 分析系列（brooks-lint 衰减框架、Harness Engineering 五原则、测试决策单、知识库分层编排）
> spec-first 基线版本：v1.10.0

---

## 目录

1. [文章核心框架提炼](#一文章核心框架提炼)
2. [关键数据与反直觉判断](#二关键数据与反直觉判断)
3. [与 spec-first 的全景对照](#三与-spec-first-的全景对照)
4. [与前序 Harness 分析的知识链收束](#四与前序-harness-分析的知识链收束)
5. [Gap 分析矩阵](#五gap-分析矩阵)
6. [分级改进建议](#六分级改进建议)
7. [分阶段演进路线](#七分阶段演进路线)
8. [附录：论文与项目列表](#八附录论文与项目列表)

---

## 一、文章核心框架提炼

### 1.1 核心论点

AI Coding 的瓶颈正从「模型能力」转移到「流程工程」——模型已经足够聪明但不稳定，而稳定性必须由外部框架供给。Harness（驾驭框架）的本质是将「AI 该怎么干活」固化成可执行、可约束、可评测的工程框架，与"写更好的 prompt"有本质区别：prompt 是一次性的说服，harness 是结构性的约束。**模型供给智商，harness 供给纪律。**

### 1.2 五层架构图

```
┌──────────────────────────────────────────────────┐
│  L1 常驻入口层 │ CLAUDE.md + CLAUDE.local.md      │
│                │ 角色/代码偏好/流程触发/G1-G8速查  │
│                │ ≤8K tokens，自包含不依赖 @import  │
├──────────────────────────────────────────────────┤
│  L2 原子规则层 │ rules/（7个）                     │
│                │ 单一职责、按需引用、事故墓志铭     │
├──────────────────────────────────────────────────┤
│  L3 角色Agent层│ agents/（dispatcher + orchestrator │
│                │ + 三角色评审 + 流程执行五岗）      │
│                │ 薄主会话原则：主会话退化纯执行器   │
├──────────────────────────────────────────────────┤
│  L4 按需上下文层│ context/（10个）                  │
│                │ 完整流程/Pre-Mortem/对抗辩论/证据  │
│                │ 只在对应阶段 Read，用完即释放      │
├──────────────────────────────────────────────────┤
│  L5 执行支撑层 │ skills/22 + commands/12 + evals/  │
│                │ ubase全家桶 + slash命令 + 经验进化 │
│                │ G1-G8 门禁墙 + hook 拦截           │
└──────────────────────────────────────────────────┘
```

**关键设计原则**：

- **上下文当预算管理**："分层的唯一标准不是按功能分类，而是按何时被读取——常驻的极小，深的按需加载。"
- **薄主会话**："主会话应该退化成一个什么都不想、只执行 dispatcher 指令的纯执行器。"
- **三条铁律**：主会话只听 dispatcher / 职责隔离 / 上下文 ≤8K。

### 1.3 19 节点链 + G1-G8 门禁

完整链路：

```
需求评审 → 需求确认 → 方案设计 → 方案确认 → Pre-Mortem → 实施计划
→ 验收标准确认 → 拉变更 → 建分支 → 建 worktree → 开发 → 编译 → 单测
→ ATDD → 证据链 → 部署预发 → 接口测试 → 上线确认 → 验收报告
```

**intent × risk 动态裁剪**：

| intent × risk | 链路长度 | 说明 |
|---------------|---------|------|
| QUERY | 0 节点 | 纯问答不走流程 |
| BUG_FIX / LOW | 最小链（5 节点） | 核心节点即可 |
| FEATURE / HIGH | 全链（19 节点） | 完整工序链 |

**硬规则**："改完必部署"——检测到真实业务代码改动自动追加部署预发 + 接口测试。

**G1-G8 门禁是确定性 Python 函数**，检查产物存在性/编译/单测。任一 FAIL 则流程退回 DEVELOPING。hook 拦截做实时围栏：状态文件写操作只允许编排层 agent 触发，危险操作弹确认。

### 1.4 dispatcher 编排模型

三种机制互补：

| 机制 | 适用平面 | 优势 | 劣势 |
|------|---------|------|------|
| Workflow（JS 脚本） | 计算平面（高并行单阶段） | 确定性控制流、强 schema 校验 | 无 askUser 交互、跨 session 不可续、超时问题 |
| Agent Team | 协作平面（多人独立任务） | 消息驱动、灵活协调 | 松散协调、无确定性工序保证 |
| dispatcher + 文件交接 | 控制平面（有状态工序链） | 天然持久化、可审计（git diff）、强一致性 | token IO 开销、调试链路长 |

**核心流程**：

```
主会话 → dispatcher(读 state.json，返回"下一步调谁")
  → intent-classifier 判定意图×风险
  → dispatcher → 三角色并行评审 → orchestrator 合成 → 用户确认方案
  → dispatcher → plan-generator 出实施计划
  → dispatcher → developer 按 TDD 编码
  → dispatcher → verifier 跑 G1-G8 门禁
  → dispatcher → deployer 部署预发
  → dispatcher → tester 接口测试 → 验收报告
```

主会话全程不"思考"任何业务细节，只是 dispatcher 指令的执行器；每个 agent 从干净上下文启动、只装自己那一段的规则和输入。

---

## 二、关键数据与反直觉判断

### 2.1 7 维评分权重表

评测平台用 **100% Python 确定性逻辑、零 LLM 调用、3 次跑分 hash 完全一致** 的方式评分：

| # | 维度 | 权重 | 验证方式 | 设计依据 |
|---|------|------|---------|---------|
| 1 | 流程完整性 | 22% | 产物文件存在性，按 intent×risk 裁剪必需节点 | 文件系统不会说谎 |
| 2 | 代码正确性 | 22% | 真编译 + 真跑单测 + 诚实度差距（honesty gap） | 防 AI 注水 |
| 3 | 规则遵从性 | 18% | 检查关键规则是否被遵守 | 规则外置验证 |
| 4 | 工具效率 | 10% | 工具调用次数/耗时 | AgentBench 参考 |
| 5 | 审查完整度 | 10% | 三角色是否都产出观点 | 审查覆盖度 |
| 6 | 时间效率 | 10% | 端到端耗时 | 工程实用性 |
| 7 | 人工交互 | 8% | 人工确认次数/耗时 | CMMI 流程域参考 |

**评分设计融合四大来源**：SWE-bench（测试通过率）、AgentBench（工具效率）、Anthropic Eval Guide（双评分器对抗偏差）、CMMI（流程域成熟度）。

### 2.2 VikingMem 数据（VLDB 2026, ByteDance）

| 方案 | Token 留存率 | 得分 |
|------|-------------|------|
| VikingMem（智能组织） | 16.82% | **75.80** |
| 朴素 RAG（全量保留） | 100% | 63.81 |

**反直觉发现**：更少的 Token 留存 + 更智能的组织 > 全量保留。VikingMem 的结论直接支撑了"上下文是预算而非草稿纸"这一设计原则。

### 2.3 四条踩坑教训

| # | 教训 | 根因 | 对应加固 |
|---|------|------|---------|
| 1 | prompt 约束是说服不是强制 | 模型"理解"了规则不等于"遵守"了规则 | 规则外置→门禁阻断（G1-G8） |
| 2 | 上下文是预算不是草稿纸 | 把「有状态的流程」硬塞进「无状态的对话窗口」 | 分层加载 + dispatcher 状态机 |
| 3 | 评测环境越干净越不真实 | 空的隔离 Maven 仓库导致恒为 0 分 | 共享本地 6.9G ~/.m2 缓存 |
| 4 | agent 不是越多越好 | 24 agent 过度拆分，每个 system prompt 都是小型 CLAUDE.md | 合并精简冗余调度层 |

### 2.4 反直觉判断提炼

| # | 反直觉判断 | 传统直觉 | 工程含义 |
|---|-----------|---------|---------|
| 1 | 宁要可复现的粗糙分，不要会漂移的精准分 | LLM 评委更懂语义 | 评测的唯一目的是驱动迭代——3 次跑分一致才有 A/B 对比意义 |
| 2 | 上下文不是越大越好的免费缓冲区 | 窗口越大越强 | 上下文是需要精心管理的稀缺资源，LLM 注意力呈 U 型分布（Lost in the Middle） |
| 3 | 主会话不是能力不足，而是职责收窄 | 让主模型更全能 | 全能是污染之源——thin controller 模式，不是它不行，是它不该管 |
| 4 | 每条规则都是一次事故的墓志铭 | 规则来自设计 | 坑只踩一次，之后由规则兜底——harness 最朴素也最值钱的复利 |
| 5 | 流程强制执行必须从 LLM 推理中外置 | AI 能记住流程 | 门禁必须是确定性代码，独立于上下文窗口，fail-closed |
| 6 | 评测平台是评估者不是执行者 | 评测环境帮 AI 干活 | 一旦平台开始"帮忙干活"，就失去客观裁判资格 |

### 2.5 arxiv 2605.29682 关键发现

原始 token 消耗和工具调用仅解释 agent 成功率方差的 **R²=0.33~0.42**，而验证反馈质量（Effective Feedback Compute）达到 **R²=0.94~0.99**。**决定 AI 干活靠不靠谱的并非「给它多少预算」，而是「检查做得多好」。** 这直接论证了 G1-G8 门禁墙 + hook 拦截作为 harness 稳定性支点的正确性。

---

## 三、与 spec-first 的全景对照

> 对照框架：Harness 五层架构 + 门禁评测 + 编排模型，逐层比对 spec-first v1.10.0。

### 3.1 逐层对照

#### L1 常驻入口层

| 维度 | 文章 Harness | spec-first v1.10.0 | 吻合度 | 差距 |
|------|------------|-------------------|--------|------|
| 角色定义 | CLAUDE.md：角色 + 代码偏好 + 流程触发 | instruction-bootstrap.js 做 using-spec-first 注入 | ★★★ | spec-first 有角色注入但无 local.md 自包含模式 |
| 门禁速查 | G1-G8 门禁速查表 | 无 | ☆ | 完全缺失——无门禁速查入口 |
| 自包含 | CLAUDE.local.md 不依赖全局 @import | using-spec-first 依赖 skill 加载 | ★★ | 半自包含，依赖 npm 包结构 |
| 上下文预算 | ≤8K tokens | 无显式上下文预算 | ☆ | 无 token 预算约束 |

#### L2 原子规则层

| 维度 | 文章 Harness | spec-first v1.10.0 | 吻合度 | 差距 |
|------|------------|-------------------|--------|------|
| 规则数量 | 7 个原子规则，单一职责 | 无独立 rules/ 目录 | ☆ | 规则散落在各 SKILL.md 的 prompt 中 |
| 事故固化 | 每条规则是事故墓志铭 | 有 docs/solutions/ 经验沉淀 | ★★★ | 有经验沉淀但非原子化、非可引用 |
| 按需引用 | 规则可被按需 Read | 规则内嵌 prompt，无法按需引用 | ★ | 规则随 skill 整体加载 |

#### L3 角色 Agent 层

| 维度 | 文章 Harness | spec-first v1.10.0 | 吻合度 | 差距 |
|------|------------|-------------------|--------|------|
| dispatcher | 独立 dispatcher agent 读 state.json + workflow.yaml | 无独立 dispatcher | ☆ | **最大差距**——spec-first 无流程调度层 |
| orchestrator | 评审合成 agent | spec-code-review 有 merge/dedup pipeline | ★★★ | 功能相似但形式不同 |
| 三角色评审 | requirement-analyst / tech-architect / quality-guardian | spec-code-review 12+ 角色化审查者 | ★★★★ | **吻合度最高**——spec-code-review 审查体系更细粒度 |
| 流程执行链 | plan-generator→developer→verifier→deployer→tester | spec-prd→spec-plan→spec-work→spec-mcp-setup | ★★★ | 有流程但非 dispatcher 调度 |
| Agent 数量 | 精简后 ~10 agent | 51 个 Agent | — | spec-first 显著更多，与文章"24 agent 过度拆分"的教训对应 |
| 薄主会话 | 主会话退化纯执行器 | 主会话承载业务逻辑 | ☆ | **核心分歧**——spec-first 主会话承担全部推理 |

#### L4 按需上下文层

| 维度 | 文章 Harness | spec-first v1.10.0 | 吻合度 | 差距 |
|------|------------|-------------------|--------|------|
| 按需加载 | context/ 10 个，进入阶段才 Read | 技能按需加载（use_skill），但上下文管理粗放 | ★★★ | 技能加载是"整体加载"而非"最小集加载" |
| 用完释放 | 每阶段用完即释放 | 无显式释放机制 | ★ | 上下文持续累积 |
| 元数据管理 | orchestrator 维护强制 Read 清单 | 无 | ☆ | 无强制 Read 清单 |

#### L5 执行支撑层

| 维度 | 文章 Harness | spec-first v1.10.0 | 吻合度 | 差距 |
|------|------------|-------------------|--------|------|
| skills | 22 个，封装 CLI + 研发工具链 | 37 个 Skill | ★★★★ | **吻合度高**——spec-first Skill 体系更丰富 |
| commands | 12 个 slash 命令 | 18 个斜杠命令模板 | ★★★★ | 形式一致 |
| 经验进化 | lesson→pattern→instinct 三级 | docs/solutions/ 分类目录 | ★★ | 有沉淀但缺自动化晋升 |

#### 门禁评测

| 维度 | 文章 Harness | spec-first v1.10.0 | 吻合度 | 差距 |
|------|------------|-------------------|--------|------|
| G1-G8 门禁 | 确定性 Python 函数 | 无 | ☆ | **完全缺失** |
| hook 拦截 | 工具调用前实时围栏 | 无 | ☆ | **完全缺失** |
| 评测平台 | 7 维评分、3 条轨道、确定性 | 无 | ☆ | **完全缺失** |
| 诚实度差距 | evidence.json vs 真实编译对比 | spec-code-review 有 confidence calibration | ★★ | 有置信度校准但无 honesty gap 概念 |

#### 编排模型

| 维度 | 文章 Harness | spec-first v1.10.0 | 吻合度 | 差距 |
|------|------------|-------------------|--------|------|
| 状态机 | dispatcher 状态机 + state.json | 无全局状态机 | ☆ | **完全缺失** |
| 文件交接 | phases/*.md + evidence.json | contracts/ + tasks/ | ★★ | 有产物文件但非结构化交接 |
| 跨 session | state.json 天然持久化 | summary.md 进度追踪 | ★★ | 可续但非状态机驱动 |
| 动态裁剪 | intent×risk 裁剪节点 | 无 | ☆ | **完全缺失** |

### 3.2 关键差距总结

```
spec-first 当前最突出的五个结构性差距：

1. 【无 dispatcher 状态机】- 核心缺失
   主会话承载全部推理而非退化纯执行器，无独立流程调度层，无 state.json 持久化

2. 【无门禁体系】- 核心缺失
   无 G1-G8 式确定性门禁函数，无 hook 实时拦截，流程强制执行完全依赖 LLM 自觉

3. 【无评测平台】- 核心缺失
   无法回答"这次改规范到底变好还是变坏"，改 harness 凭感觉

4. 【上下文无预算管理】- 重要差距
   无 token 上限约束，无按需加载/用完释放机制，上下文类似草稿纸而非预算

5. 【规则内嵌不可引用】- 中度差距
   规则散落 prompt 中无法按需引用，无法原子化触发
```

### 3.3 意外优势

spec-first 在以下维度其实**超前于**文章 Harness：

- **审查体系丰富度**：spec-code-review 的 12+ 角色化审查 + Confidence Calibration + merge/dedup pipeline 比文章三角色评审更精细。前序 brooks-lint 分析已确认 spec-code-review 在 R1-R6 衰减维度、测试审查、merge pipeline 方面有独特优势。
- **合同驱动治理**：spec-first 的 dual-host-governance 合同体系在架构层面定义了明确的治理边界，而文章 Harness 的治理更多体现在门禁层。
- **知识库分层编排**：前序分析中已构建的知识库金字塔五层 + 7 种有向边，为 spec-first 的上下文管理提供了可落地的分层方案。

---

## 四、与前序 Harness 分析的知识链收束

### 4.1 知识链全景

```
                    ┌─────────────────────────────┐
                    │   本文：Harness 纪律框架      │
                    │   五层架构 + 门禁评测 +       │
                    │   dispatcher 编排            │
                    └─────────────┬───────────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          │                       │                       │
          ▼                       ▼                       ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│ brooks-lint     │   │ Harness Eng.    │   │ 测试决策单       │
│ 六维衰减框架    │   │ 五原则映射      │   │ T1-T6            │
│ (对话 38-49)    │   │ (对话 38-49)    │   │ (对话 58-59)     │
└────────┬────────┘   └────────┬────────┘   └────────┬────────┘
         │                     │                     │
         └─────────────────────┼─────────────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ 知识库分层编排       │
                    │ 金字塔五层+7有向边  │
                    │ (对话 60-61)        │
                    └─────────────────────┘
```

### 4.2 深层联系

#### 4.2.1 brooks-lint 六维衰减 ↔ G1-G8 门禁：验证层的互补

| brooks-lint 维度 | 文章 Harness 门禁 | 互补关系 |
|-----------------|------------------|---------|
| R1 认知过载 | G4 代码复杂度检查 | brooks-lint 提供**诊断框架**，门禁提供**阻断机制** |
| R2 变更传播 | G5 依赖影响分析 | brooks-lint 的"改一处炸多处"对应门禁的变更范围校验 |
| R3 知识重复 | 无直接对等门禁 | brooks-lint 的 DRY 检测可作为新门禁 G4.1 |
| R4 意外复杂度 | G3 编译 + G7 部署预发 | 意外复杂度往往在编译/部署阶段暴露 |
| R5 依赖混乱 | G6 依赖图检查 | 前序分析建议的 Mermaid 依赖图可视化可直接用于 G6 |
| R6 领域模型失真 | 无直接对等门禁 | brooks-lint 的 DDD 审查可作为新门禁 |

**核心洞察**：brooks-lint 的六维衰减框架定义了「查什么」，文章 Harness 的 G1-G8 门禁定义了「怎么阻断」。两者结合才是完整的验证层——brooks-lint 做诊断（detect），门禁做阻断（enforce）。前序 spec-code-review-brooks-lint-integration.md 中的 9 个优化点（decay_risk 标签、出处追溯、T1-T6 测试审查、Health Score）恰好填补了文章 Harness 在"审查内容丰富度"上的空白——文章三角色评审偏粗，brooks-lint 的六维框架可以注入为审查 subagent 的诊断工具。

#### 4.2.2 Harness Engineering 五原则 ↔ 文章三条铁律：设计哲学的同源

前序分析中提炼的 Harness Engineering 五原则（来自 Mitchell Hashimoto + Anthropic）：

| 五原则 | 文章对应设计 | 映射 |
|--------|------------|------|
| **约束（Constrain）** | 原子规则层 + hook 拦截 + G1-G8 门禁 | 规则外置 + 门禁阻断 |
| **告知（Inform）** | 按需上下文层 + CLAUDE.md | 上下文当预算管理 |
| **验证（Verify）** | G1-G8 确定性 Python 函数 | 门禁外置 |
| **纠正（Correct）** | 经验三级进化 + auto-learn | lesson→pattern→instinct |
| **状态持久化** | dispatcher + state.json + 文件交接 | 天然持久化 |

文章三条铁律（主会话只听 dispatcher / 职责隔离 / 上下文 ≤8K）是五原则在**主会话层面**的具体落地：约束→只听 dispatcher（收窄指令源）、告知→≤8K（严格控制信息量）、验证→职责隔离（不同 agent 互审）。

#### 4.2.3 测试决策单 ↔ 评测平台：从"怎么测"到"怎么评"

前序对话 58-59 中的测试决策单分析发现 spec-code-review 缺少 `testing_plan` 结构化字段，以及 T1-T6 测试衰减风险审查的缺失。

文章评测平台的 7 维评分中"代码正确性（22%）"维度用"真编译 + 真跑单测 + 诚实度差距"做验证——这直接呼应了前序分析的结论：测试审查不应只检查"有没有测试"，而要验证"测试是否真的有效"（Coverage Illusion 问题）。两者的串联路径：

```
前序分析                  →    文章评测平台
T5 覆盖幻觉检测          →    诚实度差距（honesty gap）
T2 测试脆弱性            →    真编译 + 真跑单测（非 mock）
testing_plan 缺失        →    流程完整性（22%）检查产物存在性
```

#### 4.2.4 知识库分层编排 ↔ 文章五层架构：分层思想的同构

前序对话 60-61 中构建的知识库金字塔五层（L0 Core / L1 Foundation / L2 Domain / L3 Experience / L4 Meta）与 7 种有向边，与文章五层架构高度同构：

| 前序知识分层 | 文章 Harness 分层 | 同构关系 |
|------------|------------------|---------|
| L0 Core（规则/约定） | L1 常驻入口 + L2 原子规则 | 常驻最小集 |
| L1 Foundation（基础技能） | L5 执行支撑层 skills/ | 可调用能力 |
| L2 Domain（领域知识） | L4 按需上下文层 context/ | 按需加载 |
| L3 Experience（经验） | L5 经验三级进化 | 经验沉淀 |
| L4 Meta（元认知） | 评测平台 evals/ | 自评估 |

**核心洞察**：前序分析的"金字塔五层 + 有向边"为 spec-first 的上下文管理提供了可落地的分层方案；而文章的"按何时被读取分层"设计原则进一步明确了分层的唯一标准——不是按内容类型，而是按加载时机。两者结合可得：**用金字塔五层定义内容结构，用何时被读取定义加载规则。**

---

## 五、Gap 分析矩阵

按核心维度逐一制表，对照 spec-first v1.10.0 现状：

| 维度 | 文章 Harness 能力 | spec-first 现状 | 差距等级 | 量化描述 |
|------|-----------------|----------------|---------|---------|
| **常驻入口** | CLAUDE.md + CLAUDE.local.md，≤8K，自包含 | instruction-bootstrap.js 注入 using-spec-first | 🔴 重大 | 无 token 预算，无 self-contained local 模式 |
| **原子规则** | rules/ 7 个，单一职责，可引用 | 规则散落 prompt 中 | 🟡 中度 | 不可原子化按需引用 |
| **Agent 编排** | dispatcher 状态机 + orchestrator 合成 | 无独立 dispatcher，主会话承载全量推理 | 🔴 重大 | 无流程调度层，无状态机 |
| **按需上下文** | context/ 10 个，用完释放 | Skill 整体加载，无显式释放 | 🟡 中度 | 无最小集加载，无释放机制 |
| **执行支撑** | skills/22 + commands/12 + 经验三级进化 | skills/37 + commands/18 + docs/solutions/ | 🟢 轻微 | 数量更丰富但缺自动化进化 |
| **门禁评测** | G1-G8 确定性 Python + hook 拦截 | 无 | 🔴 重大 | 完全缺失 |
| **编排模型** | dispatcher 状态机 + 文件交接 + 动态裁剪 | 线性流水线，无状态机 | 🔴 重大 | 无状态持久化，无意图裁剪 |
| **状态持久化** | state.json + phases/*.md + evidence.json | summary.md 进度追踪 | 🟡 中度 | 可续但非结构化状态机 |
| **经验进化** | lesson→pattern→instinct 三级自动晋升 | docs/solutions/ 人工分类 | 🟡 中度 | 有沉淀机制但缺自动化晋升 |

**整体评估**：9 维度中 🔴重大差距 4 个、🟡中度差距 4 个、🟢轻微差距 1 个。核心瓶颈集中在**编排模型 + 门禁评测**两个维度——这是 spec-first 与生产级 Harness Engineering 之间的最大鸿沟。

---

## 六、分级改进建议

### P0 —— 架构级修复（立即启动，预计 4-6 周）

#### P0-1：引入 dispatcher 状态机 + state.json

| 项目 | 内容 |
|------|------|
| **对标能力** | 文章 dispatcher agent + state.json + workflow.yaml |
| **预期效果** | 主会话退化为纯执行器，流程状态跨 session 可续，支持意图×风险动态裁剪 |
| **实施要点** | ① 创建 `agents/spec-dispatcher.agent.md`（只读 state.json + workflow.yaml，只输出"下一步调谁"）；② 创建 `state.json` schema（当前阶段/已完成节点/意图类型/风险等级）；③ 在 instruction-bootstrap.js 中注入"主会话只听 dispatcher"铁律；④ 定义 intent×risk 裁剪表（QUERY/BUG_FIX/FEATURE × LOW/MEDIUM/HIGH） |
| **风险** | 与现有线性流水线的兼容性——需要 dispatcher 支持渐进式接入，已启动的旧会话不受影响 |

#### P0-2：建设 G1-G8 门禁墙

| 项目 | 内容 |
|------|------|
| **对标能力** | 文章 G1-G8 确定性 Python 函数 + fail-closed 阻断 |
| **预期效果** | 流程强制执行从 LLM 自觉变为确定性代码，任一 FAIL 流程退回 |
| **实施要点** | ① 定义 8 个门禁（产物存在性/编译/单测/代码复杂度/依赖影响/依赖图/部署状态/接口测试）；② 每个门禁为独立 Python 脚本，输出 PASS/FAIL + JSON；③ 创建 `verifier` agent 跑门禁并写 `phases/verification.json`；④ hook 拦截危险操作（git push --force / rm -rf）的配置模板 |
| **风险** | 门禁定义过严可能阻塞合理开发流程——初期设为 advisory 模式，验证 2 周后切换 blocking |

#### P0-3：建立评测平台（最小可行版）

| 项目 | 内容 |
|------|------|
| **对标能力** | 文章 7 维评分 + 3 条轨道 + 确定性逻辑 |
| **预期效果** | 回答"这次改规范到底变好还是变坏"，A/B 对比有据 |
| **实施要点** | ① 先做 5 维评分（流程完整性 25% + 代码正确性 25% + 规则遵从性 20% + 工具效率 15% + 审查完整度 15%），后续补齐 7 维；② 100% Python 确定性逻辑，零 LLM 调用；③ 3 次跑分 hash 一致性校验；④ 定义 3-5 个 Dry Run 用例作为回归基准 |
| **风险** | 评测用例设计覆盖面不足——初期聚焦 5 个核心场景，逐步扩展 |

### P1 —— 能力级增强（P0 完成后启动，预计 3-4 周）

#### P1-1：上下文预算管理

| 项目 | 内容 |
|------|------|
| **对标能力** | 文章 ≤8K token 预算 + 按需加载 + 用完释放 |
| **预期效果** | 主会话上下文不再被规则淹没，模型有"脑容量"理解代码 |
| **实施要点** | ① 接入前序分析的知识库金字塔五层 + 7 种有向边作为按需上下文层的基础结构；② 在 dispatcher 指令中强制指定当前阶段必须 Read 的最小文件集；③ 在 CLAUDE.md 中加入 token 预算监控规则 |
| **风险** | 最小集定义失误可能导致关键上下文漏加载——orchestrator 维护强制 Read 清单兜底 |

#### P1-2：原子规则层独立

| 项目 | 内容 |
|------|------|
| **对标能力** | 文章 rules/ 7 个原子规则，单一职责，按需引用 |
| **预期效果** | 规则从 prompt 中解耦，可单独引用、单独版本管理 |
| **实施要点** | ① 从现有 SKILL.md prompt 中提取规则逻辑，拆分为独立 `rules/` 文件；② 每个规则加 `trigger_condition` 字段（何时加载）；③ dispatcher 按阶段注入对应规则 |
| **风险** | 拆分过程中可能遗漏隐式规则——逐 skill 审计，保留原 prompt 为 reference |

#### P1-3：经验三级进化机制

| 项目 | 内容 |
|------|------|
| **对标能力** | 文章 lesson→pattern→instinct 三级自动晋升 + 人工确认 |
| **预期效果** | harness "越用越聪明"，踩坑自动固化为规则 |
| **实施要点** | ① 扩展 docs/solutions/ 的经验分类增加 `maturity` 字段（lesson/pattern/instinct）；② 新增 `/learn` slash 命令实现晋升流程；③ pattern→instinct 晋升需人工确认 |
| **风险** | 错误经验扩散——三级晋升的每级都需人工确认 |

### P2 —— 生态级扩展（P1 完成后，预计 2-3 周）

#### P2-1：VikingMem 式记忆管理研究

| 项目 | 内容 |
|------|------|
| **对标能力** | VikingMem 智能组织 + Sverklo 双时态记忆 |
| **预期效果** | 减少上下文占用同时提升记忆检索准确率（参考 16.82% token 得 75.80 分的反直觉发现） |
| **实施要点** | ① 研究 VikingMem 的智能组织算法；② 在单模块上试点 Codebase-Memory-MCP 知识图谱（AST 分析 + 13+ 节点类型 + 18+ 边类型）；③ 评估双时态记忆对经验进化的适用性 |
| **风险** | 技术成熟度不足——仅做研究性试点，不投入生产 |

#### P2-2：混合编排实验

| 项目 | 内容 |
|------|------|
| **对标能力** | 文章 dispatcher 管控制流 + Workflow 加速纯计算环节 |
| **预期效果** | 三角色评审等可并行阶段性能提升 |
| **实施要点** | ① 在 dispatcher 中加入 parallel 指令类型；② 三角色评审阶段改为并行 Workflow 执行；③ A/B 对比评测决定优劣 |
| **风险** | 并行引入状态同步复杂度——先做实验性验证 |

---

## 七、分阶段演进路线

```
Phase 1（第 1-6 周）：架构基座
├── P0-1：dispatcher 状态机 + state.json
├── P0-2：G1-G8 门禁墙（advisory → blocking）
├── P0-3：评测平台 MVP（5 维评分 + 5 个 Dry Run 用例）
└── 里程碑：主会话退化纯执行器，每次流程有分可查

Phase 2（第 7-10 周）：能力深化
├── P1-1：上下文预算管理（金字塔五层 + 7 有向边落地）
├── P1-2：原子规则层独立
├── P1-3：经验三级进化
└── 里程碑：上下文 ≤8K，规则可原子引用，经验自进化

Phase 3（第 11-13 周）：前沿探索
├── P2-1：VikingMem / Codebase-Memory-MCP 试点
├── P2-2：混合编排 A/B 实验
└── 里程碑：评测数据驱动架构决策，实验性能力储备
```

### 关键里程碑定义

| 阶段 | 验收标准 | 回退条件 |
|------|---------|---------|
| Phase 1 | dispatcher 成功调度 5 个 Dry Run 用例；门禁至少 1 次成功阻断不合规产出；评测平台 3 次跑分 hash 一致 | 任一 Dry Run 用例连续 3 次失败 |
| Phase 2 | 主会话 token 占用稳定 ≤8K；至少 3 条规则从 prompt 解耦为独立 rule；至少 1 条经验完成 lesson→pattern 晋升 | 上下文预算导致关键信息漏加载超过 2 次 |
| Phase 3 | VikingMem 试点产出可量化对比数据；混合编排 A/B 评测至少 1 维度显著优于 baseline | 试点 2 周内无正向数据 |

---

## 八、附录：论文与项目列表

### A. 学术论文

| # | 标题 | 来源 | 链接 | 核心发现 |
|---|------|------|------|---------|
| 1 | Lost in the Middle: How Language Models Use Long Contexts | Stanford, TACL 2024 | [arxiv 2307.03172](https://arxiv.org/abs/2307.03172) | LLM 注意力呈 U 型分布，中部信息准确率显著下降 |
| 2 | RULER: What's the Real Context Size of Your Long-Context Language Models? | NVIDIA | [arxiv 2404.06654](https://arxiv.org/abs/2404.06654) | 声称支持 32K+ 的模型仅半数能保持可靠性能 |
| 3 | Scaling Laws for Agent Harnesses via Effective Feedback Compute | arxiv | [arxiv 2605.29682](https://arxiv.org/abs/2605.29682) | 验证反馈质量 R²=0.94~0.99，远超 token 消耗 R²=0.33~0.42 |
| 4 | VikingMem | ByteDance, VLDB 2026 | [arxiv 2605.29640v1](https://arxiv.org/html/2605.29640v1) | 16.82% Token 留存得 75.80 分 > 朴素 RAG 100% 留存仅 63.81 分 |

### B. 开源项目与技术方案

| # | 项目 | 链接 | 说明 |
|---|------|------|------|
| 1 | VILA-Lab / Dive-into-Claude-Code | [GitHub](https://github.com/VILA-Lab/Dive-into-Claude-Code) | Claude Code 逆向工程：5 层渐进式压缩管线 + Auto-Compact |
| 2 | sd0x-dev-flow | [GitHub](https://github.com/sd0xdev/sd0x-dev-flow) | hook-enforced dual review + state-machine gates |
| 3 | Apache Burr | Apache 基金会 | 通用 Agent 状态机 + 可插拔持久化 + 实时追踪 UI |
| 4 | Sverklo | [GitHub](https://github.com/sverklo/sverklo) | 双时态记忆：valid_from_sha / valid_until_sha |
| 5 | Codebase-Memory-MCP | [GitHub](https://github.com/DeusData/codebase-memory-mcp) | 多轮 AST 分析构建持久化知识图谱（13+ 节点类型、18+ 边类型） |
| 6 | hyhmrright/brooks-lint | [GitHub](https://github.com/hyhmrright/brooks-lint) | 12 本经典软件工程著作驱动的六维衰减代码审查（前序深度分析） |
| 7 | obra/superpowers | [GitHub](https://github.com/obra/superpowers) | ~217k 星 Agent 技能框架 + 开发方法论（前序生态调研） |
| 8 | EveryInc/compound-engineering-plugin | [GitHub](https://github.com/EveryInc/compound-engineering-plugin) | ~19k 星 Claude Code 复利工程插件（前序生态调研） |

### C. 行业参考

| # | 来源 | 内容 |
|---|------|------|
| 1 | Cognition / Latent Space 播客 | Devin CPO 坦言"记忆达到数千条时检索正确记忆尚未解决" |
| 2 | Anthropic Eval Guide | 双评分器对抗偏差方法（前序分析引用于 7 维评分设计） |
| 3 | CMMI | 流程域成熟度模型（前序分析引用于人工交互维度） |
| 4 | SWE-bench / AgentBench | 测试通过率验证 + 工具调用效率衡量（前序分析引用于评分设计） |

---

## 跨文档引用索引

本文与以下前序分析文章构成知识链：

| # | 前序文章 | 路径 | 本文引用章节 |
|---|---------|------|------------|
| 1 | brooks-lint 代码审查方法论深度分析 | `output/brooks-lint-analysis.md` | §4.2.1, §4.2.3, §6 P1-2 |
| 2 | brooks-lint 方法论集成分析（9 优化点） | `output/spec-code-review-brooks-lint-integration.md` | §4.2.1 |
| 3 | Harness Engineering 生态调研报告 | `output/harness-ecosystem-report-2026-06-07.md` | §4.2.2 |
| 4 | spec-first 深度提升报告（九域框架） | `output/spec-first-capability-enhancement-report-2026-06-06.md` | §3.1, §4.2.4 |
| 5 | spec-first 优化提升技术方案（知识库分层） | `output/spec-first-optimization-plan-2026-06-06.md` | §4.2.4, §6 P1-1 |
*（内容由AI生成，仅供参考）*
