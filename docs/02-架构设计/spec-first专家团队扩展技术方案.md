# spec-first 专家团队扩展技术方案

> Lifecycle: historical-input / external-reference. 本文保留旧架构、方案、迁移或研究记录；当前 source of truth 以 `docs/README.md`、根目录 README、`docs/05-用户手册/`、`docs/contracts/`、`skills/`、`src/cli/` 和 `CHANGELOG.md` 为准。

## 基于 `everything-claude-code` 的 Agent Team 能力补强设计

> 建议文档路径：
> `docs/2026-05-02-agent-team-expansion/README.md`

---

## 0. 结论

`everything-claude-code` 值得作为 spec-first 的 **专家团队能力参考库**，但不应该被当成“可直接搬运的 agent 集合”。

最优集成方式是：

> **不复制 ECC 的运行时控制面，不复制 hooks，不复制 commands；只吸收它的 agent taxonomy、语言专家、build resolver、rules/skills 分层方法、agent-sort / team-builder / skill-stocktake 思路，并用 spec-first 自己的 workflow、graph evidence、artifact protocol、skill orchestration 重新治理。**

原因是两者定位不同：

* `everything-claude-code` 更像 **AI agent harness performance system**，包含 agents、skills、hooks、rules、MCP configs、legacy command shims、installer、dashboard 等多宿主增强能力。它 README 当前描述支持 Claude Code、Codex、Cursor、OpenCode、Gemini 等 harness，并在公开说明中提到 48 agents、182 skills、68 legacy command shims。([GitHub][1])
* spec-first 的核心优势不是 agent 数量，而是 **研发闭环与证据治理**：Spec → Plan → Tasks → Work → Review → Knowledge。现有 `spec-code-review` 已经是结构化、多 persona、confidence-gated、merge/dedup 的 review workflow，而不是简单 subagent 调用器。([GitHub][2])

所以最终目标不是：

> 把 spec-first 的 agent 从 51 个堆到 100 个。

而是：

> 建立一个 **可路由、可审计、可演进、可沉淀、低上下文污染** 的专家团队系统，让每个 skill 在合适阶段精准调度合适专家。

---

# 1. 背景与问题定义

## 1.1 当前 spec-first 已经具备的优势

当前 spec-first 已经不是“prompt collection”，而是一个较完整的研发工作流系统。公开仓库中可以看到它已经有 `spec-brainstorm`、`spec-plan`、`spec-write-tasks`、`spec-work`、`spec-code-review`、`spec-doc-review`、`spec-debug`、`spec-graph-bootstrap` 等核心 skill。([GitHub][3])

其中：

* `spec-plan` 明确承担 “WHAT → HOW” 的转换：`spec-brainstorm` 定义要做什么，`spec-plan` 定义如何实现，`spec-work` 负责执行。([GitHub][4])
* `spec-write-tasks` 被定义为 `spec-plan` 与 `spec-work` 之间的可选派生层，强调 plan 是 single source of truth，task pack 只是派生产物，不能改变 scope、acceptance criteria、non-goals。([GitHub][5])
* `spec-code-review` 当前已经具备 diff scope、plan/task/work artifacts、AGENTS/CLAUDE/project role docs、manifest、nearby implementation/tests、graph readiness fallback 等上下文锚点。([GitHub][2])
* `spec-graph-bootstrap` 已经承担 Graph Readiness Compiler 职责，会读取 `.spec-first/config/runtime-capabilities.json`、`graph-providers.json`、`provider-artifacts.json` 等 setup-owned facts，然后写 canonical readiness artifacts。([GitHub][6])

这说明 spec-first 的基础设施已经足够强。现在缺的是：

> 专家团队覆盖面不足，尤其是不同语言、不同框架、不同研发场景、不同技术架构的深度 expert 不够细。

## 1.2 当前问题

现有 spec-first 的 agent 团队更偏下面几类：

1. spec-first 自身 workflow / agent-native / CLI readiness / graph / schema / standards 审查。
2. 通用 code review：correctness、testing、maintainability、security、performance、API contract、reliability 等。
3. 局部 stack-specific：Rails、Python、TypeScript、Frontend race、Swift/iOS 等。`spec-code-review` persona catalog 当前明确列出了 18 reviewer personas，并区分 always-on、cross-cutting conditional、stack-specific conditional、Spec-First conditional agents。([GitHub][7])

缺口主要在：

| 能力域            | 当前问题                                                                             |
| -------------- | -------------------------------------------------------------------------------- |
| 多语言覆盖          | Go、Java/Spring、Kotlin/Android/KMP、Rust、C++、C#、Dart/Flutter、PHP/Laravel 等专家不足     |
| build/debug 场景 | 各语言 build resolver、依赖冲突 resolver、CI failure resolver 不够体系化                       |
| 多端协作           | App、H5、Admin、多后台、多服务、多团队需求拆解时，专家参与 plan/task 的能力不足                               |
| 架构场景           | event-driven、cache consistency、observability、deployment、monorepo boundary 等专家可补强 |
| review 噪音治理    | agent 扩容后需要 routing、confidence、dedup、schema、audit，否则会变成“很多专家一起吵”                 |
| agent 资产演进     | 缺少类似 skill-stocktake/agent-stocktake 的周期性审查机制                                    |

---

# 2. 外部参考：`everything-claude-code` 值得借鉴什么

## 2.1 ECC 的整体形态

ECC README 把自己描述为一个完整系统，包含 skills、instincts、memory optimization、continuous learning、security scanning、research-first development，并且跨多个 agent harness。它的 v2.0.0-rc.1 说明中也提到 dashboard、operator workflows、media tooling、Rust control-plane prototype、AgentShield/cost controls 等扩展。([GitHub][1])

这说明 ECC 不是一个单纯 agent 文件夹，而是：

```text
agent harness performance system
├── agents
├── skills
├── rules
├── hooks
├── commands / legacy shims
├── installer / profiles
├── dashboard
├── continuous learning
├── security scanning
└── cross-harness packaging
```

对 spec-first 来说，**最值得吸收的是 agents、skills 方法论、rules 分层和 selective install/routing 思想**；最不应该直接吸收的是 hooks runtime、commands runtime、installer 控制面。

## 2.2 ECC 的 agent 覆盖优势

