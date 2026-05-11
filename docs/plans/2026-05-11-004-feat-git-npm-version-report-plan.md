---
title: feat: git-npm 发布后生成面向用户的版本内容报告
type: feat
status: completed
date: 2026-05-11
spec_id: 2026-05-11-001-git-npm-version-report
origin: docs/brainstorms/2026-05-11-001-git-npm-version-report-requirements.md
deepened: 2026-05-11
completed: 2026-05-11
---

# feat: git-npm 发布后生成面向用户的版本内容报告

**Target repo:** `~/.claude/skills/git-npm` （外部用户级 standalone skill，非本 spec-first 仓库。以下所有 `SKILL.md`、`scripts/publish.sh`、`scripts/*.sh` 路径均相对 target repo。）

---

## Summary

通过"两阶段交接"实现需求文档的 R1–R20：Phase 1 是纯确定性 bash 流水线（`scripts/publish.sh` 由 4 步扩展为 7 步：preflight 含 docs/VERSION/ npm-pack 排除校验 / quality / publish / post-publish verify / **bump-commit 对齐目标仓库 release:publish 副作用** / tag 含幂等冲突分叉 / facts 持久化到 `.git/spec-first/version-facts-<version>.json`）；Phase 2 是宿主 Agent 读取事实集、通过宿主 LLM 生成结构化 release notes、结构校验后写入目标仓库 `docs/VERSION/YYYY-MM-DD-<version>.md` 并以独立 commit 追加到主开发分支。bump-commit 步骤是从 plan 首轮 review 中回写的 P0 修复，用于解决 spec-first 等目标仓库的 `release:publish` 不自动 commit bump 导致的 tarball ↔ HEAD 漂移。

---

## Problem Frame

`git-npm` 当前只维护开发者视角的 `CHANGELOG.md`；发布后没有稳定的面向用户的版本报告，也没有强制 tag ↔ tarball 映射。origin 文档（`docs/brainstorms/2026-05-11-001-git-npm-version-report-requirements.md`）固化了双份并存（CHANGELOG + release notes）、发布后生成、硬约定路径、强制 tag、LLM 归纳为主、失败不阻塞 publish 等决策。本计划把这些决策落地到目标 skill 的 bash 脚本与 SKILL.md 文档中，不改变既有安全发布路径，并显式处理"目标仓库 `release:publish` 是否自动 commit bump"的行为差异。

---

## Requirements

- R1–R20 直接沿用 origin 文档，trace 如下：

**原始需求（继承自 origin）**：
- R1 publish 后追加；R2 dry-run 不写/不创建 tag；R3 报告不进 tarball
- R4 事实集 + 首次发布退化；R5 LLM 归纳；R6 6 个固定结构化分块
- R7 硬约定 `docs/VERSION/YYYY-MM-DD-<version>.md`；R8 目录缺失自动创建；R9 独立 commit + 目标仓库既有 commit 约定；R10 同日同版本覆盖
- R11 LLM 不可用 warn+跳过不阻塞；R12 facts 持久化 `.git/spec-first/version-facts-<v>.json`
- R13 同步 `SKILL.md`
- R14–R18 tag 契约（必创、先于 notes commit、禁强制覆盖、同 commit 幂等、不同 commit abort notes 流程、本地创建失败降级、push 失败 warn 不回滚）
- R19 preflight 校验 docs/VERSION/ 已从 npm pack 排除
- R20 release notes 非审计证据

**本计划追加需求（由 review 回写，plan-local）**：
- R21. publish.sh 在 Step 5（tag）之前必须将目标仓库 `release:publish` 成功后残留的 bump 改动提交为独立 `chore(release): v<version>` commit 并 push 到主开发分支；若 Step 4 后 `git status --porcelain` 已为空（即目标仓库的 `release:publish` 自己完成了 commit+push）则跳过此步。bump commit 是后续 "release snapshot commit" 的锚点。
- R22. Phase 2 handoff 不依赖"同一 agent 会话"这一隐含假设。Step 6 必须写 pending marker 文件 `.git/spec-first/pending-notes-<version>` 用于任一后续 agent 会话主动识别未完成的 Phase 2。

**Origin actors:** A1 (发布执行者), A2 (git-npm 脚本层), A3 (宿主 LLM)
**Origin flows:** F1 (发布后 bump-commit + tag + 生成报告 + 入库), F2 (LLM 不可用降级)
**Origin acceptance examples:** AE1 (covers R1, R3, R4, R5, R6, R7, R9), AE2 (covers R2, R3, R14), AE3 (covers R8, R10), AE4 (covers R11, R12, R18), AE5 (covers R14, R15, R21), AE6 (covers R15, R17), AE7 (covers R4 first-release), AE8 (covers R17 idempotent), AE9 (covers R18), AE10 (covers R19), AE11 (covers R21 bump-commit), AE12 (covers R22 pending marker)

---

## Scope Boundaries

- 不改造目标仓库 `CHANGELOG.md` 的生成/维护方式（见 origin）。
- 不推送 GitHub Release / npm README / 外部渠道（见 origin）。
- 不引入 `package.json` 字段或环境变量覆写报告路径（硬约定，见 origin）。
- 不跨仓库/workspace 汇总；不回填历史版本。
- 不自动补写目标仓库 `.npmignore`；R19 仅做校验并 abort（语气由 review 回写为 stderr 明确修复指令）。
- 不把 release notes 纳入审计证据；审计链只到 tag ↔ tarball（见 origin R20）。
- **v1 输出语言默认中文，同时接受英文 H2 别名（structural 校验同时匹配中英两套 header）；但 prompt template 主体以中文示例为主，英文用户可在 SKILL.md 记录的 opt-in 方式切换语言**（由 review 回写，见 Key Technical Decisions）。

### Deferred to Follow-Up Work

- PR-only 保护分支仓库支持：v1 仍仅支持 `master`-direct 仓库；PR-only 模式需额外适配（推送目标、commit 落地路径）。后续单独迭代。
- tag 命名 `tagPrefix` 自定义覆盖：v1 硬编码 `v<version>`。
- annotated tag（`git tag -a`）：v1 使用 lightweight tag。
- 本地-远端 tag drift 检测与清理入口：v1 不提供。
- `.git/spec-first/version-facts-*.json` 的 retention 策略：v1 不做清理，累计保留；累积体积变大后再引入保留 N 份策略（由 review 回写）。
- Phase 2 宿主 Agent 自动识别 publish.sh 退出的机器级 primitive：v1 通过 `pending-notes-*` marker + 用户手动触发；自动识别是后续增强（由 review 回写）。

---

## Graph Readiness

- target_repo: `~/.claude/skills/git-npm` (external user-level standalone skill)
- status: unavailable
- source_revision: n/a
- current_revision: n/a
- stale: n/a
- primary_providers: none
- degraded_providers: none
- fallback_capabilities: direct repo reads on `SKILL.md` 与 `scripts/publish.sh`；在本轮 review 中还对 spec-first `scripts/release-publish.cjs` 做了直接阅读以验证 bump commit 行为
- runtime_mcp_evidence: none
- confidence: high（target 仅 ~400 行 bash + markdown，加上 spec-first 侧 `release-publish.cjs` 的 135 行，已逐行阅读）
- limitations: spec-first 的 graph readiness 面向本仓库；目标 skill 不在 graph 范围，改用直接文件阅读作为一手证据

---

## Context & Research

