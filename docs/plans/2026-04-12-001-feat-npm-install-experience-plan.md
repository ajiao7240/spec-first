---
title: "feat: Improve npm install experience and onboarding"
type: feat
status: active
date: 2026-04-12
---

# feat: Improve npm install experience and onboarding

## Overview

优化 `npm install -g spec-first-1.5.1.tgz` 的首屏安装体验，目标不是“润色欢迎文案”，而是系统性解决两类问题：一是 `tree-sitter` 依赖树失配导致的大量 peer warning 噪音；二是 `postinstall`、`spec-first -v`、`spec-first doctor` 三个入口分工混乱，导致用户在安装成功后看不到一条清晰、稳定、可执行的下一步路径。

本计划把安装体验拆成三个层次治理：先收敛依赖图以减少 warning，再压缩 `postinstall` 为最短提示，最后把稳定 onboarding 入口收敛到 `spec-first -v` 与 `spec-first doctor`，并同步 README / FAQ / 本地安装文档与 smoke 回归，避免未来再发生文案漂移。

## Problem Frame

当前用户执行 `npm install -g spec-first-1.5.1.tgz` 时，安装日志前段会被多组 `npm warn ERESOLVE overriding peer dependency` 覆盖，核心原因是 `package.json` 中直依赖 `tree-sitter@~0.21.0`，但多个 grammar 包实际声明 `peerOptional tree-sitter@^0.22.1`。用户看到的第一屏不是“安装完成，下一步做什么”，而是“安装过程中出现大量看起来像失败的警告”。

与此同时，安装成功后的三类提示缺少产品分层：

- `bin/postinstall.js` 在安装阶段包含 warning 兜底文案（"属于预期行为"）+ 4 条 workflow 入口列表，与 Unit 1 完成后的目标状态（无需 warning 兜底 + 只指向 doctor/-v）不一致。
- `src/cli/index.js` 的 `printVersion()` 完全没有提到 `doctor`，直接跳到 `init` → `/spec:ideate`/`/spec:brainstorm`，与 `doctor` 的 canonical onboarding 路径（doctor → init → 重启 → workflow）方向冲突。
- `src/cli/commands/doctor.js` 已具备很好的“安装后第一动作”能力，但当前没有被提升为最稳定、最权威的后续入口。

结果是：用户经历了大量 warning，却没有得到单一且稳定的成功路径；文档也把噪音当作“预期行为”长期接受，降低了整体产品质量门槛。

## Requirements Trace

- R1. 全局安装日志中的 `tree-sitter` peer warning 数量从当前 ~14 条降至 ≤ 1（仅允许 tree-sitter-objc 的已知 peer 不匹配，无法在不损失 ObjC 解析能力的前提下消除）
- R2. `postinstall` 只承担“安装完成 + 最短下一步”职责，不再暴露完整 workflow 菜单
- R3. `spec-first -v` 成为稳定欢迎页，输出与 `doctor/init` 路径一致的 canonical onboarding
- R4. `spec-first doctor` 成为安装成功后的首选验证入口，并在未初始化项目时给出简洁、正确的下一步
- R5. README、FAQ、本地源码安装文档与 CLI 输出的 onboarding 顺序保持一致，不再出现“警告可忽略”式长期兜底表述
- R6. 为 tarball 安装链路增加可重复的回归验证，覆盖 warning 噪音、`postinstall` 输出、`-v` 欢迎页和 `doctor` 引导

## Scope Boundaries

- 不在本计划中新增新的 CLI 子命令
- 不改变 `spec-first init --claude|--codex` 的核心行为，只调整其在安装链路中的提示位置
- 不把“让 npm 生命周期输出始终可见”作为目标；这不受本仓库完全控制
- 不在本计划中处理所有可能的 npm warning 类型，只聚焦当前真实安装日志中的 `tree-sitter` peer dependency 噪音
- 不把 CRG 功能本身的正确性作为本计划目标；本计划只处理安装体验与入口引导
- 不将 `postinstall` 改为静默模式（如重定向 stderr 或设置 `--silent`）；保持输出可见，只压缩内容

### Smoke 测试职责分工

