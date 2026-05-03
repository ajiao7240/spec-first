# `/spec:standards` 最终版技术方案文档

## Graph-backed Project Standards & Glue Compiler

## 代码图谱支撑的项目规范与胶水能力编译器

> 建议落地文档路径：
> `docs/2026-05-04-spec-standards/README.md`

---

# 0. 结论先行

建议在 spec-first 中新增一个独立 skill：

```text
/spec:standards
```

它的完整定位是：

```text
Graph-backed Project Standards & Glue Compiler
代码图谱支撑的项目规范与胶水能力编译器
```

它不是普通“规范文档生成器”，也不是 `AGENTS.md / CLAUDE.md` 生成器，更不是规则引擎。

它负责：

```text
识别项目模式
  ↓
识别项目形态、模块、技术域、graph 能力
  ↓
从团队共享规范仓库导入适用规范
  ↓
读取 graph facts / semantic query / reuse candidates
  ↓
发现当前项目的 observed conventions
  ↓
生成 glue-map，识别已有能力和胶水边界
  ↓
生成 standards-candidates
  ↓
生成 standards-preview 给团队确认
  ↓
确认后写入 repo-profile
  ↓
供 brainstorm / doc-review / plan / write-tasks / work / code-review / compound 全链路复用
```

最终目标：

```text
把存量代码仓库从“隐性经验 + 零散代码 + 过期文档”
编译成“项目形态识别 + 团队规范导入 + 图谱证据索引 + 胶水能力地图 + 候选规范 + 已确认 repo-profile”。
```

---

# 1. 背景

存量项目接入 spec-first 时，通常缺少显性项目规范。

例如：

```text
前端组件规范
前端请求规范
后端分层规范
接口响应规范
数据库 migration 规范
命名规范
测试规范
日志规范
异常规范
权限规范
多端协作规范
胶水代码边界
已有能力复用地图
```

但这些规范并不是完全不存在，而是散落在：

```text
代码结构
历史实现
README / docs
团队规范文档
旧 PR
团队口头约定
lint / formatter
CI
Controller / Service / Repository 结构
组件目录
数据库 schema / migration
API client
测试目录
```

如果没有结构化沉淀，AI 在开发时会出现这些问题：

```text
不知道已有能力在哪里
不知道项目真实架构边界
重复造轮子
绕过现有封装
生成方案不贴合项目
review 只能泛泛而谈
团队规范无法被 AI 稳定消费
```

所以 spec-first 需要新增 `/spec:standards`，把“代码事实 + 团队规范 + 图谱证据 + 胶水能力”统一编译为项目级标准基线。

---

# 2. 核心设计目标

## 2.1 支持存量项目规范发现

`/spec:standards` 不直接制定规则，而是先发现：

```text
Code Facts
  ↓
Observed Conventions
  ↓
Standards Candidates
  ↓
Human Confirmed Standards
```

核心原则：

```text
事实不等于规范
观察到的约定不等于确认标准
AI 建议不等于团队共识
只有用户/团队确认后才进入 repo-profile
```

---

## 2.2 支持团队共享规范仓库

团队规范不应散落在每个业务仓库里。

建议设计一个独立 Git 仓库：

```text
spec-first-standards.git
```

它作为公司/部门/团队级规范源，业务项目通过 `/spec:standards --import-source` 按需导入。

完整链路：

```text
shared standards repo
  ↓
/spec:standards --import-source
  ↓
imported-standards.json
  ↓
graph/code alignment check
  ↓
standards-candidates.json
  ↓
standards-preview.md
  ↓
团队确认
  ↓
repo-profile.yaml
  ↓
plan / work / review 消费
```

一句话：

```text
共享规范仓库负责“标准化输入”，业务项目负责“项目化确认”。
```

---

## 2.3 支持 graph-backed evidence

候选规范不能只靠 LLM 总结。

它应该优先来自：

```text
graph-facts.json
architecture-facts.json
reuse-candidates.json
bootstrap-impact-capabilities.json
graph semantic query
code-review-graph
GitNexus / semantic query provider
真实文件 evidence
symbol / dependency / call graph
```

也就是说：

```text
不是 AI 觉得这个项目应该这样写；
而是 graph query 和代码事实表明这个项目主要是这样写。
```

---

## 2.4 支持 glue-map 胶水能力地图

传统规范回答：

```text
代码应该怎么写？
```

spec-first 还要回答：

```text
已有能力在哪里？
什么时候应该复用？
哪里应该写胶水代码？
哪些能力不能重复实现？
跨 skill / module / repo 如何通过 artifact handoff？
provider adapter 的边界在哪里？
```

所以 `/spec:standards` 需要生成：

```text
glue-map.json
```

它是项目能力复用地图。

---

## 2.5 支持三种研发场景

`/spec:standards` 必须 project-mode aware，支持：

```text
1. single_project_repo
   单个 git 仓库，单项目

2. monorepo_multi_module
   单个 git 仓库，多 module / 多 app / 多 package

3. multi_repo_workspace
   父目录下多个独立 git 仓库，组成一个业务研发空间
```

---

# 3. 设计原则

## 3.1 先识别，再梳理

不要默认生成：

```text
frontend.md
backend.md
api.md
database.md
mobile.md
admin.md
```

正确方式：

```text
项目有什么 → 扫描什么
当前需求需要什么 → 生成什么
后续 skill 会消费什么 → 保留什么
团队确认什么 → 写入什么
```

---

## 3.2 Preview-first

任何长期标准写入前，必须先生成：

```text
standards-preview.md
repo-profile.patch.yaml
```

禁止：

```text
静默修改 repo-profile.yaml
observed 自动升级 confirmed
suggested 自动写入标准
conflict / unknown 被当成规则
```

---

## 3.3 Shared standards first，但必须项目化确认

输入优先级：

```text
1. 用户显式输入
2. 项目 repo-profile.yaml 已确认标准
3. 项目本地 domains/*.md
4. 团队共享规范仓库导入的 team standards
5. 公司共享规范仓库导入的 company standards
6. graph-backed observed conventions
7. README / manifest / config / CI
8. AI suggested best practice
```

说明：

```text
共享规范优先于 graph observed conventions，因为旧代码可能是不规范的。
项目 confirmed standards 优先于共享规范，因为项目本地约束更具体。
```

---

## 3.4 Light contract，不做重规则引擎

第一阶段禁止做：

```text
rules DSL
policy engine
复杂 hard gate
完整 workflow state machine
大而全标准库
自动注入 CLAUDE.md / AGENTS.md
```

保持 spec-first 原则：

```text
Light contract
Explicit boundaries
Let the LLM decide
Scripts prepare, LLM decides
```

---

## 3.5 成本受控

`/spec:standards` 不是每个需求都全量运行的高频 skill。

正确使用方式：

```text
首次接入项目：运行一次 baseline
大结构变化：局部 refresh
新 domain 出现：局部 refresh
review 多次发现同类问题：生成候选更新
日常开发：只消费已有产物，不重新扫描
```

---

# 4. 在 spec-first 全流程中的位置

完整闭环：

```text
/spec:mcp-setup
  ↓
/spec:graph-bootstrap
  ↓
/spec:standards
  ↓
/spec:brainstorm / ideate
  ↓
/spec:doc-review
  ↓
/spec:plan
  ↓
/spec:write-tasks
  ↓
/spec:work / debug / optimize / polish
  ↓
/spec:code-review / app-consistency-audit
  ↓
/spec:compound-refresh / knowledge / skill-audit
```

`/spec:standards` 位于：

```text
graph-bootstrap 之后
brainstorm / plan 之前
```

边界：

