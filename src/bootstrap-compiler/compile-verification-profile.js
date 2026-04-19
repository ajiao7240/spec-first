'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { buildVerifierHintsFromRegistry } = require('../context-routing/verifier-registry');

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function safeReadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function readPackageJson(repoRoot) {
  if (!repoRoot) return null;
  return safeReadJson(path.join(repoRoot, 'package.json'));
}

function pathExists(repoRoot, relativePath) {
  return Boolean(repoRoot) && fs.existsSync(path.join(repoRoot, relativePath));
}

function hasAnyPath(repoRoot, relativePaths) {
  return relativePaths.some((relativePath) => pathExists(repoRoot, relativePath));
}

function hasDirectoryWithSuffix(repoRoot, suffix) {
  if (!repoRoot) return false;
  try {
    return fs.readdirSync(repoRoot).some((entry) => entry.endsWith(suffix));
  } catch {
    return false;
  }
}

function normalizeLanguage(language) {
  const value = String(language || '').trim().toLowerCase();
  if (!value) return null;

  const aliases = {
    javascript: 'javascript',
    js: 'javascript',
    typescript: 'typescript',
    ts: 'typescript',
    python: 'python',
    py: 'python',
    java: 'java',
    kotlin: 'kotlin',
    swift: 'swift',
    ruby: 'ruby',
    go: 'go',
    rust: 'rust',
  };

  return aliases[value] || value;
}

function inferLanguages({ factInventory, pkg }) {
  const languages = [];
  const primaryLanguage = factInventory && factInventory.project_identity
    ? factInventory.project_identity.primary_language
    : null;
  const normalizedPrimary = normalizeLanguage(primaryLanguage);
  if (normalizedPrimary) languages.push(normalizedPrimary);

  if (pkg) {
    if (pkg.type === 'commonjs' || pkg.type === 'module' || pkg.bin) {
      languages.push('javascript');
    }
    const dependencies = {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
    };
    if (dependencies.typescript || dependencies['ts-node']) {
      languages.push('typescript');
    }
  }

  return unique(languages);
}

function inferTestFrameworks({ repoRoot, factInventory, testSurface, pkg }) {
  const frameworks = [];
  const primaryFrameworks = factInventory
    && factInventory.project_identity
    && Array.isArray(factInventory.project_identity.primary_frameworks)
    ? factInventory.project_identity.primary_frameworks
    : [];
  const combinedText = primaryFrameworks.join(' ').toLowerCase();

  if (combinedText.includes('jest')) frameworks.push('jest');
  if (combinedText.includes('playwright')) frameworks.push('playwright');
  if (combinedText.includes('pytest')) frameworks.push('pytest');
  if (combinedText.includes('xctest')) frameworks.push('xctest');

  if (Array.isArray(testSurface && testSurface.test_files)) {
    for (const testFile of testSurface.test_files) {
      const testPath = String(testFile.path || '').toLowerCase();
      if (testPath.includes('playwright')) frameworks.push('playwright');
      if (testPath.includes('cypress')) frameworks.push('cypress');
      if (testPath.includes('pytest')) frameworks.push('pytest');
    }
  }

  if (repoRoot) {
    if (hasAnyPath(repoRoot, ['playwright.config.js', 'playwright.config.ts', 'playwright.config.mjs'])) {
      frameworks.push('playwright');
    }
    if (hasAnyPath(repoRoot, ['cypress.config.js', 'cypress.config.ts'])) {
      frameworks.push('cypress');
    }
    if (hasAnyPath(repoRoot, ['pytest.ini', 'conftest.py'])) {
      frameworks.push('pytest');
    }
    if (
      pathExists(repoRoot, 'Package.swift')
      || hasDirectoryWithSuffix(repoRoot, '.xcodeproj')
      || hasDirectoryWithSuffix(repoRoot, '.xcworkspace')
    ) {
      frameworks.push('xctest');
    }
  }

  if (pkg) {
    const dependencies = {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
    };
    if (dependencies.jest) frameworks.push('jest');
    if (dependencies.pytest) frameworks.push('pytest');
    if (dependencies['@playwright/test']) frameworks.push('playwright');
    if (dependencies.cypress) frameworks.push('cypress');
  }

  return unique(frameworks);
}

