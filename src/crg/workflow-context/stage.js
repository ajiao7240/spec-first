'use strict';

const path = require('node:path');
const { buildGraphStatus } = require('./status');
const { buildRecommendedQueries, readCodeNavigation } = require('./navigation');
const { filterSuggestedReads } = require('./suggested-reads-filter');

const VALID_STAGES = new Set(['plan', 'work', 'review']);

function parseWorkflowContextArgs(argv) {
  const result = {
    repoRoot: process.cwd(),
    stage: null,
    task: null,
    since: null,
    workRun: null,
    detailProfile: 'minimal',
  };

  for (const arg of Array.isArray(argv) ? argv : []) {
    if (arg.startsWith('--repo=')) result.repoRoot = path.resolve(arg.slice('--repo='.length));
    else if (arg.startsWith('--stage=')) result.stage = arg.slice('--stage='.length);
    else if (arg.startsWith('--task=')) result.task = arg.slice('--task='.length);
    else if (arg.startsWith('--since=')) result.since = arg.slice('--since='.length);
    else if (arg.startsWith('--work-run=')) result.workRun = arg.slice('--work-run='.length);
    else if (arg.startsWith('--detail=')) result.detailProfile = arg.slice('--detail='.length);
  }

  return result;
}

function buildFallback({ stage, graphStatus }) {
  const defaultReads = [
    'package.json',
    'src/',
    'tests/',
    'README.md',
  ];
  const { kept, denied } = filterSuggestedReads(defaultReads);
  return {
    mode: 'direct_repo_reads',
    reason: graphStatus.state,
    suggested_reads: kept,
    limitations: [
      ...graphStatus.limitations,
      ...denied.map((filePath) => ({
        code: 'suggested-read-filtered',
        message: `Filtered unsafe fallback path for ${stage}.`,
        path: filePath,
      })),
    ],
  };
}

function buildWorkflowContext(options = {}) {
  const repoRoot = path.resolve(options.repoRoot || process.cwd());
  const stage = options.stage || 'plan';
  if (!VALID_STAGES.has(stage)) {
    const error = new Error(`invalid workflow-context stage: ${stage}`);
    error.isUserError = true;
    throw error;
  }

  const detailProfile = options.detailProfile || 'minimal';
  const graphStatus = buildGraphStatus(repoRoot);
  const navigation = readCodeNavigation(repoRoot);
  const ready = graphStatus.state === 'ready';
  const recommendedQueries = buildRecommendedQueries(stage, {
    task: options.task,
    since: options.since,
    workRun: options.workRun,
  });

  return {
    stage,
    detail_profile: detailProfile,
    graph_status: graphStatus,
    code_navigation: navigation,
    decision_inputs: ready
      ? [
          {
            kind: 'crg_graph',
            decision_input_kind: 'observed',
            evidence: ['active graph.db available'],
          },
          {
            kind: 'code_navigation',
            decision_input_kind: navigation.source === 'artifact' ? 'observed' : 'ambiguous',
            evidence: [navigation.source === 'artifact' ? 'code-navigation.json available' : 'code-navigation.json unavailable'],
          },
        ]
      : [],
    recommended_queries: recommendedQueries,
    fallback: ready ? null : buildFallback({ stage, graphStatus }),
    limitations: ready ? [] : graphStatus.limitations,
  };
}

module.exports = {
  VALID_STAGES,
  buildWorkflowContext,
  parseWorkflowContextArgs,
};
