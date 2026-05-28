# spec-first 研发场景自适应实施方案

> 视角:Spec-First Evolution Architect / AI Coding Harness 守护者
> 输出基线:`docs/10-prompt/结构化项目角色契约.md`
> 触发证据:`docs/03-实施方案/2026-05-28-mcp-setup-graph-bootstrap-深度优化建议.md`(kaz-mvp 实测,multi-repo + multi-build-target + cross-machine-residual 复合场景全链路暴露)
> 类型:中型(影响 setup / graph-bootstrap / using-spec-first / 所有下游 workflow 的契约层)
> 状态:实施方案草案,尚未进入 spec-plan

---

## 0. 结论先行

当前 spec-first 的隐性假设是 **"单 git 仓库 + 标准 npm/Python/Go 项目 + clean worktree"**。其他场景全部走 `degraded-fallback`,但 fallback 不分级、不指引——LLM 在 multi-repo / multi-build-target / 跨机器残留 / dirty / 多语言混合场景下看到的是"事实不完整 + 不知道为什么不完整"。

**最关键的一刀**:把"研发场景"提升为**一等公民事实**——scripts 识别 → LLM 路由 → 各 workflow 按场景能力矩阵自动降级或增强。这一刀下去,kaz-mvp 这种复合拓扑会自然进入正确路径,新场景接入也不需要改每一个 workflow。

具体落地为三件事:

1. **Developer Scenario Fingerprint**(新增 `.spec-first/workspace/scenario-fingerprint.json`)
2. **Scenario Capability Matrix**(每个 workflow SKILL.md 增加一节,契约化降级路径)
3. **场景驱动的 Entry Router**(`using-spec-first` guide mode 强制读指纹做路由)

三件事都不引入 schema bump,不引入新 provider,不增加状态机思维。

---

## 1. 现状与问题(为什么要做)

### 1.1 实测证据(kaz-mvp,2026-05-28)

- `mcp-setup` 全部 ready(6/6 child),`graph-bootstrap` 全部 ready(6/6 child),耗时 88.9s
- 但顶层 17+ 个 Gradle module(`app-kaz`、`app-core`、`annotation` 等)**完全不在任何 graph 内**(`build_target_coverage_ratio ≈ 0.26`)
- 顶层 `.spec-first/{graph,config,providers}/**` 是 2026-05-06 的 lynwang/mantou 残留,**没有任何 invalidation 标记**
- 顶层 `.gitnexus/meta.json` label=`kaz-app`,与当前目录 `kaz-mvp` 冲突,**没有任何 conflict 暴露**
- 6 个 child 全 `dirty-graph-affecting`,但**dirty 路径具体是什么、影响哪些 query**,LLM 拿到的只是计数

### 1.2 根因:隐性单点判断散落在每个 workflow

每个 workflow 都在自己代码里做了**隐性场景判断**——
- `mcp-setup` 用 `resolve-project-target` 检测 multi-repo
- `graph-bootstrap` 用 `resolve-workspace-graph-targets` 检测 dirty
- `using-spec-first` 用 prose 判断"是否需要 setup"
- `spec-code-review` / `spec-plan` 用 graph-facts 自行解读

这些判断**没有被聚合成一个统一的场景指纹**,也**没有被下游 workflow 消费**——结果是每个 workflow 各自实现一遍场景适配,接缝处全是漏洞。

### 1.3 与 Harness 6 层模型的冲突

| Harness 层 | 当前缺口 |
|---|---|
| Context Harness | LLM 拿到的 context 不知道"残缺在哪里" |
| Execution Harness | 每个 workflow 自己判断场景,接缝处漏洞 |
| Evidence Harness | parent 污染失声、跨机器残留无标记 |
| Evaluation Harness | 没有 graph-to-finding ratio、scenario coverage 指标 |
| Governance Harness | 知道"不该写",不知道"该清" |
| Knowledge Harness | bootstrap-report 是给人看的,LLM 不消费 |

---

## 2. Goals / Non-goals

### 2.1 Goals

- 让 spec-first 在 **任意研发场景**下,LLM 都能从 artifact 中读出"当前场景的关键特征 + 在该场景下我能做什么 / 不能做什么"
- 让 setup / graph-bootstrap / using-spec-first / 所有下游 workflow **共享一份场景事实**(scenario-fingerprint)
- 让每个 workflow 的**降级行为契约化**(Scenario Capability Matrix),可测试、可审计
- 让 cross-machine-residual / git-misaligned-build-targets / definitions-only-provider 等今天的"隐性 degraded"场景**显式化**为 LLM 可消费的字段
- 不破坏既有 schema,不引入新 provider

