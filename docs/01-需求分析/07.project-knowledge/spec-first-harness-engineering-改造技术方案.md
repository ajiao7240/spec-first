# spec-first 借鉴 Harness Engineering、胶水编程、知识基座与 Spec Runtime 的改造技术方案

> 方案性质：修订版架构与流程设计稿
> 适用范围：`spec-first` 主框架、`spec-graph-bootstrap`、`spec-brainstorm`、`spec-plan`、`spec-work`、`spec-code-review`、`spec-compound`、`spec-ideate`
> 参考来源：
> - `docs/09-业界借鉴/2026-04-03-Qoder-工程实践：Harness-Engineering-指南.md`
> - `docs/09-业界借鉴/2026-03-27-胶水编程-业务需求出码最佳实践.md`
> - `docs/09-业界借鉴/2026-03-02-AI-Coding思考：从工具提效到范式变革，我们还缺什么？.md`
> - `docs/09-业界借鉴/2026-03-23-知识基座：让“AI-越用越懂业务”的团队经验实践【天猫AI-Coding实践系列】.md`
> - `docs/09-业界借鉴/2026-03-30-从-Vibe-Coding-到范式编程：用-Spec-打造淘系交易的-AI-领域专家.md`
> - `docs/05-用户手册/02-核心概念.md`
> - `skills/spec-graph-bootstrap/SKILL.md`
> - `skills/spec-work/SKILL.md`
> - `skills/spec-code-review/SKILL.md`
> - `skills/spec-compound/SKILL.md`
> 修订日期：2026-04-04

---

## 1. 背景与核心判断

`spec-first` 当前已经有一套成型的 workflow 骨架：

- 主链路是 `ideate -> brainstorm -> plan -> work -> review -> compound`
- `spec-graph-bootstrap` 是 Stage-0 supporting workflow，负责产出 `docs/contexts/<slug>/`
- `spec-work` 已支持 subagent、worktree、测试与 lint
- `spec-code-review` 已支持 persona review、autofix、run artifact
- `spec-compound` 已支持把问题沉淀为长期文档

但如果同时吸收 Harness Engineering、“胶水编程”、“知识基座”与 “Spec Runtime” 四组经验，当前系统还缺四层关键能力：

1. **Harness 层**
   规则、预检、统一验证、失败回流还不够强。
2. **Glue 层**
   样板间、参考实现、相似代码索引还不够强，Agent 仍然容易“原创过多”。
3. **Knowledge Ops 层**
   超级个体经验还没有被转成团队共享、可分层、可路由、可自动保鲜的知识基座。
4. **Spec Runtime 层**
   `proposal -> doubt points -> design -> tasks` 还没有成为统一的执行入口，Spec 仍偏静态文档。

因此本方案的核心判断不是“继续堆更多规则”，也不是“只补几个提示词”，而是：

> `spec-first` 应演进为一个同时具备 `Spec Runtime + Shared Knowledge + Reference + Harness + Memory` 的 Agent 交付系统。

这意味着后续改造要同时满足四件事：

- 用 Harness 防止 Agent 乱做
- 用 Reference/Pattern 让 Agent 尽量少从零开始写
- 用 Shared Knowledge 把超级个体的方法论沉淀成团队能力
- 用 Spec Runtime 把需求、疑问、设计、任务编译成稳定执行链

---

## 2. 本方案的八个硬决策

这八个决策是后续实现的 source-of-truth，优先级高于局部设计细节。

### 2.1 `spec-graph-bootstrap` 保持 supporting workflow，不升级为强前置

`spec-graph-bootstrap` 仍然是推荐先跑的 Stage-0，但不是 `spec-work` 的硬前提。

后续执行模式统一分成两档：

- `Harness-enabled`
  发现 bootstrap 控制面资产时，启用增强预检与 reference-first 流程
- `Reduced-harness`
  未发现 bootstrap 资产时，退化为轻量 repo scan + 现有 instruction file + 就地 pattern 搜索

这样可以保持产品心智稳定，同时把用户逐步引导到更强路径。

但这里还要再收紧一层边界：

- `Reduced-harness` 只是“bootstrap 资产缺失时仍可运行”的兼容底线
- 它不应被当成完整的 `0-1` 新项目设计模式

对于新项目，后续应显式演进出 `Greenfield Mode`；对于已有存量仓库，则默认走 `Brownfield Mode`。两者都可复用同一条 workflow 主链，但默认加载资产、reference 来源与验证重心不同。

### 2.2 repo-root instruction file 只能有一个 writer

当前平台语义已经明确：

- Claude 平台使用 repo-root `CLAUDE.md`
- Codex 平台使用 repo-root `AGENTS.md`

本方案规定：

- `spec-graph-bootstrap` **不直接写** `CLAUDE.md` / `AGENTS.md`
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

### 2.4 `spec-plan` 升级为 Difference Spec 与 Spec Runtime 入口，而不是样板复写器

Plan 不应重复写一遍目标实现，也不应跳过 proposal/design 直接进入 task list。

Plan 应优先表达：

- 上游 proposal / requirements 还缺哪些 planning-relevant 澄清
- 本次要参考哪些现有实现
- 与参考实现相比有哪些差异
- 哪些结构性约束不能破
- 哪些验证必须做

一句话：**plan 负责消费 proposal handoff，补齐 design / tasks，并表达差异，而不是重写 WHAT 或样板。**

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

### 2.6 `spec-code-review` 必须产出双轨结果

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

### 2.8 优先建设 Shared Knowledge Substrate，而不是继续堆单仓库技巧

`docs/contexts/<slug>/` 和 repo-local reference 很重要，但它们只覆盖了仓库上下文。

后续必须补上的，是一层可共享、可隔离、可路由的知识基座。它至少要覆盖：

- `repo knowledge`
  仓库上下文、reference、history spec、experience memory
- `domain knowledge`
  某业务域/某团队共享的术语、规范、特殊流程
- `platform knowledge`
  设计系统、组件库、API 平台、基础设施等上游知识
- `experience knowledge`
  来自踩坑、试错、review、验证失败后修复的隐性经验

首版不强依赖云控中心，但要在产品模型上把这层抽象出来，后续才能从“repo-local SDD”走向“团队级知识运营”。

---

## 3. 目标与非目标

### 3.1 目标

本次改造目标是：

1. 让 Stage-0 产物从“文档”升级为“文档 + 结构化控制面 + reference 索引”
2. 让 `spec-work` 在有无 bootstrap 的两种情况下都能稳定工作
3. 让 `spec-plan` 显式产出 `proposal / design / tasks / doubt points`
4. 让 `spec-plan`、`spec-work`、`spec-code-review` 共享同一套 reference-first 与 history-first 语义
5. 让 `spec-brainstorm` 与 `spec-ideate` 以轻量方式消费同一套上下文与知识入口
6. 让验证从“事后修”前移为“事前预检 + 统一验证链”
7. 让 review 与 compound 同时产出规则候选和样板候选
8. 让 repo knowledge、domain knowledge、platform knowledge、experience knowledge 具备统一路由语义
9. 让系统逐步形成 `bootstrap -> brainstorm -> plan -> work -> review -> compound -> improve` 的闭环

### 3.2 非目标

本方案明确不做以下事情：

1. 不把 `spec-graph-bootstrap` 变成所有 workflow 的硬前置
2. 不让 `spec-graph-bootstrap` 直接接管 repo-root instruction file
3. 不为所有项目立即生成跨语言可执行 lint 脚本
4. 不在第一阶段引入重型 swarm 或中心化引擎
5. 不把目录猜测包装成已验证的架构规则
6. 不把未来的 `spec-improve` 伪装成当前已存在能力
7. 不假定第一阶段就必须上线远程知识中心或统一管理后台

---

## 4. 设计原则

### 4.1 单一所有权

- instruction file 只有 runtime/CLI 层能写
- `docs/contexts/<slug>/` 由 `spec-graph-bootstrap` 管理
- `.context/spec-first/...` 作为控制面与运行资产

### 4.2 证据优先

任何规则、hint、reference 推荐都必须带证据来源，证据只能来自：

- 真实目录结构
- 真实配置与依赖
- 真实代码模式
- 真实 review / trace / compound 结果

### 4.3 优先复用，不鼓励原创

只要仓库里已有足够接近的实现，Agent 应优先：

1. 找最像的 reference
2. 说明差异
3. 在 reference 基础上改写 glue code

### 4.4 渐进增强

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

### 4.5 知识路由优于知识堆积

不是所有知识都应该沉淀进同一个经验库。

统一路由原则如下：

1. 组件/框架基础用法
   优先回到平台文档或 platform knowledge pack
2. 业务域术语、规则、概念映射
   优先进入 domain knowledge pack
3. 仓库特定路径、模块结构、reference
   优先进入 repo knowledge
4. 特定场景、边缘情况、官方文档不会覆盖的坑
   进入 experience knowledge / failure memory
