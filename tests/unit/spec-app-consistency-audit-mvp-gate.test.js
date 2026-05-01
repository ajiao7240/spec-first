'use strict';

const {
  buildMvpValidationGate,
  buildPilotValidationGate,
} = require('../../skills/spec-app-consistency-audit/scripts/merge-contracts');

describe('spec-app-consistency-audit MVP gate', () => {
  test('requires page routing, engineering quality, static result, evidence gate, and preview writeback', () => {
    const gate = buildMvpValidationGate({
      section_coverage: {
        page_routes: true,
        engineering_quality: true,
      },
      issues: [
        {
          id: 'APP-AUDIT-001',
          severity: 'high',
          evidence_gate: { passed: true },
        },
      ],
      writeback_preview: {
        mode: 'preview_only',
        auto_apply: false,
      },
    });

    expect(gate).toEqual(expect.objectContaining({
      static_first: true,
      has_page_route_section: true,
      has_engineering_quality_section: true,
      has_static_result: true,
      writeback_preview_only: true,
      evidence_gate_enforced: true,
      ready_for_v0_2: false,
    }));
    expect(gate.pilot_validation.pilot_recorded).toBe(false);
  });

  test('accepts a clean audit as a static result for local MVP gates', () => {
    const gate = buildMvpValidationGate({
      section_coverage: {
        page_routes: true,
        engineering_quality: true,
      },
      issues: [],
      writeback_preview: {
        mode: 'preview_only',
        auto_apply: false,
      },
    });

    expect(gate).toEqual(expect.objectContaining({
      has_static_result: true,
      evidence_gate_enforced: true,
    }));
  });

  test('requires a recorded real or historical app pilot before v0.2 readiness', () => {
    const gate = buildPilotValidationGate({
      pilot_validation: {
        sample_type: 'historical_app',
        confirmed_issue_count: 1,
        rejected_issue_count: 2,
        advisory_issue_count: 3,
        manual_confirmation_rate: 0.75,
        false_positive_reasons: ['route name matched but screen intent differed'],
        pre_runtime_fixable_count: 1,
        rule_pack_only_hits_downgraded: true,
        static_confirmed_issues: [{
          id: 'APP-AUDIT-PILOT-001',
          static_confirmed: true,
          evidence: {
            prd: [{ file: 'prd.md', summary: 'PRD requires failed transfer copy.' }],
            figma: [{ file: 'figma.json', summary: 'Figma contains failed transfer frame.' }],
            code: [{ file: 'TransferScreen.kt', summary: 'Code has no failed state branch.' }],
          },
        }],
      },
    });

    expect(gate).toEqual({
      pilot_recorded: true,
      has_real_or_historical_sample: true,
      has_static_confirmed_issue: true,
      has_two_source_evidence_issue: true,
      has_issue_counts: true,
      has_manual_confirmation_metrics: true,
      has_pre_runtime_fix_count: true,
      rule_pack_only_hits_downgraded: true,
      ready_for_v0_2: true,
    });
  });

  test('requires local MVP gates even when pilot validation is ready', () => {
    const pilotValidation = {
      sample_type: 'historical_app',
      confirmed_issue_count: 1,
      rejected_issue_count: 0,
      advisory_issue_count: 1,
      manual_confirmation_rate: 1,
      false_positive_reasons: [],
      pre_runtime_fixable_count: 1,
      rule_pack_only_hits_downgraded: true,
      static_confirmed_issues: [{
        id: 'APP-AUDIT-PILOT-001',
        static_confirmed: true,
        evidence: {
          prd: [{ file: 'prd.md', summary: 'PRD evidence.' }],
          figma: [{ file: 'figma.json', summary: 'Figma evidence.' }],
        },
      }],
    };

    const ready = buildMvpValidationGate({
      section_coverage: { page_routes: true, engineering_quality: true },
      issues: [{ id: 'APP-AUDIT-001', severity: 'medium', evidence_gate: { passed: true } }],
      writeback_preview: { mode: 'preview_only', auto_apply: false },
      pilot_validation: pilotValidation,
    });
    const missingLocalSection = buildMvpValidationGate({
      section_coverage: { page_routes: false, engineering_quality: true },
      issues: [{ id: 'APP-AUDIT-001', severity: 'medium', evidence_gate: { passed: true } }],
      writeback_preview: { mode: 'preview_only', auto_apply: false },
      pilot_validation: pilotValidation,
    });

    expect(ready.ready_for_v0_2).toBe(true);
    expect(missingLocalSection.ready_for_v0_2).toBe(false);
  });
});
