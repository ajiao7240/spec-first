'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SKILL_PATH = path.join(REPO_ROOT, 'skills/rclone/SKILL.md');
const SETUP_SCRIPT_PATH = path.join(REPO_ROOT, 'skills/rclone/scripts/check_setup.sh');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('rclone contracts', () => {
  test('skill preserves transport boundary, setup-first workflow, and provider matrix', () => {
    const skill = read(SKILL_PATH);

    expect(skill).toContain('name: rclone');
    expect(skill).toContain('provider-agnostic remote file transfer');
    expect(skill).toContain('Do **not** use this skill as a replacement for `deploy-docs` or `feature-video`.');
    expect(skill).toContain('bash skills/rclone/scripts/check_setup.sh');

    expect(skill).toContain('| AWS S3 |');
    expect(skill).toContain('| Cloudflare R2 |');
    expect(skill).toContain('| Backblaze B2 |');
    expect(skill).toContain('| Google Drive |');
    expect(skill).toContain('| Dropbox |');
  });

  test('skill preserves safety-critical transfer commands and sync warning', () => {
    const skill = read(SKILL_PATH);

    expect(skill).toContain('rclone copy /path/to/file.mp4 remote:bucket/path/ --progress');
    expect(skill).toContain('rclone sync /local/path remote:bucket/path/ --progress');
    expect(skill).toContain('rclone copy /path remote:bucket/ --dry-run');
    expect(skill).toContain('rclone check /local/file remote:bucket/file');
    expect(skill).toContain('rclone ls remote:bucket/');
    expect(skill).toContain('Require explicit user confirmation before using `sync`');
  });

  test('repo-local setup helper remains present', () => {
    const script = read(SETUP_SCRIPT_PATH);

    expect(script).toContain('=== rclone Setup Check ===');
    expect(script).toContain('rclone listremotes');
    expect(script).toContain('rclone lsd "$remote"');
    expect(script).toContain('brew install rclone');
    expect(script).toContain("Run 'rclone config' to set up a remote");
  });
});
