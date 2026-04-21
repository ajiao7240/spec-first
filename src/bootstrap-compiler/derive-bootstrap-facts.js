'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { buildRepoTopology } = require('./topology');

const LANGUAGE_LABELS = {
  '.js': 'JavaScript',
  '.cjs': 'JavaScript',
  '.mjs': 'JavaScript',
  '.jsx': 'JavaScript',
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript',
  '.py': 'Python',
  '.rb': 'Ruby',
  '.go': 'Go',
  '.java': 'Java',
  '.kt': 'Kotlin',
  '.kts': 'Kotlin',
  '.swift': 'Swift',
  '.rs': 'Rust',
};

const SKIP_ROOTS = new Set([
  '.git',
  'node_modules',
  '.spec-first',
  '.claude',
  '.codex',
  '.agents',
  '.playwright-mcp',
  'docs/contexts',
]);

const RUNTIME_EXTENSION_RE = /\.(cjs|go|java|js|jsx|kt|kts|mjs|py|rb|rs|swift|ts|tsx)$/i;
const TEST_FILE_RE = /(^|\/)(tests?|__tests__)\/|(\.test\.|\.(spec)\.)/i;
const TEXT_SCAN_EXTENSION_RE = /\.(cjs|conf|env|go|ini|java|js|json|kt|kts|md|mjs|properties|py|rb|sh|sql|toml|ts|tsx|txt|ya?ml)$/i;
const DATABASE_SCAN_PATH_HINT_RE = /(^|\/)(\.env[^/]*|config\/|docker-compose|compose\.(ya?ml)|.*(database|mysql|postgres|sqlite|mongo|prisma|knex|typeorm|sequelize|datasource|connection|application).*)$/i;
const DATABASE_CODE_PATH_RE = /(^|\/)(db|database|datasource|connection|env|settings)\.(cjs|go|java|js|jsx|kt|kts|mjs|py|rb|rs|swift|ts|tsx)$/i;
const DATABASE_MIGRATION_PATH_RE = /(^|\/)((db\/)?migrations?|db\/migrate|alembic\/versions)\//i;
const DATABASE_DOC_TOKEN_RE = /(^|[-_.])(database|schema|er|db)([-_.]|$)/i;
const DATABASE_CONNECTION_HINT_RE = /(adapter|datasource|spring\.datasource|database_url|jdbc:(mysql|postgresql|sqlite)|mysql2?|mariadb|postgres|postgresql|mongodb|mongo:\/\/|redis|createPool|createConnection|create_engine|new PrismaClient|knex\(|sequelize|typeorm|DATABASES\s*=|establish_connection|gorm\.Open|sql\.Open)/i;
const DATABASE_SCHEMA_HINT_RE = /(create\s+table|alter\s+table|references\s+[a-z_][a-z0-9_]*|schema\.prisma|datasource\s+[a-z_][a-z0-9_]*|erdiagram|mermaid|table\s+[a-z_][a-z0-9_]*|CreateModel|op\.create_table|create_table|ActiveRecord::Schema|type\s+\w+\s+struct|Column\()/i;
const NON_PROJECT_DOC_PREFIXES = [
  'docs/10-prompt/',
  'docs/brainstorms/',
  'docs/contracts/',
  'docs/ideation/',
  'docs/plans/',
  'docs/solutions/',
];
const DATABASE_TYPE_PATTERNS = [
  { type: 'mysql', pattern: /(mysql2?|mariadb|mysql:\/\/|jdbc:mysql|mysql-connector-j|django\.db\.backends\.mysql|mysqlclient)/i },
  { type: 'postgres', pattern: /(postgres|postgresql|pg_|postgres:\/\/|jdbc:postgresql|django\.db\.backends\.postgresql)/i },
  { type: 'sqlite', pattern: /(sqlite|\.sqlite3?|jdbc:sqlite|django\.db\.backends\.sqlite3)/i },
  { type: 'mongodb', pattern: /(mongodb|mongo:\/\/)/i },
];
const DATABASE_KEY_SUFFIXES = [
  'DATABASE_URL',
  'DB_URL',
  'DB_HOST',
  'DB_PORT',
  'DB_USER',
  'DB_USERNAME',
  'DB_PASS',
  'DB_PASSWORD',
  'DB_NAME',
  'DB_DATABASE',
  'MYSQL_URL',
  'MYSQL_HOST',
  'MYSQL_PORT',
  'MYSQL_USER',
  'MYSQL_USERNAME',
  'MYSQL_PASS',
  'MYSQL_PASSWORD',
  'MYSQL_DATABASE',
];

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\.\//, '');
}

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function listRepoFiles(repoRoot, currentDir = repoRoot, results = []) {
  if (!fs.existsSync(currentDir)) return results;

  for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
    const absolutePath = path.join(currentDir, entry.name);
    const relativePath = normalizePath(path.relative(repoRoot, absolutePath));
    if (!relativePath) continue;

    if (entry.isDirectory()) {
      if (SKIP_ROOTS.has(relativePath) || entry.name === 'node_modules') continue;
      listRepoFiles(repoRoot, absolutePath, results);
      continue;
    }

    results.push(relativePath);
  }

  return results;
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_error) {
    return null;
  }
}

