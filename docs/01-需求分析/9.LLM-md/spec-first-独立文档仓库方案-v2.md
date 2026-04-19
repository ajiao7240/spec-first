# spec-first 独立文档仓库方案 v2

> 方案性质：需求设计稿（完整技术方案）
> 适用范围：`spec-first init`、`spec-first doctor`、所有 spec-* workflow skill
> 撰写日期：2026-04-04
> 前置文档：spec-first-独立文档仓库方案.md（v1，已废弃，本文完整替代）

---

## 1. 背景与问题

当前 spec-first 产出的所有文档（bootstrap 产物、plan、work artifact、review 结果、compound 沉淀）均写入项目代码仓库的 `docs/` 目录。在单人单项目场景下工作良好，但存在三个本质问题：

1. **权限耦合**：文档 PR 和代码 PR 混在同一仓库，非开发角色（PM、设计师）访问文档必须克隆代码仓库
2. **版本噪音**：`git log` 夹杂大量文档提交，代码历史难以追踪
3. **跨项目共享受阻**：`_shared/` 级别的 patterns、rules、playbooks 无法在多个项目间自然共享

v1 方案解决了单项目场景下的文档仓库绑定，但未处理 **workspace 场景**（一个文件夹下包含多个独立项目），本文作为完整替代方案。

---

## 2. 目标

1. 支持将 spec-first 文档写入独立 Git 仓库（docs repo），与代码仓库解耦
2. **workspace 场景**：在 workspace 根目录执行一次 init，自动发现所有子项目并在 docs repo 中建立对应目录
3. **增量感知**：workspace 后续新增项目后，重新执行 init 或 doctor 能自动识别并补充初始化，无需手动进入子目录
4. 支持 team / org 级别的全局默认配置
5. 保留降级兼容：未配置 docs repo 时回退到现有 in-repo 行为
6. 单项目模式完全向下兼容，行为零变化

---

## 3. 非目标

1. 不强制要求绑定独立 docs repo，in-repo 模式继续有效
2. 不实现 docs repo 的自动同步守护进程
3. 不引入中心化文档平台或 web UI
4. 不处理嵌套 workspace（workspace 下的子项目本身也是 workspace），只处理一层深度
5. 不在第一阶段实现跨 docs repo 的知识聚合

---

## 4. 核心概念

### 4.1 spec-docs 的定位

spec-docs 是**团队长期维护的知识库**，是一个独立的 Git 仓库，由团队研发共同写入和维护。它的性质等同于任何一个团队项目仓库：

- **生命周期独立**：不依附于任何单一代码仓库或 workspace，长期存在
- **团队共同维护**：所有团队成员都是贡献者，通过正常 git 工作流（clone、commit、push、PR）协作
- **spec-first 是写入方之一**：spec-first 负责在执行 spec-* workflow 时向 spec-docs 写入产物，但不拥有、不管理这个知识库

**spec-first 对 spec-docs 的职责边界：**

```
知道它在哪里（localPath）      ✓
写入文档时 commit + push       ✓
首次便捷 clone（可选辅助）     ✓

替代开发者管理 git 工作流       ✗
在 init 时自动 pull             ✗
管理分支或 merge 策略           ✗
```

### 4.3 两种运行模式

| 模式 | 触发条件 | 控制平面 |
|---|---|---|
| **workspace 模式** | 当前目录被检测为 workspace 根目录 | workspace 根目录 |
| **单项目模式** | 当前目录被检测为单一项目 | 当前项目目录 |

两种模式**自动感知**，无需用户传入额外 flag。

### 4.2 完整文件目录结构

涉及三个独立位置：workspace 代码仓库侧、独立文档仓库、用户 home 目录全局存储。

#### workspace（代码仓库侧）

```
workspace/
├── .spec-first/
│   └── state.json                  ← workspace 级状态（新增）
│
├── project-A/
│   └── .claude/
│       └── spec-first/
│           └── state.json          ← 单项目级状态（现有，可选 docs 字段覆盖）
│
├── project-B/
│   └── .claude/
│       └── spec-first/
│           └── state.json
│
├── project-C/
│   └── .claude/
│       └── spec-first/
│           └── state.json
│
├── <docs-repo>/                    ← 可选：docs-repo 克隆到 workspace 下（目录名用户自定义）
│   ├── .git/                         通过 git remote URL 识别并排除，不会被误判为子项目
│   ├── project-A/
│   ├── project-B/
│   └── project-C/
│
├── pnpm-workspace.yaml             ← workspace 声明（已有，spec-first 只读）
└── package.json
```

#### spec-docs（独立文档仓库）

```
spec-docs/                         ← 独立文档仓库
├── _shared/                       ← 跨项目共享知识（保留名，不可作为项目 slug）
│   ├── patterns/
│   ├── rules/
│   └── playbooks/
├── project-A/
│   ├── README.md                  ← init 时自动生成，含 slug/created-by 等 meta
│   ├── contexts/                  ← spec-graph-bootstrap 产物
│   ├── plans/                     ← spec-plan 产物
│   ├── work/                      ← spec-work meta/signals/verification
│   ├── reviews/                   ← spec-review 产物
│   └── knowledge/                 ← spec-compound 沉淀
├── project-B/
│   └── ...
└── project-C/
    └── ...
```

#### ~/.spec-first/（全局，用户 home 目录）

```
~/.spec-first/
└── config.json                     ← global 级配置（docs-repo URL + 开发者指定的 localPath）
```

spec-docs 的本地克隆**由开发者自行管理**，位置由开发者决定，存入 `config.json` 供 spec-first 引用。不在 `~/.spec-first/` 内强制维护副本。

#### 数据归属与 commit 策略

两类数据性质不同，严格分离存储：

| 数据 | 存储位置 | 是否 commit | 说明 |
|---|---|---|---|
| `docsRepo` URL + slug 映射 | `workspace/.spec-first/state.json` | **是** | 团队共享，所有成员使用同一份 |
| `docsLocalPath`（本地路径） | `~/.spec-first/config.json` | **否** | 个人配置，各自管理，不入 git |

#### 三者关系

```
workspace/.spec-first/state.json（committed）
  docsRepo ──────────────────────────────────→ git@github.com:org/spec-docs.git
                                                          │
                              ~/.spec-first/config.json  │  （个人，不 commit）
                              docsRepos 查表              │
                                    ↓                    │
                              ~/projects/spec-docs/ ←────┘  ← 开发者自行 clone，位置自定
                              （也可放在 workspace/ 下）
```

spec-first 解析 localPath 的两步流程：

```
step 1: 从 project/workspace state.json 得到 docsRepo URL
step 2: 将 URL 规范化后，在 ~/.spec-first/config.json 的 docsRepos 表中查找 localPath
```

skill 写文档时，完整路径解析链：

