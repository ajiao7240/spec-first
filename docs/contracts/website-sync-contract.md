# Website Sync Contract

## Purpose

`spec-first` package releases must not assume the official website has consumed the latest package facts. The website is an external consumer of this repository, not a source-of-truth directory inside this package.

This contract defines the release-time boundary between the package repo and the official website repo.

## Source Of Truth

The package repo owns these facts:

- `package.json` version, package name, bin path, and Node.js engine.
- `src/cli/contracts/dual-host-governance/skills-governance.json`.
- `templates/claude/commands/spec/*.md`.
- `skills/*/SKILL.md`.
- `agents/*.agent.md`.
- `README.md`, `README.zh-CN.md`, and `docs/05-用户手册/**`.

The website repo consumes those facts through its own generated data and content audit. The package repo must not edit website source files during package release.

## External Consumer

The expected website repo is:

```text
/Users/kuang/xiaobu/spec-first-official-website
```

Maintainers may override the path with:

```bash
SPEC_FIRST_WEBSITE_REPO=/path/to/spec-first-official-website
```

The website-side fact sync contract is:

```bash
cd "$SPEC_FIRST_WEBSITE_REPO/website"
npm run facts:sync
npm run content:audit
```

`facts:sync` is the website-owned deterministic writer. `content:audit` is the package-release gate consumed by this repo.

## Release Gate

The package release publisher must run:

```bash
npm run test:release:website
```

`test:release:website` runs `scripts/check-website-sync.cjs --required`, which:

1. Locates the website repo from `SPEC_FIRST_WEBSITE_REPO` or the default sibling path.
2. Verifies the website package exposes `facts:sync` and `content:audit`.
3. Runs `npm run content:audit` in the website package with `SPEC_FIRST_SOURCE_DIR` set to the current package repo.

If the website repo is missing, the website scripts are missing, or `content:audit` fails, package publishing must stop. This keeps the deterministic fact check in scripts while leaving stale-content interpretation and remediation to the maintainer.

## Non-Goals

- Do not vendor website source into this package repo.
- Do not make ordinary `npm run test:unit` or `npm run test:release` depend on a sibling checkout.
- Do not let package scripts rewrite website facts during publish. If facts are stale, run `npm run facts:sync` in the website repo and review the website diff there.
