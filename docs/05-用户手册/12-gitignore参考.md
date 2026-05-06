# spec-first `.gitignore` 参考

本文面向把 `spec-first` 安装到业务项目里的用户，说明在执行 `spec-first init`、`spec-mcp-setup`、`spec-graph-bootstrap` 和 `spec-standards` 后，哪些产物应该加入 `.gitignore`，哪些产物可以按团队协作需要提交。

从 `v1.7.0` 起，`spec-first init --claude|--codex` 会在当前目标项目的 `.gitignore` 中自动写入或更新一个 `# spec-first:start` / `# spec-first:end` managed block。`init --dry-run` 会预览这次写入，但不会改变文件系统。团队仍然应该 review 并提交 `.gitignore`，让后续成员获得相同忽略规则。

核心原则：

- `.claude/`、`.codex/` 和 `.agents/skills/` 下的 spec-first runtime mirror 可重建，不作为项目 source truth。
- `.spec-first/config/`、`.spec-first/graph/`、`.spec-first/providers/`、`.spec-first/impact/` 和 `.spec-first/workspace/` 是本地 readiness/control-plane facts，默认不提交。
- `.spec-first/standards/` 里有一部分是可 review 的项目规范 baseline。默认不要整目录忽略，除非团队明确决定 standards baseline 只保留在本地。
- `AGENTS.md`、`CLAUDE.md`、`docs/`、项目源码、测试和 confirmed standards source 应按团队正常协作策略提交。

## init 默认写入的 `.gitignore` block

`init` 默认写入下面这一段。不要手改 managed block 内部内容；如果需要团队额外规则，放在 block 外部。

```gitignore
# spec-first:start
# spec-first generated runtime assets
.claude/commands/spec/
.claude/skills/
.claude/spec-first/
.claude/agents/
.claude/tasks/
.claude/worktrees/
.codex/commands/spec/
.codex/spec-first/
.codex/agents/
.agents/skills/
.context/spec-first/

# spec-first local setup, graph readiness, and workflow runtime artifacts
.spec-first-graph/
.spec-first/*.local.yaml
.spec-first/config.local.yaml
.spec-first/config/*.json
.spec-first/audits/
.spec-first/app-audit/
.spec-first/graph/
.spec-first/providers/
.spec-first/impact/
.spec-first/workflows/
.spec-first/workspace/
.spec-first/standards/work/
.spec-first/standards/tmp/
.spec-first/standards/cache/
.spec-first/standards/raw/
.spec-first/standards/graph-query-raw/
.spec-first/standards/**/*.log
.spec-first/standards/repo-profile.patch.yaml

# local project tooling used by spec-first workflows
.serena/
# spec-first:end
```

`init` 不会递归修改多仓 workspace 里的所有 child repo。你在哪个目录运行 `spec-first init --claude|--codex`，它只维护当前目标目录的 `.gitignore`；如果要给某个 child repo 安装运行时资产和 `.gitignore`，请在该 child repo 内运行 init，或使用后续显式 all-repos setup 流程。

如果项目里已经有同类规则，`init` 仍会保留 spec-first managed block，保证后续版本可以幂等更新。它不会尝试判断所有语义等价的 glob，也不会删除 block 外的用户规则。

如果你的项目没有自定义 `.agents/` 目录资产，也可以把 `.agents/skills/` 简化成：

```gitignore
.agents/
```

如果项目里已经用 `.agents/plugins/` 或其他 `.agents/` 内容承载团队自定义资产，不要忽略整个 `.agents/`，只忽略 `.agents/skills/`。

## 执行后常见产物树

