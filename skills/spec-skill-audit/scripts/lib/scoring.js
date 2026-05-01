'use strict';

const WEIGHTS = {
  spec_compliance: 0.07,
  trigger_precision: 0.10,
  boundary_discipline: 0.12,
  input_contract: 0.09,
  output_contract: 0.10,
  workflow_explicitness: 0.09,
  progressive_disclosure: 0.07,
  eval_readiness: 0.08,
  security_posture: 0.12,
  runtime_governance: 0.07,
  cross_host_portability: 0.04,
  spec_first_alignment: 0.05,
};

function buildScorecard({ inventory, structureFindings, securityFindings, governanceReport, boundaryReport }) {
  const governanceSkipped = Boolean(governanceReport && governanceReport.skipped);
  const governanceChecked = Boolean(governanceReport && !governanceReport.skipped && Array.isArray(governanceReport.records));
  const governanceBySkill = new Map();
  for (const record of (governanceReport && governanceReport.records) || []) {
    governanceBySkill.set(record.skill_name, record);
  }

  const boundaryBySkill = new Map();
  for (const candidate of (boundaryReport && boundaryReport.candidates) || []) {
    for (const skillId of [candidate.left_skill_id, candidate.right_skill_id]) {
      boundaryBySkill.set(skillId, (boundaryBySkill.get(skillId) || 0) + 1);
    }
  }

  const skills = (inventory.skills || []).map((skill) => {
    const perSkillStructure = structureFindings.filter((finding) => finding.skill_id === skill.skill_id);
    const perSkillSecurity = securityFindings.filter((finding) => finding.skill_id === skill.skill_id);
    const governanceRecord = governanceBySkill.get(skill.skill_id);
    const dimensions = {
      spec_compliance: scoreSpecCompliance(skill, perSkillStructure),
      trigger_precision: scoreTriggerPrecision(skill),
      boundary_discipline: Math.max(0, 5 - Math.min(3, boundaryBySkill.get(skill.skill_id) || 0)),
      input_contract: hasSection(skill, ['inputs']) ? 4 : 2,
      output_contract: hasSection(skill, ['outputs']) ? 4 : 2,
      workflow_explicitness: hasSection(skill, ['workflow', 'execution']) ? 4 : 2,
      progressive_disclosure: scoreProgressiveDisclosure(skill),
      eval_readiness: scoreEvalReadiness(skill),
      security_posture: scoreSecurityPosture(perSkillSecurity),
      runtime_governance: scoreRuntimeGovernance(governanceRecord, governanceChecked),
      cross_host_portability: scoreCrossHostPortability(governanceRecord, governanceChecked),
      spec_first_alignment: scoreSpecFirstAlignment(skill),
    };
    const scoredDimensions = Object.entries(dimensions)
      .filter(([_key, score]) => typeof score === 'number');
    const activeWeight = scoredDimensions.reduce((total, [key]) => total + (WEIGHTS[key] || 0), 0);
    const weighted = scoredDimensions.reduce((total, [key, score]) => {
      return total + (WEIGHTS[key] || 0) * score;
    }, 0);
    const overallScore = activeWeight > 0 ? Math.round((weighted / (activeWeight * 5)) * 100) : 0;

    return {
      skill_id: skill.skill_id,
      overall_score: overallScore,
      grade: gradeForScore(overallScore),
      dimensions,
      dimension_status: {
        runtime_governance: governanceDimensionStatus(governanceRecord, governanceChecked, governanceSkipped),
        cross_host_portability: governanceDimensionStatus(governanceRecord, governanceChecked, governanceSkipped),
      },
      score_is_signal_not_gate: true,
      top_risks: [...perSkillStructure, ...perSkillSecurity]
        .filter((finding) => ['P0', 'P1'].includes(finding.severity))
        .slice(0, 3)
        .map((finding) => ({
          severity: finding.severity,
          category: finding.category,
          title: finding.title,
        })),
      workflow_completeness_signal: assessWorkflowCompleteness(skill),
      score_reliability: scoreReliabilityForSkill(skill, governanceRecord, { governanceSkipped }),
      recommended_next_action: recommendedNextAction(skill, perSkillStructure, perSkillSecurity, governanceRecord, { governanceSkipped }),
    };
  });

  return {
    schema_version: 'spec-first.skill-audit-scorecard.v1',
    generated_at: new Date().toISOString(),
    score_is_signal_not_gate: true,
    requires_llm_review: true,
    score_reliability: scoreReliabilityForRun({ inventory, governanceReport }),
    conclusion_ceiling: 'tentative',
    weights: WEIGHTS,
    skills,
  };
}

function scoreRuntimeGovernance(governanceRecord, governanceChecked) {
  if (!governanceChecked) return null;
  return governanceRecord ? 5 : 0;
}

function scoreCrossHostPortability(governanceRecord, governanceChecked) {
  if (!governanceChecked) return null;
  return governanceRecord && governanceRecord.host_scope === 'dual_host' ? 5 : 3;
}

function governanceDimensionStatus(governanceRecord, governanceChecked, governanceSkipped) {
  if (governanceSkipped) return 'not_checked';
  if (!governanceChecked) return 'unavailable';
  return governanceRecord ? 'checked' : 'missing';
}

function hasSection(skill, names) {
  const sections = new Set((skill.sections || []).map((section) => section.normalized));
  return names.some((name) => sections.has(name));
}

