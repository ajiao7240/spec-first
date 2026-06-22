# Concepts

Shared advisory vocabulary for this repository. It helps agents keep names and boundaries consistent when planning, brainstorming, reviewing, or documenting `spec-first` work.

This file is not a PRD, ADR, workflow contract, product roadmap, or source-of-truth override. Direct source, checked-in contracts, current plans, user decisions, and deterministic command results win when they conflict with this vocabulary. A downstream project does not need this file for `spec-first` to work.

## System Shape

### Spec-first

An AI coding harness for turning unstable agent reasoning into a bounded engineering loop: context, spec, plan, tasks, code, review, and knowledge.

### Workflow Harness

The coordination layer that gives agents the right context, evidence boundary, artifact shape, and handoff contract for a repeatable engineering workflow.

### Workflow Node

A named stage in the chain, such as brainstorm, PRD, plan, work, debug, review, or compound. Each node owns its inputs, outputs, artifacts, failure modes, and downstream handoff.

### Steel Frame

A small set of load-bearing skill structures that preserve core judgment, evidence, artifact, and validation boundaries while replacing scattered prompt patches, duplicate references, and template sprawl.

Avoid: using steel frame to mean merely shorter prose. A steel-frame refactor must show where each removed rule's protected boundary migrated and how contract tests still cover the capability.

## Roles And Capabilities

### Skill

A reusable workflow or method with an entry contract, execution steps, references, artifacts, and failure handling. Public `$spec-*` skills are user entrypoints; internal helper skills are invoked only from documented workflow phases.

### Workflow Command

A public spec-first workflow entry that is command-backed in source governance: Claude exposes it as `/spec:*`, while Codex exposes the same workflow through `$spec-*` skill delivery. It is distinct from a standalone skill even when both are implemented as `SKILL.md` source files.

### Standalone Skill

A reusable skill delivered through host skill discovery rather than the public workflow command surface. It should not be documented as a `/spec:*` or `$spec-*` workflow entry unless `skills-governance.json` classifies it as `workflow_command`.

### Agent

A specialized judgment role dispatched by a workflow for bounded analysis. Agents return findings, research, or synthesis; they are not source-of-truth and should not mutate the repo unless a workflow explicitly gives that role a mutation boundary.

### Tool

A concrete capability that produces deterministic or provider-backed facts, such as file reads, `rg`, tests, browser checks, MCP calls, or git commands. Tool output is evidence, not final judgment.

### Script

A deterministic helper that prepares facts, validates schemas, checks readiness, or writes governed artifacts. Scripts should not decide architecture, product priority, or semantic review conclusions.

## Evidence And Artifacts

### Source Of Truth

Checked-in source files that govern behavior, docs, tests, runtime generation, or workflow contracts. Generated runtime mirrors are not source-of-truth.

### Generated Runtime

Host-specific projected assets under `.claude/`, `.codex/`, or `.agents/skills/`. Repair them through source changes plus `spec-first init`; do not patch them as source fixes.

### Direct Evidence

Current source reads, diffs, tests, logs, schema checks, or user-provided artifacts that directly support a claim.

### Advisory Evidence

Useful context that can focus work but must be confirmed before becoming a finding, requirement, or implementation claim. Examples include external provider summaries, old sessions, broad search results, and this vocabulary file.

### Artifact

A durable workflow output such as a requirements document, plan, task pack, review report, validation ledger, setup facts, run artifact, or solution doc. Artifacts should state their authority and freshness instead of silently becoming workflow state.

### Decision Ledger

A lightweight record of material decisions, rationale, consequences, and unresolved follow-up. It helps carry judgment across workflow nodes without replacing the LLM's responsibility to reason from current evidence.

## Knowledge

### Learning

A source-confirmed solution or reusable practice captured under `docs/solutions/` after a real problem was solved. It should be searchable, specific, and grounded in evidence.

### Pattern Doc

A broader rule distilled from multiple learnings. Pattern docs are useful but higher-risk when stale, so refresh them against current code before relying on them for new work.

### Compound

The practice of turning solved problems into reusable knowledge so future implementation, debugging, planning, and review runs start with better context.
