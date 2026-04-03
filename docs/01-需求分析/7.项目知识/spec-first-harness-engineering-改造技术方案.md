# spec-first 借鉴 Harness Engineering 与胶水编程的改造技术方案

> 方案性质：修订版架构与流程设计稿
> 适用范围：`spec-first` 主框架、`spec-bootstrap`、`spec-plan`、`spec-work`、`spec-review`、`spec-compound`
> 参考来源：
> - `docs/09-业界借鉴/2026-04-03-Qoder-工程实践：Harness-Engineering-指南.md`
> - `docs/09-业界借鉴/2026-03-27-胶水编程-业务需求出码最佳实践.md`
> - `docs/05-用户手册/02-核心概念.md`
> - `skills/spec-bootstrap/SKILL.md`
> - `skills/spec-work/SKILL.md`
> - `skills/spec-review/SKILL.md`
> - `skills/spec-compound/SKILL.md`
> 修订日期：2026-04-04

---

## 1. 背景与核心判断

`spec-first` 当前已经有一套成型的 workflow 骨架：

- 主链路是 `ideate -> brainstorm -> plan -> work -> review -> compound`
- `spec-bootstrap` 是 Stage-0 supporting workflow，负责产出 `docs/contexts/<slug>/`
- `spec-work` 已支持 subagent、worktree、测试与 lint
- `spec-review` 已支持 persona review、autofix、run artifact
- `spec-compound` 已支持把问题沉淀为长期文档

但如果同时吸收 Harness Engineering 和“胶水编程”的经验，当前系统还缺两层关键能力：

1. **Harness 层**
   规则、预检、统一验证、失败回流还不够强。
2. **Glue 层**
   样板间、参考实现、相似代码索引还不够强，Agent 仍然容易“原创过多”。

因此本方案的核心判断不是“继续堆更多规则”，也不是“只补几个提示词”，而是：

> `spec-first` 应演进为一个同时具备 `Spec + Reference + Harness + Memory` 的 Agent 交付系统。

这意味着后续改造要同时满足两件事：

- 用 Harness 防止 Agent 乱做
- 用 Reference/Pattern 让 Agent 尽量少从零开始写

---

## 2. 本方案的七个硬决策

这七个决策是后续实现的 source-of-truth，优先级高于局部设计细节。

### 2.1 `spec-bootstrap` 保持 supporting workflow，不升级为强前置

`spec-bootstrap` 仍然是推荐先跑的 Stage-0，但不是 `spec-work` 的硬前提。

后续执行模式统一分成两档：

- `Harness-enabled`
  发现 bootstrap 控制面资产时，启用增强预检与 reference-first 流程
- `Reduced-harness`
  未发现 bootstrap 资产时，退化为轻量 repo scan + 现有 instruction file + 就地 pattern 搜索

这样可以保持产品心智稳定，同时把用户逐步引导到更强路径。

### 2.2 repo-root instruction file 只能有一个 writer

当前平台语义已经明确：

- Claude 平台使用 repo-root `CLAUDE.md`
- Codex 平台使用 repo-root `AGENTS.md`

本方案规定：

- `spec-bootstrap` **不直接写** `CLAUDE.md` / `AGENTS.md`
- repo-root instruction file 的 writer 继续由 runtime/CLI 层负责
- Stage-0 只产出 `instruction-context.json` 与 `instruction-context.md`

首版实现建议统一抽象为 `sync-instruction` 能力：

- 第一阶段可以先以 `init --refresh-context` 的内部流程落地
- 后续如有必要，再公开为独立命令

一句话：**bootstrap 负责生成内容，runtime 负责写 instruction file。**

### 2.3 `reference-index` 与 `pattern` 资产是一等公民

不能只补 `analysis.json` 和 `verify-hints.json`。

必须同时补一层“可抄的参考实现索引”，否则系统会越来越会拦错，但不一定越来越会高采纳率出码。

第一阶段就应新增：

