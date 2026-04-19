'use strict';

const { loadBootstrapRuntimeState } = require('./loader');
const { resolveStage0Entry } = require('./entry-resolver');
const { matchTopologyUnitsForFiles } = require('../bootstrap-compiler/topology');

const LANGUAGE_BY_EXTENSION = {
  '.js': 'javascript',
  '.cjs': 'javascript',
  '.mjs': 'javascript',
  '.jsx': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.py': 'python',
  '.java': 'java',
  '.kt': 'kotlin',
  '.kts': 'kotlin',
  '.swift': 'swift',
  '.rb': 'ruby',
  '.go': 'go',
  '.rs': 'rust',
  '.php': 'php',
  '.proto': 'proto',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.md': 'markdown',
};

const DOC_LIKE_ROOT_FILES = new Set([
  'README.md',
  'CHANGELOG.md',
  'AGENTS.md',
  'CLAUDE.md',
]);
const PLATFORM_PRIORITY = [
  'mobile-ios',
  'mobile-android',
  'web',
  'backend',
  'desktop',
  'shared-contract',
  'cli',
];

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function normalizePath(filePath) {
  return String(filePath || '')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '');
}

function splitPath(filePath) {
  return normalizePath(filePath).split('/').filter(Boolean);
}

function inferLanguage(filePath) {
  const normalized = normalizePath(filePath);
  if (!normalized) return null;
  const extension = normalized.includes('.')
    ? normalized.slice(normalized.lastIndexOf('.')).toLowerCase()
    : '';
  return LANGUAGE_BY_EXTENSION[extension] || null;
}

function isDocsLikeFile(filePath) {
  const normalized = normalizePath(filePath);
  if (!normalized) return false;
  return normalized.startsWith('docs/')
    || normalized.startsWith('.github/')
    || DOC_LIKE_ROOT_FILES.has(normalized)
    || normalized.endsWith('.md');
}

function isTestLikeFile(filePath) {
  const normalized = normalizePath(filePath);
  return /(^|\/)(tests?|__tests__)\//.test(normalized)
    || /\.(test|spec)\.[^/]+$/i.test(normalized);
}

function isPackagingFile(filePath) {
  const normalized = normalizePath(filePath);
  return normalized === 'package.json'
    || normalized.startsWith('bin/')
    || normalized.startsWith('scripts/release')
    || normalized.startsWith('.github/workflows/');
}

function isRuntimeRelevantFile(filePath) {
  if (!filePath) return false;
  if (isDocsLikeFile(filePath)) return false;
  if (isTestLikeFile(filePath)) return false;
  return true;
}

function inferModuleBucket(filePath) {
  const parts = splitPath(filePath);
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];

  if (['src', 'tests', 'docs'].includes(parts[0]) && parts[1] && !parts[1].includes('.')) {
    return `${parts[0]}/${parts[1]}/`;
  }

  return `${parts[0]}/`;
}

function sortPlatforms(platforms) {
  return unique(platforms).sort((left, right) => {
    const leftPriority = PLATFORM_PRIORITY.indexOf(left);
    const rightPriority = PLATFORM_PRIORITY.indexOf(right);
    const safeLeft = leftPriority === -1 ? Number.MAX_SAFE_INTEGER : leftPriority;
    const safeRight = rightPriority === -1 ? Number.MAX_SAFE_INTEGER : rightPriority;
    return safeLeft - safeRight || left.localeCompare(right);
  });
}

function sortStrings(values) {
  return unique(values).sort((left, right) => left.localeCompare(right));
}