```
resolveDocsPath()
  → 读 <project>/.claude/spec-first/state.json（有 docsRepo？）
  → 读 <workspace>/.spec-first/state.json（有 docsRepo？）
  → 读 ~/.spec-first/config.json（有 defaultDocsRepo？）
       ↓ 得到 docsRepo URL
  → 在 ~/.spec-first/config.json 的 docsRepos 表中查 localPath
  → fallback: 写 <project>/docs/（现有行为）
```

---

## 5. Workspace 自动检测

### 5.1 检测优先级

按以下顺序检测，命中即停止：

| 优先级 | 判据 | 来源标记 |
|---|---|---|
| 1 | 存在 `pnpm-workspace.yaml` | `pnpm` |
| 2 | `package.json` 含 `workspaces` 字段 | `npm` |
| 3 | 存在 `turbo.json` | `turbo` |
| 4 | 存在 `nx.json` | `nx` |
| 5 | 无 `.git/`，但至少 2 个直接子目录含有项目标记（见 5.3） | `heuristic` |

命中任意条件 → workspace 模式；否则 → 单项目模式。

### 5.2 特殊情况：monorepo

根目录**同时存在** `.git/` 和 workspace 声明（如 pnpm-workspace.yaml）：
- **进入 workspace 模式**，`.git/` 不影响判定
- workspace 整体的 git remote 用于 global slug 推断时参考，不用于子项目 slug 推断

### 5.3 项目标记（Project Marker）

扫描子目录时，满足以下任一条件视为有效项目：

| 标记文件 | 说明 |
|---|---|
| `.git/` | 独立 git 仓库 |
| `package.json` | Node.js 项目 |
| `go.mod` | Go 项目 |
| `Cargo.toml` | Rust 项目 |
| `pyproject.toml` / `setup.py` | Python 项目 |
| `pom.xml` / `build.gradle` | Java/Kotlin 项目 |

### 5.4 强制排除目录

无论包含何种文件，以下目录始终排除：

- `node_modules/`
- `.git/`（根目录下的 git 内部目录）
- 所有以 `.` 开头的隐藏目录（`.claude/`、`.vscode/` 等）
- `dist/`、`build/`、`out/`、`target/`（构建产物目录）

### 5.5 docs-repo 目录识别与排除

用户可以将 docs-repo 克隆到 workspace 根目录下，方便在 IDE 中直接查看和编辑文档。由于 docs-repo 的目录名由用户自定义（可以是 `spec-docs`、`my-docs`、`team-knowledge` 等任意名称），**不能依赖目录名过滤**，必须通过 **git remote URL 匹配**来识别。

**识别逻辑**

扫描候选子目录时，对每个含有 `.git/` 的目录执行：

```
git -C <candidate-dir> remote get-url origin
```

若输出的 URL 与 `--docs-repo` 参数值（规范化后）一致 → 该目录是 docs-repo 本身，**排除**。

**URL 规范化规则**（比较前统一处理）

| 原始形式 | 规范化结果 |
|---|---|
| `git@github.com:org/spec-docs.git` | `github.com/org/spec-docs` |
| `https://github.com/org/spec-docs.git` | `github.com/org/spec-docs` |
| `https://github.com/org/spec-docs` | `github.com/org/spec-docs` |

去掉协议头、`git@` 前缀、末尾 `.git`，统一为 `host/org/repo` 格式后再比较。

**两层排除保护**

| 排除层 | 机制 | 覆盖场景 |
|---|---|---|
| 第一层（快） | 候选目录绝对路径 === `docsLocalPath`（从 global config 查表得到） | 常规情况，无需执行 git 命令 |
| 第二层（准） | `git -C <candidate> remote get-url origin` 规范化后与 `docsRepo` URL 比较 | 目录被移动/重命名、symlink、localPath 未配置等场景 |

命中任意一层即排除，两层互为兜底。第二层不依赖 `--docs-local-path` 参数，直接从候选目录的 git remote 推导，因此即使用户只传了 `--docs-local-path` 而未传 `--docs-repo` 也能正确排除。

**对 pnpm/npm workspace 声明的说明**

若 workspace 使用精确模式（读取 pnpm-workspace.yaml / package.json workspaces），docs-repo 目录只要不出现在 packages 声明中，就不会被发现逻辑纳入候选，第二层 git remote 排除作为额外兜底。建议确保 docs-repo 目录不加入 packages 列表。

---

## 6. 项目发现机制

### 6.1 基于 workspace 声明的发现（精确模式）

当检测来源为 `pnpm` / `npm` / `turbo` / `nx` 时，读取对应的项目列表声明：

**pnpm-workspace.yaml**

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
  - 'services/api'
```

展开所有 glob 模式，过滤出实际存在的目录，再用项目标记过滤。

**package.json workspaces**

```json
{ "workspaces": ["apps/*", "packages/*"] }
```

同上，展开 glob 后过滤。

**turbo.json**

读取 `pipeline` 中涉及的 workspace 成员，结合 `package.json workspaces` 展开。

### 6.2 启发式扫描（fallback）

当检测来源为 `heuristic` 时：
1. 枚举当前目录的直接子目录（深度 = 1，不递归）
2. 过滤强制排除目录（见 5.4）
3. 过滤 docs-repo 目录（见 5.5）
4. 检查项目标记（见 5.3），有标记才纳入候选

### 6.3 Symlink 处理

发现过程中遇到 symlink 目录：
- 解析真实路径
- 若真实路径在 workspace 根目录之外 → 跳过，防止意外跨越边界
- 若真实路径在 workspace 根目录之内 → 正常处理

---

## 7. Slug 推断规则

### 7.1 推断顺序

对每个发现的子项目，按以下顺序推断 slug：

1. 子项目的 `git remote get-url origin` → 取 URL 最后一段（去掉 `.git`）
2. 子项目目录名

### 7.2 Sanitize 规则

slug 只允许字符：`[a-z0-9][a-z0-9\-_]*`

- 大写字母 → 转小写
- 空格 → `-`
- 中文及其他 Unicode → 转 pinyin 首字母（若无法转换则报错，要求用 `--slug` 指定）
- 长度限制：≤ 64 字符

### 7.3 保留名

以下 slug 禁止使用（docs-repo 顶层保留目录）：

```
_shared
_meta
_global
```

命中保留名时：报错，提示用 `--slug <name>` 覆盖。

### 7.4 冲突检测

同一次初始化中，若两个子项目推断出相同 slug：
- 报错，列出冲突的两个项目路径
- 要求用 `spec-first init --docs-repo ... --slug-map project-A=slug-a,project-B=slug-b` 手动指定

若 slug 在 docs-repo 中已存在（被其他 workspace 创建）：
- 检查 `<slug>/README.md` 中的 `created-by` 字段
- 若 `created-by` 与当前 workspace 不一致 → 警告，要求用 `--slug` 覆盖
- 若一致（同一 workspace 重复 init）→ 幂等跳过

---

## 8. docs-repo 操作规范

### 8.1 本地路径的所有权

spec-docs 的本地克隆**由开发者自行管理**，spec-first 只需知道它的本地路径（`docsLocalPath`）。路径通过以下方式配置（一次性）：

```bash
# 推荐：开发者先 clone，再告诉 spec-first 路径在哪里
git clone git@github.com:org/spec-docs.git ~/projects/spec-docs
spec-first init --claude --docs-local-path ~/projects/spec-docs --global

