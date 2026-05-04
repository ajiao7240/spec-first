'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { getAdapter } = require('../../src/cli/adapters');
const { planBundledAssetSync } = require('../../src/cli/plugin');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SKILL_PATH = path.join(REPO_ROOT, 'skills', 'spec-update', 'SKILL.md');
const SCRIPTS_DIR = path.join(REPO_ROOT, 'skills', 'spec-update', 'scripts');
const COMMAND_TEMPLATE_PATH = path.join(
  REPO_ROOT,
  'templates',
  'claude',
  'commands',
  'spec',
  'update.md',
);
const GOVERNANCE_PATH = path.join(
  REPO_ROOT,
  'src',
  'cli',
  'contracts',
  'dual-host-governance',
  'skills-governance.json',
);

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function findUnindentedBlockScalarLines(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) {
    throw new Error('Missing frontmatter');
  }

  const lines = match[1].split(/\r?\n/);
  const findings = [];

  for (let index = 0; index < lines.length; index += 1) {
    const blockScalar = lines[index].match(/^([A-Za-z0-9_-]+):\s*[>|]/);
    if (!blockScalar) {
      continue;
    }

    for (let nextIndex = index + 1; nextIndex < lines.length; nextIndex += 1) {
      const line = lines[nextIndex];
      if (/^[A-Za-z0-9_-]+:\s*/.test(line)) {
        break;
      }
      if (line.trim() === '') {
        continue;
      }
      if (!/^\s/.test(line)) {
        findings.push({
          key: blockScalar[1],
          line: nextIndex + 2,
          content: line,
        });
      }
    }
  }

  return findings;
}

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spec-first-update-contracts-'));
}

function renderClaudeSpecUpdate() {
  const adapter = getAdapter('claude');
  return adapter.renderCommandContent(
    { name: 'update', filename: 'update.md', skill: 'spec-update' },
    read(COMMAND_TEMPLATE_PATH),
    {
      commandName: 'update',
      skillName: 'spec-update',
      skillContent: read(SKILL_PATH),
    },
  );
}

function renderCodexSpecUpdate() {
  const adapter = getAdapter('codex');
  return adapter.transformSkillContent(read(SKILL_PATH), {
    skillName: 'spec-update',
    isWorkflowSkill: true,
  });
}

