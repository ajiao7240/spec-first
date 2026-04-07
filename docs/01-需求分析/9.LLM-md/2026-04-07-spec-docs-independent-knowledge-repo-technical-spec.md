# spec-first 独立知识库 — 完整技术方案

> 文档性质：可执行技术方案（替代已废弃的 2026-04-06 两份混血文档）
> 版本：1.0
> 撰写日期：2026-04-07
> 前置文档：
>   - docs/01-需求分析/8.独立知识库/spec-first-独立文档仓库方案-v2.md（存储/管理基础设施，完整有效，本文直接复用）
>   - docs/01-需求分析/7.项目知识/spec-first-harness-engineering-实施分期（控制面改造，独立线索，本文不涉及）

---

## 背景与决策依据

### 为何重写文档

2026-04-06 生成的两份 LLM-md 文档（knowledge-architecture.md、knowledge-plan.md）存在根本性问题：将两套不同架构强行拼合：

- **Harness Engineering 架构**：控制面资产（.context/spec-first/）、spec_id/run_id、三阶段演进（高ROI改造→反馈回流→自进化）
- **Independent Docs Repo 架构**：独立 git 仓库、raw→draft→knowledge 三层、LLM Wiki 知识生命周期

这导致 contexts/ 定义缺失、读取顺序自相矛盾、spec-compound 职责冲突、运行时路径约定冲突等一系列不一致。本文从零重建，基于**独立 docs repo 方案**，明确回答四个核心问题：知识库记录什么、如何管理、如何使用、如何维护更新。

### 四个核心决策

| 维度 | 决策 | 理由 |
|---|---|---|
| 产出内容 | 项目理解（bootstrap）+ 团队经验（compound）为第一优先级 | 这两类知识复用价值最高、生命周期最长，plans/brainstorms 等短命产物暂不纳入 |
| 存储模式 | 独立 Git 仓库（spec-docs） | 解耦文档与代码、支持跨项目共享、允许非开发角色访问 |
| 消费方式 | Agent 优先 | spec-plan/work/review 启动时先读知识库，不足时才回退代码分析 |
| 维护方式 | Phase 1 轻量（source_commit + diff_count doctor 巡检），Phase 2+ 增强（stale 标记、compound-refresh） | 优先保证可用，不引入发布门禁 |

---

## 一、产出内容：知识库记录什么

### 1.1 第一优先级：项目理解（spec-bootstrap 产物）

存放位置：`<docs-repo>/<slug>/contexts/`

| 产物路径 | 内容 | 消费方 | 更新频率 |
|---|---|---|---|
| `contexts/00-summary.md` | 项目一句话定位、技术栈、核心模块列表 | spec-plan / spec-work | 月级（bootstrap 重跑） |
| `contexts/architecture/system-overview.md` | 系统架构图、模块边界、数据流向 | spec-plan / spec-review | 月级 |
| `contexts/architecture/module-map.md` | 模块职责、依赖关系、公开接口 | spec-plan / spec-work | 月级 |
| `contexts/architecture/integration-boundaries.md` | 外部集成点、API 契约、协议边界 | spec-plan | 月级 |
| `contexts/pitfalls/index.md` | 已知陷阱、技术债、踩过的坑 | spec-plan / spec-work / spec-review | 月级（bootstrap 重跑） |
| `contexts/layers/<layer>/index.md` | 各层（frontend/backend/data/cli）的内部结构 | spec-work | 月级 |
| `contexts/database/database-er.md` | 数据模型 ER 图、表关系、索引策略 | spec-plan / spec-work | 月级 |

这些是**稳定知识**——项目结构大改后重跑 spec-bootstrap 全量刷新，平日不会因功能开发而变化。frontmatter 记录 `updated_at` + `source_commit`（bootstrap 执行时的 HEAD），供 doctor 陈旧检测使用。

frontmatter schema：

```yaml
---
slug: <project-slug>
source_commit: <git-sha>
updated_at: <ISO 8601>
generated_by: spec-bootstrap
---
```

### 1.2 第一优先级：团队经验（spec-compound 产物）

存放位置：`<docs-repo>/<slug>/solutions/`

目录结构继承现有 `docs/solutions/` 约定（不破坏现有内容组织方式）：

```
solutions/
├── build-errors/
├── test-failures/
├── runtime-errors/
├── architecture-decisions/
└── ...（按问题类型分类）
```

每个条目的 frontmatter schema：

