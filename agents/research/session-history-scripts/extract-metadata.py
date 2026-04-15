#!/usr/bin/env python3
"""Extract session metadata from Claude Code, Codex, and Cursor JSONL files."""

import json
import os
import sys
from datetime import datetime, timezone

MAX_LINES = 25
TAIL_BYTES = 16384


def try_claude(lines):
    for line in lines:
        try:
            obj = json.loads(line.strip())
            if obj.get("type") == "user" and "gitBranch" in obj:
                return {
                    "platform": "claude",
                    "branch": obj["gitBranch"],
                    "ts": obj.get("timestamp", ""),
                    "session": obj.get("sessionId", ""),
                }
        except (json.JSONDecodeError, KeyError):
            pass
    return None


def try_codex(lines):
    meta = {}
    for line in lines:
        try:
            obj = json.loads(line.strip())
            if obj.get("type") == "session_meta":
                payload = obj.get("payload", {})
                meta["platform"] = "codex"
                meta["cwd"] = payload.get("cwd", "")
                meta["session"] = payload.get("id", "")
                meta["ts"] = payload.get("timestamp", obj.get("timestamp", ""))
                meta["source"] = payload.get("source", "")
                meta["cli_version"] = payload.get("cli_version", "")
            elif obj.get("type") == "turn_context":
                payload = obj.get("payload", {})
                meta["model"] = payload.get("model", "")
                meta["cwd"] = meta.get("cwd") or payload.get("cwd", "")
        except (json.JSONDecodeError, KeyError):
            pass
    return meta if meta else None


def try_cursor(lines):
    for line in lines:
        try:
            obj = json.loads(line.strip())
            if obj.get("role") in ("user", "assistant") and "type" not in obj:
                return {"platform": "cursor"}
        except (json.JSONDecodeError, KeyError):
            pass
    return None


def extract_from_lines(lines):
    return try_claude(lines) or try_codex(lines) or try_cursor(lines)


def get_last_timestamp(filepath, size):
    try:
        with open(filepath, "rb") as handle:
            handle.seek(max(0, size - TAIL_BYTES))
            tail = handle.read().decode("utf-8", errors="ignore")
            lines = tail.strip().split("\n")
        for line in reversed(lines):
            try:
                obj = json.loads(line.strip())
                if "timestamp" in obj:
                    return obj["timestamp"]
            except (json.JSONDecodeError, KeyError):
                pass
    except (OSError, IOError):
        pass
    return None


def process_file(filepath):
    try:
        size = os.path.getsize(filepath)
        with open(filepath, "r", encoding="utf-8") as handle:
            lines = []
            for index, line in enumerate(handle):
                if index >= MAX_LINES:
                    break
                lines.append(line)
        result = extract_from_lines(lines)
        if result:
            result["file"] = filepath
            result["size"] = size
            if result["platform"] == "cursor":
                mtime = os.path.getmtime(filepath)
                result["ts"] = datetime.fromtimestamp(mtime, tz=timezone.utc).isoformat()
                result["session"] = os.path.basename(os.path.dirname(filepath))
            else:
                last_ts = get_last_timestamp(filepath, size)
                if last_ts:
                    result["last_ts"] = last_ts
            return result, None
        return None, filepath
    except (OSError, IOError):
        return None, filepath


files = []
cwd_filter = None
args = sys.argv[1:]
index = 0
while index < len(args):
    if args[index] == "--cwd-filter" and index + 1 < len(args):
        cwd_filter = args[index + 1]
        index += 2
    elif not args[index].startswith("-"):
        files.append(args[index])
        index += 1
    else:
        index += 1

if files:
    processed = 0
    parse_errors = 0
    filtered = 0
    for filepath in files:
        if not filepath.endswith(".jsonl"):
            continue
        result, error = process_file(filepath)
        processed += 1
        if result:
            if cwd_filter and result.get("cwd") and cwd_filter not in result["cwd"]:
                filtered += 1
                continue
            print(json.dumps(result))
        elif error:
            parse_errors += 1

    meta = {"_meta": True, "files_processed": processed, "parse_errors": parse_errors}
    if filtered:
        meta["filtered_by_cwd"] = filtered
    print(json.dumps(meta))
else:
    if sys.stdin.isatty():
        lines = []
    else:
        lines = list(sys.stdin)

    if not lines:
        print(json.dumps({"_meta": True, "files_processed": 0, "parse_errors": 0}))
    else:
        result = extract_from_lines(lines)
        if result:
            print(json.dumps(result))
        print(json.dumps({"_meta": True, "files_processed": 1, "parse_errors": 0 if result else 1}))
