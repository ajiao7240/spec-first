# Spec-First 项目代码审查报告

文档角色：`仓库级总审查报告`  
阅读优先级：`第一篇`  
关联专项：`spec-graph-bootstrap`  
后续路线图：[2026-04-18-spec-graph-bootstrap-optimization-roadmap.md](/Users/kuang/xiaobu/spec-first/docs/项目审查/spec-graph-bootstrap/2026-04-18-spec-graph-bootstrap-optimization-roadmap.md)

日期：`2026-04-18`  
范围：当前工作区中的 `spec-first` 仓库  
审查依据：以仓库内代码、测试、脚本、manifest、workflow 资产为主，文档仅作辅助证据

本报告是仓库级主结论；若要继续查看最关键的 Stage-0 / bootstrap 输入问题，请转到 [2026-04-18-spec-graph-bootstrap-audit.md](/Users/kuang/xiaobu/spec-first/docs/项目审查/spec-graph-bootstrap/2026-04-18-spec-graph-bootstrap-audit.md)。

## 证据标签说明

- `[代码已证实]` 结论可直接由仓库代码、脚本、测试或本次执行结果证明
- `[高可信推断]` 结论不是某一条单一代码事实，但由多条代码事实共同强支持
- `[文档声明但代码未充分证实]` 文档或技能文本有表述，但代码侧没有足够硬约束
- `[无法从仓库单独证实]` 需要真实宿主、真实团队使用或外部运行环境才能确认

## 已执行验证

- `[代码已证实]` 在 `2026-04-18` 重新执行了 `npm run test:smoke`，通过
- `[代码已证实]` 在 `2026-04-18` 重新执行了 `npm run test:unit`，通过
- `[代码已证实]` 当前 `unit` 状态为 `98 / 98` 个 suite、`489 / 489` 个 test 全绿
- `[代码已证实]` 本轮复审过程中，`unit` 曾短暂暴露两类高信号问题，随后已被收口：
  1. `CHANGELOG.md` 顶部说明块缩进漂移，触发 `tests/unit/changelog-format.test.js`
  2. `verification_summary / verifier_dispatch / verification_gate_state` 在演进过程中的消费口径漂移，曾体现在 `stage0-context-command` 与 `workspace-context` 相关断言上
- `[高可信推断]` 当前门禁虽已恢复为绿，但这次暴露出的不是随机噪音，而是同一类问题：Stage-0 决策输入 contract 在快速演进时，测试、telemetry、运行时消费边界需要更早收口

---

# 0. 管理层摘要

## 0.1 一句话结论

`spec-first` 更像一个“用轻 contract、明确边界和结构化运行时输入来提升 LLM 决策质量”的 AI 工程治理平台，而不是一个把整条流程硬编码成状态机的编排器；它当前的主要短板不是“没做硬状态机”，而是部分决策输入仍不够真、不够稳。`[高可信推断]`

## 0.2 总分与成熟度

- 总分：**69 / 100**
- 成熟度：**团队试点**
- 核心判断：**值得继续投入，且主线应继续沿“LLM 决策输入平台”深化，而不是转向重状态机编排**。`[高可信推断]`

## 0.3 最强的 3 个方面

1. 双宿主 runtime governance 做得扎实，`plugin.json`、`skills-governance.json`、adapter、runtime boundary 之间的关系是清楚且有测试支撑的。`[代码已证实]`
2. `init` / `doctor` / `clean` 不是薄拷贝脚本，而是带有 managed state、迁移与 drift 检测能力的受管安装生命周期。`[代码已证实]`
3. CRG、Stage-0 context routing、verification summary、bootstrap compiler 让它开始具备“给 LLM 提供更好决策输入”的真实基础，而不是只提供流程话术。`[代码已证实]`

## 0.4 最高优先级的 5 个风险

1. graph bootstrap / Stage-0 当前更强地证明“产物可组装”，而不是“真实仓库事实被抽取成功”，这会直接污染 LLM 的决策输入。`[代码已证实]`
2. 系统采用的是轻 contract 策略，但“哪些由代码保证、哪些交给 LLM 判断”的边界还不够显式。`[高可信推断]`
3. 当前默认 unit gate 已恢复为绿，但 recent drift 已证明治理面仍存在脆弱点。`[代码已证实]`
4. `verification_summary / verifier_dispatch / verification_gate_state / telemetry` 的 runtime contract 正在演进，边界若不及时收口，就会直接体现在 unit 漂移上。`[代码已证实]`
5. 测试体系偏 contract / packaging，对真实 host 行为和决策输入质量的证明仍偏弱。`[高可信推断]`

## 0.5 系统定位判断

- 它当前更像：**LLM 决策输入平台 + workflow governance layer**
- 它当前不像：**重状态机工作流编排器**
- 这个定位本身不是问题；问题在于与该定位配套的输入真实性、置信度语义和边界语义还没完全补齐。`[高可信推断]`

## 0.6 30 / 60 / 90 天整改建议

- **30 天内**
  保持默认 unit gate 持续为绿：冻结 `verification_summary / verifier_dispatch / verification_gate_state / telemetry` 的当前 contract 与测试断言，尤其是 `verification_gate_state` 已独立成状态对象后的消费口径；同时把 `CHANGELOG.md` 这类治理格式漂移继续纳入快速回归。同步明确 `.claude/tasks` 旧控制面的去留策略。`[代码已证实]`
- **60 天内**
  收窄或修正 bootstrap “complete” 语义，让成功必须依赖真实分析输入；给 `doctor` 增加可选 runnable probe，并把“代码保证 vs LLM 判断”的边界显式暴露到运行时元数据里。`[高可信推断]`
- **90 天内**
  不必默认引入重状态机；优先补 `freshness`、`confidence`、`fallback_reason`、真实宿主 discovery / execution 测试，并把 docs mirror 进一步收口为可重建派生产物。`[高可信推断]`

## 0.7 本次复审工作顺序