# 可选：spec-first 辅助首次 clone（仅当 localPath 不存在时执行）
spec-first init --claude \
  --docs-repo git@github.com:org/spec-docs.git \
  --docs-local-path ~/projects/spec-docs \
  --global
```

`--docs-local-path` 指定的路径写入 `~/.spec-first/config.json`，后续所有 workspace 自动复用，无需重复传参。

### 8.2 init 时的路径解析与校验

init 执行时，spec-first 的 docs 配置解析顺序：

```
step 1: 确定 docsRepo URL
  → 来自 --docs-repo 参数
  → 或来自 workspace/project state.json 的 docsRepo 字段
  → 或来自 ~/.spec-first/config.json 的 defaultDocsRepo 字段
  → 均无 → 跳过 docs 配置（in-repo 模式）

step 2: 确定 localPath
  → 来自 --docs-local-path 参数（同时写入 global config docsRepos 表）
  → 或在 ~/.spec-first/config.json 的 docsRepos 表中查 docsRepo URL
  → 均无 → 【引导流程】提示：
      "检测到团队知识库：<docsRepo>
       尚未在本机配置本地路径，请运行：
         spec-first init --docs-local-path <路径> --global
       或让 spec-first 辅助 clone（指定目标路径）：
         spec-first init --docs-local-path ~/projects/spec-docs --global"
      → init 继续，当前 workspace 降级 in-repo 模式

step 3: 校验 localPath
  → 存在且是有效 git 仓库（git rev-parse --git-dir）→ 通过
  → 不存在，有 --docs-repo → 辅助 clone 到该路径（仅此一次），clone 失败降级 in-repo
  → 不存在，无 --docs-repo → 报错：路径不存在，提示先手动 clone
  → 存在但不是 git 仓库 → 报错
```

**init 阶段必须先 pull，再判断目录是否存在**

init 和 skill 写入对 pull 的需求不同，需严格区分：

| 阶段 | 是否 pull | 理由 |
|---|---|---|
| **init 目录创建** | **必须先 pull** | 远端可能已有其他成员创建的 slug 目录；不 pull 就创建会导致 push 冲突 |
| **skill 写入文档** | **不自动 pull，提示用户** | 写作节奏是开发者自己的，auto-pull 可能打断工作流 |

init 阶段执行前，先做 working tree 预检，再执行 pull：

```
步骤 0：working tree 状态预检

git -C <localPath> status --porcelain
（porcelain 格式：两列，第一列 = index 状态，第二列 = working tree 状态）

  存在 unmerged paths（UU/AA/DD/AU/UA/DU/UD）→ 报错：
    "spec-docs 存在未解决的 merge 冲突，请先手动处理：cd <localPath> && git status"
    → 中止 init

  存在 staged 内容（第一列非空且非 U，如 A/M/D/R/C）：
    → 全部 staged 文件路径均属于本次目标 slug 目录前缀（如 project-A/ project-B/）
        → 判断为上次 init 中途中断的 staged 残留（Ctrl+C / OOM kill 等）
        → 跳过 pull（index 有内容时 pull 会报错），直接进入 §8.4 情况二恢复路径
    → staged 内容包含非 slug 目录路径
        → 报错："spec-docs 有无关的已暂存内容，请先处理后重试：
                 cd <localPath> && git reset HEAD -- <files> 或 git commit"
        → 中止 init（注：staged 内容不可 git stash，需用 git reset HEAD）

  存在未暂存的工作目录修改（第二列非空）→ 报错：
    "spec-docs 有未提交修改，请先 commit 或 stash 后重试"
    → 中止 init

  index 和工作目录均干净 → 继续

步骤 1：pull

git -C <localPath> pull --ff-only

  fast-forward 成功 → 本地已与远端同步，继续
  分叉（non-fast-forward）→ 报错：
    "spec-docs 本地与远端分叉，请手动处理后重试：cd <localPath> && git pull"
    → 中止 init
  无远端分支（离线 / 新建仓库）→ 跳过 pull，继续
```

### 8.3 写入时的 git 操作

spec-first 仅在 **spec-* skill 写入文档时**执行 git 操作。

**写入前预检**（避免写完才发现无法 push）：

```
git -C <localPath> rev-list HEAD..@{u} --count
  → 本地落后远端 N 个提交（N > 0）→ 警告并询问：
      "WARNING: spec-docs 本地落后远端 N 个提交，建议先执行 git pull。
       继续写入？(y/N)"
  → 用户选 N → 中止，不写入
  → 用户选 y → 继续（用户自行承担 merge 责任）
  → 无远端分支（离线/新 clone）→ 跳过检查，继续
```

**写入与提交**：

```
写入文档文件
  → git add <file>
  → git commit -m "<skill>: <description>"
  → git push
      → push 成功 → 完成
      → push 失败（无权限/网络）→ 警告，不阻断 skill 主流程
      → push 冲突（本地落后，忽略了预检警告）→ 警告，提示先执行 git pull 再手动 push
```

### 8.4 目录初始化（init 阶段）

**pull 完成后**，检查每个发现的项目 slug：

```
对每个 slug（A、B、C...）：

  情况一：<localPath>/<slug>/ 已存在（pull 后同步到的）
    → 跳过，幂等
      远端已由其他成员创建，本地已同步，无需重复操作

  情况二：<localPath>/<slug>/ 不存在
    → 本地有未提交的 <slug>/ 目录（上次 init 中途中断的残留）？
        → 是，且结构完整（有 README.md）→ 直接复用，跳过创建，进入 commit 步骤
        → 是，但结构不完整 → 清理残留（git clean -fd <slug>/），重新创建
        → 否 → 正常创建流程：
                 1. 创建 <slug>/ 及子目录（contexts/plans/work/reviews/knowledge/）
                 2. 写入 <slug>/README.md：
                    ---
                    slug: <slug>
                    project-path: <相对路径，如 ./project-A>
                    workspace-repo: <workspace 的 git remote URL（规范化），
                                     无 remote 时为 local:<workspace-dir-name-hash>
                    created-by: <git user.email>
                    created-at: <ISO 8601>
                    ---
                    # <slug>

                    workspace-repo 作为 workspace 的稳定标识，与 project-path 联合构成
                    全局唯一的项目身份（解决不同 workspace 同名项目的 slug 冲突检测问题）。

  情况三：<localPath>/<slug>/ 已存在，README.md 中 (workspace-repo + project-path) 与当前项目不符
    → 警告：slug 与已有但不同的项目冲突
      "spec-docs 中 <slug>/ 已被 <old-workspace-repo> 下的 <old-path> 使用，
       请用 --slug 指定新名称，或使用 --slug-prefix <prefix-> 为 workspace 加统一前缀"
    → 中止该 slug 初始化（不影响其他 slug）
    注：project-path 相同但 workspace-repo 不同 = 跨 workspace 的不同项目，仍属冲突。

