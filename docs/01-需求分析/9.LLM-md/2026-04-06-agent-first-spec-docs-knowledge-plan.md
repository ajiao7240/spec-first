# Agent-First Spec-Docs Knowledge System Phase 1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在 `1 -> 10` 团队阶段落地 Agent-first `spec-docs` 的第一阶段能力：完成 docs repo 绑定、运行时路径发现、项目知识骨架、基础 publish guard，以及 `spec-plan/spec-work/spec-review` 的知识优先读取。

**Architecture:** `spec-first init/doctor` 负责 docs repo 绑定、workspace 发现、slug 解析、项目骨架初始化与健康检查；`spec-bootstrap` 把代码分析结果写入 `raw/snapshots/<timestamp>/`；`spec-compound` / `spec-compound-refresh` 负责 `raw -> draft -> knowledge` 编译链；`spec-plan` / `spec-work` / `spec-review` 在进入本地代码扫描前，优先读取 `knowledge/`、必要时回退到 `draft/`、`raw/` 与代码仓库。第一阶段坚持 repo-native、git-native、markdown-native，不引入向量库、数据库或 Web UI。

**Tech Stack:** Node.js 20+, CommonJS, shell-first tests, Git, Markdown/YAML frontmatter, Claude/Codex runtime assets

**Companion Architecture:** `docs/01-需求分析/9.LLM-md/2026-04-06-agent-first-spec-docs-knowledge-architecture.md`

---

## 背景与约束

- 来源文档：
  - `docs/01-需求分析/8.独立知识库/spec-first-独立文档仓库方案-v2.md`
  - 本次对 Karpathy `LLM Wiki` 的落地讨论结论
- 原始输入不是人工笔记，而是**代码分析结果**
- 主要消费方不是人类读者，而是 **Agent CLI 的上下文装配器**
- 团队治理模型固定为：**LLM 起草，模块 owner 审核后生效**
- 第一阶段不做：
  - 向量检索
  - 数据库后端
  - Web 管理界面
  - 跨 docs repo 聚合
  - 全自动审核与自动 merge

## 成功标准

- `spec-first init --claude|--codex` 可以在绑定 docs repo 时初始化项目级知识骨架：
  - `raw/`
  - `draft/`
  - `knowledge/`
  - `README.md`
- `spec-first init --claude|--codex --docs-repo <repo> --docs-local-path <path> [--global]` 能完成 docs repo 绑定与个人本地路径登记
- `spec-first doctor` 能检查 docs repo 绑定、本地路径、git 状态、知识骨架是否存在
- 运行中的 Claude / Codex 资产都能通过**本地运行时文件**发现解析后的 `docsLocalPath`，而不是依赖 agent 重新推断 `~/.spec-first/config.json`
- `spec-bootstrap` 明确将代码分析结果写入 `raw/snapshots/<timestamp>/`
- `spec-compound` / `spec-compound-refresh` 有明确的 `draft` / `knowledge` 写入职责
- `spec-plan` / `spec-work` / `spec-review` 有一致的知识读取顺序：
  - `knowledge/`
  - `contexts/`
  - `draft/`
  - `raw/`
  - 源码
- shell-first 测试覆盖 docs config、workspace 发现、docs repo 初始化、skill 合约

## 范围声明

本文件只描述 **Phase 1 / Team 模式** 的实施计划。  
长期分阶段策略、北极星架构、能力矩阵与防返工原则，统一收敛到：

- `docs/01-需求分析/9.LLM-md/2026-04-06-agent-first-spec-docs-knowledge-architecture.md`

执行本计划时，默认假设：

- 目标阶段为 `1 -> 10`
- `0 -> 1` 可以按架构文档中的 `Lite` 模式降级运行
- `10 -> 100` 所需的 shared routing、taxonomy、健康度治理等能力不进入当前 Phase 1 主链

## 任务拆分总览

1. docs repo 配置、CLI 入口与运行时状态模型
2. workspace 发现与 slug 解析
3. docs repo 项目骨架初始化
4. doctor 健康检查扩展
5. 知识层 schema、publish guard 与模板固化
6. `spec-bootstrap` 原始快照写入
7. `spec-compound` / `spec-compound-refresh` 的 draft/publish 流程
8. `spec-plan` / `spec-work` / `spec-review` 的知识路由接入
9. 发布说明、changelog 与回归测试

### Task 1: docs repo 配置、CLI 入口与运行时状态模型

**Files:**
- Create: `src/cli/docs-config.js`
- Create: `src/cli/docs-runtime.js`
- Modify: `src/cli/state.js`
- Modify: `src/cli/commands/init.js`
- Modify: `package.json`
- Test: `tests/unit/docs-config.sh`

**Step 1: Write the failing test**