```yaml
---
slug: <project-slug>
problem_type: <build-error|test-failure|runtime-error|architecture-decision|...>
severity: <critical|high|medium|low>
confidence: <high|medium|low>
affected_modules:
  - <module-name>
pattern_type: <incident|antipattern|best-practice>
source_commit: <git-sha at time of compound>
last_verified_commit: <git-sha>（Phase 2+）
created_at: <ISO 8601>
updated_at: <ISO 8601>
---
```

这是**复利知识**——每次解决问题后通过 spec-compound 沉淀，后续遇到相似问题直接复用。

### 1.3 暂不纳入知识库

| 产物 | 理由 |
|---|---|
| plans（spec-plan 产出） | 面向特定需求，生命周期短，不适合作为长期知识 |
| brainstorms / ideation | 探索性文档，不确定性强，不适合高信任知识库 |
| review findings（spec-review 产出） | 面向特定 PR/分支，短命；其中的 recurring patterns 通过 compound 进入知识库 |

**Phase 1 不引入 draft/published 分层**，所有写入即生效（与当前 in-repo 行为一致）。知识信任度由 frontmatter 的 `confidence` 和 `source_commit` 体现，不做发布门禁。

---

## 二、知识库管理：存储与配置

> 本节基于 v2 文档（8.独立知识库/spec-first-独立文档仓库方案-v2.md），提炼与本方案直接相关的部分。

### 2.1 存储架构

```
spec-docs/                              ← 独立 Git 仓库（团队共同维护）
├── _shared/                            ← 跨项目共享（Phase 2+）
│   ├── patterns/
│   ├── rules/
│   └── playbooks/
├── <project-slug>/
│   ├── README.md                       ← init 时写入，含 slug/project-path/workspace-repo/created-by/created-at
│   ├── contexts/                       ← spec-bootstrap 产物（项目理解）
│   │   ├── 00-summary.md
│   │   ├── architecture/
│   │   │   ├── system-overview.md
│   │   │   ├── module-map.md
│   │   │   └── integration-boundaries.md
│   │   ├── pitfalls/
│   │   │   └── index.md
│   │   ├── layers/
│   │   │   └── <layer>/index.md
│   │   └── database/
│   │       └── database-er.md
│   └── solutions/                      ← spec-compound 产物（团队经验）
│       ├── build-errors/
│       ├── test-failures/
│       └── ...
├── <project-slug-2>/
│   └── ...
```

> `contexts/guides/` 在 v2 原始目录树中存在，本方案**不创建**该目录——它是 spec-first 运维类文档的预留位，不属于 bootstrap/compound 产物，Phase 2+ 再评估是否纳入。init 骨架创建时不建 guides/。

### 2.2 配置层级与解析优先级

```
project 级  →  <project>/.claude/spec-first/state.json 的 docsRepo + docsProjectSlug 字段
workspace 级 →  <workspace>/.spec-first/state.json 的 docsRepo 字段
global 级   →  ~/.spec-first/config.json 的 defaultDocsRepo + docsRepos 路径映射
fallback    →  in-repo（项目内 docs/ 目录，零变化）
```

解析优先级：project > workspace > global > in-repo fallback

### 2.3 关键数据文件

**project state**（现有 `.claude/spec-first/state.json`，新增可选字段）：

```json
{
  "manifestVersion": "1.5.0",
  "platform": "claude",
  "docsRepo": "git@github.com:org/spec-docs.git",
  "docsProjectSlug": "my-project"
}
```

**workspace state**（新增 `<workspace>/.spec-first/state.json`）：

```json
{
  "specFirstVersion": "1.5.0",
  "docsRepo": "git@github.com:org/spec-docs.git",
  "detectedAs": "pnpm",
  "projects": {
    "project-A": { "path": "./project-A", "slug": "project-A", "status": "active" },
    "project-B": { "path": "./project-B", "slug": "project-B", "status": "active" }
  }
}
```

> workspace state 是本方案**新增**的文件，与 project state（`.claude/spec-first/state.json`）是不同文件。版本字段统一使用 `specFirstVersion`（与 project state 的 `manifestVersion` 字义不同：manifestVersion 跟踪资产清单版本，specFirstVersion 跟踪 CLI 版本），避免混淆。

**global config**（`~/.spec-first/config.json`，个人，不 commit）：

```json
{
  "defaultDocsRepo": "git@github.com:org/spec-docs.git",
  "docsRepos": {
    "github.com/org/spec-docs": "/Users/kuang/projects/spec-docs"
  }
}
```

**运行时私有文件**（`.claude/spec-first/docs-local.json`，供 skill 读取，不 commit）：

```json
{
  "localPath": "/Users/kuang/projects/spec-docs",
  "repo": "github.com/org/spec-docs",
  "slug": "my-project",
  "resolvedAt": "2026-04-07T10:00:00Z"
}
```

