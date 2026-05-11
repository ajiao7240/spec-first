---
date: 2026-05-11
topic: git-npm-version-report
spec_id: 2026-05-11-001-git-npm-version-report
---

# git-npm 发布后生成面向用户的版本内容报告

## Summary

在用户级 standalone skill `git-npm` 现有"发布成功后收尾"阶段追加两件事：一是基于脚本制备的确定性事实（上一 release tag → HEAD 的 git log、变更文件、CHANGELOG 顶部条目）由 LLM 归纳为面向用户的结构化 release notes，写入目标仓库 `docs/VERSION/YYYY-MM-DD-<version>.md` 并以独立 commit 追加到主开发分支；二是每次真实发布强制创建一个 `v<version>` git tag，使"版本 ↔ tag ↔ tarball"三者在审计上形成稳定映射；release notes 作为辅助归档，不列入审计映射。

---

## Problem Frame

当前 `git-npm` 真实发布流程只维护 `CHANGELOG.md`，其定位是面向开发者的逐版本开发侧记录——行级变更、任务号、技术上下文。用户需要的是面向读者（他人、未来的自己、外部使用方）的**版本内容报告**：按新增 / 修复 / 破坏性变更分块，说明这一版带来的价值与升级注意事项。

目前这类信息要么散落在 commit message、CHANGELOG、PR 描述里需要读者自行拼装，要么每次发布后由人工另写一份，缺乏稳定的落盘约定与自动化。随着 `spec-first` 等仓库发布频率上升、跨版本迁移（术语重命名、schema 演进）变多，发布后没有稳定的用户视角快照，审计和对外沟通成本持续累积。

本次改动的目的是让 `git-npm` 在不改变现有安全发布流程的前提下，把"发布完 → 输出可读版本报告 → 入库"这一步固化下来。本版选择"两份并存"（CHANGELOG 开发者视角 + release notes 用户视角）而非把 CHANGELOG 渲染成用户视角，原因是：CHANGELOG 的治理（逐次 commit 追加、任务前缀、rev 作者）是提交期证据；release notes 是发布期归档，两者的生命周期、写作视角、读者都不同，合并会迫使 CHANGELOG 丢失 commit 粒度或让 release notes 失去阅读性。

---

## Actors

- A1. 发布执行者：在目标仓库中触发 `git-npm` 发布流程的人类用户；最终 release notes 的首要读者与质量把关人。
- A2. `git-npm` skill 脚本层：负责版本检测、git/npm 预检与实际发布、确定性事实收集与文件落盘、commit。
- A3. LLM（宿主对话模型）：消费脚本输出的事实集，产出结构化 release notes 文本。

---

## Key Flows

- F1. 发布成功后创建 tag、生成版本报告并入库
  - **Trigger:** 目标仓库执行 `git-npm` 真实发布（非 `--dry-run`）且 `npm publish` 返回成功。
  - **Actors:** A2, A3, A1
  - **Preconditions:** publish 前 worktree clean；bump-to-`v<version>` commit 已落库；目标仓库 `.npmignore` 或 `package.json#files` 已排除 `docs/VERSION/`（见 R19）。任一前置未满足则由 preflight 阶段 abort，不进入 F1。
  - **Steps:**
    1. 脚本捕获发布成功信号，读取新版本号与发布时间；定位 release snapshot commit（见 Dependencies 的精确定义）。
    2. 脚本在 release snapshot commit 上打 `v<version>` git tag；同名 tag 已存在且指向同一 commit 视为幂等成功、跳过；指向不同 commit 或本地创建失败则按 R17/R18 降级。
    3. 脚本收集确定性事实：上一 release tag → HEAD 的 commit 列表、变更文件清单、`CHANGELOG.md` 本次版本条目。
    4. 脚本把事实集交给 LLM 并请求结构化 release notes；LLM 按约定分块输出。
    5. 脚本确保目标仓库 `docs/VERSION/` 目录存在（不存在则创建），按 `YYYY-MM-DD-<version>.md` 写入报告文件。
    6. 脚本把该文件作为独立 commit 提交到主开发分支；commit 位于 tag 之后，不重新执行 `npm publish`、不进入已发布的 tarball、不移动 tag。
  - **Outcome:** 已发布版本对应的 release snapshot commit 上存在 `v<version>` tag；主开发分支比 tag 多出一条版本报告 commit；目标仓库 `docs/VERSION/` 下新增一份当日当版报告。
  - **Covered by:** R1, R3, R4, R6, R8, R14, R15, R17, R19

