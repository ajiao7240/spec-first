---
name: spec-wechat-publish
description: "（项目专属）微信公众号文章运营全流程流水线。从选题到发布串联：选题 → 写作检测 → 封面图 → 正文配图 → SVG 转换 → 图片完整性 → frontmatter/标题格式检查 → 排版预览 → 润色 → 推送。固化 spec-first 系列的 blueprint 风格规范，无需记忆 baoyu-skill 参数。非公开 spec-first workflow 入口，不通过 using-spec-first 路由推荐。Use when user says \"发布公众号文章\"、\"发文\"、\"wechat publish\"、\"走发布流程\"."
argument-hint: "[可选：文章路径，如 docs/11-文章系列/02-ai-coding-harness.md。留空则进入选题步骤]"
---

# 微信公众号文章发布流水线

spec-first 系列文章从选题到发布的项目本地流水线 skill。固化 blueprint 风格规范，无需记忆 baoyu-skill 参数。

**SKILL_DIR 约定：** 执行本 skill 时，`SKILL_DIR` 指本 SKILL.md 所在目录（`docs/11-文章系列/.skills/spec-wechat-publish/`）。

---

## Workflow Contract Summary

**When to use:** 用户想发布一篇微信公众号文章，已有文章草稿或大纲。

**When not to use:** 文章还没有任何内容（连大纲都没有）；多平台批量发布；非微信公众号平台。

**Inputs:** 可选文章路径（留空则进入选题）；`docs/11-文章系列/` 目录下的文章文件。

**Outputs:** 封面图、正文配图（含 SVG→PNG 转换）、HTML 预览、润色后文章、微信编辑器草稿。

**Dependencies:**
- 必需 skill：`baoyu-post-to-wechat`（需安装在 `~/.claude/skills/`）
- 必需运行时：本机 Chrome（SVG→PNG 用 headless；微信推送和封面上传用 CDP）
- 可选 skill：`baoyu-cover-image`、`baoyu-article-illustrator`、`baoyu-image-gen`（仅在用户明确要求 AI raster image 时需要）
- 图片策略：默认由 LLM 直接生成本地 SVG，再用 `scripts/svg-to-png.mjs` 转 PNG；不因图片 API key 缺失阻塞发布流程。

---

## Prerequisites 检查

**在任何步骤开始前，先执行以下检查：**

```bash
MISSING=()

# 1. baoyu-post-to-wechat 安装（必需）
# 注意：~/.claude/skills/baoyu-* 可能是指向 ~/.agents/skills/ 的 symlink。
# test -d 对断链 symlink 返回 false，需要同时检查 symlink 目标是否存在。
BAOYU_PATH="$HOME/.claude/skills/baoyu-post-to-wechat"
if [ -d "$BAOYU_PATH" ]; then
  echo "✓ baoyu-post-to-wechat"
elif [ -L "$BAOYU_PATH" ]; then
  TARGET=$(readlink "$BAOYU_PATH")
  echo "✗ baoyu-post-to-wechat symlink 断链 → $TARGET 不存在"
  echo "  修复：检查 ~/.agents/skills/ 是否有 baoyu-post-to-wechat，若在 disabled 目录则 mv 回来"
  MISSING+=("baoyu-post-to-wechat(broken-symlink)")
else
  echo "✗ baoyu-post-to-wechat 未安装"
  MISSING+=("baoyu-post-to-wechat")
fi

# 2. 本地 SVG 转 PNG 脚本（必需）
test -f "docs/11-文章系列/.skills/spec-wechat-publish/scripts/svg-to-png.mjs" \
  && echo "✓ svg-to-png.mjs" \
  || { echo "✗ svg-to-png.mjs 缺失"; MISSING+=("svg-to-png.mjs"); }

# 3. 微信封面上传脚本（必需）
test -f "docs/11-文章系列/.skills/spec-wechat-publish/scripts/upload-wechat-cover.ts" \
  && echo "✓ upload-wechat-cover.ts" \
  || { echo "✗ upload-wechat-cover.ts 缺失"; MISSING+=("upload-wechat-cover.ts"); }

# 4. tech-blog 微信技术博文主题（必需，脚本可自动安装到 baoyu runtime）
node docs/11-文章系列/.skills/spec-wechat-publish/scripts/install-tech-blog-theme.mjs \
  --skill-dir "$HOME/.claude/skills/baoyu-post-to-wechat" \
  && echo "✓ tech-blog theme" \
  || { echo "✗ tech-blog theme 安装/校验失败"; MISSING+=("tech-blog theme"); }

# 5. AI 图片 skill（可选）
for s in baoyu-cover-image baoyu-article-illustrator baoyu-image-gen; do
  if [[ -d "$HOME/.claude/skills/$s" ]]; then
    echo "✓ $s（可选）"
  else
    echo "⚠ $s 未安装（仅 AI 图片生成需要）"
  fi
done

# 6. API key（可选，仅 AI 图片生成需要）
if [[ -f "$HOME/.baoyu-skills/.env" ]] && grep -qE "^[A-Z_]*API_KEY=[^# ]" "$HOME/.baoyu-skills/.env"; then
  echo "✓ API key 已配置"
else
  echo "⚠ API key 未配置（仅 AI 图片生成需要，默认 SVG-first 流程不需要）"
fi

# Fail fast: 任一必需 skill 缺失立即停止
if [[ ${#MISSING[@]} -gt 0 ]]; then
  echo ""
  echo "✗ 缺少必需依赖: ${MISSING[*]}"
  echo "安装方式：baoyu-post-to-wechat 参考 https://github.com/JimLiu/baoyu-skills"
  echo "断链修复：ls ~/.agents/skills-disabled-*/ 查找 baoyu-* 目录，mv 回 ~/.agents/skills/"
  exit 1
fi
```

**如果上述命令以非 0 退出码结束，立即停止整个 skill 执行**，告诉用户缺少哪些 skill 并给出安装链接。**不要继续后续步骤。**

AI 图片 skill 和 API key 缺失不阻塞默认 SVG-first 流程；只有用户明确要求 AI raster image 时才阻塞。

---

## Progress Checklist

每次运行时复制此清单跟踪进度：

```
发布进度：
- [ ] Prerequisites 检查（含 symlink 断链诊断）
- [ ] Step 1: 选题（或跳过，已有文章路径）
- [ ] Step 2: 写作检测
- [ ] Step 3: 封面图生成
- [ ] Step 4: 正文配图生成
- [ ] Step 4.5: SVG → PNG 转换（如有 SVG 源图）
- [ ] Step 4.6: 图片完整性检查
- [ ] Step 4.7: frontmatter / H1 / 标题格式检查 ⚠️ 关键（Spec-First：xxxx）
- [ ] Step 5: 排版预览
- [ ] Step 5.5: 专业技术博文版式 gate
- [ ] Step 6: 润色（可跳过）
- [ ] Step 6.5: frontmatter 回查（润色后可选）
- [ ] Step 7: Chrome 状态预检查 → 推送草稿 → 自动上传封面
- [ ] Step 7 验证: visible_title / body_h2 / real_images / cover_ok 全部通过
```

