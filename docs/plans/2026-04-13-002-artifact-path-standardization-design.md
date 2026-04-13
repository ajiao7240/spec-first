# Spec-First 产物目录标准化技术方案

> 日期：2026-04-13
> 状态：Draft
> 范围：`.context/`、`.spec-first-graph/`、`docs/contexts/`
> 目标：统一 machine artifact、workflow control-plane 和 human-readable docs 的目录模型

> 决策更新：仅保留方案 C。当前仍处于开发阶段，采用一次性硬切换重构，不做向下兼容，不保留过渡路径。

## 1. 背景

当前 `spec-graph-bootstrap` 已经形成三类产物：

1. 机器运行态图谱产物：`.spec-first-graph/`
2. 工作流控制面产物：`.context/spec-first/bootstrap/<slug>/`
3. 长期可读文档产物：`docs/contexts/<slug>/`

当前实际样例：

```text
.spec-first-graph/
  graph.db
  fingerprints.json

.context/spec-first/bootstrap/spec-first/
  fact-inventory.json
  fingerprints.json
  risk-signals.json
  test-surface.json

docs/contexts/spec-first/
  README.md
  00-summary.md
  architecture/module-map.md
  pitfalls/index.md
  code-facts/public-entrypoints.md
  code-facts/test-map.md
  code-facts/high-risk-modules.md
  context-packs/review-change.md
  injection-index.yaml
```

这三层产物语义上是成立的，但当前命名和布局仍然不够标准，主要问题有四类：

- `.context/` 与 `docs/contexts/` 名称过于接近，容易误解为同层目录
- `.spec-first-graph/` 独立在根目录，未纳入统一 `spec-first` 命名空间
- `fingerprints.json` 在图谱层和 bootstrap 控制面同时存在，但语义不同
- 目录职责没有被清晰定义为“运行态 / 控制面 / 长期文档”三层，后续扩展容易继续漂移

本方案的目标不是调整 bootstrap 内容本身，而是收敛路径规范、命名规范和生命周期规范。

## 2. 设计目标

### 2.1 必须达成

- 单一 machine namespace：所有隐藏运行态产物统一收敛到 `.spec-first/`
- 清晰分层：图区、工作流控制区、长期文档区职责分离
- 路径可推导：看到目录即可知道归属 workflow、slug、生命周期
- 命名去歧义：避免同名文件在不同层承担不同含义
- 一次性收敛：目录与逻辑同步切换到新模型，不保留旧路径兼容分支

### 2.2 约束

- `docs/contexts/<slug>/` 已经是面向用户的长期文档入口，应尽量保持稳定
- 已有 `spec-graph-bootstrap`、CRG CLI、阶段验收文档都引用了旧路径，需要在本次重构中同步改完
- 控制面数据可能不提交 Git，但长期文档通常需要进入版本库
- 方案需要支持未来除 `bootstrap` 外的其他 supporting workflow
- 当前处于开发阶段，可以接受 breaking change，但不接受双轨逻辑

## 3. 非目标

本方案不处理以下事项：

- 不重设计 `fact-inventory.json`、`risk-signals.json` 的字段结构
- 不重做 `docs/contexts/<slug>/` 的 9 份文档内容模板
- 不在本阶段引入中心化 artifact registry 服务
- 不把长期文档也迁入隐藏目录

## 4. 当前三类目录的职责定义

### 4.1 `.spec-first-graph/`

定位：CRG engine 的底层运行态存储。

特征：

- 以数据库、指纹、索引元数据为主
- 面向 CLI 和分析引擎，不面向人读
- 可以重建
- 生命周期与 `crg build`、`crg postprocess`、`crg stats` 绑定

### 4.2 `.context/spec-first/bootstrap/<slug>/`

定位：workflow 级控制面产物。

特征：

- 面向 `spec-graph-bootstrap` 各 Phase 的中间聚合结果
- 是“文档生成前的事实层”和“运行决策所需索引层”
- 可重跑生成，但不等同于临时垃圾数据
- 与 workflow、target slug 强绑定

### 4.3 `docs/contexts/<slug>/`

定位：长期稳定、可提交、可阅读、可注入的上下文文档层。

特征：

- 面向人和后续 workflow 消费
- 应保持路径稳定和可引用
- 是 bootstrap 的正式输出，不应与中间控制面混放

## 5. 最终方案

采用方案 C，并且按开发期标准执行一次性硬切换。

做法：

- `.spec-first-graph/` 直接重构为 `.spec-first/graph/`
- `.context/spec-first/bootstrap/<slug>/` 直接重构为 `.spec-first/workflows/bootstrap/<slug>/`
- `docs/contexts/<slug>/` 保持不变
- 所有代码、文档、测试、脚本、验收清单同步改到新路径
- 删除旧路径读写逻辑，不保留 fallback，不输出 deprecation warning

