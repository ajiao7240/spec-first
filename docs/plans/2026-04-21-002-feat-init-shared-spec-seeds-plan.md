---
title: init 阶段共享 spec seed 初始化计划
created: 2026-04-21
status: completed
owner: engineering
origin: 当前对话，确认在 `spec-first init --claude` 与 `spec-first init --codex` 阶段创建 `.spec-first/specs/`
scope: 在 init 阶段初始化共享 repo-level spec seeds，并补最小确定性初稿与 `spec-plan` 首批消费闭环；第一版仅包含 `repo-profile.yaml` 与 `README.md`；不引入新的多文件规范系统
---

# init 阶段共享 spec seed 初始化计划

## 完成说明

本计划的第一版最小闭环已完成，当前状态收口为 `completed`。

已完成项：

1. `spec-first init --claude` 与 `spec-first init --codex` 会创建 `.spec-first/specs/repo-profile.yaml` 与 `.spec-first/specs/README.md`
2. shared seed 初始化逻辑已统一收口到 `src/cli/spec-seeds.js`
3. `init` 对 shared seeds 采用 add-only 语义，重复执行不会覆盖用户修改
4. `clean --claude` 与 `clean --codex` 不删除 `.spec-first/specs/`
5. `.spec-first/specs/` 不纳入当前 managed state
6. `spec-plan` 已把 `.spec-first/specs/repo-profile.yaml` 作为 optional planning input 消费
7. 相关 unit / smoke / integration 主链已通过

本次收口不包含后续增强项，例如 repo-profile 的单独 refresh skill、planning 可观测性或更细粒度 patch preview。这些能力已在后续独立计划中继续演进。

## 1. 背景与问题定义

当前 `spec-first init --claude` 与 `spec-first init --codex` 的职责，主要是安装 host-specific runtime assets、项目级 instruction file、developer profile 与 managed state。现有受管目录主要分为两类：

- host-specific runtime
  - Claude: `.claude/spec-first/`
  - Codex: `.codex/spec-first/`
- repo-shared control-plane / workflow artifacts
  - `.spec-first/graph/`
  - `.spec-first/workflows/`

现阶段缺少一类 repo-level、跨 host 共享、由 init 冷启动种下的“项目规范 seed”。这导致后续如果要承接 `repo-profile` 方案，只能依赖：

- 文档讨论中的抽象方案
- workflow 运行期动态生成
- 人工手动创建目录与模板

这不利于形成稳定的初始化体验，也不利于让后续 workflow 在统一位置读取项目规范输入。

本计划的目标，是在不把 `init` 变成重型规范系统安装器的前提下，在项目内初始化一份最小共享 spec seed，并让它进入至少一个真实消费闭环。

### 1.1 为什么现在值得做

这个需求只有在以下条件同时成立时才有意义：

1. 它提升的是 LLM 的决策输入质量，而不是增加新的流程控制。
2. 它至少进入一个真实消费闭环，而不是只生成占位模板。
3. 它保持 add-only、非 managed-state、非 hard-gate 的轻边界。

因此，本计划不把 shared spec seed 视为“规范系统建设”，而视为一个低成本验证性迭代：

- 验证 `repo-profile.yaml` 是否真能改善 `spec-plan` 的规划输入质量
- 验证团队是否愿意维护这份 repo-level shared input
- 验证它是否会在保持清晰边界的同时，避免退化成死模板

### 1.2 什么情况下不值得继续做大

如果出现以下任一情况，应停止扩张，而不是继续往 `spec-code-review`、`spec-work`、`doctor`、`sync` 等方向铺开：

1. shared seed 只是被创建，但没有进入真实消费闭环。
2. `repo-profile.yaml` 长期保持空壳或默认值，团队几乎不维护。
3. `spec-plan` 读取它之后，规划质量没有可感知改善。
4. 为了支持它而开始引入多模板分支、自动刷新、doctor hard-check、state 接管或其他重控制逻辑。
5. 脚本为了补全它而承担越来越多语义判断，开始偏离“脚本做确定性初始化，LLM 做语义决策”。

## 2. 决策摘要

本计划确认以下决策：

1. 共享 spec seed 目录放在 `.spec-first/specs/`。
2. 第一版只初始化两个文件：
   - `.spec-first/specs/repo-profile.yaml`
   - `.spec-first/specs/README.md`
