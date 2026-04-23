# Review Change Context Pack

> 静态组装：risk_signals high/medium + test-surface coverage_gaps + entrypoints + integrations high-risk  
> 生成时间: 2026-04-23

## 变更审查前置信息

使用此文件时，优先关注以下维度：

---

## 1. 高风险入口（修改时需重点验证）

```
src/crg/commands/detect-changes.js#run       criticality=0.737
src/crg/cli/postprocess.js#run               criticality=0.735
src/crg/commands/review-context.js#run       criticality=0.735
src/bootstrap-compiler/compile-machine-artifacts.js#compileMachineArtifacts  criticality=0.728
src/crg/cli/context.js#run                   criticality=0.728
src/cli/index.js#runCli                      criticality=0.712
```

**验证建议**：修改上述入口时，运行完整测试链 `npm test`，尤其是 `npm run test:e2e:crg`。

---

## 2. 高 in_degree Hub 节点（破坏性修改的扩散点）

```
src/crg/cli/envelope.js#makeEnvelope          in_degree=19  ← 所有 CRG 命令输出 schema
src/context-routing/profiles.js#normalizeStage in_degree=15  ← 所有 stage 路由
src/crg/cli/open-db.js#openDb                 in_degree=14  ← 所有 SQLite 访问
src/context-routing/entry-resolver.js#normalizeAbsolutePath in_degree=10
```

**审查关注点**：这些函数的签名、返回值、行为语义变更均为破坏性变更，需要 full regression。

---

## 3. 覆盖缺口（测试未直接覆盖的关键路径）

| 符号 | severity | 说明 |
|------|----------|------|
| `src/crg/changes.js#detectChanges` | high | 在两条最高 criticality 流中均出现，无直接测试映射 |
| `src/crg/cli/envelope.js#makeEnvelope` | high | hub 节点，无直接单测 |
| `src/crg/cli/open-db.js#openDb` | medium | SQLite 入口，optional dep 容错路径未被直接测试 |

---

## 4. 集成依赖注意事项

| 依赖 | 关注点 |
|------|--------|
| `better-sqlite3` ~12.6.0 (optional) | native module 可能因 Node.js 版本不匹配失败；`bin/postinstall.js` 负责安装后检测和修复 |
| `tree-sitter` ~0.21.0 | 17 语言 grammar 版本矩阵严格锁定；升级时需全量回归 |
| `simple-git` ~3.0.0 | git CLI 依赖环境可用；Docker/CI 需确认 git binary 存在 |

---

## 5. 审查时必须确认的治理合规

- [ ] 源码变更已更新 `CHANGELOG.md`
- [ ] 修改 skill/agent 源码后 `spec-first init --claude/--codex` 已重新运行
- [ ] 涉及 skills-governance 或 plugin.json 的变更已通过 `npm run lint:skill-entrypoints`
- [ ] CRG 相关变更已通过 `npm run test:e2e:crg`
- [ ] 双宿主（Claude + Codex）路径已分别验证

---

## 6. 关键文件 SHA（用于 stale 检测）

- `package.json`: `e52b53711846bd24dfabd73802b7b2b46f8de4c25c7bbbff27cb6f4277a666ce`
- CRG last built: `2026-04-23T02:31:22.230Z`
- repo HEAD: `6adaa98cb7734fcb70a5af0eb2653b2fbc35ecdc`