- `reference-index.json`
- `docs/contexts/<slug>/patterns/index.md`

它们要优先回答：

- 这个仓库里最像本次需求的页面在哪里
- 最像的 route / service / command / test 模式在哪里
- 哪些实现是“推荐复用”的，而不是“只是碰巧存在”

### 2.4 `spec-plan` 升级为 Difference Spec，而不是样板复写器

Plan 不应重复写一遍目标实现。

Plan 应优先表达：

- 本次要参考哪些现有实现
- 与参考实现相比有哪些差异
- 哪些结构性约束不能破
- 哪些验证必须做

一句话：**plan 负责差异说明，不负责重写样板。**

### 2.5 `spec-work` 必须采用 Reference-first 执行链

`spec-work` 的理想执行顺序统一为：

```text
read plan
-> load references
-> structural preflight
-> implement glue code
-> build
-> lint-arch
-> test
-> verify
```

其中最重要的不是“更多 subagent”，而是：

- `load references`
- `structural preflight`

### 2.6 `spec-review` 必须产出双轨结果

Review 不再只输出当前 diff 的 findings。

以后至少要同时产出：

- `findings`
- `rule-candidates.json`
- `pattern-candidates.json`

这三者分别解决：

- 当前问题
- 下次别再犯
- 下次直接抄更好的

### 2.7 第三阶段新增 `spec-improve`，不复用不存在的 `spec-audit`

当前仓库里没有可落地的 `skills/spec-audit`。

因此本方案不再写“增强现有 `spec-audit`”，统一改为：

- 第三阶段新增 `spec-improve`
- 如需复用评分模型，可参考现有 `agent-native-audit` 的 rubric 思路
- 但不要把一个当前不存在的 workflow 当成现成扩展点

---

## 3. 目标与非目标

## 3.1 目标

本次改造目标是：

1. 让 Stage-0 产物从“文档”升级为“文档 + 结构化控制面 + reference 索引”
2. 让 `spec-work` 在有无 bootstrap 的两种情况下都能稳定工作
3. 让 `spec-plan`、`spec-work`、`spec-review` 共享同一套 reference-first 语义
4. 让验证从“事后修”前移为“事前预检 + 统一验证链”
5. 让 review 与 compound 同时产出规则候选和样板候选
6. 让系统逐步形成 `bootstrap -> plan -> work -> review -> compound -> improve` 的闭环

## 3.2 非目标

本方案明确不做以下事情：

1. 不把 `spec-bootstrap` 变成所有 workflow 的硬前置
2. 不让 `spec-bootstrap` 直接接管 repo-root instruction file
3. 不为所有项目立即生成跨语言可执行 lint 脚本
4. 不在第一阶段引入重型 swarm 或中心化引擎
5. 不把目录猜测包装成已验证的架构规则
6. 不把未来的 `spec-improve` 伪装成当前已存在能力

---

## 4. 设计原则

## 4.1 单一所有权

- instruction file 只有 runtime/CLI 层能写
- `docs/contexts/<slug>/` 由 `spec-bootstrap` 管理
- `.context/spec-first/...` 作为控制面与运行资产

## 4.2 证据优先

任何规则、hint、reference 推荐都必须带证据来源，证据只能来自：

- 真实目录结构
- 真实配置与依赖
- 真实代码模式
- 真实 review / trace / compound 结果

## 4.3 优先复用，不鼓励原创

只要仓库里已有足够接近的实现，Agent 应优先：

1. 找最像的 reference
2. 说明差异
3. 在 reference 基础上改写 glue code

## 4.4 渐进增强

第一阶段只交付：

- 结构化分析
- reference 索引
- 可降级预检
- 统一验证契约

第二阶段再补：

- review 回流
- pattern memory
- failure memory

第三阶段再补：

- improve loop
- readiness scoring
- 自动化候选编译

---

## 5. 目标系统形态

## 5.1 目标系统一句话描述

未来的 `spec-first` 不是“带几个 workflow skill 的文档框架”，而是：

