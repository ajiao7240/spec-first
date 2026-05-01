'use strict';

const { applyEvidenceGate } = require('../../skills/spec-app-consistency-audit/scripts/merge-contracts');

describe('spec-app-consistency-audit evidence gate', () => {
  test('rejects confirmed issues that only cite rule packs', () => {
    const issues = applyEvidenceGate([
      {
        id: 'APP-AUDIT-001',
        title: 'Rule-only issue',
        severity: 'high',
        static_confirmed: true,
        contract_status: 'confirmed',
        evidence: {
          rule_pack: [{ source: 'rule_pack', summary: 'common-app says loading is needed' }],
        },
        related_rule_packs: ['common-app'],
      },
      {
        id: 'APP-AUDIT-002',
        title: 'Code-backed issue',
        severity: 'medium',
        static_confirmed: true,
        contract_status: 'confirmed',
        evidence: {
          code: [{ file: 'TradeViewModel.kt', summary: 'No failure state was detected.' }],
        },
        related_rule_packs: ['common-app'],
      },
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
      {
        id: 'APP-AUDIT-003',
        title: 'Array rule-only issue',
        severity: 'high',
        static_confirmed: true,
        contract_status: 'confirmed',
        evidence: [
          { source: 'rule_pack', summary: 'generic rule rationale' },
        ],
      },
      {
        id: 'APP-AUDIT-004',
        title: 'Array code-backed issue',
        severity: 'medium',
        static_confirmed: true,
        contract_status: 'confirmed',
        evidence: [
          { source: 'code', file: 'TradeViewModel.kt', summary: 'No failure state was detected.' },
        ],
      },
    ]);

    expect(issues[0]).toEqual(expect.objectContaining({
      contract_status: 'rejected',
      static_confirmed: false,
    }));
    expect(issues[0].evidence_gate).toEqual(expect.objectContaining({
      passed: false,
      project_evidence_count: 0,
      rule_pack_evidence_count: 1,
    }));
    expect(issues[1].evidence_gate).toEqual(expect.objectContaining({
      passed: true,
      project_evidence_count: 1,
    }));
  });

  test('rejects no-evidence candidates and does not count rule-pack selection as project evidence', () => {
    const issues = applyEvidenceGate([
      {
        id: 'APP-AUDIT-005',
        title: 'No evidence candidate',
        severity: 'medium',
        static_confirmed: false,
        contract_status: 'candidate',
      },
      {
        id: 'APP-AUDIT-006',
        title: 'Rule selection disguised as contract',
        severity: 'high',
        static_confirmed: true,
        contract_status: 'confirmed',
        evidence: {
          contract: [{ source: 'rule_pack_selection', summary: 'Industry securities was selected.' }],
        },
      },
      {
        id: 'APP-AUDIT-007',
        title: 'Concrete extracted contract evidence',
        severity: 'medium',
        static_confirmed: true,
        contract_status: 'confirmed',
        evidence: {
          contract: [{ file: 'page-route-contract.json', summary: 'Route contract includes missing guard.' }],
        },
      },
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
});