5. 某次需求的设计 rationale 与实现路径
   进入 history spec / historical analogs

目标不是“知识越来越多”，而是“知识越来越知道该去哪里”。

### 4.6 结构化资产必须版本化

凡是写入 `.context/spec-first/` 的 JSON 资产，默认都应遵守同一条最小契约：

- 顶层使用 object，而不是裸 array
- 必须包含 `schema_version`
- 只要是自动生成产物，最好同时包含 `generated_at`
- 只要产物参与跨阶段关联，最好同时包含 `slug`、`spec_id`、`run_id` 中的适用字段

建议首版统一使用：

```json
{
  "schema_version": "1.0"
}
```

这样后续即使字段演进，也能做兼容读取、迁移或显式报错，而不是把旧文件误当成新格式消费。

### 4.7 workflow first，knowledge second

本方案虽然引入了 Shared Knowledge Substrate，但它首先是为了增强现有 workflow 主链，而不是优先建设一个独立知识平台。

优先级必须始终保持为：

1. 先改善 `brainstorm / plan / work / review / compound` 的实际体验
2. 再把有效经验抽象成 knowledge routing、packs、connected sources
3. 最后才考虑更强的统一知识运营能力

任何知识层设计，如果不能直接帮助主链减少原创、返工或知识丢失，就不应优先进入实现主路径。

### 4.8 交付增益优先于治理膨胀

本方案不是为了把 `spec-first` 演进成更重的治理系统。

每个新增能力都应优先回答三个问题：

1. 是否减少 `spec-work` 的原创量
2. 是否减少错误假设或返工
3. 是否把一次经验变成下次可复用资产

若一个能力主要增加控制面、规则量或配置量，却无法回答上面至少两个问题，则不应进入主链。

### 4.9 人确认优先于自动写回

candidate、routing、memory、improve 的职责首先是提炼和建议，而不是自动接管系统。

默认原则应为：

- `rule-candidates` 与 `pattern-candidates` 先产出候选，不自动写回规则源
- `spec-compound` 先做路由建议，不静默覆盖人工维护内容
- `spec-improve` 先输出 Highest ROI gaps 与建议，不自动修改主资产

只有在证据充分、边界明确、回滚语义清晰的前提下，才应考虑局部自动写回。

### 4.10 全局合理性的判断标准

后续任何实现或裁剪，如果要判断是否符合本方案的全局方向，应优先检查：

1. 是否保持 `spec-graph-bootstrap` 只是增强器而不是 gatekeeper
2. 是否继续坚持 instruction file、文档层、控制面的单一所有权
3. 是否让 `Spec` 更像执行契约，而不是新增文档负担
4. 是否坚持 `verified` 与 `inferred` 的证据边界
5. 是否让系统更少原创、更少返工、更少丢知识

这五条比局部目录名、字段名和阶段拆分更重要。

### 4.11 五组系统级张力与裁决

这份方案不是简单地“补几个能力”，而是在处理五组长期会反复出现的系统级张力。

#### 工作流产品 vs 知识基础设施

裁决：

- `spec-first` 首先是 workflow product
- Shared Knowledge Substrate 只应作为 workflow 的增强层
- 不允许为了 packs、source registry、connected sources 的完整性，牺牲主链的简洁性与落地速度

#### 执行增强 vs 治理增强

裁决：

- guardrails 必须与 `reference / template / pattern` 同步建设
- 任何治理能力，如果无法同时提升采纳率、复用率或返工率，就不应优先进入主链
- 系统默认目标不是“更会拦错”，而是“更会做对”

#### Brownfield 优化 vs Greenfield 支持

裁决：

- `Brownfield Mode` 可以是当前更强的收益来源，但不能成为唯一心智模型
- `Greenfield Mode` 必须是一等场景，而不是 `Reduced-harness` 的别名
- 所有“默认依赖本地成熟 reference”的设计，都必须明确给出 greenfield 下的替代路径

#### 文档驱动 vs 运行时驱动

裁决：

- 文档层、控制面、instruction file 必须各有清晰职责
- `docs/contexts/<slug>/` 是人类可读 source of truth
- `.context/spec-first/...` 是 workflow 运行时控制面
- skill prompt、runtime metadata、文档内容不得演化成三套并行真相源

#### 自动闭环 vs 人类裁决

裁决：

- `doubt points`、`INVALID`、routing candidate、`spec-improve` 输出都应保留人类裁决点
- 默认优先“提建议、给候选、保留 override”，而不是自动写回
- 自动化只能在证据充分、审批明确、回滚可行的局部环节展开

---

## 5. 目标系统形态

### 5.1 目标系统一句话描述

未来的 `spec-first` 不是“带几个 workflow skill 的文档框架”，而是：

> 一个能先加载合适知识、再产出 Spec、再找参考、再做预检、再写 glue code、再统一验证、再把经验回流成规则、样板与知识源头的 Agent 交付系统。

### 5.2 新的横向能力层

在现有 Prompt / Context / Harness 三层基础上，补齐六个横向能力层：

1. `Instruction Context Layer`
   供 runtime 写入 repo-root instruction file 的导航上下文
2. `Shared Knowledge Substrate Layer`
   统一抽象 repo/domain/platform/experience 四类知识源
3. `Reference & Pattern Layer`
   供 plan/work 优先复用的相似实现索引
4. `Verification Hint Layer`
   供 work 做结构性动作预检
5. `Trace & Memory Layer`
   统一沉淀失败、候选规则、候选样板、稳定流程
6. `Improve Loop Layer`
   周期性把 trace 与 memory 回流为模板、规则与建议

### 5.3 控制面目录建议

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
      meta.json
      preflight.json
      verification.json
      signals.json
  spec-code-review/
    <run-id>/
      meta.json
      findings.json
      rule-candidates.json
      pattern-candidates.json
  history/
    <spec-id>/
      meta.json
      decision-notes.md
  knowledge/
    sources.json
    points.json
    retrieval-policy.json
    history-spec-index.json
    signal-candidates/
  memory/
    procedures/
    patterns/
    failures/
    automations/