| 脚本 | 职责边界 | 运行方式 |
|------|---------|---------|
| `tests/smoke/install-local.sh` | 仓库辅助脚本 `install-local.sh` 的文案检查 | `bash ./install-local.sh` 输出断言 |
| `tests/smoke/cli.sh` | 源码级 CLI 行为（`node bin/spec-first.js` 的 help/version/init/doctor/clean） | 从源码直接运行，不依赖全局安装 |
| `tests/smoke/install-tarball.sh` | **packaged install 全链路**：npm pack → npm install -g → postinstall 输出 → 全局 shim → 安装日志 warning 计数 | 临时 prefix 隔离，绝对路径调用 |

三者不重叠：postinstall 输出的 packaged install 回归只在 `install-tarball.sh` 中验证；`cli.sh` 和 `install-local.sh` 不承担 packaged install 职责。

## Context & Research

### Relevant Code and Patterns

- `package.json`：当前声明 `tree-sitter@~0.21.0`，而多个 grammar 包版本已要求 `^0.22.1`
- **tree-sitter peer 兼容矩阵**（截至 2026-04-12）：
  - 兼容组 A（peer `^0.21.x`，与当前 tree-sitter 兼容）：c-sharp@0.23.1、cpp@0.23.4、go@0.23.4、java@0.23.5、javascript@0.23.1、kotlin@0.3.8、php@0.23.0、ruby@0.23.1、scala@0.24.0、typescript@0.23.2 — 共 10 包
  - 兼容组 B（peer `^0.22.1`，与当前 tree-sitter 不兼容，触发 warning）：c@0.23.6、objc@3.0.2、python@0.23.6、rust@0.23.3、swift@0.7.1 — 共 5 包
  - **关键事实**：不存在单一 tree-sitter 版本能同时满足所有 15 个 grammar 包。升级到 0.22.x 会转移 warning 到兼容组 A 的 10 包，降级兼容组 B 的 grammar 包可消除 warning 但有解析能力退化风险
- `package-lock.json`：锁文件中已经能看到 `tree-sitter` peer 范围混杂，说明 warning 不是偶发，而是可复现的依赖图问题
- `bin/postinstall.js`：在安装阶段包含 warning 兜底文案（”属于预期行为”）+ 4 条 workflow 入口列表，与 Unit 1 完成后的目标状态（无需 warning 兜底 + 只指向 doctor/-v）不一致
- `src/cli/index.js`：`printVersion()` 完全没有提到 `doctor`，直接跳到 `init` → `/spec:ideate`/`/spec:brainstorm`，与 canonical onboarding 路径（doctor → init → 重启 → workflow）方向冲突
- `src/cli/commands/doctor.js`：在未初始化项目时已能输出简洁的 `init --claude` / `init --codex` 指引，适合成为 canonical next step
- `tests/smoke/cli.sh`：已有 `--version` 与 `doctor` 输出断言，是扩展安装引导回归的最佳切入点
- `tests/smoke/install-local.sh`：已有本地安装文案 smoke 测试，可扩展为安装模型一致性校验

### Institutional Learnings

- `docs/05-用户手册/04-常见问题.md` 已经明确指出 npm lifecycle 输出不保证稳定可见，因此 `postinstall` 不应承担唯一欢迎入口
- `docs/05-用户手册/06-本地源码安装.md` 目前仍把 peer warning 描述为“预期行为，可忽略”，说明文档口径已经漂移到接受噪音，而不是消除噪音
- `docs/brainstorms/2026-03-30-code-audit-report.md` 曾指出安装引导文案存在错误和漂移历史，说明需要一个统一的 canonical onboarding 来源，而不是多处各写一套

### External References

- npm package.json documentation: `peerDependencies` / `peerDependenciesMeta` / `overrides`
  `https://docs.npmjs.com/cli/v11/configuring-npm/package-json`
- npm scripts documentation: lifecycle scripts including `postinstall`
  `https://docs.npmjs.com/cli/v11/using-npm/scripts`
- npm config documentation: `foreground-scripts` controls whether lifecycle script stdio is shared,说明安装脚本输出可见性不是稳定产品契约
  `https://docs.npmjs.com/cli/v11/using-npm/config#foreground-scripts`

## Key Technical Decisions