ECC `agents/` 目录里可以看到较多语言与场景专家，包括 `cpp-reviewer`、`cpp-build-resolver`、`csharp-reviewer`、`dart-build-resolver`、`database-reviewer`、`flutter-reviewer`、`go-reviewer`、`go-build-resolver`、`java-reviewer`、`java-build-resolver`、`kotlin-reviewer`、`kotlin-build-resolver`、`python-reviewer`、`pytorch-build-resolver`、`rust-reviewer`、`rust-build-resolver`、`typescript-reviewer`、`silent-failure-hunter` 等。([GitHub][8])

几个高价值样本：

* `kotlin-reviewer` 覆盖 Kotlin / Android / KMP / Compose，重点包括 coroutine misuse、Flow anti-pattern、lifecycle bugs、clean architecture boundaries、Compose recomposition traps、Android security 等。([GitHub][9])
* `java-reviewer` 重点覆盖 Java / Spring Boot 的 layered architecture、JPA patterns、security、concurrency，并列出 SQL injection、command injection、path traversal、Bean Validation、CSRF、transaction、N+1、unbounded list endpoint 等 review priority。([GitHub][10])
* `go-reviewer` 重点覆盖 Go idioms、concurrency、error handling、performance、security，并包含 `go vet`、`staticcheck`、race test、govulncheck 等 diagnostic commands。([GitHub][11])
* `typescript-reviewer` 关注 TypeScript/JavaScript 的 type safety、async correctness、Node/web security、idiomatic patterns，并强调 review scope 要基于真实 PR base 或 merge-base，而不是硬编码 main。([GitHub][12])

这些能力刚好补 spec-first 当前 stack-specific 专家不足的问题。

## 2.3 ECC 的 rules 分层值得借鉴，但不能照搬

ECC 的 `rules/README.md` 明确把 rules 分成 common 层和 language-specific directories，例如 common、typescript、python、golang、web、swift、php 等；common 放语言无关原则，语言目录扩展具体 framework patterns、tools、examples。([GitHub][13])

这个思想非常适合 spec-first，但应该转换成：

```text
spec-first expert knowledge packs
├── common-review-principles
├── language-specific review knowledge
├── framework-specific review knowledge
├── domain-specific review knowledge
└── workflow-specific output contracts
```

关键点：**这些知识包不应该默认注入所有会话**。它们应该被 skill 根据 repo evidence、diff evidence、plan evidence 按需加载。

## 2.4 ECC 的 selective install / low-context 思想必须吸收

ECC README 特别强调不要叠加多种 install methods，也提醒 plugin 安装后不要再 full install，否则会造成重复 skills 和重复 runtime behavior。它还提供 low-context/no-hooks path，建议只复制实际需要的 rules，而不是复制所有 rules。([GitHub][1])

这个对 spec-first 非常关键。spec-first 不能因为扩充专家而把 `CLAUDE.md` / `AGENTS.md` 注入成一个庞大的“百科全书”。正确方向是：

```text
常驻上下文：轻量治理原则 + workflow contract
按需上下文：skill 根据任务动态选择 agent + knowledge pack
输出闭环：agent 结果进入 artifacts，而不是污染全局规则
```

---

# 3. 设计原则

## 3.1 不做“agent 堆数量”，做“专家能力路由系统”

一个专家是否值得加入，不看名字酷不酷，而看：

```text
1. 是否覆盖当前缺口
2. 是否有明确触发条件
3. 是否能读取足够证据
4. 是否能输出统一 schema
5. 是否能被 skill synthesis 消化
6. 是否避免和现有 agent 重复
7. 是否有真实 workflow 使用场景
```

## 3.2 skill 是调度者，agent 是执行专家

spec-first 当前方向是正确的：**skill 负责流程控制与决策，agent 聚焦专家执行**。

不建议让 agent 自己决定全局流程，不建议让 agent 自己修改 workflow state，不建议让 agent 自己创建额外生命周期。

推荐关系：

```text
Skill
  ├── 读取 spec / plan / task / work / diff / graph / repo facts
  ├── 选择专家团队
  ├── 给每个 agent 分发 bounded context
  ├── 收集结构化结果
  ├── 合并 / 去重 / 置信度过滤 / 严重级校准
  ├── 决定 safe_auto / gated_auto / manual / advisory
  └── 写入 workflow artifacts

Agent
  ├── 只做本领域判断
  ├── 不扩大 scope
  ├── 不改变 workflow state
  ├── 不直接替用户做产品/架构终裁
  └── 输出统一 contract
```

## 3.3 Scripts prepare, LLM decides

detector script 可以做确定性准备：

```text
- changed file list
- language histogram
- manifest detection
- lockfile detection
- build tool detection
- test command detection
- graph readiness check
- impacted modules
- dependency hints
- framework hints
- CI/build logs parsing
```

但最终是否调度某个 expert，应由 skill 基于上下文判断。这个也和 `spec-code-review` 当前 persona catalog 的规则一致：conditional persona 的选择不是简单 keyword matching，而是 orchestrator 读 diff 后做判断。([GitHub][7])

## 3.4 不引入第二套 runtime 控制面

第一阶段明确不引入：

```text
- ECC hooks runtime
- ECC command shims
- ECC install profiles
- ECC dashboard
- ECC memory persistence runtime
- ECC continuous learning hooks
```

这些会和 spec-first 现有 init、mcp-setup、graph-bootstrap、CLAUDE/AGENTS generation、workflow artifacts 形成重叠控制面。

---

# 4. 目标架构

## 4.1 新增 “Expert Team Layer”

建议在 spec-first 中新增一层逻辑概念：

```text
Spec-First Workflow Layer
├── spec-brainstorm
├── spec-plan
├── spec-write-tasks
├── spec-work
├── spec-debug
├── spec-code-review
├── spec-doc-review
└── spec-knowledge / solutions

Expert Team Layer
├── agent-catalog
├── routing-rules
├── stack-detectors
├── evidence-packs
├── output-contracts
└── agent-audit

Agent Implementation Layer
├── language reviewers
├── framework reviewers
├── build resolvers
├── architecture reviewers
├── domain reviewers
├── quality reviewers
└── release/deployment reviewers
```

## 4.2 目录建议

推荐新增共享目录：

```text
skills/_shared/agent-routing/
├── README.md
├── agent-catalog.yaml
├── routing-rules.md
├── stack-detectors.md
├── routing-decision-record.schema.json
├── expert-context-pack.schema.json
├── output-contracts/
│   ├── review-finding.schema.json
│   ├── plan-consultation.schema.json
│   ├── debug-diagnosis.schema.json
│   ├── task-pack-consultation.schema.json
│   └── agent-audit-finding.schema.json
├── examples/
│   ├── kotlin-kmp-review-routing.json
│   ├── java-spring-plan-routing.json
│   ├── go-debug-routing.json
│   └── multi-team-prd-routing.json
└── scripts/
    ├── detect-stack.mjs
    ├── detect-agent-candidates.mjs
    ├── validate-agent-catalog.mjs
    ├── validate-agent-output.mjs
    └── print-routing-explain.mjs
```

