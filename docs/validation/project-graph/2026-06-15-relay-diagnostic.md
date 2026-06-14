# project-graph relay diagnostic

日期: 2026-06-15
范围: `docs/06-待办事项/2026-06-15-001-optimize-project-graph-usage-quality-plan.md` 的 P1 一次性诊断
结论: Graphify `query` 对本仓 docs/plan/contract 定位仍容易被高频词、自指 host 指令或同名 fixture 劫持；`explain` 对已索引 Bash 符号有用，但对 PowerShell 函数和若干文档文件名不稳定。后续实现只应修正 host 指令和结构化 recall anchor，不应新增 project-graph 协议或常驻 benchmark。

## Provider Readiness Snapshot

`S1` 来自当前 Codex host setup ledger(`$HOME/.codex/spec-first/host-setup.json`)与当前只读命令:

- `provider_readiness[].provider=graphify`: `readiness_status=unknown`, `lifecycle.installed=true`, `configured=true`, `indexed=true`, `artifact_exists=true`, `query_verified=true`, `steady_state.hook_status=verified`
- `next_actions`: Graphify CLI 位于 `$HOME/.local/bin/graphify`，但不在当前 `PATH`
- 当前命令实测: `graphify-out/graph.json` 存在；`$HOME/.local/bin/graphify query/explain/path` 可运行
- 信任边界: 以上只是 setup/runtime mechanical facts；所有结论仍由 `rg`、CodeGraph/source snippet、source docs/tests/logs 确认

## Cases

### PGD-01

- question: `project-graph Graphify host instruction consumption quality relay diagnostic source runtime boundary`
- provider_readiness_snapshot: `S1`
- project_graph_attempt: `query`, `provider_untrusted`;候选主要是 `CLAUDE.md` / `AGENTS.md` 的 `## graphify` 段和 dual-host schema
- code_graph_or_rg_narrowing: `rg "Use Graphify first only|exploration-tier|provider_untrusted"` 直接定位 `CLAUDE.md`, `AGENTS.md`, `install-helpers.{sh,ps1}`, 以及测试断言
- confirmed_evidence: `docs/06-待办事项/2026-06-15-001-optimize-project-graph-usage-quality-plan.md`, `docs/contracts/project-graph-consumption.md`, `skills/spec-mcp-setup/scripts/install-helpers.sh`
- outcome: noisy
- deviation_stage: project-graph
- anchor_candidate: no;目标计划本身已有明确路径，Graphify 没有缩小读取面
- limitations: Graphify 输出未作为范围或结论证据

### PGD-02

- question: `Graphify instruction rendering install helpers AGENTS CLAUDE`
- provider_readiness_snapshot: `S1`
- project_graph_attempt: `query`, `provider_untrusted`;候选偏到 `AGENTS.md` 和 `helper-tools-registry.schema.json`
- code_graph_or_rg_narrowing: `rg` 精确找到 Bash/PowerShell 两个 render/normalize surface；CodeGraph 本轮 broad query 未直接命中 helper 函数
- confirmed_evidence: `skills/spec-mcp-setup/scripts/install-helpers.sh`, `skills/spec-mcp-setup/scripts/install-helpers.ps1`, `tests/unit/mcp-setup.sh`, `tests/unit/mcp-setup-powershell-contracts.test.js`
- outcome: noisy
- deviation_stage: project-graph
- anchor_candidate: yes;host 指令需要从 hard first-call wording 改为 exploration-tier wording
- limitations: 诊断只覆盖当前 helper render strings，不声明 provider install 全流程健康

### PGD-03

- question: `render_graphify_instruction_section`
- provider_readiness_snapshot: `S1`
- project_graph_attempt: `explain`, `provider_untrusted`;命中 `skills/spec-mcp-setup/scripts/install-helpers.sh L1115`
- code_graph_or_rg_narrowing: `rg "render_graphify_instruction_section"` 可确认 Bash source 与 normalize 调用
- confirmed_evidence: `skills/spec-mcp-setup/scripts/install-helpers.sh`
- outcome: helpful
- deviation_stage: none
- anchor_candidate: no;这是已索引 Bash 符号，说明 `explain` 对具名代码节点有价值
- limitations: 不代表 `.ps1` 函数或 docs 文件名同样可命中

### PGD-04

- question: `Get-GraphifyInstructionSection`
- provider_readiness_snapshot: `S1`
- project_graph_attempt: `explain`, `provider_untrusted`;未找到节点
- code_graph_or_rg_narrowing: `rg "Get-GraphifyInstructionSection"` 直接定位 PowerShell render 函数
- confirmed_evidence: `skills/spec-mcp-setup/scripts/install-helpers.ps1`
- outcome: miss
- deviation_stage: project-graph
- anchor_candidate: no;这是 provider 索引覆盖局限，不在本方案修 provider
- limitations: 未检查 Graphify 上游 PowerShell extractor 行为，只记录本仓当前图谱结果