3. `repo-profile.yaml` 是机器可读的 repo-level shared seed scaffold，用于提升后续节点的决策输入质量，而不是替项目自动完成身份建模。
4. `README.md` 只是说明文件，不承担规则真相源职责。
5. 这两个文件是 repo-level shared inputs，不属于 host runtime assets。
6. `init` 对这两个文件采用 add-only 语义：
   - 缺失则创建
   - 已存在则跳过
   - 不 merge，不覆盖
7. `clean --claude` 与 `clean --codex` 不删除 `.spec-first/specs/`。
8. 第一版不把 `.spec-first/specs/` 纳入 platform managed state。
9. `init` 第一版要补最小、低误导的初稿：
   - `repo_id`
   - `languages`
   - `project_intent.summary` 初稿
   - `project_type` 仅在强信号命中时写入，否则留空
10. 第一版不替项目预置治理判断：
   - `principles`
   - `non_negotiables`
   - `review_defaults`
   默认留空数组，不按 `project_type` 分支。
11. 第一版首批消费节点为 `spec-plan`。
12. 第一版不引入 `frontend/`、`backend/`、`common/` 等多域模板体系。
13. 第一版不新增 `validation`、`routing`、`quality-gates`、`state-machine` 类文件。
14. 本次实现定位为验证性迭代，不默认承诺后续扩展到 `spec-code-review`、`spec-work`、`doctor` 或 managed-state 闭环。
15. 本次优化优先级是“减少误导”而不是“提高覆盖率”；空值优于伪信息。

## 3. 目标与非目标

### 3.1 目标

1. 在 `spec-first init --claude` 与 `spec-first init --codex` 后，项目根目录出现：
   - `.spec-first/specs/repo-profile.yaml`
   - `.spec-first/specs/README.md`
2. 两个平台复用同一套 shared seed 初始化逻辑。
3. `repo-profile.yaml` 初稿具备最小可用字段集，并由脚本填入最小、低误导初稿，而不是重判断模板。
4. 重复执行 `init` 不覆盖用户已修改的 seed 文件。
5. `clean` 不误删这些 repo-level spec seeds。
6. `spec-plan` 能把 `repo-profile.yaml` 作为 planning input 读取。
7. 不破坏现有 runtime asset、managed state、doctor、dry-run 与 smoke 主链。
8. 本轮实现完成后，团队可以基于真实使用判断这条路线是否值得继续扩张，而不是先假设它必然进入长期核心系统。

### 3.2 非目标

1. 不在第一版实现深度代码扫描后自动补全 `principles` / `non_negotiables` / `review_defaults`。
2. 不在第一版为 `repo-profile.yaml` 建立 doctor hard-check。
3. 不在第一版引入新的 workflow command。
4. 不在第一版引入多文件 spec system。
5. 不在第一版实现 `.spec-first/specs/` 与 `docs/contexts/` 的镜像同步。
6. 不在第一版把 `.spec-first/specs/` 接入 clean/state 闭环。
7. 不在第一版做自由式 LLM 写回或自动重写用户规范。
8. 不把 seed 扩展成 repo 自动分类体系。
9. 不把 `spec-plan` 对 seed 的消费扩展成 checklist、rules engine 或 hard gate。

## 4. 需求追踪

本计划直接对应当前讨论中确认的需求：

1. `spec-first init --claude` 与 `spec-first init --codex` 都需要创建共享 seed。
2. 共享目录放在 `.spec-first/specs/`，而不是 `docs/contexts/`。
3. 第一版模板要足够小，只做 repo-level shared seed scaffold。
4. `repo-profile.yaml` 是主要模板；`README.md` 是辅助说明。
5. 不要把第一版做成新的重型规则系统。
6. 首批必须至少有一个真实消费节点，避免 seed 退化为占位目录。
7. 当前最重要的优化方向是减少误导性默认值，而不是扩写 seed 内容。

## 5. 设计原则

1. 轻 contract
   - 只种下最小必要模板，不在 init 阶段引入复杂状态或编排。
2. 明确边界
   - `.spec-first/specs/` 是 shared spec seed 目录，不是 host runtime 目录。
3. 用户内容优先
   - 已存在 seed 文件不覆盖。
4. source-of-truth 与 runtime asset 分离
   - `.spec-first/specs/` 不进入当前 managed runtime state。
5. 让后续 workflow 决策
   - init 只负责确定性初始化最小初稿，不负责语义层深度判定。
