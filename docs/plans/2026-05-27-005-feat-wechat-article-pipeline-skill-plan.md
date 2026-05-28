---
title: "feat: 微信公众号文章运营流水线 skill (spec-wechat-publish)"
type: feat
status: completed
date: 2026-05-27
spec_id: 2026-05-27-003-wechat-article-pipeline-skill
origin: docs/brainstorms/2026-05-27-003-wechat-article-pipeline-skill-requirements.md
---

# feat: 微信公众号文章运营流水线 skill (spec-wechat-publish)

## Summary

新建 `docs/11-文章系列/.skills/spec-wechat-publish/SKILL.md`，把微信公众号技术文章从选题到发布的 7 个步骤串联成一个可一键运行的项目本地流水线 skill。skill 本身是 LLM-orchestrated prose workflow，不含脚本；它通过调用已安装的 baoyu-skills（`baoyu-cover-image`、`baoyu-article-illustrator`、`baoyu-image-gen`、`baoyu-post-to-wechat`）完成配图、排版和发布，并内置润色 prompt 和发布前手动操作清单。

---

## Problem Frame

每次发布 spec-first 系列文章时，作者需要记忆并手动调用多个 baoyu-skill 的参数组合（封面图 5 维度、正文配图 type×style、排版主题、发布参数），步骤割裂、参数易忘、风格难以保持一致。

需要一个 skill 把这些步骤和参数固化下来，让作者只需运行一个入口，全程在 skill 内完成操作，无需记忆底层参数。

---

## Requirements

- R1. skill 支持全流程一键运行：选题 → 写作检测 → 封面图 → 正文配图 → 排版预览 → 润色 → 发布
- R2. 选题步骤扫描 `docs/11-文章系列/` 目录，列出候选文章（大纲/草稿），用户选择后继续；也支持直接传入文章路径跳过选题
- R3. 封面图固定参数：`--type conceptual --style blueprint --text title-subtitle --mood subtle --aspect 2.35:1 --lang zh`，输出到 `docs/11-文章系列/pic/{slug}-cover.png`
- R4. 正文配图固定 style `blueprint`，type 按段落内容信号自动选（framework/flowchart/infographic/timeline），数量 3-7 张，输出到 `docs/11-文章系列/pic/{slug}-{n}-{type}.png`
- R5. 排版固定主题 `simple`（`baoyu-post-to-wechat`），生成 HTML 预览供用户确认
- R6. 润色步骤内置 prompt，去除 AI 常见句式，保持作者第一人称短句风格，不改变论点和结构
- R7. 发布步骤固定参数 `--author leokuang --theme simple`，发布前展示手动操作清单（原创/合集/留言），用户确认后推送草稿到微信编辑器
- R8. 封面图和正文配图视觉语言统一：共用 cool/blueprint 色系，保持系列一致性
- R9. skill 包含 `references/style-guide.md`，固化配图风格规范和润色规则，供 skill 执行时引用
- R10. skill 包含 `references/polish-prompt.md`，固化润色 prompt 模板

---

## Scope Boundaries

- 不自动设置微信编辑器的原创/合集/留言（手动操作，skill 提供清单）
- 不包含文章写作本身（skill 仅检测文件是否为大纲，提示用户先完成写作）
- 不支持多平台同步发布（仅微信公众号）
- 不支持历史文章批量处理
- 不修改任何 baoyu-skill 源码，只调用其公开接口

---

## Key Technical Decisions

**决策 1：skill 结构**

`spec-wechat-publish` 是纯 LLM-orchestrated prose skill，不含可执行脚本。它是 `docs/11-文章系列/` 下的项目本地运营资产，不属于 `spec-first init` 会分发的 bundled skill。skill 通过 Bash 工具调用 baoyu-skill 的 CLI 脚本，通过 `AskUserQuestion` 工具与用户交互。

理由：baoyu-skills 已有完整的 CLI 脚本层，无需重复封装；skill prose 负责参数固化、步骤编排和用户交互。

**决策 2：配图风格固化方式**

封面图和正文配图的风格参数写入 `references/style-guide.md`，skill 主体在执行时引用该文件，而不是把参数硬编码在 SKILL.md 正文里。

理由：风格参数可能随系列演进调整，放在 references 里便于单独更新，不影响 skill 主体逻辑。

**决策 3：润色 prompt 位置**

润色 prompt 模板放在 `references/polish-prompt.md`，skill 执行润色步骤时读取并注入文章内容。

理由：润色规则需要随作者风格迭代，独立文件便于调整；同时避免 SKILL.md 主体过长。

