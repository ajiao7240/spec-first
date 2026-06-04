# project-scaffold 依赖安装流程与 spec-runtime-setup 优化技术方案

> 日期：2026-06-03
> 状态：proposal
> 目标目录：`docs/01-需求分析/13.scale集成`
> 关联父方案：`spec-first内化集成scale-project-scaffold技术方案.md`
> 关联分析：`project-scaffold-依赖安装逻辑分析.md`、`scale-os-config-claude-code-依赖安装面分析.md`、`CodeGraph技术方案.md`

---

## 0. 结论

`project-scaffold` 的依赖安装流程值得 `spec-first` 借鉴，但不能照搬为“一键默认安装更多工具”。

它真正有价值的模式是：

```text
locked check-only bootstrap
  -> explicit install apply
  -> profile-aware required tools
  -> missing tool / not-run disclosure
  -> optional provider fallback
  -> verification evidence and logs
```

对应到 `spec-first`，应拆成三条清晰链路：

```text
spec-first init
  只负责 source-managed runtime projection。
  不安装 MCP、helper、provider、Graph、memory。

$spec-runtime-setup / /spec:runtime-setup
  负责 dependency readiness、install plan、explicit install、verify ledger、setup facts。
  默认 preview/check-first，不 silent install。

spec-first doctor
  消费 init state + setup facts + verification evidence。
  汇总 install_health、runtime_asset_health、host_readiness、decision_input_health、workflow_runnability。
```

核心原则：

- **安装不是验证**：tool installed 只说明命令可用，不说明 workflow 真的跑过。
- **配置不是执行**：host config / hook / permission allowlist 只说明 runtime 会或可调用，不说明已成功执行。
- **provider 不是 truth**：CodeGraph / Graphify / GBrain 只能先给 advisory candidate facts，confirmed truth 仍来自 source/test/log/contract/user evidence。
- **default minimal**：默认不安装 GBrain / Graphify / CodeGraph，不自动启动 daemon，不自动刷新图谱，不自动写长期记忆。
- **explicit apply**：任何 `npm install -g`、`pip install`、`brew install`、`cargo install`、`go install`、`npx skills add`、provider indexing 都必须来自显式安装阶段或用户明确授权。
- **runtime-setup naming**：主入口 canonical 命名为 `$spec-runtime-setup` / `/spec:runtime-setup`（已在父方案 §0.4.2 登记为 canonical 入口名），因为它治理的是 spec-first required harness runtime readiness，不只是 MCP；`$spec-mcp-setup` / `/spec:mcp-setup` 为迁移期 deprecated alias。本子方案的 `skills/spec-mcp-setup/**` source 实体路径在后续 source 重命名 work 任务落地前保持现状。
- **双宿主边界**：本方案维持当前 Claude / Codex 双宿主，不引入多平台 adapter 扩展。

### 0.1 Review follow-up 修复决策

结合 `scale-os-config-claude-code-依赖安装面分析.md` 后，本方案按以下方式逐项修复：

| 问题 | 最佳修复 | 落点 |
| --- | --- | --- |
| install safety 过薄 | 不新增安装审批引擎；在 helper/provider registry 上补 `risk_flags`、`version_policy`、`source`、`review_required`，由 plan renderer 输出风险，LLM 决定是否建议 apply | `helper-tools-registry.v1`、`provider-tools.json`、Phase 1/3 tests |
| host runtime / hook 隐含依赖未入账 | 新增 configured dependency scan，把 MCP、hook、permission allowlist、script command 都投影为 setup facts；不复制 inline hook | `tool-facts.v2.configured_dependencies[]`、`doctor.decision_input_health_basis` |
| `--verify-only` 写入语义不清 | 拆分只读 `--check` 与可写 `--verify-only` / `--refresh-facts`；所有 mode 在 status table 明示 write boundary | `$spec-runtime-setup` argument semantics（旧 `$spec-mcp-setup` alias 兼容） |
| `agent-browser` required 口径冲突 | 拆开 `required`、`baseline_blocking`、`surface_overlay`、`demand_signals`；minimal 下 agent-browser 是 skipped/degraded capability，不是 baseline blocker | `helper-tools.json`、check-health/install-helpers parity |
| `team` / `platform` profile 命名不一致 | 统一以父方案 §0.4 总表为准：组织 opt-in profile 命名为 `platform`；不再使用 `team`（历史 `team` 表述全部归一为 `platform`） | `provider-tools.json`、`provider-readiness.v1`、父方案 §0.4 |
| `tool-facts.v1/v2` 兼容未定义 | 增加 setup facts compatibility normalizer，doctor 只消费 normalized projection；invalid/stale 用 reason_code 降级 | `Dependency Readiness Projection`、doctor tests |
| doctor 缺少 basis | 增加 `decision_input_health_basis`，输出 artifact refs、freshness、counts、reason_code；status 本身仍是 deterministic rollup | `spec-first doctor` |
| honest closeout 可能变第二 artifact | 不新增独立 closeout artifact；映射到现有 `spec-work-run-artifact/v2` 与 final response closeout | `honest-closeout.v1` |
| Shell / PowerShell required tools 不同 | registry 支持 `runner_kind` / `platform_required_tools`；Windows PowerShell path 不强制 `jq`，Git Bash/WSL path 才要求 | testing strategy、PowerShell parity |
| provider freshness 太抽象 | 定义最小 freshness 算法：repo HEAD、index HEAD、source fingerprint、generated/query time；stale provider 只作 advisory | Provider readiness |

---

## 1. Goals / Non-goals

## 1.1 Goals

1. 让 `spec-first` 能诚实回答：
   - 当前 runtime 会调用哪些工具？
   - 哪些工具已安装、已配置、只是允许、只是推荐？
   - 哪些验证命令真实运行过？
   - 哪些因为缺依赖而未运行？
   - 哪些 provider 缺失后使用了 fallback？

2. 将 `project-scaffold` 的依赖治理模式内化为 `spec-first` 的 source contracts 和 deterministic facts。

3. 保持 `init`、`runtime-setup`、`doctor` 职责边界清晰，避免 setup 事实、runtime 生成、provider 语义判断混成一套隐式状态。

4. 为后续 verification profile、honest closeout、skill/tool registry，以及 v1.16 的 GBrain / Graphify / CodeGraph optional provider pack 打基础。

## 1.2 Non-goals

1. 不把 `.scale/`、`.agent/`、`scripts/gates/G0-G22` 复制到 `spec-first`。
2. 不让 `spec-first init` 安装任何外部依赖。
3. 不默认安装 `@hongmaple0820/scale-engine`、GBrain、Graphify、CodeGraph、agent-browser、Playwright、第三方 skill registry。
4. 不复制 `project-scaffold` 的 inline shell hooks 或 blocking gate engine。
5. 不让脚本决定任务等级、架构判断、review finding、root cause、是否可发布。
6. 不让 `doctor` 运行安装、刷新索引、启动 provider daemon 或修改 host config。
7. 不新增多平台 adapter；Host runtime 支持维持 Claude / Codex。

---

## 2. 现状证据

## 2.1 project-scaffold 安装与依赖事实

| 证据 | 关键事实 | 可借鉴点 |
| --- | --- | --- |
| `/Users/kuang/xiaobu/project-scaffold/scripts/bootstrap-scale.ps1` | 默认只检查 `scale` installed / target；未满足且无 `-AutoInstall` 时退出 `2` 并打印安装命令；显式 `-AutoInstall` 才 `npm install -g @hongmaple0820/scale-engine@<target>`；支持 locked/latest/mirror；安装后复查版本 | check-only default、explicit install、版本锁、安装后确认 |
| `/Users/kuang/xiaobu/project-scaffold/Makefile` | `bootstrap-scale` / `bootstrap-scale-install` / `bootstrap-scale-latest` 明确拆分；upgrade 也拆成 check / plan / apply / rollback / verify | 安装和升级动作显式分层 |
| `/Users/kuang/xiaobu/project-scaffold/.agent/project.json` | profiles / services / stacks / commands / required_tools 分离；scaffold、go、node、python stack 各自声明验证命令和工具 | verification profile contract |
| `/Users/kuang/xiaobu/project-scaffold/scripts/workflow/verify.sh` | 先生成 RUN/SKIP/ERROR plan；执行前检查 required_tools；缺工具时记录 missing tool 并跳过命令；日志落 `.agent/logs/<service>/<check>.profile.log` | missing tool / not-run disclosure |
| `/Users/kuang/xiaobu/project-scaffold/.scale/tools.json` | 工具按 `requiredFor`、`recommendedFor`、`destructiveActions`、`evidenceRequired` 描述 | tool policy metadata，不是安装清单 |
| `/Users/kuang/xiaobu/project-scaffold/.scale/skills.json` | domain detect、recommended/required skills、required artifacts、verification；policy mode 为 warn | skill/domain lens，不是硬路由 |
| `/Users/kuang/xiaobu/project-scaffold/.scale/code-intelligence.json` | CodeGraph external CLI、Graphify artifact、fallback internal-scan/rg/read | provider readiness + fallback |
| `/Users/kuang/xiaobu/project-scaffold/.scale/governance.lock.json` | 锁定 scale package/version 和 owned 文件 hash | lock / ownership / drift evidence |

## 2.2 spec-first 当前实现基础