6. 脚本做确定性初始化，LLM 做语义决策
   - `repo_id`、`languages` 与 `project_intent.summary` 初稿由脚本负责
   - `project_type` 仅在强信号命中时由脚本补入，否则保留空值
   - `principles`、`non_negotiables`、`review_defaults` 的最终语义确认由人和后续 workflow 决策
7. 宁空勿错
   - 空值表示“当前没有高置信度输入”，优于 `unknown`、固定句式或强分类误判。

## 6. 方案设计

### 6.0 本轮优化收口

基于本轮讨论，当前方案需要从“会替项目下默认判断的 seed”收缩为“低误导、可编辑、只提供高置信度输入的 scaffold”。本轮优化重点如下：

1. 收缩 `project_type` 推断
   - 去掉高误判规则，例如 `name.includes('cli')` 与 `private => fullstack-app`
   - 只在强信号命中时写入 `project_type`，否则留空
2. 去掉 `languages: unknown`
   - 识别到什么写什么
   - 识别不到就写空列表，不制造伪分类值
3. 收缩 `project_intent.summary`
   - 优先 manifest 描述字段
   - 其次 README 首段可读摘要
   - Markdown link 保留可读文本，不保留 URL
   - 无高质量来源时留空，不写固定 fallback 句子
4. 模板不预置治理判断
   - `principles`
   - `non_negotiables`
   - `review_defaults`
   默认留空数组，由项目维护者后续补全
5. `spec-plan` 消费保持克制
   - 继续作为 optional planning input
   - 空字符串、空数组、缺失字段都按 absent 处理
   - 不扩展成 rules engine、checklist 或 gate

### 6.1 目标目录与模板源

新增模板源目录：

- `templates/specs/repo-profile.yaml`
- `templates/specs/README.md`

新增初始化产物目录：

- `.spec-first/specs/repo-profile.yaml`
- `.spec-first/specs/README.md`

### 6.2 `repo-profile.yaml` 字段范围

第一版模板字段固定为：

- `schema_version`
- `repo_id`
- `project_type`
- `languages`
- `project_intent.summary`
- `principles`
- `non_negotiables`
- `review_defaults`

模板内容保持 repo-level、长期稳定、机器可读，不包含：

- workflow state
- transition rules
- quality gate state
- verifier dispatch
- task-specific requirements
- runtime routing rules

其中第一版 init 应补入以下最小、低误导初稿：

- `repo_id`
- `languages`
- `project_intent.summary`
- `project_type`（仅在强信号命中时）

其中：

- `principles`
- `non_negotiables`
- `review_defaults`

第一版直接来自空数组模板，不按 `project_type` 分支，避免把 init 变成规则映射器。

更具体的字段语义如下：

- `repo_id`
  - 必填
  - 由仓库目录名确定性生成
- `languages`
  - 只写识别到的语言列表
  - 识别不到时写空列表 `[]`
  - 不写 `unknown`
- `project_type`
  - 可选弱字段
  - 只有命中强信号时才写值
  - 低置信度场景留空字符串
- `project_intent.summary`
  - 可编辑初稿
  - 只在拿到高质量可读摘要时写值
  - 拿不到时留空字符串
- `principles` / `non_negotiables` / `review_defaults`
  - 作为字段壳保留
  - 默认空数组
  - 不由 `init` 代替项目写入长期治理判断

### 6.3 `README.md` 职责

`README.md` 只解释：

- 这个目录的用途
- `spec-first init` 的 add-only 规则
- `repo-profile.yaml` 的维护边界
- 哪些内容不应该写进 `repo-profile.yaml`
- 空值表示“当前没有高置信度输入”，不是错误

它不承担任何 runtime contract 或解析职责。

### 6.4 与 `docs/contexts/` 的边界

`docs/contexts/<slug>/` 继续承载事实型上下文，例如：

- 语言/运行时摘要
- module map
- public entrypoints
- test map
- pitfalls / context pack

`.spec-first/specs/repo-profile.yaml` 只承载规范型输入 scaffold，例如：

- 轻量项目身份与意图
- 项目长期原则
- 不可违反项
- review 默认关注点

因此：

- `docs/contexts/` 负责“项目现在是什么”
- `repo-profile.yaml` 负责“项目长期怎么做”的可编辑 seed 起点

二者互补，不互相覆盖。

### 6.5 init 集成方式