### Relevant Code and Patterns

- `SKILL.md`（226 行）：Quick Start / Recommended Flow / 多节 Real-world lessons (1.5.3, 1.5.4) / Authentication / Failure and Recovery / Manual release commands / Validation Checklist / Important guardrails。Real-world lessons 分节作为经验沉淀载体，本计划沿用此格式但**不再预置 1.5.5 占位**（由 review 回写，经验回填在首次真实 rollout 后由 A1 追加）。
- `scripts/publish.sh`（160 行）：4 步 Preflight / Quality Gates / Publish / Post-publish verify。`set -euo pipefail`；`pnpm run release:publish -- $PUBLISH_ARGS` 间接调用目标仓库的发布脚本；现有输出 `Next steps: create/push git tag explicitly if your repo policy requires it`。
- spec-first `scripts/release-publish.cjs`（135 行）：通过 review 的 feasibility reviewer 直接阅读验证——**成功路径下该脚本只 write package.json + 运行 tests + `npm publish`，不执行 `git add`/`git commit`/`git push`；finally 块仅在 dry-run 或失败时 restore；成功路径下 bump 改动残留在 worktree**。这是 R21 的直接动因。
- 既有 guardrails：auto 不幂等、hook 阻断、mirror registry 防护、tarball ≠ git HEAD 警戒、OTP vs token 顺序。本计划新增 R14–R22 相关 guardrails 但不削弱既有内容。

### Institutional Learnings

- `git-npm@1.5.3` 经验：auto 失败不要重跑；hook 阻断先满足治理；token > OTP；warning 回写 source。本计划 F2 降级与此一致。
- `git-npm@1.5.4` 经验：默认 registry 可能指向 mirror；`git status --porcelain` 假干净；tarball ≠ git HEAD；大规模 rename 不 auto。**R21 是对 1.5.4 "tarball ≠ HEAD" 经验的直接收束**：把"publish 后 HEAD 可能不含 bump"这一隐患在 bash 层消解，不再依赖目标仓库 `release:publish` 的实现差异。

### External References

- 未使用外部检索。目标是 bash + git + npm 标准接口。origin 已吸收 release-it / semantic-release 等既有工具的设计空间。

---

## Key Technical Decisions

- **两阶段交接（bash 做确定性工作、宿主 Agent 做 LLM 工作）**：bash 无法以可移植方式直接调用宿主 LLM；publish.sh 责任收敛到"preflight + publish + bump-commit + tag + facts 收集 + pending marker"，LLM 调用+结构校验+写盘+commit 交给宿主 Agent。与 `scripts prepare, LLM decides` 哲学对齐。
- **目标仓库 `release:publish` 副作用契约（R21 动因）**：不同目标仓库的 `release:publish` 语义差异很大——spec-first 的 `release-publish.cjs` 不做 git 提交，release-it / changesets 会自己 bump+commit+tag+push。publish.sh 在 Step 4 post-publish verify 之后检查 `git status --porcelain`：若非空（spec-first 风格）→ Step 4.5 执行 `git add package.json CHANGELOG.md`（以及其他在 bump 时被改动的文件）→ `git commit -m 'chore(release): v<version>'` → `git push $REMOTE $CURRENT_BRANCH`；若为空（release-it 风格）→ 跳过并记录"target release:publish self-managed"。随后 Step 5 把 `release snapshot commit = $(git rev-parse HEAD)` 作为 tag 锚点——此时该 HEAD 保证包含 bump。
- **release notes 输出语言 = 中文默认，双语 header 校验**：固定六个 H2 标题中文 `## 摘要 / ## 亮点 / ## 新增 / ## 修复 / ## 破坏性变更 / ## 升级注意事项`；结构校验同时接受英文等价 `## Summary / ## Highlights / ## Added / ## Fixed / ## Breaking Changes / ## Upgrade Notes`。LLM prompt template 主体为中文，英文用户在 SKILL.md 记录的 opt-in 路径（未来版本提供）之前默认按中文 prompt 走；英文 LLM 输出仍能通过校验因为 header 匹配双语集合。这是对 review 中"语言锁定"finding 的收束。
- **lightweight `git tag v<version>`**：简单、无强制 message；annotated 推迟（Deferred to Follow-Up Work）。
- **commit message 启发式在 bash 层产出 hint，agent 按 hint 执行**（由 review 回写——原方案"agent 侧做启发式"会造成启发式解释漂移）：publish.sh Step 6 事实集中增加 `commitConventionHint` 字段，由 bash 运行下列确定性检测，agent 读 hint 直接使用，不再重跑：
  - 正则 `^(feat|fix|docs|style|refactor|perf|test|chore|ci|build|revert)(\([^)]+\))?!?:`
  - 窗口 `git log --format=%s -n 20 HEAD`
  - 匹配率 ≥ 50%（含边界）→ hint = `"conventional"`；否则 hint = `"freeform"`
  - 同窗口检测 `\[TASK-[^\]]+\]`，匹配率 ≥ 30%（含边界） → hint-附加 `task_prefix: true`
  - agent 按 hint 选模板：conventional → `docs(version): v<v> release notes`（+ `[TASK-RELEASE-NOTES]` 前缀 if task_prefix）；freeform → `docs: add v<v> release notes`
- **LLM 失败判定**：timeout 120s，重试 0。三条触发——（a）宿主无可用 primitive 或调用异常；（b）response body trim 后为空；（c）6 个必需分块存在数（按双语任一版本识别）< 3。
- **R19 preflight 策略 = 仅校验+abort**：通过 `npm pack --dry-run --json` 读 `files[].path`，命中任何匹配 `^docs/VERSION(/|$)` 路径 → abort 并明确给出两种修复方式（在 `.npmignore` 追加 `docs/VERSION/` 或在 `package.json#files` 白名单明确不含 `docs/VERSION/`）；`npm pack --dry-run --json` 返回非 JSON 或 exit 非零（老 npm 版本）→ warn 并放行（在 stderr 标注"无法自动校验，请人工确认"）。abort 出错时给出的 stderr 文案保证用户可操作，这是对"首次必 abort"的 UX 缓解。
- **tag push 1 次 2s 重试后 warn 继续**；v1 无 drift 终局校验；tag push 失败不阻塞 Phase 2（本地 tag 是权威）。
- **SKIP_NOTES 在 Step 5 入口显式初始化**（由 review 回写——`set -u` 下引用未初始化变量会炸）：`SKIP_NOTES=false` 在 Step 5 顶部赋值；下游 Step 6/U5 用 `${SKIP_NOTES:-false}` 防御式读取。
- **facts JSON 扁平 object**，字段 `{ version, publishedAt, previousTag, firstRelease, releaseSnapshotCommit, commits: [{hash, subject, files}], changelogEntry, commitConventionHint, targetRepo, priorReleasePublishSelfCommitted }`。JSON 组装必须通过 `node -e` 的 `process.env`/stdin 传入数据，禁止字符串拼接（避免 commit subject 中的引号/反引号/`$`/中文炸脚本）；组装后用 `node -e "JSON.parse(require('fs').readFileSync(process.env.F,'utf8'))"` 自校验。
- **release snapshot commit 定位算法（修正版）**：Step 4.5 完成后的 `git rev-parse HEAD`。Step 4.5 保证 HEAD 含 bump；前置校验在 Step 4.5 自身（若 `git status --porcelain` 仍非空说明有非 bump 改动，warn 并 abort release notes 流程但不撤 publish）。
- **previousTag 检测算法（修正版）**（由 review 回写——原 `HEAD^` 算法在 merge commit 和 non-v* tag 场景会误判）：
  - 先用 `git tag --list --sort=-v:refname 'v*' | head -n 1`（在打新 tag 之前采集，避免污染）得到 `PREV_TAG`
  - 若 `PREV_TAG` 为空但 `git tag --list | head -n 1` 非空 → 存在 non-v* 命名的 tag 历史，判定"tag 命名约定不匹配"而非 first-release，warn 并把 `previousTag` 写为 `null` + `firstRelease: false` + `warning: "no v* tag but other tags exist"` 交给 Phase 2 降级处理
  - 两者都为空 → 真正 first-release，`firstRelease: true`，commits 退化为 repo 初始 commit → HEAD
