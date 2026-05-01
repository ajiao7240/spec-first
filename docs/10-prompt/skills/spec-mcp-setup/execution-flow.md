# spec-mcp-setup Execution Flow Mirror

> 镜像用途：帮助审查 `$spec-mcp-setup` / `/spec:mcp-setup` 的脚本链路、LLM 判断边界和本地产物写入路径。源码真相源仍是 `skills/spec-mcp-setup/`，本文件不替代 `SKILL.md`、`mcp-tools.json` 或脚本 contract。

## 核心结论

`spec-mcp-setup` 是 spec-first 的 Required Harness Runtime 安装入口，但它不是 graph bootstrap。它只做确定性环境准备、host MCP 配置、helper readiness、Serena project bootstrap、readiness ledger v2 写入，以及 graph provider config projection。

Graph readiness 编译由 `$spec-graph-bootstrap` 负责。`spec-mcp-setup` 不应运行 `gitnexus analyze/query/status` 或 `code-review-graph build/status`。这条边界保持了 Light contract：setup 脚本准备事实，LLM 基于事实判断下一步，graph bootstrap 再编译代码图谱事实。

## Source Map

```text
skills/spec-mcp-setup/
  |
  +-- SKILL.md                         # workflow 行为契约
  +-- mcp-tools.json                   # MCP / graph provider 唯一机器注册表
  +-- scripts/check-health             # project preflight / local setup facts
  +-- scripts/check-deps.sh            # 基础依赖检查
  +-- scripts/install-helpers.sh       # helper tooling 安装/verify
  +-- scripts/install-mcp.sh           # MCP/provider warmup + host config + Serena
  +-- scripts/detect-tools.sh          # tool-facts.v2 探测
  +-- scripts/verify-tools.sh          # readiness ledger v2 写入
  +-- scripts/write-provider-config.sh # .spec-first/config/* projection
  +-- scripts/resolve-project-target.sh# repo target 解析
  +-- scripts/configure-host.sh        # Claude/Codex host MCP 写入
  +-- scripts/repair-install.sh        # configure 失败后的修复路径
  +-- scripts/activate-serena.sh       # Serena project bootstrap / verify
```

## Top Level Flow

```text
+-----------------------------+
| user invokes mcp setup      |
| $spec-mcp-setup             |
| /spec:mcp-setup             |
+-------------+---------------+
              |
              v
+-----------------------------+
| LLM orchestration           |
| - read project evidence     |
| - choose Serena languages   |
| - decide local setup action |
+-------------+---------------+
              |
              v
+-----------------------------+
| check-health                |
| project preflight facts     |
+-------------+---------------+
              |
              v
+-----------------------------+
| check-deps                  |
| node/npm/npx/uv/uvx/jq/...  |
+-------------+---------------+
              |
              v
+-----------------------------+
| install-helpers             |
| agent-browser, gh, jq, ...  |
+-------------+---------------+
              |
              v
+-----------------------------+
| install-mcp                 |
| warmup + host config +      |
| Serena project bootstrap    |
+-------------+---------------+
              |
              v
+-----------------------------+
| verify-tools                |
| detect facts + helper facts |
| compute baseline_ready      |
+-------------+---------------+
              |
              v
+-----------------------------+
| write-provider-config       |
| .spec-first/config/*.json   |
+-------------+---------------+
              |
              v
+-----------------------------+
| final status block          |
| restart/new session, then   |
| run spec-graph-bootstrap    |
+-----------------------------+
```

## Two Layer Model

```text
+---------------------------------------------------------------+
| Layer A: Project Preflight / Local Setup                      |
+---------------------------------------------------------------+
| check-health                                                  |
|   - helper tool visibility                                    |
|   - .spec-first/config.local.yaml                             |
|   - .spec-first/config.local.example.yaml                     |
|   - .spec-first/*.local.yaml gitignore coverage               |
|   - legacy compound-engineering residue                       |
|                                                               |
| bootstrap-project-config                                      |
|   - runs automatically for required bounded local setup writes |
|   - may refresh example, create local config, ensure gitignore |
|   - does not determine baseline_ready                         |
+---------------------------------------------------------------+
                              |
                              v
+---------------------------------------------------------------+
| Layer B: Required Harness Runtime                             |
+---------------------------------------------------------------+
| check-deps + install-helpers + install-mcp + verify-tools     |
|   - required MCP host servers                                 |
|   - required graph providers                                  |
|   - helper_tools readiness                                    |
|   - host readiness ledger v2                                  |
|   - graph provider projection                                 |
|                                                               |
| This layer determines baseline_ready.                         |
+---------------------------------------------------------------+
```

