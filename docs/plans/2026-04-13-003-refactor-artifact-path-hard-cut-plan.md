---
title: refactor: hard-cut artifact path standardization
type: refactor
status: completed
date: 2026-04-13
origin: docs/plans/2026-04-13-002-artifact-path-standardization-design.md
---

# refactor: hard-cut artifact path standardization

## Overview

本计划把 `spec-first` 当前分散且命名不一致的产物目录一次性收敛到新的双层模型：

- 隐藏运行态统一进入 `.spec-first/`
- 长期可读上下文继续保留在 `docs/contexts/<slug>/`

这次是开发期硬切换重构，不做向下兼容，不保留 fallback，不引入过渡路径。实现完成后，`.context/` 与 `.spec-first-graph/` 不再是正式运行时目录，仓库中所有当前有效文档、测试和 prompt 契约都必须只使用新路径。

## Problem Frame

当前实现同时存在三套路径语义：

- `.spec-first-graph/`：CRG repo-global 图数据库与输入指纹
- `.context/spec-first/bootstrap/<slug>/`：bootstrap 控制面与中间事实
- `docs/contexts/<slug>/`：长期上下文文档

问题不在于功能缺失，而在于目录语义没有标准化：

- `.context/` 与 `docs/contexts/` 名称过近，容易误导为同一层
- `.spec-first-graph/` 没有纳入统一 `spec-first` 命名空间
- `fingerprints.json` 在 graph 与 bootstrap 两层同名异义
- 旧路径已经散落在 `src/crg`、skills prompt、模板、e2e/smoke 测试和正式文档里，后续每扩一次都在复制技术债

origin 文档已经做出关键决策：只保留方案 C，运行态统一收敛到 `.spec-first/`，并按开发期标准做一次性硬切换，不保留向下兼容（see origin: `docs/plans/2026-04-13-002-artifact-path-standardization-design.md`）。

## Requirements Trace

**Namespace & Structure**

- R1. 所有隐藏运行态产物统一收敛到 `.spec-first/`，不再使用 `.context/` 和 `.spec-first-graph/` 作为正式目录。
- R7. graph 仍是 repo-global runtime，不进入 `docs/contexts/<slug>/`。

**Implementation Approach**

- R3. 代码实现按硬切换处理，不读旧路径、不写旧路径、不保留 fallback。
- R5. 目录拼接逻辑必须集中，不能继续在多个 handler、测试和文档里散落硬编码旧路径。

**Semantic Clarity & Documentation**

- R2. `docs/contexts/<slug>/` 继续作为唯一长期可读文档出口，不承载 DB、缓存或中间控制面状态。
- R4. 图谱层与 bootstrap 控制面层的同名异义文件必须去歧义，至少消除 `fingerprints.json` 双重语义。
- R6. 所有当前有效的 skill、模板、测试、正式文档都必须同步改到新路径。
- R8. 规范类文档必须更新；历史/审计类文档若保留旧路径，只能以”历史说明”语义存在，不能再描述当前契约。

## Scope Boundaries

- 不重构 `fact-inventory.json`、`risk-signals.json`、`test-surface.json` 的内容 schema。
- 不重做 `docs/contexts/<slug>/` 的文档模板与章节结构。
- 不在本次重构中引入自动迁移器或旧目录清理器。
- 不把 `graph.db`、输入指纹或其他运行态缓存移入 `docs/contexts/<slug>/`。
- 不要求历史需求文档逐篇改写为新现实，但必须避免它们继续被当作当前规范入口。
- **非 bootstrap workflow skills 不纳入本次重构**：`spec-review`、`spec-plan`、`todo-create`、`todo-triage`、`todo-resolve`、`feature-video` 目前写入 `.context/spec-first/<workflow>/`，其控制面路径迁移作为后续独立任务处理，不在本次范围内。R1 中"所有隐藏运行态产物"指 bootstrap + graph-bootstrap workflow 的产物，不包括上述 6 个 skill 的控制面目录。

## Context & Research

### Relevant Code and Patterns

