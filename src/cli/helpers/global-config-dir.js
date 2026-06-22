'use strict';

// Single source of truth for "is this projectRoot's .codex actually the Codex global
// hook directory (CODEX_HOME)?" — the predicate that decides whether an `init` here would
// write SessionStart hooks into the location Codex reads for ALL projects, causing
// per-session double injection (global hook + project hook both fire).
//
// The pollution condition is NOT `projectRoot === os.homedir()`. Codex reads hooks from
// `$CODEX_HOME/hooks.json` (default `~/.codex`). The adapter always writes
// `<projectRoot>/.codex/hooks.json`. So the necessary-and-sufficient condition is that the
// projectRoot-derived `.codex` directory resolves to the SAME path Codex actually reads:
//   canonical(path.join(projectRoot, '.codex')) === canonical(effectiveCodexHome)
// This stays correct when CODEX_HOME is relocated via env (where a HOME-only check would
// both false-positive on ~ and miss the real polluting directory).

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// `.codex` is the project-relative runtime root the Codex adapter writes under. Kept here
// as a literal rather than imported from the adapter to avoid a require cycle (the adapter
// and init both consume this helper).
const CODEX_RUNTIME_ROOT = '.codex';

function effectiveCodexHome() {
  const fromEnv = process.env.CODEX_HOME;
  if (fromEnv && fromEnv.trim() !== '') {
    return fromEnv;
  }
  return path.join(os.homedir(), '.codex');
}

function resolveClaudeUserInstructionPath() {
  return {
    absolutePath: path.join(os.homedir(), '.claude', 'CLAUDE.md'),
    displayPath: '~/.claude/CLAUDE.md',
    basis: 'claude-user-instructions-claude-md-v1',
  };
}

// Canonicalize for comparison without requiring the path to exist: realpath the deepest
// existing ancestor, then re-append the missing tail. This makes the comparison robust to
// symlinks (e.g. /var -> /private/var on macOS) while still working before the directory
// is created.
function canonicalize(targetPath) {
  const resolved = path.resolve(targetPath);
  let existing = resolved;
  const tail = [];
  while (!fs.existsSync(existing)) {
    const parent = path.dirname(existing);
    if (parent === existing) {
      return resolved;
    }
    tail.unshift(path.basename(existing));
    existing = parent;
  }
  try {
    const realExisting = fs.realpathSync(existing);
    return tail.length > 0 ? path.join(realExisting, ...tail) : realExisting;
  } catch {
    return resolved;
  }
}

// True when an `init` at projectRoot would write its `.codex` runtime into the directory
// Codex actually reads hooks from (effectiveCodexHome). Callers use this to skip hook
// writes (init) or to detect/clean global pollution (doctor/clean).
function isCodexHomeProjectRoot(projectRoot) {
  if (!projectRoot) {
    return false;
  }
  const derivedRuntime = canonicalize(path.join(projectRoot, CODEX_RUNTIME_ROOT));
  const codexHome = canonicalize(effectiveCodexHome());
  return derivedRuntime === codexHome;
}

function samePhysicalPath(left, right) {
  if (!left || !right) {
    return false;
  }
  return canonicalize(left) === canonicalize(right);
}

module.exports = {
  CODEX_RUNTIME_ROOT,
  effectiveCodexHome,
  isCodexHomeProjectRoot,
  resolveClaudeUserInstructionPath,
  samePhysicalPath,
};