> 一个能先找参考、再做预检、再写 glue code、再统一验证、再把经验回流成规则与样板的 Agent 交付系统。

## 5.2 新的横向能力层

在现有 Prompt / Context / Harness 三层基础上，补齐五个横向能力层：

1. `Instruction Context Layer`
   供 runtime 写入 repo-root instruction file 的导航上下文
2. `Reference & Pattern Layer`
   供 plan/work 优先复用的相似实现索引
3. `Verification Hint Layer`
   供 work 做结构性动作预检
4. `Trace & Memory Layer`
   统一沉淀失败、候选规则、候选样板、稳定流程
5. `Improve Loop Layer`
   周期性把 trace 与 memory 回流为模板、规则与建议

## 5.3 控制面目录建议

```text
.context/spec-first/
  bootstrap/
    <slug>/
      analysis/
        analysis.json
        reference-index.json
        verify-hints.json
        instruction-context.json
        instruction-context.md
      tasks/
        <task-id>/prd.md
      trace/
        probe-failures.json
        worker-failures.json
        verify-warnings.json
  work/
    <run-id>/
      preflight.json
      verification.json
  review/
    <run-id>/
      findings.json
      rule-candidates.json
      pattern-candidates.json
  memory/
    procedures/
    patterns/
    failures/
    automations/
```

说明：

- `review/` 统一采用 `.context/spec-first/review/<run-id>/...`
- `work/` 新增显式持久化，用于承接 preflight 与 verification 结果
- `memory/patterns/` 用于承接“下次值得直接抄”的资产

---

## 6. Stage-0：spec-bootstrap 改造方案

`spec-bootstrap` 的新职责不是“写更多 Markdown”，而是：

- 继续生成长期上下文文档
- 同时生成下游可消费的结构化资产
- 优先帮助下游找到 reference，而不是只给抽象描述

## 6.1 保持 supporting workflow 定位

文档层面要明确写死：

- `spec-bootstrap` 是推荐先跑的 Stage-0
- 它增强下游 workflow，但不是硬依赖
- `spec-work` 必须支持无 bootstrap 资产时的降级运行

这是本方案和上一版最大的收敛点。

## 6.2 新增 `analysis.json`

路径：

`.context/spec-first/bootstrap/<slug>/analysis/analysis.json`

建议结构：

```json
{
  "slug": "target-project",
  "generated_at": "2026-04-04T02:00:00Z",
  "analysis_mode": "Enhanced",
  "primary_language": "typescript",
  "frameworks": ["next.js"],
  "layers": {
    "frontend": true,
    "backend": true,
    "shared": true
  },
  "entrypoints": [
    { "path": "package.json", "type": "npm" },
    { "path": "app", "type": "frontend-entry" }
  ],
  "commands": {
    "build": ["npm run build"],
    "test": ["npm test"],
    "lint": ["npm run lint"]
  },
  "evidence": [
    { "kind": "package.json", "path": "package.json" },
    { "kind": "framework-config", "path": "next.config.js" }
  ]
}
```

作用：

- 避免下游每次从 Markdown 反解析
- 为 `verify-hints` 和 `instruction-context` 提供结构化输入
- 为 Reduced-harness 模式定义“缺什么”

## 6.3 新增 `reference-index.json`

路径：

`.context/spec-first/bootstrap/<slug>/analysis/reference-index.json`

这是第一阶段必须落地的新增资产。

建议结构：

```json
{
  "generated_at": "2026-04-04T02:00:00Z",
  "references": [
    {
      "kind": "page",
      "path": "app/users/page.tsx",
      "reason": "closest list page with server data loading",
      "confidence": 0.83
    },
    {
      "kind": "service",
      "path": "src/server/users/service.ts",
      "reason": "closest CRUD service",
      "confidence": 0.78
    },
    {
      "kind": "test",
      "path": "tests/integration/users-flow.test.ts",
      "reason": "closest end-to-end flow",
      "confidence": 0.74
    }
  ]
}
```