- **KD1: 先治理依赖图，再治理文案。** 当前最刺眼的问题是 `tree-sitter` peer mismatch 触发的安装噪音；如果不先解决，任何欢迎文案优化都会被 warning 冲掉。
- **KD2: `postinstall` 只保留最短 next step。** 安装阶段输出不可作为稳定承诺，因此这里只做“安装成功 + 运行 `spec-first doctor` + 如需详情执行 `spec-first -v`”。
- **KD3: `spec-first -v` 作为稳定欢迎页，`doctor` 作为稳定第一动作。** `-v` 负责解释“这个 CLI 是什么 + 你现在该干什么”；`doctor` 负责在当前项目里给出精确状态与下一步。
- **KD4: 统一 onboarding 的 canonical 顺序。** 推荐顺序收敛为：安装 CLI → `spec-first doctor` → `spec-first init --claude|--codex` → 重启宿主 → 使用 `/spec:*` 或 `$spec-*`。
- **KD5: 以直接依赖版本收敛为主要手段，`overrides` 为辅助兜底。** npm 的 `overrides` 在全局安装场景下不保证生效（`overrides` 需要 npm v8.3+，而 `engines.node >= 20` 默认 bundled npm 9+，版本满足），因此核心策略必须是 grammar 包版本降级（消除 peer 不匹配的根源）。`overrides` 作为额外保障层，在支持的安装路径下提供兜底。
- **KD6: 回归验证以真实 tarball 安装为准。** 只测 `postinstall.js` 文本拼接不够，必须覆盖 `npm pack` / `npm install -g <tarball>` 场景，才能证明安装体验真的变好了。
- **KD7: 把“警告可忽略”降级为过渡性兼容说明，而不是主叙事。** 若个别 warning 无法在第一轮完全消除，文档可以保留故障说明，但不能再把它作为默认安装体验的合理化解释。

## Open Questions

### Resolved During Planning

- **Q: 这次优化的主问题是不是 `postinstall` 文案不够友好？** 不是。真正的首屏失败体验首先来自依赖 warning 噪音，文案只是第二层问题。
- **Q: `doctor` 是否适合作为安装后第一动作？** 适合。当前实现已经能在未初始化项目中给出简洁、正确的下一步。
- **Q: 是否应继续在 `postinstall` 中直接展示 `/spec:bootstrap`、`/spec:plan` 等 workflow 列表？** 不应。那是初始化和重启宿主之后的事情，安装阶段提前暴露会增加信息噪音。
- **Q: 是否可以通过包内 `overrides` 快速遮掉 warning？** 不应作为消除 warning 的主手段，但作为辅助兜底层仍有价值。npm 的 `overrides` 在全局安装场景下不保证生效，核心策略必须是 grammar 包版本降级。
- **Q: `tree-sitter` 最终统一到哪个主版本最稳妥？** 保持 `tree-sitter@~0.21.0` 不变，降级 4 个要求 `^0.22.1` 的 grammar 包（c/python/rust/swift）到兼容 0.21.x 的版本，保留 `tree-sitter-objc@^3.0.2` 不降级（iOS 解析链最近修复）。原因：不存在单一 tree-sitter 版本能同时满足所有 15 个 grammar 包，升级到 0.22.x 会转移 warning 到 10 个包，降级 grammar 包的代价更小且方向更可控。

### Deferred to Implementation

- **是否需要引入共享 onboarding helper**：例如新增 `src/cli/install-message.js` 统一 `postinstall` 与 `-v` 的一部分文案来源；这是实现细节，不必在计划中先定死
- **是否保留少量进阶入口文案**：如 `spec-first --help`、README 链接、Stage-0 特定入口，需在实际输出长度和认知负担之间取平衡

## High-Level Technical Design

> *这部分用于说明预期的职责分层，是方向性指引，不是实现规格。实现代理应把它视为设计上下文，而不是逐字照写的代码。*

```mermaid
flowchart TD
    A[npm install -g spec-first.tgz] --> B{依赖树是否干净}
    B -->|否| C[调整 tree-sitter / grammar 版本策略]
    B -->|≤1 条已知 objc warning| D[进入 postinstall]

    D --> E[短提示: 安装完成]
    E --> F[主入口: spec-first doctor]
    E --> G[稳定详情: spec-first -v]

    F --> H{当前项目是否已初始化}
    H -->|否| I[提示 init --claude / --codex]
    H -->|是| J[校验命令/skills/agents 状态]

    G --> K[解释产品定位]
    K --> L[重复 canonical onboarding 顺序]

    M[README / FAQ / 本地安装指南] --> N[与 doctor/-v 共享同一顺序]
    J --> N
    L --> N
```

## Implementation Units

- [ ] **Unit 1: 收敛 `tree-sitter` 依赖兼容策略**

