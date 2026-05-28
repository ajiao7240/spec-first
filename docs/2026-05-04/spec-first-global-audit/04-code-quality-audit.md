# 代码质量、CLI 与安装体验审查

## 结论

CLI 架构克制、双宿主 adapter 分层清楚、外部命令 timeout 已补齐，当前主要代码质量风险集中在：文档/代码边界漂移、产物 ignore 漏洞、部分 contract 未实现成 runtime 行为、以及 package README/asset 发布体验。

## 代码质量问题矩阵

| 文件/模块 | 问题 | 影响 | 风险等级 | 修复建议 |
|---|---|---|---|---|
| `AGENTS.md` / `CLAUDE.md` / `docs/10-prompt/结构化项目角色契约.md` | 列出不存在的 `.claude-plugin/plugin.json` 为 source-of-truth | 误导维护者重建退休 manifest，破坏动态 governance | P1 | 改为 `src/cli/plugin.js`、`src/cli/contracts/dual-host-governance/skills-governance.json`、`templates/claude/commands/spec/*.md` |
| `.gitignore` | 缺 `.spec-first/app-audit/`、`.spec-first/workspace/`、`.spec-first/workflows/` | runtime/control-plane artifacts 可能被提交 | P1 | 更新 `.gitignore`，补 user manual contract test |
| `src/cli/commands/init.js` | `printInitNextSteps()` 只引导 restart -> mcp-setup -> graph-bootstrap if pending，未包含 `standards` | first-run durable setup handoff 不完整 | P1 | 引入 graph ready 后 standards 推荐；同步 README expected output 和 tests |
| `docs/contracts/workflows/spec-work-run-artifact.schema.json` + `skills/spec-work/SKILL.md` | 有 run artifact schema，但 runtime 未写盘；测试样例明确 residual risk | 执行闭环缺 machine-readable resume/review handoff | P1 | 实现 `.spec-first/workflows/spec-work/<run-id>/run.json` 或降级为 future contract |
| `skills/spec-code-review/SKILL.md` | run artifact 写 `/tmp/spec-first/spec-code-review/<run-id>/` | 不利于团队长期 review 留痕，与 repo-local artifact 主叙事冲突 | P1/P2 | headless/autofix 写 repo-local summary，full detail 可保留 tmp |
| `skills/spec-app-consistency-audit/` | 有大量 spine scripts/schemas/prompts，但无单一 top-level `run-audit.js` orchestrator | headless 实操需要 LLM 串联多个脚本，用户落地成本高 | P2 | 增 `scripts/run-audit.js` 或最小 shell recipe，跑端到端 fixture |
| `package.json:27-39` | npm package 只包含 `README.md`，但 README 链接 `README.zh-CN.md`、`docs/05-用户手册`、`docs/assets/readme/spec-first-flow.svg` | npm README 相对链接和图片在包内容中不完整 | P2 | 包含 README.zh-CN、docs/assets/readme、用户手册入口，或改为 GitHub absolute links |
| `docs/README.md` / historical docs | historical-input 已标注，但旧 `src/crg`/`.context`/`.claude-plugin` 搜索噪音仍大 | 维护者容易误读 current architecture | P2 | 加 stronger archive banner 或移入 `docs/archive/` |
| `src/contracts/schema-validator.js` | lightweight validator 只覆盖关键 JSON Schema 子集 | 若未来 schema 依赖未支持关键字，可能误判 | P2 | 保持“lightweight validator”命名并列出支持关键字，或接入 Ajv |
| `skills/spec-ideate/SKILL.md` | baseline 8-9 agents，scratch 在 `/tmp` | token/时间成本较高，产物路径不完全进入 artifact catalog | P2 | 在 README 与 artifact catalog 中明确成本和输出 |
| `skills/spec-compound-refresh/SKILL.md` | autofix 可更新、合并、删除 docs/solutions | 若 scope 过宽，可能破坏知识库 | P2 | 要求 scope hint、删除证据和 selective staging |
| `src/cli/index.js` | help/version 输出混合 emoji、中英文和 Unicode box | 终端兼容性和机器解析性一般 | P3 | 将 human help 与 machine JSON 输出分层；可保留品牌但避免关键命令依赖符号 |

## CLI 与安装体验审查