新增或增强 agents：

```text
agents/
├── spec-go-reviewer.agent.md
├── spec-go-build-resolver.agent.md
├── spec-java-spring-reviewer.agent.md
├── spec-java-gradle-maven-build-resolver.agent.md
├── spec-kotlin-android-kmp-reviewer.agent.md
├── spec-kotlin-gradle-build-resolver.agent.md
├── spec-rust-reviewer.agent.md
├── spec-rust-cargo-build-resolver.agent.md
├── spec-cpp-reviewer.agent.md
├── spec-cpp-cmake-build-resolver.agent.md
├── spec-csharp-dotnet-reviewer.agent.md
├── spec-dart-flutter-reviewer.agent.md
├── spec-flutter-build-resolver.agent.md
├── spec-database-reviewer.agent.md
├── spec-deployment-devops-reviewer.agent.md
├── spec-observability-reviewer.agent.md
├── spec-accessibility-reviewer.agent.md
├── spec-browser-qa-reviewer.agent.md
├── spec-silent-failure-hunter.agent.md
└── spec-monorepo-boundary-reviewer.agent.md
```

---

# 5. Agent Catalog 设计

## 5.1 Catalog 不是列表，是可调度协议

`agent-catalog.yaml` 应该成为 skill 选择专家的核心依据。

示例：

```yaml
schema_version: spec-first.agent-catalog.v1

agents:
  spec-kotlin-android-kmp-reviewer:
    status: active
    category: language_framework_reviewer
    source_reference:
      inspired_by: everything-claude-code/agents/kotlin-reviewer.md
      import_mode: rewritten
      license_note: review_before_copying
    description: >
      Kotlin / Android / KMP / Compose reviewer. Focuses on coroutine safety,
      Flow usage, lifecycle correctness, module boundaries, Compose state and
      Android security.
    workflows:
      - spec-plan
      - spec-write-tasks
      - spec-work
      - spec-code-review
      - spec-debug
    trigger_evidence:
      file_patterns:
        - "**/*.kt"
        - "**/*.kts"
        - "**/build.gradle.kts"
        - "**/settings.gradle.kts"
        - "**/AndroidManifest.xml"
      manifests:
        - "gradle/libs.versions.toml"
        - "build.gradle.kts"
        - "settings.gradle.kts"
      keywords:
        - Android
        - KMP
        - Compose
        - Coroutine
        - Flow
        - ViewModel
        - lifecycle
    avoid_when:
      - docs_only
      - formatting_only
      - generated_only
      - lockfile_only_without_runtime_change
    evidence_required:
      - diff
      - changed_files
      - relevant_source
      - relevant_manifest
    output_contracts:
      spec-code-review: review-finding.v1
      spec-plan: plan-consultation.v1
      spec-debug: debug-diagnosis.v1
    max_findings: 6
    min_confidence: 75
    default_model: mid_tier
```

## 5.2 Agent 状态

每个 agent 必须有生命周期状态：

```yaml
status: proposed | active | deprecated | retired | experimental
```

含义：

| 状态             | 含义                    |
| -------------- | --------------------- |
| `proposed`     | 已设计，未接入 workflow      |
| `experimental` | 可被手动调用或测试场景调用，不进入默认路由 |
| `active`       | 可被 routing 自动选择       |
| `deprecated`   | 保留兼容，但不推荐新增调用         |
| `retired`      | 不再调用，等待删除             |

## 5.3 Agent 分类

建议先分 8 类：

```text
1. language_framework_reviewer
2. build_resolver
3. architecture_reviewer
4. product_domain_reviewer
5. quality_reviewer
6. security_compliance_reviewer
7. release_deployment_reviewer
8. workflow_native_reviewer
```

---

# 6. Routing 机制设计

## 6.1 输入证据

Routing 不能只看文件后缀。输入应包含：

```text
- user request
- current workflow name
- current mode
- spec / brainstorm / plan / task pack / work artifact
- changed files
- diff summary
- executable changed lines
- package manifests
- lockfiles
- build configs
- test configs
- graph facts
- impact facts
- previous review artifacts
- CI/build logs
- repo profile / standards
- AGENTS.md / CLAUDE.md governing paths
```

## 6.2 路由流程

```text
Stage A: Evidence collection
  - detect changed files
  - detect language/framework/build tool
  - detect workflow context
  - detect graph readiness and impact hints
  - detect plan/task source authority

Stage B: Candidate generation
  - select possible agents from agent-catalog.yaml
  - attach trigger reasons
  - attach avoid reasons
  - mark confidence

Stage C: Skill-level judgment
  - skill reads candidates
  - remove low-value agents
  - enforce max team size
  - ensure cross-cutting coverage

Stage D: Dispatch
  - build bounded context pack per agent
  - spawn selected agents
  - require schema output

Stage E: Synthesis
  - normalize
  - dedup
  - confidence gate
  - severity calibration
  - route safe_auto / gated_auto / manual / advisory
  - write artifacts
```

## 6.3 Routing Decision Record

每次调度都应该生成 routing decision record，便于审计和调优。

```json
{
  "schema_version": "spec-first.routing-decision.v1",
  "workflow": "spec-code-review",
  "run_id": "2026-05-02T10-00-00Z-kmp-review",
  "scope": {
    "base": "origin/main",
    "head": "HEAD",
    "changed_files_count": 14,
    "executable_changed_lines": 420
  },
  "detected_stacks": [
    {
      "stack": "kotlin-android-kmp",
      "confidence": 0.93,
      "evidence": [
        "app/build.gradle.kts",
        "shared/src/commonMain/**/*.kt",
        "AndroidManifest.xml"
      ]
    }
  ],
  "selected_agents": [
    {
      "agent": "spec-kotlin-android-kmp-reviewer",
      "reason": "Kotlin/KMP source and Gradle module boundaries changed",
      "confidence": 0.93
    },
    {
      "agent": "spec-api-contract-reviewer",
      "reason": "shared API DTO and network contract changed",
      "confidence": 0.82
    }
  ],
  "skipped_agents": [
    {
      "agent": "spec-rust-reviewer",
      "reason": "no Rust files or Cargo manifests detected"
    }
  ]
}
```