```bash
#!/bin/bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

workspace="$TMP_DIR/workspace"
mkdir -p "$workspace/.spec-first" "$workspace/project/.claude/spec-first" "$TMP_DIR/home/.spec-first"

cat > "$workspace/.spec-first/state.json" <<'EOF'
{ "docsRepo": "git@github.com:org/spec-docs.git" }
EOF

cat > "$TMP_DIR/home/.spec-first/config.json" <<'EOF'
{
  "defaultDocsRepo": "git@github.com:org/spec-docs.git",
  "docsRepos": {
    "github.com/org/spec-docs": { "localPath": "/tmp/spec-docs" }
  }
}
EOF

HOME="$TMP_DIR/home" node - <<'EOF'
const { resolveDocsConfig } = require(process.argv[1]);
const result = resolveDocsConfig(process.argv[2], { platform: 'claude', stateFile: '.claude/spec-first/state.json' });
if (!result || result.repo !== 'git@github.com:org/spec-docs.git' || result.localPath !== '/tmp/spec-docs') {
  throw new Error(`unexpected docs config: ${JSON.stringify(result)}`);
}
EOF "$REPO_ROOT/src/cli/docs-config.js" "$workspace/project"

node - <<'EOF' "$REPO_ROOT/src/cli/commands/init.js"
const { parseInitArgs } = require(process.argv[1]);
const parsed = parseInitArgs(['--claude', '--docs-repo', 'git@github.com:org/spec-docs.git', '--docs-local-path', '/tmp/spec-docs', '--global']);
if (parsed.docsRepo !== 'git@github.com:org/spec-docs.git' || parsed.docsLocalPath !== '/tmp/spec-docs' || !parsed.global) {
  throw new Error(JSON.stringify(parsed));
}
EOF
```

**Step 2: Run test to verify it fails**

Run: `bash tests/unit/docs-config.sh`  
Expected: FAIL with `Cannot find module '../src/cli/docs-config.js'` or `resolveDocsConfig is not a function`

**Step 3: Write minimal implementation**

实现 `src/cli/docs-config.js`，至少提供：

```javascript
function normalizeRepoUrl(input) { /* git@ / https / .git -> host/org/repo */ }
function readGlobalDocsConfig(homeDir) { /* ~/.spec-first/config.json */ }
function resolveDocsConfig(projectRoot, adapter) { /* project state -> workspace state -> global default */ }
function writeGlobalDocsRepoMapping(homeDir, repoUrl, localPath) { /* 只写个人 config */ }
```

实现 `src/cli/docs-runtime.js`，用于把**已解析**的 docs 本机信息写入运行时私有文件：

```javascript
function getDocsRuntimeFile(adapter) { /* .claude/spec-first/docs-local.json or .codex/spec-first/docs-local.json */ }
function writeDocsRuntimeContext(projectRoot, adapter, docsConfig) { /* localPath, repo, slug, resolvedAt */ }
function readDocsRuntimeContext(projectRoot, adapter) { /* skill / doctor / helper reuse */ }
```

并在 `src/cli/commands/init.js` 中补齐 CLI 配置入口：

```javascript
--docs-repo <url>
--docs-local-path <path>
--global
```

并在 `src/cli/state.js` 中允许保留 docs 相关字段：

```javascript
{
  manifestVersion,
  platform,
  developer,
  docsRepo,
  docsProjectSlug,
  commands,
  skills,
  agents
}
```

约束：
- `docsLocalPath` 不写入项目共享 `state.json`
- `docsLocalPath` 必须写入个人 `~/.spec-first/config.json`
- 解析后的 `docsLocalPath` 必须再落到运行时私有文件，供 Agent CLI 读取
- `parseInitArgs()`、`printHelp()`、smoke help 断言同步更新

**Step 4: Run test to verify it passes**

Run: `bash tests/unit/docs-config.sh`  
Expected: PASS with config precedence and repo normalization cases all green

**Step 5: Commit**

```bash
git add package.json tests/unit/docs-config.sh src/cli/docs-config.js src/cli/docs-runtime.js src/cli/state.js src/cli/commands/init.js
git commit -m "feat(init): add docs repo config resolution"
```

### Task 2: workspace 发现与 slug 解析

**Files:**
- Create: `src/cli/workspace.js`
- Modify: `src/cli/commands/init.js`
- Modify: `src/cli/docs-config.js`
- Modify: `package.json`
- Test: `tests/unit/workspace.sh`

**Step 1: Write the failing test**

