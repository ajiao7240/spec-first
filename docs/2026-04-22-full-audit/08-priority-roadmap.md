# 优先级路线图

## P0：先修文档定位与治理清单

### 目标

- 防止未跟踪草案被误当成治理真源
- 把当前最关键的治理 drift 纳入审计清单

### 任务

1. `应重构`
   - 重写 `项目治理-agent.md` 的前言与定位声明
2. `应强化`
   - 加入“治理真源前提”与“文档状态声明”
3. `应强化`
   - 加入 dual-host governance checklist
4. `应强化`
   - 加入 `推断性验证 / 真实 probe 验证` 语义区分

### Done signals

- 文档明确声明自己是草案/手册
- 文档不再以现行真源口吻叙述
- dual-host / verification 关键检查项已经显式写入

## P1：修真实治理缺口

### 目标

- 收口单一真相源、freshness、入口治理、测试接线

### 任务

1. `应重构`
   - 解决 `artifact-manifest.json` 双语义
2. `应重构`
   - 停止 sample 发布 `ownership/review-queue`，或接入真实 derivation
3. `应强化`
   - 修复 `setup` / `spec-mcp-setup` route drift
4. `应强化`
   - 修复 11 个 skill 命名漂移和 docs mirror drift
5. `应重构`
   - 收回 `review-context` 的决策拼装职责
6. `应强化`
   - 接线 `tests/contracts`
7. `应强化`
   - 补 destructive rollback 故障注入测试
8. `应强化`
   - 收紧 release tarball 白名单

### Done signals

- 无同名双语义 manifest
- setup/MCP setup 入口与 route 对齐
- mirror 与 source 同步
- review-context 只输出事实层结果
- tests/contracts 进入默认测试入口

## P2：有限试点高级治理能力

### 目标

- 在不引入强编排的前提下，试点高价值能力

### 任务

1. `应实验化`
   - 可选 runnable probe
2. `应实验化`
   - 少数 workflow 的结构化 prompt metadata 守卫
3. `应实验化`
   - full-audit workflow 的半自动化入口
4. `应轻量化`
   - integration/e2e 命名与 package script 整理

### Done signals

- probe 是可选能力，不强制
- metadata 守卫未扩大到全部 workflow
- full-audit workflow 不影响普通开发流

## 不建议的路线

- 不建议把 full audit 设为所有架构判断的默认前置。
- 不建议把 prompt 正文锚点检查扩展为大范围 CLI 规则系统。
- 不建议在 P0 完成前直接把 `项目治理-agent.md` 升级为正式治理真源。
