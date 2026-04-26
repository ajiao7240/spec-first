'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  GRAPH_CODE_NAVIGATION_FILE,
  resolveGraphDir,
} = require('../artifact-paths');

function readCodeNavigation(repoRoot) {
  const navigationPath = path.join(resolveGraphDir(repoRoot), GRAPH_CODE_NAVIGATION_FILE);
  if (!fs.existsSync(navigationPath)) {
    return {
      schema_version: 'code-navigation/v1',
      source: 'missing',
      entrypoints: [],
      test_roots: [],
      high_risk_nodes: [],
      top_communities: [],
      top_flows: [],
      query_starters: [],
      limitations: [{
        code: 'code-navigation-missing',
        message: 'code-navigation.json is not available yet.',
      }],
    };
  }
  try {
    return {
      source: 'artifact',
      ...JSON.parse(fs.readFileSync(navigationPath, 'utf8')),
    };
  } catch (error) {
    return {
      schema_version: 'code-navigation/v1',
      source: 'invalid',
      entrypoints: [],
      test_roots: [],
      high_risk_nodes: [],
      top_communities: [],
      top_flows: [],
      query_starters: [],
      limitations: [{
        code: 'code-navigation-invalid',
        message: error && error.message ? error.message : String(error),
      }],
    };
  }
}

function buildRecommendedQueries(stage, { task, since, workRun } = {}) {
  const cleanTask = String(task || '').trim();
  const queries = [];

  if (stage === 'plan') {
    queries.push({
      command: `spec-first crg locate --repo=<repo> --query="${cleanTask || '<task keywords>'}" --detail=minimal`,
      purpose: 'Find candidate files and symbols for the requested change.',
    });
    queries.push({
      command: 'spec-first crg explain --repo=<repo> --node=<candidate> --detail=standard',
      purpose: 'Inspect one candidate before selecting the planned change surface.',
    });
    queries.push({
      command: 'spec-first crg path --repo=<repo> --from=<candidate-a> --to=<candidate-b> --detail=standard',
      purpose: 'Explain why two candidates are connected.',
    });
  } else if (stage === 'work') {
    queries.push({
      command: 'spec-first crg impact --repo=<repo> --symbol=<planned-symbol> --depth=2',
      purpose: 'Check likely blast radius before editing.',
    });
    queries.push({
      command: `spec-first crg review-context --repo=<repo> --since=${since || '<work-start-ref>'}`,
      purpose: 'Compare actual diff against the planned surface after editing.',
    });
  } else if (stage === 'review') {
    queries.push({
      command: `spec-first crg review-context --repo=<repo> --since=${since || '<base-ref>'}`,
      purpose: 'Rank review focus by changed nodes, graph expansion, flows, and candidate tests.',
    });
    if (workRun) {
      queries.push({
        command: `spec-first crg hook before-review --repo=<repo> --work-run=${workRun}`,
        purpose: 'Reuse the work run handoff when reviewing a completed spec-work session.',
      });
    }
  }

  return queries;
}

module.exports = {
  buildRecommendedQueries,
  readCodeNavigation,
};
