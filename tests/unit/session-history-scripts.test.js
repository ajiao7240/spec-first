'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.join(__dirname, '..', '..');
const EXTRACT_SKELETON_PATH = path.join(
  REPO_ROOT,
  'agents/research/session-history-scripts/extract-skeleton.py',
);

describe('session history scripts', () => {
  test('extract-skeleton preserves Cursor message content and tool targets', () => {
    const input = [
      JSON.stringify({
        role: 'user',
        message: {
          content: [
            {
              type: 'text',
              text: '<user_query>Investigate the login race condition</user_query>',
            },
          ],
        },
      }),
      JSON.stringify({
        role: 'assistant',
        message: {
          content: [
            { type: 'text', text: '[REDACTED]' },
            { type: 'text', text: 'I traced the failure to session refresh ordering.' },
            {
              type: 'tool_use',
              name: 'Read',
              input: {
                path: 'app/services/session_refresh.js',
              },
            },
          ],
        },
      }),
    ].join('\n');

    const result = spawnSync('python3', [EXTRACT_SKELETON_PATH], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      input,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('[user] Investigate the login race condition');
    expect(result.stdout).toContain('[assistant] I traced the failure to session refresh ordering.');
    expect(result.stdout).toContain('[tool] Read app/services/session_refresh.js');
    expect(result.stdout).not.toContain('[REDACTED]');
    expect(result.stdout).toContain('"parse_errors": 0');
  });
});