**决策 4：baoyu-skill 调用方式**

skill 通过 `SKILL_DIR` 变量定位 baoyu-skill 的脚本路径（`~/.claude/skills/{skill-name}/`），用 `npx -y bun` 执行。执行前先检查 baoyu-skill 是否已安装。

**决策 5：步骤间中断/恢复**

skill 在每个主要步骤完成后展示进度摘要，用户可以在任意步骤后停止并在下次继续（通过传入文章路径跳过选题，跳过已完成的步骤）。不实现自动状态持久化，依赖用户判断。

---

## Implementation Units

### U1. 创建 skill 目录结构

**Goal:** 建立 `docs/11-文章系列/.skills/spec-wechat-publish/` 目录和文件骨架

**Requirements:** R1

**Dependencies:** None

**Files:**
- Create: `docs/11-文章系列/.skills/spec-wechat-publish/SKILL.md`
- Create: `docs/11-文章系列/.skills/spec-wechat-publish/references/style-guide.md`
- Create: `docs/11-文章系列/.skills/spec-wechat-publish/references/polish-prompt.md`

**Approach:**
- 目录结构保留标准 skill 形状（SKILL.md + references/），但放在文章系列目录下，避免进入 bundled skill 扫描范围
- 不需要 evals/ 目录（非核心 workflow skill）

**Test scenarios:**
- Happy path: 目录和文件均存在，SKILL.md 有正确 frontmatter

**Verification:**
- `ls docs/11-文章系列/.skills/spec-wechat-publish/` 显示 SKILL.md 和 references/ 目录

---

### U2. 写 `references/style-guide.md`

**Goal:** 固化封面图和正文配图的完整风格规范，供 skill 执行时引用

**Requirements:** R3, R4, R8

**Dependencies:** U1

**Files:**
- Create: `docs/11-文章系列/.skills/spec-wechat-publish/references/style-guide.md`

**Approach:**

文件内容包含：

1. **封面图规范**
   - 工具：`baoyu-cover-image`
   - 固定参数：`--type conceptual --style blueprint --text title-subtitle --mood subtle --aspect 2.35:1 --lang zh`
   - 尺寸：900×383px（2.35:1）
   - 输出路径约定：`docs/11-文章系列/pic/{slug}-cover.png`
   - 兼容矩阵依据：conceptual×digital=✓✓, cool×digital=✓✓, conceptual×subtle=✓✓

2. **正文配图规范**
   - 工具：`baoyu-article-illustrator` + `baoyu-image-gen`
   - 固定 style：`blueprint`（全系列统一）
   - Type 选择规则表（内容信号 → type → 兼容性）
   - 尺寸：16:9（框架图/信息图）或 4:3（流程图），宽度 900px
   - 数量：3-7 张，balanced density
   - 输出路径约定：`docs/11-文章系列/pic/{slug}-{n}-{type}.png`

3. **排版主题规范**
   - 工具：`baoyu-post-to-wechat`
   - 固定主题：`simple`
   - 选择理由：与 blueprint 工程风格协调，blockquote/代码块处理干净

4. **视觉一致性原则**
   - 封面图和正文配图共用 cool/blueprint 色系
   - 不混用 notion style

**Test scenarios:**
- 文件存在且包含封面图、正文配图、排版主题三个规范章节

**Verification:**
- 读取文件，确认三个规范章节均存在且参数完整

---

### U3. 写 `references/polish-prompt.md`

**Goal:** 固化润色 prompt 模板，去除 AI 痕迹，保持作者风格

**Requirements:** R6

**Dependencies:** U1

**Files:**
- Create: `docs/11-文章系列/.skills/spec-wechat-publish/references/polish-prompt.md`

**Approach:**

文件内容包含：

1. **润色目标**（专业研发技术公众号风格）
   - 去除 AI 常见句式黑名单：「首先...其次...最后...」「值得注意的是」「总的来说」「不难发现」「在此基础上」「综上所述」「需要指出的是」「毋庸置疑」
   - 去除过度礼貌/客套表达
   - 去除无实质内容的过渡句

2. **保留规则**
   - 技术术语和代码片段原文不改
   - 作者第一人称叙事风格（参考基线：`docs/11-文章系列/01-spec-first.md`）
   - 核心论点和文章结构不变
   - 已有的引用块（blockquote）格式不变

3. **风格要求**
   - 段落节奏：短句为主，避免长从句堆叠
   - 每段不超过 4 句
   - 用词直接，不用「可以」「应该」「需要」等模糊助动词堆叠

4. **prompt 模板**（供 skill 执行时填入文章内容）

