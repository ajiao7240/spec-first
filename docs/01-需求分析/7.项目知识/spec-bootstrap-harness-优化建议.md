# spec-bootstrap × Harness Engineering 优化建议

> 参考来源：`docs/09-业界借鉴/2026-04-03-Qoder-工程实践：Harness-Engineering-指南.md`
> 分析基准：`skills/spec-bootstrap/SKILL.md`（spec-first v1.5.x，截至 2026-04-03）

---

## 一句话结论

Harness 的核心是**与其教 Agent 怎么做，不如让它自己验证做得对不对**。对照当前 spec-bootstrap，主要缺口在三处：产物对 Agent 不可达、约束停留在软知识、失败经验没有沉淀。

---

## Harness 三支柱 × spec-bootstrap 节点映射

### 支柱一：知识可达性

**核心问题：** 当前产物全在 `docs/contexts/<slug>/`，Agent 需要被明确引导才能读到，是"被动资源"。Harness 最基础的单元是项目根目录的 `AGENTS.md`（~100 行），Agent 打开项目自动读取。

#### 优化点 A：Phase 2.1 新增 `agents-md-context` 固定任务

**现状：** 固定任务只有 `summary-context / architecture-context / pitfalls-context` 三个，没有为目标项目生成 Agent 导航入口。

**建议：** 新增第四个固定任务 `agents-md-context`，产物为目标项目根目录的 `AGENTS.md`。

产物内容规范（遵循 Harness 标准）：
- 控制在 ~100 行，只做索引和指路，不堆内容
- 内容来自 Phase 1 分析结论，不编造

```markdown
# [Project] Agent Guide

## 快速链接
- [架构总览](docs/contexts/<slug>/architecture/system-overview.md)
- [模块地图](docs/contexts/<slug>/architecture/module-map.md)
- [已知风险](docs/contexts/<slug>/pitfalls/index.md)

## 构建命令
<从 Phase 1 检测到的 package.json / Makefile / go.mod 中提取>

## 分层规则
<从 Phase 1.4 layer detection 结论中生成，每层一行>

## 质量标准
<从 pitfalls 分析中提炼最关键的 3-5 条可执行规则>
```

**Worker 边界规则：**
- 目标项目已有 `AGENTS.md` → 只追加 `## spec-first Context` section，不覆盖现有内容
- 目标项目无 `AGENTS.md` → 全量创建
- 内容必须项目特定，禁止模板占位符

**PRD Technical Notes 约束：**
- 简短原则：每个 section 不超过 10 行
- 地图原则：只写路径和规则，不写解释性散文
- 证据原则：分层规则必须来自 Phase 1.4 的实际检测结果，不能推断

---

### 支柱二：机械执法

**核心问题：** 当前生成的层级约束和 pitfall 知识是"希望被遵守"的软知识，没有机械验证兜底。Harness 的层级 lint 脚本让违反"直接报错"。

#### 优化点 B：Phase 1.4 Layer Detection → 输出 lint hint 骨架

**现状：** Layer detection 结论仅用于"决定创建哪些条件任务"，检测到的依赖方向没有后续利用。

**建议：** 在 Phase 1.4 完成后，编排器额外输出一份 `layer_lint_hints`，作为 `agents-md-context` 和 `pitfalls-context` PRD 的输入。

`layer_lint_hints` 内容示例：

```text
# 基于 layer detection 推断的依赖方向约束
Layer 0: types/, shared/types/  → 无内部依赖
Layer 1: utils/, lib/           → 仅依赖 Layer 0
Layer 2: config/, settings/     → 仅依赖 Layer 0-1
Layer 3: services/, core/       → 仅依赖 Layer 0-2
Layer 4: api/, cli/, ui/        → 仅依赖 Layer 0-3，彼此不互相引用

# 推荐 lint hint（bash/grep 骨架，供用户演化为真实脚本）
grep -r "from.*api.*import" services/ && echo "VIOLATION: services/ imports api/"
```

这份 hint 写入 `AGENTS.md` 的"分层规则"节，同时作为 `pitfalls-context` 的补充材料。

#### 优化点 C：Phase 2.4.2 pitfalls AC 追加 lint hint 要求

**现状：** `pitfalls-context` AC 要求每个 pitfall 含 `file + line range + risk type + why risky + mitigation`，已经很具体。

**建议：** 在现有 AC 末尾追加一条：

```
- [ ] 对于可机械化检测的 pitfall（循环依赖、函数体 > 100 行、God class > 500 行、
      裸 try-catch），在文档末尾附 `## Lint Hints` section，
      包含可复用的 bash/grep 检测骨架（不要求可直接运行，方向正确即可）
