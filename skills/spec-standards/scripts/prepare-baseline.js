#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const PROJECT_SHAPE_SCHEMA = 'spec-first.project-shape.v1';
const STANDARDS_PLAN_SCHEMA = 'spec-first.standards-plan.v1';
const GLUE_MAP_SCHEMA = 'spec-first.glue-map.v1';
const STANDARDS_UPDATE_DECISION_SCHEMA = 'spec-first.standards-update-decision.v1';
const GRAPH_QUERY_INDEX_SCHEMA = 'spec-first.standards-graph-query-index.v1';
const STANDARDS_SOURCES_SCHEMA = 'spec-first.standards-sources.v1';
const IMPORT_LOCK_SCHEMA = 'spec-first.standards-import-lock.v1';
const IMPORTED_STANDARDS_SCHEMA = 'spec-first.imported-standards.v1';
const SUPPORTED_MODES = ['baseline', 'quick', 'refresh', 'deep'];
const CANDIDATE_STATUSES = [
  'confirmed',
  'imported',
  'observed',
  'suggested',
  'conflict',
  'unknown',
  'deprecated',
  'drifted',
];
const CANDIDATE_SOURCE_TYPES = [
  'user_input',
  'repo_profile_confirmed',
  'shared_standard_imported',
  'graph_observed',
  'code_observed',
  'config_observed',
  'docs_observed',
  'llm_suggested',
];
const BASELINE_REVIEW_ARTIFACTS = [
  'project-shape.json',
  'standards-plan.json',
  'glue-map.json',
  'standards-candidates.json',
  'standards-preview.md',
];

function parseArgs(argv) {
  const args = {
    mode: 'baseline',
    root: process.cwd(),
    output: '.spec-first/standards',
    dryRun: false,
    domains: [],
    modules: [],
    repo: null,
    importSource: null,
    modeExplicit: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--baseline' || arg === '--quick' || arg === '--refresh' || arg === '--deep') {
      setMode(args, arg.slice(2));
      continue;
    }
    if (arg === '--mode') {
      setMode(args, requireValue(argv, index, arg));
      index += 1;
      continue;
    }
    if (arg === '--root') {
      args.root = requireValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === '--output') {
      args.output = requireValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === '--dry-run') {
      args.dryRun = true;
      continue;
    }
    if (arg === '--domain') {
      args.domains.push(requireValue(argv, index, arg));
      index += 1;
      continue;
    }
    if (arg === '--module') {
      args.modules.push(requireValue(argv, index, arg));
      index += 1;
      continue;
    }
    if (arg === '--repo') {
      args.repo = requireValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === '--import-source') {
      args.importSource = requireValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!SUPPORTED_MODES.includes(args.mode)) {
    throw new Error(`Unsupported mode for deterministic standards preparation: ${args.mode}`);
  }

  return normalizePrepareOptions(args);
}

function setMode(args, mode) {
  if (!SUPPORTED_MODES.includes(mode)) {
    throw new Error(`Unsupported mode for deterministic standards preparation: ${mode}`);
  }
  if (args.modeExplicit && args.mode !== mode) {
    throw new Error(`Conflicting standards modes: ${args.mode} and ${mode} cannot be combined.`);
  }
  args.mode = mode;
  args.modeExplicit = true;
}

function requireValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}

function printHelp() {
  process.stdout.write(`Usage: node skills/spec-standards/scripts/prepare-baseline.js [--baseline|--quick|--refresh|--deep] [--root <path>] [--output <path>] [--domain <name>] [--module <path>] [--repo <child>] [--import-source <path-or-git-url>] [--dry-run]

Prepare deterministic spec-standards facts. Semantic standards candidates, conflict analysis, and previews remain LLM-owned.
`);
}

function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    const result = prepareBaseline(args);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}

function prepareBaseline(args) {
  const options = normalizePrepareOptions(args);
  const repoRoot = options.root;
  if (!fs.existsSync(repoRoot) || !fs.statSync(repoRoot).isDirectory()) {
    throw new Error(`Repo root does not exist or is not a directory: ${repoRoot}`);
  }

  const inventory = buildInventory(repoRoot);
  const projectShape = buildProjectShape(repoRoot, inventory, options);
  const importArtifacts = options.importSource
    ? buildImportArtifacts(repoRoot, options.importSource, options.workspaceRoot)
    : null;
  const standardsPlan = buildStandardsPlan(projectShape, inventory, options, importArtifacts);
  const glueMap = buildGlueMap(projectShape, inventory, options);
  const updateDecision = ['quick', 'refresh'].includes(options.mode)
    ? buildUpdateDecision(repoRoot, options, projectShape)
    : null;
  const graphQueryIndex = options.mode === 'deep'
    ? buildGraphQueryIndex(projectShape, options)
    : null;

  const writes = buildArtifactWrites({
    options,
    projectShape,
    standardsPlan,
    glueMap,
    updateDecision,
    graphQueryIndex,
    importArtifacts,
  });

  if (!options.dryRun) {
    fs.mkdirSync(options.output, { recursive: true });
    for (const [fileName, payload] of writes) {
      writeJson(path.join(options.output, fileName), payload);
    }
  }

  return {
    schema_version: 'spec-first.standards-prepare-baseline.result.v1',
    mode: options.mode,
    workspace_root: options.workspaceRoot,
    repo_root: repoRoot,
    target_repo: options.repo,
    output_root: options.output,
    dry_run: options.dryRun,
    scope: buildScope(options),
    import_source: options.importSource,
    artifacts: writes.map(([fileName]) => path.relative(repoRoot, path.join(options.output, fileName)).replace(/\\/g, '/')),
    workspace_artifacts: writes.map(([fileName]) => path.relative(options.workspaceRoot, path.join(options.output, fileName)).replace(/\\/g, '/')),
  };
}

