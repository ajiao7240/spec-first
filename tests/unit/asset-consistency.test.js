'use strict';

const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.join(__dirname, '..', '..');

function walkFiles(rootDir, skipNames = new Set(['.git', 'node_modules', '.spec-first', '.claude', '.codex', '.agents'])) {
  const results = [];

  function walk(currentDir) {
    if (!fs.existsSync(currentDir)) return;
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      if (skipNames.has(entry.name)) continue;
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(absolutePath);
        continue;
      }
      if (entry.isFile()) {
        results.push(absolutePath);
      }
    }
  }

  walk(rootDir);
  return results;
}

function isTextFile(filePath) {
  return /\.(cjs|js|json|md|sh|txt|yaml|yml)$/i.test(filePath);
}

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

const HIGH_RISK_SKILL_ANCHORS = [
  {
    skillName: 'spec-brainstorm',
    sourcePath: 'skills/spec-brainstorm/SKILL.md',
    mirrorPath: 'docs/10-prompt/skills/spec-brainstorm/SKILL.md',
    anchors: [
      'Restated Understanding',
      'Current Core Goal',
      'Scope / Non-goals',
      'Verification-as-Done',
    ],
  },
  {
    skillName: 'spec-plan',
    sourcePath: 'skills/spec-plan/SKILL.md',
    mirrorPath: 'docs/10-prompt/skills/spec-plan/SKILL.md',
    anchors: [
      'selection_subject / selected_contexts',
      'selected_assets / fallback_reason / level / skipped_rules',
      'verifier_dispatch',
      'verification_gate_state',
      'Verification-as-Done',
      'Reload Before Act',
      'freshness_stale',
      'stage0-context --stage plan --workflow spec-plan --format json',
    ],
  },
  {
    skillName: 'spec-work',
    sourcePath: 'skills/spec-work/SKILL.md',
    mirrorPath: 'docs/10-prompt/skills/spec-work/SKILL.md',
    anchors: [
      'selection_subject / selected_contexts',
      'required_verifications',
      'verifier_dispatch',
      'verification_gate_state',
      'Verification-as-Done',
      'pre-execution checkpoint',
      'Run Artifact Contract',
      'spec-work-run-artifact.schema.json',
      'work_run:<run-id>',
      'freshness_stale',
      'stage0-context --stage work --workflow spec-work --format json',
    ],
  },
  {
    skillName: 'spec-work-beta',
    sourcePath: 'skills/spec-work-beta/SKILL.md',
    mirrorPath: 'docs/10-prompt/skills/spec-work-beta/SKILL.md',
    anchors: [
      'selection_subject / selected_contexts',
      'required_verifications',
      'verifier_dispatch',
      'verification_gate_state',
      'Verification-as-Done',
      'pre-execution checkpoint',
      'freshness_stale',
      'stage0-context --stage work --workflow spec-work-beta --format json',
    ],
  },
  {
    skillName: 'spec-review',
    sourcePath: 'skills/spec-review/SKILL.md',
    mirrorPath: 'docs/10-prompt/skills/spec-review/SKILL.md',
    anchors: [
      'selection_subject / selected_contexts',
      'verification summary',
      'verifier_dispatch',
      'verification_gate_state',
      'Reload Before Act',
      'Optional Upstream Work Handoff',
      'work_run:<run-id>',
      'Three-Axis Verdict',
      'Requirement Completion',
      'Plan-Diff Fidelity',
      'Code Intrinsic Quality',
      'freshness_stale',
      'stage0-context --stage review --workflow spec-review --format json',
    ],
  },
  {
    skillName: 'spec-compound',
    sourcePath: 'skills/spec-compound/SKILL.md',
    mirrorPath: 'docs/10-prompt/skills/spec-compound/SKILL.md',
    anchors: [
      'single durable file',
      'Human Summary',
      'LLM Reuse Context',
      'primary reuse surface',
      'Do not create a second durable artifact',
    ],
  },
  {
    skillName: 'spec-compound-refresh',
    sourcePath: 'skills/spec-compound-refresh/SKILL.md',
    mirrorPath: 'docs/10-prompt/skills/spec-compound-refresh/SKILL.md',
    anchors: [
      'same durable file',
      'section-aware',
      'Code Touchpoints',
      'Provenance',
      'upgrade opportunity',
    ],
  },
  {
    skillName: 'spec-debug',
    sourcePath: 'skills/spec-debug/SKILL.md',
    mirrorPath: 'docs/10-prompt/skills/spec-debug/SKILL.md',
    anchors: [
      'Restated Understanding',
      'Current Core Goal',
      'Scope / Non-goals',
      'Verification-as-Done',
    ],
  },
  {
    skillName: 'spec-graph-bootstrap',
    sourcePath: 'skills/spec-graph-bootstrap/SKILL.md',
    mirrorPath: 'docs/10-prompt/skills/spec-graph-bootstrap/SKILL.md',
    anchors: [
      'Runs Phase 0–4',
      'fact-inventory.json',
      'database-routing.json',
      'risk-signals.json',
      'test-surface.json',
      '/spec:graph-bootstrap',
    ],
  },
];