**注意：**
- frontmatter 检查（Step 4.7）放在排版预览**之前**，确保预览看到的是发布版本的标题结构。
- 标题必须以 `Spec-First：`（全角冒号）开头，这是系列品牌一致性要求。
- **正文字数不少于 1.5 万字（按去除空白后的正文字符数统计），正文配图 6-10 张**（不含封面）。
- Step 7 推送前必须运行 Chrome 状态预检查，确保微信 tab 在首页，否则会报 `New tab not found`。
- 润色（Step 6）之后如果文件 frontmatter 被改动，回到 Step 6.5 重新检查。

---

## Step 1: 选题

**触发条件：** 未传入文章路径参数时执行。若已传入路径，跳过此步直接进入 Step 2。

**执行：**

```bash
ls docs/11-文章系列/*.md 2>/dev/null | sort
```

按以下规则分类：

| 文件名模式 | 状态 |
|---|---|
| `*-outline.md` | 大纲（未写正文） |
| `*-publish.md` | 草稿（可发布版本） |
| `*-polished.md` | 已润色版本 |
| 其他 `*.md`（非 outline/requirements/roadmap） | 正文草稿 |
| `requirements.md`、`roadmap.md`、`ideation.md` | 规划文档（跳过） |

**已发布检测（可选）：** spec-first 没有内置「已发布」标记，但可以从 `CHANGELOG.md` 推断——如果 `git log` 或 CHANGELOG 有 "发布第 NN 篇" 类记录，可以软提示用户。**默认不阻止重发**（用户可能就是要更新已发文章）。

```bash
# 软检测：在 CHANGELOG 里搜文章 slug 是否被提到「发布」
grep -E "发布.*${SLUG}|publish.*${SLUG}" CHANGELOG.md 2>/dev/null | head -3
```

**优先级：** 同一前缀（如 `02-`）有多个文件时，优先推荐 `polished` > `publish` > 草稿。

**列表展示要求：**
- 包含每个候选的：文件路径、文章标题（从 frontmatter 或 H1 提取）、状态标签
- 用 `AskUserQuestion` 让用户选择，提供「输入自定义路径」选项

**确认后输出：** 设置 `article_path={selected_path}`，进入 Step 2。

---

## Step 2: 写作检测

```bash
echo "{article_path}" | grep -q "\-outline" && echo "outline" || echo "draft"
```

**若是大纲文件：** 用 `AskUserQuestion` 提示先完成正文写作，或选择继续用大纲。

**若是正文文件：** 直接进入 Step 2.5。

---

## Step 2.5: 需求模式识别（写需求类文章时）

**触发条件：** 文章主题涉及需求工具（brainstorm / spec-prd / ideate）时执行此步骤，帮助作者明确文章的目标读者和需求场景定位。

spec-first 的需求工具按产品阶段分三种模式：

| 模式 | 场景 | 推荐工具 | 文章定位 |
|---|---|---|---|
| **0-1** | 全新产品/功能，方向未定，需要探索 | `spec-ideate` → `spec-brainstorm` | 讲"如何把模糊想法变成可执行需求" |
| **1-10** | 已有产品，增量功能，需求较清晰 | `spec-brainstorm` 或 `spec-prd` | 讲"如何快速收敛需求边界" |
| **10-100** | 存量系统，增量需求，需要 PRD 级文档 | `spec-prd`（brownfield increment） | 讲"如何在已有系统上写清楚 WHAT/WHY" |

**写作时的区分原则：**
- brainstorm 文章：强调"意图显式化"，适合 0-1 场景，核心是把模糊变清晰
- spec-prd 文章：强调"current-state evidence + change delta"，适合 1-10/10-100 场景，核心是让 plan 不用猜 WHAT
- 两篇文章都要说清楚：什么时候用这个工具，什么时候用另一个

---

## Step 3: 封面图生成（SVG-first）

**读取风格规范：** 参见 `references/style-guide.md` 封面图规范章节。

**默认策略：** 先生成或维护本地 SVG，再转 PNG。不要因为 API key 缺失而阻塞封面图。只有用户明确要求 AI raster image 时，才调用 `baoyu-cover-image`。

**执行：**

先检查 `pic/` 目录是否已有封面图：

```bash
test -f "docs/11-文章系列/pic/{slug}-cover.png" && echo "已存在" || echo "需生成"
```

若已存在，用 `AskUserQuestion` 询问：使用已有 / 重新生成本地 SVG / 调用 AI 生成。

若需重新生成本地 SVG：

1. 读取文章标题、description 或第一段核心论点
2. 生成 `docs/11-文章系列/pic/{slug}-cover.svg`
3. SVG 必须满足：
   - `viewBox="0 0 1200 511"`，比例接近 2.35:1
   - 使用 blueprint/cool 色系
   - 标题文字可读，不依赖外部字体或外链资源
   - 不使用 `foreignObject`
4. 立即转 PNG：

```bash
node docs/11-文章系列/.skills/spec-wechat-publish/scripts/svg-to-png.mjs \
  docs/11-文章系列/pic/{slug}-cover.svg \
  --out docs/11-文章系列/pic/{slug}-cover.png \
  --scale 2
```

若用户明确选择 AI 生成，再通过 Skill 工具调用 `baoyu-cover-image`，传入文章路径和固定参数：

```
调用 baoyu-cover-image：
  文章路径：{article_path}
  参数：--type conceptual --style blueprint --text title-subtitle --mood subtle --aspect 2.35:1 --lang zh --quick
```

`--quick` 跳过 baoyu-cover-image 的交互确认，直接用固定参数生成。

**输出：** `docs/11-文章系列/pic/{slug}-cover.png`（900×383px）

---

## Step 4: 正文配图生成

**读取风格规范：** 参见 `references/style-guide.md` 正文配图规范章节。

**固定 style：`blueprint`**（全系列统一）

**执行：**

先检查 `pic/` 目录是否已有该篇配图，并对比 markdown 中的引用数量：