function normalizePrepareOptions(args) {
  const alreadyNormalized = Boolean(args.workspaceRoot);
  const workspaceRoot = path.resolve(args.workspaceRoot || args.root || process.cwd());
  const repo = normalizeRepoSelector(args.repo || null);
  const root = alreadyNormalized
    ? path.resolve(args.root || (repo ? path.resolve(workspaceRoot, repo) : workspaceRoot))
    : (repo ? path.resolve(workspaceRoot, repo) : workspaceRoot);
  const output = path.resolve(root, args.output || '.spec-first/standards');
  const mode = args.mode || 'baseline';
  if (!SUPPORTED_MODES.includes(mode)) {
    throw new Error(`Unsupported mode for deterministic standards preparation: ${mode}`);
  }

  return {
    mode,
    workspaceRoot,
    root,
    output,
    dryRun: Boolean(args.dryRun),
    domains: uniqueList(args.domains || (args.domain ? [args.domain] : [])),
    modules: uniqueList(args.modules || (args.module ? [args.module] : [])),
    repo,
    importSource: args.importSource || args.import_source || null,
  };
}

function normalizeRepoSelector(repo) {
  if (!repo) return null;
  const normalized = String(repo).trim().replace(/\\/g, '/').replace(/\/+$/g, '');
  if (!normalized) return null;
  if (path.isAbsolute(normalized)) {
    throw new Error(`--repo must be a workspace-relative child repo path: ${repo}`);
  }
  if (normalized.split('/').includes('..')) {
    throw new Error(`--repo must not traverse outside the workspace root: ${repo}`);
  }
  return normalized;
}

function uniqueList(values) {
  return [...new Set(values.filter(Boolean).map((value) => String(value).trim()).filter(Boolean))];
}

function buildArtifactWrites({
  options,
  projectShape,
  standardsPlan,
  glueMap,
  updateDecision,
  graphQueryIndex,
  importArtifacts,
}) {
  const writes = [];

  if (options.mode !== 'quick') {
    writes.push(
      ['project-shape.json', projectShape],
      ['standards-plan.json', standardsPlan],
      ['glue-map.json', glueMap],
    );
  }

  if (updateDecision) {
    writes.push(['standards-update-decision.json', updateDecision]);
  }

  if (graphQueryIndex) {
    writes.push(['graph-query-index.json', graphQueryIndex]);
  }

  if (importArtifacts) {
    writes.push(
      ['standards-sources.json', importArtifacts.standardsSources],
      ['import-lock.json', importArtifacts.importLock],
      ['imported-standards.json', importArtifacts.importedStandards],
    );
  }

  return writes;
}

function buildInventory(repoRoot) {
  const files = walkFiles(repoRoot, {
    maxFiles: 4000,
    root: repoRoot,
    ignoredDirs: new Set([
      '.git',
      '.gitnexus',
      '.worktrees',
      'node_modules',
      'coverage',
      'dist',
      'tmp',
      'temp',
      '.claude',
      '.codex',
      '.agents',
      '.serena',
    ]),
    ignoredRelativePrefixes: [
      '.spec-first/standards/',
    ],
  });

  const relativeFiles = files.map((filePath) => path.relative(repoRoot, filePath).replace(/\\/g, '/'));
  return {
    files: relativeFiles,
    file_count: relativeFiles.length,
    truncated: files.length >= 4000,
    manifests: pickExisting(relativeFiles, [
      'package.json',
      'pnpm-workspace.yaml',
      'yarn.lock',
      'pnpm-lock.yaml',
      'package-lock.json',
      'bun.lockb',
      'pyproject.toml',
      'Cargo.toml',
      'go.mod',
      'Gemfile',
    ]),
    roots: {
      skills: hasDir(repoRoot, 'skills'),
      agents: hasDir(repoRoot, 'agents'),
      templates: hasDir(repoRoot, 'templates'),
      src_cli: hasDir(repoRoot, 'src/cli'),
      tests: hasDir(repoRoot, 'tests'),
      docs: hasDir(repoRoot, 'docs'),
    },
    graph_artifacts: pickExisting(relativeFiles, [
      '.spec-first/graph/graph-facts.json',
      '.spec-first/graph/architecture-facts.json',
      '.spec-first/graph/reuse-candidates.json',
      '.spec-first/graph/bootstrap-impact-capabilities.json',
      '.spec-first/config/runtime-capabilities.json',
      '.spec-first/config/provider-artifacts.json',
    ]),
  };
}

function walkFiles(root, options) {
  const result = [];

  function walk(current) {
    if (result.length >= options.maxFiles) return;

    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (result.length >= options.maxFiles) return;
      if (options.ignoredDirs.has(entry.name)) continue;

      const entryPath = path.join(current, entry.name);
      const relativePath = path.relative(options.root, entryPath).replace(/\\/g, '/');
      const relativePrefix = entry.isDirectory() ? `${relativePath}/` : relativePath;
      if (options.ignoredRelativePrefixes.some((prefix) => relativePrefix.startsWith(prefix))) {
        continue;
      }
      if (entry.isDirectory()) {
        walk(entryPath);
        continue;
      }
      if (entry.isFile()) {
        result.push(entryPath);
      }
    }
  }

  walk(root);
  return result;
}

function pickExisting(files, candidates) {
  const fileSet = new Set(files);
  return candidates.filter((candidate) => fileSet.has(candidate));
}

function hasDir(root, relativePath) {
  const target = path.join(root, relativePath);
  return fs.existsSync(target) && fs.statSync(target).isDirectory();
}