| 节点 | 当前文件 | 现状 |
| --- | --- | --- |
| `init` | `src/cli/commands/init.js` | 生成 Claude/Codex runtime assets、managed state、skills、agents、host instruction blocks；有 preview、managed hard reset、runtime drift 检测 |
| `doctor` | `src/cli/commands/doctor.js` | 检查 Node/Git/package manifest、runtime assets、host CLI、workflow evidence freshness；`decision_input_health` 当前仍是 `not_checked` |
| `runtime-setup` | `skills/spec-mcp-setup/SKILL.md`（当前 source 目录名；目标入口名 `spec-runtime-setup`） | 定位为 required harness runtime setup；输出 tool-facts、runtime-capabilities、scenario fingerprint |
| MCP registry | `skills/spec-mcp-setup/mcp-tools.json` | 只管理 required MCP server：`sequential-thinking`、`context7` |
| MCP install | `skills/spec-mcp-setup/scripts/install-mcp.sh` | warmup package-backed MCP、写 host config、repair、summary ledger；已有 warmup cache 和 timeout |
| helper install | `skills/spec-mcp-setup/scripts/install-helpers.sh` | 管理 agent-browser、gh、jq、vhs、silicon、ffmpeg、ast-grep、ast-grep skill；helper 列表目前硬编码在脚本中 |
| setup facts | `skills/spec-mcp-setup/scripts/write-setup-facts.sh` | 写 `.spec-first/config/tool-facts.json` 和 `.spec-first/config/runtime-capabilities.json` |
| check health | `skills/spec-mcp-setup/scripts/check-health` | 输出 preflight，列出 helper/skill/project config status |

## 2.3 当前主要缺口

| 缺口 | 表现 | 风险 |
| --- | --- | --- |
| helper registry 不统一 | `install-helpers.sh` 和 `check-health` 都维护工具列表、required 口径和安装建议 | required / optional / baseline_blocking 漂移 |
| `runtime-setup` 用户语义不够分层 | workflow 文案有 verify/install，但缺统一 `check -> plan -> apply -> verify` contract | 用户不清楚何时会写 host config 或安装工具 |
| `doctor` 不消费 setup facts | `decision_input_health` 永远 `not_checked` | 用户无法从 `doctor` 看出 MCP/helper/provider readiness |
| `runtime-capabilities` 容易被误读 | `direct_evidence.ast_grep:true` 表达“可使用 direct evidence posture”，不是“当前机器 ast-grep 已 ready” | 下游 workflow 可能把 capability posture 当 installed fact |
| install safety 未结构化 | 当前 helper 安装建议仍可能包含 `@latest`、`npx -y`、global install、installer script 等风险形态 | preview plan 难以区分普通 missing tool 与高风险安装 |
| configured dependency 未统一扫描 | host MCP config、hook、allowlist、script command 可能真实调用未声明工具 | 运行时调用失败，但 setup/doctor 仍显示 ready |
| helper `required` 与 baseline blocking 混用 | `agent-browser` 等场景能力可能显示 required，但实际只在 UI/browser demand 下需要 | 用户误以为 minimal setup 必须安装 browser 工具 |
| setup facts 版本兼容未定义 | `tool-facts.v1` / `tool-facts.v2` 同时存在演进需求 | `doctor` 和 workflow 消费端可能按不同 schema 解读 |
| provider 安装/启动/刷新边界未统一 | CodeGraph / Graphify / GBrain 目前在文档方案中讨论，但未纳入 setup contract | 容易出现默认全装、默认刷新、默认信任 provider |
| verification profile 未产品化 | spec-first 有测试命令和 run artifact，但没有 project-level verification profile | final closeout 难以稳定说明 not-run / skipped / missing tool |

## 2.4 Minimal baseline 必装依赖表

以下表格定义本方案下的 **minimal baseline 必须 ready** 的依赖。`spec-first init` 不安装这些依赖；`$spec-runtime-setup` 负责检测、warmup、配置、写 facts，并在缺失时输出 action-required / degraded / skipped。

| 层级 | 组件 / 工具 | 必装或必配置条件 | 为什么必须 | setup/doctor 缺失结果 |
| --- | --- | --- | --- | --- |
| CLI runtime | Node.js | 所有 `spec-first` CLI 与 setup workflow | `spec-first` 是 Node.js CommonJS CLI，MCP warmup 和 package-backed tools 也依赖 Node | `install_health=error` 或 setup preflight action-required |
| Package runner | npm / npx | required MCP warmup、package-backed MCP host config、部分 helper install plan | `sequential-thinking`、`context7` 当前通过 `npx -y <package>@latest` warmup / runtime 拉起 | required MCP dependency `missing`，`decision_input_health=error` |
| Repo evidence | Git | git repo / worktree 场景默认 required；非 git workspace 可降级 | `doctor`、scenario fingerprint、diff evidence、workspace topology、verification evidence 都依赖 git facts | git repo workflow action-required；非 git 场景标 degraded / partial |
| Source search | `rg` / ripgrep | direct source evidence baseline | plan/work/debug/review 需要快速 bounded source reads；缺失时只能退化到慢速搜索 | `degraded`，workflow closeout 需披露 fallback |
| Structured search | `ast-grep` 或 `sg` | `structured-code-search` / review pre-facts / complex refactor 场景；target design 中 minimal helper baseline | 用于 AST 结构搜索，避免把复杂代码模式降级成纯文本猜测 | baseline helper missing 时 action-required；允许明确 fallback 到 `rg` 并标 degraded |
| Host runtime | Claude Code 或 Codex host config target | 选择对应 host 后必须可定位可写或可读配置目标 | required MCP server 需要写入或验证 host config；doctor 需要检查 host wiring | `host_readiness=warn/error`，MCP configured_status action-required / precedence-blocked |
| Required MCP | `sequential-thinking` | 所有 spec-first workflow 的 required MCP server | 支撑动态反思和复杂问题分解，是 required harness runtime 的一部分 | MCP row action-required；`decision_input_health=error` |
| Required MCP | `context7` | 所有需要最新框架/库文档的一手查询场景；required MCP server | 技术实现、计划、review 需要可验证的一手文档入口 | MCP row action-required；缺失时 docs lookup degraded |
| Script runner | Bash | macOS / Linux / WSL / Git Bash 路径 | shell setup scripts、check-health、verify-tools、project bootstrap 需要 shell runner | shell runner action-required；Windows native PowerShell 路径不因 Bash 缺失失败 |
| Script runner | PowerShell | Windows native setup 路径 | PowerShell parity scripts 需要原生 runner，避免强依赖 Git Bash / WSL | Windows native setup action-required |
| JSON parser | `jq` | Bash / Git Bash / WSL setup 路径 | shell scripts 解析 host config、tool registry、setup facts 需要 `jq` | Bash path action-required；PowerShell native path 不要求 `jq` |

不属于 minimal baseline 必装，但可按 profile / overlay / workflow demand 升级：

| 组件 / 工具 | 默认状态 | 升级条件 | 说明 |
| --- | --- | --- | --- |
| `agent-browser`、Playwright MCP、Chrome DevTools MCP | skipped / degraded | `surface-ui`、browser/E2E 验证、`SPEC_FIRST_BROWSER_HELPER_REQUIRED=1` | 浏览器证据工具，不是普通 plan/work/debug 必装项 |
| `gh` | optional / workflow-specific | commit / PR / GitHub review workflow | PR 操作需要，普通 setup/readiness 不应阻塞 |
| `vhs`、`silicon`、`ffmpeg` | optional | feature-video、演示录制、截图渲染 | 媒体生成辅助，不是 harness baseline |
| CodeGraph、Graphify、GBrain | optional provider | `recommended` / `platform` profile explicit apply 或 workflow 显式召回 | 只产 advisory candidate facts，不替代 source/test/log evidence |
| postgres MCP、gosec、audit tools | surface-specific | `surface-data-security` | 需要凭据、权限和 security boundary，不默认安装 |

## 2.5 三个参考项目可补充集成项

结合 `/Users/kuang/xiaobu/scale-engine`、`/Users/kuang/xiaobu/project-scaffold`、`/Users/kuang/xiaobu/scale-os-config-claude-code` 的本地证据后，建议只吸收能增强 **readiness facts、install safety、verification evidence、provider fallback、resource governance** 的机制；不搬 `.scale` 状态机、blocking gate engine、inline hook 或第三方技能全集。