```bash
#!/bin/bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

mkdir -p "$TMP_DIR/ws/apps/app-a" "$TMP_DIR/ws/apps/app-b" "$TMP_DIR/ws/spec-docs"
cat > "$TMP_DIR/ws/pnpm-workspace.yaml" <<'EOF'
packages:
  - 'apps/*'
EOF
touch "$TMP_DIR/ws/apps/app-a/package.json" "$TMP_DIR/ws/apps/app-b/package.json"
mkdir -p "$TMP_DIR/ws/spec-docs/.git"

node - <<'EOF' "$REPO_ROOT/src/cli/workspace.js" "$TMP_DIR/ws"
const mod = require(process.argv[1]);
const workspace = mod.detectWorkspace(process.argv[2]);
const projects = mod.discoverProjects(process.argv[2], workspace);
if (!workspace.isWorkspace || projects.length !== 2) {
  throw new Error(JSON.stringify({ workspace, projects }));
}
EOF
```

**Step 2: Run test to verify it fails**

Run: `bash tests/unit/workspace.sh`  
Expected: FAIL because `detectWorkspace` / `discoverProjects` / `sanitizeSlug` 尚未实现

**Step 3: Write minimal implementation**

实现 `src/cli/workspace.js`：

```javascript
function detectWorkspace(root) { /* Phase 1: pnpm -> npm workspaces -> heuristic */ }
function discoverProjects(root, workspaceMeta, options) { /* 深度=1 或 workspace globs */ }
function isProjectMarker(dir) { /* package.json / go.mod / Cargo.toml ... */ }
function sanitizeSlug(input) { /* lower-case, spaces -> -, length <= 64 */ }
function inferProjectSlug(projectDir) { /* git remote basename -> dir name */ }
```

并把 docs repo 排除逻辑接入候选扫描：
- 先按 `docsLocalPath` 排除
- 再按 `git remote get-url origin` 规范化结果排除

Phase 1 明确不做：
- `turbo.json`
- `nx.json`
- 多层 workspace 推导

这些能力保留到后续阶段增强。

**Step 4: Run test to verify it passes**

Run: `bash tests/unit/workspace.sh`  
Expected: PASS for pnpm workspace, heuristic mode, docs repo exclusion, slug conflict detection

**Step 5: Commit**

```bash
git add package.json tests/unit/workspace.sh src/cli/workspace.js src/cli/commands/init.js src/cli/docs-config.js
git commit -m "feat(init): detect workspaces and infer docs slugs"
```

### Task 3: docs repo 项目骨架初始化

**Files:**
- Create: `src/cli/knowledge.js`
- Create: `templates/docs/project-readme.md`
- Create: `templates/docs/knowledge-index.md`
- Modify: `src/cli/commands/init.js`
- Modify: `src/cli/docs-runtime.js`
- Modify: `package.json`
- Test: `tests/integration/docs-repo-init.sh`
- Test: `tests/integration/docs-repo-errors.sh`
- Test: `tests/smoke/cli.sh`

**Step 1: Write the failing test**

```bash
#!/bin/bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

mkdir -p "$TMP_DIR/project" "$TMP_DIR/spec-docs/.git" "$TMP_DIR/home/.spec-first"

(
  cd "$TMP_DIR/project"
  HOME="$TMP_DIR/home" node "$REPO_ROOT/bin/spec-first.js" init --claude -u kuang --lang zh \
    --docs-repo git@github.com:org/spec-docs.git \
    --docs-local-path "$TMP_DIR/spec-docs" \
    --global
)

test -d "$TMP_DIR/spec-docs/project/raw"
test -d "$TMP_DIR/spec-docs/project/draft"
test -d "$TMP_DIR/spec-docs/project/knowledge"
test -f "$TMP_DIR/spec-docs/project/README.md"
test -f "$TMP_DIR/spec-docs/project/knowledge/index.md"
test -f "$TMP_DIR/project/.claude/spec-first/docs-local.json"

mkdir -p "$TMP_DIR/project-codex"
(
  cd "$TMP_DIR/project-codex"
  HOME="$TMP_DIR/home" node "$REPO_ROOT/bin/spec-first.js" init --codex -u kuang --lang zh \
    --docs-repo git@github.com:org/spec-docs.git \
    --docs-local-path "$TMP_DIR/spec-docs" \
    --global
)
test -f "$TMP_DIR/project-codex/.codex/spec-first/docs-local.json"
```

**Step 2: Run test to verify it fails**

Run: `bash tests/integration/docs-repo-init.sh`  
Expected: FAIL because init 只会生成 `.claude/` / `.codex/` 运行态，不会初始化 docs repo 骨架

**Step 3: Write minimal implementation**

在 `src/cli/knowledge.js` 中实现：

```javascript
function ensureProjectKnowledgeSkeleton(localDocsPath, slug, meta) {
  // create raw/, draft/, knowledge/, README.md, knowledge/index.md
}

function buildProjectReadme(meta) { /* slug, project-path, workspace-repo, created-by, created-at */ }
function buildKnowledgeIndex(meta) { /* 初始 canonical pages 占位 */ }
```