function buildProjectShape(repoRoot, inventory, args = {}) {
  const options = normalizePlanOptions(args);
  const packageJson = readPackageJson(repoRoot);
  const languages = detectLanguages(inventory.files);
  const packageManagers = detectPackageManagers(inventory.files);
  const frameworks = detectFrameworks(packageJson, inventory);
  const domains = detectDomains(packageJson, inventory);
  const projectMode = detectProjectMode(packageJson, inventory);

  return {
    schema_version: PROJECT_SHAPE_SCHEMA,
    generated_at: new Date().toISOString(),
    scope: buildScope(options),
    project_mode: projectMode,
    project: {
      root: '.',
      detected_type: detectProjectType(packageJson, domains),
      summary: summarizeProject(packageJson, domains),
      confidence: packageJson ? 'high' : 'medium',
    },
    languages,
    frameworks,
    package_managers: packageManagers,
    domains,
    graph: {
      available_artifacts: inventory.graph_artifacts,
      status: inventory.graph_artifacts.length > 0 ? 'available' : 'not_detected',
    },
    modules: [],
    recommended_standard_domains: recommendDomains(domains),
    skipped_standard_domains: skippedDomains(domains),
    evidence: {
      manifest_paths: inventory.manifests,
      scanned_file_count: inventory.file_count,
      scan_truncated: inventory.truncated,
      inventory_hash: hashInventory(repoRoot, inventory.files),
    },
  };
}

function hashInventory(repoRoot, files) {
  const hash = crypto.createHash('sha256');
  for (const file of [...files].sort()) {
    const filePath = path.join(repoRoot, file);
    hash.update(`${file}\0`);
    try {
      const stat = fs.statSync(filePath);
      hash.update(`${stat.size}:${Math.floor(stat.mtimeMs)}\0`);
    } catch (error) {
      hash.update('missing\0');
    }
  }
  return `sha256:${hash.digest('hex')}`;
}

function readPackageJson(repoRoot) {
  const packagePath = path.join(repoRoot, 'package.json');
  if (!fs.existsSync(packagePath)) return null;
  return JSON.parse(fs.readFileSync(packagePath, 'utf8'));
}

function detectLanguages(files) {
  const counts = {};
  const extensionToLanguage = {
    '.js': 'javascript',
    '.cjs': 'javascript',
    '.mjs': 'javascript',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.jsx': 'javascript',
    '.json': 'json',
    '.md': 'markdown',
    '.sh': 'shell',
    '.ps1': 'powershell',
    '.py': 'python',
    '.rb': 'ruby',
    '.go': 'go',
    '.rs': 'rust',
    '.java': 'java',
    '.kt': 'kotlin',
    '.swift': 'swift',
    '.yaml': 'yaml',
    '.yml': 'yaml',
  };

  for (const file of files) {
    const language = extensionToLanguage[path.extname(file)];
    if (!language) continue;
    counts[language] = (counts[language] || 0) + 1;
  }

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([language, count]) => ({ language, file_count: count }));
}

function detectPackageManagers(files) {
  const managers = [];
  if (files.includes('package.json')) managers.push('npm');
  if (files.includes('pnpm-lock.yaml') || files.includes('pnpm-workspace.yaml')) managers.push('pnpm');
  if (files.includes('yarn.lock')) managers.push('yarn');
  if (files.includes('bun.lockb')) managers.push('bun');
  if (files.includes('pyproject.toml')) managers.push('python');
  if (files.includes('Cargo.toml')) managers.push('cargo');
  if (files.includes('go.mod')) managers.push('go');
  return [...new Set(managers)];
}

function detectFrameworks(packageJson, inventory) {
  const names = new Set();
  const deps = {
    ...((packageJson && packageJson.dependencies) || {}),
    ...((packageJson && packageJson.devDependencies) || {}),
  };

  for (const name of Object.keys(deps)) {
    if (name === 'jest') names.add('jest');
    if (name === 'ignore') names.add('ignore');
    if (name === 'simple-git') names.add('simple-git');
    if (name === 'react') names.add('react');
    if (name === 'next') names.add('nextjs');
    if (name === 'vue') names.add('vue');
    if (name === 'express') names.add('express');
  }

  if (inventory.roots.skills) names.add('spec-first-skills');
  if (inventory.roots.agents) names.add('agent-profiles');
  return [...names].sort();
}

function detectDomains(packageJson, inventory) {
  const files = new Set(inventory.files);
  const sourceFiles = inventory.files.filter(isDomainSourceFile);
  const databaseEvidence = sourceFiles
    .filter(isDatabaseSignalFile)
    .slice(0, 8);
  const mobileEvidence = sourceFiles
    .filter(isMobileSignalFile)
    .slice(0, 8);
  const graphEvidence = [
    ...inventory.graph_artifacts,
    ...inventory.files
      .filter((file) => isWorkflowSourceFile(file) && file.includes('graph-bootstrap'))
      .slice(0, 5),
  ];
  const domains = {
    cli: {
      detected: files.has('bin/spec-first.js') || inventory.roots.src_cli,
      evidence: pickExisting(inventory.files, ['bin/spec-first.js', 'src/cli/index.js']),
    },
    skill_workflow: {
      detected: inventory.roots.skills,
      evidence: inventory.roots.skills ? ['skills/'] : [],
    },
    agent_profiles: {
      detected: inventory.roots.agents,
      evidence: inventory.roots.agents ? ['agents/'] : [],
    },
    artifact_contracts: {
      detected: inventory.files.some((file) => file.includes('/contracts/') || file.endsWith('.schema.json')),
      evidence: inventory.files
        .filter((file) => file.includes('/contracts/') || file.endsWith('.schema.json'))
        .slice(0, 8),
    },
    graph: {
      detected: graphEvidence.length > 0,
      evidence: graphEvidence,
    },
    docs: {
      detected: inventory.roots.docs,
      evidence: inventory.roots.docs ? ['docs/'] : [],
    },
    tests: {
      detected: inventory.roots.tests,
      evidence: inventory.roots.tests ? ['tests/'] : [],
    },
    frontend: {
      detected: hasDependency(packageJson, ['react', 'vue', 'next']),
      evidence: hasDependency(packageJson, ['react', 'vue', 'next']) ? ['package.json'] : [],
    },
    backend: {
      detected: hasDependency(packageJson, ['express', 'fastify', 'koa', 'nestjs']),
      evidence: hasDependency(packageJson, ['express', 'fastify', 'koa', 'nestjs']) ? ['package.json'] : [],
    },
    database: {
      detected: databaseEvidence.length > 0,
      evidence: databaseEvidence,
    },
    mobile: {
      detected: mobileEvidence.length > 0,
      evidence: mobileEvidence,
    },
  };

  return domains;
}