### 2.4 spec-first 对知识库的职责边界

```
知道它在哪里（localPath）                   ✓
写入文档时 commit + push                    ✓
首次便捷 clone（可选辅助）                  ✓
init 时执行 git pull --ff-only（init 特例） ✓  ← init 必须先同步再创建目录，防 push 冲突

替代开发者管理 git 工作流                   ✗
skill 写入文档时自动 pull                   ✗  ← skill 只做预检+提示，不拉取，不打断工作流
管理分支或 merge 策略                       ✗
```

---

## 三、知识库消费：Agent 如何读取

### 3.1 读取路径发现

skill 启动时的知识库路径解析链：

```
1. 读 .claude/spec-first/docs-local.json（优先，最快）
2. 不存在时，读 state.json 的 docsRepo + ~/.spec-first/config.json 的 docsRepos 查 localPath
3. 仍无 → 回退 in-repo docs/
```

`docs-local.json` 由 `spec-first init` 写入，包含已解析的 `localPath` 和 `slug`，避免 skill 每次重复解析配置链路。

**失效与刷新**：docs-local.json 是 init 时的快照，以下情况会导致内容过期：
- 用户修改了 `~/.spec-first/config.json` 的 `docsRepos` 映射（改了 localPath）
- docs repo 被迁移，state.json 的 `docsRepo` 已更新

skill 读取 docs-local.json 时，若 `localPath` 指向的目录不存在或不是 git 仓库，视为失效：
```
localPath 校验失败 → 自动降级：重新走 resolveDocsConfig 链路动态解析
                    → 解析成功 → 使用动态结果（但不自动重写 docs-local.json，需手动 re-init）
                    → 解析失败 → 回退 in-repo 模式 + WARNING：建议重跑 spec-first init
```
重写 docs-local.json 的唯一入口是 `spec-first init`，不自动发生。

### 3.2 知识读取顺序（Agent 消费顺序）

spec-plan / spec-work / spec-review 启动时：

```
1. 读 docs-local.json → 得到 localPath 和 slug
2. 读 <localPath>/<slug>/contexts/00-summary.md       ← 快速定位项目
3. 读 <localPath>/<slug>/contexts/architecture/module-map.md  ← 了解模块边界
4. 读 <localPath>/<slug>/contexts/pitfalls/index.md   ← 避开已知陷阱
5. 按当前任务相关性，读 <localPath>/<slug>/solutions/ 中的相关条目  ← 复用经验
6. 以上不足时，才回退到项目代码分析
```

### 3.3 各 Skill 的读取触发点

| Skill | 触发时机 | 优先读取内容 |
|---|---|---|
| spec-plan | 生成计划前 | contexts/（项目理解）+ solutions/（相似问题经验） |
| spec-work | 执行任务前 | contexts/pitfalls/ + solutions/（相关经验）|
| spec-review | 审查代码前 | contexts/architecture/（预期结构）+ solutions/（已知问题模式）|
| spec-bootstrap | 分析完成后写入 | 写入 contexts/（不读，自己是生产方）|
| spec-compound | 问题解决后写入 | 写入 solutions/（不读，自己是生产方）|

### 3.4 知识不足时的回退策略

```
contexts/ 不存在 → 提示："项目理解文档缺失，建议先运行 spec-bootstrap"
                    → 回退：直接分析项目代码（当前行为）

solutions/ 不存在 → 无提示，静默跳过（正常情况，新项目还没有积累）

docs-local.json 不存在 → 提示："知识库未配置，使用项目内 docs/ 目录"
                           → 回退：in-repo 模式（当前行为）
```

---

## 四、知识库维护：陈旧检测与更新

### 4.1 更新触发机制

| 触发方 | 时机 | 更新内容 |
|---|---|---|
| spec-bootstrap（手动重跑） | 项目结构大改后 | contexts/ 全量刷新 |
| spec-compound | 解决问题后 | solutions/ 新增条目 |
| spec-compound-refresh（Phase 2+） | 定期或感知到陈旧 | 标记 stale、合并重复、更新过期内容 |
| doctor（巡检） | 每次 doctor 执行 | 报告知识覆盖率和陈旧状态 |

### 4.2 陈旧检测策略

**Phase 1（轻量）**：