```bash
SLUG="{slug}"
PIC_DIR="docs/11-文章系列/pic"
ARTICLE="{article_path}"

# 1. 数 markdown 里引用了多少张正文图片（不含封面）
REFERENCED_IMAGES=$(grep -oE '!\[[^]]*\]\([^)]*\.(png|svg|jpg)\)' "$ARTICLE" | grep -v cover | wc -l | tr -d ' ')

# 2. 数 pic/ 里实际有多少张该篇配图（不含封面）
EXISTING_IMAGES=$(ls "$PIC_DIR"/${SLUG}-*.{png,svg} 2>/dev/null | grep -v cover | wc -l | tr -d ' ')

echo "Referenced in markdown: $REFERENCED_IMAGES"
echo "Existing in pic/: $EXISTING_IMAGES"
```

**判断逻辑：**

| Referenced | Existing | 处理 |
|---|---|---|
| 0 | 0 | 默认由 LLM 直接生成本地 SVG；用户明确要求 AI 图片时才调用 `baoyu-article-illustrator` |
| 0 | >0 | markdown 没引用图片但 pic 有 → 用 `AskUserQuestion`：手动注入 PNG 引用 / 跳过 / 重新生成 SVG |
| >0 | < Referenced | 部分缺失 → 用 `AskUserQuestion`：补齐 SVG+PNG / 重新全部生成 SVG / 跳过 |
| >0 | ≥ Referenced | 配图齐全 → 跳到 Step 4.5 |

**默认本地 SVG 生成：**

1. **先确认文章字数是否达到 1.5 万字**（按去除空白后的正文字符数统计）；不足时先扩写，再生成配图
2. 按文章结构选择 **6-10 个关键位置**（每个 H2 章节至少考虑一张图）
3. 每张图先写为 `docs/11-文章系列/pic/{slug}-{topic}.svg`
4. SVG 必须满足：
   - framework/infographic/timeline 默认 `viewBox="0 0 1200 675"`
   - flowchart 默认 `viewBox="0 0 1200 900"`
   - 使用 blueprint/cool 色系，少文字、强结构
   - 不使用外链资源，不使用 `foreignObject`
5. markdown 中引用同名 `.png`，不是 `.svg`
6. 进入 Step 4.5 批量转 PNG

**可选 AI 生成：** 仅当用户明确要求 AI raster image 时，通过 Skill 工具调用 `baoyu-article-illustrator` 并传入 `--style blueprint`，它会自动：
1. 分析文章内容，识别需要配图的位置
2. 按内容信号选择 type（framework/flowchart/infographic/timeline）
3. 生成配图 outline，等待用户确认
4. 批量生成图片，注入 markdown 文件

**输出：** `docs/11-文章系列/pic/{slug}-{topic}.svg` + `.png`，并更新 `{article_path}` 中的 PNG 图片引用。

---

## Step 4.5: SVG → PNG 转换

**触发条件：** `pic/` 目录里有 SVG 文件（如手绘流程图、Mermaid/PlantUML 导出）。

**为什么需要：** 微信公众号编辑器**不接受 SVG**，必须转 PNG。常见 SVG→PNG 工具会强制变正方形（如 2000×2000），破坏 viewBox 比例。

**两个脚本可选：**

| 脚本 | 运行时 | 前置条件 | 优势 |
|---|---|---|---|
| `scripts/svg-to-png.mjs`（推荐） | Node.js | 本机有 Chrome/Chromium | 完全独立，不依赖 Chrome 已运行，不依赖 bun |
| `scripts/svg-to-png.ts` | bun | Chrome 必须已 `--remote-debugging-port` 运行 | 复用 baoyu 已开的 Chrome session，速度更快 |

**推荐用法（mjs 版，最稳）：**

```bash
# 单个文件（自动从 viewBox 检测尺寸，scale=2x retina）
node docs/11-文章系列/.skills/spec-wechat-publish/scripts/svg-to-png.mjs \
  docs/11-文章系列/pic/{slug}-01-framework.svg

# 批量
node docs/11-文章系列/.skills/spec-wechat-publish/scripts/svg-to-png.mjs \
  --batch docs/11-文章系列/pic/

# 自定义 scale
node .../svg-to-png.mjs input.svg --scale 3

# 自定义背景色（默认 #FAF8F5 Blueprint Off-White）
node .../svg-to-png.mjs input.svg --bg "#ffffff"
```

**Chrome 路径：** `.mjs` 默认查找 `/Applications/Google Chrome.app/...` 或 `/usr/bin/google-chrome`。其他位置用 `CHROME_BIN` 环境变量指定：

```bash
CHROME_BIN=/path/to/chrome node .../svg-to-png.mjs input.svg
```

**ts 版用法（baoyu Chrome 已运行时）：**

```bash
npx -y bun docs/11-文章系列/.skills/spec-wechat-publish/scripts/svg-to-png.ts \
  --batch docs/11-文章系列/pic/
```

---

## Step 4.6: 图片完整性检查

**目的：** 确认所有图片尺寸/比例正确，避免微信编辑器里图片被截断。

**执行：**

```bash
echo "=== 封面图 ==="
sips -g pixelWidth -g pixelHeight docs/11-文章系列/pic/{slug}-cover.png 2>/dev/null
echo "  期望：宽:高 ≈ 2.35:1（如 900×383 或 1800×766）"
echo ""
echo "=== 正文配图 ==="
for f in docs/11-文章系列/pic/{slug}-*.png; do
  [[ "$f" == *"-cover.png" ]] && continue
  sips -g pixelWidth -g pixelHeight "$f" 2>/dev/null | head -3
done
echo "  期望：宽:高 ∈ {16:9, 4:3, 与对应 SVG viewBox 一致}"
```

**检查规则：**
- 封面图：宽:高 应接近 2.35:1（900×383px 等比缩放）
- 正文图：与 SVG viewBox 比例一致；如果是直接 AI 生成的 PNG，应是 16:9 或 4:3
- 任何 PNG 是正方形（1:1）但对应 SVG 不是 → 转换被破坏，回 Step 4.5 用 svg-to-png.ts 重转

---

## Step 4.7: frontmatter / H1 一致性检查 ⚠️ 关键

**为什么需要：** `wechat-article.ts` 从 frontmatter `title` 字段或正文 H1 提取标题，但**不会从 body 删除 H1**。如果 markdown 同时有 H1 标题和 frontmatter `title:`，H1 内容会同时出现在编辑器标题栏和正文里（重复显示）。

**目标状态（推荐方案 A）：**

```yaml
---
title: Spec-First：什么是 AI Coding Harness
description: ...
---

**副标题或引子直接作为正文开头**
```

要点：
- frontmatter 有 `title:` 字段（提供给 wechat-article.ts 提取）
- 正文**不要 H1**（避免重复）
- 副标题用粗体 `**...**`（不是 H1）
- **标题格式必须是 `Spec-First：xxxx`（全角冒号）**，这是系列品牌一致性要求

