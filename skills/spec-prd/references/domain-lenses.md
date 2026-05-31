# Domain Lenses

Load this reference when selecting surface-specific PRD checks or project-local industry overlays.

## Layering Model

Start with the generic core skeleton from `prd-output-template.md`, then add one or more surface lenses. When a concrete template is needed, read the packaged template set under `templates/standard/` first. Finally, detect project-local industry/team overlays by reading local template/docs references when they exist.

The generic skeleton, surface lens mechanism, and standard PRD templates are bundled with the workflow. Project-local overlay docs may add or override industry/team detail by reference. Missing local overlay docs are a graceful absence, not an error and not permission to invent industry rules.

## Surface Lenses

| Surface | Add these product questions |
| --- | --- |
| App | entry point, navigation, state, copy, loading/empty/error, permissions, release/gray rollout, accessibility, i18n, risk or confirmation steps |
| H5/PC | routes, form behavior, browser back/refresh, responsive viewports, login/session state, sharing/SEO if relevant |
| Admin | menu placement, roles/permissions, list/search/filter/export, form validation, review flow, audit trail, bulk action, four-eyes/maker-checker when relevant |
| Backend/Java | product-level state semantics, idempotency expectations, compatibility, transaction-visible outcomes, error semantics, observability expectations, operational readiness |
| CLI/DevTool | command entry, arguments/config, dry-run or preview-first behavior, logs, cross-platform behavior, failure recovery, upgrade/migration path |
| Mixed | source-of-truth, cross-surface consistency, contract expectation, async sync, degradation, end-to-end acceptance, ownership boundary |

## Packaged Template Relationship

The packaged runtime standard template library lives under `templates/standard/` so installed workflow assets can load templates without this repository's `docs/` tree:

- `00-通用增量需求模板.md` informs the core and conditional section skeleton.
- `10-App客户端需求模板.md`, `20-Admin中后台需求模板.md`, and `30-Backend中台服务需求模板.md` inform App/Admin/Backend lens questions.

In this repository, `docs/需求文档模版/标准模版/` remains the human-facing mirror, design reference, and project-local overlay example. Do not make packaged runtime behavior depend on that `docs/` path.

## Project-Local Overlay Detection

When a project has local templates, standards, glossary, compliance docs, or industry appendices:

1. Read only the relevant section.
2. Treat it as a project-local overlay.
3. Record which overlay was applied.
4. Ask for confirmation when the overlay suggests legal, compliance, money movement, privacy, or safety implications.

Do not treat template industry facts as confirmed project rules. The template asks what must be confirmed; it does not provide legal, compliance, exchange, clearing, or product-policy truth by itself.
