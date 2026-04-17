---
name: update-workflow
description: |
  Check whether the installed spec-first CLI and the current project's managed runtime are up to date,
  then repair managed runtime drift when needed. Use when the user says "update spec-first",
  "check spec-first version", "spec update", "is spec-first up to date", or reports problems
  that might stem from an outdated CLI or stale managed runtime under .claude/ or .codex/.
disable-model-invocation: true
argument-hint: "[check|repair]"
---

# Check & Repair Spec-First Runtime

Verify the installed `spec-first` CLI version, compare it with the latest npm release,
and check whether the current project's managed runtime state is in sync for Claude and Codex.

This workflow is intentionally broader than upstream `ce-update`:

- `spec-first` is distributed as an npm CLI, not a Claude marketplace plugin
- runtime drift happens per project under `.claude/spec-first/` and `.codex/spec-first/`
- the right repair action is usually `spec-first init --claude|--codex`, not cache deletion

## Pre-resolved context

**Current CLI version:**
!`current=""; if command -v spec-first >/dev/null 2>&1; then current=$(spec-first --version 2>/dev/null | sed -n 's/.*Spec-First v\([0-9][0-9A-Za-z.+-]*\).*/\1/p' | head -1); fi; if [ -z "$current" ]; then repo=$(git rev-parse --show-toplevel 2>/dev/null || true); if [ -n "$repo" ] && [ -f "$repo/bin/spec-first.js" ] && [ -f "$repo/package.json" ] && node -e 'const fs=require("fs");const p=process.argv[1];try{const pkg=JSON.parse(fs.readFileSync(p,"utf8"));process.exit(pkg&&pkg.name==="spec-first"?0:1);}catch(_error){process.exit(1);}' "$repo/package.json"; then current=$(node "$repo/bin/spec-first.js" --version 2>/dev/null | sed -n 's/.*Spec-First v\([0-9][0-9A-Za-z.+-]*\).*/\1/p' | head -1); fi; fi; if [ -n "$current" ]; then echo "$current"; else echo '__SPEC_UPDATE_CURRENT_FAILED__'; fi`

**Latest released version:**
!`npm view spec-first version 2>/dev/null || echo '__SPEC_UPDATE_LATEST_FAILED__'`

**Repo root:**
!`git rev-parse --show-toplevel 2>/dev/null || echo '__SPEC_UPDATE_NO_REPO__'`

**Claude runtime state:**
!`repo=$(git rev-parse --show-toplevel 2>/dev/null || true); if [ -z "$repo" ]; then echo '__SPEC_UPDATE_NO_REPO__'; else if [ ! -d "$repo/.claude/spec-first" ]; then echo '{"status":"not-installed"}'; elif [ ! -f "$repo/.claude/spec-first/state.json" ]; then echo '{"status":"partial"}'; else node -e 'const fs=require("fs");const p=process.argv[1];try{const raw=JSON.parse(fs.readFileSync(p,"utf8"));const req=["commands","skills","workflowSkills","agents","agentSupportFiles"];const legacy=req.some((key)=>!Array.isArray(raw[key]));if(typeof raw.manifestVersion!=="string"||raw.manifestVersion.length===0){console.log(JSON.stringify({status:legacy?"legacy":"invalid"}));}else if(legacy){console.log(JSON.stringify({status:"legacy",recorded:raw.manifestVersion}));}else{console.log(JSON.stringify({status:"ok",recorded:raw.manifestVersion}));}}catch(_error){console.log(JSON.stringify({status:"invalid"}));}' "$repo/.claude/spec-first/state.json"; fi; fi`

**Codex runtime state:**
!`repo=$(git rev-parse --show-toplevel 2>/dev/null || true); if [ -z "$repo" ]; then echo '__SPEC_UPDATE_NO_REPO__'; else if [ ! -d "$repo/.codex/spec-first" ]; then echo '{"status":"not-installed"}'; elif [ ! -f "$repo/.codex/spec-first/state.json" ]; then echo '{"status":"partial"}'; else node -e 'const fs=require("fs");const p=process.argv[1];try{const raw=JSON.parse(fs.readFileSync(p,"utf8"));const req=["commands","skills","workflowSkills","agents","agentSupportFiles"];const legacy=req.some((key)=>!Array.isArray(raw[key]));if(typeof raw.manifestVersion!=="string"||raw.manifestVersion.length===0){console.log(JSON.stringify({status:legacy?"legacy":"invalid"}));}else if(legacy){console.log(JSON.stringify({status:"legacy",recorded:raw.manifestVersion}));}else{console.log(JSON.stringify({status:"ok",recorded:raw.manifestVersion}));}}catch(_error){console.log(JSON.stringify({status:"invalid"}));}' "$repo/.codex/spec-first/state.json"; fi; fi`

## Decision logic

### 1. CLI availability gate

If **Current CLI version** contains `__SPEC_UPDATE_CURRENT_FAILED__` or is empty:

- Tell the user that both PATH-based CLI inspection and repo-local source checkout inspection failed, so the current `spec-first` CLI could not be inspected.
- If they expected this repo to be a repo-local source checkout of `spec-first`, tell them to verify `node bin/spec-first.js --version` still works from the repo root.
- Otherwise, recommend reinstalling the CLI first:

```bash
npm install -g spec-first@latest
```

Stop here.

If the repo-local source checkout fallback succeeded:

- Treat that version as authoritative for the current repo-local source checkout.
- Continue with the latest release comparison and runtime drift checks below.

### 2. Latest release check

If **Latest released version** contains `__SPEC_UPDATE_LATEST_FAILED__`:

- Tell the user the latest npm release could not be fetched.
- Continue with project runtime inspection below; the runtime drift check still provides value.

If both versions are available:

- If `current == latest`, tell the user the installed CLI is current.
- If `current != latest`, tell the user the CLI is outdated and recommend:

```bash
npm install -g spec-first@latest
```

### 3. Project scope gate

If **Repo root** contains `__SPEC_UPDATE_NO_REPO__`:

- Tell the user there is no git repo context, so only the CLI version check was possible.
- Do not attempt project runtime repair.
- Stop here.

### 4. Runtime repair matrix

Inspect **Claude runtime state** and **Codex runtime state** independently.

#### Status: `not-installed`

- No managed runtime is installed for that host in this repo.
- Tell the user nothing is broken for that host; initialize it only if they want that host:

```bash
spec-first init --claude
```

or

```bash
spec-first init --codex
```

#### Status: `ok`

- Compare the recorded version with **Current CLI version**.
- If they match, tell the user that host runtime is in sync.
- If they differ, the runtime is stale. Recommend:

```bash
spec-first init --claude
```

or

```bash
spec-first init --codex
```

#### Status: `legacy`

- The repo still has a legacy managed state shape.
- Recommend re-running init for that host. This performs the supported managed reset path:

```bash
spec-first init --claude
```

or

```bash
spec-first init --codex
```

#### Status: `partial` or `invalid`

- The runtime is present but incomplete or unreadable.
- Recommend a clean rebuild for that host:

```bash
spec-first clean --claude
spec-first init --claude
```

or

```bash
spec-first clean --codex
spec-first init --codex
```

### 5. Verification

After any repair action, recommend:

```bash
spec-first doctor
```

Use the `doctor` output as the final confirmation that CLI version, managed state, and runtime assets are back in sync.
