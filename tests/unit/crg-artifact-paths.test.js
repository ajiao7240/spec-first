'use strict';

const {
  resolveGraphDir,
  resolveGraphDb,
  resolveGraphInputFingerprints,
  resolveWorkflowArtifactDir,
  resolveContextDocsDir,
  GRAPH_INPUT_FINGERPRINTS_FILE,
  BOOTSTRAP_ARTIFACT_MANIFEST_FILE,
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

  test('resolveWorkflowArtifactDir returns correct path for bootstrap/my-app', () => {
    expect(resolveWorkflowArtifactDir('/repo', 'bootstrap', 'my-app')).toBe(
      '/repo/.spec-first/workflows/bootstrap/my-app'
    );
  });

  test('resolveContextDocsDir returns docs/contexts/<slug> under repoRoot', () => {
    expect(resolveContextDocsDir('/repo', 'my-app')).toBe('/repo/docs/contexts/my-app');
  });
});

describe('artifact-paths — edge cases', () => {
  test('resolveWorkflowArtifactDir handles slug with multiple hyphens', () => {
    expect(resolveWorkflowArtifactDir('/repo', 'bootstrap', 'my-complex-app')).toBe(
      '/repo/.spec-first/workflows/bootstrap/my-complex-app'
    );
  });

  test('resolveWorkflowArtifactDir result contains no double slashes', () => {
    const result = resolveWorkflowArtifactDir('/repo', 'bootstrap', 'my-app');
    expect(result).not.toMatch(/\/\//);
  });

  test('resolveWorkflowArtifactDir result has no extra path components beyond slug', () => {
    const result = resolveWorkflowArtifactDir('/repo', 'bootstrap', 'my-app');
    // Must end exactly with the slug segment
    expect(result).toMatch(/\/my-app$/);
    expect(result.split('/').slice(-1)[0]).toBe('my-app');
  });

  test('resolveWorkflowArtifactDir throws on empty workflow name', () => {
    expect(() => resolveWorkflowArtifactDir('/repo', '', 'my-app')).toThrow();
  });

  test('resolveWorkflowArtifactDir throws on empty slug', () => {
    expect(() => resolveWorkflowArtifactDir('/repo', 'bootstrap', '')).toThrow();
  });

  test('resolveContextDocsDir result has no double slashes', () => {
    const result = resolveContextDocsDir('/repo', 'my-app');
    expect(result).not.toMatch(/\/\//);
  });
});

describe('artifact-paths — R4 filename constants', () => {
  test('GRAPH_INPUT_FINGERPRINTS_FILE is input-fingerprints.json', () => {
    expect(GRAPH_INPUT_FINGERPRINTS_FILE).toBe('input-fingerprints.json');
  });

  test('BOOTSTRAP_ARTIFACT_MANIFEST_FILE is artifact-manifest.json', () => {
    expect(BOOTSTRAP_ARTIFACT_MANIFEST_FILE).toBe('artifact-manifest.json');
  });

  test('GRAPH_INPUT_FINGERPRINTS_FILE and BOOTSTRAP_ARTIFACT_MANIFEST_FILE are unambiguously different', () => {
    expect(GRAPH_INPUT_FINGERPRINTS_FILE).not.toBe(BOOTSTRAP_ARTIFACT_MANIFEST_FILE);
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