---

# 7. 输出协议设计

## 7.1 review-finding.v1

现有 `spec-code-review` 已经有 severity、routing、confidence、safe_auto/gated_auto/manual/advisory 这类强设计。扩展后的 agent 必须服从这个 contract，而不是使用 ECC 原始 `[CRITICAL]` / `[HIGH]` 风格文本输出。`spec-code-review` 当前也明确区分 severity 和 action routing：severity 表示紧急程度，routing 表示谁处理以及当前 skill 是否能修改 checkout。([GitHub][2])

建议 schema：

```json
{
  "schema_version": "spec-first.review-finding.v1",
  "agent": "spec-kotlin-android-kmp-reviewer",
  "persona": "kotlin-android-kmp",
  "severity": "P1",
  "confidence": 86,
  "file": "shared/src/commonMain/kotlin/com/foo/UserRepository.kt",
  "line": 42,
  "title": "CancellationException is swallowed in repository flow",
  "evidence": [
    "catch (e: Exception) handles CancellationException and emits fallback state",
    "caller collects this flow from viewModelScope"
  ],
  "why_it_matters": "Swallowing cancellation can keep stale work alive and break structured concurrency.",
  "suggested_fix": "Catch CancellationException first and rethrow it before handling other exceptions.",
  "autofix_class": "gated_auto",
  "owner": "downstream-resolver",
  "requires_verification": true,
  "verification_hint": "./gradlew :shared:testDebugUnitTest",
  "pre_existing": false,
  "related_requirements": ["R-APP-03"],
  "related_plan_units": ["U2"]
}
```

## 7.2 plan-consultation.v1

`spec-plan` 不应该等代码写完才让专家介入。技术栈明确时，专家可以做 plan-level feasibility review。

```json
{
  "schema_version": "spec-first.plan-consultation.v1",
  "agent": "spec-java-spring-reviewer",
  "scope": "plan",
  "decision": "revise",
  "blocking_concerns": [
    {
      "title": "Plan changes entity lifecycle but lacks transaction boundary",
      "plan_section": "Implementation Unit 3",
      "why_it_matters": "State transition and event publish can become non-atomic.",
      "recommendation": "Move transition into service-level @Transactional boundary and publish outbox event after commit."
    }
  ],
  "advisory_notes": [
    "Prefer DTO projection for list endpoint to avoid entity leakage."
  ],
  "recommended_tests": [
    "service transition test for illegal state changes",
    "repository query test for pagination"
  ]
}
```

## 7.3 debug-diagnosis.v1

build resolver 不输出 review finding，而输出 diagnosis：

```json
{
  "schema_version": "spec-first.debug-diagnosis.v1",
  "agent": "spec-kotlin-gradle-build-resolver",
  "error_signature": "Unresolved reference: libs",
  "probable_root_cause": "Version catalog not visible from included build",
  "confidence": 82,
  "evidence": [
    "settings.gradle.kts includes build-logic",
    "build-logic plugin references libs without catalog injection"
  ],
  "fix_plan": [
    "Expose version catalog to build-logic",
    "Move plugin dependency alias to pluginManagement or convention plugin config"
  ],
  "verification_commands": [
    "./gradlew :app:assembleDebug"
  ],
  "risk": "manual"
}
```

---

# 8. 工作流接入方案

## 8.1 `spec-code-review`：第一优先级改造

### 当前基础

`spec-code-review` 已经支持：

* diff scope detection
* mode: interactive / autofix / report-only / headless
* severity P0-P3
* safe_auto / gated_auto / manual / advisory
* always-on reviewers
* conditional reviewers
* stack-specific reviewers
* synthesis / dedup / confidence gate
* artifacts under emitted `<review-artifact-dir>/` paths resolved from the current OS temp root

这些都应该保留。([GitHub][2])

### 改造目标

把当前 stack-specific conditional 从 6 个扩展为可路由专家池。

当前 persona catalog 中 stack-specific 有 Rails、Python、TypeScript、Frontend race、Swift/iOS。([GitHub][7])

建议新增：

```text
spec-go-reviewer
spec-java-spring-reviewer
spec-kotlin-android-kmp-reviewer
spec-rust-reviewer
spec-cpp-reviewer
spec-csharp-dotnet-reviewer
spec-dart-flutter-reviewer
spec-php-laravel-reviewer
spec-database-reviewer
spec-deployment-devops-reviewer
spec-accessibility-reviewer
spec-silent-failure-hunter
spec-monorepo-boundary-reviewer
```

### Review Team Selection 新流程

```text
Always-on:
  - correctness
  - testing
  - maintainability
  - project-standards
  - spec-agent-native-reviewer
  - spec-learnings-researcher

Cross-cutting conditional:
  - security
  - performance
  - api-contract
  - data-migrations
  - reliability
  - adversarial
  - cli-readiness
  - previous-comments

Stack-specific conditional:
  - language/framework experts from agent-catalog.yaml

Scenario-specific conditional:
  - database
  - deployment-devops
  - observability
  - accessibility
  - browser-qa
  - silent-failure-hunter
  - monorepo-boundary
```

### 关键限制

1. 不允许 agent 原样输出 markdown finding，必须输出 JSON。
2. 不允许 agent 自己决定最终 severity。
3. 不允许 agent 自己决定 safe_auto。
4. 不允许 language agent 报 formatter/linter 能自动发现的问题。
5. 不允许 docs-only diff 触发 runtime-focused reviewer。
6. 默认每个 stack-specific agent 最多输出 6 条 finding。
7. P2/P3 advisory 进入 soft bucket，防止噪音。

---

## 8.2 `spec-debug`：第二优先级改造

ECC 的 build resolver 类 agent 很适合补 spec-debug。ECC `agents/` 目录已经有 Go、Java、Kotlin、Rust、C++、Dart、PyTorch 等 build resolver。([GitHub][8])

### 触发方式

`spec-debug` 不应该只看语言文件，而要看错误签名。

```text
Error log contains:
  "Execution failed for task" + Gradle + .kt/.kts
    -> spec-kotlin-gradle-build-resolver

  "mvn test failed" / "NoSuchBeanDefinitionException"
    -> spec-java-gradle-maven-build-resolver

  "go test" / "data race" / "undefined: xxx"
    -> spec-go-build-resolver

  "cargo check" / borrow checker / lifetime error
    -> spec-rust-cargo-build-resolver

  "CMake Error" / linker undefined symbol
    -> spec-cpp-cmake-build-resolver

  "flutter build" / pubspec / Gradle Android plugin
    -> spec-flutter-build-resolver

  "CUDA out of memory" / torch version mismatch
    -> spec-pytorch-cuda-runtime-resolver
```