**自动检查脚本：**

```bash
ARTICLE="{article_path}"

HAS_FRONTMATTER=$(awk 'NR==1 && /^---$/{found=1} END{print found?"yes":"no"}' "$ARTICLE")
HAS_FRONTMATTER_TITLE="no"
HAS_BODY_H1="no"
TITLE_FORMAT_OK="no"

if [[ "$HAS_FRONTMATTER" == "yes" ]]; then
  HAS_FRONTMATTER_TITLE=$(awk '
    /^---$/{n++; next}
    n==1 && /^title:[[:space:]]/{print "yes"; exit}
  ' "$ARTICLE")
  HAS_FRONTMATTER_TITLE=${HAS_FRONTMATTER_TITLE:-no}
  HAS_BODY_H1=$(awk '
    /^---$/{n++; next}
    n>=2 && /^# [^#]/{print "yes"; exit}
  ' "$ARTICLE")
  HAS_BODY_H1=${HAS_BODY_H1:-no}
  # 检查标题是否以 Spec-First： 开头（全角冒号）
  TITLE_VAL=$(awk '/^---$/{n++; next} n==1 && /^title:/{sub(/^title:[[:space:]]*/,""); print; exit}' "$ARTICLE")
  [[ "$TITLE_VAL" == Spec-First：* ]] && TITLE_FORMAT_OK="yes" || TITLE_FORMAT_OK="no"
else
  HAS_BODY_H1=$(grep -m1 -E '^# [^#]' "$ARTICLE" >/dev/null && echo yes || echo no)
fi

echo "frontmatter: $HAS_FRONTMATTER, title: $HAS_FRONTMATTER_TITLE, body H1: $HAS_BODY_H1"
echo "title format (Spec-First：xxxx): $TITLE_FORMAT_OK"

if [[ "$HAS_FRONTMATTER_TITLE" == "yes" && "$HAS_BODY_H1" == "yes" ]]; then
  echo "⚠ 重复风险：frontmatter title 和正文 H1 都存在"
elif [[ "$HAS_FRONTMATTER_TITLE" == "no" && "$HAS_BODY_H1" == "no" ]]; then
  echo "⚠ 缺标题：既无 frontmatter title 也无正文 H1"
else
  echo "✓ 标题来源唯一"
fi

if [[ "$TITLE_FORMAT_OK" == "no" && "$HAS_FRONTMATTER_TITLE" == "yes" ]]; then
  echo "⚠ 标题格式错误：必须以 'Spec-First：' 开头（全角冒号），当前值：$TITLE_VAL"
fi
```

**处理策略：**

| 状态 | 处理 |
|---|---|
| ✓ 标题来源唯一 + 格式正确 | 直接进入 Step 5 |
| ⚠ 重复风险 | 用 `AskUserQuestion` 询问：自动删除正文 H1（推荐）/ 手动修复 / 忽略继续 |
| ⚠ 缺标题 | 用 `AskUserQuestion` 询问：从首行 H1/H2 提取写入 frontmatter / 用户输入 / 用文件名 |
| ⚠ 标题格式错误 | 自动在 frontmatter title 前加 `Spec-First：` 前缀，或提示用户修改 |

**自动删除 H1 的实现：**

```bash
ARTICLE="{article_path}"
awk 'BEGIN{n=0; deleted=0}
  /^---$/{n++; print; next}
  n>=2 && !deleted && /^# [^#]/{deleted=1; next}
  n>=2 && deleted==1 && /^$/{deleted=2; next}
  {print}
' "$ARTICLE" > "${ARTICLE}.tmp" && mv "${ARTICLE}.tmp" "$ARTICLE"
```

**自动写入 frontmatter title 的实现（如缺标题且原文有 H1）：**

```bash
ARTICLE="{article_path}"
H1_TITLE=$(awk 'BEGIN{n=0} /^---$/{n++; next} n>=2 && /^# [^#]/{sub(/^# +/, ""); print; exit}' "$ARTICLE")
if [[ -n "$H1_TITLE" ]]; then
  if grep -q "^---$" "$ARTICLE"; then
    awk -v title="$H1_TITLE" '
      BEGIN{n=0; added=0}
      /^---$/{n++; print; if (n==1 && !added) { print "title: " title; added=1 }; next}
      {print}
    ' "$ARTICLE" > "${ARTICLE}.tmp" && mv "${ARTICLE}.tmp" "$ARTICLE"
  else
    { echo "---"; echo "title: $H1_TITLE"; echo "---"; echo ""; cat "$ARTICLE"; } > "${ARTICLE}.tmp" && mv "${ARTICLE}.tmp" "$ARTICLE"
  fi
fi
```

修复后再次运行检查脚本确认 ✓，然后进入 Step 5。

---

## Step 5: 排版预览

**执行：**

```bash
WECHAT_SKILL_DIR="$HOME/.claude/skills/baoyu-post-to-wechat"
npx -y bun "$WECHAT_SKILL_DIR/scripts/md-to-wechat.ts" "{article_path}" --theme tech-blog
```

命令输出 JSON，从中提取 `htmlPath` 字段。在浏览器中打开预览：

```bash
open "{htmlPath}"
```

用 `AskUserQuestion` 询问排版是否满意：
- ✓ 排版满意，继续润色
- 调整图片位置或文字内容（修正后重新生成预览）
- 跳过预览，直接发布（不推荐）

**常见排版问题与修法：**

| 问题 | 表现 | 修法 |
|---|---|---|
| 图片显示 broken | 预览里显示 alt 文字而无图 | 检查 markdown 引用路径，相对路径要相对于 markdown 文件位置 |
| 代码块溢出 | 横向滚动条 | markdown 里的长行加换行，或改成 inline code |
| Blockquote 嵌套过深 | 渲染层级混乱 | 拆成多个独立 blockquote |
| H1/H2 都很大 | 标题层级不清 | 检查是否同时有 H1 和 H2，建议只用 H1 + H2 + H3 |
| 段落间距不一致 | 部分段落贴在一起 | 段落之间确保有空行 |

**修复后：** 重新执行 `md-to-wechat.ts`，刷新浏览器预览。

---

## Step 5.5: 专业技术博文版式 gate

**目的：** 防止发布稿停留在普通 Markdown 长文，确保微信公众号正文具备专业技术博文的结构感、可扫读性和视觉清晰度。

**版式要求：**

