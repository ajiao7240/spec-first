'use strict';

const { applyEvidenceGate } = require('../../skills/spec-app-consistency-audit/scripts/merge-contracts');

function issue(overrides = {}) {
  return {
    id: 'APP-AUDIT-001',
    title: 'Issue',
    severity: 'high',
    category: 'app_consistency',
    claim_family: 'architecture_static',
    claim_type: 'missing_state',
    affected_surface: { type: 'view_model', id: 'TradeViewModel', file: 'TradeViewModel.kt' },
    expert: 'engineering-quality-expert',
    static_confirmed: true,
    contract_status: 'confirmed',
    confidence: 0.82,
    evidence: {
      code: [{ source: 'code', file: 'TradeViewModel.kt', summary: 'No failure state was detected.' }],
    },
    related_rule_packs: ['common-app'],
    ...overrides,
  };
}

describe('spec-app-consistency-audit evidence gate', () => {
  test('rejects confirmed issues that only cite rule packs', () => {
    const issues = applyEvidenceGate([
      issue({
        id: 'APP-AUDIT-001',
        title: 'Rule-only issue',
        evidence: {
          rule_pack: [{ source: 'rule_pack', summary: 'common-app says loading is needed' }],
        },
        related_rule_packs: ['common-app'],
      }),
      issue({
        id: 'APP-AUDIT-002',
        title: 'Code-backed issue',
        severity: 'medium',
        evidence: {
          code: [{ file: 'TradeViewModel.kt', summary: 'No failure state was detected.' }],
        },
        related_rule_packs: ['common-app'],
      }),
    ]);

    expect(issues[0]).toEqual(expect.objectContaining({
      contract_status: 'rejected',
      static_confirmed: false,
    }));
    expect(issues[0].evidence_gate).toEqual(expect.objectContaining({
      passed: false,
      reason: 'confirmed_issue_requires_project_specific_evidence',
    }));
    expect(issues[1].evidence_gate).toEqual(expect.objectContaining({
      passed: true,
      project_evidence_count: 1,
    }));
  });

  test('rejects array-shaped rule-pack evidence and accepts array-shaped project evidence', () => {
    const issues = applyEvidenceGate([
      issue({
        id: 'APP-AUDIT-003',
        title: 'Array rule-only issue',
        evidence: [
          { source: 'rule_pack', summary: 'generic rule rationale' },
        ],
      }),
      issue({
        id: 'APP-AUDIT-004',
        title: 'Array code-backed issue',
        severity: 'medium',
        evidence: [
          { source: 'code', file: 'TradeViewModel.kt', summary: 'No failure state was detected.' },
        ],
      }),
    ]);

    expect(issues[0]).toEqual(expect.objectContaining({
      contract_status: 'rejected',
      static_confirmed: false,
    }));
    expect(issues[0].evidence_gate).toEqual(expect.objectContaining({
      passed: false,
      project_evidence_count: 0,
      rule_pack_evidence_count: 2,
    }));
    expect(issues[1].evidence_gate).toEqual(expect.objectContaining({
      passed: true,
      project_evidence_count: 1,
    }));
  });

  test('rejects no-evidence candidates and does not count rule-pack selection as project evidence', () => {
    const issues = applyEvidenceGate([
      issue({
        id: 'APP-AUDIT-005',
        title: 'No evidence candidate',
        severity: 'medium',
        static_confirmed: false,
        contract_status: 'candidate',
        evidence: undefined,
      }),
      issue({
        id: 'APP-AUDIT-006',
        title: 'Rule selection disguised as contract',
        evidence: {
          contract: [{ source: 'rule_pack_selection', summary: 'Industry securities was selected.' }],
        },
      }),
      issue({
        id: 'APP-AUDIT-007',
        title: 'Concrete extracted contract evidence',
        severity: 'medium',
        evidence: {
          contract: [{ file: 'page-route-contract.json', summary: 'Route contract includes missing guard.' }],
        },
      }),
    ]);

    expect(issues[0].evidence_gate).toEqual(expect.objectContaining({
      passed: false,
      reason: 'issue_requires_evidence_or_provenance',
    }));
    expect(issues[1].evidence_gate).toEqual(expect.objectContaining({
      passed: false,
      reason: 'confirmed_issue_requires_project_specific_evidence',
      project_evidence_count: 0,
    }));
    expect(issues[2].evidence_gate).toEqual(expect.objectContaining({
      passed: true,
      project_evidence_count: 1,
    }));
  });

  test('rejects rule-pack evidence disguised inside project buckets', () => {
    const issues = applyEvidenceGate([
      issue({
        id: 'APP-AUDIT-010',
        title: 'Disguised rule pack issue',
        evidence: {
          code: [{ rule_pack: 'common-app', summary: 'Generic checklist says loading is required.' }],
        },
      }),
    ]);

    expect(issues[0]).toEqual(expect.objectContaining({
      contract_status: 'rejected',
      static_confirmed: false,
    }));
    expect(issues[0].evidence_gate).toEqual(expect.objectContaining({
      passed: false,
      reason: 'confirmed_issue_requires_project_specific_evidence',
      project_evidence_count: 0,
    }));
  });

  test('rejects issue self-asserted industry confirmation', () => {
    const issues = applyEvidenceGate([
      issue({
        id: 'APP-AUDIT-011',
        title: 'Self-confirmed industry issue',
        claim_family: 'industry_compliance',
        industry_confirmed: true,
        confirmed_industry: true,
        evidence: {
          code: [{ source: 'code', file: 'TradeScreen.kt', summary: 'Trade flow changed.' }],
        },
      }),
    ]);

    expect(issues[0]).toEqual(expect.objectContaining({
      contract_status: 'rejected',
      static_confirmed: false,
    }));
    expect(issues[0].evidence_gate.reason).toBe('industry_confirmed_issue_requires_confirmed_industry_profile');
  });

  test('accepts industry confirmed issues only when caller provides a confirmed industry profile', () => {
    const issues = applyEvidenceGate([
      issue({
        id: 'APP-AUDIT-012',
        title: 'Confirmed industry issue',
        claim_family: 'industry_compliance',
        claim_type: 'missing_risk_disclosure',
        evidence: {
          code: [{ source: 'code', file: 'TradeScreen.kt', summary: 'Risk disclosure is missing.' }],
        },
        related_rule_packs: ['finance-common'],
      }),
    ], { confirmedIndustry: 'finance-common' });

    expect(issues[0]).toEqual(expect.objectContaining({
      contract_status: 'confirmed',
      static_confirmed: true,
    }));
    expect(issues[0].evidence_gate).toEqual(expect.objectContaining({
      passed: true,
      reason: 'project_specific_evidence_present',
      project_evidence_count: 1,
    }));
  });

  test('downgrades confirmed issues below the confidence threshold', () => {
    const issues = applyEvidenceGate([
      issue({
        id: 'APP-AUDIT-013',
        title: 'Low confidence confirmed issue',
        confidence: 0.62,
        evidence: {
          code: [{ source: 'code', file: 'TradeViewModel.kt', summary: 'State looks incomplete.' }],
        },
      }),
      issue({
        id: 'APP-AUDIT-014',
        title: 'High confidence confirmed issue',
        confidence: 0.75,
        evidence: {
          code: [{ source: 'code', file: 'TradeViewModel.kt', summary: 'State is incomplete.' }],
        },
      }),
    ]);

    expect(issues[0]).toEqual(expect.objectContaining({
      contract_status: 'candidate',
      static_confirmed: false,
    }));
    expect(issues[0].evidence_gate).toEqual(expect.objectContaining({
      passed: false,
      reason: 'confirmed_issue_confidence_below_threshold',
      confidence_threshold: 0.75,
    }));
    expect(issues[1]).toEqual(expect.objectContaining({
      contract_status: 'confirmed',
      static_confirmed: true,
    }));
    expect(issues[1].evidence_gate).toEqual(expect.objectContaining({
      passed: true,
      reason: 'project_specific_evidence_present',
    }));
  });

  test('downgrades confirmed issues that miss claim-family-required evidence and rejects unconfirmed industry confirmed claims', () => {
    const issues = applyEvidenceGate([
      issue({
        id: 'APP-AUDIT-008',
        title: 'Design issue without Figma evidence',
        claim_family: 'design_alignment',
        evidence: {
          code: [{ source: 'code', file: 'TradeScreen.kt', summary: 'Code screen changed.' }],
        },
      }),
      issue({
        id: 'APP-AUDIT-009',
        title: 'Unconfirmed industry issue',
        claim_family: 'industry_compliance',
        evidence: {
          code: [{ source: 'code', file: 'TradeScreen.kt', summary: 'Trade flow changed.' }],
        },
      }),
    ]);

    expect(issues[0]).toEqual(expect.objectContaining({
      contract_status: 'candidate',
      static_confirmed: false,
      missing_evidence_sources: ['figma|design'],
    }));
    expect(issues[0].review_lifecycle.map((entry) => entry.reason_code)).toContain('claim_family_required_evidence_missing');
    expect(issues[1]).toEqual(expect.objectContaining({
      contract_status: 'rejected',
      static_confirmed: false,
    }));
    expect(issues[1].evidence_gate.reason).toBe('industry_confirmed_issue_requires_confirmed_industry_profile');
  });
});