要求：

- 每条 reference 都要有 `reason`
- 只能推荐真实存在且可打开的路径
- 优先推荐“值得复用”的实现，不是简单列举搜索结果

同时建议投影出人类可读版：

`docs/contexts/<slug>/patterns/index.md`

## 6.4 新增 `instruction-context`

路径：

- `.context/spec-first/bootstrap/<slug>/analysis/instruction-context.json`
- `.context/spec-first/bootstrap/<slug>/analysis/instruction-context.md`

关键约束：

- `spec-bootstrap` 只产出内容
- 绝不直接改 repo-root `CLAUDE.md` / `AGENTS.md`

建议结构：

```json
{
  "managed_block_title": "spec-first Context",
  "quick_links": [
    "docs/contexts/target-project/00-summary.md",
    "docs/contexts/target-project/patterns/index.md",
    "docs/contexts/target-project/pitfalls/index.md"
  ],
  "build_commands": ["npm run build"],
  "test_commands": ["npm test"],
  "high_risk_areas": ["src/server/auth", "src/shared/config"]
}
```

随后由 runtime 层的 `sync-instruction` 能力决定：

- 当前项目的 instruction file 是 `CLAUDE.md` 还是 `AGENTS.md`
- 如何在受管理区块内写入
- 如何做备份与恢复

## 6.5 新增 `verify-hints.json`

路径：

`.context/spec-first/bootstrap/<slug>/analysis/verify-hints.json`

建议结构：

```json
{
  "file_creation_zones": [
    { "pattern": "app/**", "role": "frontend-entry", "evidence_level": "verified" },
    { "pattern": "src/server/**", "role": "backend", "evidence_level": "verified" }
  ],
  "public_interface_zones": [
    { "pattern": "app/api/**", "evidence_level": "verified" }
  ],
  "risk_rules": [
    {
      "id": "cross-layer-import",
      "description": "Avoid frontend importing backend internals directly",
      "evidence_level": "inferred-from-structure"
    }
  ]
}
```

关键原则：

- hint 不是 lint rule
- `verified` 与 `inferred-from-structure` 必须显式区分
- 下游消费时，`inferred` 最多产生 `WARN`，不能直接当 `INVALID`

## 6.6 Assembly verify 与 trace 建模

Assembly 后新增真实性核验，但只写 warning，不触发 full restore。

核验项：

1. `module-map.md` 中列出的路径是否存在
2. `pitfalls/index.md` 中引用的路径是否存在
3. `00-summary.md` 中识别的框架是否能在真实配置中找到证据
4. `instruction-context` 中命令是否有真实来源
5. `reference-index.json` 中所有路径是否存在

trace 文件统一拆成：

- `probe-failures.json`
- `worker-failures.json`
- `verify-warnings.json`

这样可以避免把 Phase 1 探针失败和 worker 失败混成一个 taxonomy。

---

## 7. 规划面：spec-plan 改造方案

上一版方案缺了 `spec-plan`，这是不完整的。

如果没有 plan 层承接 reference-first 语义，`spec-work` 很容易重新退回“读需求然后原创实现”。

## 7.1 改造目标

让 `spec-plan` 从“技术说明文档”升级为“差异说明书”。

它要回答的核心问题变成：

1. 本次优先参考哪些现有实现
2. 本次与 reference 相比差在哪
3. 哪些结构性规则不能破
4. 这次准备怎么验证

## 7.2 新增四个标准字段

### `References`

列出最像的页面、route、service、test、command。

### `Differences`

只写和 reference 不同的地方，例如：

- 新增权限校验
- 多一个筛选条件
- 输出格式改成 JSON

### `Structural Constraints`

例如：

- 不允许 frontend 直接引用 backend internals
- 新增 public endpoint 只能放在 `app/api/` 或既有 route 目录

### `Verification Mapping`

```markdown
## Verification Mapping

- build: `npm run build`
- lint-arch: `npm run lint`
- test: `npm test`
- verify: `node scripts/verify/login-flow.js`
```

