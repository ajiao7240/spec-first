#!/usr/bin/env python3
"""Extract the conversation skeleton from a Claude Code, Codex, or Cursor JSONL session file."""

import json
import re
import sys

stats = {"lines": 0, "parse_errors": 0, "user": 0, "assistant": 0, "tool": 0}
pending_tools = []

_STRIP_BLOCK = re.compile(
    r"<(?:task-notification|local-command-caveat|local-command-stdout|local-command-stderr|system-reminder)[^>]*>.*?</(?:task-notification|local-command-caveat|local-command-stdout|local-command-stderr|system-reminder)>",
    re.DOTALL,
)
_STRIP_TAG = re.compile(r"</?(?:command-message|command-name|command-args|user_query)[^>]*>")


def clean_text(text):
    text = _STRIP_BLOCK.sub("", text)
    text = _STRIP_TAG.sub("", text)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    return text


def flush_tools():
    if not pending_tools:
        return

    groups = []
    for entry in pending_tools:
        if groups and groups[-1][0]["name"] == entry["name"]:
            groups[-1].append(entry)
        else:
            groups.append([entry])

    for group in groups:
        name = group[0]["name"]
        if len(group) <= 2:
            for entry in group:
                status = f" -> {entry['status']}" if entry.get("status") else ""
                ts_prefix = f"[{entry['ts']}] " if entry.get("ts") else ""
                print(f"{ts_prefix}[tool] {name} {entry['target']}{status}")
                stats["tool"] += 1
        else:
            ts = group[0].get("ts", "")
            targets = [entry["target"] for entry in group if entry.get("target")]
            ok = sum(1 for entry in group if entry.get("status") == "ok")
            err = sum(1 for entry in group if entry.get("status") and entry["status"] != "ok")
            no_status = len(group) - ok - err

            if len(targets) > 2:
                target_str = ", ".join(targets[:2]) + f", +{len(targets) - 2} more"
            elif targets:
                target_str = ", ".join(targets)
            else:
                target_str = ""

            if no_status == len(group):
                status_str = ""
            elif err == 0:
                status_str = " -> all ok"
            else:
                status_str = f" -> {ok} ok, {err} error"

            ts_prefix = f"[{ts}] " if ts else ""
            print(f"{ts_prefix}[tools] {len(group)}x {name} ({target_str}){status_str}")
            stats["tool"] += len(group)

    pending_tools.clear()


def summarize_claude_tool(block):
    name = block.get("name", "unknown")
    tool_input = block.get("input", {})
    target = (
        tool_input.get("file_path")
        or tool_input.get("path")
        or tool_input.get("command", "")[:120]
        or tool_input.get("pattern", "")
        or tool_input.get("query", "")[:80]
        or tool_input.get("prompt", "")[:80]
        or ""
    )
    if isinstance(target, str) and len(target) > 120:
        target = target[:120]
    return name, target


def handle_claude(obj):
    msg_type = obj.get("type")
    ts = obj.get("timestamp", "")[:19]

    if msg_type == "user":
        message = obj.get("message", {})
        content = message.get("content", "")

        if isinstance(content, list):
            for block in content:
                if block.get("type") == "tool_result":
                    is_error = block.get("is_error", False)
                    status = "error" if is_error else "ok"
                    tool_use_id = block.get("tool_use_id")
                    matched = False
                    if tool_use_id:
                        for entry in pending_tools:
                            if entry.get("id") == tool_use_id:
                                entry["status"] = status
                                matched = True
                                break
                    if not matched:
                        for entry in pending_tools:
                            if not entry.get("status"):
                                entry["status"] = status
                                break

            texts = [
                item.get("text", "")
                for item in content
                if item.get("type") == "text" and len(item.get("text", "")) > 10
            ]
            content = " ".join(texts)

        if isinstance(content, str):
            content = clean_text(content)
            if len(content) > 15:
                flush_tools()
                print(f"[{ts}] [user] {content[:800]}")
                print("---")
                stats["user"] += 1

    elif msg_type == "assistant":
        message = obj.get("message", {})
        content = message.get("content", [])
        if isinstance(content, list):
            has_text = False
            for block in content:
                if block.get("type") == "text":
                    text = clean_text(block.get("text", ""))
                    if len(text) > 20:
                        if not has_text:
                            flush_tools()
                            has_text = True
                        print(f"[{ts}] [assistant] {text[:800]}")
                        print("---")
                        stats["assistant"] += 1
                elif block.get("type") == "tool_use":
                    name, target = summarize_claude_tool(block)
                    entry = {"ts": ts, "name": name, "target": target}
                    tool_id = block.get("id")
                    if tool_id:
                        entry["id"] = tool_id
                    pending_tools.append(entry)


