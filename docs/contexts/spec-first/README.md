# spec-first · Context Pack

Generated: 2026-04-23 | Mode: full | Graph: local-available

- project: spec-first
- primary_language: JavaScript
- repo_shape: single_repo
- topology: single_repo
- source_of_truth: control-plane artifacts under .spec-first/workflows/bootstrap/spec-first/

## 产物索引

| 文件 | 内容 |
|------|------|
| `00-summary.md` | 项目概览、核心模块、关键入口、依赖特征 |
| `architecture/module-map.md` | 模块层次、目录结构、模块间依赖、JSON Schema 契约层 |
| `pitfalls/index.md` | 高风险文件、hub 节点风险、集成风险、架构决策陷阱 |
| `code-facts/public-entrypoints.md` | CLI 入口、CRG 子命令入口、bootstrap 内部入口、hub 节点 |
| `code-facts/test-map.md` | 测试层次、文件→模块映射、覆盖缺口 |
| `code-facts/high-risk-modules.md` | high/medium 风险信号、修改检查清单 |
| `context-packs/review-change.md` | PR 审查前置包：高风险入口 + hub + 覆盖缺口 + 集成 |
| `injection-index.yaml` | Stage-0 路由索引 |

## 控制面真源

机器可读产物位于：`.spec-first/workflows/bootstrap/spec-first/`

- `fact-inventory.json` — 所有事实的来源
- `risk-signals.json` — 风险信号
- `test-surface.json` — 测试面 + 覆盖缺口
- `database-routing.json` — 数据库 LLM handoff
- `artifact-manifest.json` — 产物状态清单