## 7.3 禁止事项

Plan 不应：

- 内联大段样板代码
- 重新复写完整实现
- 在没有 reference 时假装已经找到最优模式

当仓库里找不到可用 reference 时，应显式写出：

- `No strong local reference found`
- 需要由 `spec-work` 在实现前扩大 repo 搜索范围

---

## 8. 执行面：spec-work 改造方案

`spec-work` 是收益最高的改造点，因为它直接决定返工率和采纳率。

## 8.1 双模式运行

`spec-work` 必须内建两种模式：

### `Harness-enabled`

前置条件：

- 找到 `analysis.json`
- 找到 `reference-index.json`
- 找到 `verify-hints.json`

行为：

- 按 reference-first 路线执行
- 启用 preflight
- 显式记录 verification 结果

### `Reduced-harness`

触发条件：

- 任一关键 bootstrap 资产缺失

行为：

- 做轻量 repo scan
- 读取现有 instruction file
- 就地搜索最像 reference
- 输出提示：建议先运行 `spec-bootstrap`

关键要求：

- 退化是显式的，不允许静默退化

## 8.2 Complexity Gate

满足任一条件即视为中复杂度及以上：

- 影响 3 个及以上非测试文件
- 涉及 2 个及以上 implementation units
- 涉及 public API、权限、数据持久化、回滚、并发
- 没有 checklist 就无法完成

行为：

- 低复杂度：允许 inline
- 中复杂度：主控优先 subagent，不直接写主实现
- 高复杂度：必须 subagent，必要时 worktree

## 8.3 Reference-first 执行链

标准执行顺序固定为：

```text
read plan
-> load references
-> structural preflight
-> implement glue code
-> build
-> lint-arch
-> test
-> verify
```

解释：

- `load references` 优先解决“怎么少原创”
- `structural preflight` 优先解决“怎么少返工”
- `implement glue code` 强调是在已有模式基础上做差异化拼装

## 8.4 Preflight Verify Action

适用动作：

- 新建文件
- 新增目录
- 添加跨模块 import
- 新增公开 API / command / route
- 新增数据库访问层

输入优先级：

1. `verify-hints.json`
2. `reference-index.json`
3. `instruction-context`
4. Reduced-harness 下的 repo scan 结果

输出：

- `VALID`
- `WARN`
- `INVALID`

判定规则：

- 有 `verified` 证据支持时可给 `VALID`
- 只有 `inferred-from-structure` 时最多给 `WARN`
- 只有明确违反已验证 zone 或已验证约束时才给 `INVALID`

## 8.5 统一验证链与持久化

验证链统一为：

```text
build -> lint-arch -> test -> verify
```

持久化路径：

`.context/spec-first/work/<run-id>/verification.json`

建议结构：

```json
{
  "mode": "Harness-enabled",
  "build": { "status": "passed", "command": "npm run build" },
  "lint_arch": { "status": "passed", "command": "npm run lint" },
  "test": { "status": "passed", "command": "npm test" },
  "verify": { "status": "skipped", "reason": "no project-level verify script" }
}
```

同时记录：

- `.context/spec-first/work/<run-id>/preflight.json`

这样 review 与 compound 后续就有稳定输入，而不是只看终端输出。

---

## 9. 评审面：spec-review 改造方案

## 9.1 改造目标

让 `spec-review` 同时承担三件事：

1. 找出当前 diff 的风险
2. 提炼可回流的规则候选
3. 提炼可复用的样板候选

## 9.2 新增双候选输出

目录统一为：

`.context/spec-first/review/<run-id>/`

新增：

- `rule-candidates.json`
- `pattern-candidates.json`

示例：

```json
[
  {
    "candidate_type": "rule",
    "source_finding": "review-123-p1",
    "pattern": "public API endpoint missing auth guard",
    "suggested_target": "lint-arch / verify",
    "confidence": 0.72
  }
]
```