def handle_codex(obj):
    msg_type = obj.get("type")
    ts = obj.get("timestamp", "")[:19]

    if msg_type == "event_msg":
        payload = obj.get("payload", {})
        if payload.get("type") == "user_message":
            text = payload.get("message", "")
            if isinstance(text, str) and len(text) > 15:
                parts = text.split("</system_instruction>")
                user_text = parts[-1].strip() if parts else text
                if len(user_text) > 15:
                    flush_tools()
                    print(f"[{ts}] [user] {user_text[:800]}")
                    print("---")
                    stats["user"] += 1
        elif payload.get("type") == "exec_command_end":
            command = payload.get("command", [])
            cmd_str = command[-1] if command else ""
            output = payload.get("aggregated_output", "")

            status = "ok"
            if "Process exited with code " in output:
                try:
                    code = int(output.split("Process exited with code ")[1].split("\n")[0])
                    if code != 0:
                        status = f"error(exit {code})"
                except (IndexError, ValueError):
                    pass

            if cmd_str:
                pending_tools.append({"ts": ts, "name": "exec", "target": cmd_str[:120], "status": status})

    elif msg_type == "response_item":
        payload = obj.get("payload", {})
        if payload.get("type") == "message" and payload.get("role") == "assistant":
            for item in payload.get("content", []):
                if item.get("type") == "output_text":
                    text = clean_text(item.get("text", ""))
                    if len(text) > 20:
                        flush_tools()
                        print(f"[{ts}] [assistant] {text[:800]}")
                        print("---")
                        stats["assistant"] += 1


def handle_cursor(obj):
    role = obj.get("role")
    content = obj.get("content", [])

    if role == "user":
        text_parts = []
        if isinstance(content, list):
            for block in content:
                if block.get("type") == "text":
                    text_parts.append(block.get("text", ""))
        text = clean_text("\n".join(text_parts))
        if len(text) > 15:
            flush_tools()
            print(f"[user] {text[:800]}")
            print("---")
            stats["user"] += 1

    elif role == "assistant":
        if isinstance(content, list):
            for block in content:
                if block.get("type") == "text":
                    text = clean_text(block.get("text", ""))
                    if len(text) > 20:
                        flush_tools()
                        print(f"[assistant] {text[:800]}")
                        print("---")
                        stats["assistant"] += 1
                elif block.get("type") == "tool_use":
                    pending_tools.append({
                        "ts": "",
                        "name": block.get("name", "unknown"),
                        "target": "",
                    })


detected = None
buffer = []

for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    buffer.append(line)
    stats["lines"] += 1

    if not detected and len(buffer) <= 10:
        try:
            obj = json.loads(line)
            if obj.get("type") in ("user", "assistant"):
                detected = "claude"
            elif obj.get("type") in ("session_meta", "turn_context", "response_item", "event_msg"):
                detected = "codex"
            elif obj.get("role") in ("user", "assistant") and "type" not in obj:
                detected = "cursor"
        except (json.JSONDecodeError, KeyError):
            pass

handlers = {"claude": handle_claude, "codex": handle_codex, "cursor": handle_cursor}
handler = handlers.get(detected, lambda _obj: None)

for line in buffer:
    try:
        handler(json.loads(line))
    except (json.JSONDecodeError, KeyError):
        stats["parse_errors"] += 1

flush_tools()
print(json.dumps({"_meta": True, **stats}))