- **CHANGELOG 本版条目抽取（修正版）**（由 review 回写——目标仓库 CHANGELOG 格式不统一）：两段式解析，先 `awk '/^## \[?v?<version>/,/^## /' CHANGELOG.md`（匹配 `## version` 风格）；匹配为空则 fallback `grep -E '^- v?<version> ' CHANGELOG.md`（匹配 spec-first 的 flat bullet 风格）；两者都空 → `changelogEntry: null` + warn。两种格式识别写进 SKILL.md Failure Modes。
- **Phase 2 触发通路（修正版）**（由 review 回写——"同会话依赖"是隐含假设）：Step 6 写 pending marker `.git/spec-first/pending-notes-<version>`（空文件或 JSON）；SKILL.md 明确 Phase 2 入口是"用户在任一 agent 会话中说'继续处理 git-npm pending release notes'"，agent 看到该短语或检测到 pending marker 即进入 Phase 2；完成后删除 marker。
- **spec-first 文档是否反映**：否（保持 skill 独立，origin 已决定）。
- **`.git/spec-first/` 持久化位置**：`.git/` 本地、不 tracked；`spec-first/` 子目录命名承载"spec-first 哲学派生"语义但不依赖 spec-first runtime。

---

## Open Questions

### Resolved During Planning

- LLM prompt / commit msg / LLM timeout / tag 命名 / push 重试 / preflight 策略 / PR-only / spec-first 反映 / release snapshot commit 定位 / previousTag 检测 / CHANGELOG 抽取 / Phase 2 触发 / bump commit 契约 / SKIP_NOTES 初始化 / 双语 header / 启发式在 bash 层产出 hint — 全部由 Key Technical Decisions 给出方案。

### Deferred to Implementation (TBD during first iteration, not v2+ features)

- `npm pack --dry-run --json` 在不同 npm 版本下的输出结构差异：实现时在 2 个以上目标仓库样本验证；失败走 warn+放行路径。
- `.git/spec-first/version-facts-<version>.json` 的精细字段（例如 `commits[].files` 是否带改动行数/改动类型）：按 LLM 归纳质量实际需要调整。
- bump-commit message 的精确文本在 conv-commits 仓库 vs freeform 仓库之间的小调整：默认 `chore(release): v<version>`；若 commitConventionHint=freeform 则 `bump: v<version>`。
- 事实集中 `commits` 列表大小上限（防 LLM context overflow）：v1 硬上限 200 条或 256KB，超出走 F2 降级或摘要化，具体阈值实现时定。

---

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```mermaid
sequenceDiagram
    participant A1 as A1 Publisher
    participant A2 as A2 publish.sh (bash)
    participant A3 as A3 Host Agent + LLM
    participant FS as Target repo

    A1->>A2: bash publish.sh [version-type] [--dry-run]

    rect rgba(200, 220, 255, 0.3)
    Note over A2,FS: Phase 1 — Deterministic (bash only)
    A2->>FS: Step 1 Preflight<br/>(worktree clean · npm auth · registry · docs/VERSION/ excluded)
    A2->>FS: Step 2 Quality Gates (typecheck · build)
    A2->>FS: Step 3 Publish (npm publish via target release:publish)
    A2->>FS: Step 4 Post-publish verify (registry match)
    A2->>FS: Step 4.5 Bump-commit if dirty<br/>(git add + chore(release) commit + push)
    A2->>FS: Step 5 Tag (v&lt;version&gt; lightweight, R14/R15/R17/R18 rules)<br/>SKIP_NOTES=false init at entry
    A2->>FS: Step 6 Facts collection<br/>→ .git/spec-first/version-facts-&lt;v&gt;.json<br/>→ pending-notes-&lt;v&gt; marker
    A2-->>A1: stdout: facts path + Phase 2 trigger phrase
    end

    rect rgba(255, 220, 200, 0.3)
    Note over A3,FS: Phase 2 — Semantic (host agent, any session)
    A1->>A3: Trigger phrase or agent detects pending marker
    A3->>FS: Read .git/spec-first/version-facts-&lt;v&gt;.json
    A3->>A3: Call host LLM with prompt template<br/>(language per hint; 6 section headers CN/EN aliases)
    A3->>A3: Validate ≥3 headers present<br/>(<3 → F2 degrade; 3-5 → write + warn; 6 → silent)
    A3->>FS: Write docs/VERSION/YYYY-MM-DD-&lt;v&gt;.md
    A3->>FS: Commit via commitConventionHint-driven message<br/>→ delete pending-notes-&lt;v&gt; marker
    end
```

关键不变式：**bash 不直接调 LLM**；Phase 1 任何步骤失败可独立观测、降级或 abort；Phase 2 完全在宿主 Agent 控制面内，失败不回退已完成的 publish/tag。bump-commit（Step 4.5）是 R21 的落地点，保证 Step 5 tag 所指 commit 与 npm tarball 内 `package.json.version` 一致。

---

## Implementation Units

<!-- U1–U7 按原始顺序保留；U8 新增于 review 阶段，承担 R21 bump-commit 步骤（U-ID 稳定规则：不重编号）。执行依赖顺序：U1 → U2 → U3 → U8 → U4 → U5 → U6 → U7。 -->

### U1. Extend SKILL.md to document the two-phase flow and new guardrails

**Goal:** 把 R1–R22 行为契约写进 SKILL.md，使宿主 Agent 与人类用户都能读懂 v1.5.5+ 的新发布流程。

**Requirements:** R13；间接承载 R1–R12、R14–R22 的可读契约。

**Dependencies:** none。先行单元，为后续实现提供 source-of-truth。

**Files:**
- Modify: `SKILL.md`

**Approach:**
- Quick Start 追加"执行 publish.sh 后进入 release notes 交接 Phase 2：在任一 agent 会话中触发短语 `继续处理 git-npm pending release notes` 或直接告知 agent 检查 `.git/spec-first/pending-notes-*`"。
- Recommended Flow：把"可选 tag"升级为"必须 tag"；把原 4 步扩展为 7 步（preflight / quality / publish / verify / **bump-commit** / tag / facts）；新增独立 "Release Notes Handoff (Phase 2)" 节。
- 新增 "Release Notes Structure"：6 个必需 H2 标题的中英双语集合（中文为默认输出示例，英文作为 alias）。
- 新增 "Failure Modes"：F1 正常 / F2 LLM 不可用 / F3 结构灰区 / F4 tag 冲突（warn+continue，不 exit）/ F5 tag 创建失败 / F6 R19 preflight abort / F7 bump-commit 前置不满足（worktree 有非 bump 改动）/ F8 pending marker 未被消化。
- Validation Checklist 追加：`git describe --tags`、`ls -la .git/spec-first/`、`ls docs/VERSION/`、`cat .git/spec-first/pending-notes-*`。
- Important guardrails 追加 6–7 条：tag 强制、dry-run 不碰 tag、bump-commit 先行、facts 持久化路径、LLM 失败不阻塞 publish、release notes 非审计证据、SKIP_NOTES 入口初始化。
- 明确 v1 语言默认中文 + 英文 alias 校验；英文用户 opt-in 路径记为未来版本。
- **本单元不预置 "Real-world lessons from 1.5.5" 占位节**（由 review 回写：空占位会误导读者）；经验回填由 U7 完成首次 rollout 后由 A1 追加。

