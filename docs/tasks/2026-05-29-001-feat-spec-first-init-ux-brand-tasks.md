---
title: "spec-first init UX & brand polish — Task Pack"
type: "task-pack"
status: "derived"
date: "2026-05-29"
spec_id: "2026-05-29-002-spec-first-init-ux-brand"
source_plan: "docs/plans/2026-05-29-002-feat-spec-first-init-ux-brand-plan.md"
source_plan_hash: "sha256:0bc034f032952fc655ab3840a5130c45778a432d24be3898a57b72a8537e9aee"
generated_by: "spec-write-tasks"
mode: "derived"
source_sections:
  - "Requirements"
  - "Scope Boundaries"
  - "Key Technical Decisions"
  - "Implementation Units"
---

# spec-first init UX & brand polish — Task Pack

## Overview

8 个任务、4 波执行。Wave 1 独立并行，Wave 2 依赖 Wave 1，Wave 3/4 串行消化 `commands/init.js` 的文件排他性。所有任务均为展示层改动，不触碰 init 落盘逻辑，无迁移风险。

---

## Source Summary

- **Source plan**: `docs/plans/2026-05-29-002-feat-spec-first-init-ux-brand-plan.md`
- **Task-ready branch**: `compile`（8 个实现单元，清晰文件边界，依赖可图示化）
- **Consumed sections**: Requirements (R1–R14, AE1–AE8), Scope Boundaries, Key Technical Decisions, Implementation Units (U1–U8)
- **Scope exclusions shaping splits**: 不改落盘逻辑；颜色仅限 logo+preview；不引入新 npm 依赖；不做 workspace 模式语言切换
- **Implementation-time unknowns**: ASCII art 具体字形（U1 实现时定稿）；按键提示 hint 文案措辞（T002 i18n 表定稿）

---

## Traceability Matrix

| 计划单元 | 需求 / AE | 任务 | 验证方式 |
|---------|----------|------|---------|
| U1 | R1, R11, R12, R13 / AE5, AE6, AE7, AE8 | T001 | brand.test.js |
| U3 | R5, R6 / AE1, AE4 | T002 | init-i18n.test.js |
| U4 | R7, R8 / AE3 | T003 | prompts.test.js |
| U2 | R2, R3, R4 / AE1, AE2 | T004 | init-interactive.test.js |
| U7 | R2, R11 / AE5, AE6 | T005 | smoke + 手动 -v 对齐验证 |
| U8 | R1, R2 / AE6, AE8 | T006 | smoke |
| U5 | R9, R13, R14 / AE7, AE8 | T007 | init-interactive.test.js |
| U6 | R10 / AE1, AE4 | T008 | init-interactive.test.js |

---

## Task Graph

```
T001 (brand)    ──┐
T002 (i18n)     ──┼──→ T004 (banner, init.js)
T003 (prompts)  ──┘──→ T005 (version, index.js)
                    ──→ T006 (postinstall)
                         T004 ──→ T007 (preview, init.js)
                                    T007 ──→ T008 (nextstep, init.js)
```

T001、T002、T003 互相独立，可并行。T004/T005/T006 均依赖 T001（T004 还依赖 T002），文件不重叠可并行。T007 必须在 T004 之后（同一文件）；T008 必须在 T007 之后（同一文件）。

---

## Execution Waves

| Wave | 任务 | 说明 |
|------|------|------|
| 1 | T001, T002, T003 | 独立基础模块，无共享文件 |
| 2 | T004, T005, T006 | 消费 Wave 1 产物；三个任务文件不重叠，可并行 |
| 3 | T007 | 消费 T004 成果；init.js 延续编辑 |
| 4 | T008 | 消费 T007 成果；init.js 最终 polish |

---

## Task Pack Contract

