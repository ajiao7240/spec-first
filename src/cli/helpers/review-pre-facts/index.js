'use strict';

const { LIMITS } = require('./constants');
const { computeReadiness, currentRepoSnapshot } = require('./readiness');
const { extractTargetsFromDocument, resolveTargets } = require('./targets');
const { normalizeRawFacts } = require('./normalize');
const { renderFactsBlock } = require('./render');
const { runReviewPreFacts } = require('./cli');
const { validateProviderResults } = require('./validate-results');
const { validateQueryPlan } = require('./query-plan');
const { validateRawResult } = require('./raw-result');

module.exports = {
  LIMITS,
  computeReadiness,
  currentRepoSnapshot,
  extractTargetsFromDocument,
  normalizeRawFacts,
  renderFactsBlock,
  resolveTargets,
  runReviewPreFacts,
  validateProviderResults,
  validateQueryPlan,
  validateRawResult,
};
