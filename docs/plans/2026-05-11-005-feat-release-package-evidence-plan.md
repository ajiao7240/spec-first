---
title: "feat: release/package evidence v1"
type: feat
status: completed
date: 2026-05-11
spec_id: 2026-05-11-005-release-package-evidence
origin: docs/2026-05-10/spec-first-full-code-review-and-competitor-benchmark.md
origin_issue: P2-007
---

# feat: release/package evidence v1

## 摘要

本计划交付 `docs/2026-05-10/spec-first-full-code-review-and-competitor-benchmark.md` 中 `P2-007 release/package smoke 已强，但 dry-run 与 package evidence 可更细` 的 v1。目标不是重做发布系统，而是在现有 `npm install matrix` 与 `test:release` 基础上补齐三个确定性证据：

1. package content manifest：发布包实际包含哪些文件、关键目录是否存在、禁入路径是否缺席。
2. tarball-installed `init --claude --dry-run` / `init --codex --dry-run` evidence：证明安装后的 CLI 能预览 runtime 写入且不修改项目。
3. release artifact summary：给维护者、release 页面或后续 `spec-release-notes` 一个可直接读取的 JSON 摘要，而不是解析长日志。

设计保持 light contract：脚本只产出可验证事实、artifact path、reason_code 和 exit code；是否足以发布仍由维护者或 LLM reviewer 结合上下文判断。v1 不引入 release dashboard、不新增 telemetry 平台、不扩大 GitHub Actions matrix，也不把 AI dev benchmark advisory signal 变成 release hard gate。

## 问题框架

当前 release/package 路径已经具备较强基线：

- `scripts/npm-install-matrix-smoke.js` 会在临时目录中 `npm pack`、全局安装 tarball、运行 `help/version/init/doctor`，并写入 `summary.json` 与 `pack-output.log`。
- `.github/workflows/npm-install-matrix.yml` 覆盖 `ubuntu-latest`、`macos-latest`、`windows-latest` 与 Node 20/22/24，Windows 同时跑 `pwsh` 和 `cmd`。
- `npm run test:release` 串联 release governance 与 tarball install smoke；`scripts/release-publish.cjs` 在 pack/publish 前运行 release gate 和 website sync gate。

剩余问题是 evidence 粒度不够：发布失败时维护者仍需要读日志推断 tarball 内容、dry-run 行为和 release artifact 状态；发布页面或 release notes 也缺少一个轻量 JSON 可以直接消费。

## 目标

- G1. 在现有 matrix smoke artifact 目录中生成 `package-content-manifest.json`，记录 npm pack dry-run JSON 的核心文件清单与关键路径检查结果。
- G2. 在 tarball-installed CLI 上执行 `init --claude --dry-run` 与 `init --codex --dry-run`，把 stdout/stderr、exit code、mutation check 结果写入 artifacts。
- G3. 生成 `release-artifact-summary.json`，汇总 pack、install、CLI smoke、init dry-run、package content manifest 和关键 artifact paths。
- G4. 保持现有 `npm run test:release` / `npm run test:release:install` 入口，不新增重复 install telemetry 或新的 CI matrix。
- G5. 让 failure 输出带明确 `reason_code`，便于 release reviewer 直接定位 package content、dry-run preview、install smoke 或 artifact write 的失败类别。

## 非目标

- 不新增 release dashboard、history store、leaderboard、外部 telemetry 或数据库。
- 不自动创建 GitHub Release、不发布 npm README、不改写官网仓库 source。
- 不把 `npm run test:ai-dev:gate` 或 benchmark advisory signal 接入 release hard gate；如后续 release evidence 需要引用 AI dev gate result，应作为独立 artifact pointer 处理。
- 不扩展 OS/Node/shell matrix；现有 matrix 只补 evidence，不扩大维度。
- 不把 `init --dry-run` 预览结果当作 runtime source truth；source-of-truth 仍是 `skills/`、`agents/`、`templates/`、`src/cli/` 等 source 文件。
- 不手改 `.claude/`、`.codex/` 或 `.agents/skills/` generated runtime mirrors。

## 需求

