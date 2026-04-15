# 版本更新

本目录用于记录 `spec-first` 近期的重要能力迭代。结合当前仓库版本信息，以下内容可作为 `v1.5.1` 阶段的核心更新摘要。

## 最近更新速览

| 日期 | 类型 | 主题 | 价值 |
|------|------|------|------|
| 2026-04-15 | feat | `spec-graph-bootstrap+crg` | 完成 Stage-0 后续 P1-P3 最小闭环：补齐 `plan/work minimal-context`、hybrid retrieval、AST-aware chunking、freshness/lint/contradictions、compiler 模块化、repo QA/context efficiency/regression benchmark、workflow telemetry、optional semantic rerank、workspace context 与知识治理能力 |
| 2026-04-15 | fix | `managed-state-upgrade` | 统一 legacy managed state 升级语义：`doctor` 会明确标记 legacy state 并指向 `init`，`init` 成为唯一支持的 hard-cut 升级入口，执行 managed hard reset 后全量重建运行时，`clean` 仅清理当前受管集合并保留用户自定义资产 |
| 2026-04-15 | feat | `spec-brainstorm` | `spec-brainstorm` 同步 `ce-brainstorm` 非 Slack 核心能力，并新增 source-driven supplemental context 路由：支持 Local Docs、Feishu Chat、Feishu Doc、GitHub URL、Docs URL、Web URL；同时补齐 `universal-brainstorming` / `visual-communication` references 与 contract/smoke 守卫 |
| 2026-04-14 | fix | `compound-core-workflows` | 修正 `spec-plan/references/plan-handoff.md` 中遗留的 `document-review mode:headless` 指令，使 planning handoff 与本地 `document-review` 非 headless contract 一致，避免自动化调用引用不存在模式 |
| 2026-04-14 | feat | `compound-core-workflows` | 完成 `compound-engineering-plugin` 核心链路批次 B-D 同步：`spec-plan` / `spec-brainstorm` 收口 repo-relative、mandatory document-review 与 reference 抽取；`spec-work` / `spec-work-beta` 收口 review/testing/delegation 约束并拆出 shipping/codex references；`spec-compound` / `spec-compound-refresh` 补 discoverability 检查、stack-aware reviewer 路由，并将 `docs/solutions/` 可发现性写回 `AGENTS.md` / `CLAUDE.md` |
| 2026-04-13 | refactor | `artifact-path` | CRG 图数据库从 `.spec-first-graph/` 迁移到 `.spec-first/graph/`；bootstrap 控制面从 `.context/spec-first/bootstrap/` 迁移到 `.spec-first/workflows/bootstrap/`；fingerprints.json 拆分为 `input-fingerprints.json`（graph 层）和 `artifact-manifest.json`（bootstrap 层）；ignore 文件从 `.spec-first-graphignore` 改名为 `.spec-firstignore` [breaking internal] |
| 2026-04-13 | docs | `install-experience` | 统一所有面向用户安装文档的 onboarding 顺序（安装 -> doctor -> init -> 重启 -> workflow）；修正 tree-sitter peer dep 版本方向描述错误（主包 0.21.0，grammar 要求更高版本）；将 peer warning 叙事从"预期行为"改为"已知兼容性噪音，本版本目标是消除"；FAQ 明确区分"安装成功确认"与"宿主内 workflow 可见"两个阶段 |
| 2026-04-12 | feat | `spec-graph-bootstrap` | `graph-bootstrap` 的 manifest、安装提示、README、用户手册与 smoke 断言统一升级为 graph-informed Phase 0-4 / 阶段2最小闭环语义，对外描述与 `SKILL.md`、阶段2文档收敛一致 |
| 2026-04-09 | feat | `spec-graph-bootstrap` | 新增阶段 1 安装集成入口，`bootstrap` 保持稳定默认入口，`graph-bootstrap` 以并行验证入口接入 Claude / Codex runtime、smoke 与文档链路 |
| 2026-04-08 | fix | `mcp-setup` | 收紧双宿主健壮性，Serena MCP 配置按宿主上下文校验，宿主歧义时不再默认 Claude |
| 2026-04-08 | docs | `mcp-setup` | 将技能命名统一为 `spec-mcp-setup`，Codex 直接调用格式改为 `$spec-mcp-setup`，与其他 spec-* 技能保持一致 |
| 2026-04-08 | feat | `codex` | Codex init 现在也会生成 `/spec:*` command files，和 Claude 对齐命令可见性、doctor 检查和 clean 清理链路 |
| 2026-04-08 | docs | `mcp-setup` | 增加更友好的执行进度提示，安装与验证脚本会显示当前宿主检查、逐项配置、标记写入和完成状态 |
| 2026-04-08 | feat | `mcp-setup` | 增加 Windows PowerShell 7+ 支持，补齐 detect/check/install/verify 的 .ps1 入口，并把技能合同改成按平台选择脚本 |
| 2026-04-08 | fix | `mcp-setup/spec-bootstrap` | 让 MCP 安装与引导流程按当前宿主自适应，自动区分 Claude Code / Codex 的配置文件与 host-setup 标记路径，并补齐双宿主 unit 测试与文档同步 |
| 2026-04-08 | refactor | `graphify` | 全局删除 graphify skill、命令模板和运行时引用，移除 spec-first 中的 graphify 入口 |
| 2026-04-08 | fix | `mcp-setup/spec-bootstrap` | 删除 GitNexus / ABCoder 安装链与 Full mode 引用，收缩为 Serena / Sequential Thinking / Context7 基础 MCP 套件，并同步重写 host schema、验证脚本和 PRD 模板 |
| 2026-04-01 | feat | `version-reminder` | CLI 执行真实命令前自动检查 npm 最新版本，有更新时输出提醒，降低用户使用旧版本的概率 |
| 2026-04-01 | feat | `lang-governance` | `spec-first init` 将语言和 Changelog 治理规则写入 CLAUDE.md/AGENTS.md，并修复 lang 优先级（项目 > 全局 > 默认） |
| 2026-04-01 | feat | `mcp-setup` | 把 MCP 工具安装、检测、配置合并为一条一键化路径，降低 Full mode 落地门槛 |
| 2026-03-31 | fix | `spec-bootstrap` | 基于 review 结论补强原子备份、失败恢复、MCP 连接校验等关键可靠性能力 |
| 2026-03-31 | feat | `spec-bootstrap` | 新增 Stage-0 上下文引导工作流，为后续 brainstorm / plan / work / review / compound 提供稳定上下文资产 |