**Patterns to follow:**
- 沿用既有 Real-world lessons 小节的"现象 → 规则"结构。
- "Preferred / Fallback" 在 Authentication 小节的二选一写法，复用到 LLM 失败降级。

**Test scenarios:**
- Test expectation: none — documentation-only change；human/agent 通过 U7 smoke 验证可读性。

**Verification:**
- SKILL.md 被一位从未读本 plan 的 agent/人阅读后，能独立执行：(a) publish.sh 后下一步；(b) preflight abort 并修复 `.npmignore`；(c) tag 冲突的幂等/abort 分叉判断；(d) bump-commit 失败时的恢复；(e) LLM 失败时找 facts 和 pending marker 的位置。
- 已有 1.5.3/1.5.4 lessons 条目未被删除。
- 1.5.5 lessons 节不预置（此 assertion 反向保护）。

---

### U2. publish.sh — Step 1 preflight extensions（R19 + dry-run tag 占位）

**Goal:** 在 Step 1 Preflight 内追加 `docs/VERSION/` 排除校验；在 Step 1 尾部为 Step 4.5/5/6 的 dry-run 语义做统一声明。

**Requirements:** R2（dry-run 不碰 tag / bump commit）, R19（preflight 排除校验）。

**Dependencies:** U1（SKILL.md 契约已就位）。

**Files:**
- Modify: `scripts/publish.sh`（Step 1 区段）

**Approach:**
- 在 `npm whoami` 与 `npm config get registry` 校验之后新增一步：
  - 调用 `npm pack --dry-run --json 2>/dev/null`；parse 失败（JSON 不合法或 exit 非零） → warn 到 stderr 并放行（写明"无法自动校验 docs/VERSION/ 排除，请人工确认"）。
  - parse 成功后扫描 `files[].path`，匹配 `^docs/VERSION(/|$)` → `echo "✗ docs/VERSION/ 必须从 npm pack 排除"` + 给出两种修复方式（`.npmignore` 追加 `docs/VERSION/` 或 `package.json#files` 显式不列 docs/VERSION/） + `exit 1`。
- dry-run 占位：Step 1 结束前打印 `▸ Mode: DRY-RUN — Step 4.5 bump-commit 将不执行、Step 5 tag 将不创建、Step 6 facts 将不写盘，仅输出预期行为摘要`（仅 `--dry-run` 分支）。

**Execution note:** 新校验作为 Step 1 最后一项；保持现有 registry mirror / worktree clean 校验优先出错顺序。

**Patterns to follow:**
- 既有 `✓/✗/⚠` 前缀与 "echo …; exit 1" 错误出口惯用法。
- `DEFAULT_REGISTRY` 检测的 warn/abort 分叉（dry-run warn、真实 abort）作为 R19 分叉参考。

**Test scenarios:**
- Happy path：目标仓库 `.npmignore` 含 `docs/VERSION/`，preflight 通过。
- Happy path：目标仓库 `package.json#files` 白名单不含 `docs/VERSION/`，preflight 通过。
- Error path：既无 `.npmignore` 也无 `files` 白名单，`docs/VERSION/my.md` 存在，preflight `exit 1` + 给出两种修复提示。**Covers AE10.**
- Edge case：`npm pack --dry-run --json` 返回非 JSON → warn 放行，不 abort。
- Integration：`--dry-run` 下 Step 1 打印 dry-run 占位提示，包含 Step 4.5/5/6 将不执行的说明。

**Verification:**
- 排除正确时 `bash publish.sh patch --dry-run` 不 abort；移除排除后再跑真实 publish 立即 abort。
- dry-run 输出有"Step 4.5 / 5 / 6 将不执行"的明确提示字样。

---

### U3. publish.sh — Step 5 tag creation with idempotency & conflict handling

**Goal:** 在 Step 4.5 之后新增 Step 5 Tag，落实 R14/R15/R16/R17/R18 全部 tag 契约；修正原稿 `exit 1` 让已成功 publish 看起来失败的 UX 问题。

**Requirements:** R14, R15, R16, R17, R18；间接 R2（dry-run）。

**Dependencies:** U2（dry-run 提示统一）、**U8（Step 4.5 bump-commit 保证 HEAD 含 bump）**。

**Files:**
- Modify: `scripts/publish.sh`（Step 4.5 之后插入 Step 5 区段）

**Approach:**
- **Step 5 入口初始化**：`SKIP_NOTES=false`（避免 `set -u` 下未初始化读取炸脚本）。
- `TAG="v$NEW_VERSION"`。`SNAPSHOT_COMMIT=$(git rev-parse HEAD)` — 此时 HEAD 已由 Step 4.5 保证含 bump。
- 记录 previousTag（**在打新 tag 之前**，避免采集污染）：`PREV_TAG=$(git tag --list --sort=-v:refname 'v*' | head -n 1 || true)`。若 `PREV_TAG` 空但 `git tag --list | head -n 1` 非空 → `PREV_TAG_WARN="no v* tag but other tags exist"`。写入环境变量供 U4 Step 6 消费。
- dry-run 分支：`echo "▸ dry-run — Would create lightweight tag $TAG at $SNAPSHOT_COMMIT (prev $PREV_TAG)"`；跳过创建与 push；不设置 SKIP_NOTES。
- 真实分支：
  1. `EXISTING=$(git rev-parse --verify --quiet "$TAG" 2>/dev/null || true)`
  2. `EXISTING` 非空：
     - `[[ "$EXISTING" == "$SNAPSHOT_COMMIT" ]]` → 幂等成功：`echo "⚠ tag $TAG 已存在且指向同一 commit，跳过创建"`，继续 Step 6。
     - 否则 → **warn + SKIP_NOTES=true + 不 exit**（修正：原稿 `exit 1` 让已成功的 publish 退出码非零，用户易误以为 publish 失败；改为保持 exit 0、设置 SKIP_NOTES 让 Step 6 跳过 facts 持久化、打印清晰的 `⚠ publish 已成功但 tag $TAG 冲突，release notes 已跳过；请人工处理 tag` 双行输出 + 人工处理指引）。
  3. `EXISTING` 为空：`git tag "$TAG" "$SNAPSHOT_COMMIT"`；若退出非零（hook 拒绝 / 磁盘 / 权限） → warn + `SKIP_NOTES=true` + 不 exit（R18 publish 保留）。
- Push：`git push "$REMOTE" "$TAG"`；失败 `sleep 2` 重试一次；仍失败 warn 不 exit、不改 SKIP_NOTES（本地 tag 已权威，Phase 2 可继续）。

**Execution note:** 先写 happy path + dry-run + 入口 SKIP_NOTES 初始化三条最清晰场景；再加冲突/失败分叉，避免一次性写全导致状态交错难验证。

