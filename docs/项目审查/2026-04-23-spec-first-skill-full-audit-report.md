# 2026-04-23 spec-first 全量 skill 审查报告

## 审查基线

- 审查对象：当前工作树代码事实，不以 README、宣传文案、设计意图替代源码事实
- 审查范围：`skills/` 全部 46 个 skill、`agents/` 全部 55 个 agent markdown、`src/cli/`/`src/context-routing/`/`src/bootstrap-compiler/` 相关 runtime 与治理实现、对应 `tests/`/`templates/`/`package.json`
- 审查方式：先建立完整清单，再逐层覆盖；禁止抽查；每个 skill 都进入覆盖矩阵
- 当前现实：仓库在审查时处于 dirty worktree 状态，存在一批未提交中的 setup -> `spec-mcp-setup` 重构痕迹。本报告判断的是“当前 checkout 的真实实现状态”，不是对某个已发布 tag 的回顾

## 已执行验证

- `npx jest tests/unit/asset-consistency.test.js tests/unit/skills-governance-contracts.test.js tests/unit/runtime-asset-integrity.test.js tests/unit/dual-host-governance-contracts.test.js --runInBand`
  - 结果：4 个 suite / 22 个测试全部通过
- `bash tests/unit/mcp-setup.sh`
  - 结果：124 pass / 0 fail
- `npx jest tests/unit/spec-graph-bootstrap-contracts.test.js tests/unit/test-browser-contracts.test.js --runInBand`
  - 结果：2 个 suite / 31 个测试全部通过
- `npm pack --dry-run`
  - 结果：tarball 可生成；同时暴露出发布包实际包含 `skills/feature-video/scripts/__pycache__/capture-demo.cpython-311.pyc` 与 `skills/gemini-imagegen/scripts/__pycache__/*.pyc`

## 全局结论

当前 spec-first **不是落后的实现**。在下列方面，它已经明显强于常见的“只靠 prompt + README + 手工同步”的 workflow 仓库：

- skill 交付面有机器真源：`src/cli/contracts/dual-host-governance/skills-governance.json`
- 双宿主交付边界清晰：Claude 命令 / Codex skill 的过滤由代码和测试共同约束
- runtime 漂移检测不是“只看文件是否存在”，而是检查关键 anchor、路径重写和 host 特定 contract
- Stage-0 context routing 在脚本层保持克制，`fact.*` 条件不会在脚本里强行做语义决策，而是显式跳过，保留给 LLM
- verifier registry 目前仍是轻量静态表，没有演化成中心化调度引擎

但它**还不能称为“适合长期演化的最佳实践”**。当前最主要的问题不在“功能不够多”，而在：

1. runtime 治理强，知识镜像治理弱
2. 发布包卫生不足，源码真源边界被字节码缓存污染
3. 部分高价值知识面只做 anchor 级或存在性校验，没有做完整一致性治理
4. 核心操作逻辑集中在少数超大文件，维护边界已经开始变厚

我的判断是：

- **是否合理：** 合理，且有明确工程方向
- **是否先进：** 在 runtime governance / drift inspection 上是先进的
- **是否符合最佳实践：** 还没有，尤其在 knowledge mirror、package hygiene、核心模块收口上还不够
- **是否值得继续演化：** 值得，但优先级应放在“证据、边界、轻量化”，而不是再堆新能力

## 点线面分析

### 点：单点能力与单点异常

从单点能力看，当前仓库里最成熟的不是某一个 workflow 文案，而是三类“可机器验证的单点”：

1. **skill 交付点**
   - `src/cli/contracts/dual-host-governance/skills-governance.json` 为 46 个 skill 提供了完整登记
   - `tests/unit/skills-governance-contracts.test.js` 会校验 skill 与 governance 的一一对应、双宿主过滤和 host-delivery 合同

2. **runtime 漂移点**
   - `src/cli/plugin.js` 定义了 skill / command 高价值 anchor
   - `tests/unit/runtime-asset-integrity.test.js` 已证明 runtime 漂移会被发现，而不是“存在即通过”

3. **Stage-0 评估点**
   - `src/context-routing/evaluator.js` 将脚本层判断限制在 `output_exists.*`、`stage_is.*` 等确定性条件
   - 对 `fact.*` 语义条件明确 `skipped`，没有越界把 LLM 判断变成脚本规则引擎

但从单点异常看，也已经出现三类明确 debt：

1. **mirror drift 单点**
   - `spec-graph-bootstrap`
   - `spec-mcp-setup`
   - `test-browser`

2. **发布污染单点**
   - `feature-video`
   - `gemini-imagegen`

3. **contract 空洞单点**
   - `proof` 本体没有专属 unit contract

这说明仓库已经具备强 contract 的意识，但 contract 强度分布还不均匀。

### 线：核心链路线性分析

本次审查把当前系统拆成 3 条关键链路。

#### 线 1：入口治理线

代码路径：

- `skills/using-spec-first/SKILL.md`
- `.claude-plugin/plugin.json`
- `src/cli/plugin.js`
- `src/cli/adapters/claude.js`
- `src/cli/adapters/codex.js`
- `src/cli/commands/init.js`

当前判断：

- 这条线整体是健康的
- `using-spec-first` 负责路由语义
- `.claude-plugin/plugin.json` 负责命令面注册
- `skills-governance.json` + `buildFilteredAssetSet()` 负责 host delivery
- `init` 只负责安装，不负责重新解释 workflow 语义

这条线符合“脚本安装、LLM路由”的分层，没有把入口治理塞进中心化状态机。

#### 线 2：Stage-0 上下文线

代码路径：

- `src/bootstrap-compiler/run-bootstrap.js`
- `src/context-routing/loader.js`
- `src/context-routing/entry-resolver.js`
- `src/context-routing/evaluator.js`
- `src/cli/commands/stage0-context.js`

当前判断：

- 这条线的优势是：控制面、上下文面、workspace 路由面已经开始分离
- `run-bootstrap.js` 负责产物落盘
- `loader.js` 负责装载
- `entry-resolver.js` 负责 workspace / repo 入口解析
- `evaluator.js` 负责轻量 fallback 与 asset 选择
- `stage0-context.js` 负责对外吐统一 JSON contract

风险在于：

- 这条线的代码量已经不小
- 如果继续把更多语义推断、更多 verifier 分支、更多 quality gate 逻辑叠上去，Stage-0 会从“轻控制面”长成“厚运行时决策面”

所以这条线当前是**方向正确，但已逼近厚化边界**。

#### 线 3：验证与审查线

代码路径：

- `skills/spec-code-review/SKILL.md`
- `skills/test-browser/SKILL.md`
- `skills/test-xcode/SKILL.md`
- `src/context-routing/verification-summary.js`
- `src/context-routing/verifier-registry.js`
- `src/cli/commands/doctor.js`

当前判断：