```text
graph-bootstrap 负责代码事实
standards 负责项目规范与胶水能力
plan/work/review 负责消费这些标准
compound-refresh 负责反哺更新
```

---

# 5. 是否新增 skill？

是。

新增一个 skill：

```text
/spec:standards
```

不要拆成多个 skill：

```text
/spec:frontend-standards
/spec:backend-standards
/spec:database-standards
/spec:glue
/spec:graph-query-index
```

这些应该是 `/spec:standards` 内部的 lens / task。

推荐内部结构：

```text
/spec:standards
  ├─ Project Mode Detector
  ├─ Project Shape Detector
  ├─ Shared Standards Importer
  ├─ Artifact Demand Planner
  ├─ Graph Semantic Query Lens
  ├─ Glue Standards Lens
  ├─ Frontend Standards Lens        # 按需
  ├─ Backend Standards Lens         # 按需
  ├─ API Standards Lens             # 按需
  ├─ Database Standards Lens        # 按需
  ├─ Mobile Standards Lens          # 按需
  ├─ Admin Standards Lens           # 按需
  ├─ CLI Standards Lens             # 按需
  ├─ Skill Workflow Standards Lens  # 按需
  ├─ Artifact Contract Lens         # 按需
  ├─ Evidence Auditor
  └─ Standards Synthesizer
```

---

# 6. 与现有 skill 的边界

## 6.1 `spec-mcp-setup`

负责：

```text
安装 / 检测工具
准备 provider
输出 graph-providers.json
输出 runtime-capabilities.json
输出 provider-artifacts.json
```

不负责项目规范。

---

## 6.2 `spec-graph-bootstrap`

负责：

```text
代码事实编译
graph readiness 判断
provider capability 判断
生成 canonical graph artifacts
```

产物：

```text
.spec-first/graph/graph-facts.json
.spec-first/graph/architecture-facts.json
.spec-first/graph/reuse-candidates.json
.spec-first/graph/bootstrap-impact-capabilities.json
```

它是事实层，不是规范层。

---

## 6.3 `spec-standards`

负责：

```text
识别项目模式
识别项目形态
导入团队共享规范
发现规范候选
建立 graph-backed evidence
生成 glue-map
生成 standards-preview
生成 repo-profile patch
```

它是规范层 + 胶水能力层。

---

## 6.4 `spec-plan`

负责：

```text
针对具体需求生成技术方案
```

它消费 standards，不重新发现 standards。

---

## 6.5 `spec-work`

负责：

```text
按 plan 执行代码修改
```

它消费：

```text
repo-profile.yaml
glue-map.json
standards-candidates.json
graph-query-index.json
```

---

## 6.6 `spec-code-review`

负责：

```text
审查 diff 是否符合 confirmed standards
审查是否重复造轮子
审查是否绕过 canonical artifacts
审查是否违反 glue boundary
```

它不能直接更新 standards，只能生成 update suggestion。

---

# 7. 团队共享规范仓库设计

## 7.1 仓库定位

建议新建独立 Git 仓库：

```text
spec-first-standards.git
```

它作为公司/团队共享规范源。

业务项目不直接复制整个规范仓库，而是：

```text
按 project-shape 自动匹配
按 domain / stack / scenario 导入
锁定版本
生成 imported-standards.json
结合项目代码事实做 alignment
团队确认后写入 repo-profile
```

---

## 7.2 推荐目录结构

```text
spec-first-standards/
  README.md

  standards.yaml

  global/
    engineering-principles.md
    review-governance.md
    changelog-governance.md
    security-baseline.md
    testing-baseline.md
    ai-coding-baseline.md

  frontend/
    README.md
    component-standards.md
    api-client-standards.md
    state-management-standards.md
    routing-standards.md
    styling-standards.md
    form-standards.md
    i18n-standards.md
    analytics-standards.md
    testing-standards.md

    react/
      README.md
      react-component-standards.md
      react-hooks-standards.md
      react-query-standards.md
      nextjs-standards.md
      vite-standards.md

    vue/
      README.md
      vue-component-standards.md
      pinia-standards.md
      nuxt-standards.md

  backend/
    README.md
    layering-standards.md
    api-standards.md
    error-handling-standards.md
    logging-standards.md
    config-standards.md
    transaction-standards.md
    testing-standards.md

    java/
      spring-boot-standards.md
      mybatis-standards.md
      jpa-standards.md

    node/
      nestjs-standards.md
      express-standards.md

    go/
      go-service-standards.md

  api/
    README.md
    rest-api-standards.md
    response-shape-standards.md
    pagination-standards.md
    error-code-standards.md
    openapi-standards.md
    versioning-standards.md

  database/
    README.md
    table-design-standards.md
    field-naming-standards.md
    migration-standards.md
    index-standards.md
    soft-delete-standards.md
    audit-fields-standards.md

    mysql/
      mysql-standards.md

    postgresql/
      postgresql-standards.md

  mobile/
    README.md
    mobile-architecture-standards.md
    navigation-standards.md
    state-management-standards.md
    performance-standards.md

    android/
      android-standards.md
      kmp-standards.md

    ios/
      ios-standards.md

    flutter/
      flutter-standards.md

    react-native/
      react-native-standards.md

  admin/
    README.md
    admin-page-standards.md
    table-form-standards.md
    permission-standards.md
    menu-routing-standards.md

  glue/
    README.md
    reuse-first-standards.md
    glue-code-boundary.md
    provider-adapter-standards.md
    artifact-handoff-standards.md
    integration-contract-standards.md

  ai-workflow/
    README.md
    spec-first-workflow-standards.md
    skill-authoring-standards.md
    agent-lens-standards.md
    artifact-contract-standards.md
    graph-backed-standards.md
    review-governance.md

  scenarios/
    single-project-repo.md
    monorepo-multi-module.md
    multi-repo-workspace.md
    large-requirement-splitting.md
    multi-team-collaboration.md
    brownfield-onboarding.md
    api-change.md
    database-change.md
    frontend-backend-collaboration.md
    legacy-refactor.md

  templates/
    repo-profile.template.yaml
    standards-preview.template.md
    api-standard.template.md
    database-standard.template.md
    glue-map.template.json

  schemas/
    standards-index.schema.json
    standard-item.schema.json
    import-manifest.schema.json

  examples/
    frontend-react-project/
    backend-spring-project/
    monorepo-project/
    multi-repo-workspace/
```

---

## 7.3 `standards.yaml`

共享规范仓库必须有一个总索引。

```yaml
schema_version: spec-first.shared-standards.v1
name: engineering-standards
version: 1.0.0

standards:
  - id: global.review.changelog-required
    title: Changelog 治理规则
    domain: global
    path: global/changelog-governance.md
    scope: company
    priority: 90
    applies_to:
      project_modes:
        - single_project_repo
        - monorepo_multi_module
        - multi_repo_workspace
      stacks: []
    tags:
      - review
      - governance
      - changelog

  - id: frontend.react.component-standards
    title: React 组件规范
    domain: frontend
    stack: react
    path: frontend/react/react-component-standards.md
    scope: team
    priority: 70
    applies_to:
      domains:
        - frontend
      frameworks:
        - react
      project_modes:
        - single_project_repo
        - monorepo_multi_module
    tags:
      - frontend
      - react
      - component

  - id: backend.spring.layering
    title: Spring Boot 分层规范
    domain: backend
    stack: spring-boot
    path: backend/java/spring-boot-standards.md
    scope: team
    priority: 70
    applies_to:
      domains:
        - backend
      frameworks:
        - spring-boot

  - id: api.response-shape
    title: 统一接口响应规范
    domain: api
    path: api/response-shape-standards.md
    scope: company
    priority: 85
    applies_to:
      domains:
        - api
    tags:
      - api
      - response
      - contract

  - id: glue.artifact-handoff
    title: Artifact Handoff 胶水规范
    domain: glue
    path: glue/artifact-handoff-standards.md
    scope: team
    priority: 80
    applies_to:
      domains:
        - glue
        - ai_workflows
    tags:
      - glue
      - artifact
      - workflow
```

