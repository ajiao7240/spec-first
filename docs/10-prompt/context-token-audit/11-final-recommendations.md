# Final Recommendations

## 1. 总体结论

`spec-first` 的问题不是“prompt 太长”这么简单，而是缺少系统化 Context Governance。目标不是让 skill 变短，而是让每个 workflow 节点只加载自己当前阶段真正需要的最小充分上下文。

当前成熟度：**C2+ / 局部 C3**。建议下一阶段目标：**C4 Context Router**，中期目标：**C5 Evidence-aware Context**，长期目标：**C6 Token-optimized Harness**。

## 2. 当前 token 消耗的根因

1. 高频 `SKILL.md` 过大。
2. review/doc/app audit 多专家 fanout 会乘法放大上下文。
3. `.spec-first` runtime artifacts 体积和重复快照过大。
4. 下游 artifact handoff 仍偏全文/长报告。
5. broad researcher agents 没有统一 context budget。
6. tool results/raw logs 默认没有全局 clearing policy。
7. 历史 docs/plans/changelog 很大，缺少 summary/index consumption。

## 2.1 业界最佳实践校准

业界主流做法已经从“把上下文窗口塞满”转向“把上下文当缓存、索引和预算共同治理的运行时资源”。对 `spec-first` 最有参考价值的不是某个 provider 的具体 API，而是这些共同原则：

| practice | industry signal | `spec-first` implication |
| --- | --- | --- |
| 稳定 prompt prefix | OpenAI / Anthropic / Gemini 等 provider 的 prompt caching / context caching 实践都鼓励把稳定、可复用的大段指令或资料放在前部，并把动态请求、工具输出、临时证据放在后部，以提高 cache 命中率 | 高频 workflow 的 host/system/skill core 应稳定排序、稳定措辞、稳定边界；用户请求、diff、tool summary、review evidence 放入 dynamic suffix |
| 明确 cache boundary | 长上下文缓存通常要求可复用块足够大、边界清楚，且避免把高变动内容混入可缓存块 | `SKILL.md` core、role contract、workflow policy 应成为 stable instruction cache layer；raw logs、git status、test output 不应污染该层 |
| repo map / context map | Aider 等 coding agent 的有效实践不是把全仓源码塞进 prompt，而是维护 repo map，再按当前 task 注入相关 symbols、files、paths 和摘要 | Context Router 应优先产出 `context-bundle.v1`，包含 task-relevant map、artifact summary、evidence pointers，而不是 full repo / full artifact |
| summary-first handoff | Agentic workflow 越长，越需要把中间产物压成 path-backed summary，保留 raw artifact 按需展开 | 所有 durable artifacts 默认生成 `artifact-summary.v1`；下游先读 summary，再基于 path 精确读取 full content |
| selective fanout | 多专家并行适合高风险审查，但如果每个 reviewer 都拿同一份全文，会线性乘以 reviewer 数量 | reviewer dispatch 应以 scope/risk/context budget 决定 persona 数和 section bundle，而不是默认 full-context broadcast |
| tool result clearing | 工具输出、网页抓取、MCP diagnostics、测试日志常是最大 token 噪声源，应保留事实摘要和 raw path，及时从 conversational context 清出 | graph/bootstrap/review/browser/test 输出统一为 compact summary + raw path，禁止 raw log 在多轮 agent handoff 中复制 |
| telemetry-driven budget | 成熟系统会把 token usage、cache hit、context miss、review recall 等指标纳入治理，而不是靠人工感觉压缩 | 新增预算规则时必须可观测：记录 estimated_tokens、bundle size、fanout multiplier、summary/full 读取次数和 cache-hostile inputs |

因此，本轮建议不应被理解为“把文档写短”，而是把 `spec-first` 改造成 **cache-friendly, retrieval-shaped, evidence-preserving** 的 workflow harness。

## 2.2 建议的上下文分层模型

`spec-first` 的 token 管理应拆成六层，每层有不同 ownership、缓存策略和降级方式：

