---
date: 2026-05-26
topic: spec-first-init-interactive-rebuild
spec_id: 2026-05-26-002-spec-first-init-interactive-rebuild
---

# spec-first init 交互式重构

## Summary

把 `spec-first init` 从「必填 `--claude/--codex` 的批处理命令」彻底重构为「在交互式终端里逐步引导的命令」：取消 init 子命令的所有 flag，在 TTY 中以下拉/输入逐步收集平台、用户、语言、批量目标，默认呈现写出物预览并要求显式确认才落盘；non-TTY 环境直接报错退出。

---

## Problem Frame

当前 `spec-first init (--claude|--codex) [-u <name>] [--lang <zh|en>] [--dry-run] [--repo <child>|--all-repos]` 的设计把所有产品维度都摊在 flag 平面上。结果是：

- 新用户首次运行时必须知道两个 host 的 flag 名才能往下走，记错 flag 就直接撞 usage 错误。
- 其他参数（user、lang、dry-run、repo 路由）即使有 fallback 也都是「全或无」的命令行约定，没有任何在线引导能告诉用户当前预填值是什么、可以怎么改。
- 双 host 入口在视觉上同等重要，但用户大多只用其中一个；现有形态没有按用户当前环境帮其聚焦。

`-u`、`--lang` 已有的 fallback 链（项目 `.developer` → 全局 `~/.spec-first/.developer` → `git config user.name`）只在静默路径生效；用户既看不到默认值，也无法只复用部分默认。`--dry-run` 这种「先看再决定」的能力，必须用户先知道有这个 flag 才能用上。整体形态对脚本/CI 友好，但对真人首次接入不友好。

本次决策的边界：只重构 `init` 子命令的入口形态与默认语义；不动 `doctor`、`clean`、`tasks`、`session` 等其他子命令，也不动 init 的写出物本体（runtime asset 同步、CHANGELOG bootstrap、developer profile、SessionStart hook 写入这些产物逻辑保持不变）。

---

## Actors

- A1. 真人开发者（首次接入或回头重置）：在交互式终端里运行 `spec-first init`，按引导完成平台/身份/语言/目标选择，预览写出物后确认或取消。
- A2. 自动化场景（CI、postinstall 子进程、`tarball install` 测试运行器、`runInit()` 程序化调用）：本次重构后这些场景不再走 init 命令；release/install 验证路径需要在 plan 阶段重新设计（详见 Outstanding Questions）。

---

## Key Flows

- F1. 单仓首次 init
  - **Trigger:** 用户在仓库根目录交互式终端运行 `spec-first init`。
  - **Actors:** A1。
  - **Steps:**
    1. 命令检测 stdin 是 TTY，进入引导模式。
    2. 询问平台（下拉单选：Claude / Codex）。
    3. 询问开发者用户名，预填值取自现有 fallback 链。
    4. 询问语言（下拉单选：zh / en），预填值取自现有 fallback 链。
    5. 打印「将要写出/更新/移除/untrack 的全部路径」预览。
    6. 询问「确认执行 / 取消」。
  - **Outcome:** 用户确认后落盘；用户取消则 0 退出且磁盘未变。
  - **Covered by:** R1, R2, R3, R4, R5, R7, R9, R10, R11, R12, R13。

- F2. 父 workspace 多 child repos 批量 init
  - **Trigger:** 用户在父 workspace（cwd 不在任何 git 仓库内）运行 `spec-first init`，且检测到至少一个 child git 仓库。
  - **Actors:** A1。
  - **Steps:**
    1. 命令检测 stdin 是 TTY，进入引导模式。
    2. 询问平台、用户名、语言（同 F1 步骤 2-4）。
    3. 列出探测到的 child repos，询问「全部初始化 / 选某一个 / 取消」。
    4. 打印将要在父 workspace 与所选 child(ren) 上执行的写出物预览，包括各 child 的 host runtime mirror 与父 workspace 的 advisory summary 路径。
    5. 询问「确认执行 / 取消」。
  - **Outcome:** 选「全部」等价于今天的 `--all-repos`；选某一个等价于今天的 `--repo <child>`；选「取消」则 0 退出且磁盘未变。
  - **Covered by:** R1, R6, R9, R10, R12, R13。