| 来源项目 | 可借鉴组件 / 机制 | 证据路径 | 建议进入 spec-first 的位置 | 集成等级 | 边界 / 原因 |
| --- | --- | --- | --- | --- | --- |
| `scale-engine` | Dependency bootstrap 的 status taxonomy：`ready`、`manual-review`、`needs-init`、`version-drift`、`installed-now`、`failed` | `src/bootstrap/DependencyBootstrap.ts`、`src/bootstrap/DependencyBootstrapRenderer.ts` | `$spec-runtime-setup` status renderer、`tool-facts.v2.items[]` | P0 直接补入 | 只作为 deterministic readiness/result 字段；不复制 SCALE dependency pack 或自动安装逻辑 |
| `scale-engine` | runtimeChecks / postChecks / postActions / rollbackHints / recommendations 分层报告 | `src/bootstrap/DependencyBootstrap.ts` | `$spec-runtime-setup --plan/--verify-only` 输出、install ledger | P0 直接补入 | post-check 只记录命令与结果；LLM 决定是否建议继续 install/apply |
| `scale-engine` | bounded dependency audit：只读 lockfile、默认 direct deps、不联系 registry、不运行 install scripts、检测 install script/bin/eval/shell/network 风险 | `docs/DEPENDENCY_AUDIT.md` | install safety lens、provider/helper registry safety metadata、Phase 3 apply guard | P1 推荐补入 | 作为 local supply-chain screening；不引入新的 G7 gate 或 registry 网络审计默认路径 |
| `scale-engine` / `project-scaffold` | tool policy metadata：`requiredFor`、`recommendedFor`、`destructiveActions`、`evidenceRequired`、allowed domains | `.scale/tools.json` | `helper-tools-registry.v1` / `provider-tools.json` | P0 直接补入 | 这些是工具策略字段，不是安装清单；`requiredFor` 必须继续和 `baseline_blocking` 分离 |
| `scale-engine` | memory provider routing：`allowExternalWrite=false`、`requireEvidence=true`、`writeMode=disabled/candidate-only` | `.scale/memory-providers.json` | GBrain / memory provider profile、`candidate -> review -> promote` 规则 | P2 optional provider | 只做 recall/candidate 约束；不默认写长期记忆，不把 memory 命中当 confirmed truth |
| `scale-engine` / `project-scaffold` | adapter-first code intelligence：CodeGraph external CLI、Graphify artifact、fallback `internal-scan/rg/read`、ROI metrics | `docs/CODE_INTELLIGENCE.md`、`.scale/code-intelligence.json` | provider readiness/freshness/fallback、`CodeGraph技术方案.md` implementation alignment | P2 optional provider | provider `not-run`/stale 不能阻塞 minimal；ROI 只能作为是否保留 provider 的 advisory 指标 |
| `scale-engine` | Runtime evidence 的 final-check / redaction / runtime doctor 思路 | `docs/RUNTIME_EVIDENCE.md` | `verification-run-summary.v1` 与 `spec-work-run-artifact/v2` 字段映射 | P1 推荐补入 | 不新增 `.scale/evidence` 平行 truth；复用 spec-first 现有 run artifact 与 final closeout |
| `project-scaffold` | resource policy：ignored dirs、retained runtime dirs、owners/modules | `.scale/resource-policy.json` | context/resource governance lens、future `resource-impact` advisory | P1 推荐补入 | 不作为默认 repo 扫描 source-of-truth；可作为资源分类和保留策略的参考模板 |
| `project-scaffold` | product smoke：真实业务路径 probe、空 probe block、runtime evidence 要求 | `.scale/product-smoke.json` | `verification-profile.v1` 的 optional `productSmoke` profile | P1 推荐补入 | 只在项目显式声明 probe 后启用；不把示例 health check 当产品验收 |
| `project-scaffold` | output policy：artifact manifest、禁止远程脚本/样式、detect secrets | `.scale/output-policy.json` | 文档/HTML sidecar 输出安全策略、artifact manifest future work | P2/P3 分拆补入 | secret/redaction/defaultGitPolicy 进入 P2 artifact-summary hardening；HTML sidecar/manifest 等到 P3，不引入 exclusive HTML output |
| `project-scaffold` | skill/domain lens：domain detect、recommended skills、required artifacts、verification | `.scale/skills.json` | surface overlay 与 skill evidence 的 advisory detector | P2 延后补入 | 不做强路由，不要求每个 docs/UI/API 任务生成固定 artifact |
| `scale-os-config-claude-code` | quality contract：task levels、verification profiles、install safety、usage evidence、red lines | `.scale/quality-contract.json`、`docs/workflow/QUALITY_CONTRACT.md` | `verification-profile.v1`、closeout red-line wording、install safety 文案 | P1 推荐补入 | 吸收 contract shape；不复制 `.scale/workflow.json` 作为流程状态 truth |
| `scale-os-config-claude-code` | `.agent/project.json` 的 stack/service/required_tools 矩阵 | `.agent/project.json` | `spec-first.verification.json` loader、configured dependency scan | P1 推荐补入 | 只作为项目级 verification source；required tools 必须按 runner/profile 解释 |
| `scale-os-config-claude-code` | host MCP configured surface：7 个 MCP servers 已配置，但并非都 baseline required | `.claude/settings.json` | `tool-facts.v2.configured_dependencies[]`、doctor configured dependency counts | P0 直接补入 | 配置存在不等于 installed/verified；`postgres`、`playwright` 等保持 surface-specific |
| `scale-os-config-claude-code` | skills registry：177 entries，`core/recommended/optional`、`installable/reference`、`riskFlags` | `.scale/skills-registry.json` | third-party skill registry import lens、install safety risk flags | P2 延后补入 | 不批量安装、不常驻上下文；只抽取 metadata 与 review-before-install 规则 |
| `scale-os-config-claude-code` | shield/policies：protected paths、denied commands、required gates、hook 隐含命令 | `.scale/policies.json`、`.scale/hooks/devin-shield.yaml` | configured dependency scan、dangerous command advisory、install/apply safety | P1 推荐补入 | 不复制 blocking hook 或 Devin-specific enforcement；只提取会调用的命令和风险字段 |
| `scale-os-config-claude-code` | workflow phase/gate/detector 状态机 | `.scale/workflow.json` | 不进入当前方案 | 不集成 | 与 spec-first “Light contract + LLM decides” 冲突；最多作为反模式和术语参考 |

优先级收敛：

> 优先级口径消歧：下表的 P0–P3 是**本子方案 setup / readiness 面内部的「应补充内容」优先级**，回答「这些参考项目的机制先补哪些」，**不等同**于父方案 §10 的全局交付优先级（P0 可信交付基线 / P1 governance lens / P2 Knowledge Harness / P3 optional providers / P4 platform baseline）。两套 P 编号同名不同轴：本表 P0 指 setup 面最先补的事实字段，父方案 §10 P0 指全局最先交付的可信交付基线。涉及全局相位 / 优先级归属时以父方案 §8 / §10 与 §8.1 相位对照表为准。

| 优先级 | 应补充内容 | 最小落地 |
| --- | --- | --- |
| P0 | bootstrap status taxonomy、tool policy metadata、host configured dependency scan | 进入 Phase 1/2，直接改善 `$spec-runtime-setup` 与 `doctor` 的事实表达 |
| P1 | dependency audit safety、runtime evidence mapping、product smoke、quality contract required tools、resource governance、shield policy extraction | 进入 Phase 3/4 与 Governance Lens，强化 install plan、verification/run closeout 和资源证据边界 |
| P2 | memory/code provider、skill/domain lens、skills registry metadata、output policy 的 redaction/artifact-summary 部分 | 进入 optional provider / knowledge / artifact governance，不阻塞 minimal |
| P3 | output policy 的 HTML sidecar / artifact manifest 扩展 | 等 Markdown canonical consumer 和 optional sidecar tests 成熟后再接 |
| 不集成 | `.scale/workflow.json` 状态机、G0-G22 blocking gate、inline hook、第三方技能全集默认安装 | 保持 spec-first source/runtime 边界和 LLM judgment 边界 |

---

## 3. 目标架构

## 3.1 三节点职责

```text
┌──────────────────────┐
│ spec-first init       │
│ runtime projection    │
└──────────┬───────────┘
           │ writes managed runtime assets/state
           ▼
┌──────────────────────┐
│ spec-first doctor     │◄──────────────┐
│ readiness summary     │               │ consumes
└──────────┬───────────┘               │
           │ reads                      │
           ▼                            │
┌──────────────────────┐                │
│ spec-runtime-setup    │────────────────┘
│ setup facts producer  │
└──────────┬───────────┘
           │ writes
           ▼
┌───────────────────────────────────────────┐
│ .spec-first/config/tool-facts.json         │
│ .spec-first/config/runtime-capabilities.json│
│ .spec-first/workspace/*summary.json        │
│ host readiness ledger                      │
└───────────────────────────────────────────┘
```

## 3.2 `init` 边界

`spec-first init` 做：

- 选择 Claude / Codex runtime。
- 生成 managed runtime assets。
- 写 managed state。
- 修复 source-managed runtime drift。
- 生成或更新 host instruction managed blocks。
- 输出 runtime generation summary。
- 提示下一步运行 `doctor` 或 `$spec-runtime-setup`（旧 `$spec-mcp-setup` 兼容）。

`spec-first init` 不做：

- 不安装 MCP server。
- 不安装 helper CLI。
- 不写全局 provider config。
- 不运行 `npx -y` warmup。
- 不启动 CodeGraph / Graphify / GBrain。
- 不刷新索引。
- 不写 `.spec-first/config/tool-facts.json`。

## 3.3 `runtime-setup` 边界

`$spec-runtime-setup` / `/spec:runtime-setup` 做：

- 检测 required MCP / helper / provider readiness。
- 生成 install plan。
- 在 explicit apply 时安装或 warmup。
- 写 host MCP config。
- 写 project-local setup facts。
- 记录 missing / skipped / degraded / fallback。
- 输出下一步动作。

各 mode 的写入边界以 §5.2 mode 矩阵为准：`--check` 严格只读（不写 setup facts、不改 host config、不安装）；`--verify-only` / `--refresh-facts` 只写 setup facts；`--install` 才写 host config / 安装 required helper。

`runtime-setup` 不做：

- 不判断业务需求范围。
- 不判断 review finding。
- 不把 provider 输出升级为 confirmed truth。
- 不默认写长期记忆。
- 不替代 `spec-work` 的验证执行。

## 3.4 `doctor` 边界

`spec-first doctor` 做：

- 检查 CLI 与 runtime assets。
- 检查 host CLI 和 host wiring。
- 读取 setup facts，汇总 dependency readiness。
- 读取 verification evidence freshness。
- 输出 health summary 和 fix guidance。

`doctor` 不做：

- 不安装。
- 不 repair。
- 不写 host config。
- 不刷新 provider。
- 不运行项目验证命令。

---

## 4. Contract 设计

## 4.1 Dependency Readiness Projection

不新增独立 runtime dependency readiness artifact，避免形成第二事实源。

Dependency readiness 是 `doctor` 从现有 setup facts 计算出来的 projection / rollup：

| Source facts | 归属 | 说明 |
| --- | --- | --- |
| `.spec-first/config/tool-facts.json` | `$spec-runtime-setup` | tool / helper / MCP 的安装、检测、缺失、降级事实 |
| `.spec-first/config/runtime-capabilities.json` | `$spec-runtime-setup` | runtime capability posture，不等同于 installed fact |
| `.spec-first/workspace/*summary.json` | `$spec-runtime-setup` | workspace topology、scenario fingerprint、setup freshness |
| host managed state | `spec-first init` | Claude / Codex runtime projection 状态 |

如果现有 setup facts 字段不足，优先演进为 `tool-facts.v2` 或补充 `runtime-capabilities.v2`，而不是新增一份并行 readiness 文件。

