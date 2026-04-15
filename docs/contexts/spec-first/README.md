# Context Console: spec-first

## Status

- Mode: Full
- Generated: 2026-04-14T14:24:00.000Z
- CRG last built: 2026-04-13T17:58:32.435Z
- Repo HEAD: aa4b9037e1d5fe7b3447dfc64ed24e7dd1a53e4d

## Artifacts

- [00-summary.md](./00-summary.md)
- [architecture/module-map.md](./architecture/module-map.md)
- [pitfalls/index.md](./pitfalls/index.md)
- [code-facts/public-entrypoints.md](./code-facts/public-entrypoints.md)
- [code-facts/test-map.md](./code-facts/test-map.md)
- [code-facts/high-risk-modules.md](./code-facts/high-risk-modules.md)
- [context-packs/review-change.md](./context-packs/review-change.md)
- [injection-index.yaml](./injection-index.yaml)

## Freshness

- 本次上下文来自本地 CRG Full 模式，图规模为 528 nodes / 1307 edges。
- 当前 unresolved edge 仍有 2055 条；若修改 parser-heavy、runtime install 或 graph traversal 代码，请结合源码读取和脚本验证，不要只依赖图谱。

## Signals

- Top communities: `crg/0`, `cli`, `skills`
- Top flows: `src/crg/cli/postprocess.js#function#run#L87`, `src/cli/index.js#function#runCli#L9`, `src/crg/commands/review-context.js#function#run#L30`
- Top hubs: `makeEnvelope`, `openDb`, `getBundledPath`
