# spec-graph-bootstrap 阶段 0/1/2/3 正式审查报告

## 1. 审查范围与基线

本次审查对象为 `docs/01-需求分析/spec-graph-bootstrap需求` 所覆盖的阶段 0/1/2/3 当前仓库落地状态，检查范围包括：

- 源 skill / command / plugin 接线
- 控制面产物与目录契约
- `docs/contexts/spec-first/` 样本目录
- Stage-0 消费接入（`spec-plan` / `spec-work` / `spec-review`）
- 单元测试与验证记录闭环

本次审查**以当前仓库已收敛的实现契约为准**，不以历史需求草案中的旧路径作为验收标准。当前有效基线为：

- 控制面路径：`.spec-first/workflows/bootstrap/<slug>/`
- 文档路径：`docs/contexts/<slug>/`
- manifest：`artifact-manifest.json`
- Stage-0 样本与测试基线：`docs/contexts/spec-first/`

关键依据：

- `skills/spec-graph-bootstrap/SKILL.md:127-155`
- `skills/spec-graph-bootstrap/SKILL.md:332-416`
- `skills/spec-graph-bootstrap/SKILL.md:453-461`
- `skills/spec-graph-bootstrap/SKILL.md:567-583`
- `templates/claude/commands/spec/graph-bootstrap.md`
- `package.json:10-17`
- `tests/unit/spec-graph-bootstrap-contracts.test.js:18-47`
- `docs/contexts/spec-first/injection-index.yaml:1-30`
- `.gitignore:41-44`

---

## 2. 总体结论

**结论：阶段 0/1/2/3 主体已符合当前仓库预期，可放行。**

当前实现已经形成如下闭环：

1. `graph-bootstrap` 命令入口已注册，并绑定 `spec-graph-bootstrap`。
2. `spec-graph-bootstrap` 源 skill 已统一收敛到 `.spec-first/workflows/bootstrap/<slug>/` 与 `artifact-manifest.json`。
3. `docs/contexts/spec-first/` 已作为受控样本与测试基线纳入仓库。
4. `spec-plan`、`spec-work`、`spec-review` 已接入 Stage-0 上下文预载规则。
5. 单测已覆盖 `.gitignore`、schema `updated_at` 契约、`public-entrypoints.md` 去重注入三项关键收敛点。

当前残留问题主要是：

- 历史需求文档仍保留旧 `.context/...` / `fingerprints.json` 口径；
- 部分 3A/3B 验证记录保留了“重复注入”旧结论，与当前样本和单测存在时间差漂移。

这两项问题均属于**文档/记录时效性问题**，不是当前实现阻断项。

---

## 3. 分阶段审查结果

## 3.1 Phase 0：就绪探测、路径收敛、样本基线

### 符合预期项

#### A. 控制面路径已切换到新契约
源 skill 已明确要求：

- 第一次写入 `.spec-first/workflows/bootstrap/<slug>/artifact-manifest.json`
- Phase 1.6 将控制面主文件写入 `.spec-first/workflows/bootstrap/<slug>/`
- Phase 3/4 产物输出至 `docs/contexts/<slug>/`
- 最终产物树中使用 `artifact-manifest.json`，不再使用 `fingerprints.json`

证据：

- `skills/spec-graph-bootstrap/SKILL.md:127-155`
- `skills/spec-graph-bootstrap/SKILL.md:332-416`
- `skills/spec-graph-bootstrap/SKILL.md:453-461`
- `skills/spec-graph-bootstrap/SKILL.md:567-583`

#### B. 命令入口已接线
`graph-bootstrap` 已在插件 manifest 中注册，并绑定到 `spec-graph-bootstrap` skill；命令模板也要求运行时读取 `.claude/spec-first/workflows/spec-graph-bootstrap/SKILL.md` 作为主契约。

证据：

- `.claude-plugin/plugin.json`
- `templates/claude/commands/spec/graph-bootstrap.md`

#### C. 样本目录已纳入版本控制基线
`docs/contexts/spec-first/injection-index.yaml` 已存在，且被单测直接作为样本读取。这说明 `docs/contexts/spec-first/` 不是运行时垃圾目录，而是当前仓库的受控样本与验证基线。

