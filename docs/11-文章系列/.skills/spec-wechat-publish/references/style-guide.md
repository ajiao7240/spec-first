# 配图与排版风格规范

spec-first 微信公众号系列的视觉语言规范。封面图和正文配图共用 cool/blueprint 色系，保持系列一致性。

---

## 封面图规范

**默认工具：** LLM 直接生成本地 SVG + `scripts/svg-to-png.mjs` 转 PNG。

**可选工具：** `baoyu-cover-image`。仅在用户明确要求 AI raster image 时使用。

**固定参数：**

```
--type conceptual
--style blueprint
--text title-subtitle
--mood subtle
--aspect 2.35:1
--lang zh
```

**参数说明：**

| 参数 | 值 | 理由 |
|---|---|---|
| `--type` | `conceptual` | 概念可视化，适合技术方法论文章；conceptual×digital 兼容矩阵 ✓✓ |
| `--style` | `blueprint` | 展开为 cool palette + digital rendering；cool×digital = ✓✓ |
| `--text` | `title-subtitle` | 标题 + 副标题；conceptual×title-subtitle = ✓ |
| `--mood` | `subtle` | 对应「专业、思想领导力」信号；conceptual×subtle = ✓✓ |
| `--aspect` | `2.35:1` | 微信公众号封面实际比例（900×383px ≈ 2.35:1） |
| `--lang` | `zh` | 中文标题 |

**SVG-first 输出路径约定：**

- SVG source：`docs/11-文章系列/pic/{slug}-cover.svg`
- PNG output：`docs/11-文章系列/pic/{slug}-cover.png`

**SVG viewBox：** `0 0 1200 511`（2.35:1）

**PNG 尺寸：** 2400×1022px（2x retina）或 900×383px 等比缩放版本

---

## 正文配图规范

**默认工具：** LLM 直接生成本地 SVG + `scripts/svg-to-png.mjs` 转 PNG。

**可选工具：** `baoyu-article-illustrator`（分析 + outline）+ `baoyu-image-gen`（生成）。仅在用户明确要求 AI raster image 时使用。

**固定 style：`blueprint`**（全系列统一，不混用 notion）

理由：spec-first 文章核心是架构/系统设计/工程方法论，blueprint style 对 framework/flowchart/infographic 三种 type 均为 ✓✓，且与封面图的 cool+digital 视觉语言一致。

**Type 选择规则（按段落内容信号）：**

| 内容信号 | Type | 兼容性 |
|---|---|---|
| 架构、层次、原则、模型、Harness 层、六层结构 | `framework` | blueprint+framework = ✓✓ |
| 流程、步骤、workflow、链路、pipeline | `flowchart` | blueprint+flowchart = ✓✓ |
| 数据、对比、指标、before/after、pros/cons | `infographic` | blueprint+infographic = ✓✓ |
| 演进、历史、版本迭代、时间线 | `timeline` | blueprint+timeline = ✓ |

**数量：** 3-7 张，balanced density（major sections），根据文章长度自动判断

**尺寸：**

| Type | 比例 | 尺寸 |
|---|---|---|
| framework / infographic / timeline | 16:9 | 900×506px |
| flowchart | 4:3 | 900×675px |

**输出路径约定：**

- SVG source：`docs/11-文章系列/pic/{slug}-{topic}.svg`
- PNG output：`docs/11-文章系列/pic/{slug}-{topic}.png`

---

## 排版主题规范

**工具：** `baoyu-post-to-wechat`（`md-to-wechat.ts`）

**固定主题：`tech-blog`**

主题源文件：`docs/11-文章系列/.skills/spec-wechat-publish/assets/tech-blog.css`

安装脚本：`docs/11-文章系列/.skills/spec-wechat-publish/scripts/install-tech-blog-theme.mjs`

理由：
- `tech-blog` 主题为长篇技术公众号文章设计，使用克制的章节标题、24px 段落节奏、浅蓝引用块和全宽图片
- `simple` 主题视觉更轻，但 H2/H3 装饰偏通用，不足以形成专业技术博文的结构感
- `grace` 主题有文字阴影、box-shadow、斜体引用块，视觉装饰偏重，与 blueprint 风格不搭
- spec-first 文章大量使用 blockquote、代码块、术语和工程清单，`tech-blog` 更适合稳定承载

---

## 专业技术博文版式 Gate

发布前必须满足：