```json
{
  "schema_version": "task-pack/v1",
  "execution_waves": [
    { "wave": 1, "tasks": ["T001", "T002", "T003"] },
    { "wave": 2, "tasks": ["T004", "T005", "T006"] },
    { "wave": 3, "tasks": ["T007"] },
    { "wave": 4, "tasks": ["T008"] }
  ],
  "tasks": [
    {
      "task_id": "T001",
      "source_unit": "U1",
      "requirement_refs": ["R1", "R11", "R12", "R13"],
      "goal": "新建 src/cli/brand.js，导出 renderFullArt、renderWordmark、detectColorSupport、BrandColors、colorize，供三处品牌入口共享。",
      "dependencies": [],
      "files": [
        "src/cli/brand.js",
        "tests/unit/brand.test.js"
      ],
      "test_focus": "detectColorSupport 在 NO_COLOR/FORCE_COLOR/isTTY/TERM=dumb 各条件下的返回值；renderFullArt 对不同长度版本号的框边对齐稳定性；useColor=false 时输出不含 ANSI 转义序列。",
      "done_signal": "npm run test:unit -- --testPathPattern=brand 全绿；node --check src/cli/brand.js 通过。",
      "wave": 1,
      "stop_if": "实现需要引入新 npm 运行时依赖；art 字形需要超出 ASCII/box-drawing 字符集；renderFullArt/renderWordmark 需要读取文件系统之外的外部资源。",
      "review_gate": "optional",
      "review_focus": "BrandColors 的 ANSI 16-color 选值是否覆盖 AE7；detectColorSupport 的 FORCE_COLOR/NO_COLOR 优先级顺序是否与 R13 一致。"
    },
    {
      "task_id": "T002",
      "source_unit": "U3",
      "requirement_refs": ["R5", "R6"],
      "goal": "新建 src/cli/init-i18n.js，导出 getInitMessages(lang)，覆盖所有 init 交互 prompt、hint、错误反馈的 zh/en 文案键。",
      "dependencies": [],
      "files": [
        "src/cli/init-i18n.js",
        "tests/unit/init-i18n.test.js"
      ],
      "test_focus": "zh/en 键集合完整性（所有键在两种语言下均存在）；minSelectedError(n) 含数字参数且有说明；invalid lang fallback 到 zh。",
      "done_signal": "npm run test:unit -- --testPathPattern=init-i18n 全绿；getInitMessages('zh') 与 getInitMessages('en') 的键集合相同。",
      "wave": 1,
      "stop_if": "发现需要覆盖 init 以外（doctor/clean/tasks 等）的文案；需要超过 zh/en 两种语言；需要引入 i18n 库依赖。"
    },
    {
      "task_id": "T003",
      "source_unit": "U4",
      "requirement_refs": ["R7", "R8"],
      "goal": "为 select 和 checkbox prompt 增加 hint 选项（按键提示行）；为 checkbox 增加 minSelected 未满时的可见错误行，清除 errorMessage 逻辑正确。",
      "dependencies": [],
      "files": [
        "src/cli/prompts/index.js",
        "tests/unit/prompts.test.js"
      ],
      "test_focus": "有/无 hint 时 lineCount 值正确；零勾选回车后出现错误行；用户方向键/空格操作后错误行清除；minSelected=0 时零勾选回车正常 resolve（无回归）；现有 prompts 测试全部通过。",
      "done_signal": "npm run test:unit -- --testPathPattern=prompts 全绿，包括原有测试无回归。",
      "wave": 1,
      "review_gate": "optional",
      "review_focus": "lineCount 计算精确性（含 hint/error 行时各分支值）；errorMessage 的清零时机；prompt API 向后兼容性（hint/onMinError 为可选参数）。",
      "stop_if": "lineCount 改动导致多于 1 个既有 prompts 测试失败且失败原因与展示无关；需要修改 runPrompt 核心事件循环逻辑。"
    },
    {
      "task_id": "T004",
      "source_unit": "U2",
      "requirement_refs": ["R2", "R3", "R4"],
      "goal": "在 runInit() 加入 hasAnyManagedState 快速检测与品牌 banner 展示：首次运行显示完整 art，重复运行降为 wordmark；同时前置解析 defaultLang 供后续 prompt 使用。",
      "dependencies": ["T001", "T002"],
      "files": [
        "src/cli/commands/init.js",
        "tests/unit/init-interactive.test.js"
      ],
      "test_focus": "无 managed state 时 stdout 包含完整 art 多行内容；有 .claude/spec-first/state.json 时仅 wordmark；-y 模式无 banner；non-TTY 拒绝路径输出不含 banner。",
      "done_signal": "npm run test:unit -- --testPathPattern=init-interactive 相关 banner 用例通过；现有 init-interactive 测试无回归。",
      "wave": 2,
      "stop_if": "hasAnyManagedState 需要实例化 adapter 对象（而非直接 fs.existsSync 文件路径检查）；banner 插入位置影响现有 non-TTY 拒绝逻辑或 -y 模式行为。"
    },
    {
      "task_id": "T005",
      "source_unit": "U7",
      "requirement_refs": ["R2", "R11"],
      "goal": "将 printVersion() 改用 renderFullArt(pkg.version, { useColor: detectColorSupport() })，删除硬编码双线框字符串，消除版本号长度导致的对齐错位。",
      "dependencies": ["T001"],
      "files": [
        "src/cli/index.js"
      ],
      "test_focus": "不同长度版本号下各行字符长度相同（对齐稳定，AE5）；spec-first --version smoke 路径无回归。",
      "done_signal": "npm run test:smoke 通过；node -e 'require(\"./src/cli\").printVersion()' 输出对齐正确（视觉验证）。",
      "wave": 2,
      "stop_if": "快速上手文案需要大幅重写或与 printHelp 逻辑产生耦合；需要修改 pkg.version 以外的 CLI 分支。"
    },
    {
      "task_id": "T006",
      "source_unit": "U8",
      "requirement_refs": ["R1", "R2"],
      "goal": "将 bin/postinstall.js 的品牌展示替换为 renderFullArt，实现三处品牌视觉一致（AE6）；非 TTY 场景自动降级为纯文本（AE8）。",
      "dependencies": ["T001"],
      "files": [
        "bin/postinstall.js"
      ],
      "test_focus": "smoke test 中 postinstall 输出包含版本字符串；模拟非 TTY 时输出不含 ANSI 序列（AE8 postinstall 路径）。",
      "done_signal": "npm run test:smoke 通过；node bin/postinstall.js 手动验证品牌输出与 spec-first -v 一致（AE6）。",
      "wave": 2,
      "stop_if": "需要修改 ensureSupportedNodeVersion 或其他非展示逻辑；需要新增对 package.json 以外文件的依赖。"
    },
    {
      "task_id": "T007",
      "source_unit": "U5",
      "requirement_refs": ["R9", "R13", "R14"],
      "goal": "本地化 printInitDryRun() 消息（zh/en），为写入/更新/移除/untrack 操作计数加语义色；修改 printInitPreviews() 传递 lang 和 useColor。",
      "dependencies": ["T004", "T002", "T001"],
      "files": [
        "src/cli/commands/init.js",
        "src/cli/init-i18n.js",
        "tests/unit/init-interactive.test.js"
      ],
      "test_focus": "lang=zh 时输出含中文「移除」；lang=en 时含英文「remove」；useColor=false 时无 ANSI 序列（AE8）；useColor=true 时写入计数含绿色 ANSI、移除含红色（AE7）；零操作计划输出无回归。",
      "done_signal": "npm run test:unit -- --testPathPattern=init-interactive 中 preview 相关用例通过。",
      "wave": 3,
      "stop_if": "preview 本地化影响 workspace 模式的英文输出逻辑（workspace 模式本次不做语言切换，若有影响需停下与 spec-plan 确认）；需要修改 printWorkspaceInitApplySuccess 的语言行为。"
    },
    {
      "task_id": "T008",
      "source_unit": "U6",
      "requirement_refs": ["R10"],
      "goal": "改进 printInitNextSteps() 和 printInitNextStepsForPlatforms() 的引导语气与层次结构（zh/en 同步，核心信息不丢失）。",
      "dependencies": ["T007"],
      "files": [
        "src/cli/commands/init.js"
      ],
      "test_focus": "zh 输出含「重启」关键词；en 输出含「Restart」；双 platform 场景包含两个 platform 名称（无回归）。",
      "done_signal": "npm run test:unit -- --testPathPattern=init-interactive 通过；文案结构人工确认引导语气与层次改善。",
      "wave": 4,
      "stop_if": "文案改动导致 smoke 测试中 next-step 输出验证失败且人工确认文案取舍存在争议；需要引入新的 console.log 输出结构影响其他测试。"
    }
  ]
}
```