证据：

- `docs/contexts/spec-first/injection-index.yaml:1-30`
- `tests/unit/spec-graph-bootstrap-contracts.test.js:12-16`
- `tests/unit/spec-graph-bootstrap-contracts.test.js:39-47`

#### D. `.gitignore` 策略与样本入库策略一致
`.gitignore` 继续忽略 `.spec-first/` 等运行时目录，但没有忽略 `docs/contexts/`。这与单测要求一致。

证据：

- `.gitignore:41-44`
- `tests/unit/spec-graph-bootstrap-contracts.test.js:18-23`

### 结论
Phase 0 当前实现已与仓库现行契约一致，**符合预期**。

---

## 3.2 Phase 1：事实抽取契约与 schema 收敛

### 符合预期项

#### A. 三个控制面主文件契约已明确
Phase 1.6 已定义三类主文件：

- `fact-inventory.json`
- `risk-signals.json`
- `test-surface.json`

并要求写入后进行结构校验。

证据：

- `skills/spec-graph-bootstrap/SKILL.md:332-416`

#### B. `updated_at` 契约已落实到关键字段
单测要求以下字段必须带 `updated_at`：

- `layers`
- `signals`
- `top_hubs`

源 skill 中对应 schema 文本也已包含这些字段，说明该收敛点已进入正式合同。

证据：

- `tests/unit/spec-graph-bootstrap-contracts.test.js:25-37`
- `skills/spec-graph-bootstrap/SKILL.md:346-353`
- `skills/spec-graph-bootstrap/SKILL.md:356-369`

#### C. Full / Enhanced / Basic 降级语义已固定
Skill 对模式判定、`graph_support_state`、`code_facts_confidence`、severity 上限等已给出明确规则，说明阶段 1 的降级链路不再是口头约定，而是源合同的一部分。

证据：

- `skills/spec-graph-bootstrap/SKILL.md:106-125`
- `skills/spec-graph-bootstrap/SKILL.md:508-560`

### 结论
Phase 1 的事实抽取 schema、字段要求、降级契约已成型，**符合预期**。

---

## 3.3 Phase 2：任务规划契约

### 符合预期项

#### A. 固定产物与事实来源映射已明确
Phase 2 已为固定产物定义来源：

- `00-summary.md` ← `project_identity`
- `architecture/module-map.md` ← `modules + data_shapes`
- `pitfalls/index.md` ← `risk_signals + integrations`
- `code-facts/public-entrypoints.md` ← `entrypoints`
- `code-facts/test-map.md` ← `testing_surface + test-surface.json`
- `code-facts/high-risk-modules.md` ← `risk_signals`
- `context-packs/review-change.md` ← 静态组装

证据：

- `skills/spec-graph-bootstrap/SKILL.md:419-431`

### 结论
Phase 2 已具备稳定 task contract，不是临时拼接，**符合预期**。

---

## 3.4 Phase 3：文档生成与 Stage-0 消费接入

### 符合预期项

#### A. `injection-index.yaml` 已收敛为 v1 新结构
当前样本 `docs/contexts/spec-first/injection-index.yaml` 使用如下结构：

- `always`
- `stages`
- `selection_rules`
- `advice`

未再出现旧 `task_types` 字段。

证据：

- `docs/contexts/spec-first/injection-index.yaml:1-30`

#### B. `spec-plan` / `spec-work` / `spec-review` 已完成 Stage-0 消费接入
三份源 skill 已接入统一的 Stage-0 预载语义：

- 先加载 `always[]`
- 再加载 `stages.<stage>[]`
- 执行 `selection_rules[]` 中 `output_exists.*`
- v1 显式跳过 `fact.*`
- 缺失时回退到固定 L2 集合

证据：

- `skills/spec-plan/SKILL.md`
- `skills/spec-work/SKILL.md`
- `skills/spec-review/SKILL.md`

#### C. 当前样本已避免 `public-entrypoints.md` 在 plan/work 重复注入
单测要求 `plan` / `work` block 内不得直接包含 `code-facts/public-entrypoints.md`，只允许通过 `selection_rules` 的 `output_exists.code_facts_public_entrypoints` 条件注入。当前样本 YAML 满足此约束。