function isDomainSourceFile(file) {
  return ![
    'docs/',
    'agents/',
    'skills/',
    'templates/',
    'tests/',
    'vendor/',
    '.github/',
  ].some((prefix) => file.startsWith(prefix));
}

function isWorkflowSourceFile(file) {
  return [
    'skills/',
    'src/cli/',
    'templates/',
    'docs/contracts/',
  ].some((prefix) => file.startsWith(prefix));
}

function isDatabaseSignalFile(file) {
  return (
    /(^|\/)(db\/migrate|migrations?|prisma)\//.test(file)
    || /(^|\/)schema\.(sql|rb|prisma)$/.test(file)
  );
}

function isMobileSignalFile(file) {
  return (
    file.startsWith('android/')
    || file.startsWith('ios/')
    || file.includes('/android/')
    || file.includes('/ios/')
    || file.endsWith('.swift')
    || file.endsWith('.kt')
  );
}

function hasDependency(packageJson, names) {
  if (!packageJson) return false;
  const deps = {
    ...(packageJson.dependencies || {}),
    ...(packageJson.devDependencies || {}),
  };
  return names.some((name) => Object.prototype.hasOwnProperty.call(deps, name));
}

function detectProjectMode(packageJson, inventory) {
  if (packageJson && packageJson.workspaces) return 'monorepo_multi_module';
  if (inventory.files.includes('pnpm-workspace.yaml')) return 'monorepo_multi_module';
  return 'single_project_repo';
}

function detectProjectType(packageJson, domains) {
  if (domains.cli.detected && domains.skill_workflow.detected) return 'node_cli_ai_workflow_framework';
  if (domains.cli.detected) return 'node_cli';
  if (domains.frontend.detected && domains.backend.detected) return 'full_stack_application';
  if (domains.frontend.detected) return 'frontend_application';
  if (domains.backend.detected) return 'backend_service';
  return packageJson ? 'node_project' : 'software_project';
}

function summarizeProject(packageJson, domains) {
  const name = packageJson && packageJson.name ? packageJson.name : 'current project';
  const activeDomains = recommendDomains(domains).join(', ');
  return `${name} with detected domains: ${activeDomains || 'none'}`;
}

function recommendDomains(domains) {
  return Object.entries(domains)
    .filter(([, value]) => value.detected)
    .map(([domain]) => domain)
    .sort();
}

function skippedDomains(domains) {
  return Object.entries(domains)
    .filter(([, value]) => !value.detected)
    .map(([domain]) => domain)
    .sort();
}

function buildStandardsPlan(projectShape, inventory, args = {}, importArtifacts = null) {
  const options = normalizePlanOptions(args);
  const baseEnabledDomains = projectShape.recommended_standard_domains.filter((domain) => (
    !['agent_profiles', 'docs', 'tests'].includes(domain)
  ));
  const requestedDomains = options.domains.length > 0 ? options.domains : baseEnabledDomains;
  const budget = buildModeBudget(options.mode);
  const enabledDomains = requestedDomains.slice(0, budget.max_enabled_lenses);
  const scope = buildScope(options);

  return {
    schema_version: STANDARDS_PLAN_SCHEMA,
    generated_at: new Date().toISOString(),
    project_mode: projectShape.project_mode,
    mode: options.mode,
    budget,
    scope,
    scope_plan: {
      global: {
        enabled: options.mode !== 'quick',
        domains: enabledDomains,
      },
      modules: options.modules,
      repo: options.repo,
    },
    tasks: buildPlanTasks(options, enabledDomains, importArtifacts),
    artifacts: buildPlanArtifacts(options, importArtifacts),
    synthesis_contract: buildSynthesisContract(options, enabledDomains, importArtifacts),
    dispatch: {
      mode: options.mode === 'deep' ? 'multi_lens_review' : 'single_skill',
      enabled_lenses: enabledDomains.map((domain) => `${domain}-standards-lens`),
      skipped_lenses: projectShape.skipped_standard_domains.map((domain) => ({
        lens: `${domain}-standards-lens`,
        reason_code: 'domain-not-detected',
      })),
    },
  };
}

function normalizePlanOptions(args) {
  return {
    mode: args.mode || 'baseline',
    domains: uniqueList(args.domains || []),
    modules: uniqueList(args.modules || []),
    repo: args.repo || null,
    workspaceRoot: args.workspaceRoot || args.root || process.cwd(),
  };
}

function buildModeBudget(mode) {
  const budgets = {
    baseline: {
      max_enabled_lenses: 5,
      max_candidates_per_domain: 12,
      max_evidence_per_candidate: 4,
      allow_multi_agent: false,
      allow_raw_source_context: false,
      allow_deep_graph_queries: false,
    },
    quick: {
      max_enabled_lenses: 0,
      max_candidates_per_domain: 0,
      max_evidence_per_candidate: 0,
      allow_multi_agent: false,
      allow_raw_source_context: false,
      allow_deep_graph_queries: false,
    },
    refresh: {
      max_enabled_lenses: 4,
      max_candidates_per_domain: 10,
      max_evidence_per_candidate: 4,
      allow_multi_agent: false,
      allow_raw_source_context: false,
      allow_deep_graph_queries: false,
    },
    deep: {
      max_enabled_lenses: 8,
      max_candidates_per_domain: 20,
      max_evidence_per_candidate: 6,
      allow_multi_agent: true,
      allow_raw_source_context: true,
      allow_deep_graph_queries: true,
    },
  };

  return {
    mode,
    ...budgets[mode],
  };
}