1. 先复核入口与治理真源，包括 `bin/spec-first.js`、`src/cli/index.js`、`src/cli/plugin.js`、`skills-governance.json`、`.claude-plugin/plugin.json`。`[代码已证实]`
2. 再重建安装链、Stage-0 链和 bootstrap 链，确认哪些是代码保证、哪些是 prompt 合同。`[代码已证实]`
3. 然后重新跑高信号验证命令，以当日实测结果替换报告中的旧测试状态。`[代码已证实]`
4. 最后只把风险收敛到“决策输入真值、边界语义、运行时 contract 漂移”三类，不把“没有硬状态机”误判成主缺陷。`[高可信推断]`

---

# 1. 项目本质定义

## 一句话定义

`spec-first` 本质上是一个面向 Claude Code 与 Codex 的 AI 工作流资产编译器与治理层，配套一个较小但不算薄的安装/修复 CLI，并叠加一个正在成形的 Stage-0 / CRG 上下文底座。`[代码已证实]`

## 边界说明

它实际在做什么：

1. 通过 `init`、`doctor`、`clean` 安装并修复宿主相关的 workflow assets、skills、agents、治理块和受管状态。`[代码已证实]`
2. 通过 `.claude-plugin/plugin.json` 和 `src/cli/contracts/dual-host-governance/skills-governance.json` 维护双宿主可交付治理合同。`[代码已证实]`
3. 提供了真实代码实现的 CRG 图构建/查询、Stage-0 上下文选择、verification summary 推导和 bootstrap 产物编译。`[代码已证实]`
4. 以 `docs/brainstorms/`、`docs/plans/`、`docs/solutions/`、`docs/contexts/` 为耐久工件输出面。`[代码已证实]`

它没有真正做到什么：

1. 它没有把 `brainstorm -> plan -> work -> review -> compound` 主链实现成 CLI 内部的硬状态机；从代码事实看，这更像设计取向而不是单纯遗漏。`[代码已证实]`
2. 它不能保证 Claude Code 或 Codex 在资产安装后一定严格遵守这些 workflow contract，因此它更依赖边界清晰和输入质量，而不是强流程。`[高可信推断]`
3. 它不是自动代码生成器，而是一个约束 AI 如何协作、并为 AI 提供可复用决策输入的 workflow / governance harness。`[代码已证实]`
4. 它还不是一个从真实仓库分析直接端到端生成高可信 bootstrap 的成熟平台，当前 bootstrap compiler 仍有 sample / scaffold 风格成功路径。`[代码已证实]`

## 审查结论

`spec-first` 是一个真实的软件工程系统，不是“高级提示词集合”这么简单；它的合理主线不是“把流程全部编进状态机”，而是“用轻 contract 和更高质量的上下文输入，提升 LLM 决策质量”。当前问题在于这条主线已经成形，但输入真实性和边界语义还不够扎实。`[高可信推断]`

---

# 2. 基于代码事实的项目结构总览

## 2.1 目录结构解读

- `bin/spec-first.js`
  发布入口，负责在经典 CLI 与 CRG CLI 之间做第一层分流。`[代码已证实]`
- `src/cli/`
  安装、修复、治理层。当前文件数：23。`[代码已证实]`
- `src/crg/`
  代码图子系统，覆盖 parser、graph persistence、增量构建、retrieval、review-context 和图分析。当前文件数：46。`[代码已证实]`
- `src/bootstrap-compiler/`
  Stage-0 控制面编译层。当前文件数：19。`[代码已证实]`
- `src/context-routing/`
  运行时上下文加载、评估、verification summary 选择层。当前文件数：10。`[代码已证实]`
- `skills/`
  技能与 workflow 资产的源码真源目录。当前目录数：48。`[代码已证实]`
- `agents/`
  Agent profile 源码真源目录。当前 Markdown 文件数：57，support file 数：4。`[代码已证实]`
- `templates/claude/commands/spec/`
  Claude 侧 13 个 command-backed workflow 模板。`[代码已证实]`
- `docs/10-prompt/`
  提示词文档镜像层，是人类可读镜像，不是 runtime 真源。`[代码已证实]`
- `tests/`
  一个混合测试面：96 个 Jest unit suite、若干 shell unit、4 个 smoke、2 个 integration、3 个 e2e。`[代码已证实]`

## 2.2 运行时资产规模

使用 `buildFilteredAssetSet()` 统计：

- Claude 运行时：13 个 commands、13 个 workflow skills、35 个 standalone skills、57 个 agents、4 个 support files。`[代码已证实]`
- Codex 运行时：0 个 commands、13 个 workflow skills、34 个 standalone skills、57 个 agents、4 个 support files。`[代码已证实]`

这说明该项目不是“几个命令模板 + 一个薄 CLI”这么简单。已安装的 prompt/runtime 资产本身就是产品主体之一。`[代码已证实]`

## 2.3 文本版分层架构图

```text
用户 / 宿主运行时
  -> Claude / Codex 调用已安装 command 或 skill 入口
    -> .claude/ 或 .agents/skills/ 下的运行时资产指挥宿主行为

包入口层
  -> bin/spec-first.js
    -> src/cli/index.js
      -> init / doctor / clean / stage0-context
      -> plugin.js + adapters/* + state.js + developer.js
      -> 写入受管 runtime 资产与治理块

并行子系统
  -> spec-first crg ...
    -> src/crg/cli/router.js
    -> parser.js / graph.js / changes.js / flows.js / analyze.js / retrieval/*
    -> SQLite 图数据库 + 派生 review/context 数据

Stage-0 子系统
  -> src/bootstrap-compiler/*
  -> src/context-routing/*
  -> stage0-context 命令
  -> plan/work/review workflow 消费 selected assets + verification summary

治理真源层
  -> .claude-plugin/plugin.json
  -> src/cli/contracts/dual-host-governance/skills-governance.json
  -> skills/
  -> agents/

文档与镜像层
  -> docs/10-prompt/*
  -> docs/contexts/*
  -> docs/brainstorms/*
  -> docs/plans/*
  -> docs/solutions/*
```

## 2.4 各层职责是否清晰

### 相对清晰的层