- `src/crg/cli/build.js` 当前负责创建 `.spec-first-graph/`、写入 `graph.db` 与 `fingerprints.json`，也是 graph 路径的主写入口。
- `src/crg/cli/open-db.js`、[`src/crg/cli/context.js`](/Users/kuang/xiaobu/spec-first/src/crg/cli/context.js)、[`src/crg/cli/query.js`](/Users/kuang/xiaobu/spec-first/src/crg/cli/query.js)、[`src/crg/cli/postprocess.js`](/Users/kuang/xiaobu/spec-first/src/crg/cli/postprocess.js) 都直接拼接 `.spec-first-graph/graph.db`，适合统一收口。
- `src/crg/input-convergence.js` 目前内置排除 `.spec-first-graph/**` 并解析 `.spec-first-graphignore`，说明路径重构必须同步覆盖输入收敛与测试夹具。
- `skills/spec-bootstrap/SKILL.md`、`skills/spec-graph-bootstrap/SKILL.md` 及其 reference 模板才是 runtime prompt 资产的 source of truth；`.claude/` / `.agents/` 里的副本不是手工编辑入口。
- `templates/claude/commands/spec/graph-bootstrap.md` 当前把 `.context/spec-first/bootstrap/<slug>/` 写死为命令契约的一部分，说明模板层也必须同步切换。
- `tests/unit/crg-build-cli.test.js`、`tests/unit/crg-cli-handlers.test.js`、`tests/unit/crg-input-convergence.test.js`、`tests/e2e/crg-all-commands.sh`、`tests/e2e/crg-sqlite-audit.sh` 已经覆盖 graph 路径与 CLI 读写，是这次硬切换的主验证骨架。

### Institutional Learnings

- `docs/solutions/logic-errors/spec-bootstrap-deep-review.md` 强调 supporting workflow 的 prompt 契约必须清晰、平台无关且边界明确；这直接支持把控制面路径、备份路径和 worker PRD 路径一次性收口到新目录模型。
- `docs/solutions/developer-experience/bash-portability-pitfalls-2026-04-01.md` 提醒 shell 测试在 macOS Bash 3.2 下要避免脆弱写法，因此本次验证策略应继续基于现有 shell 模式做最小侵入修改，而不是临时堆复杂 bash 特性。

### External References

- 无。该重构属于 repo 内部目录治理，当前代码、测试和文档模式已经足够支撑规划，不需要额外外部研究。

## Key Technical Decisions

- 决策 1：隐藏运行态根目录统一为 `.spec-first/`。
  理由：这是唯一能同时容纳 repo-global graph 与 workflow-scoped control-plane 的命名空间，且不会污染 `docs/`。

- 决策 2：graph 维持 repo-global，docs 维持 slug-scoped。
  理由：`graph.db` 服务 `crg build/stats/query/flows/communities` 等全仓能力，不属于单个 `<slug>`；把 DB 放进 `docs/contexts/<slug>/` 会把运行态和长期文档混仓。

- 决策 3：新增集中路径解析模块，所有 CRG 运行时代码只通过该模块拿路径。
  理由：当前 `.spec-first-graph` 路径散落在多个 handler 中；如果不先收口，后续任何目录调整都会再次全仓搜改。

- 决策 4：repo 级 graph ignore 文件一并重命名为 `.spec-firstignore`。
  理由：保留 `.spec-first-graphignore` 会留下旧命名模型残影；既然本次是硬切换，配置名也应和新命名空间对齐。

- 决策 5：bootstrap 控制面主清单文件统一命名为 `artifact-manifest.json`。
  理由：图谱输入指纹与 bootstrap 产物清单不再共用 `fingerprints.json`，消除歧义；`graph` 侧清单命名为 `input-fingerprints.json`。

- 决策 6：正式规范文档必须全部切换；历史文档允许保留旧路径，但必须显式保持“历史说明”身份。
  理由：当前有效文档不能继续给实现者错误信号，但历史分析稿保留原貌仍有追溯价值。

## Open Questions

### Resolved During Planning

- `graph.db` 是否进入 `docs/contexts/<slug>/`：否。graph 继续保留在 `.spec-first/graph/`。
- 是否保留旧路径兼容读取：否。当前仍处开发阶段，本次直接硬切换。
- 是否只改目录不改配置文件名：否。`.spec-first-graphignore` 同步收口为 `.spec-firstignore`。
- 备份目录是否继续使用 `backup_<ISO-timestamp>`：否。统一收口到 `.spec-first/workflows/bootstrap/<slug>/backups/<timestamp>/`。

### Deferred to Implementation

- `graph-meta.json` 与 `run-meta.json` 是否在同一批次落地为真实产物。
  原因：这两个文件是设计上合理的增强，但当前最小闭环只要求路径与主清单收口；实现时可根据改动量决定是否同期加入。