```
你是一位专业的技术公众号编辑。请对以下文章进行润色，目标是去除 AI 生成痕迹，保持作者的真实写作风格。

润色规则：
[规则列表]

参考风格基线：作者惯用短句、第一人称、直接陈述，不用「首先其次最后」结构，不用「值得注意的是」等过渡语。

请直接输出润色后的完整文章，不要解释修改原因。

---

[文章内容]
```

**Test scenarios:**
- 文件存在且包含 prompt 模板
- prompt 模板包含规则列表占位和文章内容占位

**Verification:**
- 读取文件，确认 prompt 模板结构完整

---

### U4. 写 `docs/11-文章系列/.skills/spec-wechat-publish/SKILL.md` 主体

**Goal:** 实现完整的 7 步流水线 skill，包含所有步骤的执行逻辑、用户交互和错误处理

**Requirements:** R1–R10

**Dependencies:** U1, U2, U3

**Files:**
- Create: `docs/11-文章系列/.skills/spec-wechat-publish/SKILL.md`

**Approach:**

SKILL.md 结构：

```
---
name: spec-wechat-publish
description: ...
argument-hint: "[可选：文章路径，留空则进入选题步骤]"
---

# 微信公众号文章发布流水线

## Workflow Contract Summary
## Prerequisites（依赖 skill 检查）
## Progress Checklist
## Step 1: 选题
## Step 2: 写作检测
## Step 3: 封面图生成
## Step 4: 正文配图生成
## Step 5: 排版预览
## Step 6: 润色
## Step 7: 发布
## References
```

各步骤关键设计：

**Step 1 选题：**
- 用 Bash 扫描 `docs/11-文章系列/` 目录
- 区分状态：`*-outline.md`（大纲）、`*-publish.md` 或无后缀（草稿/正文）、已发布（通过文件名前缀判断）
- 用 `AskUserQuestion` 展示候选列表，用户选择
- 若传入参数则跳过此步

**Step 2 写作检测：**
- 检查选中文件是否为 `*-outline.md`
- 若是，提示「当前文件是大纲，建议先完成正文写作」，用 `AskUserQuestion` 确认是否继续

**Step 3 封面图：**
- 读取 `references/style-guide.md` 获取固定参数
- 确定 `SKILL_DIR`（`~/.claude/skills/baoyu-cover-image/`）
- 调用：`npx -y bun ${COVER_SKILL_DIR}/scripts/main.ts` 或通过 `/baoyu-cover-image` skill 调用
- 实际调用方式：通过 Skill 工具调用 `baoyu-cover-image`，传入文章路径和固定参数
- 生成后展示结果，询问是否满意

**Step 4 正文配图：**
- 通过 Skill 工具调用 `baoyu-article-illustrator`，传入文章路径和固定 style `blueprint`
- illustrator 会自动分析内容、选择 type、生成 outline，用户确认后批量生成

**Step 5 排版预览：**
- 确认配图已注入 markdown（illustrator 完成后自动注入）
- 确定 `SKILL_DIR`（`~/.claude/skills/baoyu-post-to-wechat/`）
- 调用：`npx -y bun ${WECHAT_SKILL_DIR}/scripts/md-to-wechat.ts {article_path} --theme simple`
- 输出预览 HTML 路径，提示用户在浏览器中查看

**Step 6 润色：**
- 读取 `references/polish-prompt.md` 获取 prompt 模板
- 读取文章内容，填入 prompt 模板
- Claude 内联执行润色
- 用 `AskUserQuestion` 询问：覆盖原文件 / 存为 `{slug}-polished.md` / 跳过
- 写入用户选择的路径

**Step 7 发布：**
- 展示手动操作清单（原创/合集/留言精选）
- 用 `AskUserQuestion` 确认用户已准备好
- 确定润色后文章路径（polished 版本优先）
- 调用：`npx -y bun ${WECHAT_SKILL_DIR}/scripts/wechat-article.ts --markdown {article_path} --author leokuang --theme simple`
- 报告草稿已推送，提示用户在微信编辑器中完成手动设置后发布

**Prerequisites 检查：**
- 检查 `~/.claude/skills/baoyu-cover-image/` 是否存在
- 检查 `~/.claude/skills/baoyu-article-illustrator/` 是否存在
- 检查 `~/.claude/skills/baoyu-post-to-wechat/` 是否存在
- 任一缺失则提示安装路径并停止

**Patterns to follow:**
- `skills/spec-brainstorm/SKILL.md`：Progress Checklist 格式、AskUserQuestion 使用方式
- `~/.claude/skills/baoyu-cover-image/SKILL.md`：Step 0 preferences 检查模式
- `~/.claude/skills/baoyu-post-to-wechat/SKILL.md`：wechat-article.ts 调用方式

