'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SKILL_PATH = path.join(REPO_ROOT, 'skills/test-xcode/SKILL.md');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('test-xcode contracts', () => {
  test('skill preserves upstream simulator test flow and SwiftUI text-link limitation guidance', () => {
    const skill = read(SKILL_PATH);

    expect(skill).toContain('### 0. Verify XcodeBuildMCP is Available');
    expect(skill).toContain('mcp__xcodebuildmcp__list_simulators');
    expect(skill).toContain('### 3. Build the App');
    expect(skill).toContain('### 5. Test Key Screens');
    expect(skill).toContain('Known automation limitation — SwiftUI Text links:');
    expect(skill).toContain('xcrun simctl openurl <device> <URL>');
    expect(skill).toContain('### 9. Cleanup');
    expect(skill).toContain('load the `todo-create` skill and create a todo with priority p1');
    expect(skill).toContain('Load the `test-xcode` skill with one of these argument shapes:');
    expect(skill).toContain('## Verifier Registry Metadata');
    expect(skill).toContain('Verifier id: `test-xcode`');
    expect(skill).toContain('Supported platforms: `mobile-ios`');
    expect(skill).not.toContain('/test-xcode');
  });

  test('skill keeps spec-first review integration and enriched description', () => {
    const skill = read(SKILL_PATH);

    expect(skill).toContain('description: "Build and test iOS apps on simulator using XcodeBuildMCP. Use after making iOS code changes, before creating a PR, or when verifying app behavior and checking for crashes on simulator."');
    expect(skill).toContain('## Integration with spec:review');
    expect(skill).toContain('the `spec:review` workflow can spawn an agent');

    expect(skill).not.toContain('## Integration with ce:review');
    expect(skill).not.toContain('the `ce:review` workflow can spawn an agent');
  });
});
