'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPT_PATH = path.join(__dirname, '..', '..', 'skills', 'feature-video', 'scripts', 'capture-demo.py');
const BROWSER_REEL_PATH = path.join(
  __dirname,
  '..',
  '..',
  'skills',
  'feature-video',
  'references',
  'tier-browser-reel.md',
);

describe('feature-video browser reel contracts', () => {
  test('browser capture waits for network idle and has SPA fallback guidance', () => {
    const text = fs.readFileSync(BROWSER_REEL_PATH, 'utf8');

    expect(text).toContain('agent-browser wait --load networkidle');
    expect(text).toContain('agent-browser wait 1000');
    expect(text).toContain('websockets, long-polling');
    expect(text).toContain('agent-browser wait --text "<known content>"');
    expect(text).toContain('agent-browser wait --fn "<expression>"');
    expect(text).not.toContain('agent-browser wait 2000');
  });

  test('stitch rejects tiny frames by default before invoking ffmpeg', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-feature-video-'));
    try {
      const frame = path.join(dir, 'tiny.png');
      const output = path.join(dir, 'demo.gif');
      fs.writeFileSync(frame, 'not a real png');

      const result = spawnSync('python3', [SCRIPT_PATH, 'stitch', output, frame], {
        encoding: 'utf8',
      });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('below the 20480-byte minimum');
      expect(result.stderr).toContain('agent-browser wait --load networkidle');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('script exposes min-frame override and bypasses it for screenshot-reel', () => {
    const text = fs.readFileSync(SCRIPT_PATH, 'utf8');

    expect(text).toContain('DEFAULT_MIN_FRAME_BYTES = 20 * 1024');
    expect(text).toContain('--min-frame-bytes');
    expect(text).toContain('min_frame_bytes=0');
    expect(text).toContain('_stitch_frames(output, reduced, duration, min_frame_bytes)');
    expect(text).toContain('feature-video skill');
    expect(text).not.toContain('demo-reel skill');
  });

  test('skill prose uses feature-video scratch naming', () => {
    const text = fs.readFileSync(
      path.join(__dirname, '..', '..', 'skills', 'feature-video', 'SKILL.md'),
      'utf8',
    );

    expect(text).toContain('mktemp -d -t feature-video-XXXXXX');
    expect(text).not.toContain('mktemp -d -t demo-reel-XXXXXX');
  });
});
