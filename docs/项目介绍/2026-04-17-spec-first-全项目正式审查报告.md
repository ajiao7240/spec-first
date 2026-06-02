# spec-first 全项目正式审查报告

> Lifecycle: historical-input / external-reference. 本文保留历史 CRG/CE/ECC 方案、迁移或对比材料；其中 `src/crg`、`spec-first crg`、`graph.db`、`better-sqlite3`、`.claude-plugin`、命令数量和文件数量等旧口径可能已过期。当前 source of truth 以 `docs/archive-index.md`、`docs/README.md`、根目录 README、`docs/05-用户手册/`、`docs/contracts/`、`skills/`、`src/cli/`、`CHANGELOG.md`、`spec-mcp-setup` 和 direct source evidence workflows 为准。

> 审查时间：2026-04-17
> 审查对象：当前工作树状态下的 `spec-first` 全仓
> 审查原则：一切以代码、测试、脚本输出和仓库内受控文档为依据；不根据愿景文档替代实现事实；不把 sample/skeleton 当作真实能力

---

## 1. 审查范围与方法

本次审查覆盖以下区域：

- `src/cli/`：CLI 入口、双宿主适配、状态管理、安装/清理/诊断链路
- `src/crg/`：CRG 构建、查询、增量、SQLite 存储、review-context
- `src/bootstrap-compiler/`、`src/context-routing/`：Stage-0 / bootstrap 编译与消费链
- `skills/`、`agents/`、`templates/`、`.claude-plugin/`：工作流资产真源与宿主治理
- `tests/`：unit / smoke / integration / e2e / release gate
- `docs/contexts/spec-first/`、`docs/solutions/`、`docs/validation/`：受控样本、经验与历史审计材料

本次采用两层方法：

1. 静态审查：读取关键源码、测试、治理真源和受控样本，检查契约一致性。
2. 运行验证：直接执行仓库自带验证链，并补充最小复现实验确认疑点。

---

## 2. 基线事实

### 2.1 当前工作树不是干净头状态

`git status --porcelain` 统计结果：

- 总变更数：`263`
- `modified`：`157`
- `added`：`4`
- `untracked`：`102`

改动面主要集中于：

- `docs/`：`116`
- `tests/`：`55`
- `skills/`：`43`
- `agents/`：`13`
- `src/`：`5`

这意味着本次审查对象是“当前工作树整体状态”，不是某个稳定发布点。

### 2.2 关键静态事实

- `package.json` 版本：`1.5.1`
- `.claude-plugin/plugin.json` 版本：`1.5.1`
- 命令数：`13`
- `skills/` 目录数：`47`
- `agents/**/*.md` 文件数：`57`
- `agents/` 非 markdown support files：`4`

这些数字与 README 当前对外宣称一致。

### 2.3 已执行的验证命令

本次审查实际执行并观察结果的命令：

```bash
npm run test:unit
npm run test:smoke
npm run test:integration
npm run test:e2e:crg
npm run test:release
node bin/spec-first.js crg stats --repo=.
node bin/spec-first.js crg build --repo=.
```

结论：

- `unit`：`81/81` suites 通过，`408/408` tests 通过
- `smoke`：通过
- `integration`：通过
- `e2e:crg`：通过
- `release`：通过

因此，本报告列出的主要问题不是“现有门禁直接失败”，而是“绿灯下仍存在的语义偏差、盲区或误导性成功”。

---

## 3. 总体判断

### 3.1 优点

项目当前最强的部分有三项：

1. **双宿主治理闭环较完整**
   - `src/cli/plugin.js`、`src/cli/contracts/dual-host-governance/skills-governance.json`、`tests/unit/skills-governance-contracts.test.js`、`tests/smoke/release-dual-host-governance.sh` 形成了“真源 + 单测 + tarball 安装态验证”的闭环。

2. **CLI 安装与受管资产生命周期覆盖度较高**
   - `init` / `doctor` / `clean` 的本地 smoke、install-local、tarball install、双宿主安装态验证都已经具备，说明项目不是只做文档层面治理。