```json
[
  {
    "candidate_type": "pattern",
    "source_finding": "review-123-p2",
    "path": "src/server/base-crud-service.ts",
    "reason": "reused successfully across multiple endpoint implementations",
    "confidence": 0.68
  }
]
```

## 9.3 回流门槛

只有同时满足以下条件的 finding 才能进入 candidate：

- 可重复
- 可抽象
- 不强依赖某次业务上下文
- 有足够证据支撑

`autofix` 解决当前问题；
candidate 解决下次更少犯、或更少原创。

---

## 10. 知识面：spec-compound 改造方案

`spec-compound` 不应只写 `docs/solutions/`，还要为长期演进提供 pattern 与 procedure。

## 10.1 四类记忆模型

### `solution memory`

现有 `docs/solutions/`。

### `procedure memory`

记录一类任务怎么做最稳，例如：

- 新增 endpoint
- 新增 skill
- 更新 runtime 资产

### `pattern memory`

记录哪些实现值得以后直接参考，例如：

- 某类表单页
- 某类 service
- 某类 integration test

### `failure memory`

记录高频失败、踩坑与 warning。

## 10.2 automation candidates

当同类流程多次成功且步骤稳定时，可产出：

```json
{
  "task_family": "add-endpoint",
  "evidence_count": 4,
  "stability": "high",
  "suggested_next_step": "compile into script/template"
}
```

这不是直接生成脚本，而是给第三阶段的 `spec-improve` 提供输入。

---

## 11. 第三阶段新增能力：spec-improve

Harness Engineering 真正有价值的部分，不是第一次搭建，而是后续越来越像团队自己的系统。

## 11.1 定位

第三阶段新增 `spec-improve`，职责是：

1. 读取 bootstrap / work / review / compound / memory / trace
2. 评估 agent-readiness
3. 输出 Highest ROI gaps
4. 在允许范围内更新模板建议、rule candidate 汇总或 instruction-context 内容源

## 11.2 评分维度

建议至少包含五项：

1. `instruction_readiness`
2. `context_readiness`
3. `reference_readiness`
4. `verification_readiness`
5. `feedback_loop_readiness`

## 11.3 输出形式

```markdown
# Agent Readiness Audit

- Instruction Readiness: 72
- Context Readiness: 85
- Reference Readiness: 39
- Verification Readiness: 41
- Feedback Loop Readiness: 33

## Highest ROI Gaps
- Missing reference index for common task families
- No structural preflight in work phase
- Review findings are not compiled into reusable rules or patterns
```

---

## 12. 需要改动的资产

## 12.1 Skill / prompt 资产

- `skills/spec-bootstrap/SKILL.md`
- `skills/spec-bootstrap/references/prd-template.md`
- `skills/spec-bootstrap/references/database-prd-template.md`
- `skills/spec-plan/SKILL.md`
- `skills/spec-work/SKILL.md`
- `skills/spec-review/SKILL.md`
- `skills/spec-compound/SKILL.md`

## 12.2 文档层

- `docs/05-用户手册/02-核心概念.md`
- `docs/01-需求分析/4.五阶段工作流详解.md`
- 与 bootstrap / work / review / compound 相关的需求分析文档

## 12.3 CLI / runtime 层

若进入实现，需要至少考虑：

- `src/cli/commands/init.js`
- `src/cli/lang-policy.js`
- `src/cli/commands/doctor.js`
- `src/cli/state.js`

其中 `init` 或其共享 helper 需要承担 `sync-instruction` writer 角色。

---

## 13. 实施分期

## 13.1 第一阶段：高 ROI 基础改造

范围：

1. `spec-bootstrap` 新增 `analysis.json`
2. `spec-bootstrap` 新增 `reference-index.json`
3. `spec-bootstrap` 新增 `verify-hints.json`
4. `spec-bootstrap` 新增 `instruction-context.json/.md`
5. `spec-plan` 新增 `References / Differences / Structural Constraints / Verification Mapping`
6. `spec-work` 新增 `Harness-enabled / Reduced-harness`
7. `spec-work` 新增 preflight 与 `verification.json`