它回答：

```text
有哪些规范？
每条规范在哪里？
适用于哪些项目模式？
适用于哪些技术栈？
优先级是什么？
scope 是公司级、团队级还是项目级？
```

---

## 7.4 单个规范文档模板

共享规范文档不能只是散文，要有固定结构，方便导入解析。

````markdown
# React 组件规范

## Metadata

- id: frontend.react.component-standards
- domain: frontend
- stack: react
- scope: team
- status: active
- version: 1.0.0
- owner: frontend-architecture-team
- applies_to:
  - React
  - Vite
  - Next.js

## Purpose

说明这条规范解决什么问题。

## Rules

### Rule 1: 组件命名使用 PascalCase

组件名和组件文件名使用 PascalCase。

Good:

```tsx
UserCard.tsx
OrderTable.tsx
````

Bad:

```tsx
user-card.tsx
order_table.tsx
```

### Rule 2: 跨业务复用组件放入 shared components

...

## Recommended Project Mapping

* `src/components`
* `src/features/*/components`
* `packages/ui`

## Review Checklist

* [ ] 组件命名是否符合 PascalCase
* [ ] 是否复用已有组件
* [ ] 是否避免把业务逻辑塞进通用组件
* [ ] 是否有必要的测试或 Storybook 示例

## Common Violations

* 重复创建 Button / Modal / Table
* 在页面组件中写复杂业务状态
* 通用组件依赖具体业务 domain

## Exceptions

说明哪些情况下可以例外。

## Related Standards

* frontend.api-client-standards
* frontend.styling-standards

````

必须包含：

```text
Metadata
Purpose
Rules
Good / Bad
Recommended Project Mapping
Review Checklist
Common Violations
Exceptions
Related Standards
````

---

# 8. 业务项目如何导入共享规范

## 8.1 从 Git URL 导入

```bash
/spec:standards --import-source git:https://github.com/company/spec-first-standards.git
```

指定 tag：

```bash
/spec:standards --import-source git:https://github.com/company/spec-first-standards.git --ref v1.2.0
```

指定 commit：

```bash
/spec:standards --import-source git:https://github.com/company/spec-first-standards.git --commit abc123
```

---

## 8.2 从本地目录导入

```bash
/spec:standards --import-source ../spec-first-standards
```

---

## 8.3 只导入某个 domain

```bash
/spec:standards --import-source ../spec-first-standards --domain frontend
/spec:standards --import-source ../spec-first-standards --domain backend
/spec:standards --import-source ../spec-first-standards --domain api
/spec:standards --import-source ../spec-first-standards --domain glue
```

---

## 8.4 自动匹配当前项目

```bash
/spec:standards --import-source ../spec-first-standards --auto
```

流程：

```text
读取当前项目 project-shape.json
读取 shared standards standards.yaml
自动匹配适用规范
生成 import plan
```

例如项目识别为：

```text
React + Vite + Node backend + MySQL
```

自动导入：

```text
global/review-governance.md
frontend/react/react-component-standards.md
frontend/api-client-standards.md
backend/node/nestjs-standards.md
api/response-shape-standards.md
database/mysql/mysql-standards.md
glue/reuse-first-standards.md
```

---

# 9. 业务项目新增导入产物

业务项目导入共享规范后，生成：

```text
.spec-first/standards/standards-sources.json
.spec-first/standards/import-lock.json
.spec-first/standards/imported-standards.json
```

---

## 9.1 `standards-sources.json`

记录规范源。

```json
{
  "schema_version": "spec-first.standards-sources.v1",
  "sources": [
    {
      "id": "company-shared-standards",
      "type": "git",
      "url": "git@github.com:company/spec-first-standards.git",
      "ref": "v1.2.0",
      "commit": "abc123",
      "path": ".",
      "priority": 60,
      "scope": "company"
    }
  ]
}
```

---

## 9.2 `import-lock.json`

类似 `package-lock`，锁定导入版本，避免规范漂移。

```json
{
  "schema_version": "spec-first.import-lock.v1",
  "imports": [
    {
      "source_id": "company-shared-standards",
      "ref": "v1.2.0",
      "commit": "abc123",
      "imported_at": "2026-05-04T00:00:00Z",
      "standards": [
        {
          "id": "frontend.react.component-standards",
          "source_path": "frontend/react/react-component-standards.md",
          "content_hash": "sha256:xxx"
        },
        {
          "id": "api.response-shape",
          "source_path": "api/response-shape-standards.md",
          "content_hash": "sha256:yyy"
        }
      ]
    }
  ]
}
```

---

## 9.3 `imported-standards.json`

把导入文档解析成结构化 items。

```json
{
  "schema_version": "spec-first.imported-standards.v1",
  "source_id": "company-shared-standards",
  "items": [
    {
      "id": "api.response-shape",
      "domain": "api",
      "type": "interface_contract",
      "status": "imported",
      "rule": "接口响应结构统一为 { code, message, data }。",
      "source": {
        "path": "api/response-shape-standards.md",
        "section": "Rules"
      },
      "requires_confirmation": true,
      "suggested_action": "confirm"
    }
  ]
}
```

---

# 10. 导入后的项目适配

共享规范不能直接生效，必须做项目适配。

流程：

```text
Imported Standards
  ↓
Project Shape
  ↓
Graph / Code Facts
  ↓
Alignment Check
  ↓
Standards Preview
  ↓
Human Confirm
  ↓
Repo Profile
```

对齐结果：

```text
aligned
partially_aligned
conflict
not_observable
not_applicable
```

示例：

```json
{
  "id": "backend.layering.controller-service-repository",
  "source_type": "shared_standard",
  "status": "imported",
  "alignment": {
    "result": "partially_aligned",
    "matched_paths": [
      "src/modules/user/UserController.ts",
      "src/modules/user/UserService.ts"
    ],
    "conflict_paths": [
      "src/modules/order/OrderController.ts"
    ],
    "summary": "用户模块符合分层规范，订单模块存在 Controller 直接访问 Repository 的旧实现。"
  },
  "suggested_action": "confirm_as_target_standard"
}
```

处理原则：

```text
新代码遵循团队标准
旧代码不强行重构
触达时渐进改善
冲突模块在 review 中提示风险
```

---

# 11. 三种项目模式支持

## 11.1 单仓单项目：`single_project_repo`

示例：

```text
my-service/
  .git/
  package.json
  src/
  tests/
```

产物结构：

```text
.spec-first/
  specs/
    repo-profile.yaml

  graph/
    graph-facts.json
    architecture-facts.json
    reuse-candidates.json
    bootstrap-impact-capabilities.json

  standards/
    standards-sources.json
    import-lock.json
    imported-standards.json
    project-shape.json
    standards-plan.json
    graph-query-index.json
    glue-map.json
    standards-candidates.json
    standards-preview.md
    repo-profile.patch.yaml

    domains/
      <detected-domain>.md
```

特点：

```text
一个 repo
一个 graph
一份 repo-profile
一份 glue-map
plan/work/review 读取当前 repo standards
```

---

## 11.2 单仓多模块：`monorepo_multi_module`

示例：

```text
trade-platform/
  .git/
  apps/
    web/
    admin/
  services/
    order/
    payment/
  packages/
    ui/
    api-client/
```

产物结构：

```text
.spec-first/
  specs/
    repo-profile.yaml

  standards/
    standards-sources.json
    import-lock.json
    imported-standards.json
    project-shape.json
    standards-plan.json
    graph-query-index.json
    glue-map.json
    standards-candidates.json
    standards-preview.md

    domains/
      frontend.md
      backend.md
      api.md
      database.md
      glue.md
      artifact-contracts.md
      review-governance.md

    modules/
      apps-web/
        module-shape.json
        standards-candidates.json
        glue-map.json
        standards-preview.md
        graph-query-index.json

      apps-admin/
        module-shape.json
        standards-candidates.json
        standards-preview.md

      services-order/
        module-shape.json
        standards-candidates.json
        glue-map.json
        standards-preview.md
```

层级：

```text
root standards：跨模块原则、review 规则、artifact contract、glue 原则
module standards：模块内规范、局部目录、局部 glue-map
```

---

## 11.3 多仓 workspace：`multi_repo_workspace`

示例：

```text
workspace/
  h5-app/
    .git/
  admin-web/
    .git/
  order-service/
    .git/
  common-sdk/
    .git/
```

推荐结构：

```text
workspace/
  .spec-first/
    workspace/
      standards-sources.json
      import-lock.json
      imported-standards.json
      workspace-shape.json
      workspace-standards-plan.json
      workspace-glue-map.json
      workspace-context-routing.json
      workspace-standards-preview.md
      workspace-standards-candidates.json

  h5-app/
    .spec-first/
      specs/
        repo-profile.yaml
      standards/
        project-shape.json
        standards-plan.json
        standards-candidates.json
        glue-map.json
        standards-preview.md

  admin-web/
    .spec-first/
      specs/
        repo-profile.yaml
      standards/
        project-shape.json
        standards-plan.json
        standards-candidates.json

  order-service/
    .spec-first/
      specs/
        repo-profile.yaml
      standards/
        project-shape.json
        standards-plan.json
        standards-candidates.json
        glue-map.json
        standards-preview.md
```

workspace 级别只放：

```text
有哪些 repo
repo 角色
跨 repo glue-map
跨 repo API / SDK / contract
context routing
发布顺序提示
```

每个 repo 自己保留：

```text
repo-profile.yaml
project-shape.json
standards-candidates.json
glue-map.json
```

---

# 12. 代码结构设计

## 12.1 新增目录

```text
skills/spec-standards/
.claude/spec-first/workflows/spec-standards/
```

---

## 12.2 `skills/spec-standards/`

```text
skills/
  spec-standards/
    SKILL.md
    README.md
    examples/
      project-shape.example.json
      standards-plan.example.json
      standards-sources.example.json
      import-lock.example.json
      imported-standards.example.json
      graph-query-index.example.json
      glue-map.example.json
      standards-candidates.example.json
      standards-preview.example.md
      repo-profile-patch.example.yaml
      workspace-shape.example.json
      workspace-glue-map.example.json
```

---

## 12.3 `.claude/spec-first/workflows/spec-standards/`

```text
.claude/
  spec-first/
    workflows/
      spec-standards/
        SKILL.md

        prompts/
          standards-system.md
          standards-synthesis.md
          import-synthesis.md
          repo-profile-confirmation.md
          downstream-consumption.md
          workspace-synthesis.md

        lenses/
          project-shape-lens.md
          shared-standards-import-lens.md
          graph-semantic-query-lens.md
          glue-standards-lens.md
          reuse-boundary-lens.md
          integration-contract-lens.md
          cli-standards-lens.md
          frontend-standards-lens.md
          backend-standards-lens.md
          api-standards-lens.md
          database-standards-lens.md
          mobile-standards-lens.md
          admin-standards-lens.md
          skill-workflow-standards-lens.md
          artifact-contract-standards-lens.md
          review-governance-standards-lens.md
          workspace-routing-lens.md
          cross-repo-consistency-lens.md
          evidence-auditor-lens.md

        schemas/
          standards-sources.schema.json
          import-lock.schema.json
          imported-standards.schema.json
          project-shape.schema.json
          module-shape.schema.json
          workspace-shape.schema.json
          standards-plan.schema.json
          workspace-standards-plan.schema.json
          graph-query-index.schema.json
          glue-map.schema.json
          workspace-glue-map.schema.json
          capability-map.schema.json
          standards-candidate.schema.json
          lens-result.schema.json
          repo-profile-patch.schema.json
          standards-update-decision.schema.json
          workspace-context-routing.schema.json

        scripts/
          run-detect-project-mode.js
          run-detect-project-shape.js
          run-detect-workspace-shape.js
          run-import-shared-standards.js
          run-build-import-lock.js
          run-align-imported-standards.js
          run-plan-standards.js
          run-plan-workspace-standards.js
          run-build-graph-query-index.js
          run-build-glue-map.js
          run-build-workspace-glue-map.js
          run-prepare-lens-inputs.js
          run-merge-lens-results.js
          run-render-preview.js
          run-render-workspace-preview.js
          run-build-repo-profile-patch.js
          run-apply-repo-profile-patch.js
          run-validate-artifacts.js
          run-refresh-standards.js
          run-check-drift.js
          run-decide-standards-update.js
          run-upgrade-standards-source.js

          lib/
            fs-utils.js
            git-utils.js
            json-utils.js
            yaml-utils.js
            path-utils.js
            hash-utils.js
            evidence-utils.js
            schema-utils.js
            repo-profile-utils.js
            artifact-utils.js
            graph-artifact-utils.js
            workspace-utils.js
            module-utils.js
            import-source-utils.js

            detectors/
              detect-project-mode.js
              detect-git-roots.js
              detect-languages.js
              detect-package-managers.js
              detect-monorepo.js
              detect-modules.js
              detect-frontend.js
              detect-backend.js
              detect-api.js
              detect-database.js
              detect-mobile.js
              detect-admin.js
              detect-cli.js
              detect-ai-workflows.js
              detect-tests.js
              detect-ci.js
              detect-docs.js
              detect-glue-capabilities.js
              detect-provider-adapters.js
              detect-artifact-handoffs.js
              detect-workflow-composition.js
              detect-reuse-boundaries.js
              detect-cross-repo-contracts.js

            planners/
              plan-domains.js
              plan-artifacts.js
              plan-lenses.js
              plan-graph-queries.js
              plan-module-scopes.js
              plan-workspace-scopes.js
              plan-imported-standards.js
              plan-downstream-consumption.js
              plan-refresh-scope.js

            renderers/
              render-standards-preview.js
              render-workspace-preview.js
              render-import-diff.js
              render-artifact-plan.js
              render-glue-standards.js
              render-repo-profile-patch.js
              render-refresh-report.js
              render-drift-report.js

            writers/
              write-json-artifact.js
              write-markdown-artifact.js
              write-repo-profile.js
```

---

# 13. 核心执行流程

```text
/spec:standards
  ↓
1. Detect Project Mode
  ↓
2. Detect Project Shape
  ↓
3. Import Shared Standards     # 可选，但推荐支持
  ↓
4. Build Import Lock
  ↓
5. Align Imported Standards with Code / Graph
  ↓
6. Plan Standards Tasks
  ↓
7. Run Graph Semantic Queries
  ↓
8. Build Glue Map
  ↓
9. Dispatch Domain Lenses
  ↓
10. Merge Standards Candidates
  ↓
11. Render standards-preview.md
  ↓
12. Human Confirm / Edit / Reject
  ↓
13. Build repo-profile.patch.yaml
  ↓
14. Apply confirmed standards to repo-profile.yaml
```

ASCII：

```text
/spec:standards
  │
  ├─ Project Mode Detection
  │
  ├─ Project Shape Detection
  │    └─ project-shape.json
  │
  ├─ Shared Standards Import
  │    ├─ standards-sources.json
  │    ├─ import-lock.json
  │    └─ imported-standards.json
  │
  ├─ Standards Task Planning
  │    └─ standards-plan.json
  │
  ├─ Graph Semantic Query
  │    └─ graph-query-index.json
  │
  ├─ Glue Capability Discovery
  │    └─ glue-map.json
  │
  ├─ Domain Lens Discovery
  │    └─ lens-results/*.json
  │
  ├─ Candidate Synthesis
  │    └─ standards-candidates.json
  │
  ├─ Preview Rendering
  │    └─ standards-preview.md
  │
  ├─ Repo Profile Patch
  │    └─ repo-profile.patch.yaml
  │
  └─ Human Confirmed Write
       └─ repo-profile.yaml
```

---

# 14. 核心产物定义

## 14.1 `project-shape.json`

识别当前 repo / module 的项目形态。

```json
{
  "schema_version": "spec-first.project-shape.v1",
  "project_mode": "single_project_repo",
  "project": {
    "root": ".",
    "detected_type": "node_cli_ai_workflow_framework",
    "summary": "Node.js CLI and AI workflow framework",
    "confidence": "high"
  },
  "languages": [],
  "frameworks": [],
  "package_managers": [],
  "domains": {},
  "graph": {},
  "modules": [],
  "recommended_standard_domains": [],
  "skipped_standard_domains": []
}
```

---

## 14.2 `standards-sources.json`

记录规范来源。

```json
{
  "schema_version": "spec-first.standards-sources.v1",
  "sources": [
    {
      "id": "company-shared-standards",
      "type": "git",
      "url": "git@github.com:company/spec-first-standards.git",
      "ref": "v1.2.0",
      "commit": "abc123",
      "path": ".",
      "priority": 60,
      "scope": "company"
    }
  ]
}
```

---

## 14.3 `import-lock.json`

锁定导入版本。

```json
{
  "schema_version": "spec-first.import-lock.v1",
  "imports": [
    {
      "source_id": "company-shared-standards",
      "ref": "v1.2.0",
      "commit": "abc123",
      "imported_at": "2026-05-04T00:00:00Z",
      "standards": [
        {
          "id": "api.response-shape",
          "source_path": "api/response-shape-standards.md",
          "content_hash": "sha256:yyy"
        }
      ]
    }
  ]
}
```

---

## 14.4 `imported-standards.json`

结构化导入的团队规范。

```json
{
  "schema_version": "spec-first.imported-standards.v1",
  "source_id": "company-shared-standards",
  "items": [
    {
      "id": "api.response-shape",
      "domain": "api",
      "type": "interface_contract",
      "status": "imported",
      "rule": "接口响应结构统一为 { code, message, data }。",
      "source": {
        "path": "api/response-shape-standards.md",
        "section": "Rules"
      },
      "requires_confirmation": true,
      "suggested_action": "confirm"
    }
  ]
}
```

---

## 14.5 `standards-plan.json`

决定这次梳理哪些标准、哪些跳过、生成哪些产物。

```json
{
  "schema_version": "spec-first.standards-plan.v1",
  "project_mode": "monorepo_multi_module",
  "mode": "baseline",
  "budget": {
    "mode": "baseline",
    "max_enabled_lenses": 5,
    "max_candidates_per_domain": 20,
    "max_evidence_per_candidate": 5,
    "allow_multi_agent": false,
    "allow_raw_source_context": false,
    "allow_deep_graph_queries": false
  },
  "scope_plan": {
    "global": {
      "enabled": true,
      "domains": ["glue", "artifact_contracts", "review_governance"]
    },
    "modules": []
  },
  "tasks": [],
  "artifacts": {
    "generate": [],
    "defer": [],
    "skip": []
  },
  "dispatch": {
    "mode": "single_skill",
    "enabled_lenses": [],
    "skipped_lenses": []
  }
}
```

---

## 14.6 `graph-query-index.json`

记录 graph-backed evidence 和 semantic query 结果摘要。

```json
{
  "schema_version": "spec-first.graph-query-index.v1",
  "queries": [
    {
      "id": "query.workflow.artifact-handoff",
      "intent": "discover canonical artifact handoff patterns",
      "provider": "code-review-graph",
      "status": "succeeded",
      "result_summary": "Workflow skills exchange context through explicit artifacts under .spec-first.",
      "evidence": [
        {
          "path": ".spec-first/graph/graph-facts.json",
          "reason": "Canonical graph fact artifact consumed by downstream skills"
        }
      ],
      "candidate_ids": [
        "glue.artifact-handoff.canonical-artifacts"
      ],
      "capability_ids": []
    }
  ],
  "fallbacks": []
}
```

---

## 14.7 `glue-map.json`

项目能力复用地图。

```json
{
  "schema_version": "spec-first.glue-map.v1",
  "scope": {
    "type": "repo"
  },
  "capabilities": [
    {
      "id": "capability.graph.readiness",
      "name": "Graph Readiness Compiler",
      "kind": "code_facts_provider",
      "owners": ["spec-graph-bootstrap"],
      "entrypoints": [
        "skills/spec-graph-bootstrap/SKILL.md"
      ],
      "outputs": [
        ".spec-first/graph/graph-facts.json",
        ".spec-first/graph/architecture-facts.json",
        ".spec-first/graph/bootstrap-impact-capabilities.json"
      ],
      "reuse_when": [
        "需要代码事实",
        "需要影响面分析",
        "需要候选复用模块"
      ],
      "do_not_reimplement": [
        "不要在 spec-plan 中重新扫描全仓库生成代码事实",
        "不要让下游 skill 直接猜 provider 能力"
      ],
      "discovered_by": [
        "graph-query-index.query.workflow.artifact-handoff"
      ]
    }
  ],
  "glue_patterns": [],
  "risks": []
}
```

---

## 14.8 `standards-candidates.json`

结构化候选规范。

状态：

```text
confirmed
imported
observed
suggested
conflict
unknown
deprecated    # P2+
drifted       # P2+
```

示例：

```json
{
  "schema_version": "spec-first.standards-candidates.v1",
  "candidates": [
    {
      "id": "glue.artifact-handoff.canonical-artifacts",
      "domain": "glue",
      "type": "artifact_contract",
      "status": "observed",
      "confidence": "high",
      "rule_candidate": "跨 skill 传递上下文时，应优先使用显式 canonical artifacts，而不是依赖聊天历史。",
      "source_type": "graph_observed",
      "evidence": [
        {
          "path": ".spec-first/graph/graph-facts.json",
          "source": "graph-query",
          "query_id": "query.workflow.artifact-handoff",
          "reason": "Graph facts are consumed as canonical downstream input"
        }
      ],
      "graph_support": {
        "query_ids": ["query.workflow.artifact-handoff"],
        "coverage": "high"
      },
      "suggested_action": "confirm",
      "downstream_usage": [
        "spec-plan",
        "spec-write-tasks",
        "spec-work",
        "spec-code-review"
      ]
    }
  ],
  "conflicts": [],
  "unknowns": []
}
```

---

## 14.9 `standards-preview.md`

给人审查的候选规范预览。

推荐结构：

```markdown
# Standards Preview

## 1. Summary

## 2. Detected Project Mode

## 3. Detected Project Shape

## 4. Imported Shared Standards

## 5. Import Alignment Result

## 6. Artifact Plan

## 7. Graph-backed Findings

## 8. Glue Capability Map Summary

## 9. Observed Conventions

### CLI

### Skill Workflow

### Artifact Contracts

### Review Governance

### Glue

### Frontend / Backend / API / Database / Mobile / Admin

## 10. Conflicts

## 11. Unknowns / Requires User Decision

## 12. Suggested Repo Profile Patch

## 13. Suggested Actions
```

---

## 14.10 `repo-profile.patch.yaml`

准备写入 repo-profile 的 patch。

```yaml
schema_version: spec-first.repo-profile-patch.v1
source: .spec-first/standards/standards-preview.md

confirmed_candidate_ids:
  - glue.artifact-handoff.canonical-artifacts
  - glue.provider-adapter.boundary

patch:
  confirmed_standards:
    glue:
      artifact_handoff: "跨 skill 传递上下文时优先使用显式 canonical artifacts，不依赖聊天历史。"
      provider_boundary: "skill 消费 provider capability，不直接绑定 provider 实现细节。"
      preview_first: "任何长期规范写入必须先生成 preview/patch，用户确认后再写入。"

safety:
  contains_observed: false
  contains_suggested: false
  contains_conflict: false
  requires_user_confirmation: true
```

---

# 15. `repo-profile.yaml` 写入规则

只能写：

```text
用户确认后的核心标准
```

不能写：

```text
project shape
运行状态
lens 输出
完整 evidence
observed convention
suggested rule
conflict
unknown
raw graph query
完整共享规范文档
```

推荐结构：

```yaml
project_intent:
  summary: ""

principles:
  - "优先复用已有能力，不重复造轮子"
  - "新代码遵循当前模块所在上下文的已确认规范"

non_negotiables:
  - "任何长期规范写入必须先 preview，再用户确认"
  - "涉及源码变更必须更新 CHANGELOG.md"

review_defaults:
  language: zh-CN
  require_changelog: true
  require_tests_for_logic_change: true

confirmed_standards:
  glue:
    artifact_handoff: "跨 skill 传递上下文时优先使用显式 canonical artifacts，不依赖聊天历史。"
    provider_boundary: "skill 消费 provider capability，不直接绑定 provider 实现细节。"
    reuse_first: "新增能力优先复用已有 canonical artifacts、provider artifacts 和 workflow scripts。"

  graph:
    graph_backed_discovery: "项目规范候选优先由 graph facts、semantic query 和代码 evidence 支撑。"

  skill_workflow:
    preview_first: "任何影响长期规范或项目配置的写入，必须先生成 preview/patch。"
```

---

# 16. 产物是否提交仓库

## 16.1 应提交

这些是团队共享基线：

```text
.spec-first/specs/repo-profile.yaml

.spec-first/standards/standards-sources.json
.spec-first/standards/import-lock.json
.spec-first/standards/imported-standards.json
.spec-first/standards/project-shape.json
.spec-first/standards/standards-plan.json
.spec-first/standards/standards-candidates.json
.spec-first/standards/standards-preview.md
.spec-first/standards/glue-map.json

.spec-first/standards/domains/*.md   # 按需
```

multi-repo workspace 下：

```text
workspace/.spec-first/workspace/workspace-shape.json
workspace/.spec-first/workspace/workspace-glue-map.json
workspace/.spec-first/workspace/workspace-context-routing.json
```

---

## 16.2 条件提交

```text
.spec-first/standards/graph-query-index.json
.spec-first/standards/standards-status.json
.spec-first/standards/standards-evidence.json
.spec-first/standards/standards-refresh.md
.spec-first/standards/standards-drift.md
.spec-first/standards/repo-profile.patch.yaml
.spec-first/standards/standards-import-diff.md
```

条件：

```text
后续 skill 需要消费
PR 需要审查依据
团队需要共享
这次变更目标就是 standards refresh / upgrade
```

---

## 16.3 不提交

```text
.spec-first/standards/work/
.spec-first/standards/tmp/
.spec-first/standards/cache/
.spec-first/standards/raw/
```

建议 `.gitignore`：

```gitignore
# spec-first standards runtime artifacts
.spec-first/standards/work/
.spec-first/standards/tmp/
.spec-first/standards/cache/
.spec-first/standards/raw/
.spec-first/standards/**/*.log

