# `spec-graph-bootstrap` 与 `code-review-graph` MCP 能力对照表

> 本文是增强适配研究文档，不是 `spec-graph-bootstrap` v1 主链路需求合同。
>
> 如与 [修订终版.md](./修订终版.md) 或四份阶段需求文档冲突，以总版与阶段需求文档为准。
>
> 本文的作用是讨论后续版本如何有选择地吸收 `code-review-graph` MCP 能力，而不是重定义 v1 的 facts-first、自给自足主链路。

## 1. 目的

本文只回答一件事：

**`spec-graph-bootstrap` 在后续增强阶段可以接哪些 `code-review-graph` MCP 能力，为什么接，怎么接，哪些暂时不接。**

本表面向的目标是：

- 让 `plan / work / review` 更准
- 让增量刷新更可靠
- 让代码事实层真正可执行

结论先行：

- **v1 主链路仍以本地 facts-first、自给自足生成链路为准**
- **`code-review-graph` MCP 只作为后续增强适配候选，不是 v1 前置依赖**
- **`graphify` 不进入 v1 主链路**

---

## 2. 使用边界

### 2.1 仓库作用域工具

以下工具支持 `repo_root`，适合 `spec-graph-bootstrap` 在“外部仓库”上显式调用：

- `build_or_update_graph_tool`
- `run_postprocess_tool`
- `get_minimal_context_tool`
- `get_impact_radius_tool`
- `query_graph_tool`
- `get_review_context_tool`
- `semantic_search_nodes_tool`
- `embed_graph_tool`
- `list_graph_stats_tool`
- `find_large_functions_tool`
- `list_flows_tool`
- `get_flow_tool`
- `get_affected_flows_tool`
- `list_communities_tool`
- `get_community_tool`
- `get_architecture_overview_tool`
- `detect_changes_tool`
- `refactor_tool`
- `apply_refactor_tool`
- `generate_wiki_tool`
- `get_wiki_page_tool`

### 2.2 Registry / 工作流模板

以下能力不使用 `repo_root`，也不应被当成事实源工具：

- `list_repos_tool`
- `cross_repo_search_tool`
- `review_changes`
- `architecture_map`
- `debug_issue`
- `onboard_developer`
- `pre_merge_check`

### 2.3 调用前提

1. 跨仓库调用时，必须显式传入 `repo_root`
2. 首次建图不要求已存在 `.spec-first-graph/graph.db`
3. 若图未建，先执行 `build_or_update_graph_tool`
4. `list_graph_stats_tool` 用于判断当前仓库图是否已就绪

---

## 3. Core / Optional / Deferred

### 3.1 Core

1. `build_or_update_graph_tool`
2. `list_graph_stats_tool`
3. `get_minimal_context_tool`
4. `detect_changes_tool`
5. `get_review_context_tool`
6. `get_impact_radius_tool`
7. `query_graph_tool`
8. `list_flows_tool`
9. `get_flow_tool`
10. `list_communities_tool`
11. `get_architecture_overview_tool`

这些能力可以作为后续增强阶段的优先候选，但不构成 v1 主链路必需依赖。

### 3.2 Optional

1. `run_postprocess_tool`
2. `get_docs_section_tool`
3. `find_large_functions_tool`
4. `get_affected_flows_tool`
5. `semantic_search_nodes_tool`
6. `embed_graph_tool`
7. `refactor_tool`
8. `generate_wiki_tool`
9. `get_wiki_page_tool`

这些能力不进入 v1 主链路，可以在后续增强阶段按需补入。

### 3.3 Deferred

1. `list_repos_tool`
2. `cross_repo_search_tool`
3. `review_changes`
4. `architecture_map`
5. `debug_issue`
6. `onboard_developer`
7. `pre_merge_check`

这些能力属于工作流模板或跨仓库增强，不应进入 v1 主链路。

---

## 4. 能力对照表

