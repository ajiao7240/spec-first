# graphify Contract

本文件定义 `spec-graph-bootstrap` 消费 `graphify` 产物时的最小 contract。

> **重要**：graphify 不提供 `graphify <path>` 形式的 CLI 构建命令。
> 图谱构建通过 graphify 自身的 SKILL.md 驱动（用户运行 `/graphify`）。
> 本 skill 仅消费已构建的产物。

## 目录 contract

默认输出目录：

```text
<target>/
└── graphify-out/
    ├── GRAPH_REPORT.md       ← 必需：agent 第一入口
    ├── graph.json            ← 可选：机器查询层
    ├── graph.html            ← 可选：人类可视化
    ├── manifest.json         ← 可选：增量构建依据
    └── wiki/                 ← 可选：按社区切分的 Markdown 导航
```

## GRAPH_REPORT.md 最小 schema

以下章节为必须存在的结构（若缺失则视为产物不完整）：

```text
# Corpus Check           ← 必需：文件统计、语言分布
## Summary                ← 必需：整体概述
## God Nodes              ← 必需：高连接节点列表，格式 "N. `label` - M edges"
## Surprising Connections ← 可选但有价值：反直觉连接
## Hyperedges             ← 可选：组关系
## Communities            ← 必需：社区聚类，格式 "### Community N - Label" + Cohesion
## Ambiguous Edges        ← 可选：语义模糊连接
## Knowledge Gaps         ← 可选：信息缺口
## Suggested Questions    ← 可选：探索建议
```

**版本兼容性**：本 schema 基于 graphify 当前版本。如果 graphify 升级后章节名称变化，
spec-graph-bootstrap 的摘要提取可能失效。遇到异常时应回退到全文阅读并人工提取。

## 文件职责

### `GRAPH_REPORT.md`

用途：

- agent 和人共同的第一入口
- 先读结构，再决定要不要下钻源码

应优先关注：

- Corpus Check
- Summary
- God Nodes
- Surprising Connections
- Communities

### `graph.json`

用途：

- 机器可查询层
- 后续可支持 query/path/explain/漂移检测

限制：

- 不应作为第一阅读入口
- 不应在 skill 启动时整体加载

### `wiki/`

用途：

- 按社区切分的 Markdown 导航层
- 适合 agent 做“从 index 进入，再按文章跳转”的阅读模式

优先级：

- 低于 `GRAPH_REPORT.md`
- 高于直接通读 `graph.json`

## 消费顺序

固定顺序如下：

1. `GRAPH_REPORT.md`
2. `wiki/index.md` 与相关 wiki 页面（若存在）
3. `graph.json`（按需）

## 与 spec-docs 的关系

`graphify` 产物属于**结构导航层**，不是长期真相层。

适合辅助生成：

- `contexts/summary.md`
- `contexts/architecture/module-map.md`
- `contexts/architecture/overview.md`

不应直接作为终稿来源：

- `contexts/conventions.md`
- `contexts/pitfalls/index.md`
- `solutions/*`

## 冲突处理

若 `graphify` 与人工确认后的 `spec-docs` 冲突：

1. 以人工确认后的 `spec-docs` 为准
2. 必要时重新运行 `graphify`
3. 若冲突持续，视为图谱发现误差，而不是知识库错误

## 降级行为

| 场景 | 行为 |
|---|---|
| 无 `graphify-out/` | 提示用户运行 `/graphify`，或直接走 `spec-bootstrap` |
| 有 `graphify-out/` 但缺少 `GRAPH_REPORT.md` | 视为不完整产物（可能为崩溃残留），建议重新运行 `/graphify` |
| 有 `GRAPH_REPORT.md` 但缺少必需章节（如无 Communities） | 降级为全文阅读模式，手动提取结构信息 |
| 有 `GRAPH_REPORT.md` 无 `wiki/` | 正常继续 |
| 有 `GRAPH_REPORT.md` 无 `graph.json` | 可继续，但失去机器查询层 |
| GRAPH_REPORT.md 内容与上次消费时显著不同（graphify 升级） | 警告用户格式可能变化，建议重新审视提取结果 |