所有 slug 检查完毕，有新建目录时统一一次提交推送：
  git add .
  git commit -m "init: add docs dirs for <slug1>, <slug2>, ..."
  git push
    → 成功 → 完成
    → 失败（见 8.5 并发冲突处理）
```

**幂等保证**：init 可重复执行，已存在且 project-path 匹配的 slug 目录永远跳过。

### 8.5 并发冲突处理

#### 场景一：经典 race condition（双方同时创建同一 slug）

```
A 和 B 同时 pull，远端均无 C/
A 创建 C/，commit，push 成功
B 创建 C/，commit，push 失败（non-fast-forward）

B 的自动恢复流程：
  git pull --rebase
    → rebase 时 README.md 冲突（A 和 B 各自的 created-by/created-at 不同）
    → spec-first 自动解决：checkout --theirs（先到先得，远端优先）
       git checkout --theirs -- C/README.md
       git add C/README.md
       git rebase --continue
    → 子目录结构（contexts/ plans/ 等）无冲突（additive 操作）
    → git push
```

**原则：远端先到先得，README.md 以第一个 push 的版本为准。**

#### 场景二：本地有已提交但未推送的 slug 目录（上次 init 未 push 成功）

```
A 上次 init 创建了 C/，commit 了但网络断开未 push
A 再次 init，working tree 干净，执行 pull --ff-only：
  远端无 C/ → ff-only 成功，A 的 C/ commit 仍在栈上，直接 push 即可
  远端有 C/（B 已创建）→ ff-only 失败（分叉）
    → 报错，提示手动处理
    → A 手动执行：git pull --rebase，解决 README.md 冲突，push
```

#### 场景三：orphaned slug 被新项目复用

```
旧 project-C 已删除，spec-docs 中 C/ 为 orphaned 状态（目录保留）
新项目 slug 推断为 C

init 检查时，C/ 存在：
  读取 C/README.md 的 project-path 字段
  与当前项目路径一致 → 视为同一项目重新激活，复用目录，更新 state 为 active
  与当前项目路径不一致 → 警告冲突，要求 --slug 指定新名称
```

#### 场景四：spec-docs 被 force push

```
git pull --ff-only 失败，且不是 unmerged 也不是普通分叉
→ 检测到远端 HEAD 与本地无共同祖先
→ 报错：
  "spec-docs 远端历史已被重写（force push），本地无法自动同步。
   请手动处理：cd <localPath> && git fetch origin && git reset --hard origin/main"
→ 中止 init，不做任何本地修改
```

#### 场景五：并发 skill 写入同一文档

```
A 和 B 同时对 project-C 运行 spec-graph-bootstrap，写入 C/contexts/bootstrap.md

预检（8.3 节）：各自检测到本地未落后 → 均继续写入
A push 成功
B push 失败

B 的处理：
  git pull（此时 bootstrap.md 内容冲突，无法自动合并）
  → 警告："spec-docs 存在内容冲突，需要手动合并：
     cd <localPath> && git pull，解决冲突后 git push"
  → skill 产物保留在本地，不丢失
```

**根本预防**：skill 写入前的预检（8.3 节）是防止场景五的主要手段，落后则提示用户串行操作。

#### 场景六：workspace state.json 在代码仓库侧的合并冲突

```
A 和 B 同时执行 spec-first init，各自发现新项目，修改 workspace/.spec-first/state.json，
A push 成功，B push 失败（non-fast-forward），B 执行 git pull 产生 JSON merge 冲突。

冲突根源：
  projects 对象各自新增了不同 key → git 3-way merge 按行合并，通常可自动成功
  根级 updatedAt 两人都修改了    → 同一行冲突，概率极高
  最坏情况：JSON 含 <<<< ==== >>>> 标记，解析失败

最佳实践处理：

1. state.json 结构减少冲突面（工具写入时固定格式）：
   - 根级 updatedAt 改为 last-write-wins 语义
   - projects 内每个条目单独成行（工具生成时固定缩进，方便 diff）

2. init 时自动写入 workspace .gitattributes（若不存在该条目）：
   .spec-first/state.json merge=union
   （union merge 取双方所有行，对只增不减的 JSON 对象效果好，避免 updatedAt 冲突）

3. spec-first init/doctor 启动时检测 state.json 含冲突标记（<<<<<<）：
   → 触发 §10.2 损坏重建路径
   → 重建方式：重新全量扫描 workspace，而非空白创建，确保不丢失任何一方新增的项目
   → 重建后给出提示："state.json 已自动修复，请 git commit 保存"

4. 团队规范建议（文档级）：同一 workspace 避免多人同时执行 init。
```

#### 场景七：spec-docs 开启了分支保护（主分支禁止直接 push）

```
企业级 spec-docs 通常设置 main 分支保护（require PR / require review / require CI 通过）。
spec-first 执行 git push origin main 时被策略拒绝：

  remote: error: GH006: Protected branch update forbidden.
  remote: error: Required reviews not met.

此类失败与网络/权限失败相似（均为 exit 1），但需要走 PR 流程，无法重试解决。

最佳实践处理：

1. 检测 push 失败的 stderr，识别分支保护拒绝：
   含 "protected branch" / "Required reviews" / "required status checks" →
   给出明确提示（而非通用 "push 失败"）：
     "spec-docs main 分支已开启保护，spec-first 无法直接推送。
      请使用 --docs-branch 推到特性分支后手动发起 PR：
        spec-first init --docs-branch docs/init-$(date +%Y%m%d)"

2. 支持 --docs-branch <branch> 参数（见 §15.2）：
   - spec-first 创建并推送到指定分支，由开发者手动发起 PR 合入 main

3. global config 支持 docsBranch 字段，团队统一配置：
   { "docsBranch": "docs-updates" }
   配置后，所有 push 默认走特性分支，无需每次传参。

4. 使用分支模式时，skill 写入产物在本地分支堆积；
   doctor 检测本地分支领先远端 N 个提交时，提示：
     "spec-docs 本地分支 docs-updates 有 N 个未合入提交，建议发起 PR"
```

#### 场景八：spec-docs 仓库地址变更（迁移场景）

```
团队将 spec-docs 迁移到新地址（org rename、平台迁移、仓库重命名）。

三处可能漂移的 URL：
  A. workspace state.json 的 docsRepo 字段
  B. global config docsRepos 表的 key
  C. localPath/.git/config 的 remote.origin.url

