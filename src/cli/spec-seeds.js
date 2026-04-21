const fs = require('node:fs');
const path = require('node:path');

const {
  buildFileWriteOperation,
  buildRelativeOperation,
  summarizeOperationPlan,
} = require('./state');

const REPO_ROOT = path.join(__dirname, '..', '..');
const TEMPLATE_ROOT = path.join(REPO_ROOT, 'templates', 'specs');
const SKIPPED_SCAN_DIRS = new Set([
  '.git',
  'node_modules',
  '.claude',
  '.codex',
  '.spec-first',
  'dist',
  'build',
  'coverage',
  'vendor',
]);
const FRONTEND_DEPENDENCIES = new Set([
  'react',
  'react-dom',
  'next',
  'vue',
  'nuxt',
  'svelte',
  '@angular/core',
]);
const BACKEND_DEPENDENCIES = new Set([
  'express',
  'koa',
  'fastify',
  '@nestjs/core',
  'hono',
  'elysia',
]);

function buildSharedSpecSeedPlan(projectRoot) {
  const operations = [
    buildRelativeOperation('ensure_dir', '.spec-first', 'shared_spec_root_dir'),
    buildRelativeOperation('ensure_dir', '.spec-first/specs', 'shared_spec_seed_dir'),
  ];
  const specsRoot = path.join(projectRoot, '.spec-first', 'specs');
  const profilePath = path.join(specsRoot, 'repo-profile.yaml');
  const readmePath = path.join(specsRoot, 'README.md');

  if (!fs.existsSync(profilePath)) {
    operations.push(buildFileWriteOperation(
      projectRoot,
      profilePath,
      renderRepoProfileTemplate(projectRoot),
      'shared_spec_seed_repo_profile',
    ));
  }

  if (!fs.existsSync(readmePath)) {
    operations.push(buildFileWriteOperation(
      projectRoot,
      readmePath,
      readSpecSeedTemplate('README.md'),
      'shared_spec_seed_readme',
    ));
  }

  return {
    operations,
    summary: summarizeOperationPlan(operations),
  };
}

function renderRepoProfileTemplate(projectRoot) {
  const template = readSpecSeedTemplate('repo-profile.yaml');
  const repoId = inferRepoId(projectRoot);
  const projectType = inferProjectType(projectRoot);
  const languages = inferLanguages(projectRoot);
  const summary = inferProjectIntentSummary(projectRoot);

  return template
    .replace('__REPO_ID__', yamlDoubleQuoted(repoId))
    .replace('__PROJECT_TYPE__', yamlDoubleQuoted(projectType))
    .replace('__LANGUAGES__', renderLanguagesValue(languages))
    .replace('__PROJECT_INTENT_SUMMARY__', yamlDoubleQuoted(summary));
}

function readSpecSeedTemplate(fileName) {
  const filePath = path.join(TEMPLATE_ROOT, fileName);
  return fs.readFileSync(filePath, 'utf8');
}

function inferRepoId(projectRoot) {
  return path.basename(path.resolve(projectRoot));
}

function inferProjectType(projectRoot) {
  const packageJson = readPackageJson(projectRoot);
  if (packageJson) {
    return inferProjectTypeFromPackageJson(packageJson);
  }

  if (fs.existsSync(path.join(projectRoot, 'pyproject.toml'))) {
    const content = safeReadFile(path.join(projectRoot, 'pyproject.toml'));
    return /\[project\.scripts\]/.test(content) ? 'cli-tooling' : '';
  }

  if (fs.existsSync(path.join(projectRoot, 'go.mod'))) {
    return fs.existsSync(path.join(projectRoot, 'cmd')) ? 'cli-tooling' : '';
  }

  if (fs.existsSync(path.join(projectRoot, 'Cargo.toml'))) {
    const content = safeReadFile(path.join(projectRoot, 'Cargo.toml'));
    return /\[\[bin\]\]/.test(content) ? 'cli-tooling' : '';
  }

  return '';
}

function inferProjectTypeFromPackageJson(packageJson) {
  const description = String(packageJson.description || '').toLowerCase();
  const dependencies = new Set([
    ...Object.keys(packageJson.dependencies || {}),
    ...Object.keys(packageJson.devDependencies || {}),
    ...Object.keys(packageJson.peerDependencies || {}),
    ...Object.keys(packageJson.optionalDependencies || {}),
  ]);
  const hasCliSignal = Boolean(packageJson.bin)
    || /\bcli\b/.test(description)
    || description.includes('command line');
  const hasAiWorkflowSignal = description.includes('ai') && description.includes('workflow');
  const hasFrontendSignal = [...FRONTEND_DEPENDENCIES].some((name) => dependencies.has(name));
  const hasBackendSignal = [...BACKEND_DEPENDENCIES].some((name) => dependencies.has(name));

  if (hasCliSignal && hasAiWorkflowSignal) {
    return 'ai-workflow-cli';
  }

  if (hasCliSignal) {
    return 'cli-tooling';
  }

  if (hasFrontendSignal && hasBackendSignal) {
    return 'fullstack-app';
  }

  if (hasFrontendSignal) {
    return 'frontend-app';
  }

  if (hasBackendSignal) {
    return 'backend-service';
  }

  return '';
}