```
contexts/ 的每个文件 frontmatter 记录：
  source_commit: <bootstrap 执行时的项目 HEAD SHA>
  updated_at: <ISO 8601>

doctor 巡检逻辑：
  project_head = git -C <project-path> rev-parse HEAD
  bootstrap_commit = contexts/00-summary.md 的 source_commit
  diff_count = git -C <project-path> rev-list <bootstrap_commit>..HEAD --count

  diff_count > 50  → WARNING: contexts/ 可能已陈旧（自上次 bootstrap 已有 N 个提交）
  diff_count > 200 → ERROR: contexts/ 严重陈旧，强烈建议重跑 spec-bootstrap
  bootstrap_commit 不在项目历史中 → WARNING: 无法检测陈旧（force push 或仓库重建），跳过计数

  阈值（Phase 1 硬编码，Phase 2+ 可通过 global config 的 staleness.warningThreshold /
  staleness.errorThreshold 字段覆盖）：
    warningThreshold: 50
    errorThreshold:   200
```

**Phase 2+（增强）**：

- solutions/ 的 frontmatter 记录 `affected_modules` + `last_verified_commit`
- spec-work 完成后自动触发相关 solution 的验证标记更新
- compound-refresh 定期全量扫描，标记 `confidence: stale` 的条目

### 4.3 知识生命周期

```
产出（bootstrap/compound 写入）
  → 存入知识库 contexts/ 或 solutions/（commit + push）
  → 被 plan/work/review 消费（读取 docs-local.json → 读知识库）
  → 陈旧检测（doctor 巡检 / compound-refresh）
  → 更新（重跑 bootstrap / 更新 solution）或标记 stale
  → 极端情况：归档或删除（人工操作，spec-first 不自动删除）
```

---

## 五、分阶段实施路线

### Phase 1：CLI 基座（当前实施范围）

**目标**：spec-first 能绑定 docs repo、创建项目骨架、检查健康状态。Skill 仍写 in-repo，但 CLI 基座就绪，为 Phase 2 铺路。

**约束**：
- 所有 skill 的 SKILL.md 不动
- in-repo 模式的任何行为零变化
- adapters / plugin.js / developer.js 不动

**Phase 1 已知限制**：

| 限制 | 说明 | 计划阶段 |
|---|---|---|
| 分支保护 | spec-docs main 分支开启 protected branch 时，Phase 1 的 push 会直接失败，无降级路径。需要 `--docs-branch` 参数支持推到特性分支。 | Phase 2 |
| Codex 平台 | Phase 1 只支持 Claude adapter（`.claude/` 路径体系）。Codex 下的 docs-local.json 路径未处理。 | Phase 2 |
| docs/solutions/ 迁移 | 现有 in-repo solutions 不自动迁移，需要手动或 Phase 2 的迁移工具。 | Phase 2 |

### Phase 2：产出接入

**目标**：spec-bootstrap 和 spec-compound 实际写入 docs repo。

改动范围：
- `skills/spec-bootstrap/SKILL.md` — 检测 docs-local.json，有则写入知识库 contexts/
- `skills/spec-compound/SKILL.md` — 检测 docs-local.json，有则写入知识库 solutions/
- `skills/spec-compound-refresh/SKILL.md` — 操作知识库 solutions/ 而非 in-repo

**docs/solutions/ 迁移策略**：

```
现有 in-repo 的 docs/solutions/ 内容保留原位（不强制迁移）
spec-compound 新产出写入知识库 solutions/（有 docs-local.json 时）
两套路径并存过渡期：doctor 提示哪些 solution 尚未迁移到知识库
```

Phase 2 末尾专门有一个迁移 Task（见下方 Phase 2 Task 列表）。

**Phase 2 Task 列表（粗粒度）**：

| Task | 内容 |
|---|---|
| P2-T1 | `skills/spec-bootstrap/SKILL.md`：检测 docs-local.json，有则写入知识库 contexts/ |
| P2-T2 | `skills/spec-compound/SKILL.md`：检测 docs-local.json，有则写入知识库 solutions/ |
| P2-T3 | `skills/spec-compound-refresh/SKILL.md`：操作知识库 solutions/ 而非 in-repo |
| P2-T4 | `spec-first migrate-solutions` CLI 命令：将 in-repo `docs/solutions/` 批量迁移到知识库 `solutions/`，命令格式：`spec-first migrate-solutions --from <project-root> --to <docs-local-path>` |
| P2-T5 | `--docs-branch <branch>` 参数：支持推到特性分支（分支保护场景，见 v2 §8.7）|

Phase 2 详细任务分解在 Phase 2 立项时单独补充。

### Phase 3：消费接入

**目标**：spec-plan/spec-work/spec-review 启动时优先读取知识库。

改动范围：
- `skills/spec-plan/SKILL.md` — 加入第三节"知识读取顺序"（见本文 §3.2）
- `skills/spec-work/SKILL.md` — 同上
- `skills/spec-review/SKILL.md` — 同上