```

**目标：** 把"软知识"向"硬规则"推进一步，让 pitfalls 文档兼具知识库和工具库的价值。

#### 优化点 D：Phase 3.4 Assembly 后加入 verify step

**现状：** 完成标准是"契约一致性"——PRD 列出的文件已生成且非空、无模板占位符。这是"文档生成了"，不是"文档内容真实"。

**建议：** Assembly 完成后、输出执行摘要前，orchestrator 执行一次轻量**产物功能性核验**：

| 验证项 | 验证方式 |
|--------|----------|
| `module-map.md` 中列出的顶层目录是否实际存在于项目中 | Glob 核验 |
| `pitfalls/index.md` 中引用的文件路径是否真实存在 | Glob 核验 |
| `00-summary.md` 识别的主框架是否能在 `package.json`/`go.mod`/`requirements.txt` 中找到对应证据 | Grep 核验 |
| `AGENTS.md` 中的构建命令是否能在项目中找到对应脚本/配置 | Glob 核验 |

核验失败时：
- 非阻断：记录到执行摘要的 `⚠️ Verify Warnings` section
- 不触发 full restore（verify 失败 ≠ worker 失败）
- 提示用户人工检查具体条目

---

### 支柱三：协调者保护

**核心问题：** Harness 铁律是"协调者绝不写代码"——上下文窗口是最贵的资源。当前 orchestrator 自己完成了 Phase 1 完整分析，上下文窗口在进入 Phase 2 时已经很重，且失败经验没有沉淀供重跑参考。

#### 优化点 E：Phase 3.4 partial failure → 写入失败记忆

**现状：** Worker 失败只有 full restore / partial preserve 两种处理，失败原因仅出现在执行摘要文本中，下次重跑无法参考。

**建议：** 在 partial failure 时，额外写入：

```
.context/spec-first/bootstrap/<slug>/trace/failures/<ISO-timestamp>.json
```

结构：
```json
{
  "timestamp": "2026-04-03T10:30:00Z",
  "slug": "my-project",
  "failed_tasks": [
    {
      "task_id": "pitfalls-context",
      "reason": "abcoder-parse-timeout",
      "analysis_mode": "Enhanced",
      "prd_path": ".context/spec-first/bootstrap/my-project/tasks/pitfalls-context/prd.md",
      "recommended_retry": "retry with Basic mode; increase context evidence in PRD"
    }
  ],
  "analysis_mode": "Enhanced",
  "db_access_mode": "not detected"
}
```

**重跑时的参考逻辑：**
- orchestrator 在 Phase 1 结束后，检查是否存在 `trace/failures/` 记录
- 存在时，在对应 task 的 PRD 中注入 `Previous Failure Notes` section
- 例：上次因 `abcoder-parse-timeout` 失败 → 本次 PRD 注入"上次 ABCoder 超时，本次降级 Basic mode 补充手动分析证据"

#### 优化点 F：Phase 3.2 Worker Dispatch Contract 加模型建议

**现状：** dispatch contract 没有模型建议，所有 worker 隐式使用同一模型。

**建议：** contract 新增 `recommended_model` 字段：

| Task | 类型 | 推荐模型 |
|------|------|----------|
| `summary-context` | 综合推理 | sonnet/opus |
| `architecture-context` | 综合推理 | sonnet/opus |
| `pitfalls-context` | 代码检索 + 推理 | sonnet |
| `agents-md-context` | 内容整合 | haiku/sonnet |
| `<layer>-context` | 代码检索 | haiku/sonnet |
| `database-context` | 工具调用 | haiku/sonnet |

**说明：** 这是建议而非强制，实际模型选择取决于宿主平台支持。在 dispatch contract 中提供建议的意义是：让用户或平台层有明确的分级依据，避免所有 worker 无差别使用最重量级模型。

---

#### 优化点 G：Phase 1 委派 analysis-worker（架构级，下一版规划）

**现状：** orchestrator 自己完成了 Phase 1 完整分析（三工具探针 + layer detection + DB detection），导致 orchestrator 上下文窗口在进入 Phase 2 时过重，违背"协调者只规划/委派/汇总"的原则。

**建议（下一版）：** 将 Phase 1 分析抽成独立的 `analysis-worker`：
- orchestrator 只发出"分析目标项目"的 dispatch contract
- `analysis-worker` 完成所有探针 + 检测，输出结构化结论文件到控制面
- orchestrator 消费结论文件，进入 Phase 2 决策

**改动代价大，当前版本不建议立即实施。** 作为下一版架构优化方向。

---

## 优先级与实施路径

| 优化点 | 改动范围 | 改动大小 | ROI |
|--------|----------|----------|-----|
| A: 新增 `agents-md-context` 固定任务 | Phase 2.1 + 新 worker 规范 | 小 | 最高 |
| B: Layer detection → lint hint 骨架 | Phase 1.4 输出 + PRD 输入 | 小 | 高 |
| C: pitfalls AC 追加 lint hint | Phase 2.4.2 一行 AC | 极小 | 高 |
| D: Assembly 后加 verify step | Phase 3.4 新增环节 | 中 | 中 |
| E: 失败记忆写入 trace | Phase 3.4 partial failure | 小 | 中 |
| F: dispatch 加 model 建议 | Phase 3.2 contract 字段 | 极小 | 中 |
| G: Phase 1 委派 analysis-worker | 架构重构 | 大 | 低（当前阶段） |

**推荐实施顺序：**

```
第一轮（改动小、收益高）：C → F → A → B
第二轮（涉及新流程节点）：E → D
第三轮（架构级）：G
```

---

## 与 Harness 的本质差异（不建议照搬的部分）

Harness 的 `scripts/lint-deps.*` 是真实可运行脚本，由 creator 自动生成并注入 CI。spec-bootstrap 的定位是"上下文 Bootstrap 编排器"，不是"CI 基础设施生成器"。

因此，本文的建议是**生成 lint hint 骨架**（方向正确的伪代码），而不是生成真实 lint 脚本。真实脚本的生成逻辑因项目语言/框架差异极大，强行生成会产生大量错误脚本，得不偿失。

用户可以把 lint hint 骨架作为起点，自行演化为项目专用的验证脚本。这是在 spec-bootstrap 定位范围内，最接近 Harness 机械执法精神的实践方式。