预期收益：

- reference-first 路线具备最小闭环
- bootstrap 不再只是“读物生成器”
- work 在无 bootstrap 时也有明确降级行为

## 13.2 第二阶段：反馈回流与记忆增强

范围：

1. `spec-review` 输出 `rule-candidates.json`
2. `spec-review` 输出 `pattern-candidates.json`
3. `spec-compound` 新增 procedure / pattern / failure / automation candidates
4. bootstrap / work / review trace 统一建模

预期收益：

- review 不再只是一次性判题
- compound 不再只记“怎么修”，还记“以后怎么抄、怎么防”

## 13.3 第三阶段：系统自进化

范围：

1. 新增 `spec-improve`
2. 引入 agent-readiness 评分
3. 基于 memory / trace 编译 Highest ROI improvements

预期收益：

- `spec-first` 从 workflow 集合演进为持续优化的交付系统

---

## 14. 风险与缓解

## 14.1 风险：bootstrap 被误用成强前置

缓解：

- 文档明确 supporting workflow 定位
- `spec-work` 必须实现 `Reduced-harness`
- 缺失 bootstrap 资产时显式提示，不允许静默失败

## 14.2 风险：instruction file 所有权冲突

缓解：

- bootstrap 只产出 `instruction-context`
- repo-root instruction file 只由 runtime/CLI writer 更新
- writer 必须具备备份与恢复语义

## 14.3 风险：reference 索引变成无价值文件列表

缓解：

- 每条 reference 必须写 `reason`
- 只推荐可复用的“好模式”
- review 与 compound 可以反向修正 reference 候选

## 14.4 风险：把推断包装成规则

缓解：

- 所有 hint 标注 `evidence_level`
- `inferred-from-structure` 只能产生 `WARN`
- `INVALID` 仅来自已验证证据

## 14.5 风险：控制面过重

缓解：

- 第一阶段先做 `analysis + reference-index + verify-hints + reduced-harness`
- 第三阶段前不引入过重自动化

---

## 15. 验收标准

进入实现时，建议以以下结果验收：

1. `spec-bootstrap` 运行后，除 `docs/contexts/<slug>/` 外，存在 `analysis.json`、`reference-index.json`、`verify-hints.json`、`instruction-context.json`
2. runtime 层能基于 `instruction-context` 更新 repo-root `CLAUDE.md` 或 `AGENTS.md`，且不破坏现有治理块
3. `spec-work` 在无 bootstrap 资产时仍可运行，并显式报告 `Reduced-harness`
4. `spec-plan` 能显式列出 `References / Differences / Structural Constraints / Verification Mapping`
5. `spec-work` 能持久化 `preflight.json` 与 `verification.json`
6. `spec-review` 能同时输出 findings、rule candidates、pattern candidates
7. `spec-compound` 能沉淀 procedure / pattern / failure / automation candidates
8. 第三阶段的 `spec-improve` 能输出 readiness 分数与 Highest ROI gaps

---

## 16. 结论

这次修订后的路线与上一版相比，核心变化有四个：

1. 不再把 `spec-bootstrap` 推向强前置，而是明确 supporting workflow + 可降级 harness
2. 不再让 bootstrap 直接写 instruction file，而是恢复单一 writer 语义
3. 不再只强调规则与验证，而是把 `reference-index` 和 pattern 资产提升为一等能力
4. 不再跳过 `spec-plan`，而是把它纳入 reference-first 主链

因此，本方案的最终判断是：

> `spec-first` 最优的演进方向，不是“更重的规则系统”，也不是“更长的上下文文档”，
> 而是一个让 Agent 先找参考、再做预检、再写 glue code、再统一验证、最后把经验回流成规则和样板的交付系统。

这条路径比单纯补 Harness 更稳，也比单纯补 Context 更有采纳率，更符合 `spec-first` 当前的产品形态与实现约束。