- 这是当前仓库“最有潜力，也最容易失控”的一条线
- 好的一面：
  - verifier registry 目前仍是极小静态表
  - `verification_summary` / `verifier_dispatch` / `verification_gate_state` 已被拆成不同职责
  - review workflow 已经显式区分 evidence、dispatch、gate ledger
- 风险面：
  - 这条线天然容易被做成调度中心
  - 一旦后续把更多 verifier、更多 gate、更多自动阻断塞进去，就会偏离“让 LLM 决策”

也就是说，验证线当前还在可控区间，但必须强约束其厚度。

### 面：系统面与用户增益面

从系统面看，当前 spec-first 的真实强项不是“skill 多”，而是它已经形成了一套比较少见的组合：

- runtime 资产有机器真源
- 双宿主差异有正式治理
- drift 检测能做内容级检查
- workflow assets、agents、runtime install、doctor 之间开始形成闭环

这解释了为什么它虽然还不算“最佳实践”，但已经不是普通 prompt 仓库。

从用户增益面看，当前真正能持续带来效率与质量提升的，不是所有 skill，而是几条主干：

1. `using-spec-first` 降低入口选择成本
2. `spec-graph-bootstrap` / `stage0-context` 降低上下文构建成本
3. `spec-plan` / `spec-work` / `spec-code-review` 形成需求、执行、审查三段式主链
4. `spec-mcp-setup` / verifier registry 提供最小验证闭环

但用户增益面目前也有上限：

- mirror drift 会直接降低模型输入质量
- package hygiene 问题会降低工程可信度
- 超大文件会拖慢后续演化速度

所以“面”的判断很明确：

- 当前系统已经能真实提高研发效率与质量
- 但如果不先修输入真源和边界维护问题，这种增益会在后续演化中逐渐衰减

## Evolution Architect 裁判结论

基于这次代码审查，我对 spec-first 下一阶段演化给出明确裁判结论。

### 应继续强化的方向

1. **输入真源质量**
   - 强化 source skill、prompt mirror、agent mirror、runtime asset 之间的真实一致性
   - 这是提升 LLM 决策质量的第一优先级

2. **边界清晰度**
   - 继续保持 `skill source -> governance -> runtime install -> doctor/inspection` 的层次分离
   - 保持 `control-plane artifact` 与 `human-readable context docs` 的边界

3. **证据驱动演化**
   - 多用 contract tests、runtime drift checks、pack dry-run、artifact inspection 说话
   - 少用 README 叙事、历史设计意图或“理论上应该如此”来替代证据

4. **知识复用质量**
   - 让 `docs/10-prompt` 和 `docs/contexts` 这种被模型消费的知识层真正可依赖
   - 这比再加一个新 workflow 更重要

### 必须拒绝的方向

1. **拒绝把 verifier registry 做成中心调度系统**
   - registry 目前是轻量静态表，这是优点，不是欠缺
   - 不应继续给它叠状态流转、自动编排树和统一 gate 中控语义

2. **拒绝把 Stage-0 evaluator 扩成语义规则引擎**
   - 当前 `fact.* -> skipped` 是正确边界
   - 不应为了“自动化更强”而把 LLM 的判断塞回脚本分支

3. **拒绝把 knowledge mirror 当成次级资产**
   - 如果 mirror 会被模型消费，它就不是“可有可无的 docs copy”
   - 它必须被正式治理，否则输入层会持续腐蚀

4. **拒绝继续把复杂度堆进少数超级文件**
   - 现在这些大文件还可维护，但已经不再轻
   - 下一阶段应该拆，而不是继续加

### 对项目方向的一句话判断

spec-first 当前最值得保护的，不是“workflow 面越来越全”，而是这套系统还保留着：

- 轻 contract
- 明确边界
- 脚本做确定性流程
- LLM 做语义决策

只要后续演化继续围绕这四点，spec-first 会越来越稳、越来越准。

如果偏离这四点，它就会从“高质量 AI 研发辅助系统”退化成“越来越复杂的流程机器”。

## 关键发现

## 明确问题列表

以下问题不是“可能存在”，而是本次基于当前代码工作树已经确认的问题。

### P1-1：`docs/10-prompt` skill mirror 已出现真实漂移，输入层不再可靠

问题事实：