---

## Task Cards

### T001 — 品牌与颜色模块

- **source_unit:** U1
- **requirement_refs:** R1, R11, R12, R13
- **goal:** 新建 `src/cli/brand.js`，导出 `renderFullArt`、`renderWordmark`、`detectColorSupport`、`BrandColors`、`colorize`。
- **dependencies:** []
- **files:**
  - `src/cli/brand.js`
  - `tests/unit/brand.test.js`
- **context_refs:**
  - `docs/plans/2026-05-29-002-feat-spec-first-init-ux-brand-plan.md#U1-品牌与颜色模块` — 接口草图与颜色常量规格
  - `src/cli/index.js` — `printVersion()` 当前双线框实现作为起点参考
  - `bin/postinstall.js` — 当前单线框实现作为对比参考
- **entry_hint:** 从计划 Key Technical Decisions 中的 brand.js 接口草图开始；`detectColorSupport` 是其他模块的前置条件
- **test_focus:** detectColorSupport 在 NO_COLOR/FORCE_COLOR/isTTY/TERM 各条件下的返回值；renderFullArt 对不同长度版本号的框边对齐稳定性；useColor=false 时输出不含 ANSI 转义序列
- **done_signal:** `npm run test:unit -- --testPathPattern=brand` 全绿；`node --check src/cli/brand.js` 通过
- **parallelizable:** true（Wave 1，无依赖）
- **risk_note:** ASCII art 字形最终由实现者定稿；主要风险是计算式 padding 的等宽字符假设（art 中不含 CJK，风险低）
- **review_gate:** optional
- **review_focus:** BrandColors 16-color 选值与 AE7 的语义色要求一致性；detectColorSupport FORCE_COLOR/NO_COLOR 优先级是否与 R13 预期一致
- **stop_if:** 实现需要新 npm 运行时依赖；art 需要 CJK 字符或超出 ASCII/box-drawing 范围
- **wave:** 1