- F2. LLM 不可用或归纳失败时的降级
  - **Trigger:** F1 第 4 步 LLM 调用失败、超时或返回空 / 非预期结构。
  - **Actors:** A2, A1
  - **Steps:**
    1. 脚本不重试 LLM、不阻塞整体发布结果。
    2. 脚本输出明确 warning，指出 release notes 未生成及原因。
    3. 脚本把事实集写入 `.git/spec-first/version-facts-<version>.json` 并在 stdout 打印路径，便于 A1 事后人工补写（取代仅保 stdout 的早期约定）。
    4. 后续 commit 步骤被跳过：不写出空 / 残缺的 `docs/VERSION/` 文件，不追加 release notes commit；已创建的 `v<version>` tag 保持不变。
  - **Outcome:** 已发布版本保持成功状态；tag 保持；报告缺失但事实集可追溯。
  - **Covered by:** R11, R12, R20

---

## Requirements

**触发与时机**
- R1. `git-npm` 在真实发布（`npm publish` 返回成功）后、主干收尾阶段，追加一步版本报告生成。
- R2. `--dry-run` 模式不得写入 `docs/VERSION/`、不得产生 release notes commit。
- R3. 版本报告必须在 `npm publish` 成功之后生成，不得进入已发布的 tarball。

**内容与归纳策略**
- R4. 脚本负责收集确定性事实集，至少包括：上一 release tag 到 HEAD 的 commit 列表（含 subject/scope）、变更文件清单、`CHANGELOG.md` 本次版本条目。首次发布（无上一 release tag）时退化为：仓库初始 commit 到 HEAD 的全量 commit + 本版 `CHANGELOG.md` 条目；skill 文档须显式说明该退化为 first-release fallback。
- R5. release notes 的自然语言内容由 LLM 归纳，脚本不得机械拼装正文（降级路径除外）。
- R6. release notes 至少覆盖：一句话版本摘要、本版亮点、新增、修复、破坏性 / 不兼容变更、升级注意事项；某一类无内容时省略该块，不留空标题。

**落盘与入库**
- R7. 报告文件路径硬约定为 `docs/VERSION/YYYY-MM-DD-<version>.md`；`<version>` 使用 `package.json.version`，日期使用脚本执行时机的本地日期。
- R8. 若目标仓库不存在 `docs/VERSION/` 目录，脚本自动创建；不放置 `.gitkeep` 之类占位文件。
- R9. 报告写入后以独立 commit 追加到主开发分支（与现有 release snapshot commit 策略协同，不覆盖原 snapshot commit 边界）。commit message 默认沿用目标仓库当前的约定（若仓库中 `CLAUDE.md` / `AGENTS.md` 启用 Conventional Commits 并强制任务前缀，则跟随；否则使用中性的 `docs(version): v<version> release notes` 作为 fallback）。
- R10. 同一日同一版本重复发布时，覆盖已有当日文件；不追加 `-2`、`-retry` 等后缀。

**失败与降级**
- R11. 当 LLM 不可用、超时或返回无效内容时，脚本输出 warning 并跳过报告写入与 commit，不得阻塞已完成的 publish 结果。
- R12. 降级路径不得写出空白或残缺的 `docs/VERSION/` 报告文件；事实集须持久化到 `.git/spec-first/version-facts-<version>.json` 并在 stdout 打印路径，保证 CI / 远程发布场景的证据不丢失。