- 集中路径模块的最终文件名是否使用 `artifact-paths.js` 还是 `paths.js`。
  原因：这是实现命名细节，不影响架构方向；计划仅要求“集中 resolver 模块”这一事实。

## High-Level Technical Design

> *这部分用于表达方案形状，是 review 用的方向性说明，不是实现代码规范。实现阶段可调整 helper 命名，但不能改变层次边界。*

```text
repoRoot
  ├─ resolveGraphPaths(repoRoot)
  │    ├─ root: .spec-first/graph/
  │    ├─ db: .spec-first/graph/graph.db
  │    └─ inputFingerprints: .spec-first/graph/input-fingerprints.json
  │
  ├─ resolveWorkflowPaths(repoRoot, 'bootstrap', slug)
  │    ├─ root: .spec-first/workflows/bootstrap/<slug>/
  │    ├─ manifest: artifact-manifest.json
  │    ├─ tasks/: worker PRD files
  │    └─ backups/<timestamp>/
  │
  └─ resolveContextDocsDir(repoRoot, slug)
       └─ docs/contexts/<slug>/

Consumers:
  - CRG CLI handlers -> 只消费 graph resolver
  - bootstrap / graph-bootstrap skill contract -> 只消费 workflow/docs resolver 语义
  - tests & docs -> 断言同一套路径模型
```

## Implementation Units

- [x] **Unit 1: 建立统一路径模型与命名常量**

**Goal:** 为 graph runtime、workflow control-plane 和 docs context 建立单一命名模型，消除后续实现中的散落字符串拼接。

**Requirements:** R1, R4, R5, R7

**Dependencies:** None

**Files:**
- Create: `src/crg/artifact-paths.js`
- Modify: `src/crg/constants.js`
- Test: `tests/unit/crg-artifact-paths.test.js`

**Approach:**
- 在 `src/crg/` 下新增集中路径解析模块，至少覆盖 graph 根目录、graph DB、graph input fingerprints、workflow artifact 根目录、bootstrap artifact 清单路径、docs context 根目录。
- 共享命名常量放到集中模块或 `src/crg/constants.js`，避免 `artifact-manifest.json`、`input-fingerprints.json` 等字符串在多处重复。
- 该模块只做纯路径与文件名推导，不承载 I/O、副作用或参数校验逻辑，便于后续单元测试直接验证。
- **R4 实现**：明确定义去歧义文件名常量：graph 层指纹为 `input-fingerprints.json`，bootstrap 层产物清单为 `artifact-manifest.json`。这是本 Unit 直接满足 R4 的交付件。

**Execution note:** 先写新的路径解析测试，再替换各 CLI/skill 消费方，避免硬切换时失去稳定锚点。

**Patterns to follow:**
- `src/crg/constants.js` 的共享常量风格
- `src/crg/cli/router.js` 当前对 `--repo` 做集中归一化的做法

**Test scenarios:**
- Happy path: `resolveGraphPaths('/repo')` 返回 `.spec-first/graph/graph.db` 与 `.spec-first/graph/input-fingerprints.json`。
- Happy path: `resolveWorkflowArtifactDir('/repo', 'bootstrap', 'my-app')` 返回 `.spec-first/workflows/bootstrap/my-app/`。
- Edge case: slug 含中划线或嵌套 repo 路径时，docs 路径仍只拼出 `docs/contexts/<slug>/`，不把绝对路径碎片带入文件名。
- Error path: 传入空 workflow 名称或空 slug 的 helper 不应静默拼出畸形路径；应由调用层或 helper 明确拒绝。
- Integration: 共享常量变更后，graph 与 workflow 两层文件名不会再次出现同名异义的 `fingerprints.json`。

**Verification:**
- 新增测试能直接证明三层路径模型与命名决策。
- `src/crg` 不再需要手工拼接 `.spec-first-graph` 或 `.context/spec-first/bootstrap`。

- [x] **Unit 2: 硬切换 CRG graph runtime 到 `.spec-first/graph/`**

**Goal:** 让 `crg build/stats/context/query/postprocess/open-db` 及输入收敛逻辑只使用新的 graph 运行态目录与 ignore 配置。

**Requirements:** R1, R3, R4, R5

**Dependencies:** Unit 1