---

## 2026-04-15 `feat(spec-graph-bootstrap+crg)`

### 更新内容

围绕 `spec-graph-bootstrap` 与 `src/crg` 完成 Stage-0 后续能力闭环，把此前只覆盖 `P0` 的最小消费链，扩展为可迭代的 machine-first context platform。

### 主要变化

- `minimal-context`
  - 补齐 `plan.json`、`work.json`
  - `review/plan/work` 三类 workflow 都有明确的 machine-first task card
- retrieval / indexing
  - 新增 hybrid retrieval v1：`seed -> expand -> rerank -> pack`
  - 引入 AST-aware chunking v1，并让 retrieval 可返回 chunk 级上下文
  - 支持 optional semantic rerank，默认不破坏 lexical + graph 主链
- Stage-0 compiler / governance
  - 新增 `freshness / lint / contradictions`
  - 拆分 compiler：machine artifacts、human assets、routing 三层
  - 新增 ownership / review queue 治理能力
- benchmark / regression
  - 新增 `repo-qa`、`context-efficiency`、`regression gate`
  - `workflow telemetry` 记录 selected assets / skipped rules / fallback reason / freshness status
- workspace
  - 支持跨 repo workspace context 聚合与优雅降级

### 版本意义

这次更新的核心不是“再多产一些文档”，而是把 Stage-0 从一次性 bootstrap 输出，推进成一个可验证、可回归、可治理、可跨仓库扩展的上下文分发底座。后续无论是 `spec-plan`、`spec-work`、`spec-review`，还是更高层的 benchmark/regression 演进，都有了统一的 machine-first contract 和最小实现骨架。

