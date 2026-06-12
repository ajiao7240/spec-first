---
date: 2026-06-12
topic: init-host-selection-remember-last
spec_id: 2026-06-12-001-init-host-selection-remember-last
---

# spec-first init 记住上次 host 选择并自动预勾选

## Summary

让 `spec-first init` 交互安装时，host 多选框（Claude Code / Codex）自动预勾选用户**上一次勾选**的 host。上次选择持久化到全局 developer 文件 `~/.spec-first/.developer`（与用户名同一文件）作为新字段；首次安装（文件无该字段）保持现状——两个 host 都不勾选，强制显式选择。

---

## Problem Frame

`spec-first init` 是反复运行的命令：升级 CLI、修复 runtime drift、重装资产时都会再次执行。每次交互安装，host 多选框（`INIT_PLATFORM_CHOICES`，两项都硬编码 `defaultChecked: false`）都以全空状态呈现，从不回填上一次的选择。

对几乎只用单一 host（例如只用 Claude Code）或固定组合的用户，这意味着每次重装都要手动重新勾选一遍，是可消除的重复操作。命令已经在交互结束时把用户名和语言持久化到全局 developer 文件，但 host 选择没有被记住——这是一个低成本、高频的体验缺口。

---

## Requirements

**持久化**
- R1. 交互式 `spec-first init` 完成后，把用户本次勾选的 host 列表持久化到全局 developer 文件 `~/.spec-first/.developer`，作为该文件中的一个新字段，与 `name`/`lang` 等并列。
- R2. 持久化的是用户在多选框中**实际勾选**的列表，而非当前项目实际安装的 runtime 目录状态。

**回填预勾选**
- R3. 交互式 `spec-first init` 渲染 host 多选框时，读取全局 developer 文件中已记录的上次 host 选择，把其中每个 host 预勾选为默认选中态。
- R4. 当全局 developer 文件不存在、或不含上次 host 选择字段（首次安装）时，多选框保持现状——所有 host 均不勾选。
- R5. 记录中出现的、当前已不在 `INIT_PLATFORM_CHOICES` 支持范围内的 host 标识，回填时安全忽略，不影响其余预勾选，也不报错。

**边界**
- R6. 该改动只影响交互式多选框的默认勾选态，不改变 `--yes` 非交互路径的行为（其默认仍由各 host 的 `defaultForYes` 决定）。
- R7. 显式通过 `--claude` / `--codex` 等 flag 指定 host 时，按现状直接采用 flag 指定值，不进入多选框，也不受上次记录影响。

---

## Acceptance Examples

- AE1. **Covers R3, R1.** 上一次交互安装只勾选了 Claude Code 并完成；再次运行 `spec-first init`（交互），host 多选框中 Claude Code 已预勾选、Codex 未勾选。
- AE2. **Covers R4.** 全新环境下首次运行 `spec-first init`（无全局 developer 文件或无 host 字段），多选框两项都不勾选。
- AE3. **Covers R2, R3.** 用户曾勾选 Claude+Codex 完成安装，之后手动删除某个 runtime 目录；再次交互运行 init，多选框仍按上次勾选的两项预勾选（按记忆而非按磁盘实际安装回填）。
- AE4. **Covers R5.** 全局文件记录了一个当前已不支持的 host 标识，再次运行 init 时该标识被忽略，其余受支持的 host 正常预勾选，命令不报错。
- AE5. **Covers R6.** 运行 `spec-first init --yes`，host 选择仍走 `defaultForYes` 默认，不受上次交互记录影响。

---

## Success Criteria

- 在固定使用单一 host 或固定组合的用户那里，重复运行交互式 init 时无需再手动重勾 host——上次选择已默认选中，回车即可。
- 首次安装体验不变，仍强制用户显式选择，避免新用户被预设。
- 下游实现者能从需求清楚区分：记忆源是「用户上次勾选列表」而非「磁盘已装 runtime」，持久化位置是全局 developer 文件而非 per-project state。

---

## Scope Boundaries

- 不做 per-project（每个 repo 各记各的）host 记忆——记忆是全局共享的一份（见 Key Decisions）。
- 不改为「扫描已安装 runtime 目录」来决定预勾选——明确按持久化的用户选择回填。
- 不改变首次安装的默认勾选态（不做「首次默认全勾」）。
- 不改变 `--yes` 或显式 flag 路径的既有行为。
- 不引入新的独立配置文件或新的 CLI flag。

---

## Key Decisions

- 记忆位置 = 全局 developer 文件（`~/.spec-first/.developer`，与用户名同源）：用户明确要求写入「持久化用户名同一个文件」。后果——上次 host 选择跨所有项目共享，在 repo A 选 Claude 后，在 repo B 跑 init 也会默认预勾选 Claude。这是有意的全局行为，不是 per-project。
- 记忆语义 = 用户上次勾选列表，而非当前项目实际安装状态：即使手动删除了某个 runtime 目录，回填仍按上次勾选。与用户选定的「持久化上次选择」而非「扫描已装 runtime」一致。
- 首次安装保持全空：避免给新用户预设 host，强制一次显式选择，之后才开始记忆。

---

## Dependencies / Assumptions

- 依赖现有全局 developer 文件读写链路（`readDeveloperFile` / `writeGlobalDeveloperFile` 及其 normalize 逻辑）。新增字段需让该文件的解析/序列化/normalize 能容纳并保留新字段，具体落地方式由 planning 决定。
- 依赖 host 多选框底层 prompt 已支持按选项 `checked` 渲染预勾选态（现有 checkbox 实现已支持）。

---

## Outstanding Questions

### Deferred to Planning

- [Affects R1][Technical] 新字段在 `.developer` 文件中的键名与序列化格式（单行分隔的 host 列表 vs 其他形式），以及 `normalizeDeveloper` 如何在保留 `name/lang/initializedAt/version` 既有契约的同时纳入新字段。
- [Affects R1][Technical] 写入时机与现有 developer 文件写入路径的整合点（与用户名/语言同一次写入，还是独立步骤）。