**Technical design:** *directional*

```text
Step 5 Tag  (dry-run → skip real tag)
├── SKIP_NOTES=false   (MUST — set -u 防御)
├── compute TAG, SNAPSHOT_COMMIT, PREV_TAG
├── dry-run?  -> print would-create, continue (不改 SKIP_NOTES)
└── real:
    ├── existing = git rev-parse --verify --quiet TAG
    ├── existing empty?
    │   └── git tag TAG SNAPSHOT_COMMIT
    │       ├── ok?  -> push with 1 retry, warn on push-fail, continue
    │       └── fail? -> warn, SKIP_NOTES=true, continue (NOT exit)
    └── existing non-empty?
        ├── == SNAPSHOT_COMMIT? -> idempotent warn, continue
        └── != SNAPSHOT_COMMIT? -> warn + SKIP_NOTES=true, continue (NOT exit)
```

**Patterns to follow:**
- 既有 Step 4 的 `if-elif-else` 分叉结构。
- "publish 已成功但 X 失败" 的双行输出句式，让用户快速区分真正的 publish 失败 vs 后置步骤失败。

**Test scenarios:**
- Happy path：全新 tag 创建并 push 成功。**Covers AE5.**
- Happy path (idempotent)：同名 tag 指向当前 HEAD，warn 并继续。**Covers AE8.**
- Error path：同名 tag 指向不同 commit → warn + SKIP_NOTES + 继续（不 exit）。**Covers AE6.**
- Error path：`git tag` 被 pre-tag hook 拒绝 → warn + SKIP_NOTES + 不 exit。**Covers AE9.**
- Error path：push 第一次失败、重试成功 → warn + 继续。
- Error path：push 两次都失败 → warn + 不 exit（本地 tag 保留，Phase 2 可继续，因为本地 tag 权威）。
- Dry-run：`--dry-run` 路径不创建 tag、不 push，stdout 打印 would-create。**Covers AE2.**
- Integration (set -u)：SKIP_NOTES 入口初始化后，happy path 下 Step 6 读取不炸。

**Verification:**
- 真实 publish 后 `git tag --list "v$NEW_VERSION"` 存在；`git show v$NEW_VERSION` 的 tree 包含 bump 后 package.json，等于 npm registry tarball 源码。
- 冲突路径不 exit，用户在 stdout 能明确看到 "publish 成功 / tag 冲突" 区分。
- SKIP_NOTES 从入口到 Step 6 传递一致。

---

### U4. publish.sh — Step 6 facts collection & persistence + pending marker

**Goal:** 收集 R4 事实集（含 first-release 退化与 non-v*-tag 分叉），写入 `.git/spec-first/version-facts-<v>.json`；写 pending marker `.git/spec-first/pending-notes-<v>`；stdout 打印 Phase 2 触发短语与路径。

**Requirements:** R4, R7 (date), R10, R12, R22；间接 R20。

**Dependencies:** U3（tag 已创建或已幂等；SKIP_NOTES=true 时本单元跳过）。

**Files:**
- Modify: `scripts/publish.sh`（Step 5 之后插入 Step 6 区段）

**Approach:**
- `SKIP_NOTES` 防御读：`if [[ "${SKIP_NOTES:-false}" == "true" ]]`。true → 打印 "release notes 交接已跳过"；不写 facts、不写 marker；publish 保留。
- dry-run 路径：不写 `.git/spec-first/`、不写 marker。
- 前置：`FACTS_DIR=".git/spec-first"`, `mkdir -p "$FACTS_DIR"`。写盘失败（极端权限） → warn + 退化为仅 stdout 打印 JSON + 仍写 marker 到 `$TMPDIR`（失败时把 fallback 路径打印到 stderr）。
- 事实集组装（**必须通过环境变量/stdin 传数据给 node -e，禁止字符串拼接**——避免 commit subject 中的特殊字符炸脚本）：
  - `version = $NEW_VERSION`
  - `publishedAt`：ISO8601 本地时间。
  - `previousTag`：来自 Step 5 采集的 `$PREV_TAG`（空则 `null`）。
  - `firstRelease`：`$PREV_TAG` 空且仓库没有任何 tag → `true`；`$PREV_TAG` 空但有 non-v* tag → `false` + `warning: "$PREV_TAG_WARN"`；`$PREV_TAG` 非空 → `false`。
  - `releaseSnapshotCommit`：`$SNAPSHOT_COMMIT`（由 Step 5 记录，HEAD 已含 bump）。
  - `commits`：`$PREV_TAG..HEAD`（或 first-release fallback：repo 初始 commit → HEAD），`git log --format='%H%x00%s%x00'` + 每 commit `git show --name-only --format='' <hash>`；commits 条数 > 200 或总 bytes > 256KB 时截断并 `commitsTruncated: true`。
  - `changelogEntry`：两段式 fallback——先 `awk '/^## \[?v?'"$NEW_VERSION"'/,/^## /' CHANGELOG.md`；空 → `grep -E '^- v?'"$NEW_VERSION"' ' CHANGELOG.md`；仍空 → `null` + warn。
  - `commitConventionHint`：Step 6 末尾运行 Key Technical Decisions 中定义的正则窗口检测，产出 `{convention: "conventional"|"freeform", taskPrefix: bool}`。
  - `targetRepo`：`{name: $PKG_NAME, remote: $REMOTE, branch: $CURRENT_BRANCH}`。
  - `priorReleasePublishSelfCommitted`：由 U8 Step 4.5 暴露为环境变量（true 若 Step 4.5 跳过了 bump-commit；false 若 Step 4.5 自行 commit+push 了）。
- 组装完毕后 `node -e "JSON.parse(require('fs').readFileSync(process.env.F,'utf8'))"` 自校验；失败 → warn + 把 raw JSON 也打到 stderr 便于调试。
- 写 pending marker：`echo "{\"version\":\"$NEW_VERSION\",\"created\":\"$TS\"}" > "$FACTS_DIR/pending-notes-$NEW_VERSION"`。
- stdout 输出（Phase 2 触发短语）：
  ```
  ▸ Next: run release notes handoff via your host agent (Claude Code / Codex).
    Facts: <absolute path>
    Pending marker: <absolute path>
    Trigger phrase: "继续处理 git-npm pending release notes"
  ```

**Technical design:** *directional*

```json
{
  "version": "1.5.5",
  "publishedAt": "2026-05-11T14:30:00+08:00",
  "previousTag": "v1.5.4",
  "firstRelease": false,
  "releaseSnapshotCommit": "abc123...",
  "commits": [
    { "hash": "abc123", "subject": "feat(release): add tag + version report", "files": ["scripts/publish.sh", "SKILL.md"] }
  ],
  "commitsTruncated": false,
  "changelogEntry": "- v1.5.5 2026-05-11 leokuang: ...",
  "commitConventionHint": { "convention": "conventional", "taskPrefix": true },
  "targetRepo": { "name": "spec-first", "remote": "github", "branch": "master" },
  "priorReleasePublishSelfCommitted": false
}
```

**Patterns to follow:**
- 既有 `NEW_VERSION=$(node -p "...")` 读取 package 的惯用法。JSON 组装用 `node -e` 但**必须通过 env/stdin 传值**。
- 既有 `▸` 进度行 + `✓` 成功行的打印风格。