`doctor.decision_input_health` 只消费这些 facts 并输出汇总，不成为 source-of-truth。下游 workflow 可以读取 `doctor --json` 的 projection 作为 advisory input，但仍应在执行阶段以 source/test/log/contract/user evidence 确认语义结论。

Projection item 的最小计算字段：

| 字段 | 枚举 |
| --- | --- |
| `dependency_status` | `ready` / `missing` / `unsupported` / `unknown` |
| `configured_status` | `ready` / `action-required` / `not-required` / `precedence-blocked` / `fallback-active` |
| `allowed_status` | `allowed` / `denied` / `not-checked` / `not-applicable` |
| `install_status` | `not-run` / `planned` / `installed` / `failed` / `skipped` / `cached` |
| `result` | `ready` / `action-required` / `degraded` / `skipped` / `unsupported` |

这些字段可以由 `tool-facts.v2.items[]` 承载，也可以由 `doctor` 在内存中计算后输出到 `doctor --json`。除非后续出现真实 durable consumer，不单独落盘为新的 readiness artifact。

### 4.1.1 Setup facts compatibility

`doctor` 和 downstream workflow 不直接依赖某个历史 facts 版本的原始字段。新增一个窄 normalizer：

```text
tool-facts.v1 / tool-facts.v2
  -> normalized setup facts projection
  -> doctor.decision_input_health + decision_input_health_basis
```

规则：

- `tool-facts.v1` 保持可读，缺失的新字段按 `unknown` / `not-checked` / `not-applicable` 填充。
- `tool-facts.v2` 是新增字段的主要承载位置，优先补 `items[]`、`configured_dependencies[]`、`schema_capabilities[]`。
- schema invalid、不可读、版本未知分别输出 `setup-facts-invalid`、`setup-facts-unreadable`、`setup-facts-schema-unsupported`。
- normalizer 是 deterministic script 逻辑，只做字段归一化和 reason_code 计算，不判断 provider 内容是否可信。
- 下游 workflow 消费 `doctor --json` projection 时必须标为 advisory input；真正的语义结论仍由 source/test/log/contract/user evidence 确认。

`decision_input_health_basis` 的 canonical schema 以 §5.3 为准（含 artifact refs、freshness、各类 counts、configured/provider counts、reason_code）。本节只说明 normalizer 必须为该 basis 填充的最小输入：`reason_code`、被消费的 setup facts 的 `schema_versions`、`freshness` 和归一化后的 counts。§5.3 的 basis 是 doctor 输出的唯一形状，本节不另立平行字段结构。

## 4.2 `helper-tools-registry.v1`

将 `install-helpers.sh` 和 `check-health` 的硬编码列表收敛到 registry。

建议新增：

```text
skills/spec-mcp-setup/helper-tools.json
```

字段：

```json
{
  "schema_version": "helper-tools-registry.v1",
  "tools": [
    {
      "id": "ast-grep",
      "kind": "helper-cli",
      "profiles": ["minimal", "recommended", "platform"],
      "surface_overlays": ["structured-code-search"],
      "baseline_blocking": true,
      "required_for": ["structured-code-search", "review-pre-facts"],
      "recommended_for": ["plan", "code-review", "debug"],
      "demand_signals": [],
      "detection": {
        "command": "ast-grep",
        "args": ["--version"]
      },
      "installation": {
        "macos": "brew install ast-grep",
        "linux": "cargo install ast-grep --locked --force || npm install -g @ast-grep/cli@latest",
        "windows": "npm install -g @ast-grep/cli@latest"
      },
      "safety": {
        "source": "official-package-manager",
        "source_repo": "https://github.com/ast-grep/ast-grep",
        "risk_flags": ["global-install", "network-download"],
        "global_install": true,
        "network_required": true,
        "explicit_apply_required": true,
        "review_required": false,
        "version_policy": {
          "pin_status": "unpinned",
          "requested_version": "latest",
          "lock_recommended": true
        }
      },
      "platform_required_tools": {
        "shell": ["bash"],
        "powershell": []
      },
      "runner_kind": ["shell"]
    }
  ]
}
```

设计要求：

- registry 只描述 deterministic install/readiness facts。
- workflow LLM 决定是否建议安装。
- installer 只执行 registry 明确允许的 install strategy。
- `check-health`、`install-helpers`、`verify-tools` 都从同一 registry 派生。
- `required` 表示“某个 profile / overlay / workflow surface 下会需要”，不等同于 minimal baseline blocker。
- `baseline_blocking=true` 才会让 minimal setup 进入 `action-required`；`agent-browser` 这类 browser evidence helper 默认应是 `baseline_blocking=false`，只有 `surface-ui` overlay 或 `SPEC_FIRST_BROWSER_HELPER_REQUIRED=1` demand signal 才升级为 required action。
- `runner_kind` / `platform_required_tools` 允许 shell 与 PowerShell 路径不同；Windows native PowerShell setup 不应因为 Bash 脚本依赖 `jq` 而失败。helper registry 的 `runner_kind` 描述该 helper 的检测/安装 runner；verification-profile（§4.4）的 `runner_kind` 描述某个 check 的执行 runner——二者同名但作用域不同，不共享同一字段实例。

### 4.2.1 Install safety lens

Install safety 是 plan/apply 之间的轻量 gate，不是新的审批系统。

每个 registry item 至少需要输出：

| 字段 | 说明 |
| --- | --- |
| `risk_flags[]` | `global-install` / `installer-script` / `unknown-source` / `reference-only` / `host-plugin-install` / `unpinned-npx` / `postinstall` / `lockfile-change` |
| `source` | `official-package-manager` / `source-repo` / `host-marketplace` / `reference-doc` / `unknown` |
| `source_repo` | 可审查的一手仓库或文档 URL；缺失时标 `unknown-source` |
| `version_policy.pin_status` | `pinned` / `unpinned` / `floating-latest` / `not-applicable` |
| `review_required` | 高风险 item 在 apply 前必须由 workflow 明示风险，不能静默安装 |
| `install_effect` | `global-env` / `project-local` / `host-config` / `provider-index` / `browser-runtime` |

Plan renderer 对安装项计算：

```text
safety_result = safe | review-required | unsupported | blocked
reason_code   = global-install | unpinned-npx | installer-script | unknown-source | ...
```

Apply 规则：

- `safe`：可在用户选择 `--install` 后执行。
- `review-required`：必须在 status table 中显示风险和 install command；LLM 只能建议，不能代表用户静默确认。
- `unsupported`：只输出手动安装建议。
- `blocked`：缺少 source、版本、权限或平台边界时不执行。

## 4.3 Provider registry profile + `provider-readiness.v1`

用于承载 GBrain / Graphify / CodeGraph 等 optional provider。

本节只定义 v1.11/v1.12 需要的通用 provider readiness 槽位、profile 命名和 install safety 边界，避免 setup facts 无法表达 optional provider 的 `not-run` / `stale` / fallback。具体 CodeGraph / Graphify / GBrain registry entries、adapter、query consumer 和 context fusion 不属于本子方案的开发范围；它们在 v1.16 以父方案 + `CodeGraph技术方案.md` 为实施依据。

建议新增：

```text
docs/contracts/provider-readiness.md
skills/spec-mcp-setup/provider-tools.json
```

目录规范：不新增独立 `docs/contracts/provider-install-profile.md`。`minimal` / `recommended` / `platform` profile 的安装策略属于 `skills/spec-mcp-setup/provider-tools.json` 的 registry metadata；provider 的 lifecycle 布尔位、readiness freshness、repo alignment 与 fallback 事实属于 `docs/contracts/provider-readiness.md` / `provider-readiness.v1`。这样与父方案 §7.1 的“近期只新增一个 provider 核心合同”保持一致，避免 provider profile 和 provider readiness 形成双合同。

Profile：

> Profile 命名以父方案 §0.4 总表为准：统一为 `minimal` / `recommended` / `platform`，不使用 `team`。

| Profile | 默认行为 | Provider |
| --- | --- | --- |
| `minimal` | 不安装，只检测已存在 provider；缺失不阻塞 | none |
| `recommended` | 输出 install plan；用户显式确认后安装/初始化 | CodeGraph、Graphify candidate、GBrain candidate |
| `platform` | 团队 opt-in profile，可纳入 provider pack | CodeGraph、Graphify、GBrain（browser/e2e 走 scenario overlay，不入 profile） |

命名约束（以父方案 §0.4 总表为准）：

- `scale-os-config-claude-code` 分析中的 `platform` profile 与 spec-first 的 `platform` profile 同名对齐，不再引入 `team` 别名。
- `platform` 是组织显式 opt-in，不是默认 profile。
- browser/e2e、data/security 能力优先通过 scenario overlay 启用；即使 `platform` profile 推荐这些能力，也不应让 unrelated workflow 因缺 browser/database provider 进入 `error`。

Scenario overlays 不是 profile，不参与默认 profile 选择，只在 workflow 根据任务表面显式启用：

| Overlay | 触发场景 | Provider / Tool |
| --- | --- | --- |
| `surface-ui` | UI/E2E 场景触发 | agent-browser、Playwright MCP、Chrome DevTools MCP |
| `surface-data-security` | 数据库/安全场景触发 | postgres MCP、gosec、audit tools |

Provider readiness 必须用**两轴模型**表达（与父方案 §5.4、§0.4 总表对齐，不再用单字段 9 值列表混合生命周期与新鲜度）。

> 字段引用边界（父方案 §0.4.3）：`provider-readiness.v1` 的**完整 canonical 字段定义见父方案 §7.1**（含 `readiness_status`、`lifecycle.*` 生命周期布尔位全集、`repo_aligned`、`source_read_required`、`fallback` 等），落盘目标是 `docs/contracts/provider-readiness.md` / `.schema.json`。本节只复述消费口径，不重定义字段；生命周期布尔位以父方案 §7.1 的 `lifecycle` 对象为唯一字段集合，本节不再单列、不私自增减位。

