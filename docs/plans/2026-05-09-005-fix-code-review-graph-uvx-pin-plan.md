---
title: fix: pin code-review-graph uvx provider commands
type: fix
status: active
date: 2026-05-09
spec_id: 2026-05-09-005-code-review-graph-uvx-pin
---

## Summary

本轻量计划解决 `code-review-graph` 默认通过 `uvx --upgrade code-review-graph` 执行导致的 uv cache 膨胀与版本不可证明问题。核心策略是把默认 graph-bootstrap 热路径改为 source-first 的 pinned provider identity，去掉日常路径里的 `--upgrade`，并把“跟随最新版本”保留给显式更新 / probe 路径。

---

## Problem Frame

当前 `spec-mcp-setup` 将 `code-review-graph` 投影为 floating `uvx --upgrade code-review-graph ...` 命令，`spec-graph-bootstrap` 再按配置依次执行 `build`、`status`、`status --repo <repo-root>`。这会让每次维护性 graph-bootstrap 都有机会解析最新包并创建新的 uv cached tool environment。

本地缓存调查显示，大量 `archive-v0` 环境来自 `code-review-graph`，主要空间由其依赖 `tree_sitter_language_pack` 占用。已有 `docs/plans/2026-05-09-003-feat-graph-bootstrap-fast-reuse-plan.md` 将 `code-review-graph` pin 作为后续项；本计划把该后续项拆成 80/20 快速修复，先消除默认热路径的 floating upgrade 与版本不可证明，再考虑更大的 fast reuse / 并行化优化。

---

## Requirements

- R1. `code-review-graph` 默认 provider command 必须使用 pinned package identity，不能继续在 graph-bootstrap 热路径使用 `uvx --upgrade code-review-graph`。
- R2. `skills/spec-mcp-setup/mcp-tools.json` 必须成为 `code-review-graph` package/version 的 source-of-truth，保持与 GitNexus pin 治理模式一致。
- R3. `.spec-first/config/graph-providers.json` 的 generated provider commands 必须由 source pin 投影产生，不手改 generated runtime/config artifact。
- R4. `spec-graph-bootstrap` command shape validator 必须接受安全的 pinned `code-review-graph@<version>` package spec，并拒绝任意包名、`@latest` 默认路径或 shell 元字符逃逸。
- R5. 文档必须明确：日常 graph-bootstrap 使用 pinned 版本；显式 update/probe 才允许查询或切换 latest。
- R6. 测试必须覆盖 Bash/PowerShell parity、fixture 命令形态和失败诊断，不因命令形态变化削弱 readiness contract。
- R7. 不自动清理用户 uv cache；只提供一次性人工清理建议。

---

## Assumptions

- A1. 当前优先目标是快速停止重复产生大型 uv tool env，而不是一次性实现完整 provider cache 管理器。
- A2. `code-review-graph` 当前可用稳定版本以本次调查中已出现的 `2.3.3` 作为初始 pin；后续版本升级通过 source pin 变更和 changelog 记录完成。
- A3. 用户接受“默认稳定 + 显式更新”的治理模型：日常 workflow 不自动追 latest，避免同一 command string 背后 provider 行为静默变化。

---

## Scope Boundaries

### In Scope

- 为 `code-review-graph` 增加 source-level package/version identity。
- 将 projected commands 改为 pinned `uvx code-review-graph@<version> ...`。
- 更新 graph-bootstrap Bash/PowerShell command validation contract。
- 更新相关 unit/contract tests、skill prose、CHANGELOG。
- 给出 `uv cache clean code-review-graph` 作为人工运维建议。

### Out of Scope

- 不实现 uv cache scanner 或 archive-v0 目录清理逻辑。
- 不在 graph-bootstrap 中自动执行 `uv cache clean`。
- 不把 `uv tool install code-review-graph` 作为第一阶段默认路径。
- 不实现完整 fast reuse、provider 并行化或 all-repos 并行化；这些仍属于 `docs/plans/2026-05-09-003-feat-graph-bootstrap-fast-reuse-plan.md` 的更大优化边界。
- 不手改 `.claude/`、`.codex/`、`.agents/skills/` 或 `.spec-first/config/graph-providers.json`。

---

