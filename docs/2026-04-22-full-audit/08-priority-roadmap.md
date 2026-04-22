# 08 Priority Roadmap

## P0

### 1. 收口共享枢纽复杂度
- 重构 `src/cli/commands/init.js`
- 重构 `src/bootstrap-compiler/workspace-compiler.js`
- 重构 `src/crg/cli/build.js`
- 重构 `src/crg/commands/review-context.js`
- 为 `src/crg/graph.js#resolveEdges` 增加更明确阶段边界

**为什么是 P0**：这是当前最主要的结构性风险源，直接影响后续一切演化成本。代码依据包括：`src/cli/commands/init.js:72-303`、`src/crg/cli/build.js:180-340`、`src/crg/commands/review-context.js:41-305`、`src/crg/graph.js:142-360`。

### 2. 发布失败恢复收口
- 重构 `scripts/release-publish.cjs`
- 增加 release failure tests

**为什么是 P0**：这是当前工程闭环最明显的缺口。依据来自已读发布链路与工程审计：脚本当前先修改 version，再执行 `test:release -> npm pack -> npm publish`，失败后可能停在半收口状态。

### 3. 明确默认主路径
- 收口对外叙事：默认主路径是什么，哪些是高级/实验能力

**为什么是 P0**：防止平台身份继续膨胀，影响 adoption。

## P1

### 1. 强化故障路径验证
- postinstall repair branch tests
- bootstrap rollback failure tests
- workspace prune failure tests

依据：`bin/postinstall.js` 存在多阶段修复链；`src/bootstrap-compiler/run-bootstrap.js` 设计了 rollback 与 `prunedChildSlugs/failedPrunes`；但当前测试证据更强地覆盖了主路径而非故障注入路径。

### 2. 收口 source / mirror / runtime / sample 的同步面
- 识别可移除的重复投影
- 识别必须保留的真源与镜像

依据：`src/cli/plugin.js:111-335`、`src/cli/adapters/claude.js:52-177`、`src/cli/adapters/codex.js:80-236` 与 `docs/contexts/spec-first/` 的样本化角色共同表明，当前 source / mirror / runtime / sample 已形成显著同步面。

### 3. 强化 evidence-to-verdict 可回指
- diagnostics / run artifact / review artifact 补最小索引

## P2

### 1. 实验 handoff payload policy
- 定义最小必要上下文传递规则

### 2. 实验 invalidation exposure
- 暴露哪些 context/plan/evidence 已失效，而非自动重算

### 3. 实验 run trace 轻量索引
- 仅做索引与回指，不做 tracing platform

## 长期观察项

- verification summary / dispatch / gate state 是否重新耦合为超级 gate
- workspace/topology/gate 功能是否超过真实 adoption 需求
- `CLAUDE.md` 是否继续膨胀为认知黑洞
- 文档/镜像/样本同步成本是否持续上升

## 路线图总原则

1. 优先提升输入质量，而不是增加流程控制
2. 优先降低共享枢纽复杂度，而不是增加新层次
3. 优先显式化失败原因与失效信号，而不是增加自动编排
4. 优先保留 LLM 决策空间，而不是强化中心 orchestration