1. `src/cli/` 负责安装/治理/修复，这一层边界较清楚。`[代码已证实]`
2. `src/cli/adapters/claude.js` 与 `src/cli/adapters/codex.js` 将宿主差异集中在路径、runtime 文件与文本转换层。`[代码已证实]`
3. 双宿主可交付治理被收敛到 `plugin.js` 与 `skills-governance.json`。`[代码已证实]`
4. `src/crg/` 是独立的真实子系统，不是摆设目录。`[代码已证实]`
5. `bootstrap-compiler/*` 与 `context-routing/*` 基本形成了 Stage-0 编译与消费的分层。`[代码已证实]`

### 职责泄漏与边界不清

1. 对用户最关键的工作流行为并不在 CLI 层执行，而是下沉到 `SKILL.md` 文本合同里。`[高可信推断]`
2. `docs/10-prompt/` 作为 prompt mirror，形成了一个额外的人类侧同步面。`[代码已证实]`
3. `scripts/task-manager.sh`、`scripts/stage-gate.sh`、`scripts/review-judge.sh` 代表旧控制面，仍和当前以 docs / control-plane 为核心的新路径并存。`[代码已证实]`

---

# 3. 关键执行链路复盘

## 3.1 CLI 主入口链路

执行从 `bin/spec-first.js` 开始：

1. 如果第一个参数是 `crg`，转入 `src/crg/cli/router.js`
2. 否则进入 `src/cli/index.js`
3. `src/cli/index.js` 支持 `doctor`、`init`、`clean`、`stage0-context`

这意味着发布出的可执行体有两种人格：

- 经典安装/治理 CLI
- CRG 图系统 CLI

`[代码已证实]`

## 3.2 `init` 执行链

`src/cli/commands/init.js` 是当前经典 CLI 的核心编排点。

真实执行链：

1. 解析 `--claude` / `--codex` / `--user` / `--lang`
2. 选择 adapter
3. 读取既有 managed state，并检测 legacy state
4. 读取 plugin manifest 与治理过滤后的 asset set
5. 解析 developer identity
6. Claude 场景下校验 `.claude/settings.json`
7. 如有 legacy state，执行 managed hard reset
8. 移除过时受管资产
9. 同步 commands / skills / agents / support files
10. 写入 language policy block
11. 写入 `using-spec-first` bootstrap block
12. Claude 场景下安装 SessionStart hook
13. 若 `CHANGELOG.md` 缺失则 bootstrap
14. 写入 developer file
15. 写入受管 state

所以 `init` 不是一个薄薄的 copy 命令，而是一个“受管运行时交易”。`[代码已证实]`

## 3.3 `doctor` 执行链

`src/cli/commands/doctor.js` 检查：

- Node 版本
- Git 是否存在
- plugin manifest 是否可读
- CRG CLI 与原生模块是否可加载
- `claude --version` / `codex --version`
- developer file 是否存在、是否完整、版本是否匹配
- managed state 是否存在、是否完整、版本是否匹配
- bootstrap block 是否存在/漂移
- Claude SessionStart hook 是否存在/漂移
- commands / skills / agents / support files 是否缺失或 out of sync

判断：

- `[代码已证实]` `doctor` 对“安装是否健康、运行时资产是否漂移”很有用
- `[高可信推断]` 它不是一个真正的“工作流是否可跑通”的可运行性检查器
- `[代码已证实]` 它更偏 existence/drift 检查，不会从宿主内部真实执行一个 `spec:*` 或 `$spec-*` workflow 入口来验证端到端可用性

## 3.4 `clean` 执行链

`src/cli/commands/clean.js` 的行为：

1. 读取 managed state
2. 对 legacy state 直接拒绝模糊清理，要求先 re-init
3. 只删除受管资产
4. 移除受管 bootstrap block 与 SessionStart hook
5. 移除 runtime files 与 state
6. 明确保留用户自定义资产

这套 clean 设计是稳的。`[代码已证实]`

## 3.5 Stage-0 运行时链路

`src/cli/commands/stage0-context.js`：

1. 解析 `--stage`、`--cwd`、`--target`、`--repo-root`、`--changed-file`
2. 若未显式给 changed files，则通过 Git 自动检测
3. 调用 `compileWorkspaceContext()`
4. 返回供 workflow runtime 消费的 JSON

`src/bootstrap-compiler/workspace-compiler.js` 中的 `compileWorkspaceContext()` 再继续：

1. 解析 repo / workspace entry
2. 通过 `context-routing/evaluator.js` 选择 selected assets
3. 通过 `context-routing/verification-summary.js` 构造 verification summary
4. 返回一份压缩过的 machine-readable contract 给运行时

这是当前项目少数真正把 prompt workflow 转成“代码支持的运行时输入”的地方。`[代码已证实]`

## 3.6 CRG 执行链

CRG 子系统是真实存在且有工程厚度的：

- `src/crg/parser.js`
  基于 tree-sitter 的多语言解析，支持 graceful degradation。`[代码已证实]`
- `src/crg/graph.js`
  SQLite 数据层，负责节点/边 upsert、删除、解析与 unresolved 处理。`[代码已证实]`
- `src/crg/changes.js`
  负责 diff 解析与节点级 review priority 风险评分。`[代码已证实]`
- `src/crg/flows.js`
  负责调用流检测与 criticality 评分。`[代码已证实]`
- `src/crg/analyze.js`
  负责 surprising connections 与 god nodes 分析。`[代码已证实]`
- `src/crg/cli/build.js`
  负责 build / stats 生命周期、原生依赖兜底、unresolved 摘要输出。`[代码已证实]`

这是证明该项目不只是 prompt 打包器的最强证据之一。`[代码已证实]`

---

# 4. 流程 contract 与决策输入审查

本节回答两个核心问题：工作流到底是谁在 enforce，以及系统到底给 LLM 提供了什么级别的决策输入。

## 4.1 总体判断

