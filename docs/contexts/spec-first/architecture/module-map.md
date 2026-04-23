# 模块结构图

> 来源: fact-inventory.modules + crg communities  
> 分析模式: Full (CRG local-available)

## 模块层次

```
spec-first/
├── bin/                    # CLI 可执行入口（3 文件）
│   ├── spec-first.js       # 包级 CLI 入口，延迟加载 crg 子命令
│   └── postinstall.js      # 安装后处理：native module probe/repair
│
├── src/
│   ├── cli/                # CLI 控制面（community: cli, 20 文件）
│   │   ├── index.js        # runCli：主命令分发（flow criticality=0.712）
│   │   ├── commands/       # doctor / init / clean / stage0-context
│   │   ├── adapters/       # ClaudeAdapter / CodexAdapter（双宿主差异）
│   │   ├── plugin.js       # 插件清单加载（1116 LOC）
│   │   └── state.js        # 运行时状态管理（626 LOC）
│   │
│   ├── crg/                # CRG 图引擎（community: crg, 45 文件）
│   │   ├── parser.js       # tree-sitter AST 解析器（1910 LOC，17 语言）
│   │   ├── analyze.js      # 图分析：社区检测 + 流分析
│   │   ├── changes.js      # git diff 变更检测（485 LOC）
│   │   ├── search.js       # FTS5 全文检索
│   │   ├── cli/            # CRG 子命令（build/postprocess/context/query）
│   │   │   ├── build.js    # crg build 主流程（636 LOC）
│   │   │   ├── envelope.js # makeEnvelope：CRG 输出格式化 hub（in_degree=19）
│   │   │   └── open-db.js  # openDb：SQLite 访问 hub（in_degree=14）
│   │   ├── commands/       # detect-changes / review-context / architecture 等
│   │   └── migrations.js   # SQLite schema 迁移管理
│   │
│   ├── bootstrap-compiler/ # Stage-0 编译流水线（community: bootstrap-compiler, 21 文件）
│   │   ├── compile-machine-artifacts.js  # 主编排入口（flow criticality=0.728）
│   │   ├── derive-bootstrap-facts.js     # 事实提取核心（700 LOC）
│   │   ├── compile-routing.js            # routing / injection-index / manifest（595 LOC）
│   │   ├── compile-minimal-context.js    # minimal-context 编译
│   │   ├── compile-verification-profile.js  # verification profile
│   │   ├── schema-loader.js              # JSON Schema 加载与验证
│   │   └── run-bootstrap.js             # bootstrap 执行调度（609 LOC）
│   │
│   └── context-routing/    # Stage-0 路由引擎（community: context-routing, 16 文件）
│       ├── entry-resolver.js  # 工作区/单仓库 entry 解析，normalizeAbsolutePath hub（in_degree=10）
│       ├── profiles.js        # normalizeStage hub（in_degree=15）
│       ├── evaluator.js       # buildOutputExistsMap：injection-index 条件求值
│       ├── verification-summary.js  # 运行时 verification bundle（520 LOC）
│       └── verification-gate-state.js  # gate 状态机
│
├── skills/                 # Workflow/skill 源码真相源（community: skills, 12 文件）
├── agents/                 # Agent profile 源码（community: agents, 3 文件）
└── templates/              # 宿主运行时模板（SessionStart hook 等）
```

## 模块间关键依赖

```
runCli (cli/index.js)
  └─► init / doctor / clean (cli/commands/)
        └─► ClaudeAdapter / CodexAdapter (cli/adapters/)

compileMachineArtifacts (bootstrap-compiler/)
  ├─► deriveBootstrapInputs
  ├─► buildArtifactManifest
  ├─► buildVerificationProfile
  └─► compileMinimalContexts

crg build (crg/cli/build.js)
  ├─► parser.js → analyzeGraph → openDb (sqlite)
  └─► postprocess → initDatabase (migrations.js)

review-context (crg/commands/)
  ├─► detectChanges (crg/changes.js)
  ├─► openDb (crg/cli/open-db.js)
  └─► summarizeChangeSurface (context-routing/change-surface.js)
```

## JSON Schema 契约层（data_shapes）

`src/bootstrap-compiler/schema-loader.js` 加载以下 JSON Schema：
- `artifact-manifest.schema.json`
- `fact-inventory.schema.json`
- `risk-signals.schema.json`
- `test-surface.schema.json`
- `database-routing.schema.json`
- `context-routing.schema.json`
- `freshness.schema.json`
- `minimal-context.schema.json`
- `verification-profile.schema.json`