- frontmatter 有 `title:`，正文不出现 H1
- **正文字数不少于 1.5 万字（按去除空白后的正文字符数统计）**
- **正文配图 6-10 张**（不含封面图）；少于 6 张需补图，超过 10 张需精简
- H2 使用编号章节，例如 `## 01 从 Prompt 到 Harness`
- H3 使用章节内编号，例如 `### 06.1 Context Harness：上下文要正确，不要无限`
- `tech-blog` 渲染 HTML 必须给 H2/H3 写入 inline style，避免微信编辑器粘贴后剥离 CSS class 导致章节层级失效
- 开头有导读或核心结论，结尾有可带走判断
- 段落短、留白稳定，移动端单段不超过 3 行
- 只用真实 Markdown 列表，不在文本里手写 `•`
- 图片全部为 PNG，且图片前后有过渡文案
- blockquote 只承载关键判断，不连续堆叠长段落

**自动检查脚本：**

```bash
ARTICLE="{article_path}"
WECHAT_SKILL_DIR="$HOME/.claude/skills/baoyu-post-to-wechat"
JSON=$(npx -y bun "$WECHAT_SKILL_DIR/scripts/md-to-wechat.ts" "$ARTICLE" --theme tech-blog)
HTML=$(printf '%s' "$JSON" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).htmlPath))')

node - "$ARTICLE" "$HTML" <<'NODE'
const fs = require('fs');
const article = fs.readFileSync(process.argv[2], 'utf8');
const html = fs.readFileSync(process.argv[3], 'utf8');
const body = article.replace(/^---\n[\s\S]*?\n---\n?/, '');
const bodyTextForCount = body.replace(/\s+/g, '');
const checks = {
  hasFrontmatterTitle: /^---\n[\s\S]*?\ntitle:\s*.+\n[\s\S]*?\n---/.test(article),
  bodyH1: /^# [^#]/m.test(body),
  markdownSvgImages: /!\[[^\]]*\]\([^)]*\.svg\)/i.test(body),
  bodyCharCount: Array.from(bodyTextForCount).length,
  h2Count: (body.match(/^## /gm) || []).length,
  h3StructuredCount: (body.match(/^###\s+\d{2}\.\d+\s+/gm) || []).length,
  htmlHandwrittenBullets: /<li[^>]*>\s*•/.test(html),
  imagePlaceholders: (html.match(/WECHATIMGPH_/g) || []).length,
  inlineH2Style: /<h2[^>]*style="[^"]*border-left:5px solid #2563eb/.test(html),
  inlineH3Style: /<h3[^>]*style="[^"]*border-left:3px solid #06b6d4/.test(html),
};
console.log(JSON.stringify(checks, null, 2));
if (!checks.hasFrontmatterTitle) process.exitCode = 1;
if (checks.bodyH1) process.exitCode = 1;
if (checks.markdownSvgImages) process.exitCode = 1;
if (checks.bodyCharCount < 15000) { console.error(`FAIL: bodyCharCount=${checks.bodyCharCount} < 15000 (按去除空白后的正文字符数统计)`); process.exitCode = 1; }
if (checks.h2Count < 5) process.exitCode = 1;
if (checks.h3StructuredCount < 4) process.exitCode = 1;
if (checks.htmlHandwrittenBullets) process.exitCode = 1;
if (checks.imagePlaceholders < 6) { console.error(`FAIL: imagePlaceholders=${checks.imagePlaceholders} < 6 (需要至少6张正文图)`); process.exitCode = 1; }
if (checks.imagePlaceholders > 10) { console.error(`WARN: imagePlaceholders=${checks.imagePlaceholders} > 10 (建议精简到10张以内)`); }
if (!checks.inlineH2Style) process.exitCode = 1;
if (!checks.inlineH3Style) process.exitCode = 1;
NODE
```

**期望：** 所有布尔问题通过；`htmlHandwrittenBullets` 必须是 `false`。如果出现 `• •`，优先检查 `baoyu-post-to-wechat/scripts/md/render.ts` 的 `listitem()`，它必须只输出 `<li>` 内容，不得手写 `• ` 前缀。

---

## Step 6: 润色

**读取润色规范：** 参见 `references/polish-prompt.md`。

用 `AskUserQuestion` 询问是否执行润色：
- 执行润色（推荐）
- 跳过润色，直接发布

**若执行润色：**

1. 读取 `references/polish-prompt.md` 获取 prompt 模板
2. 读取文章内容
3. Claude 内联执行润色（不调用外部工具）
4. 展示润色后的文章内容

用 `AskUserQuestion` 询问保存方式：
- 覆盖原文件
- 存为新文件 `{slug}-polished.md`（推荐）
- 不保存

更新 `article_path` 指向润色后的文件路径。

---

## Step 6.5: frontmatter 回查（润色后可选）

**注意：** Step 4.7 已经做过完整检查。本步骤仅在以下情况需要：
- Step 6 润色后文件 frontmatter 被修改/丢失
- 用户在 Step 5 预览之后又手动改了文件

**如果 Step 6 之后未修改文件 frontmatter，跳过本步骤直接进入 Step 7。**

如果需要回查，使用 Step 4.7 的同一套检查脚本，定位问题后修复，然后重新执行 Step 5 排版预览确认。

---

## Step 7: 推送草稿到微信编辑器并自动上传封面

**Chrome 状态预检查：**

推送前必须确保 Chrome 处于正确状态，否则会出现 `New tab not found` 或 `Home page menu did not load` 错误。

```bash
cat > /tmp/_wechat_prep.ts << 'EOF'
import path from 'node:path';
import os from 'node:os';
const CDP = path.join(os.homedir(), '.claude/skills/baoyu-post-to-wechat/scripts/cdp.ts');
const { tryConnectExisting, findExistingChromeDebugPort } = await import(CDP);

const port = await findExistingChromeDebugPort();
if (!port) { console.log('no_debug_port'); process.exit(0); }
const cdp = await tryConnectExisting(port);
if (!cdp) { console.log('no_cdp'); process.exit(0); }

const { targetInfos } = await cdp.send('Target.getTargets', {});

// 1. 关闭残留编辑器 tab（避免 "Home page menu did not load"）
let closedEditors = 0;
for (const t of targetInfos) {
  if (t.type === 'page' && t.url?.includes('appmsg_edit')) {
    await cdp.send('Target.closeTarget', { targetId: t.targetId });
    closedEditors++;
  }
}
if (closedEditors > 0) console.log(`closed ${closedEditors} stale editor tab(s)`);

// 2. 确保有一个微信 tab 停在首页（避免 "New tab not found"）
// 如果当前 tab 停在文章预览页、图片库等非首页，wechat-article.ts 点击"文章"菜单后
// 可能在同一 tab 内跳转而不是打开新 tab，导致 waitForNewTab 超时。
const wechatTabs = targetInfos.filter(t => t.type === 'page' && t.url?.includes('mp.weixin.qq.com'));
if (wechatTabs.length > 0) {
  const homeTab = wechatTabs.find(t => t.url?.includes('/cgi-bin/home'));
  if (!homeTab) {
    // 把第一个微信 tab 导航到首页
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId: wechatTabs[0].targetId, flatten: true });
    await cdp.send('Page.navigate', { url: 'https://mp.weixin.qq.com/cgi-bin/home' }, { sessionId });
    console.log('navigated to home, waiting 4s for menu...');
    await new Promise(r => setTimeout(r, 4000));
  } else {
    console.log('home tab already exists');
  }
} else {
  console.log('no wechat tab found — wechat-article.ts will launch Chrome');
}

cdp.close();
EOF
npx -y bun /tmp/_wechat_prep.ts 2>/dev/null
rm -f /tmp/_wechat_prep.ts
```

