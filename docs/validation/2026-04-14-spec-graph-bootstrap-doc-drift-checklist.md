# spec-graph-bootstrap 需求文档口径漂移清单

## 1. 目的

本文档用于补充 `spec-graph-bootstrap` 阶段 0/1/2/3 正式审查报告，专门记录**历史需求文档**与**当前仓库已收敛实现契约**之间的口径漂移，避免后续审查把“旧文档未清理”误判成“当前实现缺陷”。

当前审查基线见：

- `docs/validation/2026-04-14-spec-graph-bootstrap-phase0-3-audit-report.md`

当前仓库已收敛基线为：

- 控制面路径：`.spec-first/workflows/bootstrap/<slug>/`
- 文档路径：`docs/contexts/<slug>/`
- manifest：`artifact-manifest.json`
- Stage-0 样本：`docs/contexts/spec-first/`
- 路由结构：`always + stages + selection_rules + advice`
- Stage-0 消费顺序：`always[] -> stages.<stage>[] -> selection_rules(output_exists.*) -> advice.<stage>`
- v1 显式跳过 `fact.*` 规则

---

## 2. 漂移总览

| 漂移主题 | 当前正确口径 | 漂移类型 | 优先级 |
| --- | --- | --- | --- |
| 控制面目录 | `.spec-first/workflows/bootstrap/<slug>/` | 旧路径残留 | 高 |
| manifest 文件名 | `artifact-manifest.json` | 旧文件名残留 | 高 |
| 路由结构 | `always + stages + selection_rules + advice` | 旧 schema/过渡语义残留 | 高 |
| task type 路由 | v1 不再生成 `task_types`，由 `stages` 与 `selection_rules` 收敛 | 旧能力边界未收口 | 中 |
| selection_rules 求值 | v1 仅固化 `output_exists.*`；`fact.*` 显式跳过 | 旧终局能力与当前实现混写 | 中 |
| slug 规则 | 当前源 skill 采用 `basename(resolve(target))` 并替换特殊字符为 `-` | 旧需求仍保留显式 slug / hash 扩展口径 | 中 |
| 验证结论 | 当前样本与单测已修复 plan/work 重复注入 | 旧验证记录过时 | 中 |

---

## 3. 文件级漂移清单

## 3.1 `修订终版.md`

文件：

- `docs/01-需求分析/spec-graph-bootstrap需求/修订终版.md`

### 已对齐项

以下核心口径已与当前实现一致：

- 控制面根目录使用 `.spec-first/workflows/bootstrap/<slug>/`
- 文档根目录使用 `docs/contexts/<slug>/`
- `artifact-manifest.json` 已作为统一索引文件
- 最小闭环产物集合与当前源 skill 基本一致

证据：

- `docs/01-需求分析/spec-graph-bootstrap需求/修订终版.md:516-524`
- `docs/01-需求分析/spec-graph-bootstrap需求/修订终版.md:552-589`

### 漂移项 A：`task_type` / `fact.*` 仍按终局路由能力表述
文档仍写到 `injection-index.yaml` 至少应表达：

- `stage`
- `task_type`
- `fact.*.present`
- `fact.*.confidence`
- `output_exists.*`

证据：

- `docs/01-需求分析/spec-graph-bootstrap需求/修订终版.md:341-360`

但当前仓库已收敛到：

- v1 样本结构为 `always + stages + selection_rules + advice`
- `task_types` 不再生成
- `fact.*` 规则在 Stage-0 消费中显式跳过
- `output_exists.*` 才是当前实际生效的选择规则

对应当前实现证据：

- `docs/contexts/spec-first/injection-index.yaml:1-30`
- `tests/unit/spec-graph-bootstrap-contracts.test.js:39-47`
- `skills/spec-plan/SKILL.md`
- `skills/spec-work/SKILL.md`
- `skills/spec-code-review/SKILL.md`

### 建议修订
将该段改成两层表述：

1. **终局目标**：可扩展到 `task_type` / `fact.*` 条件；
2. **v1 当前实现**：只固化 `always + stages + selection_rules(output_exists.*) + advice`，并显式说明 `fact.*` 在 v1 跳过。

### 漂移项 B：slug 生成规则仍保留更宽的终局设计
文档仍写“用户显式传入 slug / 冲突附加短 hash / 可创建 `<slug>-v2`”等策略。

证据：

- `docs/01-需求分析/spec-graph-bootstrap需求/修订终版.md:526-549`

而当前源 skill 的 Phase 0 已收敛为更简单规则：

- `slug = basename(resolve(target))`
- 特殊字符替换为 `-`

对应当前实现证据：

- `skills/spec-graph-bootstrap/SKILL.md:31-42`

### 建议修订
将现有复杂 slug 方案改标为“后续增强/设计保留”，并补一句：

- “v1 当前实现按 `basename(resolve(target))` 生成并标准化，不支持显式 slug 指定。”

---

## 3.2 `阶段化开发与验证路线图.md`

文件：

- `docs/01-需求分析/spec-graph-bootstrap需求/阶段化开发与验证路线图.md`

### 漂移项 A：控制面路径仍写旧 `.context/...`
文档在总原则中明确写：

- 第一版复用 `docs/contexts/<slug>/` 与 `.context/spec-first/bootstrap/<slug>/` 路径