### PGD-05

- question: `provider readiness source runtime boundary project graph consumption contract`
- provider_readiness_snapshot: `S1`
- project_graph_attempt: `query`, `provider_untrusted`;候选主要是 `provider-readiness.schema.json` 与 `provider-tools-registry.schema.json`
- code_graph_or_rg_narrowing: `rg "This relay is a trust-elevation direction|provider_readiness"` 缩到消费合同与 host setup ledger
- confirmed_evidence: `docs/contracts/project-graph-consumption.md`, current host setup ledger(`$HOME/.codex/spec-first/host-setup.json`, local runtime evidence), `skills/spec-mcp-setup/provider-tools.json`
- outcome: helpful
- deviation_stage: none
- anchor_candidate: no;现有合同已经覆盖 readiness/trust 边界
- limitations: `host-setup.json` 是本机 runtime evidence，不应写成 repo source truth

### PGD-06

- question: `verification run summary spec work run artifact closeout`
- provider_readiness_snapshot: `S1`
- project_graph_attempt: `query`, `provider_untrusted`;候选偏到 `src/cli/plugin.js`、adapter 和旧 `2026-05-20` plan
- code_graph_or_rg_narrowing: `rg "verification-run-summary|spec-work-run-artifact"` 定位 schema、producer helper、tests 和 shipping workflow 指引
- confirmed_evidence: `docs/contracts/workflows/spec-work-run-artifact.schema.json`, `src/cli/helpers/spec-work-run-artifact.js`, `skills/spec-work/references/shipping-workflow.md`, `tests/unit/spec-work-run-artifact-producer.test.js`
- outcome: noisy
- deviation_stage: project-graph
- anchor_candidate: no;closeout 证据链不应靠 Graphify query
- limitations: 未做 closeout producer 运行，只确认定位质量

### PGD-07

- question: `source runtime boundary generated runtime mirror init update install helpers graphify`
- provider_readiness_snapshot: `S1`
- project_graph_attempt: `query`, `provider_untrusted`;候选偏到 `spec-compound-refresh` 与 helper-tools schema
- code_graph_or_rg_narrowing: `rg "normalize_graphify_instruction_section|spec-first init|generated runtime"` 缩到 helper normalize 与角色契约 source/runtime 段
- confirmed_evidence: `docs/10-prompt/结构化项目角色契约.md`, `skills/spec-mcp-setup/scripts/install-helpers.sh`, `skills/spec-mcp-setup/scripts/install-helpers.ps1`
- outcome: noisy
- deviation_stage: project-graph
- anchor_candidate: yes;host docs 的 `## graphify` 段应明确 source-first valid，避免把 Graphify 误读为 workflow 路由 gate
- limitations: 未新增 source/runtime 合同；只修 host 指令 wording

### PGD-08

- question: `Knowledge Harness solution source_refs invalidation_condition legacy_unstructured_advisory`
- provider_readiness_snapshot: `S1`
- project_graph_attempt: `query`, `provider_untrusted`;候选被 eval fixture 的 `source_refs` 字段劫持
- code_graph_or_rg_narrowing: `rg "legacy_unstructured_advisory|new_promote_required_fields"` 直接定位 Knowledge Harness 与 spec-compound schema
- confirmed_evidence: `docs/contracts/knowledge/knowledge-harness.md`, `skills/spec-compound/references/schema.yaml`, `docs/solutions/tooling-decisions/graphify-query-explain-reliability-2026-06-12.md`
- outcome: miss
- deviation_stage: project-graph
- anchor_candidate: yes;既有 Graphify solution 应回填 `domain`、`pattern`、`source_refs`、`invalidation_condition`
- limitations: anchor 的独立收益是 structured recall，不是承诺 Graphify 召回变好

### PGD-09

- question: `Knowledge Harness`
- provider_readiness_snapshot: `S1`
- project_graph_attempt: `explain`, `provider_untrusted`;命中 `docs/contracts/knowledge/knowledge-harness.md L1`
- code_graph_or_rg_narrowing: `rg "Recall Trust Boundary|Promotion Boundary"` 可继续缩到相关节
- confirmed_evidence: `docs/contracts/knowledge/knowledge-harness.md`
- outcome: helpful
- deviation_stage: none
- anchor_candidate: no;具名概念 explain 可作为有用候选
- limitations: 仍需回源读取合同正文确认字段归属

### PGD-10