**Files:**
- Modify: `src/crg/cli/build.js`
- Modify: `src/crg/cli/open-db.js`
- Modify: `src/crg/cli/context.js`
- Modify: `src/crg/cli/query.js`
- Modify: `src/crg/cli/postprocess.js`
- Modify: `src/crg/input-convergence.js`
- Test: `tests/unit/crg-build-cli.test.js` *(Unit 2 改路径断言；Unit 5 加旧路径不存在的 negative guard)*
- Test: `tests/unit/crg-cli-handlers.test.js` *(同上)*
- Test: `tests/unit/crg-input-convergence.test.js` *(同上)*
- Test: `tests/e2e/crg-all-commands.sh` *(同上)*
- Test: `tests/e2e/crg-sqlite-audit.sh` *(同上)*

**Approach:**
- 所有 graph I/O 一律改从 Unit 1 的 resolver 取值，统一写入 `.spec-first/graph/graph.db` 和 `.spec-first/graph/input-fingerprints.json`。
- `build.js` 的目录创建、DB 初始化、fingerprint 输出、`runStats` 路径读取都要同步改到新目录。
- `open-db.js`、`context.js`、`query.js`、`postprocess.js` 只认新 DB 路径；旧 `.spec-first-graph/graph.db` 不再被视为有效 graph。
- `input-convergence.js` 需要把默认排除从 `.spec-first-graph/**` 扩展为 `.spec-first/**`，并把 repo 根 ignore 文件名改为 `.spec-firstignore`。
- shell/e2e 测试同步改为断言新路径和新文件名，不再创建或读取旧目录。

**Execution note:** 优先把会先红的单元与 e2e 断言改为新路径，再修改实现，以便明确看到硬切换完成度。

**Patterns to follow:**
- `tests/unit/crg-build-cli.test.js` 当前使用 `jest.isolateModules` + `fs` mock 的 CLI 测试模式
- `tests/e2e/crg-all-commands.sh` 与 `tests/e2e/crg-sqlite-audit.sh` 的 shell-first 黑盒验证模式

**Test scenarios:**
- Happy path: `crg build --repo=<path>` 首次构建时创建 `.spec-first/graph/graph.db` 与 `input-fingerprints.json`。
- Happy path: `crg stats/context/query/postprocess` 在新目录存在时正常工作，envelope 输出不变。
- Edge case: repo 根已有 `.spec-first/graph/` 但 DB 尚未构建时，命令按未构建状态报错，不生成旧路径。
- Edge case: `.spec-first/` 下同时存在 `graph/` 与 `workflows/` 时，输入收敛会排除二者，不把运行态自身重新纳入图。
- Error path: 仅存在旧 `.spec-first-graph/graph.db` 而不存在新路径时，`open-db` 与所有依赖它的命令应报“graph not built”，而不是悄悄读取旧目录。
- Error path: repo 根仅存在旧 `.spec-first-graphignore` 时，输入收敛不再读取它；只有 `.spec-firstignore` 生效。
- Integration: `build -> stats -> context -> query` 全链路在新目录模型下可连续运行，SQLite 审计脚本对账通过。

**Verification:**
- `src/crg` 运行时实现中不再引用 `.spec-first-graph`。
- e2e 测试使用新路径能完整通过，且旧路径不会被误认为有效 graph。

- [x] **Unit 3: 硬切换 bootstrap / graph-bootstrap 控制面契约**

**Goal:** 把 supporting workflow 的控制面从 `.context/spec-first/bootstrap/<slug>/` 收口到 `.spec-first/workflows/bootstrap/<slug>/`，并同步去歧义文件命名。

**Requirements:** R1, R2, R3, R4, R6

**Dependencies:** Unit 1

**Files:**
- Modify: `skills/spec-graph-bootstrap/SKILL.md`
- Modify: `skills/spec-bootstrap/SKILL.md`
- Modify: `skills/spec-bootstrap/references/prd-template.md`
- Modify: `skills/spec-bootstrap/references/database-prd-template.md`
- Modify: `templates/claude/commands/spec/graph-bootstrap.md`
- Modify: `templates/claude/commands/spec/bootstrap.md`
- Test: `tests/smoke/cli.sh`

