'use strict';

const path = require('node:path');
const {
  ALLOWED_AGENT_KINDS,
  generateSessionId,
  getSessionDir,
  isStale,
  isValidAgentKind,
  isValidSessionId,
  listSessions,
  registerSession,
  heartbeatSession,
  unregisterSession,
} = require('../helpers/session-store');

function runSession(argv) {
  const args = [...argv];
  const sub = args.shift();

  if (!sub || sub === '--help' || sub === '-h') {
    printHelp();
    return sub ? 0 : 2;
  }

  if (sub === 'register') {
    return runRegister(args);
  }
  if (sub === 'heartbeat') {
    return runHeartbeat(args);
  }
  if (sub === 'unregister') {
    return runUnregister(args);
  }
  if (sub === 'list') {
    return runList(args);
  }

  console.error(`Unknown session subcommand: ${sub}`);
  printHelp(true);
  return 2;
}

function parseCommonFlags(args) {
  const result = { json: false, rest: [], error: '' };
  for (const arg of args) {
    if (arg === '--json') {
      result.json = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      result.help = true;
      continue;
    }
    result.rest.push(arg);
  }
  return result;
}

function takeOption(rest, flag) {
  for (let i = 0; i < rest.length; i += 1) {
    const a = rest[i];
    if (a === flag) {
      const v = rest[i + 1];
      rest.splice(i, 2);
      return v;
    }
    if (a.startsWith(`${flag}=`)) {
      const v = a.slice(flag.length + 1);
      rest.splice(i, 1);
      return v;
    }
  }
  return undefined;
}

function emit(json, payload, humanLines) {
  if (json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return;
  }
  for (const line of humanLines) {
    process.stdout.write(`${line}\n`);
  }
}

function emitErr(json, payload, humanLines) {
  if (json) {
    process.stderr.write(`${JSON.stringify(payload, null, 2)}\n`);
    return;
  }
  for (const line of humanLines) {
    process.stderr.write(`${line}\n`);
  }
}

function runRegister(args) {
  const parsed = parseCommonFlags(args);
  if (parsed.help) { printHelp(); return 0; }
  const id = takeOption(parsed.rest, '--id');
  const agentKind = takeOption(parsed.rest, '--agent-kind') || 'other';
  const scopeHint = takeOption(parsed.rest, '--scope-hint');
  const hostMarker = takeOption(parsed.rest, '--host-marker');
  const pidStr = takeOption(parsed.rest, '--pid');
  if (parsed.rest.length > 0) {
    emitErr(parsed.json, { ok: false, reason_code: 'unknown-option', unknown: parsed.rest }, [
      `Unknown options: ${parsed.rest.join(', ')}`,
    ]);
    return 2;
  }
  if (id !== undefined && !isValidSessionId(id)) {
    emitErr(parsed.json, { ok: false, reason_code: 'session-id-invalid', session_id: id }, [
      `Invalid --id: ${id}`,
    ]);
    return 2;
  }
  if (!isValidAgentKind(agentKind)) {
    emitErr(parsed.json, { ok: false, reason_code: 'agent-kind-invalid', agent_kind: agentKind }, [
      `Invalid --agent-kind: ${agentKind} (allowed: ${ALLOWED_AGENT_KINDS.join(', ')})`,
    ]);
    return 2;
  }
  const pid = pidStr === undefined ? process.ppid || process.pid : Number.parseInt(pidStr, 10);
  const repoRoot = process.cwd();
  const result = registerSession(repoRoot, {
    session_id: id || generateSessionId(),
    agent_kind: agentKind,
    scope_hint: scopeHint,
    host_marker_path: hostMarker,
    pid: Number.isFinite(pid) && pid > 0 ? pid : null,
  });
  if (!result.ok) {
    emitErr(parsed.json, result, [
      `session register failed: ${result.reason_code}`,
      result.path ? `existing record: ${path.relative(repoRoot, result.path)}` : '',
    ].filter(Boolean));
    return 1;
  }
  emit(parsed.json, { ok: true, session_id: result.session_id, path: path.relative(repoRoot, result.path), record: result.record }, [
    `session registered: ${result.session_id}`,
    `path: ${path.relative(repoRoot, result.path)}`,
  ]);
  return 0;
}