```text
<repo>/
  AGENTS.md                         # Codex 入口文档，可提交
  CLAUDE.md                         # Claude Code 入口文档，可提交
  .gitignore                        # 建议提交

  .claude/
    commands/spec/                  # generated runtime，忽略
    skills/                         # generated runtime，忽略
    spec-first/                     # runtime state/profile，忽略
    agents/                         # generated runtime，忽略
    tasks/ worktrees/               # host-local scratch，忽略

  .codex/
    commands/spec/                  # legacy cleanup/runtime path，忽略
    spec-first/                     # runtime state/profile，忽略
    agents/                         # generated runtime，忽略

  .agents/
    skills/                         # Codex skill runtime mirror，忽略

  .spec-first/
    config.local.example.yaml       # 本地配置模板，可提交
    config.local.yaml               # 本地配置，忽略
    config/
      graph-providers.json          # setup-owned projection，忽略
      runtime-capabilities.json     # setup-owned local readiness facts，忽略
      provider-artifacts.json       # setup/bootstrap path contract，忽略
    providers/
      <provider>/raw/*.log          # provider 原始日志，忽略
      <provider>/status.json        # provider 本地状态，忽略
      <provider>/normalized/*.json  # provider 规范化事实，忽略
    graph/
      provider-status.json          # canonical graph readiness facts，忽略
      graph-facts.json              # canonical graph readiness facts，忽略
      bootstrap-report.md           # 本地 bootstrap 报告，忽略
    impact/
      bootstrap-impact-capabilities.json # impact capability envelope，忽略
    workspace/
      *.json                        # 父级多仓 advisory summaries，忽略
    standards/
      project-shape.json            # reviewable baseline，可选择提交
      standards-plan.json           # reviewable baseline，可选择提交
      glue-map.json                 # reviewable baseline，可选择提交
      standards-candidates.json     # reviewable baseline，可选择提交
      standards-preview.md          # reviewable baseline，可选择提交
      standards-sources.json        # import-source 模式，可选择提交
      import-lock.json              # import-source 模式，可选择提交
      imported-standards.json       # import-source 模式，可选择提交
      graph-query-index.json        # deep 模式 query plan，可选择提交
      standards-update-decision.json # quick/refresh freshness，可选择提交
      standards-drift.md            # refresh/drift 报告，可选择提交
      repo-profile.patch.yaml       # preview/apply patch，通常不提交
      work/ tmp/ cache/ raw/ graph-query-raw/ *.log # scratch，忽略

  .serena/                          # 本地符号索引配置/缓存，忽略
```

## 需要提交的内容

通常应该提交：

| 路径 | 原因 |
| --- | --- |
| `.gitignore` | 让团队统一忽略本地 runtime/control-plane 产物 |
| `AGENTS.md` | Codex 入口文档，包含项目级 workflow 入口治理和语言策略 |
| `CLAUDE.md` | Claude Code 入口文档，包含项目级 workflow 入口治理和语言策略 |
| `.spec-first/config.local.example.yaml` | 本地配置模板，不包含个人密钥时可作为 onboarding 模板提交 |
| `docs/brainstorms/`、`docs/plans/`、`docs/tasks/`、`docs/solutions/` | durable workflow artifacts 和工程知识 |
| `.spec-first/specs/repo-profile.yaml` | 如果团队明确使用它承载 confirmed project profile，应作为项目知识 source 提交 |

`AGENTS.md` 和 `CLAUDE.md` 是 checked-in host entry docs，不等同于 `.agents/skills/`、`.codex/agents/` 或 `.claude/skills/` 里的 runtime mirror。

## 默认不提交的内容

默认不提交：

| 路径 | 原因 |
| --- | --- |
| `.claude/commands/spec/`、`.claude/skills/`、`.claude/spec-first/`、`.claude/agents/` | `spec-first init --claude` 可重建的 runtime assets |
| `.claude/tasks/`、`.claude/worktrees/` | Claude Code host-local scratch/worktree 产物 |
| `.codex/commands/spec/`、`.codex/spec-first/`、`.codex/agents/`、`.agents/skills/` | `spec-first init --codex` 可重建的 runtime assets |
| `.spec-first/config.local.yaml`、`.spec-first/*.local.yaml` | 本地配置，可能包含个人路径或私有设置 |
| `.spec-first/config/*.json` | `spec-mcp-setup` 生成的 setup-owned 本地投影，不是第二个版本源 |
| `.spec-first/providers/` | provider 原始日志、状态和规范化输出，依赖本机环境和当前索引 |
| `.spec-first/graph/` | graph readiness facts，可由 `spec-graph-bootstrap` 重建 |
| `.spec-first/impact/` | impact capability envelope，可由 `spec-graph-bootstrap` 重建 |
| `.spec-first/workspace/` | 父级多仓 advisory summaries，不是 child repo canonical truth |
| `.spec-first/audits/`、`.spec-first/app-audit/`、`.spec-first/workflows/` | workflow execution evidence，默认本地留存 |
| `.spec-first/standards/work/`、`tmp/`、`cache/`、`raw/`、`graph-query-raw/`、`*.log` | standards scratch/raw/cache/logs |
| `.spec-first/standards/repo-profile.patch.yaml` | repo-profile preview/apply 阶段的临时 patch |
| `.serena/` | 本地符号索引配置/缓存 |