### 输出

`spec-debug` 产物建议写入：

```text
/tmp/spec-first/spec-debug/<run-id>/
├── diagnosis.json
├── selected-agents.json
├── root-cause-candidates.json
├── fix-plan.md
└── verification-commands.md
```

---

## 8.3 `spec-plan`：第三优先级改造

`spec-plan` 当前明确不实现代码、不跑测试、不从 execution-time results 学习；它是 durable implementation plan。([GitHub][4])

因此专家在 `spec-plan` 中的角色不是 review code，而是：

```text
- 评审技术方案是否符合该技术栈真实工程约束
- 发现 plan 漏掉的边界条件
- 补充 verification strategy
- 标记高风险实现单元
- 建议 task group / team boundary
```

### 接入点

在 `spec-plan` 增加一个可选 Stage：

```text
Stage X: Expert Consultation Pass

When:
  - plan touches a stack with active expert
  - plan is multi-module / multi-service / multi-client
  - plan includes DB migration, auth, payment, external API, deployment, mobile app, frontend state, performance-sensitive path

Input:
  - current plan draft
  - requirements / brainstorm
  - graph facts / impacted modules
  - repo manifests
  - relevant code excerpts

Output:
  - plan-consultation.v1
  - required plan revisions
  - recommended expert review list for code-review
```

### plan frontmatter 增强

```yaml
expert_consultation:
  status: completed
  selected_agents:
    - spec-kotlin-android-kmp-reviewer
    - spec-api-contract-reviewer
    - spec-database-reviewer
  required_revisions:
    - U3 transaction boundary must be explicit
  recommended_review_agents:
    - spec-kotlin-android-kmp-reviewer
    - spec-api-contract-reviewer
    - spec-reliability-reviewer
```

---

## 8.4 `spec-write-tasks`：支撑多团队交付

`spec-write-tasks` 当前已经强调 task pack 是派生产物，并且要求 `spec_id`、`source_plan`、`source_plan_hash`，防止 wrong-chain / stale task handoff。([GitHub][5])

扩展重点是：

> 在 task pack 里显式记录 task group 的技术栈、团队边界、推荐专家、验证方式。

### 新增 task group 结构

```yaml
task_groups:
  - id: app-kmp
    target_repo: mobile-app
    team_hint: app-team
    stack:
      - kotlin
      - android
      - kmp
      - compose
    source_plan_units:
      - U2
      - U4
    recommended_agents:
      - spec-kotlin-android-kmp-reviewer
      - spec-mobile-ux-reviewer
      - spec-api-contract-reviewer
    verification_focus:
      - ./gradlew :app:testDebugUnitTest
      - ./gradlew :shared:allTests

  - id: h5-frontend
    target_repo: web-h5
    team_hint: frontend-team
    stack:
      - typescript
      - react
    recommended_agents:
      - spec-kieran-typescript-reviewer
      - spec-frontend-architecture-reviewer
      - spec-accessibility-reviewer

  - id: market-backend
    target_repo: market-service
    team_hint: market-backend-team
    stack:
      - java
      - spring-boot
      - mysql
    recommended_agents:
      - spec-java-spring-reviewer
      - spec-database-reviewer
      - spec-reliability-reviewer
```

### 关键规则

1. task group 可以按业务域、技术栈、团队边界拆。
2. 不拆多个 spec_id，也可以给多个团队开发。
3. spec_id 代表同一个需求闭环；task group 代表执行切片。
4. 每个 task group 可以有不同 target_repo / target_module / recommended_agents。
5. source_plan 仍然是唯一权威，task pack 不改需求范围。

---

## 8.5 `spec-work`：专家只做 bounded guidance，不抢执行权

`spec-work` 中不建议让多个专家同时写代码。推荐：

```text
Before implementation:
  - load task-specific expert hints

During failure:
  - call build/debug resolver

Before completion:
  - call local report-only review for touched stack

After completion:
  - write residual risks and verification notes
```

原则：

```text
1. 一个 checkout 同一时间只有一个 mutating executor。
2. 专家默认 read-only。
3. build resolver 可以给 fix plan，但不直接并行改代码。
4. 需要多专家并行时，必须用独立 worktree 或 report-only。
```

这个和 `spec-code-review` 现有约束一致：同一个 checkout 不应该 fan out 多个 fixer，除非使用隔离 worktree/branch。([GitHub][2])

---

## 8.6 `spec-doc-review`：从“文字审查”升级为“可交付性审查”

doc-review 可以接入：

```text
spec-product-lens-reviewer
spec-api-contract-reviewer
spec-data-migration-expert
spec-security-lens-reviewer
spec-deployment-devops-reviewer
spec-mobile-ux-reviewer
spec-frontend-architecture-reviewer
spec-backend-architecture-reviewer
```

它的任务不是替代 plan，而是判断文档是否足以进入下一阶段：

```text
- PRD 是否能被拆成 plan？
- 技术方案是否能被拆成 task pack？
- 是否缺少跨端契约？
- 是否缺少 API contract？
- 是否缺少数据迁移策略？
- 是否缺少验收与回滚？
- 是否缺少团队边界？
```

---

# 9. Agent 迁移策略：从 ECC 到 spec-first

## 9.1 不直接 copy，采用 rewrite-import

建议每个 ECC agent 进入 spec-first 前都走四步：

```text
1. Source Analysis
   - 阅读 ECC agent 原文
   - 提取 role / checklist / commands / anti-patterns / escalation rules

2. Spec-First Adaptation
   - 改成 spec-first 命名
   - 替换输出格式为 spec-first schema
   - 删除自带全局 workflow 决策
   - 删除不适合 spec-first 的命令假设

3. Routing Contract
   - 写入 agent-catalog.yaml
   - 明确 trigger / avoid / workflows / output contracts

4. Golden Tests
   - 加路由测试
   - 加输出 schema 测试
   - 加 false-positive 测试
```

## 9.2 Agent 文件模板

