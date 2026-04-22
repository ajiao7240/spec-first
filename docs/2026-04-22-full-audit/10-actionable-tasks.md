# 可执行任务清单

| 优先级 | 分类 | 任务 | 依据 | Done signal |
| --- | --- | --- | --- | --- |
| P0 | `应重构` | 重写 `项目治理-agent.md` 定位为草案/操作手册 | 文档未跟踪且无配套 checker | 文档前言明确状态与用途 |
| P0 | `应强化` | 在文档增加治理真源前提 | 当前文档被误读风险高 | 明确写出“未提交文档不得作真源” |
| P0 | `应强化` | 在文档增加 dual-host governance checklist | setup/MCP/命名/mirror drift 已发生 | 检查项写入文档 |
| P0 | `应强化` | 区分 `推断性验证` 与 `真实 probe 验证` | doctor `verified` 仍属推断 | 文档术语更新 |
| P1 | `应强化` | 修复 `setup` Codex 入口 | 当前写成 `$setup` | 全部改为 `$spec-setup` |
| P1 | `应强化` | 修复 `using-spec-first` 对 MCP setup 的路由 | 错把 MCP setup 路由到 setup | route 与 contract 对齐 |
| P1 | `应重构` | 处理 `artifact-manifest.json` 双语义 | repo/workspace 双 contract | 同名双语义消失 |
| P1 | `应重构` | 停止 sample 发布 ownership/review-queue 或接入真实 derivation | 伪事实发布 | runtime 只发真实事实 |
| P1 | `应强化` | 修复 11 个 skill 命名漂移 | 目录/contract/frontmatter 不一致 | 三者一致 |
| P1 | `应强化` | 修复 docs mirror drift | source 与 mirror 内容不一致 | mirror 同步恢复 |
| P1 | `应强化` | 为 agent 补 reachability contract | 23 个 agent 缺直接证据 | 能回答 agent 由谁触达 |
| P1 | `应重构` | 收回 `review-context` 的决策拼装 | review-context 越界 | 只保留事实层输出 |
| P1 | `应删除` | 删除 `init --force` ghost surface | 参数未实际消费 | 代码与帮助面统一 |
| P1 | `应重构` | 处理 `skills.js/agents.js` 假接口 | 与 adapter-aware 控制面脱节 | host-aware 或移除 |
| P1 | `应强化` | 接线 `tests/contracts` | 当前不进入默认测试脚本 | `npm test` 覆盖到 |
| P1 | `应强化` | 为 destructive rollback 增加故障注入测试 | 机制存在但未被关键方式证明 | 有失败中途回滚测试 |
| P1 | `应强化` | 收紧 release tarball 白名单 | 未知 tree-sitter 只 warning | 未知依赖 fail-fast |
| P2 | `应实验化` | 增加可选 runnable probe | 当前 doctor 仍推断 | 可选 probe 存在 |
| P2 | `应实验化` | 试点结构化 prompt metadata 守卫 | 当前 prompt prose anchor 偏重 | 仅少数 workflow 试点 |
| P2 | `应轻量化` | 整理 integration/e2e 命名 | 层次命名漂移 | package script 与目录一致 |
| P2 | `应实验化` | 为 full-audit 提供半自动 workflow 入口 | 当前无对应 workflow | 只用于高价值场景 |
