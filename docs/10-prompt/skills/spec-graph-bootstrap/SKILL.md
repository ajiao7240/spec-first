# spec-graph-bootstrap Prompt Mirror

> 镜像用途：记录 external graph provider bootstrap 的当前架构语义。源码真相源仍是 `skills/spec-graph-bootstrap/SKILL.md`。

`spec-graph-bootstrap` 在 `spec-mcp-setup` 之后运行，负责真正构建项目图谱。

它读取：

- host readiness ledger v2
- `.spec-first/config/graph-providers.json`

它运行：

- `npx -y gitnexus@latest analyze`
- `uvx code-review-graph build`

它成功后更新 provider projection：

```json
{
  "query_ready": true,
  "bootstrap_required": false
}
```

边界：

- 不读取顶层 `crg`。
- 不依赖 retired internal CRG runtime。
- 不把 provider projection 当成第二个 registry。
- scripts 负责 deterministic build 和 readiness 写入；LLM 负责判断下游 workflow 是否需要消费图谱证据。
