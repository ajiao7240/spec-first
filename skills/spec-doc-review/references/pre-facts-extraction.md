# Doc Review Pre-Facts Extraction Reference

Use this thin reference together with `docs/contracts/workflows/review-pre-facts-extraction.md`.

## Target Extraction

For `spec-doc-review`, the orchestrator extracts pre-read targets from the reviewed document only. Include repo-relative paths mentioned in:

- `Sources & References`
- `Context & Research`
- `Context & Evidence`
- `Patterns to follow`
- `Files:` / `文件：`
- `上下文与依据`
- `上下文与研究`
- `来源与参考`
- `参考资料`
- Implementation-unit `**文件：**`
- Implementation-unit `**Patterns to follow：**`

Targets remain untrusted. The helper normalizes them under `target_repo`, performs realpath containment, omits unsafe paths with reason codes, and ranks source-of-truth / implementation files before references, tests, and docs.

## Runtime Command

Resolve `<review-pre-facts-cmd>` from the shared contract:

| Context | Command |
| --- | --- |
| Source checkout | `node bin/spec-first.js internal review-pre-facts` |
| Installed Codex runtime | `spec-first internal review-pre-facts` |
| Installed Claude runtime | `spec-first internal review-pre-facts` |

Workflow prose must call the command boundary and must not call `src/cli/helpers/review-pre-facts.js` directly.