在 `src/cli/commands/init.js` 中接入：
- 读取 docs config
- 解析 `--docs-repo` / `--docs-local-path` / `--global`
- 允许首次写入 `~/.spec-first/config.json`
- workspace / 单项目模式下解析 slug
- 校验 docs repo working tree
- 初始化项目目录骨架
- 写入运行时私有 docs context 文件
- 将 `docsRepo` / `docsProjectSlug` 写入 state

**Step 4: Run test to verify it passes**

Run:
- `bash tests/integration/docs-repo-init.sh`
- `bash tests/integration/docs-repo-errors.sh`
- `bash tests/smoke/cli.sh`

Expected:
- docs repo 下生成项目目录骨架
- `state.json` 记录 `docsRepo` 和 `docsProjectSlug`
- `.claude/spec-first/docs-local.json` / `.codex/spec-first/docs-local.json` 记录解析后的本机 localPath
- 未配置 docs repo 时保持 in-repo 行为不变
- `--codex` 路径与 `--claude` 等价通过
- `docs-repo-init.sh` 只覆盖 Claude/Codex happy path
- `docs-repo-errors.sh` 单独覆盖 `docs-local-path` 缺失、路径不存在、不是 git repo、working tree 脏、`pull --ff-only` 失败

**Step 5: Commit**

```bash
git add package.json tests/integration/docs-repo-init.sh tests/integration/docs-repo-errors.sh tests/smoke/cli.sh src/cli/knowledge.js src/cli/docs-runtime.js src/cli/commands/init.js templates/docs/project-readme.md templates/docs/knowledge-index.md
git commit -m "feat(init): bootstrap project knowledge skeleton in docs repo"
```

### Task 4: doctor 健康检查扩展

**Files:**
- Modify: `src/cli/commands/doctor.js`
- Modify: `src/cli/docs-config.js`
- Modify: `src/cli/docs-runtime.js`
- Modify: `src/cli/knowledge.js`
- Test: `tests/smoke/cli.sh`
- Test: `tests/integration/docs-repo-init.sh`
- Test: `tests/integration/docs-repo-errors.sh`

**Step 1: Write the failing test**

在 `tests/smoke/cli.sh` 增加断言：

```bash
doctor_output="$(cd "$TMP_DIR/project" && HOME="$TMP_DIR/home" node "$REPO_ROOT/bin/spec-first.js" doctor)"
grep -q "docs repo" <<<"$doctor_output"
grep -q "knowledge skeleton" <<<"$doctor_output"
grep -q "docsProjectSlug" <<<"$doctor_output"
grep -q "docs-local.json" <<<"$doctor_output"
```

**Step 2: Run test to verify it fails**

Run: `bash tests/smoke/cli.sh`  
Expected: FAIL because doctor 还不知道 docs repo、knowledge skeleton 与 git 健康状态

**Step 3: Write minimal implementation**

在 `src/cli/commands/doctor.js` 新增检查项：

```javascript
checkDocsRepoBinding(projectRoot, adapter)
checkDocsRepoLocalPath(projectRoot, adapter)
checkDocsRuntimeContext(projectRoot, adapter)
checkDocsRepoGitStatus(projectRoot, adapter)
checkKnowledgeSkeleton(projectRoot, adapter)
```

输出级别建议：
- `PASS`: docs repo 可解析，骨架完整
- `INFO`: 未配置 docs repo，当前为 in-repo mode
- `WARNING`: 本地落后远端 / 缺少 `knowledge/index.md`
- `ERROR`: localPath 不存在、不是 git repo、state 中 slug 缺失

**Step 4: Run test to verify it passes**

Run:
- `bash tests/smoke/cli.sh`
- `bash tests/integration/docs-repo-init.sh`
- `bash tests/integration/docs-repo-errors.sh`

Expected: doctor 在 fresh project、in-repo、docs repo mode 三种路径下输出稳定且简洁

**Step 5: Commit**

```bash
git add tests/smoke/cli.sh tests/integration/docs-repo-init.sh tests/integration/docs-repo-errors.sh src/cli/commands/doctor.js src/cli/docs-config.js src/cli/docs-runtime.js src/cli/knowledge.js
git commit -m "feat(doctor): inspect docs repo knowledge health"
```

### Task 5: 固化知识层 schema 与模板

**Files:**
- Create: `templates/docs/draft-page.md`
- Create: `templates/docs/knowledge-page.md`
- Create: `templates/docs/snapshot-manifest.json`
- Create: `scripts/validate-knowledge-tree.js`
- Create: `tests/fixtures/knowledge-invalid/`
- Modify: `skills/spec-bootstrap/SKILL.md`
- Modify: `skills/spec-compound/SKILL.md`
- Modify: `skills/spec-compound/assets/resolution-template.md`
- Modify: `skills/spec-compound/references/schema.yaml`
- Modify: `src/cli/commands/doctor.js`
- Test: `tests/unit/knowledge-schema.sh`
- Test: `tests/unit/knowledge-validator.sh`
- Modify: `package.json`