3. **CRG 子系统的完整性验证质量高于仓库平均水平**
   - 除 unit/contracts 外，还补了 `tests/e2e/crg-all-commands.sh` 与 `tests/e2e/crg-sqlite-audit.sh`，这两类验证对图数据库产品非常关键。

### 3.2 主要问题类型

本次审查发现的问题集中在四类：

- 运行结果语义与持久化真相不一致
- release gate 的约束比注释和设计目标更宽
- Stage-0 / bootstrap 编译链存在 sample/skeleton 伪成功
- 治理规则写在文档里，但没有被自动校验到实际内容

---

## 4. Findings

## F1. `crg build` 在 0 变更增量构建时会返回错误的 unresolved 计数

**级别：高**

### 事实

`src/crg/cli/build.js` 在 0 变更增量构建时，明确**不更新**持久化的 `graph_meta.unresolved_edge_count` 与 `unresolved_edges`：

- `src/crg/cli/build.js:287-291`

但随后构造返回 envelope 时，仍直接把本轮内存中的 `unresolvedCount` 写入：

- `src/crg/cli/build.js:390-405`

而在 0 变更增量构建中，`allRawEdges` 为空，`resolveEdges()` 产出的 `unresolvedCount` 也自然是 `0`。

### 复现结果

实际执行：

```bash
node bin/spec-first.js crg build --repo=.
node bin/spec-first.js crg stats --repo=.
```

观察到：

```json
{
  "build": {
    "changed_files": 0,
    "unresolved_edge_count": 0,
    "last_build_unresolved_edge_count": 0
  },
  "stats": {
    "unresolved_edge_count": 2809,
    "last_build_unresolved_edge_count": 2809
  }
}
```

这不是展示层差异，而是**同一仓库、同一时刻、同一图谱状态下两个官方入口给出相互矛盾的 unresolved 结论**。

### 影响

- 用户或上层 workflow 如果读取 `crg build` 返回值，会误判“最近一次构建没有 unresolved 风险”。
- `build` 输出与 `stats` / SQLite 真相分裂，降低了 CRG 作为工程事实底座的可信度。
- 现有 `e2e` 没有保护到这个语义差异，因此回归时不会自动报警。

### 最佳修复方向

在 `parsedChanged.length === 0 && !force` 时：

1. 不应继续把内存中的 `unresolvedCount=0` 当作“最近构建结果”返回。
2. 应回读 `graph_meta.unresolved_edge_count` 与 `unresolved_edges` 表，把持久化真相写回 envelope。
3. 新增一条专门的 regression test：
   - 前置：数据库中已有 unresolved 记录
   - 动作：执行 0 变更增量构建
   - 断言：`build` 输出与 `stats` 输出在 unresolved 维度一致

---

## F2. `test:release` 对未知 `tree-sitter-*` 冲突包实际是放行的

**级别：中高**

### 事实

`tests/smoke/install-tarball.sh` 的注释写的是：

- “冲突包集合断言”
- “断言集合 ⊆ `{tree-sitter-objc}`”

见：

- `tests/smoke/install-tarball.sh:67-69`

但实际 `case` 分支中，未知 `tree-sitter-*` 包进入默认分支后只是打印 warning 并继续通过：

- `tests/smoke/install-tarball.sh:72-90`

### 本次实际观测

本次执行 `npm run test:release` 时，脚本打印：

```text
检测到的 tree-sitter 冲突包: tree-sitter-c-sharp
⚠ 未知 tree-sitter 包: tree-sitter-c-sharp（忽略）
✓ 冲突包集合验证通过
```

这说明当前 release gate 的真实语义不是“只允许 `tree-sitter-objc`”，而是“列入明确禁止名单的少数包不能出现，其余未知包都放行”。

### 影响

- release gate 无法真正守住依赖冲突集合边界。
- 新的 grammar 冲突可以在没有显式决策、没有 ADR、没有测试补充的情况下悄悄进入 tarball。
- 脚本注释、历史设计文档和实际执行语义不一致，容易误导维护者。

### 最佳修复方向

二选一，不能继续模糊：

1. **严格 allowlist**
   - 真正断言集合只能为空或仅为 `{tree-sitter-objc}`
   - 任何新增冲突包直接失败