共享 seed 初始化逻辑不放进 adapter，而是作为 repo-level shared plan 集成到 `src/cli/commands/init.js` 的写入链路中。

理由：

- 这不是 Claude-specific 或 Codex-specific runtime asset
- 它不属于 `.claude/spec-first/` 或 `.codex/spec-first/`
- 放在 adapter 会模糊 runtime asset 与 repo-level spec seed 的边界

建议新增一个小的 helper，例如：

- `src/cli/spec-seeds.js`

职责只包含：

1. 读取 `templates/specs/` 下的模板内容
2. 构建 `.spec-first/` 与 `.spec-first/specs/` 的 `ensure_dir` plan
3. 确定性推断 `repo_id` 与 `languages`
4. 用保守规则推断 `project_type`：
   - 仅在强信号命中时写入
   - 否则保留空值
5. 用固定优先级生成 `project_intent.summary` 初稿：
   - 优先读取 manifest 描述字段，例如 `package.json.description`
   - 其次读取 `README.md` 首个标题后的首段摘要
   - 拿不到高质量摘要则留空
6. 对缺失文件构建 `write_file` plan
7. 对已存在文件返回 no-op

### 6.6 add-only 语义

`.spec-first/specs/` 下的两个 seed 文件采用严格 add-only 规则：

- 文件不存在：创建
- 文件已存在：跳过
- 不 merge
- 不覆盖
- 不因为升级而强制刷新模板

理由：

- 这两个文件代表 repo-level shared inputs
- 它们的 owner 是项目，而不是 CLI runtime installer
- 一旦进入用户维护阶段，继续覆盖会破坏 source-of-truth 语义

### 6.7 clean / doctor 边界

#### clean

`src/cli/commands/clean.js` 第一版不修改删除边界，不把 `.spec-first/specs/` 纳入删除计划。

明确语义：

- `clean` 只清理当前 platform managed runtime assets
- `.spec-first/specs/` 是 repo-level seed，不在 clean 范围内

#### doctor

第一版建议不新增 hard requirement。可接受两种策略：

- 最小策略：不检查 `.spec-first/specs/`
- 轻提示策略：如果目录或 `repo-profile.yaml` 缺失，只给 WARNING，不影响整体健康判断

本计划建议先采用最小策略，避免把 init seed 过早纳入 doctor contract。

### 6.8 模板目标形态

第一版 `repo-profile.yaml` 目标形态应尽量接近如下结构：

```yaml
schema_version: 1
repo_id: "__REPO_ID__"

languages: []

project_type: ""

project_intent:
  summary: ""

principles: []
non_negotiables: []
review_defaults: []
```

允许实现层在有高置信度输入时填入 `languages`、`project_type` 与 `project_intent.summary`，但默认合同必须保持“空值优于伪信息”的方向。

## 7. 实施单元

## Unit 1: 新增共享 spec seed 模板源

### Goal

在 source tree 中增加最小共享模板源，为 `init` 提供稳定 seed 内容。

### Files

- `templates/specs/repo-profile.yaml`
- `templates/specs/README.md`

### Decisions

1. 第一版模板只有这两份。
2. 不新增子目录。
3. 模板内容使用 repo-level 语义，不引入 frontend/backend/common 分类。

### Test Scenarios

1. 模板文件存在且可读。
2. `repo-profile.yaml` 模板字段完整且无禁用字段。
3. `README.md` 明确写出 add-only 与边界说明。

## Unit 2: 新增 shared spec seed planner + 最小低误导初稿

### Goal

为 `.spec-first/specs/` 建立独立于 adapter 的 shared plan 构造逻辑，并在 init 阶段补最小、低误导初稿。

### Files

- `src/cli/spec-seeds.js`
- `src/cli/commands/init.js`

### Decisions

1. seed plan 是 repo-level 计划，不挂在 adapter 上。
2. seed plan 只负责：
   - `ensure_dir`
   - 缺失文件写入
   - `repo_id` 与 `languages` 的确定性初值
   - `project_type` 的保守、强信号写入
   - `project_intent.summary` 的最小可读初稿
   - 写入空数组模板中的 `principles` / `non_negotiables` / `review_defaults`
3. 已存在文件不更新。
4. seed plan 不写入 managed state。

### Test Scenarios