症状：
  git push/pull → "remote: Repository not found." 或 "ERROR: Repository not found"
  与网络失败报错相似，用户难以自行判断是迁移还是网络问题。

最佳实践处理：

1. doctor 新增"URL 一致性检查"：
   比对 state.json docsRepo（规范化）vs git -C <localPath> remote get-url origin（规范化）
   不一致 → WARNING：
     "state.json docsRepo 与 spec-docs 本地 remote 不一致，仓库可能已迁移。
      请执行：spec-first init --docs-repo <correct-url> 同步所有配置"

2. 检测到 "Repository not found" 时，给出针对性提示：
     "push/pull 失败，仓库可能已迁移或被删除，请检查 docsRepo URL 是否有效，
      如已迁移，执行：spec-first init --docs-repo <new-url>"

3. spec-first init --docs-repo <new-url> 执行三步联动更新：
   a. 更新 workspace state.json 的 docsRepo 字段
   b. 更新 global config docsRepos 表（移除旧 URL key，写入新 URL key + 相同 localPath）
   c. 同步更新 localPath 的 git remote：
        git -C <localPath> remote set-url origin <new-url>
      三处同步，确保不漂移。
```

#### 场景九：多 workspace 共享 spec-docs，跨 workspace slug 命名空间冲突

```
公司 org 级 spec-docs 被多个 workspace 共用（frontend-ws / backend-ws 均绑定同一 spec-docs）。
两个 workspace 各有一个项目推断出相同 slug（如均有 "api" 子目录）。

问题根源：
  §8.4 情况三的冲突检测使用 README.md 中的 project-path（相对路径）
  两个 workspace 的 api 项目 project-path 均为 ./api → 误判为同一项目（幂等跳过）
  实际上它们来自不同 workspace 的不同代码库，文档不应混写到同一目录。

最佳实践处理：

1. 情况三冲突检测升级为 (workspace-repo + project-path) 双键比对：
   - 两者均匹配 → 同一项目，幂等跳过（正常）
   - project-path 相同但 workspace-repo 不同 → 跨 workspace 同名项目，属真冲突

2. 冲突提示升级：
   "spec-docs 中 <slug>/ 已被另一 workspace（<old-workspace-repo>）
    的 <old-path> 项目使用。请用 --slug 指定不同名称，
    或使用 --slug-prefix <team-> 为整个 workspace 加统一前缀：
      spec-first init --claude --slug-prefix frontend-"

3. 新增 --slug-prefix <prefix> 参数（见 §15.2），为 workspace 内所有 slug 加统一前缀：
   spec-first init --claude --slug-prefix frontend-
     → project-A    → frontend-project-A
     → api          → frontend-api
   prefix 写入 workspace state.json，后续 init 和 skill 写入自动沿用。
```

#### 场景十：init 中途中断后 git index 有残留 staged 内容

```
init 执行到"创建目录 + git add"之后、commit 之前，进程被中断（Ctrl+C / OOM kill）。
再次执行 init 时，git status --porcelain 输出：

  A  project-A/README.md
  A  project-A/contexts/.gitkeep
  ...（均为上次 init 的 staged 残留）

误判为"有未提交修改"并报错，会导致用户无从下手：
  - git stash 对 staged 内容无效（stash 需要工作目录变更）
  - 需要 git reset HEAD -- <files>，但错误提示未说明

最佳实践处理：

步骤 0 识别"staged 残留 = 本次 init 目标 slug"（见 §8.2 更新版预检逻辑）：
  → 检查所有 staged 文件路径前缀是否均在本次目标 slug 集合内
  → 是 → 跳过 pull，直接进入 §8.4 情况二恢复路径：
          结构完整（README.md 存在） → 复用，进入 commit 步骤
          结构不完整 → git reset HEAD -- <slug>/，清理后重建
  → 否 → 报错：包含非 slug 目录的 staged 内容，给出 git reset HEAD 指引

原则：init 应能幂等恢复自身中断产生的 staged 残留，不应将其判为"外部脏状态"。
```

#### 场景十一：spec-docs 被其他进程锁定（git lock 竞争）

```
同一台机器多个终端同时执行 spec-first init（或 CI 并发 job 共享同一 localPath），
两个进程同时执行 git pull / commit，后者遇到：

  fatal: Unable to create '<localPath>/.git/index.lock': File exists.

此报错来自 git 底层，用户容易误认为是文件权限问题。

最佳实践处理：

在执行任何 git 操作前，主动检测 lock 文件：

  ls <localPath>/.git/index.lock
    → 存在：
        提示："spec-docs 正被另一个进程操作（存在 .git/index.lock），请稍后重试。
               若确认无其他 git 进程，可手动删除：
                 rm '<localPath>/.git/index.lock'"
        → 中止 init，不自动删除 lock（误删活跃 lock 会导致 git 数据损坏）
    → 不存在 → 继续

建议：本地开发避免在同一 spec-docs localPath 并发运行多个 spec-first 实例；
      CI 场景应通过任务串行或不同 localPath 隔离来规避此问题。