**轴 A — Provider Readiness（机械新鲜度，单字段 `readiness_status`，只取 5 值）**

| `readiness_status` | 含义 |
| --- | --- |
| `not-run` | provider 命令/artifact/server 不存在（吸收旧 `missing`） |
| `degraded` | 可用但部分能力缺失或降级运行 |
| `stale` | 可用但 index/graph/memory 需 refresh |
| `fresh` | 与当前 repo HEAD / source fingerprint 对齐 |
| `unknown` | 无法判定 |

**生命周期阶段**：各自独立布尔位、不塞进 `readiness_status` enum；字段集合以父方案 §7.1 的 `lifecycle` 对象为准（`installed` / `configured` / `initialized` / `indexed` / `server_reachable` / `artifact_exists` / `query_verified` / `fallback_used`）。本节不另列字段，避免与 canonical 漂移。

**轴 B — Evidence Trust（语义晋升，不写进上面任何字段）**：`advisory` / `evidence_candidate` / `confirmed_context` / `durable_knowledge` / `governance_rule`，由 workflow 判断，见父方案 §5.4。`readiness_status=fresh` 永不等于 `confirmed_context`。

Freshness 最小算法：

| 字段 | 来源 | 判断 |
| --- | --- | --- |
| `repo_head` | `git rev-parse HEAD` | 当前代码版本 |
| `source_fingerprint` | tracked source path/hash summary | 检测未提交 source drift |
| `provider_index_head` | provider index marker / artifact metadata | 与 `repo_head` 不一致则 `stale` |
| `generated_at` | provider artifact metadata | 超过 freshness window 则 `stale` |
| `query_verified_at` | 最近一次 bounded query ledger | 缺失则 `query_verified=false` |
| `fallback_used` | workflow/status renderer | provider 不可用或 stale 时记录 direct-source fallback |

`fresh` 只说明 provider artifact 与当前 repo/version 对齐，不说明 provider 的语义结论正确。

## 4.4 `verification-profile.v1`

从 `project-scaffold/.agent/project.json` 借鉴 profile/service/stack/checks/required_tools 结构，但改成 spec-first source contract。

Canonical source path：

```text
spec-first.verification.json
```

可选本地 override：

```text
.spec-first/verification-profile.local.json
```

`spec-first.verification.json` 位于 repo root，是可提交的项目级 source-of-truth。本地 override 主用 `.spec-first/verification-profile.local.json`（与父方案 §0.4 总表第一顺位一致，落入 gitignore）；`.spec-first/config.local.yaml` 作为兼容别名同样被接受。两者都只允许覆盖本机路径、临时跳过项或本地命令参数，不作为团队共享事实源。

完整 JSON 形态（canonical：本节为 `verification-profile.v1` 的唯一完整字段定义，引用处只指向本结构，不重写字段）：

```json
{
  "schema_version": "verification-profile.v1",
  "default_profile": "default",
  "profiles": {
    "default": {
      "services": ["root"],
      "checks": ["typecheck", "unit"]
    }
  },
  "services": {
    "root": {
      "path": ".",
      "stack": "node",
      "required": true
    }
  },
  "stacks": {
    "node": {
      "detect": ["package.json"],
      "commands": {
        "typecheck": "npm run typecheck",
        "unit": "npm run test:unit"
      },
      "runner_kind": {
        "typecheck": "npm-script",
        "unit": "npm-script"
      },
      "required_tools": {
        "typecheck": ["node", "npm"],
        "unit": ["node", "npm"]
      }
    }
  }
}
```

字段说明（canonical 完整字段，避免引用处漂移）：

| 字段 | 含义 |
| --- | --- |
| `schema_version` | 固定 `verification-profile.v1`。 |
| `default_profile` | 未显式选择时使用的 profile key。 |
| `profiles.<name>.services` | 该 profile 涉及的 service id 列表。 |
| `profiles.<name>.checks` | 该 profile 运行的 check id 列表（解析到 stack.commands）。 |
| `services.<id>.path` | service 根路径（相对 repo root）。 |
| `services.<id>.stack` | service 绑定的 stack key。 |
| `services.<id>.required` | service 是否必跑；`false` 表示缺失只降级不阻断。 |
| `stacks.<key>.detect` | stack 自动探测标志文件（如 `package.json`）；用于缺 profile 时的 stack 推断。 |
| `stacks.<key>.commands.<check>` | check id 到实际执行命令的映射。 |
| `stacks.<key>.runner_kind.<check>` | check 的执行 runner：`shell` / `powershell` / `node` / `npm-script`；同一 check 在不同 runner 下 `required_tools` 可不同。 |
| `stacks.<key>.required_tools.<check>` | check 在当前 runner 下的必需工具列表；缺失时该 check 记 `not-run: missing_dependency`。 |

规则：

- profile 是项目声明，不是 spec-first 默认强制。
- 缺 `spec-first.verification.json` 时，workflow 使用 package scripts、CI、README、用户指令和 direct reads 推断验证候选（可借助 `stacks.<key>.detect` 标志文件做 stack 推断），并在 closeout 中标记 profile source 为 `inferred`。
- `verification-run-summary.v1` 是真实执行结果，不是 profile source-of-truth。
- 缺工具必须记录 `not-run: missing_dependency`。
- `runner_kind` 必须区分 `shell`、`powershell`、`node`、`npm-script` 等执行路径；同一 check 在不同 runner 下的 required tools 可以不同。helper registry（§4.2）的 `runner_kind` 描述 helper 检测/安装 runner，与本字段同名但作用域不同，不共享字段实例。
- 本地 override 只能影响本机执行参数或临时 skip，不能改变团队共享的 check 身份、required tools 语义或 pass/fail 解释。

## 4.5 `verification-run-summary.v1`

用于记录真实验证执行，不替代现有 workflow final response，也不强制成为所有 workflow 的新独立 artifact。

**canonical 字段定义见 `docs/contracts/verification/verification-run-summary.schema.json`**（§0.4.3 登记）；本节只说明落点，不重定义字段。要点：顶层数组 `checks[]` 记录逐 check 明细，`status` 复用 `passed/failed/not-run/degraded`，`log_path` 是 redacted repo-relative 字符串。

首选落点：

- `spec-work`：产出或引用 `verification-run-summary.v1`；`spec-work-run-artifact/v2` 的 `script_confirmed.validation` 只保留聚合 `status` / `reason_code` / `run_summary_ref`，不复制逐 check 明细（与父方案 §4.4/§4.5 的单向引用口径一致）。
- `spec-debug` / `spec-code-review`：可在各自 closeout 或 run evidence 中引用同一 `verification-run-summary.v1` 结构。
- 对需要 durable validation evidence 的 closeout，`verification-run-summary.v1` 是逐 check 明细的唯一 source；不再使用 `script_confirmed.validation.commands[]` 作为并行明细结构。
- 只有出现真实 durable consumer 时，才单独落盘 `verification-run-summary.v1`。

## 4.6 `honest-closeout.v1`

`project-scaffold` 的四问可内化为 closeout evidence mapping，但不新增第二份 durable closeout artifact。

本节是 `honest-closeout.v1` 的**字段映射面**；其 **claim 校验模型**（结构化 `{claim_type, asserted_status, evidence_refs[]}` + consistent/unsupported/degraded 判定）的 canonical 定义见父方案 §4.6（§0.4.3 登记）。二者是同一 contract 的两个面：父方案定义"怎么校验 claim"，本节定义"四问映射到哪些字段"，不是两套竞争定义。

对于 `spec-work`，优先映射到现有 `spec-work-run-artifact/v2`：

| 问题 | spec-first closeout 字段 |
| --- | --- |
| 这次任务解决什么问题？ | `llm_asserted.summary` |
| 改动影响哪些文件、服务、文档？ | `script_confirmed.changed_files`、`direct_evidence_used.source_refs` |
| 哪些验证真实运行过，哪些没有运行？ | `script_confirmed.validation.run_summary_ref` 指向的 `verification-run-summary.v1` |
| 哪些结论沉淀，哪些只是过程产物？ | `llm_asserted.deferred_follow_up`、`docs/solutions/**` refs、`script_confirmed.artifact_refs` |

原则：

- final response 可以摘要，但 durable artifact 要能支撑复查。
- 若 `spec-work-run-artifact/v2` 已写入，本 contract 只作为字段映射，不再额外写 `honest-closeout.json`。
- 未运行验证必须明确 `not_run`，不能写成 `passed` 或 `verified`。
- provider evidence 要标 `advisory`，source/test/log evidence 才能支持 confirmed claim。

## 4.7 Runtime configured dependency scan

configured dependency scan 只扫描“runtime 会或可能调用什么”，不复制 hook 逻辑、不执行 hook。

建议写入 `tool-facts.v2.configured_dependencies[]`：

```json
{
  "id": "claude-post-tool-ruff",
  "kind": "hook-command",
  "source_path": ".claude/settings.json",
  "command": "ruff",
  "args_shape": ["check", "$FILEPATH"],
  "declared_tool_id": "ruff",
  "declared_status": "missing",
  "dependency_status": "missing",
  "configured_status": "ready",
  "result": "action-required",
  "reason_code": "configured-dependency-undeclared"
}
```

扫描范围：

| Surface | 示例 | 处理 |
| --- | --- | --- |
| MCP config | `.claude/settings.json` / Codex MCP config | 解析 command、package、args、config scope |
| hooks | pre/post tool hooks、shell hook | 只提取命令名和来源，不执行 |
| permission allowlist | allow/deny tool command | 标 `allowed_status`，不代表命令可执行 |
| setup scripts | setup workflow 会调用的 helper scripts | 与 registry declared tools 比对 |
| verification commands | `spec-first.verification.json` / inferred package scripts | 比对 required tools |

