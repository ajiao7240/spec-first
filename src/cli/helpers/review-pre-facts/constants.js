'use strict';

const READINESS = new Set(['graph-fresh', 'graph-stale', 'provider-unavailable', 'no-targets']);
const TIERS = new Set(['graph-fresh', 'bounded-reads', 'unavailable', 'no-targets']);
const WORKFLOWS = new Set(['doc-review', 'code-review', 'plan', 'debug']);
const OPERATION_TOOL_NAMES = {
  query: 'gitnexus.query',
  context: 'gitnexus.context',
  impact: 'gitnexus.impact',
  detect_changes: 'gitnexus.detect_changes',
};
const OPERATIONS = new Set(Object.keys(OPERATION_TOOL_NAMES));
const FACT_KINDS = new Set(['query_symbol', 'context_symbol', 'impact_summary', 'detect_changes_summary']);
const REDACTION_STATUSES = new Set(['none-required', 'redacted', 'redaction-degraded']);
const DETECT_CHANGE_SCOPES = new Set(['staged', 'unstaged', 'all', 'compare']);
const IMPACT_DIRECTIONS = new Set(['upstream', 'downstream']);

const LIMITS = {
  rawArtifactTotalBytes: 1024 * 1024,
  singleQueryRawBytes: 256 * 1024,
  maxFacts: {
    'doc-review': 24,
    'code-review': 40,
    plan: 32,
    debug: 32,
  },
  perExcerptChars: 1200,
  maxSummaryItems: 8,
  renderedBlockChars: {
    'doc-review': 16000,
    'code-review': 24000,
    plan: 18000,
    debug: 18000,
  },
  maxDocumentBytes: 1024 * 1024,
  maxDirectReadBytes: 128 * 1024,
  maxDirectReadTargets: 15,
};

module.exports = {
  READINESS,
  TIERS,
  WORKFLOWS,
  OPERATION_TOOL_NAMES,
  OPERATIONS,
  FACT_KINDS,
  REDACTION_STATUSES,
  DETECT_CHANGE_SCOPES,
  IMPACT_DIRECTIONS,
  LIMITS,
};
