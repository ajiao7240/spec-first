# `.claude/launch.json` schema

Polish reads `.claude/launch.json` at the repo root to resolve the dev-server start command. The schema is a small launch-config subset owned by the spec-first Claude/Codex host surface.

## Top-level shape

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "<human label>",
      "runtimeExecutable": "<binary>",
      "runtimeArgs": ["<arg>", "<arg>"],
      "port": <number>,
      "cwd": "<optional, repo-relative>",
      "env": { "<key>": "<value>" }
    }
  ]
}
```

## Fields polish consumes

| Field | Required | Purpose |
|-------|----------|---------|
| `name` | yes (when multiple configurations) | Used to disambiguate when the array has more than one entry. Polish asks the user to pick by `name`. |
| `runtimeExecutable` | yes | The binary polish spawns (e.g., `bin/dev`, `npm`, `overmind`, `bun`). |
| `runtimeArgs` | no | Array of arguments passed to `runtimeExecutable`. Default: empty array. |
| `port` | yes | The port the dev server will listen on. Polish probes `http://localhost:<port>` for reachability and uses it for the IDE browser handoff. |
| `cwd` | no | Repo-relative working directory for the dev server. Default: repo root. Useful for monorepos (`apps/web`, `packages/frontend`). |
| `env` | no | Additional environment variables for the dev-server process. Default: inherit polish's environment. |

## Stub template (written on first run when user accepts)

When polish auto-detects a project type and the user confirms "Save this as `.claude/launch.json`?", polish writes a minimal stub derived from the detected type. These templates intentionally hard-code common defaults — users can edit them later.

### Rails stub

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Rails dev",
      "runtimeExecutable": "bin/dev",
      "runtimeArgs": [],
      "port": 3000
    }
  ]
}
```

### Next.js stub

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Next dev",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "port": 3000
    }
  ]
}
```

### Vite stub

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Vite dev",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "port": 5173
    }
  ]
}
```

### Procfile / Overmind stub

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Overmind dev",
      "runtimeExecutable": "overmind",
      "runtimeArgs": ["start", "-f", "Procfile.dev"],
      "port": 3000
    }
  ]
}
```

### Nuxt stub

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Nuxt dev",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "port": 3000
    }
  ]
}
```

### Astro stub

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Astro dev",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "port": 4321
    }
  ]
}
```

### Remix stub

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Remix dev",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "port": 3000
    }
  ]
}
```

### SvelteKit stub

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "SvelteKit dev",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "port": 5173
    }
  ]
}
```

## Why a subset of VS Code's schema

Polish does not use `type`, `request`, `console`, `stopOnEntry`, or any of the other VS Code fields. Including them is harmless — polish ignores them — but the stub writer never adds them. The fields polish cares about are the ones that describe *how to start a long-running dev server on a known port*, which is a smaller surface than what VS Code uses for debug-stepping.

## Host notes

`.claude/launch.json` is not a general IDE standard. Polish leads with `.claude/launch.json` because:
- Claude Code can use it directly and Codex can read it as repo-local configuration
- It sits at a clean repo-root trust boundary (user-authored, not auto-detected)

If a future Claude/Codex host standard emerges, the stub writer and reader can swap paths without touching the rest of the skill.