1. 新项目执行 `runInit(['--claude', ...])` 后生成两个 seed 文件。
2. 新项目执行 `runInit(['--codex', ...])` 后生成同样的两个 seed 文件。
3. 已存在 `repo-profile.yaml` 时，再次执行 `init` 不覆盖用户内容。
4. 新项目初始化后，`repo-profile.yaml` 中 `repo_id` 非空。
5. 无法识别语言时，`languages` 写空列表而不是 `unknown`。
6. 只有命中强信号时才写入 `project_type`；弱信号场景保持空值。
7. `project_intent.summary` 具备最小可读初稿；若无高质量来源则保持空值。
8. README 中的 Markdown link 被提取为可读文本，而不是 URL。
9. `api-client` 之类名称不应被误判为 `cli-tooling`。
10. `private: true` 的普通包不应默认被误判为 `fullstack-app`。
11. dry-run 能显示 `.spec-first/` 与 `.spec-first/specs/` 的创建计划。
12. dry-run 不把已存在 seed 文件误报成更新项。

## Unit 3: `spec-plan` 首批消费闭环

### Goal

确保 shared spec seed 不只是初始化目录，而是进入第一个真实决策输入闭环。

### Files

- `skills/spec-plan/SKILL.md`
- `tests/unit/spec-plan-contracts.test.js`

### Decisions

1. 第一版只接入 `spec-plan`，不同时铺开 `spec-code-review` 与 `spec-work`。
2. `spec-plan` 只把 `repo-profile.yaml` 作为 planning input，不做规则引擎展开。
3. 读取字段优先级：
   - `project_type`
   - `project_intent.summary`
   - `principles`
   - `non_negotiables`
4. 空字符串、空数组、缺失字段都按 absent 处理。
5. 若文件缺失或无法解析，降级继续，不阻断 planning 主流程。

### Test Scenarios

1. `spec-plan` 文案明确 `repo-profile.yaml` 是可选 planning input。
2. `spec-plan` 合同测试不会把 `repo-profile.yaml` 描述成 hard gate。
3. 当 seed 存在时，plan workflow 能把其视为项目级规范输入源。
4. 当字段为空时，plan workflow 不会把空值当成规则或必填合同。

## Unit 4: 保护 clean 与 runtime managed boundary

### Goal

确保新增共享 spec seeds 后，不污染当前 runtime asset / clean 边界。

### Files

- `tests/unit/managed-state-contracts.test.js`
- `tests/unit/runtime-plan-contracts.test.js`

### Decisions

1. `.spec-first/specs/` 不写入 `state.json`。
2. `clean --claude` / `clean --codex` 不删除 `.spec-first/specs/`。
3. runtime managed boundary 继续只围绕 adapter runtime roots 与 state 跟踪项。
4. 第一版优先通过 contract tests 锁定该边界；只有测试证明现状不满足时，才修改 `src/cli/commands/clean.js`。

### Test Scenarios

1. 执行 `init` 后生成 `.spec-first/specs/`。
2. 执行对应平台 `clean` 后，runtime assets 被删除，但 `.spec-first/specs/` 保留。
3. managed state contract 中不出现 `repo-profile.yaml` 与 `README.md`。
4. dry-run clean 不把 `.spec-first/specs/` 列为待删除项。

## Unit 5: 文档与变更记录收口

### Goal

让用户与后续维护者明确知道 `.spec-first/specs/` 的定位与边界。

### Files

- `CHANGELOG.md`
- `docs/05-用户手册/README.md`
- `docs/05-用户手册/02-核心概念.md`
- `docs/08-版本更新/README.md`（若本次被认定为用户可见的 workflow 初始化增强）

### Decisions

1. 文档描述中必须明确区分：
   - host runtime assets
   - repo-level shared spec seeds
2. 不把 `.spec-first/specs/` 描述成新的 workflow runtime。
3. 不向用户暗示 `repo-profile.yaml` 会被 CLI 持续自动维护。
4. 要明确 seed 是 scaffold，不是 repo truth engine。
5. 要明确空值语义：代表暂无高置信度输入。

### Test Scenarios

1. Changelog 有记录。
2. 用户手册不会把 `.spec-first/specs/` 误写成 clean 目标。
3. 文档中明确“init 只创建缺失 seed”。

## 8. 推荐测试文件

建议新增或修改的测试文件如下：

- `tests/unit/spec-seeds.test.js`
- `tests/unit/init-dry-run.test.js`
- `tests/unit/spec-plan-contracts.test.js`
- `tests/unit/managed-state-contracts.test.js`
- `tests/unit/runtime-plan-contracts.test.js`
- `tests/smoke/cli.sh`

