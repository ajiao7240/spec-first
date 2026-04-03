# spec-bootstrap 文档索引

> 本目录汇总 `spec-bootstrap` 主题的历史分析、v1 全览和 v2 设计文档。
> 建议优先从 v2 正式方案读起，再按需要进入产物、worker、历史分析等专题文档。

---

## 目录结构

```text
spec-bootstrap/
├── README.md
├── spec-bootstrap-v2-需求与实施方案.md
├── spec-bootstrap-v2-验收标准清单.md
├── spec-bootstrap-v2-总体方案.md
├── spec-bootstrap-v2-演进决策稿.md
├── 胶水编程对spec-bootstrap-v2的设计启发.md
├── spec-bootstrap-v2-产物清单明细表.md
├── spec-bootstrap-v2-worker-任务拆分与PRD模板升级稿.md
├── spec-bootstrap-产物文档全览.md
├── cc-codex-spec-bootstrap-skill-分析.md
├── cc-codex-spec-bootstrap-skill-实现梳理.md
└── spec-bootstrap-skill-execution-analysis.md
```

---

## 快速入口

| 目的 | 建议阅读 |
|------|----------|
| 直接了解 v2 正式方案 | `spec-bootstrap-v2-需求与实施方案.md` |
| 直接看 v2 是否收敛到可实现状态 | `spec-bootstrap-v2-验收标准清单.md` |
| 看外部“胶水编程”实践如何强化 v2 方向 | `胶水编程对spec-bootstrap-v2的设计启发.md` |
| 先看高层结论 | `spec-bootstrap-v2-总体方案.md` |
| 看为什么要从 v1 升级到 v2 | `spec-bootstrap-v2-演进决策稿.md` |
| 看 v2 具体产物有哪些 | `spec-bootstrap-v2-产物清单明细表.md` |
| 看 worker 与 PRD 怎么改 | `spec-bootstrap-v2-worker-任务拆分与PRD模板升级稿.md` |
| 对照 v1 历史模型 | `spec-bootstrap-产物文档全览.md` |
| 看早期 skill 分析材料 | `cc-codex-spec-bootstrap-skill-分析.md`、`cc-codex-spec-bootstrap-skill-实现梳理.md` |

---

## 建议阅读顺序

1. `spec-bootstrap-v2-需求与实施方案.md`
2. `spec-bootstrap-v2-验收标准清单.md`
3. `胶水编程对spec-bootstrap-v2的设计启发.md`
4. `spec-bootstrap-v2-总体方案.md`
5. `spec-bootstrap-v2-演进决策稿.md`
6. `spec-bootstrap-v2-产物清单明细表.md`
7. `spec-bootstrap-v2-worker-任务拆分与PRD模板升级稿.md`
8. `spec-bootstrap-产物文档全览.md`
9. `cc-codex-spec-bootstrap-skill-分析.md`
10. `cc-codex-spec-bootstrap-skill-实现梳理.md`

---

## 文档定位

| 文件 | 定位 |
|------|------|
| `spec-bootstrap-v2-需求与实施方案.md` | v2 正式需求与实施方案主文档 |
| `spec-bootstrap-v2-验收标准清单.md` | v2 设计与实现验收检查清单 |
| `胶水编程对spec-bootstrap-v2的设计启发.md` | 外部实践对 v2 设计的专题补充 |
| `spec-bootstrap-v2-总体方案.md` | v2 主方案入口 |
| `spec-bootstrap-v2-演进决策稿.md` | 解释为什么升级、升级边界和优先级 |
| `spec-bootstrap-v2-产物清单明细表.md` | 定义 v2 产物模型与目录结构 |
| `spec-bootstrap-v2-worker-任务拆分与PRD模板升级稿.md` | 定义 v2 worker 拆分与 PRD 合同升级 |
| `spec-bootstrap-产物文档全览.md` | v1 历史版全览 |
| `cc-codex-spec-bootstrap-skill-分析.md` | 早期 skill 分析资料 |
| `cc-codex-spec-bootstrap-skill-实现梳理.md` | 早期实现拆解资料 |
| `spec-bootstrap-skill-execution-analysis.md` | 当前 skill 执行逻辑分析与流程图 |

---

## 按主题分组

### v2 主线文档

- `spec-bootstrap-v2-需求与实施方案.md`
- `spec-bootstrap-v2-验收标准清单.md`
- `胶水编程对spec-bootstrap-v2的设计启发.md`
- `spec-bootstrap-v2-总体方案.md`
- `spec-bootstrap-v2-演进决策稿.md`

### v2 细化专题

- `spec-bootstrap-v2-产物清单明细表.md`
- `spec-bootstrap-v2-worker-任务拆分与PRD模板升级稿.md`

### 历史对照

- `spec-bootstrap-产物文档全览.md`

### 早期分析材料

- `cc-codex-spec-bootstrap-skill-分析.md`
- `cc-codex-spec-bootstrap-skill-实现梳理.md`
- `spec-bootstrap-skill-execution-analysis.md`

---

## 当前建议

如果目标是继续推进 `spec-bootstrap` 下一版设计，应以 v2 系列文档为主，v1 与早期分析文档作为对照材料使用。

建议的实际使用方式：

1. 先读 `spec-bootstrap-v2-需求与实施方案.md`，确认目标、范围和实施顺序
2. 再读 `spec-bootstrap-v2-验收标准清单.md`，确认设计是否已收敛到可实现状态
3. 再读 `胶水编程对spec-bootstrap-v2的设计启发.md`，理解外部实践对 v2 的强化点
4. 再读 `spec-bootstrap-v2-产物清单明细表.md`，确认“到底产什么”
5. 然后读 `spec-bootstrap-v2-worker-任务拆分与PRD模板升级稿.md`，确认“怎么稳定地产”
6. 若需要解释设计取舍，再补读 `spec-bootstrap-v2-演进决策稿.md`
7. 若需要和旧方案对照，再看 `spec-bootstrap-产物文档全览.md`