证据：

- `tests/unit/spec-graph-bootstrap-contracts.test.js:39-47`
- `docs/contexts/spec-first/injection-index.yaml:5-25`

### 结论
Phase 3 当前已形成“生成 + 消费 + 单测”的闭环，**符合预期**。

---

## 4. 偏差与风险

## 4.1 非阻断偏差：历史需求文档仍保留旧口径
在需求目录中，仍能看到旧路径与旧文件名口径，例如：

- `.context/spec-first/bootstrap/<slug>/`
- `fingerprints.json`

而当前实现已收敛到：

- `.spec-first/workflows/bootstrap/<slug>/`
- `artifact-manifest.json`

### 判断
这是**历史文档遗留**，不是当前代码实现缺陷。

### 风险级别
中。

### 建议
后续对需求文档做一次 source-of-truth 清理，显式标注旧口径为历史阶段，避免未来审查误判。

---

## 4.2 非阻断偏差：验证记录与当前样本/单测存在时间差漂移
阶段 3A / 3B 的部分验证记录曾记录 `public-entrypoints.md` 在 `plan/work` 中重复注入的问题；但当前仓库中的样本 YAML 与单测合同已经明确要求避免该重复注入。

### 判断
这是**验证记录时点早于当前修复**导致的漂移，更像“历史通过记录尚未回填更新”，而不是当前缺陷。

### 风险级别
中。

### 建议
补一条新的验证记录，或在现有 3B 报告中追加说明：

- 旧报告反映的是当时状态；
- 当前仓库头状态下，该问题已由样本与单测共同约束修复。

---

## 5. 关键证据索引

- `package.json:10-17`  
  `test:unit` 已接入 `tests/unit/spec-graph-bootstrap-contracts.test.js`

- `tests/unit/spec-graph-bootstrap-contracts.test.js:18-23`  
  `.gitignore` 必须忽略 `.spec-first/`，且不得忽略 `docs/contexts/`

- `tests/unit/spec-graph-bootstrap-contracts.test.js:25-37`  
  `layers` / `signals` / `top_hubs` 的 `updated_at` 契约

- `tests/unit/spec-graph-bootstrap-contracts.test.js:39-47`  
  `plan/work` 不得重复注入 `public-entrypoints.md`

- `skills/spec-graph-bootstrap/SKILL.md:127-155`  
  `artifact-manifest.json` 第一次写入

- `skills/spec-graph-bootstrap/SKILL.md:332-416`  
  Phase 1.6 控制面 schema 与写入后校验

- `skills/spec-graph-bootstrap/SKILL.md:419-431`  
  Phase 2 固定产物映射

- `skills/spec-graph-bootstrap/SKILL.md:453-461`  
  `artifact-manifest.json` 第二次写入

- `skills/spec-graph-bootstrap/SKILL.md:467-504`  
  `injection-index.yaml` 的 v1 结构定义

- `skills/spec-graph-bootstrap/SKILL.md:567-583`  
  最终产物树

- `docs/contexts/spec-first/injection-index.yaml:1-30`  
  当前样本结构

- `.gitignore:41-44`  
  忽略运行时目录但不忽略样本目录

---

## 6. 放行建议

### 结论
**建议放行。**

### 放行理由
当前仓库中，阶段 0/1/2/3 已建立以下最低可依赖闭环：

- command 已注册
- skill 契约已收敛
- 样本目录已入库
- 消费接入已打通
- 单测已覆盖关键收敛点

### 放行前建议补齐但非阻断的项

1. 清理需求文档中的旧 `.context/...` / `fingerprints.json` 口径。
2. 新增或补写一条验证记录，确认当前头状态下 `public-entrypoints.md` 重复注入问题已修复。
3. 作为最终收口，再执行一次 `npm run test:unit` 保留实测证据。

---

## 7. 最终判定

**最终判定：spec-graph-bootstrap 阶段 0/1/2/3 已基本完成并符合当前仓库预期；现存问题以历史文档漂移与验证记录时效性为主，不构成阻断。**
