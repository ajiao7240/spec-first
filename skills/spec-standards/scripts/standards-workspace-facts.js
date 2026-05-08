#!/usr/bin/env node
'use strict';

const DEFAULT_WORKSPACE_CHILD_MAX_FILES = 800;
const WORKSPACE_CHILD_FACT_LIMIT = 20;

function buildWorkspaceInventory(workspaceRoot, options, buildInventory) {
  const childPrefixes = options.workspaceChildren
    .map((child) => `${child.workspace_relative_path}/`);
  return buildInventory(workspaceRoot, {
    ignoredRelativePrefixes: childPrefixes,
  });
}

function buildWorkspaceFacts(options, buildWorkspaceChildFacts) {
  const children = options.workspaceChildren || [];
  const selectedChildren = workspaceChildSample(children);
  const truncated = children.length > selectedChildren.length;
  const childRepos = selectedChildren.map((child) => buildWorkspaceChildFacts(child));
  const languageCounts = {};
  const packageManagers = new Set();
  const detectedTypes = {};

  for (const child of childRepos) {
    for (const language of child.languages) {
      languageCounts[language.language] = (languageCounts[language.language] || 0) + language.file_count;
    }
    for (const manager of child.package_managers) {
      packageManagers.add(manager);
    }
    detectedTypes[child.detected_type] = (detectedTypes[child.detected_type] || 0) + 1;
  }

  return {
    schema_version: 'spec-first.workspace-children.v1',
    status: children.length > 0 ? 'detected' : 'explicit-empty-workspace',
    child_repo_count: children.length,
    child_repos: childRepos,
    child_repos_truncated: truncated,
    language_summary: Object.entries(languageCounts)
      .sort((left, right) => right[1] - left[1])
      .map(([language, file_count]) => ({ language, file_count })),
    package_managers: [...packageManagers].sort(),
    detected_type_counts: detectedTypes,
    scan: {
      max_child_repos: WORKSPACE_CHILD_FACT_LIMIT,
      child_inventory_max_files: DEFAULT_WORKSPACE_CHILD_MAX_FILES,
      child_repo_ordering: 'lexical',
      mixed_child_source_scan: false,
      parent_artifacts_advisory_only: true,
    },
  };
}

function buildWorkspaceScope(options) {
  const childRepoSample = workspaceChildPathSample(options.workspaceChildren);
  return {
    type: 'workspace',
    root: '.',
    domains: options.domains,
    modules: options.modules,
    workspace: {
      child_repo_count: options.workspaceChildren.length,
      child_repos: childRepoSample,
      child_repos_truncated: options.workspaceChildren.length > childRepoSample.length,
      child_repo_ordering: 'lexical',
      artifacts_advisory_only: true,
    },
  };
}

function buildWorkspacePolicy(options) {
  if (options.targetKind !== 'workspace') {
    return {
      active: false,
      artifacts_are_advisory: false,
    };
  }

  return {
    active: true,
    artifacts_are_advisory: true,
    parent_workspace_writes: [
      '.spec-first/standards/*',
    ],
    forbidden_writes: [
      '<child>/.spec-first/standards/*',
      '<child>/.spec-first/specs/repo-profile.yaml',
      'repo-profile.yaml',
    ],
    confirmed_candidate_policy: 'Workspace artifacts may summarize shared observations, imported standards, conflicts, and unknowns; child repo policy still requires child-local confirmation or explicit external attestation.',
    downstream_usage: 'Use as workspace routing and alignment context. Do not treat it as a child repo standards baseline.',
  };
}

function buildWorkspaceChildRepoMapCapability(options, capability) {
  const childRepoSample = workspaceChildPathSample(options.workspaceChildren);
  return capability({
    id: 'capability.workspace.child-repo-map',
    name: 'Workspace child repo map',
    kind: 'workspace_advisory_context',
    owners: ['parent workspace'],
    entrypoints: childRepoSample,
    child_repo_count: options.workspaceChildren.length,
    child_repos_truncated: options.workspaceChildren.length > childRepoSample.length,
    outputs: ['.spec-first/standards/project-shape.json'],
    reuse_when: ['需要从父 workspace 选择 child repo', '需要比较多个 child repo 的 shared standards alignment'],
    do_not_reimplement: ['不要把 parent workspace advisory baseline 当成 child repo confirmed standards'],
    evidence: childRepoSample,
  });
}

function workspaceChildSample(children) {
  return (children || []).slice(0, WORKSPACE_CHILD_FACT_LIMIT);
}

function workspaceChildPathSample(children) {
  return workspaceChildSample(children).map((child) => child.workspace_relative_path);
}

function hashWorkspaceSummary(workspace, hashString) {
  return hashString(JSON.stringify({
    child_repo_count: workspace.child_repo_count,
    child_repos_truncated: workspace.child_repos_truncated,
    child_repos: workspace.child_repos.map((child) => ({
      path: child.workspace_relative_path,
      inventory_hash: child.evidence && child.evidence.inventory_hash,
      inventory_hash_reliability: child.evidence && child.evidence.inventory_hash_reliability,
      scan_truncated: child.evidence && child.evidence.scan_truncated,
    })),
  }));
}

module.exports = {
  DEFAULT_WORKSPACE_CHILD_MAX_FILES,
  WORKSPACE_CHILD_FACT_LIMIT,
  buildWorkspaceChildRepoMapCapability,
  buildWorkspaceFacts,
  buildWorkspaceInventory,
  buildWorkspacePolicy,
  buildWorkspaceScope,
  hashWorkspaceSummary,
};
