'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SKILL_PATH = path.join(REPO_ROOT, 'skills/feature-video/SKILL.md');
const CAPTURE_SCRIPT_PATH = path.join(REPO_ROOT, 'skills/feature-video/scripts/capture-demo.py');
const BROWSER_REEL_PATH = path.join(
  REPO_ROOT,
  'skills/feature-video/references/tier-browser-reel.md',
);
const UPLOAD_APPROVAL_PATH = path.join(
  REPO_ROOT,
  'skills/feature-video/references/upload-and-approval.md',
);

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('feature-video contracts', () => {
  test('skill preserves native video upload and tiered evidence capture', () => {
    const skill = read(SKILL_PATH);

    expect(skill).toContain('Feature Evidence Capture');
    expect(skill).toContain('Tiered evidence capture');
    expect(skill).toContain('Native GitHub video upload');
    expect(skill).toContain('## Native GitHub Video Mode');
    expect(skill).toContain('## Tiered Evidence Mode');
    expect(skill).toContain('scripts/capture-demo.py');
    expect(skill).toContain('references/tier-browser-reel.md');
    expect(skill).toContain('user-attachments/assets/');
    expect(skill).toContain('Load the `feature-video` skill with one of these argument shapes:');
    expect(skill).not.toMatch(/(^|\n)\/feature-video(?:\s|$)/m);
  });

  test('tier references and shared capture pipeline use spec-first naming', () => {
    const captureScript = read(CAPTURE_SCRIPT_PATH);
    const browserReel = read(BROWSER_REEL_PATH);
    const uploadApproval = read(UPLOAD_APPROVAL_PATH);

    expect(captureScript).toContain('detect [--repo-root PATH]');
    expect(captureScript).toContain('recommend --project-type');
    expect(captureScript).toContain('terminal-recording');
    expect(captureScript).not.toContain('demo-reel skill');
    expect(browserReel).toContain('/spec:setup');
    expect(browserReel).not.toContain('/ce-setup');
    expect(uploadApproval).not.toContain('ce-demo-reel');
  });
});