| layer | owner | default loading policy | must avoid |
| --- | --- | --- | --- |
| Stable instruction cache layer | checked-in role contract、host entry、high-frequency skill core | 稳定前置、短小、低变动；仅承载 workflow invariant 和 hard boundary | 混入 git 状态、用户请求、临时诊断、一次性实现细节 |
| Context bundle layer | Context Router / workflow preflight | 按 task 生成 `context-request.v1` 和 `context-bundle.v1`，只注入必要 files、symbols、artifact summaries、evidence paths | full repo、full docs、full generated runtime mirror |
| Artifact summary layer | artifact producer workflow | 每个 durable artifact 同步生成 `artifact-summary.v1`，下游默认读 summary | 要求下游先读长报告全文才能继续 |
| Tool result clearing layer | tool adapters / workflow glue | 工具输出只保留结论、关键字段、raw path、exit code、reason_code | 把 raw logs、网页全文、MCP dumps 反复转发给 reviewer/worker |
| Selective fanout layer | review/doc/app audit dispatch | 根据 risk、scope、budget 选择 reviewer 数、persona、section bundle 和 finding cap | 固定全量多专家广播 |
| Telemetry and budget layer | CLI/scripts + LLM judgment | 记录预算、超限原因、降级策略和 cache-hostile 内容；脚本给事实，LLM 决定取舍 | 让脚本硬编码语义优先级，或让 LLM 假装有确定性 token 计量 |

这个分层符合项目角色契约：scripts 准备确定性 facts，LLM 做语义取舍；contract 轻量且显式边界清楚；source/runtime/generated artifacts 不混为一谈。

## 3. Top 10 Token Hotspots

1. `.spec-first/audits/skill-audit/*/skill-source-inventory.json`
2. `skills/spec-code-review/SKILL.md`
3. code-review reviewer fanout
4. `skills/spec-plan/SKILL.md`
5. `skills/spec-work/SKILL.md`
6. `skills/spec-doc-review/SKILL.md` full-document fanout
7. `skills/spec-compound/SKILL.md` full mode
8. `.claude/` / `.agents/skills/` runtime mirror duplication
9. `CHANGELOG.md`
10. graph/provider raw diagnostics

## 4. Top 10 Quick Wins

1. 默认排除 `.spec-first/audits/**`。
2. 默认排除 generated runtime mirrors，除非 runtime workflow 显式需要。
3. 调整高频 prompt layout：stable instruction prefix 固定，dynamic request/tool/evidence suffix 后置。
4. 压缩 `spec-code-review` core，并把长参考材料移动到按需 references。
5. 压缩 `spec-work` / `spec-plan` 高频 core。
6. doc-review 改 section bundle，不再 full document per reviewer。
7. code-review/doc-review 增加 reviewer budget、finding cap 和 section budget。
8. `spec-skill-audit` summary-only default。
9. `CHANGELOG.md` latest-window + index consumption。
10. graph/tool output compact summary + raw path，raw log 不进入 agent handoff。

## 5. Top 10 Structural Fixes

1. Context Router MVP，先做 task-scoped context bundle，不做中心化强状态机。
2. `context-request.v1` / `context-bundle.v1`，字段只覆盖 scope、budget、artifacts、evidence pointers、degraded reason。
3. Shared `artifact-summary.v1`，让 plan/review/work/compound 都能 summary-first handoff。
4. Repo map / context map 机制：按 task 注入 related paths/symbols/artifacts，而不是 full repo。
5. Shared `review-finding.v1`，review synthesis from structured findings only。
6. Compound/session/changelog index，支持 latest-window 与按主题检索。
7. Context budget policy + lint，覆盖 skill、agent、artifact、review、tool result、session 六类预算。
8. Runtime artifact retention and exclusion policy。
9. Tool result clearing policy。
10. Agent profile standard output schema，支持 bounded fanout 和 summary-only consumption。

## 6. 哪些 skill 最耗 token

| rank | skill | estimated_tokens |
| ---: | --- | ---: |
| 1 | `spec-code-review` | 24056 |
| 2 | `spec-plan` | 14576 |
| 3 | `spec-compound-refresh` | 11201 |
| 4 | `spec-work-beta` | 11092 |
| 5 | `spec-work` | 10479 |