---

### T002 — Init i18n 文案表

- **source_unit:** U3
- **requirement_refs:** R5, R6
- **goal:** 新建 `src/cli/init-i18n.js`，导出 `getInitMessages(lang)` 覆盖所有 init 交互 prompt/hint 文案键（不含 preview 相关键，由 T007 补充）。
- **dependencies:** []
- **files:**
  - `src/cli/init-i18n.js`
  - `tests/unit/init-i18n.test.js`
- **context_refs:**
  - `docs/plans/2026-05-29-002-feat-spec-first-init-ux-brand-plan.md#U3-Init-prompt-本地化i18n-表` — 所有需要覆盖的消息键列表
  - `src/cli/commands/init.js` — `collectInitInput()` 中所有硬编码英文 prompt 字符串
- **entry_hint:** 先在 init.js 的 collectInitInput() 中枚举所有硬编码英文字符串，再建表
- **test_focus:** zh/en 键集合完整性（两组键名相同）；minSelectedError(n) 含数字参数；invalid lang fallback 到 zh
- **done_signal:** `npm run test:unit -- --testPathPattern=init-i18n` 全绿
- **parallelizable:** true（Wave 1，无依赖）
- **risk_note:** 若 collectInitInput 中还有遗漏英文 prompt，T007 的 preview 键会单独补充
- **stop_if:** 需要覆盖 init 以外的子命令文案；需要超过 zh/en 两种语言；需要引入 i18n 库
- **wave:** 1

