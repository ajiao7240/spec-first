# CE 独有 skills 集成记录

日期：2026-04-25

## 迁移原则

- 以 CE skill 目录为基线迁移。
- 当前项目独有 17 个 skill 不删除、不覆盖。
- CE 独有 skill 统一改为 spec-first 命名。
- `scripts/`、`references/` 随 skill 目录一起迁移。
- 迁移后只做必要的 spec-first 适配：名称、GitHub 仓库、badge、`.spec-first/config.local.yaml` 路径、legacy CE 检测边界。

## 已集成 7 个 CE 独有 skills

| CE 源目录 | 当前目录 | 说明 |
| --- | --- | --- |
| `ce-dhh-rails-style` | `spec-dhh-rails-style` | DHH / 37signals Rails 风格指导 |
| `ce-polish-beta` | `spec-polish-beta` | 浏览器驱动的功能 polish beta workflow |
| `ce-pr-description` | `spec-pr-description` | value-first PR description 生成 |
| `ce-release-notes` | `spec-release-notes` | spec-first GitHub releases 摘要 |
| `ce-session-extract` | `spec-session-extract` | session 文件 skeleton / error 提取 primitive |
| `ce-session-inventory` | `spec-session-inventory` | Claude / Codex / Cursor session inventory primitive |
| `ce-setup` | `spec-setup` | spec-first helper tools 与本地配置诊断 |

## 适配记录

- `spec-release-notes` 的 release 数据源改为 `sunrain520/spec-first`，helper 脚本改名为 `scripts/list-spec-releases.py`。
- `spec-setup` 的新配置路径使用 `.spec-first/config.local.yaml` 与 `.spec-first/config.local.example.yaml`。
- `spec-setup` 只把 `compound-engineering.local.md` 与 `.compound-engineering/config.local.yaml` 作为 legacy residue 检测，不作为新写入路径。
- 新增 7 个 skill 已加入 `src/cli/contracts/dual-host-governance/skills-governance.json`，Claude 与 Codex 均按 standalone skill 交付。
- 新增 7 个 skill 已同步到 `docs/10-prompt/skills/` mirror。