- `[代码已证实]` 主流程模型完整存在于资产层：ideate / brainstorm / plan / work / review / compound / bootstrap / mcp-setup / graph-bootstrap
- `[高可信推断]` 当前形成的是“轻 contract + runtime input augmentation”的工作流系统，而不是代码状态机闭环
- `[代码已证实]` 硬约束主要集中在：运行时安装、资产过滤、managed state、host setup marker、Stage-0 helper、docs/solutions 合同
- `[代码已证实]` 软约束主要集中在：主链工作流顺序、每一步的提问/协作方式、review persona 编排、compound 输出策略
- `[高可信推断]` 这种分层本身是合理的；真正需要盯紧的是 LLM 每一步拿到的输入是否足够真、足够稳、足够可解释

## 4.2 按流程逐项检查

| 流程 | 入口 | 主契约 | 工件输出 | 关键决策输入 | 依赖关系 | 硬约束/软约束 | 主要 enforcement 来源 |
|---|---|---|---|---|---|---|---|
| Ideate | manifest + `skills/spec-ideate/SKILL.md` | ideation workflow contract | `docs/ideation/` | 主要还是 prompt 内部的选题/评估指令，代码侧决策输入较弱 | 位于 brainstorm 前 | 以软约束为主 | 宿主遵守 skill 文本 |
| Brainstorm | command template + `skills/spec-brainstorm/SKILL.md` | requirements 对齐合同 | `docs/brainstorms/` | 以前序文档、仓库上下文和 prompt 追问为主，代码侧缺少更强的 machine-readable requirements input | 应先于 plan | 以软约束为主 | 宿主遵守 skill 文本 |
| Plan | command template + `skills/spec-plan/SKILL.md` | plan contract + Stage-0 preload 说明 | `docs/plans/` | `stage0-context`、selected assets、minimal-context/plan、verification summary | 应接 brainstorm | 软约束为主，辅以 helper | 宿主 + `stage0-context` |
| Work | command template + `skills/spec-work/SKILL.md` | execution contract + verification checklist | 代码改动 + tests | `stage0-context`、minimal-context/work、change surface、verification summary、dispatch posture | 应接 plan | 软约束为主，辅以 helper | 宿主 + `stage0-context` |
| Review | command template + `skills/spec-review/SKILL.md` | review contract + persona route + gap checklist | findings / review 产物 | `stage0-context`、minimal-context/review、verification gaps、review context、风险信号 | 应接 work | 软约束为主，辅以 helper | 宿主 + `stage0-context` |
| Compound | command template + `skills/spec-compound/SKILL.md` | solution 文档沉淀合同 | `docs/solutions/` | 主要消费 review / fix 结果与 docs/solutions 合同，输入结构化程度中等 | 应接 review/fix 结果 | 执行软约束，输出较硬 | 宿主 + docs/tests 合同 |
| Bootstrap | `skills/spec-graph-bootstrap/SKILL.md` | Stage-0 supporting workflow 合同 | `docs/contexts/<slug>/` | 仓库事实、bootstrap compiler 产物、control-plane samples，但当前真值性不足 | 主流程上游支撑 | 以软约束为主 | 宿主 + 可选工具 |
| MCP Setup | `skills/spec-mcp-setup/SKILL.md` + shell / PowerShell scripts | host install/config 合同 | host marker + host config | baseline tools presence、marker file、verify 输出 | richer workflow 前置条件 | 相对硬 | 真脚本 + marker file |
| Graph Bootstrap | `skills/spec-graph-bootstrap/SKILL.md` + bootstrap compiler | graph-informed bootstrap 合同 | control-plane + docs assets | fact inventory、risk signals、test surface、verification profile；但 sample-friendly success path 仍会稀释真值 | Stage-0 machine context 上游 | 混合，但代码强度低于宣称 | prompt orchestration + compiler |

### 4.2.1 判断

- `[代码已证实]` 真正开始提供强决策输入的阶段，主要集中在 `plan` / `work` / `review`，而不是 ideate / brainstorm。
- `[高可信推断]` 这与项目路线是一致的：前段更像协作式需求探索，后段才逐步引入 machine-readable context。
- `[高可信推断]` 因此当前最该补的不是“让前段也重编排”，而是把后段已经引入的决策输入做得更真实、更可解释。

## 4.3 “宣称闭环”与“实际闭环”的差异

### 需求澄清 -> 规划 -> 实施 -> 评审 -> 知识沉淀

- `[代码已证实]` 仓库中确实为每一步都定义了 workflow asset
- `[代码已证实]` 也确实为每一步都设计了耐久工件落点
- `[高可信推断]` 它明显提高了 AI 宿主沿着规范流程工作的概率
- `[代码已证实]` 它不会从代码层强制阻止宿主跳过 brainstorm 或 plan；这本身不一定是问题，前提是后续阶段能拿到足够好的上下文、风险和验证输入

### Bootstrap / Stage-0

- `[代码已证实]` `stage0-context` 是一个真实存在的运行时 helper
- `[代码已证实]` evaluator / verification-summary 也是实代码
- `[代码已证实]` 但 `runBootstrap()` 当前可以在空临时仓库上通过 `DEFAULT_CONTEXT_DOCS` 与 compiler/sample 默认值产出一个“complete” bootstrap
- `[代码已证实]` `tests/e2e/spec-graph-bootstrap-mainline.sh` 明确把这种空仓成功路径视为可接受

这意味着：当前 Stage-0 compiler 更强地证明了“产物形状可组装”，而不是“真实项目事实被正确抽取”。对于一个以 LLM 决策输入质量为主线的系统，这是比“没做硬状态机”更实质的缺口。`[高可信推断]`

### MCP Setup

这是项目里最接近硬工程闭环的一段：

- 真脚本存在
- 真 marker 会写
- 真 host config 会改
- verify 脚本会确认 baseline 工具已注册

`[代码已证实]`

## 4.4 工程 contract 与提示词 contract 的区别

### 工程闭环

例子：

- `src/cli/state.js` 的 managed state
- `src/cli/plugin.js` 的双宿主资产过滤
- bootstrap block 与 SessionStart hook 的受管写入/检查
- `stage0-context` 命令返回的 JSON contract
- `docs/solutions` frontmatter/category 合同测试

这些是硬软件机制。`[代码已证实]`

### 提示词闭环

例子：