---

## 2026-04-15 `fix(managed-state-upgrade)`

### 更新内容

统一 `doctor / init / clean` 对 legacy managed state 的处理语义，并同步更新 README 与用户手册，避免用户从不同文档读到相互冲突的升级路径。

### 主要变化

- `doctor`
  - 若发现旧版 `state.json` 形状，会明确报告 `legacy managed state detected`
  - 修复建议统一收敛到重新执行 `spec-first init --claude|--codex`
- `init`
  - 成为唯一支持的 legacy 升级入口
  - 检测到 legacy state 时，先执行 managed hard reset，再按当前版本全量重建运行时
- `clean`
  - 只删除当前受管集合
  - 保留未受管的自定义 skills / agents
  - 不再承担 legacy 迁移职责
- 文档
  - README、快速开始、核心概念、FAQ、本地源码安装指南全部同步到同一口径
  - 修正 Claude workflow skill 实际目录为 `.claude/spec-first/workflows/`
  - 修正当前运行时数量说明为 `45` 个 skills、`54` 个 agents、`4` 个 agent support files

### 版本意义

这次更新解决的不是单条命令行为，而是用户升级路径的认知分叉问题。当前口径非常明确：看到 legacy state，不要手工清目录，不要先跑 `clean`，直接重新运行 `init`。这样既能保证 hard-cut 升级一致性，也能最大程度保护用户自定义运行时资产。

---

## 2026-04-15 `feat(spec-brainstorm)`

### 更新内容

`spec-brainstorm` 完成对上游 `ce-brainstorm` 非 Slack 核心能力的同步，并在 `spec-first` 当前产品边界内新增 supplemental context 路由能力。

### 主要变化

- 同步上游 brainstorm 核心能力
  - 非软件任务分流
  - 先问用户已有想法
  - 至少一个非显然角度
  - 先展示方案，再给推荐
  - requirements visual communication guidance
- 新增 supplemental context adapters
  - `local-doc-reader`
  - `feishu-chat-researcher`
  - `feishu-doc-reader`
  - `github-context-reader`
  - `docs-context-reader`
  - `web-context-reader`
- 新增 references
  - `skills/spec-brainstorm/references/universal-brainstorming.md`
  - `skills/spec-brainstorm/references/visual-communication.md`
- contract 收口
  - supplemental context 改为 `opt-in / source-driven`
  - 冻结 `research digest.status` 枚举
  - 明确 `find-skills` 只是 environment-optional fallback
  - 锁定 Claude / Codex 双宿主 runtime 命名与 agent 引用适配差异
- 测试与打包守卫
  - 新增 `tests/unit/spec-brainstorm-contracts.test.js`
  - smoke 覆盖新 references、new research agents 和 runtime transform 结果

### 版本意义

这次更新把 `spec-brainstorm` 从“只读 repo 内上下文”的基础态，升级成“可显式接入外部上下文”的增强态，但仍保持 `spec-first` 当前边界：不引入 Slack、不新增 public command、不假设所有外部工具默认存在。这样后续 brainstorm 可以在不破坏 Claude/Codex 双宿主分发模型的前提下，稳定消费本地文档、飞书、GitHub、网页和文档链接上下文。

---

## 2026-04-14 `feat(compound-core-workflows)`

### 更新内容

完成 `compound-engineering-plugin` 核心工作流同步计划的批次 B-D，实现从“只完成批次 A”升级到“核心链路全闭环”。

### 主要变化

