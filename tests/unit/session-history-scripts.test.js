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
  'spec-session-inventory',
  'scripts',
  'extract-metadata.py'
);

function writeJsonl(dir, name, rows) {
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, rows.map((row) => JSON.stringify(row)).join('\n') + '\n');
  return filePath;
}

function runExtract(args) {
  const output = execFileSync('python3', [SCRIPT_PATH, ...args], { encoding: 'utf8' });
  return output.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
}

describe('session inventory metadata extraction', () => {
  let dir;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-session-history-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
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
});