- `skills/spec-brainstorm/SKILL.md` 里“不允许跳过 alignment 直接 work”
- `skills/spec-plan/SKILL.md` 里“brainstorm 定 WHAT，plan 定 HOW”
- `skills/spec-review/SKILL.md` 里 persona 路由、action class、autofix policy

这些是结构化、价值高的合同，但本质上仍是宿主执行 prompt 的结果。只要系统清楚承认这一点，并为宿主补足高质量输入，它们并不天然比“代码状态机”低级。`[高可信推断]`

---

# 5. 软件工程质量审查

## 5.1 架构与分层

### 优点

1. 双宿主治理真源是集中化的，`plugin.js` 不只加载 manifest，还验证治理合同与可交付语义。`[代码已证实]`
2. Adapter 层是真的有用，而不是装饰层。Claude 与 Codex 的路径布局、runtime 文件、文本变换都集中在 adapter。`[代码已证实]`
3. managed state 与 clean 机制比一般 prompt installer 更安全，能追踪自己写过什么，只清理受管资产。`[代码已证实]`
4. CRG 与 Stage-0 都不是虚设目录，而是有实际实现的子系统。`[代码已证实]`

### 问题

1. `init` 职责偏重，迁移、同步、治理块写入、hook 安装、changelog bootstrap、developer identity、state 持久化全都挤在一个命令里。`[代码已证实]`
2. 宿主适配主要靠文本 rewrite，而不是结构化模板渲染，`transformCodexContent()` 与 Claude 侧 rewrite 都是 regex 密集型实现。`[代码已证实]`
3. bootstrap compiler 当前“产物编排能力”强于“事实抽取能力”。`[代码已证实]`
4. 旧脚本控制面与新 docs/control-plane 路径同时存在，维护负担增加。`[代码已证实]`

## 5.2 稳健性、幂等性、文件安全

### 做得好的地方

- 多处使用原子写入：`lang-policy`、`instruction-bootstrap`、`claude-settings`、`state`。`[代码已证实]`
- `init` / `clean` 基本具备状态感知与幂等思路，且显式保护自定义资产。`[代码已证实]`
- legacy state 检测明确，且通过 managed hard reset 路径收口。`[代码已证实]`
- bootstrap 有 context/control-plane backup + rollback 逻辑。`[代码已证实]`

### 薄弱点

- 当前 bootstrap 的 success 语义仍可能建立在 placeholder 产物之上。`[代码已证实]`
- 若干 repo 辅助脚本不符合仓库自己声明的 shell 规范，而且带有 macOS 绑定实现。`[代码已证实]`

## 5.3 命令解析与参数校验

总体上，CLI 参数解析是显式且可读的。

优点：

- 主 CLI 对未知参数较保守，能尽早报错。`[代码已证实]`

问题：

- `init` 解析了 `--force`，但执行逻辑中没有使用，这属于死参数面与 contract 漂移。`[代码已证实]`
- `src/cli/skills.js` 与 `src/cli/agents.js` 这类 wrapper 模块看起来更像残留接口，不在主执行链路里。`[高可信推断]`

## 5.4 单一真相源问题

### 做得比较好的地方

- runtime delivery classification 真源集中在 `src/cli/contracts/dual-host-governance/skills-governance.json`。`[代码已证实]`
- `tests/unit/runtime-contract-boundary.test.js` 明确限制 runtime governance path 的所有权只在 `plugin.js`。`[代码已证实]`

### 仍存在的多真相源风险

当前至少有以下同步面：

1. `skills/`
2. `docs/10-prompt/skills/`
3. `.claude/` 或 `.agents/skills/` 下的运行时生成副本
4. `.claude-plugin/plugin.json` 中的 command 定义
5. `skills-governance.json` 中的 host delivery 定义

项目通过测试来压住漂移，但这仍然是“同步管理”，不是“重复被消灭”。`[代码已证实]`

## 5.5 `doctor` 的能力边界

结论：

- `[代码已证实]` `doctor` 对安装健康度和资产漂移检测很有价值
- `[高可信推断]` 它还不是一个真正的 workflow runnable probe

原因：

- 它会检查 `claude --version` / `codex --version`
- 会检查文件漂移、state、hook、settings
- 会检查 CRG 原生模块可加载性
- 但不会从宿主内部真实执行 workflow 入口验证 command / skill discovery 与执行路径

## 5.6 CLI 到底是不是一个薄安装壳

判断：

- 不是。单看 `managed state`、`dual-host governance`、`adapter transforms`、`stage0-context`、`CRG`、`bootstrap compiler`，它已经具备真实平台治理能力。`[代码已证实]`
- 主用户工作流的纪律性仍主要由已安装 prompt 资产来实现，而 CLI 更像是为宿主提供治理边界和决策输入。按当前产品方向看，这不是缺陷本身，缺陷在于输入质量还未完全收口。`[高可信推断]`

---

# 6. AI 决策增益价值审查

## 6.1 它提升 AI 编码质量的核心机制是什么

核心机制链条如下：

1. 安装具名 workflow 入口和宿主侧 runtime assets
2. 用轻 contract 明确每个阶段应消费什么工件、输出什么工件，而不是把每一步强编码成状态机
3. 把 `docs/brainstorms`、`docs/plans`、`docs/solutions`、`docs/contexts` 固化成耐久工件
4. 通过 Stage-0 上下文、verification summary、风险/验证信号，把这些工件重新压缩成 machine-readable 决策输入喂给运行时
5. 再叠加语言治理、changelog 治理、双宿主可交付治理与 runtime repair，降低上下文漂移和行为漂移

这就是它真正提升 AI 编码质量的机制。它提升质量的关键，不是“更强地命令 LLM”，而是“让 LLM 在更好的输入面上做决定”。`[高可信推断]`

## 6.2 它最明显提升的是哪几类质量

提升最明显的维度：

- 需求质量。`[高可信推断]`
- 设计/规划质量。`[高可信推断]`
- 评审结构质量。`[高可信推断]`
- 知识沉淀质量。`[代码已证实]`
- 团队治理一致性。`[代码已证实]`

提升较弱的维度：