## 7. 哪些 agent 最耗 token

| rank | agent | estimated_tokens |
| ---: | --- | ---: |
| 1 | `spec-cli-agent-readiness-reviewer` | 5332 |
| 2 | `spec-learnings-researcher` | 3679 |
| 3 | `spec-issue-intelligence-analyst` | 3614 |
| 4 | `spec-repo-research-analyst` | 3276 |
| 5 | `spec-slack-researcher` | 2881 |

## 8. 哪些 workflow 最容易上下文膨胀

1. `spec-code-review`
2. `spec-doc-review`
3. `spec-compound`
4. `spec-skill-audit`
5. `spec-plan`
6. `spec-work`
7. `spec-app-consistency-audit`
8. `spec-sessions`
9. `spec-graph-bootstrap`
10. `spec-optimize`

## 9. 是否需要压缩

需要。压缩重点是 instruction 分层、artifact summary、tool result clearing、selective dispatch 和 runtime exclusion，不是删除 evidence、安全、degraded-mode 或 review rigor。

## 10. 应该压缩什么

- 高频 `SKILL.md` core。
- reviewer 输入和输出。
- full document / full artifact handoff。
- runtime artifacts / generated mirrors 的默认扫描。
- raw tool outputs。
- session/history/changelog consumption。

## 11. 不应该压缩什么

- evidence requirements。
- source/runtime 边界。
- safety rules。
- reason_code / degraded-mode。
- confidence anchors。
- deterministic validation facts。
- CHANGELOG 规则。

## 12. 是否需要 Context Router

需要。没有 Context Router，context budget 只能靠各 workflow 自律，难以持续治理。

但 Context Router 的第一版不应该做成复杂流程引擎。它只需要回答四个问题：

1. 当前 task 属于哪个 workflow stage。
2. 当前 stage 必须读取哪些 source-of-truth。
3. 哪些 artifacts 只读 summary，哪些需要 full content。
4. 超出预算时如何降级、记录 reason_code，并把 raw path 留给人工或后续 agent 按需展开。

这与业界 repo map / retrieval-first coding agent 的方向一致：router 不是替代 LLM 判断，而是为 LLM 提供更干净、更可验证、更缓存友好的输入包。

## 13. 是否需要 Progressive Disclosure

需要。当前已有 references，但很多 core `SKILL.md` 仍过大，说明 progressive disclosure 还没有成为默认治理标准。

下一步应把 progressive disclosure 从“文档组织技巧”提升为 token contract：

- core 只放 invariant、entry routing、hard boundary、minimal workflow loop。
- references 放 persona matrix、edge cases、examples、long rationale。
- scripts 输出 machine-readable facts 和 artifact paths。
- LLM 在需要深审或遇到冲突时才展开 references/full artifact。

## 14. 是否需要 Selective Reviewer Dispatch

需要。`spec-code-review` 已有 scale-aware preflight 的基础，应进一步预算化；`spec-doc-review` 和 app-audit 也需要 selected personas/experts 预算。

建议把 reviewer dispatch 改成 risk-based selection：

- 小改动：single reviewer 或 parent-agent review，禁止默认多专家 fanout。
- 中风险：2-3 个 persona，每个只拿相关 section bundle。
- 高风险：多 persona fanout，但必须有 budget、finding cap、evidence path、dedup/synthesis schema。

这样保留 review rigor，同时避免“同一份全文 × reviewer 数量”的 token 放大。

## 15. 是否需要 Tool Result Clearing

需要。graph/bootstrap/review-pre-facts/test/browser/MCP 输出都应 summary-first，raw path-only。

clearing 的关键不是丢证据，而是把证据从 conversational context 移到可追溯 artifact：

- 当前轮回答只保留 conclusion、exit code、reason_code、关键字段、artifact path。
- raw logs、full diagnostics、large JSON、网页全文不跨 agent 复制。
- reviewer 如果需要 full evidence，按 path 精确读取，而不是接收 upstream 粘贴的全文。
- failed/degraded 状态必须保留，不得被 summary 抹平。

## 16. 是否需要 Artifact Summary

