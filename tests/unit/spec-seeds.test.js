'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { runInit } = require('../../src/cli/commands/init');
const {
  buildSharedSpecSeedPlan,
  inferProjectIntentSummary,
  inferProjectType,
  renderRepoProfileTemplate,
} = require('../../src/cli/spec-seeds');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spec-first-spec-seeds-'));
}

function withCwd(cwd, fn) {
  const previous = process.cwd();
  process.chdir(cwd);
  try {
    return fn();
  } finally {
    process.chdir(previous);
  }
}

describe('spec seeds', () => {
  test('shared spec seed plan writes repo-profile and README with deterministic initial draft', () => {
    const projectRoot = makeTempDir();

    try {
      fs.writeFileSync(path.join(projectRoot, 'package.json'), JSON.stringify({
        name: 'demo-cli',
        description: 'AI workflow CLI for repo-aware planning.',
        bin: {
          demo: 'bin/demo.js',
        },
      }, null, 2));

      const plan = buildSharedSpecSeedPlan(projectRoot);
      const profileOperation = plan.operations.find((entry) => entry.path === '.spec-first/specs/repo-profile.yaml');
      const readmeOperation = plan.operations.find((entry) => entry.path === '.spec-first/specs/README.md');

      expect(plan.summary.ensure_dir).toBe(2);
      expect(profileOperation).toBeDefined();
      expect(readmeOperation).toBeDefined();
      expect(profileOperation.kind).toBe('write_file');
      expect(profileOperation.contents).toContain('schema_version: 1');
      expect(profileOperation.contents).toContain('repo_id: "');
      expect(profileOperation.contents).toContain('project_type: "ai-workflow-cli"');
      expect(profileOperation.contents).toContain('summary: "AI workflow CLI for repo-aware planning."');
      expect(profileOperation.contents).toContain('languages: ["javascript"]');
      expect(profileOperation.contents).toContain('principles: []');
      expect(profileOperation.contents).toContain('non_negotiables: []');
      expect(profileOperation.contents).toContain('review_defaults: []');
      expect(readmeOperation.contents).toContain('add-only');
      expect(readmeOperation.contents).toContain('clean --claude');
      expect(readmeOperation.contents).toContain('repo truth engine');
      expect(readmeOperation.contents).toContain('高置信度输入');
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('shared spec seed plan keeps existing user-owned seed files untouched', () => {
    const projectRoot = makeTempDir();
    const specsRoot = path.join(projectRoot, '.spec-first', 'specs');

    try {
      fs.mkdirSync(specsRoot, { recursive: true });
      fs.writeFileSync(path.join(specsRoot, 'repo-profile.yaml'), 'repo_id: "custom"\n', 'utf8');
      fs.writeFileSync(path.join(specsRoot, 'README.md'), '# custom\n', 'utf8');

      const plan = buildSharedSpecSeedPlan(projectRoot);

      expect(plan.operations).toEqual([
        expect.objectContaining({ kind: 'ensure_dir', path: '.spec-first' }),
        expect.objectContaining({ kind: 'ensure_dir', path: '.spec-first/specs' }),
      ]);
      expect(plan.summary).toEqual({ ensure_dir: 2 });
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('project intent summary uses README before falling back to empty string', () => {
    const projectRoot = makeTempDir();

    try {
      fs.writeFileSync(path.join(projectRoot, 'README.md'), [
        '# Demo Project',
        '',
        'Ship a small planning helper for repository bootstrap.',
        '',
        '## Details',
      ].join('\n'));

      expect(inferProjectIntentSummary(projectRoot, {
        repoId: 'demo-project',
        projectType: 'library',
      })).toBe('Ship a small planning helper for repository bootstrap.');

      fs.rmSync(path.join(projectRoot, 'README.md'));

      expect(inferProjectIntentSummary(projectRoot)).toBe('');
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('project intent summary keeps markdown link text instead of URL', () => {
    const projectRoot = makeTempDir();

    try {
      fs.writeFileSync(path.join(projectRoot, 'README.md'), [
        '# Demo Project',
        '',
        '[Spec First](https://example.com) helps plan repos.',
      ].join('\n'));

      expect(inferProjectIntentSummary(projectRoot)).toBe('Spec First helps plan repos.');
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('project type inference keeps cli classification deterministic', () => {
    const projectRoot = makeTempDir();

    try {
      fs.writeFileSync(path.join(projectRoot, 'package.json'), JSON.stringify({
        name: 'toolbox',
        description: 'CLI for project automation',
        bin: {
          toolbox: 'bin/toolbox.js',
        },
      }, null, 2));

      expect(inferProjectType(projectRoot)).toBe('cli-tooling');
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('project type inference does not treat client packages as cli tooling', () => {
    const projectRoot = makeTempDir();

    try {
      fs.writeFileSync(path.join(projectRoot, 'package.json'), JSON.stringify({
        name: 'api-client',
      }, null, 2));

      expect(inferProjectType(projectRoot)).toBe('');
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('project type inference does not treat private packages as fullstack apps by default', () => {
    const projectRoot = makeTempDir();

    try {
      fs.writeFileSync(path.join(projectRoot, 'package.json'), JSON.stringify({
        name: 'internal-lib',
        private: true,
      }, null, 2));
      fs.mkdirSync(path.join(projectRoot, 'src'), { recursive: true });
      fs.writeFileSync(path.join(projectRoot, 'src', 'index.ts'), 'export const x = 1;\n', 'utf8');

      expect(inferProjectType(projectRoot)).toBe('');
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('repo profile template keeps empty scaffold values when no high-confidence signals exist', () => {
    const projectRoot = makeTempDir();

    try {
      const profile = renderRepoProfileTemplate(projectRoot);

      expect(profile).toContain('languages: []');
      expect(profile).toContain('project_type: ""');
      expect(profile).toContain('summary: ""');
      expect(profile).not.toContain('unknown');
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('Codex init materializes shared spec seeds and re-init keeps user edits', () => {
    const projectRoot = makeTempDir();
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      fs.writeFileSync(path.join(projectRoot, 'package.json'), JSON.stringify({
        name: 'demo-codex',
        description: 'CLI for repo planning',
        bin: {
          demo: 'bin/demo.js',
        },
      }, null, 2));

      expect(withCwd(projectRoot, () => runInit(['--codex', '-u', 'reviewer', '--lang', 'zh']))).toBe(0);

      const profilePath = path.join(projectRoot, '.spec-first/specs/repo-profile.yaml');
      const original = fs.readFileSync(profilePath, 'utf8');
      expect(original).toContain('repo_id: "');

      fs.writeFileSync(profilePath, 'repo_id: "custom"\n', 'utf8');
      expect(withCwd(projectRoot, () => runInit(['--codex', '-u', 'reviewer', '--lang', 'zh']))).toBe(0);

      expect(fs.readFileSync(profilePath, 'utf8')).toBe('repo_id: "custom"\n');
      expect(fs.existsSync(path.join(projectRoot, '.spec-first/specs/README.md'))).toBe(true);
    } finally {
      logSpy.mockRestore();
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
