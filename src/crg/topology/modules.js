'use strict';

const fs = require('fs');
const path = require('node:path');

const { resolveRepoTopology } = require('../artifact-paths');
const { sanitizeSlugPart } = require('../workspace/artifacts');

function toPosixPath(filePath) {
  return String(filePath || '').replace(/\\/g, '/');
}

function makeLimitation(code, message, extra = {}) {
  return { code, message, ...extra };
}

function isInsideRoot(rootPath, targetPath) {
  const root = path.resolve(rootPath);
  const target = path.resolve(targetPath);
  const relativePath = path.relative(root, target);
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

function resolveExistingPath(targetPath) {
  try {
    return fs.realpathSync.native(targetPath);
  } catch (_) {
    return path.resolve(targetPath);
  }
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
}

function stripXmlComments(content) {
  return String(content || '').replace(/<!--[\s\S]*?-->/g, '');
}

function extractMavenModules(pomContent) {
  const clean = stripXmlComments(pomContent);
  const limitations = [];
  const modules = [];
  const modulesBlockPattern = /<modules\b[^>]*>([\s\S]*?)<\/modules>/g;
  let blockMatch;
  let foundModulesTag = false;

  while ((blockMatch = modulesBlockPattern.exec(clean)) !== null) {
    foundModulesTag = true;
    const blockContent = blockMatch[1];
    const openCount = (blockContent.match(/<module\b[^>]*>/g) || []).length;
    const closeCount = (blockContent.match(/<\/module>/g) || []).length;
    let modulesInBlock = 0;
    const modulePattern = /<module\b[^>]*>([\s\S]*?)<\/module>/g;
    let moduleMatch;
    while ((moduleMatch = modulePattern.exec(blockContent)) !== null) {
      modulesInBlock++;
      const modulePath = moduleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim();
      if (modulePath) modules.push(modulePath);
    }
    if (openCount !== closeCount || (openCount > 0 && modulesInBlock === 0)) {
      limitations.push(makeLimitation('module_config_malformed', 'Maven pom.xml contains malformed <module> entries.'));
    } else if (openCount === 0) {
      limitations.push(makeLimitation('module_config_malformed', 'Maven pom.xml contains an empty <modules> block.'));
    } else if (modulesInBlock > 0 && modules.length === 0) {
      limitations.push(makeLimitation('module_config_malformed', 'Maven pom.xml contains empty <module> entries.'));
    }
  }

  if (!foundModulesTag && /<modules\b[^>]*>/.test(clean)) {
    limitations.push(makeLimitation('module_config_malformed', 'Maven pom.xml contains an unclosed <modules> block.'));
  }

  return { modules, foundModulesTag, limitations };
}

function detectMavenTopology(repoRoot) {
  const pomPath = path.join(repoRoot, 'pom.xml');
  if (!fs.existsSync(pomPath)) {
    return {
      detector: 'maven',
      detected: false,
      units: [],
      limitations: [],
      signals: [],
    };
  }

  let content;
  try {
    content = fs.readFileSync(pomPath, 'utf8');
  } catch (error) {
    return {
      detector: 'maven',
      detected: false,
      units: [],
      limitations: [
        makeLimitation('module_config_malformed', 'Maven pom.xml could not be read.', {
          path: pomPath,
          detail: error && error.message ? error.message : String(error),
        }),
      ],
      signals: [],
    };
  }

  const extracted = extractMavenModules(content);
  if (!extracted.foundModulesTag && extracted.modules.length === 0) {
    return {
      detector: 'maven',
      detected: false,
      units: [],
      limitations: extracted.limitations,
      signals: [],
    };
  }

  const repoRealRoot = resolveExistingPath(repoRoot);
  const rejectedModuleLimitations = [];
  const units = extracted.modules.flatMap((modulePath) => {
    const moduleRoot = path.resolve(repoRoot, modulePath);
    const moduleExists = fs.existsSync(moduleRoot);
    const moduleComparableRoot = moduleExists
      ? resolveExistingPath(moduleRoot)
      : null;
    const relativePath = toPosixPath(path.relative(repoRoot, moduleRoot));
    if (!isInsideRoot(repoRoot, moduleRoot) || (moduleExists && !isInsideRoot(repoRealRoot, moduleComparableRoot))) {
      rejectedModuleLimitations.push(makeLimitation('module_path_outside_repo', 'Declared Maven module path escapes the repository root.', {
        path: modulePath,
      }));
      return [];
    }
    return [{
      id: `maven:${sanitizeSlugPart(relativePath) || 'module'}`,
      name: path.basename(modulePath),
      path: relativePath,
      absolute_path: moduleRoot,
      detector: 'maven',
      exists: moduleExists,
      signals: ['module_declaration_detected'],
      limitations: moduleExists ? [] : [
        makeLimitation('module_path_missing', 'Declared Maven module path does not exist.', {
          path: relativePath,
        }),
      ],
    }];
  });

  const missingLimitations = units.flatMap((unit) => unit.limitations);
  return {
    detector: 'maven',
    detected: true,
    units,
    limitations: [
      ...extracted.limitations,
      ...rejectedModuleLimitations,
      ...missingLimitations,
    ],
    signals: ['module_declaration_detected'],
  };
}

function detectRepoTopology(repoRootInput) {
  const repoRoot = path.resolve(repoRootInput || process.cwd());
  const maven = detectMavenTopology(repoRoot);
  const units = maven.units;
  const kind = units.length > 0 ? 'monorepo_multi_module' : 'single_repo';

  return {
    schema_version: 'repo-topology/v1',
    repo_root: repoRoot,
    generated_at: new Date().toISOString(),
    kind,
    detectors: ['maven'],
    units,
    signals: maven.signals,
    limitations: maven.limitations,
  };
}

function writeRepoTopology(repoRoot, topology = detectRepoTopology(repoRoot)) {
  writeJson(resolveRepoTopology(repoRoot), topology);
  return topology;
}

function readRepoTopology(repoRootInput) {
  const repoRoot = path.resolve(repoRootInput || process.cwd());
  const topologyPath = resolveRepoTopology(repoRoot);
  if (!fs.existsSync(topologyPath)) {
    return {
      schema_version: 'repo-topology/v1',
      source: 'missing',
      repo_root: repoRoot,
      kind: 'unknown',
      detectors: [],
      units: [],
      signals: [],
      limitations: [{
        code: 'repo-topology-missing',
        message: 'repo-topology.json is not available yet.',
      }],
    };
  }

  try {
    return {
      source: 'artifact',
      ...JSON.parse(fs.readFileSync(topologyPath, 'utf8')),
    };
  } catch (error) {
    return {
      schema_version: 'repo-topology/v1',
      source: 'invalid',
      repo_root: repoRoot,
      kind: 'unknown',
      detectors: [],
      units: [],
      signals: [],
      limitations: [{
        code: 'repo-topology-invalid',
        message: error && error.message ? error.message : String(error),
      }],
    };
  }
}

module.exports = {
  detectRepoTopology,
  extractMavenModules,
  isInsideRoot,
  readRepoTopology,
  writeRepoTopology,
};
