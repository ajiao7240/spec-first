'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { validateAgainstSchema } = require('../../src/contracts/schema-validator');
const {
  ALLOWED_AGENT_KINDS,
  SCHEMA_VERSION,
  SESSION_DIR_REL,
  STALE_MS,
  generateSessionId,
  getSessionDir,
  getSessionFile,
  getSchema,
  isStale,
  isValidAgentKind,
  isValidSessionId,
  listSessions,
  registerSession,
  heartbeatSession,
  unregisterSession,
  validateAdvisoryFields,
} = require('../../src/cli/helpers/session-store');

function makeRepoRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'sf-session-'));
}

describe('spec-first-session.v1 schema and helper contract', () => {
  test('schema_version constant matches helper export', () => {
    expect(SCHEMA_VERSION).toBe('spec-first-session.v1');
    const schema = getSchema();
    expect(schema.properties.schema_version.const).toBe('spec-first-session.v1');
    expect(schema.required).toEqual(expect.arrayContaining([
      'schema_version',
      'session_id',
      'agent_kind',
      'started_at',
      'last_heartbeat_at',
    ]));
  });

  test('agent kinds are bounded to documented set', () => {
    expect(new Set(ALLOWED_AGENT_KINDS)).toEqual(new Set(['claude-code', 'codex', 'other']));
    const schema = getSchema();
    expect(new Set(schema.properties.agent_kind.enum)).toEqual(new Set(ALLOWED_AGENT_KINDS));
  });

  test('schema enforces nullable field constraints when values are non-null', () => {
    const record = {
      schema_version: 'spec-first-session.v1',
      session_id: 'session-1',
      agent_kind: 'codex',
      started_at: '2026-05-14T12:00:00Z',
      last_heartbeat_at: '2026-05-14T12:00:01Z',
      host_marker_path: null,
      scope_hint: null,
      pid: null,
    };

    expect(validateAgainstSchema(getSchema(), record).errors).toEqual([]);
    expect(validateAgainstSchema(getSchema(), {
      ...record,
      host_marker_path: 'x'.repeat(1025),
      scope_hint: 'x'.repeat(513),
      pid: 0,
    }).errors).toEqual(expect.arrayContaining([
      'root.host_marker_path: expected string length at most 1024, received 1025',
      'root.scope_hint: expected string length at most 512, received 513',
      'root.pid: expected number >= 1, received 0',
    ]));
    expect(validateAgainstSchema(getSchema(), {
      ...record,
      pid: 4294967296,
    }).errors).toContain('root.pid: expected number <= 4294967295, received 4294967296');
    expect(validateAgainstSchema(getSchema(), {
      ...record,
      host_marker_path: '/tmp/host.json',
      scope_hint: '../escape',
    }).errors).toEqual(expect.arrayContaining([
      expect.stringContaining('root.host_marker_path: value'),
      expect.stringContaining('root.scope_hint: value'),
    ]));
  });

  test('SESSION_DIR_REL points at .spec-first/sessions', () => {
    expect(SESSION_DIR_REL).toBe(path.join('.spec-first', 'sessions'));
  });

  test('STALE_MS is exactly 24h', () => {
    expect(STALE_MS).toBe(24 * 60 * 60 * 1000);
  });

  test('isValidSessionId rejects forbidden chars and length', () => {
    expect(isValidSessionId('abc-123')).toBe(true);
    expect(isValidSessionId('A.B_C-1')).toBe(true);
    expect(isValidSessionId('')).toBe(false);
    expect(isValidSessionId('has space')).toBe(false);
    expect(isValidSessionId('has/slash')).toBe(false);
    expect(isValidSessionId('a'.repeat(129))).toBe(false);
  });

  test('isValidAgentKind matches enum', () => {
    expect(isValidAgentKind('claude-code')).toBe(true);
    expect(isValidAgentKind('codex')).toBe(true);
    expect(isValidAgentKind('other')).toBe(true);
    expect(isValidAgentKind('claude')).toBe(false);
    expect(isValidAgentKind('')).toBe(false);
  });
});

