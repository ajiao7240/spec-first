'use strict';

const {
  resolveGraphDir,
  resolveGraphDb,
  resolveGraphInputFingerprints,
  resolveWorkflowArtifactDir,
  GRAPH_INPUT_FINGERPRINTS_FILE,
  GRAPH_IGNORE_FILE,
} = require('../../src/crg/artifact-paths');

describe('artifact-paths — happy paths', () => {
  test('resolveGraphDir returns .spec-first/graph under repoRoot', () => {
    expect(resolveGraphDir('/repo')).toBe('/repo/.spec-first/graph');
  });

  test('resolveGraphDb returns graph.db inside graph dir', () => {
    expect(resolveGraphDb('/repo')).toBe('/repo/.spec-first/graph/graph.db');
  });

  test('resolveGraphInputFingerprints returns input-fingerprints.json inside graph dir', () => {
    expect(resolveGraphInputFingerprints('/repo')).toBe(
      '/repo/.spec-first/graph/input-fingerprints.json'
    );
  });

  test('resolveWorkflowArtifactDir returns correct path for quality gate artifacts', () => {
    expect(resolveWorkflowArtifactDir('/repo', 'quality-gates', 'ai-dev-quality-gate')).toBe(
      '/repo/.spec-first/workflows/quality-gates/ai-dev-quality-gate'
    );
  });
});

describe('artifact-paths — edge cases', () => {
  test('resolveWorkflowArtifactDir handles slug with multiple hyphens', () => {
    expect(resolveWorkflowArtifactDir('/repo', 'spec-work', 'my-complex-app')).toBe(
      '/repo/.spec-first/workflows/spec-work/my-complex-app'
    );
  });

  test('resolveWorkflowArtifactDir result contains no double slashes', () => {
    const result = resolveWorkflowArtifactDir('/repo', 'spec-work', 'my-app');
    expect(result).not.toMatch(/\/\//);
  });

  test('resolveWorkflowArtifactDir result has no extra path components beyond slug', () => {
    const result = resolveWorkflowArtifactDir('/repo', 'spec-work', 'my-app');
    // Must end exactly with the slug segment
    expect(result).toMatch(/\/my-app$/);
    expect(result.split('/').slice(-1)[0]).toBe('my-app');
  });

  test('resolveWorkflowArtifactDir throws on empty workflow name', () => {
    expect(() => resolveWorkflowArtifactDir('/repo', '', 'my-app')).toThrow();
  });

  test('resolveWorkflowArtifactDir throws on empty slug', () => {
    expect(() => resolveWorkflowArtifactDir('/repo', 'spec-work', '')).toThrow();
  });
});

describe('artifact-paths — R4 filename constants', () => {
  test('GRAPH_INPUT_FINGERPRINTS_FILE is input-fingerprints.json', () => {
    expect(GRAPH_INPUT_FINGERPRINTS_FILE).toBe('input-fingerprints.json');
  });

  test('GRAPH_IGNORE_FILE is .spec-firstignore (not .spec-first-graphignore)', () => {
    expect(GRAPH_IGNORE_FILE).toBe('.spec-firstignore');
    expect(GRAPH_IGNORE_FILE).not.toBe('.spec-first-graphignore');
  });
});

describe('artifact-paths — no legacy path strings', () => {
  test('module source does not contain spec-first-graph directory string', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../../src/crg/artifact-paths.js'),
      'utf8'
    );
    expect(src).not.toMatch(/spec-first-graph/);
  });

  test('module source does not contain .context/spec-first directory string', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../../src/crg/artifact-paths.js'),
      'utf8'
    );
    expect(src).not.toMatch(/\.context\/spec-first/);
  });
});
