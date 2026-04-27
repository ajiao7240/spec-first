> 状态说明：本文是 CRG 删除前后的探索性设计记录，不代表当前 runtime contract。
> 当前实现已移除内置 CRG 与 graph-bootstrap workflow。
> 如需恢复图谱能力，请另见后续 external graph provider 集成方案。

你是 spec-first 项目的核心维护者。请基于当前 master 分支重构 skills/spec-mcp-setup，使它从可选 MCP 安装器升级为 Required Harness Runtime Setup。

重要约束：
- 不考虑向下兼容。
- 但当前新工作流必须完整可运行。
- 所有源码改动必须同步更新 CHANGELOG.md。
- 不要只删除测试文件，必须同步更新 package.json 测试入口。

目标：
1. 删除 Playwright MCP。
2. 删除 optional tools、quick/custom mode、optional-pending。
3. mcp-tools.json schema 升级为 4。
4. mcp-tools.json 只保留 serena、sequential-thinking、context7、gitnexus、code-review-graph。
5. 所有 mcp-tools.json tools 都 required=true。
6. 所有 tools 增加 category 字段：mcp 或 graph-provider。
7. agent-browser 不进入 mcp-tools.json。
8. agent-browser 作为 required helper，由 install-helpers.sh / install-helpers.ps1 管理。
9. install-helpers 默认模式必须：
   - 缺失时安装 agent-browser CLI
   - 运行 agent-browser install
   - 安装 global agent-browser skill
10. install-helpers --verify-only 必须只检测，不写入，不安装。
11. install-helpers 输出 shape 必须是：
    {
      "helper_tools": {
        "agent-browser": {}
      }
    }
12. check-deps Unix required dependencies 包含：
    node, npm, npx, uv, uvx, jq, python3。
13. serena 和 code-review-graph dependencies 必须包含 uv 和 uvx。
14. 新增 GitNexus graph provider：
    - warmup: npx -y gitnexus@latest --help
    - MCP: npx -y gitnexus@latest mcp
    - role: global_knowledge
15. 新增 code-review-graph graph provider：
    - warmup: uvx code-review-graph --help
    - MCP: uvx code-review-graph serve --tools get_minimal_context_tool,get_impact_radius_tool,get_review_context_tool,query_graph_tool,detect_changes_tool,list_graph_stats_tool
    - role: impact_context
16. spec-mcp-setup 不得运行 gitnexus analyze。
17. spec-mcp-setup 不得运行 code-review-graph build。
18. detect-tools.* 删除顶层 crg 字段。
19. detect-tools.* 不输出 baseline_ready，只输出 tool facts。
20. verify-tools.* 合并 detect-tools facts 和 install-helpers --verify-only facts。
21. verify-tools.* 统一计算 baseline_ready。
22. verify-tools.* 输出 readiness ledger schema_version=v2。
23. baseline_ready 必须包含 MCP tools、graph providers、agent-browser。
24. graph provider 在 setup 后只能 configured=true、enabled_for_bootstrap=true、query_ready=false。
25. 新增 write-provider-config.sh / write-provider-config.ps1。
26. write-provider-config 只在 git repo 内生成 .spec-first/config/graph-providers.json。
27. .spec-first/config/graph-providers.json 不是第二个 registry，只是 provider selection projection。
28. configure-host.* 必须支持 Codex TOML quoted table key：
    [mcp_servers."code-review-graph"]
29. configure-host.* 写入前必须删除 quoted 和 unquoted 两种旧 section。
30. detect-tools.* 和 uninstall-mcp.* 必须复用同一 TOML key formatter/parser。
31. uninstall-mcp.* 必须能删除 gitnexus 和 code-review-graph。
32. uninstall 后必须刷新 readiness ledger 和 provider config。
33. spec-graph-bootstrap 必须同步改造：
    - 读取 ledger v2
    - 读取 .spec-first/config/graph-providers.json
    - 不再读取顶层 crg
    - graph-bootstrap 自己负责 gitnexus analyze
    - graph-bootstrap 自己负责 code-review-graph build
    - bootstrap 成功后更新 query_ready=true
34. 更新 SKILL.md、supported-mcp-tools.md、README.md、README.zh-CN.md、templates、docs/10-prompt 镜像。
35. 更新 package.json test scripts。
36. 删除或重写旧 quick/custom、optional、Playwright、crg v1 测试。
37. 补齐新测试：
    - mcp-tools schema v4
    - helper install / verify-only
    - dependency detection
    - Codex TOML quoted key
    - detect-tools facts v2
    - ledger v2
    - graph-providers.json
    - graph-bootstrap ledger v2 consumer
    - required runtime integration