2. **显式 allowlist with justification**
   - 如果 `tree-sitter-c-sharp` 确实允许存在，就把它加入 allowlist，并在脚本注释、设计文档、CHANGELOG 中说明原因

同时建议新增一个针对安装日志样本的轻量单测或 fixture 校验，避免只靠集成脚本人工观察。

---

## F3. `bootstrap-compiler` 当前主链仍是 sample/skeleton 驱动，现有 mainline E2E 只能证明“能写文件”，不能证明“产物可信”

**级别：中高**

### 事实 1：默认文档内容是骨架文本

`src/bootstrap-compiler/run-bootstrap.js` 内置了：

- `00-summary.md: '# summary\n'`
- `README.md: '# readme\n'`
- `architecture/module-map.md: '# module map\n'`

见：

- `src/bootstrap-compiler/run-bootstrap.js:19-28`
- `src/bootstrap-compiler/run-bootstrap.js:69-79`

我直接运行 `runBootstrap()` 的默认主链，实际读到的产物就是：

```json
{
  "summary": "# summary\n",
  "readme": "# readme\n"
}
```

### 事实 2：routing 和 manifest 仍直接来自 sample generator

`compileRouting()` 直接返回 sample：

- `src/bootstrap-compiler/compile-routing.js:3-14`

`compileMachineArtifacts()` 默认 manifest 也来自 `buildArtifactManifestSample()`：

- `src/bootstrap-compiler/compile-machine-artifacts.js:7-18`

而 `src/bootstrap-compiler/sample-generator.js` 里仍硬编码：

- `node_count: 528`
- `edge_count: 1307`

与此同时，当前仓库 live `crg stats` 实测是：

- `node_count: 779`
- `edge_count: 1977`

这说明 bootstrap compiler 相关代码仍未摆脱 sample 值。

### 事实 3：mainline E2E 只校验存在性，不校验语义

`tests/e2e/spec-graph-bootstrap-mainline.sh` 只断言：

- `runBootstrap()` 返回 complete
- evaluator 能选中 `minimal-context/review.json`
- 若干 artifact 文件存在

见：

- `tests/e2e/spec-graph-bootstrap-mainline.sh:28-78`

它**没有检查**：

- `00-summary.md` 是否包含真实项目事实
- `artifact-manifest.json` 是否反映真实图谱数据
- `context-routing.json` 是否来自真实编译而非 sample

### 影响

- 当前 `bootstrap-compiler` 相关测试可以全绿，但并不代表 Stage-0 真实编译链已经可信。
- 容易形成“mainline 已通过”的假信心，掩盖 sample/skeleton 尚未退出生产链这一事实。
- 如果后续有人基于这些模块继续叠加逻辑，会把不真实的基础继续平台化。

### 最佳修复方向

1. 明确分离 **production compiler** 与 **sample fixture generator**
   - `sample-generator.js` 只供 tests/fixtures 使用
   - 生产路径不得直接依赖 sample 值

2. 提升 mainline E2E 的断言强度
   - 不只看文件存在
   - 至少断言 `00-summary.md` / `artifact-manifest.json` / `context-routing.json` 中有真实 repo-derived 字段

3. 为 `docs/contexts/spec-first/` checked-in sample 增加 freshness / drift 保护
   - 当前 checked-in `00-summary.md` 写的是 `528 nodes / 1307 edges`、`2055 unresolved`
   - 当前 live `crg stats` 已经是 `779 / 1977 / 2809`
   - 如果它继续被当作受控样本与测试基线，就必须有自动刷新或 drift failure

### 说明

这条问题的定性是“当前代码库中的 bootstrap-compiler 子系统仍未产品化收口”，不是在说整个 `spec-graph-bootstrap` 用户面已经完全失效。当前用户面大量逻辑仍在 `skills/spec-graph-bootstrap/SKILL.md` 等 workflow 资产中，而不是这套 JS compiler 内核里。

---

## F4. `CHANGELOG` 的格式治理规则没有真正校验到实际条目

**级别：中**

### 事实

`CHANGELOG.md` 顶部明确要求：