- F3. non-TTY 拒绝
  - **Trigger:** stdin 不是 TTY（pipe、子进程、CI runner、tarball install 测试等）下运行 `spec-first init`。
  - **Actors:** A2。
  - **Steps:**
    1. 命令检测 stdin 不是 TTY。
    2. 打印一条明确指向「请在交互式终端运行 spec-first init」的错误，并以非 0 退出码结束。
  - **Outcome:** 不写任何文件、不试图读取 stdin、不静默兜底。
  - **Covered by:** R8。

---

## Requirements

**入口形态**
- R1. `spec-first init` 子命令不再接受任何位置参数 / flag（包括 `--claude`、`--codex`、`-u`、`--user`、`--lang`、`--dry-run`、`--repo`、`--all-repos` 及对应 `=` 形式）；任何未知 flag 一律按错误处理。
- R2. CLI 全局开关 `--help`/`-h`、`--version`/`-v` 仍然支持，并由 `runCli` 顶层处理；`spec-first init --help` 仍打印 init 子命令的引导说明（不再列 flag 表，改为说明引导步骤与 non-TTY 行为）。

**交互引导步骤**
- R3. 在 TTY 下，引导按固定顺序呈现：① 平台 → ② 用户名 → ③ 语言 → ④（仅当父 workspace 检测到 child repos 时）批量目标 → ⑤ 写出物预览 → ⑥ 确认/取消。
- R4. 平台步骤是单选下拉，固定两项：Claude、Codex。无预选默认；用户必须显式选择。
- R5. 用户名步骤是文本输入，预填值按现有 fallback 链解析（项目 `.developer` → `~/.spec-first/.developer` → `git config user.name`）；用户回车即接受预填，输入新值即覆盖；预填解析失败时不阻塞，留空让用户输入。
- R6. 语言步骤是单选下拉，候选项 `zh`、`en`，预填值按现有 fallback 链解析；用户回车接受，方向键/键入选另一个即覆盖。
- R7. 批量目标步骤仅在「cwd 不在 git 仓库 + 父 workspace 内探测到至少一个 child git repo」时出现；候选项至少包含「全部 child repos / 单选某 child / 取消」。否则跳过此步。

**默认预览语义**
- R8. 进入主流程前必须先校验 stdin 是 TTY；非 TTY 时打印明确错误并以非 0 退出码退出，错误文本要明确指向「请在交互式终端运行」。
- R9. 所有问答收集完后，命令必须先打印「将要写出/更新/移除/untrack 的全部路径」预览，再发出确认询问；预览阶段绝对不能落盘。
- R10. 预览之后，询问「确认执行 / 取消」二选一；选确认才落盘，选取消必须 0 退出且磁盘未变；取消信息中提示用户「重新运行 spec-first init 可重启引导」。

**写出物本体不变**
- R11. 引导确认后实际写出的内容（`.claude/`、`.codex/`、`.agents/skills/` runtime mirror、`CLAUDE.md`/`AGENTS.md` managed blocks、`.developer`、state 文件、`.gitignore` managed block、CHANGELOG bootstrap、Claude SessionStart hook 等）与今天 `init --claude|--codex -u … --lang …` 一次性运行的产物等价。
- R12. 引导确认后写入的 developer profile、CHANGELOG 作者、language managed block 等内容与今天 `init` 选择对应平台/用户/语言时完全一致。
- R13. 父 workspace 批量 init 时，针对父 workspace 与所选 child(ren) 的 advisory summary（`.spec-first/workspace/init-summary.json`）行为与今天 `--all-repos` / `--repo <child>` 等价。

**外部话术与文档**
- R14. 所有现存指向 `spec-first init --claude` 或 `spec-first init --codex` 的引导文本都要更新为「运行 `spec-first init` 然后按引导选择」；至少覆盖 `spec-first doctor` 输出、`bin/postinstall.js` 欢迎信息、`spec-first --version` 文案、`spec-first --help`、`spec-first init --help`、README、README.zh-CN、CHANGELOG、`docs/` 中作为现行用法引用的位置（archive 与历史 plan/audit 不强制改）。
- R15. 因取消 flag 而失效的所有 unit test、smoke test、tarball install test、release-governance 检查（约 70+ 处 `runInit([...])` 与 `init --claude` 调用）必须在 plan 阶段一并改造，使其通过其他可测试入口验证 init 行为；不得保留以「跳过测试」收场。