function countLines(filePath) {
  if (!fs.existsSync(filePath)) return 0;
  const content = fs.readFileSync(filePath, 'utf8');
  if (!content) return 0;
  return content.split(/\r?\n/).length;
}

function isTextScanCandidate(filePath) {
  const basename = path.basename(filePath);
  return basename.startsWith('.env') || TEXT_SCAN_EXTENSION_RE.test(filePath);
}

function isDatabaseDocCandidate(filePath) {
  if (!filePath.startsWith('docs/')) return false;
  const normalized = normalizePath(filePath);
  if (NON_PROJECT_DOC_PREFIXES.some((prefix) => normalized.startsWith(prefix))) return false;
  const parts = normalized.split('/');
  if (parts.length > 3) return false;
  const basename = path.basename(normalized, path.extname(normalized)).toLowerCase();
  return DATABASE_DOC_TOKEN_RE.test(basename);
}

function shouldInspectForDatabase(filePath) {
  if (
    filePath.startsWith('docs/contexts/')
    || filePath.startsWith('tests/')
    || filePath.startsWith('skills/')
    || filePath.startsWith('agents/')
  ) {
    return false;
  }

  if (filePath.startsWith('docs/')) {
    return isDatabaseDocCandidate(filePath);
  }

  return DATABASE_SCAN_PATH_HINT_RE.test(filePath)
    || DATABASE_CODE_PATH_RE.test(filePath)
    || DATABASE_MIGRATION_PATH_RE.test(filePath);
}

function safeReadTextFile(filePath, maxBytes = 65536) {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile() || stat.size > maxBytes) return null;
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('\u0000')) return null;
    return content;
  } catch (_error) {
    return null;
  }
}

function collectMatches(pattern, content) {
  const matches = [];
  for (const match of content.matchAll(pattern)) {
    if (match[1]) matches.push(match[1]);
  }
  return matches;
}

function isDatabaseCredentialKey(key) {
  const upper = String(key || '').toUpperCase();
  if (!upper) return false;
  if (upper === 'DATABASE_URL') return true;
  return DATABASE_KEY_SUFFIXES.some((suffix) => upper === suffix || upper.endsWith(`_${suffix}`));
}

function inferConnectionNameFromKey(key) {
  const upper = String(key || '').toUpperCase();
  for (const suffix of DATABASE_KEY_SUFFIXES) {
    if (upper === suffix) return 'default';
    if (!upper.endsWith(`_${suffix}`)) continue;
    const prefix = upper.slice(0, -1 * (`_${suffix}`.length));
    if (!prefix) return 'default';
    return prefix
      .toLowerCase()
      .replace(/__/g, '_')
      .replace(/_/g, '-')
      .replace(/^-+|-+$/g, '') || 'default';
  }
  return 'default';
}