**Tag 强制**
- R14. 每次真实发布（非 `--dry-run`）成功后，脚本必须在 release snapshot commit 上创建 `v<version>` 形式的 git tag；tag 指向的 commit 必须与已发布 tarball 对应的源码树一致。`--dry-run` 路径不得创建 git tag、不得 push tag，仅把将要创建的 tag 名输出到 stdout。
- R15. tag 创建步骤先于 release notes 的 commit，确保 tag 指向的源码不包含 release notes 文件；禁止在已存在的同名 tag 上强制覆盖。
- R16. tag 推送到 remote 的策略沿用目标仓库既有分支策略（如 `master` 直接提交场景默认 `git push --tags`），不单独在本次变更中引入新的 push 规则；若推送失败，给出 warning，不回滚已创建的本地 tag、不阻塞发布成功结论。
- R17. 同名 `v<version>` tag 已存在时的处理：若已有 tag 指向当前 release snapshot commit，视为幂等成功并跳过 tag 创建，继续执行 release notes 流程；若指向不同 commit，则 abort release notes 流程并 warn 要求人工介入，已发布的 registry 结果保持。
- R18. tag 本地创建因磁盘 / 权限 / hook 等原因失败时（非 R17 同名冲突），脚本输出 warning 并跳过后续 release notes commit，但不撤销已完成的 publish；事实集按 R12 持久化。

**发布前校验**
- R19. preflight 阶段须验证目标仓库已通过 `.npmignore` 或 `package.json#files` 排除 `docs/VERSION/`；未排除则 abort 发布并给出修复提示。自动补写排除规则 vs 仅告警的选择留给 planning。

**Skill 文档与源代码对齐**
- R13. 本次行为变更须同步更新 `~/.claude/skills/git-npm/SKILL.md` 的流程说明、Validation Checklist 与 Important guardrails 段落，以及对应的发布脚本实现。

**LLM 输出质量与审计边界**
- R20. release notes 被明确定位为辅助归档而非审计证据；审计映射只保证 "`v<version>` tag ↔ tarball 源码树" 一致。skill 文档须显式声明这一点，避免下游把 release notes 当作发布证据使用。LLM 输出的最小结构校验（R6 所列分块的存在性）由脚本在写入前做一次，缺失一整份输出走 F2 降级；结构不完整但非空的灰区按"人工复核优先，不自动重试"处理。

---

## Acceptance Examples