**Approach:**
- 所有 control-plane 路径统一改成 `.spec-first/workflows/bootstrap/<slug>/...`。
- worker PRD 路径、backup 路径、Phase 0/Phase 3 产物路径、README/注入说明都必须同步切换。
- `fingerprints.json` 在 bootstrap 控制面中统一改名为 `artifact-manifest.json`；graph-side `fingerprints.json` 改为 `input-fingerprints.json`。
- `graph-bootstrap` 中所有关于 graph DB 的说明改为 `.spec-first/graph/graph.db`。
- 只改 source-of-truth：`skills/` 与 `templates/`；不把 `.claude/`、`.agents/` 运行时副本当作手工维护入口。

**Patterns to follow:**
- `skills/spec-bootstrap/SKILL.md` 当前对 backup/restore、worker ownership、README marker 的契约写法
- `templates/claude/commands/spec/graph-bootstrap.md` 当前“命令模板只指向 skill source of truth”的模式

**Test scenarios:**
- Happy path: 安装后的 `spec-graph-bootstrap` skill 文本包含 `.spec-first/workflows/bootstrap/<slug>/` 和 `.spec-first/graph/graph.db`。
- Happy path: 安装后的 `spec-bootstrap` / `spec-graph-bootstrap` reference 模板使用新的 PRD 路径与 backup 路径。
- Edge case: command template 继续只引用 skill source-of-truth，但产物路径说明已全部切换为新目录。
- Error path: 生成的 runtime assets 中不应残留 `.context/spec-first/bootstrap` 或 `.spec-first-graph` 字符串。
- Integration: `spec-first init --claude` / `--codex` 生成的命令入口与 skill 资产保持同一套路径契约，smoke 测试可直接 grep 验证。

**Verification:**
- 新安装出的 runtime skill/command 资产只描述新路径。
- bootstrap 与 graph-bootstrap 的控制面、备份与 PRD 合同不再出现旧目录模型。

- [x] **Unit 4: 收口正式文档与架构说明**

**Goal:** 更新当前有效的架构/手册/流程文档，使文档层与实现层使用同一套新路径模型。

**Requirements:** R2, R6, R8

**Dependencies:** Unit 2, Unit 3

**Files:**
- Modify: `docs/02-架构设计/02-目录结构.md`
- Modify: `docs/02-架构设计/03-agent-workflow-patterns.md`
- Modify: `docs/02-架构设计/04-crg-阶段0-构建流水线.md`
- Modify: `docs/05-用户手册/02-核心概念.md`
- Modify: `docs/05-用户手册/06-本地源码安装.md`
- Modify: `docs/spec-graph-bootstrap-flow.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/08-版本更新/README.md`

**Approach:**
- 只更新“当前规范入口”和“面向用户的有效说明”；把旧路径从这些文档中完全移除。
- 对 `docs/01-需求分析/` 等历史文档，不强制逐篇改写，但如果它们会被当前 README/手册直接引用，则需要补充历史语义或避免继续充当现行规范入口。
- `CHANGELOG.md` 与 `docs/08-版本更新/README.md` 必须同步记录这次 source-level 重构，因为仓库治理规则要求源码变更与版本说明联动。
- `docs/spec-graph-bootstrap-flow.md` 需要反映新的 path contract、artifact file names 与 backup layout，避免流程图继续传播旧路径。

**Patterns to follow:**
- `docs/02-架构设计/02-目录结构.md` 当前对“源码视角 / 运行态视角”的说明方式
- `docs/05-用户手册/02-核心概念.md` 当前对 Stage-0 supporting workflow 的定位写法

**Verification:**
- 正式文档中的当前契约不再引用 `.context/spec-first/bootstrap`、`.spec-first-graph` 或 `fingerprints.json`（bootstrap 控制面语义）。
- `CHANGELOG.md` 与版本更新文档能说明这是一次 breaking internal refactor。

- [x] **Unit 5: 加强验证与仓库级旧路径清扫**

**Goal:** 在测试层和仓库扫描层建立“旧路径不可回流”的硬约束，确保这次硬切换不会留下半收口状态。

**Requirements:** R3, R5, R6, R8

**Dependencies:** Unit 2, Unit 3, Unit 4

**Files:**
- Modify: `tests/unit/crg-build-cli.test.js`
- Modify: `tests/unit/crg-cli-handlers.test.js`
- Modify: `tests/unit/crg-input-convergence.test.js`
- Modify: `tests/e2e/crg-all-commands.sh`
- Modify: `tests/e2e/crg-sqlite-audit.sh`
- Modify: `tests/smoke/cli.sh`
- Test: `tests/unit/crg-artifact-paths.test.js`