describe('register / heartbeat / unregister roundtrip', () => {
  let repoRoot;

  beforeEach(() => {
    repoRoot = makeRepoRoot();
  });

  afterEach(() => {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  });

  test('register creates a schema-valid file and is idempotent against duplicates', () => {
    const id = generateSessionId();
    const r1 = registerSession(repoRoot, { session_id: id, agent_kind: 'claude-code', scope_hint: 'task-A' });
    expect(r1.ok).toBe(true);
    const filePath = getSessionFile(repoRoot, id);
    expect(fs.existsSync(filePath)).toBe(true);
    const record = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    expect(validateAgainstSchema(getSchema(), record).valid).toBe(true);
    expect(record.scope_hint).toBe('task-A');
    expect(record.agent_kind).toBe('claude-code');

    const r2 = registerSession(repoRoot, { session_id: id, agent_kind: 'claude-code' });
    expect(r2.ok).toBe(false);
    expect(r2.reason_code).toBe('session-already-registered');
  });

  test('register rejects invalid id and invalid agent kind', () => {
    expect(registerSession(repoRoot, { session_id: 'has space', agent_kind: 'claude-code' }).reason_code)
      .toBe('session-id-invalid');
    expect(registerSession(repoRoot, { session_id: generateSessionId(), agent_kind: 'bogus' }).reason_code)
      .toBe('agent-kind-invalid');
  });

  test('register rejects unsafe advisory fields before writing a session file', () => {
    for (const hostMarkerPath of ['/tmp/host.json', '../host.json', './host.json', 'C:/host.json', 'dir\\host.json']) {
      const result = registerSession(repoRoot, {
        session_id: generateSessionId(),
        agent_kind: 'codex',
        host_marker_path: hostMarkerPath,
      });
      expect(result.ok).toBe(false);
      expect(result.reason_code).toBe('session-field-invalid');
    }

    for (const scopeHint of ['/tmp/work', 'C:/tmp/work', '../work', 'work\\item', 'work\u0000item']) {
      const result = registerSession(repoRoot, {
        session_id: generateSessionId(),
        agent_kind: 'codex',
        scope_hint: scopeHint,
      });
      expect(result.ok).toBe(false);
      expect(result.reason_code).toBe('session-field-invalid');
    }

    expect(validateAdvisoryFields({
      host_marker_path: '.codex/spec-first/host-setup.json',
      scope_hint: 'TASK-123 current review',
    })).toMatchObject({
      ok: true,
      fields: {
        host_marker_path: '.codex/spec-first/host-setup.json',
        scope_hint: 'TASK-123 current review',
      },
    });
  });

  test('register, list, heartbeat, and unregister reject session store symlink escapes', () => {
    const outside = makeRepoRoot();
    try {
      fs.symlinkSync(outside, path.join(repoRoot, '.spec-first'), 'dir');
    } catch (_error) {
      fs.rmSync(outside, { recursive: true, force: true });
      return;
    }

    const id = generateSessionId();
    const register = registerSession(repoRoot, { session_id: id, agent_kind: 'codex' });
    expect(register.ok).toBe(false);
    expect(register.reason_code).toBe('session-path-escape');
    expect(fs.existsSync(path.join(outside, 'sessions'))).toBe(false);

    const list = listSessions(repoRoot, { includeStale: true });
    expect(list).toEqual([
      expect.objectContaining({
        invalid: true,
        reason: 'session-path-escape',
      }),
    ]);

    expect(heartbeatSession(repoRoot, id).reason_code).toBe('session-path-escape');
    expect(unregisterSession(repoRoot, id).reason_code).toBe('session-path-escape');
    fs.rmSync(outside, { recursive: true, force: true });
  });

  test('heartbeat updates last_heartbeat_at and preserves started_at', async () => {
    const id = generateSessionId();
    const reg = registerSession(repoRoot, { session_id: id, agent_kind: 'codex' });
    expect(reg.ok).toBe(true);
    const before = JSON.parse(fs.readFileSync(reg.path, 'utf8'));

    await new Promise((r) => setTimeout(r, 10));
    const hb = heartbeatSession(repoRoot, id);
    expect(hb.ok).toBe(true);
    const after = JSON.parse(fs.readFileSync(reg.path, 'utf8'));
    expect(after.started_at).toBe(before.started_at);
    expect(after.last_heartbeat_at >= before.last_heartbeat_at).toBe(true);
    expect(validateAgainstSchema(getSchema(), after).valid).toBe(true);
  });

  test('heartbeat on missing session returns session-not-found', () => {
    const result = heartbeatSession(repoRoot, generateSessionId());
    expect(result.ok).toBe(false);
    expect(result.reason_code).toBe('session-not-found');
  });

  test('unregister removes file; calling twice yields session-not-found', () => {
    const id = generateSessionId();
    registerSession(repoRoot, { session_id: id, agent_kind: 'other' });
    const filePath = getSessionFile(repoRoot, id);
    expect(fs.existsSync(filePath)).toBe(true);
    expect(unregisterSession(repoRoot, id).ok).toBe(true);
    expect(fs.existsSync(filePath)).toBe(false);
    expect(unregisterSession(repoRoot, id).reason_code).toBe('session-not-found');
  });
});