---

### T003 — Prompt 按键提示与多选反馈

- **source_unit:** U4
- **requirement_refs:** R7, R8
- **goal:** 为 `select`/`checkbox` 增加 `hint` 选项（按键提示末行），为 `checkbox` 增加 `minSelected` 未满时的可见错误行及其清零逻辑。
- **dependencies:** []
- **files:**
  - `src/cli/prompts/index.js`
  - `tests/unit/prompts.test.js`
- **context_refs:**
  - `docs/plans/2026-05-29-002-feat-spec-first-init-ux-brand-plan.md#U4-Prompt-按键提示与多选最小数量反馈` — lineCount 变更规格、errorMessage 清零时机
  - `src/cli/prompts/index.js` — `renderSelect`/`renderCheckbox` 的 lineCount 计算（当前值，修改基准）
  - `tests/unit/prompts.test.js` — 现有测试结构（作为无回归基准）
- **entry_hint:** 先阅读 renderSelect/renderCheckbox 中 lineCount 的当前值，然后按 hint 存在/不存在两种路径分别计算新 lineCount
- **test_focus:** 有/无 hint 时 lineCount 值正确；零勾选回车后出现错误行；用户方向键操作后错误清除；minSelected=0 无回归；现有 prompts 测试全通过
- **done_signal:** `npm run test:unit -- --testPathPattern=prompts` 全绿，包含原有测试无回归
- **parallelizable:** true（Wave 1，无依赖）
- **risk_note:** lineCount 精确性是 prompt 清除重绘的前提，计算错误导致 UI glitch
- **review_gate:** optional
- **review_focus:** lineCount 各分支计算精确性；errorMessage 清零时机；hint/onMinError 参数可选性
- **stop_if:** lineCount 改动导致多于 1 个既有测试失败且原因与展示无关；需要修改 runPrompt 核心事件循环
- **wave:** 1

---

### T004 — Init 首次/重复运行品牌 Banner

- **source_unit:** U2
- **requirement_refs:** R2, R3, R4
- **goal:** 在 `runInit()` 加入 `hasAnyManagedState` 检测与品牌 banner 展示：首次运行 → 完整 art，重复运行 → wordmark；前置 defaultLang 解析供全程 prompt 使用。
- **dependencies:** ["T001", "T002"]
- **files:**
  - `src/cli/commands/init.js`
  - `tests/unit/init-interactive.test.js`
- **context_refs:**
  - `docs/plans/2026-05-29-002-feat-spec-first-init-ux-brand-plan.md#U2-Init-首次重复运行品牌-banner` — hasAnyManagedState 实现方式、banner 插入位置
  - `src/cli/commands/init.js:84-180` — `runInit()` 当前结构（TTY 检查、collectInitInput 调用点）
  - `src/cli/adapters/claude.js:43-45` — stateFile 路径（.claude/spec-first/state.json）
  - `src/cli/adapters/codex.js:51-53` — stateFile 路径
- **entry_hint:** banner 应插入在 requireTty 检查通过之后、collectInitInput() 之前；hasAnyManagedState 用 fs.existsSync 检查两个 stateFile 路径
- **test_focus:** 无 state 时 stdout 包含多行 art；有 .claude/spec-first/state.json 时仅 wordmark；-y 模式无 banner；non-TTY 时无 banner
- **done_signal:** `npm run test:unit -- --testPathPattern=init-interactive` banner 相关用例通过，现有测试无回归
- **risk_note:** hasAnyManagedState 基于 cwd，workspace 模式下若 cwd 是 parent 目录则始终显示 full art（可接受，plan 已明确）
- **stop_if:** banner 插入影响 non-TTY 拒绝路径（exit code 2）或 -y 模式的无交互行为；hasAnyManagedState 需要 adapter 实例化
- **wave:** 2