**Test scenarios:**
- Happy path：正常 publish，`.git/spec-first/version-facts-1.5.5.json` 生成、JSON 合法、commits 覆盖 PREV_TAG→HEAD；pending marker 存在。**Covers AE1.**
- Edge case (first release)：仓库无任何 tag，facts `firstRelease: true` + commits 含 repo 初始 commit → HEAD。**Covers AE7.**
- Edge case (non-v* tags only)：仓库有 `release-1.2.3` 等 non-v* tag，`previousTag: null` + `firstRelease: false` + `warning` 字段。
- Edge case：CHANGELOG 两种格式分别被正确解析；flat-bullet 格式（spec-first 风格）也能抽到。
- Edge case (commit 超量)：commits 超 200 → `commitsTruncated: true`。
- Error path：commit subject 含单双引号、`$`、反引号、中文 → facts JSON 仍合法（node -e env/stdin 路径）。
- Error path：`.git/spec-first/` 无法写入 → warn + fallback stdout + 仍写 marker 到 TMPDIR。**Covers AE4.**
- Integration：SKIP_NOTES=true → 跳过全部本单元。
- Dry-run：不写 `.git/spec-first/`、不写 marker、不打印 facts JSON。**Covers AE2.**

**Verification:**
- `cat .git/spec-first/version-facts-$NEW_VERSION.json | node -e "JSON.parse(require('fs').readFileSync(0))"` 不抛错。
- 首次发布仓库（无 v* tag）上 `firstRelease: true` 且 commits ≥ 1。
- 有 non-v* tag 但无 v* tag 的仓库走 warning 分支而非 first-release。
- stdout 含 Phase 2 trigger phrase、facts 绝对路径、marker 绝对路径。

---

### U5. SKILL.md — release-notes handoff contract (Phase 2)

**Goal:** 在 SKILL.md 中固化 Phase 2 的完整契约：Trigger（短语或 marker 检测）/ Input（facts JSON）/ LLM Prompt Template / 6-header 双语 Structural Validation / Write Path / Commit（用 commitConventionHint 而非 agent 自行启发）/ Marker Cleanup。

**Requirements:** R5, R6, R9, R10, R20, R22；间接 R11。

**Dependencies:** U1（框架就位）、U4（facts schema 确定）。

**Files:**
- Modify: `SKILL.md`（新增 "Release Notes Handoff" 主节）
- Create: `prompts/release-notes.md`（独立 prompt template 文件，由 SKILL.md 引用；避免 SKILL.md 同时承担操作文档与 prompt 契约两个角色）

**Approach:**
- **Trigger & Input**：Phase 2 入口 = 用户在任一 agent 会话中说"继续处理 git-npm pending release notes"；或 agent 启动时扫描 `.git/spec-first/pending-notes-*` 主动提示用户。输入是该 marker 同目录下的 `version-facts-<v>.json`。
- **LLM Prompt Template**：正文在 `prompts/release-notes.md`；SKILL.md 只说明"system + user 结构 + 6 个固定双语 H2 标题 + 事实集字段引用方式"。prompt 明确要求按 `commitConventionHint` 调整语气、按 `targetRepo.name` 定位叙事主体、按 `firstRelease` 区分"本版亮点 vs 从零开始"。
- **Structural Validation**：正则同时匹配中英 `^## (摘要|亮点|新增|修复|破坏性变更|升级注意事项|Summary|Highlights|Added|Fixed|Breaking Changes|Upgrade Notes)$`；存在数 ≥ 6 → 静默写；3–5 → 写 + warn（R20 灰区）；< 3 → F2 降级（不写，保留 facts 和 marker，提示人工补写）。
- **Write Path**：`YYYY-MM-DD-<version>.md`（本地日期）+ `docs/VERSION/`；不存在则 mkdir；已存在则覆盖（R10）。
- **Commit**：直接使用 `facts.commitConventionHint` 而非 agent 自己扫 git log：
  - `convention == "conventional" && taskPrefix` → `[TASK-RELEASE-NOTES] docs(version): v<v> release notes`
  - `convention == "conventional" && !taskPrefix` → `docs(version): v<v> release notes`
  - `convention == "freeform"` → `docs: add v<v> release notes`
  - `git add docs/VERSION/<file>.md` + `git commit -m '<msg>'`
  - push 策略沿用 Important guardrails 的 `master`-direct 规则；PR-only 仓库在 SKILL.md Failure Modes 明确说明 v1 不支持并给出人工处理指引。
- **Marker Cleanup**：commit 成功后 `rm .git/spec-first/pending-notes-<v>`；F2 降级路径保留 marker 以便后续补写时再次进入 Phase 2。
- **Failure Modes 小节**：列出 F1–F8 所有路径及对应恢复操作。
- **Release Notes Structure 小节**：给出中英双语 6 标题对照表 + 一段中文示例。

**Patterns to follow:**
- 既有 Real-world lessons 小节的"现象 → 规则"结构，用于 Failure Modes 总览。
- Authentication 小节的 "Preferred / Fallback" 二分写法用在 "Normal / Degraded" Release Notes 路径对比。

**Test scenarios:**
- Test expectation: none — documentation + prompt template 文档；由 U7 smoke 间接校验。

**Verification:**
- 未读本 plan 的 agent 仅凭 SKILL.md + `prompts/release-notes.md` 能在测试仓库上完成 Phase 2 全路径。
- Failure Modes 覆盖 F1–F8；每条路径映射至少一个 AE。
- prompt template 在独立文件便于后续迭代（不污染 SKILL.md）。

---

### U6. SKILL.md — guardrails consolidation

**Goal:** 收敛 Important guardrails 与 Validation Checklist；**不预置 1.5.5 lessons 占位**（由 review 回写：占位节会被读者误解为文档缺漏，且提前创建空节无信息价值；经验回填由 U7 完成首次 rollout 后在 A1 手动追加时创建）。

**Requirements:** R13；间接 R14–R22 面向用户的收口呈现。

**Dependencies:** U1, U5（SKILL.md 主体已落）。

**Files:**
- Modify: `SKILL.md`（Important guardrails / Validation Checklist 两节）

**Approach:**
- Important guardrails 追加：
  - 每次真实发布必创建 `v<version>` lightweight tag；dry-run 不创建
  - bump-commit 先于 tag：publish.sh Step 4.5 负责对齐目标仓库 `release:publish` 副作用
  - 同名 tag 同 commit 幂等；不同 commit warn+SKIP_NOTES+继续（不 exit，与 publish 失败区分）
  - tag 本地创建失败 warn+跳 notes+不撤 publish
  - tag push 1 次重试后 warn；本地 tag 权威，Phase 2 继续
  - preflight 校验 `docs/VERSION/` 已从 npm pack 排除；未排除 abort（不自动补写）
  - LLM 不可用或输出 < 3 个必需分块 warn 并保留 facts 和 marker，不阻塞 publish
  - release notes 辅助归档，非审计证据；审计链只到 tag ↔ tarball
  - SKIP_NOTES 在 Step 5 入口必须显式 `SKIP_NOTES=false` 初始化（set -u 防御）
  - Phase 2 触发不依赖同会话；用户可在任何 agent 会话中以约定短语触发