```

说明：

- 平台运行态状态文件仍保持在 `.claude/spec-first/state.json` 或 `.codex/spec-first/state.json`
- `.context/spec-first/` 是 workflow 控制面与中间产物目录，不替代平台 state file
- `spec-code-review/` 沿用当前项目已经存在的 scratch 路径命名，避免和现有 runtime / 文档约定冲突
- `work/` 新增显式持久化，用于承接 preflight 与 verification 结果
- `history/` 保存跨 session 仍然重要的设计决策、实现偏差与 lineage 元信息
- `knowledge/` 保存 repo-local 视角下的知识源清单、知识点、路由策略和历史 spec 索引
- `memory/patterns/` 用于承接“下次值得直接抄”的资产

主键与关联约定：

- `slug`
  标识一个 bootstrap 目标项目
- `spec_id`
  标识一条需求 / plan / work / review / compound 的 lineage
- `run-id`
  标识某次具体执行或审查

要求：

- `work/<run-id>/meta.json` 必须至少包含 `slug`、`spec_id`、`source_plan`
- `spec-code-review/<run-id>/meta.json` 必须至少包含 `slug`、`spec_id`、可选 `work_run_id`
- `history/<spec-id>/meta.json` 必须至少包含 `slug`、当前 spec 的主入口文档路径

否则后续的 Historical Analogs、专项 reviewer、knowledge routing 都无法稳定关联到正确上下文。

`spec_id` 的生成规范也要一并固定：

1. 主路径
   由 `spec-plan` 在写 plan 文档时生成并写入 frontmatter / metadata
2. 推荐格式
   复用 plan 主文件名 stem，不含结尾 `-plan`
   例如：`2026-04-04-001-feature-order-list`
3. 唯一性
   以 repo-local 为作用域，沿用现有 plan 文件命名的日期 + 序号唯一性
4. 直达 work 的降级路径
   若用户绕过 plan 直接进入 `spec-work`，则生成 `adhoc-YYYYMMDD-HHMMSS-<slug>`，
   并在 `meta.json` 标记 `spec_origin: "adhoc"`
5. 使用规则
   一旦 stable `spec_id` 已生成，下游 workflow 必须复用，不得自行改写

这样既兼容当前“plan 是主入口”的主链路，也兼容少量 direct-to-work 的例外路径。

### 5.3.1 Projection Matrix

为避免文档层、控制面、instruction file、skill prompt 演化成多套真相源，首版必须明确几个高频字段的投影规则。

| 字段 / 资产 | 唯一真源 | 默认写入责任方 | 允许投影到 | 禁止行为 |
| --- | --- | --- | --- | --- |
| `proposal` 的 WHAT 层内容 | `docs/brainstorms/*-requirements.md`；仅在 direct-to-plan 时允许 `docs/plans/*.md` 中的 `provisional proposal` 临时承担真源 | `spec-brainstorm`；例外时由 `spec-plan` 临时生成 | `docs/plans/*.md` 的 `proposal` section；必要时投影到 `history/<spec-id>/meta.json` 的引用字段 | `plan` 中的 `proposal` section 独立演化；prompt 内长期保留与真源不一致的 WHAT 摘要 |
| `quick_links` | `.context/spec-first/bootstrap/<slug>/analysis/instruction-context.json` | `spec-graph-bootstrap` | `instruction-context.md`、repo-root managed block、`docs/contexts/<slug>/README.md` 中的导航段 | 在多个 Markdown 文档中各自手工维护不同版本的 quick links |
| `high_risk_areas` | `.context/spec-first/bootstrap/<slug>/analysis/instruction-context.json` | `spec-graph-bootstrap`；后续由 review / improve 只产出更新提案 | repo-root managed block、`work/<run-id>/meta.json`、review 选择 reviewer 的运行时上下文 | 直接在 prompt、README 或 plan 文档里手工改写并反向覆盖 JSON 真源 |
| `build/test/verify` 命令 | `.context/spec-first/bootstrap/<slug>/analysis/instruction-context.json`；若目标项目已有稳定脚本入口，应优先记录脚本入口而不是临时命令串 | `spec-graph-bootstrap` 初始化；runtime 只消费 | repo-root managed block、`docs/contexts/<slug>/00-summary.md`、`work/<run-id>/verification.json` 的引用字段 | 在多个 workflow 中各自复制维护命令字符串 |
| reference 元数据（路径、理由、排序分、质量状态） | `.context/spec-first/bootstrap/<slug>/analysis/reference-index.json` | `spec-graph-bootstrap` 初始化；`spec-code-review` / `spec-improve` 只产出候选更新 | `docs/contexts/<slug>/patterns/index.md`、plan 中的 references section、work 的消费上下文 | 把 `patterns/index.md` 当作机器真源；在 plan/work 中私自新增未登记 reference |
| verify hints / 结构性预检规则 | `.context/spec-first/bootstrap/<slug>/analysis/verify-hints.json` | `spec-graph-bootstrap` | `work/<run-id>/preflight.json` 的引用字段、必要时的人类可读摘要 | 由 `spec-work` 在运行中默默改写 hint 真源 |
| 历史决策摘要 | `history/<spec-id>/decision-notes.md` | `spec-compound` 或人工维护 | `history-spec-index.json` 摘要字段、plan/work 的历史 analog 引用 | 在索引里写比 `decision-notes.md` 更完整、且彼此冲突的决策版本 |

补充约束：

- 若投影与唯一真源冲突，必须回到真源修正，再重新生成或同步投影。
- runtime metadata 可以缓存引用值，但缓存值不得反向成为 authoring surface。
- skill prompt 只能读取或摘要这些字段，不得承担长期存储职责。
- 若某字段尚未定义唯一真源，则该字段不应同时出现在两个以上可编辑位置。

### 5.4 Shared Knowledge Substrate 设计

这层是本次“进一步思考”后最需要补上的部分。

`spec-first` 不应只消费 repo-local 上下文，而要能统一处理四类知识源：

1. `repo-local`
   `docs/contexts/`、history spec、repo experience、reference index
2. `runtime-managed packs`
   由 `spec-first` runtime 管理的 domain/platform knowledge packs
3. `connected sources`
   通过 MCP 或其他适配层访问的外部文档/资产中心/API 文档
4. `signal-derived knowledge`
   从 work/review/compound 运行痕迹中自动提取的经验

除“知识源”外，还应显式区分一类轻量资产：

- `knowledge points`
  用一句话或短映射表达的高频澄清信息，例如“业务术语 -> 代码位置”“概念 A 与概念 B 的区别”“某工具链的特殊行为”。

首版不要求做“云端配置中心”，但要先定义三个 repo-local 入口：

- `.context/spec-first/knowledge/sources.json`
- `.context/spec-first/knowledge/points.json`
- `.context/spec-first/knowledge/retrieval-policy.json`

建议结构如下：

```json
{
  "schema_version": "1.0",
  "sources": [
    { "id": "repo-context", "kind": "repo-local", "path": "docs/contexts/target-project" },
    { "id": "repo-history-spec", "kind": "repo-local", "path": ".context/spec-first/knowledge/history-spec-index.json" },
    { "id": "domain-pack-default", "kind": "runtime-managed-pack", "scope": "domain" },
    { "id": "platform-pack-default", "kind": "runtime-managed-pack", "scope": "platform" }
  ]
}
```

```json
{
  "schema_version": "1.0",
  "points": [
    {
      "id": "business-term-to-code-location",
      "keywords": ["种草列表", "feeds list"],
      "content": "种草列表入口优先检查 app/feeds/page.tsx 与 src/server/feeds/*"
    }
  ]
}
```

```json
{
  "schema_version": "1.0",
  "always_load": [
    "instruction-context",
    "repo-summary",
    "repo-pattern-index",
    "triggered-knowledge-points"
  ],
  "on_demand": [
    "experience-knowledge",
    "history-spec",
    "platform-docs",
    "domain-rules"
  ],
  "priority_order": [
    "repo-task-context",
    "history-spec",
    "repo-experience",
    "domain-pack",
    "platform-pack",
    "global-fallback"
  ]
}
```

这层解决的不是“知识存哪里”这么简单，而是三个长期问题：

- 知识跟仓库走还是跟人走
- 不同知识该在什么时机被加载
- 某条经验最终该回流到哪个源头

Phase 1 的写入责任也要明确：

- `spec-graph-bootstrap`
  初始化并写入 repo-local 的 `sources.json`、`points.json`、`retrieval-policy.json`
- runtime / CLI
  只负责补充 runtime-managed pack 的可用性信息，不直接接管 repo-local 内容
- `spec-improve`
  只在显式允许写回时更新这些文件，默认输出建议而不自动覆盖
- 用户
  可手动维护非自动生成条目；后续自动流程不得静默覆盖手工内容

### 5.5 Spec Runtime 设计

仅有 shared knowledge 还不够，必须再有一层把知识编译成交付动作的 `Spec Runtime`。

建议统一链路为：

```text
PRD / issue / user intent
-> proposal
-> doubt points
-> design
-> tasks
-> work
-> review
-> compound
```

这里的关键不是“多几个文档”，而是把每个阶段都变成有明确职责的中间表示：

- `proposal`
  聚焦 Why / What / impact / scope
- `doubt points`
  暴露当前无法确定、需要补充的信息
- `design`
  聚焦架构、决策、约束、验证
- `tasks`
  把 design 编译成可执行清单

角色边界也必须明确收紧：

- `proposal`
  默认由 `spec-brainstorm` 的 requirements / brief 产物承担，是 WHAT 层的 handoff artifact
- `spec-plan`
  默认消费这个 proposal-equivalent handoff，并补齐 `design / tasks / planning-time doubt points`
- 若用户跳过 brainstorm 直接进入 plan
  planner 可以先生成一个 `provisional proposal` 作为输入归一化层，但必须明确标记其来源是“用户输入直达”，而不是让 planning 静默接管产品澄清

唯一真源约束：

- 若存在 `docs/brainstorms/*-requirements.md`，其中的 requirements / brief 是 `proposal` 的唯一真源
- `docs/plans/*.md` 中的 `proposal` section 只是 handoff 的只读投影或归一化摘录，不得反向成为 WHAT 层 source-of-truth
- 若 `proposal` 投影与 requirements 文档不一致，应以 requirements 文档为准，并要求 planner 重新同步投影
- 只有在 direct-to-plan 场景下，plan 内的 `provisional proposal` 才临时承担唯一真源；一旦后续补写 brainstorm 产物，应迁移真源并将 plan 中对应 section 降为投影

也就是说，`proposal` 可以成为 Spec Runtime 的第一层中间表示，但它不应因此回收 `brainstorm = WHAT，plan = HOW` 的基本分工。

它的意义在于：

- Spec 成为真正的执行入口，而不是附属文档
- 不确定性可以在 proposal 后被显式暴露
- work 不再承担需求澄清的职责
- review / compound 能沿着同一条 spec lineage 回溯

### 5.6 双路召回与渐进式披露

Shared knowledge 的消费方式也要工程化，而不是继续堆大 prompt。

建议两条机制同时成立：

1. `双路召回`
   - 语义召回：回答“可能该看什么”
   - 索引导航式召回：回答“准确去哪里”
2. `渐进式披露`
   - proposal 阶段只加载 proposal 所需知识
   - design 阶段再加载 design template、历史决策、验证约束
   - work 阶段再加载 implementation skill、preflight、verify 映射

后续如果 runtime 层支持 hook，还应把“阶段结束后的必做动作”从长 prompt 挪到 hook / skill 触发上，避免指令膨胀。

### 5.7 `spec-brainstorm` 与 `spec-ideate` 的轻量接入

虽然本方案重点改造的是 bootstrap / plan / work / review / compound，但上游的 brainstorm 与 ideate 不能继续做成“脱离项目现实的自由发挥层”。

它们应共享同一套轻量入口：

- `instruction-context`
  提供不可违反的关键约束与 quick links
- `repo summary`
  提供系统职责、边界与主要模块
- `pitfalls / pattern maturity`
  帮助判断某个方向是高风险、低价值，还是高 ROI 缺口

建议约定：

1. `spec-brainstorm`
   - Standard / Deep 模式先读取 `instruction-context` 的关键约束
   - 仅当话题涉及新模块、跨层调用、新依赖、新公共接口时，再按需加载 `system-overview.md`、`pitfalls/index.md`
   - 输出 proposal 时，显式标记“本次方案受哪些现有约束影响”
   - requirements 文档或其摘要应被视为 `proposal-equivalent handoff`，供后续 `spec-plan` 消费
2. `spec-ideate`
   - Quick scan 先看 `00-summary.md`、`pitfalls/index.md`、patterns 覆盖情况
   - 优先提出“补 pattern / 补 knowledge points / 补 verify / 补 routing”的高 ROI 改进，而不只提新功能

降级要求：

- 若 bootstrap 资产不存在，这两个 skill 不得静默失败，也不得隐式把 bootstrap 变成强前置
- 最低可用降级路径应为：读取当前 instruction file -> 做轻量 repo scan -> 明确提示“建议先运行 spec-graph-bootstrap”
- 只有在话题确实需要架构级上下文时，才把“缺 bootstrap 资产”升级成显式风险提示

这样可以把上游探索约束在真实项目条件内，同时避免一开始就加载全量上下文。

### 5.8 `Greenfield Mode` 与 `Brownfield Mode`

当前方案必须明确支持两类不同场景，而不是只为存量仓库优化：

- `Greenfield Mode`
  面向 `0-1` 新项目或代码资产极少的新模块
- `Brownfield Mode`
  面向 `1-10-100` 阶段的持续迭代项目、已有复杂上下文的老仓库

两者共享同一条主链：

```text
ideate -> brainstorm -> plan -> work -> review -> compound
```

但默认策略不同。

#### `Greenfield Mode`

主要问题不是“怎么贴着现有代码改”，而是：

- 先把目标、边界、疑问点和架构约束讲清楚
- 在缺少本地 reference 时，优先使用 template / starter pattern / platform pattern
- 先生成最小可运行骨架，再通过 review / compound 慢慢积累 reference 与经验

默认策略应为：

1. 上游 handoff 更强调 `proposal / doubt points`，`spec-plan` 重点消费 proposal 并补齐 `design / tasks`
2. `spec-work` 在本地 reference 稀缺时优先 `template-first`，而不是把“找不到参考”当成异常
3. `verify` 先覆盖骨架正确性、基本可运行性与关键约束，不追求一开始就拥有存量项目级别的 pattern richness
4. `spec-graph-bootstrap` 在此场景下更偏“初始化上下文、约束、starter assets”，而不是 repo mining

#### `Brownfield Mode`

主要问题不是“从零搭骨架”，而是：

- 不破坏既有结构
- 尽量复用现有模式
- 在复杂依赖和历史决策里降低返工

默认策略应为：

1. `spec-graph-bootstrap` 优先生成 `analysis.json`、`reference-index.json`、`verify-hints.json`、`pitfalls`
2. `spec-plan` 更强调 `References / Historical Analogs / Differences / Structural Constraints`
3. `spec-work` 默认走 `reference-first + preflight-first`
4. `spec-code-review` 与 `spec-compound` 更强调 pattern、pitfall、failure 的回流复用

一句话：

- `Greenfield Mode` 的核心是 `spec-first + architecture-first + template-first`
- `Brownfield Mode` 的核心是 `reference-first + history-first + preflight-first`

这样做的意义是：

- 不把 `0-1` 场景继续挂在“降级路径”名下
- 不让所有设计默认以“仓库里已有成熟参考代码”为前提
- 让后续实现可以按场景提供不同的默认策略，而不是靠 prompt 临时猜测

---

## 6. Stage-0：spec-graph-bootstrap 改造方案

`spec-graph-bootstrap` 的新职责不是“写更多 Markdown”，而是：

- 继续生成长期上下文文档
- 同时生成下游可消费的结构化资产
- 优先帮助下游找到 reference，而不是只给抽象描述
- 为 repo-local 知识源、历史 spec 与 runtime-managed knowledge packs 建立绑定关系

它管理的两类产物关系如下：

- `docs/contexts/<slug>/`
  面向人类阅读与长期浏览的上下文文档
- `.context/spec-first/bootstrap/<slug>/analysis/*`
  面向 workflow 消费的结构化控制面资产

两者共享同一个 `slug`，但职责不同：

- `docs/contexts/<slug>/` 是文档层 source of truth
- `.context/.../analysis/*` 是运行时索引与投影，不应反向当成文档主存储

### 6.1 保持 supporting workflow 定位

文档层面要明确写死：

- `spec-graph-bootstrap` 是推荐先跑的 Stage-0
- 它增强下游 workflow，但不是硬依赖
- `spec-work` 必须支持无 bootstrap 资产时的降级运行

这是本方案和上一版最大的收敛点。

同时必须明确：Stage-0 存在两套不同的 contract，而不是一套 brownfield bootstrap 兼容所有场景。

- `Brownfield bootstrap contract`
  重点是 repo mining、reference discovery、pitfall extraction、verified hints
- `Greenfield bootstrap contract`
  重点是初始化 starter context、模板索引、最小架构约束、初始 verify skeleton

后文 `6.2 ~ 6.7` 描述的是 brownfield-default 产物形态；对于 greenfield，应允许生成“初始化型”而不是“分析型”资产，只要下游能稳定消费即可。

### 6.2 新增 `analysis.json`

路径：

`.context/spec-first/bootstrap/<slug>/analysis/analysis.json`

建议结构：

```json
{
  "schema_version": "1.0",
  "slug": "target-project",
  "project_state": "brownfield",
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

Greenfield 下也应允许生成同名资产，但语义不同：

- `project_state` 应显式标记为 `greenfield`
- 可记录选定 starter stack、目标模块边界、预期入口点、初始 build/test/verify 命令
- 若仓库里尚无稳定框架文件、成熟目录或真实运行命令，不应把这些空缺当成失败

作用：

- 避免下游每次从 Markdown 反解析
- 为 `verify-hints` 和 `instruction-context` 提供结构化输入
- 为 Reduced-harness 模式定义“缺什么”
- 为后续 `knowledge/sources.json` 生成提供 repo 指纹

### 6.3 新增 `reference-index.json`

路径：

`.context/spec-first/bootstrap/<slug>/analysis/reference-index.json`

这是第一阶段必须落地的新增资产。

建议结构：

```json
{
  "schema_version": "1.0",
  "generated_at": "2026-04-04T02:00:00Z",
  "references": [
    {
      "kind": "page",
      "path": "app/users/page.tsx",
      "reason": "closest list page with server data loading",
      "confidence": 0.83,
      "quality_status": "validated",
      "quality_signals": ["has-test", "recently-reused"]
    },
    {
      "kind": "service",
      "path": "src/server/users/service.ts",
      "reason": "closest CRUD service",
      "confidence": 0.78,
      "quality_status": "candidate",
      "quality_signals": ["same-domain"]
    },
    {
      "kind": "test",
      "path": "tests/integration/users-flow.test.ts",
      "reason": "closest end-to-end flow",
      "confidence": 0.74,
      "quality_status": "validated",
      "quality_signals": ["is-test-anchor"]
    }
  ]
}
```

要求：

- 每条 reference 都要有 `reason`
- 只能推荐真实存在且可打开的路径
- 优先推荐“值得复用”的实现，不是简单列举搜索结果
- 每条 reference 都应至少带最小质量门字段：
  - `quality_status`
    首版建议只区分 `candidate` 与 `validated`
  - `quality_signals`
    记录它为什么值得优先参考，而不是只给一个分数

`confidence` 字段的含义也要限定：

- 它是排序与筛选分数，不是概率承诺
- 首版应来自启发式证据组合，而不是纯 LLM 自报
- 建议至少综合：
  - 目录/文件结构相似度
  - 功能角色匹配度
  - 是否包含测试或验证资产
  - 是否被近期实现或历史 decision notes 复用
- 下游可用它排序，但不得仅凭 `confidence` 决定是否允许实现

`quality_status` 的最小语义：

- `candidate`
  仅表示“相似且可能有用”，不代表已经被证明是好模式
- `validated`
  表示至少满足下面任一条件：
  - 有相邻测试或验证资产支撑
  - 被近期实现、decision note 或 review 明确复用过
  - 被人工确认应作为优先参考

下游消费规则：

- `spec-plan` 默认优先引用 `validated` reference；若只能找到 `candidate`，必须显式写出“候选参考，需谨慎偏离/复用”
- `spec-work` 可以读取 `candidate` 作为搜索锚点，但不得把它当成“推荐照抄”的强信号
- `spec-code-review` 与 `spec-improve` 只产出 reference 质量更新提案，不直接静默改写 `reference-index.json`

同时建议投影出人类可读版：

`docs/contexts/<slug>/patterns/index.md`

Greenfield 下的 `reference-index.json` 也应被允许主要指向：

- starter / template references
- platform pattern references
- cross-project reusable examples

而不是强制要求它主要来自当前仓库本地代码。

### 6.4 新增 `instruction-context`

路径：

- `.context/spec-first/bootstrap/<slug>/analysis/instruction-context.json`
- `.context/spec-first/bootstrap/<slug>/analysis/instruction-context.md`

关键约束：

- `spec-graph-bootstrap` 只产出内容
- 绝不直接改 repo-root `CLAUDE.md` / `AGENTS.md`

建议结构：

```json
{
  "schema_version": "1.0",
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

`sync-instruction` 的最小契约应明确为：

- 输入
  `adapter`、`project_root`、`instruction-context.json`
- 定位
  仅通过 adapter 决定目标文件，Claude 写 `CLAUDE.md`，Codex 写 `AGENTS.md`
- 写入方式
  只 upsert 受管理区块，例如：
  `<!-- spec-first:context:start -->` / `<!-- spec-first:context:end -->`
- 幂等性
  多次执行只替换 managed block，不改动用户手写内容
- 冲突处理
  若 managed block 之外存在疑似重复内容，只告警不自动合并
- 失败恢复
  写入前备份，写入失败或校验失败时回滚

### 6.5 新增 `verify-hints.json`

路径：

`.context/spec-first/bootstrap/<slug>/analysis/verify-hints.json`

建议结构：

```json
{
  "schema_version": "1.0",
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

Greenfield 下的 hint 来源也应单独说明：

- 可以来自选定 starter architecture、模板约束、人工确认的初始模块边界
- 不应因为缺少本地历史代码，就退化为完全没有结构性提示

### 6.6 新增知识源绑定与检索策略初始化

`spec-graph-bootstrap` 不负责直接构建完整共享知识库，但负责初始化 repo-local 的知识路由上下文。

建议新增两个产物：

- `.context/spec-first/knowledge/sources.json`
- `.context/spec-first/knowledge/points.json`
- `.context/spec-first/knowledge/retrieval-policy.json`

其中至少包含：

- 当前 repo slug、语言、框架、模块特征
- 当前 repo 的 `docs/contexts/<slug>/` 路径
- 当前 repo 的 history spec 索引入口
- 当前 repo 的初始 knowledge points 或空集合占位
- 可选的 domain/platform pack 标识
- 默认检索优先级

这样后续 `plan/work/review/compound` 就不需要自己猜“该查哪些知识源”。

### 6.7 Assembly verify 与 trace 建模

这里的 `Assembly` 专指 `spec-graph-bootstrap` orchestrator 汇总 worker 产物、写入最终文档和结构化资产的阶段。

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

Greenfield 下的 Assembly verify 也应改成“初始化资产校验”，重点检查：

1. starter / template references 是否可用
2. 选定架构边界、入口点、命令声明是否自洽
3. `instruction-context`、`verify-hints`、初始 patterns 是否彼此一致

而不是继续沿用 brownfield 的“从现有仓库中发现并核验”心智。

---

## 7. 规划面：spec-plan 改造方案

上一版方案缺了 `spec-plan`，这是不完整的。

如果没有 plan 层承接 reference-first 语义，`spec-work` 很容易重新退回“读需求然后原创实现”。

### 7.1 改造目标

让 `spec-plan` 从“技术说明文档”升级为 `proposal -> design -> tasks` 的 Spec Runtime 入口。

它要回答的核心问题变成：

1. 上游 proposal / requirements 还缺哪些 planning-relevant 澄清
2. design 阶段优先参考哪些现有实现
3. 本次与 reference 相比差在哪
4. 哪些结构性规则不能破
5. 这次准备怎么验证

### 7.2 三段式 Spec 结构

### `proposal.md`

负责明确：

- 业务目标
- 范围边界
- 影响面
- 需要用户补充的疑问点

所有权约束：

- 默认由 `spec-brainstorm` 的 requirements 文档或其摘要承担
- `spec-plan` 默认是读取、保留、归一化这个 proposal，而不是重新发明一份 WHAT 文档
- 只有当用户跳过 brainstorm 直达 plan 时，planner 才能生成 `provisional proposal`
- 若已存在 requirements 文档，plan 中的 `proposal` section 只能做只读投影 / 归一化摘录，不得独立演化

### `design.md`

负责明确：

- 参考实现
- 结构性约束
- 技术决策
- 验证映射

### `tasks.md`

负责明确：

- 实施步骤
- 验证顺序
- 交付检查点

这三者不是三份随意拆开的文档，而是一个逐步收敛的 Spec。

首版存储契约需要明确收敛，避免和当前单文件 `plan.md` 体系冲突：

- Phase 1 推荐继续保留当前主入口：`docs/plans/YYYY-MM-DD-NNN-<type>-<name>-plan.md`
- `proposal / design / tasks / doubt points` 先作为这个 plan 文档中的一级 section 落盘
- 只有在 command template、handoff、review 引用方式都完成迁移后，才考虑升级为目录形态

也就是说，三段式 Spec 在第一阶段首先是“结构契约”，不是立刻把当前 plan 产物改成三份独立文件。

但其角色仍需区分：

- `proposal` section 更像 handoff preservation / normalization
- `design / tasks` section 才是 planning 的真正主责任区
- `proposal` section 若被人工修改，必须同时回写唯一真源或显式拒绝修改，不能默许双向漂移

### 7.3 design / tasks 标准字段

### `References`

列出最像的页面、route、service、test、command。

要求区分两类来源：

- `code references`
- `historical analogs`

若当前处于 `Greenfield Mode` 且本地可复用 reference 稀缺，还应显式补充第三类来源：

- `starter / template references`

也就是说，`spec-plan` 不应把“找不到强本地 reference”直接等同于无参考可用，而应优先查找平台骨架、starter pattern、跨项目可迁移的基础实现。

还应显式区分 reference 质量：

- `validated references`
  默认优先引用，可作为 design / tasks 的主要锚点
- `candidate references`
  只能作为搜索锚点或备选模式，plan 中应明确其不确定性

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

### 7.4 禁止事项

Plan 不应：

- 内联大段样板代码
- 重新复写完整实现
- 在没有 reference 时假装已经找到最优模式

当仓库里找不到可用 reference 时，应显式写出：

- `No strong local reference found`
- 若处于 `Greenfield Mode`，优先改查 `starter / template references`
- 若处于 `Brownfield Mode`，再由 `spec-work` 在实现前扩大 repo 搜索范围

### 7.5 新增 Historical Analogs

`spec-plan` 不应只找“相似代码”，还应优先找“相似历史需求 / 相似历史 SPEC”。

原因：

- 相似代码告诉 Agent “代码长什么样”
- 相似历史需求告诉 Agent “为什么这样写”

建议从：

- `.context/spec-first/knowledge/history-spec-index.json`
- `.context/spec-first/history/*/decision-notes.md`
- `docs/plans/`
- 与当前需求有关的历史 review / compound 产物

中提取候选 analog，并在 plan 中显式写出：

- 为什么这条历史需求相关
- 哪个设计决策值得复用
- 哪个验证路径值得延续

### 7.6 新增疑问点机制

异步 spec 生成链路里，最容易浪费时间的不是“写不出方案”，而是“带着错误假设把方案写完了”。

因此 proposal 阶段应允许 Agent 输出结构化 `doubt points`，例如：

- 需求改动范围不清
- 功能入口代码位置不明
- 依赖哪个系统或接口不明确
- 验证口径不完整

这些疑问点必须在 design / work 前被显式消费：

- 用户补充
- 选择忽略并记录假设
- 转化为后续风险提示

这会把“生成后返工”前移成“生成前对齐”。

---

## 8. 执行面：spec-work 改造方案

`spec-work` 是收益最高的改造点，因为它直接决定返工率和采纳率。

### 8.1 双模式运行

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
- 输出提示：建议先运行 `spec-graph-bootstrap`

关键要求：

- 退化是显式的，不允许静默退化

场景映射应再补一层：

- `Brownfield Mode`
  默认优先进入 `Harness-enabled`，因为它最依赖 bootstrap 资产、reference 密度与结构性预检
- `Greenfield Mode`
  可以从 `Reduced-harness` 起步，但不应只理解成“少了几个资产的弱化版”

对 `Greenfield Mode`，`spec-work` 还应额外遵守：

1. 本地 reference 稀缺时优先 `template-first`
2. preflight 优先保护目录、入口、公共接口与最小架构边界
3. verification 优先确认“骨架正确、主链可运行、关键约束未破坏”

这样 `Reduced-harness` 才是运行态降级语义，而 `Greenfield Mode` 是产品层的一等场景语义。

### 8.2 Complexity Gate

满足任一条件即视为中复杂度及以上：

- 影响 3 个及以上非测试文件
- 涉及 2 个及以上 implementation units
- 涉及 public API、权限、数据持久化、回滚、并发
- 没有 checklist 就无法完成

行为：

- 低复杂度：允许 inline
- 中复杂度：主控优先 subagent，不直接写主实现
- 高复杂度：必须 subagent，必要时 worktree

### 8.3 Reference-first 执行链

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

### 8.4 Preflight Verify Action

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

`INVALID` 的处置逻辑也要固定：

1. 默认行为
   阻断当前结构性动作，不允许静默继续
2. 允许的后续路径
   - 修改方案后重新跑 preflight
   - 请求用户显式确认 override
   - 放弃该动作并回退到安全方案
3. override 规则
   只有在用户明确接受风险，或上游 design 已记录 waiver 时才允许 override
4. 持久化要求
   所有 override 必须写入 `preflight.json`，至少记录：
   `reason`、`confirmed_by`、`timestamp`、`related_rule`

也就是说，`INVALID` 是一个需要显式决策的阻断状态，而不是普通 warning。

### 8.5 统一验证链与持久化

验证链统一为：

```text
build -> lint-arch -> test -> verify
```

持久化路径：

`.context/spec-first/work/<run-id>/verification.json`

建议结构：

```json
{
  "schema_version": "1.0",
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

### 8.6 新增 Signals 持久化

为了支撑后续“信号驱动知识沉淀”，`spec-work` 应在不引入重型遥测的前提下，先持久化最基础的运行信号：

路径：

`.context/spec-first/work/<run-id>/signals.json`

建议收集：

- preflight `WARN` 次数
- build/test/verify 失败后再成功的次数
- 同类验证失败的重复出现
- 因 reference 缺失而触发的扩展搜索
- 需要人工 override 的结构性动作

这些信号本身不是知识，只是“是否值得提炼知识”的候选线索。

### 8.7 新增 Decision Notes / Track 持久化

仅有 `proposal / design / tasks` 还不够。

很多真正影响后续维护质量的信息，并不会体现在设计文档本身，而是体现在执行后的非显而易见决策里，例如：

- 为什么最终选了 A 而不是 design 里原先写的 B
- 为什么某个模块必须拆成 4 个文件而不是 2 个
- 为什么某段逻辑看似重复，实际上是在兼容既有约束

因此 `spec-work` 在以下场景应追加写入 decision notes：

- 实际实现与 `design` 部分存在重要偏差
- 发现了新的强约束或隐藏依赖
- 复用了某个 reference，但复用理由与边界值得后续继续保留

建议路径：

`.context/spec-first/history/<spec-id>/decision-notes.md`

建议结构：

```markdown
---
spec_id: order-list
source_plan: docs/plans/2026-04-04-001-feature-order-list-plan.md
source_section: design
executed_at: 2026-04-04
---

## Key Decisions
- 选用 `useProTableRequest` 而不是手写 `useState`，因为这是当前 repo 的稳定列表页模式
- 文件拆分为 4 个模块，原因是权限逻辑与表格渲染职责分离后更符合既有 pattern

## Deviations From Design
- design 部分原计划复用 ComponentA，实际改为 ComponentB，因为前者已进入 deprecated path

## Reference Notes
- 主要参照：`app/orders/page.tsx`
- 未沿用其筛选栏实现，因为本次多了批量操作与状态聚合
```

`history-spec-index.json` 应索引到这些 notes 及其 `source_plan` / `source_section`，后续 `spec-plan` 在做 Historical Analogs 时就不只知道“当时怎么做”，也知道“为什么这样做”。

---

## 9. 评审面：spec-code-review 改造方案

### 9.1 改造目标

让 `spec-code-review` 同时承担三件事：

1. 找出当前 diff 的风险
2. 提炼可回流的规则候选
3. 提炼可复用的样板候选

### 9.2 新增双候选输出

目录统一为：

`.context/spec-first/spec-code-review/<run-id>/`

新增：

- `rule-candidates.json`
- `pattern-candidates.json`

示例：

```json
{
  "schema_version": "1.0",
  "generated_at": "2026-04-04T02:00:00Z",
  "candidates": [
    {
      "candidate_type": "rule",
      "source_finding": "review-123-p1",
      "pattern": "public API endpoint missing auth guard",
      "suggested_target": "lint-arch / verify",
      "suggested_destination": "domain-pack",
      "confidence": 0.72
    }
  ]
}
```

```json
{
  "schema_version": "1.0",
  "generated_at": "2026-04-04T02:00:00Z",
  "candidates": [
    {
      "candidate_type": "pattern",
      "source_finding": "review-123-p2",
      "path": "src/server/base-crud-service.ts",
      "reason": "reused successfully across multiple endpoint implementations",
      "suggested_destination": "repo-pattern-memory",
      "confidence": 0.68
    }
  ]
}
```

### 9.3 回流门槛

只有同时满足以下条件的 finding 才能进入 candidate：

- 可重复
- 可抽象
- 不强依赖某次业务上下文
- 有足够证据支撑

`autofix` 解决当前问题；
candidate 解决下次更少犯、或更少原创。

每个 candidate 最好额外带上 `suggested_destination`，后续才能知道它是应该：

- 回流到 domain knowledge
- 回流到 platform docs feedback
- 进入 repo pattern memory
- 进入 failure memory

### 9.3.1 快速更新提案通道

仅靠 `compound -> improve` 长链路回流还不够。

当 review 发现的是“高危、明确、且后续极可能再次发生”的问题时，应允许先产出快速更新提案，而不是等到完整知识沉淀周期结束。

建议新增：

- `.context/spec-first/spec-code-review/<run-id>/fast-track-proposals.json`

适用条件建议为同时满足：

- finding 严重度高，或直接命中 `high_risk_areas`
- 证据明确，不依赖模糊业务解释
- 有清晰的建议落点
- 若不尽快更新，下次很可能重复出现

首版允许的提案类型应尽量收窄：

- `verify-hint-update-proposal`
- `instruction-context-update-proposal`
- `reference-quality-update-proposal`
- `pitfall-entry-update-proposal`

约束：

- 它是 `proposal`，不是自动写回
- `spec-code-review` 只负责提出“建议改什么、为什么、证据是什么、建议写到哪里”
- 真正写回仍应由人工确认，或在后续 `spec-compound` / `spec-improve` 中显式采纳
- 若提案未被采纳，不得静默修改任何主资产

建议结构：

```json
{
  "schema_version": "1.0",
  "generated_at": "2026-04-04T02:00:00Z",
  "proposals": [
    {
      "proposal_type": "verify-hint-update-proposal",
      "source_finding": "review-123-p1",
      "target_asset": ".context/spec-first/bootstrap/<slug>/analysis/verify-hints.json",
      "reason": "same missing auth guard recurred in high-risk area",
      "evidence": [
        "current diff touched src/server/auth",
        "preflight emitted WARN on public endpoint guard",
        "pitfalls-specialist confirmed repeated anti-pattern"
      ],
      "human_action_required": true
    }
  ]
}
```

这条短回路的价值在于：

- 高价值风险不用等到完整 compound 周期后才被看见
- 但系统仍保持“建议优先、人工采纳、禁止静默写回”的总原则

### 9.4 新增专项 reviewer 路由

除通用 reviewer 外，`spec-code-review` 还应支持根据 bootstrap 与 knowledge 资产触发专项 reviewer。

首个高价值专项 reviewer 建议就是：

- `pitfalls-specialist`

触发条件建议为：

- `pitfalls/index.md` 存在
- 本次 diff 触达 `instruction-context` 里的 `high_risk_areas`
  或命中 `pitfalls/index.md` 中记录的高风险模块 / 反模式

输入建议包括：

- `pitfalls/index.md`
- `verify-hints.json`
- `instruction-context` 中的关键约束与高风险区域
- `preflight.json` / `verification.json` 中与该区域相关的 warning

输出重点不是重复通用 findings，而是回答：

- 本次修改是否命中了已知风险
- 是否再次引入了历史上出现过的反模式
- 当前风险是应立即修复、允许接受，还是应升级为新规则候选

这样可以把旧文档里“pitfalls 专项检查”的优点保留下来，同时接到当前更通用的 candidate / routing 模型上。

对于 review candidate 中的 `confidence`，也应沿用“排序分数而非概率”的解释：

- 可由 reviewer 共识、证据强度、重复命中次数共同决定
- 可用于路由优先级，但不得单独替代证据本身

---

## 10. 知识面：spec-compound 改造方案

`spec-compound` 不应只写 `docs/solutions/`，还要为长期演进提供 pattern 与 procedure。

### 10.1 四类记忆模型

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

### 10.2 从“人工总结”扩展到“信号驱动沉淀”

`spec-compound` 不应只在“用户明确要求写总结”时工作。

第二阶段开始，它应优先消费这些上游信号：

- `work/signals.json`
- `work/verification.json`
- `spec-code-review/rule-candidates.json`
- `spec-code-review/pattern-candidates.json`
- bootstrap `verify-warnings.json`

目标不是自动写一堆文档，而是先做两步：

1. 判断这次是否存在值得沉淀的经验
2. 判断这条经验该路由到哪里

建议的路由目标：

- `solution memory`
- `procedure memory`
- `pattern memory`
- `failure memory`
- `platform-doc-feedback`
- `domain-pack-update`

这一步非常关键，因为它决定 `spec-first` 是“文档越来越多”，还是“知识越来越会回到正确源头”。

### 10.3 automation candidates

当同类流程多次成功且步骤稳定时，可产出：

```json
{
  "schema_version": "1.0",
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

### 11.1 定位

第三阶段新增 `spec-improve`，职责是：

1. 读取 bootstrap / work / review / compound / memory / trace
2. 评估 agent-readiness
3. 输出 Highest ROI gaps
4. 输出模板建议、rule / pattern 汇总提案、knowledge routing 建议与内容源更新提案

默认约束：

- `spec-improve` 默认是 auditor / proposer，不是自动 writer
- 首版允许写出的应是报告、提案、汇总索引，不是静默改写主资产
- 若未来需要自动写回，必须由单独 capability 明确声明目标资产、权限边界与回滚策略

### 11.2 评分维度

建议至少包含六项：

1. `instruction_readiness`
2. `context_readiness`
3. `reference_readiness`
4. `knowledge_ops_readiness`
5. `verification_readiness`
6. `feedback_loop_readiness`

### 11.3 输出形式

```markdown
# Agent Readiness Audit

- Instruction Readiness: 72
- Context Readiness: 85
- Reference Readiness: 39
- Knowledge Ops Readiness: 34
- Verification Readiness: 41
- Feedback Loop Readiness: 33

## Highest ROI Gaps
- Missing reference index for common task families
- No shared knowledge routing between repo/domain/platform sources
- No structural preflight in work phase
- Review findings are not compiled into reusable rules or patterns
```

### 11.4 运营指标与物料质量度量

除 readiness 评分外，还应增加一组更贴近日常使用质量的运营指标。

建议至少跟踪：

1. `bootstrap_context_hit_rate`
   有多少次 brainstorm / plan / ideate / work 实际命中了 bootstrap 资产
2. `reference_anchor_rate`
   `spec-work` 中有多少 implementation units 在写代码前成功找到了 reference anchor
3. `inline_template_ratio`
   `spec-plan` 中内联样板代码或过长实现描述的占比，越低越好
4. `doubt_resolution_rate`
   `doubt points` 中有多少在进入 work 前被真正消化，而不是被忽略
5. `pitfalls_hit_rate`
   专项 reviewer 或 review 流程有多少次成功命中了已知 pitfall
6. `pitfalls_action_rate`
   命中 pitfall 后有多少真的引发了修正，而不是沦为噪音
7. `decision_note_reuse_rate`
   历史 `decision-notes.md` 在后续 plan / review / work 中被引用的频率
8. `rewrite_ratio`
   最终实现中“直接基于 reference 改造”的比例，与“从零原创”的比例

建议的数据来源也要同步定义：

- `bootstrap_context_hit_rate` 来自 brainstorm / plan / ideate / work 的 run metadata
- `reference_anchor_rate`、`rewrite_ratio` 来自 `work/<run-id>/meta.json` 与 `decision-notes.md`
- `doubt_resolution_rate` 来自 plan 文档中的 doubt points 状态字段
- `pitfalls_hit_rate`、`pitfalls_action_rate` 来自 `spec-code-review/<run-id>/findings.json` 与 candidate 结果
- `decision_note_reuse_rate` 来自 `history-spec-index.json` 的引用记录

计算责任也应固定：

- 各 workflow 负责写原始信号与 metadata
- `spec-improve` 负责读取这些原始数据并汇总成指标
- 第三阶段前不要求实时仪表盘，只要求原始数据足够支撑离线计算

### 11.4.1 Outcome Metrics

除过程代理指标外，还应至少补一组结果型指标，避免系统只会优化“看起来像有效”的中间信号。

建议首版最少包含：

1. `first_pass_success_rate`
   一条需求在首次 `spec-work -> spec-code-review` 循环后，无需重大返工即可进入可接受状态的比例
2. `spec_to_review_lead_time`
   从 stable `spec_id` 建立到首轮 review 完成的耗时
3. `blocking_finding_density`
   每次 review 中阻断级 finding 的密度，观察其是否随 reference / preflight / hint 质量提升而下降
4. `post_plan_rework_count`
   plan 产出后，因 WHAT/HOW 不清、reference 误选、结构假设错误而触发的重大返工次数

建议数据来源：

- `first_pass_success_rate`
  来自 `work/<run-id>/verification.json`、`spec-code-review/<run-id>/findings.json` 与后续是否追加大规模 rework 的 metadata
- `spec_to_review_lead_time`
  来自 `spec_id` 对应 plan/work/review 的时间戳
- `blocking_finding_density`
  来自 `spec-code-review/<run-id>/findings.json` 的严重度统计
- `post_plan_rework_count`
  来自 `decision-notes.md` 中的重大偏差、review finding 与后续 rerun 记录

解释原则：

- outcome metrics 不替代过程指标，而是校验过程指标是否真的带来了更好的交付结果
- 若过程指标变好而 outcome metrics 无改善，应优先怀疑指标代理失真，而不是继续堆更多过程治理

这组指标的意义不是做仪表盘好看，而是判断：

- pattern 体系是否真的在被用
- shared knowledge 是否真的减少了重复分析
- Spec Runtime 是否真的减少了返工与错误假设

---

## 12. 需要改动的资产

### 12.1 Skill / prompt 资产

- `skills/spec-graph-bootstrap/SKILL.md`
- `skills/spec-brainstorm/SKILL.md`
- `skills/spec-graph-bootstrap/references/prd-template.md`
- `skills/spec-graph-bootstrap/references/database-prd-template.md`
- `skills/spec-plan/SKILL.md`
- `skills/spec-work/SKILL.md`
- `skills/spec-code-review/SKILL.md`
- `skills/spec-compound/SKILL.md`
- `skills/spec-ideate/SKILL.md`

说明：

- `spec-work-beta` 当前仍是实验分支，本轮主方案默认先收敛稳定版 `spec-work`
- 待稳定版 contract 落地后，再决定是镜像到 beta，还是以 beta 反向替换 stable

### 12.2 文档层

- `docs/05-用户手册/02-核心概念.md`
- `docs/01-需求分析/4.五阶段工作流详解.md`
- 与 bootstrap / work / review / compound 相关的需求分析文档

### 12.3 CLI / runtime 层

若进入实现，需要至少考虑：

- `src/cli/commands/init.js`
- `src/cli/lang-policy.js`
- `src/cli/commands/doctor.js`
- `src/cli/state.js`

其中 `init` 或其共享 helper 需要承担 `sync-instruction` writer 角色。

如果进入 shared knowledge 能力实现，还需要考虑：

- runtime-managed knowledge packs 的目录与索引格式
- 可选 MCP / remote source 的 source descriptor
- `doctor` 对 knowledge routing 与 source health 的诊断输出
- Spec Runtime 各阶段产物的存储、版本与 lineage 追踪

---

## 13. 实施分期

### 13.1 第一阶段：高 ROI 基础改造

范围：

1. `spec-graph-bootstrap` 新增 `analysis.json`
2. `spec-graph-bootstrap` 新增 `reference-index.json`
3. `spec-graph-bootstrap` 新增 `verify-hints.json`
4. `spec-graph-bootstrap` 新增 `instruction-context.json/.md`
5. `spec-graph-bootstrap` 初始化 `knowledge/sources.json`、`points.json` 与 `retrieval-policy.json`
6. `spec-plan` 收敛为 `proposal -> design -> tasks`
7. `spec-plan` 新增 `References / Differences / Structural Constraints / Verification Mapping`
8. `spec-plan` 引入 `Historical Analogs`
9. `spec-plan` 新增 `doubt points`
10. `spec-brainstorm` 与 `spec-ideate` 建立轻量 context scan 入口
11. `spec-work` 新增 `Harness-enabled / Reduced-harness`
12. `spec-work` 新增 `meta.json`、preflight、`verification.json` 与 `signals.json`

预期收益：

- reference-first 路线具备最小闭环
- bootstrap 不再只是“读物生成器”
- work 在无 bootstrap 时也有明确降级行为
- repo-local 知识源与检索策略具备统一入口
- Spec 开始成为执行入口，而不是附属文档
- brainstorm / ideate 不再是脱离项目现实的上游自由发挥层
- `0-1` 新项目具备 `spec-first + template-first` 的可用起步路径
- 存量项目具备 `reference-first + preflight-first` 的最小闭环

### 13.2 第二阶段：反馈回流与记忆增强

范围：

1. `spec-code-review` 输出 `meta.json`
2. `spec-code-review` 输出 `rule-candidates.json`
3. `spec-code-review` 输出 `pattern-candidates.json`
4. `spec-code-review` candidate 增加 `suggested_destination`
5. Shared knowledge 引入双路召回
6. `spec-code-review` 增加专项 reviewer 路由
7. `spec-work` 新增 `decision-notes.md` 并接入 `history-spec-index.json`
8. `spec-compound` 新增 procedure / pattern / failure / automation candidates
9. `spec-compound` 消费 `work/review` 信号并做知识路由
10. bootstrap / work / review trace 统一建模
11. `history-spec-index.json` 打通沉淀与召回

预期收益：

- review 不再只是一次性判题
- compound 不再只记“怎么修”，还记“以后怎么抄、怎么防、该回流到哪里”
- proposal / design / tasks 与 shared knowledge 开始形成稳定联动
- 历史决策开始可被后续 plan / work / review 真正复用
- `Greenfield Mode` 开始从早期 starter/template 逐步积累出 repo-local reference
- `Brownfield Mode` 开始把历史决策、pattern 与 pitfalls 变成稳定复利

### 13.3 第三阶段：系统自进化

范围：

1. 新增 `spec-improve`
2. 引入 agent-readiness 评分
3. 基于 memory / trace / knowledge routing 编译 Highest ROI improvements

预期收益：

- `spec-first` 从 workflow 集合演进为持续优化的交付系统
- 两类场景都能逐步收敛为更明确的默认策略，而不是继续依赖经验型人工切换

---

## 14. 风险与缓解

### 14.1 风险：bootstrap 被误用成强前置

缓解：

- 文档明确 supporting workflow 定位
- `spec-work` 必须实现 `Reduced-harness`
- 缺失 bootstrap 资产时显式提示，不允许静默失败

### 14.2 风险：instruction file 所有权冲突

缓解：

- bootstrap 只产出 `instruction-context`
- repo-root instruction file 只由 runtime/CLI writer 更新
- writer 必须具备备份与恢复语义

### 14.3 风险：reference 索引变成无价值文件列表

缓解：

- 每条 reference 必须写 `reason`
- 只推荐可复用的“好模式”
- review 与 compound 可以反向修正 reference 候选

### 14.4 风险：把推断包装成规则

缓解：

- 所有 hint 标注 `evidence_level`
- `inferred-from-structure` 只能产生 `WARN`
- `INVALID` 仅来自已验证证据

### 14.5 风险：控制面过重

缓解：

- 第一阶段先做 `analysis + reference-index + verify-hints + reduced-harness`
- 第三阶段前不引入过重自动化

### 14.6 风险：知识源污染与错路由

缓解：

- 经验知识、平台知识、业务知识严格分层
- candidate 必须携带 `suggested_destination`
- 高频基础问题优先回流上游文档，而不是不断堆进经验库

### 14.7 风险：知识保鲜跟不上 AI 生成速度

缓解：

- 先做信号驱动候选提取，不要求全量人工维护
- 优先沉淀“高价值、可复用、能执行”的经验
- 第三阶段再用 `spec-improve` 持续识别 stale source 与高 ROI 修复点

### 14.8 风险：Spec Runtime 变成新的文档负担

缓解：

- `proposal / design / tasks` 必须承担不同职责，避免重复
- 疑问点只暴露不确定信息，不把所有风险都塞进去
- 渐进式披露，避免一次性加载全量模板和规则

### 14.9 风险：知识层先行，workflow 反而退居次要

缓解：

- 先验证知识设计是否真实改善 `plan / work / review` 的命中率与复用率
- 第一优先级始终是主链收益，而不是先做 packs、source registry 或中心化知识面板
- 若某项 knowledge 能力暂时不能证明对主链有直接收益，应延后到第二阶段或第三阶段

### 14.10 风险：greenfield 再次被误用为降级路径

缓解：

- 文档已显式区分 `Greenfield Mode` 与 `Reduced-harness`
- 后续实现必须给 `Greenfield Mode` 提供 `template-first / starter-pattern-first` 的一等支持
- 不能把“缺少 bootstrap/reference 资产”直接等同于“弱化模式”

### 14.11 风险：candidate / improve 被误实现为自动治理闭环

缓解：

- `rule-candidates`、`pattern-candidates` 默认只产生候选，不自动写回
- `spec-compound` 默认做路由建议，不静默覆盖人工维护内容
- `spec-improve` 默认输出建议与评分，不承担万能修复器角色
- 任何自动写回能力都必须具备证据、审批与回滚语义

### 14.12 风险：治理能力增长快于交付支持能力

缓解：

- `reference-index`、`pattern`、`starter/template references` 的建设优先级不得低于 guardrails
- 每次新增 preflight、verify、routing 规则时，都应检查是否同步增强了“怎么做对”的路径
- 若系统开始更频繁地产生 `WARN/INVALID`，却没有更强的 reference/template 支持，应视为偏航信号

### 14.13 风险：文档、控制面、prompt 演化成三套真相源

缓解：

- 文档层负责长期可读表达，控制面负责结构化消费，instruction file 负责最小导航与约束注入
- skill/runtime 不得绕过结构化资产长期维护另一套隐式规则
- 一旦发现同一约束需要在文档、JSON、prompt 中重复维护，应优先收敛到单一来源再投影

---

## 15. 验收标准

进入实现时，建议以以下结果验收：

1. `spec-graph-bootstrap` 运行后，除 `docs/contexts/<slug>/` 外，存在 `analysis.json`、`reference-index.json`、`verify-hints.json`、`instruction-context.json`
2. repo-local 存在 `.context/spec-first/knowledge/sources.json`、`points.json` 与 `retrieval-policy.json`
3. runtime 层能基于 `instruction-context` 更新 repo-root `CLAUDE.md` 或 `AGENTS.md`，且不破坏现有治理块
4. `spec-work` 在无 bootstrap 资产时仍可运行，并显式报告 `Reduced-harness`
5. `spec-plan` 能显式产出 `proposal / design / tasks`，并支持 `Historical Analogs` 与 `doubt points`
6. shared knowledge 同时支持语义召回与索引导航式召回
7. `spec-brainstorm` 与 `spec-ideate` 能通过轻量 context scan 消费 bootstrap / shared knowledge 入口
8. `spec-work` 能持久化 `meta.json`、`preflight.json`、`verification.json`、`signals.json` 与 `decision-notes.md`
9. `spec-code-review` 能持久化 `meta.json`，并同时输出 findings、rule candidates、pattern candidates，且 candidate 带 `suggested_destination`
10. `spec-code-review` 支持基于 pitfall / high-risk area 的专项 reviewer 路由
11. `spec-compound` 能沉淀 procedure / pattern / failure / automation candidates，并把候选路由到正确知识层
12. 第三阶段的 `spec-improve` 能输出 readiness 分数、物料质量指标与 Highest ROI gaps

---

## 16. 结论

这次修订后的路线与上一版相比，核心变化有六个：

1. 不再把 `spec-graph-bootstrap` 推向强前置，而是明确 supporting workflow + 可降级 harness
2. 不再让 bootstrap 直接写 instruction file，而是恢复单一 writer 语义
3. 不再只强调规则与验证，而是把 `reference-index` 和 pattern 资产提升为一等能力
4. 不再跳过 `spec-plan`，而是把它纳入 reference-first 主链
5. 不再把知识理解成 repo-local 文档，而是显式补上 shared knowledge substrate、知识路由和信号驱动沉淀
6. 不再把 plan 当成一张静态说明纸，而是把 `proposal / design / tasks / doubt points` 提升为 Spec Runtime

再加一条本轮新收敛的判断：

7. 不再默认所有需求开发都以“已有成熟仓库”为前提，而是显式区分 `Greenfield Mode` 与 `Brownfield Mode`

还要明确一个更高层的约束：

8. 不把方案实现成“knowledge-platform-first”或“control-heavy”的系统，而始终坚持 `workflow first`、`delivery gain first`

因此，本方案的最终判断是：

> `spec-first` 最优的演进方向，不是“更重的规则系统”，也不是“更长的上下文文档”，
> 而是一个同时覆盖 `0-1` 新项目与 `1-10-100` 存量迭代，让 Agent 先加载正确知识、再找参考或模板、再做预检、再写 glue code、再统一验证、最后把经验回流成规则、样板与知识源头的交付系统。

这条路径比单纯补 Harness 更稳，也比单纯补 Context 更有采纳率；它把 `spec-first` 从 repo-level SDD 骨架，推进到具备团队知识运营潜力的 Agent 交付系统，更符合你现在通过几篇业界实践文档收敛出的方向。
