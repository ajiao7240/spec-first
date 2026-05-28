# spec-wechat-publish 使用说明

`spec-wechat-publish` 是 `docs/11-文章系列/` 的项目本地微信公众号发布流水线 skill，不属于 `spec-first init` 会分发的 bundled skill。

它用于把一篇文章从选题推进到微信编辑器草稿，串联：

```text
选题 -> 写作检测 -> 封面图 -> 正文配图 -> SVG 转 PNG -> 图片完整性 -> frontmatter 检查 -> 排版预览 -> 技术博文版式 gate -> 润色 -> 推送并上传封面
```

## 直接使用

在当前仓库中，把下面这段作为任务发给 agent：

```text
使用 docs/11-文章系列/.skills/spec-wechat-publish/SKILL.md，发布 docs/11-文章系列/<文章文件>.md
```

如果还没有确定文章文件，可以说：

```text
使用 docs/11-文章系列/.skills/spec-wechat-publish/SKILL.md，进入选题步骤
```

执行时，agent 应先读取 `SKILL.md`，再按其中的 Prerequisites、Progress Checklist 和 Step 1 → Step 7（含子步 4.5/4.6/4.7/6.5）继续。

## 可选：安装到本机 runtime

如果希望它能像普通本地 skill 一样被宿主发现，可以复制到用户级 skill 目录。这个步骤只影响本机，不影响 `spec-first` 发布包。

Claude Code:

```bash
mkdir -p "$HOME/.claude/skills"
cp -R docs/11-文章系列/.skills/spec-wechat-publish "$HOME/.claude/skills/spec-wechat-publish"
```

Codex:

```bash
mkdir -p "$HOME/.agents/skills"
cp -R docs/11-文章系列/.skills/spec-wechat-publish "$HOME/.agents/skills/spec-wechat-publish"
```

安装后重启对应宿主，再用自然语言触发，例如：

```text
使用 spec-wechat-publish 发布 docs/11-文章系列/02-ai-coding-harness-publish.md
```

## 依赖

必需：

- `baoyu-post-to-wechat`
- 本机 Chrome（SVG 转 PNG 与微信编辑器自动化都需要）

默认图片流程不需要外部图片 API：agent 直接生成 SVG，使用 `scripts/svg-to-png.mjs` 转 PNG。

只有选择 AI raster image 生成时才需要：

- `baoyu-cover-image`
- `baoyu-article-illustrator`
- `baoyu-image-gen`
- `~/.baoyu-skills/.env` 中配置 `GOOGLE_API_KEY` 或 `OPENAI_API_KEY`

SVG 转 PNG 默认使用本 skill 自带的 `scripts/svg-to-png.mjs`，通过 Chrome headless 渲染，不依赖 Bun 或 npm 下载。微信草稿推送和封面上传依赖 Chrome CDP。`baoyu-post-to-wechat` 会处理 Chrome 启动与登录交互；本 skill 的 `scripts/upload-wechat-cover.ts` 会在正文推送后走微信图片库链路自动上传并选择封面图。如果遇到登录、焦点、可见标题为空、文章卡片无封面或编辑器写入问题，先看 `SKILL.md` 的 Troubleshooting 章节。

排版默认使用 `baoyu-post-to-wechat` 的 `tech-blog` 主题。发布前必须通过 `SKILL.md` 的专业技术博文版式 gate：无正文 H1、不直接引用 SVG、H2/H3 层级有清晰编号、发布 HTML 含 H2/H3 inline style、列表不手写 `•`、图片上下有过渡文案。

如果本机 `baoyu-post-to-wechat` 还没有 `tech-blog` 主题，运行：

```bash
node docs/11-文章系列/.skills/spec-wechat-publish/scripts/install-tech-blog-theme.mjs \
  --skill-dir "$HOME/.claude/skills/baoyu-post-to-wechat"
```

Codex 用户级 runtime 也可以安装到：

```bash
node docs/11-文章系列/.skills/spec-wechat-publish/scripts/install-tech-blog-theme.mjs \
  --skill-dir "$HOME/.agents/skills/baoyu-post-to-wechat"
```

## 边界

- 不要把这个目录移回根目录 `skills/`。
- 不要把它加入 `src/cli/contracts/dual-host-governance/skills-governance.json`。
- 不要期待 `spec-first init` 分发它。

它是文章运营资产，不是 spec-first 核心 workflow/runtime delivery 资产。