- question: `spec id traceability origin status superseded_by plan taxonomy`
- provider_readiness_snapshot: `S1`
- project_graph_attempt: `query`, `provider_untrusted`;候选偏到旧 plan 和 app-consistency metadata schema
- code_graph_or_rg_narrowing: `rg "spec_id|origin|source_plan_hash"` 缩到 Spec ID Traceability 合同
- confirmed_evidence: `docs/contracts/workflows/spec-id-traceability.md`
- outcome: noisy
- deviation_stage: project-graph
- anchor_candidate: no;P1 未证明 Spec ID 合同需要新增 anchor
- limitations: 只检查本题相关 traceability ownership，不审查 plan taxonomy 全量

### PGD-11

- question: `review closure traceability referenced_reviews addresses_findings deferred_findings`
- provider_readiness_snapshot: `S1`
- project_graph_attempt: `query`, `provider_untrusted`;候选偏到用户手册最佳实践和历史 standards 草稿
- code_graph_or_rg_narrowing: `rg "referenced_reviews|addresses_findings|deferred_findings"` 缩到 Review Closure Traceability 合同和 plan-status test
- confirmed_evidence: `docs/contracts/workflows/review-closure-traceability.md`, `tests/unit/plan-status-taxonomy.test.js`
- outcome: noisy
- deviation_stage: project-graph
- anchor_candidate: no;P1 未证明 review closure 合同需要改动
- limitations: 没有复审 review closure 的所有历史 artifacts

### PGD-12

- question: `project-graph-consumption.md`
- provider_readiness_snapshot: `S1`
- project_graph_attempt: `explain`, `provider_untrusted`;未找到节点
- code_graph_or_rg_narrowing: 直接读取计划 `source_refs` 和 `rg "project-graph-consumption.v1"` 定位合同
- confirmed_evidence: `docs/contracts/project-graph-consumption.md`, `tests/unit/project-graph-consumption-contracts.test.js`
- outcome: miss
- deviation_stage: project-graph
- anchor_candidate: no;合同文件名召回不稳定，不通过堆关键词修复
- limitations: 不代表合同正文没有被图谱部分索引，只说明该 filename explain 未命中

### PGD-13

- question: `spec-work-run-artifact`
- provider_readiness_snapshot: `S1`
- project_graph_attempt: `explain`, `provider_untrusted`;未找到节点
- code_graph_or_rg_narrowing: `rg "spec-work-run-artifact"` 精确定位 schema、producer helper 和 tests
- confirmed_evidence: `docs/contracts/workflows/spec-work-run-artifact.schema.json`, `src/cli/helpers/spec-work-run-artifact.js`, `tests/unit/spec-work-run-artifact-contract.test.js`
- outcome: miss
- deviation_stage: project-graph
- anchor_candidate: no;baseline `rg` 是更合适的定位工具
- limitations: 未审查 run artifact 语义，只作为 relay 定位样本

### PGD-14

- question: `AGENTS.md` -> `CLAUDE.md`
- provider_readiness_snapshot: `S1`
- project_graph_attempt: `path`, `provider_untrusted`;目标匹配歧义且未找到路径
- code_graph_or_rg_narrowing: direct source read/`rg "## graphify"` 同时定位两个 checked-in host docs
- confirmed_evidence: `AGENTS.md`, `CLAUDE.md`
- outcome: unavailable
- deviation_stage: project-graph
- anchor_candidate: no;host docs 同步应由 install-helper normalize/test 证明，不依赖 project-graph path
- limitations: path 命令对两个高频根文档名没有提供实用 relay

## Diagnosis

- `project_graph`: 10/14 个样本为 noisy/miss/unavailable，主要偏航来自 seed selection、自指 host 段、高频字段名和部分文件/语言索引覆盖。
- `code_graph_or_rg`: 对本题实施路径，`rg` 是最稳定 narrowing layer；CodeGraph/source snippets 可辅助代码符号，但不能替代 direct source/test/doc confirmation。
- `source-confirmation`: 所有实施结论均能由计划、合同、helper source、tests 和 host setup ledger 直接确认。

## Anchor Decisions

- P0: 修改 `## graphify` host 指令，把 `Use Graphify first only` 改成 exploration-tier orientation，并写明 `reading source first is always valid`。
- P2: 只回填既有 solution 的 structured recall anchor: `domain`、`pattern`、`source_refs`、`invalidation_condition`，并补充 rejected alternatives / applicable versions。
- No action: 不改 `docs/contracts/project-graph-consumption.md`，不新增 project-graph schema，不改 Spec ID / Review Closure 合同，不修 Graphify provider。

## P3 Decision

不做常驻 benchmark suite。本诊断没有形成稳定、可确定性判定的 provider recall golden；把 Graphify 召回质量做成 CI gate 会把 LLM 语义判断或 provider 内部算法误装成 spec-first 硬证据。若未来出现高频且人工 golden 清晰的问题，应另开 opt-in 方案评估，而不是进入核心路径。