## Tool Registry Decision Flow

`mcp-tools.json` 是 MCP 与 graph provider 的唯一机器注册表。每个 tool 都必须 `required=true`，并声明 `category`。MCP tool 必须写 host config；graph provider 是否写 host config 由 `host_config_required` 决定。

```text
for each tool in mcp-tools.json
  |
  v
+------------------------------+
| required == true ?           |
+------+-----------------------+
       |
       v
+------------------------------+
| dependencies ready ?         |
+------+------------+----------+
       | yes        | no
       v            v
+--------------+  +------------------+
| warmup cmd   |  | action-required  |
| succeeds ?   |  | missing_dependency|
+------+-------+  +------------------+
       |
       v
+------------------------------+
| host_config_required ?       |
+------+-----------------------+
       | true
       v
+------------------------------+
| configure-host               |
| - write Claude/Codex config  |
| - exact command/args         |
+------+-----------------------+
       |
       | failure
       v
+------------------------------+
| repair-install               |
| - retry known repair path    |
+------------------------------+

host_config_required == false
  |
  v
+------------------------------+
| host-config-skipped          |
| dependency ready still counts|
| host status = not-required   |
+------------------------------+
```

Current registry intent:

```text
MCP tools
  serena              host_config_required=true
  sequential-thinking host_config_required=true
  context7            host_config_required=true

Graph providers
  gitnexus            host_config_required=true
                      access mode: live MCP + provider projection

  code-review-graph   host_config_required=false
                      access mode: cli_artifact
                      live MCP: optional explicit enhancement only
```

## code-review-graph Boundary

`code-review-graph` 是 required graph provider，但默认不是 host MCP server。setup 只 warm up `uvx code-review-graph` 并写入 provider command projection；实际 graph 编译由 graph-bootstrap 执行。

```text
+------------------------------+
| spec-mcp-setup               |
+------------------------------+
| uvx code-review-graph --help |
| host_config_status:          |
|   not-required               |
| .spec-first/config projection|
+--------------+---------------+
               |
               v
+------------------------------+
| spec-graph-bootstrap         |
+------------------------------+
| uvx code-review-graph build  |
| uvx code-review-graph status |
| uvx code-review-graph status |
|   --repo <repo_root>         |
| .spec-first/graph/*          |
| .spec-first/impact/*         |
+------------------------------+

Optional live MCP path:
  user explicitly opts in
    -> configure host with code-review-graph serve
    -> host performs MCP initialize handshake on startup

Default path:
  no host MCP registration
    -> no startup handshake risk
    -> graph facts still available through CLI artifacts
```

## Target Resolution And Write Boundaries

Repo-local writers must pass through `resolve-project-target.*`. This prevents parent workspaces from being treated as writable project repos when they merely contain child Git repos.

```text
+-------------------------------+
| invocation cwd                |
+---------------+---------------+
                |
                v
+-------------------------------+
| resolve-project-target        |
+---------------+---------------+
                |
     +----------+----------+
     |                     |
     v                     v
+-----------+       +----------------------+
| git repo  |       | parent workspace     |
| selected  |       | with child repos      |
+-----+-----+       +----------+-----------+
      |                        |
      v                        v
+-----------+       +----------------------+
| state     |       | state_write_allowed  |
| writes ok |       | false                |
+-----------+       | next_action: choose  |
                    | --repo <child>       |
                    +----------------------+
```

Allowed repo-local setup writes:

```text
.spec-first/config/graph-providers.json
.spec-first/config/runtime-capabilities.json
.spec-first/config/provider-artifacts.json
.serena/*
```

Not allowed from unresolved parent workspace:

```text
.spec-first/config/*
.spec-first/graph/*
.spec-first/impact/*
.spec-first/*.local.yaml
.serena/*
```

## Serena Language Boundary

Serena language selection is semantic and belongs to the LLM. Scripts must not infer or ask interactively.

