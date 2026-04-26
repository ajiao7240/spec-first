'use strict';

function inferEntrySource(node) {
  const filePath = node.file_path || '';
  const name = node.name || '';
  if (/bin\/|src\/cli\/|commands?\//.test(filePath) || /^(run|main|cli)$/i.test(name)) {
    return {
      entry_source: 'cli_like',
      entry_confidence: 'Inferred',
      entry_inference_reason: 'path_or_name_entry_signal',
      entry_evidence: [`CLI-like path/name: ${filePath}#${name}`],
    };
  }
  if (/(route|handler|controller)/i.test(filePath) || /(handler|route|controller)/i.test(name)) {
    return {
      entry_source: 'route_like',
      entry_confidence: 'Inferred',
      entry_inference_reason: 'route_like_static_signal',
      entry_evidence: [`Route-like path/name: ${filePath}#${name}`],
    };
  }
  if (node.is_test) {
    return {
      entry_source: 'test_like',
      entry_confidence: 'Inferred',
      entry_inference_reason: 'test_entry_signal',
      entry_evidence: [`Test-like entry: ${filePath}`],
    };
  }
  return {
    entry_source: 'zero_in_degree_calls',
    entry_confidence: 'Inferred',
    entry_inference_reason: 'zero_in_degree_calls',
    entry_evidence: ['No incoming calls edge in static call graph'],
  };
}

function annotateEntryCandidates(nodes) {
  return (nodes || []).map((node) => ({
    ...node,
    ...inferEntrySource(node),
  }));
}

module.exports = {
  annotateEntryCandidates,
  inferEntrySource,
};