## Source-of-Truth And Runtime Boundary

- Source-of-truth:
  - `skills/spec-mcp-setup/mcp-tools.json`
  - `skills/spec-mcp-setup/scripts/write-provider-config.sh`
  - `skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh`
  - `skills/spec-graph-bootstrap/scripts/bootstrap-providers.ps1`
  - `skills/spec-graph-bootstrap/SKILL.md`
  - tests and `CHANGELOG.md`
- Generated / local runtime artifacts:
  - `.spec-first/config/graph-providers.json`
  - `.spec-first/graph/**`
  - `.claude/`, `.codex/`, `.agents/skills/`

Implementation should update source first. Regenerating local runtime config is an execution-time verification step, not a replacement for source changes.

---

## Context & Evidence

- `skills/spec-mcp-setup/mcp-tools.json` currently defines `code-review-graph` warmup and host config commands with `uvx --upgrade code-review-graph`.
- `skills/spec-mcp-setup/scripts/write-provider-config.sh` hardcodes generated graph provider commands as `uvx --upgrade code-review-graph build/status`.
- `skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh` validates and executes configured provider command arrays; its current `crg_tail` logic does not obviously accept `code-review-graph@2.3.3` package syntax.
- `skills/spec-graph-bootstrap/SKILL.md` already documents `code-review-graph` as `version_policy=floating-unverifiable` and `reuse_eligible=false`.
- `tests/unit/spec-graph-bootstrap.sh` contains uvx fixtures and provider command JSON fixtures that currently match the floating command shape.
- `docs/plans/2026-05-09-003-feat-graph-bootstrap-fast-reuse-plan.md` defers CRG pinning; this plan pulls that narrow piece forward.

---

## Key Technical Decisions

1. **Pin package identity in source, not generated config.** `mcp-tools.json` should carry `package` + `version` or equivalent fields for `code-review-graph`; `write-provider-config.sh` should project commands from those fields.
2. **Remove `--upgrade` from daily graph-bootstrap commands.** Default command shape should be `uvx code-review-graph@<version> build/status/...` so repeated runs can reuse the same package identity.
3. **Keep latest tracking explicit.** Future upgrade flow may run `uvx code-review-graph@latest --version` or update the pin, but graph-bootstrap should not resolve latest implicitly.
4. **Fail closed on command validation.** The validator should accept only `uvx code-review-graph@<exact-safe-version> <allowed-subcommand>` on the desired path. It must reject arbitrary uvx packages, shell 元字符, unexpected args, and `code-review-graph@latest` in daily graph-bootstrap; legacy `uvx --upgrade code-review-graph ...` may only be surfaced as stale generated config / action-required diagnostics, not treated as current desired state.
5. **Do not solve cache cleanup in code.** Cache cleanup is a one-time operator action after source fix lands, not a spec-first runtime responsibility.

---

## Implementation Units

### U1. Add source-level code-review-graph package/version pin

**Goal:** Make `code-review-graph` version identity explicit and source-owned.

**Requirements:** R1, R2, R5

**Files:**

- Modify: `skills/spec-mcp-setup/mcp-tools.json`
- Modify: `skills/spec-mcp-setup/SKILL.md` if the setup prose discusses graph provider package/version policy
- Test: `tests/unit/spec-graph-bootstrap.sh` or existing mcp-setup contract tests that inspect provider package projection

**Approach:**

- Add `package` and `version` fields for `code-review-graph`, mirroring the GitNexus package/version model where practical.
- Set the initial pin to `code-review-graph@2.3.3` unless implementation-time package validation shows a newer intentionally selected version.
- Replace warmup / host config package references with templated or generated pinned package spec instead of raw `code-review-graph` plus `--upgrade`.

**Test Scenarios:**

- Normal: `mcp-tools.json` exposes a non-empty `code-review-graph` package and version.
- Regression: no source command for `code-review-graph` contains `uvx --upgrade code-review-graph` on the default path.
- Governance: docs/prose explain that version updates happen by changing the source pin.

**Acceptance:**

- A reviewer can identify the intended CRG version without inspecting uv cache or generated config.

---

### U2. Project pinned graph provider commands

**Goal:** Ensure generated provider config uses pinned CRG commands from source identity.