function plannedRuntimeContent(platform, targetPath) {
  const projectRoot = makeTempDir();

  try {
    const adapter = getAdapter(platform);
    const { plan } = planBundledAssetSync(projectRoot, adapter);
    const operation = plan.operations.find((entry) => entry.path === targetPath);
    if (!operation) {
      throw new Error(`Missing planned runtime operation for ${targetPath}`);
    }
    return operation.contents;
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
}

function plannedRuntimeOperation(platform, targetPath) {
  const projectRoot = makeTempDir();

  try {
    const adapter = getAdapter(platform);
    const { plan } = planBundledAssetSync(projectRoot, adapter);
    const operation = plan.operations.find((entry) => entry.path === targetPath);
    if (!operation) {
      throw new Error(`Missing planned runtime operation for ${targetPath}`);
    }
    return operation;
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
}

function expectRenderedRuntimeParity(content) {
  expect(content).toContain('.agents/skills/spec-update/SKILL.md');
  expect(content).toContain('.claude/commands/spec/update.md');
  expect(content).toContain('spec-first init --claude');
  expect(content).toContain('spec-first init --codex');
  expect(content).not.toContain('.agents/.agents');
  expect(content).not.toContain('.agents/.claude');
  expect(content).not.toContain('.claude/.claude');
  expect(content).not.toContain('.claude/.agents');
}

describe('spec-update contracts', () => {
  test('source and generated Codex frontmatter keep block scalar continuation lines indented', () => {
    expect(findUnindentedBlockScalarLines(read(SKILL_PATH))).toEqual([]);
    expect(findUnindentedBlockScalarLines(plannedRuntimeContent('codex', '.agents/skills/spec-update/SKILL.md'))).toEqual([]);
  });

  test('source skill supports Claude Code and Codex update flows', () => {
    const skill = read(SKILL_PATH);

    expect(skill).toContain('Supports Claude Code and');
    expect(skill).toContain('Codex with host-specific update commands');
    expect(skill).toContain('Claude Code branch');
    expect(skill).toContain('Codex branch');
    expect(skill).toContain('claude plugin update');
    expect(skill).toContain('npm install -g spec-first@latest');
    expect(skill).toContain('Startup version reminders may route users here');
    expect(skill).toContain('/spec:update');
    expect(skill).toContain('$spec-update');
    expect(skill).toContain('Those reminders are advisory only');
    expect(skill).toContain('install packages, refresh runtime assets, or restart the host');
    expect(skill).toContain('spec-first startup-reminder --claude --reset');
    expect(skill).toContain('spec-first startup-reminder --codex --reset');
    expect(skill).toContain('For Claude Code:');
    expect(skill).toContain('For Codex:');
    expect(skill).toContain('If this workflow is reporting both host checks');
    expect(skill).toContain('spec-first doctor --claude --json');
    expect(skill).toContain('spec-first doctor --codex --json');
    expect(skill).toContain('spec-first init --claude');
    expect(skill).toContain('spec-first init --codex');
    expect(skill).toContain('run the update workflow');
    expect(skill).not.toContain('ce_platforms: [claude]');
    expect(skill).not.toContain('Claude Code only.');
  });

  test('Claude marketplace probes use bounded scripts with stable sentinels', () => {
    const skill = read(SKILL_PATH);

    expect(skill).not.toContain('allowed-tools:');
    expect(skill).toContain('bash "${CLAUDE_SKILL_DIR}/scripts/upstream-version.sh"');
    expect(skill).toContain('bash "${CLAUDE_SKILL_DIR}/scripts/currently-loaded-version.sh"');
    expect(skill).toContain('bash "${CLAUDE_SKILL_DIR}/scripts/marketplace-name.sh"');
    expect(skill).toContain('__SPEC_UPDATE_NOT_MARKETPLACE__');
    expect(skill).toContain('__SPEC_UPDATE_VERSION_FAILED__');
    expect(skill).not.toContain('__SPEC_UPDATE_NOT_MARKETPLASPEC__');
    expect(skill).not.toContain('!`version=');
    expect(skill).not.toContain('!`echo "${CLAUDE_SKILL_DIR}"');
    expect(skill).not.toContain('case "${CLAUDE_SKILL_DIR}"');
    expect(skill).not.toContain(';; esac');
  });

  test('Claude marketplace probe scripts self-locate and use spec-first sentinels', () => {
    const currentVersionScript = read(path.join(SCRIPTS_DIR, 'currently-loaded-version.sh'));
    const marketplaceScript = read(path.join(SCRIPTS_DIR, 'marketplace-name.sh'));
    const upstreamScript = read(path.join(SCRIPTS_DIR, 'upstream-version.sh'));

    for (const scriptName of ['currently-loaded-version.sh', 'marketplace-name.sh', 'upstream-version.sh']) {
      const script = read(path.join(SCRIPTS_DIR, scriptName));
      const mode = fs.statSync(path.join(SCRIPTS_DIR, scriptName)).mode & 0o111;
      expect(mode).not.toBe(0);
      expect(script).toContain('#!/bin/bash');
      expect(script).toContain('set -euo pipefail');
    }

    expect(currentVersionScript).toContain('BASH_SOURCE[0]');
    expect(currentVersionScript).toContain('/spec-first/([^/]+)/skills/spec-update');
    expect(currentVersionScript).toContain('__SPEC_UPDATE_NOT_MARKETPLACE__');
    expect(marketplaceScript).toContain('BASH_SOURCE[0]');
    expect(marketplaceScript).toContain('/spec-first/[^/]+/skills/spec-update');
    expect(marketplaceScript).toContain('__SPEC_UPDATE_NOT_MARKETPLACE__');
    expect(upstreamScript).toContain('repos/sunrain520/spec-first/contents/package.json');
    expect(upstreamScript).toContain('2>/dev/null || true');
    expect(upstreamScript).toContain('__SPEC_UPDATE_VERSION_FAILED__');
    expect(upstreamScript).not.toContain('EveryInc/compound-engineering-plugin');
  });

  test('runtime sync includes update probe scripts on both hosts', () => {
    for (const [platform, prefix] of [
      ['claude', '.claude/spec-first/workflows/spec-update/scripts'],
      ['codex', '.agents/skills/spec-update/scripts'],
    ]) {
      for (const scriptName of ['currently-loaded-version.sh', 'marketplace-name.sh', 'upstream-version.sh']) {
        const operation = plannedRuntimeOperation(platform, `${prefix}/${scriptName}`);

        expect(operation.kind).toBe('write_file');
        expect(operation.mode & 0o111).not.toBe(0);
        expect(operation.contents).toContain('#!/bin/bash');
        expect(operation.contents).toContain('set -euo pipefail');
      }
    }
  });

  test('governance exposes spec-update on both hosts', () => {
    const governance = JSON.parse(read(GOVERNANCE_PATH));

    expect(governance.skills).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          skill_name: 'spec-update',
          entry_surface: 'workflow_command',
          command_name: 'update',
          host_scope: 'dual_host',
          owner_host: null,
          host_delivery: {
            claude: 'command',
            codex: 'skill',
          },
        }),
      ]),
    );
  });

  test('rendered Claude and Codex update entries preserve host-comparative runtime prose', () => {
    const claude = renderClaudeSpecUpdate();
    const codex = renderCodexSpecUpdate();

    expectRenderedRuntimeParity(claude);
    expectRenderedRuntimeParity(codex);
  });

  test('planned runtime generation preserves spec-update parity for both hosts', () => {
    const claude = plannedRuntimeContent('claude', '.claude/commands/spec/update.md');
    const codex = plannedRuntimeContent('codex', '.agents/skills/spec-update/SKILL.md');

    expectRenderedRuntimeParity(claude);
    expectRenderedRuntimeParity(codex);
  });
});