function inferDatabaseType({ filePath, content, credentialKeys }) {
  const haystack = [filePath, content, credentialKeys.join(' ')].join('\n');
  for (const record of DATABASE_TYPE_PATTERNS) {
    if (record.pattern.test(haystack)) return record.type;
  }
  return 'unknown';
}

function inferDatabaseConfidence({ content, credentialKeys, dbType }) {
  if (dbType !== 'unknown' && /(adapter|datasource|database_url|mysql:\/\/|postgres:\/\/)/i.test(content)) {
    return 'high';
  }
  if (credentialKeys.length >= 2 || dbType !== 'unknown') return 'medium';
  return 'low';
}

function inferDatabaseEvidenceKind(filePath) {
  const normalized = normalizePath(filePath);
  const basename = path.basename(normalized).toLowerCase();

  if (basename.startsWith('.env')) return 'env-template';
  if (DATABASE_MIGRATION_PATH_RE.test(normalized)) return 'migration';
  if (/schema\.prisma$/i.test(normalized) || /schema\.rb$/i.test(normalized)) return 'orm-schema';
  if (/(^|\/)(application\.(ya?ml|properties)|config\/.*\.(ya?ml|yaml|ini|toml|properties)|alembic\.ini|database\.yml)$/i.test(normalized)) {
    return 'config-file';
  }
  if (normalized.startsWith('docs/')) return 'doc-reference';
  if (normalized.startsWith('config/')) return 'config-file';
  return 'code-config';
}

function shouldUseAsConnectionCandidate(kind) {
  return kind === 'code-config' || kind === 'config-file' || kind === 'env-template';
}

function mergeEvidenceSource(existingSources, nextSource) {
  const sources = Array.isArray(existingSources) ? existingSources.map((source) => ({
    ...source,
    details: Array.isArray(source.details) ? [...source.details] : [],
  })) : [];
  const index = sources.findIndex((source) => source.kind === nextSource.kind && source.path === nextSource.path);
  if (index === -1) {
    sources.push({
      kind: nextSource.kind,
      path: nextSource.path,
      details: unique(nextSource.details || []).sort(),
    });
    return sources;
  }

  sources[index].details = unique([...(sources[index].details || []), ...(nextSource.details || [])]).sort();
  return sources;
}

