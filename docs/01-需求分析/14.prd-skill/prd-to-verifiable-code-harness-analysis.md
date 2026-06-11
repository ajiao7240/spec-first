---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: a88644969371398a873cabeac0a028ab_a3366726654f11f1aaba5254006c9bbf
    ReservedCode1: xqAsPERx6NCGXhEddL7wBb1vPesYdk4B6srJjvMeSyHICaVilWHb3gdHndGL2y9cAolYT/z7dLdiqKGI2wctKO/M/sj7QNzfOrXqevBFOC/t3SH9ViuUsM6v4eJOtHzN0AlerylsmVGPf5oFL7F9EsooY1nuEZMtAtjFnW+JQLLKVg6BJLeLjFMjzRM=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: a88644969371398a873cabeac0a028ab_a3366726654f11f1aaba5254006c9bbf
    ReservedCode2: xqAsPERx6NCGXhEddL7wBb1vPesYdk4B6srJjvMeSyHICaVilWHb3gdHndGL2y9cAolYT/z7dLdiqKGI2wctKO/M/sj7QNzfOrXqevBFOC/t3SH9ViuUsM6v4eJOtHzN0AlerylsmVGPf5oFL7F9EsooY1nuEZMtAtjFnW+JQLLKVg6BJLeLjFMjzRM=
---

# 从 PRD 到可验证代码：AI 需求开发闭环实践 —— 深度分析报告

> 基于「从 PRD 到可验证代码：AI 需求开发闭环实践」原文，结合系列前三篇文章及 spec-first 体系进行全景对照分析。

---

## 一、Harness 框架全景

### 1.1 框架定义

Harness（流程框架）是 AI Coding 研发体系中**监督式工程（L3 能力模型）**的工程化落地。它把 prompts、commands、subagents、rules 和门禁流程组织成一套开发约束体系，不替代工程判断，而是规定 AI 在什么阶段分析、何时等待审阅、何时生成代码、何时必须验证。

**核心原则：把不确定性前移，把代码生成后移。**

### 1.2 层间关系

从 AI Coding 六层总架构视角，Harness 位于以下三层的交织点：

| 架构层级 | 在 Harness 中的体现 |
|---------|------------------|
| Agent 执行层 | code-generator、build-verifier、visual-auditor、experience-depositor 等子 Agent |
| 流程层 | 两道门禁、证据驱动编码流水线、编译验证→视觉审计→经验沉淀的反馈闭环 |
| 组织能力层 | 人工审阅/确认门禁体现了"人负责判断，AI 负责执行"的分工范式 |

### 1.3 输入 → 产出完整链路

```
PRD + 接口文档 + Figma 设计稿
       ↓
   RequirementSpec（需求规格）       ← AI 产出
       ↓
  【人工审阅门禁】
       ↓
   ArchitectureDesign（架构设计）    ← AI 产出
       ↓
  【人工确认门禁】
       ↓
   Code Generation（代码生成）       ← AI 产出
       ↓
   Build Verification（编译验证）    ← AI 自动修复
       ↓
   Visual Audit（视觉审计）          ← AI 偏差检测
       ↓
   Experience Deposit（经验沉淀）    ← AI 知识资产化
```

**关键设计理念**：不确定性在链路前端（需求分析、架构设计）通过人工门禁被截断，只有经过两次确认后代码才被大规模生成，避免了"在错误方向上快速产出大量代码"的经典返工陷阱。

---

## 二、需求规格化与两道门禁

### 2.1 RequirementSpec 的结构

RequirementSpec 是 AI 产出的第一份关键产物，而不是直接写代码。其结构覆盖了传统 PRD 未充分形式化的维度：

| 维度 | 内容 | 与传统 PRD 的差异 |
|------|------|------------------|
| 功能范围 | 本次需求覆盖与不覆盖的边界 | 明确了"不做什么"，防止 AI 越界 |
| 页面结构 | 页面层级、入口、跳转关系 | 结构化为可编码的树状描述 |
| 字段规则 | 接口字段类型、必填性、默认值、校验规则 | 标注可信度（已确认/待确认），防止 AI 自行命名 |
| 接口依赖 | 依赖的 API 端点、字段映射 | 区分前后端边界 |
| 状态流转 | 正常/异常/加载/空/错误态 | 强制覆盖异常场景 |
| Figma 节点拆分 | 设计稿的 node_id 与 UI 组件对应 | 建立设计→代码的追溯证据 |
| 埋点要求 | 页面曝光、点击事件、参数定义 | 前置接入数据埋点体系 |
| 验收标准 | 可验证的功能和视觉检查点 | 与后续 build-verifier / visual-auditor 对齐 |

**关键约束**：所有关键结论必须标注来源（PRD 章节/接口文档字段/Figma nodeId），使得后续偏差可以追溯到证据本身定位。