- R1. `scripts/npm-install-matrix-smoke.js` 必须在 `SPEC_FIRST_SMOKE_ARTIFACT_DIR` 存在时写入：
  - `summary.json`（保留现有职责，追加 artifact 指针）
  - `pack-output.log`（保留）
  - `package-content-manifest.json`
  - `init-claude-dry-run.log`
  - `init-codex-dry-run.log`
  - `release-artifact-summary.json`
- R2. `package-content-manifest.json` 必须来自 deterministic package evidence，优先使用 `npm pack --dry-run --json` 的 `files[].path` / `size` / `mode`，不能通过手写 allowlist 假装实际包内容。
- R3. package content manifest 必须至少记录 `file_count`、`files[]`、`required_paths[]`、`forbidden_paths[]`、`checks[]`、`passed`；路径必须是 package-relative POSIX path。
- R4. required path v1 至少覆盖 `bin/spec-first.js`、`src/cli/index.js`、`skills/spec-work/SKILL.md`、`skills/spec-plan/SKILL.md`、`templates/claude/commands/spec/work.md`、`README.md`。
- R5. forbidden path v1 至少覆盖 generated/runtime-only 或已退役内容：`.claude-plugin/`、`.claude/`、`.codex/`、`.agents/skills/`、`src/crg/`、`vendor/`、`__pycache__/`、`*.pyc`、`*.pyo`。
- R6. `init --dry-run` evidence 必须使用 tarball-installed CLI，而不是 repo source CLI；每个 host 各写一个独立 log，并在 summary 中记录 exit code、是否包含 dry-run 标识、是否保持 fixture project tree 不变。
- R7. `release-artifact-summary.json` 必须是 release 页面可消费的轻量摘要，包含 schema version、status、platform、node version、package name/version、tarball name、artifact paths、checks summary 和 failures；不能包含本机绝对路径作为公共 artifact path。
- R8. `npm run test:release:install` 继续作为本地 release install smoke；GitHub Actions 继续上传 `.spec-first/ci/npm-install-matrix/`，不需要额外 upload step。
- R9. Unit tests 必须覆盖 manifest 生成、forbidden/required path checks、dry-run no-mutation evidence、summary artifact 指针、workflow path filter。
- R10. 文档更新只说明 release evidence 的 artifact 形态与边界，不把 v1 包装成完整 release observability 平台。

## 设计决策

- D1. 复用 `scripts/npm-install-matrix-smoke.js`，不新增第二套 release evidence runner。理由：现有脚本已经拥有 tarball pack/install、cross-platform path、artifact writer 和 Actions matrix 上下文，新增 runner 会造成重复 telemetry。
- D2. 使用 npm pack dry-run JSON 生成 package content manifest。理由：这是 npm 官方 pack 视角的确定性事实，比手写文件扫描更接近真实发布包。
- D3. `init --dry-run` 只在 tarball-installed CLI 上执行。理由：P2-007 要证明 package 用户拿到的 CLI 行为，而不是 repo source 当前行为。
- D4. `release-artifact-summary.json` 与 `summary.json` 并存。理由：保留既有 smoke summary 兼容性，同时提供面向 release consumer 的更稳定摘要。
- D5. Path 输出分两类：本地调试字段可保留临时目录路径，release consumer 字段必须使用 artifact-relative name。理由：维护者排障需要本地路径，但 durable/release 页面不应消费机器路径。
- D6. 不在 v1 增加正式 release quality gate schema 平台。理由：一个轻量 `docs/contracts/release-package-evidence.schema.json` 足够约束 summary shape；更复杂的 release evidence registry 等到有多个 consumer 再做。

## 过度设计防线

### v1 必须完成

- 扩展现有 install matrix smoke artifact writer。
- 增加 package content manifest、两个 init dry-run logs、release artifact summary。
- 增加聚焦 unit tests 和 release install smoke 验证。
- 更新 README/runtime catalog 或 review 文档中的轻量说明，以及 `CHANGELOG.md`。

### v1 必须延后