function runHeartbeat(args) {
  const parsed = parseCommonFlags(args);
  if (parsed.help) { printHelp(); return 0; }
  const id = takeOption(parsed.rest, '--id');
  if (parsed.rest.length > 0) {
    emitErr(parsed.json, { ok: false, reason_code: 'unknown-option', unknown: parsed.rest }, [
      `Unknown options: ${parsed.rest.join(', ')}`,
    ]);
    return 2;
  }
  if (!id) {
    emitErr(parsed.json, { ok: false, reason_code: 'session-id-required' }, [
      'Usage: spec-first session heartbeat --id <session-id>',
    ]);
    return 2;
  }
  const repoRoot = process.cwd();
  const result = heartbeatSession(repoRoot, id);
  if (!result.ok) {
    emitErr(parsed.json, result, [`session heartbeat failed: ${result.reason_code}`]);
    return 1;
  }
  emit(parsed.json, { ok: true, session_id: id, path: path.relative(repoRoot, result.path), record: result.record }, [
    `session heartbeat ok: ${id}`,
  ]);
  return 0;
}

function runUnregister(args) {
  const parsed = parseCommonFlags(args);
  if (parsed.help) { printHelp(); return 0; }
  const id = takeOption(parsed.rest, '--id');
  if (parsed.rest.length > 0) {
    emitErr(parsed.json, { ok: false, reason_code: 'unknown-option', unknown: parsed.rest }, [
      `Unknown options: ${parsed.rest.join(', ')}`,
    ]);
    return 2;
  }
  if (!id) {
    emitErr(parsed.json, { ok: false, reason_code: 'session-id-required' }, [
      'Usage: spec-first session unregister --id <session-id>',
    ]);
    return 2;
  }
  const repoRoot = process.cwd();
  const result = unregisterSession(repoRoot, id);
  if (!result.ok) {
    emitErr(parsed.json, result, [`session unregister failed: ${result.reason_code}`]);
    return 1;
  }
  emit(parsed.json, { ok: true, session_id: id, path: path.relative(repoRoot, result.path) }, [
    `session unregistered: ${id}`,
  ]);
  return 0;
}

function runList(args) {
  const parsed = parseCommonFlags(args);
  if (parsed.help) { printHelp(); return 0; }
  const includeStale = parsed.rest.includes('--include-stale');
  const filtered = parsed.rest.filter((a) => a !== '--include-stale');
  if (filtered.length > 0) {
    emitErr(parsed.json, { ok: false, reason_code: 'unknown-option', unknown: filtered }, [
      `Unknown options: ${filtered.join(', ')}`,
    ]);
    return 2;
  }
  const repoRoot = process.cwd();
  const sessions = listSessions(repoRoot, { includeStale });
  const payload = {
    schema_version: 'spec-first-session-list.v1',
    repo_root: repoRoot,
    session_dir: path.relative(repoRoot, getSessionDir(repoRoot)),
    include_stale: includeStale,
    active_count: sessions.filter((s) => !s.stale && !s.invalid).length,
    stale_count: sessions.filter((s) => s.stale).length,
    invalid_count: sessions.filter((s) => s.invalid).length,
    sessions,
  };
  if (parsed.json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return 0;
  }
  if (sessions.length === 0) {
    process.stdout.write(`spec-first sessions: 0 active${includeStale ? ' (incl. stale)' : ''}\n`);
    return 0;
  }
  process.stdout.write(`spec-first sessions in ${payload.session_dir}:\n`);
  for (const s of sessions) {
    if (s.invalid) {
      process.stdout.write(`  - ${s.session_id} [invalid: ${s.reason}]\n`);
      continue;
    }
    const flags = [];
    if (s.stale) flags.push('stale');
    process.stdout.write(`  - ${s.session_id} (${s.agent_kind}) started=${s.started_at} heartbeat=${s.last_heartbeat_at}${flags.length ? ` [${flags.join(',')}]` : ''}\n`);
  }
  return 0;
}

function printHelp(toErr = false) {
  const out = toErr ? process.stderr : process.stdout;
  const lines = [
    'spec-first session — opt-in advisory protocol for multi-actor worktree governance',
    '',
    'Usage:',
    '  spec-first session register   [--id <id>] [--agent-kind claude-code|codex|other] [--scope-hint <text>] [--host-marker <path>] [--pid <pid>] [--json]',
    '  spec-first session heartbeat  --id <id> [--json]',
    '  spec-first session unregister --id <id> [--json]',
    '  spec-first session list       [--json] [--include-stale]',
    '',
    'Notes:',
    '  - All session records live under .spec-first/sessions/<id>.json (gitignored).',
    '  - Records are advisory; not a hard lock. LLMs decide whether to defer or proceed.',
    '  - Records older than 24h since last heartbeat are considered stale.',
    '',
  ];
  out.write(lines.join('\n'));
}

module.exports = {
  runSession,
};