```

---

## 9. 配置层级与优先级

### 9.1 四层优先级

```
project 级  →  <project>/.claude/spec-first/state.json   ← 单项目专属绑定
workspace 级 → <workspace>/.spec-first/state.json         ← workspace 内所有项目共享
global 级   →  ~/.spec-first/config.json                  ← team / org 默认
fallback    →  in-repo（docs/ 目录）                       ← 无任何配置时的现有行为
```

**解析优先级**：project > workspace > global > in-repo fallback

### 9.2 典型配置场景

| 场景 | 生效配置 |
|---|---|
| 单项目，有自己的 docs-repo 绑定 | project 级 state.json |
| workspace 下的项目，无单独绑定 | workspace 级 state.json |
| workspace 下的项目，单独绑定了不同的 docs-repo | project 级覆盖 workspace 级 |
| 全局设置了默认 docs-repo，workspace 未配置 | global 配置 |
| 未配置任何 docs-repo | in-repo fallback |

---

## 10. 状态管理

### 10.1 workspace 状态文件

位置：`<workspace-root>/.spec-first/state.json`
**建议 commit 到 git**（仅含团队共享数据，不含个人路径）。

```json
{
  "version": "2.0.0",
  "docsRepo": "git@github.com:org/spec-docs.git",
  "detectedAs": "pnpm",
  "updatedAt": "2026-04-04T00:00:00Z",
  "projects": {
    "project-A": {
      "path": "./project-A",
      "slug": "project-A",
      "status": "active",
      "initializedAt": "2026-04-04T00:00:00Z"
    },
    "project-B": {
      "path": "./project-B",
      "slug": "project-B",
      "status": "active",
      "initializedAt": "2026-04-04T00:00:00Z"
    },
    "project-old": {
      "path": "./project-old",
      "slug": "project-old",
      "status": "orphaned",
      "initializedAt": "2026-03-01T00:00:00Z",
      "orphanedAt": "2026-04-04T00:00:00Z"
    }
  }
}
```

**不含 `docsLocalPath`**：本地路径因开发者而异，属于个人配置，存于 global config，不进入 git。

**防止 state.json merge 冲突（见 §8.5 场景六）**

state.json 作为 committable 文件，多人同时 init 时可能产生 JSON merge 冲突。`init` 执行时自动在 workspace 写入以下 `.gitattributes` 条目（若不存在）：

```gitattributes
.spec-first/state.json merge=union
```

`merge=union` 策略对双方各自新增不同 key 的场景效果最好（取双方所有行），适合 projects 对象只增不减的 state.json 结构。根级 `updatedAt` 字段若冲突，以较新的时间戳为准（last-write-wins）。

**status 字段说明**

| 值 | 含义 |
|---|---|
| `active` | 正常运行中 |
| `orphaned` | 曾经存在，现在从 workspace 声明中消失（目录已删除或从 pnpm-workspace.yaml 移除） |

### 10.2 状态文件健壮性

| 场景 | 处理 |
|---|---|
| 文件不存在 | 视为首次运行，全量初始化 |
| 文件存在但 JSON 无效 | 警告 "state.json 损坏，将重建"，重新全量扫描，覆盖写入 |
| version 字段不匹配（旧格式） | 迁移到新格式，保留 projects 数据 |

### 10.3 global 配置文件

位置：`~/.spec-first/config.json`
**不 commit，个人专属。**

```json
{
  "defaultDocsRepo": "git@github.com:org/spec-docs.git",
  "docsRepos": {
    "github.com/org-a/spec-docs": "/Users/kuang/projects/org-a/spec-docs",
    "github.com/org-b/knowledge": "/Users/kuang/projects/org-b/knowledge"
  }
}
```

**字段说明**：

| 字段 | 说明 |
|---|---|
| `defaultDocsRepo` | 未绑定 workspace 时的默认 docsRepo URL（单项目模式 fallback） |
| `docsRepos` | URL（规范化）→ localPath 的映射表，支持同时参与多个 org |

`docsRepos` 中的 key 为 URL 规范化结果（`host/org/repo`），value 为开发者自定义的本地路径（绝对路径或相对于 workspace 的相对路径）。

**路径可移植性**：当 spec-docs 克隆在某个 workspace 内时，localPath 可存为相对路径（如 `./spec-docs`），解析时相对于当前 workspace 根目录展开，方便团队内约定统一存放位置。

---

## 11. 增量扫描机制

### 11.1 触发时机

以下操作都会触发增量扫描：

- `spec-first init`（在已初始化的 workspace 根目录重新执行）
- `spec-first doctor`（检查时顺带发现新项目）

### 11.2 增量逻辑

```
当前发现的项目集合  diff  state.json 中的 active 项目
        │
        ├── 新增（在当前发现但不在 state）
        │   → 执行初始化：创建 docs-repo 目录 + 更新 state（status: active）
        │
        ├── 删除（在 state 中为 active，但当前未发现）
        │   → 不删除 docs-repo 目录（保留历史）
        │   → 更新 state：status 改为 orphaned，记录 orphanedAt
        │
        └── 未变化（在 state 中为 active，当前也发现）
            → 跳过，幂等
```

### 11.3 orphaned 项目的后续处理

orphaned 项目不会被自动清理。清理方式：
- 手动执行：`spec-first clean --slug <slug>` （第二阶段实现）
- doctor 会持续提示 orphaned 项目存在

---

## 12. doctor 检查项

### 12.1 workspace 级检查

在 workspace 根目录执行 `spec-first doctor` 时：

| 状态 | 条件 | 提示 |
|---|---|---|
| `INFO` | 未配置 docsRepo | `not configured (in-repo mode)`，提示可用 `--docs-local-path` 绑定 |
| `INFO` | docsRepo 已知，但当前开发者 global config 无 localPath | 提示运行 `spec-first init --docs-local-path <路径> --global` 完成本机配置 |
| `PASS` | localPath 存在且是有效 git 仓库 | 输出 docsRepo URL + 当前开发者的 localPath |
| `WARNING` | localPath 不存在（global config 有记录但目录消失） | 提示重新 clone 或修正 global config |
| `WARNING` | 本地落后远端 N 个提交 | 提示在 localPath 执行 `git pull`（由开发者自行处理） |
| `WARNING` | 本地有未推送提交 | 提示在 localPath 执行 `git push` |

> **注意**：doctor 显示的 `localPath` 来自**当前开发者的 global config**，而非 workspace state.json。不同开发者的 doctor 输出 Local 字段可能不同，这是预期行为。

### 12.2 项目级检查（workspace 下逐项检查）

| 状态 | 条件 | 提示 |
|---|---|---|
| `PASS` | `<slug>/` 目录存在于 docs-repo | 输出 slug + initializedAt |
| `WARNING` | 项目为 active 但 docs-repo 中 `<slug>/` 缺失 | 提示重新运行 `init` |
| `WARNING` | 项目为 orphaned | 提示项目已从 workspace 移除，可执行 `clean --slug` 清理 |
| `INFO` | 当前 workspace 有新项目未在 state 中 | 提示重新运行 `init` 以完成增量初始化 |

### 12.3 doctor 输出示例

```
spec-first doctor
─────────────────────────────────────
Workspace:  /Users/kuang/workspace
Docs Repo:  git@github.com:org/spec-docs.git
Local:      /Users/kuang/projects/spec-docs

