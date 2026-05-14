# Progressive Disclosure Plan

## 方案结论

`spec-first` 应把每个 high-frequency skill 改成“核心指令 + machine-readable contract + 按需 reference + compact artifact”的结构。核心不是让文件短，而是让普通执行只加载当前阶段必需上下文。

SKILL.md 首屏目标是让 agent 快速判断入口、输入、输出、失败模式和 refs 触发条件，而不是承载完整方法论。

推荐结构：

```text
skill/
  SKILL.md
  contract.yaml
  references/
    checklist.md
    examples.md
    edge-cases.md
    workflow-modes.md
  scripts/
    collect-context.js
    summarize-artifact.js
```

## 必答问题

| question | answer |
| --- | --- |
| skill metadata 应该包含什么 | `name`、`description`、`argument-hint`、public/internal boundary、mode tokens、required inputs、outputs、artifacts、degraded modes、reference index。 |
| `SKILL.md` 首屏应该多短 | 高频 public workflow 目标 `< 3,000-4,000` tokens；internal helper `< 1,500` tokens；超过阈值必须说明原因。 |
| 哪些内容应拆到 references | examples、walkthrough、bulk preview、long checklists、repair recipes、provider-specific notes、host-specific variants、edge cases。 |
| 哪些 examples 应按需加载 | fresh-source eval examples、mode-specific examples、failure examples、long command transcripts。 |
| 哪些 checklists 应按需加载 | shipping checklist、review synthesis pipeline、branch/commit policy、provider repair checklist、browser/runtime validation checklist。 |
| agent profile 是否也要 progressive disclosure | 要。agent core 保留 role/trigger/inputs/output/confidence/forbidden behaviors；长方法论拆 lens refs。 |
| code-review reviewer 是否按需加载 | 要。先跑 scale-aware preflight，再只加载 selected reviewer files 和 shared schema id。 |
| app-audit experts 是否按需加载 | 要。planner 先从 preflight/impact/context 选择 experts；未选 expert 只记录 skipped reason。 |
| compound history 是否按需加载 | 要。默认读 compound index 和 matching summaries；full solution doc 只在高相似度时读。 |
| standards 是否按需加载 | 要。默认读 confirmed standards summary；conflict/unknown details 按需。 |
| graph facts 是否按需加载 | 要。默认 readiness summary；impact/query facts 必须与 intent 和 budget 绑定。 |

## Core Skill 改造建议

| skill | current issue | progressive disclosure change | target |
| --- | --- | --- | --- |
| spec-brainstorm | 容易扩大到项目背景全读 | core 只保留 framing loop；research/context refs 按需 | 不读全仓，生成 problem-frame bundle |
| spec-plan | 计划流程和研究规则过长 | planning core + research refs + artifact contract refs | `SKILL.md` <4k tokens |
| spec-write-tasks | task-pack contract 细节多 | `contract.yaml` + schema refs；core 只保留生成/验证/handoff | task-pack 引用 plan ids |
| spec-work | branch/task-pack/subagent/shipping 全在正文 | branch refs、task-pack validator refs、shipping refs 延迟读取 | ordinary work only loads current-task rules |
| spec-code-review | 最大 SKILL，reviewer/synthesis/fixer/artifact 全内联 | persona catalog、synthesis、walkthrough、findings schema 分 refs；core 只调度 | core <5k，selected refs only |
| spec-app-consistency-audit | 多源、多 expert、多 script | planner 先选 experts；expert prompts/rule packs selected only | compact app-audit-context |
| spec-compound | full mode 多 subagent + session | lightweight default；session/related docs opt-in；solution index | no raw session/history in orchestrator |
| spec-skill-audit | small core 但产物巨大 | summary-only default；full JSON explicit; retention refs | latest summary first |
| spec-graph-bootstrap | provider rules多 | core readiness ladder；provider repair recipes refs | raw logs path-only |
| spec-mcp-setup | setup/repair/provider/host 混合 | setup core + provider repair refs + host refs | no full recipe load by default |

## Agent 改造建议

| agent class | change |
| --- | --- |
| broad researchers | 必须声明 `max_sources`、`max_evidence_refs`、`output_schema`，禁止自行全仓读。 |
| reviewer agents | 必须输出 JSON findings 或 bounded lens notes，不输出长报告。 |
| mutating agents | 退役或迁移到 workflow-owned phase；agent 不拥有 source writes。 |
| stack-specific reviewers | 仅在 semantic trigger 命中时加载，不能按扩展名机械 fanout。 |
| synthesis/report agents | 输入 structured findings，输出 compact synthesis + artifact refs。 |

## Acceptance Criteria

1. 高频 public workflow `SKILL.md` 默认加载 token 下降 40% 以上。
2. 每个 moved reference 都有明确 load condition。
3. 无 workflow 需要为了普通执行加载 entire references directory。
4. Reviewer dispatch 前可以列出 selected/unselected personas 和 reason。
5. 下游 handoff 默认使用 summary + path，而不是全文复制。