# optional raw graph query results
.spec-first/standards/graph-query-raw/
```

---

# 17. 后续 skill 消费矩阵

| 产物                          | brainstorm | doc-review | plan | write-tasks | work/debug/optimize/polish | code-review | compound-refresh | skill-audit |
| --------------------------- | ---------: | ---------: | ---: | ----------: | -------------------------: | ----------: | ---------------: | ----------: |
| `repo-profile.yaml`         |          是 |          是 |    是 |           是 |                          是 |           是 |                是 |           是 |
| `project-shape.json`        |          是 |          是 |    是 |           是 |                          是 |           是 |                是 |           是 |
| `workspace-shape.json`      |          是 |          是 |    是 |           是 |                          是 |           是 |                是 |           是 |
| `standards-sources.json`    |          低 |          低 |    中 |           低 |                          低 |           中 |                是 |           是 |
| `import-lock.json`          |          低 |          低 |    中 |           低 |                          低 |           中 |                是 |           是 |
| `imported-standards.json`   |          中 |          是 |    是 |           是 |                          是 |           是 |                是 |           是 |
| `standards-plan.json`       |          低 |          低 |    低 |           低 |                          低 |           中 |                中 |           是 |
| `graph-query-index.json`    |          中 |          低 |    是 |           是 |                          是 |           是 |                是 |           中 |
| `glue-map.json`             |          是 |          中 |    是 |           是 |                          是 |           是 |                是 |           是 |
| `workspace-glue-map.json`   |          是 |          是 |    是 |           是 |                          中 |           是 |                是 |           是 |
| `standards-candidates.json` |          中 |          中 |    是 |           是 |                          是 |           是 |                是 |           是 |
| `standards-preview.md`      |          低 |          中 |    低 |           低 |                          低 |           中 |                是 |           是 |

---

# 18. 后续 skill 具体消费方式

## 18.1 `brainstorm`

读取：

```text
project-shape.json
workspace-shape.json
repo-profile.yaml
glue-map.json
workspace-glue-map.json
```

作用：

```text
判断需求涉及哪些 domain / module / repo
判断是否已有能力可复用
判断是否需要大需求拆分
判断是否跨团队 / 跨端
```

---

## 18.2 `doc-review`

读取：

```text
project-shape.json
imported-standards.json
standards-candidates.json
repo-profile.yaml
```

作用：

```text
审查 PRD 是否缺接口、权限、DB、组件、测试、埋点、i18n、灰度、兼容性等信息
```

---

## 18.3 `spec-plan`

读取：

```text
repo-profile.yaml
project-shape.json
workspace-shape.json
imported-standards.json
graph-query-index.json
glue-map.json
workspace-glue-map.json
standards-candidates.json
graph artifacts
```

输出中新增：

```markdown
## Project Standards Applied