| CLI 功能 | 当前行为 | 用户体验问题 | 技术风险 | 建议 |
|---|---|---|---|---|
| `npm install -g spec-first` | `postinstall` 输出欢迎和下一步，见 `bin/postinstall.js:8-19` | npm lifecycle 输出不保证展示，手册也承认不是稳定欢迎页 | 低 | 保持轻量；把稳定 first-run 入口放 README/`spec-first -v` |
| `spec-first --version` | 输出版本、doctor/init/restart/host entry 示例，见 `src/cli/index.js:160-192` | 对英文用户混用中文；emoji/box 对某些终端不友好 | 低 | 提供 `--json` 或简化版本输出 |
| `spec-first --help` | 只列 CLI helpers，并说明 workflow entrypoints 在 host after init | 定位准确 | 低 | 保持 |
| `doctor` | 检查 Node/Git/manifest/developer/runtime assets/host CLI；`decision_input_health: not_checked`，见 `src/cli/commands/doctor.js:485-493` | 用户可能误以为 doctor = MCP/graph 完整健康 | 中 | 输出中明确 “doctor 不验证 MCP/graph provider readiness；请跑 mcp-setup/graph-bootstrap” |
| `doctor --json` | 输出 install/runtime/host/workflow_runnability | `workflow_runnability=simulated` 依赖 verification evidence，不等价真实 workflow 成功 | 中 | 文档加入字段解释 |
| `init --claude` | 写 commands、skills、workflow copies、agents、state、developer，安装 SessionStart hook | 成功引导缺 standards | 中 | 修改 `printInitNextSteps()` |
| `init --codex` | 不写 commands，写 `.agents/skills` 与 `.codex/agents`，清理 legacy Codex paths | 边界清楚 | 低 | 保持 |
| `init --dry-run` | 预览 prune/write/hard reset，不改文件，测试覆盖 | 良好 | 低 | README 增大项目试运行建议 |
| runtime drift reset | current runtime drift 时 managed hard reset，并有 rollback backup，见 `src/cli/commands/init.js:189-267`、`:461-553` | 行为强，但有明确命令授权和 dry-run | 中 | 成功输出中说明 backup/rollback 只覆盖 managed paths |
| `clean --dry-run` | 预览 managed deletions，不碰 custom assets | 良好 | 低 | 保持 |
| `clean` legacy state | 拒绝直接 clean，要求 init managed hard reset，见 `src/cli/commands/clean.js:52-60` | 体验稍绕，但安全 | 低 | 手册保持当前 FAQ |
| `tasks hash/validate` | 校验 task pack identity/freshness/structure | 容易被误解为语义 validator | 中 | 输出/文档重复 “does not judge semantic task quality” |

## 安装和平台兼容性

| 主题 | 当前事实 | 风险 | 建议 |
|---|---|---|---|
| Node.js | `package.json:67-69` 要求 `>=20.0.0`，doctor 检查 Node | 低 | 保持 |
| CommonJS CLI | `package.json:5`、`bin/spec-first.js` | 低 | 保持 |
| Windows/PowerShell | mcp-setup、graph-bootstrap 均有 `.ps1` 版本；tests 覆盖 PowerShell contracts | 中 | 对新 `.gitignore`/artifact 改动也补 PowerShell/Unix parity tests |
| 外部命令 timeout | `src/cli/external-command.js:3-19`，graph bootstrap provider timeout `bootstrap-providers.sh:12`、`:498-555` | 低/中 | 保持可配置 env |
| 路径安全 | task pack validator 拒绝反斜杠/`..`/空 files；app audit 对 base refs 有测试 | 中 | 新 artifact paths 继续用 POSIX contract |
| npm package payload | `package.json:27-39` 不包含中文 README、用户手册和 README SVG | 中 | 修包内容或改 README links |

## 测试覆盖观察

| 测试域 | 当前覆盖 | 缺口 |
|---|---|---|
| dual-host governance | `tests/unit/dual-host-governance-contracts.test.js` 覆盖 counts、Codex no commands、README runtime summary | 未覆盖 AGENTS/CLAUDE 中 `.claude-plugin` source truth 残留 |
| setup/bootstrap | `npm run test:mcp-setup`、`npm run test:graph-bootstrap` 和对应 unit/shell tests | 需要继续覆盖 `.spec-first/workflows` ignore 策略 |
| task pack | `tests/unit/task-pack-command.test.js` 覆盖 hash/freshness/contract | 语义质量依赖 LLM，合理不做 deterministic |
| app audit | 大量 unit/e2e-like script tests | 缺一个 public top-level runner fixture |
| skill audit | script tests 验证 writes latest/patch-preview | 良好 |
| docs lifecycle | `tests/unit/docs-lifecycle-contracts.test.js` 约束 docs index | 历史 docs banner/归档策略还不够强 |

## 代码层优先修复顺序

1. 修 source truth 残留：低代码风险，高治理收益。
2. 修 `.gitignore` 与 artifact catalog：低实现成本，高用户信任收益。
3. 修 init next steps：回应真实用户痛点，打通 setup -> standards handoff。
4. 实现或撤销 `spec-work` run artifact contract：避免 contract drift。
5. 给 app audit 增 top-level headless runner：降低复杂 workflow 的落地成本。