采用该方案的原因：

- 当前还在开发阶段，双轨兼容只会增加实现复杂度和维护噪音
- 目录模型本身已经足够明确，没有必要为短期旧路径保留长期技术债
- 一次性切换更有利于把路径解析、命名、清理、测试和文档一起收口

## 6. 推荐目录模型

推荐目标结构如下：

```text
.spec-first/
  graph/
    graph.db
    graph-meta.json
    input-fingerprints.json

  workflows/
    bootstrap/
      <slug>/
        fact-inventory.json
        risk-signals.json
        test-surface.json
        artifact-manifest.json
        run-meta.json
        backups/
          <timestamp>/

docs/
  contexts/
    <slug>/
      README.md
      00-summary.md
      architecture/
      pitfalls/
      code-facts/
      context-packs/
      injection-index.yaml
```

### 6.1 分层原则

- `.spec-first/graph/`：引擎底层状态，只服务 CRG
- `.spec-first/workflows/<workflow>/<slug>/`：工作流级控制面和中间事实
- `docs/contexts/<slug>/`：稳定的人类可读上下文资产

### 6.2 路径推导规则

- graph 运行态永远不带 slug，因为它面向 repo 全局
- workflow 控制面永远带 `<workflow>/<slug>` 两级
- 文档产物永远只暴露 `docs/contexts/<slug>/`

## 7. 命名规范

### 7.1 顶层目录命名

- 统一使用 `.spec-first/` 作为所有隐藏运行态产物的根目录
- 禁止新增新的平级隐藏目录，如 `.spec-first-graph/`、`.context/`、`.sf-cache/`

### 7.2 文件命名去歧义

当前两个 `fingerprints.json` 语义不同，必须拆开：

- `.spec-first/graph/fingerprints.json` -> `.spec-first/graph/input-fingerprints.json`
- `.spec-first/workflows/bootstrap/<slug>/fingerprints.json` -> `.spec-first/workflows/bootstrap/<slug>/artifact-manifest.json`

建议新增：

- `graph-meta.json`：图谱构建时间、节点数、边数、degraded 状态等摘要
- `run-meta.json`：某次 bootstrap 执行模式、时间、版本、错误、回退信息

### 7.3 slug 和 workflow 命名

- workflow 目录统一使用 kebab-case，如 `bootstrap`、`audit`
- slug 统一复用已有规则：用户传入优先，否则从目标仓库根目录名推导为 kebab-case

## 8. 生命周期与提交策略

### 8.1 `.spec-first/graph/`

- 生命周期：可重建
- 默认提交策略：不提交
- 清理方式：允许 `spec-first crg clean` 或未来统一清理命令删除

### 8.2 `.spec-first/workflows/<workflow>/<slug>/`

- 生命周期：可重跑生成，可覆盖，可备份
- 默认提交策略：不要求提交
- 价值：用于 rerun、诊断、质量校验、文档再生成

### 8.3 `docs/contexts/<slug>/`

- 生命周期：长期保留
- 默认提交策略：建议提交
- 价值：供人阅读、供 review/plan/work 注入、供后续复用

## 9. 重构映射

旧路径到新路径映射如下：

| 旧路径 | 新路径 | 说明 |
|---|---|---|
| `.spec-first-graph/graph.db` | `.spec-first/graph/graph.db` | CRG 主数据库 |
| `.spec-first-graph/fingerprints.json` | `.spec-first/graph/input-fingerprints.json` | 图谱输入指纹 |
| `.context/spec-first/bootstrap/<slug>/fact-inventory.json` | `.spec-first/workflows/bootstrap/<slug>/fact-inventory.json` | 保持文件名 |
| `.context/spec-first/bootstrap/<slug>/risk-signals.json` | `.spec-first/workflows/bootstrap/<slug>/risk-signals.json` | 保持文件名 |
| `.context/spec-first/bootstrap/<slug>/test-surface.json` | `.spec-first/workflows/bootstrap/<slug>/test-surface.json` | 保持文件名 |
| `.context/spec-first/bootstrap/<slug>/fingerprints.json` | `.spec-first/workflows/bootstrap/<slug>/artifact-manifest.json` | 避免语义冲突 |
| `.context/spec-first/bootstrap/<slug>/tasks/<task-id>/prd.md` | `.spec-first/workflows/bootstrap/<slug>/tasks/<task-id>/prd.md` | worker PRD 路径 |
| `.context/spec-first/bootstrap/<slug>/backups/<timestamp>/` | `.spec-first/workflows/bootstrap/<slug>/backups/<timestamp>/` | 备份目录 |
| `docs/contexts/<slug>/...` | `docs/contexts/<slug>/...` | 保持稳定 |

