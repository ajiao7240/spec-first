---
name: spec-graph-bootstrap
description: 消费 graphify-out 图谱产物，输出结构摘要，为 spec-bootstrap 和 spec-docs 提供上游结构先验。适用于已有 graphify-out/ 需要消费、或希望将 graphify 结果接入 spec-first 工作流时。
argument-hint: "[target path, optional; default: .]"
---

# Graph Bootstrap

将 `graphify` 的图谱产物作为 `spec-first` 的上游结构先验消费，而不是替代 `spec-bootstrap`。

## 这个 skill 做什么

它负责 3 件事：

1. 检查目标目录是否已有 `graphify-out/`
2. 读取 `graphify-out/GRAPH_REPORT.md`，必要时再读 `wiki/` 或 `graph.json`
3. 输出一份结构摘要到 `.context/spec-first/graph-bootstrap/<slug>/`，供后续 `spec-bootstrap` 消费

## 决策矩阵

Agent 在决定是否触发本 skill 时，按以下规则判断：

| 条件 | 动作 |
|------|------|
| `graphify-out/GRAPH_REPORT.md` 已存在 | 运行本 skill，消费已有产物 |
| 没有 `graphify-out/` 且项目文件 > 50 个 | 提示用户先运行 `/graphify`，完成后再回来运行本 skill |
| 没有 `graphify-out/` 且项目文件 <= 50 个 | 直接走 `spec-bootstrap`，不需要 graphify |
| 已运行本 skill 且摘要已生成 | 下一步运行 `spec-bootstrap` |

**Phase 2 后**：spec-bootstrap 将内联对已有 `graphify-out/` 的自动消费，本 skill 仅用于需要独立执行结构预检的场景。

## 何时使用

- 目标目录下已经有 `graphify-out/`（用户已通过 `/graphify` 构建完成）
- 你准备进入 `spec-bootstrap`，希望先拿到模块、社区、连接关系的高层视图
- 目标目录里不只是代码，还混有文档、PDF、图片、研究资料
- 你刚进入一个大型或陌生代码库，想先看结构再看源码

## 不做什么

- 不主动调用 graphify 构建图谱（graphify 是通过 `/graphify` skill 驱动的，不是 CLI 命令）
- 不把 `graphify` 当成长期真相层
- 不直接生成 `spec-docs` 终稿
- 不自动生成 `conventions.md`
- 不自动生成 `pitfalls/index.md`
- 不自动生成 `solutions/*`

当 `graphify` 的结构发现结果与人工确认后的 `spec-docs` 冲突时，以 `spec-docs` 为准。

## 支持文件

按需读取，不要在 skill 启动时全部加载：

- `references/graphify-contract.md`
  什么时候读取：需要确认 `graphify-out/` 的目录 contract、消费顺序、降级行为时

## 执行流程

### Phase 1：确定目标目录

- 如果用户给了路径，使用该路径
- 如果用户没给路径，默认使用当前目录 `.`
- 不要为路径重复发问，除非路径不存在

如果目标目录不存在，立即停止并告诉用户。

### Phase 2：检查 graphify 产物

按以下顺序检查：

1. `<target>/graphify-out/GRAPH_REPORT.md`
2. `<target>/graphify-out/graph.json`
3. `<target>/graphify-out/wiki/index.md`

**安全前置检查**：

在读取任何产物之前，检查目标目录是否存在 `.graphifyignore` 或 `.gitignore` 中的敏感排除规则。如果 `GRAPH_REPORT.md` 中出现以下模式，在输出摘要时必须脱敏：
- 环境变量值（`DATABASE_URL=...`、`API_KEY=...`）
- 文件路径中包含 `secret`、`credential`、`key`、`token`、`.env` 的内容
- 内部 IP 地址和主机名

处理规则：

- 如果 `GRAPH_REPORT.md` 已存在：验证产物完整性，进入 Phase 4
- 如果 `graphify-out/` 不存在：进入 Phase 3
- 如果只存在部分产物：
  - 有 `GRAPH_REPORT.md` 就可继续
  - 没有 `GRAPH_REPORT.md` 视为不完整产物，建议用户重新运行 `/graphify`

