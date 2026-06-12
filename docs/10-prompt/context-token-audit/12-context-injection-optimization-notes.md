# 当前上下文注入成本项优化建议

## 结论

当前 Codex 上下文注入对 `spec-first` 是合理的：它守住了 workflow 入口、source/runtime 边界、script/LLM 职责分工和中文治理策略。但它也带来明显上下文成本。优化方向不是删除治理，而是把治理拆成更稳定、更短、更按需展开的上下文层。

推荐总体策略：

1. 保留 session 启动时的最小治理锚点。
2. 将长规则收回 source-of-truth 文档和按需 `references/`。
3. 用 summary/index/context bundle 消费长 artifact。
4. 把 optional provider、Graphify、review fanout 和 skill 触发都标成 advisory 或 scoped capability，避免默认放大。

## Goals

- 降低普通轻量问答、定位、docs-only 任务的上下文负载。
- 保留 `Light contract + Explicit boundaries + Scripts prepare, LLM decides` 的核心治理。
- 避免把 generated runtime mirror 当 source 修。
- 让 workflow routing、skill trigger、Graphify/provider evidence 的边界更清楚。
- 让后续实现可以通过 focused contract tests 或 eval examples 验证。

## Non-goals

- 不移除 `using-spec-first` 入口治理。
- 不弱化 source/runtime 边界、verification honesty、degraded-mode reason code。
- 不取消项目 source 变更同步 `CHANGELOG.md` 的规则。
- 不把 Graphify 或其他 provider 结果升级为 confirmed truth。
- 不新增中心化强状态机。

## Source / Runtime 边界

建议只修改 source-of-truth：

- `skills/using-spec-first/SKILL.md`
- `skills/*/SKILL.md` 的 trigger / reference load conditions
- `templates/*` 中的 host bootstrap / session-start 生成逻辑
- `docs/contracts/context-governance.md`
- `docs/10-prompt/context-token-audit/**`
- 相关 focused contract tests / eval examples

不要手改：

- `.claude/**`
- `.codex/**`
- `.agents/skills/**`

需要 runtime 刷新时，用 `spec-first init` 从 source 重新生成。

## 1. 上下文很重

### 问题

当前注入同时包含 host developer rules、`AGENTS.md` managed blocks、skills 列表、Graphify 规则、项目治理规则和大量 workflow route map。对 `spec-first` 自身治理是有价值的，但轻量请求也会被迫携带完整治理负载。

### 优化建议

1. **把 session 启动注入收敛为最小锚点**
   - 只保留语言策略、target repo 边界、workflow-first 提醒、source/runtime 禁线和 `using-spec-first` source path。
   - 不在启动层重复 route map 全量文本、长反例、完整 skill 列表解释。

2. **将长规则移动到按需 source**
   - `AGENTS.md` managed block 保留核心决策集。
   - `skills/using-spec-first/SKILL.md` 保留完整路由细节。
   - 复杂例子、edge cases、eval fixtures 继续放 `references/` 或 `evals/`，只在编辑/eval/review routing 规则时读取。

3. **引入上下文预算检查**
   - 给高频启动块设定目标，例如 managed bootstrap block 控制在可维护的短文本范围内。
   - 用 contract test 断言“session-start hook 不复读 managed block”这类高价值不变量。

4. **按任务类型降级加载**
   - 轻量事实问答：不强制读完整 workflow skill。
   - 明确写入/修复/评审/计划：再进入对应 `$spec-*` workflow 并加载其 source。
   - 架构/prompt/workflow/contract 判断：必须读角色契约。

### Script-owned facts

- token/line/byte 预算统计。
- managed block 是否重复注入。
- runtime mirror 是否由 source 生成。

### LLM-owned judgment

- 当前请求是否需要完整 workflow。
- 哪些 references 对当前任务有语义价值。
- 超预算时是否接受 degraded context。

### 验收信号

- 轻量问答不需要读取完整 `$spec-work` / `$spec-plan` / `$spec-code-review`。
- SessionStart 只输出短提醒，不复读 `AGENTS.md` managed block。
- 高风险治理任务仍会读角色契约和对应 source skill。

## 2. 重复度偏高

### 问题

`AGENTS.md` managed block、SessionStart reminder、`using-spec-first` skill、角色契约之间存在刻意重叠。重叠能提高启动可靠性，但也会增加 token 成本和漂移风险。

### 优化建议

1. **明确三层职责**
   - 角色契约：系统演化判断基线，不做 runtime workflow 细节。
   - `using-spec-first/SKILL.md`：完整路由 source-of-truth。
   - `AGENTS.md` managed block：会话启动时的核心子集，只承载入口锚点和必须禁线。