**Goal:** 从根源减少 `npm install -g spec-first-1.5.1.tgz` 期间的 peer dependency warning，使安装日志恢复可读。

**Requirements:** R1, R6

**Dependencies:** 无

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Test: `tests/unit/crg-parser.test.js`（补足 C/Python/Rust/ObjC AST parse 断言）
- Test: `tests/fixtures/parser/c/`（新增 C 语言 fixture）
- Test: `tests/fixtures/parser/py/`（扩展 Python fixture）
- Test: `tests/fixtures/parser/rs/`（新增 Rust fixture）
- Test: `tests/fixtures/parser/objc/`（新增 ObjC fixture：含 @interface/@implementation/@protocol 的 .m 文件）
- Test: `tests/unit/crg-build-cli.test.js`
- Test: `tests/unit/crg-router.test.js`
- Test: `tests/integration/e2e.sh`

**Approach:**
- **前置步骤：补足 C/Python/Rust/ObjC 的 AST parse 断言**。当前 `tests/unit/crg-parser.test.js` 对这四种语言只有 `inferLanguage` 断言，无法检测 grammar 降级后的 AST 提取退化。降级前必须先补足 parse-level 测试（参照现有 Swift/Kotlin 测试结构：创建 fixture 文件，断言 `skipped=false` + `class`/`function` 节点存在 + `rawEdges` 结构正确），使降级决策有回归网支撑。**ObjC 尤其重要**：它是方案唯一保留的例外（1 条 residual warning 的来源），必须补足 `@interface`/`@implementation`/`@protocol` 节点提取断言，为"保留不降级"决策提供可执行证据
- 补足测试后，再执行"降级 4 包 + 保留 objc + overrides 兜底"策略，将 warning 从 ~14 条降到仅 1 条（objc）
- 具体版本调整：

  | 包 | 当前版本 | 调整为 | 原因 |
  |----|---------|-------|------|
  | tree-sitter-c | `~0.23.0` | `~0.21.4` | peer `^0.21.0`，兼容 tree-sitter 0.21.x |
  | tree-sitter-python | `~0.23.0` | `~0.21.0` | peer `^0.21.0`，兼容 tree-sitter 0.21.x |
  | tree-sitter-rust | `~0.23.0` | `~0.21.0` | peer `^0.21.1`，兼容 tree-sitter 0.21.x |
  | tree-sitter-swift | `~0.7.0` | `~0.6.0` | peer `^0.21.1`，兼容 tree-sitter 0.21.x |
  | tree-sitter-objc | `^3.0.2` | **保留不变** | iOS 解析链最近修复（ea453c70），降级到 2.1.0 有 ObjC @interface/@implementation/@protocol 提取能力退化风险 |

- 在 `package.json` 中增加 `overrides` 字段锁定 `tree-sitter` 版本，作为依赖解析的兜底保障：
  ```json
  “overrides”: {
    “tree-sitter”: “0.21.1”
  }
  ```
- 注意：`overrides` 在 `npm install -g` 场景下不能保证 100% 生效（npm 对全局包的 overrides 支持依赖版本和配置），但它是一层额外保障，且对 `npm pack` → 本地安装链路有帮助
- 完成版本收敛后，验证 CRG 相关 parser/build/router 测试以及 tarball 安装行为，防止”日志变干净但解析功能退化”