---

### T005 — 版本 Banner 对齐修复

- **source_unit:** U7
- **requirement_refs:** R2, R11
- **goal:** 将 `printVersion()` 改用 `renderFullArt(pkg.version, { useColor: detectColorSupport() })`，删除硬编码双线框字符串。
- **dependencies:** ["T001"]
- **files:**
  - `src/cli/index.js`
- **context_refs:**
  - `src/cli/index.js:185-218` — 当前 printVersion 实现（硬编码双线框 + 快速上手文案）
  - `docs/plans/2026-05-29-002-feat-spec-first-init-ux-brand-plan.md#U7-版本-banner-对齐修复`
- **entry_hint:** 直接替换 printVersion 中的 console.log 多行字符串；快速上手步骤列表保留，跟在 art 后面
- **test_focus:** 不同长度版本号下 art 各行字符长度相等（AE5）；spec-first --version smoke 路径无回归
- **done_signal:** `npm run test:smoke` 通过；不同版本号下 art 对齐视觉验证
- **parallelizable:** true（与 T004/T006 无文件重叠）
- **stop_if:** 快速上手文案改动影响 printHelp 或其他 CLI 分支
- **wave:** 2

---

### T006 — Postinstall Banner 统一

- **source_unit:** U8
- **requirement_refs:** R1, R2
- **goal:** 将 `bin/postinstall.js` 品牌展示替换为 `renderFullArt`，实现三处品牌视觉一致（AE6），非 TTY 场景自动降级（AE8）。
- **dependencies:** ["T001"]
- **files:**
  - `bin/postinstall.js`
- **context_refs:**
  - `bin/postinstall.js` — 当前约 25 行实现（单线框）
  - `docs/plans/2026-05-29-002-feat-spec-first-init-ux-brand-plan.md#U8-Postinstall-banner-统一`
- **entry_hint:** 文件极短；替换 process.stdout.write 中的框字符串为 renderFullArt，保留「下一步」文字
- **test_focus:** smoke test 中 postinstall 输出含版本字符串；模拟非 TTY 时输出不含 ANSI 序列
- **done_signal:** `npm run test:smoke` 通过；node bin/postinstall.js 手动确认输出与 spec-first -v 视觉一致（AE6）
- **parallelizable:** true（与 T004/T005 无文件重叠）
- **stop_if:** 需要修改 ensureSupportedNodeVersion 逻辑；需要新增对 package.json 以外文件的依赖
- **wave:** 2

---

### T007 — Preview 本地化与语义色

- **source_unit:** U5
- **requirement_refs:** R9, R13, R14
- **goal:** 本地化 `printInitDryRun()` 消息，为写入/更新/移除/untrack 计数加语义色；向 printInitPreviews() 传递 lang 和 useColor；补充 preview 消息键到 init-i18n.js。
- **dependencies:** ["T004", "T002", "T001"]
- **files:**
  - `src/cli/commands/init.js`
  - `src/cli/init-i18n.js`
  - `tests/unit/init-interactive.test.js`
- **context_refs:**
  - `docs/plans/2026-05-29-002-feat-spec-first-init-ux-brand-plan.md#U5-Preview-本地化与语义色`
  - `src/cli/commands/init.js:2023-2072` — printInitDryRun 当前实现（英文消息 + 无色版）
  - `src/cli/commands/init.js:473-485` — printInitPreviews 调用链
- **entry_hint:** 先在 init-i18n.js 中补充 preview 消息键；再修改 printInitDryRun 接受 lang/useColor 参数并替换字符串；最后在 runInit 的 printInitPreviews 调用处传参
- **test_focus:** lang=zh 时输出含中文「移除」；useColor=false 时无 ANSI；useColor=true 时写入计数含 BrandColors.write；零操作计划输出无回归
- **done_signal:** `npm run test:unit -- --testPathPattern=init-interactive` preview 相关用例通过
- **risk_note:** printInitDryRun 的签名变化需检查是否被 init.js 之外的代码调用（exports 检查）
- **stop_if:** preview 本地化影响 workspace 模式英文输出逻辑（plan 明确 workspace 模式本次不做语言切换）
- **wave:** 3