2. **把重复从“文本一致”改成“关键不变量一致”**
   - 不要求三处逐字同步。
   - 用 tests 断言 route identifiers、host entrypoint spelling、source/runtime 禁线、internal helper 不暴露等关键 token 存在。

3. **为重复内容建立引用式表达**
   - `AGENTS.md` 中保留“完整策略见 `skills/using-spec-first/SKILL.md`”。
   - SessionStart 只提示“治理已由 `AGENTS.md` 注入”，避免再复制原文。

4. **减少跨文档解释性重复**
   - 角色契约解释为什么。
   - workflow skill 说明怎么做。
   - bootstrap block 只告诉当前会话必须记住什么。

### Script-owned facts

- managed block 与 full skill 的 route id 集合一致性。
- SessionStart 输出是否包含重复块。
- generated runtime 是否与 source projection 一致。

### LLM-owned judgment

- 某个细节应留在 bootstrap，还是下沉到 full skill。
- 当前任务是否需要展开角色契约或 full skill。

### 验收信号

- 三层文档不再大段同文重复。
- route map、host entrypoint、source/runtime 边界仍被测试覆盖。
- runtime reminder 缺失时可降级提示 `spec-first init`，但不伪造 deterministic readiness。

## 3. Graphify 触发面偏宽

### 问题

Graphify 对 codebase / architecture / file relationship 问题很有价值，但“任何 project content 问题”容易让普通文档写作、当前对话总结或用户已给定材料也先走图谱。Graphify 的 BFS/query 结果是导航线索，不是 confirmed truth。

### 优化建议

1. **收窄默认触发条件**
   - 默认触发：架构关系、跨文件关系、影响面、where/how does X connect、代码库导航。
   - 默认不触发：用户要求把当前对话整理成文档、明确给定单个文档路径、简单事实问答、只需要编辑当前已知内容。

2. **把 Graphify 标成 provider_untrusted**
   - Graphify 输出用于发现候选节点和 source refs。
   - 最终结论必须回到 source 文件、测试、diff 或用户提供材料确认。

3. **建立 Graphify 使用分级**
   - broad navigation：`graphify query`。
   - precise relationship：`graphify path`。
   - concept explanation：`graphify explain`。
   - source confirmation：`rg` / direct file read / tests。

4. **避免 graph freshness 伪确定**
   - `graphify-out/graph.json` 存在只说明 artifact 可用。
   - freshness、coverage、query quality 仍是 advisory。
   - stale 或 provider 不可用时，用 bounded direct reads，并建议 `$spec-mcp-setup --only graphify` 修复 readiness。

### Script-owned facts

- `graphify-out/graph.json` 是否存在。
- Graphify CLI 是否可见。
- query/path/explain 命令是否成功、exit code 和 raw output path。

### LLM-owned judgment

- 当前问题是否需要图谱导航。
- 图谱候选是否足以指导下一步 source read。
- 何时声明 provider evidence degraded。

### 验收信号

- 简单 docs-only 产出不强制 Graphify。
- Graphify 结论进入 final / handoff 时标注 advisory 或 provider_untrusted。
- 重要结论附 source refs 或明确说明未回源。

## 4. CHANGELOG 规则很硬

### 问题

项目要求任何 source 变更都同步根目录 `CHANGELOG.md`。这符合 source governance，但当前 changelog entry 往往很长，导致读取、编辑、review 和冲突成本升高。硬规则的问题不在“必须记录”，而在“记录粒度和消费方式”。

### 优化建议

1. **保留硬 gate，压缩 entry**
   - 仍要求任何 source 变更追加根 `CHANGELOG.md`。
   - entry 只记录用户可见影响、source 面、验证摘要和必要 caveat。
   - 长设计理由放到 plan/review/doc artifact，changelog 引用路径即可。

2. **采用 latest-window 消费**
   - 普通任务只读 changelog 顶部窗口和格式说明。
   - release note / 历史追溯任务再读更大范围或索引。

3. **建立 changelog entry 模板**
   - `docs(type): <一句话>；影响 <paths/surfaces>；验证 <commands or not-run reason>`
   - 避免把完整实现说明、测试全集、review 过程全部塞进一条 entry。

4. **把 author 获取脚本化**
   - author 继续来自 `~/.spec-first/.developer`。
   - 可提供 helper 或 doc snippet，减少每次手动确认成本。

5. **区分 user-visible 与内部 source 记录**
   - 用户可见行为变化继续追加 `(user-visible)`。
   - 纯内部文档索引或测试补强不滥用 user-visible 标记。