### 2.2 Non-goals

- 不实现"自动决策"——LLM 永远是最终路由者,scenario-fingerprint 是事实不是结论
- 不引入状态机/中心化流程引擎
- 不在 fingerprint 里埋"建议命令"——命令建议是 routing 层职责
- 不为非 git 目录跑 GitNexus(等上游能力)
- 不替代 graph-facts.json / graph-targets.json / runtime-capabilities.json,只在它们之上补一层"场景视角"

---

## 3. 核心机制设计

### 3.1 研发场景的维度向量

研发场景不是一维标签,而是多维向量。Fingerprint 必须捕获以下维度:

| 维度 | 取值空间 | 来源 | 类别 |
|---|---|---|---|
| 仓库拓扑 | `single-repo` / `multi-repo-workspace` / `monorepo` / `submodule-heavy` / `non-git` | `resolve-project-target` + git submodule 扫描 | 确定性事实 |
| Build system | `npm` / `gradle` / `maven` / `cargo` / `go` / `python` / `mixed` | manifest 文件存在性扫描 | 确定性事实 |
| 索引边界对齐 | `git-aligned` / `git-misaligned` / `no-git` | 比较 build manifest 数 vs git child repo 数 | 确定性事实 |
| 语言 | `kotlin` / `java` / `typescript` / `python` / ... | provider status 或 file 扩展名采样 | 确定性事实 |
| Worktree 状态 | `clean` / `dirty-graph-affecting` / `dirty-non-graph` / `cross-machine-residual` | dirty paths breakdown + foreign owner 检测 | 确定性事实 |
| Provider 能力 | `full-process-graph` / `definitions-only` / `partial` / `unavailable` | provider-status.json 解读 | 派生事实 |
| 协作位置 | `local-dev` / `ci` / `cross-machine-clone` / `worktree` | git worktree 指针 + 路径来源对比 | 派生事实 |
| 团队规模信号 | `solo` / `small-team` / `enterprise-multi-repo` | git remote 域名采样 + child repo 数 | 派生事实 |
| 复杂度评分 | `0.0~1.0` | 上述维度加权 | 派生数字 |

**注意**:这些都是**事实采集**,不是"建议"。LLM 拿到事实后,结合任务意图(implement / review / debug / plan)做路由。

### 3.2 scenario-fingerprint.json schema

新增 `.spec-first/workspace/scenario-fingerprint.json`,由 `mcp-setup` 在 resolve-target / verify-tools 阶段产出。

```json
{
  "schema_version": "developer-scenario-fingerprint.v1",
  "generated_by": "spec-mcp-setup",
  "generated_at": "2026-05-28T04:46:47Z",
  "advisory": true,
  "topology": {
    "repo_topology": "multi-repo-workspace",
    "submodule_heavy": true,
    "child_repo_count": 6,
    "git_misaligned_build_targets": 17,
    "build_target_coverage_ratio": 0.26
  },
  "build_systems": {
    "primary": "gradle",
    "secondary": ["gradle-kts"],
    "manifests_detected": ["settings.gradle", "build.gradle", "build.gradle.kts"]
  },
  "languages": ["kotlin", "java"],
  "worktree": {
    "state_class": "cross-machine-residual",
    "dirty_child_count": 6,
    "cross_machine_indicators": [
      {"path": ".gitnexus/meta.json", "foreign_owner": "/Users/mantou/...", "reason_code": "foreign-absolute-path"},
      {"path": ".spec-first/graph/graph-facts.json", "foreign_owner": "/Users/lynwang/...", "reason_code": "foreign-absolute-path"}
    ]
  },
  "provider_capability_class": "full-process-graph-with-coverage-gap",
  "collaboration_position": "cross-machine-clone",
  "team_signals": {
    "git_remotes": ["gitlab.inzwc.com"],
    "estimated_scale": "enterprise-multi-repo"
  },
  "scenario_summary_label": "android-multi-repo-workspace + gradle + cross-machine-residual + git-misaligned-build-targets",
  "scenario_complexity_score": 0.83,
  "downstream_routing_hints": {
    "spec-plan": "降级 confidence;对 17 个 git-misaligned build target 用 ast-grep 直读补充",
    "spec-code-review": "review 范围必须显式包括 dirty 路径采样;impact 半径只在 6 个 child 内可信",
    "spec-debug": "顶层 stale 产物不可信;先跑 spec-first clean --workspace-orphans",
    "spec-work": "写边界严格限定 target_repo;parent 顶层禁止任何 .spec-first/{graph,config,providers} 写入"
  }
}
```