**Approach:**
- 把”新路径存在”和”旧路径不存在/不再被读取”都转成显式断言，而不是只验证 happy path。
- `smoke` 继续负责安装产物文本验证；`unit` 负责 helper/handler 路径消费；`e2e` 负责 graph DB 与 CLI 的黑盒对账。
- 仓库级文本扫描不必新建复杂脚本，但实现完成时应有一组明确的 grep/sweep 规则，只允许旧路径出现在历史说明或专门的”旧到新映射”文档中。
- CLI 错误提示中引用路径的字符串（如 “graph not found at .spec-first-graph/”）必须同步更新为新路径，sweep 规则应覆盖运行时代码中的用户可见字符串，不仅限于测试断言。

**Execution note:** 这是硬切换的最终守门单元，必须在实现完成前作为收口标准跑通。

**Patterns to follow:**
- `tests/smoke/cli.sh` 当前对已安装 skill/command 文本做 grep 验证的方式
- `tests/e2e/crg-sqlite-audit.sh` 当前通过 SQLite 真值与 CLI 输出对账的方式

**Test scenarios:**
- Happy path: `tests/unit/crg-artifact-paths.test.js` 覆盖所有关键路径 helper，避免未来目录模型再次散落。
- Happy path: smoke 测试验证打包/安装后的 skill 资产只包含 `.spec-first/workflows/bootstrap/<slug>/`、`.spec-first/graph/graph.db`、`artifact-manifest.json`。
- Edge case: e2e 在新 graph 目录下二次构建时仍能得到稳定的增量结果，不因目录改名破坏 `changed_files=0` 语义。
- Error path: 当仓库仅保留旧 `.spec-first-graph/graph.db` 时，e2e/handler 断言应明确失败，防止旧目录被偷偷复用。
- Integration: 通过 repo-wide sweep 确认当前有效源码、测试、模板、正式文档不再依赖旧路径；若历史文档保留旧路径，应处于明确历史语境。

**Verification:**
- 新旧路径的“存在 / 不存在 / 不再消费”都变成自动化断言或明确收口规则。
- 这次重构后新增代码若重新写回旧路径，至少会在一个 unit、smoke 或 e2e 层面失败。

## System-Wide Impact

- **Interaction graph:** `crg build` 写 graph runtime；`stats/context/query/postprocess/open-db` 读 graph runtime；`spec-bootstrap` / `spec-graph-bootstrap` prompt 契约写 workflow control-plane；`init` 安装流程把 `skills/` 与 `templates/` 复制到 runtime。目录模型重构会同时影响这三条链。
- **Error propagation:** 硬切换后，只有旧 graph 目录的仓库会被视为“未构建图”；错误应统一表现为“graph not built / run build”，而不是模糊读取旧目录。
- **State lifecycle risks:** 旧 `.spec-first-graph/` 或 `.context/` 可能继续留在开发者本地工作树中；实现不负责自动清理，但文档与错误语义必须清楚表明它们已失效。
- **API surface parity:** CLI 错误提示、skill 文本、手册说明、流程图、e2e 断言必须共同描述 `.spec-first/graph/`、`.spec-first/workflows/bootstrap/<slug>/` 与 `docs/contexts/<slug>/`。
- **Integration coverage:** 至少要覆盖 `build -> stats -> query`、`init -> installed skill assets`、`bootstrap / graph-bootstrap prompt contract` 三个跨层集成面。
- **Unchanged invariants:** `docs/contexts/<slug>/` 仍然是唯一长期可读上下文出口；graph 仍然是 repo-global；DB 不进入 `docs/contexts/<slug>/`；source of truth 仍然是 repo 内 `skills/` 和 `templates/`，不是 runtime 副本。

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| 旧路径字符串散落在文档、测试、prompt 中，容易漏改 | 以 Unit 5 的 repo-wide sweep 为最终守门，并优先修改 source-of-truth 与自动化测试 |
| 硬切换后，本地仅有旧 graph 目录的仓库会直接报未构建 | 在文档、错误提示与版本说明中明确“需要重新 build”，且不提供兼容读取 |
| `.spec-first-graphignore` 改名后，现有测试夹具与用户心智会短暂失配 | Unit 2 把 `.spec-firstignore` 作为唯一新契约，同时在正式文档里统一说明 |
| runtime 副本与 source-of-truth 同时被手改，导致后续 `init` 覆盖行为混乱 | 实施时只改 `skills/` 与 `templates/`，runtime 副本仅通过安装/测试验证生成结果 |
| 历史文档若继续被 README 或手册引用，会传播旧路径 | Unit 4 只保留历史语义，不让旧路径文档继续充当当前规范入口 |