结果消费：

- `runtime-setup` 生产 scan facts。
- `doctor` 汇总到 `decision_input_health_basis.configured_dependency_counts`。
- 下游 workflow 只把这些作为 advisory readiness；是否需要安装或降级由 LLM 判断。

---

## 5. 流程节点改造

## 5.1 `spec-first init`

### 当前保留

- 继续使用 `buildInitPlan` / `applyInitPlan`。
- 继续 managed runtime state。
- 继续 preview-first。
- 继续不手改 generated runtime mirrors。

### 建议新增

1. `runtime-generation-report.v1`
   - 写入或打印本次生成了哪些 command/skill/agent/support file。
   - 标明未执行 MCP/helper/provider setup。
   - 标明下一步建议。

2. 初始化后提示：

```text
Runtime assets generated.
Next:
  1. spec-first doctor --<host>        # inspect runtime projection
  2. $spec-runtime-setup --verify-only # inspect required harness runtime
  3. $spec-runtime-setup --plan        # preview install/config changes
```

3. 对 multi-repo workspace：
   - 继续 explicit target / all-repos 逻辑。
   - 不在 parent workspace 写 repo-local setup facts。

### 不建议

- 不给 `init` 加 `--install-mcp` 或 `--install-runtime`。
- 不在 `init -y` 中默认跑 `runtime-setup`。
- 不把 `mcp-tools.json` 或 helper registry 结果写进 managed runtime state。

## 5.2 `$spec-runtime-setup`

### 推荐主流程

```text
Phase 0: preflight
  check jq/node/npm/npx/python/git availability

Phase 1: detect
  detect MCP registry
  detect helper registry
  detect provider registry
  detect host configured dependencies
  detect hook / allowlist / script configured commands
  detect project target / workspace topology

Phase 2: plan
  build install/config/write plan
  classify required/recommended/optional
  classify explicit_apply_required
  classify install safety and review_required
  print action table

Phase 3: apply
  only when user explicitly requests install/repair/apply
  warmup MCP packages
  configure host MCP
  install helper CLI or skill
  optional provider init/refresh only by profile and safety_result

Phase 4: verify
  run detect again
  write readiness ledger
  write tool-facts/runtime-capabilities
  write scenario fingerprint
  render status table

Phase 5: handoff
  tell user what is ready, degraded, skipped, not-run
```

### Workflow 模式与脚本能力拆分

`$spec-runtime-setup` 是 host workflow，不应假设所有底层脚本都有同一套参数。现有脚本能力保持向后兼容：

| 当前脚本 | 已有能力 | 不应强行改写为 |
| --- | --- | --- |
| `install-mcp.sh` | `--only`、`--repo`、`--folder`、`--all-repos` | 不要求直接支持 `--plan` / `--install` |
| `install-helpers.sh` | `--install`、`--verify-only` | 不要求承担 MCP host config plan |
| `check-health` / `detect-tools.*` | preflight / readiness 检测 | 不执行安装 |
| `write-setup-facts.sh` | 写 setup facts / runtime capabilities | 不做安装或语义判断 |

Workflow-level mode 可以由 orchestrator 组合现有脚本和新增只读 renderer 实现：

| Workflow mode | 组合方式 | 写入边界 |
| --- | --- | --- |
| check | `detect-tools.*`、`install-helpers.* --verify-only`、`check-health`，但不调用 facts writer | 严格只读；不安装、不改 host config、不写 setup facts |
| verify-only / refresh-facts | detect + `verify-tools.*` + `write-setup-facts.*` | 可写 setup facts / ledger；不安装、不改 host config |
| plan | 新增 read-only setup-plan renderer，消费 detect 结果并输出 planned operations、risk_flags、write set | 不安装、不改 host config、不写 setup facts |
| apply | 复用 `install-mcp.sh` 与 `install-helpers.sh --install`，按 plan 执行 required 或 explicit optional action | 可写 host config、安装 required helper/provider |
| verify | `verify-tools.sh`、`write-setup-facts.sh`、status renderer | 写最终 setup facts / ledger |

### 建议 workflow argument 语义

以下是 `$spec-runtime-setup` 的 workflow-level 语义，不是要求每个 shell script 都实现同名 flag：

| 参数 | 语义 | 是否写入 |
| --- | --- | --- |
| `--check` | 只检测并打印当前状态 | 不写入、不安装 |
| `--verify-only` | 检测并写 verify ledger/setup facts；名称保留兼容 | 可写 setup facts；不安装 |
| `--refresh-facts` | `--verify-only` 的显式写 facts 别名 | 可写 setup facts；不安装 |
| `--plan` | 生成 install/config plan | 不安装、不改 host config |
| `--install` | 执行 required runtime install/config；跳过 `safety_result=blocked`，展示 `review-required` 风险 | 写 host config、安装 required helper |
| `--profile minimal` | 默认轻量 profile | 不安装 optional provider |
| `--profile recommended` | 推荐能力 profile | 生成 provider install plan；apply 需确认 |
| `--profile platform` | 团队 profile | 可安装 provider pack，但必须 explicit |
| `--only <id>` | 限定 tool/provider | 降低 blast radius |
| `--repo <path>` | 指定 child repo | 写入 child repo setup facts |
| `--all-repos` | parent workspace 全量 child repo | parent 只写 summary |

### Status table 建议

```text
Execution result
MCP servers
Helper tools
Provider tools
Host configured dependencies
Install safety
Project setup facts
Verification profile
Next steps
```

每行必须包含：

```text
id / kind / profile / required / baseline_blocking / dependency / configured / allowed / install / safety / result / reason_code / next_action
```

## 5.3 `spec-first doctor`

### 当前字段演进

`doctor` 当前 JSON：

```json
{
  "install_health": "...",
  "runtime_asset_health": "...",
  "host_readiness": "...",
  "decision_input_health": "not_checked",
  "decision_input_health_basis": null,
  "workflow_runnability": "..."
}
```

建议把 `decision_input_health` 从 `not_checked` 演进为：

| 状态 | 含义 |
| --- | --- |
| `pass` | setup facts fresh，required runtime ready |
| `warn` | setup facts fresh，但有 degraded/optional missing/not-run |
| `error` | required runtime action-required |
| `stale` | setup facts 超过 freshness window |
| `missing` | setup facts 不存在 |
| `not_checked` | 未选择或无法定位 host |

### Deterministic rollup

`decision_input_health` 必须由确定性 facts 汇总，不能由 LLM 语义判断填充：

| 条件 | status | reason_code |
| --- | --- | --- |
| 没有选择或检测到 Claude / Codex host | `not_checked` | `no-host-selected` |
| setup facts 缺失 | `missing` | `setup-facts-missing` |
| setup facts 不可读或 schema invalid | `error` | `setup-facts-invalid` |
| required MCP/helper 缺失，或 `baseline_ready=false` | `error` | `required-runtime-action-required` |
| setup facts 超过 freshness window | `stale` | `setup-facts-stale` |
| required runtime ready 且 facts fresh，但 optional provider/helper 缺失或 stale | `warn` | `optional-capability-degraded` |
| required runtime ready 且 facts fresh | `pass` | `setup-facts-ready` |

Provider missing/stale 不能让 minimal workflow 进入 `error`。`doctor` 只报告 readiness 与 reason_code；是否继续、降级、刷新或安装，由用户和下游 workflow 的 LLM judgment 决定。

`decision_input_health_basis` 必须 machine-readable：

```json
{
  "reason_code": "optional-capability-degraded",
  "artifact_refs": [
    ".spec-first/config/tool-facts.json",
    ".spec-first/config/runtime-capabilities.json"
  ],
  "schema_versions": {
    "tool_facts": "tool-facts.v2",
    "runtime_capabilities": "runtime-capabilities.v1"
  },
  "freshness": {
    "status": "fresh",
    "generated_at": "2026-06-03T00:00:00Z"
  },
  "required_action_count": 0,
  "degraded_count": 2,
  "skipped_count": 1,
  "configured_dependency_counts": {
    "action_required": 1,
    "undeclared": 1
  },
  "provider_counts": {
    "missing": 2,
    "stale": 1,
    "fresh": 0
  }
}
```

Human output 可以压缩展示，但 JSON 不应丢失 `reason_code`、artifact refs 和 counts。

### doctor 消费 artifacts

读取顺序：

1. host managed state：`.claude/spec-first/state.json` / `.codex/spec-first/state.json`
2. setup facts：`.spec-first/config/tool-facts.json`
3. runtime capabilities：`.spec-first/config/runtime-capabilities.json`
4. workspace summaries：`.spec-first/workspace/*summary.json`
5. workflow verification evidence：现有 `verification-evidence.json`

读取后先做 setup facts normalizer，再计算 rollup；不要让 `doctor` 分别在 v1/v2 分支里重复业务逻辑。

### doctor 不做的事

- 不直接调用 `install-mcp.sh`。
- 不直接调用 `install-helpers.sh --install`。
- 不写 host config。
- 不根据 provider facts 断言代码理解质量。

---

## 6. Provider 安装、启动、刷新边界

## 6.1 CodeGraph

| 阶段 | 行为 | 默认 |
| --- | --- | --- |
| detect | `command -v codegraph`、读取 project index marker | yes |
| plan | 输出安装/初始化/刷新建议 | yes |
| install | 根据 registry 执行安装命令 | explicit only |
| start | 若是 MCP/server，由 host 或 explicit command 拉起 | explicit / host-managed |
| refresh | dirty/fingerprint stale 时提示或受控刷新 | recommended/profile only |
| consume | workflow 用作 candidate files/symbols/impact | advisory |

默认不自动刷新。大型 review/debug 可建议刷新，但必须记录：

```text
provider=codegraph
freshness=stale
fallback=rg/source-read
reason_code=provider-index-stale
```