```markdown
---
name: spec-go-reviewer
description: Go reviewer for spec-first workflows. Use when meaningful Go behavior, concurrency, API, persistence, CLI, or performance-sensitive code changes are present.
model: sonnet
tools: Read, Grep, Glob, Bash
---

# Role

You are a Go engineering reviewer inside the spec-first workflow.

# Scope

You review only Go-related engineering risks. You do not own the workflow, do not mutate code, and do not broaden scope beyond the provided evidence.

# Activation Evidence

Use when the routing context includes:
- changed `*.go`
- `go.mod` / `go.sum`
- Go CLI/server/test/build changes
- Go-related build/test failure logs

Skip when:
- docs-only change
- generated-only change
- formatting-only change
- lockfile-only change with no runtime dependency implication

# Required Inputs

- user request
- workflow name
- diff scope
- changed files
- relevant Go files
- nearby tests
- package/module manifests
- graph/impact facts when available
- plan/task refs when available

# Review Focus

1. correctness and error propagation
2. context cancellation
3. goroutine lifecycle
4. data races
5. API/contract behavior
6. database/query safety
7. test quality
8. performance only where evidence indicates a hot path

# Output

Return JSON conforming to `spec-first.review-finding.v1`.

# Constraints

- Do not report generic style issues.
- Do not report findings without concrete evidence.
- Do not propose broad rewrites.
- Prefer fewer, high-confidence findings.
- Minimum confidence: 75.
- Max findings: 6.
```

---

# 10. 专家团队扩展清单

## 10.1 P0：必须优先补齐

| Agent                              | 来源参考                           | 接入 workflow                               | 价值                                     |
| ---------------------------------- | ------------------------------ | ----------------------------------------- | -------------------------------------- |
| `spec-kotlin-android-kmp-reviewer` | ECC Kotlin reviewer            | plan / tasks / work / code-review / debug | 补 App、KMP、Compose、Coroutine、Android 安全 |
| `spec-java-spring-reviewer`        | ECC Java reviewer              | plan / tasks / code-review / debug        | 补企业后台、中台、交易/行情服务                       |
| `spec-go-reviewer`                 | ECC Go reviewer                | code-review / debug / work                | 补 infra、CLI、backend、并发与性能              |
| `spec-rust-reviewer`               | ECC Rust reviewer              | code-review / debug                       | 补工具链、高性能组件                             |
| `spec-cpp-reviewer`                | ECC C++ reviewer               | code-review / debug                       | 补 native、SDK、性能敏感场景                    |
| `spec-csharp-dotnet-reviewer`      | ECC C# reviewer                | code-review / debug                       | 补 .NET 企业系统                            |
| `spec-dart-flutter-reviewer`       | ECC Flutter reviewer           | plan / code-review / debug                | 补 Flutter 跨端                           |
| `spec-database-reviewer`           | ECC database reviewer          | plan / code-review / debug                | 补 schema、migration、transaction、query   |
| `spec-silent-failure-hunter`       | ECC silent failure hunter      | code-review / debug                       | 补“看似成功但实际失败”的质量缺陷                      |
| `spec-deployment-devops-reviewer`  | ECC deployment/docker patterns | plan / code-review                        | 补 CI/CD、Docker、rollback、health check   |

## 10.2 P1：第二阶段增强

```text
spec-accessibility-reviewer
spec-browser-qa-reviewer
spec-observability-reviewer
spec-monorepo-boundary-reviewer
spec-cache-consistency-reviewer
spec-event-driven-architecture-reviewer
spec-auth-authorization-reviewer
spec-privacy-pii-reviewer
spec-supply-chain-security-reviewer
spec-react-nextjs-reviewer
spec-fastapi-reviewer
spec-django-reviewer
spec-laravel-reviewer
```

## 10.3 P2：作为知识包，暂不做独立 agent

```text
api-design patterns
docker-patterns
deployment-patterns
database-migrations
e2e-testing
cost-aware-llm-pipeline
regex-vs-llm decision framework
agent-eval
skill-stocktake
iterative-retrieval
```

---

# 11. `spec-agent-audit` 新 skill 设计

## 11.1 为什么需要

一旦 agent 扩张，必须有治理机制，否则会出现：

```text
- agent 重复
- 触发过宽
- 输出噪音
- schema 不统一
- 与 skill 职责冲突
- token 成本失控
- 常驻上下文污染
- 低质量 advisory 泛滥
```

ECC 的 `skill-stocktake` 明确用于审查 skills / commands 的质量、重叠、是否应该 keep/improve/merge/retire。([GitHub][14])

spec-first 应该做自己的 `spec-agent-audit`。

## 11.2 新 skill 目录

```text
skills/spec-agent-audit/
├── SKILL.md
├── references/
│   ├── agent-quality-checklist.md
│   ├── routing-coverage-matrix.md
│   ├── overlap-detection.md
│   ├── schema-compliance.md
│   ├── workflow-usage-check.md
│   └── audit-output-template.md
└── scripts/
    ├── list-agents.mjs
    ├── inspect-agent-frontmatter.mjs
    ├── detect-agent-overlap.mjs
    ├── validate-agent-catalog.mjs
    └── validate-agent-fixtures.mjs
```

## 11.3 审查输出

```markdown
# Agent Audit Report

## Summary

- total_agents:
- active_agents:
- experimental_agents:
- deprecated_agents:
- orphan_agents:
- duplicate_clusters:

## Coverage Matrix

| Workflow | Covered Experts | Missing Experts | Risk |
|---|---|---|---|

## Duplicate / Overlap Clusters

| Cluster | Agents | Recommendation |
|---|---|---|

## Routing Quality

| Agent | Trigger Precision | Avoid Rules | Output Schema | Recommendation |
|---|---|---|---|---|

## Actions

- keep
- improve
- merge
- deprecate
- retire
```

---

# 12. 测试与验收方案

## 12.1 单元测试

```text
tests/agent-routing/
├── detect-stack.test.mjs
├── candidate-selection.test.mjs
├── avoid-rules.test.mjs
├── catalog-schema.test.mjs
├── output-schema.test.mjs
└── routing-decision-record.test.mjs
```

## 12.2 Golden fixtures

```text
tests/fixtures/agent-routing/
├── docs-only-change/
├── kotlin-kmp-compose-change/
├── java-spring-api-change/
├── go-concurrency-change/
├── rust-cargo-build-failure/
├── db-migration-change/
├── frontend-accessibility-change/
├── multi-team-requirement/
└── monorepo-multi-module-change/
```

## 12.3 必须通过的验收用例