**产物完整性校验**：

如果 `graphify-out/manifest.json` 存在，读取并检查：
- `GRAPH_REPORT.md` 是否存在（必需）
- 如果 manifest 中记录了 `wiki/` 但 wiki 不存在，记录为不完整但不阻断

### Phase 3：引导用户构建

> **注意**：graphify 不提供 `graphify <path>` 这样的 CLI 构建命令。图谱构建通过 graphify 自身的 SKILL.md 驱动（即 `/graphify`）。

如果没有 `graphify-out/`，执行以下步骤：

1. 报告当前状态：目标目录没有 `graphify-out/`
2. 提示用户：

```text
目标目录尚未构建 graphify 图谱。请先运行：

    /graphify <target-path>

构建完成后，重新运行本 skill 消费图谱产物。

或者，跳过图谱辅助，直接运行 spec-bootstrap：
    /spec:bootstrap <target-path>
```

3. 停止执行，不伪造图谱摘要
4. 如果用户选择跳过，建议直接进入 `spec-bootstrap`

### Phase 4：消费 graphify 产物

消费顺序必须固定：

1. **先读** `graphify-out/GRAPH_REPORT.md`
2. **再按需读** `graphify-out/wiki/index.md` 和相关 wiki 页面
3. **最后才考虑** `graphify-out/graph.json`

读取规则：

- 不要一上来就通读 `graph.json`
- `graph.json` 是机器可查询层，不是首选阅读入口
- `GRAPH_REPORT.md` 是 agent 和人共同的第一入口
- wiki 只在需要进一步理解某个社区或节点时再读

### Phase 5：输出结构摘要

#### 5.1 确定 slug

复用 spec-bootstrap 的 slug 派生规则：

1. 扫描 `<target>/docs/contexts/*/README.md` 寻找 `<!-- spec-bootstrap -->` 标记
   - 1 个匹配 → 复用该 slug
   - 多个匹配 → 选择最近修改的
2. 无匹配 → 从目标目录名派生 kebab-case slug
3. 不要为 slug 确认阻断用户

#### 5.2 写入文件

将摘要持久化到 `.context/spec-first/graph-bootstrap/<slug>/`：

```text
.context/spec-first/graph-bootstrap/<slug>/
├── summary.md        ← 结构摘要（必需）
├── sources.json      ← 消费的 graphify 产物清单（必需）
└── status.json       ← 运行状态（必需）
```

**summary.md** 格式：

```markdown
---
slug: <slug>
target_path: <target-path>
graphify_status: hit|miss|partial
generated_at: <ISO 8601>
---

# 结构摘要 — <project-name>

## Corpus 概况
- 文件规模：<从 GRAPH_REPORT.md Corpus Check 提取>
- 是否值得走图谱导航：<判断>

## 核心结构
- god nodes：<从 GRAPH_REPORT.md 提取>
- 核心社区：<从 GRAPH_REPORT.md Communities 提取>
- 高连接模块：<从 God Nodes 和 Surprising Connections 提取>

## 值得注意的连接
- 跨模块耦合
- 出人意料的连接
- 可能的共享抽象

## 推荐阅读路径
1. 先读哪些模块
2. 再读哪些页面 / 文件
3. 最后才下钻源码

## 对 spec-first 的建议映射
| spec-docs 页面 | graphify 辅助程度 | 建议操作 |
|---|---|---|
| contexts/summary.md | ~70% | 社区名称、god nodes 可直接使用 |
| architecture/module-map.md | ~50% | 模块边界和依赖可参考 |
| architecture/overview.md | ~30% | Hyperedges 可辅助数据流描述 |
| conventions.md | 0% | 不从 graphify 生成 |
| pitfalls/index.md | 0% | 不从 graphify 生成 |
```

**sources.json** 格式：