其中：

- `spec-seeds.test.js`
  - 负责 seed planner 的 add-only、模板写入、路径创建与误判防回归
- `init-dry-run.test.js`
  - 负责 init preview 中新增 shared seed 路径
- `spec-plan-contracts.test.js`
  - 负责断言 `spec-plan` 首批消费 `repo-profile.yaml` 时仍保持 lightweight input 语义，并把空值按 absent 处理
- `managed-state-contracts.test.js`
  - 负责断言这些 seed 不进入 managed state
- `runtime-plan-contracts.test.js`
  - 负责断言 runtime managed boundary 未扩张到 `.spec-first/specs/`
- `tests/smoke/cli.sh`
  - 负责端到端验证 init 后 seed 存在，clean 后 seed 仍保留

## 9. 风险与缓解

### 风险 1：`.spec-first/` 目录语义进一步混合

当前 `.spec-first/` 已包含 graph 与 workflows。新增 `specs/` 后，可能让目录语义从“control-plane artifacts”扩展为“control-plane + repo seed inputs”。

缓解：

- 在文档里明确子目录语义
- `specs/` 只放 repo-level seeds，不放 runtime state、quality gate、routing 文件

### 风险 2：未来用户误以为 seed 会被 init 覆盖

缓解：

- `README.md` 明确 add-only
- 测试显式覆盖“不覆盖已有 seed”

### 风险 3：未来有人把 `.spec-first/specs/` 扩展成多域模板系统

缓解：

- 在 `README.md` 和实现注释中明确第一版边界
- 后续若要扩展，必须单独立项，不在本计划内顺手扩

### 风险 4：clean / doctor 误把 seed 当 runtime asset

缓解：

- 第一版不纳入 managed state
- 增加 contract tests，防止回归

### 风险 5：seed 变成“带着误导默认值长期留存”的噪音文件

缓解：

- 第一版必须同步接入 `spec-plan`，避免 seed 只有写入没有消费
- `repo-profile.yaml` 保持单文件、轻字段、短内容，降低维护门槛
- 默认值收缩到低误导 scaffold，避免用户先删错内容再开始维护
- 完成后通过真实使用反馈评估其是否继续保留和扩张

## 10. 执行顺序

1. 先更新 `CHANGELOG.md`
2. 新增 `templates/specs/repo-profile.yaml` 与 `templates/specs/README.md`
3. 新增 `src/cli/spec-seeds.js`
4. 在 `src/cli/commands/init.js` 中合并 shared seed plan
5. 为 add-only 与 dry-run 添加单元测试
6. 为 `spec-plan` 增加首批消费 contract tests
7. 为 clean boundary 添加 contract tests
8. 仅在 contract tests 证明现状不满足时修改 `clean` 相关实现
9. 更新 smoke 与用户文档

## 11. seed 消费节点优先级矩阵

下表用于回答“先做 seed 之后，哪些节点最值得消费它，以提升节点执行质量”。

| 节点 | 是否推荐首批接入 | 推荐消费字段 | 预期增强点 | 风险与边界 |
|------|------------------|-------------|-----------|-----------|
| `spec-plan` | 高 | `project_type`、`project_intent.summary`、`principles`、`non_negotiables` | 让规划阶段在有高置信度输入时更快建立 repo-level 心智，减少冷启动偏差 | 只作为 planning input；空值按 absent 处理；不把 plan 变成 repo-profile 规则展开器 |
| `spec-code-review` | 低 | `review_defaults`、`non_negotiables`、`principles` | 理论上可让 review 默认关注点更贴项目长期约束 | 第一版不接入；避免在 seed 价值未验证前扩张消费面 |
| `spec-work` | 低 | `non_negotiables`、`principles` | 理论上可在执行阶段提醒长期硬边界 | 第一版不接入；避免把 work 变成强控制流程 |
| `spec-brainstorm` | 低 | `project_intent.summary`、`principles` | 理论上可在技术型 brainstorm 中补充项目方向 | 第一版不接入；只在将来有明确价值证据时再评估 |
| `doctor` | 低 | 最多只读存在性或“明显空模板”信号 | 可作为轻提示，提醒 seed 是否存在或长期未补全 | 不应把 repo-profile 变成 doctor 的 hard-check 或健康 gate |
| `init` | 不推荐 | 无 | 无 | `init` 的职责是创建 seed，不应反向消费 seed 自己 |
| `clean` | 不推荐 | 无 | 无 | `clean` 管 runtime asset 生命周期，与项目长期规范无直接关系 |