| 用例                     | 输入                                       | 期望                                            |
| ---------------------- | ---------------------------------------- | --------------------------------------------- |
| docs-only              | 只改 README                                | 不触发 runtime language reviewer                 |
| Kotlin App             | 改 `.kt`、`build.gradle.kts`、Compose state | 触发 Kotlin/KMP + mobile UX + testing           |
| Java Spring API        | 改 Controller/Service/Repository          | 触发 Java Spring + API contract + database      |
| Go concurrency         | 改 goroutine/context/channel              | 触发 Go + reliability + testing                 |
| DB migration           | 改 migration/schema/backfill              | 触发 database + data migration + deployment     |
| React UI               | 改 TSX + async state                      | 触发 TS + frontend race + accessibility         |
| Docker/CI              | 改 Dockerfile / GitHub Actions            | 触发 DevOps/deployment                          |
| Multi-team PRD         | 一个需求涉及 App/H5/Admin/多后台                  | task pack 输出 task_groups + recommended_agents |
| Build failure          | Gradle/Maven/Cargo/go test failed        | `spec-debug` 触发对应 build resolver              |
| False-positive control | 只有 lockfile 或 generated diff             | 不触发高成本专家                                      |

## 12.4 质量指标

```text
Routing precision:
  - docs-only false activation = 0
  - generated-only false activation = 0
  - language expert activation precision >= 85%

Review quality:
  - 每个 finding 有 file/line/evidence
  - P0/P1 finding validation pass >= 90%
  - duplicate finding rate <= 15%
  - advisory-only noise <= 20%

Cost:
  - small diff selected agents <= 6 + necessary conditionals
  - medium diff selected agents <= 10
  - large/high-risk diff selected agents <= 15 unless explicit mode allows more

Workflow integrity:
  - no agent writes workflow state
  - no agent bypasses skill synthesis
  - no agent mutates checkout in report-only
```

---

# 13. 分阶段实施计划

## Phase 0：调研与基线文档

产物：

```text
docs/2026-05-02-agent-team-expansion/
├── 00-ecc-source-analysis.md
├── 01-current-spec-first-agent-gap.md
├── 02-target-agent-taxonomy.md
├── 03-routing-design.md
├── 04-integration-plan.md
└── README.md
```

任务：

1. 列出现有 spec-first agents。
2. 列出现有 spec-first skills 与 agent 使用关系。
3. 对照 ECC agents / skills / rules。
4. 形成 P0/P1/P2 agent 候选。
5. 明确不引入 hooks/commands/runtime。
6. 输出最终 agent taxonomy。

验收：

```text
- 每个候选 agent 有来源、价值、workflow、风险、优先级
- 每个现有 skill 有是否需要专家团队的判断
- 明确重复/合并/新增/暂缓/拒绝清单
```

---

## Phase 1：Agent Routing Infrastructure

改动文件：

```text
skills/_shared/agent-routing/
├── README.md
├── agent-catalog.yaml
├── routing-rules.md
├── stack-detectors.md
├── routing-decision-record.schema.json
├── output-contracts/
│   ├── review-finding.schema.json
│   ├── plan-consultation.schema.json
│   └── debug-diagnosis.schema.json
└── scripts/
    ├── detect-stack.mjs
    ├── detect-agent-candidates.mjs
    └── validate-agent-catalog.mjs
```

验收：

```bash
node skills/_shared/agent-routing/scripts/validate-agent-catalog.mjs
node skills/_shared/agent-routing/scripts/detect-stack.mjs --fixtures tests/fixtures/agent-routing
node skills/_shared/agent-routing/scripts/detect-agent-candidates.mjs --changed-files tests/fixtures/agent-routing/kotlin-kmp-compose-change/files.txt
```

---

## Phase 2：P0 Language Reviewers

新增：

```text
agents/spec-go-reviewer.agent.md
agents/spec-java-spring-reviewer.agent.md
agents/spec-kotlin-android-kmp-reviewer.agent.md
agents/spec-rust-reviewer.agent.md
agents/spec-cpp-reviewer.agent.md
agents/spec-csharp-dotnet-reviewer.agent.md
agents/spec-dart-flutter-reviewer.agent.md
agents/spec-database-reviewer.agent.md
agents/spec-silent-failure-hunter.agent.md
agents/spec-deployment-devops-reviewer.agent.md
```

改造：

```text
skills/spec-code-review/SKILL.md
skills/spec-code-review/references/persona-catalog.md
skills/spec-code-review/references/subagent-template.md
skills/spec-code-review/references/findings-schema.json
```

验收：

```text
- P0 agent 都能被 catalog 校验通过
- spec-code-review 可以解释 selected/skipped agents
- docs-only 不触发语言专家
- Kotlin/Java/Go fixture 可以正确触发对应专家
```

---

## Phase 3：Build Resolver 接入 `spec-debug`

新增：

```text
agents/spec-go-build-resolver.agent.md
agents/spec-java-gradle-maven-build-resolver.agent.md
agents/spec-kotlin-gradle-build-resolver.agent.md
agents/spec-rust-cargo-build-resolver.agent.md
agents/spec-cpp-cmake-build-resolver.agent.md
agents/spec-flutter-build-resolver.agent.md
agents/spec-pytorch-cuda-runtime-resolver.agent.md
```

改造：

```text
skills/spec-debug/SKILL.md
skills/spec-debug/references/error-signature-catalog.md
skills/spec-debug/references/debug-agent-routing.md
```

验收：

```text
- Gradle/Kotlin 错误触发 Kotlin build resolver
- Maven/Spring 错误触发 Java resolver
- Cargo 错误触发 Rust resolver
- go test/build 错误触发 Go resolver
- 输出 debug-diagnosis.v1
```

---

## Phase 4：接入 `spec-plan` / `spec-write-tasks`

改造：

```text
skills/spec-plan/SKILL.md
skills/spec-plan/references/expert-consultation-routing.md
skills/spec-write-tasks/SKILL.md
skills/spec-write-tasks/references/team-boundary-routing.md
```

新增字段：

```yaml
expert_consultation:
recommended_review_agents:
task_groups:
```

验收：

```text
- 多端需求可以在一个 spec_id 下拆成多个 task group
- 每个 task group 可以绑定 target_repo / target_module / recommended_agents
- task pack 仍然不能改变 plan scope
- source_plan_hash 校验规则不被破坏
```

---

## Phase 5：`spec-agent-audit`

新增：

```text
skills/spec-agent-audit/
```

验收：

```text
- 能列出所有 agents
- 能发现 orphan agent
- 能发现 trigger overlap
- 能校验 output contract
- 能给出 keep/improve/merge/deprecate/retire 建议
```