- Release dashboard、历史趋势、artifact registry、评分系统。
- GitHub Release 自动发布或 release notes 自动回写。
- AI benchmark/advisory gate 与 release hard gate 的合并。
- 新 OS/Node/shell matrix 维度。
- 对 generated runtime mirror 做 source 级 patch。

### 停止条件

实施中如果需要新增长期数据库、复杂 artifact registry、重写 `release-publish.cjs` 发布状态机、或让脚本判断“是否值得发布”，应停止并回到 plan/doc-review。P2-007 只增强确定性 evidence，不改变发布决策权。

## 文件计划

新增：

- `docs/contracts/release-package-evidence.schema.json`

修改：

- `scripts/npm-install-matrix-smoke.js`
- `tests/unit/npm-install-matrix-smoke.test.js`
- `.github/workflows/npm-install-matrix.yml`
- `README.md`
- `README.zh-CN.md`
- `docs/catalog/runtime-capabilities.md`
- `docs/2026-05-10/spec-first-full-code-review-and-competitor-benchmark.md`
- `CHANGELOG.md`

仅在实现需要时修改：

- `tests/unit/package-install-contracts.test.js`
- `scripts/run-test-suite.cjs`

不修改：

- `scripts/release-publish.cjs`，除非实现时发现 `test:release` 无法自然消费新增 evidence。
- `.claude/`、`.codex/`、`.agents/skills/` generated runtime assets。

## 实施单元

### U1. 定义 release package evidence summary contract

- 目标：用一个轻量 schema 固定 release consumer 可读取的 summary shape。
- 修改：`docs/contracts/release-package-evidence.schema.json`、`tests/unit/npm-install-matrix-smoke.test.js`。
- Approach：schema 只约束 `schema_version`、`status`、`package`、`environment`、`artifacts`、`checks`、`failures`，不表达发布结论或语义评分。
- Test scenarios：
  - valid summary 通过 schema。
  - missing `artifacts.package_content_manifest` 被拒绝。
  - public artifact path 为绝对路径时被拒绝。
  - `status=failed` 时必须有 `failures[]`。
- Verification：`npx jest tests/unit/npm-install-matrix-smoke.test.js --runInBand`。

### U2. 生成 package content manifest

- 目标：把 npm pack 视角的实际包内容固化为 artifact。
- 修改：`scripts/npm-install-matrix-smoke.js`、`tests/unit/npm-install-matrix-smoke.test.js`。
- Approach：新增纯函数解析 `npm pack --dry-run --json` 输出，生成 `package-content-manifest.json`；manifest 只记录 package-relative POSIX paths 和必要 metadata。实际 pack/install 流程保持现状。
- Test scenarios：
  - npm pack JSON 中的 files 被规范化为 POSIX path。
  - required paths 缺失时 manifest `passed=false` 且 reason_code 指向 `required-package-path-missing`。
  - forbidden paths 出现时 manifest `passed=false` 且 reason_code 指向 `forbidden-package-path-present`。
  - `__pycache__` / `.pyc` / `.pyo` 被 forbidden check 捕获。
- Verification：`node --check scripts/npm-install-matrix-smoke.js`、`npx jest tests/unit/npm-install-matrix-smoke.test.js --runInBand`。

### U3. 捕获 tarball-installed init dry-run evidence

- 目标：证明发布包里的 CLI 能 dry-run 预览 Claude/Codex runtime 初始化且不写文件。
- 修改：`scripts/npm-install-matrix-smoke.js`、`tests/unit/npm-install-matrix-smoke.test.js`。
- Approach：在已安装 tarball 后创建独立 fixture project，分别运行 `runInstalledBin(packageRoot, ['init', '--claude', '--dry-run', '-u', 'matrix', '--lang', 'en'])` 与 Codex 等价命令；执行前后 snapshot tree，写 log 与 no-mutation result。
- Test scenarios：
  - dry-run stdout 包含 `Dry run: spec-first init (claude)` / `(codex)`。
  - dry-run 后 fixture project tree 与执行前一致。
  - nonzero exit 被写入 summary failures，reason_code 为 `init-dry-run-failed`。
  - log artifact 文件名仍通过 `normalizeArtifactFileName` 安全校验。