```text
+-------------------------------+
| install-mcp reaches serena    |
+---------------+---------------+
                |
                v
+-------------------------------+
| target write allowed ?        |
+------+------------------------+
       | yes
       v
+-------------------------------+
| language facts available ?    |
+------+----------------+-------+
       | yes            | no
       v                v
+--------------+   +----------------------+
| activate     |   | fail fast            |
| serena       |   | reason_code:         |
| --language   |   | serena_language_     |
| ...          |   | required             |
+------+-------+   +----------+-----------+
       |                      |
       v                      v
+--------------+   +----------------------+
| ready marker |   | LLM inspects repo    |
| verified     |   | evidence and retries |
+--------------+   +----------------------+
```

Important rule:

```text
LLM chooses supported Serena language labels from project evidence.
Scripts execute the selected labels.
Scripts do not enter Serena interactive language selection.
```

## Readiness Ledger Flow

`verify-tools.*` is the readiness compiler for setup. It does not install graph facts; it merges tool facts and helper facts, computes `baseline_ready`, writes the host marker, then delegates repo-local graph provider projection to `write-provider-config.*`.

```text
+-----------------------------+
| detect-tools                |
| output: tools + providers   |
+--------------+--------------+
               |
               v
+-----------------------------+
| install-helpers --verify-only|
| output: helper_tools facts  |
+--------------+--------------+
               |
               v
+-----------------------------+
| verify-tools                |
| - host_ready                |
| - tool_ready                |
| - helper_ready              |
| - baseline_ready            |
+--------------+--------------+
               |
               v
+-----------------------------+
| write host readiness ledger |
| ~/.codex/spec-first/...     |
| or host-specific marker     |
+--------------+--------------+
               |
               v
+-----------------------------+
| write-provider-config       |
| project-local config facts  |
+-----------------------------+
```

`baseline_ready` is true only when required tools and required helper tooling are ready:

```text
tool_ready =
  dependency_status == ready
  and host_ready
  and project_status in [ready, not-applicable, workspace-target-required]

host_ready =
  host_config_status == ready
  or host_config_status == fallback-active
  or (host_config_required == false and host_config_status == not-required)

baseline_ready =
  all(tool_ready) and all(helper_tools.result == ready)
```

## Artifacts

```text
Host-local readiness
  ~/.codex/spec-first/host-setup.json
  Claude equivalent marker path from detect-host

Project-local setup projection
  .spec-first/config/graph-providers.json
  .spec-first/config/runtime-capabilities.json
  .spec-first/config/provider-artifacts.json

Graph-bootstrap owned artifacts
  .spec-first/graph/graph-facts.json
  .spec-first/graph/provider-status.json
  .spec-first/impact/bootstrap-impact-capabilities.json
  .spec-first/providers/*/status.json
```

Artifact ownership:

```text
spec-mcp-setup
  owns host readiness ledger
  owns .spec-first/config/*
  does not own .spec-first/graph/*
  does not own .spec-first/impact/*

spec-graph-bootstrap
  consumes .spec-first/config/*
  owns graph and impact readiness artifacts
```

## Failure And Next Action Map

```text
missing dependency
  -> install the missing executable, rerun setup

warmup failed
  -> check package manager, network, package spec

host configure failed
  -> repair-install attempts known repair path
  -> if still failed, inspect host CLI and config permissions

workspace target unresolved
  -> choose a child Git repo and rerun with --repo <child>

serena_language_required
  -> LLM reads project evidence
  -> rerun install-mcp with --serena-language

baseline_ready == true and graph_bootstrap_required == true
  -> run spec-graph-bootstrap
  -> restart/new host session before relying on newly written MCP config

code-review-graph host status == not-required
  -> expected default
  -> do not add host MCP server unless user explicitly asks for live CRG MCP
```

## Boundary Checklist

```text
[x] mcp-tools.json is the single MCP/provider machine registry
[x] setup writes only required host MCP servers by default
[x] code-review-graph default path is cli_artifact, not live MCP
[x] setup does not run graph provider bootstrap/query commands
[x] graph-bootstrap owns graph readiness compilation
[x] scripts output deterministic facts and reason_code
[x] LLM decides semantic language selection and next action
[x] generated runtime assets are not source of truth
```