需要。所有 durable artifacts 都应有 summary；下游默认读 summary，full artifact 按需读取。

`artifact-summary.v1` 建议保持轻量，先覆盖：

- artifact type、source path、producer、timestamp。
- goal / scope / non-goals。
- key conclusions。
- changed facts / unresolved risks。
- evidence paths。
- recommended next action。
- full artifact 何时必须读取。

它不应变成第二份长报告；summary 的价值在于稳定、短、可索引、可缓存。

## 17. 是否需要 Token Budget Policy

需要。本轮已提出 skill、agent、artifact、review、tool result、session 六类预算。

预算策略应同时管理两类目标：

1. **输入预算**：skill core、agent profile、context bundle、tool summary、artifact summary 的最大 token / line / byte 门槛。
2. **放大预算**：reviewer count、subagent fanout、tool result carry-over、session history window、full artifact reads。

预算超限时不应 silent truncate。正确行为是：生成 compact bundle、列出 excluded paths、标注 degraded reason，并让 LLM 判断是否需要扩大范围。

## 18. 预期 token 降低比例

| scenario | expected saving |
| --- | ---: |
| quick wins | 30%-40% |
| medium structural fixes | 45%-55% |
| Context Router + budget governance | 60%-70% |

## 19. 对质量的风险

最大风险是过度压缩导致 reviewer 漏掉真实 evidence 或 workflow 丢失 safety boundary。缓解方式是 summary-first、path-backed、on-demand full context，而不是直接删除事实或规则。

## 20. 下一轮实施顺序

1. 写 `docs/contracts/context-governance.md`，固化 stable prefix / dynamic suffix、runtime exclusion、summary-first、budget failure modes。
2. 定义 `artifact-summary.v1`，先让 durable artifacts 有统一短摘要。
3. 定义 `context-request.v1` / `context-bundle.v1`，先覆盖 workflow stage、scope、budget、summary paths、full-read triggers。
4. 建立 repo map / context map MVP：输出 related paths/symbols/artifacts，不做 provider-specific 强依赖。
5. 拆 `spec-code-review` core 到 references，保留行为测试和 review-finding schema。
6. 拆 `spec-work` / `spec-plan` 高频 core，固定 cache-friendly prompt layout。
7. 为 code/doc review 增加 reviewer budget、finding cap、section bundle 和 fanout telemetry。
8. 修改 `spec-skill-audit` summary-only default 和 retention policy。
9. 把 compound/session/changelog 改为 index/window consumption。
10. 增加 token/context telemetry：bundle size、fanout multiplier、summary/full read count、cache-hostile inputs。

## 第一批建议修改文件

1. `skills/spec-code-review/SKILL.md`
2. `skills/spec-work/SKILL.md`
3. `skills/spec-plan/SKILL.md`
4. `skills/spec-doc-review/SKILL.md`
5. `skills/spec-skill-audit/SKILL.md`
6. `skills/spec-skill-audit/scripts/write-audit-artifacts.js`
7. `skills/using-spec-first/SKILL.md`
8. `docs/contracts/context-governance.md`
9. `docs/contracts/workflows/review-finding.md`
10. `CHANGELOG.md`

## 最小实施方案

最小可维护方案不是先做完整 Context Router，而是先落地五件事：

1. **Runtime exclusion policy**：默认不把 `.spec-first/audits/**`、generated mirrors 当普通上下文。
2. **Cache-friendly prompt layout**：高频 workflow 固定 stable instruction prefix，把用户请求、diff、tool summary、临时 evidence 放入 dynamic suffix。
3. **High-frequency core split**：先拆 `spec-code-review`、`spec-work`、`spec-plan`。
4. **Summary-first handoff**：review/work/compound 下游默认只读 summary + path。
5. **Context bundle MVP**：用轻量 `context-bundle.v1` 承载 related paths、artifact summaries、evidence paths 和 full-read triggers。

这五项足以先拿到 30%-40% 的节省，并为 Context Router、repo map、selective fanout 和预算遥测打基础。后续再推进复杂缓存 API 或 provider-specific 优化，避免把第一阶段做成不可维护的中心化规则系统。
