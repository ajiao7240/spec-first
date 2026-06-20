'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const EVALS_PATH = path.join(REPO_ROOT, 'skills/agent-native-architecture/evals/examples.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sourceRefPath(sourceRef) {
  return sourceRef.split('#')[0];
}

describe('agent-native-architecture eval readiness', () => {
  test('eval examples cover trigger, guardrail, taxonomy, provider, and runtime boundaries', () => {
    const fixture = readJson(EVALS_PATH);

    expect(fixture.schema_version).toBe('spec-first.agent-native-architecture-eval-examples.v1');
    expect(fixture.skill).toBe('agent-native-architecture');
    expect(Array.isArray(fixture.examples)).toBe(true);
    expect(fixture.examples.length).toBeGreaterThanOrEqual(6);

    const ids = new Set();
    const coverageTags = new Set();

    for (const example of fixture.examples) {
      expect(example).toEqual(expect.objectContaining({
        id: expect.any(String),
        user_intent: expect.any(String),
        expected_posture: expect.any(String),
        coverage_tags: expect.any(Array),
        forbidden_signals: expect.any(Array),
        source_refs: expect.any(Array),
      }));
      expect(ids.has(example.id)).toBe(false);
      ids.add(example.id);
      expect(example.coverage_tags.length).toBeGreaterThan(0);
      expect(example.forbidden_signals.length).toBeGreaterThan(0);
      expect(example.source_refs.length).toBeGreaterThan(0);

      for (const tag of example.coverage_tags) {
        coverageTags.add(tag);
      }
    }

    [
      'internal-only',
      'public-route-refusal',
      'guardrail-routing',
      'production-guardrails',
      'action-parity-audit-mapping',
      'taxonomy-mapping',
      'near-neighbor',
      'skill-quality-boundary',
      'spec-skill-audit-handoff',
      'code-review-boundary',
      'spec-agent-native-reviewer-handoff',
      'merged-helper-boundary',
      'audit-playbook-routing',
      'provider-neutral-external-absorption',
      'x-twitter-limitation',
      'runtime-source-boundary',
      'generated-runtime-boundary',
      'failure-mode',
    ].forEach((tag) => {
      expect(coverageTags).toContain(tag);
    });
  });

  test('eval examples remain source-first and provider-neutral', () => {
    const fixture = readJson(EVALS_PATH);
    const serialized = JSON.stringify(fixture, null, 2);

    expect(serialized).not.toMatch(/required spec-first .*OpenAI .*field/i);

    for (const example of fixture.examples) {
      expect(example.expected_posture).not.toContain('spec-agent-native-architecture');
      expect(example.expected_posture).not.toMatch(/model-graded benchmark/i);
      expect(example.expected_posture).not.toMatch(/second implementation plan/i);

      for (const sourceRef of example.source_refs) {
        const refPath = sourceRefPath(sourceRef);

        expect(sourceRef).not.toContain('spec-agent-native-architecture');
        expect(refPath).not.toMatch(/^\.claude\//);
        expect(refPath).not.toMatch(/^\.codex\//);
        expect(refPath).not.toMatch(/^\.agents\/skills\//);
        expect(refPath).not.toMatch(/^docs\/plans\//);
        expect(refPath).not.toMatch(/^docs\/validation\//);
        expect(fs.existsSync(path.join(REPO_ROOT, refPath))).toBe(true);
      }
    }
  });
});
