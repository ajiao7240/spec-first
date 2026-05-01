'use strict';

const SEVERITY_RANK = {
  P0: 0,
  P1: 1,
  P2: 2,
  P3: 3,
  INFO: 4,
};

function createFinding(fields) {
  const claimType = fields.claim_type || claimTypeForCategory(fields.category);
  const counterEvidence = normalizeCounterEvidence(fields.counter_evidence);
  const completeness = fields.completeness || completenessForEvidence(fields.evidence);
  const decision = fields.decision || decisionForCompleteness(completeness, counterEvidence);

  return {
    id: fields.id || null,
    severity: fields.severity || 'P3',
    category: fields.category || 'general',
    skill_id: fields.skill_id || null,
    title: fields.title || '',
    signal: fields.signal || fields.title || '',
    claim_type: claimType,
    evidence: Array.isArray(fields.evidence) ? fields.evidence : [],
    counter_evidence: counterEvidence,
    completeness,
    decision,
    reason: fields.reason || '',
    recommendation: fields.recommendation || '',
    confidence: fields.confidence || 'medium',
    source: fields.source || 'deterministic',
    fix_mode: fields.fix_mode || 'human-decision',
  };
}

function claimTypeForCategory(category) {
  const value = String(category || '').toLowerCase();
  if (value.includes('security')) return 'security';
  if (value.includes('governance')) return 'governance';
  if (value.includes('runtime')) return 'runtime';
  if (value.includes('boundary')) return 'semantic';
  if (value.includes('link') || value.includes('section') || value.includes('frontmatter')) return 'structural';
  return 'structural';
}

function normalizeCounterEvidence(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return {
      checked: Boolean(value.checked),
      result: value.result || (value.checked ? 'none' : 'unknown'),
      note: value.note || '',
    };
  }
  return {
    checked: false,
    result: 'unknown',
    note: 'Deterministic scripts do not decide semantic counter-evidence.',
  };
}

function completenessForEvidence(evidence) {
  return Array.isArray(evidence) && evidence.length > 0 ? 'partial' : 'unresolved';
}

function decisionForCompleteness(completeness, counterEvidence) {
  if (completeness === 'unresolved') return 'unresolved';
  if (!counterEvidence.checked) return 'tentative';
  if (counterEvidence.result === 'contradicted') return 'rejected';
  if (counterEvidence.result === 'mitigated' || counterEvidence.result === 'scope_limited') return 'tentative';
  return completeness === 'complete' ? 'accepted' : 'tentative';
}

function assignFindingIds(prefix, findings) {
  const counters = new Map();
  return findings.map((finding) => {
    const severity = finding.severity || 'INFO';
    const category = String(finding.category || 'general').toUpperCase().replace(/[^A-Z0-9]+/g, '-');
    const key = `${severity}-${category}`;
    const next = (counters.get(key) || 0) + 1;
    counters.set(key, next);

    return {
      ...finding,
      id: finding.id || `${prefix}-${severity}-${category}-${String(next).padStart(3, '0')}`,
    };
  });
}

function compareFindings(left, right) {
  const leftRank = SEVERITY_RANK[left.severity] ?? 99;
  const rightRank = SEVERITY_RANK[right.severity] ?? 99;
  if (leftRank !== rightRank) return leftRank - rightRank;
  return String(left.skill_id || '').localeCompare(String(right.skill_id || ''))
    || String(left.category || '').localeCompare(String(right.category || ''))
    || String(left.title || '').localeCompare(String(right.title || ''));
}

function countBySeverity(findings) {
  return findings.reduce((counts, finding) => {
    const severity = finding.severity || 'INFO';
    counts[severity] = (counts[severity] || 0) + 1;
    return counts;
  }, {});
}

module.exports = {
  assignFindingIds,
  compareFindings,
  countBySeverity,
  createFinding,
  claimTypeForCategory,
  SEVERITY_RANK,
};