- 实现正确性本身。`[高可信推断]`
- 决策输入真实性还不够稳定的部分。`[代码已证实]`
- 宿主对流程合同的严格遵守证明。`[无法从仓库单独证实]`

## 6.3 它在哪些地方已经超出“提示词文件化”

因为它除了 prompt 资产，还做了：

- managed install / clean / state lifecycle
- dual-host delivery governance
- adapter transforms
- `docs/solutions` 知识库合同
- CRG 代码图子系统
- Stage-0 runtime helper 与 verification summary

所以它已经明显超出“把提示词存成文件”。`[代码已证实]`

## 6.4 它在哪些地方仍然本质上是 prompt system

主工作流语义仍然仍是 prompt-native 的：

- ideate 怎么做
- brainstorm 何时停
- plan 怎样提问
- review 如何调度 reviewer
- compound 如何选择 lightweight / full

这些关键行为不是 CLI 状态机在跑，而是 `SKILL.md` 在描述。`[代码已证实]`

## 6.5 它引入的新复杂度

新增复杂度包括：

1. 模板漂移
2. docs mirror 漂移
3. 宿主侧文本变换漂移
4. 手工 changelog / governance 纪律成本
5. 仓库被 workflow/context 资产占用更多心智空间
6. 旧控制面与新控制面并存带来的理解负担

这些都是真实的工程成本。`[高可信推断]`

---

# 7. 测试与质量保障审查

## 7.1 当前测试体系覆盖了什么

### Unit 层

Unit 层覆盖了：

- CLI state / governance / helper
- adapter transforms
- dual-host governance contract
- 大量 skill contract
- CRG parser / graph / build / incremental 逻辑
- Stage-0 context routing 与 workspace context
- `docs/solutions` frontmatter / category contract
- 部分 benchmark smoke contract

`[代码已证实]`

一个重要量化信号：

- 96 个 Jest unit suite 中，有 53 个名字是 `*-contracts.test.js`。`[代码已证实]`

这说明 unit 层明显偏 contract 检查。`[代码已证实]`

### Smoke 层

`tests/smoke/` 验证：

- install-local
- CLI help / version / init / doctor / clean 主路径
- tarball 打包安装路径
- release 双宿主治理打包边界

这部分是有用户路径意义的。`[代码已证实]`

### Integration 层

Integration 目前比较窄：

- `tests/integration/e2e.sh`
- `tests/integration/spec-brainstorm-flow.sh`

但主 integration 脚本仍然主要验证旧的 `.claude/tasks/<task-id>/` 脚本式流程。`[代码已证实]`

### E2E 层

E2E 层验证：

- CRG all commands
- CRG SQLite audit
- graph bootstrap mainline

有价值，但距离真实宿主执行还有距离。`[代码已证实]`

## 7.2 测试体系没有很好覆盖什么

1. 真实 Claude Code / Codex 宿主中的入口发现与执行。`[无法从仓库单独证实]`
2. 已安装 `SKILL.md` 合同在真实宿主中的服从性。`[无法从仓库单独证实]`
3. graph/bootstrap 在真实复杂仓库上的高可信抽取质量。`[高可信推断]`
4. 旧 `.claude/tasks` 模型与当前 docs/control-plane 模型之间的迁移/退役一致性。`[代码已证实]`

## 7.3 这套测试更像什么

当前测试体系更像：

- 强 contract verification
- 较好的 install / package smoke verification
- 中等的子系统 unit coverage
- 较弱的真实宿主行为验证
- 较弱的“决策输入是否真实可信”验证

`[高可信推断]`

它还不足以单独证明工作流执行语义长期不漂移。`[高可信推断]`

## 7.4 本次实测结果

- `npm run test:smoke`：通过。`[代码已证实]`
- `npm run test:unit`：通过。`[代码已证实]`

本轮最终状态：

1. `unit` 最终为 `98 / 98` 个 suite、`489 / 489` 个 test 全绿。`[代码已证实]`
2. `smoke` 复跑通过，说明安装、初始化、runtime 资产生成、doctor、clean 的主路径没有被本轮审查动作打坏。`[代码已证实]`
3. 本轮中途确实暴露过两类问题：`CHANGELOG.md` 顶部格式漂移，以及 `verification_summary / verifier_dispatch / verification_gate_state` 的消费口径漂移；两者最终都已被收口。`[代码已证实]`

判断：

- `[代码已证实]` 当前默认质量门已经恢复为绿。
- `[高可信推断]` 但这次过程仍然很有信息量：问题并不是“系统缺状态机”，而是“决策输入 contract 演进过快时，测试、telemetry 与消费口径是否同步收口”。
- `[高可信推断]` 这恰好印证了本报告的主判断：该项目的关键质量面不是“有没有重状态机”，而是“决策输入 contract 是否真实、稳定、可解释”。

## 7.5 缺失的高价值测试

1. 真实宿主 discovery / execution 测试
2. 基于真实 fixture repo 的 bootstrap extraction 测试
3. `verification_summary / verifier_dispatch / verification_gate_state / telemetry` 的边界一致性测试，而不是让多个层各自演进
4. 全量 docs mirror 生成一致性测试，而不只是抽样 contract spot-check
5. legacy `.claude/tasks` 路径是否退役或保留的显式迁移测试
6. 多 repo / 多 changed-file 形态下 verification summary 的行为测试

## 7.6 测试成熟度评分

当前测试成熟度：**6 / 10**

理由：

- contract 与 packaging 做得比较扎实
- 真实 host 行为与工作流执行闭环验证仍偏弱

---

# 8. 问题与风险清单