- `spec-plan` / `spec-brainstorm`
  - 强制 repo-relative 路径
  - 把 late-sequence 内容拆到 reference 文件
  - 收口 `document-review` 的 mandatory handoff 规则
- `spec-work` / `spec-work-beta`
  - 默认强制 code review
  - 增加 `Test Discovery` 与 testing-gap 收口
  - `spec-work-beta` 新增 Codex delegation 参数解析、配置解析与 reference 化 delegation workflow
  - Phase 3-4 shipping 流程从主文件抽成 reference，降低主 skill token 负担
- `testing-reviewer`
  - 增加“行为变化但零测试变更”审查项
- `spec-compound` / `spec-compound-refresh`
  - 补 discoverability check
  - `spec-compound` 改成按主栈路由 `kieran-* reviewer`，移除不存在 reviewer 的引用
  - `"What's next?"` 明确要求使用 blocking question tool
- 仓库治理
  - `AGENTS.md` / `CLAUDE.md` 新增 `docs/solutions/` 可发现性说明
  - 同步矩阵与审查报告可直接作为后续继续追上游的基线

### 版本意义

这次更新把 `spec-first` 与上游 `compound-engineering-plugin` 的核心 workflow 契约重新拉齐到同一层级：planning 更结构化，execution 更稳，knowledge compounding 更容易被后续 agent 发现和复用。对后续继续追上游更新而言，这意味着同步工作已经从“零散补丁”升级为“有基线、有 handoff、有审查记录”的可持续状态。

### 审查期补充修复

- 修正 `skills/spec-plan/references/plan-handoff.md` 中遗留的 `document-review mode:headless` 指令
- 明确自动化 / `disable-model-invocation` 场景下：
  - 若调用方能承接交互式 `document-review`，则继续以普通 `document-review` 路径运行
  - 若调用方不能承接交互，则返回 `Interactive document-review still required before execution handoff.`，不再伪称 review 已完成

这条修复把 planning handoff 与当前 `document-review` 的本地非 headless 路线重新收口，避免后续自动化调用引用不存在的模式。

---

## 2026-04-13 `docs(install-experience)`

### 更新内容

统一所有面向用户的安装文档，使 onboarding 口径一致。这是安装体验治理的文档层改动，不涉及代码变更。

### 主要变化

- 统一 canonical onboarding 顺序为：安装 CLI -> `spec-first doctor` -> `spec-first init --claude|--codex` -> 重启宿主 -> 使用 workflow
- 修正 `06-本地源码安装.md` 中 tree-sitter peer dependency 版本方向描述错误（旧文档错误地写成"主包 ~0.22.0 vs grammar 要 ^0.21.x"，实际方向是主包 0.21.0，grammar 要求 ^0.22.1 以上）
- 将 peer warning 叙事从"预期行为，可忽略"改为"已知兼容性噪音，本版本目标是消除"
- `04-常见问题.md` 明确区分"安装成功确认"与"宿主内 workflow 可见"是两个阶段
- 明确 `postinstall` 不是稳定欢迎页，`spec-first -v` 才是稳定入口
- README 中 warning 相关文案同步更新

### 版本意义

这次改动解决的是新用户在安装过程中遇到 peer dependency 警告时的困惑问题，以及不同文档之间 onboarding 顺序不一致导致的认知分叉。修正版本方向描述错误可以避免误导用户理解依赖关系。

---

## 2026-04-12 `feat(spec-graph-bootstrap)`

### 更新内容

`spec-graph-bootstrap` 的对外契约已经从“阶段 1 并行验证入口”收敛到“graph-informed Phase 0-4 入口”。这次更新不改变 `bootstrap` 仍是默认稳定入口，但明确 `graph-bootstrap` 已承担阶段2最小闭环职责：事实抽取、控制面产物生成、文档生成和路由生成。

### 主要变化