**字段语义边界**:
- `topology`、`build_systems`、`worktree.state_class`、`worktree.cross_machine_indicators[]` 是 **scripts-owned 确定性事实**
- `provider_capability_class`、`collaboration_position`、`scenario_complexity_score`、`scenario_summary_label` 是 **scripts-owned 派生事实**(由确定性事实按公开规则推算,不含语义判断)
- `downstream_routing_hints.*` 是 **scripts-owned 路由提示**——以**键值对**形式提供给具体 workflow,**不是决策**,LLM 可以采纳或忽略
- `advisory: true` 永远固定,这个文件不是 confirmed truth

**为什么不放进 graph-facts.json / graph-targets.json?**
- graph-facts 是 child-local 产物,scenario fingerprint 是 workspace-level 视角
- fingerprint **不依赖** graph 是否 ready(setup 阶段就要产出),graph-facts 依赖 bootstrap
- 让 `using-spec-first` 在 routing 时也能读,不必等 graph-bootstrap
- 保持各 artifact 的语义内聚:graph-facts 谈"图谱本身",fingerprint 谈"场景本身"

### 3.3 Scenario Capability Matrix(每个 workflow 必须声明)

每个公开 workflow 的 `SKILL.md` 增加一节 `## Scenario Capability Matrix`。这是**契约**,不是 prose 提示。

**矩阵格式(强制列):**

| Scenario class | Capability class | Required Evidence | Fallback path | LLM 决策点 |

**Capability class 取值(全 workflow 统一):**
- `full`:可以按 SKILL 默认契约执行
- `bounded`:可以执行,但必须显式限定边界(例如 target_repo / 路径范围)
- `partial`:能力有缺口,必须在 artifact 中声明 limitations
- `fallback-only`:graph/provider 不可用,只用 ast-grep / Read 直读
- `blocked-action-required`:不应继续,必须先跑某个修复 workflow

**Scenario class 取值(全 workflow 统一,来自 fingerprint):**
- `single-repo + clean + full-graph`
- `multi-repo + dirty-graph-affecting`
- `git-misaligned-build-targets`
- `cross-machine-residual`
- `definitions-only-provider`
- `unavailable-provider`
- `no-git`

**示例:`spec-code-review` 的矩阵**

| Scenario class | Capability class | Required Evidence | Fallback path | LLM 决策点 |
|---|---|---|---|---|
| single-repo + clean + full-graph | full | graph + impact_probe + tests | n/a | 直接给 finding |
| multi-repo + dirty-graph-affecting | bounded | per-target_repo graph + dirty_paths_sample | bounded ast-grep on dirty paths | 必须显示 dirty 列表给用户确认 |
| git-misaligned-build-targets | partial | covered child graphs + uncovered ast-grep | direct read on uncovered modules | 在 review report 顶部声明覆盖盲区 |
| cross-machine-residual | blocked-action-required | none | 不开始 review | 必须先跑 clean,显式 next_action |
| definitions-only-provider | partial | definitions + ast-grep | ast-grep 补 process flow | 不声称有 impact 半径 |
| unavailable-provider | fallback-only | ast-grep + Read | 全部 fallback | confidence=low |

**测试要求**:每个 workflow 的 contract test 必须覆盖矩阵中每一行的 Capability class,确保降级路径不是死代码。

### 3.4 using-spec-first 升级:场景驱动的 Entry Router

`using-spec-first` 当前是 prose-based guide mode。升级后:

- **强制读** `.spec-first/workspace/scenario-fingerprint.json`(不存在时建议先跑 `/spec:mcp-setup`)
- 路由判断按如下优先级(从高到低):
  1. `state_class == cross-machine-residual` → 推荐 `spec-first clean --workspace-orphans` + `spec-first init`
  2. `worktree.cross_machine_indicators.length > 0` → 推荐 `/spec:mcp-setup`(重新生成 host_ledger_pointer)
  3. `scenario_complexity_score > 0.7` → 在推荐任何"做事"workflow 前,告知用户复杂度并询问是否仍继续
  4. `build_target_coverage_ratio < 0.5` 且任务涉及 impact/review → 告知覆盖盲区
  5. `provider_capability_class == unavailable-provider` → 推荐 `/spec:graph-bootstrap` 或显式 fallback
  6. 上述都不命中 → 按用户意图正常路由(plan/work/review/debug)

