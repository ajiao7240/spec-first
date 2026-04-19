'use strict';

function renderSummary({ factInventory, riskSignals, testSurface, verificationProfile }) {
  const project = factInventory && factInventory.project_identity ? factInventory.project_identity : {};
  const topology = factInventory && factInventory.topology ? factInventory.topology : {};
  const entrypoints = Array.isArray(factInventory && factInventory.entrypoints) ? factInventory.entrypoints : [];
  const modules = Array.isArray(factInventory && factInventory.modules) ? factInventory.modules : [];
  const topologyUnits = Array.isArray(topology.units) ? topology.units : [];
  const signals = Array.isArray(riskSignals && riskSignals.signals) ? riskSignals.signals : [];
  const tests = Array.isArray(testSurface && testSurface.test_files) ? testSurface.test_files : [];
  const requiredGates = Array.isArray(verificationProfile && verificationProfile.required_gates)
    ? verificationProfile.required_gates.map((item) => item.id)
    : [];
  const moduleCount = topology.kind === 'monorepo_multi_module'
    ? topologyUnits.filter((item) => item && item.kind === 'module').length
    : modules.length;

  return [
    `# ${project.name || 'bootstrap summary'}`,
    '',
    `- 主语言：${project.primary_language || 'Unknown'}`,
    `- 主要框架：${(project.primary_frameworks || []).join(', ') || '无'}`,
    `- 仓库形态：${project.repo_shape || '未知'}`,
    `- topology：${topology.kind || 'unknown'}`,
    `- 入口数量：${entrypoints.length}`,
    `- 模块数量：${moduleCount}`,
    `- 风险信号：${signals.length}`,
    `- 测试文件：${tests.length}`,
    `- 默认必跑验证：${requiredGates.join(', ') || '无'}`,
    '',
  ].join('\n');
}

function renderReadme({ factInventory }) {
  const project = factInventory && factInventory.project_identity ? factInventory.project_identity : {};
  const topology = factInventory && factInventory.topology ? factInventory.topology : {};
  return [
    '# Stage-0 Context',
    '',
    `- project: ${project.name || 'unknown'}`,
    `- primary_language: ${project.primary_language || 'Unknown'}`,
    `- repo_shape: ${project.repo_shape || 'unknown'}`,
    `- topology: ${topology.kind || 'unknown'}`,
    '- source_of_truth: control-plane artifacts under .spec-first/workflows/bootstrap/<slug>/',
    '',
  ].join('\n');
}

function renderModuleMap({ factInventory }) {
  const topologyUnits = Array.isArray(factInventory && factInventory.topology && factInventory.topology.units)
    ? factInventory.topology.units
    : [];
  const moduleLines = topologyUnits.length > 0
    ? topologyUnits.map((item) => `- [${item.kind}] ${item.path}`)
    : (Array.isArray(factInventory && factInventory.modules) ? factInventory.modules.map((item) => `- ${item.path}`) : []);
  return [
    '# Module Map',
    '',
    ...moduleLines,
    '',
  ].join('\n');
}

function renderEntrypoints({ factInventory }) {
  const entrypoints = Array.isArray(factInventory && factInventory.entrypoints) ? factInventory.entrypoints : [];
  return [
    '# Public Entrypoints',
    '',
    ...entrypoints.map((item) => `- ${item.path}`),
    '',
  ].join('\n');
}

function renderTestMap({ testSurface }) {
  const testFiles = Array.isArray(testSurface && testSurface.test_files) ? testSurface.test_files : [];
  return [
    '# Test Map',
    '',
    ...testFiles.map((item) => {
      const target = item.target_path ? ` -> ${item.target_path}` : '';
      return `- [${item.kind}] ${item.path}${target}`;
    }),
    '',
  ].join('\n');
}

function renderHighRiskModules({ riskSignals }) {
  const signals = Array.isArray(riskSignals && riskSignals.signals) ? riskSignals.signals : [];
  return [
    '# High Risk Modules',
    '',
    ...signals.map((item) => `- [${item.severity}] ${item.path} (${item.kind})${item.summary ? `: ${item.summary}` : ''}`),
    '',
  ].join('\n');
}

function renderPitfalls({ riskSignals }) {
  const signals = Array.isArray(riskSignals && riskSignals.signals) ? riskSignals.signals : [];
  return [
    '# Pitfalls',
    '',
    ...signals
      .filter((item) => item.severity === 'high')
      .map((item) => `- ${item.path}: ${item.summary || item.kind}`),
    '',
  ].join('\n');
}

function renderReviewChange({ riskSignals, testSurface, verificationProfile }) {
  const signals = Array.isArray(riskSignals && riskSignals.signals) ? riskSignals.signals : [];
  const testFiles = Array.isArray(testSurface && testSurface.test_files) ? testSurface.test_files : [];
  const requiredGates = Array.isArray(verificationProfile && verificationProfile.required_gates)
    ? verificationProfile.required_gates.map((item) => item.id)
    : [];

  return [
    '# Review Change',
    '',
    '## 风险热点',
    ...signals.slice(0, 5).map((item) => `- ${item.path} [${item.severity}]`),
    '',
    '## 候选测试',
    ...testFiles.slice(0, 8).map((item) => `- ${item.path}`),
    '',
    '## 默认验证',
    ...requiredGates.map((item) => `- ${item}`),
    '',
  ].join('\n');
}

function compileHumanAssets({
  factInventory,
  riskSignals,
  testSurface,
  verificationProfile,
} = {}) {
  const contextDocs = {
    '00-summary.md': renderSummary({
      factInventory,
      riskSignals,
      testSurface,
      verificationProfile,
    }),
    'README.md': renderReadme({ factInventory }),
    'architecture/module-map.md': renderModuleMap({ factInventory }),
    'code-facts/public-entrypoints.md': renderEntrypoints({ factInventory }),
    'code-facts/test-map.md': renderTestMap({ testSurface }),
    'code-facts/high-risk-modules.md': renderHighRiskModules({ riskSignals }),
    'pitfalls/index.md': renderPitfalls({ riskSignals }),
    'context-packs/review-change.md': renderReviewChange({
      riskSignals,
      testSurface,
      verificationProfile,
    }),
  };

  const generatedAssets = Object.keys(contextDocs).concat(['injection-index.yaml']);

  return {
    generated_assets: generatedAssets,
    docs_assets: generatedAssets.filter(
      (assetPath) => assetPath.startsWith('architecture/') || assetPath.startsWith('code-facts/')
    ),
    context_docs: contextDocs,
  };
}

module.exports = {
  compileHumanAssets,
};