## Documentation / Operational Notes

- 这是 source-level refactor，实施前必须先在 `CHANGELOG.md` 记录变更，再动源码。
- 由于这是路径与契约重构，也应同步更新 `docs/08-版本更新/README.md`。
- 建议实现完成后，在仓库根目录与目标项目示例中更新 `.gitignore` 指引：从忽略 `.spec-first-graph/` 改为忽略 `.spec-first/` 或至少 `.spec-first/graph/` 与 `.spec-first/workflows/`。
- 历史需求/审计文档若继续保留旧路径，应通过标题、前言或所在目录上下文明确说明其为历史资料，而非现行规范。

## Alternative Approaches Considered

- 保留旧路径 fallback 一段时间：已拒绝。当前仍处开发阶段，双轨逻辑只会增加噪音并延长技术债寿命。
- 把 graph runtime 移入 `docs/contexts/<slug>/`：已拒绝。graph 是 repo-global、二进制、频繁变化的内部状态，不符合文档层职责。
- 只改 graph 目录，不改 control-plane 与 ignore 命名：已拒绝。这样会保留半套旧命名模型，无法真正完成标准化。

## Success Metrics

- 当前有效源码、模板、测试、正式文档中，不再把 `.context/` 或 `.spec-first-graph/` 描述为现行运行时目录。
- `crg build/stats/context/query/postprocess` 全链路在 `.spec-first/graph/` 下工作正常。
- bootstrap / graph-bootstrap runtime assets 只描述 `.spec-first/workflows/bootstrap/<slug>/` 与 `artifact-manifest.json`。
- repo-wide sweep 后，旧路径只出现在历史语义文档或专门的旧新映射说明中。

## Phased Delivery

> 三个 Phase 在同一分支内顺序完成，不存在独立可交付状态。Phase 3 在 Phase 1/2 的实现已合并后才能开始。

### Phase 1

- 完成 Unit 1 与 Unit 2，先让 graph runtime 与输入收敛硬切换成功。

### Phase 2

- 完成 Unit 3，把 supporting workflow 的控制面契约和安装产物源文件全部切换。

### Phase 3

- 完成 Unit 4 与 Unit 5，收口正式文档、版本记录和自动化验证。

## Sources & References

- **Origin document:** [docs/plans/2026-04-13-002-artifact-path-standardization-design.md](/Users/kuang/xiaobu/spec-first/docs/plans/2026-04-13-002-artifact-path-standardization-design.md)
- Related code: [build.js](/Users/kuang/xiaobu/spec-first/src/crg/cli/build.js)
- Related code: [open-db.js](/Users/kuang/xiaobu/spec-first/src/crg/cli/open-db.js)
- Related code: [context.js](/Users/kuang/xiaobu/spec-first/src/crg/cli/context.js)
- Related code: [query.js](/Users/kuang/xiaobu/spec-first/src/crg/cli/query.js)
- Related code: [postprocess.js](/Users/kuang/xiaobu/spec-first/src/crg/cli/postprocess.js)
- Related code: [input-convergence.js](/Users/kuang/xiaobu/spec-first/src/crg/input-convergence.js)
- Related prompt source: [spec-graph-bootstrap SKILL](/Users/kuang/xiaobu/spec-first/skills/spec-graph-bootstrap/SKILL.md)
- Related prompt source: [spec-bootstrap SKILL](/Users/kuang/xiaobu/spec-first/skills/spec-bootstrap/SKILL.md)
- Related test: [crg-build-cli.test.js](/Users/kuang/xiaobu/spec-first/tests/unit/crg-build-cli.test.js)
- Related test: [crg-all-commands.sh](/Users/kuang/xiaobu/spec-first/tests/e2e/crg-all-commands.sh)
- Institutional learning: [spec-bootstrap-deep-review.md](/Users/kuang/xiaobu/spec-first/docs/solutions/logic-errors/spec-bootstrap-deep-review.md)
- Institutional learning: [bash-portability-pitfalls-2026-04-01.md](/Users/kuang/xiaobu/spec-first/docs/solutions/developer-experience/bash-portability-pitfalls-2026-04-01.md)
