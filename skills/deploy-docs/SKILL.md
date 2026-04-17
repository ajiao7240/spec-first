---
name: deploy-docs
description: Validate and prepare documentation for GitHub Pages deployment
disable-model-invocation: true
---

# Deploy Documentation Command

Validate the documentation site and prepare it for GitHub Pages deployment.

## Step 1: Validate Documentation

Run these checks:

```bash
# Count source-of-truth components from the current repo root
echo "Agents: $(find agents -maxdepth 1 -name '*.md' | wc -l)"
echo "Skills: $(find skills -mindepth 1 -maxdepth 1 -type d | wc -l)"

# Validate JSON
cat .claude-plugin/marketplace.json | jq . > /dev/null && echo "✓ marketplace.json valid"
cat .claude-plugin/plugin.json | jq . > /dev/null && echo "✓ plugin.json valid"

# Check markdown-first documentation entrypoints exist
for path in \
  "docs/05-用户手册/README.md" \
  "docs/10-prompt/README.md" \
  "docs/contexts/README.md" \
  "docs/02-架构设计/01-整体架构.md" \
  "docs/03-实施方案/02-Skills改造详细指南.md"; do
  if [ -f "$path" ]; then
    echo "✓ ${path} exists"
  else
    echo "✗ ${path} MISSING"
  fi
done
```

## Step 2: Check for Uncommitted Changes

```bash
git status --porcelain docs/ .claude-plugin/plugin.json
```

If there are uncommitted changes, warn the user to commit first.

## Step 3: Deployment Instructions

Since GitHub Pages deployment requires a workflow file with special permissions, provide these instructions:

### First-time Setup

1. Create `.github/workflows/deploy-docs.yml` with the GitHub Pages workflow
2. Go to repository Settings > Pages
3. Set Source to "GitHub Actions"

### Deploying

After merging to `main`, the docs will auto-deploy. Or:

1. Go to Actions tab
2. Select "Deploy Documentation to GitHub Pages"
3. Click "Run workflow"

### Workflow File Content

```yaml
name: Deploy Documentation to GitHub Pages

on:
  push:
    branches: [main]
    paths:
      - 'docs/**'
      - '.claude-plugin/plugin.json'
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
          path: 'docs'
      - uses: actions/deploy-pages@v4
```

## Step 4: Report Status

Provide a summary:

```
## Deployment Readiness

✓ All HTML pages present
✓ JSON files valid
✓ Component counts match

### Next Steps
- [ ] Commit any pending changes
- [ ] Push to main branch
- [ ] Verify GitHub Pages workflow exists
- [ ] Check deployment at the repository's configured GitHub Pages URL
```
