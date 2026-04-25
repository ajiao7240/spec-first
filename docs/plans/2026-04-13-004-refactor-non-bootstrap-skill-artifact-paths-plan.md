# 非 bootstrap Skill 控制面路径迁移计划

```
文件：docs/plans/2026-04-13-004-refactor-non-bootstrap-skill-artifact-paths-plan.md
状态：completed（2026-04-13）
优先级：P1
关联：docs/06-待办事项/03-非bootstrap-skill控制面路径迁移.md
前置：docs/plans/2026-04-13-003-refactor-artifact-path-hard-cut-plan.md（已完成）
```

---

## 完成说明

本计划对应的迁移已于 2026-04-13 完成并入库。

- Unit 1–6：`skills/*/SKILL.md` 已完成路径切换；todos canonical 已切换到 `docs/todos/`
- Unit 7：`docs/02-架构设计/02-目录结构.md` 已补齐 `.spec-first/workflows/*` 与 `docs/todos/` 说明
- Unit 8：`tests/smoke/cli.sh` 已补充 workflow scratch path 与 todo canonical 的 negative guard
- Unit 9：`CLAUDE.md` 与 `CHANGELOG.md` 已同步更新

本文保留为实施记录，不再作为待执行计划。

---

## 目标

将 6 个非 bootstrap skill 的控制面路径从 `.context/spec-first/` 迁移到方案三布局，并将 todos 持久工作项升级为 `docs/todos/` VCS 资产；`.context/` 不再作为正式写入目录，仅保留 todo legacy read-only 兼容层。

---

## 设计决策

### 最终路径布局（方案三）

```text
.spec-first/
├── graph/                          # CRG 引擎产物（gitignored）
└── workflows/
    ├── bootstrap/<slug>/           # bootstrap 控制面（已完成）
    ├── spec-code-review/<run-id>/       # review per-run 输出（gitignored）
    ├── spec-plan/deepen/           # plan deepen 暂存（gitignored）
    ├── feature-video/<run-id>/     # 截图/视频暂存（gitignored）
    └── todo-resolve/<run-id>/      # resolve 并发暂存（gitignored）

docs/
├── brainstorms/                    # 需求文档（VCS）
├── plans/                          # 实施计划（VCS）
├── solutions/                      # 知识积累（VCS）
├── contexts/<slug>/                # bootstrap 输出（VCS）
└── todos/                          # 持久工作项追踪（VCS，本次新增）
```

### todos 升级为 `docs/` 层的理由

- todos 是带 YAML frontmatter 的 Markdown 工作项，与 `docs/plans/`、`docs/solutions/` 性质相同
- legacy 路径 `todos/`（原始）已是 VCS 资产，迁移到 `.context/spec-first/todos/` 是命名空间整理，不是要隐藏它
- `.spec-first/` 整体 gitignored，放在其中会导致多人协作时工作项不可见
- 默认可入库，用户如不想提交可自行在项目 `.gitignore` 添加 `docs/todos/`

### 遗留路径兼容策略

todos 有两层历史遗留：
- Legacy v1：`todos/`（原始项目根目录）
- Legacy v2：`.context/spec-first/todos/`（上一版本 canonical）

本次迁移：**写入切到 `docs/todos/`，读取保留 v1/v2 legacy 兼容层**（read-only），下个版本再彻底清除。

其他 4 个 workflow 暂存目录（spec-code-review/spec-plan/feature-video/todo-resolve）采用**硬切换，无 fallback**，与 bootstrap 迁移策略一致。

---

## 路径变更全量映射

| Skill | 产物类型 | 旧路径 | 新路径 |
|-------|---------|--------|--------|
| `spec-code-review` | per-run 产物 | `.context/spec-first/spec-code-review/<run-id>/` | `.spec-first/workflows/spec-code-review/<run-id>/` |
| `spec-plan` | deepen 暂存 | `.context/spec-first/spec-plan/deepen/` | `.spec-first/workflows/spec-plan/deepen/` |
| `todo-create` | 持久工作项（写） | `.context/spec-first/todos/` | `docs/todos/` |
| `todo-triage` | 持久工作项（读） | `.context/spec-first/todos/` | `docs/todos/` |
| `todo-resolve` | 持久工作项（读）+ 暂存 | `.context/spec-first/todos/` + `.context/spec-first/todo-resolve/<run-id>/` | `docs/todos/` + `.spec-first/workflows/todo-resolve/<run-id>/` |
| `feature-video` | 截图/视频暂存 | `.context/spec-first/feature-video/[RUN_ID]/` | `.spec-first/workflows/feature-video/[RUN_ID]/` |

