'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const SCRIPT_PATH = path.join(
  __dirname,
  '..',
  '..',
  'skills',
  'spec-sessions',
  'scripts',
  'extract-metadata.py'
);
const SCRIPTS_DIR = path.join(__dirname, '..', '..', 'skills', 'spec-sessions', 'scripts');
const DISCOVER_SCRIPT_PATH = path.join(SCRIPTS_DIR, 'discover-sessions.sh');

function writeJsonl(dir, name, rows) {
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, rows.map((row) => JSON.stringify(row)).join('\n') + '\n');
  return filePath;
}

function runExtract(args) {
  const output = execFileSync('python3', [SCRIPT_PATH, ...args], { encoding: 'utf8' });
  return output.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
}

function runScript(scriptName, args, stdin) {
  return execFileSync('python3', [path.join(SCRIPTS_DIR, scriptName), ...args], {
    encoding: 'utf8',
    input: stdin,
  });
}

function runDiscover(home, args) {
  const output = execFileSync('bash', [DISCOVER_SCRIPT_PATH, ...args], {
    encoding: 'utf8',
    env: { ...process.env, HOME: home },
  });
  return output.trim().split('\n').filter(Boolean).sort();
}

describe('session inventory metadata extraction', () => {
  let dir;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-session-history-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('discover-sessions finds Claude and Codex files by platform and mtime window', () => {
    const claudeDir = path.join(dir, '.claude', 'projects', '-Users-kuang-xiaobu-spec-first');
    const otherClaudeDir = path.join(dir, '.claude', 'projects', '-Users-kuang-xiaobu-other-repo');
    const codexDir = path.join(dir, '.codex', 'sessions', '2026', '05');
    const agentsDir = path.join(dir, '.agents', 'sessions');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.mkdirSync(otherClaudeDir, { recursive: true });
    fs.mkdirSync(codexDir, { recursive: true });
    fs.mkdirSync(agentsDir, { recursive: true });

    const claudeSession = writeJsonl(claudeDir, 'claude.jsonl', [{ type: 'user', timestamp: '2026-05-09T00:00:00Z' }]);
    const otherClaudeSession = writeJsonl(otherClaudeDir, 'other.jsonl', [{ type: 'user', timestamp: '2026-05-09T00:00:00Z' }]);
    const codexSession = writeJsonl(codexDir, 'codex.jsonl', [{ type: 'session_meta', timestamp: '2026-05-09T00:00:00Z' }]);
    const agentsSession = writeJsonl(agentsDir, 'agents.jsonl', [{ type: 'session_meta', timestamp: '2026-05-09T00:00:00Z' }]);
    const staleSession = writeJsonl(claudeDir, 'stale.jsonl', [{ type: 'user', timestamp: '2026-04-01T00:00:00Z' }]);
    const staleTime = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    fs.utimesSync(staleSession, staleTime, staleTime);

    expect(runDiscover(dir, ['spec-first', '7'])).toEqual([agentsSession, claudeSession, codexSession].sort());
    expect(runDiscover(dir, ['spec-first', '7', '--platform', 'claude'])).toEqual([claudeSession]);
    expect(runDiscover(dir, ['spec-first', '7', '--platform', 'codex'])).toEqual([agentsSession, codexSession].sort());
    expect(runDiscover(dir, ['missing-repo', '7', '--platform', 'claude'])).toEqual([]);
    expect(runDiscover(dir, ['spec-first', '7'])).not.toContain(otherClaudeSession);
    expect(runDiscover(dir, ['spec-first', '7'])).not.toContain(staleSession);
  });

  test('--keyword counts only user and assistant text', () => {
    const realMatch = writeJsonl(dir, 'real-match.jsonl', [
      {
        type: 'user',
        gitBranch: 'feat/auth',
        timestamp: '2026-04-26T01:00:00.000Z',
        sessionId: 'session-without-topic',
        message: { content: [{ type: 'text', text: 'Fix auth middleware token handling.' }] },
      },
      {
        type: 'assistant',
        timestamp: '2026-04-26T01:01:00.000Z',
        message: { content: [{ type: 'text', text: 'The auth path needs a contract check.' }] },
      },
    ]);
    const metadataOnly = writeJsonl(dir, 'metadata-only.jsonl', [
      {
        type: 'user',
        gitBranch: 'feat/metadata',
        timestamp: '2026-04-26T02:00:00.000Z',
        sessionId: 'auth-token-session',
        message: { content: [{ type: 'tool_result', content: 'auth middleware from tool output' }] },
      },
      {
        type: 'assistant',
        timestamp: '2026-04-26T02:01:00.000Z',
        message: { content: [{ type: 'tool_use', name: 'auth_tool', input: { topic: 'auth' } }] },
      },
    ]);

    const rows = runExtract([realMatch, metadataOnly, '--keyword', 'auth,middleware']);
    const sessions = rows.filter((row) => !row._meta);
    const meta = rows.find((row) => row._meta);

    expect(sessions).toHaveLength(1);
    expect(sessions[0].file).toBe(realMatch);
    expect(sessions[0].match_count).toBe(3);
    expect(sessions[0].keyword_matches).toEqual({ auth: 2, middleware: 1 });
    expect(meta.files_processed).toBe(2);
    expect(meta.files_matched).toBe(1);
  });

  test('CWD filter runs before keyword scan for Codex sessions', () => {
    const otherRepo = writeJsonl(dir, 'other-repo.jsonl', [
      {
        type: 'session_meta',
        timestamp: '2026-04-26T01:00:00.000Z',
        payload: { cwd: '/tmp/other-repo', id: 'other', source: 'codex' },
      },
      {
        type: 'event_msg',
        timestamp: '2026-04-26T01:01:00.000Z',
        payload: { type: 'user_message', message: 'auth auth auth' },
      },
    ]);
    const targetRepo = writeJsonl(dir, 'target-repo.jsonl', [
      {
        type: 'session_meta',
        timestamp: '2026-04-26T02:00:00.000Z',
        payload: { cwd: '/tmp/spec-first', id: 'target', source: 'codex' },
      },
      {
        type: 'event_msg',
        timestamp: '2026-04-26T02:01:00.000Z',
        payload: {
          type: 'user_message',
          message: '<system_instruction>boilerplate auth</system_instruction>Need token review.',
        },
      },
    ]);

    const rows = runExtract([
      otherRepo,
      targetRepo,
      '--cwd-filter',
      'spec-first',
      '--keyword',
      'auth,token',
    ]);
    const sessions = rows.filter((row) => !row._meta);
    const meta = rows.find((row) => row._meta);

    expect(sessions).toHaveLength(1);
    expect(sessions[0].file).toBe(targetRepo);
    expect(sessions[0].keyword_matches).toEqual({ auth: 0, token: 1 });
    expect(meta.filtered_by_cwd).toBe(1);
    expect(meta.files_matched).toBe(1);
  });

  test('empty keyword scans emit stable files_matched metadata', () => {
    const rows = runExtract(['--keyword', 'auth']);
    expect(rows).toEqual([{ _meta: true, files_processed: 0, parse_errors: 0, files_matched: 0 }]);
  });

  test('--output writes skeleton bytes to a scratch file and emits status JSON only', () => {
    const session = writeJsonl(dir, 'claude-output.jsonl', [
      {
        type: 'user',
        gitBranch: 'feat/auth',
        timestamp: '2026-04-26T01:00:00.000Z',
        sessionId: 'output-session',
        message: { content: [{ type: 'text', text: 'Please fix auth middleware token handling.' }] },
      },
      {
        type: 'assistant',
        timestamp: '2026-04-26T01:01:00.000Z',
        message: { content: [{ type: 'text', text: 'The auth middleware path is now fixed.' }] },
      },
    ]);
    const outPath = path.join(dir, 'out.skeleton.txt');

    const stdout = runScript('extract-skeleton.py', ['--output', outPath], fs.readFileSync(session, 'utf8'));
    const lines = stdout.trim().split('\n').filter(Boolean);
    const status = JSON.parse(lines[0]);
    const body = fs.readFileSync(outPath, 'utf8');

    expect(lines).toHaveLength(1);
    expect(status._meta).toBe(true);
    expect(status.wrote).toBe(outPath);
    expect(status.bytes).toBe(Buffer.byteLength(body));
    expect(status.parse_errors).toBe(0);
    expect(body).toContain('[user] Please fix auth middleware token handling.');
    expect(body).toContain('[assistant] The auth middleware path is now fixed.');
    expect(body).not.toContain('"_meta"');
    expect(body).not.toContain('"wrote":');
  });

  test('--output writes error bytes to a scratch file and emits status JSON only', () => {
    const session = writeJsonl(dir, 'claude-error.jsonl', [
      {
        type: 'user',
        timestamp: '2026-04-26T01:00:00.000Z',
        message: {
          content: [
            {
              type: 'tool_result',
              is_error: true,
              content: 'String to replace not found\nlarge payload omitted',
            },
          ],
        },
      },
    ]);
    const outPath = path.join(dir, 'out.errors.txt');

    const stdout = runScript('extract-errors.py', ['--output', outPath], fs.readFileSync(session, 'utf8'));
    const lines = stdout.trim().split('\n').filter(Boolean);
    const status = JSON.parse(lines[0]);
    const body = fs.readFileSync(outPath, 'utf8');

    expect(lines).toHaveLength(1);
    expect(status._meta).toBe(true);
    expect(status.wrote).toBe(outPath);
    expect(status.bytes).toBe(Buffer.byteLength(body));
    expect(status.errors_found).toBe(1);
    expect(body).toContain('[error] String to replace not found');
    expect(body).not.toContain('"_meta"');
    expect(body).not.toContain('"wrote":');
  });
});