function inferPlatformsForFile(filePath) {
  const platforms = [];
  const normalized = normalizePath(filePath);
  const parts = splitPath(normalized);
  const extension = normalized.includes('.')
    ? normalized.slice(normalized.lastIndexOf('.')).toLowerCase()
    : '';

  if (
    normalized.startsWith('ios/')
    || extension === '.swift'
    || normalized.includes('.xcodeproj/')
    || normalized.includes('.xcworkspace/')
  ) {
    platforms.push('mobile-ios');
  }

  if (
    normalized.startsWith('android/')
    || normalized.includes('AndroidManifest.xml')
    || extension === '.kt'
    || extension === '.kts'
    || normalized.endsWith('build.gradle')
    || normalized.endsWith('build.gradle.kts')
  ) {
    platforms.push('mobile-android');
  }

  if (
    normalized.startsWith('src/app/')
    || normalized.startsWith('app/')
    || normalized.startsWith('pages/')
    || normalized.startsWith('components/')
    || normalized.startsWith('public/')
    || ['.tsx', '.jsx', '.css', '.scss', '.sass', '.less', '.html'].includes(extension)
  ) {
    platforms.push('web');
  }

  if (
    normalized.startsWith('server/')
    || normalized.startsWith('api/')
    || normalized.includes('/routes/')
    || normalized.includes('/controllers/')
    || normalized.startsWith('src/main/java/')
    || normalized.startsWith('src/main/kotlin/')
  ) {
    platforms.push('backend');
  }

  if (
    normalized.startsWith('desktop/')
    || normalized.includes('/electron/')
    || normalized.includes('/tauri/')
  ) {
    platforms.push('desktop');
  }

  if (
    normalized.includes('/contracts/')
    || normalized.includes('/schemas/')
    || normalized.includes('/schema/')
    || normalized.includes('/openapi/')
    || extension === '.proto'
    || normalized.endsWith('openapi.yaml')
    || normalized.endsWith('openapi.yml')
    || normalized.endsWith('swagger.yaml')
    || normalized.endsWith('swagger.yml')
  ) {
    platforms.push('shared-contract');
  }

  if (
    normalized.startsWith('src/cli/')
    || normalized.startsWith('skills/')
    || normalized.startsWith('agents/')
    || normalized.startsWith('templates/')
    || normalized.startsWith('bin/')
    || normalized === 'package.json'
  ) {
    platforms.push('cli');
  }

  if (parts[0] === 'src' && platforms.length === 0) {
    platforms.push('cli');
  }

  return unique(platforms);
}

function inferPlatformsFromFiles(changedFiles) {
  const platforms = [];

  for (const filePath of changedFiles) {
    platforms.push(...inferPlatformsForFile(filePath));
  }

  return sortPlatforms(platforms);
}

function gateMatchesScope(scope, context) {
  switch (scope) {
    case 'repository':
      return context.runtimeChange;
    case 'cross-module':
      return context.runtimeChange && (
        context.impactedModules.length > 1
        || context.impactedPlatforms.length > 1
        || context.impactedPlatforms.includes('shared-contract')
        || context.impactedPlatforms.length === 1
      );
    case 'cli-surface':
      return context.impactedPlatforms.includes('cli');
    case 'web-surface':
      return context.impactedPlatforms.includes('web');
    case 'backend':
      return context.impactedPlatforms.includes('backend');
    case 'desktop':
      return context.impactedPlatforms.includes('desktop');
    case 'mobile-ios':
      return context.impactedPlatforms.includes('mobile-ios');
    case 'mobile-android':
      return context.impactedPlatforms.includes('mobile-android');
    case 'shared-contract':
      return context.impactedPlatforms.includes('shared-contract');
    case 'packaging':
      return context.changedFiles.some(isPackagingFile);
    case 'crg-surface':
      return context.impactedModules.some((item) => item === 'src/crg/' || item.startsWith('src/crg/'));
    default:
      return false;
  }
}

function selectRecommendedGates(gates, context) {
  if (!Array.isArray(gates) || gates.length === 0) return [];
  if (!context.runtimeChange) return [];

  const matched = gates.filter((gate) => gateMatchesScope(gate.scope, context));
  if (matched.length > 0) {
    return unique(matched.map((gate) => gate.id));
  }

  const fallback = gates.filter((gate) => gate.scope === 'repository' || gate.scope === 'cross-module');
  if (fallback.length > 0) {
    return unique(fallback.map((gate) => gate.id));
  }

  return unique(gates.map((gate) => gate.id));
}