---

## 实施单元

### Unit 1：`skills/spec-code-review/SKILL.md`

**3 处替换**（硬切换，无 fallback）：

| 行号 | 变更 |
|------|------|
| 44 | `.context/spec-first/spec-code-review/<run-id>/` → `.spec-first/workflows/spec-code-review/<run-id>/` |
| 51 | 同上（report-only mode 的 "do not write" 说明） |
| 496 | 同上（Step 4 emit artifacts） |

---

### Unit 2：`skills/spec-plan/SKILL.md`

**1 处替换**：

| 行号 | 变更 |
|------|------|
| 817 | `.context/spec-first/spec-plan/deepen/` → `.spec-first/workflows/spec-plan/deepen/` |

> 注：`spec-plan` 的暂存目录不含 run-id，因单次 deepen 阶段结束即清理，永远只有一个当前目录。

---

### Unit 3：`skills/feature-video/SKILL.md`

**11 处替换**（全部 `.context/spec-first/feature-video/` → `.spec-first/workflows/feature-video/`）：

| 行号 | 内容 |
|------|------|
| 62 | upload-only resume 示例路径 |
| 152 | `mkdir -p ... screenshots` |
| 153 | `mkdir -p ... videos` |
| 161 | screenshot 01-start.png |
| 168 | screenshot 02-navigate.png |
| 175 | screenshot 03-feature.png |
| 180 | screenshot 04-result.png |
| 188 | ffmpeg 输入 glob 路径 |
| 190 | ffmpeg 输出 mp4 路径 |
| 268 | `[VIDEO_FILE_PATH]` 说明注释 |
| 322 | cleanup `rm -r` 全目录 |
| 328 | cleanup `rm -r` screenshots 子目录 |

---

### Unit 4：`skills/todo-create/SKILL.md`（含遗留兼容层）

**5 处变更**：

```
# Overview（第 11 行）
旧：The `.context/spec-first/todos/` directory is a file-based tracking system
新：The `docs/todos/` directory is a file-based tracking system

# Legacy support 注释（第 13 行）
旧：Always check both `.context/spec-first/todos/` (canonical) and `todos/` (legacy)
新：Always check `docs/todos/` (canonical), `.context/spec-first/todos/` (legacy-v2),
    and `todos/` (legacy-v1) when reading. Write new todos only to the canonical path.

# Directory Paths 表格（第 17-20 行）
旧：
  | Canonical (write here) | .context/spec-first/todos/ |
  | Legacy (read-only)     | todos/                     |

新：
  | Canonical (write here)  | docs/todos/                     |
  | Legacy v2 (read-only)   | .context/spec-first/todos/      |
  | Legacy v1 (read-only)   | todos/                          |

# Creating a New Todo（第 59 行）
旧：mkdir -p .context/spec-first/todos/
新：mkdir -p docs/todos/
```

---

### Unit 5：`skills/todo-triage/SKILL.md`

**1 处变更**：

```
# 第 15 行
旧：Read all pending todos from `.context/spec-first/todos/` and legacy `todos/` directories
新：Read all pending todos from `docs/todos/` (canonical), `.context/spec-first/todos/`
    (legacy-v2), and `todos/` (legacy-v1) directories
```

---

### Unit 6：`skills/todo-resolve/SKILL.md`

**3 处变更**：