**Step 1: Write the failing test**

```bash
#!/bin/bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

grep -q "raw/snapshots/<timestamp>" "$REPO_ROOT/skills/spec-bootstrap/SKILL.md"
grep -q "status: draft" "$REPO_ROOT/skills/spec-compound/SKILL.md"
grep -q "status: published" "$REPO_ROOT/skills/spec-compound/SKILL.md"
grep -q "derived_from" "$REPO_ROOT/skills/spec-compound/references/schema.yaml"
node "$REPO_ROOT/scripts/validate-knowledge-tree.js" "$REPO_ROOT/tests/fixtures/knowledge-invalid" >/dev/null 2>&1 && exit 1 || true
```

**Step 2: Run test to verify it fails**

Run:
- `bash tests/unit/knowledge-schema.sh`
- `bash tests/unit/knowledge-validator.sh`

Expected: FAIL because现有 skill 还没有 `raw/draft/knowledge` 三层约束

**Step 3: Write minimal implementation**

模板与 schema 最少覆盖这些字段：

```yaml
id:
title:
type:
status:
owner:
summary:
derived_from:
source_commits:
related:
confidence:
updated_at:
```

约束：
- `raw/` 只追加，不改写
- `draft/` 可综合，但必须保留 `derived_from`
- `knowledge/` 只能承载 `status: published`
- `draft/` 中禁止出现 `status: published`
- `knowledge/` 中禁止缺失 `owner`、`derived_from`、`updated_at`
- 页面正文统一分为：
  - `Purpose`
  - `Key Responsibilities`
  - `Important Flows`
  - `Constraints / Edge Cases`
  - `Open Questions`

实现 `scripts/validate-knowledge-tree.js`，至少校验：

```javascript
1. knowledge/ only contains published pages
2. draft/ never contains published pages
3. published pages must include owner + derived_from + updated_at
```

Phase 1 不校验：
- `related` 的完整性
- canonical id 覆盖率
- taxonomy 归类正确性

这些属于 `Scale` 阶段的知识健康度治理。

发布门禁第一阶段定义为：
- `spec-compound-refresh` 准备发布前必须通过 validator
- `doctor` 对已绑定 docs repo 的项目，或存在本地 `knowledge/` 结构的 in-repo 项目执行 validator，并把失败升级为 `ERROR`
- `knowledge-schema.sh` 负责 source assets / frontmatter / 模板 contract
- `knowledge-validator.sh` 负责 invalid tree / missing owner / published-in-draft 三类失败场景

**Step 4: Run test to verify it passes**

Run:
- `bash tests/unit/knowledge-schema.sh`
- `bash tests/unit/knowledge-validator.sh`

Expected: PASS with schema fields and path contracts present in source assets

**Step 5: Commit**

```bash
git add package.json tests/unit/knowledge-schema.sh tests/unit/knowledge-validator.sh tests/fixtures/knowledge-invalid scripts/validate-knowledge-tree.js templates/docs/draft-page.md templates/docs/knowledge-page.md templates/docs/snapshot-manifest.json skills/spec-bootstrap/SKILL.md skills/spec-compound/SKILL.md skills/spec-compound/assets/resolution-template.md skills/spec-compound/references/schema.yaml src/cli/commands/doctor.js
git commit -m "feat(knowledge): define raw draft knowledge schemas"
```

### Task 6: `spec-bootstrap` 写入原始快照

**Files:**
- Modify: `skills/spec-bootstrap/SKILL.md`
- Test: `tests/smoke/cli.sh`
- Test: `tests/unit/knowledge-schema.sh`

**Step 1: Write the failing test**

在 `tests/smoke/cli.sh` 增加源资产与生成资产断言：

```bash
grep -q 'raw/snapshots/' "$REPO_ROOT/skills/spec-bootstrap/SKILL.md"
grep -q 'raw/snapshots/' "$TMP_DIR/.claude/skills/spec-bootstrap/SKILL.md"
grep -q 'contexts/' "$TMP_DIR/.claude/skills/spec-bootstrap/SKILL.md"
```

**Step 2: Run test to verify it fails**

Run:
- `bash tests/unit/knowledge-schema.sh`
- `bash tests/smoke/cli.sh`

Expected: FAIL because `spec-bootstrap` 目前只生成 context / PRD，不会明确沉淀 raw snapshot

**Step 3: Write minimal implementation**

调整 `skills/spec-bootstrap/SKILL.md`：
- 先定位 docs repo 项目根
- 将 repo scan、module map、dependency surface、entrypoints、risk notes 写入 `raw/snapshots/<timestamp>/`
- 在 `contexts/` 中只保留摘要和导航，不复制全部原始分析
- snapshot manifest 必须包含：