function buildScope(options) {
  const scope = {
    type: options.repo ? 'workspace_child_repo' : 'repo',
    root: '.',
    domains: options.domains,
    modules: options.modules,
  };
  if (options.repo) {
    scope.workspace_child = options.repo;
  }
  return scope;
}

function buildPlanTasks(options, enabledDomains, importArtifacts) {
  if (options.mode === 'quick') {
    return [
      {
        id: 'quick.freshness-decision',
        domain: 'standards',
        action: 'inspect_existing_artifact_freshness',
        owner: 'script',
      },
    ];
  }

  const actionByMode = {
    baseline: 'synthesize_candidates_from_evidence',
    refresh: 'refresh_candidates_from_bounded_scope',
    deep: 'deep_synthesize_candidates_from_graph_and_source_evidence',
  };
  const tasks = enabledDomains.map((domain) => ({
    id: `${options.mode}.${domain}`,
    domain,
    action: actionByMode[options.mode],
    owner: 'llm',
  }));

  if (importArtifacts) {
    tasks.push({
      id: `${options.mode}.shared-standards-import-alignment`,
      domain: 'shared_standards',
      action: 'align_imported_standards_with_project_shape',
      owner: 'llm',
      source_id: importArtifacts.importLock.source.id,
    });
  }

  return tasks;
}

function buildPlanArtifacts(options, importArtifacts) {
  const generateByMode = {
    baseline: [
      '.spec-first/standards/project-shape.json',
      '.spec-first/standards/standards-plan.json',
      '.spec-first/standards/glue-map.json',
      '.spec-first/standards/standards-candidates.json',
      '.spec-first/standards/standards-preview.md',
    ],
    quick: [
      '.spec-first/standards/standards-update-decision.json',
    ],
    refresh: [
      '.spec-first/standards/project-shape.json',
      '.spec-first/standards/standards-plan.json',
      '.spec-first/standards/glue-map.json',
      '.spec-first/standards/standards-update-decision.json',
      '.spec-first/standards/standards-candidates.json',
      '.spec-first/standards/standards-preview.md',
    ],
    deep: [
      '.spec-first/standards/project-shape.json',
      '.spec-first/standards/standards-plan.json',
      '.spec-first/standards/glue-map.json',
      '.spec-first/standards/graph-query-index.json',
      '.spec-first/standards/standards-candidates.json',
      '.spec-first/standards/standards-preview.md',
    ],
  };
  const generate = [...generateByMode[options.mode]];

  if (importArtifacts) {
    generate.push(
      '.spec-first/standards/standards-sources.json',
      '.spec-first/standards/import-lock.json',
      '.spec-first/standards/imported-standards.json',
    );
  }

  return {
    generate,
    defer: [
      '.spec-first/standards/repo-profile.patch.yaml',
    ],
    skip: [],
  };
}

function buildSynthesisContract(options, enabledDomains, importArtifacts) {
  return {
    schema_version: 'spec-first.standards-synthesis-contract.v1',
    mode: options.mode,
    enabled_domains: enabledDomains,
    inputs: {
      deterministic_facts: [
        '.spec-first/standards/project-shape.json',
        '.spec-first/standards/standards-plan.json',
        '.spec-first/standards/glue-map.json',
      ],
      optional_imports: importArtifacts ? [
        '.spec-first/standards/standards-sources.json',
        '.spec-first/standards/import-lock.json',
        '.spec-first/standards/imported-standards.json',
      ] : [],
      optional_graph_plan: options.mode === 'deep'
        ? '.spec-first/standards/graph-query-index.json'
        : null,
    },
    outputs: {
      candidates: '.spec-first/standards/standards-candidates.json',
      preview: '.spec-first/standards/standards-preview.md',
      repo_profile_patch: '.spec-first/standards/repo-profile.patch.yaml',
    },
    candidate_required_fields: [
      'id',
      'domain',
      'type',
      'status',
      'confidence',
      'rule_candidate',
      'source_type',
      'evidence',
      'suggested_action',
      'downstream_usage',
    ],
    allowed_statuses: CANDIDATE_STATUSES,
    allowed_source_types: CANDIDATE_SOURCE_TYPES,
    evidence_policy: {
      max_evidence_per_candidate: buildModeBudget(options.mode).max_evidence_per_candidate,
      bounded_paths_only: true,
      raw_graph_results_are_session_local: true,
      missing_graph_means_degraded_confidence: true,
    },
    writeback_policy: {
      repo_profile_yaml_modified_by_default: false,
      only_confirmed_candidates_are_patch_eligible: true,
      patch_requires_explicit_user_confirmation: true,
    },
    downstream_consumers: buildDownstreamConsumers(),
  };
}