### Phase 4：维护增强

**目标**：陈旧检测、知识健康度仪表盘、跨项目共享。

改动范围：
- doctor 扩展：知识覆盖率报告、陈旧检测（见 §4.2 Phase 2+ 部分）
- compound-refresh 支持知识库级别的全量陈旧扫描
- `_shared/` 跨项目知识路由（doc 级别的 `shared: true` 标记 → 自动同步到 _shared/）

---

## 六、Phase 1 详细任务分解

### Task 1：docs-config.js — 配置读写模块

**新增**：`src/cli/docs-config.js`

```javascript
// 公开 API
function getGlobalConfigPath()                          // ~/.spec-first/config.json
function readGlobalConfig()                             // 容忍文件不存在和 JSON 损坏
function writeGlobalConfig(config)                      // 整体覆盖
function upsertDocsRepoMapping(url, localPath)          // 更新 docsRepos 映射
function normalizeGitUrl(url)                           // git@/https/.git → host/org/repo
function resolveDocsConfig(startDir, options)
  // startDir：配置查找的起点目录（单项目时=项目根，workspace 模式时=workspace 根）
  // 从 startDir 向上查找 project state → workspace state → global config
  // options 中的命令行参数（docsRepo/docsLocalPath）优先级最高
  // 返回：{ repo: string|null, localPath: string|null, slug: string|null, source: 'cli'|'project'|'workspace'|'global'|'fallback' }
function validateLocalPath(localPath)                   // 是否为有效 git 仓库（git rev-parse --git-dir）
function writeDocsLocalConfig(projectRoot, adapter, data) // 写 .claude/spec-first/docs-local.json
function readDocsLocalConfig(projectRoot, adapter)      // 读 docs-local.json
```

`normalizeGitUrl` 规则：

| 原始形式 | 规范化结果 |
|---|---|
| `git@github.com:org/spec-docs.git` | `github.com/org/spec-docs` |
| `https://github.com/org/spec-docs.git` | `github.com/org/spec-docs` |
| `https://github.com/org/spec-docs` | `github.com/org/spec-docs` |

**测试**：`tests/unit/docs-config.sh`

```bash
# 测试矩阵
# 1. URL 规范化：SSH / HTTPS / 无 .git 后缀 / 不合法 URL
# 2. readGlobalConfig：文件不存在 / JSON 损坏 / 正常读取
# 3. writeGlobalConfig + readGlobalConfig 往返
# 4. upsertDocsRepoMapping：新增 / 覆盖已有 / URL 规范化后相同
# 5. resolveDocsConfig 解析优先级：project > workspace > global > fallback
# 6. validateLocalPath：存在且是 git repo / 存在但不是 git repo / 不存在
# 7. writeDocsLocalConfig + readDocsLocalConfig 往返
```

---

### Task 2：state.js — 独立 docs 字段读写函数

**背景约束**：`normalizeState` 采用固定字段集，`writeState` 直接 `JSON.stringify(normalizeState(...))`。若在 `normalizeState` 里添加 docs 字段，空字符串会写入所有 state.json，污染未配置 docs repo 的项目。因此**不修改 `normalizeState`**，改为在 `state.js` 中新增独立的 docs 字段读写函数。

**修改**：`src/cli/state.js`，新增两个导出函数：

```javascript
/**
 * 读取 state.json 中的 docs 字段（可能不存在）。
 * 不经过 normalizeState，直接读原始 JSON，避免被现有 schema 过滤掉。
 */
function readDocsFields(projectRoot, adapter) {
  const statePath = getStateFilePath(projectRoot, adapter);
  if (!fs.existsSync(statePath)) return {};
  try {
    const raw = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    const result = {};
    if (typeof raw.docsRepo === 'string' && raw.docsRepo) result.docsRepo = raw.docsRepo;
    if (typeof raw.docsProjectSlug === 'string' && raw.docsProjectSlug) result.docsProjectSlug = raw.docsProjectSlug;
    return result;
  } catch {
    return {};
  }
}

/**
 * 将 docs 字段合并写入 state.json（仅在非空时写入，空值时删除该键）。
 * 与 normalizeState 管理的字段共存，互不干扰。
 */
function writeDocsFields(projectRoot, adapter, { docsRepo, docsProjectSlug }) {
  const statePath = getStateFilePath(projectRoot, adapter);
  let existing = {};
  if (fs.existsSync(statePath)) {
    try { existing = JSON.parse(fs.readFileSync(statePath, 'utf8')); } catch {}
  }
  if (docsRepo) existing.docsRepo = docsRepo;
  else delete existing.docsRepo;
  if (docsProjectSlug) existing.docsProjectSlug = docsProjectSlug;
  else delete existing.docsProjectSlug;
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, `${JSON.stringify(existing, null, 2)}\n`, 'utf8');
}
```