### 2.2 人工审阅门禁的定位与价值

第一道门禁——需求审阅，不是修改文案，而是确认 AI 对业务和边界的理解是否可靠：

- 核心路径是否完整覆盖；
- 异常场景是否被识别；
- 字段可信度是否被标注（待确认字段触发人决策）；
- Figma 组件状态和资源节点是否被记录。

这道门禁的价值在于：**字段缺失时是等待接口补充、做本地兜底还是调整交互口径，这些需要人的工程判断，AI 擅长整合但无法替代决策。**

### 2.3 架构确认门禁的定位与价值

第二道门禁——架构确认，在需求通过后才进入。架构设计（ArchitectureDesign）要明确：

- 模块拆分和目录结构；
- 组件分工与状态管理方案；
- 接口封装方式与数据流；
- Figma 分块到实现的映射（哪个设计分块落到哪个组件）；
- 直读审计计划（后续 code-generator 要直读哪些 nodeId 和属性）。

**两道门禁的核心防御目标**：防止 AI 在错误需求或错误架构上快速生成大量代码——代码生成速度越快，错误架构造成的返工代价越高。

---

## 三、证据驱动编码深度拆解

### 3.1 code-generator 的职责边界

code-generator 的职责不是"看需求写 TSX"，而是**按 ArchitectureDesign 实施代码，并输出 ArchitectureAlignmentReport 证明实现与架构一致**。

实现前必须读取的输入源：
- RequirementSpec（需求规格）
- ArchitectureDesign（架构设计）
- 接口字段产物
- Figma summary（设计稿摘要）
- codeHints（代码生成提示，约束参考页面/样式/文件/依赖）
- 项目规则与团队经验文档（按 RN 页面开发、UI 组件库、lint、埋点等关键词检索）

### 3.2 ArchitectureAlignmentReport 机制

这是 Harness 最关键的检查装置。code-generator 生成代码后必须产出一份对齐报告，覆盖以下维度：

| 检查项 | 内容 |
|--------|------|
| 文件 | 实际生成的文件是否与架构设计一致 |
| 分块 | 每个设计分块是否落实到对应文件 |
| 接口字段 | 字段定义是否与接口文档匹配 |
| 路由平台 | native route / web route 是否正确注册 |
| UI 组件库 | ZRN UI 组件使用是否符合规范 |
| 埋点 | routeList 和 tracking 是否完整 |
| 偏差 | 主动声明的差异及理由 |
| 待验证项 | 需要后续环节确认的点 |

**阻断机制**：关键项必须全部 pass 才进入编译验证；missing 最多回流补全 5 轮，仍无法补齐则标记 blocked。

### 3.3 direct-read-audit（直读审计）

这是 Figma→代码还原的证据链机制。每个关键视觉常量必须能追溯到四元组：

```
node_id + 属性名 + raw_value + RN mapping
```

即"设计节点、样式属性、原始值、RN 写法"四者对应。颜色、字号、圆角、间距、边框、阴影和图片资源不能只来自截图感觉；截图只用于最终校准，不作为首要编码来源。

### 3.4 实现顺序的稳定性设计

代码生成遵循固定顺序，确保依赖关系正确：

```
types.ts → api.ts → hooks/state → leaf components
→ page container → route/web registration → tracking/logging
```

这种顺序设计确保：类型定义先于接口调用，接口调用先于状态管理，状态管理先于 UI 渲染，UI 渲染先于路由注册和埋点。

### 3.5 blocked 机制

每个设计分块（block）必须有目标文件、目标组件、数据字段、交互和证据。缺少落点时不能硬写代码，只能在 ArchitectureAlignmentReport 中标记 blocked，由人工决策是跳过、补齐还是替代方案。

### 3.6 Figma 产物验证链

代码生成前必须验证磁盘产物真实存在：

- metadata（元数据）
- raw node（原始节点）
- reference code（参考代码）
- coverage audit（覆盖度审计）
- asset mapping（资源映射）
- unit contract（单元契约）
- artifact manifest（产物清单）

文档写着"已验证"不够，必须以文件事实为准。缺少关键产物时，回推 requirement-analyzer 补齐，**禁止凭截图手写 UI**。

---

## 四、编译验证与视觉审计

### 4.1 build-verifier 的工作机制

编译验证 Agent 执行 lint、TypeScript 编译和构建检查，多平台场景追加 iOS/Android/Harmony 的 bundle 验证。

与通常"贴出错误让人修"不同，build-verifier 的核心能力是**自动定位并修复**。常见可自动修复的问题：

| 问题类型 | 示例 |
|---------|------|
| import 路径错误 | 模块引用路径不匹配 |
| 类型不匹配 | 接口字段类型与使用处不一致 |
| 平台后缀缺失 | 缺少 .ios.ts / .android.ts 等平台文件 |
| 依赖误用 | 引用了未安装或已废弃的依赖 |
| lint 规则违反 | 不符合项目编码规范 |