- Validation Checklist 追加：
  - `git tag --list "v$NEW_VERSION"` 存在
  - `git show v$NEW_VERSION -- docs/VERSION/ 2>&1 | head` 空（tag 不含报告文件）
  - `ls -la .git/spec-first/version-facts-$NEW_VERSION.json` 真实发布后存在
  - `ls .git/spec-first/pending-notes-$NEW_VERSION` Phase 1 后存在、Phase 2 完成后消失
  - `ls docs/VERSION/$(date +%Y-%m-%d)-$NEW_VERSION.md` Phase 2 成功后存在
- **不预置 `Real-world lessons from 1.5.5` 占位节**；由 U7 首次 rollout 后由 A1 追加。

**Test scenarios:**
- Test expectation: none。

**Verification:**
- Important guardrails 增加 ≥ 8 条，既有 1.5.3/1.5.4 条目保留。
- Validation Checklist 增加 ≥ 5 条，含 marker 生命周期校验。
- 无"待回填"空节残留。

---

### U7. Rollout Checklist — two-step smoke (throwaway → spec-first)

**Goal:** 定义首次真实启用的 rollout 流程（不是代码交付物；本 unit 是可手工执行的 checklist）；通过 review 从原"直接在 spec-first 上做首发 smoke"调整为两步：先在低风险 throwaway target 上验证端到端，再切换到 spec-first 做正式 rollout，降低不对称风险。

**Requirements:** 间接覆盖所有 R；主要为 AE1–AE12 提供真实证据。

**Dependencies:** U1–U6 + U8 全部完成。

**Files:**
- None created. 仅对 `SKILL.md` 记录本 checklist 作为附录（在 Documentation / Operational Notes 段落）。

**Approach:**
- **Step 1 throwaway smoke**（强烈推荐）：
  - 选用一个低风险 target（推荐 npm 私有 registry + toy package 或本地 verdaccio；若只能用 public npm，用 scoped package `@leokuang/git-npm-smoke-YYMMDD`）。
  - 跑 `bash ~/.claude/skills/git-npm/scripts/publish.sh patch --dry-run` → Step 1 preflight / dry-run 占位 / Step 4.5/5/6 均不执行验证。
  - 跑真实 `patch` release → Phase 1 全步骤 + Phase 2 agent 交接。
  - 观察：AE1/AE5/AE7/AE8/AE9/AE10/AE11/AE12 是否逐条满足。
- **Step 2 spec-first rollout**（throwaway 全绿后执行）：
  - 前置确认：spec-first `.npmignore` 或 `package.json#files` 已排除 `docs/VERSION/`（**必做确认**，否则 R19 abort）。
  - 前置确认：spec-first 当前无 uncommitted 改动。
  - 跑 `--dry-run`。
  - 跑真实 `patch` release（仅在 throwaway 全绿 + 前置确认齐备时）。
  - Phase 2 完成后：`git show v<NEW>` 不含 docs/VERSION/；主干 HEAD 在 tag 之后多一条 notes commit。
- **Step 3 lessons 回填**：首次真实 rollout 后，把 throwaway + spec-first 两轮中暴露的真实坑写入 SKILL.md 的新建 `Real-world lessons from spec-first@<NEW>` 节（由 A1 首次创建该节；U6 不预置）。

**Execution note:** 手工 smoke；不自动化（与 skill 当前无测试套件的工程定位一致）。Rollout Checklist 属于手工交付物；U1–U6 + U8 完成后该 checklist 可被单独执行。

**Test scenarios:**
- Integration (AE1, AE2, AE5, AE7, AE8, AE9, AE10, AE11, AE12)：throwaway target 端到端，每 AE 逐条打勾。
- Integration (AE1, AE5, AE11)：spec-first rollout 验证真实场景下 bump-commit → tag → facts → Phase 2 全链路。

**Verification:**
- throwaway smoke 全 AE 绿后才进入 spec-first rollout。
- 两轮都符合预期；偏差记录为 lessons 回填素材。
- 若 throwaway 暴露严重缺陷，回到 U1–U6 + U8 修订，不进入 spec-first rollout。

---

### U8. publish.sh — Step 4.5 bump-commit alignment（R21）

**Goal:** 对齐目标仓库 `release:publish` 是否自行提交 bump 的行为差异，保证 Step 5 tag 所指 commit 与 npm tarball 内 `package.json.version` 一致。

**Requirements:** R21；间接支撑 R14/R15（tag 锚点正确性）、origin 1.5.4 lesson "tarball ≠ git HEAD"。

**Dependencies:** U2（Step 1 preflight 已确认 Step 3 前 worktree clean）。

**Files:**
- Modify: `scripts/publish.sh`（Step 4 之后、Step 5 之前插入 Step 4.5）

**Approach:**
- Step 4.5 入口前置：`PRIOR_RELEASE_PUBLISH_SELF_COMMITTED=false`。
- dry-run 分支：`echo "▸ dry-run — Would commit bump if dirty";` 跳过实际 commit/push。
- 真实分支：
  1. `CURRENT_STATUS=$(git status --porcelain)`。
  2. `CURRENT_STATUS` 空 → `echo "✓ release:publish self-managed git state (no bump residue); skipping Step 4.5"`；设 `PRIOR_RELEASE_PUBLISH_SELF_COMMITTED=true`；继续 Step 5。
  3. `CURRENT_STATUS` 非空：
     - 验证脏文件只包含 bump 预期的范围（`package.json` 必含；`CHANGELOG.md`、`package-lock.json`、`pnpm-lock.yaml` 允许；其他路径 → warn 列出 + abort 整个流程前询问是否继续——保守做法：遇到非预期脏文件时 `echo "✗ worktree contains unexpected changes after publish: <list>"; echo "  publish succeeded but Step 4.5 aborts to avoid committing unrelated changes"; echo "  手工处理：git stash 非 bump 改动 → 重新只对 bump 文件 commit"; SKIP_NOTES=true; continue`（不 exit，与 U3 的 F4/F5 一致）。
     - 脏文件全在允许范围：`git add <allowlist>` → `git commit -m "chore(release): v$NEW_VERSION"`（若 `facts.commitConventionHint.convention == "freeform"` 则用 `bump: v$NEW_VERSION`；本 Step 的 commit 也是仓库 commit，遵循同样检测；但因 Step 4.5 执行时 facts 未写，检测在本 Step 内直接运行同样的 20-commit 窗口扫描即可）。
     - commit 后 `git push $REMOTE $CURRENT_BRANCH`；push 失败 sleep 2 重试一次；仍失败 warn + SKIP_NOTES=true + 继续（与 tag push 失败一致；保持 publish 结果）。
- 将 `PRIOR_RELEASE_PUBLISH_SELF_COMMITTED` 导出供 Step 6 U4 写入 facts。

**Execution note:** 本单元是 R21 的唯一实现点；设计为幂等——对 release-it / changesets 等自己做 bump commit 的目标仓库无副作用。

**Technical design:** *directional*

```text
Step 4.5 Bump-commit
├── dry-run?  -> print would-commit-if-dirty, continue
└── real:
    ├── status = git status --porcelain
    ├── status empty? -> PRIOR_SELF=true, continue (release:publish self-managed)
    └── status non-empty?
        ├── all in allowlist (package.json, CHANGELOG.md, lockfiles)?
        │   ├── yes -> git add; git commit; git push (1 retry); continue
        │   └── no  -> warn list unexpected; SKIP_NOTES=true; continue (保护)
```

**Patterns to follow:**
- 既有 Step 1 preflight 的 `git status --porcelain` 惯用法。
- 既有 `▸/✓/⚠/✗` 前缀系统；"publish 已成功但 X 失败" 的双行输出。

