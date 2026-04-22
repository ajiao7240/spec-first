# Agent 发现矩阵

| 来源 | 事实依据 | 关键发现 | 分类 | 是否采纳 |
| --- | --- | --- | --- | --- |
| 主线程 | `git status` / `git ls-files` | `项目治理-agent.md` 是未跟踪草案 | `应重构` | 已采纳 |
| 主线程 | `npm test` | 仓库具备真实多层验证，不是文档自证 | `应保留` | 已采纳 |
| Agent A | `src/cli` / `plugin.js` / `state.js` | CLI 边界总体清楚，但 `skills.js/agents.js` 脱节、`--force` ghost、prompt prose anchor 偏重 | `应重构` `应删除` `应轻量化` | 已采纳 |
| Agent B | `run-bootstrap.js` / `evaluator.js` / schema | `artifact-manifest.json` 双语义、多真相源 | `应重构` | 已采纳 |
| Agent B | `sample-generator.js` | ownership/review-queue 由 sample 伪造发布 | `应重构` | 已采纳 |
| Agent B | `run-bootstrap.js` | workspace readiness 发布即可能陈旧 | `应强化` `应重构` | 已采纳 |
| Agent B | `schema-loader.js` | schema 校验能力弱于 schema 实际使用面 | `应轻量化` `应强化` | 已采纳 |
| Agent C | `review-context.js` | review-context 越界到 review/workflow 决策拼装 | `应重构` | 已采纳 |
| Agent C | `query.js` | `inheritors_of` 无事实生产链 | `应删除` 或 `应修正` | 已采纳 |
| Agent C | `impact.js` / `changes.js` / `affected-flows.js` | deterministic helper 重复，命令层开始长逻辑化 | `应轻量化` | 已采纳 |
| Agent D | `skills/setup/SKILL.md` / governance contract | setup Codex 入口写错 | `应强化` | 已采纳 |
| Agent D | `using-spec-first/SKILL.md` / `spec-mcp-setup` | MCP setup 路由错误 | `应强化` | 已采纳 |
| Agent D | 全量扫描 48 skills | 11 个 skill 命名漂移 | `应强化` | 已采纳 |
| Agent D | source vs mirror | docs mirror drift | `应强化` | 已采纳 |
| Agent D | 全量扫描 57 agents | 23 个 agents 缺直接 reachability evidence | `应强化` | 已采纳 |
| Agent E | `doctor.js` / tests | `doctor verified` 仍属推断 | `应强化` `应轻量化` | 已采纳 |
| Agent E | `package.json` / tests tree | `tests/contracts` 未接线 | `应强化` | 已采纳 |
| Agent E | `install-tarball.sh` | 未知 `tree-sitter-*` 只 warning | `应强化` | 已采纳 |
| Agent E | package scripts | integration/e2e 命名边界漂移 | `应轻量化` | 已采纳 |

## 共识点

- 文档哲学方向应保留。
- 文档定位必须重构。
- dual-host governance 需要进入显式审计清单。
- verification 术语必须降强度或补探测。
- sample/live 与 manifest/freshness 风险是真问题，不是抽象担忧。

## 争议点

### 是否应立即制度化 full-audit / 多 Agent

- 支持：文档骨架质量高，结构完整
- 反对：当前无配套 workflow/contract/checker，直接制度化会走向强编排
- 裁决：`应实验化`

### 是否应扩大 prompt 正文锚点守卫

- 支持：可保护高价值 workflow 语义
- 反对：会把 CLI 拉向持有语义正文
- 裁决：只做少数 workflow 试点，`应实验化`

## 未采纳项

- 未采纳“直接把被审文档作为现行治理真源”
- 未采纳“把 full audit 设为默认前置流程”