## 10. 重构策略

采用“一次性硬切换”：

### 10.1 路径切换

- 所有运行时读写路径直接改为新路径
- 旧路径视为无效实现，全部删除
- 不允许在代码中出现“新旧路径二选一”的兼容判断

### 10.2 资产处理

- 仓库内已有示例产物如需保留，直接搬迁到新目录
- 无需自动迁移器
- 无需首运行迁移逻辑

### 10.3 文档与测试收口

- 所有文档中的旧路径引用必须同步改完
- 所有测试断言必须只验证新路径
- 若有 shell 脚本或 skill 文本直接写死旧路径，必须在本次重构中全部替换

## 11. 分阶段实施建议

### Phase A：路径常量与目录模型重构

目标：

- 在 CLI、skills、脚本中统一目录解析实现
- 彻底移除旧路径常量和字符串拼接

产出：

- graph 目录解析统一到 `.spec-first/graph/`
- workflow artifact 目录解析统一到 `.spec-first/workflows/<workflow>/<slug>/`
- context docs 目录解析统一到 `docs/contexts/<slug>/`

### Phase B：文件命名与产物语义收敛

目标：

- 统一文件名，消除语义冲突

建议新增能力：

- `resolveGraphDir(repoRoot)`
- `resolveWorkflowArtifactDir(repoRoot, workflow, slug)`
- `resolveContextDocsDir(repoRoot, slug)`

要求：

- 禁止在多个文件散落拼接路径字符串
- `fingerprints.json` 必须全部拆分为语义明确的新名字

### Phase C：文档、测试、样例一次性切换

目标：

- 让仓库内所有引用只剩新路径

要求：

- 更新架构文档、用户手册、workflow 文档、需求文档、checklist
- 更新 smoke、integration、unit 测试
- 更新仓库中的示例目录和样例产物

### Phase D：全量验证

目标：

- 证明仓库内已不存在旧路径依赖

要求：

- 全仓 `rg` 旧路径应只允许出现在历史说明或明确的“旧到新映射”文档中
- bootstrap、graph、doctor、相关脚本与测试全部通过

## 12. 验收标准

满足以下条件，视为目录标准化完成：

### 12.1 结构层

- 仓库根目录不再存在 `.context/` 和 `.spec-first-graph/` 作为运行时正式目录
- 所有隐藏运行态产物统一进入 `.spec-first/`
- `docs/contexts/<slug>/` 保持为唯一长期文档出口

### 12.2 语义层

- 不再存在两个不同语义的 `fingerprints.json`
- 任一 artifact 文件都能从文件名推断用途
- 任一路径都能从层级判断其是否应提交 Git

### 12.3 收口层

- 代码中不存在旧路径 fallback
- 测试中不存在旧路径断言
- 仓库正式文档不再把旧路径描述为当前有效路径

### 12.4 文档层

- 用户手册、架构文档、workflow 文档对目录说明一致
- bootstrap 和 graph 相关文档都使用同一套标准路径

## 13. 风险与未决项

### 13.1 风险

- 旧路径在多处文档、脚本、测试中被硬编码，重构时容易漏改
- 控制面目录更名后，阶段验收和数据质量检查文档需要同步更新
- 一次性切换后，任何遗漏都会直接表现为运行失败或测试失败

### 13.2 未决项

- 是否需要在 `.spec-first/` 下引入统一 `state/` 或 `manifests/` 子目录
- `docs/contexts/<slug>/injection-index.yaml` 是否保留在文档层，还是复制一份 machine-readable 索引到控制面
- 未来是否需要为 `bootstrap` 之外的 workflow 约定统一控制面文件集合

当前建议：

- 本阶段只处理路径收敛，不扩展新的 state 层
- `injection-index.yaml` 保留在 `docs/contexts/<slug>/`，因为它本身是文档注入入口的一部分
- 等 `audit`、`compound` 类 supporting workflow 落地后，再抽象通用 workflow manifest

## 14. 最终建议

建议正式采用“隐藏运行态统一到 `.spec-first/`，长期文档继续保留在 `docs/contexts/`”的双层外显模型，并在当前开发阶段一次性完成重构：

- 用户可见的长期知识资产只看 `docs/contexts/<slug>/`
- 引擎和工作流中间产物统一收敛到 `.spec-first/`
- graph 是 repo-global runtime
- workflow artifact 是 workflow-scoped control-plane
- 不保留旧路径兼容逻辑
- 不引入过渡期双轨模型

这是当前改动成本最低、语义最清楚、后续扩展性最好的标准化路径。