---

## Acceptance Examples

- AE1. **Covers R1, R3, R4.** 在交互式终端单仓中运行 `spec-first init --claude`，命令立即报错「unknown option」并以非 0 退出，磁盘未变。
- AE2. **Covers R3, R4, R5, R6, R9, R10, R11.** 在交互式终端单仓中运行 `spec-first init`，按引导依次选 Claude、回车接受预填用户名、回车接受预填 zh，看到写出物预览，选「确认」；最终 `.claude/`、`CLAUDE.md` managed blocks、`CHANGELOG.md`、`.developer`、state 等与今天 `init --claude -u <预填名> --lang zh` 一次性运行的产物等价。
- AE3. **Covers R9, R10.** 在交互式终端单仓中运行 `spec-first init`，按引导走到预览步骤，选「取消」；命令以 0 退出，仓库内不存在任何 init 写出/更新/移除/untrack 操作。
- AE4. **Covers R7, R13.** 在父 workspace（cwd 不在 git 仓库）下检测到 2 个 child repos 时运行 `spec-first init`，引导第 4 步出现批量目标询问，选「全部」并确认；父 workspace 的 advisory summary 与两个 child 的 runtime mirror 都生成，行为与今天 `--all-repos` 等价。
- AE5. **Covers R7, R13.** 在父 workspace 下检测到 2 个 child repos 时运行 `spec-first init`，引导第 4 步选「单选 repoA」并确认；只有 repoA 与父 workspace 写出物落盘，repoB 未变，行为与今天 `--repo repoA` 等价。
- AE6. **Covers R8.** 在 non-TTY 环境（如 `node bin/spec-first.js init </dev/null`）运行 init，命令打印明确的「需要交互式终端」错误并以非 0 退出，磁盘未变。
- AE7. **Covers R2.** `spec-first init --help`、`spec-first --help`、`spec-first --version` 仍正常打印帮助/版本，不进入引导也不报错。

---

## Success Criteria

- 真人开发者在不读 README 的前提下，仅靠运行 `spec-first init` 就能在 TTY 中走完一次完整初始化，无需事先记住任何 flag 名；首次 init 与重置 init 的语义直观一致。
- 取消 init flag 后的所有外部引导话术（doctor、postinstall、help、版本信息、README）保持自洽，下游 agent / 用户读到的下一步指令是「运行 `spec-first init`」而不是任何含 `--claude` / `--codex` 的命令。
- non-TTY 环境下命令无歧义地拒绝运行，错误信息可被自动化场景作为明确信号，不会因静默兜底引发难定位的副作用。
- 引导确认后的实际写出物与今天 `init --claude|--codex -u … --lang …` 一次性运行的产物逐字段等价；现有的 runtime drift 检测、legacy state hard reset、untrack 等行为不受影响。
- 取消的所有 flag 在测试矩阵中都有等价覆盖：plan 阶段产出的可测试入口能验证 R3-R13 行为，不得以「测试不可达 → 跳过」收场。

---

## Scope Boundaries

- 不提供 CI / 自动化 / pipe stdin 的非交互兜底通路；non-TTY 一律拒绝。
- 不重构 `doctor`、`clean`、`tasks`、`session`、`gitnexus-instruction`、`internal` 等其他子命令的入口形态。
- 不修改 init 落盘内容本身（runtime mirror 同步、managed block 渲染、SessionStart hook、CHANGELOG bootstrap、`.gitignore` managed block 这些产物逻辑保持原样）。
- 不变更 CLI 全局 flag（`--help`、`-h`、`--version`、`-v`）的行为。
- 不在本次决定具体引导实现技术（原生 readline、是否引入轻量 prompt 库、纯数字选择等），不在本次决定下拉/输入控件的精确视觉与按键定义；这些归 plan 阶段。
- 不在本次定义错误文案、帮助文案、预览输出的精确字符串。
- 不重写已经归档的 plan/audit/历史 README backup 中对旧 flag 的引用。