`*.tgz` 是本地打包产物，可重新执行 `npm pack` 生成，但它不是 spec-first 专属产物，因此不进入 init 默认 managed block。团队如果希望统一忽略 npm pack 产物，可以在 block 外自行加入：

```gitignore
*.tgz
```

## standards baseline 的提交策略

`spec-standards` 是唯一需要团队做选择的目录。它既会生成 deterministic facts，也会生成 LLM review artifacts。推荐策略是：

| 产物 | 默认策略 | 说明 |
| --- | --- | --- |
| `project-shape.json` | 可提交 | 项目形态 facts，适合团队共享 |
| `standards-plan.json` | 可提交 | 本次 standards run 的 synthesis contract 和 downstream consumers |
| `glue-map.json` | 可提交 | 可复用能力和不要重复实现的边界 |
| `standards-candidates.json` | 可提交 | 候选规范，只有 `confirmed` 才能作为硬约束 |
| `standards-preview.md` | 可提交 | 人类可读 preview，便于 review 和确认 |
| `standards-sources.json`、`import-lock.json`、`imported-standards.json` | 可提交 | shared standards import-source 的来源和锁定信息 |
| `graph-query-index.json` | 可提交 | deep 模式的 bounded query plan，不包含 raw MCP dump |
| `standards-update-decision.json`、`standards-drift.md` | 可选择提交 | 如果团队希望保留 freshness/drift 审计记录，可以提交；否则可作为本地检查产物 |
| `repo-profile.patch.yaml` | 通常不提交 | 它是 preview/apply 阶段的临时 patch；更推荐提交最终确认后的 `.spec-first/specs/repo-profile.yaml` |

在把 `standards-candidates.json` 和 `standards-preview.md` 当作可信 baseline 前，先运行：

```bash
node skills/spec-standards/scripts/validate-artifacts.js --standards-dir .spec-first/standards --json
```

验证失败或 `trust_level=degraded` 时，下游 workflow 只能把 standards artifacts 当作 advisory context，不能把它们当作 confirmed project policy。

## 可选严格模式：完全不提交 standards 产物

如果团队希望 `.spec-first/standards/` 全部只保留在本地，可以额外加入：

```gitignore
# Optional: keep all spec-first standards artifacts local
.spec-first/standards/
```

使用这个模式时，下游会话仍可读取本机已有 standards artifacts，但其他团队成员和 CI 不会共享这份 baseline。团队如果希望跨人复用 project standards，不建议启用这个严格模式。

## 不建议加入的规则

不要默认加入：

```gitignore
.claude/
.codex/
.agents/
.spec-first/
.spec-first/standards/
```

原因：

- 整个 `.claude/` 或 `.codex/` 可能会隐藏团队有意提交的项目设置、hook 或非 spec-first 配置。
- 整个 `.agents/` 可能会隐藏团队自定义 plugins 或 marketplace 配置。
- 整个 `.spec-first/` 会隐藏 `.spec-first/config.local.example.yaml`、`.spec-first/specs/repo-profile.yaml` 和团队选择提交的 standards baseline。
- 整个 `.spec-first/standards/` 会隐藏团队可能想 review 和共享的 standards baseline。

默认推荐是忽略 spec-first 可重建 runtime 和本地 facts，同时保留少数 durable artifacts 的提交决策空间。