- frontmatter 有 `title:`，正文不出现 H1
- 正文图片全部引用 PNG，不直接引用 SVG
- H2 使用编号章节，例如 `## 01 从 Prompt 到 Harness`
- H3 使用章节内编号，例如 `### 06.1 Context Harness：上下文要正确，不要无限`
- `tech-blog` 发布 HTML 必须包含 H2/H3 inline style；微信公众号编辑器可能剥离 CSS class，不能只依赖 `<style>` 里的主题样式
- 开头有导读或核心结论，结尾有可带走判断
- 普通段落尽量短，移动端单段不超过 3 行
- 列表只用于清单，不用手写 `•`；渲染 HTML 中 `<li>` 内容不得以 `•` 开头
- 图片前后有过渡文案，不连续堆图
- blockquote 用于关键判断，不用于堆叠长段落

验证方式：

```bash
WECHAT_SKILL_DIR="$HOME/.claude/skills/baoyu-post-to-wechat"
npx -y bun "$WECHAT_SKILL_DIR/scripts/md-to-wechat.ts" "{article_path}" --theme tech-blog
```

生成 HTML 后检查：

- `body h1` 数量为 0
- `li` 的 `textContent` 不以 `•` 开头
- `img` 占位符数量等于 markdown 正文图片数
- 首屏包含导读或核心结论
- H2/H3 章节节奏清晰，无大段连续列表

## 视觉一致性原则

1. 封面图和正文配图共用 cool/blueprint 色系（Engineering Blue #2563EB，Navy #1E3A5F，Cyan #06B6D4）
2. 正文配图全系列固定 `blueprint` style，不混用 `notion` 或其他 style
3. 封面图固定 `conceptual` type，不随文章内容变化（保持系列封面视觉统一）
4. 排版主题固定 `tech-blog`，不随文章内容变化

---

## 文件存储约定

```
docs/11-文章系列/
├── {NN}-{slug}.md              # 正文（source）
├── {NN}-{slug}-polished.md     # 润色后版本（可选）
└── pic/
    ├── {slug}-cover.svg        # 封面 SVG 源（2.35:1）
    ├── {slug}-cover.png        # 封面 PNG（由 SVG 转换）
    ├── {slug}-01-framework.png # 正文配图
    ├── {slug}-01-framework.svg # 可选 SVG 源
    ├── {slug}-02-flowchart.png
    └── ...
```

---

## SVG → PNG 转换

部分配图（特别是手绘流程图、Mermaid/PlantUML 导出）会以 SVG 格式存在。微信公众号编辑器**不接受 SVG**，必须转 PNG 才能上传。

**问题：**naive 的 SVG → PNG 转换器（如默认 rsvg、未配置的 sharp）会强制输出固定尺寸（如 2000×2000），**破坏 viewBox 比例**，导致图片被截断或拉伸。

**解决方案：** 使用 skill 自带的转换脚本，按 viewBox 等比输出：

- `scripts/svg-to-png.mjs`（推荐）：纯 Node.js，调用本机 Chrome `--headless=new`，不需要 bun 也不需要 Chrome 已运行
- `scripts/svg-to-png.ts`：复用 baoyu-post-to-wechat 已开的 CDP 连接（如果已经运行）

**用法：**

```bash
# 转换单个 SVG（推荐 .mjs，自动从 viewBox 检测尺寸，scale=2x retina）
node docs/11-文章系列/.skills/spec-wechat-publish/scripts/svg-to-png.mjs \
  docs/11-文章系列/pic/{slug}-{n}-{type}.svg

# 批量转换目录下所有 SVG
node docs/11-文章系列/.skills/spec-wechat-publish/scripts/svg-to-png.mjs \
  --batch docs/11-文章系列/pic/

# 自定义 scale（默认 2x）
node .../svg-to-png.mjs input.svg --scale 3

# 自定义背景色（默认 #FAF8F5 Blueprint Off-White）
node .../svg-to-png.mjs input.svg --bg "#ffffff"

# 备选 .ts 版（baoyu Chrome 已运行时）
npx -y bun .../svg-to-png.ts input.svg
```

**前置条件（mjs）：** 本机有 Chrome/Chromium。脚本自动查找标准位置，可用 `CHROME_BIN` 环境变量指定其他路径。

**触发时机：**
- Step 4 正文配图生成完成后，如果 `pic/` 目录里有 SVG 文件而对应 PNG 缺失或比例不对（看 `sips -g pixelWidth -g pixelHeight`），先批量转换再进入排版预览。
- 任何手动新增/修改 SVG 后。