---

## Key Decisions

- 彻底取消 init 子命令的所有 flag，不保留任何向后兼容路径（包括 hidden CI backdoor）：明确收益是 UX 形态唯一、外部话术与教学路径单一；明确代价是 70+ 处既有调用与若干外部测试路径必须重写，由 plan 阶段承担。
- non-TTY 直接报错退出而非静默兜底：避免「因为 stdin 不是 TTY，所以静默用某些默认值」这种隐式行为带来的可观测性损失；release/install 测试路径在 plan 阶段重新设计而不是回退到此决策。
- 默认行为变更为「先预览再确认」（吸收今天 `--dry-run` 的能力）：和 plan/apply pattern 对齐，新人首次 init 不会因误执行而留下需要 clean 的产物；代价是每次正常 init 多一次确认按键，可接受。
- 用户名/语言的现有 fallback 链作为「预填默认值」呈现而非静默套用：用户能看到当前预填来源，回车即接受、输入即覆盖；保留 fallback 行为本身的同时把它从隐式路径转成显式路径。

---

## Dependencies / Assumptions

- 假设宿主在 macOS / Linux 主流终端中 `process.stdin.isTTY` 是稳定可用的判定信号；在 Windows 终端、Docker exec 等边缘环境的判定准确性需要在 plan 阶段抽样验证。
- 假设现有 fallback 链解析路径（`developer.js` 中的 `resolveDeveloperIdentity` / 全局 `~/.spec-first/.developer` 读取）可以被引导前置使用以计算预填默认值，无需大改。
- 假设 child repos 探测逻辑（`discoverChildGitRepos` 当前最大深度 3、`skipNames` 列表）可以原样复用以驱动批量目标步骤，无需变更探测策略。
- 假设引导阶段不需要新建 npm 运行时依赖；若 plan 阶段评估必须引入轻量 prompt 库，需要单独决策（参见 Outstanding Questions）。
- 70+ 处现存测试调用（`runInit([...])`、`init --claude --dry-run -u … --lang …`、`install-tarball.sh` 中的 init 调用）的改造由 plan 阶段统一规划；本次假设可以通过抽出一个程序化、独立于交互层的 init plan/apply 入口来给测试用，但具体形式留待 plan。

---

## Outstanding Questions

### Resolve Before Planning

（无；产品维度的关键决策已在对话中确认。）

### Deferred to Planning

- [Affects R3-R7][Technical] 引导控件的具体实现方式：原生 `readline`、引入轻量 prompt 库（如 `@inquirer/prompts`、`prompts`）、还是纯 numbered prompt 让用户敲数字？需要平衡「保持当前 0 运行时依赖」与「下拉/方向键体验」。
- [Affects R8][Technical] `process.stdin.isTTY` 在 Windows、Docker exec、SSH non-pty、`node bin/spec-first.js init <` 等场景下的判定准确性，需要在 plan 阶段抽样验证或定义补充判定规则。
- [Affects R15][Technical] 取消 flag 后给单元/smoke/tarball 测试的「程序化入口」抽象怎么设计：是抽出 `buildInitPlan(answers)` + `applyInitPlan(plan)` 两层让测试只测后者，还是引入「testing-only stdin script harness」。两条路线在测试可读性、覆盖度、与产品代码耦合度上差异较大。
- [Affects R14][Needs research] 是否要为引导模式新增 in-CLI 国际化文案管理（zh/en 双语提示词）：当前 init 文案是 hard-coded 的，引导改造会显著扩大文案面积；是延续现有 hard-code 风格还是引入轻量 i18n 表，留 plan 评估。
- [Affects R7, R13][Needs research] 父 workspace 批量目标的候选项是「单选某 child / 全部 / 取消」三项就够，还是要支持多选若干 child（今天 `--repo` 只支持单 child）？多选会让 plan 设计更复杂，但可能匹配真实使用场景；plan 阶段抽样真实 workspace 形态后定。