**核心原则**:Entry Router 推荐"一个入口、一个理由、一个动作"。不串联 workflow。不替代 LLM 最终判断。

---

## 4. Artifact 增量

| 文件 | 类型 | 产出方 | 消费方 |
|---|---|---|---|
| `.spec-first/workspace/scenario-fingerprint.json` | **新增**,schema `developer-scenario-fingerprint.v1` | `spec-mcp-setup`(`verify-tools.*` 阶段) | `using-spec-first`、所有公开 workflow、`spec-optimize` |
| `skills/*/SKILL.md` 内 `## Scenario Capability Matrix` 节 | **新增 prose 契约** | 各 workflow owner | LLM 在执行 workflow 时按矩阵降级 |
| `skills/using-spec-first/SKILL.md` 内 router 段落 | **修改** | using-spec-first owner | Entry router 行为 |
| 各 workflow 的 contract test | **新增 capability matrix 覆盖** | 各 workflow owner | CI |

**不改**:graph-providers.v1 / runtime-capabilities.v1 / graph-facts.v1 / provider-status.v1 / workspace-graph-targets.v1 / 任何既有 schema 版本号。

**对称工作**(必须):
- Claude 和 Codex 双宿主都要读同一个 fingerprint(`using-spec-first` 是双宿主共享 source)
- Bash 和 PowerShell 两条脚本路径都要产出 fingerprint(`verify-tools.sh` 与 `verify-tools.ps1` 对称)

---

## 5. 与角色契约的一致性自检

| 角色契约要求 | 本方案 |
|---|---|
| Scripts prepare, LLM decides | ✅ scripts 输出 fingerprint 字段,LLM 用 matrix + score 判断路由 |
| Light contract | ✅ 1 个新文件 + 每个 SKILL 加 1 节,不改既有 schema |
| Explicit boundaries | ✅ `advisory: true` 固定,clean / init 是显式入口,LLM 是最终决策者 |
| 不引入状态机 | ✅ Capability Matrix 是契约不是 FSM,workflow 仍可灵活降级 |
| 不引入多真相源 | ✅ fingerprint 由 setup 唯一产出,其他只读 |
| 服务核心链路 | ✅ Codebase→Graph→Spec 阶段就介入,Plan→Tasks→Code→Review 全链消费 |
| 80/20 | ✅ 1 份指纹解决 N 个 workflow 的场景适配,边际成本递减 |
| 双宿主对称 | ✅ Claude / Codex 共享 fingerprint;Bash / PowerShell 对称产出 |
| 不把 advisory 当 confirmed | ✅ fingerprint 永远 advisory,LLM 必须叠加 graph + 直读验证 |

---

## 6. 风险与反模式

| 类别 | 项目 | 缓解 |
|---|---|---|
| 反模式 | 让 fingerprint 变成"自动决策机" | 矩阵保留 "LLM 决策点" 列;复杂度评分永远是 advisory |
| 反模式 | 让 Capability Matrix 变成 FSM | 矩阵是契约不是流程图,workflow 仍可按 LLM 判断越级降级 |
| 反模式 | scenario_complexity_score 变硬阈值 gate | 0.7/0.5 这些数字只是 routing 提示,不阻断 workflow 启动 |
| 反模式 | 在 fingerprint 里埋"建议命令" | 命令建议放 `downstream_routing_hints` 的 prose 描述,不放可执行字段 |
| 风险 | build_target 检测扩大事实面,会让原"ready"workspace 显示 `partial-build-targets` | 这是**正确暴露**,不是回归;通过 CHANGELOG (user-visible) + docs 沟通 |
| 风险 | cross-machine-residual 在每次新 clone 都报警 | 通过 `spec-first init` + `clean --workspace-orphans` 显式入口,onboarding docs 引导一次性修复 |
| 风险 | fingerprint 误判(例如把 single-repo 误标成 multi-repo) | fingerprint advisory + LLM 仍叠加 graph-facts 核对;contract test 覆盖典型拓扑 |
| 风险 | 每个 workflow 维护 capability matrix 增加维护成本 | 矩阵 6 行 5 列上限;新 scenario class 加入时统一 RFC,各 workflow 同步;contract test 验证完备性 |

