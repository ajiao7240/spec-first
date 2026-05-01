'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const TEXT_FILE_PATTERN = /\.(kt|kts|java|swift|m|mm|xml|json|ya?ml|gradle|properties|txt|md|strings)$/i;
const SKIPPED_DIRS = new Set([
  '.git',
  '.gradle',
  '.idea',
  '.next',
  'DerivedData',
  'Pods',
  'build',
  'dist',
  'node_modules',
  'out',
  'target',
]);

function makeArtifact(options) {
  return {
    schema_version: options.schemaVersion,
    artifact_id: options.artifactId,
    generated_at: new Date().toISOString(),
    source_inputs: options.sourceInputs && options.sourceInputs.length > 0
      ? options.sourceInputs
      : [unavailableSourceInput('unknown', 'unavailable', 'input_missing')],
    consumers: options.consumers || ['expert-agents', 'evidence-auditor', 'report-writer'],
    contract_status: options.contractStatus || 'candidate',
    data_sensitivity: options.dataSensitivity || 'internal',
    ...(options.body || {}),
  };
}

function sourceInputFromFile(type, filePath, repoRoot) {
  const absolutePath = path.resolve(filePath);
  return {
    type,
    path: repoRoot ? publicPath(repoRoot, absolutePath, `${type}-outside-repo`) : `<${type}:input-path-redacted>`,
    source_hash: hashFile(absolutePath),
    freshness: 'current-worktree',
  };
}

function sourceInputFromFiles(type, files, repoRoot, options = {}) {
  if (options.truncated) {
    return {
      type,
      path: options.sourceRoot && repoRoot ? publicPath(repoRoot, options.sourceRoot, 'source-outside-repo') : (repoRoot ? '.' : 'multiple-files'),
      source_hash_unavailable_reason: 'file_scan_truncated',
      freshness: 'partial-worktree',
      file_count: files.length,
      max_files: options.maxFiles || files.length,
    };
  }
  const fileInputs = files
    .map((filePath) => {
      const relativePath = repoRoot ? publicPath(repoRoot, filePath, 'outside-repo-file') : '<file-path-redacted>';
      return `${relativePath}\0${safeHashFile(filePath)}`;
    })
    .sort();
  return {
    type,
    path: options.sourceRoot && repoRoot ? publicPath(repoRoot, options.sourceRoot, 'source-outside-repo') : (repoRoot ? '.' : 'multiple-files'),
    source_hash: hashText(fileInputs.join('\n')),
    freshness: 'current-worktree',
  };
}

function unavailableSourceInput(type, inputPath, reason) {
  return {
    type,
    path: String(inputPath || type),
    source_hash_unavailable_reason: reason,
    freshness: 'unavailable',
  };
}

function listTextFiles(root, options = {}) {
  return listTextFilesWithMetadata(root, options).files;
}

function listTextFilesWithMetadata(root, options = {}) {
  const absoluteRoot = path.resolve(root || '.');
  const maxFiles = options.maxFiles || 2000;
  const files = [];
  const stack = [absoluteRoot];
  let truncated = false;

  while (stack.length > 0 && files.length < maxFiles) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch (_error) {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRS.has(entry.name)) stack.push(fullPath);
        continue;
      }
      if (entry.isFile() && TEXT_FILE_PATTERN.test(entry.name)) {
        files.push(fullPath);
        if (files.length >= maxFiles) {
          truncated = true;
          break;
        }
      }
    }
  }

  return {
    files: files.sort((left, right) => left.localeCompare(right)),
    maxFiles,
    truncated,
  };
}

function listSourceTextFiles(options = {}) {
  const source = resolveBoundedSourceRoot(options);
  const scan = listTextFilesWithMetadata(source.sourceRoot, { maxFiles: options.maxFiles || 2000 });
  return {
    ...source,
    ...scan,
    degraded_modes: scan.truncated ? [degradedMode(
      'source_scan_truncated',
      'warning',
      'Source scan reached max file limit; source hash is intentionally unavailable.',
      null,
    )] : [],
  };
}

function readText(filePath, maxBytes = 128 * 1024) {
  const buffer = fs.readFileSync(filePath);
  return buffer.slice(0, maxBytes).toString('utf8');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
}

function readArtifact(filePath) {
  return readJson(filePath);
}

function writeJsonOutput(result, outputPath) {
  const json = `${JSON.stringify(result, null, 2)}\n`;
  if (outputPath) {
    const absolutePath = path.resolve(outputPath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, json);
  } else {
    process.stdout.write(json);
  }
}

