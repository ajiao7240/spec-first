'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SKILL_PATH = path.join(REPO_ROOT, 'skills/agent-browser/SKILL.md');
const REFS_DIR = path.join(REPO_ROOT, 'skills/agent-browser/references');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function refExists(name) {
  return fs.existsSync(path.join(REFS_DIR, name));
}

describe('agent-browser skill contracts', () => {
  test('frontmatter preserves identity and tool permission model', () => {
    const skill = read(SKILL_PATH);

    // Skill identity
    expect(skill).toContain('name: agent-browser');

    // allowed-tools is the permission gate for all 6 downstream skills
    // (frontend-design, test-browser, reproduce-bug, feature-video, spec-debug, setup)
    // Both variants must be present: direct CLI and npx-based invocation
    // If either is removed, the model loses permission to execute agent-browser commands
    // within those downstream skill contexts
    expect(skill).toContain('Bash(agent-browser:*)');
    expect(skill).toContain('Bash(npx agent-browser:*)');
  });

  test('installation instructions cover all required paths and Chrome download step', () => {
    const skill = read(SKILL_PATH);

    // npm: primary install path referenced by most downstream skills
    expect(skill).toContain('npm i -g agent-browser');

    // brew and cargo: alternative paths that downstream skills may guide users to
    expect(skill).toContain('brew install agent-browser');
    expect(skill).toContain('cargo install agent-browser');

    // Chrome download — without this step, CLI installs but browser automation fails
    // feature-video, test-browser, and reproduce-bug all assume Chrome is available
    expect(skill).toContain('agent-browser install');
  });

  test('preserves CDP technical foundation and core open/snapshot/interact workflow', () => {
    const skill = read(SKILL_PATH);

    // CDP is the technical foundation of agent-browser
    // If upstream switches to Playwright or puppeteer, the entire command surface changes
    // and all 6 downstream skill integrations break silently
    expect(skill).toContain('Chrome/Chromium via CDP');

    // Core Workflow — open → snapshot → interact → re-snapshot
    // reproduce-bug Route B, frontend-design visual verification, and feature-video
    // all depend on this exact 4-step interaction model
    expect(skill).toContain('Core Workflow');
    expect(skill).toContain('agent-browser open');
    expect(skill).toContain('agent-browser snapshot -i');
    expect(skill).toContain('Re-snapshot');
  });

  test('Ref Lifecycle section guards downstream safe-interaction contracts', () => {
    const skill = read(SKILL_PATH);

    // Ref Lifecycle explains that @e1/@e2 refs are invalidated on navigation
    // reproduce-bug, feature-video, and test-browser all follow this contract
    // If this section is removed, downstream agents silently use stale refs after navigation
    expect(skill).toContain('Ref Lifecycle');
    expect(skill).toContain('are invalidated when the page changes');
  });

  test('all 7 reference files are present', () => {
    // These files provide deep documentation for scenarios that the main SKILL.md summarizes
    // authentication.md: login flows used by reproduce-bug and feature-video
    // snapshot-refs.md: ref lifecycle details critical for all 6 downstream consumers
    // commands.md: full command reference — the authoritative source for downstream skill snippets
    const REQUIRED_REFS = [
      'authentication.md',
      'commands.md',
      'profiling.md',
      'proxy-support.md',
      'session-management.md',
      'snapshot-refs.md',
      'video-recording.md',
    ];

    for (const ref of REQUIRED_REFS) {
      expect(refExists(ref)).toBe(true);
    }
  });
});