[PASS]    project-A  (slug: project-A, initialized: 2026-04-04)
[PASS]    project-B  (slug: project-B, initialized: 2026-04-04)
[WARNING] project-C  (slug: project-C, initialized: 2026-04-04, docs dir missing — run: spec-first init)
[WARNING] project-old (orphaned: 2026-04-04 — run: spec-first clean --slug project-old)
[INFO]    project-D  (new, not yet initialized — run: spec-first init)
─────────────────────────────────────
2 pass, 1 warning, 1 orphaned, 1 uninitialized
```

---

## 13. 降级与错误处理

| 场景 | 行为 | 是否阻断 init |
|---|---|---|
| 未配置 docsRepo | 继续写入项目 `docs/` 目录，无报错 | 否 |
| docsRepo 已知但 global config 无 localPath | INFO 提示引导，降级 in-repo，不阻断 | 否 |
| localPath 不存在且有 --docs-repo → 辅助 clone 失败 | 警告 + 降级 in-repo | 否 |
| localPath 不存在且无 --docs-repo | 报错：路径不存在，提示先手动 clone | **是** |
| localPath 存在但不是 git 仓库 | 报错：路径无效 | **是** |
| init 阶段：working tree 有 unmerged 冲突残留 | 报错：提示先手动解决冲突 | **是** |
| init 阶段：working tree 有未提交修改 | 报错：提示先 commit 或 stash | **是** |
| init 阶段 pull 失败：本地与远端分叉 | 报错：提示手动处理后重试 | **是** |
| init 阶段 pull 失败：force push 导致无共同祖先 | 报错：给出 reset 指引，中止 | **是** |
| init 阶段 push 冲突（race condition） | 自动 rebase，README.md 取 theirs，重新 push | 否（自动恢复） |
| orphaned slug 被新项目复用：path 一致 | 复用目录，重新激活 | 否 |
| orphaned slug 被新项目复用：path 不一致 | 报错：slug 冲突，提示 --slug | **是**（该 slug） |
| 并发 skill 写入同一文档，push 失败 | 警告：提示手动 pull + 解决内容冲突 | 否（产物保留本地） |
| 写文档前预检：本地落后远端，用户选 N | 中止写入 | **是**（skill 级，非 init） |
| 写文档时 push 失败（无写权限/网络） | 警告，提示手动 push，不阻断 skill | 否 |
| 写文档时 push 冲突（本地落后，忽略预检） | 警告，提示 git pull 后手动 push | 否 |
| slug 冲突（两个项目推断出相同 slug） | 报错，列出冲突路径，提示 --slug-map | **是** |
| slug 为保留名 | 报错，提示 --slug | **是** |
| state.json 损坏 | 警告 + 重建 | 否 |
| workspace 检测失败（无法判定） | 降级单项目模式，警告 | 否 |
| 新项目目录名含无法 sanitize 的字符 | 报错，提示 --slug-map | **是** |
| init 启动时 state.json 含冲突标记（<<<）| 警告 + 全量扫描重建 state，提示 commit | 否 |
| push 被分支保护策略拒绝（protected branch）| 报错：提示使用 --docs-branch，给出 PR 示例 | 否（产物在本地） |
| push/pull 报 "Repository not found"（仓库迁移）| 警告：仓库可能已迁移，提示 --docs-repo 更新 | 否（降级 in-repo） |
| state.json docsRepo 与 localPath remote URL 不一致 | doctor WARNING：提示 URL 漂移，执行 init --docs-repo 同步 | 否 |
| 步骤 0 检测到 staged 内容属于本次 init slug | 跳过 pull，走 staged 残留恢复路径（§8.4 情况二）| 否（自动恢复） |
| 步骤 0 检测到 staged 内容含非 slug 路径 | 报错：提示 git reset HEAD，不建议 stash | **是** |
| spec-docs .git/index.lock 存在 | 报错：提示稍后重试或手动删除 lock | **是** |
| 跨 workspace slug 冲突（workspace-repo 不同）| 报错：提示 --slug 或 --slug-prefix | **是**（该 slug）|

**原则**：只有需要用户干预才能继续的情况才阻断（slug 冲突、保留名），网络/权限失败一律警告不阻断。

---

## 14. 向下兼容保证

### 14.1 单项目模式零变化

- 单项目模式的完整执行路径（init、doctor、clean）代码逻辑不修改
- 现有的 `.claude/spec-first/state.json` 格式不变（只新增可选 `docs` 字段）
- 已有用户的已有项目：无 `.spec-first/state.json` 时，解析链自动 fallback 到 global → in-repo

### 14.2 workspace 内的单项目覆盖

workspace 内某个子项目若有自己的 project 级 docs 绑定（`.claude/spec-first/state.json` 含 `docs` 字段），则该项目的 docs 写入目标以 project 级为准，不受 workspace 配置影响。

---

## 15. 命令接口

### 15.1 团队 onboarding 流程

```bash
# ── 步骤一：创始成员首次配置（整个团队只做一次）──────────────────────

# 推荐：先 clone spec-docs 到自己习惯的位置，再告诉 spec-first
git clone git@github.com:org/spec-docs.git ~/projects/spec-docs
spec-first init --claude \
  --docs-repo git@github.com:org/spec-docs.git \
  --docs-local-path ~/projects/spec-docs \
  --global
# → 写入 ~/.spec-first/config.json（个人，不 commit）
# → workspace/.spec-first/state.json 写入 docsRepo URL + slug 映射（commit 到 git）

# ── 步骤二：新成员加入（克隆 workspace 后）────────────────────────────

cd workspace/
spec-first init --claude
# → 读取已 commit 的 workspace state.json，获取 docsRepo URL
# → 在 global config 中查不到 localPath → 给出引导提示：
#   "检测到团队知识库：git@github.com:org/spec-docs.git
#    请配置本地路径（运行以下命令之一）：
#    1. 已有本地克隆：spec-first init --docs-local-path <路径> --global
#    2. 让 spec-first 辅助 clone：spec-first init \
#         --docs-local-path ~/projects/spec-docs --global"

# 新成员执行后：
spec-first init --claude --docs-local-path ~/projects/spec-docs --global
# → 首次 clone spec-docs（localPath 不存在时自动执行）
# → 写入个人 global config

# ── 步骤三：日常使用（配置完成后零参数）─────────────────────────────

cd any-workspace/
spec-first init --claude          # 自动读全局配置，零参数

cd project-A/
spec-first init --claude          # 单项目模式，同上

# ── 特殊场景：slug 冲突或保留名 ─────────────────────────────────────