- AE1. **Covers R1, R3, R4, R5, R6, R7, R9.** Given 目标仓库工作区干净且 `npm publish` 返回成功，when `git-npm` 进入收尾阶段，then 脚本收集事实集并调用 LLM 得到结构化 release notes，目标仓库出现 `docs/VERSION/2026-05-11-<new-version>.md` 新文件并以独立 commit 追加到主开发分支，已发布的 tarball 内不包含该文件。
- AE2. **Covers R2, R3, R14.** Given 用户以 `--dry-run` 运行 `git-npm`，when 流程结束，then `docs/VERSION/` 下不新增任何文件、不产生任何 release notes commit、也不创建或推送任何 git tag；dry-run 仅把将要创建的 tag 名打印到 stdout。
- AE3. **Covers R8, R10.** Given 目标仓库此前不存在 `docs/VERSION/` 目录且同日以同一版本号重复发布一次，when 第二次真实发布成功，then 目录被自动创建、`2026-05-11-<version>.md` 以第二次发布的新内容覆盖第一次的文件，不出现 `-2` 后缀文件。
- AE4. **Covers R11, R12, R18.** Given 发布成功后 LLM 调用失败或返回空内容，when 脚本进入 release notes 阶段，then `docs/VERSION/` 不落盘任何文件、不追加 release notes commit，事实集被写入 `.git/spec-first/version-facts-<version>.json` 并在 stdout 打印路径；已发布版本结果不变；已创建的 `v<version>` tag 保持不变。
- AE5. **Covers R14, R15.** Given `npm publish` 已返回成功，when 脚本执行收尾步骤，then 在 release snapshot commit（与 tarball 对应）上出现 `v<version>` tag；随后追加的 release notes commit 在 git log 中位于该 tag 之后、主开发分支 HEAD 处；`git show v<version>` 不含 `docs/VERSION/` 新文件。
- AE6. **Covers R15, R17.** Given 之前因异常留下了同名 `v<version>` 本地 tag 且指向与本次 release snapshot commit 不同的 commit，when 当前这次 `git-npm` 发布流程执行到 tag 步骤，then 脚本不强制覆盖，输出明确 warning 并 abort 后续 release notes 流程要求人工介入；已 publish 到 registry 的结果保持。
- AE7. **Covers R4（first-release fallback）.** Given 目标仓库首次发布、无任何上一 release tag，when 脚本收集事实集，then 事实集退化为"仓库初始 commit → HEAD 全量 commit + 本版 CHANGELOG 条目"；LLM 成功归纳后，生成的 report 结构与常规发布一致；skill 在 stdout 明确提示"首次发布 fallback 路径"。
- AE8. **Covers R17（idempotent tag）.** Given 同名 `v<version>` tag 已存在且指向与本次 release snapshot commit 相同的 commit（如半自动重试场景），when 脚本执行 tag 步骤，then 视为幂等成功、不 warn，release notes 流程继续正常执行。
- AE9. **Covers R18.** Given `npm publish` 已成功但本地 tag 创建因 git hook 拒绝或磁盘权限问题失败，when 脚本处理该失败，then 输出明确 warning、跳过 release notes commit、按 R12 写 fact set；已 publish 的 registry 结果不回滚。
- AE10. **Covers R19.** Given 目标仓库 `.npmignore` 与 `package.json#files` 均未排除 `docs/VERSION/`，when 用户触发真实发布，then preflight 阶段 abort 并给出"在 `.npmignore` 添加 `docs/VERSION/` 或在 `package.json#files` 中显式排除"的修复提示，`npm publish` 不会被执行。

---

## Success Criteria

- 任意目标仓库按 `git-npm` 真实发布一次后，在 `docs/VERSION/` 出现结构符合 R6 的当日当版报告，且该报告 commit 位于已发布 tag 之后、主开发分支 HEAD 之前。
- 发布执行者无需手写 release notes，也不用在发布后再跑额外命令；报告是发布流程的自然产出。
- 下游（`spec-plan` / 手工实现者）能够只从本需求文档推进到 `git-npm` 源文件与发布脚本的具体改造，不需要反向补齐产品决策（触发时机、定位、路径、失败策略、tag 冲突策略、LLM 失败持久化、tarball 排除 preflight）。
- LLM 不可用 / 输出残缺 / tag 冲突 / tag 创建失败这四类异常场景下，发布结果、CHANGELOG、tag（已创建的部分）、主干状态均保持既有 `git-npm@1.5.4` 成功路径的质量；事实集可复用、异常不静默。

---

## Scope Boundaries

