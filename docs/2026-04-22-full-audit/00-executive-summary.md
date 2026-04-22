# 执行摘要

## 事实层

- 强制基线 `docs/10-prompt/项目角色.md` 已明确要求：
  - `Light contract`
  - `Explicit boundaries`
  - `Let the LLM decide`
- 被审文档 `docs/10-prompt/项目治理-agent.md` 当前是 `git` 未跟踪文件，不是已提交治理真源。
- 仓库主代码面分为：
  - `src/cli`：包级 CLI、双宿主资产同步与治理注入
  - `src/bootstrap-compiler` + `src/context-routing`：Stage-0 / control-plane / verification read model
  - `src/crg`：代码图谱、检索、分析与 CRG CLI
  - `skills/` + `agents/`：workflow 资产真源
  - `tests/`：多层验证
- 实测 `npm test` 通过，说明当前仓库不是“只靠文档自证”的状态。

## 判断层

- 该文档的方向是对的，但定位是不对的。
- 它适合作为“完整审计作战手册 / 候选治理草案”，不适合作为“现行治理真源”直接生效。
- 当前仓库的主要问题是“落地细节比文档理想化程度低”，而不是哲学方向跑偏。

## 最重要的 7 个结论

1. `应保留`
   - 文档继承了 `项目角色.md` 的核心哲学，且仓库不少关键实现与之相符：薄 CLI、advisory contract、selection subject、facts-first verification、CRG 输入增强、marker-based 注入。

2. `应重构`
   - 文档必须先改写定位，明确自己是草案或操作手册，而不是现行治理 contract。

3. `应强化`
   - dual-host governance 审计清单必须补进文档：
     - `setup` 的 Codex 入口 drift
     - `using-spec-first` 对 `spec-mcp-setup` 的错误路由
     - skill 命名一致性
     - docs mirror drift
     - agent reachability

4. `应强化`
   - 单一真相源与 freshness 审计清单必须补进文档：
     - `artifact-manifest.json` 双语义
     - `ownership/review-queue` sample 发布
     - `workspace-readiness-summary` 时效失真
     - sample/live drift

5. `应重构`
   - `review-context` 当前已从 CRG 事实层越界到 review/workflow 决策拼装层，应回收边界。

6. `应强化`
   - 文档对“关键链路可验证”的表述过强；当前 `doctor.workflow_runnability=verified` 仍是推断，不是宿主真实 probe。

7. `应实验化`
   - 全量多 Agent full audit 不应直接制度化为所有审计的默认流程，应该先作为高成本、高价值场景的实验流程。

## 高优先级路线

### P0

- 重写 `项目治理-agent.md` 的定位声明
- 加入治理真源前提
- 加入 dual-host governance checklist
- 区分 `推断性验证` 与 `真实 probe 验证`

### P1

- 加入 single-source-of-truth / freshness / mirror drift / review-context 越界检查项
- 修复现有高风险治理 drift
- 补 tests/contracts 接线与 rollback 故障注入测试

### P2

- 仅在 P0/P1 稳定后，再试点 full-audit workflow、runnable probe、少数 workflow 的语义守卫

## 结论

本次审计不建议立即把 `项目治理-agent.md` 作为正式基线提交生效。更稳妥的做法是：先按本审计产出的 `P0` 和 `P1` 项完成重写与校正，再决定是否升级为正式治理文档。
