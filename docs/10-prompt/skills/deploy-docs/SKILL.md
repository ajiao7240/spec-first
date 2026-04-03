---
name: deploy-docs
description: 验证并准备文档站点，以部署到 GitHub Pages
disable-model-invocation: true
---

# 文档部署命令

验证文档站点，并为 GitHub Pages 部署做好准备。

## 第 1 步：验证文档

运行以下检查：

```bash
# 统计组件数量
echo "Agents: $(ls plugins/spec-first/agents/*.md | wc -l)"
echo "Skills: $(ls -d plugins/spec-first/skills/*/ 2>/dev/null | wc -l)"

# 校验 JSON
cat .claude-plugin/marketplace.json | jq . > /dev/null && echo "✓ marketplace.json 有效"
cat plugins/spec-first/.claude-plugin/plugin.json | jq . > /dev/null && echo "✓ plugin.json 有效"

# 检查所有 HTML 文件是否存在
for page in index agents commands skills mcp-servers changelog getting-started; do
  if [ -f "plugins/spec-first/docs/pages/${page}.html" ] || [ -f "plugins/spec-first/docs/${page}.html" ]; then
    echo "✓ ${page}.html 存在"
  else
    echo "✗ ${page}.html 缺失"
  fi
done
```

## 第 2 步：检查未提交变更

```bash
git status --porcelain plugins/spec-first/docs/
```

如果存在未提交变更，提醒用户先提交。

## 第 3 步：部署说明

由于 GitHub Pages 部署需要带有特殊权限的 workflow 文件，请提供以下说明：

### 首次配置

1. 创建 `.github/workflows/deploy-docs.yml`，写入 GitHub Pages workflow
2. 前往仓库 `Settings > Pages`
3. 将 `Source` 设置为 `GitHub Actions`

### 部署方式

合并到 `main` 后，文档会自动部署。也可以手动执行：

1. 打开 `Actions` 标签页
2. 选择 `Deploy Documentation to GitHub Pages`
3. 点击 `Run workflow`

### Workflow 文件内容

```yaml
name: Deploy Documentation to GitHub Pages

on:
  push:
    branches: [main]
    paths:
      - 'plugins/spec-first/docs/**'
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: 'plugins/spec-first/docs'
      - uses: actions/deploy-pages@v4
```

## 第 4 步：汇报状态

提供如下摘要：

```
## 部署就绪状态

✓ 所有 HTML 页面均已存在
✓ JSON 文件有效
✓ 组件数量匹配

### 下一步
- [ ] 提交所有待提交变更
- [ ] 推送到 main 分支
- [ ] 确认 GitHub Pages workflow 已存在
- [ ] 在 https://everyinc.github.io/spec-first-plugin/ 检查部署结果
```