function inferDatabaseSchemaSourceKind({ filePath, content }) {
  if (DATABASE_MIGRATION_PATH_RE.test(filePath)) return 'migration';
  if (/schema\.prisma$/i.test(filePath) || /schema\.rb$/i.test(filePath)) return 'orm-schema';
  if (isDatabaseDocCandidate(filePath) && /(database\s+er|erdiagram|```mermaid|table\s+[a-z_][a-z0-9_]*|create\s+table|alter\s+table|references\s+[a-z_][a-z0-9_]*)/i.test(content)) {
    return 'doc-er';
  }
  if (DATABASE_SCHEMA_HINT_RE.test(content)) return 'migration';
  return null;
}

function inferPrimaryDatabaseType(databaseCandidates) {
  const candidate = (databaseCandidates || []).find((item) => item && item.db_type && item.db_type !== 'unknown');
  return candidate ? candidate.db_type : 'unknown';
}

function buildSchemaEvidence({ filePath, content, sourceKind }) {
  if (sourceKind === 'migration') {
    const tableNames = collectMatches(/(?:create|alter)\s+table\s+([a-z_][a-z0-9_]*)/gi, content);
    return unique([
      ...tableNames.map((tableName) => `${filePath}:${tableName}`),
      ...(tableNames.length === 0 ? [`${filePath}:ddl-detected`] : []),
    ]).sort();
  }

  if (sourceKind === 'doc-er') {
    return [`${filePath}:doc-er`];
  }

  if (sourceKind === 'orm-schema') {
    return [`${filePath}:schema-file`];
  }

  return [`${filePath}:schema-hint`];
}

function collectDatabaseCandidates({ repoRoot, files }) {
  const candidates = [];

  for (const filePath of files) {
    if (!isTextScanCandidate(filePath)) continue;
    const absolutePath = path.join(repoRoot, filePath);
    const content = safeReadTextFile(absolutePath);
    if (!content) continue;
    if (!shouldInspectForDatabase(filePath)) continue;
    const evidenceKind = inferDatabaseEvidenceKind(filePath);
    if (!shouldUseAsConnectionCandidate(evidenceKind)) continue;

    const rawKeys = unique([
      ...collectMatches(/\b([A-Z][A-Z0-9_]{2,})\b(?=\s*=)/g, content),
      ...collectMatches(/process\.env\.([A-Z][A-Z0-9_]{2,})/g, content),
      ...collectMatches(/ENV\[['"]([A-Z][A-Z0-9_]{2,})['"]\]/g, content),
      ...collectMatches(/System\.getenv\(['"]([A-Z][A-Z0-9_]{2,})['"]\)/g, content),
      ...collectMatches(/os\.getenv\(['"]([A-Z][A-Z0-9_]{2,})['"]\)/g, content),
      ...collectMatches(/os\.environ\[['"]([A-Z][A-Z0-9_]{2,})['"]\]/g, content),
      ...collectMatches(/\$\{([A-Z][A-Z0-9_]{2,})(?::[^}]*)?\}/g, content),
    ].filter(isDatabaseCredentialKey));

    if (rawKeys.length === 0 && !DATABASE_CONNECTION_HINT_RE.test(content)) continue;

    const credentialKeys = rawKeys.sort();
    const dbType = inferDatabaseType({ filePath, content, credentialKeys });
    const connectionName = credentialKeys[0] ? inferConnectionNameFromKey(credentialKeys[0]) : 'default';
    const staticAccessHints = [];
    if (dbType === 'mysql') {
      const hasHostKey = credentialKeys.some((key) => /(?:^|_)(DB_HOST|MYSQL_HOST)$/.test(key));
      const hasUserKey = credentialKeys.some((key) => /(?:^|_)(DB_USER|DB_USERNAME|MYSQL_USER|MYSQL_USERNAME)$/.test(key));
      if (hasHostKey && hasUserKey) staticAccessHints.push('mysql-cli');
    }

    candidates.push({
      present: true,
      connection_name: connectionName,
      config_source: filePath,
      evidence_sources: mergeEvidenceSource([], {
        kind: evidenceKind,
        path: filePath,
        details: credentialKeys.length > 0 ? credentialKeys : [dbType === 'unknown' ? 'database-hint' : dbType],
      }),
      db_type: dbType,
      database_name_guess: null,
      credential_keys: credentialKeys,
      static_access_hints: unique(staticAccessHints),
      confidence: inferDatabaseConfidence({ content, credentialKeys, dbType }),
      inference_reason: 'database-hint-detected',
      evidence: unique([
        ...credentialKeys.map((key) => `${filePath}:${key}`),
        ...(credentialKeys.length === 0 ? [`${filePath}:database-hint`] : []),
      ]).sort(),
    });
  }

  return candidates.sort((a, b) => a.config_source.localeCompare(b.config_source));
}

function collectDatabaseSchemaSources({ repoRoot, files, databaseCandidates }) {
  const sources = [];
  const fallbackDbType = inferPrimaryDatabaseType(databaseCandidates);

  for (const filePath of files) {
    if (!isTextScanCandidate(filePath)) continue;
    const absolutePath = path.join(repoRoot, filePath);
    const content = safeReadTextFile(absolutePath);
    if (!content) continue;
    const shouldInspectSchema = shouldInspectForDatabase(filePath) || isDatabaseDocCandidate(filePath);
    if (!shouldInspectSchema) continue;

    const sourceKind = inferDatabaseSchemaSourceKind({ filePath, content });
    if (!sourceKind) continue;

    let dbType = inferDatabaseType({ filePath, content, credentialKeys: [] });
    if (dbType === 'unknown') dbType = fallbackDbType;
    if (dbType === 'unknown') continue;

    sources.push({
      source_kind: sourceKind,
      path: filePath,
      db_type: dbType,
      connection_name: null,
      confidence: sourceKind === 'doc-er' ? 'medium' : 'high',
      inference_reason: sourceKind === 'doc-er' ? 'documented-schema-evidence' : 'schema-file-detected',
      evidence: buildSchemaEvidence({ filePath, content, sourceKind }),
    });
  }

  return sources.sort((a, b) => a.path.localeCompare(b.path));
}

function detectPrimaryLanguage(files) {
  const counts = new Map();
  for (const filePath of files) {
    if (!RUNTIME_EXTENSION_RE.test(filePath) || TEST_FILE_RE.test(filePath)) continue;
    const extension = path.extname(filePath).toLowerCase();
    const label = LANGUAGE_LABELS[extension];
    if (!label) continue;
    counts.set(label, (counts.get(label) || 0) + 1);
  }

  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return ranked.length > 0 ? ranked[0][0] : 'Unknown';
}

function detectPrimaryFrameworks({ repoRoot, pkg, files }) {
  const frameworks = [];
  const deps = {
    ...(pkg && pkg.dependencies ? pkg.dependencies : {}),
    ...(pkg && pkg.devDependencies ? pkg.devDependencies : {}),
  };
  const depNames = new Set(Object.keys(deps).map((name) => name.toLowerCase()));
  const fileSet = new Set(files);
  const manifestContents = [
    'pom.xml',
    'build.gradle',
    'build.gradle.kts',
    'requirements.txt',
    'pyproject.toml',
    'Gemfile',
    'go.mod',
  ]
    .filter((filePath) => fileSet.has(filePath))
    .map((filePath) => safeReadTextFile(path.join(repoRoot, filePath), 131072) || '')
    .join('\n')
    .toLowerCase();

  if ((pkg && pkg.bin) || files.some((filePath) => filePath.startsWith('bin/'))) frameworks.push('Node.js CLI');
  if (depNames.has('jest') || Object.keys(pkg && pkg.scripts ? pkg.scripts : {}).some((key) => key.includes('test'))) frameworks.push('Jest');
  if (depNames.has('tree-sitter')) frameworks.push('tree-sitter');
  if (depNames.has('better-sqlite3')) frameworks.push('better-sqlite3');
  if (depNames.has('simple-git')) frameworks.push('simple-git');
  if (fileSet.has('pom.xml') || fileSet.has('build.gradle') || fileSet.has('build.gradle.kts')) frameworks.push('JVM Build');
  if (fileSet.has('requirements.txt') || fileSet.has('pyproject.toml')) frameworks.push('Python Project');
  if (fileSet.has('Gemfile')) frameworks.push('Ruby Project');
  if (fileSet.has('go.mod')) frameworks.push('Go Module');
  if (/spring-boot|org\.springframework\.boot/.test(manifestContents)) frameworks.push('Spring Boot');
  if (/flyway/.test(manifestContents)) frameworks.push('Flyway');
  if (/liquibase/.test(manifestContents)) frameworks.push('Liquibase');
  if (/\bdjango\b/.test(manifestContents) || fileSet.has('manage.py')) frameworks.push('Django');
  if (/\bsqlalchemy\b/.test(manifestContents)) frameworks.push('SQLAlchemy');
  if (/\balembic\b/.test(manifestContents)) frameworks.push('Alembic');
  if (/\brails\b/.test(manifestContents)) frameworks.push('Rails');
  if (/\bactiverecord\b/.test(manifestContents) || fileSet.has('config/database.yml')) frameworks.push('ActiveRecord');
  if (/\bgorm\b/.test(manifestContents)) frameworks.push('GORM');

  return unique(frameworks);
}

function detectRepoShape({ repoRoot, pkg, files, topology }) {
  if (topology && topology.kind === 'monorepo_multi_module') {
    return 'multi-module git repository';
  }
  if (pkg && Array.isArray(pkg.workspaces) && pkg.workspaces.length > 0) {
    return 'workspace repository with managed CLI and shared workflow assets';
  }

  const hasCli = files.some((filePath) => filePath.startsWith('bin/') || filePath.startsWith('src/cli/'));
  const hasWorkflowAssets = files.some((filePath) => filePath.startsWith('skills/') || filePath.startsWith('agents/'));
  const hasEmbeddedCrg = files.some((filePath) => filePath.startsWith('src/crg/'));

  if (hasCli && hasWorkflowAssets && hasEmbeddedCrg) {
    return 'single-package CLI repository with bundled workflow assets and embedded CRG runtime';
  }
  if (hasCli) {
    return 'single-package CLI repository';
  }
  return `${path.basename(repoRoot)} source repository`;
}

function collectEntrypoints({ repoRoot, pkg, files }) {
  const entrypoints = [];

  if (pkg && pkg.bin && typeof pkg.bin === 'object') {
    for (const filePath of Object.values(pkg.bin)) {
      const normalized = normalizePath(filePath);
      if (files.includes(normalized)) {
        entrypoints.push({ path: normalized });
      }
    }
  }

  for (const candidate of [
    'src/cli/index.js',
    'src/crg/cli/router.js',
    'src/cli/commands/stage0-context.js',
  ]) {
    if (files.includes(candidate)) {
      entrypoints.push({ path: candidate });
    }
  }

  return unique(entrypoints.map((item) => item.path)).map((filePath) => ({ path: filePath }));
}

function collectModules(files) {
  const modules = new Set();

  for (const filePath of files) {
    if (filePath.startsWith('src/')) {
      const parts = filePath.split('/');
      if (parts[1]) modules.add(`src/${parts[1]}/`);
      continue;
    }

    if (filePath.startsWith('docs/contracts/')) {
      modules.add('docs/contracts/');
      continue;
    }

    const topLevel = filePath.split('/')[0];
    if (['agents', 'benchmarks', 'bin', 'docs', 'scripts', 'skills', 'templates', 'tests', 'vendor'].includes(topLevel)) {
      modules.add(`${topLevel}/`);
    }
  }

  return [...modules].sort().map((modulePath) => ({ path: modulePath }));
}

function collectIntegrations(pkg) {
  const deps = {
    ...(pkg && pkg.dependencies ? pkg.dependencies : {}),
    ...(pkg && pkg.devDependencies ? pkg.devDependencies : {}),
  };
  const priority = [
    'better-sqlite3',
    'tree-sitter',
    'simple-git',
    'jest',
    'ignore',
  ];
  const seen = new Set();
  const result = [];

  for (const dep of priority) {
    if (Object.prototype.hasOwnProperty.call(deps, dep)) {
      seen.add(dep);
      result.push({ symbol: dep });
    }
  }

  for (const dep of Object.keys(deps).sort()) {
    if (seen.has(dep) || dep.startsWith('tree-sitter-')) continue;
    result.push({ symbol: dep });
    if (result.length >= 8) break;
  }

  return result;
}

function inferTestKind(filePath) {
  if (filePath.includes('/contracts/')) return 'contract';
  if (filePath.includes('/integration/')) return 'integration';
  if (filePath.includes('/smoke/')) return 'smoke';
  if (filePath.includes('/e2e/')) return 'e2e';
  return 'unit';
}

function inferTargetPath(testFilePath, runtimeFiles) {
  const basename = path.basename(testFilePath)
    .replace(/\.test\.[^.]+$/i, '')
    .replace(/\.spec\.[^.]+$/i, '');

  if (testFilePath.startsWith('tests/contracts/')) {
    const contractCandidate = `docs/contracts/${basename}.schema.json`;
    if (runtimeFiles.includes(contractCandidate)) return contractCandidate;
  }

  const candidates = runtimeFiles.filter((filePath) => path.basename(filePath, path.extname(filePath)) === basename);
  if (candidates.length === 1) return candidates[0];
  if (candidates.length > 1) {
    return candidates.sort((a, b) => a.length - b.length || a.localeCompare(b))[0];
  }

  return null;
}

function collectTestSurface(files) {
  const runtimeFiles = files.filter((filePath) => RUNTIME_EXTENSION_RE.test(filePath) && !TEST_FILE_RE.test(filePath));
  const testFiles = files
    .filter((filePath) => TEST_FILE_RE.test(filePath))
    .sort()
    .map((filePath) => ({
      path: filePath,
      kind: inferTestKind(filePath),
      target_path: inferTargetPath(filePath, runtimeFiles),
    }));

  return {
    test_files: testFiles,
    coverage_gaps: [],
  };
}

function collectTestingSurface(testSurface) {
  const testFiles = Array.isArray(testSurface && testSurface.test_files) ? testSurface.test_files : [];
  return testFiles
    .filter((item) => item && item.target_path)
    .slice(0, 8)
    .map((item) => ({
      target_path: item.target_path,
      source_test: item.path,
    }));
}

function collectRiskSignals({ repoRoot, files }) {
  const runtimeFiles = files.filter((filePath) => filePath.startsWith('src/') && RUNTIME_EXTENSION_RE.test(filePath));
  const signals = runtimeFiles
    .map((filePath) => {
      const absolutePath = path.join(repoRoot, filePath);
      const lineCount = countLines(absolutePath);
      return {
        path: filePath,
        kind: lineCount >= 220 ? 'large-module' : 'hotspot',
        severity: lineCount >= 220 ? 'high' : 'medium',
        summary: `文件约 ${lineCount} 行，属于当前仓库较大的运行时模块`,
        line_count: lineCount,
      };
    })
    .sort((a, b) => b.line_count - a.line_count || a.path.localeCompare(b.path))
    .slice(0, 5);

  return {
    signals,
    crg_metrics: {
      source: 'filesystem-inference',
      signal_count: signals.length,
    },
  };
}

function deriveBootstrapInputs({ repoRoot, factInventory, riskSignals, testSurface } = {}) {
  if (!repoRoot) {
    return {
      factInventory: factInventory || {},
      riskSignals: riskSignals || { signals: [], crg_metrics: { source: 'missing-repo-root', signal_count: 0 } },
      testSurface: testSurface || { test_files: [], coverage_gaps: [] },
      repoFiles: [],
      packageJson: null,
    };
  }

  const repoFiles = listRepoFiles(repoRoot).sort();
  const packageJson = readJsonIfExists(path.join(repoRoot, 'package.json'));
  const topology = buildRepoTopology({ repoRoot, files: repoFiles });
  const primaryLanguage = detectPrimaryLanguage(repoFiles);
  const primaryFrameworks = detectPrimaryFrameworks({
    repoRoot,
    pkg: packageJson,
    files: repoFiles,
  });

  const effectiveTestSurface = testSurface || collectTestSurface(repoFiles);
  const databaseCandidates = collectDatabaseCandidates({
    repoRoot,
    files: repoFiles,
  });
  const effectiveFactInventory = factInventory || {
    project_identity: {
      name: packageJson && packageJson.name ? packageJson.name : path.basename(repoRoot),
      primary_language: primaryLanguage,
      primary_frameworks: primaryFrameworks,
      repo_shape: detectRepoShape({ repoRoot, pkg: packageJson, files: repoFiles, topology }),
    },
    topology,
    entrypoints: collectEntrypoints({ repoRoot, pkg: packageJson, files: repoFiles }),
    modules: collectModules(repoFiles),
    integrations: collectIntegrations(packageJson),
    testing_surface: collectTestingSurface(effectiveTestSurface),
    database: databaseCandidates,
    database_schema: collectDatabaseSchemaSources({
      repoRoot,
      files: repoFiles,
      databaseCandidates,
    }),
  };
  const effectiveRiskSignals = riskSignals || collectRiskSignals({ repoRoot, files: repoFiles });

  return {
    factInventory: effectiveFactInventory,
    riskSignals: effectiveRiskSignals,
    testSurface: effectiveTestSurface,
    repoFiles,
    packageJson,
  };
}

function sha256File(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function resolveGitCommit(repoRoot) {
  try {
    return execFileSync('git', ['-C', repoRoot, 'rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch (_error) {
    return null;
  }
}

module.exports = {
  deriveBootstrapInputs,
  resolveGitCommit,
  sha256File,
};