- [skills/test-browser/SKILL.md](/Users/kuang/xiaobu/spec-first/skills/test-browser/SKILL.md) 当前写的是“权限受阻时转到 `/spec:mcp-setup`”
- [docs/10-prompt/skills/test-browser/SKILL.md](/Users/kuang/xiaobu/spec-first/docs/10-prompt/skills/test-browser/SKILL.md) 仍保留旧的 `/spec:setup`
- `spec-graph-bootstrap` 与 `spec-mcp-setup` 的 source skill / prompt mirror 也已出现非 byte-equal 漂移
- 进一步下钻 skill 本体后发现，[skills/test-browser/SKILL.md:39](/Users/kuang/xiaobu/spec-first/skills/test-browser/SKILL.md#L39) 已改成 `/spec:mcp-setup`，但同一 source 文件的 [skills/test-browser/SKILL.md:54](/Users/kuang/xiaobu/spec-first/skills/test-browser/SKILL.md#L54) 仍保留 `/spec:setup`
- 现有 [tests/unit/test-browser-contracts.test.js:30](/Users/kuang/xiaobu/spec-first/tests/unit/test-browser-contracts.test.js#L30) 只断言必须包含 `/spec:mcp-setup`，但没有显式禁止 `/spec:setup`

为什么是问题：

- `docs/10-prompt` 不是纯展示文档，而是会被模型消费的知识层
- 一旦 mirror 漂移，模型输入就会和真实 skill 真源不一致
- 这会直接降低输入质量，进而降低路由、执行与审查质量

代码证据：

- [skills/test-browser/SKILL.md:39](/Users/kuang/xiaobu/spec-first/skills/test-browser/SKILL.md#L39)
- [skills/test-browser/SKILL.md:54](/Users/kuang/xiaobu/spec-first/skills/test-browser/SKILL.md#L54)
- [docs/10-prompt/skills/test-browser/SKILL.md:39](/Users/kuang/xiaobu/spec-first/docs/10-prompt/skills/test-browser/SKILL.md#L39)
- [tests/unit/test-browser-contracts.test.js:30](/Users/kuang/xiaobu/spec-first/tests/unit/test-browser-contracts.test.js#L30)
- [tests/unit/asset-consistency.test.js:38](/Users/kuang/xiaobu/spec-first/tests/unit/asset-consistency.test.js#L38)

当前判断：

- 这是**输入质量问题**
- 也是**知识复用层治理不足问题**
- 同时已经升级为 **source contract 自身不一致问题**

### P1-2：agent mirror 治理基本失效，knowledge layer 与 runtime layer 严重失衡

问题事实：

- `agents/` 共 55 个 markdown agent
- `docs/10-prompt/agents` mirror 中：
  - 8 个缺失
  - 46 个 drift
  - 只有 1 个 byte-equal
- 当前自动测试只对一个 agent mirror 做 anchor 校验

为什么是问题：

- 当前系统对 runtime skills / commands 的治理很强，但对 agent mirror 几乎没有同级治理
- 这意味着“审查和研究能力”的知识镜像层可能长期陈旧而不自知
- 如果后续继续依赖 mirror 做文档、prompt、审查输入，这会持续侵蚀知识复用质量

代码证据：

- [agents](/Users/kuang/xiaobu/spec-first/agents)
- [docs/10-prompt/agents](/Users/kuang/xiaobu/spec-first/docs/10-prompt/agents)
- [tests/unit/asset-consistency.test.js:170](/Users/kuang/xiaobu/spec-first/tests/unit/asset-consistency.test.js#L170)

当前判断：

- 这是**知识复用问题**
- 也是**演化证据不足问题**

### P1-3：发布包包含 `__pycache__/*.pyc`，破坏 source-of-truth 边界

问题事实：

- `package.json` 将整个 `skills/` 纳入发布白名单
- `.npmignore` 未忽略 `__pycache__` / `*.pyc`
- `npm pack --dry-run` 已确认 tarball 包含：
  - `skills/feature-video/scripts/__pycache__/capture-demo.cpython-311.pyc`
  - `skills/gemini-imagegen/scripts/__pycache__/*.pyc`

为什么是问题：

- 这些不是 source asset，而是解释器缓存
- 它们会污染发布物、增加噪声、削弱仓库“代码即事实”的边界
- 这说明当前发布卫生没有完全收口到“可审查真源”

代码证据：

- [package.json:26](/Users/kuang/xiaobu/spec-first/package.json#L26)
- [.npmignore:1](/Users/kuang/xiaobu/spec-first/.npmignore#L1)
- [skills/feature-video/scripts/__pycache__/capture-demo.cpython-311.pyc](/Users/kuang/xiaobu/spec-first/skills/feature-video/scripts/__pycache__/capture-demo.cpython-311.pyc)
- [skills/gemini-imagegen/scripts/__pycache__/compose_images.cpython-311.pyc](/Users/kuang/xiaobu/spec-first/skills/gemini-imagegen/scripts/__pycache__/compose_images.cpython-311.pyc)

当前判断：

- 这是**边界清晰度问题**
- 也是**系统轻量性与可维护性问题**

### P1-4：mirror contract 仍以 anchor 存在性为主，无法有效拦截语义 drift

问题事实：

- `tests/unit/asset-consistency.test.js` 主要验证 high-risk skill 的关键 anchor 是否存在
- 它不会保证全部 skill mirror 与 source 保持整体一致
- 因此 `spec-graph-bootstrap`、`spec-mcp-setup`、`test-browser` 的 mirror drift 都可能在现有测试下继续通过

为什么是问题：

- 关键字存在不等于语义一致
- 对 prompt / skill 这类知识资产来说，允许“关键段落还在，但实际示例和入口已漂移”，会慢慢把系统带向低质量输入

代码证据：

- [tests/unit/asset-consistency.test.js:197](/Users/kuang/xiaobu/spec-first/tests/unit/asset-consistency.test.js#L197)
- [tests/unit/asset-consistency.test.js:185](/Users/kuang/xiaobu/spec-first/tests/unit/asset-consistency.test.js#L185)

当前判断：

- 这是**审查质量问题**
- 也是**演化证据不足问题**

### P2-1：核心控制逻辑集中在少数超大文件，已经偏离“轻、稳、准、可维护”

问题事实：

- [src/cli/plugin.js](/Users/kuang/xiaobu/spec-first/src/cli/plugin.js)：1116 行
- [src/cli/commands/doctor.js](/Users/kuang/xiaobu/spec-first/src/cli/commands/doctor.js)：1211 行
- [src/cli/commands/init.js](/Users/kuang/xiaobu/spec-first/src/cli/commands/init.js)：729 行
- [src/bootstrap-compiler/run-bootstrap.js](/Users/kuang/xiaobu/spec-first/src/bootstrap-compiler/run-bootstrap.js)：609 行
- [src/context-routing/verification-summary.js](/Users/kuang/xiaobu/spec-first/src/context-routing/verification-summary.js)：520 行

为什么是问题：

- 这会让职责切分越来越模糊
- 后续每次新增 verifier、mirror、doctor、runtime contract 时，都更容易把复杂度继续堆进中心文件
- 当前虽然还不是状态机系统，但已经开始形成“厚控制层”

当前判断：

- 这是**系统可维护性问题**
- 也是**边界清晰度问题**

### P2-2：`proof` 被多个 workflow 依赖，但缺少本体自证 contract

问题事实：

- `proof` 被 `spec-plan`、`spec-brainstorm`、`spec-debug` 等多个 skill 引用
- 但当前 `tests/unit/` 下没有 `proof` 专属 contract test

为什么是问题：

- 下游依赖多，上游自证弱，意味着未来 drift 或入口错误更容易延迟暴露
- 这会拖低知识复用与执行链路的可靠性

代码证据：

- [skills/proof/SKILL.md](/Users/kuang/xiaobu/spec-first/skills/proof/SKILL.md)
- [skills/spec-debug/SKILL.md:127](/Users/kuang/xiaobu/spec-first/skills/spec-debug/SKILL.md#L127)
- [skills/spec-plan/references/universal-planning.md:107](/Users/kuang/xiaobu/spec-first/skills/spec-plan/references/universal-planning.md#L107)

当前判断：

- 这是**审查覆盖不足问题**

### 发现 1：prompt / docs mirror 治理明显弱于 runtime 治理，已经影响输入质量与知识复用质量

这是本次审查里最重要的结构性问题。

代码事实：

- 46 个 source skill 都有 `docs/10-prompt/skills/<skill>/SKILL.md` mirror
- 但其中至少 3 个 mirror 当前与 source 不字节一致：
  - `spec-graph-bootstrap`
  - `spec-mcp-setup`
  - `test-browser`
- `test-browser` 的 source 写的是“权限受阻时转到 `/spec:mcp-setup`”，而 prompt mirror 仍写成旧的 `/spec:setup`
- `tests/unit/test-browser-contracts.test.js` 只校验 source skill，不校验 prompt mirror
- `tests/unit/asset-consistency.test.js` 只对部分 high-risk skill 做 anchor 对齐，不做 46 个 skill 的完整 mirror 一致性校验
- agent mirror 更弱：55 个 agent markdown 中，8 个 mirror 缺失，46 个 mirror drift，只有 1 个是 byte-equal
- `tests/unit/asset-consistency.test.js` 对 agent 侧只检查一个 `learnings-researcher` 的 anchor

影响：

- 这不会立刻破坏 runtime，但会直接削弱“知识复用层”的可信度
- 如果 `docs/10-prompt` 被当作 prompt mirror / 审查镜像 / docs 真源使用，模型拿到的输入可能和真实 skill 已经不一致
- 这类问题最危险的地方在于：测试能通过，运行时也未必立刻报错，但输入质量已经悄悄下降

结论：

- 这不是单点文档疏忽，而是“runtime contract 强、knowledge mirror contract 弱”的系统性不对称

### 发现 2：npm 发布包当前会携带 Python 字节码缓存，破坏 source-of-truth 边界与发布卫生

代码事实：

- `package.json` 的 `files` 白名单直接包含整个 `skills/`
- `.npmignore` 没有忽略 `__pycache__` / `*.pyc`
- 当前仓库里存在以下已纳入 `skills/` 的缓存文件：
  - `skills/feature-video/scripts/__pycache__/capture-demo.cpython-311.pyc`
  - `skills/gemini-imagegen/scripts/__pycache__/compose_images.cpython-311.pyc`
  - `skills/gemini-imagegen/scripts/__pycache__/edit_image.cpython-311.pyc`
  - `skills/gemini-imagegen/scripts/__pycache__/gemini_images.cpython-311.pyc`
  - `skills/gemini-imagegen/scripts/__pycache__/generate_image.cpython-311.pyc`
  - `skills/gemini-imagegen/scripts/__pycache__/multi_turn_chat.cpython-311.pyc`
- `npm pack --dry-run` 已证实这些 `.pyc` 文件进入 tarball

影响：

- 发布物混入解释器缓存，不再是纯 source asset
- 不同开发机生成的缓存可能导致包内容噪声、不稳定 diff、无谓体积膨胀
- 这会削弱“skills/ 是可审查、可复用、可比对的真源资产”这条边界

结论：

- 这是明确的工程卫生问题，应优先修复

### 发现 3：mirror contract 当前大量依赖“关键锚点存在”而非“整体验证一致”，会放过语义 drift

代码事实：

- `tests/unit/asset-consistency.test.js` 为 high-risk skill 定义的是 anchor 集，而不是全文一致
- `spec-graph-bootstrap` 的 source 与 prompt mirror 当前存在明显 diff，但相关测试仍然通过
- `spec-mcp-setup` 的 source 与 prompt mirror 示例内容已有差异，但 shell 合同只校验若干字符串存在，不校验完整示例语义一致
- `test-browser` mirror 的 `/spec:setup` 旧入口也没有被现有测试捕获

影响：

- 当前治理更擅长防“文件缺失”和“关键段落丢失”，不擅长防“语义漂移”
- 对一个以 prompt / skill 作为重要知识资产的系统来说，这会慢慢侵蚀输入质量

结论：

- 现有 contract 设计方向是对的，但镜像层的验证粒度还不够

### 发现 4：核心治理与运行时逻辑开始向少数超大文件集中，长期看会伤害“轻、稳、准、可维护”

代码事实：

- `src/cli/plugin.js`：1116 行
- `src/cli/commands/doctor.js`：1211 行
- `src/cli/commands/init.js`：729 行
- `src/bootstrap-compiler/run-bootstrap.js`：609 行
- `src/context-routing/verification-summary.js`：520 行
- `src/context-routing/verifier-registry.js`：407 行

这些文件同时承担了多种职责：

- 资产清单与治理
- runtime 安装与同步
- 漂移检测
- doctor 诊断
- Stage-0 contract 评估
- verification summary 与 dispatch posture 计算

影响：

- 当前还没发展成典型状态机系统，但维护成本已经开始集中化
- 当后续继续叠加 verifier、workspace、mirror、doctor、init 逻辑时，这些文件会成为演化瓶颈
- 这不是“现在不可用”，而是“当前可用，但不是最佳实践”

结论：

- 应尽早沿职责面切分，而不是继续向大文件堆逻辑

### 发现 5：skill 覆盖基本完整，但个别 skill 的 contract 深度仍然不均衡

代码事实：

- 46 个 skill 全部登记在 `skills-governance.json`
- 大多数 skill 都有对应 unit contract
- `proof` 当前没有专属 unit contract
- `spec-mcp-setup` 是高复杂度 / 高影响 skill，但当前主要依赖 shell 合同；没有与其复杂度对等的 JS contract suite
- `spec-compound-refresh` 没有单独命名的 contract 文件，但其核心语义被 `spec-compound-contracts.test.js` 间接覆盖

影响：

- 当前不是“完全没测”，而是“高价值 skill 的 contract 粒度不均”
- `proof` 被 `spec-plan`、`spec-brainstorm`、`spec-debug` 等多处引用，但本体缺少独立合同，属于典型的下游依赖多、上游自证弱

结论：

- 这是 coverage debt，不是 runtime breakage

## 系统级判断

## 单节点深审

这一节只看主干节点，不看“有没有这个 skill”，而看“这个节点在整条 spec-first 链路里是否承担了清晰职责、是否真的提供质量增益、是否存在结构性风险”。

### 节点 1：`using-spec-first`

代码事实：

- 它是 session 入口治理层，source of truth 在 [skills/using-spec-first/SKILL.md](/Users/kuang/xiaobu/spec-first/skills/using-spec-first/SKILL.md)
- 双宿主 runtime 合同有专门测试：[tests/unit/using-spec-first-runtime-contracts.test.js](/Users/kuang/xiaobu/spec-first/tests/unit/using-spec-first-runtime-contracts.test.js)
- 路由规则明确覆盖 setup / update / sessions / debug / review / graph-bootstrap / brainstorm / ideate / plan / work

判断：

- 这是当前系统方向最正确的节点之一
- 它没有把自己做成命令，也没有把所有任务都强行导向 brainstorm
- 它真正起到了“入口分诊”而不是“中心总闸门”的作用

风险：

- 它的正确性高度依赖下游 workflow 真正可用
- 如果 mirror 层继续漂移，入口路由的知识上下文会逐渐失真

结论：

- 保留并继续强化
- 不要把它扩成全局 gate 系统

### 节点 2：`spec-mcp-setup`

代码事实：

- source skill 在 [skills/spec-mcp-setup/SKILL.md](/Users/kuang/xiaobu/spec-first/skills/spec-mcp-setup/SKILL.md)
- 配套脚本和 metadata 最多：23 个文件
- 主体合同更多由 shell tests 保证：[tests/unit/mcp-setup.sh](/Users/kuang/xiaobu/spec-first/tests/unit/mcp-setup.sh)
- 当前 prompt mirror 与 source 已出现 drift

判断：

- 这是当前最重、也最关键的 supporting node 之一
- 它确实在为整个 spec-first 提供环境前置条件，价值是真实的
- 但它已经逼近“setup 中心控制器”的风险区

风险：

- 复杂度高
- mirror drift 已出现
- 核心合同偏 shell-heavy，缺少与复杂度等量的 JS-side 结构合同

结论：

- 保留
- 但必须做减重、补 contract、修 mirror

### 节点 3：`spec-graph-bootstrap`

代码事实：

- 它是 Stage-0 主节点，承担事实抽取与 context 产物生成
- 相关实现横跨：
  - [skills/spec-graph-bootstrap/SKILL.md](/Users/kuang/xiaobu/spec-first/skills/spec-graph-bootstrap/SKILL.md)
  - [src/bootstrap-compiler/run-bootstrap.js](/Users/kuang/xiaobu/spec-first/src/bootstrap-compiler/run-bootstrap.js)
  - [src/context-routing/loader.js](/Users/kuang/xiaobu/spec-first/src/context-routing/loader.js)
  - [src/context-routing/evaluator.js](/Users/kuang/xiaobu/spec-first/src/context-routing/evaluator.js)
  - [src/cli/commands/stage0-context.js](/Users/kuang/xiaobu/spec-first/src/cli/commands/stage0-context.js)
- 合同测试是当前最完整的节点之一：
  - [tests/unit/spec-graph-bootstrap-contracts.test.js](/Users/kuang/xiaobu/spec-first/tests/unit/spec-graph-bootstrap-contracts.test.js)
  - [tests/unit/spec-graph-bootstrap-compiler.test.js](/Users/kuang/xiaobu/spec-first/tests/unit/spec-graph-bootstrap-compiler.test.js)
  - [tests/unit/spec-graph-bootstrap-monorepo.test.js](/Users/kuang/xiaobu/spec-first/tests/unit/spec-graph-bootstrap-monorepo.test.js)
- prompt mirror 当前存在 drift

判断：

- 这是 spec-first 的“事实层主引擎”
- 它的价值是真实的，因为后续 plan/work/review 都在消费 Stage-0
- 代码里能看出设计上已经很努力地避免把它做成厚规则引擎

风险：

- 它的复杂度已经很高
- 一旦继续往里面堆 verifier、workspace、database、quality gate、doctor 逻辑，就容易从“事实层”变成“控制中心”

结论：

- 应继续保留为核心节点
- 但下一阶段重点是“收边界”，不是“再加功能”

### 节点 4：`spec-plan`

代码事实：

- source skill 有明确的内部命名与 Stage-0 contract
- 配套 references 完整，含 plan-handoff / deepening-workflow / universal-planning / visual-communication
- tests 比较扎实：[tests/unit/spec-plan-contracts.test.js](/Users/kuang/xiaobu/spec-first/tests/unit/spec-plan-contracts.test.js)

判断：

- 这是当前主干 workflow 里完成度较高的节点
- 它既保留 planning 的开放性，也有 execution handoff 边界
- 它没有退化成“写计划文档工具”，而是逐步形成了 execution-quality 输入层

风险：

- 节点本身较重
- 对 Stage-0 质量、agent mirror、best-practice research 的依赖较强

结论：

- 值得继续作为主干节点
- 但它的上游输入层必须更可信

### 节点 5：`spec-work`

代码事实：

- source skill 与 shipping-workflow 形成执行节点主合同
- 显式消费 Stage-0 verification summary / verifier_dispatch / gate state
- `spec-work` 与 `spec-code-review` 之间已有 run artifact handoff contract

判断：

- 这是当前系统里最接近“真实研发执行面”的节点
- 它没有把 review 跳过，也没有把 verification 仅当文案
- 这一点对“真实提升研发质量”非常关键

风险：

- 它和 review / verification 的耦合会天然拉高复杂度
- 如果后续不收敛，会变成“执行 + gate + orchestration + reporting”的超级节点

结论：

- 继续保留为主干
- 但要避免吞并更多控制职责

### 节点 6：`spec-code-review`

代码事实：

- 当前节点的 persona、schema、output template、subagent template 都比较完整
- 明确把 `verification_summary`、`verifier_dispatch`、`verification_gate_state` 做了职责区分
- 21 个 reviewer/agent 引用说明这是当前最强的“质量放大器”节点

判断：

- 这是 spec-first 当前最有差异化竞争力的节点之一
- 它不是单 reviewer，而是一个有约束的审查系统
- 如果维护得当，它会持续放大用户研发质量

风险：

- 复杂度极高
- 最容易滑向中心化审查编排器
- agent mirror 治理不足会反噬这个节点

结论：

- 是核心资产
- 但必须重点防“复杂化失控”

### 节点 7：`spec-compound` / `spec-compound-refresh`

代码事实：

- 它们负责 durable knowledge file，而不是第二份独立产物
- `spec-compound-contracts.test.js` 已覆盖核心结构
- `session-historian` 被作为知识补强输入，而不是主真源

判断：

- 这是当前系统里最符合“知识复用”目标的节点
- 设计方向正确：单文件双视角、刷新而不裂变

风险：

- 它对 mirror 可信度和 session historian 质量依赖明显
- 如果上游 knowledge layer 不稳，这个节点很容易沦为“格式化归档器”

结论：

- 值得继续演化
- 前提是先修 knowledge mirror 治理

### 节点 8：`spec-update` / `spec-sessions` / `spec-debug`

判断：

- 这三者属于 supporting workflow
- `spec-update` 提供 runtime repair，价值明确
- `spec-sessions` 提供历史会话回收，是 knowledge / context 的支撑点
- `spec-debug` 提供调查式修 bug 路径，也较符合 spec-first 哲学

风险：

- 它们不是当前主要结构风险来源
- 但它们的收益依然依赖前面那条主干链路是否可信

结论：

- 保留
- 不建议在它们身上扩张大量新功能

## 整体流程推演

这一节不再看单个 skill，而看用户从进入仓库到完成研发闭环的整个路径。

### 流程 1：入口到执行的主链

当前代码事实支持的主链是：

1. `using-spec-first`
2. `spec-mcp-setup`（如有 host / verifier / MCP 前置需求）
3. `spec-graph-bootstrap`
4. `spec-brainstorm` / `spec-ideate`（问题不清晰时）
5. `spec-plan`
6. `spec-work`
7. `spec-code-review`
8. `spec-compound` / `spec-compound-refresh`

这条链的优点：

- 输入层、规划层、执行层、审查层、知识层已经开始分层
- 它不是“一上来就写代码”的 workflow
- 也不是“所有请求都先进 brainstorm”的强编排

这条链的风险：

- 入口到执行之间依赖的知识层越来越多
- 一旦 mirror / runtime / Stage-0 其中一层失真，后续层的质量会级联下降

### 流程 2：用户真实增益推演

如果当前主链运行正常，用户得到的真实增益是：

1. 少走错入口
2. 更快拿到 repo facts
3. 更稳地形成 plan
4. 执行时更清楚 verification 要求
5. review 不再只靠单人直觉
6. 最终形成可复用知识

但如果当前已发现的问题不修，增益会怎样衰减：

1. mirror drift 先削弱输入质量
2. 输入质量下降后，plan/work/review 的判断质量会随之下降
3. 知识沉淀层会开始积累不可靠资产
4. 核心控制文件变厚后，后续修复速度会越来越慢

这说明：

- 当前 spec-first 已经能产生真实外部增益
- 但这套增益并不是“自动永续”的
- 它必须靠更强的输入治理和边界治理来维持

### 流程 3：下一阶段正确推进方式

正确推进顺序应该是：

1. 修输入真源
2. 修 mirror 治理
3. 修 package hygiene
4. 拆大文件
5. 再考虑是否需要新增能力

错误推进顺序是：

1. 继续加 skill
2. 继续加 verifier
3. 继续加 gate
4. 继续加 docs mirror
5. 最后再回头修输入层

前者会让系统更稳，后者会让系统更重。

### 哪些地方已经符合 spec-first 哲学

1. **脚本不替代 LLM 做语义判断**
   - `src/context-routing/evaluator.js` 只识别 `output_exists.*` 与 `stage_is.*`
   - 对 `fact.*` 条件直接标记 `skipped`
   - 这是在代码层明确拒绝“把语义判断硬编码成规则引擎”

2. **verifier registry 仍是轻 contract**
   - `src/context-routing/verifier-registry.js` 目前只维护 `test-browser` 与 `test-xcode` 两个静态 verifier
   - registry 只描述平台、前置条件、evidence 类型和 invocation hint，没有长成中心化调度状态机

3. **双宿主治理落到了机器真源**
   - `skills-governance.json` + `buildFilteredAssetSet()` + `validateSkillsGovernance()` 形成了真实的 host delivery contract
   - 这一层不是口头约定，而是代码和测试共同约束

4. **doctor 已具备真实 drift 诊断价值**
   - 不是只检查“文件是否存在”
   - 会检查 anchor 漂移、path rewrite drift、runtime asset 健康度

### 哪些地方已经偏离“最佳实践”

1. **知识镜像层没有拿到和 runtime 同等级别的治理强度**
2. **发布包里混入字节码缓存，破坏 source-only 边界**
3. **大文件集中度过高，下一步若继续叠加逻辑容易滑向厚 control plane**
4. **部分 contract 还是偏“关键字存在”而不是“语义整体一致”**

## 演化优先级建议

### P0：先修证据质量，不加新功能

1. 给 `docs/10-prompt/skills` 建立完整一致性策略
   - 要么明确声明“允许摘要镜像”，并为摘要镜像定义严格 schema
   - 要么明确声明“必须 source byte-equal”，并补全自动校验

2. 给 `docs/10-prompt/agents` 建立真实治理合同
   - 当前 55 个 agent mirror 中只有 1 个 byte-equal，这一层不能继续靠默认信任

3. 清理发布包中的 `__pycache__` / `*.pyc`
   - 同时把这条变成测试或打包 gate，而不是人工习惯

### P1：把维护复杂度从超大文件中剥离出来

1. 把 `plugin.js` 再切分
   - 治理加载 / 过滤
   - runtime sync
   - drift inspection
   - command/skill/agent 枚举

2. 把 `doctor.js` 拆成 platform checks / bootstrap checks / verification checks / report rendering

3. 把 `init.js` 拆成
   - 参数解析
   - preflight
   - sync planning
   - managed block 写入
   - state 构建

### P2：补齐下游依赖重、上游自证弱的 skill 合同

1. `proof`
2. `spec-mcp-setup` 的 JS-side contract
3. `docs/10-prompt` mirror consistency test matrix

## 整改路线图 / 规划执行

这一部分不是“继续加功能”的 roadmap，而是把已经确认的问题转成最小可执行的系统演化动作。

### 先定三条执行原则

1. **先修输入与证据层，再谈新增 workflow**
   - 在 `docs/10-prompt/skills`、`docs/10-prompt/agents`、发布包卫生、关键合同自证没有收口前，不应继续扩大 workflow 面积

2. **能删噪声就删，不要把治理问题变成更厚的 gate**
   - `__pycache__` / `*.pyc` 这类问题应直接从 source 与发布链中清掉
   - mirror 漂移问题应回到真源与 contract，而不是继续加人工同步步骤

3. **把“可执行 prompt 资产”和“知识摘要资产”彻底分层**
   - 可执行 prompt mirror 需要强一致治理
   - 摘要、学习材料、附录型知识资产可以存在，但不能再伪装成 source mirror

### 第 0 阶段：冻结扩张，先修真源与镜像治理

这一步不新增能力，只修证据质量。

必须立即执行的动作：

1. **删除发布噪声**
   - 从仓库与发布白名单中清除 `skills/**/__pycache__/` 与 `*.pyc`
   - 在 `.npmignore` 或等效打包规则中显式拦截这类解释器缓存

2. **建立 mirror 分类账，而不是继续把所有 mirror 混在一起**
   - 对 `docs/10-prompt/skills/**` 与 `docs/10-prompt/agents/**` 逐一标记：
     - `byte-equal mirror`
     - `schema-summary`
     - `generated appendix`
     - `delete`

3. **收紧 `docs/10-prompt/skills` 的治理口径**
   - 现有代码与测试已经把它当成 prompt mirror 使用：`tests/unit/spec-plan-contracts.test.js`、`tests/unit/spec-work-contracts.test.js`、`tests/unit/spec-review-contracts.test.js`、`tests/unit/mcp-setup.sh`
   - 因此这层不能继续“部分同义、部分手写、部分旧入口残留”
   - 结论：凡是直接承载 workflow 执行口径的 `docs/10-prompt/skills/<skill>/SKILL.md`，默认都应升级为 **source byte-equal**
   - 如果确实需要更短版本，应该改成独立命名的摘要资产，而不是继续占用 mirror 路径

4. **处置 `docs/10-prompt/agents` 的失衡**
   - 当前只有 1 个 byte-equal、46 个 drift、8 个缺失，这说明“把 agent docs 全量作为手写 mirror”在现状下不可维护
   - 正确动作不是继续人工补齐，而是先做边界裁决：
     - 若某个 agent markdown 会作为模型执行输入或审查输入，应升级为 **受合同保护的 byte-equal mirror**
     - 若只是知识说明或示例，应降级为 `schema-summary` 或 `generated appendix`
     - 若没有清晰消费方，应直接删除 mirror，避免制造第二真源

第 0 阶段的 done signals：

1. `npm pack --dry-run` 结果中不再出现 `__pycache__` 或 `*.pyc`
2. `docs/10-prompt/skills/**` 全量完成分类，所有执行型 mirror 都进入 byte-equal 集
3. `docs/10-prompt/agents/**` 全量完成分类，不再默认把“手写 mirror”视为合理常态
4. 对当前已发现 drift 的 `test-browser`、`spec-mcp-setup`、`spec-graph-bootstrap` 完成 source/mirror 收口

### 第 1 阶段：把“会被依赖的能力”补成自证合同

这一步的目标不是扩能力，而是把已经被主流程依赖的节点补成可验证资产。

必须优先补的合同：

1. **`proof` 本体合同**
   - 当前 `spec-plan`、`spec-brainstorm`、`spec-debug` 等都依赖 `proof` 作为分享/交付出口，但只有“引用 proof”层面的断言，没有 `proof` 自身的 contract test
   - 应补充：
     - URL / slug / token 解析合同
     - API/bridge 双模式边界合同
     - 关键命令示例与禁止入口的 wording 合同
     - 被下游 workflow 依赖的最小 prompt surface 合同

2. **`spec-mcp-setup` 的 JS-side contract**
   - 当前 `tests/unit/mcp-setup.sh` 覆盖了 shell 侧大量事实，但 `src/cli/` 里与 host delivery、asset sync、governance 相关的 JS 侧边界仍应有更直接的 contract test
   - 应补充：
     - source -> docs mirror -> runtime asset 的路径一致性
     - host 过滤后的保留/剔除规则
     - setup 别名、旧入口、迁移提示是否与当前 source contract 一致

3. **mirror consistency matrix**
   - `tests/unit/asset-consistency.test.js` 应从“高风险锚点存在性”升级成“两层矩阵”：
     - 第一层：执行型 mirror 做目录级 byte-equal 校验
     - 第二层：摘要型 mirror 做 schema 字段与必备语义槽位校验

第 1 阶段的 done signals：

1. `proof` 拥有独立 contract test，而不是只出现在别人的 handoff 测试里
2. `spec-mcp-setup` 的关键 JS-side contract 可以独立失败并精准报错
3. mirror 测试失败时，能明确指出“byte-equal drift”还是“summary schema drift”

### 第 2 阶段：拆薄中心控制层，避免滑向厚 orchestration

这一步要做的是“减厚”，不是“重写”。

优先拆分对象：

1. **`src/cli/plugin.js`**
   - 应按职责拆成独立模块：
     - governance loading
     - host filtering
     - runtime sync
     - drift inspection
     - asset enumeration
   - `plugin.js` 自身只保留组合与编排，不再持续吸纳细节规则

2. **`src/cli/commands/doctor.js`**
   - 平台检查、bootstrap 健康度、verification 健康度、输出渲染要拆开
   - 避免同一个文件同时承担检查逻辑、数据聚合和 CLI 渲染

3. **`src/cli/commands/init.js`**
   - 参数解释、preflight、sync plan、managed block 写入、state 生成分别下沉
   - 保持 `init` 是薄 orchestrator，而不是“所有初始化细节的永久宿主”

4. **`src/bootstrap-compiler/run-bootstrap.js` 与 `src/context-routing/verification-summary.js`**
   - 前者应聚焦 compile pipeline，后者应聚焦 summary assembly
   - 不要继续把 verifier dispatch、gate projection、workspace 解释逻辑堆回单点文件

第 2 阶段的 done signals：

1. 核心大文件的职责边界可以一句话说明清楚
2. 新增一个 verifier、一个 mirror 类型、一个 host 规则时，不需要优先改中心大文件
3. 运行时仍保持“轻 contract + 明确边界 + 让 LLM 决策”，没有长成中心化状态机

### 明确的删除 / 降级 / 保留策略

应该删除：

1. 仓库中的 `__pycache__` / `*.pyc`
2. 没有明确消费方、也无法维持同步的 agent hand-written mirror

应该降级：

1. 不能做到 byte-equal、但又被放在 mirror 路径下的 prompt docs
   - 要么重命名为 summary/reference
   - 要么退出“执行输入层”

2. `docs/10-prompt/agents/**`
   - 在建立分类账前，不应再被默认视为可靠镜像层
   - 暂时应视为“待治理知识层”，而不是“可信执行输入层”

应该保留并强化：

1. `skills/` 作为 source of truth
2. `skills-governance.json` + `buildFilteredAssetSet()` + `validateSkillsGovernance()` 这类已经落到代码事实的双宿主治理骨架
3. `doctor` 对 runtime drift 的真实诊断能力，但前提是继续保持其轻量边界

### 一条必须坚持的演化纪律

在以上三阶段未完成前，新增 workflow、继续扩写 agent mirror、继续叠加 docs mirror，都不应被视为“项目在进步”。

这些动作只会让系统表面上更丰富，实际上更难维护、更难审查、更难证明输入可信。

## 对“是否继续演化”的回答

应该继续演化，但方向要非常明确：

- **不是**继续扩大 workflow 数量
- **不是**把 verifier / review / bootstrap 做成越来越厚的中心控制面
- **不是**用更多 gate 替代输入质量

而应该优先做：

- 输入真源更可信
- 镜像更一致
- contract 更可验证
- runtime 与 knowledge 层边界更清楚
- 核心实现更轻、更可拆、更可维护

如果按这个顺序推进，spec-first 会继续变强。

如果反过来继续加能力、加流程、加文档层叠，而不先修证据质量与边界清晰度，它会逐渐从“轻 contract + 明确边界 + 让 LLM 决策”退化成“复杂但不稳的 workflow 系统”。

## 全量 skill 覆盖矩阵

说明：

- `Surface` 与 `Host Delivery` 来自 `src/cli/contracts/dual-host-governance/skills-governance.json`
- `Unit Contract` 只记录直接命中的 JS contract 文件；shell 合同在备注里单列
- `Audit Note` 为本次审查发现的直接异常；写 `no direct anomaly observed` 不代表“完美”，只表示本次代码核对中没有发现明确异常点

| Skill | Surface | Host Delivery | Unit Contract | Files | Audit Note |
| --- | --- | --- | --- | ---: | --- |
| agent-browser | standalone_skill | skill/skill | agent-browser-contracts.test.js | 11 | no direct anomaly observed |
| agent-native-architecture | standalone_skill | skill/skill | agent-native-architecture-contracts.test.js | 15 | no direct anomaly observed |
| agent-native-audit | standalone_skill | skill/skill | agent-native-audit-contracts.test.js | 1 | no direct anomaly observed |
| andrew-kane-gem-writer | standalone_skill | skill/skill | andrew-kane-gem-writer-contracts.test.js | 6 | no direct anomaly observed |
| changelog | standalone_skill | skill/skill | changelog-format.test.js<br>changelog-skill-contracts.test.js | 1 | no direct anomaly observed |
| claude-permissions-optimizer | standalone_skill | skill/skill | claude-permissions-optimizer-contracts.test.js | 3 | no direct anomaly observed |
| deploy-docs | standalone_skill | skill/skill | deploy-docs-contracts.test.js | 1 | no direct anomaly observed |
| spec-doc-review | standalone_skill | skill/skill | document-review-contracts.test.js | 5 | no direct anomaly observed |
| dspy-ruby | standalone_skill | skill/skill | dspy-ruby-contracts.test.js | 9 | no direct anomaly observed |
| every-style-editor | standalone_skill | skill/skill | every-style-editor-contracts.test.js | 2 | no direct anomaly observed |
| feature-video | standalone_skill | skill/skill | feature-video-contracts.test.js | 8 | ships pyc |
| frontend-design | standalone_skill | skill/skill | frontend-design-contracts.test.js | 1 | no direct anomaly observed |
| gemini-imagegen | standalone_skill | skill/skill | gemini-imagegen-contracts.test.js | 12 | ships pyc |
| git-clean-gone-branches | standalone_skill | skill/skill | git-clean-gone-branches-contracts.test.js | 2 | no direct anomaly observed |
| git-commit | standalone_skill | skill/skill | git-commit-contracts.test.js<br>git-commit-push-pr-contracts.test.js | 1 | no direct anomaly observed |
| git-commit-push-pr | standalone_skill | skill/skill | git-commit-push-pr-contracts.test.js | 1 | no direct anomaly observed |
| git-worktree | standalone_skill | skill/skill | git-worktree-contracts.test.js | 2 | no direct anomaly observed |
| lfg | standalone_skill | skill/skill | lfg-contracts.test.js | 1 | no direct anomaly observed |
| onboarding | standalone_skill | skill/skill | onboarding-contracts.test.js | 2 | no direct anomaly observed |
| orchestrating-swarms | standalone_skill | skill/none | orchestrating-swarms-contracts.test.js | 1 | no direct anomaly observed |
| proof | standalone_skill | skill/skill | - | 1 | no dedicated contract test |
| rclone | standalone_skill | skill/skill | rclone-contracts.test.js | 2 | no direct anomaly observed |
| report-bug | standalone_skill | skill/skill | report-bug-contracts.test.js | 1 | no direct anomaly observed |
| reproduce-bug | standalone_skill | skill/skill | reproduce-bug-contracts.test.js | 1 | no direct anomaly observed |
| resolve-pr-feedback | standalone_skill | skill/skill | resolve-pr-feedback-contracts.test.js | 5 | no direct anomaly observed |
| spec-brainstorm | workflow_command | command/skill | spec-brainstorm-contracts.test.js | 6 | no direct anomaly observed |
| spec-compound | workflow_command | command/skill | spec-compound-contracts.test.js | 4 | no direct anomaly observed |
| spec-compound-refresh | standalone_skill | skill/skill | - | 4 | no direct anomaly observed |
| spec-debug | workflow_command | command/skill | spec-debug-contracts.test.js | 3 | no direct anomaly observed |
| spec-graph-bootstrap | workflow_command | command/skill | spec-graph-bootstrap-compiler.test.js<br>spec-graph-bootstrap-contracts.test.js<br>spec-graph-bootstrap-monorepo.test.js | 6 | mirror drift |
| spec-ideate | workflow_command | command/skill | spec-ideate-contracts.test.js | 2 | no direct anomaly observed |
| spec-mcp-setup | workflow_command | command/skill | - | 23 | mirror drift; shell tests only for core contract |
| spec-optimize | standalone_skill | skill/skill | spec-optimize-contracts.test.js | 12 | no direct anomaly observed |
| spec-plan | workflow_command | command/skill | spec-plan-contracts.test.js | 5 | no direct anomaly observed |
| spec-code-review | workflow_command | command/skill | spec-review-contracts.test.js | 7 | no direct anomaly observed |
| spec-sessions | workflow_command | command/skill | spec-sessions-contracts.test.js | 1 | no direct anomaly observed |
| spec-slack-research | standalone_skill | skill/skill | spec-slack-research-contracts.test.js | 1 | no direct anomaly observed |
| spec-update | workflow_command | command/skill | spec-update-contracts.test.js | 1 | no direct anomaly observed |
| spec-work | workflow_command | command/skill | spec-work-beta-contracts.test.js<br>spec-work-contracts.test.js<br>spec-work-run-artifact-contract.test.js | 2 | no direct anomaly observed |
| spec-work-beta | standalone_skill | skill/skill | spec-work-beta-contracts.test.js | 3 | no direct anomaly observed |
| test-browser | standalone_skill | skill/skill | test-browser-contracts.test.js | 1 | mirror drift; source also mixes `/spec:mcp-setup` and `/spec:setup` |
| test-xcode | standalone_skill | skill/skill | test-xcode-contracts.test.js | 1 | no direct anomaly observed |
| todo-create | standalone_skill | skill/skill | todo-create-contracts.test.js | 2 | no direct anomaly observed |
| todo-resolve | standalone_skill | skill/skill | todo-resolve-contracts.test.js | 1 | no direct anomaly observed |
| todo-triage | standalone_skill | skill/skill | todo-triage-contracts.test.js | 1 | no direct anomaly observed |
| using-spec-first | standalone_skill | skill/skill | using-spec-first-contracts.test.js<br>using-spec-first-runtime-contracts.test.js | 1 | no direct anomaly observed |

## skill 内部资产补充

在用户明确要求“每一个 skill 都要认真分析里面的每一个文档、脚本”之后，我又追加了一层只针对 `skills/` 的内部资产覆盖。

这层覆盖：

- 只看 `skills/<skill>/` 内的 `SKILL.md`、`references/`、`assets/`、`scripts/`、其他内部文件
- 只看直接命中的 `tests/`
- 不把 `docs/` 下的说明文档继续作为主分析对象

追加覆盖后，新坐实的 skill 内部问题有：

1. `test-browser` 不只是 mirror 漂移，source skill 自己也同时保留了 `/spec:mcp-setup` 与 `/spec:setup`
2. `feature-video`、`gemini-imagegen` 的 skill 目录内部确实包含 `__pycache__/*.pyc`
3. `proof` 仍没有以 skill 名命名的专属 contract test
4. `spec-mcp-setup` 是高脚本密度 skill，但当前仍主要靠 shell 侧和宿主治理侧测试兜底

逐 skill 的完整内部文件清单、测试命中与内部结论见：

- [2026-04-23-skill-内部资产全覆盖附录-紧凑版.md](/Users/kuang/xiaobu/spec-first/docs/项目审查/2026-04-23-skill-内部资产全覆盖附录-紧凑版.md)

## agent / mirror 附录

- agent markdown 总数：55
- `docs/10-prompt/agents` mirror 缺失：8
- `docs/10-prompt/agents` mirror drift：46
- byte-equal：1

这不是“文档没同步完”的轻微问题，而是当前 knowledge mirror 治理明显弱于 runtime 治理的直接证据。
