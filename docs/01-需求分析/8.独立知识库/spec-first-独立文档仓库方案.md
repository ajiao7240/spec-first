# spec-first 独立文档仓库方案

> 方案性质：需求设计稿
> 适用范围：`spec-first init`、`spec-first doctor`、所有 spec-* workflow skill
> 撰写日期：2026-04-04

---

## 1. 背景与问题

当前 spec-first 产出的所有文档（bootstrap 产物、plan、work artifact、review 结果、compound 沉淀）均写入项目代码仓库的 `docs/` 目录。这在单人开发场景下工作良好，但在团队协作场景下存在三个本质问题：

1. **权限耦合**：文档 PR 和代码 PR 混在同一仓库，评审职责不清，非开发角色（PM、设计师）访问文档必须克隆代码仓库
2. **版本噪音**：`git log` 夹杂大量文档提交，代码历史难以追踪，与 Harness 改造技术方案中"证据优先"原则冲突
3. **跨项目共享受阻**：`_shared/` 级别的 patterns、rules、playbooks 无法在多个项目间自然共享，每个项目各自维护一份

---

## 2. 目标

1. 支持将 spec-first 文档写入一个**独立的 Git 仓库**（docs repo），与代码仓库解耦
2. 支持 **team / org 级别**的全局默认配置，团队成员 onboarding 无需重复配置
3. 支持**项目级覆盖**，特殊项目可绑定不同的 docs repo
4. 保留**降级兼容**：未配置 docs repo 时回退到现有 in-repo 行为，不破坏已有用法
5. `spec-first doctor` 能检测并提示 docs repo 配置状态

---

## 3. 非目标

1. 不强制要求所有用户绑定独立 docs repo，in-repo 模式继续有效
2. 不实现 docs repo 的自动同步守护进程
3. 不引入中心化文档平台或 web UI
4. 不在第一阶段实现跨 docs repo 的知识聚合

---

## 4. 目标架构

### 4.1 目录结构

```
org/
├── project-A/                  ← 代码仓库（现有）
├── project-B/                  ← 代码仓库（现有）
└── spec-docs/                  ← 独立文档仓库（新增）
    ├── _shared/                ← 跨项目共享知识
    │   ├── patterns/
    │   ├── rules/
    │   └── playbooks/
    ├── project-A/
    │   ├── contexts/           ← spec-graph-bootstrap 产物
    │   ├── plans/              ← spec-plan 产物
    │   ├── work/               ← spec-work meta/signals/verification
    │   ├── reviews/            ← spec-code-review 产物
    │   └── knowledge/          ← spec-compound 沉淀
    └── project-B/
        └── ...
```

### 4.2 配置层级

```
project 级  →  .claude/spec-first/state.json       ← 当前项目专属
global 级   →  ~/.spec-first/config.json            ← team / org 默认
fallback    →  in-repo（docs/ 目录，现有行为）
```

**解析优先级**：project > global > in-repo fallback

---

## 5. 命令接口设计

### 5.1 init 新增参数

```bash
# 绑定到当前项目（project 级）
spec-first init --claude --docs-repo git@github.com:org/spec-docs.git

# 指定文件夹名（默认取 git remote 项目名或当前目录名）
spec-first init --claude --docs-repo git@github.com:org/spec-docs.git --docs-slug my-project

# 设置全局默认（team / org 级，写入 ~/.spec-first/config.json）
spec-first init --claude --docs-repo git@github.com:org/spec-docs.git --global

# 支持本地路径（已有克隆）
spec-first init --claude --docs-repo ~/org/spec-docs
```

### 5.2 参数说明

| 参数 | 类型 | 说明 |
|---|---|---|
| `--docs-repo` | git URL 或本地路径 | 文档仓库地址 |
| `--docs-slug` | 字符串 | 在 docs repo 中的文件夹名，默认自动推断 |
| `--global` | flag | 写入全局配置而非项目配置 |

---

## 6. docs-slug 自动推断逻辑

`--docs-slug` 未指定时，按以下顺序推断：

1. `git remote get-url origin` → 取 URL 最后一段（去掉 `.git`）
   - `git@github.com:org/my-project.git` → `my-project`
2. `process.cwd()` 的目录名
   - `/Users/kuang/projects/my-project` → `my-project`

---

## 7. 配置存储格式

### 7.1 state.json（project 级，新增 docs 字段）

```json
{
  "manifestVersion": "1.5.0",
  "platform": "claude",
  "developer": { "..." : "..." },
  "docs": {
    "repo": "git@github.com:org/spec-docs.git",
    "localPath": "/Users/kuang/.spec-first/repos/spec-docs",
    "slug": "project-A",
    "boundAt": "2026-04-04T00:00:00Z"
  },
  "commands": [],
  "skills": [],
  "agents": []
}
```

### 7.2 ~/.spec-first/config.json（global 级）

```json
{
  "defaultDocs": {
    "repo": "git@github.com:org/spec-docs.git",
    "localPath": "/Users/kuang/.spec-first/repos/spec-docs"
  }
}
```

---

## 8. --docs-repo 处理逻辑