**发布前手动操作清单（展示给用户）：**

```
发布前请准备好（推送后需在微信编辑器中手动完成）：

□ 开启原创声明
□ 指定合集：Spec-first
□ 开启留言功能
□ 开启留言自动精选
```

用 `AskUserQuestion` 确认后执行：

```bash
WECHAT_SKILL_DIR="$HOME/.claude/skills/baoyu-post-to-wechat"
npx -y bun "$WECHAT_SKILL_DIR/scripts/wechat-article.ts" \
  --markdown "{article_path}" \
  --author "leokuang" \
  --theme tech-blog
```

**如果推送报 `New tab not found`：** 说明 Chrome 当前 tab 不在首页（可能停在文章预览页、图片库等）。重新运行上面的预检查脚本，等待首页菜单加载后再推送。

**自动上传封面图：**

正文推送成功后，立即通过微信编辑器的图片库链路设置封面图：

```bash
npx -y bun docs/11-文章系列/.skills/spec-wechat-publish/scripts/upload-wechat-cover.ts \
  --cover docs/11-文章系列/pic/{slug}-cover.png --force
```

**注意：** 封面上传脚本需要编辑器 tab 已打开。如果上传超时，检查 Chrome 里是否有 `appmsg_edit` URL 的 tab；若没有，说明推送后编辑器 tab 被意外关闭，需要重新推送。

脚本只操作当前已打开的微信文章编辑器 tab，执行确定性流程：

```text
封面区域「从图片库选择」
→ 图片库上传 input 设置 cover.png
→ 选中新上传图片
→ 下一步 / 完成（如出现裁剪确认）
→ 保存草稿
→ 验证封面预览和左侧文章卡片缩略图均非空
```

**边界：**
- 不自动点击「发表」。
- 不批量设置页面所有 `input[type=file]`，只设置图片库弹窗内的上传 input。
- 默认加 `--force` 确保每次都重新上传，避免封面残留旧图。

**推送后验证：**

```bash
cat > /tmp/_wechat_verify.ts << 'EOF'
import path from 'node:path';
import os from 'node:os';
const CDP = path.join(os.homedir(), '.claude/skills/baoyu-post-to-wechat/scripts/cdp.ts');
const { tryConnectExisting, findExistingChromeDebugPort } = await import(CDP);

const port = await findExistingChromeDebugPort();
if (!port) { console.error('Chrome debug port not found'); process.exit(1); }
const cdp = await tryConnectExisting(port);
if (!cdp) { console.error('CDP connect failed'); process.exit(1); }

const { targetInfos } = await cdp.send('Target.getTargets', {});
let found = false;
for (const t of targetInfos) {
  if (t.type === 'page' && t.url?.includes('appmsg_edit')) {
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId: t.targetId, flatten: true });
    const r = await cdp.send('Runtime.evaluate', {
      expression: `JSON.stringify((function() {
        // Body editor: prefer the tagged ID; fall back to second .ProseMirror (the
        // first one is the title editor inside .title-editor__input).
        const body = document.querySelector('#wechat_body_editor_pm')
          || Array.from(document.querySelectorAll('.ProseMirror'))
               .find(el => !el.closest('.title-editor__input'));
        if (!body) return { error: 'body editor not found' };
        const visibleTitle = document.querySelector('.title-editor__input .ProseMirror');
        const coverPreview = document.querySelector('.js_cover_preview_new');
        const cardThumb = document.querySelector('.js_appmsg_thumb_new');
        const coverError = document.querySelector('.js_cover_error');
        return {
          title: (document.querySelector('#title')?.value || ''),
          visible_title: (visibleTitle?.innerText || visibleTitle?.textContent || ''),
          title_length: (document.querySelector('#title')?.value || '').length,
          body_para_count: body.querySelectorAll('p').length,
          body_h2_count: body.querySelectorAll('h2').length,
          body_image_count: body.querySelectorAll('img').length,
          body_real_image_count: Array.from(body.querySelectorAll('img'))
            .filter(i => i.src && i.src.startsWith('http')).length,
          cover_preview_bg: getComputedStyle(coverPreview || document.body).backgroundImage,
          card_thumb_bg: getComputedStyle(cardThumb || document.body).backgroundImage,
          visible_cover_error: coverError && getComputedStyle(coverError).display !== 'none'
            ? coverError.innerText
            : ''
        };
      })())`,
      returnByValue: true,
    }, { sessionId });
    console.log(r.result.value);
    found = true;
    break;
  }
}
if (!found) console.error('No editor tab found');
cdp.close();
EOF
npx -y bun /tmp/_wechat_verify.ts
rm -f /tmp/_wechat_verify.ts
```

**期望指标：**
- `title_length` 在 10-64 之间（标题字符数，不应是几千）
- `visible_title` 与 `title` 一致；微信新 UI 可见标题为空时，左侧文章列表会像“标题没有”
- `body_para_count` > 50（正常正文段落数）
- `body_h2_count` 与文章章节数一致
- `body_real_image_count` 等于文章引用的正文图片数
- `cover_preview_bg` 和 `card_thumb_bg` 都不是 `url("")`；由 `upload-wechat-cover.ts` 自动设置
- `visible_cover_error` 为空

**异常处理：**
- 如果 `title_length > 1000`，说明遇到了**双 ProseMirror 选择器问题**（详见下面 Troubleshooting）。
- 如果 `title` 有值但 `visible_title` 为空，按 Troubleshooting「标题隐藏字段有值但 UI 不显示」修复。
- 如果 `card_thumb_bg` 为空，按 Troubleshooting「文章卡片没有封面」修复。

**展示给用户：**

```
草稿已推送到微信编辑器！

下一步（在微信编辑器中手动完成）：
1. 检查封面图已自动设置：docs/11-文章系列/pic/{slug}-cover.png
2. 开启原创声明
3. 指定合集：Spec-first
4. 开启留言 + 自动精选
5. 点击发布
```