**Requirements:** R1, R2, R3, R5

**Files:**

- Modify: `skills/spec-mcp-setup/scripts/write-provider-config.sh`
- Modify: `skills/spec-mcp-setup/scripts/write-provider-config.ps1`
- Test: `tests/unit/spec-graph-bootstrap.sh`
- Test: `tests/unit/mcp-setup-powershell-contracts.test.js`

**Approach:**

- Compute a CRG package spec from `mcp-tools.json`, e.g. `code-review-graph@2.3.3`.
- Emit:
  - `bootstrap`: `['uvx', '<crg-package-spec>', 'build']`
  - `status`: `['uvx', '<crg-package-spec>', 'status']`
  - `query_probe`: `['uvx', '<crg-package-spec>', 'status', '--repo', '<repo-root>']`
- Keep array execution; do not introduce shell strings.
- If package/version is missing, fail closed with a setup/projection error rather than silently falling back to floating latest.

**Test Scenarios:**

- Normal: generated fixture contains `uvx code-review-graph@2.3.3 build`.
- Regression: generated fixture does not contain `--upgrade` for `code-review-graph`.
- Error: missing CRG package or version in `mcp-tools.json` makes Bash and PowerShell projection fail closed with a clear diagnostic before writing generated provider config.
- Cross-platform: PowerShell static contract has the same projected command shape as Bash.

**Acceptance:**

- Fresh setup projection would no longer regenerate floating CRG provider commands.

---

### U3. Update graph-bootstrap command shape validation

**Goal:** Allow the new pinned command shape while preserving command injection and arbitrary package safeguards.

**Requirements:** R4, R6

**Files:**

- Modify: `skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh`
- Modify: `skills/spec-graph-bootstrap/scripts/bootstrap-providers.ps1`
- Test: `tests/unit/spec-graph-bootstrap.sh`
- Test: `tests/unit/mcp-setup-powershell-contracts.test.js`

**Approach:**

- Update CRG parser logic so `uvx code-review-graph@<version> build/status` is recognized.
- Restrict package spec to the expected package name plus an exact safe version token, for example a controlled equivalent of `code-review-graph@[0-9A-Za-z][0-9A-Za-z._+!-]*`; do not accept arbitrary package names, shell 元字符, or `code-review-graph@latest` in the default graph-bootstrap path.
- Keep allowed tails narrow:
  - `build`
  - `status`
  - `status --repo <repo-root>`
- Treat legacy `uvx --upgrade code-review-graph ...` as non-desired stale projection: either reject it outright or classify it with a clear stale-generated-config/action-required diagnostic. Do not silently accept it as a fresh supported default.

**Test Scenarios:**

- Normal: pinned `uvx code-review-graph@2.3.3 build` passes validation.
- Normal: pinned `status --repo <repo-root>` passes validation.
- Negative: `uvx other-package@2.3.3 build` fails validation.
- Negative: package specs containing shell 元字符 fail validation.
- Negative: additional unexpected args fail validation.
- Compatibility: stale floating generated config is either classified with a clear stale-projection/action-required reason or rejected as unsupported; it must not silently be treated as the desired state.

**Acceptance:**

- The new provider command arrays execute only as safe argv arrays and cannot be widened into arbitrary uvx tool execution.

---

### U4. Update tests and fixtures for pinned CRG uvx execution

**Goal:** Lock the regression surface that caused cache growth.

**Requirements:** R1, R4, R6

**Files:**

- Modify: `tests/unit/spec-graph-bootstrap.sh`
- Modify: `tests/unit/mcp-setup-powershell-contracts.test.js`
- Modify or add any focused mcp-setup projection test that currently asserts CRG command arrays

**Approach:**

- Derive a CRG package fixture value from `mcp-tools.json`, analogous to the existing GitNexus package-spec extraction.
- Update fake `uvx` matching so it recognizes `code-review-graph@<version> build/status` while preserving existing package-not-found, cache-permission, generic build failure, and hang simulations.
- Add grep/assertions that default fixtures and source projection do not contain `uvx --upgrade code-review-graph`.
- Add negative fixtures for unsafe CRG package spec, arbitrary uvx package names, `code-review-graph@latest`, and unexpected trailing args.
- Preserve existing failure classifications such as package-not-found/cache-permission where they still apply.