### Script-owned facts

- `CHANGELOG.md` 是否有新增 entry。
- entry 是否匹配格式。
- author 是否来自 developer profile。
- package version 是否匹配当前 `package.json`。

### LLM-owned judgment

- 变更是否 user-visible。
- changelog 摘要应该压缩到什么粒度。
- 哪些设计细节应放 changelog，哪些应放 artifact。

### 验收信号

- source 变更仍有 changelog。
- entry 不再复制完整计划或评审报告。
- 普通 workflow 不需要读取整个历史 changelog 才能继续。

## 5. Skill 触发规则和路由治理有轻微张力

### 问题

全局 skill 规则倾向于“任务匹配 skill 就必须使用”，而 `using-spec-first` 又要求不要把轻量请求强制 workflow 化。两者能自洽，但需要更明确地区分：**使用 skill 方法论** 不等于 **进入 public workflow**。

### 优化建议

1. **明确 skill trigger 与 workflow route 的层级**
   - Skill trigger：决定是否读取某个方法论或工具说明。
   - Workflow route：决定是否进入 `$spec-*` public workflow 并允许其拥有 artifact / validation / handoff。

2. **让 `using-spec-first` 可返回 direct answer**
   - 它可以被用于分类当前请求。
   - 分类结果可以是“无 workflow meaningful applies，直接回答”。
   - 这不是跳过 skill，而是 skill 的合法输出。

3. **增加负例 eval**
   - 轻量问候、当前上下文解释、窄定位查询、当前对话整理，不应进入 `$spec-work`。
   - 写文件、修复 bug、评审 diff、设计 workflow contract，才进入对应 workflow。

4. **避免 helper skill 暴露为入口**
   - `graphify`、`git-worktree`、browser 等作为 provider/helper。
   - 只有 public `$spec-*` 是用户入口，除 standalone skill 明确允许外不推荐隐藏 helper。

5. **在 bootstrap 中加入一句判别规则**
   - “skill 使用不自动等于 workflow admission；轻量请求可由 `using-spec-first` 判定后直接回答。”
   - 这能降低 agent 因全局 skill 规则而过度路由的概率。

### Script-owned facts

- eval examples 是否覆盖 positive/negative routing cases。
- public entrypoint 拼写是否符合当前 host。
- helper skill 是否被错误列为 public route。

### LLM-owned judgment

- 用户意图是轻量问答、评审、计划、实现还是治理设计。
- 当前是否需要 artifact-producing workflow。
- helper evidence 是否足以支持直接回答。

### 验收信号

- 轻量请求不会创建 workflow artifact。
- 明确写入任务仍进入 `$spec-work`。
- 显式 `$spec-*` route 仍优先尊重。
- helper skill 不被包装成不存在的 public entrypoint。

## 最小落地顺序

1. **先改文档契约**
   - 在 context governance 或 token audit 文档中写清 skill trigger vs workflow route。
   - 明确 Graphify 默认触发和非触发场景。

2. **再改启动/注入层**
   - 保持 SessionStart 短提醒。
   - 确认 `AGENTS.md` managed block 只承载核心子集。

3. **补 focused tests / eval**
   - route id invariants。
   - no duplicate managed block。
   - negative routing examples。
   - changelog format / latest-window consumption 约束。

4. **最后压缩高频 skill core**
   - `using-spec-first`。
   - `spec-work`。
   - `spec-plan`。
   - `spec-code-review`。

## 风险与反模式

- 反模式：为了省 token 删除 source/runtime 边界。
- 反模式：把 Graphify 查询成功当成代码事实已确认。
- 反模式：把 changelog gate 改成可选，导致 source 变更不可追踪。
- 反模式：把 context router 做成强状态机，替代 LLM 判断。
- 风险：压缩 bootstrap 后新会话漏掉关键禁线；缓解方式是 contract tests + source skill 按需读取。
- 风险：过度 latest-window 导致历史变更遗漏；缓解方式是 release/history 任务显式扩大范围。

## 验证建议

本文档本身是 docs-only 建议，不改变 runtime 行为。若后续执行实现，建议验证：

- `npm run test:unit`
- `npm run lint:skill-entrypoints`
- focused runtime projection tests for Claude/Codex startup reminders
- routing eval examples for `using-spec-first`
- `git diff --check`

当前文档的完成标准：

- 五个成本点均有对应优化建议。
- 每项区分 script-owned facts 与 LLM-owned judgment。
- 明确 source/runtime 边界。
- 明确不弱化 changelog、evidence、degraded-mode 和 provider advisory 边界。