证据：

- `docs/01-需求分析/spec-graph-bootstrap需求/阶段化开发与验证路线图.md:23-29`

但当前仓库基线已收敛为：

- `.spec-first/workflows/bootstrap/<slug>/`

对应当前实现证据：

- `skills/spec-graph-bootstrap/SKILL.md:127-155`
- `skills/spec-graph-bootstrap/SKILL.md:567-583`
- `docs/validation/2026-04-14-spec-graph-bootstrap-phase0-3-audit-report.md:12-18`

### 建议修订
把 `.context/spec-first/bootstrap/<slug>/` 全量替换为 `.spec-first/workflows/bootstrap/<slug>/`，并加一条注释说明：

- 旧 `.context/...` 属于历史实施阶段口径，已完成迁移。

### 漂移项 B：阶段 2A 仍使用 `fingerprints.json`
文档在阶段 2A 开发任务中仍写：

- 生成 `fingerprints.json` 初版结构

并在验证任务中检查：

- `fingerprints.json` 顶层结构是否至少包含 `inputs`、`outputs`、`updated_at`

证据：

- `docs/01-需求分析/spec-graph-bootstrap需求/阶段化开发与验证路线图.md:88-105`

但当前实现已经统一改为：

- `artifact-manifest.json`

对应当前实现证据：

- `skills/spec-graph-bootstrap/SKILL.md:127-155`
- `skills/spec-graph-bootstrap/SKILL.md:453-461`

### 建议修订
全量替换：

- `fingerprints.json` -> `artifact-manifest.json`

并把验证项收敛为：

- `schema_version`
- `generated_at`
- `updated_at`
- `status`
- `inputs`
- `outputs`

### 漂移项 C：阶段 4 刷新语义仍写旧文件名
文档阶段 4 仍写：

- 完善 `fingerprints.json` 依赖模型

证据：

- `docs/01-需求分析/spec-graph-bootstrap需求/阶段化开发与验证路线图.md:241-247`

### 建议修订
统一改为：

- 完善 `artifact-manifest.json` 依赖模型

---

## 3.3 `阶段命令-产物变化对照表.md`

文件：

- `docs/01-需求分析/spec-graph-bootstrap需求/阶段命令-产物变化对照表.md`

### 主要漂移类型
该文件在之前审查中已确认存在历史路径/旧命名残留，属于“阶段性对照表未同步迁移”的典型文档。虽然本轮未再次完整展开全文，但它已被上游路线图与审查计划明确列为历史冲突来源。

当前需要重点排查并统一修订的主题有：

1. 控制面目录是否仍写 `.context/spec-first/bootstrap/<slug>/`
2. manifest 文件名是否仍写 `fingerprints.json`
3. 路由结构是否仍保留 `task_types` 或旧 fallback 语义
4. Phase 3 消费是否仍按旧的重复注入口径描述

### 建议修订
该文件建议按“命令 -> 当前产物 -> 当前消费方 -> 历史别名（如有）”四列重写，避免继续夹带迁移前命名。

---

## 3.4 验证记录（3A / 3B）

相关文件：

- `docs/validation/graph-bootstrap-3a-logs/2026-04-13-spec-plan-stage0-consumption.md`
- `docs/validation/graph-bootstrap-3a-logs/2026-04-13-spec-work-stage0-consumption.md`
- `docs/validation/graph-bootstrap-3a-logs/2026-04-13-spec-review-stage0-consumption.md`
- `docs/validation/2026-04-13-spec-graph-bootstrap-stage3b-test-report.md`

### 漂移项：重复注入结论已过时
旧验证记录曾保留 `public-entrypoints.md` 在 `plan/work` 中重复注入的问题；但当前样本与单测已经明确要求修复。

当前实现证据：

- `docs/contexts/spec-first/injection-index.yaml:5-25`
- `tests/unit/spec-graph-bootstrap-contracts.test.js:39-47`

### 建议修订
不建议直接覆盖旧验证记录正文，而是建议：

1. 在原记录顶部追加“时点说明”；或
2. 新增一条补充验证记录，明确当前头状态已修复该问题。

---

## 4. 建议修订顺序

### 第一优先级（先改）

1. `阶段化开发与验证路线图.md`
   - 旧 `.context/...` 路径
   - `fingerprints.json` 命名
   - Phase 4 刷新仍用旧文件名

2. `阶段命令-产物变化对照表.md`
   - 命令到产物的历史命名残留
   - 可能存在的旧路由结构描述

### 第二优先级（再改）

3. `修订终版.md`
   - `task_type` / `fact.*` 作为终局能力与 v1 当前实现未分层
   - slug 规则仍写得比当前实现更宽

### 第三优先级（补说明）

4. 3A / 3B 验证记录
   - 补当前头状态说明
   - 明确“旧结论 = 历史时点，不等于当前失败”

---

## 5. 最终判断

当前 `spec-graph-bootstrap` 的主要问题已不是“代码未实现”，而是**文档 source-of-truth 清理落后于实现收敛**。

因此后续工作重点应从“继续怀疑实现是否完成”，转为：

1. 清理需求文档中的历史迁移残留；
2. 给验证记录补时点说明；
3. 让需求文档、样本、单测、源 skill 四者重新回到同一口径。