**不变约束**：
- `normalizeState`、`writeState`、`buildState` 完全不改动
- 现有所有读取 state.json 的逻辑不受影响
- docs 字段只在值非空时写入，空值时删除，永远不产生 `"docsRepo": ""` 噪音

**测试**：新建 `tests/unit/state.sh`

```bash
# 1. 从无 docs 字段的 state.json 读取 → 返回空对象
# 2. writeDocsFields 写入非空值 → 文件里出现对应键
# 3. writeDocsFields 写入空值 → 对应键从文件删除
# 4. writeDocsFields 不破坏 normalizeState 管理的其他字段（manifestVersion 等）
# 5. 现有 smoke test 全量回归通过（不破坏现有字段）
```

---

### Task 3：workspace.js — 检测与项目发现

**新增**：`src/cli/workspace.js`

```javascript
// 公开 API
function detectWorkspace(cwd)
  // → { type: 'pnpm'|'npm'|'turbo'|'nx'|'heuristic'|'single', root: string }
  // 按 §2.2 优先级检测，返回第一命中

function discoverProjects(root, type, options)
  // → [{ path: string, relPath: string }]
  // type='pnpm'|'npm'|'turbo'|'nx' 时用精确模式（读 workspace 声明展开 glob）
  // type='heuristic'|'single' 时用启发式扫描
  // options.docsRepoUrl 用于排除 docs-repo 目录

function hasProjectMarker(dir)
  // → boolean
  // 检查 package.json / go.mod / Cargo.toml / pyproject.toml / pom.xml / build.gradle

function isDocsRepoDirectory(dir, docsRepoUrl, docsLocalPath)
  // → boolean
  // 双层排除（绝对路径比较 + git remote URL 比较）

function sanitizeSlug(raw)
  // → string
  // 规则：大写→小写 / 空格→- / 长度≤64 / 不合法字符报错

function inferSlug(projectPath)
  // → string
  // git remote get-url origin → 取最后一段去 .git → fallback 目录名

function isReservedSlug(slug)
  // → boolean
  // _shared / _meta / _global

function resolveSlugs(projects, options)
  // → [{ path: string, slug: string }] | throws（冲突时）
  // 批量推断 + 冲突检测（同一次 init 内）
  // options.slugMap: { [relPath]: slug }（--slug-map 参数覆盖）
  // options.slugPrefix: string（--slug-prefix 统一前缀）

function readWorkspaceState(root)
  // → object | null
function writeWorkspaceState(root, state)
  // → void
```

**测试**：`tests/unit/workspace.sh`

```bash
# 1. detectWorkspace：pnpm-workspace.yaml / package.json#workspaces / turbo.json / nx.json / 启发式（≥2子目录有标记）/ 单项目
# 2. discoverProjects（pnpm 精确模式）：glob 展开 / 目录不存在时跳过
# 3. discoverProjects（启发式）：排除 node_modules / .* / dist 等
# 4. isDocsRepoDirectory：绝对路径命中 / git remote 命中 / 两者均未命中
# 5. sanitizeSlug：正常 / 大写 / 空格 / 超长 / 不合法字符
# 6. inferSlug：有 git remote / 无 git remote fallback 目录名
# 7. isReservedSlug：_shared / _meta / _global / 正常值
# 8. resolveSlugs：正常 / 冲突报错 / --slug-map 覆盖 / --slug-prefix 前缀
```

---

### Task 4：init.js — 参数扩展与 workspace 路径分叉

**修改**：`src/cli/commands/init.js`

**新增参数**（`parseInitArgs` 扩展）：

```
--docs-repo <url>           docs 仓库 URL
--docs-local-path <path>    docs 仓库本地克隆路径
--slug <name>               手动指定单项目 slug（workspace 模式下指定当前项目）
--slug-map <map>            workspace 模式：手动指定多个 slug（格式：proj-A=slug-a,proj-B=slug-b）
--slug-prefix <prefix>      workspace 模式：为所有 slug 加统一前缀
--global                    将 --docs-repo 写入 ~/.spec-first/config.json 的 defaultDocsRepo（全局默认）
```

**参数写入目标说明**（两个参数的写入位置不受 `--global` 控制各自独立）：