## 6.2 Graphify

| 阶段 | 行为 | 默认 |
| --- | --- | --- |
| detect | 检查 `graphify` CLI 和 `graphify-out/GRAPH_REPORT.md` | yes |
| plan | 输出 artifact refresh 建议 | yes |
| install | 安装 Graphify | explicit only |
| refresh | 默认不自动刷新，除非 `platform` profile 或 scenario overlay 明确允许 | no |
| consume | PRD/plan/doc-review 使用 module-map/context summary | advisory |

Graphify artifact stale 时：

- 可以作为“可能有历史结构”的线索。
- 不能作为 current-state confirmed evidence。
- final report 必须写 `stale advisory` 或 `not used`。

## 6.3 GBrain

| 阶段 | 行为 | 默认 |
| --- | --- | --- |
| detect | 检查 CLI/server/config/reachability | yes |
| recall | 按 query 召回 historical candidates | workflow explicit |
| write | 写长期记忆 | no |
| promote | verified learning -> durable memory | human / workflow gate |

默认不自动写入。允许写入的来源：

- `spec-compound` 生成并确认的 `docs/solutions/**`
- RCA / debug ledger 中 verified root cause
- reviewed ADR / decision doc
- 用户显式导入

不允许写入：

- 单轮推理过程。
- 未验证的 provider output。
- chat 中临时假设。
- stale/out-of-scope 但未标注状态的内容。

---

## 7. Workflow 消费方式

| Workflow | 消费 setup/verification facts | 行为 |
| --- | --- | --- |
| `using-spec-first` | 读取 scenario/setup freshness advisory | setup stale 时提示，但不阻塞轻量任务 |
| `spec-plan` | 读取 verification profile、provider readiness、context bundle | 计划中写 test strategy、degraded context、not-run risks |
| `spec-work` | 读取 verification profile 和 runtime readiness | 执行后把验证结果和 honest closeout 映射进现有 run artifact / final closeout |
| `spec-code-review` | 读取 provider readiness、diff/test evidence | provider 只用于扩大搜索范围；finding 需 source/diff/test 支撑 |
| `spec-doc-review` | 读取文档 claims 的 source evidence、provider freshness | provider stale 时记录 coverage limitation |
| `spec-debug` | 读取 helper/provider readiness 和 test/log command candidates | root cause 必须由 reproduction/source/log/test 确认 |
| `spec-prd` | 读取 Graphify/GBrain/CodeGraph candidates | current-state 声明需要 direct evidence |
| `spec-compound` | 读取 verification summary 和 closeout | 只沉淀 verified learning |
| `spec-runtime-setup` | 生产 dependency / provider facts | 不做语义判断 |
| `spec-update` | 检查 source/runtime drift | 不安装 optional provider |

---

## 8. 实施阶段

## Phase 1: Readiness Contract Baseline

目标：先解决事实表达。

改动面：

- `docs/contracts/provider-readiness.md`
- `skills/spec-mcp-setup/SKILL.md`
- `skills/spec-mcp-setup/helper-tools.json`
- `skills/spec-mcp-setup/provider-tools.json` 的 install safety metadata baseline
- dependency bootstrap status taxonomy mapping：`manual-review`、`needs-init`、`version-drift`、`installed-now`
- `skills/spec-mcp-setup/scripts/detect-tools.*`
- `skills/spec-mcp-setup/scripts/install-helpers.*`
- `skills/spec-mcp-setup/scripts/verify-tools.*`
- setup facts normalizer / status renderer
- `tests/unit/mcp-setup.sh`
- PowerShell parity tests

验收：

- helper registry 是唯一列表来源。
- `required`、`baseline_blocking`、`surface_overlay`、`demand_signals` 语义分离，`agent-browser` minimal 下不阻塞 baseline。
- install safety 输出 `risk_flags`、`pin_status`、`review_required`、`safety_result`。
- configured dependency scan 能报告 undeclared hook/script command。
- status renderer 能区分 installed、ready、manual-review、needs-init、version-drift、installed-now、failed。
- runtime checks、post-check commands、rollback hints、recommendations 分区显示，不混成单一 success/failure。
- setup facts 输出足够让 `doctor` 在 Phase 2 计算 dependency readiness projection，不新增并行 readiness artifact。
- `tool-facts.v1/v2` 通过 normalizer 被一致消费。
- `check-health` 和 `install-helpers` required/baseline 口径一致。
- `--verify-only` 不安装。
- `--check` 不写 setup facts。
- missing dependency 输出 reason_code。

## Phase 2: Doctor Consumption

目标：`doctor` 成为 setup facts 的消费者。

版本归属：v1.12 Host Projection / Doctor Consumption。本阶段消费 v1.11 产出的 setup facts 与 configured dependency scan facts，不重新定义 helper/provider registry。

改动面：

- `src/cli/commands/doctor.js`
- `tests/unit/doctor*.test.js` 或现有 doctor contract tests
- `docs/catalog/runtime-capabilities.md`
- README setup guidance

验收：

- `decision_input_health` 不再固定 `not_checked`。
- `decision_input_health_basis` 输出 artifact refs、freshness、counts 和 reason_code。
- setup facts missing/stale/action-required/degraded 能被区分。
- `doctor --json` 输出 machine-readable basis。

## Phase 3: Install Plan / Apply Split

目标：安装流程 preview-first。

改动面：

- `skills/spec-mcp-setup/SKILL.md`
- `install-mcp.*`
- `install-helpers.*`
- `configure-host.*`
- `verify-tools.*`
- status renderer
- bounded dependency audit / install command safety screening

验收：

- `--plan` 输出将要安装/配置/写入的内容。
- `--plan` 同时输出 install safety risk 和 blocked/review-required 项。
- `--install` 才执行安装或配置。
- `--install` 不执行 `safety_result=blocked` 项。
- warmup cache hit / install source / mirror used 有记录。
- host config write 有 backup/rollback 或 fail-closed。
- install/apply plan 默认不联系 registry、不运行 install scripts；含 shell metacharacter 的 verification/install command 进入 review-required 或 blocked。

## Phase 4: Verification Profile

目标：把真实验证执行与未执行原因结构化。

改动面：

- `docs/contracts/verification/verification-profile.md`
- `docs/contracts/verification/verification-run-summary.md`
- `src/cli/helpers/verification-profile.js`
- `src/cli/helpers/verification-run-summary.js`
- `src/cli/helpers/honest-closeout.js`
- `src/verification/profile-loader.js`
- optional `productSmoke` verification profile support
- quality contract required tools / red lines mapping
- `spec-work-run-artifact/v2` validation `run_summary_ref` mapping
- `spec-work` / `spec-debug` / `spec-code-review` prose
- focused tests

验收：

- 缺工具时记录 `not-run: missing_dependency`。
- dry-run 与 real verification 区分。
- shell / PowerShell / npm-script runner 的 required tools 可分别声明。
- `productSmoke` 没有真实 probe 时不能被写成 passed；空 probe 按 configured policy 输出 block/warn。
- quality contract 中的 required tools / red lines 只能作为 verification/profile 输入和 closeout 文案，不成为流程状态 truth。
- `spec-work` closeout 优先复用现有 run artifact，不另造 parallel closeout truth。
- final response 能引用真实 command/log/status。

## Phase 5: Optional Provider Pack

目标：作为边界预留，说明 setup/readiness facts 如何支撑后续 CodeGraph / Graphify / GBrain 接入；本阶段不作为本子方案的实施范围。v1.16 Optional Provider Pack 的具体实施依据是父方案 + `CodeGraph技术方案.md`。

后续 v1.16 参考改动面（不在本子方案开工）：

- `skills/spec-mcp-setup/provider-tools.json`
- `docs/contracts/provider-readiness.md`（只引用父方案 canonical，不在本阶段重定义）
- `CodeGraph技术方案.md` 对齐实施状态
- memory provider candidate/review/promote write-mode rules
- optional skills registry metadata import lens
- provider readiness tests

后续 v1.16 参考验收边界：

- minimal profile 不安装 provider。
- provider `not-run` 不阻塞普通 docs/plan/work。
- stale provider 不产生 confirmed truth。
- freshness 由 repo HEAD / source fingerprint / provider index marker / query ledger 计算。
- explicit refresh 行为可记录 freshness 变化。
- memory provider 默认 `writeMode=disabled/candidate-only`；只有 verified learning / user confirmed import 才能 promote。
- third-party skills registry 只抽取 source/risk/tier/status metadata，不批量安装、不常驻 prompt context。

---

## 9. 测试策略

## 9.1 必跑测试

每次修改 setup scripts / contract：

```bash
bash skills/spec-mcp-setup/scripts/check-health --json
bash -n skills/spec-mcp-setup/scripts/*.sh
npm run test:mcp-setup
```

涉及 CLI：

```bash
npm run typecheck
npm run test:unit
```

涉及 runtime projection：

```bash
npm run test:smoke
spec-first init --claude -y
spec-first init --codex -y
spec-first doctor --claude --json
spec-first doctor --codex --json
```

## 9.2 Fixture 覆盖

需要覆盖：