- `.claude-plugin/plugin.json` 中 `graph-bootstrap` 的描述更新为 Phase 0-4 fact extraction
- `install-local.sh` 与对应 smoke 断言改为输出阶段2最小闭环语义
- README 与用户手册不再把 `graph-bootstrap` 描述为“仅用于安装集成验证”
- 双入口并行期的对外说明统一为：`bootstrap` 默认稳定，`graph-bootstrap` 负责 graph-informed 阶段2闭环

### 版本意义

这次改动解决的是“实现已到阶段2，但包装层和说明层仍停留在阶段1”的认知错位问题。用户现在看到的命令描述、安装提示和文档说明，终于与 `skills/spec-graph-bootstrap/SKILL.md` 的真实执行合同一致。

---

## 2026-04-09 `feat(spec-graph-bootstrap)`

### 更新内容

新增 `spec-graph-bootstrap` 的阶段 1 安装集成能力。新入口现已进入打包、`init`、`clean`、smoke、install-local 和文档说明链路，但仍以“并行验证入口”身份上线，不替代现有稳定的 `spec-bootstrap`。

### 主要变化

- 新增 `skills/spec-graph-bootstrap/` 源资产与 `templates/claude/commands/spec/graph-bootstrap.md`
- `.claude-plugin/plugin.json` 新增 `graph-bootstrap` command 定义
- Claude / Codex runtime 现在都会安装 `graph-bootstrap` command 与 `spec-graph-bootstrap` skill
- smoke 与 install-local 验证现在覆盖双入口并行期资产
- README、用户手册、版本更新文档统一声明：`bootstrap` 仍是默认稳定入口，`graph-bootstrap` 仅作阶段 1 并行验证

### 版本意义

这次改动先把新 Stage-0 入口安全接入现有安装与治理框架，不提前承诺 graph-informed bootstrap 能力。它解决的是“可安装、可发现、可调用”，不是“已完成迁移”。

---

## 2026-04-08 `fix(mcp-setup)`

### 更新内容

`mcp-setup` 的宿主判定和 Serena 配置现在按宿主上下文精确校验，避免把 Claude/Codex 混淆后误判为已配置。

### 主要变化

- 宿主歧义时不再默认 Claude，必须显式指定 `MCP_SETUP_HOST`
- Serena 的 `mcp_config` 通过宿主上下文参数展开后再做检测和验证
- `detect-tools` / `verify-tools` 的 Bash 与 PowerShell 路径保持一致

### 版本意义

这次改动主要修复边界条件下的误判问题，提升多宿主、多平台场景下的安装可靠性。

---

## 2026-04-08 `docs(mcp-setup)`

### 更新内容

`mcp-setup` 技能命名现在统一为 `spec-mcp-setup`，Codex 侧直接调用格式改为 `$spec-mcp-setup`，与其他 `spec-*` 技能保持一致。

### 主要变化

- 技能 frontmatter `name` 改为 `spec-mcp-setup`
- Codex 直接调用文案改成 `$spec-mcp-setup`
- 相关测试断言同步更新，避免命名再回退到旧格式

### 版本意义

这次改动只做命名统一，不改变安装行为，但能减少认知分叉。

---

## 2026-04-08 `feat(codex)`

### 更新内容

Codex 侧的 `spec-first init` 现在也会生成 `/spec:*` 命令文件，和 Claude 侧保持一致的命令可见性与诊断体验。

### 主要变化

- `CodexAdapter` 从不生成命令，改为生成 `.codex/commands/spec/`
- `doctor` 现在会在 Codex 平台检查命令目录是否存在
- smoke 测试同步验证 Codex init、doctor、clean 的命令链路
- 用户文档更新为 Codex 也会出现 `/spec:*` 命令入口

### 版本意义

这次改动把 Codex 的工作流入口从“仅 skills”扩展为“commands + skills”，降低了跨平台认知差异。

---

## 2026-04-08 `docs(mcp-setup)`

