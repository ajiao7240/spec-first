---
name: wechat-article-pipeline-skill
description: 微信公众号文章运营全流程 skill 需求——从选题到发布的 7 步串联流水线，专为 spec-first 技术公众号设计
metadata:
  type: project
---

# 微信公众号文章运营流水线 Skill 需求

**状态：** 需求已确认
**日期：** 2026-05-27
**关联文章系列：** `docs/11-文章系列/`
**关联规划：** `docs/11-文章系列/2026-05-27-004-spec-first-wechat-series-content-roadmap.md`

---

## 目标

构建一个名为 `spec-wechat-publish`（或 `wechat-article-pipeline`）的 skill，把微信公众号技术文章从选题到发布的 7 个步骤串联成一个可一键运行的流水线。

核心价值：消除每次发文时重复的工具调用、参数记忆、步骤切换负担，让作者专注于内容本身。

---

## 用户与场景

**主要用户：** spec-first 项目作者（leokuang），运营专业研发技术公众号。

**典型场景：** 已有文章大纲或草稿，希望一次性完成配图、排版、润色、发布，不需要记住每个 baoyu-skill 的参数。

**使用频率：** 每周 2-3 次（对应内容路线图的发布节奏）。

---

## 7 步流水线定义

### Step 1：选题

- 读取 `docs/11-文章系列/` 目录，扫描所有 `*-outline.md` 和已有草稿文件
- 展示未发布的候选文章列表（含编号、标题、内容类型、当前状态）
- 用户选择一篇，或传入已有文章路径直接跳过此步
- 输出：目标文章路径

### Step 2：写作（可选，按需触发）

- 如果选中的是大纲文件（`*-outline.md`），提示用户是否需要先完成写作
- 写作本身不在本 skill 范围内，但 skill 应给出明确提示：「当前文件是大纲，建议先完成正文写作后再继续」
- 用户确认正文已就绪后继续

### Step 3：封面图生成

**工具：** `baoyu-cover-image`

**固定参数（专业技术风格）：**
- `--type conceptual`（概念可视化，适合技术方法论文章；与 digital rendering 兼容矩阵 ✓✓）
- `--style blueprint`（展开为 `cool palette + digital rendering`；cool×digital = ✓✓）
- `--text title-subtitle`（标题 + 副标题；conceptual×title-subtitle = ✓）
- `--mood subtle`（对应「专业、思想领导力」信号；conceptual×subtle = ✓✓）
- `--aspect 2.35:1`（微信公众号封面实际比例 900×383px ≈ 2.35:1，非 3:2）
- `--lang zh`

**输出路径：** `docs/11-文章系列/pic/{article-slug}-cover.png`

**用户交互：** 生成后展示封面图，询问是否满意；不满意可重新生成或调整参数。

### Step 4：正文配图生成

**工具：** `baoyu-article-illustrator` + `baoyu-image-gen`

**固定 style：`blueprint`**（全系列统一，不混用 notion）

理由：spec-first 文章核心是架构/系统设计/工程方法论，blueprint style 对 framework/flowchart/infographic 三种 type 均为 ✓✓，且与封面图的 cool+digital 视觉语言一致。

**Type 按段落内容信号选择：**

| 内容信号 | Type | 兼容性 |
|---|---|---|
| 架构、层次、原则、模型、Harness 层 | `framework` | blueprint+framework = ✓✓ |
| 流程、步骤、workflow、链路 | `flowchart` | blueprint+flowchart = ✓✓ |
| 数据、对比、指标、before/after | `infographic` | blueprint+infographic = ✓✓ |
| 演进、历史、版本迭代 | `timeline` | blueprint+timeline = ✓ |

**数量：** 3-7 张，balanced density（major sections），根据文章长度自动判断

**尺寸：** 正文配图 16:9（框架图/信息图）或 4:3（流程图），宽度 900px

**输出路径：** `docs/11-文章系列/pic/{article-slug}-{n}-{type}.png`

**用户交互：** 展示配图方案（位置 + type + 描述），用户确认后批量生成。

### Step 5：图文整体排版

**工具：** `baoyu-post-to-wechat`（`md-to-wechat.ts`）

**固定主题：`simple`**（不用 grace）

理由：`simple` 主题不对称圆角、清爽留白，与 blueprint 配图的工程精准风格协调；`grace` 的文字阴影和斜体引用块视觉装饰偏重，与 blueprint 风格不搭。spec-first 文章大量使用 blockquote 和代码块，`simple` 处理更干净。