| 编号 | 问题 | 级别 | 证据 | 影响 | 建议 |
|---|---|---|---|---|---|
| R1 | 轻 contract 策略的边界不够显式，用户容易把“软流程”误解成“硬 enforce” | P1 | `src/cli/index.js`、`src/cli/plugin.js` 主要保证安装/治理，而核心行为位于 `skills/spec-*.md` 与 `stage0-context` 输入层 | 问题不在于没做状态机，而在于系统边界若不清晰，用户会错误预期它能强制约束宿主行为 | 在 docs、runtime metadata 与 doctor 输出中显式声明：哪些由代码保证，哪些交给 LLM 决策 |
| R2 | graph bootstrap mainline 当前更像“产物装配成功”，不是“真实分析成功” | P1 | `src/bootstrap-compiler/run-bootstrap.js` 使用 `DEFAULT_CONTEXT_DOCS`、compiler/sample 默认值；`tests/e2e/spec-graph-bootstrap-mainline.sh` 在空仓通过 | 对 Stage-0 / graph-informed 的宣称强于真实代码能力 | 要么收窄宣称，要么补真实 analyzer-backed bootstrap runner |
| R3 | 默认 unit gate 虽已恢复为绿，但治理格式与决策输入 contract 仍是近期真实脆弱面 | P1 | 本轮曾暴露 `tests/unit/changelog-format.test.js` 与 Stage-0 contract 相关失败，最终已修复并回归全绿 | 风险不再是“现在就红”，而是这类边界漂移若无快速回归会再次削弱治理可信度 | 保持 `CHANGELOG` 规则与 Stage-0 contract 守卫为高优先级回归项 |
| R4 | `verification_summary / verifier_dispatch / verification_gate_state / telemetry` 的边界仍在漂移风险区 | P1 | 当前代码已把 verifier dispatch 与 gate state 拆为独立结构；本轮失败与复绿过程都说明其消费口径仍需要显式冻结 | 决策输入层如果边界不稳，LLM 实际消费口径和团队理解口径都会持续分裂 | 明确四者各自职责，补 boundary tests，并在 telemetry/schema/docs 中统一命名和归属 |
| R5 | 旧 `.claude/tasks` 控制面仍在 shipping，且仍是主 integration 测试路径 | P2 | `scripts/task-manager.sh`、`scripts/stage-gate.sh`、`scripts/review-judge.sh`、`tests/integration/e2e.sh` | 新旧两套流程并存，用户心智与维护成本都升高 | 明确退役旧路径，或正式吸收进新控制面 |
| R6 | 多个同步真相源仍然存在 | P2 | `skills/`、`docs/10-prompt/skills/`、runtime 生成副本、manifest、governance json | 任何 workflow 变更都伴随同步负担与漂移风险 | 将 docs mirror 转为可重建派生产物 |
| R7 | `doctor` 更像存在性/漂移检查，不像可运行性检查 | P2 | `src/cli/commands/doctor.js` 只查版本、state、drift、module loadability | 可能出现“doctor PASS 但宿主 workflow 实际跑不动”的错觉 | 增加可选 runnable probe |
| R8 | 宿主适配依赖 regex 文本变换 | P2 | `src/cli/adapters/codex.js`、`src/cli/adapters/claude.js` | 一旦 skill 文本形状变化，转换可能静默失效 | 改成结构化 placeholder + 渲染 |
| R9 | `init` 是职责过重的 orchestration hotspot | P2 | `src/cli/commands/init.js` 同时处理迁移、同步、治理块、hook、changelog、developer、state | 单点回归半径大，review 难度高 | 把 `init` 分拆成内部 pipeline steps |
| R10 | repo 工具脚本不够可移植，且不符合仓库自述 shell 标准 | P2 | `scripts/task-manager.sh` 使用 `sed -i ''`，若干脚本未统一 `pipefail` | 对非 macOS 环境和长期维护不友好 | 改写成更可移植 shell 或 Node 工具 |

## 8.1 建议整改顺序

1. **先保持默认质量门持续为绿**
   优先处理 R3、R4。当前默认 unit gate 虽已恢复，但 recent drift 已证明 runtime verification contract 是高脆弱演进面；如果不继续冻结边界，治理可信度还会反复受损。`[代码已证实]`
2. **再修正 bootstrap 成功语义**
   处理 R2。这个问题会直接影响项目对外叙述与内部信心模型，因为“空仓也能 complete”会模糊真实分析能力边界。`[代码已证实]`
3. **随后补决策输入真值，而不是继续堆 contract**
   联动处理 R1、R4、R7。下一阶段最有价值的投入不是再多写一些合同测试，而是让 workflow 输入、verification summary 与 runnable verification 更接近真实宿主行为。`[高可信推断]`
4. **明确新旧控制面治理边界**
   处理 R5。要么退役 `.claude/tasks` 路径，要么正式吸收到当前 control-plane 叙事中，避免双轨长期并存。`[代码已证实]`
5. **最后收口维护复杂度**
   处理 R6、R8、R9、R10。它们短期不会直接摧毁主路径，但会持续抬高维护成本、降低演进速度。`[高可信推断]`

## 8.2 分步整改计划

### 阶段 1：恢复可信基线

1. 保持 `CHANGELOG.md` 顶部说明块格式与治理测试持续一致，防止再次漂移。
2. 冻结当前 `verification_summary / verifier_dispatch / verification_gate_state / telemetry` 的职责边界。
3. 把对应测试统一到当前边界，维持默认 unit gate 持续绿色。

### 阶段 2：修复输入真值

1. 收窄 bootstrap `complete` 语义，避免 sample-friendly success 路径被误当成高质量分析成功。
2. 为 `freshness / confidence / fallback_reason / dispatch posture` 建立更稳定的运行时 contract。
3. 审查 `plan / work / review` 三个阶段的实际决策输入，删掉弱信号，保留高信号。

### 阶段 3：验证真实可用性

1. 给 `doctor` 增加可选 runnable probe。
2. 增加真实宿主 discovery / execution 测试。
3. 增加 Stage-0 input truth tests，验证 LLM 实际拿到的 selected assets、verification summary 与 telemetry 彼此一致。

---

# 9. 优点总结

以下是工程优点，不是宣传性优点。