| Fixture | 断言 |
| --- | --- |
| missing `jq` | setup preflight fail with install suggestion |
| Windows native PowerShell missing `jq` | PowerShell path 不因 Bash-only required tool 失败 |
| missing helper required | `result=action-required`、`reason_code=missing_dependency` |
| optional helper missing | `result=degraded/skipped`，不阻断 baseline |
| `agent-browser` minimal missing | `baseline_blocking=false`、`result=skipped/degraded`、next action 指向 surface opt-in |
| `agent-browser` surface-ui demand | demand signal 存在时升级为 action-required 或 install plan |
| configured MCP missing host config | `host_config_status=action-required` |
| configured hook undeclared tool | `configured_dependencies[].reason_code=configured-dependency-undeclared` |
| configured MCP optional surface | 已配置 `postgres` / `playwright` 但 minimal 下不标 baseline blocker |
| higher-precedence Codex config conflict | `precedence-blocked` |
| parent workspace | parent 只写 summary，不写 child setup facts |
| `--check` mode | 不写 `.spec-first/config/tool-facts.json` / `runtime-capabilities.json` |
| `--verify-only` mode | 可写 setup facts，但不安装、不改 host config |
| unpinned `npx -y` install command | `risk_flags` 包含 `unpinned-npx`、`safety_result=review-required` |
| installer script / unknown source | `safety_result=blocked` 或 `review-required`，不 silent apply |
| shell metacharacter command | install/verification plan 标 `review-required` 或 `blocked`，不默认 shell expansion |
| `tool-facts.v1` | normalizer 输出缺省字段，doctor 不崩溃 |
| `tool-facts.v2` | doctor 消费 configured dependencies、helper/provider counts |
| bootstrap status taxonomy | `manual-review`、`needs-init`、`version-drift` 不被折叠成 generic missing |
| provider stale | `freshness=stale`、fallback visible |
| provider query not verified | `query_verified=false` |
| memory provider write disabled | GBrain/agentmemory 缺 write permission 时仍可 recall candidate，但不能 promote |
| skill registry risky entry | `global-install` / `installer-script` / `unknown-source` 触发 review-required 或 blocked |
| verification missing tool | `status=not-run`、`missing_tools[]` |
| verification runner-specific tools | shell / PowerShell required tools 分开计算 |
| product smoke empty probe | 未配置真实 probe 时不能标 passed |
| dry-run | `status=schedulable`，不写 `passed` |

## 9.3 不声称的验证

以下不能由单元测试或 setup 成功直接证明：

- GBrain 召回内容正确。
- CodeGraph impact 完整。
- Graphify artifact 与当前代码一致。
- workflow review finding 正确。
- 业务测试覆盖充分。

这些必须由 workflow 层结合 direct evidence 判断。

---

## 10. 风险与反模式

| 风险 | 反模式 | 防护 |
| --- | --- | --- |
| setup 变重 | 默认安装 recommended/platform 全套工具 | minimal 默认，explicit profile |
| 多真相源 | `check-health`、`install-helpers`、docs 各写一份工具表 | registry 单一来源 |
| registry 只是搬家 | 把硬编码列表搬到 JSON，但 required/baseline/surface 仍混用 | schema 明确 `baseline_blocking`、`surface_overlays`、`demand_signals` |
| 安装安全被弱化 | `@latest`、`npx -y`、installer script 在 `--install` 中静默执行 | install safety lens + review-required / blocked |
| verify-only 误导 | 用户以为 `--verify-only` 完全只读 | 新增 `--check`；`--verify-only` 明示会写 setup facts |
| hook 隐含依赖 | runtime hook 调 `ruff` 等未声明工具 | configured dependency scan |
| schema 版本漂移 | `tool-facts.v1/v2` 消费端各自解释 | setup facts normalizer |
| provider 过度信任 | 用 CodeGraph output 直接写 review finding | provider facts 标 advisory，finding 需 source evidence |
| silent mutation | `doctor` 或 `init` 顺手安装/修复 | doctor/init read-only 或 runtime projection only |
| not-run 被美化 | 缺工具后 final 写“验证通过” | verification-run-summary 强制 `ran=false` |
| optional 变 required | GBrain/Graphify missing 让普通工作流失败 | profile + baseline_blocking |
| global install 污染 | 自动 `npm install -g` | explicit apply + install source + version/pin |
| 状态机入侵 | 复制 `.scale/workflow.json` / G0-G22 作为 spec-first 流程 truth | 只吸收事实字段和风险 lens，workflow 仍由 LLM judgment 驱动 |

---

## 11. 最小可维护落地顺序

1. **先做 helper registry + bootstrap status taxonomy**
   - 收敛 `install-helpers` / `check-health` 漂移。
   - 同时解决 `required` / `baseline_blocking` / `surface_overlay` / `demand_signals`，否则只是把硬编码搬到 JSON。
   - 同步吸收 `manual-review`、`needs-init`、`version-drift`、post-check、rollback hint 这些报告字段。

2. **再做 install safety + configured dependency scan**
   - 让 `--plan` 能诚实展示 global install、unpinned npx、installer script、hook undeclared tool。
   - 这是吸收 `scale-os-config-claude-code` 安装面分析的关键。
   - 同步纳入 bounded dependency audit 的本地安全检查和 shell metacharacter 防护。

3. **再拆 `runtime-setup` plan/apply**
   - 把用户语义做清楚，降低 silent mutation 风险。

4. **再做 `doctor` 消费 setup facts**
   - 让用户能从一个命令看到 readiness 层级。
   - 不改变安装行为，风险低。
   - 版本归属是 v1.12；v1.11 只保证 facts producer 和 plan/apply 边界可用。

5. **再做 verification profile / run summary**
   - 把“哪些真实跑过”变成 durable evidence。
   - 优先复用 `spec-work-run-artifact/v2`，不新增 closeout truth。
   - product smoke 和 quality contract 只作为 optional profile / red-line input，不成为状态机。

6. **最后接 optional provider**
   - CodeGraph / Graphify / GBrain 等能力依赖前面 facts/freshness/fallback contract。
   - skills registry、memory provider、resource governance 先作为 metadata/advisory lens 接入。

---

## 12. 与版本路线对齐

| 版本路线 | 本方案对应内容 |
| --- | --- |
| v1.11 Dependency Readiness Baseline | Phase 1、Phase 3、configured dependency scan facts producer |
| v1.12 Claude / Codex Host Projection / Doctor Consumption | Phase 2、`init` generation report、`doctor` 消费 setup/configured dependency facts 并输出 `decision_input_health_basis` |
| v1.13 Verification + Honest Closeout | verification-profile、verification-run-summary、**honest-closeout（结构化 claim + not-run disclosure）**（helper registry 属 v1.11 / Phase 1，不在本行重复列入） |
| v1.14 Governance Lens Foundation | 非本子方案主要实施范围；仅保留与 setup/verification facts 的消费边界 |
| v1.15 Knowledge Harness | 非本子方案主要实施范围；仅保留 provider-absent / `docs/solutions` promotion 边界 |
| v1.16 Optional Provider Pack | 非本子方案主要实施范围；具体 CodeGraph / Graphify / GBrain provider readiness、adapter 和 consumer 以父方案 + `CodeGraph技术方案.md` 为准 |
| v1.17 Governance Maturity | 非本子方案主要实施范围；仅保留 RuleMaturity / evidence hardening 的依赖说明 |

时序权威：相位与 P0 归属以父方案 §8 / §10 为准。honest-closeout 的 deterministic 牙齿依赖 verification-run-summary 的真实 exit_code（见父方案 §4.4），因此二者**同相位（父方案 Phase B / P0）**，本表已把 honest-closeout 上移到 v1.13 与 verification-profile 同批，不再拖到治理阶段；v1.14 先交付 governance lens foundation，v1.17 只做 governance maturity / hardening。

本方案不替代版本路线文档；它是 v1.11-v1.13 的技术方案输入，并只为 v1.16 provider pack 留出 setup/readiness 边界，不作为 provider pack 的开工入口。

---

## 13. 验收标准

> 消费侧验收门槛（继承父方案 §9.0.1）：本方案的 setup/readiness facts 分两层验收。第一层是 v1.11+v1.12 的 direct deterministic consumer gate：`doctor --json` 必须从 setup facts 计算 `decision_input_health`，并在 `decision_input_health_basis.artifact_refs` 指向被消费的 facts；否则 v1.11 仍是无人消费的 facts producer，不得单独宣称完成。第二层是 workflow consumer gate：§7 矩阵中的 named workflow 必须在指定 consuming Phase 因消费这些 projection 产生**可观察行为变化**（如 v1.13 `spec-work` closeout 基于 readiness / verification facts 区分 verified、not-run、degraded），否则该 capability 仍停在 advisory，不计入最终 workflow 价值完成。`doctor` 是 direct consumer，不冒充 §7 named workflow。

完成后，用户应能从 `spec-first` 得到以下明确答案：

1. `spec-first init` 生成了哪些 runtime assets，哪些 setup 没有运行。
2. `$spec-runtime-setup --check` 能只读检查依赖，不写 setup facts。
3. `$spec-runtime-setup --verify-only` 检查并刷新 setup facts，同时明确哪些依赖缺失、降级、跳过。
4. `$spec-runtime-setup --plan` 会告诉用户将安装/配置/写入什么，并展示 install safety 风险。
5. `$spec-runtime-setup --install` 才会执行安装或 host config 写入，且不会 silent apply blocked install。
6. `spec-first doctor --json` 能读取 setup facts 并给出 `decision_input_health` 与 `decision_input_health_basis`。
7. host MCP / hook / allowlist / script command 的 configured dependencies 能被报告为 ready/action-required/degraded。
8. `agent-browser` 等 surface-specific helper 不会在 minimal profile 下误作 baseline blocker。
9. `spec-work` / `spec-debug` / `spec-code-review` final closeout 能区分 verified、not-run、skipped、degraded、provider advisory。
10. GBrain / Graphify / CodeGraph 缺失不会阻塞 minimal workflow。
11. provider 输出不会替代 source/test/log/contract evidence。

---

## 14. 本方案未执行项

本方案只写设计，不执行以下动作：

- 未修改 `src/cli` 或 `skills/spec-mcp-setup/scripts`。
- 未运行安装命令。
- 未启动 MCP server。
- 未启动、安装或刷新 CodeGraph / Graphify / GBrain。
- 未运行 `spec-first init`。
- 未运行测试。

后续进入 implementation 时，需要按本仓库规则同步更新 `CHANGELOG.md`、相关 docs/contracts、测试和必要 README。
