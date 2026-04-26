'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { resolveRepoTopology } = require('../../src/crg/artifact-paths');
const {
  detectRepoTopology,
  extractMavenModules,
  readRepoTopology,
  writeRepoTopology,
} = require('../../src/crg/topology/modules');
const { validateAgainstSchema } = require('../../src/contracts/schema-validator');

const REPO_ROOT = path.join(__dirname, '..', '..');

function makeTempRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spec-first-topology-'));
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8'));
}

describe('crg repo topology modules', () => {
  test('extracts Maven modules from comments and multiline modules blocks', () => {
    const result = extractMavenModules(`
      <project>
        <!-- <module>ignored</module> -->
        <modules>
          <module>
            service-a
          </module>
          <module>libs/core</module>
        </modules>
      </project>
    `);

    expect(result.modules).toEqual(['service-a', 'libs/core']);
    expect(result.limitations).toEqual([]);
  });

  test('Maven reactor modules produce monorepo_multi_module topology', () => {
    const repo = makeTempRepo();
    fs.mkdirSync(path.join(repo, 'service-a'), { recursive: true });
    fs.mkdirSync(path.join(repo, 'service-b'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'pom.xml'), `
      <project>
        <modules>
          <module>service-a</module>
          <module>service-b</module>
        </modules>
      </project>
    `);

    const topology = detectRepoTopology(repo);

    expect(topology.kind).toBe('monorepo_multi_module');
    expect(topology.units.map((unit) => unit.path)).toEqual(['service-a', 'service-b']);
    expect(topology.signals).toContain('module_declaration_detected');
    expect(topology.units.every((unit) => unit.exists)).toBe(true);
  });

  test('single repo without module declarations remains single_repo', () => {
    const repo = makeTempRepo();
    fs.writeFileSync(path.join(repo, 'package.json'), JSON.stringify({ name: 'single' }));

    const topology = detectRepoTopology(repo);

    expect(topology.kind).toBe('single_repo');
    expect(topology.units).toEqual([]);
  });

  test('missing Maven module path is a limitation, not a hard failure', () => {
    const repo = makeTempRepo();
    fs.writeFileSync(path.join(repo, 'pom.xml'), `
      <project>
        <modules>
          <module>missing-module</module>
        </modules>
      </project>
    `);

    const topology = detectRepoTopology(repo);

    expect(topology.kind).toBe('monorepo_multi_module');
    expect(topology.units[0].exists).toBe(false);
    expect(topology.limitations).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'module_path_missing' }),
    ]));
  });

  test('Maven module paths outside the repo are rejected as limitations', () => {
    const parent = makeTempRepo();
    const repo = path.join(parent, 'repo');
    const sibling = path.join(parent, 'sibling');
    fs.mkdirSync(repo, { recursive: true });
    fs.mkdirSync(sibling, { recursive: true });
    fs.writeFileSync(path.join(repo, 'pom.xml'), `
      <project>
        <modules>
          <module>../sibling</module>
        </modules>
      </project>
    `);

    const topology = detectRepoTopology(repo);

    expect(topology.kind).toBe('single_repo');
    expect(topology.units).toEqual([]);
    expect(topology.limitations).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'module_path_outside_repo' }),
    ]));
  });

  test('malformed and empty Maven module declarations produce limitations', () => {
    const malformed = extractMavenModules('<project><modules><module>service-a</modules></project>');
    const empty = extractMavenModules('<project><modules></modules></project>');

    expect(malformed.limitations).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'module_config_malformed' }),
    ]));
    expect(empty.limitations).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'module_config_malformed' }),
    ]));
  });

  test('repo-topology artifact validates against contract and can be read back', () => {
    const repo = makeTempRepo();
    fs.mkdirSync(path.join(repo, 'service-a'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'pom.xml'), `
      <project>
        <modules>
          <module>service-a</module>
        </modules>
      </project>
    `);

    const topology = writeRepoTopology(repo);
    const schema = readJson('docs/contracts/crg/repo-topology.schema.json');
    const loaded = readRepoTopology(repo);

    expect(fs.existsSync(resolveRepoTopology(repo))).toBe(true);
    expect(validateAgainstSchema(schema, topology).errors).toEqual([]);
    expect(loaded.source).toBe('artifact');
    expect(loaded.kind).toBe('monorepo_multi_module');
  });
});