---

## Troubleshooting

### 问题 1：正文内容被填到了标题字段

**症状：** 推送后微信编辑器里标题字段长达几千字符（应是文章标题），正文区为空。

**根因：** 微信公众号编辑器有**两个 `.ProseMirror` 元素**：
- `index 0` = 标题编辑器（父元素 `.title-editor__input`）
- `index 1` = 正文编辑器（父元素 `.rich_media_content`）

老版 `wechat-article.ts` 用 `document.querySelector('.ProseMirror')` 默认选中第一个 = 标题编辑器，所有内容粘到了标题。

**修复：** 本仓库的 `~/.claude/skills/baoyu-post-to-wechat/scripts/wechat-article.ts` 已修复，关键是把所有 `.ProseMirror` 选择器改为：

```javascript
const editor = Array.from(document.querySelectorAll('.ProseMirror'))
  .find(el => !el.closest('.title-editor__input'));
```

并给正文编辑器临时加 `id="wechat_body_editor_pm"` 给后续 `clickElement` 用。

**如果你的 baoyu-post-to-wechat 没修复：** 检查 `~/.claude/skills/baoyu-post-to-wechat/scripts/wechat-article.ts` 是否包含 `wechat_body_editor_pm` ID 标记和 `el.closest('.title-editor__input')` 过滤；如果没有，需要应用上述补丁，或建议作者升级。

### 问题 2：正文配图被截断 / 拉伸成正方形

**症状：** PNG 图片是 2000×2000 正方形，但 SVG viewBox 是其他比例（如 1200×620）。

**根因：** SVG → PNG 转换器（如 sharp 默认配置）强制方形输出。

**修复：** 用 skill 自带 `scripts/svg-to-png.mjs`（推荐）或 `scripts/svg-to-png.ts` 重转，详见 Step 4.5。

### 问题 3：osascript Cmd+V 把内容粘到标题（旧版本）

**症状：** baoyu-post-to-wechat 用 osascript 模拟系统级 Cmd+V，但 macOS 系统焦点不在编辑器上，paste 进了标题输入框。

**修复：** 本仓库的 `wechat-article.ts` 已改用 ClipboardEvent + DataTransfer 直接派发到 ProseMirror，绕开 macOS 系统剪贴板/焦点。

### 问题 4：API key 未配置导致图片生成失败

**症状：** `baoyu-image-gen` 报 "No API key found. Set GOOGLE_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY."

**修复：** 编辑 `~/.baoyu-skills/.env`，取消注释并填入真实 key：

```
GOOGLE_API_KEY=your_key_from_https://aistudio.google.com/apikey
```

或用 OpenAI key。

**绕过方案：** 如果暂时拿不到 key，跳过图片生成步骤，使用已有的 PNG/SVG 图片走后续流程。

### 问题 5："Home page menu did not load"

**症状：** `wechat-article.ts` 启动时报这个错。

**根因：** Chrome 里残留着一个未关闭的微信编辑器 tab（`appmsg_edit` URL），脚本试图从首页跳转失败。

**修复：** Step 7 的 Chrome 状态预检查脚本会自动关掉这些 tab。手动也可以在 Chrome 里直接关掉编辑器 tab，回到 `mp.weixin.qq.com/cgi-bin/home`。

### 问题 6：标题隐藏字段有值但 UI 不显示

**症状：** CDP 检查 `textarea#title` 有标题，但微信编辑器可见标题为空；左侧文章列表或草稿卡片看起来像”标题没有”。

**根因：** 微信新编辑器同时维护隐藏 `textarea#title` 和可见 `.title-editor__input .ProseMirror`。只写隐藏字段不足以刷新可见 UI。

**本仓库已修复：** `wechat-article.ts` 的标题写入逻辑已同时写入两个字段（见问题 9）。如果仍然出现此症状，说明 `wechat-article.ts` 的修复未生效，参考问题 9 的修复方案。

**手动修复（应急）：**

```javascript
const title = '文章标题';
const hidden = document.querySelector('#title');
if (hidden) {
  hidden.value = title;
  hidden.dispatchEvent(new Event('input', { bubbles: true }));
  hidden.dispatchEvent(new Event('change', { bubbles: true }));
}
const editor = document.querySelector('.title-editor__input .ProseMirror');
if (editor) {
  editor.focus();
  document.execCommand('selectAll', false);
  document.execCommand('delete', false);
  document.execCommand('insertText', false, title);
  editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: title }));
  editor.blur();
}
```

修复后重新验证：`title` 与 `visible_title` 必须一致。

### 问题 7：文章卡片没有封面

**症状：** 封面区域显示“拖拽或选择封面”，或 CDP 检查 `.js_appmsg_thumb_new` 的 `background-image` 是 `url("")`；保存时可能出现“必须插入一张图片”。

**根因：** `wechat-article.ts` 只负责正文图片，不直接设置微信的封面/文章卡片。直接给封面区隐藏 file input 设文件有时会卡在 loading，必须走微信图片库选择和封面裁剪确认链路。

**注意：** 不要对页面里的所有 `input[type=file]` 批量 `setFileInputFiles`。微信页面同时有正文图片上传和图片库上传 input，误设正文 input 会把封面图插进正文开头。

**修复：** 优先运行自动封面脚本：

```bash
npx -y bun docs/11-文章系列/.skills/spec-wechat-publish/scripts/upload-wechat-cover.ts \
  --cover docs/11-文章系列/pic/{slug}-cover.png \
  --force
```

脚本会点击封面区「从图片库选择」，在图片库上传 `docs/11-文章系列/pic/{slug}-cover.png`，选中新上传图片，点击「下一步」/「完成」，保存草稿，并验证 `.js_cover_preview_new` 和 `.js_appmsg_thumb_new` 都已有非空 `background-image`。

如果自动上传脚本已把图片上传到图片库但卡在封面 loading，不要重复推送正文；直接从图片库选中刚上传的封面图并完成裁剪确认。

### 问题 8：正文列表出现双层点

**症状：** 微信正文列表显示为 `• • 文件发现`、`• • 路径解析`。

**根因：** Markdown 渲染器在 `<li>` 内容里手写了 `• `，微信编辑器又对真实列表显示自己的项目符号，最终出现双层点。

**修复：** 检查 `~/.claude/skills/baoyu-post-to-wechat/scripts/md/render.ts` 和 `~/.agents/skills/baoyu-post-to-wechat/scripts/md/render.ts`：

```typescript
return styledContent("listitem", content, "li");
```

不要写成：