**Execution note:** 执行顺序严格为：(1) 先用当前 grammar 版本补足 C/Python/Rust/**ObjC** 的 AST parse fixture 和断言，确认全部通过（ObjC 断言必须覆盖 `@interface`/`@implementation`/`@protocol` 节点提取）；(2) 保留当前安装 warning 的复现命令与样本；(3) 变更版本组合，跑完整 CRG 单测套件确认无回归；(4) `npm pack` + 真实安装验证 warning 数量。修改 `package.json` 依赖后必须执行 `npm install` 重新生成 `package-lock.json`，不要手动编辑 lock file。

**Patterns to follow:**
- `package.json` 中现有 direct dependency 声明方式
- `tests/unit/crg-*.test.js` 现有对 CRG 路由、构图、解析的覆盖结构

**Test scenarios:**
- **Prerequisite**: 降级前，C/Python/Rust/**ObjC** 的 AST parse 断言在当前 grammar 版本下全部通过（ObjC 必须覆盖 `@interface`/`@implementation`/`@protocol`，验证新增 fixture 和断言本身正确）
- Happy path: 使用新依赖组合重新打包后，全局安装 warning 数量 ≤ 1（仅 tree-sitter-objc 的 `^0.22.1` 不匹配）
- Happy path: `spec-first crg` 相关既有单测全部通过，证明解析栈没有因依赖收敛而退化
- Edge case: 降级后的 tree-sitter-c/python/rust/swift 仍能正确提取 symbol_key 和 raw_edges
- Error path: 若某一版本组合导致 parser 初始化失败，应在 CRG 单测中直接暴露，而不是留到用户安装后发现
- Integration: `npm pack` 生成 tarball 后，使用该 tarball 真实安装并执行 `spec-first -v`、`spec-first doctor` 均成功

**Verification:**
- 新 tarball 在默认全局安装路径下，安装日志 warning 数量 ≤ 1（仅 objc）
- CRG 既有单测与集成测试通过，说明依赖收敛没有破坏运行时能力

---

- [ ] **Unit 2: 压缩 `postinstall` 为最短安装提示**

**Goal:** 让安装阶段输出只承担“成功确认 + 下一步动作”，避免信息过载和未来漂移。

**Requirements:** R2, R4

**Dependencies:** Unit 1

**Files:**
- Modify: `bin/postinstall.js`
- Test: `tests/smoke/install-tarball.sh`（Unit 5a 创建的 packaged install harness，独立验证 postinstall 输出）

**Approach:**
- 删除安装阶段对 workflow 菜单的直接暴露，只保留安装成功、`spec-first doctor`、`spec-first -v`
- 如必须提及 warning，只保留一句短解释，且在 Unit 1 完成后应趋近于无需解释
- 避免在安装阶段承诺“重启后一定能看到哪些入口”，因为那取决于后续是否初始化以及宿主是否重启
- 输出长度控制在一屏内，使用户在终端中能完整看到真正有效的下一步

**Patterns to follow:**
- `bin/postinstall.js` 当前 box 样式可保留，但内容要显著收缩

**Test scenarios:**
- Happy path: `postinstall` 输出包含安装完成与 `spec-first doctor`
- Happy path: `postinstall` 输出包含 `spec-first -v` 作为详情入口
- Edge case: `postinstall` 不再列出 `/spec:bootstrap`、`/spec:graph-bootstrap`、`/spec:plan` 等后续 workflow 入口
- Edge case: 输出总行数受控，不再形成长篇说明块

**Verification:**
- 安装后的第一屏信息可以在不滚屏的情况下读完，并指向单一主动作 `spec-first doctor`
- smoke 测试能稳定断言 `postinstall` 没有重新膨胀

---

- [ ] **Unit 3: 重写 `spec-first -v` 的稳定欢迎页**

**Goal:** 把 `spec-first -v` 变成权威、稳定、可重复查看的安装后欢迎入口。

**Requirements:** R3, R4, R5

**Dependencies:** Unit 2

**Files:**
- Modify: `src/cli/index.js`
- Test: `tests/smoke/cli.sh`

**Approach:**
- `printVersion()` 改为解释产品定位与 canonical onboarding 顺序，而不是直接罗列 ideation/workflow 菜单
- 将顺序明确收敛为：`doctor` → `init --claude|--codex` → 重启宿主 → 使用 workflow
- 使 `-v` 的输出与 `doctor` 的行为互补，而不是重复 `init` 或越级展示 workflow 列表
- 预留最少量的 discoverability 信息，如 `spec-first --help` 或文档链接，但不喧宾夺主

**Patterns to follow:**
- `src/cli/index.js` 中现有 `printHelp()` 与 `printVersion()` 分层方式
- `tests/smoke/cli.sh` 当前对 version 输出和 fresh-project `doctor` 输出的协同断言

**Test scenarios:**
- Happy path: `spec-first -v` 输出版本号、产品定位和 `spec-first doctor`
- Happy path: `spec-first -v` 输出 `init --claude` / `init --codex` 的后续动作
- Edge case: `spec-first -v` 不再把 `/spec:ideate`、`/spec:brainstorm` 当作安装后的第一建议
- Edge case: `-v` 与 `doctor` 的指引顺序一致，不存在互相打架的下一步
- **Regression guard**: `spec-first -v` 的输出必须包含 `doctor` 字符串（`spec-first -v | grep -q “doctor”`），且不能把 `/spec:ideate` 或 `/spec:brainstorm` 作为安装后第一建议；此断言写入 smoke 测试防止未来回退
- Integration: fresh project 中先看 `-v` 再执行 `doctor`，两者共同形成一条连续路径

**Verification:**
- `spec-first -v` 在任何时刻都能稳定输出正确欢迎页，不依赖 npm lifecycle 是否展示
- smoke 断言能防止未来版本重新回到”版本页即 workflow 菜单”的旧模式

---

- [ ] **Unit 4: 统一 README / FAQ / 本地安装文档的 onboarding 口径**

**Goal:** 让仓库内面对用户的安装说明与 CLI 输出保持一致，不再把 warning 当作标准体验解释。

**Requirements:** R5

**Dependencies:** Unit 3

**Files:**
- Modify: `README.md`
- Modify: `docs/05-用户手册/01-快速开始.md`
- Modify: `docs/05-用户手册/04-常见问题.md`
- Modify: `docs/05-用户手册/06-本地源码安装.md`
- Modify: `docs/08-版本更新/README.md`

**Approach:**
- 统一所有入口文档中的推荐顺序：安装 → `doctor` → `init` → 重启 → workflow
- 重写”peer dependency 警告”相关段落：从”预期行为，可忽略”改为”这是已知兼容性噪音，本版本目标是消除；若仍出现则作为故障排查说明”
- **修正现有文档中的版本方向描述错误**：`06-本地源码安装.md` 第 53 行和 `04-常见问题.md` 第 314-325 行错误地将版本关系描述为”tree-sitter@~0.22.0 主包 vs grammar 要 ^0.21.x”，实际方向相反（tree-sitter@0.21.0 主包，grammar 要 ^0.22.1）。Unit 4 必须同时修正这一事实错误
- 在 FAQ 中明确区分”安装成功确认”与”宿主内 workflow 可见”是两个阶段，避免把 `/spec:*` 可见性归咎于安装本身
- 更新版本更新文档，记录安装体验治理属于用户可见改进
- 注意：README 已在 Quick Start 中包含 `spec-first doctor`（第 82-84 行），Unit 4 的 README 改动范围主要是修正 warning 相关文案，不需要从零写 doctor 引导

**Patterns to follow:**
- README 当前安装与 doctor 章节的双语结构
- FAQ 当前对 lifecycle 输出不稳定的说明方式，但要收敛为更明确的产品分层

**Test scenarios:**
- Happy path: README 和本地安装文档都把 `spec-first doctor` 作为安装后的第一个命令
- Happy path: FAQ 正确解释 `postinstall` 不是稳定欢迎页，`spec-first -v` 才是稳定入口
- Edge case: 文档中不再把”大量 peer warning 是预期行为”作为主叙事
- **Fact check**: `06-本地源码安装.md` 和 `04-常见问题.md` 中 tree-sitter 版本方向描述已修正为”tree-sitter@0.21.0 主包，grammar 要 ^0.22.1”，不再写反
- Integration: 新用户按 README 或本地安装指南操作时，步骤顺序与 CLI 提示完全一致

**Verification:**
- 仓库内所有面向用户的安装文档都遵循同一 onboarding 顺序
- 没有一处文档仍把 warning 噪音描述为标准、合理、可长期接受的默认体验

---

- [ ] **Unit 5a: tarball 依赖 warning 回归**（依赖 Unit 1）

**Goal:** 验证 Unit 1 的依赖收敛策略在真实 tarball 安装中生效。

**Requirements:** R1, R6

**Dependencies:** Unit 1

**Files:**
- Create: `tests/smoke/install-tarball.sh`（新增专用 harness，不挤进现有 install-local.sh）
- Modify: `package.json`（将 `tests/smoke/install-tarball.sh` 追加到 `test:smoke` 脚本）

**Approach:**
- 新建独立 smoke 脚本 `tests/smoke/install-tarball.sh`，实现完整的隔离安装验证：
  1. 创建临时目录作为 `npm_config_prefix`（避免污染全局环境）
  2. 设置临时 `npm_config_cache`（避免缓存污染）
  3. 在仓库根目录执行 `npm pack` 生成 tarball
  4. 执行 `npm install -g ./spec-first-<version>.tgz`，捕获完整 stdout+stderr
  5. 从临时 prefix 调用 `spec-first -v` 和 `spec-first doctor`，验证全局安装后二进制可用
     - **必须通过绝对路径调用**：`"$TMP_PREFIX/bin/spec-first" -v`，或设置 `PATH="$TMP_PREFIX/bin:$PATH"` 后执行 `hash -r` 清除 shell 缓存
     - **禁止使用裸 `spec-first`**：避免命中系统已有的全局安装导致假阳性（本仓库 `install-local.sh:19` 已警告过旧 shim / shell cache 问题）
  6. 断言安装日志中 `tree-sitter` 相关 peer warning 数量 ≤ 1
  7. 清理临时 prefix 和 cache（`trap ... EXIT`）
- 现有 `tests/smoke/install-local.sh` 和 `tests/smoke/cli.sh` 继续承担源码级验证（从源码运行 `node bin/spec-first.js`），不承担 tarball 安装验证
- 在 `package.json` 的 `test:smoke` 脚本中追加 `bash tests/smoke/install-tarball.sh`

**Test scenarios:**
- Happy path: tarball 安装日志中 `tree-sitter` 相关 peer warning 数量 ≤ 1
- Happy path: 安装后从临时 prefix 执行 `spec-first -v` 成功输出版本号
- Happy path: 安装后从临时 prefix 执行 `spec-first doctor` 在空目录输出 init 指引
- Edge case: 唯一允许的 warning 来自 `tree-sitter-objc` 的 `^0.22.1` 不匹配
- Error path: 若降级的 grammar 包版本在安装时出现新 warning，说明该版本策略有误
- Cleanup: 临时 prefix 和 cache 在脚本退出时被完全清理，不污染本机全局环境

**Verification:**
- Unit 1 完成后立即可验证，不需要等文案和文档改动
- 脚本可在本地和 CI 中重复运行，结果一致

---

- [ ] **Unit 5b: 完整安装体验回归与提示契约测试**（依赖 Unit 1-4）

**Goal:** 用真实安装链路守住全链路体验——依赖噪音 + 引导文案 + CLI 输出一致性。

**Requirements:** R2, R3, R4, R6

**Dependencies:** Unit 1, Unit 2, Unit 3, Unit 4

**Files:**
- Modify: `tests/smoke/cli.sh`
- Modify: `tests/smoke/install-tarball.sh`（扩展 Unit 5a 创建的 harness）
- Modify: `README.md`

**Approach:**
- 扩展 `tests/smoke/install-tarball.sh`（Unit 5a 创建），验证 `postinstall` / `-v` / `doctor` 三者在”默认安装后、未初始化项目”的组合行为
- **postinstall 输出断言必须在 `npm_config_foreground_scripts=true` 下运行**：npm 默认 `foreground-scripts` 配置在不同版本下不一致（npm v7 默认 true，v8+ 默认 false），不设置该变量则 postinstall 输出不会出现在 stdout。测试脚本必须显式设置 `export npm_config_foreground_scripts=true`
- 区分两类断言的稳定性层级：
  - **确定性断言**（不依赖 npm lifecycle）：`spec-first -v` 包含 `doctor` + 版本号；`spec-first doctor` 输出 init 指引
  - **环境相关断言**（依赖 foreground_scripts）：postinstall 输出包含 `spec-first doctor`
- 在 README 或 release 文档中明确发布前需要做的安装体验验收，不让体验回归只依赖人工感受

**Patterns to follow:**
- `tests/smoke/install-local.sh` 当前对输出文本的精确断言模式
- `tests/smoke/cli.sh` 当前对版本页和 doctor 的组合检查模式

**Test scenarios:**
- **确定性断言**（不依赖 npm config）：安装完成后执行 `spec-first -v`，输出包含 `doctor` 且顺序与文档一致
- **确定性断言**：在 fresh project 执行 `spec-first doctor`，得到简洁 `init --claude|--codex` 指引
- **环境相关断言**（需 `npm_config_foreground_scripts=true`）：postinstall 输出包含 `spec-first doctor` 和 `spec-first -v`
- Edge case: 即使 npm lifecycle 输出不可见（未设置 foreground_scripts），执行 `spec-first -v` 仍能看到完整欢迎页
- Integration: 整个 tarball 安装验证链路可以在 CI 或本地发布前重复运行

**Verification:**
- 发布前存在一条清晰、可重复的安装体验回归路径，能够同时守住依赖噪音和引导文案两个层面
- 未来若有人重新引入 warning 噪音或膨胀安装提示，smoke 测试会直接失败

## System-Wide Impact

- **Interaction graph:** 本计划同时影响 npm 打包安装、CLI 版本输出、doctor 指引和文档入口，是典型的跨层用户体验改动
- **Error propagation:** 若依赖收敛策略处理不当，风险会直接从安装期传播到 CRG 运行时，因此必须由 CRG 单测和真实 tarball 安装共同兜底
- **State lifecycle risks:** 全局安装与项目初始化是两个不同阶段，文案必须清楚区分，否则会制造“安装成功但入口不可见”的伪故障
- **API surface parity:** `spec-first -v`、README、FAQ、本地安装文档都属于对外契约；任何一处更新都要同步其余入口
- **Integration coverage:** 单个文件的单测无法证明真实安装体验，必须保留 tarball 安装级别的回归
- **Unchanged invariants:** `doctor`、`init`、`clean` 三个核心命令的行为不变；本计划只调整依赖策略和对外引导，不改变初始化产物结构

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `tree-sitter` 版本收敛后触发 CRG 解析回归 | 以 CRG 单测 + tarball 安装回归双重验证，先收集兼容矩阵再选版本 |
| tree-sitter-c/python/rust/swift 降级后丢失较新语言语法的解析能力 | **降级前先补足 C/Python/Rust 的 AST parse fixture + 断言**（当前只有 `inferLanguage` 测试，无法检测 AST 退化），补足后再执行降级，降级后立即跑新增断言确认无回归 |
| tree-sitter-objc 保留 3.0.2 会持续产生 1 条 peer warning，且 ObjC parse 行为无测试保障 | **补足 ObjC AST fixture + parse 断言**（覆盖 `@interface`/`@implementation`/`@protocol`），为"保留不降级"决策提供可执行证据；在 postinstall 中保留一句短说明 |
| `overrides` 在全局安装时不生效 | `overrides` 只是兜底层，核心策略仍是直接依赖版本收敛；即使 overrides 不生效，warning 也仅剩 objc 1 条 |
| `postinstall` 压缩过度，导致用户不知道后续动作 | 保留 `spec-first doctor` 作为唯一主动作，并用 `spec-first -v` 承接详细说明 |
| `-v`、`doctor`、文档再次漂移 | 把 canonical onboarding 顺序写入 smoke 断言与文档同步要求 |
| npm lifecycle 输出在不同环境下不可见，导致用户以为安装没成功 | 明确把稳定欢迎页落在 `spec-first -v`（确定性断言），postinstall 断言只在 `npm_config_foreground_scripts=true` 下执行（环境相关断言），并在 FAQ 中解释分层 |
| 文档仍保留“warning 可忽略”的旧叙事 | 将其降级为故障排查说明，并在文档统一更新时显式清理旧表述 |

## Documentation / Operational Notes

- 这是用户可见改动，实施时必须同步更新 `CHANGELOG.md`
- 若依赖版本策略发生调整，需在 `docs/08-版本更新/README.md` 记录安装体验与依赖治理背景
- 发布前建议把”真实 tarball 安装体验回归”纳入 release checklist，而不是仅依赖 `npm test`
- **可选收尾**：Unit 1 完成后，验证 `npm install`（不加 `--legacy-peer-deps`）在开发环境下是否仍然成功；若成功，移除 `CLAUDE.md` 中 `npm run test:jest` 前的 `--legacy-peer-deps` 说明。此改动属于开发者工作流改进，不直接影响 R1-R6 的用户安装体验目标，不应作为 Unit 1 的核心验收门

## Plan Depth

本计划按 **Deep** 执行。原因是它同时触及：

- 对外 CLI 安装体验与欢迎页契约
- npm 生命周期与依赖解析策略
- CRG 运行时依赖兼容性
- 文档、测试、发布前验证的一致性治理

## Confidence Check

当前计划已经具备可执行所需的关键信息：

- 问题边界清晰：依赖噪音与 onboarding 分层都被纳入，而不是只改文案
- 文件路径具体：实现、测试、文档路径均已明确
- 测试足够具体：每个 feature-bearing unit 都包含真实安装或 fresh-project 场景
- 风险已显式化：特别是 `tree-sitter` 版本收敛与 CRG 回归风险

剩余不确定性主要集中在实现阶段需要验证的版本组合，而不影响当前进入实施阶段。因此本计划可直接作为后续执行输入。
