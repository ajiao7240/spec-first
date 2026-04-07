# spec-docs 知识库方案文档索引

本目录包含 spec-first 独立知识库从需求分析到技术设计的全部文档。

## 推荐阅读顺序

1. **v2 方案** — 理解全局设计目标和存储基础设施
2. **内容规范** — 理解知识库存什么、怎么组织、怎么加载
3. **技术方案** — 理解 CLI Phase 1 实施细节
4. **实施分期** — 按阶段落地

## 文档清单

| # | 文档 | 性质 | 状态 | 核心内容 |
|---|---|---|---|---|
| 1 | [spec-first-独立文档仓库方案-v2.md](./spec-first-独立文档仓库方案-v2.md) | 需求设计稿 | 稳定 | 存储基础设施（git/slug/workspace）、CLI 命令设计、skill 读写契约 |
| 2 | [2026-04-07-spec-docs-knowledge-content-spec.md](./2026-04-07-spec-docs-knowledge-content-spec.md) | 内容定义规范 | v2.0 | 知识库目录结构、L0/L1/L2 加载策略、frontmatter schema、写入/巡检规则 |
| 3 | [2026-04-07-spec-docs-independent-knowledge-repo-technical-spec.md](./2026-04-07-spec-docs-independent-knowledge-repo-technical-spec.md) | 可执行技术方案 | v1.0 | CLI Phase 1 实施 Task 1-6，替代 04-06 两份混血文档 |
| 4 | [2026-04-07-knowledge-repo-workflow-diagram.md](./2026-04-07-knowledge-repo-workflow-diagram.md) | ASCII 流程图 | 辅助 | 知识库管理全流程可视化 |
| 5 | [spec-first-harness-engineering-实施分期/](./spec-first-harness-engineering-实施分期/README.md) | 实施分期方案 | 进行中 | 3 阶段落地：基础闭环 → 反馈回流 → 系统自进化 |

## 已归档

| 文档 | 说明 |
|---|---|
| [2026-04-06-agent-first-spec-docs-knowledge-architecture.md](./2026-04-06-agent-first-spec-docs-knowledge-architecture.md) | 早期架构探索，已被 v2 方案和内容规范替代 |
| [2026-04-06-agent-first-spec-docs-knowledge-plan.md](./2026-04-06-agent-first-spec-docs-knowledge-plan.md) | 早期实施计划，已被技术方案替代 |

## 文档间关系

```
独立文档仓库方案 v2（全局 source of truth）
    │
    ├── 内容规范 v2.0（知识库存什么、怎么组织）
    │       ↑ 替代技术方案中的"一、产出内容"节
    │
    ├── 技术方案 v1.0（CLI Phase 1 实施）
    │       └── 被内容规范替代"产出内容"节，其余 Task 2-6 不变
    │
    └── Harness 实施分期（3 阶段落地）
            ├── 阶段 1：基础闭环（bootstrap → plan → work）
            ├── 阶段 2：反馈回流（review / compound / history）
            └── 阶段 3：系统自进化（spec-improve）
```