```
输入为 git URL（git@...、https://...）:
  → 克隆到 ~/.spec-first/repos/<repo-name>/
  → 若已存在则 git pull --ff-only

输入为本地路径（/、~、./）:
  → 校验路径存在且是 git 仓库
  → 直接使用，不克隆

首次绑定后:
  → 在 docs repo 中创建 <slug>/ 目录（若不存在）
  → 写入 <slug>/README.md 作为初始化标记
  → git commit + push（push 失败时给出警告，不阻断流程）
```

---

## 9. 文档写入路径映射

所有 skill 的路径解析通过公共函数 `resolveDocsPath(projectRoot, adapter)` 统一处理：

| Skill | in-repo 路径（现有） | docs repo 路径（新增） |
|---|---|---|
| `spec-graph-bootstrap` | `docs/contexts/<slug>/` | `<docs-local>/<project-slug>/contexts/<slug>/` |
| `spec-plan` | `docs/plans/` | `<docs-local>/<project-slug>/plans/` |
| `spec-work` | `docs/work/` | `<docs-local>/<project-slug>/work/` |
| `spec-code-review` | `docs/reviews/` | `<docs-local>/<project-slug>/reviews/` |
| `spec-compound` | `docs/solutions/` | `<docs-local>/<project-slug>/knowledge/` |
| shared knowledge | `.context/spec-first/knowledge/` | `<docs-local>/_shared/` |

---

## 10. doctor 新增检查项

在平台检查段末尾追加 `Docs Repo` 检查：

| 状态 | 条件 | 提示 |
|---|---|---|
| `INFO` | 未配置 docs repo | `not configured (in-repo mode)`，提示可用 `--docs-repo` 绑定 |
| `PASS` | localPath 存在且是有效 git 仓库，`<slug>/` 目录存在 | 输出 repo + slug |
| `WARNING` | localPath 不存在 | 提示重新运行 `init --docs-repo` |
| `WARNING` | `<slug>/` 目录缺失 | 提示运行 `init --docs-repo` 重新初始化 |
| `WARNING` | 远端有新提交（本地落后） | 提示在 localPath 执行 `git pull` |

---

## 11. 团队 onboarding 流程

```bash
# 成员 A（首次绑定，设置 org 级默认）
spec-first init --claude --docs-repo git@github.com:org/spec-docs.git --global

# 成员 B（同 org，无需重复传参）
spec-first init --claude
# → 读 ~/.spec-first/config.json，自动克隆并绑定

# 成员 B 对某个特殊项目 override
cd special-project
spec-first init --claude --docs-repo git@github.com:other-team/docs.git
# → 写入当前项目 state.json，优先级高于 global
```

---

## 12. 降级行为

| 场景 | 行为 |
|---|---|
| 未配置 docs repo | 继续写入项目 `docs/` 目录，无报错 |
| docs repo 路径不存在 | 显式提示 `Docs-repo not reachable, falling back to in-repo mode`，不静默失败 |
| push 失败 | 警告提示，不阻断 init 主流程 |

---

## 13. 需要改动的模块

### 新增
- `src/cli/docs-config.js`：全局配置读写、docs repo 解析、slug 推断、目录初始化

### 修改
- `src/cli/state.js`：`normalizeState` 增加 `docs` 字段，新增 `normalizeDocs` 函数
- `src/cli/commands/init.js`：`parseInitArgs` 新增 `--docs-repo / --docs-slug / --global`，`runInit` 末尾增加绑定逻辑
- `src/cli/commands/doctor.js`：新增 `checkDocsRepo` 函数，加入平台检查
- 所有 spec-* skill（`SKILL.md`）：路径解析引用 `resolveDocsPath`（第二阶段，skill 层面改造）

### 暂不改动
- skill 层面的实际路径写入（需要 Harness 改造技术方案的第一阶段先落地，再统一接入）

---

## 14. 实施分期

### 第一阶段：init + state + doctor（CLI 层）
- 新增 `docs-config.js`
- `state.js` 支持 `docs` 字段
- `init.js` 支持三个新参数
- `doctor.js` 新增 docs repo 检查
- **收益**：配置链路跑通，团队可绑定 docs repo，doctor 可验证状态

### 第二阶段：skill 层接入
- 所有 spec-* skill 读取 `resolveDocsPath` 决定写入目标
- bootstrap / plan / work / review / compound 实际写到 docs repo
- **收益**：文档与代码物理分离，协作链路完整

### 第三阶段：shared knowledge 接入
- `_shared/` 作为跨项目知识基座落地
- 与 Harness 改造方案中的 shared knowledge substrate 对齐
- **收益**：团队 patterns / rules / playbooks 跨项目复用

---

## 15. 关键决策记录

| 决策 | 选择 | 理由 |
|---|---|---|
| `--global` 放在 `init` 还是独立 `config` 命令 | 放在 `init` | 最低 onboarding 摩擦，后续有需要再拆 |
| git URL 克隆到哪里 | `~/.spec-first/repos/<name>/` | 统一管理，不污染用户项目目录 |
| push 失败是否阻断 init | 不阻断，给警告 | init 主流程不应因远端网络失败中断 |
| docs repo 未配置时是否报错 | 不报错，INFO 级提示 | 保持向后兼容，in-repo 是合法模式 |