function buildUpdateDecision(repoRoot, options, projectShape) {
  const existingArtifacts = BASELINE_REVIEW_ARTIFACTS.map((fileName) => {
    const filePath = path.join(options.output, fileName);
    const exists = fs.existsSync(filePath);
    const stat = exists ? fs.statSync(filePath) : null;
    return {
      path: path.relative(repoRoot, filePath).replace(/\\/g, '/'),
      exists,
      size_bytes: stat ? stat.size : null,
      modified_at: stat ? stat.mtime.toISOString() : null,
    };
  });
  const missingArtifacts = existingArtifacts
    .filter((artifact) => !artifact.exists)
    .map((artifact) => artifact.path);
  const existingProjectShape = readJsonIfExists(path.join(options.output, 'project-shape.json'));
  const currentInventoryHash = projectShape.evidence.inventory_hash;
  const existingInventoryHash = existingProjectShape
    && existingProjectShape.evidence
    && existingProjectShape.evidence.inventory_hash
      ? existingProjectShape.evidence.inventory_hash
      : null;
  const reasonCodes = [];
  let recommendation = 'reuse-current-baseline';

  if (options.mode === 'refresh') {
    recommendation = 'refresh-requested';
    reasonCodes.push('explicit-refresh-request');
  } else if (missingArtifacts.some((artifact) => artifact.endsWith('project-shape.json')
    || artifact.endsWith('standards-plan.json')
    || artifact.endsWith('glue-map.json'))) {
    recommendation = 'run-baseline';
    reasonCodes.push('missing-fact-artifacts');
  } else if (!existingInventoryHash) {
    recommendation = 'refresh';
    reasonCodes.push('missing-existing-inventory-hash');
  } else if (existingInventoryHash !== currentInventoryHash) {
    recommendation = 'refresh';
    reasonCodes.push('inventory-hash-changed');
  } else if (missingArtifacts.length > 0) {
    recommendation = 'complete-preview';
    reasonCodes.push('missing-review-artifacts');
  } else {
    reasonCodes.push('baseline-artifacts-current');
  }

  return {
    schema_version: STANDARDS_UPDATE_DECISION_SCHEMA,
    generated_at: new Date().toISOString(),
    mode: options.mode,
    scope: buildScope(options),
    recommendation,
    reason_codes: reasonCodes,
    current_inventory_hash: currentInventoryHash,
    existing_inventory_hash: existingInventoryHash,
    existing_artifacts: existingArtifacts,
    missing_artifacts: missingArtifacts,
    next_actions: buildUpdateNextActions(recommendation),
  };
}

function buildUpdateNextActions(recommendation) {
  const actions = {
    'run-baseline': [
      'Run spec-standards --baseline before downstream workflows consume standards artifacts.',
    ],
    refresh: [
      'Run spec-standards --refresh with a bounded domain, module, or repo scope.',
    ],
    'refresh-requested': [
      'Regenerate bounded facts, then let the LLM refresh candidates and preview for the requested scope.',
    ],
    'complete-preview': [
      'Keep fact artifacts and let the LLM regenerate standards-candidates.json and standards-preview.md.',
    ],
    'reuse-current-baseline': [
      'Reuse the current standards baseline as downstream context.',
    ],
  };
  return actions[recommendation] || [];
}

function buildGraphQueryIndex(projectShape, options) {
  const domains = (options.domains.length > 0
    ? options.domains
    : projectShape.recommended_standard_domains.filter((domain) => (
      !['agent_profiles', 'docs', 'tests'].includes(domain)
    ))
  ).slice(0, buildModeBudget('deep').max_enabled_lenses);

  return {
    schema_version: GRAPH_QUERY_INDEX_SCHEMA,
    generated_at: new Date().toISOString(),
    mode: 'deep',
    scope: buildScope(options),
    graph_status: projectShape.graph.status,
    query_budget: {
      max_queries: Math.max(2, domains.length * 2),
      max_results_per_query: 8,
      raw_results_path: '.spec-first/standards/graph-query-raw/',
    },
    planned_queries: domains.flatMap((domain) => [
      {
        id: `deep.${domain}.conventions`,
        domain,
        provider_hint: 'GitNexus',
        query: `${domain} conventions standards evidence`,
        purpose: 'Find observed project conventions that can support standards candidates.',
      },
      {
        id: `deep.${domain}.reuse`,
        domain,
        provider_hint: 'GitNexus',
        query: `${domain} reuse capability entrypoints artifacts`,
        purpose: 'Find reusable capabilities that downstream workflows should prefer over reimplementation.',
      },
    ]),
    execution_boundary: 'This index is a deterministic query plan. Live MCP results are session-local evidence and must not be written as confirmed standards without LLM review.',
  };
}

function buildImportArtifacts(repoRoot, importSource, workspaceRoot = repoRoot) {
  const source = inspectImportSource(repoRoot, importSource, workspaceRoot);
  const importedItems = source.local_path
    ? collectImportedStandards(source.local_path)
    : [];
  const sourceSummary = {
    id: source.id,
    input: importSource,
    type: source.type,
    status: source.status,
    local_path: source.local_path ? path.relative(repoRoot, source.local_path).replace(/\\/g, '/') : null,
    workspace_path: source.local_path ? path.relative(workspaceRoot, source.local_path).replace(/\\/g, '/') : null,
    git: source.git,
    reason_code: source.reason_code,
  };

  return {
    standardsSources: {
      schema_version: STANDARDS_SOURCES_SCHEMA,
      generated_at: new Date().toISOString(),
      sources: [sourceSummary],
    },
    importLock: {
      schema_version: IMPORT_LOCK_SCHEMA,
      generated_at: new Date().toISOString(),
      source: sourceSummary,
      item_count: importedItems.length,
      content_hash: hashString(JSON.stringify(importedItems.map((item) => ({
        source_path: item.source_path,
        content_hash: item.content_hash,
      })))),
    },
    importedStandards: {
      schema_version: IMPORTED_STANDARDS_SCHEMA,
      generated_at: new Date().toISOString(),
      source_id: source.id,
      source_status: source.status,
      items: importedItems,
      alignment_required: true,
      eligible_for_repo_profile_writeback: false,
      import_boundary: 'Imported standards are awaiting project alignment and are not confirmed project policy.',
    },
  };
}