function scoreSpecCompliance(skill, findings) {
  if (!skill.has_skill_md) return 0;
  const p0 = findings.filter((finding) => finding.severity === 'P0').length;
  const p1 = findings.filter((finding) => finding.severity === 'P1').length;
  const p2 = findings.filter((finding) => finding.severity === 'P2').length;
  return Math.max(0, 5 - (p0 * 3) - (p1 * 2) - Math.min(2, p2));
}

function scoreTriggerPrecision(skill) {
  const hasDescription = Boolean(skill.frontmatter && skill.frontmatter.description);
  const hasWhenToUse = hasSection(skill, ['when-to-use', 'usage']);
  const hasWhenNot = hasSection(skill, ['when-not-to-use']);
  return Math.min(5, (hasDescription ? 2 : 0) + (hasWhenToUse ? 2 : 0) + (hasWhenNot ? 1 : 0));
}

function scoreProgressiveDisclosure(skill) {
  if ((skill.estimated_tokens || 0) > 6000) return 2;
  if ((skill.estimated_tokens || 0) > 3000) return skill.has_references ? 4 : 3;
  return skill.has_references || skill.has_scripts ? 5 : 4;
}

function scoreEvalReadiness(skill) {
  if (skill.has_evals) return 4;
  return 2;
}

function scoreSecurityPosture(findings) {
  if (findings.some((finding) => finding.severity === 'P0')) return 0;
  if (findings.some((finding) => finding.severity === 'P1')) return 2;
  if (findings.some((finding) => finding.severity === 'P2')) return 4;
  return 5;
}

function scoreSpecFirstAlignment(skill) {
  const body = String(skill.body_excerpt || '');
  const text = `${skill.frontmatter && skill.frontmatter.description ? skill.frontmatter.description : ''}\n${body}`;
  if (/scripts prepare|LLM|source.of.truth|source truth|runtime|governance/i.test(text)) return 5;
  return skill.skill_id && skill.skill_id.startsWith('spec-') ? 4 : 3;
}

function assessWorkflowCompleteness(skill) {
  const workflowText = sectionTexts(skill, ['workflow', 'execution']).join('\n');
  const hasWorkflow = workflowText.trim().length > 0;
  const hasFailureModes = hasSection(skill, ['failure-modes']);
  const hasStepSignal = /(^|\n)\s*(\d+\.|[-*]\s+Step\b|Step\s+\d+|Phase\s+\d+)/i.test(workflowText);
  const hasVerificationSignal = /verify|verification|validate|done signal|checkpoint|验收|验证|完成/.test(workflowText);
  const hasCountableSignal = /==|for each|every|all\s+\w+|逐个|全部/.test(workflowText);
  const missing = [];
  if (!hasWorkflow) missing.push('workflow section');
  if (!hasFailureModes) missing.push('failure modes');
  if (!hasVerificationSignal) missing.push('verification or done signal');

  return {
    readiness: missing.length === 0 ? 'ready' : hasWorkflow ? 'partial' : 'missing',
    has_step_signal: hasStepSignal,
    has_verification_signal: hasVerificationSignal,
    has_countable_done_signal: hasCountableSignal,
    missing,
    requires_llm_judgment: true,
  };
}

function sectionTexts(skill, names) {
  const wanted = new Set(names);
  return (skill.sections || [])
    .filter((section) => wanted.has(section.normalized))
    .map((section) => section.text || '');
}

function scoreReliabilityForSkill(skill, governanceRecord, options = {}) {
  if (!skill.has_skill_md) {
    return {
      level: 'smoke_only',
      conclusion_ceiling: 'unresolved',
      reasons: ['missing SKILL.md prevents deep skill-quality review'],
    };
  }
  const reasons = ['score remains a review signal and requires semantic LLM review'];
  if (options.governanceSkipped) reasons.push('governance evidence was skipped for this audit scope');
  if (!options.governanceSkipped && !governanceRecord) reasons.push('governance evidence is missing');
  return {
    level: governanceRecord ? 'partial' : options.governanceSkipped ? 'partial' : 'smoke_only',
    conclusion_ceiling: 'tentative',
    reasons,
  };
}

function scoreReliabilityForRun({ inventory, governanceReport }) {
  const reasons = ['semantic dimensions require LLM review before strong conclusions'];
  if (governanceReport && governanceReport.skipped) {
    reasons.push(`governance evidence skipped: ${governanceReport.reason || 'unknown'}`);
  }
  if (!inventory || !Array.isArray(inventory.skills) || inventory.skills.length === 0) {
    return {
      level: 'smoke_only',
      reasons: ['no source skills were available for scoring'],
    };
  }
  return {
    level: governanceReport && governanceReport.skipped ? 'partial' : 'partial',
    reasons,
  };
}

function gradeForScore(score) {
  if (score >= 93) return 'A';
  if (score >= 90) return 'A-';
  if (score >= 87) return 'B+';
  if (score >= 83) return 'B';
  if (score >= 80) return 'B-';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function recommendedNextAction(skill, structureFindings, securityFindings, governanceRecord, options = {}) {
  if (!options.governanceSkipped && !governanceRecord) return 'Add or repair the dual-host governance record before relying on runtime delivery.';
  if (securityFindings.some((finding) => ['P0', 'P1'].includes(finding.severity))) {
    return 'Review security findings before expanding this skill.';
  }
  if (structureFindings.some((finding) => finding.category === 'missing_section')) {
    return 'Clarify missing sections that affect trigger, output, workflow, or failure handling.';
  }
  if (!skill.has_evals) return 'Add trigger and boundary eval cases when this skill becomes high-traffic.';
  return 'Use the score as a review signal and let the LLM inspect semantic quality.';
}

module.exports = {
  assessWorkflowCompleteness,
  buildScorecard,
  WEIGHTS,
};