```json
{
  "generated_at": "ISO-8601",
  "repo": "normalized remote",
  "commit": "sha",
  "scope": ["workspace-root", "target-project"],
  "artifacts": ["repo-map.json", "module-analysis.json", "findings.md"]
}
```

Phase 1 不改动：
- `skills/spec-bootstrap/references/prd-template.md`
- `skills/spec-bootstrap/references/database-prd-template.md`

除非后续确认这些模板需要直接引用 snapshot 结构，否则保持解耦。

**Step 4: Run test to verify it passes**

Run:
- `bash tests/unit/knowledge-schema.sh`
- `bash tests/smoke/cli.sh`

Expected: generated runtime skill 明确区分 `raw/` 与 `contexts/`

**Step 5: Commit**

```bash
git add tests/smoke/cli.sh tests/unit/knowledge-schema.sh skills/spec-bootstrap/SKILL.md
git commit -m "feat(spec-bootstrap): persist code analysis snapshots to raw"
```

### Task 7: `spec-compound` / `spec-compound-refresh` 接入 draft/publish 流程

**Files:**
- Modify: `skills/spec-compound/SKILL.md`
- Modify: `skills/spec-compound-refresh/SKILL.md`
- Modify: `skills/spec-compound/assets/resolution-template.md`
- Modify: `skills/spec-compound/references/yaml-schema.md`
- Test: `tests/unit/knowledge-validator.sh`
- Test: `tests/smoke/cli.sh`

**Step 1: Write the failing test**

在 `tests/unit/knowledge-validator.sh` 增加：

```bash
grep -q 'draft/' "$REPO_ROOT/skills/spec-compound/SKILL.md"
grep -q 'published' "$REPO_ROOT/skills/spec-compound/SKILL.md"
grep -q 'owner 审核' "$REPO_ROOT/skills/spec-compound-refresh/SKILL.md"
```

**Step 2: Run test to verify it fails**

Run: `bash tests/unit/knowledge-validator.sh`  
Expected: FAIL because compound 目前只处理 learnings，不区分 draft / published

**Step 3: Write minimal implementation**

职责切分：
- `spec-compound`
  - 从 `raw/` 或 recent `work/reviews` 生成 / 更新 `draft/`
  - 遇到冲突结论写 `conflict` 标记，不覆盖已发布页
- `spec-compound-refresh`
  - 基于最新 snapshot 和既有 `knowledge/` 执行 stale check
  - 将通过 owner 审核的页面发布到 `knowledge/`
  - 更新 `knowledge/index.md` 与 `related` 链接
  - 发布前必须跑 `validate-knowledge-tree.js`

frontmatter 状态机：

```yaml
status: draft | review-required | published | superseded
```

明确发布约束：
- 只有 `spec-compound-refresh` 可以产生 `published`
- `spec-compound` 默认最高只能写到 `review-required`
- 对 `published` 的手工编辑必须重新通过 validator 和 owner review

**Step 4: Run test to verify it passes**

Run:
- `bash tests/unit/knowledge-validator.sh`
- `bash tests/smoke/cli.sh`

Expected: source assets 与生成资产都出现统一的 draft/publish 术语和状态机

**Step 5: Commit**

```bash
git add tests/unit/knowledge-validator.sh tests/smoke/cli.sh skills/spec-compound/SKILL.md skills/spec-compound-refresh/SKILL.md skills/spec-compound/assets/resolution-template.md skills/spec-compound/references/yaml-schema.md
git commit -m "feat(compound): add draft and publish knowledge workflow"
```

### Task 8: `spec-plan` / `spec-work` / `spec-review` 接入知识路由

**Files:**
- Modify: `skills/spec-plan/SKILL.md`
- Modify: `skills/spec-work/SKILL.md`
- Modify: `skills/spec-review/SKILL.md`
- Test: `tests/smoke/cli.sh`
- Test: `tests/unit/workflow-routing.sh`

**Step 1: Write the failing test**

在 `tests/smoke/cli.sh` 增加生成资产断言：

```bash
grep -q 'knowledge/' "$TMP_DIR/.claude/skills/spec-plan/SKILL.md"
grep -q 'draft/' "$TMP_DIR/.claude/skills/spec-work/SKILL.md"
grep -q 'raw/' "$TMP_DIR/.claude/skills/spec-review/SKILL.md"
grep -q '读取顺序' "$REPO_ROOT/skills/spec-plan/SKILL.md"
grep -q 'docs-local.json' "$TMP_DIR/.claude/skills/spec-plan/SKILL.md"
```

**Step 2: Run test to verify it fails**

Run:
- `bash tests/unit/workflow-routing.sh`
- `bash tests/smoke/cli.sh`

