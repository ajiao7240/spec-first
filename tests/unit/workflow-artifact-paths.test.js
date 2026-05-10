'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { resolveWorkflowArtifactDir } = require('../../src/verification/artifact-paths');

const REPO_ROOT = path.join(__dirname, '..', '..');

describe('workflow artifact paths', () => {
  test('returns workflow-scoped artifact directory under .spec-first/workflows', () => {
    expect(resolveWorkflowArtifactDir('/repo', 'quality-gates', 'ai-dev-quality-gate')).toBe(
      '/repo/.spec-first/workflows/quality-gates/ai-dev-quality-gate'
    );
  });

  test('handles slug with multiple hyphens', () => {
    expect(resolveWorkflowArtifactDir('/repo', 'spec-work', 'my-complex-app')).toBe(
      '/repo/.spec-first/workflows/spec-work/my-complex-app'
    );
  });

  test('uses artifactAnchorRoot when provided', () => {
    expect(resolveWorkflowArtifactDir('/repo', 'verification', 'my-repo', {
      artifactAnchorRoot: '/artifacts',
    })).toBe('/artifacts/.spec-first/workflows/verification/my-repo');
  });

  test('throws on empty workflow name', () => {
    expect(() => resolveWorkflowArtifactDir('/repo', '', 'my-app')).toThrow(
      'resolveWorkflowArtifactDir: workflow must be a non-empty string'
    );
  });

  test('throws on empty slug', () => {
    expect(() => resolveWorkflowArtifactDir('/repo', 'spec-work', '')).toThrow(
      'resolveWorkflowArtifactDir: slug must be a non-empty string'
    );
  });

  test('rejects path traversal and absolute workflow artifact segments', () => {
    const unsafeSegments = [
      '../outside',
      'nested/path',
      'nested\\path',
      '/absolute',
      'C:\\absolute',
      '.',
      '..',
    ];

    for (const segment of unsafeSegments) {
      expect(() => resolveWorkflowArtifactDir('/repo', segment, 'safe')).toThrow(
        'resolveWorkflowArtifactDir: workflow must be a safe path segment'
      );
      expect(() => resolveWorkflowArtifactDir('/repo', 'safe', segment)).toThrow(
        'resolveWorkflowArtifactDir: slug must be a safe path segment'
      );
    }
  });

  test('rejects Windows-incompatible workflow artifact segments', () => {
    const unsafeSegments = [
      'CON',
      'nul.txt',
      'COM1',
      'LPT9.log',
      'has:colon',
      'has*star',
      'has?question',
      'has"quote',
      'has<angle',
      'has|pipe',
      'trailing-dot.',
      'trailing-space ',
    ];

    for (const segment of unsafeSegments) {
      expect(() => resolveWorkflowArtifactDir('/repo', segment, 'safe')).toThrow(
        'resolveWorkflowArtifactDir: workflow must be Windows-compatible'
      );
      expect(() => resolveWorkflowArtifactDir('/repo', 'safe', segment)).toThrow(
        'resolveWorkflowArtifactDir: slug must be Windows-compatible'
      );
    }
  });

  test('doctor and quality gate use verification artifact paths', () => {
    const retiredPath = ['src', 'crg'].join('/');
    const expectedImport = ['verification', 'artifact-paths'].join('/');
    const doctorSource = fs.readFileSync(path.join(REPO_ROOT, 'src/cli/commands/doctor.js'), 'utf8');
    const gateSource = fs.readFileSync(path.join(REPO_ROOT, 'scripts/run-ai-dev-quality-gate.js'), 'utf8');

    expect(doctorSource).not.toContain(retiredPath);
    expect(gateSource).not.toContain(retiredPath);
    expect(doctorSource).toContain(expectedImport);
    expect(gateSource).toContain(expectedImport);
  });
});