**partial 机制**：仅当错误来自外部环境或缺少人工决策时，才允许部分通过，其余情况必须全量通过。

这步把"语义上看起来对"的代码推进到"项目工具链可接受"的水平——不是思路错，而是工程约束没满足的问题被系统化解决。

### 4.2 visual-auditor 的偏差回流

编译通过只能说明代码能跑，不能说明页面还原正确。视觉审计 Agent 对照 Figma 检查：

- 布局与间距
- 字号与颜色
- 组件状态（hover/active/disabled/loading/error）
- 资源还原
- 响应式表现
- 多端差异

**偏差回流机制**：不只看整页截图，而是输出结构化的偏差清单，回流给 code-generator 精准修复。修复时仍遵守 direct-read-audit 约束——新增或调整的视觉常量必须能追溯到 Figma raw value。

---

## 五、经验沉淀闭环

### 5.1 experience-depositor 的职责

需求交付后，经验沉淀 Agent 将以下信息结构化沉淀：

| 输入 | 产出物 |
|------|--------|
| 有效 prompt | 可复用 prompt 模板 |
| 常见失败 | 失败模式 checklist |
| 修复方式 | 修复 SOP |
| 组件复用经验 | 组件使用指南 |
| Figma 直读规则 | 直读审计 checklist |
| 构建问题 | 构建排错手册 |
| 视觉偏差 | 视觉还原检查清单 |

### 5.2 从纠偏到 SOP 的知识资产化

这与流程层三工程中的"反馈要能沉淀"原则一致：如果每次纠偏都只停在聊天窗口里，团队不会真的变强，只是当次任务被救回来了。

经验沉淀的价值在于：

1. **避免重复踩坑**：下一需求复用已沉淀的模板/checklist
2. **降低新人上手成本**：SOP 替代经验依赖
3. **提高 AI 输出质量**：codeHints 和规则不断丰富
4. **量化改进效果**：可追踪哪些问题已经被经验覆盖

---

## 六、与 spec-first 全景对照

spec-first 是 spec-kit 体系下的需求→规范→计划→实现流程，与 Harness 同属 AI Coding 研发流程范畴，但在工程深度和验证闭环上存在显著差距。

### 6.1 逐环节对照

| 环节 | Harness（本文） | spec-first | 差距分析 |
|------|----------------|-----------|---------|
| 需求分析 | RequirementSpec（功能范围+字段规则+状态流转+异常场景+埋点+验收标准+来源标注） | spec-prd | spec-prd 缺少 RequirementSpec 的统一规格概念，无字段可信度标注、异常场景系统覆盖、Figma 节点拆分、埋点前置 |
| 架构设计 | ArchitectureDesign（含分块映射+直读审计计划+验证策略） | spec-plan | spec-plan 无 ArchitectureAlignmentReport 的实现对齐检查机制 |
| 代码生成 | code-generator 按架构实施 + ArchitectureAlignmentReport | spec-work（AI 直接实现） | 无按架构实施的对齐报告闭环，无 block→blocked 机制 |
| 编译验证 | build-verifier（自动定位修复） | 无 | spec-first 无专门编译验证 Agent |
| 视觉审计 | visual-auditor（偏差回流修复） | 无 | spec-first 无视觉审计 Agent |
| 经验沉淀 | experience-depositor（SOP/checklist/模板） | 无 | spec-first 无经验沉淀 Agent |
| 入口约束 | Harness 规则 + 两道门禁 | using-spec-first（注入指令） | using-spec-first 类似 Harness 入口约束，但无门禁流程 |
| 代码审查 | 无（被 ArchitectureAlignmentReport + build-verifier 替代） | spec-code-review（静态分析） | spec-code-review 是静态代码分析，不同于 build-verifier 的编译验证闭环 |

### 6.2 覆盖与缺口总结

**Harness 独有的能力**（spec-first 完全缺失）：

1. **RequirementSpec 统一规格**：将 PRD、接口文档、Figma 统一成结构化可审阅产物
2. **两道人工门禁**：需求审阅 + 架构确认，防止在错误方向生成代码
3. **ArchitectureAlignmentReport**：代码生成后的架构一致性检查与 missing/blocked 机制
4. **build-verifier 自动修复**：编译失败的自动定位与修复
5. **visual-auditor 偏差回流**：视觉还原问题的结构化检测与回流修复
6. **experience-depositor**：知识资产化的闭环 Agent
7. **direct-read-audit**：视觉常量的四元组证据追溯

**spec-first 的独有优势**：

1. spec-code-review 提供独立的静态代码审查视角
2. spec-kit 体系提供更轻量级的准入路径，适合小团队起步