describe('list and stale handling', () => {
  let repoRoot;

  beforeEach(() => {
    repoRoot = makeRepoRoot();
  });

  afterEach(() => {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  });

  test('list on empty sessions dir returns empty array', () => {
    expect(listSessions(repoRoot)).toEqual([]);
  });

  test('list returns active sessions sorted by started_at ascending', () => {
    const a = generateSessionId();
    const b = generateSessionId();
    registerSession(repoRoot, { session_id: a, agent_kind: 'claude-code' });
    // 让 b 的 started_at 严格晚于 a
    const wait = () => new Promise((r) => setTimeout(r, 10));
    return wait().then(() => {
      registerSession(repoRoot, { session_id: b, agent_kind: 'codex' });
      const list = listSessions(repoRoot);
      expect(list).toHaveLength(2);
      expect(list[0].session_id).toBe(a);
      expect(list[1].session_id).toBe(b);
      expect(list[0].stale).toBe(false);
    });
  });

  test('stale records are hidden by default and shown with includeStale', () => {
    const id = generateSessionId();
    registerSession(repoRoot, { session_id: id, agent_kind: 'other' });
    const file = getSessionFile(repoRoot, id);
    const record = JSON.parse(fs.readFileSync(file, 'utf8'));
    record.last_heartbeat_at = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);

    expect(listSessions(repoRoot)).toHaveLength(0);
    const withStale = listSessions(repoRoot, { includeStale: true });
    expect(withStale).toHaveLength(1);
    expect(withStale[0].stale).toBe(true);
  });

  test('isStale boundary at exactly 24h', () => {
    const now = Date.parse('2026-05-14T12:00:00Z');
    const within = { last_heartbeat_at: '2026-05-13T12:00:01Z' };
    const exact = { last_heartbeat_at: '2026-05-13T12:00:00Z' };
    const beyond = { last_heartbeat_at: '2026-05-13T11:59:59Z' };
    expect(isStale(within, now)).toBe(false);
    expect(isStale(exact, now)).toBe(false);
    expect(isStale(beyond, now)).toBe(true);
  });

  test('list flags schema-invalid records without crashing', () => {
    const dir = getSessionDir(repoRoot);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'broken.json'), '{ not json');
    fs.writeFileSync(path.join(dir, 'shape-broken.json'), JSON.stringify({ session_id: 'shape-broken', agent_kind: 'unknown-kind' }));

    const list = listSessions(repoRoot, { includeStale: true });
    const broken = list.find((s) => s.session_id === 'broken');
    const shape = list.find((s) => s.session_id === 'shape-broken');
    expect(broken).toBeDefined();
    expect(broken.invalid).toBe(true);
    expect(shape).toBeDefined();
    expect(shape.invalid).toBe(true);
    expect(shape.reason).toBe('session-schema-invalid');
  });
});

