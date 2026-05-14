# spec-first `.gitignore` 参考

本文面向把 `spec-first` 安装到业务项目里的用户，说明在执行 `spec-first init`、`spec-mcp-setup`、`spec-graph-bootstrap` 和 `spec-standards` 后，哪些产物应该加入 `.gitignore`，哪些产物可以按团队协作需要提交。

从 `v1.7.0` 起，`spec-first init --claude|--codex` 会在当前目标项目的 `.gitignore` 中自动写入或更新一个 `# spec-first:start` / `# spec-first:end` managed block。`init --dry-run` 会预览这次写入，但不会改变文件系统。团队仍然应该 review 并提交 `.gitignore`，让后续成员获得相同忽略规则。

核心原则：

- `.claude/`、`.codex/` 和 `.agents/skills/` 下的 spec-first runtime mirror 可重建，不作为项目 source truth。
- `.spec-first/config/`、`.spec-first/graph/`、`.spec-first/providers/`、`.spec-first/impact/` 和 `.spec-first/workspace/` 是本地 readiness/control-plane facts，默认不提交。
- `.spec-first/audits/**` 和 generated runtime mirrors 也不应作为普通 LLM 上下文扫描源；只有 setup/update/runtime-drift/audit 任务或用户明确点名路径时才按需读取。
- `.spec-first/standards/` 是本地 standards baseline、preview、scratch 和 evidence 工作区，默认不提交；需要团队共享的 confirmed standards 应 promote 到明确 source 路径。
- `.spec-first/sessions/` 是 multi-actor 治理协议的 opt-in advisory 记录目录，由 `spec-first session register` 等命令写入；属于 runtime state，默认不提交。
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

# spec-first local setup, graph readiness, standards, and workflow runtime artifacts
.gitnexus/
.code-review-graph/
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
.spec-first/standards/
.spec-first/sessions/

# local project tooling used by spec-first workflows
.serena/
# spec-first:end
```

普通单 repo / monorepo 中，`init` 保持当前行为，只维护当前执行目录对应的目标项目 `.gitignore`，通常应在项目根目录运行。在父 workspace 且检测到多个 child Git repos 时，`init` 默认进入 all-child maintenance：逐个初始化 child repo，并只在父目录写 `.spec-first/workspace/init-summary.json` advisory summary；父目录不写 `.gitignore`、`AGENTS.md`、`CLAUDE.md`、`.claude/`、`.codex/` 或 `.agents/` 等 repo-local artifacts。使用 `--repo <child>` 可只初始化一个 child repo，使用 `--all-repos` 可显式声明批量初始化意图。

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

  .gitnexus/                         # GitNexus 本地图谱索引/metadata，忽略
  .code-review-graph/                # code-review-graph 本地索引/cache，忽略

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
      project-shape.json            # local standards baseline，忽略
      standards-plan.json           # local synthesis contract，忽略
      glue-map.json                 # local reuse-first context，忽略
      standards-candidates.json     # local candidate baseline，忽略
      standards-preview.md          # local review preview，忽略
      standards-sources.json        # import-source 模式本地锁定信息，忽略
      import-lock.json              # import-source 模式本地锁定信息，忽略
      imported-standards.json       # imported standards 本地候选，忽略
      graph-query-index.json        # deep 模式 bounded query plan，忽略
      standards-update-decision.json # quick/refresh freshness，本地检查产物，忽略
      standards-drift.md            # refresh/drift 本地报告，忽略
      repo-profile.patch.yaml       # preview/apply patch，忽略
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
| `.gitnexus/`、`.code-review-graph/` | 本地图谱 provider 索引、metadata 或 cache，可由对应 provider 重建 |
| `.spec-first/config/*.json` | `spec-mcp-setup` 生成的 setup-owned 本地投影，不是第二个版本源 |
| `.spec-first/providers/` | provider 原始日志、状态和规范化输出，依赖本机环境和当前索引 |
| `.spec-first/graph/` | graph readiness facts，可由 `spec-graph-bootstrap` 重建 |
| `.spec-first/impact/` | impact capability envelope，可由 `spec-graph-bootstrap` 重建 |
| `.spec-first/workspace/` | 父级多仓 advisory summaries，不是 child repo canonical truth |
| `.spec-first/audits/`、`.spec-first/app-audit/`、`.spec-first/workflows/` | workflow execution evidence，默认本地留存 |
| `.spec-first/standards/` | standards baseline、preview、import lock、scratch 和本地 evidence 工作区；confirmed standards 应 promote 到明确 source 路径 |
| `.spec-first/sessions/` | multi-actor 治理协议的 opt-in advisory 记录目录，由 `spec-first session register` 写入；不启用时为空 |
| `.serena/` | 本地符号索引配置/缓存 |

`*.tgz` 是本地打包产物，可重新执行 `npm pack` 生成，但它不是 spec-first 专属产物，因此不进入 init 默认 managed block。团队如果希望统一忽略 npm pack 产物，可以在 block 外自行加入：

```gitignore
*.tgz
```

## standards baseline 的共享策略

`spec-standards` 会生成 deterministic facts 和 LLM review artifacts，但这些文件默认属于本地 `.spec-first/standards/` 工作区，不直接提交。推荐策略是：

| 产物 | 默认策略 | 说明 |
| --- | --- | --- |
| `project-shape.json`、`standards-plan.json`、`glue-map.json` | 不提交 | 本地 project facts 和 reuse context，可由 `$spec-standards` 重建 |
| `standards-candidates.json`、`standards-preview.md` | 不提交 | 候选规范和 preview，只有经过确认后才应 promote 到 source |
| `standards-sources.json`、`import-lock.json`、`imported-standards.json` | 不提交 | shared standards import-source 的本地来源和锁定信息；需要共享时应进入明确 source 文档或配置 |
| `graph-query-index.json`、`standards-update-decision.json`、`standards-drift.md` | 不提交 | deep/quick/refresh 的本地 evidence 和 freshness 记录 |
| `repo-profile.patch.yaml` | 不提交 | preview/apply 阶段的临时 patch；提交最终确认后的 `.spec-first/specs/repo-profile.yaml` 或其他 source 路径 |

在把 `standards-candidates.json` 和 `standards-preview.md` 当作可信 baseline 前，先运行：

```bash
node skills/spec-standards/scripts/validate-artifacts.js --standards-dir .spec-first/standards --json
```

验证失败或 `trust_level=degraded` 时，下游 workflow 只能把 standards artifacts 当作 advisory context，不能把它们当作 confirmed project policy。

## 共享 confirmed standards

如果团队希望跨人复用 project standards，不要提交 `.spec-first/standards/` 本地工作区。应把已确认内容 promote 到明确 source-of-truth，例如 `.spec-first/specs/repo-profile.yaml`、`docs/specs/**`，或团队约定的 confirmed standards 文档。

## 不建议加入的规则

不要默认加入：

```gitignore
.claude/
.codex/
.agents/
.spec-first/
```

原因：

- 整个 `.claude/` 或 `.codex/` 可能会隐藏团队有意提交的项目设置、hook 或非 spec-first 配置。
- 整个 `.agents/` 可能会隐藏团队自定义 plugins 或 marketplace 配置。
- 整个 `.spec-first/` 会隐藏 `.spec-first/config.local.example.yaml`、`.spec-first/specs/repo-profile.yaml` 和团队选择提交的 confirmed standards source。

默认推荐是忽略 spec-first 可重建 runtime、本地 facts 和 standards 工作区，同时保留明确 source 路径的提交决策空间。