**核心结论**：Harness 不是 spec-first 的替代，而是 spec-first 在工程深度上的**系统化升级**——从"让 AI 理解需求并生成代码"升级为"让 AI 在可追溯、可验证、可回流的约束流水线中完成交付"。

---

## 七、与知识链收束

### 7.1 与五级能力模型（第三篇）的关系

本文是五级能力模型中 **L3 监督式工程**的具体落地实践。五级能力模型的核心判断是"L3 是分水岭"，本文用完整工程实例证明了这一点：

- L1/L2（个人编码/AI 辅助）：让 AI 帮忙写代码、补测试、解释报错
- L3（监督式工程）：定义目标、组织上下文、设计验证、纠偏结果——本文的 Harness 流程完整展示了这一层的工作形态
- L4（多 Agent 编排）：本文中 code-generator / build-verifier / visual-auditor / experience-depositor 的多 Agent 分工已触及 L4 的编排问题
- L5（AI 研发管理）：经验沉淀的 SOP 化已开始触及 L5 的知识资产管理

### 7.2 与流程层三工程（第二篇）的关系

本文是流程层三工程（Intent Engineering / Context Engineering / Verification Engineering）在移动端 RN 开发中的**实例化**：

| 三工程 | 在本文中的体现 |
|--------|--------------|
| Intent Engineering | RequirementSpec 的结构化需求表达，字段可信度标注，两道门禁中的人工确认 |
| Context Engineering | codeHints、团队经验文档检索、Figma 产物验证链、架构设计中的分块映射 |
| Verification Engineering | build-verifier 编译验证、visual-auditor 视觉审计、ArchitectureAlignmentReport 对齐检查 |

三个工程的闭环被集成到单一 Harness 框架中，形成了"意图→上下文→验证→反馈沉淀"的完整流水线。

### 7.3 与六层总架构（第一篇）的关系

本文是六层架构中**Agent 执行层 + 流程层 + 组织能力层**的交叉实现：

| 六层架构 | 本文对应内容 |
|---------|------------|
| 基础设施层 | （隐含）模型、工具链、代码库接入 |
| **Agent 执行层** | code-generator、build-verifier、visual-auditor、experience-depositor |
| **流程层** | 两道门禁、证据驱动编码流水线、验证→审计→沉淀反馈闭环 |
| **组织能力层** | 人工审阅/确认的人机分工范式，直接呼应"AI 承担执行，人承担判断和责任" |
| 评价层 | （未展开）ArchitectureAlignmentReport 和偏差清单提供了可度量的切入点 |
| 治理层 | （隐含）blocked 机制、partial 通过、回流轮次上限构成了基本治理约束 |

### 7.4 知识链演化路径

```
第一篇（六层总架构）
  └─ 定义了企业 AI Coding 的六层能力框架
       │
第二篇（流程层：AI 如何进入研发流程）
  ├─ 提出 Intent / Context / Verification Engineering 三工程
  └─ 提出反馈沉淀的必要性
       │
第三篇（五级能力模型）
  ├─ 定义 L1-L5 能力成熟度
  └─ 指出 L3 监督式工程是分水岭
       │
第四篇（本文：PRD 到可验证代码）
  ├─ L3 监督式工程的具体落地
  ├─ 三工程在 RN 开发的实例化
  └─ 六层架构中三层交叉的运行实例
```

### 7.5 演化趋势判断

从第一篇到第四篇的知识链呈现清晰的**从抽象到具体、从框架到实例**的演化路径：

1. **第一篇**搭骨架（六层架构）
2. **第二篇**穿流程（三工程）
3. **第三篇**定能力（五级模型）
4. **第四篇**跑实例（Harness 工程）

四篇文章共同构成了一套完整的 AI Coding 研发体系理论——从为什么（六层架构），到怎么做（三工程），到谁来做（五级模型），再到长什么样（Harness 实例）。后续如果继续展开评价层和治理层，将完成整个知识链的闭环。

---

## 核心洞见

1. **「不确定性前移、代码生成后移」**是 Harness 的哲学核心——它不是让 AI 少做事，而是让 AI 在最恰当的时机做最恰当的事。

2. **两道门禁的工程经济学**：代码生成速度越快，错误架构造成的返工代价越高。门禁的成本远低于大规模代码返工的成本。

3. **证据链不只是质量保证，更是可追溯性基础设施**：从 direct-read-audit 到 ArchitectureAlignmentReport，每一个决策都能溯源到 PRD/接口/Figma 的具体位置。

4. **编译验证 + 视觉审计 = 双层质量闸口**：编译验证保"代码能跑"，视觉审计保"页面还原正确"，两者缺一不可。

5. **经验沉淀是流程进化的引擎**：没有沉淀的反馈只是这次任务的救火；有了沉淀，每一个需求都在让团队的 AI Coding 能力变强。
*（内容由AI生成，仅供参考）*