| 参数 | 写入位置 | 理由 |
|---|---|---|
| `--docs-repo <url>` 不带 `--global` | `<workspace>/.spec-first/state.json` 或 `<project>/.claude/spec-first/state.json` | 团队共享，commit 进代码库 |
| `--docs-repo <url>` 带 `--global` | 同上 **+** `~/.spec-first/config.json` 的 `defaultDocsRepo` | 同时设为个人全局默认 |
| `--docs-local-path <path>` | **始终**写入 `~/.spec-first/config.json` 的 `docsRepos` 映射 | 个人配置，路径因人而异，不 commit，不受 `--global` 控制 |

**`runInit` 新增 workspace 路径分叉**：

```javascript
async function runInit(args) {
  const workspace = detectWorkspace(cwd)

  if (workspace.type !== 'single') {
    return runWorkspaceInit(workspace, args)
  }

  // 单项目模式
  if (args.docsRepo || args.docsLocalPath) {
    // 写入 project state docs 字段 + docs-local.json
    await configureDocsForProject(projectRoot, args)
  }
  // 其余逻辑走现有路径（不变）
  return runSingleProjectInit(args)
}
```

**新增 `runWorkspaceInit`**：

```javascript
async function runWorkspaceInit(workspace, args) {
  // 1. 解析 docs 配置（resolveDocsConfig）
  const docsConfig = await resolveDocsConfig(workspace.root, args)
  if (!docsConfig.localPath) {
    // 引导流程：提示配置 docs-local-path，当前 workspace 降级 in-repo
    printDocsLocalPathGuide(docsConfig.repo)
    // runWorkspaceInitWithoutDocs：对 workspace 下每个子项目调用现有单项目 init 逻辑
    // （不传 docs 参数），行为等同于在每个子目录里执行 spec-first init --claude
    // 只写入 .claude/ 资产（skills/agents/commands），不创建 docs 骨架
    return runWorkspaceInitWithoutDocs(workspace, args)
  }

  // 2. 校验 localPath（validateLocalPath）
  // 3. working tree 预检（git status --porcelain）
  // 4. git pull --ff-only（非快进则报错）
  // 5. 发现子项目 + 推断 slug（discoverProjects + resolveSlugs）
  // 6. 检查每个 slug 的冲突（对比 README.md）
  // 7. 创建新 slug 的目录骨架（contexts/ + solutions/）
  // 8. 写入 README.md（frontmatter 含 slug/project-path/workspace-repo/created-by/created-at）
  // 9. 写入 workspace state（.spec-first/state.json）
  // 10. git add + commit + push
  // 11. 写入每个子项目的 docs-local.json（.claude/spec-first/docs-local.json）
}
```

**测试**：`tests/integration/docs-repo-init.sh`

```bash
# 使用 git init 创建临时 bare repo 作为 docs-repo 远端
# 测试矩阵：
# 1. workspace 模式端到端：pnpm workspace + 3 个子项目 → docs repo 建好 3 个 slug 目录
# 2. 单项目 + --docs-repo + --docs-local-path → 写入 state.json + docs-local.json
# 3. 未配置 docs 时 → in-repo 模式（回归，现有行为不变）
# 4. 重复 init（幂等）→ 已存在 slug 跳过，不报错，不重复 commit
# 5. 错误路径：
#    - --docs-local-path 不存在 → 提示引导
#    - --docs-local-path 存在但非 git repo → 报错
#    - docs repo working tree 脏 → 报错，中止
#    - docs repo ff-only 失败（人工制造分叉）→ 报错，中止
#    - slug 冲突（同一 init 两个项目同名）→ 报错，提示 --slug-map
```

---

### Task 5：doctor.js — workspace 检查扩展

**修改**：`src/cli/commands/doctor.js`

**新增检查项**：

```javascript
// 知识库健康检查（新增，现有检查不动）
async function checkDocsRepoHealth(projectRoot) {
  // 1. 检查 docs-local.json 是否存在
  //    → 不存在：INFO（未配置知识库）
  // 2. 检查 localPath 是否有效（validateLocalPath）
  //    → 无效：ERROR
  // 3. 检查本地与远端同步状态（git -C localPath rev-list HEAD..@{u} --count）
  //    → 落后 N 个提交：WARNING
  // 4. 检查 slug 目录是否存在（<localPath>/<slug>/）
  //    → 不存在：WARNING（建议重跑 init）
  // 5. 检查 contexts/00-summary.md 是否存在
  //    → 不存在：INFO（建议运行 spec-bootstrap）
  // 6. 陈旧检测（Phase 1 轻量版）
  //    → source_commit 存在时：计算 diff_count
  //    → diff_count > 50：WARNING
  //    → diff_count > 200：ERROR
}
```