```typescript
return styledContent("listitem", `• ${content}`, "li");
```

修复后重新执行 `md-to-wechat.ts --theme tech-blog`，检查 HTML 中 `<li>` 的文本不以 `•` 开头，再重新推送。

---

### 问题 9：标题不写入可见 UI（wechat-article.ts 根因）

**症状：** 推送后微信编辑器标题区显示"请在这里输入标题"，`visible_title` 为空，但 `title_length` 可能有值（隐藏字段写入了）。

**根因：** 原版 `wechat-article.ts` 只写了隐藏的 `textarea#title`，没有同步写可见的 `.title-editor__input .ProseMirror`。微信新编辑器需要两个字段都写入才能在 UI 上显示标题。

**本仓库已修复：** `~/.claude/skills/baoyu-post-to-wechat/scripts/wechat-article.ts` 的标题写入逻辑已更新为同时写入两个字段：

```typescript
// 写隐藏 input
await evaluate(session, `document.querySelector('#title').value = ${JSON.stringify(effectiveTitle)};
  document.querySelector('#title').dispatchEvent(new Event('input', { bubbles: true }));`);
// 同步写可见 ProseMirror
await evaluate(session, `(function(){
  const ed = document.querySelector('.title-editor__input .ProseMirror');
  if (!ed) return;
  ed.focus();
  document.execCommand('selectAll', false);
  document.execCommand('delete', false);
  document.execCommand('insertText', false, ${JSON.stringify(effectiveTitle)});
  ed.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:${JSON.stringify(effectiveTitle)}}));
  ed.blur();
})()`);
```

**验证：** 推送后检查 `visible_title` 与 `title` 是否一致。如果不一致，说明修复未生效，检查 `wechat-article.ts` 是否包含 `title-editor__input` 和 `execCommand('insertText')`。

---

### 问题 10：blockquote 底部出现空白行

**症状：** 微信正文里每个 blockquote 底部都有一段明显空白，视觉上像多了一行。

**根因：** `md-to-wechat.ts` 的 `inlineTechBlogStyles` 函数把 `margin:0 0 24px` 注入到**所有** `<p>` 标签（包括 blockquote 内的），CSS 规则无法覆盖 inline style，导致 blockquote 内最后一个 `<p>` 的 `margin-bottom:24px` 造成底部空白。

**本仓库已修复：** `~/.claude/skills/baoyu-post-to-wechat/scripts/md-to-wechat.ts` 的 `inlineTechBlogStyles` 函数已加后处理，把 blockquote 内 `<p>` 的 margin 覆盖为 `margin:0`：

```typescript
// blockquote 内的 <p> 不应有 margin-bottom，否则底部出现空白
result = result.replace(
  /(<blockquote[^>]*>)([\s\S]*?)(<\/blockquote>)/g,
  (_match, open, inner, close) => {
    const fixed = inner.replace(/margin:0 0 24px;/g, 'margin:0;');
    return `${open}${fixed}${close}`;
  }
);
```

**验证：** 生成 HTML 后检查 blockquote 内 `<p>` 的 style 是否为 `margin:0;`（不含 `24px`）。

---

### 问题 11：推送报 `New tab not found`

**症状：** `wechat-article.ts` 点击"文章"菜单后等待新 tab 超时，报 `Error: New tab not found: mp.weixin.qq.com`。

**根因：** Chrome 当前微信 tab 停在非首页（文章预览页 `/s/...`、图片库页 `appmsgalbummgr`、发布列表页 `appmsgpublish` 等）。`wechat-article.ts` 点击"文章"菜单后，微信可能在同一 tab 内跳转而不是打开新 tab，导致 `waitForNewTab` 等不到新 tab。

**修复：** 在推送前运行 Step 7 的 Chrome 状态预检查脚本，它会自动把微信 tab 导航到首页并等待菜单加载。

**手动修复：** 在 Chrome 里手动导航到 `https://mp.weixin.qq.com/cgi-bin/home`，等待首页菜单出现后再推送。

---

### 问题 12：baoyu skills symlink 断链

**症状：** Prerequisites 检查报 `✗ baoyu-post-to-wechat 未安装`，但 `~/.claude/skills/baoyu-post-to-wechat` 目录存在（实际是断链 symlink）。

**根因：** `~/.claude/skills/baoyu-*` 是指向 `~/.agents/skills/baoyu-*` 的 symlink。如果 `~/.agents/skills/` 下的目录被移走（如清理操作把它们移到 `skills-disabled-*` 目录），symlink 就会断链，`test -d` 返回 false。

**诊断：**

```bash
ls -la ~/.claude/skills/baoyu-post-to-wechat  # 查看是否是断链 symlink
ls ~/.agents/skills-disabled-*/baoyu-post-to-wechat 2>/dev/null  # 查找被移走的目录
```

**修复：**

```bash
# 把 disabled 目录里的 baoyu skills 移回 ~/.agents/skills/
for skill in baoyu-post-to-wechat baoyu-cover-image baoyu-image-gen baoyu-article-illustrator; do
  src="$HOME/.agents/skills-disabled-*/$skill"
  dst="$HOME/.agents/skills/$skill"
  [ -d $src ] && [ ! -e "$dst" ] && mv $src "$dst" && echo "✓ moved $skill"
done
```

---

## References

- 配图与排版风格规范：[references/style-guide.md](references/style-guide.md)
- 润色 Prompt 模板：[references/polish-prompt.md](references/polish-prompt.md)
- SVG→PNG 转换脚本（推荐）：[scripts/svg-to-png.mjs](scripts/svg-to-png.mjs)
- SVG→PNG 转换脚本（bun + 已运行 Chrome）：[scripts/svg-to-png.ts](scripts/svg-to-png.ts)
- skill 使用说明：[README.md](README.md)
- baoyu-cover-image：`~/.claude/skills/baoyu-cover-image/SKILL.md`
- baoyu-article-illustrator：`~/.claude/skills/baoyu-article-illustrator/SKILL.md`
- baoyu-post-to-wechat：`~/.claude/skills/baoyu-post-to-wechat/SKILL.md`（本仓库已对此 skill 应用修复，详见 Troubleshooting）
- baoyu-image-gen：`~/.claude/skills/baoyu-image-gen/SKILL.md`
- 文章系列目录：`docs/11-文章系列/`
- 内容路线图：`docs/11-文章系列/2026-05-27-004-spec-first-wechat-series-content-roadmap.md`
- **spec-first 官网内容**：`/Users/kuang/xiaobu/spec-first-official-website/website/docs/`（写文章时可查阅官网 guide 补充理解，尤其是 `best-practices.md`、`artifacts-map.md`、`graph-overview.md` 等）