function inferLanguages(projectRoot) {
  const languages = [];
  const packageJson = readPackageJson(projectRoot);

  if (packageJson) {
    languages.push(hasTypeScriptSignal(projectRoot, packageJson) ? 'typescript' : 'javascript');
  }

  if (fs.existsSync(path.join(projectRoot, 'pyproject.toml'))) {
    languages.push('python');
  }

  if (fs.existsSync(path.join(projectRoot, 'go.mod'))) {
    languages.push('go');
  }

  if (fs.existsSync(path.join(projectRoot, 'Cargo.toml'))) {
    languages.push('rust');
  }

  if (fs.existsSync(path.join(projectRoot, 'Gemfile')) || findFirstMatchingExtension(projectRoot, ['.gemspec'])) {
    languages.push('ruby');
  }

  if (fs.existsSync(path.join(projectRoot, 'pom.xml')) || fs.existsSync(path.join(projectRoot, 'build.gradle'))) {
    languages.push('java');
  }

  return [...new Set(languages)];
}

function inferProjectIntentSummary(projectRoot) {
  const manifestDescription = inferManifestDescription(projectRoot);
  if (manifestDescription) {
    return manifestDescription;
  }

  const readmeSummary = inferReadmeSummary(projectRoot);
  if (readmeSummary) {
    return readmeSummary;
  }

  return '';
}

function inferManifestDescription(projectRoot) {
  const packageJson = readPackageJson(projectRoot);
  if (packageJson && typeof packageJson.description === 'string' && packageJson.description.trim()) {
    return normalizeSummary(packageJson.description);
  }

  const pyprojectDescription = inferQuotedField(
    safeReadFile(path.join(projectRoot, 'pyproject.toml')),
    /^description\s*=\s*"([^"]+)"/m,
  );
  if (pyprojectDescription) {
    return pyprojectDescription;
  }

  const cargoDescription = inferQuotedField(
    safeReadFile(path.join(projectRoot, 'Cargo.toml')),
    /^description\s*=\s*"([^"]+)"/m,
  );
  if (cargoDescription) {
    return cargoDescription;
  }

  return '';
}

function inferReadmeSummary(projectRoot) {
  const candidates = ['README.md', 'README.zh-CN.md', 'readme.md'];

  for (const fileName of candidates) {
    const content = safeReadFile(path.join(projectRoot, fileName));
    if (!content) continue;

    const lines = content.split(/\r?\n/);
    let index = 0;
    while (index < lines.length && isSkippableReadmeLine(lines[index])) {
      index += 1;
    }

    const paragraph = [];
    while (index < lines.length) {
      const line = lines[index].trim();
      if (!line) break;
      if (line.startsWith('#') || line.startsWith('```')) break;
      if (isBadgeOnlyLine(line)) {
        index += 1;
        continue;
      }
      paragraph.push(line);
      index += 1;
    }

    const summary = normalizeSummary(paragraph.join(' '));
    if (summary) {
      return summary;
    }
  }

  return '';
}

function inferQuotedField(contents, pattern) {
  if (!contents) return '';
  const match = contents.match(pattern);
  return match ? normalizeSummary(match[1]) : '';
}

function readPackageJson(projectRoot) {
  const packagePath = path.join(projectRoot, 'package.json');
  if (!fs.existsSync(packagePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  } catch (_error) {
    return null;
  }
}

function hasTypeScriptSignal(projectRoot, packageJson) {
  const dependencies = new Set([
    ...Object.keys(packageJson.dependencies || {}),
    ...Object.keys(packageJson.devDependencies || {}),
    ...Object.keys(packageJson.peerDependencies || {}),
    ...Object.keys(packageJson.optionalDependencies || {}),
  ]);

  if (dependencies.has('typescript') || dependencies.has('ts-node')) {
    return true;
  }

  if (fs.existsSync(path.join(projectRoot, 'tsconfig.json'))) {
    return true;
  }

  return Boolean(findFirstMatchingExtension(projectRoot, ['.ts', '.tsx']));
}

function findFirstMatchingExtension(projectRoot, extensions, currentDir = projectRoot, depth = 0) {
  if (depth > 4 || !fs.existsSync(currentDir)) {
    return '';
  }

  for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.github') {
      if (SKIPPED_SCAN_DIRS.has(entry.name)) {
        continue;
      }
    } else if (SKIPPED_SCAN_DIRS.has(entry.name)) {
      continue;
    }

    const absolutePath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      const nested = findFirstMatchingExtension(projectRoot, extensions, absolutePath, depth + 1);
      if (nested) return nested;
      continue;
    }

    if (extensions.includes(path.extname(entry.name))) {
      return absolutePath;
    }
  }

  return '';
}

function renderLanguagesValue(languages) {
  if (languages.length === 0) {
    return '[]';
  }

  return `[${languages.map((language) => `"${yamlDoubleQuoted(language)}"`).join(', ')}]`;
}

function yamlDoubleQuoted(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeSummary(text) {
  return String(text || '')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/[`*_>#]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isSkippableReadmeLine(line) {
  const trimmed = String(line || '').trim();
  return !trimmed || trimmed.startsWith('#') || isBadgeOnlyLine(trimmed);
}

function isBadgeOnlyLine(line) {
  return /^(!?\[[^\]]*\]\([^)]+\)\s*)+$/.test(String(line || '').trim());
}

function safeReadFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return '';
  }

  return fs.readFileSync(filePath, 'utf8');
}

module.exports = {
  buildSharedSpecSeedPlan,
  inferLanguages,
  inferProjectIntentSummary,
  inferProjectType,
  inferRepoId,
  normalizeSummary,
  renderRepoProfileTemplate,
};