- 记录格式：`- v版本号 YYYY-MM-DD HH:MM:SS 作者: 变更摘要`
- 日期时间必须使用 `YYYY-MM-DD HH:MM:SS`

见：

- `CHANGELOG.md:3-9`

但当前顶部条目中，至少以下两条没有时间部分：

- `CHANGELOG.md:12`
- `CHANGELOG.md:13`

### 同时，现有测试只检查说明文字

`tests/unit/changelog-format.test.js` 当前只断言文件包含“说明”那一段静态文本：

- `tests/unit/changelog-format.test.js:8-13`

它没有：

- 校验实际 entry 的 regex
- 校验最新若干条是否都带时间
- 校验 `(user-visible)` 的位置或格式

### 影响

- 当前仓库已经发生了“规则写在文档里，但真实内容不符合，测试也不报警”的情况。
- 这会削弱 CHANGELOG 作为项目治理入口的严肃性。

### 最佳修复方向

新增真正基于条目的格式测试，例如：

1. 读取 `CHANGELOG.md`
2. 过滤掉说明段后的每一条 `- v...`
3. 对每条应用统一 regex
4. 至少保护最近 N 条必须符合完整时间格式

如果项目希望允许历史兼容条目，则应在规则文字中写清楚，而不是让规则与现实长期分裂。

---

## 5. 其他重要观察

### 5.1 当前门禁强，但并不覆盖所有“语义一致性”问题

本次四条 finding 都发生在“测试全绿”的前提下。这说明项目当前已经从“缺测试”进化到“需要更高质量的测试语义”阶段。

### 5.2 `docs/contexts/spec-first/` 已被视为受控样本，但 freshness 治理仍不充分

仓库内多处文档和历史审查记录都把 `docs/contexts/spec-first/` 视为“受控样本与测试基线”。但当前 live `crg stats` 与 checked-in `00-summary.md` 已明显不一致。

这不是说 checked-in sample 不该存在，而是说：

- 如果它是 baseline，就必须受 drift 保护
- 如果它只是示意样本，就不应被描述为当前基线真相

### 5.3 CRG 本体的完整性验证值得保留并继续扩展

`tests/e2e/crg-sqlite-audit.sh` 是本仓库质量体系里非常有价值的一部分。它至少已经证明：

- SQLite 物理健康
- 关系不变量
- CLI 与数据库核心计数对账
- runtime 副本未混入图谱

这一层不应被弱化，反而应该把 F1 那类“跨命令语义一致性”继续补进去。

---

## 6. 建议动作顺序

### P1：先修会误导判断的事实口径问题

1. 修复 `crg build` 在 0 变更增量构建时的 unresolved 返回口径
2. 补对应 unit/e2e regression

### P2：再收紧 release gate 与治理 gate

1. 收紧 `install-tarball.sh` 对 tree-sitter 冲突包的 allowlist
2. 补 `CHANGELOG` 实际条目格式测试

### P3：最后处理 bootstrap-compiler 的结构性去 sample 化

1. 把 sample generator 退回 fixture 角色
2. 让 routing / manifest / context docs 基于真实输入编译
3. 强化 `spec-graph-bootstrap-mainline` E2E 的语义断言
4. 为 checked-in sample 建 drift/freshness 机制

---

## 7. 最终结论

`spec-first` 当前不是“质量失控”的仓库；相反，它已经有明显高于平均项目的治理意识、安装态验证和 CRG 数据完整性校验。但它也进入了一个更难的阶段：

- 不是“有没有测试”的问题
- 而是“测试是否真的守住了项目最重要的语义边界”

本次审查确认：

1. 双宿主治理、CLI 资产管理、CRG 完整性验证是当前最成熟的三条线。
2. `crg build` unresolved 口径分裂是当前最优先应修的代码事实问题。
3. release gate 与 changelog gate 还存在“规则写得比实际严格”的治理盲区。
4. `bootstrap-compiler` 子系统当前仍处于 sample/skeleton 过渡态，不能把现有全绿测试误读为“已经收口为真实编译链”。

如果按影响排序，本仓库接下来最值得投入的，不是继续铺新功能，而是把这几条“绿灯下的假安全感”消掉。