describe('CLI command surface', () => {
  const { runSession } = require('../../src/cli/commands/session');

  let repoRoot;
  let originalCwd;
  let originalStdoutWrite;
  let originalStderrWrite;
  let stdoutChunks;
  let stderrChunks;

  beforeEach(() => {
    repoRoot = makeRepoRoot();
    originalCwd = process.cwd();
    process.chdir(repoRoot);
    stdoutChunks = [];
    stderrChunks = [];
    originalStdoutWrite = process.stdout.write.bind(process.stdout);
    originalStderrWrite = process.stderr.write.bind(process.stderr);
    process.stdout.write = (chunk) => { stdoutChunks.push(String(chunk)); return true; };
    process.stderr.write = (chunk) => { stderrChunks.push(String(chunk)); return true; };
  });

  afterEach(() => {
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
    process.chdir(originalCwd);
    fs.rmSync(repoRoot, { recursive: true, force: true });
  });

  test('register --json produces ok payload and matching file', () => {
    const id = 'test-cli-session-id';
    const code = runSession(['register', '--id', id, '--agent-kind', 'claude-code', '--json']);
    expect(code).toBe(0);
    const payload = JSON.parse(stdoutChunks.join(''));
    expect(payload.ok).toBe(true);
    expect(payload.session_id).toBe(id);
    expect(fs.existsSync(getSessionFile(repoRoot, id))).toBe(true);
  });

  test('register and list resolve the Git repo root from a subdirectory', () => {
    execFileSync('git', ['init'], { cwd: repoRoot, stdio: 'ignore' });
    const subdir = path.join(repoRoot, 'packages', 'app');
    fs.mkdirSync(subdir, { recursive: true });
    process.chdir(subdir);

    expect(runSession(['register', '--id', 'cli-subdir', '--agent-kind', 'codex', '--json'])).toBe(0);
    expect(fs.existsSync(getSessionFile(repoRoot, 'cli-subdir'))).toBe(true);
    expect(fs.existsSync(path.join(subdir, '.spec-first', 'sessions', 'cli-subdir.json'))).toBe(false);

    stdoutChunks.length = 0;
    expect(runSession(['list', '--json'])).toBe(0);
    const payload = JSON.parse(stdoutChunks.join(''));
    expect(payload.repo_root).toBe(fs.realpathSync(repoRoot));
    expect(payload.session_dir).toBe(path.join('.spec-first', 'sessions'));
    expect(payload.sessions.map((session) => session.session_id)).toContain('cli-subdir');
  });

  test('list --json reports active and stale counts', () => {
    runSession(['register', '--id', 'cli-active', '--agent-kind', 'codex', '--json']);
    stdoutChunks.length = 0;

    const code = runSession(['list', '--json']);
    expect(code).toBe(0);
    const payload = JSON.parse(stdoutChunks.join(''));
    expect(payload.schema_version).toBe('spec-first-session-list.v1');
    expect(payload.active_count).toBe(1);
    expect(payload.sessions[0].session_id).toBe('cli-active');
  });

  test('heartbeat --json updates last_heartbeat_at', async () => {
    runSession(['register', '--id', 'cli-hb', '--agent-kind', 'other', '--json']);
    const before = JSON.parse(fs.readFileSync(getSessionFile(repoRoot, 'cli-hb'), 'utf8'));
    stdoutChunks.length = 0;
    await new Promise((r) => setTimeout(r, 10));
    const code = runSession(['heartbeat', '--id', 'cli-hb', '--json']);
    expect(code).toBe(0);
    const after = JSON.parse(fs.readFileSync(getSessionFile(repoRoot, 'cli-hb'), 'utf8'));
    expect(after.last_heartbeat_at >= before.last_heartbeat_at).toBe(true);
  });

  test('unregister removes file; second call returns session-not-found', () => {
    runSession(['register', '--id', 'cli-rm', '--agent-kind', 'other', '--json']);
    stdoutChunks.length = 0;
    expect(runSession(['unregister', '--id', 'cli-rm', '--json'])).toBe(0);
    stderrChunks.length = 0;
    expect(runSession(['unregister', '--id', 'cli-rm', '--json'])).toBe(1);
    const errPayload = JSON.parse(stderrChunks.join(''));
    expect(errPayload.reason_code).toBe('session-not-found');
  });

  test('register rejects unknown options', () => {
    expect(runSession(['register', '--id', 'bad', '--unknown-flag', '--json'])).toBe(2);
    const payload = JSON.parse(stderrChunks.join(''));
    expect(payload.reason_code).toBe('unknown-option');
  });

  test('register rejects missing option values before falling back to defaults', () => {
    expect(runSession(['register', '--id', '--json'])).toBe(2);
    const idPayload = JSON.parse(stderrChunks.join(''));
    expect(idPayload.reason_code).toBe('missing-option-value');
    expect(idPayload.flag).toBe('--id');
    expect(stdoutChunks.join('')).toBe('');
    expect(fs.existsSync(getSessionDir(repoRoot))).toBe(false);

    stderrChunks.length = 0;
    expect(runSession(['register', '--agent-kind', '--scope-hint', 'x', '--json'])).toBe(2);
    const agentKindPayload = JSON.parse(stderrChunks.join(''));
    expect(agentKindPayload.reason_code).toBe('missing-option-value');
    expect(agentKindPayload.flag).toBe('--agent-kind');
  });

  test('heartbeat and unregister reject missing id values', () => {
    expect(runSession(['heartbeat', '--id', '--json'])).toBe(2);
    const heartbeatPayload = JSON.parse(stderrChunks.join(''));
    expect(heartbeatPayload.reason_code).toBe('missing-option-value');
    expect(heartbeatPayload.flag).toBe('--id');

    stderrChunks.length = 0;
    expect(runSession(['unregister', '--id', '--json'])).toBe(2);
    const unregisterPayload = JSON.parse(stderrChunks.join(''));
    expect(unregisterPayload.reason_code).toBe('missing-option-value');
    expect(unregisterPayload.flag).toBe('--id');
  });

  test('subcommand without name prints help and returns 2', () => {
    expect(runSession([])).toBe(2);
  });
});
