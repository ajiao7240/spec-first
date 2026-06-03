# CONCEPTS.md Advisory Vocabulary Rules

`CONCEPTS.md` is a repo-local advisory vocabulary. It helps agents use stable names for project-specific concepts, but it is not a PRD, ADR, workflow contract, product roadmap, setup requirement, or source-of-truth override. Direct source reads, checked-in contracts, current plans, user decisions, and deterministic command results win when they conflict with it.

For `spec-compound-refresh`, vocabulary maintenance is scoped and advisory. If `CONCEPTS.md` does not already exist at the repo root, do not create or bootstrap it as part of an ordinary refresh. Record `CONCEPTS.md: not present; no vocabulary maintenance applied` in the report and, when useful, recommend an explicit separately scoped vocabulary bootstrap. A downstream project does not need this file for `spec-first` to work.

## When To Read This Reference

Read this file during the refresh when collecting vocabulary signals, before classifying the `CONCEPTS.md` result for the final report. Do not pre-judge from memory that no terms qualify.

## What Qualifies

A term qualifies when its meaning is project-specific enough that a new engineer would need it defined to follow source, plans, reviews, tickets, or future learning docs. Good candidates include named workflow concepts, artifact types, status/lifecycle concepts, domain entities, and terms that are easy to confuse with a nearby project-specific term.

Do not add general programming vocabulary, ordinary English, one-off variable names, file paths, class names, function signatures, config values, owners, dates, version-specific claims, or raw implementation details. If a term only matters because of one exact source path, refresh the learning or pattern doc instead of promoting it to vocabulary.

## How To Reconcile

1. During investigation, collect vocabulary signals centrally; do not edit `CONCEPTS.md` inside per-doc investigation.
2. If `CONCEPTS.md` exists, add missing in-scope terms and refine existing entries when refreshed docs add durable precision.
3. Union compatible shades of meaning into one entry. Do not create duplicates, do not use most-recent-wins rewrites, and do not rewrite unrelated clusters.
4. Reconcile only the scope actually investigated in this refresh. Do not turn a focused refresh into a repo-wide vocabulary sweep.
5. Scrub touched or nearby entries when they violate the advisory boundary: implementation details, source paths, current-config values, status/owner metadata, version-specific claims, or undefined project-specific sibling terms.

## Entry Shape

Use a heading for the term, then one sentence defining what it means in this project and what distinguishes it from neighbors. A second short paragraph is allowed only for non-obvious behavioral rules, lifecycle rules, or ownership invariants.

When several words refer to the same concept, pick the clearest term and record retired names as an `Avoid:` line when useful. Keep the file opinionated without making it a record of every phrase ever used.

## Discoverability

If `CONCEPTS.md` exists, check whether the substantive instruction file surfaces it. In interactive mode, ask before editing instruction files. In `mode:autofix`, report a discoverability recommendation only; do not edit instruction files because autofix scope is doc maintenance, not project configuration.