**Test scenarios:**
- Happy path: 传入已有正文文章路径，7 步全部完成，草稿推送到微信编辑器
- Edge case: 传入大纲文件，Step 2 提示写作检测，用户确认继续
- Edge case: 用户在 Step 3 对封面图不满意，重新生成
- Edge case: baoyu-cover-image 未安装，Prerequisites 检查失败并给出安装提示
- Edge case: 用户在 Step 6 选择跳过润色，直接进入 Step 7

**Verification:**
- SKILL.md 包含 7 个步骤章节
- 每个步骤有明确的输入、执行逻辑、输出和用户交互说明
- Prerequisites 检查章节存在
- References 章节指向 style-guide.md 和 polish-prompt.md

---

### U5. 更新 CHANGELOG.md

**Goal:** 按仓库格式记录项目本地运营 skill 的添加

**Requirements:** 仓库 CHANGELOG 规范

**Dependencies:** U4

**Files:**
- Modify: `CHANGELOG.md`

**Approach:**
- 在 CHANGELOG.md 顶部追加一条记录
- 格式：`- v1.8.2 2026-05-27 HH:MM:SS leokuang: feat(article-skill): 新增项目本地 spec-wechat-publish 微信公众号文章运营流水线 skill，7 步串联选题/封面图/正文配图/排版/润色/发布，固化 blueprint 风格规范和润色 prompt (user-visible)`

**Test scenarios:**
- CHANGELOG.md 顶部有新记录，格式符合仓库规范

**Verification:**
- `head -3 CHANGELOG.md` 显示新记录

---

## System-Wide Impact

- **Interaction graph:** 新 skill 不修改任何现有 skill 或 CLI；它调用 baoyu-skills 的公开 CLI 接口，不影响 spec-first 核心 workflow
- **Error propagation:** baoyu-skill 调用失败时，skill 应捕获错误并提示用户，不中断整个流水线（允许跳过失败步骤）
- **State lifecycle risks:** skill 不持久化状态；润色后文件写入是唯一的持久化操作，用户选择路径后执行
- **API surface parity:** 不影响现有 CLI 命令或 skill 入口
- **Integration coverage:** 依赖 baoyu-skills 已安装且可用；skill 在 Prerequisites 步骤检查依赖
- **Unchanged invariants:** 现有 spec-first workflow（spec-plan、spec-work、spec-code-review 等）不受影响；`docs/11-文章系列/` 目录结构不变

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| baoyu-cover-image 的 `--aspect 2.35:1` 参数实际生成尺寸与微信封面 900×383px 有偏差 | skill 在 Step 3 完成后提示用户确认封面图尺寸，不满意可重新生成 |
| baoyu-article-illustrator 自动选择的 type 与文章内容不匹配 | Step 4 展示 outline 方案，用户确认后才批量生成 |
| wechat-article.ts 的 `--author` 参数在微信编辑器中显示效果未验证 | 发布后用户可在微信编辑器中手动修改作者名 |
| baoyu-skills 版本更新导致 CLI 参数变化 | skill 在 Prerequisites 检查时验证关键脚本存在；参数变化时更新 style-guide.md |
| 润色 prompt 效果不稳定（AI 输出不确定性） | Step 6 用户可选择跳过润色或选择存为新文件而非覆盖原文件 |

---

## Documentation / Operational Notes

- 新 skill 不需要更新 README（非用户可见的 CLI 命令，是 skill workflow）
- 不需要更新 `AGENTS.md`（非 agent profile）
- 不需要 runtime generation（`spec-first init` 不需要处理此 skill）
- 不影响双宿主（Claude Code / Codex）的 runtime assets

---

## Sources & References

- **Origin document:** `docs/brainstorms/2026-05-27-003-wechat-article-pipeline-skill-requirements.md`
- baoyu-cover-image SKILL.md: `~/.claude/skills/baoyu-cover-image/SKILL.md`
- baoyu-article-illustrator SKILL.md: `~/.claude/skills/baoyu-article-illustrator/SKILL.md`
- baoyu-post-to-wechat SKILL.md: `~/.claude/skills/baoyu-post-to-wechat/SKILL.md`
- 参考 skill 结构: `skills/spec-brainstorm/SKILL.md`
- 文章系列目录: `docs/11-文章系列/`
- 内容路线图: `docs/11-文章系列/2026-05-27-004-spec-first-wechat-series-content-roadmap.md`