function evidence(source, filePath, summary, extra = {}) {
  return {
    source,
    file: filePath ? toPosix(filePath) : null,
    summary,
    ...extra,
  };
}

function unique(values) {
  return [...new Set(values.filter((value) => value !== undefined && value !== null && String(value).length > 0))];
}

function slugify(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || 'item';
}

function normalizeName(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]/g, '');
}

function classifyStates(text) {
  const lower = String(text || '').toLowerCase();
  const states = [];
  const checks = [
    ['loading', /loading|submitting|progress|加载|提交中/],
    ['empty', /empty|no data|空态|暂无/],
    ['error', /error|failed|failure|异常|错误|失败/],
    ['success', /success|done|complete|成功|完成/],
    ['disabled', /disabled|disable|不可用|禁用/],
    ['offline', /offline|network|weak|断网|弱网/],
    ['permission_denied', /permission|denied|unauthorized|权限|拒绝/],
    ['retry', /retry|重试/],
  ];
  for (const [state, pattern] of checks) {
    if (pattern.test(lower)) states.push(state);
  }
  return unique(states);
}

function classifyEventKind(eventName) {
  const lower = String(eventName || '').toLowerCase();
  if (/page|view|screen|曝光/.test(lower)) return 'page_view';
  if (/click|tap|press|select/.test(lower)) return 'click';
  if (/submit|confirm|commit|pay|order/.test(lower)) return 'submit';
  if (/success|complete|done/.test(lower)) return 'success';
  if (/fail|error|reject|cancel/.test(lower)) return 'failed';
  if (/exposure|impression|show/.test(lower)) return 'exposure';
  return 'custom';
}

function parseCommonArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--source') options.source = argv[++index];
    else if (arg === '--repo-root') options.repoRoot = argv[++index];
    else if (arg === '--prd') options.prd = argv[++index];
    else if (arg === '--figma-context') options.figmaContext = argv[++index];
    else if (arg === '--product-contract') options.productContract = argv[++index];
    else if (arg === '--figma-contract') options.figmaContract = argv[++index];
    else if (arg === '--figma-node') options.figmaNode = argv[++index];
    else if (arg === '--figma-file') options.figmaFile = argv[++index];
    else if (arg === '--redaction') options.redaction = argv[++index];
    else if (arg === '--code-contract') options.codeContract = argv[++index];
    else if (arg === '--architecture-contract') options.architectureContract = argv[++index];
    else if (arg === '--analytics-contract') options.analyticsContract = argv[++index];
    else if (arg === '--i18n-contract') options.i18nContract = argv[++index];
    else if (arg === '--industry-profile') options.industryProfile = argv[++index];
    else if (arg === '--pilot-validation') options.pilotValidation = argv[++index];
    else if (arg === '--preflight') options.preflight = argv[++index];
    else if (arg === '--industry') options.industry = argv[++index];
    else if (arg === '--confirmed-industry') options.confirmedIndustry = argv[++index];
    else if (arg === '--allow-outside') {
      options.allowOutside = options.allowOutside || [];
      options.allowOutside.push(argv[++index]);
    } else if (arg === '--max-files') options.maxFiles = Number(argv[++index]);
    else if (arg === '--artifacts') {
      options.artifacts = options.artifacts || [];
      options.artifacts.push(argv[++index]);
    } else if (arg === '--issue') {
      options.issues = options.issues || [];
      options.issues.push(argv[++index]);
    } else if (arg === '--output') options.output = argv[++index];
    else if (!arg.startsWith('--') && !options.source) options.source = arg;
  }
  return options;
}

function relativeTo(root, filePath) {
  return publicPath(path.resolve(root || '.'), path.resolve(filePath), 'outside-repo-file');
}

function hashFile(filePath) {
  return hashText(fs.readFileSync(filePath));
}

function safeHashFile(filePath) {
  try {
    return hashFile(filePath);
  } catch (error) {
    return `unreadable:${error.code || 'read_failed'}`;
  }
}

