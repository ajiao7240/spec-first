# 文档与官网一致性审查

审查日期：2026-05-04

审查对象：`README.md`、`README.zh-CN.md`、`docs/`、skill 文档、CLI 输出、发布包文档入口，以及 README 中暴露的官网链接。

## 结论

当前 README 的主叙事基本正确：`spec-first` 被描述为 workflow-first AI coding system，而不是 prompt snippet 集合。中英文 README 都把核心闭环、双宿主、source/runtime、setup/graph/standards/work/review/knowledge 串起来了，见 `README.md:13-17`、`README.zh-CN.md:13-17`。

主要问题不是 README 方向错，而是 **文档层同时承载 current source、active artifacts、historical input 和官网入口，但历史内容、发布包 payload 与 current code 之间仍有几处断点**。

## 文档一致性矩阵

| 文档 | 当前作用 | 一致性问题 | 缺失内容 | 建议 |
|---|---|---|---|---|
| `README.md` | 英文开源入口、Quickstart、workflow 总览 | 文档链接指向 `README.zh-CN.md`、`docs/05-用户手册/*` 和 `docs/assets/readme/spec-first-flow.svg`，但 `package.json:27-39` 的 npm `files` 只包含 `README.md`，不包含这些链接目标 | npm 包页面/安装包内文档完整性说明 | 要么把 README 引用资产纳入发布包，要么把 npm README 链接改成 GitHub absolute links |
| `README.zh-CN.md` | 中文开源入口 | 与英文主叙事基本一致，但同样依赖未发布的 SVG 和 docs 路径 | 双宿主生成差异的更短 first-run 说明 | 与英文同步修 npm payload 或链接策略 |
| `README.md:509-529` | init expected output | 只引导 restart -> mcp-setup -> graph-bootstrap；未衔接 setup ready 后的 standards handoff | setup 完成后 graph ready / pending / degraded 的下一步分支 | 跟随 `skills/spec-mcp-setup/SKILL.md:498-544` 补充 `$spec-standards` / `/spec:standards` 引导 |
| `docs/05-用户手册/04-workflows-artifacts-map.md` | artifacts map | `docs/05-用户手册/04-workflows-artifacts-map.md:280` 说 `.spec-first/workspace/`、`.spec-first/app-audit/`、`.spec-first/workflows/` 默认不进 Git，但 `.gitignore:42-56` 没覆盖 | 每类 `.spec-first` 产物的 commit policy | 对齐 `.gitignore` 与文档，并增加 contract test |
| `docs/README.md` | docs lifecycle index | 已标 `historical-input`，但搜索仍大量命中旧 `src/crg`、`spec-first crg`、`.spec-first/workflows/bootstrap` | 更强的“历史材料不得覆盖 current source”入口提示 | 给历史目录加 banner，或把旧 CRG/ECC 文档迁入 `docs/archive/` |
| `AGENTS.md` / `CLAUDE.md` | 双宿主 checked-in 协作入口 | `AGENTS.md:84`、`CLAUDE.md:84` 仍列出不存在的 `.claude-plugin/plugin.json` | 动态 manifest 真源说明 | 改为 `src/cli/plugin.js`、governance JSON、command templates |
| `docs/10-prompt/结构化项目角色契约.md` | 项目演化基线 | `docs/10-prompt/结构化项目角色契约.md:193` 同样残留 `.claude-plugin/plugin.json` | 已退休 runtime manifest 迁移说明 | 与 AGENTS/CLAUDE 同步修 source truth |
| `skills/spec-graph-bootstrap/SKILL.md` | graph readiness workflow source | 当前 skill 明确禁止依赖 top-level `crg`，见 `skills/spec-graph-bootstrap/SKILL.md:77` | 与旧 docs 的冲突索引 | 在 docs lifecycle 中把旧 CRG 文档列为 superseded |
| `skills/spec-code-review/SKILL.md` | 代码审查 workflow | `/tmp/spec-first/spec-code-review/<run-id>/` artifact 与 repo-local durable artifact 主叙事存在张力，见 `skills/spec-code-review/SKILL.md:54-72`、`:810-827` | durable summary 与 tmp run artifact 的边界 | 增 repo-local review summary 或明确 tmp-only 是 session handoff |
| `docs/contracts/workflows/spec-work-run-artifact.schema.json` | spec-work run artifact schema | schema 已存在，但测试样例承认 runtime 未真正写 `run.json`，见 `tests/unit/spec-work-run-artifact-contract.test.js:59-62` | producer implementation 或 explicit beta 标注 | 落地写盘，或把 schema 标为 planned/experimental |
| 官网 `spec-first.cn` | README badge 与外部入口 | 仓库内未发现官网源码；本轮不能以代码事实审查官网内容，只能确认 README 链接存在，见 `README.md:9`、`:19` | 官网与 README/CLI 的同步机制 | 建立网站内容源路径或发布前对照 checklist |