### 更新内容

`mcp-setup` 的执行阶段增加了更友好的进度提示，用户在安装和验证时能更清楚地看到当前宿主、正在配置的工具、标记写入和完成状态。

### 主要变化

- 安装协调脚本会先提示当前宿主检查，再逐项说明正在写入的工具
- 验证脚本会先输出基础工具状态，再提示宿主就绪标记的写入位置
- 技能文档同步描述这些进度提示，避免用户误以为流程停住

### 版本意义

这次改动不改变功能路径，但显著降低了安装过程中的不确定感和等待焦虑。

---

## 2026-04-08 `feat(mcp-setup)`

### 更新内容

`mcp-setup` 现在除了 bash 入口，还提供了 Windows PowerShell 7+ 的 `.ps1` 入口，覆盖依赖检测、宿主识别、工具检测、安装协调和宿主验证。

### 主要变化

- 新增 `check-deps.ps1`、`detect-host.ps1`、`detect-tools.ps1`、`install-coordinator.ps1`、`verify-tools.ps1`
- `mcp-setup` 技能文档改成按平台选择脚本
- `check-deps` 的 Windows 兜底建议改为 `winget`
- 单元测试补充 Windows 脚本文件存在性断言

### 版本意义

这次改动把 `mcp-setup` 从 Unix-only 扩展到了 Windows PowerShell 入口，降低了 Windows 用户必须依赖 Git Bash/WSL 的门槛。

---

## 2026-04-08 `fix(mcp-setup+spec-bootstrap)`

### 更新内容

`mcp-setup` 和 `spec-bootstrap` 现在按当前宿主自适应处理 MCP 配置与就绪标记，Claude Code 和 Codex 会分别使用各自的配置文件与 `host-setup.json` 路径。

### 主要变化

- `mcp-setup` 自动识别宿主并写入对应的 MCP 配置文件
- `verify-tools.sh` 输出宿主字段与 v4 schema 的 `host-setup.json`
- `spec-bootstrap` 按宿主选择 marker 和 `mcp list` 探针
- unit tests 增加 Claude / Codex 双宿主覆盖

### 版本意义

这次改动把 MCP 工具安装与后续引导彻底从 Claude-only 变成了双宿主一致的流程，减少了在 Codex 会话中误读 Claude 配置的风险。

---

## 2026-04-08 `refactor(graphify)`

### 更新内容

删除 `graphify` skill、命令模板、测试和运行时引用，移除 `spec-first` 中对 graphify 的安装与分析入口。

### 主要变化

- 删除 `skills/graphify/`
- 删除 `templates/claude/commands/spec/graphify.md`
- 删除 `tests/unit/graphify-skill.sh`
- 从 `.claude-plugin/plugin.json`、`package.json`、`tests/smoke/cli.sh`、`CLAUDE.md` 中移除 graphify 入口

### 版本意义

`spec-first` 现在只保留当前仓库实际支持的技能与工作流。删除 graphify 后，不会再有用户通过旧命令进入已废弃的 graphify 路径。

---

## 2026-04-01 `feat(version-reminder)`

### 更新内容

在执行 `doctor`、`init`、`clean` 等真实命令前，CLI 会异步向 npm registry 查询 `spec-first` 的最新版本，若当前版本落后则通过 stderr 输出一行更新提醒。`--help` 和 `--version` 不触发检查，避免打扰只需信息查询的场景。

### 主要能力

- 版本比较实现零依赖：
  内置 `compareVersions` / `parseVersion`，完整支持 semver 核心版本号与预发布标识（`-beta.1` 等），无需引入 semver 包
- 查询有超时保护：
  默认 350 ms 超时，超时或网络失败时静默跳过，不阻塞命令执行
- 支持测试环境 override：
  通过 `SPEC_FIRST_VERSION_REMINDER_LATEST` 环境变量注入版本，测试无需真实网络请求