---

## 7. 落地序列

继承前一份报告(`2026-05-28-mcp-setup-graph-bootstrap-深度优化建议.md`)的 P0-P9,在前面插入 PA / PB,中间插入 PC、PD。每步独立可发布、独立可回滚。

| Step | 内容 | 依赖 | 改动量 | 价值 |
|---|---|---|---|---|
| **PA** | `developer-scenario-fingerprint.v1` schema + `verify-tools.*` 产出 + 双宿主对称 | - | 中 | 一切下游适配的前提 |
| **PB** | `using-spec-first` 读 fingerprint + 优先级路由 | PA | 小 | 立刻改善 cross-machine-residual / blocked 场景体验 |
| P0 | parent-artifact-quarantine.v1 + clean read-only 列举 | PA | 小 | 修补 Evidence Harness |
| P1 | provider-status.json 增 repo_label_resolution | - | 小 | 修补 repo_label 隐性误导 |
| P2 | graph-facts.json 增 dirty_paths_sample | - | 小 | 修补 dirty 影响面盲区 |
| P3 | graph-bootstrap final response 强制 drift handoff 行 | - | 极小 | 防止 handoff 丢失 |
| P4 | graph-targets.json 增 non_git_build_modules / coverage_summary | PA(共享 build manifest scan) | 中 | 提供 git_misaligned_build_targets 输入 |
| **PC** | 每个公开 workflow SKILL.md 加 Scenario Capability Matrix 节 + contract test | PA | 中(7~8 个 workflow) | Execution Harness 契约化 |
| P5 | graph-bootstrap-summary.json 增 quality_signals | P0-P4 | 中 | Evaluation Harness 落字段 |
| **PD** | spec-optimize 引入 `scenario_complexity_score` 与 `quality_signals` 作为优化目标 | PA + P5 | 中 | 真正闭环 |
| P6 | spec-first clean --workspace-orphans 升级为 preview-first 实际删除 | P0 | 小 | Governance Harness 闭环 |
| P7 | GitNexus capability surface diff 报告 | - | 中 | 跟上 provider 演化 |
| P8 | probe candidate 多样性 | - | 小 | 提升 fallback 分散性 |
| P9 | (roadmap)build-target-level GitNexus indexing,等上游 | - | 大 | 战略级 |

**关键依赖路径**:
- PA 是所有其他步骤的输入基础——**必须最先**
- PB 紧跟 PA,因为它是用户最先感知的行为变化
- PC 必须在 P0-P4 之后,因为矩阵 Required Evidence 列依赖这些字段
- PD 必须在 P5 之后,因为优化需要 quality_signals 做基线

---

## 8. 测试与验证策略

| 层级 | 测试 | 覆盖目标 |
|---|---|---|
| Schema 测试 | `developer-scenario-fingerprint.v1` 字段校验 | 必填/可选字段、enum 取值、advisory 固定 true |
| Unit 测试 | fingerprint 产出函数对各拓扑的输入输出 | single-repo / multi-repo / non-git / cross-machine / submodule-heavy / mixed-build-system |
| Contract 测试 | 各 workflow Scenario Capability Matrix 完备性 | 每个 Scenario class 至少 1 行;每个 Capability class 至少 1 测试案例 |
| Integration 测试 | `mcp-setup → using-spec-first` 端到端 | router 在每个优先级条件下推荐正确入口 |
| Smoke 测试 | 实际仓库回归 | spec-first 本仓 + kaz-mvp(multi-repo) + 临时构造的 non-git 仓 |
| Fresh-source eval | using-spec-first / 各 workflow 行为语义 | 按 `docs/contracts/workflows/fresh-source-eval-checklist.md` 跑 |
| 双宿主 | Bash 与 PowerShell 输出 fingerprint 字段一致 | 字段集 + 取值范围一致 |

---

## 9. 文档与 Changelog

### 9.1 必须同步更新