| `spec-graph-bootstrap` 需求 | `code-review-graph` 能力 | 分层 | 适配方式 | 调用示例 |
|---|---|---|---|---|
| 首次建图 / 增量刷新 | `build_or_update_graph_tool` | Core | 作为事实层底座。首次全量，后续增量。 | `build_or_update_graph_tool(repo_root=TARGET)` |
| 图状态检查 | `list_graph_stats_tool` | Core | Phase 0 前置检查。 | `list_graph_stats_tool(repo_root=TARGET)` |
| 最小任务入口上下文 | `get_minimal_context_tool` | Core | 任务进入时优先调用。 | `get_minimal_context_tool(task="bootstrap", repo_root=TARGET)` |
| 变更影响面分析 | `get_impact_radius_tool` | Core | 生成受影响文件、路径和高风险节点。 | `get_impact_radius_tool(repo_root=TARGET)` |
| 结构化变更审查 | `detect_changes_tool` | Core | 映射 diff 到函数、flow、社区和测试缺口。 | `detect_changes_tool(repo_root=TARGET)` |
| 局部 review 上下文 | `get_review_context_tool` | Core | 直接供 review 节点消费。 | `get_review_context_tool(repo_root=TARGET)` |
| 调用关系查询 | `query_graph_tool` | Core | 生成依赖和调用链摘要。 | `query_graph_tool(pattern="callers_of", target="Foo", repo_root=TARGET)` |
| 测试映射 | `query_graph_tool` | Core | 生成测试映射和缺口。 | `query_graph_tool(pattern="tests_for", target="Foo", repo_root=TARGET)` |
| 导入关系查询 | `query_graph_tool` | Core | 补充模块耦合信息。 | `query_graph_tool(pattern="importers_of", target="utils", repo_root=TARGET)` |
| 入口链路查询 | `list_flows_tool` / `get_flow_tool` | Core | 识别关键执行流。 | `list_flows_tool(repo_root=TARGET)` |
| 受影响执行流 | `get_affected_flows_tool` | Optional | 入口改动时增强使用。 | `get_affected_flows_tool(repo_root=TARGET)` |
| 社区 / 模块聚类 | `list_communities_tool` / `get_community_tool` | Core | 生成模块分组和边界。 | `list_communities_tool(repo_root=TARGET)` |
| 架构总览 | `get_architecture_overview_tool` | Core | 生成架构摘要和耦合警告。 | `get_architecture_overview_tool(repo_root=TARGET)` |
| 图后处理补跑 | `run_postprocess_tool` | Optional | 首次 build 后按需补跑。 | `run_postprocess_tool(repo_root=TARGET)` |
| 工具使用指南 | `get_docs_section_tool` | Optional | 按需查询 CRG 工具说明。 | `get_docs_section_tool(section_name="review-delta")` |
| 大函数 / 大类识别 | `find_large_functions_tool` | Optional | refactor / cleanup 时使用。 | `find_large_functions_tool(repo_root=TARGET)` |
| 语义搜索 | `semantic_search_nodes_tool` | Optional | 作为补充检索，不做主事实源。 | `semantic_search_nodes_tool(query="auth middleware", repo_root=TARGET)` |
| 向量嵌入 | `embed_graph_tool` | Optional | 仅在需要语义搜索时启用。 | `embed_graph_tool(repo_root=TARGET)` |
| 自动化重构预览 | `refactor_tool` | Optional | 只做候选生成，不做主依赖。 | `refactor_tool(mode="dead_code", repo_root=TARGET)` |
| 重构应用 | `apply_refactor_tool` | Optional | 慎用，需受控流程。 | `apply_refactor_tool(repo_root=TARGET)` |
| wiki 生成 | `generate_wiki_tool` / `get_wiki_page_tool` | Optional | Stage-0 之外的增强能力。 | `generate_wiki_tool(repo_root=TARGET)` |
| 多仓库检索 | `list_repos_tool` / `cross_repo_search_tool` | Deferred | 1.0 不接。 | — |
| review 工作流模板 | `review_changes` | Deferred | 仅作为工作流模板，不作为事实源。 | — |
| 架构工作流模板 | `architecture_map` | Deferred | 同上。 | — |
| debug 工作流模板 | `debug_issue` | Deferred | 同上。 | — |
| onboarding 工作流模板 | `onboard_developer` | Deferred | 同上。 | — |
| pre-merge 检查模板 | `pre_merge_check` | Deferred | 同上。 | — |

---

## 5. 1.0 推荐接入集

如果只保留一组“后续优先接入”的增强能力，我建议是：

1. `build_or_update_graph_tool`
2. `list_graph_stats_tool`
3. `get_minimal_context_tool`
4. `detect_changes_tool`
5. `get_review_context_tool`
6. `get_impact_radius_tool`
7. `query_graph_tool`
8. `list_flows_tool`
9. `get_flow_tool`
10. `list_communities_tool`
11. `get_architecture_overview_tool`

这组已经足够支撑后续增强方向上的：

- 事实层抽取
- review 影响分析
- 基础架构摘要
- 注入路由所需的核心事实

---

## 6. `spec-graph-bootstrap` 仍然必须自己做的事

即使集成 CRG MCP，`spec-graph-bootstrap` 也不能只做透传。

它仍然要负责：

1. 统一产物格式
2. 生成 `docs/contexts/<slug>/` 资产
3. 维护 `fact-inventory.json`
4. 维护 `injection-index.yaml`
5. 维护增量刷新规则
6. 组织 task pack

职责边界应该是：

- **CRG 负责事实**
- **spec-graph-bootstrap 负责组织、格式化、路由和交付**

---

## 7. 不建议纳入 1.0 的能力

以下能力会扩范围，不应进入 v1 主链路：

- 多仓库能力
- wiki 生成
- embedding 语义搜索
- 自动 refactor 应用
- 工作流模板 prompts

原因：

1. 它们不直接提升 1.0 的三项目标
2. 它们会增加验证与维护成本
3. 它们会让实现路径从“事实层优先”滑向“能力堆叠”

---

## 8. 调用示例

### 8.1 正确的跨仓库调用

```python
TARGET = "/path/to/target-repo"

list_graph_stats_tool(repo_root=TARGET)
build_or_update_graph_tool(repo_root=TARGET)
detect_changes_tool(repo_root=TARGET)
query_graph_tool(pattern="callers_of", target="AuthService", repo_root=TARGET)
```

### 8.2 首次建图

```python
TARGET = "/path/to/target-repo"

stats = list_graph_stats_tool(repo_root=TARGET)
if stats["status"] != "ok" or stats.get("last_updated") is None:
    build_or_update_graph_tool(repo_root=TARGET, full_rebuild=True)
```

### 8.3 review 入口

```python
detect_changes_tool(repo_root=TARGET)
get_review_context_tool(repo_root=TARGET)
get_impact_radius_tool(repo_root=TARGET)
```

---

## 9. 结论

对于 `spec-graph-bootstrap` 的 1.0 阶段，`code-review-graph` 的 MCP 集成是足够的。

执行顺序建议：

1. 先接 Core
2. 再按需要补 Optional
3. Deferred 保持不接

这会让 1.0 保持清晰、可落地、可验证。