```json
{
  "graph_report": "<target>/graphify-out/GRAPH_REPORT.md",
  "wiki_index": "<target>/graphify-out/wiki/index.md 或 null>",
  "graph_json": "<target>/graphify-out/graph.json 或 null>",
  "manifest": "<target>/graphify-out/manifest.json 或 null>"
}
```

**status.json** 格式：

```json
{
  "status": "hit",
  "graphify_available": true,
  "report_integrity": "complete|partial|missing",
  "wiki_available": true,
  "notes": "直接消费已有 graphify-out/"
}
```

`status` 取值：`hit`（直接消费已有产物）、`miss`（无产物，已引导用户构建）、`partial`（产物不完整但仍可用）。

#### 5.3 脱敏处理

在写入 summary.md 之前，对从 GRAPH_REPORT.md 提取的内容做脱敏检查：
- 移除或遮盖环境变量值
- 移除敏感文件路径中的关键值
- 如果 GRAPH_REPORT.md 包含可疑的敏感内容，在 summary.md 开头添加警告

### Phase 6：向下游 handoff

如果用户接下来要继续进入 `spec-bootstrap` 或生成 `spec-docs`，使用以下原则：

- 将 graphify 摘要视为**结构先验**
- 关键事实仍需要源码核实
- 不要直接把 `GRAPH_REPORT.md` 原样搬进 `spec-docs`
- `conventions`、`pitfalls`、`solutions` 必须经过二次提炼

建议 handoff 时使用这种表述：

```text
graphify 已提供结构导航层，可据此生成：
- summary 初稿
- module-map 初稿
- overview 的主骨架

仍需回到源码确认：
- 项目特有约定
- 高风险陷阱
- 团队经验和架构决策
```

## 输出质量要求

一份合格的输出至少应满足：

- 明确说明是否命中已有 `graphify-out/`
- 明确区分”图谱发现”与”人工确认真相”
- 给出可执行的下一步阅读顺序
- 能让后续 `spec-bootstrap` 少做一轮盲扫
- `summary.md` 的 frontmatter 完整（slug、target_path、graphify_status、generated_at）

## graphify-out/ 生命周期管理

### 版本控制建议

| 产物 | 应否提交到 VCS | 原因 |
|------|---------------|------|
| `GRAPH_REPORT.md` | 建议提交 | 文本文件、体积小、团队共享结构视图 |
| `graph.json` | 视情况 | 可能为数 MB；若需 Phase 3 漂移检测则提交 |
| `graph.html` | 不建议 | 体积大、可从 graph.json 重新生成 |
| `wiki/` | 建议提交 | Markdown、体积适中、团队可浏览 |
| `manifest.json` | 建议提交 | 增量更新和过期检测的基线 |

### 清理与刷新

- 代码大幅变更后应重新运行 `/graphify` 更新图谱
- `spec-bootstrap` 在 Phase 1.3 分析前应检查 `graphify-out/manifest.json` 与当前文件时间戳的差异，提示是否需要刷新
- `graphify-out/` 可安全删除并重建，无副作用

### .gitignore 建议

```gitignore
# graphify-out/ 建议选择性提交，如果团队不需要图谱版本控制：
# graphify-out/
# 如果选择性提交，至少忽略大文件：
graphify-out/graph.html
```

---

## Completion Checklist

- [ ] `GRAPH_REPORT.md` 已读取并提取关键结构信息
- [ ] 敏感信息已脱敏
- [ ] `.context/spec-first/graph-bootstrap/<slug>/summary.md` 已写入且 frontmatter 完整
- [ ] `.context/spec-first/graph-bootstrap/<slug>/sources.json` 已写入
- [ ] `.context/spec-first/graph-bootstrap/<slug>/status.json` 已写入
- [ ] 结构摘要覆盖 5 个必需部分（Corpus、核心结构、值得注意的连接、阅读路径、spec-docs 映射）
- [ ] graphify 产物与 spec-docs 的权威性关系已向用户说明

## 快速判断

如果你只需要一句判断：

- `graphify` 负责“先把结构找出来”
- `spec-first` 负责“把值得长期保存的知识定稿下来”