```
# 第 15 行 — Scan 路径
旧：Scan `.context/spec-first/todos/*.md` and legacy `todos/*.md`.
新：Scan `docs/todos/*.md` (canonical), `.context/spec-first/todos/*.md` (legacy-v2),
    and `todos/*.md` (legacy-v1).

# 第 37 行 — 大集合暂存（硬切换）
旧：use a scratch directory at `.context/spec-first/todo-resolve/<run-id>/`
新：use a scratch directory at `.spec-first/workflows/todo-resolve/<run-id>/`

# 第 53 行 — Clean Up
旧：Delete completed/resolved todo files from both paths.
    If a scratch directory was created at `.context/spec-first/todo-resolve/<run-id>/`, delete it
新：Delete completed/resolved todo files from all three paths.
    If a scratch directory was created at `.spec-first/workflows/todo-resolve/<run-id>/`, delete it
```

---

### Unit 7：文档更新

**7.1 `docs/02-架构设计/02-目录结构.md`**

在 Section 4「CRG 与 Bootstrap 运行态产物视角」的目录树后，追加以下两块：

```text
# 追加：Workflow 其余运行时产物
your-project/
└── .spec-first/
    └── workflows/
        ├── bootstrap/<slug>/        ← 已有
        ├── spec-code-review/<run-id>/    ← 新增：per-run 产物
        ├── spec-plan/deepen/        ← 新增：deepen 暂存
        ├── feature-video/<run-id>/  ← 新增：截图/视频暂存
        └── todo-resolve/<run-id>/   ← 新增：resolve 并发暂存
```

在 Section 5「说明」追加两条：
- `docs/todos/` 是持久工作项目录（VCS 资产），由 todo-create/triage/resolve 工作流共享
- `.spec-first/workflows/` 下除 `bootstrap/` 外的子目录均为运行时暂存产物，随 `.spec-first/` 整体 gitignored

**7.2 `docs/06-待办事项/03-非bootstrap-skill控制面路径迁移.md`**

实施完成后将此文档状态标记为已完成，或删除（任务完成归档）。

---

### Unit 8：Smoke Test 扩充（`tests/smoke/cli.sh`）

在现有 negative guard 块（当前约第 278–295 行）追加：

```bash
# 检测 workflow 暂存路径未残留旧 .context/ 位置
for skill_file in ...; do
  if grep -Eq "\.context/spec-first/(spec-code-review|spec-plan|feature-video|todo-resolve)" "$skill_file"; then
    echo "✗ $skill_file still contains old workflow scratch path"
    FAILURES=$((FAILURES + 1))
  fi
done

# 检测 todo-create canonical 写入路径已切换
if grep -q "mkdir -p \.context/spec-first/todos" "$TMP_DIR/.claude/spec-first/workflows/todo-create/SKILL.md" 2>/dev/null; then
  echo "✗ todo-create SKILL.md still uses old todos canonical path"
  FAILURES=$((FAILURES + 1))
fi
```

---

### Unit 9：CLAUDE.md + CHANGELOG

**CLAUDE.md**：在 `artifact-paths.js` 描述末尾补充：

```
；todos 持久工作项目录（→ docs/todos/，VCS 资产，todo-create/triage/resolve 共享）
```

**CHANGELOG.md**：

```
- v1.6.0 2026-04-13 kuang: feat(skills): 非 bootstrap skill 控制面路径迁移——
  spec-code-review/spec-plan/feature-video/todo-resolve 暂存迁移至 .spec-first/workflows/<workflow>/；
  todos 持久工作项升级为 docs/todos/ VCS 资产，保留 .context/spec-first/todos/ 和 todos/ 两层
  read-only 遗留兼容；彻底清除 .context/ 作为运行时正式写入目录 (user-visible)
```

---

## 不在本次范围

| 项目 | 原因 |
|------|------|
| `docs/10-prompt/skills/` | 历史翻译快照，非 source-of-truth，不影响运行时 |
| `docs/01-需求分析/` 下的旧路径引用 | 研究/设计历史文档，归档用 |
| `.gitignore` 新增条目 | `.spec-first/` 已覆盖所有暂存路径，`docs/todos/` 设计为可入库 |
| `.context/spec-first/todos/` legacy 的彻底删除 | 留作下一个版本清除，本次只降为 read-only |

---

## 验收标准

- [x] Unit 1–6：6 个 `skills/*/SKILL.md` 路径全部切换，无旧路径残留（legacy 声明除外）
- [x] Unit 7：`docs/02-架构设计/02-目录结构.md` Section 4/5 包含新路径描述
- [x] Unit 8：smoke test negative guard 覆盖新迁移的 4 个暂存路径 + todo canonical
- [x] Unit 9：`CHANGELOG.md` 有对应记录，`CLAUDE.md` 已更新
- [x] repo-wide sweep：`grep -r "\.context/spec-first/" skills/` 只在 todo legacy 声明行出现，其余为零
- [x] 待办文档 `docs/06-待办事项/03-...` 状态更新为已完成或删除