## Imported Standards Considered

## Reuse & Glue Strategy

## Graph-backed Evidence

## Scope Routing

## Standards Risks

## Cross-repo / Cross-module Impact
```

---

## 18.4 `spec-write-tasks`

读取：

```text
repo-profile.yaml
glue-map.json
workspace-glue-map.json
standards-candidates.json
project-shape.json
```

作用：

```text
按真实 module / repo 拆任务
拆出 adapter / glue / contract / migration / API / UI / review / test 任务
```

---

## 18.5 `spec-work`

读取：

```text
repo-profile.yaml
glue-map.json
graph-query-index.json
standards-candidates.json
```

作用：

```text
写代码前读取相关 confirmed standards
优先复用已有 capability
避免重复实现
避免绕过 canonical artifacts
```

---

## 18.6 `spec-code-review`

读取：

```text
repo-profile.yaml
imported-standards.json
standards-candidates.json
glue-map.json
workspace-glue-map.json
graph-query-index.json
project-shape.json
```

审查：

```text
是否违反 confirmed standards
是否重复造轮子
是否绕过 canonical artifacts
是否把 provider 细节泄露到 skill 主流程
是否缺少 schema_version
是否缺少 degraded mode
是否缺少 preview / patch
是否违反 changelog 治理
跨 repo contract 是否同步
多端行为是否一致
```

---

## 18.7 `compound-refresh`

读取：

```text
code-review result
glue-map.json
standards-candidates.json
repo-profile.yaml
```

生成：

```text
standards_update_suggestion
```

---

# 19. 成本控制策略

## 19.1 模式分级

`/spec:standards` 支持四种模式。

### `--quick`

只判断是否需要更新。

```bash
/spec:standards --quick
```

做：

```text
读取已有 project-shape
检查 manifest / graph artifact hash
判断是否需要 refresh
生成 standards-update-decision.json
```

不跑 lens，不跑深度 LLM synthesis。

---

### `--baseline`

首次基线。

```bash
/spec:standards --baseline
```

生成：

```text
project-shape.json
standards-plan.json
standards-candidates.json
standards-preview.md
glue-map.json
```

---

### `--refresh`

局部刷新。

```bash
/spec:standards --refresh --domain database
/spec:standards --refresh --module services/order
/spec:standards --refresh --repo order-service
```

只刷新命中范围。

---

### `--deep`

显式深扫。

```bash
/spec:standards --deep
```

才允许：

```text
更多 graph semantic query
更多 lens
多 agent 并行
更完整 evidence
生成 standards-evidence.json
生成 domains/*.md
```

---

## 19.2 Token Budget Policy

写入 `SKILL.md`：

```text
1. Default mode must not run deep scan.
2. Always run project-shape detection before domain lenses.
3. Do not invoke a domain lens unless standards-plan enables it.
4. Do not include raw source files in LLM context unless necessary.
5. Prefer graph artifacts and compressed summaries.
6. Limit evidence examples per candidate.
7. Do not read all module standards in plan/work/review.
8. Use context routing before loading standards.
9. Multi-agent dispatch requires explicit deep mode or large-project trigger.
10. Repo-profile must remain small.
```

---

## 19.3 Budget 配置

`standards-plan.json` 中增加：

```json
{
  "budget": {
    "mode": "baseline",
    "max_enabled_lenses": 5,
    "max_candidates_per_domain": 20,
    "max_evidence_per_candidate": 5,
    "allow_multi_agent": false,
    "allow_raw_source_context": false,
    "allow_deep_graph_queries": false
  }
}
```

`--deep` 时：

```json
{
  "budget": {
    "mode": "deep",
    "allow_multi_agent": true,
    "allow_deep_graph_queries": true,
    "allow_standards_evidence_file": true
  }
}
```

---

# 20. 更新机制

## 20.1 更新分层

| 类型  | 产物                                                                                      | 更新策略                     |
| --- | --------------------------------------------------------------------------------------- | ------------------------ |
| 事实类 | `project-shape.json`, `workspace-shape.json`, `graph-query-index.json`, `glue-map.json` | 可自动 refresh，但要报告变化       |
| 导入类 | `standards-sources.json`, `import-lock.json`, `imported-standards.json`                 | 可自动更新候选，但升级 source 需显式操作 |
| 候选类 | `standards-candidates.json`, `standards-preview.md`                                     | 可自动更新，不能作为强标准            |
| 确认类 | `repo-profile.yaml`                                                                     | 必须 preview + 用户确认后更新     |

---

## 20.2 触发更新的信号

### 结构变化信号

```text
新增 app / package / module
新增 repo
monorepo workspace 变化
目录结构大调整
```

影响：

```text
project-shape.json
workspace-shape.json
standards-plan.json
```

---

### 共享规范变化信号

```text
shared standards repo 新 tag
import-lock 与当前 source 不一致
导入标准 content_hash 变化
```

影响：

```text
import-lock.json
imported-standards.json
standards-import-diff.md
standards-preview.md
```

---

### Graph 变化信号

```text
graph-facts.json hash 变化
architecture-facts.json hash 变化
reuse-candidates.json 变化
provider readiness 变化
semantic query 能力变化
```

影响：

```text
graph-query-index.json
glue-map.json
standards-candidates.json
```

---

### 需求域变化信号

```text
当前需求第一次涉及 database
当前需求第一次涉及 mobile
当前需求第一次涉及 admin
当前需求第一次涉及 provider / MCP / graph artifacts
当前需求跨多个端 / 多个模块 / 多个 repo
```

策略：

```text
只 refresh 命中的 domain，不全量 refresh
```

---

### Review 反馈信号

```text
code-review 发现重复问题
app-consistency-audit 发现一致性问题
多次出现重复造轮子
多次绕过 canonical artifacts
用户多次纠正同一类实现
```

策略：

```text
生成新 candidate，不直接写 confirmed standard
```

---

# 21. 更新决策文件

新增：

```text
.spec-first/standards/standards-update-decision.json
```

示例：

```json
{
  "schema_version": "spec-first.standards-update-decision.v1",
  "generated_by": "spec-standards",
  "decision": "partial_refresh",
  "reasons": [
    {
      "type": "shared_standard_changed",
      "source_id": "company-shared-standards",
      "impact": "imported standards may be stale"
    },
    {
      "type": "graph_artifact_changed",
      "artifact": ".spec-first/graph/reuse-candidates.json",
      "impact": "glue-map may be stale"
    },
    {
      "type": "review_feedback",
      "source": "spec-code-review",
      "impact": "new glue candidate suggested"
    }
  ],
  "refresh_scope": {
    "domains": ["glue", "graph"],
    "artifacts": [
      "imported-standards.json",
      "graph-query-index.json",
      "glue-map.json",
      "standards-candidates.json",
      "standards-preview.md"
    ]
  },
  "auto_update_allowed": [
    "project-shape.json",
    "standards-plan.json",
    "imported-standards.json",
    "graph-query-index.json",
    "glue-map.json",
    "standards-candidates.json",
    "standards-preview.md"
  ],
  "requires_user_confirmation": [
    "repo-profile.yaml"
  ]
}
```

---

# 22. 共享规范升级

支持命令：

```bash
/spec:standards --upgrade-source company-shared-standards --ref v1.3.0
```

输出：

```text
.spec-first/standards/standards-import-diff.md
.spec-first/standards/import-lock.json
.spec-first/standards/imported-standards.json
.spec-first/standards/standards-preview.md
.spec-first/standards/repo-profile.patch.yaml
```

`standards-import-diff.md` 说明：

```text
新增了哪些规范
删除了哪些规范
哪些规范变更了
哪些和当前项目冲突
哪些需要用户确认
哪些只是文档升级，不影响 repo-profile
```

不要自动升级生效。
必须通过 preview + confirm。

---

# 23. 冲突处理

## 23.1 文档规范 vs 当前代码冲突

处理：

```text
标记 conflict
不直接改 repo-profile
preview 中提示
用户决定是否作为目标规范
```

## 23.2 公司规范 vs 团队规范冲突

处理：

```text
团队规范优先，但记录 override reason
```

示例：

```yaml
confirmed_standards:
  api:
    response_shape: "{ code, message, data }"
    source: "team_standard"
    overrides:
      source: "company_standard"
      reason: "当前业务网关已固定使用 code/message/data 结构。"
```

## 23.3 root 规范 vs module 规范冲突

处理：

```text
root non_negotiables 不可覆盖
module 可以覆盖局部实现细则
必须记录 scope
```

---

# 24. 执行模式

## 24.1 首次接入业务项目

```bash
/spec:mcp-setup
/spec:graph-bootstrap
/spec:standards --import-source ../spec-first-standards --auto --baseline
```

输出：

```text
standards-sources.json
import-lock.json
imported-standards.json
project-shape.json
standards-plan.json
graph-query-index.json
glue-map.json
standards-candidates.json
standards-preview.md
```

团队确认后：

```text
repo-profile.patch.yaml
repo-profile.yaml
```

---

## 24.2 日常开发

普通需求不重新跑 standards。

后续 skill 直接读取：

```text
repo-profile.yaml
project-shape.json
standards-candidates.json
glue-map.json
imported-standards.json
```

---

## 24.3 局部刷新

```bash
/spec:standards --refresh --domain database
/spec:standards --refresh --domain frontend
/spec:standards --refresh --domain glue
/spec:standards --refresh --module services/order
/spec:standards --refresh --repo order-service
```

---

## 24.4 Drift 检查

```bash
/spec:standards --drift
```

输出：

```text
standards-drift.md
```

检查：

```text
confirmed standards 是否和当前代码事实偏离
某些标准是否过期
某些旧约定是否被新模式替代
```

---

## 24.5 从 review 更新

```bash
/spec:standards --update-from-review
```

输入：

```text
code-review result
standards_update_suggestion
```

输出：

```text
standards-candidates.json
standards-preview.md
repo-profile.patch.yaml
```

---

# 25. 当前 spec-first 自身推荐启用 domain

spec-first 当前更像：

```text
Node.js CLI
AI workflow framework
Claude/Codex skill system
Graph readiness / provider integration
.spec-first artifact protocol
review / compound / knowledge workflow
```

所以应启用：

```text
cli
skill_workflow
artifact_contracts
review_governance
glue
graph
ai_workflow
```

不默认启用：

```text
frontend
backend
api
database
mobile
admin
```

除非检测到对应工程域。

---

# 26. Roadmap

## Phase 0：准备事实层

依赖：

```text
graph-facts.json
architecture-facts.json
reuse-candidates.json
bootstrap-impact-capabilities.json
runtime-capabilities.json
provider-artifacts.json
```

目标：

```text
graph-bootstrap 输出可以被 standards 消费的 canonical graph artifacts
```

---

## Phase 1：新增 `/spec:standards` MVP

支持：

```text
single_project_repo
```

产物：

```text
project-shape.json
standards-plan.json
standards-candidates.json
standards-preview.md
```

能力：

```text
识别项目形态
按需规划 domain
生成候选规范 preview
不写 repo-profile
```

---

## Phase 2：支持共享规范导入

新增：

```text
standards-sources.json
import-lock.json
imported-standards.json
standards-import-diff.md
```

能力：

```text
从独立 standards Git 仓库导入
按 project-shape 自动匹配
锁定 ref / commit
导入后做 alignment
```

---

## Phase 3：接入 graph-backed discovery 和 glue-map

新增：

```text
graph-query-index.json
glue-map.json
domains/glue.md
domains/graph-backed-standards.md
```

能力：

```text
graph semantic query 支撑规范候选
生成能力复用地图
沉淀胶水边界
```

---

## Phase 4：支持用户确认写入 repo-profile

新增：

```text
repo-profile.patch.yaml
```

能力：

```text
confirm / edit / reject
只写 confirmed standards
repo-profile 保持轻量
```

---

## Phase 5：支持 monorepo_multi_module

新增：

```text
module-shape.json
modules/<module-id>/standards-candidates.json
modules/<module-id>/glue-map.json
scope-aware standards-plan
```

能力：

```text
root + module 两层 standards
module scoped graph query
module scoped plan/work/review
```

---

## Phase 6：支持 multi_repo_workspace

新增：

```text
workspace-shape.json
workspace-standards-plan.json
workspace-glue-map.json
workspace-context-routing.json
workspace-standards-preview.md
```

能力：

```text
父目录多个独立 git repo 识别
workspace 级跨 repo glue-map
跨 repo context routing
cross-repo consistency review
```

---

## Phase 7：下游 skill 全链路接入

接入顺序：

```text
spec-plan
  ↓
spec-write-tasks
  ↓
spec-work
  ↓
spec-code-review
  ↓
doc-review / brainstorm
  ↓
compound-refresh / skill-audit
```

---

## Phase 8：refresh / drift / update suggestion

新增：

```text
standards-status.json
standards-update-decision.json
standards-refresh.md
standards-drift.md
```

能力：

```text
局部刷新
漂移检测
review 反馈转 candidate
compound 经验反哺 standards
```

---

# 27. 风险与防护

## 27.1 风险：变成大而全规范平台

防护：

```text
所有 domain 按需生成
所有产物由 standards-plan 决策
不默认生成 frontend/backend/api/database/mobile/admin
```

---

## 27.2 风险：污染 repo-profile

防护：

```text
repo-profile 只写 confirmed standards
observed / suggested / conflict / unknown 禁止写入
必须通过 repo-profile.patch.yaml + 用户确认
```

---

## 27.3 风险：上下文膨胀

防护：

```text
CLAUDE.md / AGENTS.md 不放完整 standards
只注入读取入口
后续 skill 按需读取相关 domain/module/repo
```

---

## 27.4 风险：graph 不可用导致误判

防护：

```text
记录 provider readiness
graph query 失败必须标 degraded
fallback 到 file scan 时降低 confidence
候选规范必须标注 evidence source
```

---

## 27.5 风险：强行统一旧代码

防护：

```text
conflict 不转 confirmed
旧代码不强拆
新代码遵循目标模块主流模式
触达时渐进式改善
```

---

## 27.6 风险：共享规范直接压项目

防护：

```text
共享规范导入后必须 alignment
不直接变成 confirmed
项目 repo-profile confirmed standards 优先
冲突必须 preview 给团队确认
```

---

## 27.7 风险：成本爆炸

防护：

```text
默认 quick / baseline，不 deep
domain 按需启用
graph query 摘要化
LLM 不读 raw source
多 agent 只在 deep 或大仓触发
日常只消费已提交 baseline
```

---

# 28. 最终架构总结

`/spec:standards` 是新增的单一 skill，不拆成多个 skill。

它内部按需派发 lens。

核心链路：

```text
detect project mode
  → detect project shape
  → import shared standards
  → align imported standards
  → plan standards
  → graph semantic query
  → build glue map
  → domain lens discovery
  → merge candidates
  → render preview
  → build repo-profile patch
  → human confirm
  → apply confirmed standards
```

核心产物链路：

```text
standards-sources.json
  → import-lock.json
  → imported-standards.json
  → project-shape.json / workspace-shape.json
  → standards-plan.json / workspace-standards-plan.json
  → graph-query-index.json
  → glue-map.json / workspace-glue-map.json
  → standards-candidates.json
  → standards-preview.md
  → repo-profile.patch.yaml
  → repo-profile.yaml
```

支持三种项目模式：

```text
single_project_repo
  → repo 级 standards

monorepo_multi_module
  → root + module 级 standards

multi_repo_workspace
  → workspace + repo 级 standards，维护跨 repo glue-map
```

最终价值：

```text
shared standards repo 提供团队规范源
graph-bootstrap 提供代码事实
standards 编译项目规范候选和胶水能力地图
plan/work/review 消费 confirmed standards 和 glue-map
code-review / compound-refresh 发现新经验
standards-refresh 生成更新建议
用户确认后写回 repo-profile
```

最终一句话：

> `/spec:standards` 是 spec-first 的 **Graph-backed Project Standards & Glue Compiler**。它把团队共享规范、当前项目代码事实、graph 语义索引、胶水能力地图和人工确认机制串成闭环，让 AI coding 从“临时读代码、临时猜规则”升级为“基于团队标准和项目事实的可复用工程流程”。