1. 双宿主治理是当前仓库里最扎实的部分之一。skill 可交付分类、owner_host、host_delivery、runtime boundary 都被集中建模且有测试守住。`[代码已证实]`
2. 安装生命周期比较成熟。`init` / `doctor` / `clean` 是有状态、具备迁移意识、基本幂等、且尽量不破坏用户资产的。`[代码已证实]`
3. 仓库绝对不只是 prompt。CRG、Stage-0 context routing、verification summary、bootstrap compiler 都是实打实的代码系统。`[代码已证实]`
4. 知识沉淀这件事比大多数 AI 工具仓库定义得更清楚。`docs/solutions/` 的 category、frontmatter、section shape 都有合同测试。`[代码已证实]`
5. Packaging 与 runtime delivery 被当成一等公民问题处理。smoke 测试覆盖了 install-local、tarball install、runtime generation 与 release governance 边界。`[代码已证实]`

---

# 10. 总评分与成熟度判断

## 10.1 分项评分

| 维度 | 分数 / 10 | 理由 |
|---|---:|---|
| 需求工程 | 7.5 | workflow 资产与工件预期很强，且已开始转向“用输入质量提升决策质量” |
| 架构设计 | 7.5 | CLI、CRG、Stage-0、资产层已形成真实子系统 |
| 分层清晰度 | 6.5 | 宏观分层清楚，但 prompt/runtime/doc/legacy 存在交叠 |
| 代码质量 | 7.0 | CommonJS 实现整体显式、可读、具备防御性 |
| 稳健性 | 6.5 | managed state 很稳，但 bootstrap success 语义偏乐观 |
| 测试充分性 | 6.2 | contract 和 smoke 很多，当前 unit gate 已恢复为绿；但 runtime verification contract 边界仍属于高敏感演进面 |
| 可维护性 | 6.5 | 规范化程度不错，但 mirror / governance / init 热点提高了维护成本 |
| 可扩展性 | 7.5 | adapters、治理记录、asset filtering 支持继续扩展 |
| 开发者体验 | 7.5 | install / doctor / clean 体验较强，打包路径清晰 |
| AI 协作增益 | 8.0 | 对流程质量、上下文连续性和决策输入质量提升明显，对实现正确性提升较间接 |
| 规范治理能力 | 8.0 | 是项目当前最强维度之一 |
| 组织可推广性 | 6.5 | 适合有 discipline 的内部团队，不适合低 ceremony 或硬合规场景 |

## 10.2 总分

**69 / 100**

## 10.3 成熟度等级

**团队试点**

原因：

- 已明显超过玩具
- 具备真实内部使用价值
- 但还不足以称为“高置信度、输入真值扎实、组织级可推广的 AI 工程规范平台”

---

# 11. 最终结论

## 技术负责人审查结论

### 值不值得用

值得，但前提是团队知道自己在买入什么。

如果目标是让 AI 编码从一次性聊天，升级成“有工件、有阶段、有复用、有治理”的工作方式，这个项目是值得用的。`[高可信推断]`
但前提是团队接受这样一个事实：它的核心价值不在“强制 LLM 按脚本行事”，而在“给 LLM 更好的决策输入”。`[高可信推断]`

### 适合谁

更适合：

- AI-first 的工程团队
- 愿意接受“流程资产也是产品表面”的平台型团队
- 重视评审质量、工件沉淀、跨会话复用的仓库

### 不适合谁

不太适合：

- 追求零流程、零治理负担的团队
- 需要把每一步都编码成硬状态机/审批流的团队
- 不愿承担 prompt / docs mirror / governance 同步成本的团队

### 它到底有没有显著提升 AI 编码质量

有，但提升是分层次的，不是全能型。

它最明显提升的是：

- 需求质量
- 设计质量
- 评审质量
- 知识沉淀质量
- 团队治理质量

它对实现质量的提升是间接的，不是直接的。它通过提高上下文质量、验证建议质量和知识复用质量，提高 AI 宿主更可能做出正确判断的概率，但没有硬编码地保证实现一定正确。`[高可信推断]`

### 它最强的地方

最强点是这组组合能力：

- durable workflow assets
- 双宿主 runtime governance
- 受管安装/修复生命周期
- 可复用上下文与知识工件

这才是它真正的差异化。`[代码已证实]`

### 它最弱的地方

最弱点是 decision-input boundary：

系统明明已经走上了“轻 contract + LLM 决策”的路线，但 bootstrap / Stage-0 / runnable probe / confidence 语义还不够扎实，导致它最关键的决策输入层还没有完全配得上这条路线。`[高可信推断]`

### 当前最该优先补的 3 个工程短板

1. 把 graph/bootstrap 从“placeholder-friendly artifact compiler”推进成真正 analyzer-backed 的决策输入链，或在做到前收窄宣称。
2. 冻结 `verification_summary / verifier_dispatch / verification_gate_state / telemetry` 的运行时边界，停止同层语义在多个结构里反复漂移。
3. 把测试重心从 contract spot-check 往“输入真值 + 真实行为验证”迁移，特别是 host execution、Stage-0 抽取真实性、docs mirror 生成一致性。

### 如果继续演进，推荐 roadmap

1. **Bootstrap 真值化**
   让 bootstrap mainline 必须依赖真实抽取输入；无 meaningful analysis 时不应标记 complete。
2. **输入语义显式化**
   在 runtime metadata 中更明确地暴露 `freshness`、`confidence`、`fallback_reason`、dispatch posture。
3. **决策输入边界冻结**
   把 `verification_summary / verifier_dispatch / verification_gate_state / telemetry` 的职责、冗余和消费口径正式定稿，并建立 boundary tests。
4. **宿主执行验证**
   给 `doctor` 与 CI 增加可选 runnable probe，验证宿主注册与入口可执行，而不仅是文件存在。
5. **工作流输入收口**
   退役或正式吸收旧 `.claude/tasks` 控制面，并把 docs mirror 更明确地收口为 source-generated 派生产物。
6. **质量收益量化**
   增加 telemetry 或 benchmark gate，证明 review 质量、context relevance、planning 质量与 verification recommendation 命中率的真实提升。

## 最终分类

这是一个**AI 工程化工具 / 治理平台 / LLM 决策输入平台**，不是自动代码生成器。`[代码已证实]`

它已经强到足以作为严肃团队试点工具使用，但还没有强到可以声称自己已经实现了“高置信度、输入真值扎实、成熟可推广的 AI 工程规范平台”。`[高可信推断]`
