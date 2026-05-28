# spec-graph-bootstrap Flow Bridge

> Lifecycle: historical-input. This bridge records an older graph-bootstrap reading model. Current graph/provider behavior is owned by `spec-mcp-setup`, `spec-graph-bootstrap`, `.spec-first/config/*`, `.spec-first/graph/*`, `.spec-first/impact/*`, and `skills/spec-graph-bootstrap/scripts/bootstrap-providers.*`.

> Current boundary: 下游 workflow 应读取 canonical readiness artifacts, including `.spec-first/graph/graph-facts.json`, `.spec-first/graph/provider-status.json`, `.spec-first/impact/bootstrap-impact-capabilities.json`, and workspace summaries when running in multi-repo mode.

## Purpose

This document preserves the migration context from the earlier CRG bridge toward the current external graph-provider readiness model. It is useful when a search result mentions `src/crg`, `spec-first crg`, `graph.db`, or CRG Stage-0, but it must not be treated as current implementation truth.

## Current Reading Path

1. Run or inspect `spec-mcp-setup` readiness facts for dependency and provider projection.
2. Run or inspect `spec-graph-bootstrap` canonical graph facts for provider freshness, limitations, and query readiness.
3. Consume canonical artifacts from downstream workflows instead of provider internals.
4. If evidence is stale, dirty, partial, or definitions-only, disclose the limitation and fall back to bounded source reads.

## Historical Notes

The old bridge assumed a local CRG control plane and SQLite graph artifacts. The current architecture keeps provider internals behind readiness artifacts and lets LLM workflows decide how much graph evidence is sufficient for the task.
