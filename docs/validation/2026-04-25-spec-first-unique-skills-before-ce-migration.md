# spec-first 独有 skills 迁移前记录

日期：2026-04-25

## 背景

本记录用于 `compound-engineering-plugin` skills 向当前 `spec-first` 项目迁移前的边界确认。

迁移原则：

- `compound-engineering-plugin/plugins/compound-engineering/skills` 中存在语义对应项的 skill，后续按当前项目命名覆盖更新。
- 当前项目独有、CE 中没有语义对应项的 skill，默认保留，不在覆盖批次中删除。
- 是否后续重命名、合并或退役，必须单独决策，不能作为 CE 同步的副作用处理。

## 当前项目独有 skills

以下 17 个目录存在于 `skills/`，但未在 CE skills 中找到明确语义对应项：

| 当前 skill | 迁移决策 | 说明 |
|---|---|---|
| `agent-browser` | 保留 | 当前项目独有的浏览器自动化能力入口。 |
| `andrew-kane-gem-writer` | 删除 | Ruby gem 写作专用 skill，CE 当前无对应项；按 2026-04-25 迁移收口决策移除。 |
| `changelog` | 保留 | 当前项目 changelog 生成/维护入口，CE 当前无对应项。 |
| `claude-permissions-optimizer` | 删除 | Claude Code 权限优化工具，CE 当前无对应项；按 2026-04-25 迁移收口决策移除。 |
| `deploy-docs` | 删除 | GitHub Pages 文档部署辅助入口，CE 当前无对应项；按 2026-04-25 迁移收口决策移除。 |
| `dspy-ruby` | 删除 | DSPy.rb 专用开发 skill，CE 当前无对应项；按 2026-04-25 迁移收口决策移除。 |
| `every-style-editor` | 删除 | Every 风格审校入口，CE 当前无对应项；按 2026-04-25 迁移收口决策移除。 |
| `onboarding` | 删除 | 生成项目 onboarding 文档入口，CE 当前无对应项；按 2026-04-25 迁移收口决策移除。 |
| `orchestrating-swarms` | 删除 | 当前项目已有的 swarm 编排参考 skill，CE 当前无对应项；按 2026-04-25 迁移收口决策移除。 |
| `rclone` | 删除 | rclone 云存储上传/同步入口，CE 当前无对应项；按 2026-04-25 迁移收口决策移除。 |
| `reproduce-bug` | 删除 | issue grounded bug reproduction 入口，CE 当前无直接对应项；按 2026-04-25 迁移收口决策移除。 |
| `spec-graph-bootstrap` | 保留 | spec-first 项目核心 Stage-0 / CRG bootstrap 能力，CE 当前无对应项。 |
| `spec-mcp-setup` | 保留 | 当前项目 MCP setup 合并后的真源入口，CE 的 `ce-setup` 不直接覆盖它。 |
| `todo-create` | 删除 | 当前项目文件化 todo 系统入口，CE 当前无对应项；按 2026-04-25 迁移收口决策移除。 |
| `todo-resolve` | 删除 | 当前项目文件化 todo 批处理入口，CE 当前无对应项；按 2026-04-25 迁移收口决策移除。 |
| `todo-triage` | 删除 | 当前项目文件化 todo triage 入口，CE 当前无对应项；按 2026-04-25 迁移收口决策移除。 |
| `using-spec-first` | 保留 | 当前项目 workflow 入口治理真源，CE 当前无对应项。 |

## 非覆盖注意事项

- `spec-mcp-setup` 不应被 CE 的 `ce-setup` 直接覆盖；两者职责不同。若要吸收 `ce-setup` 内容，应作为专项合并评估。
- `spec-graph-bootstrap` 是当前项目核心能力，不参与 CE 常规 skill 覆盖。
- `todo-*` 已有当前项目专属路径与 legacy 读语义，不能被 CE 迁移隐式删除。
- `agent-browser` 被多个当前项目 skill 依赖，迁移时需要保留其 reference 与 runtime 可见性。

## 后续使用方式

后续 skills 迁移时，以此清单作为保留边界：

1. CE 同名或语义对应 skill 覆盖当前目标目录。
2. 本清单中的 skill 不参与覆盖删除。
3. 若某个独有 skill 需要和 CE 新增 skill 合并，另建专项决策记录，并更新本文件。