**Test scenarios:**
- Happy path (spec-first 风格)：Step 4 后 worktree 脏（package.json）→ Step 4.5 commit + push → HEAD 前进；PRIOR_SELF=false。**Covers AE11.**
- Happy path (release-it 风格)：Step 4 后 worktree 干净 → Step 4.5 跳过；PRIOR_SELF=true。
- Edge case：worktree 脏但含非 bump 文件（如随机修改） → warn + SKIP_NOTES=true + 继续（不 exit）。
- Error path：bump commit 通过但 push 失败两次 → warn + SKIP_NOTES=true + 保留本地 commit + 继续。
- Error path：commit 本身失败（pre-commit hook 拒绝） → warn + SKIP_NOTES=true + 继续（publish 已完成不撤销）。
- Dry-run：不 commit、不 push，仅打印占位。**Covers AE2.**

**Verification:**
- spec-first 真实 publish 后 `git log -1 --format=%s` 为 `chore(release): vX.Y.Z`；remote master 上该 commit 可见。
- `package.json.version` 在 HEAD tree 中等于 `$NEW_VERSION`。
- release-it 风格仓库无多余 commit。

---

## System-Wide Impact

- **Interaction graph:** publish.sh 不再是终点；新增 Step 4.5 bump-commit（bash 内，新行为）与 host Agent ↔ LLM ↔ FS ↔ git 第二阶段；pending marker 让 Phase 2 可跨会话消化。
- **Error propagation:** LLM 失败 / tag 失败 / tag 冲突 / bump-commit 失败 / 非预期脏文件都不回滚已完成的 publish；preflight（R19）与 Step 4.5 的非预期脏文件检查可以阻塞后续步骤但不撤 publish。
- **State lifecycle risks:** `.git/spec-first/` 新增持久化状态（facts + pending marker）；同版本重 publish 覆盖 facts（与 R10 一致）；首次发布走 R4 退化；tag 创建失败需要运维手动清理（v1 无工具）。pending marker 累积：正常路径会被 Phase 2 删除；F2 降级保留。
- **API surface parity:** 目标仓库需在 `.npmignore` 或 `package.json#files` 显式排除 `docs/VERSION/`（新契约）；目标仓库 `release:publish` 的 git-state 语义差异被 Step 4.5 屏蔽，对调用方透明。
- **Integration coverage:** U7 rollout checklist 两步 smoke 覆盖端到端；AE1–AE12 分布映射到 U2–U4 + U8；Phase 2 由 agent + human 验证。
- **Unchanged invariants:** publish.sh **既有 4 个 publish-cycle 步骤的语义**（Preflight / Quality / Publish / Post-publish verify）全部保留；Step 4.5 / 5 / 6 是新增而非替换，其失败不会回滚已完成的 publish。registry mirror 防护 / worktree clean 入口检查 / `auto` 非幂等警示 / OTP vs token 顺序 / 现行 `pnpm run release:publish` 间接调用全部不变。

---

## Risks & Dependencies

| Risk | Mitigation |
|---|---|
| 目标仓库 `release:publish` 行为差异（spec-first 不 commit、release-it 自 commit+push+tag）未穷举 | Step 4.5 用 `git status --porcelain` 做 runtime detection，自动分叉 self-managed vs delegated；U7 throwaway smoke 先在至少两种风格上跑 |
| 宿主 Agent 未能识别 Phase 2 交接时机 | Phase 2 不再强依赖同会话：pending marker + 约定触发短语，任一后续 agent 会话都能消化；SKILL.md Quick Start 明示 |
| `npm pack --dry-run --json` 版本差异 | parse 失败 warn+放行 + stderr 标注"请人工确认"；U7 throwaway 阶段在多 npm 版本上采样 |
| 首次发布仓库无上一 v* tag | R4 退化 + `firstRelease:true`；non-v* tag 场景走 warning 分支（不误标 firstRelease） |
| LLM 非确定性 | R20 明确"非审计证据"；结构灰区不自动重试；同日同版本覆盖 |
| 大规模 rename / 迁移期间触发 | 沿用 1.5.4 guardrail；U6 Important guardrails 继承 |
| `.git/spec-first/` 未来与 spec-first runtime 冲突 | 目录命名独立不依赖 spec-first runtime；未来冲突通过 skill 升级迁移 |
| lightweight tag 下游工具兼容性 | Deferred to Follow-Up Work；升级到 annotated 是局部改动 |
| facts 文件长期累积 | Deferred to Follow-Up Work（v1 不清理，记录技术债） |
| commit subject 中特殊字符（引号/`$`/反引号/中文）炸 `node -e` | U4 强制 env/stdin 传值 + JSON.parse 自校验；Verification 项必检 |
| 中文用户之外的使用者 | v1 接受中英双语 header；英文用户可用英文 LLM 输出；opt-in 全英文 prompt 记为未来增强 |
| U7 throwaway smoke 找不到可用目标 | 推荐 verdaccio 本地 registry 或 scoped npm package；文档中给 3 种路径选择 |

---

## Documentation / Operational Notes

- SKILL.md 是主要对外文档（U1/U5/U6）；`prompts/release-notes.md` 独立承载 LLM prompt 正文。
- `.git/spec-first/` 位于 `.git/` 内，天然不 tracked；U6 Validation Checklist 会提示人工确认。
- git-npm skill 自身升级到 1.5.5+ 作为本 feature 上线标志；**git-npm 自己递归 adopt 本 flow 推迟到 v1.5.6+**（避免首次 rollout 递归风险）。
- 目标仓库操作者须知：首次启用前确认 `.npmignore` 或 `package.json#files` 排除 `docs/VERSION/`；否则首次 publish 必 abort（符合设计，但用户应预期）。
- U7 rollout checklist 建议先在 throwaway target 跑，再在 spec-first 正式 rollout。
- 如首次 rollout 暴露真实坑，由 A1 在 SKILL.md 新建 `## Real-world lessons from spec-first@<NEW>` 节追加（U6 不预置占位）。

---

## Sources & References

- **Origin document:** `docs/brainstorms/2026-05-11-001-git-npm-version-report-requirements.md`
- Related code (target repo): `~/.claude/skills/git-npm/SKILL.md`、`~/.claude/skills/git-npm/scripts/publish.sh`
- Related code (verified during review): `scripts/release-publish.cjs`（spec-first 的发布脚本；feasibility review 直接阅读确认成功路径不 commit/push，是 R21 与 U8 的动因）
- Related learnings: SKILL.md 内 `Real-world lessons from spec-first@1.5.3` 与 `@1.5.4` 小节
- Related project governance: spec-first `CLAUDE.md`（scripts prepare, LLM decides；source vs runtime 边界；CHANGELOG 治理）——本计划消费该哲学，但目标 skill 不在 spec-first 管理范围内
- Document review round 1: 跨 5 persona（coherence / feasibility / product-lens / scope-guardian / adversarial）的 ~40 条 finding；P0（4-persona 收敛）触发 R21 / U8 新增与 Step 4.5 设计；P1（≥7 条）触发 Step 5 `exit 1` → `warn+SKIP_NOTES`、`git describe HEAD^` → `git tag --list --sort=-v:refname`、CHANGELOG 两段式抽取、SKIP_NOTES 入口初始化、Phase 2 pending marker、双语 header、U7 两步 smoke、System-Wide Impact 步数措辞、LLM prompt 外置等修订。