- 不改造目标仓库现有 `CHANGELOG.md` 的生成 / 维护方式；`CHANGELOG.md` 仍按仓库自身治理规则维护。CHANGELOG 与 release notes 定位分工在本版明确，不追求格式合一（Key Decisions 已记录理由）。
- 不把 release notes 自动推送到 GitHub Release、npm README、外部公告渠道、社交媒体；**消费路径（README 链接、发布索引页、对外发布页）本版不做**，仅保证 `docs/VERSION/` 作为稳定的本地归档落点。
- `--dry-run` 流程不生成正式报告，也不生成 `docs/VERSION/` 下任何预览文件；不创建 / 不推送任何 git tag。
- 不引入 `package.json` 字段或环境变量来改写报告路径或文件命名（本次硬约定）。
- 不支持跨仓库 / 父级 workspace 级别汇总 release notes。
- 不为历史版本回填 `docs/VERSION/` 报告。
- 不改动 `git-npm` 现有的主干 push、OTP/token 认证、mirror registry 防护等策略；tag 创建变为强制（见 R14–R18），tag **推送**策略仍由仓库分支策略决定。
- 不自动改写目标仓库 `.npmignore` 或 `package.json#files`；R19 的 preflight 只校验并提示（自动补写留给 planning 评估）。
- 不扩展 release notes 的多语言版本 / 翻译流程。
- 不把 release notes 纳入发布审计证据链；审计映射只到 tag ↔ tarball 层。

---

## Key Decisions

- 面向用户的 release notes，与开发者视角的 `CHANGELOG.md` 互补共存：二者生命周期不同（提交期 vs 发布期）、读者不同、写作视角不同；合并会迫使任一方失真。
- LLM 归纳为主、脚本只准备事实：遵循 `scripts prepare, LLM decides` 哲学，避免脚本冒充语义判断。
- 发布后生成而非发布前：发布前生成会让"是否发布成功"与"报告是否写好"耦合，放大发布失败的复杂度；发布后生成让报告仅作为"对外归档"的追加物，失败时降级成本最低。
- 独立 commit 而非并入 release snapshot commit：让已发布 tarball 内容与 tag 对齐，避免用户审计"tag 指向的代码是否包含 release notes"时产生歧义。
- 硬约定 `docs/VERSION/YYYY-MM-DD-<version>.md`：在当前仅此一位用户的前提下，优先消除配置面，未来若需要跨多仓支持再引入可配置层。
- 同日同版本覆盖而非追加后缀：保持"版本号 → 报告文件"一一映射，便于 diff 与外部引用。
- Tag 强制创建且先于 release notes commit：让 `v<version>` 始终指向 tarball 对应的代码树，审计者用 `git show v<version>` 看到的内容与 npm registry 上的 tarball 等价；release notes 作为后续归档不污染 tag 所指源码。
- 同名 tag 的幂等 vs 冲突处理分叉（R17）：同 commit 幂等、异 commit abort。既消解"同日重发布" R10 与 R15 的冲突，也防止静默改写历史版本所指向的 commit。
- Release notes 与强制 tag 绑定为单一 spec 而非拆分：二者围绕"发布产出可稳定索引的归档"同一目标；拆分会引入跨 spec 的协调成本（如 tag spec 先落、notes spec 后落时目录结构命名仍需对齐），当前单一维护者场景下耦合收益大于解耦。
- LLM 输出视为辅助归档、不作审计证据（R20）：承认 LLM 非确定性带来的跨版本 release notes 措辞漂移；审计映射收敛到 tag ↔ tarball，release notes 只承担阅读价值。
- LLM 输出质量"灰区"处理策略：脚本做最小结构校验（R6 分块是否存在），缺失整份输出走 F2 降级；结构不完整但非空走"写入 + 人工复核"而非自动重试，避免引入不可追溯的重试循环。
- 失败路径事实集持久化到 `.git/spec-first/`：CI / 远程发布场景 stdout 日志易丢，持久化保证人工补写时仍可拿到事实集，也保留 Success Criteria 的证据闭环。

---

## Dependencies / Assumptions

