'use strict';

const path = require('node:path');

const { normalizeWorkspaceRoot } = require('./artifacts');
const { buildWorkspaceStatus } = require('./status');

function normalizeText(value) {
  return String(value || '').toLowerCase();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function isNestedWorkspacePath(filePath, childRelativePaths) {
  return childRelativePaths.some((relativePath) => (
    relativePath &&
    relativePath !== '.' &&
    (filePath === relativePath || filePath.startsWith(`${relativePath}/`))
  ));
}

function changedFileMatchesCandidate(normalized, child, options) {
  const basename = normalizeText(path.basename(child.repo_root));
  const slug = normalizeText(child.slug);
  const relativePath = normalizeText(child.relative_path);

  if (relativePath === '.') {
    return Boolean(normalized) &&
      !path.isAbsolute(normalized) &&
      !normalized.startsWith('../') &&
      !isNestedWorkspacePath(normalized, options.childRelativePaths || []);
  }

  return (
    normalized.startsWith(`${relativePath}/`) ||
    normalized.startsWith(`${basename}/`) ||
    normalized.startsWith(`${slug}/`)
  );
}

function scoreCandidate(child, options) {
  const task = normalizeText(options.task);
  const changedFiles = Array.isArray(options.changedFiles) ? options.changedFiles : [];
  let score = 0;
  const signals = [];
  const basename = normalizeText(path.basename(child.repo_root));
  const slug = normalizeText(child.slug);
  const relativePath = normalizeText(child.relative_path);

  if (child.readiness === 'ready') score += 20;
  else if (child.readiness === 'degraded' || child.readiness === 'unavailable') score += 5;

  if (task) {
    if (
      (relativePath && relativePath !== '.' && task.includes(`${relativePath}/`)) ||
      (basename && task.includes(`${basename}/`)) ||
      (slug && task.includes(`${slug}/`))
    ) {
      score += 25;
      signals.push('task_path_signal');
    }
    if (
      (basename && task.includes(basename)) ||
      (slug && task.includes(slug))
    ) {
      score += 15;
      signals.push('task_name_signal');
    }
  }

  for (const filePath of changedFiles) {
    const normalized = normalizeText(filePath);
    if (changedFileMatchesCandidate(normalized, child, options)) {
      score += 20;
      signals.push('changed_files_under_repo');
      break;
    }
  }

  return { score, signals };
}

function shellQuote(value) {
  return String(value).replace(/"/g, '\\"');
}

function buildRecommendedCommands(child, task) {
  const repo = child.repo_root;
  const taskArg = task ? ` --task="${shellQuote(task)}"` : '';
  return [
    `spec-first crg build --repo=${repo}`,
    `spec-first crg hook before-plan --repo=${repo}${taskArg}`,
    `spec-first crg hook before-work --repo=${repo}${taskArg}`,
  ];
}

function buildWorkspaceContext(workspaceRootInput, options = {}) {
  const workspaceRoot = normalizeWorkspaceRoot(workspaceRootInput || process.cwd());
  const status = buildWorkspaceStatus(workspaceRoot, { write: options.write !== false });
  const limitations = [...status.limitations];
  const candidateChildren = status.children.filter((child) => child.candidate);

  if (status.children.length === 0) {
    limitations.push({
      code: 'git_root_invalid',
      message: 'No validated child git repos were discovered under the workspace root.',
    });
  }

  const candidates = candidateChildren
    .map((child) => {
      const scored = scoreCandidate(child, {
        ...options,
        childRelativePaths: candidateChildren.map((candidate) => normalizeText(candidate.relative_path)),
      });
      const signals = unique([...child.signals, ...scored.signals]);
      return {
        slug: child.slug,
        repo_root: child.repo_root,
        relative_path: child.relative_path,
        relationship: child.relationship,
        readiness: child.readiness,
        score: scored.score,
        signals,
        limitations: child.limitations,
        recommended_commands: buildRecommendedCommands(child, options.task),
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.repo_root.localeCompare(b.repo_root);
    });

  return {
    workspace_root: workspaceRoot,
    task: options.task || null,
    generated_from_status: status.generated_at,
    scope: status.scope,
    candidates,
    advisory_policy: 'LLM/user chooses the repo boundary from advisory candidates; scripts do not select a semantic target repo.',
    multi_child_policy: 'If a task spans multiple child repos, decompose it into explicit sequential repo-local CRG runs.',
    stale_entries: status.stale_entries,
    limitations,
  };
}

module.exports = {
  buildWorkspaceContext,
  changedFileMatchesCandidate,
  scoreCandidate,
};