**测试**：追加到 `tests/smoke/cli.sh` + `tests/integration/docs-repo-init.sh`

```bash
# 追加 doctor 验证场景：
# 1. docs-local.json 不存在 → INFO 输出
# 2. localPath 有效 + 已同步 → 无 WARNING
# 3. 模拟落后远端 → WARNING
# 4. slug 目录不存在 → WARNING 建议 init
# 5. source_commit 存在 + diff > 50 → WARNING 建议 bootstrap
```

---

### Task 6：回归与集成

**更新**：

- `package.json` 新增测试脚本，并扩展现有 `test:integration` 和 `test` 命令：
  ```json
  "test:unit:docs-config": "bash tests/unit/docs-config.sh",
  "test:unit:workspace": "bash tests/unit/workspace.sh",
  "test:unit:state": "bash tests/unit/state.sh",
  "test:integration:docs-repo": "bash tests/integration/docs-repo-init.sh",
  "test:integration": "bash tests/integration/... && bash tests/integration/docs-repo-init.sh",
  "test": "npm run test:smoke && npm run test:integration && npm run test:unit:docs-config && npm run test:unit:workspace && npm run test:unit:state"
  ```
  注：`test:integration` 的现有命令保留，追加 `&& bash tests/integration/docs-repo-init.sh`；`test` 脚本追加三个新 unit 脚本。
- `spec-first --help` 更新（新增 `--docs-repo`、`--docs-local-path`、`--global` 等参数说明）
- `CHANGELOG.md` 更新

---

## 七、验证标准

Phase 1 完成的判定条件：

```bash
# CLI 功能
spec-first init --claude \
  --docs-repo git@github.com:org/spec-docs.git \
  --docs-local-path ~/projects/spec-docs \
  --global
# → 完成全局配置绑定，写入 ~/.spec-first/config.json

spec-first init --claude
# → 在 workspace 下自动发现子项目，在 spec-docs 中建好目录骨架，写入 workspace state

spec-first doctor
# → 输出 docs repo 健康状态（localPath 有效、同步状态、slug 目录完整性）

# 回归：未配置 docs repo 时
spec-first init --claude
# → 所有现有行为零变化

# 自动化测试
npm run test:smoke                    # 全部通过
npm run test:integration              # 全部通过
bash tests/unit/docs-config.sh        # 全部通过
bash tests/unit/workspace.sh          # 全部通过
bash tests/integration/docs-repo-init.sh  # 全部通过
```

---

## 八、v2 关键边界情况参考

以下 v2 章节对 Phase 1 实施至关重要，执行者在实现对应模块时**必须阅读**：

| v2 章节 | 涉及模块 | 核心内容 |
|---|---|---|
| §6.3 Symlink 处理 | Task 3 `discoverProjects` | 扫描到 symlink 目录时，解析真实路径；真实路径在 workspace 根外 → 跳过，防止跨边界 |
| §8.5 场景六（workspace state 合并冲突） | Task 4 `runWorkspaceInit` | init 写入 workspace `.spec-first/state.json` 时，同步写入 `.gitattributes` 一条 `merge=union` 规则，减少多人并发 init 时的 JSON merge 冲突 |
| §8.5 场景七（分支保护） | Task 4 git push 错误处理 | Phase 1 已知不支持（见 §5 限制表），push 失败时检测 "protected branch" 关键词，给出针对性提示（而非通用 "push 失败"） |
| §8.5 场景八（docs repo 迁移） | Task 5 `doctor.js` | doctor URL 一致性检查：对比 state.json `docsRepo`（规范化）与本地 git remote URL，不一致时给出迁移指引 |
| §8.5 场景十一（git lock 竞争） | Task 4 git 操作前置检查 | 执行任何 git 操作前，检测 `<localPath>/.git/index.lock` 是否存在，存在时提示等待而非报 git 内部错误 |

完整并发冲突处理细节见 v2 §8.5（场景一至十一）。

---

## 附录：文档关系与边界

| 文档 | 侧重 | 本方案关系 |
|---|---|---|
| v2（独立文档仓库方案-v2.md） | 产物内容定义（每个 workflow 产出什么）+ 存储管理基础设施（git 操作、workspace 检测、slug、并发冲突） | 本文直接继承，不重复，有矛盾以本文为准 |
| Harness Engineering 实施分期 | 控制面改造（.context/spec-first/、reference-first、preflight-first） | 独立线索，本方案不涉及，不冲突 |
| 本文 | 知识库的内容定义（记什么）+ Agent 消费路径 + 维护策略 + Phase 1 任务分解 | — |