function hashText(value) {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

function resolveBoundedInputPath(options) {
  const repoRoot = fs.existsSync(path.resolve(options.repoRoot || '.'))
    ? fs.realpathSync(path.resolve(options.repoRoot || '.'))
    : path.resolve(options.repoRoot || '.');
  const requested = path.resolve(repoRoot, String(options.inputPath || '.'));
  const result = {
    ok: false,
    kind: options.kind,
    path: requested,
    realpath: null,
    reason_code: null,
    reason: null,
  };

  if (!fs.existsSync(requested)) {
    result.reason_code = `${options.kind}_missing`;
    result.reason = `${options.kind} path does not exist.`;
    return result;
  }

  const stat = fs.statSync(requested);
  if (options.expected === 'file' && !stat.isFile()) {
    result.reason_code = `${options.kind}_not_file`;
    result.reason = `${options.kind} path is not a file.`;
    return result;
  }
  if (options.expected === 'directory' && !stat.isDirectory()) {
    result.reason_code = `${options.kind}_not_directory`;
    result.reason = `${options.kind} path is not a directory.`;
    return result;
  }

  const allowOutside = normalizeAllowOutside(repoRoot, options.allowOutside || []);
  const requestedLocation = resolvePathLocation(requested);
  const realpath = fs.realpathSync(requested);
  result.realpath = realpath;
  const requestedInside = isInsideOrSame(repoRoot, requestedLocation);
  const realInside = isInsideOrSame(repoRoot, realpath);
  const outsideAllowed = allowOutside.some((allowedRoot) => isInsideOrSame(allowedRoot, realpath));

  if (requestedInside && !realInside && !outsideAllowed) {
    result.reason_code = 'symlink_escape';
    result.reason = `${options.kind} resolves outside repo root through a symlink.`;
    return result;
  }
  if (!realInside && !outsideAllowed) {
    result.reason_code = 'path_outside_repo';
    result.reason = `${options.kind} path is outside repo root and not allowlisted.`;
    return result;
  }
  if (options.maxBytes && stat.size > options.maxBytes) {
    result.reason_code = 'file_too_large';
    result.reason = `${options.kind} file exceeds max size ${options.maxBytes} bytes.`;
    return result;
  }

  result.ok = true;
  result.reason_code = '';
  result.reason = '';
  return result;
}

function resolveBoundedSourceRoot(options = {}) {
  const repoRootInput = options.repoRoot || options.source || '.';
  const repoRoot = fs.existsSync(path.resolve(repoRootInput))
    ? fs.realpathSync(path.resolve(repoRootInput))
    : path.resolve(repoRootInput);
  const resolution = resolveBoundedInputPath({
    repoRoot,
    inputPath: options.source || '.',
    kind: 'source',
    expected: 'directory',
    allowOutside: options.allowOutside || options.allowOutsidePaths || [],
  });
  if (!resolution.ok) {
    throw new Error(`source rejected: ${resolution.reason}`);
  }
  return {
    repoRoot,
    sourceRoot: resolution.realpath,
  };
}

function publicPath(repoRoot, filePath, label = 'outside-repo') {
  if (!filePath) return null;
  const absolutePath = path.resolve(repoRoot || '.', String(filePath));
  const root = path.resolve(repoRoot || '.');
  if (isInsideOrSame(root, absolutePath)) return toPosix(path.relative(root, absolutePath)) || '.';
  return `<${label}:${hashText(absolutePath).slice(7, 19)}>`;
}

function degradedMode(code, severity, summary, filePath) {
  return {
    code,
    severity,
    summary,
    path: filePath ? toPosix(filePath) : null,
  };
}

function normalizeAllowOutside(repoRoot, values) {
  return []
    .concat(values || [])
    .filter(Boolean)
    .map((entry) => path.resolve(repoRoot, String(entry)))
    .filter((entry) => fs.existsSync(entry))
    .map((entry) => fs.realpathSync(entry));
}

function isInsideOrSame(parentPath, childPath) {
  const relative = path.relative(parentPath, childPath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function resolvePathLocation(filePath) {
  const parent = path.dirname(filePath);
  if (!fs.existsSync(parent)) return filePath;
  return path.join(fs.realpathSync(parent), path.basename(filePath));
}

function toPosix(value) {
  return String(value || '').replace(/\\/g, '/');
}

module.exports = {
  classifyEventKind,
  classifyStates,
  evidence,
  hashFile,
  hashText,
  listSourceTextFiles,
  listTextFiles,
  listTextFilesWithMetadata,
  makeArtifact,
  normalizeName,
  parseCommonArgs,
  publicPath,
  readArtifact,
  readJson,
  readText,
  relativeTo,
  resolveBoundedInputPath,
  resolveBoundedSourceRoot,
  slugify,
  sourceInputFromFile,
  sourceInputFromFiles,
  toPosix,
  unavailableSourceInput,
  unique,
  writeJsonOutput,
};