- 提醒输出到 stderr：
  不干扰命令的 stdout 输出，脚本管道场景不受影响

### 交付物

- `src/cli/version-reminder.js` — 版本查询、比较、格式化与提醒核心逻辑
- `src/cli/index.js` — 集成点，真实命令前 await 提醒检查
- `tests/unit/version-reminder.sh` — 覆盖版本比较、格式化、CLI 接线、静默超时等场景

### 版本意义

已安装 CLI 的用户在日常使用中会自然得到更新提示，无需手动查询版本差异。对于频繁迭代的工具型项目，这类低成本的自我更新通知能有效减少用户长期停留在旧版本的情况。

---

## 2026-04-01 `feat(lang-governance)`

### 更新内容

`spec-first init` 新增两项写入能力：将语言偏好与 Changelog 治理规则以受管理块的形式写入项目的 `CLAUDE.md`（Claude 平台）或 `AGENTS.md`（Codex 平台），并修复了 lang 优先级顺序。

### 主要能力

- 幂等写入语言治理块：
  通过 `<!-- spec-first:lang:start -->` / `<!-- spec-first:lang:end -->` 标记管理，支持多次 `init` 时安全覆盖，不影响用户自行添加的其他内容
- 写入 Changelog 铁律：
  在受管理块中注入"任何源码变更必须同步在 `CHANGELOG.md` 中记录，否则拒绝生成"的 prompt 层约束
- 修正 lang 优先级：
  `--lang` CLI 参数 > 当前项目 `.developer` 的 lang > 全局 `~/.spec-first/.developer` 的 lang > 默认 `zh`；重复 `init` 时项目已有语言设置不会被全局配置意外覆盖
- 自动引导 CHANGELOG：
  若项目根目录缺少 `CHANGELOG.md`，`init` 会创建格式头和初始 bootstrap 条目；已存在时不触碰

### 交付物

- `src/cli/lang-policy.js` — 受管理块写入与幂等更新逻辑
- `src/cli/developer.js` — lang 优先级修复 + 设计意图注释
- `src/cli/commands/init.js` — 集成 `writeLangPolicy` 与 `bootstrapChangelog`
- `tests/unit/lang-policy.sh` — 语言治理块写入、幂等性、多语言切换等场景
- `tests/unit/developer.sh` — lang fallback 4 个优先级场景

### 版本意义

语言治理落地后，项目的 AI 工具不再需要依赖用户记忆或手动配置来保持语言一致性。规则由 `spec-first init` 写入指令文件，每次会话自动生效。Changelog 铁律的引入则让代码变更历史的维护从"最佳实践"升格为"可执行的 AI 层约束"。

---

## 2026-04-01 `feat(mcp-setup)`

### 更新内容

新增 `skills/mcp-setup`，提供面向 `spec-first` 工作流的 MCP 工具一键安装与配置能力。该能力覆盖依赖检查、工具探测、配置合并、可选工具安装和最终验证，目标是把原本分散的环境准备工作收敛成一条标准化流程。

### 主要能力

- 支持安装和配置 6 个 MCP 相关工具：
  `Serena`、`GitNexus`、`ABCoder`、`Sequential Thinking`、`Context7`，以及可选的 `Playwright MCP`
- 提供依赖检测与分层处理：
  自动检查 `node`、`go`、`uv`、`jq`，区分可直接安装与需要风险提示的依赖
- 支持幂等安装与配置探测：
  已存在的工具会被自动跳过，避免重复写入
- 提供原子化配置合并：
  通过备份、加锁、`jq` 校验和原子替换，把 `~/.claude.json` 的配置变更风险降到最低
- 支持安装后验证：
  会重新探测工具状态，并输出完整安装结果

### 交付物

- `skills/mcp-setup/SKILL.md`
- `skills/mcp-setup/mcp-tools.json`
- `skills/mcp-setup/scripts/check-deps.sh`
- `skills/mcp-setup/scripts/detect-tools.sh`
- `skills/mcp-setup/scripts/install-coordinator.sh`