const HIGH_RISK_AGENT_ANCHORS = [
  {
    agentName: 'learnings-researcher',
    sourcePath: 'agents/research/learnings-researcher.md',
    mirrorPath: 'docs/10-prompt/agents/research/learnings-researcher.md',
    anchors: [
      '## LLM Reuse Context',
      'primary reuse surface',
      'Missing these sections is not an error',
      "the current project's compound documentation schema references",
      "The project's planning workflow",
    ],
  },
];

describe('asset consistency governance', () => {
  test('every source skill has a prompt docs mirror', () => {
    const skillsRoot = path.join(repoRoot, 'skills');
    const mirrorRoot = path.join(repoRoot, 'docs', '10-prompt', 'skills');
    const missing = fs.readdirSync(skillsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((skillName) => !fs.existsSync(path.join(mirrorRoot, skillName, 'SKILL.md')));

    expect(missing).toEqual([]);
  });

  test('package version and plugin manifest version stay aligned', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
    const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, '.claude-plugin', 'plugin.json'), 'utf8'));

    expect(manifest.version).toBe(pkg.version);
  });

  test('high-risk skills keep critical contract anchors aligned between source and prompt mirror', () => {
    const drift = [];

    for (const record of HIGH_RISK_SKILL_ANCHORS) {
      const source = read(record.sourcePath);
      const mirror = read(record.mirrorPath);

      for (const anchor of record.anchors) {
        if (!source.includes(anchor)) {
          drift.push(`${record.skillName} source missing anchor: ${anchor}`);
        }
        if (!mirror.includes(anchor)) {
          drift.push(`${record.skillName} mirror missing anchor: ${anchor}`);
        }
      }
    }

    expect(drift).toEqual([]);
  });

  test('high-risk agents keep critical contract anchors aligned between source and prompt mirror', () => {
    const drift = [];

    for (const record of HIGH_RISK_AGENT_ANCHORS) {
      const source = read(record.sourcePath);
      const mirror = read(record.mirrorPath);

      for (const anchor of record.anchors) {
        if (!source.includes(anchor)) {
          drift.push(`${record.agentName} source missing anchor: ${anchor}`);
        }
        if (!mirror.includes(anchor)) {
          drift.push(`${record.agentName} mirror missing anchor: ${anchor}`);
        }
      }
    }

    expect(drift).toEqual([]);
  });

  test('retired bootstrap entrypoints do not reappear in source assets or docs', () => {
    const retiredSkill = ['spec', 'bootstrap'].join('-');
    const retiredClaudeEntry = ['/spec', 'bootstrap'].join(':');
    const retiredCodexEntry = `$${retiredSkill}`;
    const forbidden = [retiredSkill, retiredClaudeEntry, retiredCodexEntry];
    const searchRoots = [
      'README.md',
      'README.zh-CN.md',
      'docs',
      'skills',
      'templates',
      'src',
      'tests',
    ];

    const hits = [];
    for (const relativeRoot of searchRoots) {
      const absoluteRoot = path.join(repoRoot, relativeRoot);
      const files = fs.existsSync(absoluteRoot) && fs.statSync(absoluteRoot).isDirectory()
        ? walkFiles(absoluteRoot)
        : [absoluteRoot];

      for (const filePath of files.filter(isTextFile)) {
        const content = fs.readFileSync(filePath, 'utf8');
        for (const token of forbidden) {
          if (content.includes(token)) {
            hits.push(`${path.relative(repoRoot, filePath)} -> ${token}`);
          }
        }
      }
    }

    expect(hits).toEqual([]);
  });
});