**流程：**
1. 将封面图和正文配图路径注入 markdown 文件对应位置
2. 调用 `md-to-wechat.ts` 生成 HTML 预览
3. 输出预览文件路径，供用户在浏览器中查看排版效果

**输出：** `docs/11-文章系列/{article-slug}-preview.html`

### Step 6：去 AI 痕迹 / 专业润色

**方式：** 内置 prompt，调用 Claude 内联完成

**润色目标（专业研发技术公众号风格）：**
- 去除 AI 常见句式：「首先...其次...最后...」「值得注意的是」「总的来说」「不难发现」等
- 保留技术术语和代码片段原文
- 保持作者第一人称叙事风格（参考已发布的 `01-spec-first.md` 和 `02-ai-coding-harness-publish.md`）
- 段落节奏：短句为主，避免长从句堆叠
- 不改变核心论点和结构，只调整表达方式

**输出：** 润色后的 markdown 文件，覆盖原文件或存为 `{article-slug}-polished.md`（用户选择）

### Step 7：发布

**工具：** `baoyu-post-to-wechat`（`wechat-article.ts`）

**固定参数：**
- `--author leokuang`
- `--theme simple`（与排版步骤一致）

**发布前确认清单（展示给用户，手动操作）：**
```
发布前请在微信编辑器中手动完成：
□ 上传封面图（900×383px）
□ 开启原创声明
□ 指定合集：Spec-first
□ 开启留言功能
□ 开启留言自动精选
```

**流程：**
1. 展示上述确认清单
2. 用户确认后，skill 调用 `wechat-article.ts` 将文章内容推送到微信编辑器（保存为草稿）
3. 用户在微信编辑器中完成手动设置后，自行点击发布

---

## 文件存储约定

```
docs/11-文章系列/
├── {NN}-{slug}.md              # 正文（source）
├── {NN}-{slug}-polished.md     # 润色后版本（可选）
├── {NN}-{slug}-preview.html    # 排版预览
└── pic/
    ├── {slug}-cover.png        # 封面图（900×383px）
    ├── {slug}-01-framework.png # 正文配图
    ├── {slug}-02-flowchart.png
    └── ...
```

---

## 配图风格规范（专业技术公众号）

**视觉语言统一原则：** 封面图和正文配图共用 cool/blueprint 色系，保持系列视觉一致性。

| 用途 | 尺寸 | 比例 | baoyu-skill 参数 | 兼容矩阵 |
|---|---|---|---|---|
| 封面图 | 900×383px | 2.35:1 | `--type conceptual --style blueprint --text title-subtitle --mood subtle` | conceptual×digital=✓✓, cool×digital=✓✓ |
| 正文框架图 | 900×506px | 16:9 | `--type framework --style blueprint` | framework×blueprint=✓✓ |
| 正文流程图 | 900×675px | 4:3 | `--type flowchart --style blueprint` | flowchart×blueprint=✓✓ |
| 正文信息图 | 900×506px | 16:9 | `--type infographic --style blueprint` | infographic×blueprint=✓✓ |
| 正文时间线 | 900×506px | 16:9 | `--type timeline --style blueprint` | timeline×blueprint=✓ |

**排版主题：** `simple`（`baoyu-post-to-wechat`）——现代极简，与 blueprint 工程风格协调

---

## 非目标

- 自动设置微信编辑器的原创/合集/留言（手动操作，skill 提供清单）
- 文章写作本身（选题后由用户完成，skill 仅检测状态）
- 多平台同步发布（仅微信公众号）
- 历史文章批量处理

---

## 成功标准

1. 用户从选题到草稿推送到微信编辑器，全程只需在 skill 内操作，无需记忆 baoyu-skill 参数
2. 封面图和正文配图风格统一，符合专业技术公众号视觉标准
3. 润色后文章去除明显 AI 句式，保留作者风格
4. 发布前清单清晰，用户不会遗漏原创/合集/留言设置

---

## 规划交接上下文

- **Skill 位置：** `docs/11-文章系列/.skills/spec-wechat-publish/SKILL.md`（项目本地运营 skill，不进入 `spec-first init` bundled skill 治理面）
- **依赖 skills：** `baoyu-cover-image`、`baoyu-article-illustrator`、`baoyu-image-gen`、`baoyu-post-to-wechat`
- **参考文章：** `docs/11-文章系列/01-spec-first.md`（已发布，作为润色风格参考基线）
- **内容路线图：** `docs/11-文章系列/2026-05-27-004-spec-first-wechat-series-content-roadmap.md`
- **关键约束：** 原创/合集/留言为手动操作，skill 不尝试 CDP 自动化这些设置