- 目标仓库使用 git。Release snapshot commit 精确定义为：`npm publish` 执行时 worktree 所对应的 HEAD commit，且该 commit 中 `package.json.version` 等于实际发布到 registry 的版本号；脚本通过比对 `package.json.version` 与 `npm view <pkg> version` 或发布响应来定位；当 worktree dirty 或 bump commit 尚未落库时，preflight 阶段 abort，不进入 F1。
- 首次发布（无上一 release tag）由 R4 的 first-release fallback 覆盖；skill 文档明确告知这是退化路径。
- 目标仓库主开发分支策略与 `git-npm@1.5.4` 经验保持一致：`master` 为直接提交分支、`main` 仅镜像同步。PR-only 流程仓库当前不在默认支持范围，需在 planning 评估额外适配。
- LLM 调用最小契约：`publish.sh` 通过当前宿主的 LLM 调用通道（Claude Code slash-command / Codex equivalent / 其他显式配置的 CLI 通道）完成；"不可用" = 宿主无对应 primitive、或调用 timeout、或返回空 / 无法解析结构。具体超时阈值、宿主检测优先级在 planning 决定。skill 在无可用 LLM 通道的宿主下默认走 F2 降级而不阻塞发布。
- commit message 默认沿用目标仓库现有 Conventional Commits 约定；当仓库中存在 `CLAUDE.md` / `AGENTS.md` 明确强制任务前缀时跟随，否则使用 `docs(version): v<version> release notes` 作为中性 fallback。
- 目标仓库须在 `.npmignore` 或 `package.json#files` 中排除 `docs/VERSION/`；skill 通过 preflight 校验而非自动改写（R19）。
- `~/.claude/skills/git-npm/scripts/publish.sh`（及等价实现脚本）可继续承担新增步骤；若未来该 skill 下沉或迁移目录，本需求文档的硬约定仍然成立，只是实现位置变化。

---

## Outstanding Questions

### Deferred to Planning

- [Affects R5, R6, R20][Technical] LLM 归纳的 prompt 契约与结构化输出形式（纯 Markdown vs. JSON 中转再渲染），以及 R6 分块存在性的最小结构校验具体实现。
- [Affects R9][Technical] release notes commit message 的 subject 细节：是否带版本号、是否沿用 `[TASK-*]` 前缀规则细化格式；skill 如何检测目标仓库的 commit 约定。
- [Affects R11, R12][Technical] LLM 调用的超时阈值与"非预期结构"判定边界（空字符串、截断、JSON 解析失败分别如何处理）。
- [Affects R13][Needs research] 是否把这次 skill 改动同时反映到 `spec-first` 仓库相关文档的 release-notes 治理说明里；若是，具体指向哪个文档段落。
- [Affects R14, R15][Technical] tag 命名是否永远使用 `v<version>`，或在 `package.json` 里出现自定义 `tagPrefix` 时跟随；annotated tag（`git tag -a`）还是 lightweight tag；tag message 的默认内容（是否直接复用 release notes 首段）。
- [Affects R16][Technical] tag 推送失败的重试与降级策略，以及是否在 release 流程结束时做一次"本地 tag 是否已同步到 remote"的终局校验，以及本地-远端 tag drift 的周期性检测与清理入口。
- [Affects R19][Technical] preflight 校验发现 `docs/VERSION/` 未排除时的具体处理：仅 abort+提示，还是 opt-in 自动补写 `.npmignore`；若自动补写，如何处理已在 git 中 tracked 的 `docs/VERSION/` 旧文件。
- [Affects Dependencies][Technical] 非 `master`-direct 仓库（PR-only / 保护分支策略）下 F1 step 6 的独立 commit 推送路径如何适配；当前默认直推 master 的假设在此类仓库会被拒。

### Deferred for Product / Future Consideration

- docs/VERSION/ 报告的"消费路径"（README 链接、发布索引页、GitHub Release、npm 页面）在本版有意留空；后续若要证明 release notes 的用户价值，需明确至少一条对外消费链路。
- 单用户 standalone skill 语境下"面向用户"的 release notes 受益人画像仍模糊；后续若 skill 被更多人使用，需要重新确认受众并可能调整 R6 的分块维度。
- LLM 归纳的质量监测机制（跨版本 release notes 措辞漂移率、信息完整度抽查）留给后续评估；本版仅做结构存在性校验，不追踪质量分布。