- `CHANGELOG.md`:每个 P 步骤的 user-visible 行为变化(scenario-fingerprint 暴露场景、using-spec-first router 行为改变、各 workflow 降级路径契约化)
- `README.md` / `README.zh-CN.md`:简介中提及"场景自适应"作为核心能力之一
- `docs/05-用户手册/`:新增章节"研发场景与降级路径"
- `docs/contracts/`:新增 `developer-scenario-fingerprint.md` 描述 schema 与产出语义
- `docs/contracts/workflows/`:新增 `scenario-capability-matrix.md` 描述矩阵的统一格式与 Scenario class 取值
- `skills/spec-mcp-setup/SKILL.md`:在 Outputs / Workflow 节中加入 fingerprint 产出步骤
- `skills/using-spec-first/SKILL.md`:在 router 段落引入 fingerprint 优先级判断
- `skills/spec-*/SKILL.md`(各公开 workflow):统一增加 Scenario Capability Matrix 节

### 9.2 不更新

本实施方案文档本身不属于 source 变更(它是 docs/03-实施方案 下的规划),无需 CHANGELOG 记录。
实际落地 P0-P9 各步骤时,**每个 PR** 必须按 user-visible 规则更新 CHANGELOG。

---

## 10. 决策与开放问题

### 10.1 已决策

- fingerprint 作为独立文件(workspace-level),不合并进 graph-facts / runtime-capabilities
- fingerprint 永远 `advisory: true`,不会成为硬 gate
- 矩阵列固定(Scenario class / Capability class / Required Evidence / Fallback path / LLM 决策点)
- Capability class 与 Scenario class 取值全 workflow 统一,新增取值必须走 RFC
- PA + PB 必须先做,后续步骤都依赖

### 10.2 开放问题(待 plan/brainstorm 阶段细化)

1. **build manifest 扫描深度**:gradle 的 `settings.gradle` 可以递归 include,要扫多深?默认 3 层够吗?
2. **复杂度评分公式**:加权系数如何定?需要在多个真实仓库 calibrate
3. **Scenario class 命名空间**:目前列了 7 个,是否覆盖足够?需要 RFC 流程收集新场景
4. **Fingerprint 失效条件**:graph-bootstrap 后是否需要刷新 fingerprint(比如 dirty 状态变化)?当前设计是 setup-only 产出,bootstrap 不刷
5. **跨 workflow 的 capability matrix 同步**:7~8 个 workflow 同时加矩阵,是否一次 PR 还是分批?分批的话顺序如何?
6. **`downstream_routing_hints` 的语言**:目前混用中英文,需要按项目语言策略统一

---

## 11. 已执行的验证

- ✅ 基于 kaz-mvp 实测产物(2026-05-28)推导设计
- ✅ 与角色契约 8 项要求做一致性自检(第 5 节)
- ✅ 与前一份优化建议报告(P0-P9 序列)对齐落地序列
- ⚠️ 未执行:多 ecosystem(npm / cargo / go / python)的 build manifest scan 原型验证——需要 plan 阶段做
- ⚠️ 未执行:复杂度评分公式 calibration——需要 plan 阶段在 3+ 仓库实测
- ⚠️ 未执行:双宿主对称性验证——需要 plan/work 阶段同步实现 Bash + PowerShell

---

## 12. 一句话总结

> **当前 spec-first 是"单 git repo 隐性默认 + 多场景靠每个 workflow 各自打补丁"。本方案把场景适配从 prose 判断升级为契约化事实——一份 fingerprint + 一张 capability matrix + 一个 entry router——让 spec-first 在任意研发场景下都能高质量辅助交付,且新场景接入不需要改每一个 workflow。**

---

## 附录 A:与 `2026-05-28-mcp-setup-graph-bootstrap-深度优化建议.md` 的关系

| 维度 | 前一份报告 | 本方案 |
|---|---|---|
| 视角 | 两个 skill 内部优化 | 跨 workflow 的场景自适应架构 |
| 触发 | kaz-mvp 实测发现 D1-D8 缺陷 | 把 D1-D8 抽象为场景维度,系统化解决 |
| 改动面 | mcp-setup + graph-bootstrap | + using-spec-first + 所有公开 workflow |
| 新增产物 | parent-artifact-quarantine.v1 等 | + developer-scenario-fingerprint.v1 |
| 落地序列 | P0-P9 | 在前插 PA/PB,中间插 PC/PD |
| 关系 | 子集 | 超集,前一份报告作为本方案的 Tier-1 实现基础 |

**结论**:本方案不替代前一份报告,而是把它作为执行基础,在场景维度上做架构层抽象。两份方案应**一起进入 spec-plan**,合并为一个 Milestone。