- Verification：`npx jest tests/unit/npm-install-matrix-smoke.test.js --runInBand`、`npm run test:release:install`。

### U4. 写 release artifact summary 并保持 CI 上传路径

- 目标：让 release 页面或 reviewer 不解析长日志即可读取发布包证据。
- 修改：`scripts/npm-install-matrix-smoke.js`、`.github/workflows/npm-install-matrix.yml`、`tests/unit/npm-install-matrix-smoke.test.js`。
- Approach：在 success/failure 路径都写 `release-artifact-summary.json`；`summary.json` 保持现有字段并追加 `release_artifact_summary`、`package_content_manifest`、`init_dry_run_artifacts` 指针。Actions workflow 只更新 path filters，继续上传 `.spec-first/ci/npm-install-matrix/`。
- Test scenarios：
  - success summary 包含 package manifest、dry-run logs、pack-output log 的 artifact-relative paths。
  - failure summary 包含 reason_code 与已写出的 artifact paths。
  - workflow path filters 包含新增 contract/schema 和相关 test 文件。
  - upload step 不新增重复 artifact name。
- Verification：`npx jest tests/unit/npm-install-matrix-smoke.test.js --runInBand`、`npm run test:release:install`。

### U5. 文档与 P2-007 状态回写

- 目标：让维护者理解 release evidence v1 的能力边界。
- 修改：`README.md`、`README.zh-CN.md`、`docs/catalog/runtime-capabilities.md`、`docs/2026-05-10/spec-first-full-code-review-and-competitor-benchmark.md`、`CHANGELOG.md`。
- Approach：README 只补 release command/evidence 一两句；runtime catalog 增加 release/package evidence artifact 表；review/benchmark 文档把 P2-007 标为 `v1 planned` 或实现后标为 `v1 fixed`，不得声称已有 dashboard 或 release hard gate。
- Test scenarios：
  - docs 中明确 scripts 产出事实，发布判断仍由维护者/LLM reviewer 做。
  - `CHANGELOG.md` 最新日期条目满足当前 Codex developer profile 作者格式。
- Verification：`npx jest tests/unit/changelog-format.test.js --runInBand`、`git diff --check`。

## 验证计划

最小验证：

- `node --check scripts/npm-install-matrix-smoke.js`
- `npx jest tests/unit/npm-install-matrix-smoke.test.js tests/unit/changelog-format.test.js --runInBand`
- `npm run test:release:install`
- `git diff --check`

扩展验证：

- `npm run test:release`
- `npm run build`
- `npm run typecheck`

如果实现触及 `run-test-suite.cjs`、`release-publish.cjs` 或 package files contract，再补：

- `npx jest tests/unit/package-install-contracts.test.js tests/unit/release-publish.test.js --runInBand`

## 风险与缓解

| 风险 | 缓解 |
| --- | --- |
| evidence 变成第二套 release runner | 复用 `npm-install-matrix-smoke.js`，只扩展 artifact，不新增并行 install telemetry。 |
| package manifest 与真实 tarball 不一致 | 使用 `npm pack --dry-run --json` 作为 npm 视角事实；实现时保留 raw `pack-output.log` 和 tarball install smoke。 |
| dry-run evidence 意外写文件 | 执行前后 snapshot fixture project，summary 写 `mutated=false/true` 并失败。 |
| release summary 泄漏本机绝对路径 | public artifact path 字段只使用 artifact-relative filename；本地调试路径与 release consumer path 分开。 |
| CI artifact 体积膨胀 | v1 只写几个小 JSON/log 文件，不上传 tarball 本体或长期历史。 |
| P2-007 被误解为 release observability 平台 | docs 明确 v1 是 deterministic evidence，不是 dashboard/history/release decision engine。 |

## Handoff

推荐下一步执行：

```text
$spec-work docs/plans/2026-05-11-005-feat-release-package-evidence-plan.md
```

本计划范围中等偏小，可直接进入 `$spec-work`。如果执行者想进一步压缩，可先用 standalone `spec-write-tasks` 拆成 U1-U5 task pack。
