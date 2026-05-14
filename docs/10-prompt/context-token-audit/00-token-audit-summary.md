# Token / Context 成本专项审查总览

## 审查结论

`spec-first` 当前的问题不是单个 prompt 太长，而是缺少统一的 Context Governance：不同 workflow 各自读取 source、runtime、artifact、reviewer 输出和历史资料，虽然很多节点已经有 evidence / degraded-mode 意识，但仍缺少跨 workflow 的 context budget、context bundle、artifact summary 消费规则和 selective dispatch 预算。

当前成熟度判断为 **C2+ / 局部 C3**：

- C2 已成立：`spec-code-review`、`spec-doc-review`、`spec-app-consistency-audit`、`review-pre-facts` 等已经出现 summary、schema、evidence 和 artifact 分层。
- C3 只局部成立：很多 skill 有 `references/`，但核心 `SKILL.md` 仍很大，高频 workflow 默认加载成本偏高。
- C4 尚未成立：没有统一 `context-request` / `context-bundle` router。
- C5/C6 尚未成立：evidence-aware context、token budget、tool result clearing、session compaction 还不是全局机制。

建议目标：先达到 **C4 Context Router**，再推进 **C5 Evidence-aware Context**；C6 作为长期治理目标。

## 审查范围

本轮按 `docs/10-prompt/审查token.md` 执行，覆盖：

| 范围 | 确定性证据 |
| --- | ---: |
| `skills/**/SKILL.md` | 40 个 |
| `agents/**/*.md` / `agents/**/*.yaml` | 51 个 Markdown agent，未发现 agent YAML |
| `skills/**/references/*` | 112 个文件 |
| `skills/**/evals/*` | 17 个文件 |
| `skills/**/scripts/*` | 121 个文件 |
| `skills/**/README.md` | 4 个 |
| `skills/**/contract.yaml` | 0 个 |
| `docs/solutions/**/*.md` | 12 个 |
| source text files under `skills/ agents/ templates/ docs/ src/cli/ root docs` | 约 954 个 |
| generated/runtime text files under `.claude/ .codex/ .agents/skills/ .spec-first/` | 约 1825 个 |

确定性扫描使用 repo-local Node 脚本读取目标范围文本并估算 token；语义判断由本报告完成。估算方法偏保守：CJK 字符按 1 token 近似，英文词按 1.25 token，其他字符折算。

## Source / Runtime 边界

Source-of-truth 是 `skills/`、`agents/`、`templates/`、`src/cli/`、`docs/`、根 `README*`、`CHANGELOG.md`、`AGENTS.md`、`CLAUDE.md` 等。

Runtime/generated assets 是 `.claude/`、`.codex/`、`.agents/skills/`、`.spec-first/`。本轮只审查其上下文膨胀风险，不把 runtime mirror 当 source 修改。

P0 判断：`.spec-first/audits/skill-audit/` 存在大量旧审计 JSON 快照，单个 `skill-source-inventory.json` 约 60 万估算 token，且同类快照重复多份。只要下游 workflow 或 agent 把 `.spec-first` 当普通上下文目录扫描，就会立刻发生上下文污染。

## 关键事实

| 指标 | 结果 |
| --- | ---: |
| 最大 source `SKILL.md` | `skills/spec-code-review/SKILL.md`，约 24,056 tokens |
| Top 5 source skill | `spec-code-review`、`spec-plan`、`spec-compound-refresh`、`spec-work-beta`、`spec-work` |
| 最大 agent | `agents/spec-cli-agent-readiness-reviewer.agent.md`，约 5,332 tokens |
| Top 5 agent | `spec-cli-agent-readiness-reviewer`、`spec-learnings-researcher`、`spec-issue-intelligence-analyst`、`spec-repo-research-analyst`、`spec-slack-researcher` |
| 最大 runtime 成本 | `.spec-first/audits/skill-audit/*/skill-source-inventory.json` |
| `.spec-first` 磁盘体积 | 约 93MB |
| `docs` 磁盘体积 | 约 54MB |
| `skills` 磁盘体积 | 约 4.0MB |
| `agents` 磁盘体积 | 约 400KB |

## 根因

1. 高频 `SKILL.md` 已经承载 contract、workflow、examples、failure modes、dispatch policy、artifact shape 和 host boundary，多数没有压缩到 core instructions。
2. `spec-code-review` / `spec-doc-review` / `spec-compound` 等默认多 agent 或多阶段 synthesis，虽然质量高，但 reviewer 输入和输出需要预算。
3. `.spec-first` 保存大量运行产物和旧审计快照，缺少“禁止作为 LLM 默认上下文扫描源”的显式消费规则。
4. 下游 handoff 仍常以 Markdown 正文或报告全文为主要输入，没有统一 summary-first artifact contract。
5. 当前已有 review-pre-facts、app-audit summary、findings schema 等局部机制，但没有统一 Context Router 把这些能力变成默认路径。

## 预期节省

| 目标 | 需要动作 | 预期 token 降低 |
| --- | --- | ---: |
| quick wins | 排除 runtime 全量扫描、压缩 top 8 高频 `SKILL.md`、summary-first artifact handoff、review 输出 cap | 30%-40% |
| medium-term | selective reviewer dispatch、统一 finding envelope、compound/session index、script compact JSON 默认 | 45%-55% |
| architecture-level | Context Router + context bundle + budget CI + session/tool result clearing | 60%-70% |

## 本轮产物

本目录包含 12 个审查产物：

1. `00-token-audit-summary.md`
2. `01-skill-token-inventory.md`
3. `02-agent-token-inventory.md`
4. `03-context-loading-map.md`
5. `04-token-hotspot-report.md`
6. `05-context-bloat-risk-report.md`
7. `06-compression-strategy.md`
8. `07-progressive-disclosure-plan.md`
9. `08-context-router-design.md`
10. `09-skill-agent-rewrite-plan.md`
11. `10-token-budget-policy.md`
12. `11-final-recommendations.md`

## 验证状态

- 已读取角色契约：`docs/10-prompt/结构化项目角色契约.md`。
- 已读取审查 prompt：`docs/10-prompt/审查token.md`。
- 已执行 source/runtime 文件盘点、skill/agent token 估算、runtime 体积检查、现有 skill-agent 审查产物读取。
- 未运行 runtime regeneration；本轮是审查与建议，不修改 generated runtime assets。