**Test Scenarios:**

- Existing happy path still passes with pinned CRG commands.
- Existing CRG package failure fixtures still map to provider diagnostics.
- Floating `--upgrade` does not reappear in generated provider fixtures or source projection.
- `code-review-graph@latest`, arbitrary package names, shell 元字符, and unexpected args fail validation.
- PowerShell static contract remains aligned with Bash semantics.

**Acceptance:**

- A future accidental reintroduction of `uvx --upgrade code-review-graph` fails tests.

---

### U5. Update graph-bootstrap prose and operational cleanup guidance

**Goal:** Make the new version/caching model visible and avoid automatic destructive cleanup.

**Requirements:** R5, R7

**Files:**

- Modify: `skills/spec-graph-bootstrap/SKILL.md`
- Modify: `skills/spec-mcp-setup/SKILL.md` if setup owns provider version update guidance
- Modify: `CHANGELOG.md`

**Approach:**

- Replace `floating-unverifiable` CRG language with pinned provider identity language once implementation lands.
- Explain that daily graph-bootstrap uses pinned CRG and that updating CRG means changing the source pin / rerunning setup projection.
- Add operator note: after the fix, users may reclaim old cache with `uv cache clean code-review-graph`; do not make graph-bootstrap run it automatically.
- Keep the broader fast reuse plan separate and reference it only as follow-up context.

**Test Scenarios:**

- Documentation no longer claims CRG default command is floating if code has been changed.
- Documentation retains source/runtime boundary and does not instruct users to hand-edit generated config.
- CHANGELOG has a new entry using the repository format.

**Acceptance:**

- Users understand why cache growth stops going forward and how to clean existing cache manually.

---

## Verification Plan

Run the narrowest checks first:

1. `npm run test:graph-bootstrap`
   - Proves Bash graph-bootstrap fixtures, CRG command validation, and provider diagnostics.
2. `npm run test:unit -- tests/unit/mcp-setup-powershell-contracts.test.js`
   - Proves PowerShell/static parity for provider command projection and validation wording.
3. Focused grep/static checks:
   - No default CRG graph-bootstrap command in source fixtures contains `uvx --upgrade code-review-graph`.
   - Pinned `code-review-graph@<version>` appears in source projection and expected fixtures.
4. Optional source projection smoke after implementation:
   - Regenerate local provider config with the normal setup command and inspect `.spec-first/config/graph-providers.json` as generated output only.

Full `npm test` is optional unless implementation touches shared setup helpers or graph-bootstrap canonical artifact schema beyond command shape.

---

## Risks And Mitigations

- **Risk:** `uvx code-review-graph@2.3.3` syntax differs from expected uv behavior.
  - **Mitigation:** Validate with a focused command or fixture during implementation; if needed, use uv-supported package spec syntax while preserving pin semantics.
- **Risk:** Existing generated `.spec-first/config/graph-providers.json` remains stale after source fix.
  - **Mitigation:** Document that users must rerun setup/init projection after upgrading spec-first; graph-bootstrap should surface stale projection rather than silently accepting old floating commands as fresh.
- **Risk:** Pinning slows adoption of CRG fixes.
  - **Mitigation:** Keep explicit update path: bump source pin, changelog it, regenerate projection, and let fingerprint/projection drift force a fresh run.
- **Risk:** Validator regex becomes too permissive.
  - **Mitigation:** Match expected package name first, then safe version token; keep subcommand tails enumerated.

---

## Non-Goals

- No automatic uv cache deletion.
- No global uv cache policy management.
- No runtime patching of generated host assets.
- No semantic reuse decision based solely on command string.
- No broadened provider abstraction beyond the CRG pin needed for this fix.

---

## Done Criteria

- `code-review-graph` package/version is source-owned and visible.
- Bash and PowerShell graph provider projection both use pinned CRG package spec without `--upgrade`.
- Bash and PowerShell validators accept the pinned command shape and reject unsafe variants, including `@latest` on the default path.
- Tests fail if default `uvx --upgrade code-review-graph` returns.
- Skill prose and changelog describe the pinned daily path and explicit update model.
- Existing user cache cleanup remains an explicit manual action, not automated by spec-first.