Expected: FAIL because plan/work/review 目前先做 repo scan，并没有 agent-first knowledge routing

**Step 3: Write minimal implementation**

统一读取顺序写进三个 skill：

```text
1. knowledge/ 中与任务节点最相关的 canonical pages
2. contexts/ 中的项目级 architecture / bootstrap 摘要
3. draft/ 中高相关但未发布页面
4. raw/ 中对应 snapshot 的证据文件
5. 最后才回到代码仓库
```

并要求研究类 agent 先报告：
- 命中了哪些 knowledge pages
- 哪些结论来自 `knowledge/`
- 哪些是从 `draft/` 或 `raw/` 推断得到
- 当前任务是否应该反向更新知识库

并明确运行时发现链路：
- 优先读 `.claude/spec-first/docs-local.json` 或 `.codex/spec-first/docs-local.json`
- 只有运行时文件缺失时，才回退到项目 state + `~/.spec-first/config.json`
- skill 文案中必须禁止“让 agent 自行猜测 docs repo 路径”

Phase 1 先不改动研究 agent prompt：
- `agents/research/repo-research-analyst.md`
- `agents/workflow/spec-flow-analyzer.md`

先把知识优先读取规则固化到 workflow skill；研究 agent 的细化回传格式可以作为后续增强。

**Step 4: Run test to verify it passes**

Run:
- `bash tests/unit/workflow-routing.sh`
- `bash tests/smoke/cli.sh`

Expected: 生成后的 `spec-plan` / `spec-work` / `spec-review` 均包含一致的知识读取顺序、运行时路径发现链路与回写触发条件

**Step 5: Commit**

```bash
git add tests/unit/workflow-routing.sh tests/smoke/cli.sh skills/spec-plan/SKILL.md skills/spec-work/SKILL.md skills/spec-review/SKILL.md
git commit -m "feat(workflows): route plan work review through knowledge layers"
```

### Task 9: 版本说明、changelog 与回归测试

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `docs/08-版本更新/README.md`
- Modify: `package.json`
- Test: `tests/unit/docs-config.sh`
- Test: `tests/unit/workspace.sh`
- Test: `tests/unit/knowledge-schema.sh`
- Test: `tests/unit/knowledge-validator.sh`
- Test: `tests/unit/workflow-routing.sh`
- Test: `tests/smoke/cli.sh`
- Test: `tests/integration/docs-repo-init.sh`
- Test: `tests/integration/docs-repo-errors.sh`
- Test: `tests/integration/e2e.sh`

**Step 1: Write the failing test**

在回归脚本执行前，先增加 changelog 守卫：

```bash
grep -q 'agent-first spec-docs knowledge system' CHANGELOG.md
```

**Step 2: Run test to verify it fails**

Run:
- `bash tests/unit/docs-config.sh`
- `bash tests/unit/workspace.sh`
- `bash tests/unit/knowledge-schema.sh`
- `bash tests/unit/knowledge-validator.sh`
- `bash tests/unit/workflow-routing.sh`

Expected: tests 通过后，此处仍会因为 changelog / release docs 未更新而失败

**Step 3: Write minimal implementation**

更新：
- `CHANGELOG.md`：增加一条改造摘要，用户可见项标记 `(user-visible)`
- `docs/08-版本更新/README.md`：说明 docs repo 从产物外置升级为 agent-first knowledge substrate
- `package.json`：把新增单测脚本并入 `test:unit` 或新增更细脚本

**Step 4: Run test to verify it passes**

Run:
- `npm run test:unit`
- `npm run test:smoke`
- `npm run test:integration`

Expected:
- unit 覆盖 docs config / workspace / skill contracts
- smoke 覆盖 Claude + Codex 的 init / doctor / runtime asset generation
- integration 用 `docs-repo-init.sh` 覆盖 happy path，用 `docs-repo-errors.sh` 覆盖 dirty working tree、missing localPath、`pull --ff-only` failure，并保留现有 e2e

**Step 5: Commit**

```bash
git add CHANGELOG.md docs/08-版本更新/README.md package.json tests/unit/docs-config.sh tests/unit/workspace.sh tests/unit/knowledge-schema.sh tests/unit/knowledge-validator.sh tests/unit/workflow-routing.sh tests/smoke/cli.sh tests/integration/docs-repo-init.sh tests/integration/docs-repo-errors.sh
git commit -m "feat(knowledge): ship agent-first spec-docs workflow"
```

## 关键设计决定

### 1. 不新增用户可见的顶层 CLI 命令

第一阶段不引入 `spec-first knowledge ...` 新命令，原因：
- 当前仓库定位是 runtime asset installer
- 先复用 `init` / `doctor` / `spec-bootstrap` / `spec-compound` / `spec-compound-refresh`
- 降低 surface area，先验证知识上下文是否提升 workflow 节点质量