function inferPlatforms({ repoRoot, factInventory, pkg, frameworks }) {
  const platforms = [];
  const projectIdentity = factInventory && factInventory.project_identity ? factInventory.project_identity : {};
  const primaryFrameworks = Array.isArray(projectIdentity.primary_frameworks) ? projectIdentity.primary_frameworks : [];
  const modules = Array.isArray(factInventory && factInventory.modules) ? factInventory.modules : [];
  const repoShape = String(projectIdentity.repo_shape || '').toLowerCase();
  const frameworkText = primaryFrameworks.join(' ').toLowerCase();
  const modulePaths = modules.map((entry) => String(entry.path || '').toLowerCase());
  const dependencyNames = pkg
    ? Object.keys({
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
    }).join(' ').toLowerCase()
    : '';

  if (
    frameworkText.includes('cli') ||
    repoShape.includes('cli') ||
    (pkg && pkg.bin)
  ) {
    platforms.push('cli');
  }

  if (
    frameworks.includes('playwright') ||
    frameworks.includes('cypress') ||
    hasAnyPath(repoRoot, ['src/app', 'app', 'pages', 'public']) ||
    /react|next|vue|nuxt|svelte/.test(dependencyNames)
  ) {
    platforms.push('web');
  }

  if (
    hasAnyPath(repoRoot, ['ios']) ||
    frameworkText.includes('xcode') ||
    frameworkText.includes('swift') ||
    repoShape.includes('ios')
  ) {
    platforms.push('mobile-ios');
  }

  if (
    hasAnyPath(repoRoot, ['android']) ||
    pathExists(repoRoot, 'app/src/main/AndroidManifest.xml') ||
    repoShape.includes('android')
  ) {
    platforms.push('mobile-android');
  }

  if (
    modulePaths.some((entry) => /server|api|routes|controllers/.test(entry)) ||
    /express|koa|fastify|nest|spring|django|flask|fastapi/.test(dependencyNames) ||
    repoShape.includes('service') ||
    repoShape.includes('backend')
  ) {
    platforms.push('backend');
  }

  if (
    /electron|tauri/.test(dependencyNames) ||
    modulePaths.some((entry) => entry.includes('desktop')) ||
    repoShape.includes('desktop')
  ) {
    platforms.push('desktop');
  }

  if (
    modulePaths.some((entry) => /contracts|schema|proto|openapi/.test(entry)) ||
    repoShape.includes('contract')
  ) {
    platforms.push('shared-contract');
  }

  const uniquePlatforms = unique(platforms);
  return uniquePlatforms.length > 0 ? uniquePlatforms : ['unknown'];
}

function buildGate({
  id,
  kind,
  scope,
  required,
  reason,
  suggestedCommands = [],
  evidenceType,
}) {
  return {
    id,
    kind,
    scope,
    required,
    reason,
    suggested_commands: suggestedCommands,
    evidence_type: evidenceType,
  };
}