---

# 14. 风险与防护

## 14.1 最大风险：上下文污染

风险：

```text
把所有 language rules、framework rules、agent docs 注入 AGENTS.md / CLAUDE.md，导致 brainstorm/plan/doc-review 都被 runtime coding rules 污染。
```

防护：

```text
- 常驻只放 workflow contract 和高质量编码价值观
- 语言/框架知识放 knowledge pack
- skill 通过 routing 按需加载
- agent 自己读取必要上下文，不由 orchestrator 大包塞入
```

## 14.2 第二风险：agent 重复审查

风险：

```text
correctness、language reviewer、security、adversarial 同时报同一个问题。
```

防护：

```text
- synthesis 按 file + line_bucket + normalized_title + evidence 去重
- cross-reviewer corroboration 可以提升 confidence
- duplicate advisory 自动降噪
```

## 14.3 第三风险：专家触发过宽

风险：

```text
只要看到 .kt 就触发 Kotlin expert，哪怕只是注释变化。
```

防护：

```text
- trigger_evidence + avoid_when 双规则
- executable changed lines 判断
- docs-only/generated-only/formatting-only 抑制
- routing-decision-record 记录 selected/skipped 理由
```

## 14.4 第四风险：ECC 原始 agent 与 spec-first contract 不一致

风险：

```text
ECC agent 多数输出 markdown summary，不符合 spec-first findings schema。
```

防护：

```text
- 只做 rewrite-import
- 不原样复制 output format
- 所有 agent 必须通过 schema 测试
```

## 14.5 第五风险：引入 hooks/runtime 冲突

风险：

```text
ECC hooks、commands、installer 和 spec-first 现有 CLI/init/mcp-setup/graph-bootstrap 发生控制面冲突。
```

防护：

```text
- 第一阶段明确禁止引入 ECC hooks/runtime/commands
- 只吸收 agent/rules/skill 方法论
```

---

# 15. 推荐最终落地顺序

最稳的顺序是：

```text
1. 先做 agent taxonomy 文档和 gap analysis
2. 再做 agent-catalog.yaml 和 routing schema
3. 再补 P0 reviewers
4. 只接入 spec-code-review
5. 跑 golden fixtures，把误触发和噪音压下来
6. 再接入 spec-debug build resolvers
7. 再接入 spec-plan / spec-write-tasks
8. 最后做 spec-agent-audit
```

不要一开始就做：

```text
- 全量导入 ECC agents
- 全量复制 ECC rules
- 全量改造所有 skill
- 引入 hooks runtime
- 引入 installer profile
- 引入 dashboard
```

---

# 16. 最终目标形态

集成完成后，spec-first 的能力会从：

```text
流程强
架构强
review 框架强
graph readiness 强
```

升级成：

```text
流程强
架构强
证据强
专家强
路由强
审查强
debug 强
多团队交付强
知识沉淀强
```

最终用户体验应该是：

```text
用户输入一个复杂需求
  ↓
spec-brainstorm 形成需求理解
  ↓
spec-plan 根据代码/图谱/标准生成技术方案
  ↓
专家团队做 plan consultation
  ↓
spec-write-tasks 按业务域/技术栈/团队边界拆 task group
  ↓
spec-work 执行具体任务
  ↓
遇到失败时 spec-debug 调用 build/debug 专家
  ↓
spec-code-review 根据 diff/plan/task/graph 精准组建 reviewer team
  ↓
synthesis 合并 findings，过滤噪音，形成可执行结论
  ↓
knowledge/solutions 沉淀经验
```

这才是 spec-first 相比普通 agent collection 的真正壁垒：

> **不是拥有更多 agent，而是能组织正确的专家，在正确的阶段，基于正确证据，输出可执行、可验证、可沉淀的研发结果。**

[1]: https://raw.githubusercontent.com/affaan-m/everything-claude-code/main/README.md "raw.githubusercontent.com"
[2]: https://github.com/sunrain520/spec-first/blob/master/skills/spec-code-review/SKILL.md "spec-first/skills/spec-code-review/SKILL.md at master · sunrain520/spec-first · GitHub"
[3]: https://github.com/sunrain520/spec-first/tree/master/skills "spec-first/skills at master · sunrain520/spec-first · GitHub"
[4]: https://github.com/sunrain520/spec-first/blob/master/skills/spec-plan/SKILL.md "spec-first/skills/spec-plan/SKILL.md at master · sunrain520/spec-first · GitHub"
[5]: https://github.com/sunrain520/spec-first/blob/master/skills/spec-write-tasks/SKILL.md "spec-first/skills/spec-write-tasks/SKILL.md at master · sunrain520/spec-first · GitHub"
[6]: https://github.com/sunrain520/spec-first/blob/master/skills/spec-graph-bootstrap/SKILL.md "spec-first/skills/spec-graph-bootstrap/SKILL.md at master · sunrain520/spec-first · GitHub"
[7]: https://github.com/sunrain520/spec-first/blob/master/skills/spec-code-review/references/persona-catalog.md "spec-first/skills/spec-code-review/references/persona-catalog.md at master · sunrain520/spec-first · GitHub"
[8]: https://github.com/affaan-m/everything-claude-code/tree/main/agents "everything-claude-code/agents at main · affaan-m/everything-claude-code · GitHub"
[9]: https://github.com/affaan-m/everything-claude-code/blob/main/agents/kotlin-reviewer.md "everything-claude-code/agents/kotlin-reviewer.md at main · affaan-m/everything-claude-code · GitHub"
[10]: https://github.com/affaan-m/everything-claude-code/blob/main/agents/java-reviewer.md "everything-claude-code/agents/java-reviewer.md at main · affaan-m/everything-claude-code · GitHub"
[11]: https://github.com/affaan-m/everything-claude-code/blob/main/agents/go-reviewer.md "everything-claude-code/agents/go-reviewer.md at main · affaan-m/everything-claude-code · GitHub"
[12]: https://github.com/affaan-m/everything-claude-code/blob/main/agents/typescript-reviewer.md "everything-claude-code/agents/typescript-reviewer.md at main · affaan-m/everything-claude-code · GitHub"
[13]: https://github.com/affaan-m/everything-claude-code/blob/main/rules/README.md "everything-claude-code/rules/README.md at main · affaan-m/everything-claude-code · GitHub"
[14]: https://raw.githubusercontent.com/affaan-m/everything-claude-code/main/skills/skill-stocktake/SKILL.md "raw.githubusercontent.com"