spec-first init --claude --slug-map "project-A=frontend,project-B=backend"
```

### 15.2 新增参数说明

| 参数 | 类型 | 适用模式 | 说明 |
|---|---|---|---|
| `--docs-repo` | git URL | 两种 | spec-docs 远端 URL；写入 workspace state 和 global config；辅助首次 clone 时使用 |
| `--docs-local-path` | 本地路径（绝对或相对） | 两种 | spec-docs 在本机的克隆位置；写入 global config docsRepos 表，一次配置全局复用 |
| `--slug` | 字符串 | 单项目 | 覆盖自动推断的 slug |
| `--slug-map` | `key=val,...` | workspace | 为特定子项目指定 slug |
| `--slug-prefix` | 字符串 | workspace | 为 workspace 内所有 slug 加统一前缀（解决 org 级 spec-docs 跨 workspace slug 冲突） |
| `--docs-branch` | 字符串 | 两种 | 推送到指定分支而非 main（用于 spec-docs 开启了分支保护的场景） |
| `--global` | flag | 两种 | 将 docs 配置写入 `~/.spec-first/config.json` 全局复用 |

---

## 16. 需要改动的模块

### 新增

| 文件 | 职责 |
|---|---|
| `src/cli/workspace.js` | workspace 检测、项目发现（含 glob 展开）、增量 diff、状态读写 |
| `src/cli/docs-config.js` | docs-repo 克隆/拉取/push、目录初始化、全局配置读写 |

### 修改

| 文件 | 变化 |
|---|---|
| `src/cli/commands/init.js` | 检测 workspace 上下文，分叉到 workspace / 单项目两条路径；新增 `--slug`、`--slug-map`、`--global` 参数 |
| `src/cli/commands/doctor.js` | 新增 workspace 级聚合检查；新增 orphaned / uninitialized 项目提示 |
| `src/cli/state.js` | `normalizeState` 新增可选 `docs` 字段；新增 workspace state 的读写函数 |

### 暂不改动

- 所有 spec-* skill 的实际路径写入（skill 层 resolveDocsPath 接入为第三阶段）
- `adapters/`、`lang-policy.js`、`developer.js`（无需修改）

---

## 17. 实施分期

### 第一阶段：workspace 检测 + 发现 + 状态 + init

- `workspace.js`：检测、发现、slug 推断、状态读写
- `docs-config.js`：clone/pull/push、目录初始化
- `init.js`：workspace 路径接入
- **收益**：workspace 场景下一次 init 完成所有子项目绑定

### 第二阶段：doctor + 增量扫描

- `doctor.js`：workspace 级聚合检查，orphaned / uninitialized 提示
- `init.js`：重新执行时触发增量扫描
- **收益**：新增项目无需手动操作，doctor 可全面感知状态

### 第三阶段：skill 层接入

- 所有 spec-* skill 读取 `resolveDocsPath` 决定写入目标
- bootstrap / plan / work / review / compound 实际写到 docs repo
- **收益**：文档与代码物理分离，协作链路完整

### 第四阶段：shared knowledge 接入

- `_shared/` 作为跨项目知识基座落地
- 与 Harness 改造方案中的 shared knowledge substrate 对齐

---

## 18. 关键决策记录

| 决策 | 选择 | 理由 |
|---|---|---|
| spec-docs 的定位 | 团队长期维护的知识库，spec-first 是写入方之一 | spec-docs 与任何团队项目等价，不应被工具接管；开发者保留完整 git 控制权 |
| docsLocalPath 归属 | 只存 global config（个人），不进入 workspace state | workspace state 应可 commit 共享；个人路径因人而异，混入会导致数据错乱 |
| workspace state.json 是否 commit | 是（只含 docsRepo URL + slug 映射） | 团队共享 slug 一致性；新成员 clone 后即可获知 docsRepo，无需口头传递 |
| global config 结构 | URL→localPath 映射表（docsRepos），支持多 org | 开发者可能同时参与多个 org，单一 defaultDocs 无法覆盖；映射表天然支持多 org |
| docsRepo 已知但 localPath 未配置 | INFO 引导提示，降级 in-repo，不阻断 | 新成员 onboarding 场景；强制报错会阻断整个 init，体验差 |
| 写入前预检 | 检测本地是否落后远端，落后时询问用户 | 提前发现冲突比写完后 push 失败体验好；但决策权在用户，不强制阻断 |
| init 阶段是否 pull | **必须先 pull**（ff-only），失败则中止 | pull 后才能正确判断哪些 slug 已存在；不 pull 直接创建会导致 push 冲突；脏状态下无法安全判断 |
| init push 冲突解决策略 | 自动 rebase，README.md 取 theirs | 目录结构是 additive 操作，天然不冲突；README.md 以先到先得为原则，避免人工干预 |
| orphaned slug 复用判断 | 比对 README.md 中 project-path | path 一致视为同一项目重新激活；path 不一致视为 slug 冲突 |
| skill 写入阶段是否 pull | 不自动 pull，提示用户决定 | 写作节奏是开发者自己的，auto-pull 干扰工作状态；决策权在用户 |
| 并发 skill 写入冲突 | 提示手动解决，产物保留本地 | 内容冲突无法自动合并；pre-check 是主要预防手段 |
| git 操作时机 | 仅在 skill 写入文档时 commit + push | spec-first 的职责是写入，不是管理 |
| 辅助首次 clone | 支持（可选），仅当 localPath 不存在时执行 | 降低首次配置摩擦，但不替代开发者的 git 工作流 |
| workspace 检测方式 | 自动检测，无需 `--workspace` flag | 减少用户心智负担；工具应感知上下文，不应把判断抛给用户 |
| workspace 声明来源 | 优先读取 pnpm/npm/turbo/nx 等现有声明 | 不重复造轮子；现有声明是权威信息来源 |
| 子项目初始化时机 | workspace 根目录 init 时全量初始化 | workspace 根目录是控制平面，用户无需进入每个子目录 |
| 新增项目发现时机 | 重新执行 init 或 doctor 时增量扫描 | 无守护进程，无后台任务，保持工具轻量 |
| orphaned 项目处理 | 标记状态，不自动删除 docs-repo 目录 | 历史文档有价值，删除是破坏性操作，需要用户显式清理 |
| push 失败是否阻断 | 不阻断，给警告 | 网络问题不应中断本地配置流程 |
| slug 冲突是否阻断 | 阻断，要求手动指定 | 静默处理冲突会导致数据写到错误位置，危险性高 |
| workspace state 位置 | `<workspace>/.spec-first/state.json` | 与项目 `.claude/` 分离，workspace 状态属于 workspace 而非某个具体项目 |
| 单项目模式 | 代码路径完全不变 | 保证已有用户零迁移成本 |
| state.json 并发冲突处理 | .gitattributes merge=union + 损坏时重新全量扫描重建 | union merge 覆盖只增不减的 projects 对象；重建不丢数据；比 custom merge driver 成本低 |
| 分支保护下的 push 失败 | 检测 stderr 关键词，支持 --docs-branch，global config 可设默认分支 | 区分策略拒绝与网络失败；--docs-branch 给团队 PR 工作流提供标准路径 |
| 仓库迁移后的三处 URL 同步 | init --docs-repo <new-url> 联动更新 state.json + global config + git remote | 三处一次同步，杜绝 URL 漂移；doctor URL 一致性检查作为日常巡检 |
| 跨 workspace slug 冲突检测 | README.md 使用 (workspace-repo + project-path) 双键标识 | 纯 project-path 不唯一（不同 workspace 可有同名子目录）；workspace-repo 是跨机器的稳定标识 |
| 无 git remote 的 workspace 标识 | local:<workspace-dir-name-hash> | 纯本地 workspace 无 remote URL；hash 提供区分度，不依赖绝对路径（跨机器可能不同） |
| staged 残留的恢复策略 | 识别为本次目标 slug → 跳过 pull，走情况二恢复；否则报错给 reset 指引 | 中断的 init 应能幂等恢复；staged 内容不可 stash，提示 reset 比提示 stash 更准确 |
| git lock 竞争 | 主动检测 index.lock，不自动删除 | 误删活跃 lock 会损坏 git 数据；让用户自行确认更安全 |
| --slug-prefix | 写入 workspace state.json，后续 init/skill 自动沿用 | org 级 spec-docs 多 workspace 共用时，prefix 是最低成本的命名空间隔离手段 |