function inspectImportSource(repoRoot, importSource, workspaceRoot = repoRoot) {
  const localPath = resolveLocalImportPath(repoRoot, importSource, workspaceRoot);
  const isRemote = /^(https?:\/\/|git@|ssh:\/\/)/.test(importSource);
  if (!localPath) {
    return {
      id: `standards-source.${hashString(importSource).slice(7, 19)}`,
      type: isRemote ? 'git_remote' : 'unknown',
      status: 'unavailable',
      local_path: null,
      git: null,
      reason_code: isRemote ? 'remote-fetch-not-performed' : 'source-path-not-found',
    };
  }

  const stat = fs.statSync(localPath);
  const git = readGitMetadata(localPath);
  const sourceIdentity = git && git.remote
    ? `${git.remote}:${git.commit || 'unknown'}`
    : path.relative(workspaceRoot, localPath).replace(/\\/g, '/') || importSource;
  return {
    id: `standards-source.${hashString(`${stat.isDirectory() ? 'local_directory' : 'local_file'}:${sourceIdentity}`).slice(7, 19)}`,
    type: stat.isDirectory() ? 'local_directory' : 'local_file',
    status: 'available',
    local_path: localPath,
    git,
    reason_code: null,
  };
}

function resolveLocalImportPath(repoRoot, importSource, workspaceRoot = repoRoot) {
  const candidates = [
    path.resolve(workspaceRoot, importSource),
    path.resolve(repoRoot, importSource),
    path.resolve(importSource),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function readGitMetadata(sourcePath) {
  const cwd = fs.statSync(sourcePath).isDirectory() ? sourcePath : path.dirname(sourcePath);
  const commit = runGit(cwd, ['rev-parse', 'HEAD']);
  const remote = runGit(cwd, ['remote', 'get-url', 'origin']);
  if (!commit && !remote) return null;
  return {
    commit,
    remote,
  };
}

function runGit(cwd, args) {
  const result = spawnSync('git', ['-C', cwd, ...args], {
    encoding: 'utf8',
    timeout: 2000,
  });
  if (result.status !== 0) return null;
  return result.stdout.trim() || null;
}

function collectImportedStandards(sourcePath) {
  const stat = fs.statSync(sourcePath);
  const files = stat.isDirectory()
    ? walkFiles(sourcePath, {
      maxFiles: 200,
      root: sourcePath,
      ignoredDirs: new Set(['.git', 'node_modules', 'tmp', 'temp', 'dist', 'coverage']),
      ignoredRelativePrefixes: [],
    })
    : [sourcePath];

  return files
    .filter(isImportableStandardsFile)
    .slice(0, 100)
    .map((filePath) => importedStandardItem(sourcePath, filePath));
}

function isImportableStandardsFile(filePath) {
  return ['.md', '.json', '.yaml', '.yml'].includes(path.extname(filePath));
}

function importedStandardItem(sourceRoot, filePath) {
  const contents = fs.readFileSync(filePath, 'utf8');
  const relativePath = path.relative(
    fs.statSync(sourceRoot).isDirectory() ? sourceRoot : path.dirname(sourceRoot),
    filePath,
  ).replace(/\\/g, '/');
  const title = extractTitle(contents, filePath);
  return {
    id: `imported.${slugify(relativePath)}`,
    source_path: relativePath,
    title,
    status: 'imported',
    source_type: 'shared_standard_imported',
    content_hash: hashString(contents),
    size_bytes: Buffer.byteLength(contents, 'utf8'),
    evidence: [
      {
        path: relativePath,
        source: 'import-source',
        reason: 'Imported for project alignment; not confirmed policy.',
      },
    ],
  };
}

function extractTitle(contents, filePath) {
  const heading = contents.split(/\r?\n/).find((line) => /^#\s+/.test(line));
  if (heading) return heading.replace(/^#\s+/, '').trim();
  return path.basename(filePath, path.extname(filePath));
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'standard';
}

function hashString(value) {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return null;
  }
}

function buildGlueMap(projectShape, inventory, args = {}) {
  const options = normalizePlanOptions(args);
  const capabilities = [];
  const domains = projectShape.domains;
  const files = new Set(inventory.files);
  const hasSpecFirstRuntimeSync = (
    files.has('bin/spec-first.js')
    && files.has('src/cli/commands/init.js')
    && inventory.files.some((file) => file.startsWith('templates/claude/commands/spec/'))
  );

  if (domains.graph.detected && files.has('skills/spec-graph-bootstrap/SKILL.md')) {
    capabilities.push(capability({
      id: 'capability.graph.readiness',
      name: 'Graph Readiness Compiler',
      kind: 'code_facts_provider',
      owners: ['spec-graph-bootstrap'],
      entrypoints: ['skills/spec-graph-bootstrap/SKILL.md'],
      outputs: [
        '.spec-first/graph/graph-facts.json',
        '.spec-first/graph/architecture-facts.json',
        '.spec-first/graph/reuse-candidates.json',
        '.spec-first/graph/bootstrap-impact-capabilities.json',
      ],
      reuse_when: ['需要项目图谱事实', '需要影响面或复用候选', '需要下游 workflow 的 provider readiness 输入'],
      do_not_reimplement: ['不要在下游 workflow 中重新扫描全仓替代 graph readiness facts'],
      evidence: domains.graph.evidence,
    }));
  }

  if (domains.skill_workflow.detected) {
    capabilities.push(capability({
      id: 'capability.workflow.skills',
      name: 'Spec-first workflow skills',
      kind: 'workflow_orchestration',
      owners: ['skills/'],
      entrypoints: ['skills/'],
      outputs: ['skills/*/SKILL.md'],
      reuse_when: ['新增 public workflow', '调整 workflow 入口治理', '定义 agent 可执行方法论'],
      do_not_reimplement: ['不要把 workflow 行为复制到 AGENTS.md / CLAUDE.md managed block'],
      evidence: domains.skill_workflow.evidence,
    }));
  }

  if (hasSpecFirstRuntimeSync) {
    capabilities.push(capability({
      id: 'capability.cli.runtime-sync',
      name: 'Host runtime asset synchronization',
      kind: 'runtime_delivery',
      owners: ['src/cli/'],
      entrypoints: ['bin/spec-first.js', 'src/cli/commands/init.js'],
      outputs: ['.claude/', '.codex/', '.agents/skills/'],
      reuse_when: ['需要安装或刷新 host runtime assets', '需要双宿主投递治理'],
      do_not_reimplement: ['不要手改 generated runtime mirrors 作为 source fix'],
      evidence: domains.cli.evidence,
    }));
  }

  if (domains.artifact_contracts.detected) {
    capabilities.push(capability({
      id: 'capability.contracts.machine-readable',
      name: 'Machine-readable contract registry',
      kind: 'artifact_contract',
      owners: ['src/cli/contracts/'],
      entrypoints: domains.artifact_contracts.evidence,
      outputs: domains.artifact_contracts.evidence,
      reuse_when: ['需要稳定 schema 或 governance truth source'],
      do_not_reimplement: ['不要在 docs side 复制 machine-readable contract 真源'],
      evidence: domains.artifact_contracts.evidence,
    }));
  }

  return {
    schema_version: GLUE_MAP_SCHEMA,
    generated_at: new Date().toISOString(),
    scope: buildScope(options),
    capabilities,
    downstream_consumers: buildDownstreamConsumers(),
    glue_patterns: [
      {
        id: 'pattern.source-first-runtime-regeneration',
        summary: 'Source files define workflow behavior; init regenerates host runtime mirrors.',
        evidence: ['skills/', 'templates/', 'src/cli/'],
      },
    ],
    risks: inventory.graph_artifacts.length === 0
      ? [
        {
          id: 'risk.graph-evidence-missing',
          severity: 'medium',
          summary: 'Graph readiness artifacts were not detected; graph-backed standards candidates must use degraded confidence.',
        },
      ]
      : [],
  };
}

function buildDownstreamConsumers() {
  const consumptionModes = {
    confirmed: 'hard',
    observed: 'advisory',
    imported: 'advisory',
    suggested: 'advisory',
    conflict: 'risk',
    unknown: 'question',
    deprecated: 'risk',
    drifted: 'risk',
    validator_fail: 'degraded/advisory',
    trust_level_degraded: 'degraded/advisory',
    missing_validation_result: 'degraded/advisory',
  };
  const sharedBoundary = {
    hard_context: ['confirmed'],
    advisory_context: ['observed', 'imported', 'suggested'],
    risk_context: ['conflict', 'deprecated', 'drifted'],
    question_context: ['unknown'],
    degraded_context: ['validator_fail', 'trust_level=degraded', 'missing_validation_result'],
    consumption_modes: consumptionModes,
    glue_map_boundary: 'glue-map.json supports reuse-first decisions only; it is not a workflow state machine.',
  };

  return [
    {
      ...sharedBoundary,
      workflow: 'spec-brainstorm',
      soft_context: ['observed', 'imported', 'suggested', 'conflict', 'unknown', 'deprecated', 'drifted'],
      consume: ['project-shape.json', 'standards-candidates.json'],
      boundary: 'Use standards to avoid off-target requirements; do not turn observed conventions into product scope.',
    },
    {
      ...sharedBoundary,
      workflow: 'spec-plan',
      soft_context: ['observed', 'imported', 'suggested', 'conflict', 'unknown', 'deprecated', 'drifted'],
      consume: ['project-shape.json', 'standards-candidates.json', 'glue-map.json'],
      boundary: 'Use glue capabilities for reuse-first implementation boundaries; resolve conflicts in the plan.',
    },
    {
      ...sharedBoundary,
      workflow: 'spec-write-tasks',
      soft_context: ['observed', 'imported', 'suggested', 'conflict', 'unknown', 'deprecated', 'drifted'],
      consume: ['standards-candidates.json', 'glue-map.json'],
      boundary: 'Carry standards as context refs and task constraints without changing source-plan scope.',
    },
    {
      ...sharedBoundary,
      workflow: 'spec-work',
      soft_context: ['observed', 'imported', 'suggested', 'conflict', 'unknown', 'deprecated', 'drifted'],
      consume: ['standards-candidates.json', 'glue-map.json'],
      boundary: 'Follow confirmed standards and prefer listed glue capabilities; treat soft candidates as advisory.',
    },
    {
      ...sharedBoundary,
      workflow: 'spec-code-review',
      soft_context: ['observed', 'imported', 'suggested', 'conflict', 'unknown', 'deprecated', 'drifted'],
      consume: ['standards-candidates.json', 'standards-preview.md'],
      boundary: 'Report confirmed-standard violations as findings; use soft candidates only for context or questions.',
    },
  ];
}

function capability(fields) {
  return {
    ...fields,
    discovered_by: ['spec-standards.prepare-baseline'],
    evidence: fields.evidence || [],
  };
}

function writeJson(filePath, payload) {
  const contents = `${JSON.stringify(payload, null, 2)}\n`;
  const tmpPath = `${filePath}.tmp-${crypto.randomBytes(6).toString('hex')}`;
  fs.writeFileSync(tmpPath, contents, 'utf8');
  fs.renameSync(tmpPath, filePath);
}

if (require.main === module) {
  main();
}

module.exports = {
  buildGraphQueryIndex,
  buildGlueMap,
  buildImportArtifacts,
  buildInventory,
  buildProjectShape,
  buildStandardsPlan,
  buildUpdateDecision,
  buildDownstreamConsumers,
  parseArgs,
  prepareBaseline,
};