### 11.1 推荐接入顺序

1. 先做 seed 初始化本身。
2. 同一迭代接入 `spec-plan` 作为首批消费者。
3. 观察真实使用价值后，再决定是否接入 `spec-code-review`。
4. 观察真实使用价值后，再决定是否接入 `spec-work`。

### 11.2 最小闭环

如果要验证 `.spec-first/specs/repo-profile.yaml` 是否真的有价值，推荐最小闭环是：

1. `spec-first init --claude` / `--codex` 创建 seed。
2. `init` 生成的 `repo-profile.yaml` 带最小、低误导初稿，而不是强判断模板。
3. `spec-plan` 读取 `repo-profile.yaml`，把其中非空字段当作 optional planning input。

只要这个闭环能稳定成立，shared spec seed 就不再只是“初始化模板目录”，而成为真实提升决策输入质量的项目级资产。

### 11.3 价值判定信号

本次不是“先天正确”的长期体系设计，而是一个应被现实使用信号验证的方案。建议至少观察以下信号：

1. `spec-plan` 输出是否更少偏离项目长期原则与硬边界。
2. 用户是否会主动补充或维护 `repo-profile.yaml`，而不是任其停留在默认模板。
3. 新的 seed 机制是否保持了轻边界，没有引出 doctor / state / sync / routing 扩张需求。
4. 维护成本是否低于它带来的规划输入增益。
5. 用户是否更多是在补全 scaffold，而不是先清理错误默认值。

如果这些信号没有成立，不应继续把它推广为更大的规范系统。

## 12. Verification

以下证据同时成立，才算完成：

1. `spec-first init --claude` 后，项目中存在：
   - `.spec-first/specs/repo-profile.yaml`
   - `.spec-first/specs/README.md`
2. `spec-first init --codex` 后，也存在同样两个文件。
3. 新建项目初始化后，`repo-profile.yaml` 中的 `repo_id` 非空；`languages`、`project_type`、`project_intent.summary` 满足“有高置信度输入则写，无则留空”的合同。
4. 手工修改 `.spec-first/specs/repo-profile.yaml` 后，再次执行 `init`，内容不被覆盖。
5. `spec-first init --claude --dry-run` 与 `spec-first init --codex --dry-run` 能正确显示 shared seed 创建计划。
6. `spec-plan` 已明确将 `repo-profile.yaml` 作为 planning input 使用，但不会把它变成 hard gate，且空值按 absent 处理。
7. `spec-first clean --claude` 与 `spec-first clean --codex` 不删除 `.spec-first/specs/`。
8. managed state 中不出现 `.spec-first/specs/` 路径。
9. smoke / unit 测试通过，且现有 runtime asset 主链不回归。
10. 从方案意图上看，这次实现已经构成“shared seed + 首批真实消费”的最小价值验证，而不是只有目录生成。
11. 负例测试能证明以下误导性默认值已被去除：
   - `api-client` 不会被误判为 `cli-tooling`
   - `private: true` 的普通包不会默认变成 `fullstack-app`
   - 无语言时不会写 `unknown`
   - README Markdown link 不会污染 `project_intent.summary`

以下任一情况仍算未完成：

1. seed 文件被写入 platform managed state。
2. clean 删除了 `.spec-first/specs/`。
3. re-init 覆盖用户已编辑的 `repo-profile.yaml`。
4. `repo-profile.yaml` 仍然通过 `unknown`、固定句式或强分类误判制造伪信息。
5. 文档把 `.spec-first/specs/` 描述成 host runtime 资产。
6. 第一版实现额外引入多域模板或 routing/validation/gate 类文件。
7. 实现完成后仍无法回答“它是否改善了 `spec-plan` 的输入质量”。
8. 用户需要先删除大量错误默认值，才能开始维护 seed。

## 13. 后续演进方向

本计划完成后，可在后续独立迭代中考虑：

1. 通过某个 workflow 对 `principles`、`non_negotiables`、`review_defaults` 提供“建议补全”，而不是 silent overwrite。
2. 第二阶段接入 `spec-code-review`，让 `review_defaults` 真正进入 review 决策输入。
3. 视需要增加 doctor warning，但保持它是事实提示，不变成硬 gate。