function determineConfidence({ verificationProfile, runtimeChange, impactedPlatforms, usedProfileFallback }) {
  if (!runtimeChange) return 'low';
  if (!verificationProfile) return impactedPlatforms.length > 0 ? 'medium' : 'low';
  if (impactedPlatforms.length > 0 && !usedProfileFallback) return 'high';
  return 'medium';
}

function resolveProfileLookupLocation({
  repoRoot,
  slug,
  artifactAnchorRoot,
  changedFiles = [],
} = {}) {
  if (!repoRoot) {
    return { slug, artifactAnchorRoot };
  }

  if (slug && artifactAnchorRoot && artifactAnchorRoot !== repoRoot) {
    return { slug, artifactAnchorRoot };
  }

  const entry = resolveStage0Entry({
    cwd: repoRoot,
    target: repoRoot,
    repoRoots: [repoRoot],
    changedFiles,
  });

  if (entry.mode === 'workspace-registered' && entry.matchedChildSlugs.length === 1) {
    return {
      slug: entry.matchedChildSlugs[0],
      artifactAnchorRoot: entry.artifactAnchorRoot,
    };
  }

  return {
    slug,
    artifactAnchorRoot,
  };
}

function summarizeChangeSurface({
  repoRoot,
  slug,
  changedFiles = [],
  verificationProfile = null,
  artifactAnchorRoot = repoRoot,
} = {}) {
  const normalizedFiles = unique((changedFiles || []).map(normalizePath));
  const profileLookup = resolveProfileLookupLocation({
    repoRoot,
    slug,
    artifactAnchorRoot,
    changedFiles: normalizedFiles,
  });
  const runtimeState = verificationProfile || !repoRoot
    ? null
    : loadBootstrapRuntimeState({
      repoRoot,
      slug: profileLookup.slug,
      artifactAnchorRoot: profileLookup.artifactAnchorRoot,
    });
  const profile = verificationProfile || (runtimeState && runtimeState.verificationProfile) || null;
  const topologyModuleMatches = runtimeState && runtimeState.factInventory && runtimeState.factInventory.topology
    ? matchTopologyUnitsForFiles(runtimeState.factInventory.topology, normalizedFiles)
    : [];
  const impactedModules = topologyModuleMatches.length > 0
    ? sortStrings(topologyModuleMatches)
    : sortStrings(normalizedFiles.map(inferModuleBucket));
  const impactedLanguages = sortStrings(normalizedFiles.map(inferLanguage));
  const runtimeFiles = normalizedFiles.filter(isRuntimeRelevantFile);
  const runtimeChange = runtimeFiles.length > 0;
  let impactedPlatforms = runtimeChange ? inferPlatformsFromFiles(runtimeFiles) : [];
  let usedProfileFallback = false;

  if (impactedPlatforms.length === 0 && profile && Array.isArray(profile.platforms)) {
    const fallbackPlatforms = profile.platforms.filter((item) => item && item !== 'unknown');
    if (runtimeChange && fallbackPlatforms.length === 1) {
      impactedPlatforms = fallbackPlatforms;
      usedProfileFallback = true;
    }
  }

  const recommendationContext = {
    changedFiles: normalizedFiles,
    impactedModules,
    impactedPlatforms,
    runtimeChange,
  };

  return {
    impacted_modules: impactedModules,
    impacted_languages: impactedLanguages,
    impacted_platforms: impactedPlatforms,
    recommended_required_verifications: selectRecommendedGates(
      profile && profile.required_gates,
      recommendationContext
    ),
    recommended_optional_verifications: selectRecommendedGates(
      profile && profile.optional_gates,
      recommendationContext
    ),
    confidence: determineConfidence({
      verificationProfile: profile,
      runtimeChange,
      impactedPlatforms,
      usedProfileFallback,
    }),
  };
}

module.exports = {
  inferPlatformsFromFiles,
  summarizeChangeSurface,
};