---

### T008 — Next-Step 文案润色

- **source_unit:** U6
- **requirement_refs:** R10
- **goal:** 改进 `printInitNextSteps()` 和 `printInitNextStepsForPlatforms()` 的引导语气与层次结构（zh/en 同步，核心信息不丢失）。
- **dependencies:** ["T007"]
- **files:**
  - `src/cli/commands/init.js`
- **context_refs:**
  - `src/cli/commands/init.js:1367-1414` — printInitNextSteps/printInitNextStepsForPlatforms 现有实现
  - `docs/plans/2026-05-29-002-feat-spec-first-init-ux-brand-plan.md#U6-Next-step-文案润色`
- **entry_hint:** 核心信息（重启宿主、选 workflow 入口、mcp-setup、graph-bootstrap）必须保留；可增加首行「初始化完成」提示语和结构层次
- **test_focus:** zh 含「重启」；en 含「Restart」；双 platform 场景含两个 platform 名
- **done_signal:** `npm run test:unit -- --testPathPattern=init-interactive` 通过；文案人工确认引导语气改善
- **stop_if:** 文案改动导致 smoke 测试 next-step 验证失败且争议无法当场解决；需要改变函数输出结构（如引入颜色或额外 console.log 行）
- **wave:** 4

---

## Orientation Evidence

- **provider:** direct-repo-reads
- **posture:** bounded
- **evidence_refs:**
  - `src/cli/commands/init.js`（主文件，行级定位 runInit/collectInitInput/printInitDryRun/printInitNextSteps）
  - `src/cli/prompts/index.js`（renderSelect/renderCheckbox lineCount 基准）
  - `src/cli/index.js:185-218`（printVersion 当前实现）
  - `bin/postinstall.js`（当前品牌展示）
  - `src/cli/adapters/claude.js:43-45`（stateFile 路径）
  - `src/cli/adapters/codex.js:51-53`（stateFile 路径）
  - `tests/unit/prompts.test.js`（现有测试基准）
  - `tests/unit/init-interactive.test.js`（273 行，captureInit/promptOverrides 工具函数）
- **limitations:**
  - 无 LSP；文件索引通过直接读取完成
  - graph facts stale（T004/T007 的 init.js 改动范围已通过直接读取确认足够）
  - `tests/unit/index.test.js` 未检查是否存在（T005 可能需要新建 index 单测，或仅 smoke 验证）

---

## Validation Notes

- Task pack 派生自 `docs/plans/2026-05-29-002-feat-spec-first-init-ux-brand-plan.md`
- `source_plan_hash` 由 `spec-first tasks hash` 工具计算（`sha256:0bc034f032952fc655ab3840a5130c45778a432d24be3898a57b72a8537e9aee`）
- 若 source plan 被编辑（frontmatter 外），hash 将失效，须重新运行 `spec-write-tasks` 重建本 task pack
- 任意 task 的 `stop_if` 触发时，应返回 `spec-plan` 确认范围，而不是在 task 内扩展

---

## Regeneration Rules

当以下任一情况出现时，重新运行 `spec-write-tasks`：

1. source plan 正文被修改（frontmatter 外的内容变化会导致 hash 失效）
2. 实现单元文件集变更
3. 依赖关系变更
4. 波次安排变更（如发现文件冲突）
5. task stop_if 触发，plan 返回修订后

重建命令：
```
spec-first tasks hash docs/plans/2026-05-29-002-feat-spec-first-init-ux-brand-plan.md
# 验证 hash 匹配，再使用更新后的 plan 重新生成
```