### 1.5 Phase 1 默认面向 1 -> 10 团队

本计划默认优化目标是 `1 -> 10` 阶段：
- 已经值得引入 docs repo 与知识编译链
- 还没有大到必须先做平台化治理

这意味着：
- 允许 `0 -> 1` 项目以 `Lite` 模式降级运行
- 明确拒绝把 `10 -> 100` 才需要的治理复杂度提前塞进主链

### 2. `knowledge/` 只承载已发布知识

不得让 `draft/` 直接混入高信任上下文池。  
Agent 默认消费：
- `knowledge/`
- `contexts/`

仅在知识不足时，才显式降级使用：
- `draft/`
- `raw/`

发布门禁由 `validate-knowledge-tree.js` 与 doctor 共同执行，不依赖纯约定。

### 3. `raw/` 作为不可改写证据层

不要把 `raw/` 当临时缓存。它必须是：
- 按 snapshot 版本化
- 带 commit SHA
- 带 analyzer / scope / timestamp
- 可被后续知识页追溯

### 4. owner 审核先用 Git + frontmatter，不做平台化审批

第一阶段发布门禁仅依赖：
- `status`
- `owner`
- git review / PR

不引入额外数据库或审批系统。

## 验证矩阵

- 配置层：
  - 未配置 docs repo 时保持 in-repo 行为
  - `--docs-repo` / `--docs-local-path` / `--global` 参数生效
  - 配置 `defaultDocsRepo` 时可以自动绑定 localPath
  - project state 优先级高于 workspace state，高于 global default
  - 运行时 `docs-local.json` 能被 Claude / Codex 共同读取
  - `Lite` 模式下未配置 docs repo 仍能继续工作
- 发现层：
  - `pnpm-workspace.yaml`
  - `package.json#workspaces`
  - heuristic fallback
  - docs repo 目录排除
  - slug 冲突检测
- 骨架层：
  - 创建 `raw/`、`draft/`、`knowledge/`
  - 创建 `README.md`
  - 创建 `knowledge/index.md`
  - 创建运行时本地 docs context 文件
- skill 合约层：
  - `spec-bootstrap` 写 `raw/`
  - `spec-compound` 写 `draft/`
  - `spec-compound-refresh` 负责 publish
  - `spec-plan` / `spec-work` / `spec-review` 有统一知识读取顺序
  - publish validator 能拦截 `draft` 中的 `published` 页面
- 失败路径：
  - docs repo localPath 缺失
  - localPath 不是 git repo
  - working tree 脏
  - `pull --ff-only` 失败
  - Codex 运行时路径与 Claude 一致通过
  - `Lite` 模式降级路径不阻断 init / doctor 主流程

- 测试组织：
  - `docs-repo-init.sh` 只验证 happy path
  - `docs-repo-errors.sh` 专门验证失败路径
  - `knowledge-schema.sh`、`knowledge-validator.sh`、`workflow-routing.sh` 分别验证 schema、validator、workflow contract

## 实施顺序建议

1. Task 1 到 Task 4 先完成 CLI 基座
2. Task 5 到 Task 7 完成知识编译链
3. Task 8 接入核心 workflow
4. Task 9 做 changelog、发布说明和全量回归

## 风险与缓解

- 风险：docs repo 初始化逻辑与现有 `init` 耦合过深  
  缓解：把解析、发现、骨架写入都抽到独立模块，`init.js` 只做 orchestration

- 风险：skills 文本修改后，生成资产的 smoke 断言容易脆  
  缓解：测试断言只检查关键 contract，不绑定大段文案

- 风险：单个测试脚本承担过多职责，导致失败定位成本过高  
  缓解：按 `happy path / error path / schema / validator / workflow routing` 拆分测试脚本，避免大而全测试

- 风险：`draft` / `knowledge` 职责不清导致后续页面失控  
  缓解：frontmatter 状态机、统一模板、`knowledge/` 只允许 `published`、validator 强制执行路径规则

- 风险：Agent 仍然习惯直接扫代码，知识库被边缘化  
  缓解：在 `spec-plan` / `spec-work` / `spec-review` 中强制先读知识层，再执行 repo research，并通过运行时 docs context 文件避免路径发现失败

- 风险：把 `Team` 模式的治理强度错误下放到 `0 -> 1` 项目，导致 adoption 成本过高  
  缓解：明确 `Lite / Team / Scale` 三档模式，Phase 1 默认只做 `Team`，并允许 `Lite` 模式降级运行

- 风险：过早为 `10 -> 100` 设计复杂治理，拖慢主链交付  
  缓解：把 taxonomy、shared routing、知识健康度等规模化能力显式标记为 Phase 2+，不进入第一阶段主链