## 旧架构术语污染

`docs/README.md:5-14` 已定义 lifecycle 状态，`docs/README.md:29-48` 也把旧目录标为 historical/reference。但 current repo 搜索仍有大量历史命中：

- `docs/validation/2026-04-26-spec-first-engineering-deep-audit-report.md` 仍描述 `src/crg/`、`spec-first crg build`。
- `docs/spec-graph-bootstrap-flow.md:529` 仍出现 `spec-first crg build` 提示。
- `docs/assets/svg/spec-first-runtime-assets.svg:72` 仍画出 `.claude-plugin/plugin.json`。
- `docs/08-版本更新/README.md` 含大量历史 `src/crg` 和 `.claude-plugin/plugin.json` 记录。

这些内容可以作为历史演进记录保留，但不能继续出现在未加 banner 的当前导航路径中。否则新维护者会把 retired internal CRG 或 retired plugin manifest 当成当前 source truth。

## 官网审查盲区

README 暴露官网入口 `spec-first.cn`，见 `README.md:9`、`:19`。当前仓库没有明显的 website source、static export 或 deployment config，本轮不能判断官网是否与当前 CLI、README 和 workflow 数量一致。

这不是 P0，但对开源项目是 P2 风险：用户可能从官网形成预期，再进入 GitHub/npm 时遇到不同命令、不同概念或不同产物路径。建议把官网源码纳入 repo，或至少维护一份 `docs/contracts/website-content-checklist.md`，发布前核对：

- workflow 入口数量
- Claude/Codex 命名
- Quickstart 命令
- `.spec-first` 产物边界
- graph provider degraded mode
- 当前版本号与 changelog

## 缺失文档

| 缺口 | 影响 | 建议 |
|---|---|---|
| First-run next-step decision tree | 用户完成 `init`/`mcp-setup` 后不知道何时跑 `graph-bootstrap`、何时跑 `standards`、何时重启 | 在 README、用户手册快速开始、`init` 输出中统一三态引导 |
| Public/internal skill catalog | 42 skills 与 51 agents 对新用户过载；README 只展示主链路 | 增一页“公开 workflow / standalone / internal helper / beta” catalog |
| Durable vs runtime artifact policy | `.spec-first`、`docs/*`、`/tmp` 三类产物边界需要反复推断 | 在用户手册增加一张 commit policy 表，并由 `.gitignore` contract test 锁住 |
| Website sync policy | 官网不是本轮代码事实源 | 增发布前 docs/website sync checklist |
| Cost guidance | 多 reviewer、多 agent workflow token 成本不透明 | 在重 workflow 文档中写默认成本、降级入口和 low-cost path |

## 文档修复原则

1. 先修 source truth 冲突，再修 prose polish。
2. 当前代码事实优先于历史方案，历史文档必须显式标注边界。
3. README 只承诺已实现能力，不把 planned schema 写成可用 runtime。
4. 对外文档必须区分 CLI 命令、Claude command、Codex skill。
5. npm 包内 README 的相对链接必须可达，或改成 GitHub absolute URL。