function inferGates({ pkg, platforms, frameworks }) {
  const scripts = pkg && pkg.scripts ? pkg.scripts : {};
  const requiredGates = [];
  const optionalGates = [];

  if (scripts['test:unit']) {
    requiredGates.push(buildGate({
      id: 'unit-tests',
      kind: 'automated-test',
      scope: 'repository',
      required: true,
      reason: '仓库声明了 test:unit 脚本，可作为基础回归门。',
      suggestedCommands: ['npm run test:unit'],
      evidenceType: 'command-output',
    }));
  }

  if (scripts['test:smoke']) {
    requiredGates.push(buildGate({
      id: 'smoke-tests',
      kind: 'automated-test',
      scope: platforms.includes('cli') ? 'cli-surface' : 'repository',
      required: true,
      reason: '仓库声明了 test:smoke 脚本，可作为主用户路径 smoke gate。',
      suggestedCommands: ['npm run test:smoke'],
      evidenceType: 'command-output',
    }));
  }

  if (scripts['test:integration']) {
    requiredGates.push(buildGate({
      id: 'integration-tests',
      kind: 'automated-test',
      scope: 'cross-module',
      required: true,
      reason: '仓库声明了 test:integration 脚本，可作为跨模块回归门。',
      suggestedCommands: ['npm run test:integration'],
      evidenceType: 'command-output',
    }));
  }

  if (scripts['test:e2e:crg']) {
    optionalGates.push(buildGate({
      id: 'crg-e2e-tests',
      kind: 'automated-test',
      scope: 'crg-surface',
      required: false,
      reason: '仓库声明了 test:e2e:crg，可作为 CRG 子系统补充证据。',
      suggestedCommands: ['npm run test:e2e:crg'],
      evidenceType: 'command-output',
    }));
  }

  if (scripts['test:release']) {
    optionalGates.push(buildGate({
      id: 'release-tests',
      kind: 'release-gate',
      scope: 'packaging',
      required: false,
      reason: '仓库声明了 test:release，可作为发版路径补充验证。',
      suggestedCommands: ['npm run test:release'],
      evidenceType: 'command-output',
    }));
  }

  if (frameworks.includes('playwright') && !scripts['test:smoke']) {
    optionalGates.push(buildGate({
      id: 'browser-evidence',
      kind: 'browser-verification',
      scope: 'web-surface',
      required: false,
      reason: '检测到 Playwright/browser 信号，但仓库未声明统一 smoke 脚本。',
      suggestedCommands: [],
      evidenceType: 'browser-evidence',
    }));
  }

  return { requiredGates, optionalGates };
}

function inferVerifierHints({ platforms, pkg }) {
  const hints = buildVerifierHintsFromRegistry({ platforms });
  const scripts = pkg && pkg.scripts ? pkg.scripts : {};
  const repoScriptAvailable = Object.keys(scripts).some((key) => key.startsWith('test'));

  if (repoScriptAvailable) {
    hints.push({
      verifier: 'repo-test-command',
      platforms,
      available: true,
      prerequisites: [],
      evidence_outputs: ['command-output'],
    });
  }

  return hints;
}

function inferEnvironmentPrerequisites({ pkg, platforms }) {
  const requirements = [];

  if (pkg && pkg.engines && pkg.engines.node) {
    requirements.push(`node ${pkg.engines.node}`);
  }
  if (platforms.includes('mobile-ios')) {
    requirements.push('xcodebuildmcp');
  }

  return unique(requirements);
}

function determineConfidence({ platforms, frameworks, pkg, factInventory }) {
  let score = 0;
  if (pkg) score += 1;
  if (factInventory && factInventory.project_identity) score += 1;
  if (platforms.length > 0 && !platforms.includes('unknown')) score += 1;
  if (frameworks.length > 0) score += 1;

  if (score >= 4) return 'high';
  if (score >= 2) return 'medium';
  return 'low';
}

function buildVerificationProfile({
  generatedAt = '2026-04-15T00:00:00.000Z',
  repoRoot,
  factInventory,
  testSurface,
} = {}) {
  const pkg = readPackageJson(repoRoot);
  const languages = inferLanguages({ factInventory, pkg });
  const frameworks = inferTestFrameworks({ repoRoot, factInventory, testSurface, pkg });
  const platforms = inferPlatforms({ repoRoot, factInventory, pkg, frameworks });
  const { requiredGates, optionalGates } = inferGates({ pkg, platforms, frameworks });
  const verifierHints = inferVerifierHints({ platforms, pkg });
  const environmentPrerequisites = inferEnvironmentPrerequisites({ pkg, platforms });
  const confidence = determineConfidence({ platforms, frameworks, pkg, factInventory });
  const fallbackReason = platforms.includes('unknown') && frameworks.length === 0
    ? 'verification_signals_missing'
    : null;

  return {
    schema_version: 'v1',
    generated_at: generatedAt,
    profile_id: unique([...platforms, ...frameworks]).join('+') || 'unknown',
    platforms,
    languages,
    detected_test_frameworks: frameworks,
    required_gates: requiredGates,
    optional_gates: optionalGates,
    verifier_hints: verifierHints,
    environment_prerequisites: environmentPrerequisites,
    confidence,
    fallback_reason: fallbackReason,
  };
}

module.exports = {
  buildVerificationProfile,
};
