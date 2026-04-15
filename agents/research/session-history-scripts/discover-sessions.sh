#!/usr/bin/env bash
# Discover session files across Claude Code, Codex, and Cursor.
#
# Usage: discover-sessions.sh <repo-name> <days> [--platform claude|codex|cursor]
#
# Outputs one file path per line. Safe in both bash and zsh (all globs guarded).

set -euo pipefail

REPO_NAME="${1:?Usage: discover-sessions.sh <repo-name> <days> [--platform claude|codex|cursor]}"
DAYS="${2:?Usage: discover-sessions.sh <repo-name> <days> [--platform claude|codex|cursor]}"
PLATFORM="${4:-all}"

shift 2
while [ $# -gt 0 ]; do
    case "$1" in
        --platform) PLATFORM="$2"; shift 2 ;;
        *) shift ;;
    esac
done

discover_claude() {
    local base="$HOME/.claude/projects"
    [ -d "$base" ] || return 0

    for dir in "$base"/*"$REPO_NAME"*/; do
        [ -d "$dir" ] || continue
        find "$dir" -maxdepth 1 -name "*.jsonl" -mtime "-${DAYS}" 2>/dev/null
    done
}

discover_codex() {
    for base in "$HOME/.codex/sessions" "$HOME/.agents/sessions"; do
        [ -d "$base" ] || continue
        find "$base" -name "*.jsonl" -mtime "-${DAYS}" 2>/dev/null
    done
}

discover_cursor() {
    local base="$HOME/.cursor/projects"
    [ -d "$base" ] || return 0

    for dir in "$base"/*"$REPO_NAME"*/; do
        [ -d "$dir" ] || continue
        local transcripts="$dir/agent-transcripts"
        [ -d "$transcripts" ] || continue
        find "$transcripts" -name "*.jsonl" -mtime "-${DAYS}" 2>/dev/null
    done
}

case "$PLATFORM" in
    claude)  discover_claude ;;
    codex)   discover_codex ;;
    cursor)  discover_cursor ;;
    all)
        discover_claude
        discover_codex
        discover_cursor
        ;;
    *)
        echo "Unknown platform: $PLATFORM" >&2
        exit 1
        ;;
esac