### 版本意义

这次迭代解决的不是单个 skill 的功能问题，而是 `spec-first` Full mode 的环境落地问题。它把 MCP 准备过程标准化之后，`spec-bootstrap` 等后续工作流就有了更低的使用门槛和更稳定的前置条件。

---

## 2026-03-31 `fix(spec-bootstrap)`

### 更新内容

在 `spec-bootstrap` 首版上线后，围绕 review 反馈进行了一轮可靠性加固，重点补齐“上下文生成流程是否足够安全、可恢复、可验证”这条链路。

### 主要改进

- 补强备份原子性：
  写入前使用时间戳目录备份，并通过文件数校验避免半覆盖状态
- 明确部分失败策略：
  `summary-context` 失败时整体验证回滚，其他 worker 失败时保留部分产物并显式报告
- 强化超时约束：
  为 worker 执行增加 20 分钟建议时限，避免子任务无限拖延
- 修正 MCP 校验方式：
  改为通过 `execute_query("SELECT 1")` 判断真实数据库连通性，而不是仅判断服务存在
- 优化无阻塞 slug 决策：
  多候选上下文目录时自动选取并在总结中说明，避免人工确认卡住流程

### 版本意义

这次修复说明 `spec-bootstrap` 已经从“能跑”推进到“可作为长期工作流底座来跑”。对于要把上下文文档持续沉淀到项目内的场景，这类可靠性补强比新增表面功能更关键。

---

## 2026-03-31 `feat(spec-bootstrap)`

### 更新内容

新增 `skills/spec-bootstrap`，把它定义为 `spec-first` 五阶段主流程之前的 Stage-0 支撑工作流。它负责分析目标项目，并在 `docs/contexts/<slug>/` 下生成可长期复用的项目上下文资产。

### 主要能力

- 引入 Stage-0 上下文引导模型：
  在 brainstorm / plan / work / review / compound 之前，先沉淀项目级稳定上下文
- 支持三档分析模式：
  `Full`、`Enhanced`、`Basic`，根据 `GitNexus`、`ABCoder`、`Serena` 等工具可用性自动降级
- 支持仓库结构与分层识别：
  自动识别前端、后端、移动端、桌面端、CLI、shared、data 等层
- 支持数据库配置检测：
  面向 MySQL 提供配置识别、连通性验证和数据库上下文生成入口
- 支持 PRD 任务合同与 worker 执行模型：
  先生成任务 PRD，再由子 agent 按文件所有权分工产出上下文文档
- 提供上下文模板资产：
  包含通用 PRD 模板和数据库 PRD 模板，便于后续稳定复用

### 交付物

- `skills/spec-bootstrap/SKILL.md`
- `skills/spec-bootstrap/references/prd-template.md`
- `skills/spec-bootstrap/references/database-prd-template.md`

### 版本意义

`spec-bootstrap` 的引入，补上了 `spec-first` 过去在“冷启动项目理解”上的空档。它不是新增一个普通 skill，而是在五阶段流程之前增加了一个可复用的项目上下文生产层，让后续每次需求分析都能站在更稳定的基础上开展。

---

## 总结

这几个迭代串起来，可以看出 `spec-first` 当前版本的演进方向很明确：

- 先用 `spec-bootstrap` 补齐项目上下文基础设施
- 再用 review 驱动的修复把这套基础设施做稳
- 用 `mcp-setup` 把所需工具链安装配置标准化
- 用 `lang-governance` 让语言和变更治理规则通过指令文件自动生效
- 用 `version-reminder` 让已安装用户在日常使用中自然得到版本更新提示

整体上，这一轮更新不是零散加功能，而是在继续把 `spec-first` 从”技能集合”推进成”可落地、可复用、可持续演进的工程工作流系统”。
