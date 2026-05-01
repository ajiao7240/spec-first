#!/usr/bin/env node
'use strict';

const {
  evidence,
  listSourceTextFiles,
  makeArtifact,
  parseCommonArgs,
  readText,
  relativeTo,
  sourceInputFromFiles,
  writeJsonOutput,
} = require('./lib/audit-utils');

function extractEngineeringQuality(options = {}) {
  const scan = listSourceTextFiles(options);
  const { repoRoot, files } = scan;
  const candidates = files.flatMap((filePath) => inspectEngineeringQuality(filePath, repoRoot));

  return makeArtifact({
    schemaVersion: 'engineering-quality-contract.v1',
    artifactId: 'engineering-quality-contract',
    sourceInputs: [sourceInputFromFiles('code', files, repoRoot, scan)],
    body: {
      candidate_count: candidates.length,
      candidates,
      candidate_summary: summarizeCandidates(candidates),
      extraction_notes: [
        'Candidates are static signals for App engineering review. Scripts do not classify them as confirmed issues.',
      ],
      degraded_modes: scan.degraded_modes,
    },
  });
}

function inspectEngineeringQuality(filePath, repoRoot) {
  const rel = relativeTo(repoRoot, filePath);
  const text = readText(filePath);
  const candidates = [];

  if (text.split(/\r?\n/).length > 500) {
    candidates.push(candidate('large_file', rel, 'File exceeds 500 lines and may hide mixed App responsibilities.'));
  }
  if (/catch\s*\([^)]*(Exception|Throwable)[^)]*\)\s*\{\s*\}/s.test(text)) {
    candidates.push(candidate('swallowed_exception', rel, 'Exception catch block appears empty.'));
  }
  if (/catch\s*\([^)]*CancellationException[^)]*\)\s*\{[^}]*\}/s.test(text) && !/throw|cancel/.test(text)) {
    candidates.push(candidate('cancellation_exception_not_rethrown', rel, 'CancellationException appears to be handled without rethrow or cancel signal.'));
  }
  if (/(Log\.(d|i|v)|println)\s*\([^)]*(password|token|secret|phone|email|身份证|密码)/i.test(text)) {
    candidates.push(candidate('sensitive_log_candidate', rel, 'Logging call appears near sensitive field names.'));
  }
  if (/(SharedPreferences|UserDefaults|DataStore|Keychain|Keystore)/.test(text) && /(password|token|secret|密码)/i.test(text)) {
    candidates.push(candidate('sensitive_local_storage_candidate', rel, 'Local storage usage appears near sensitive field names.'));
  }
  if (/(for\s*\(|while\s*\()[\s\S]{0,400}(api|repository|remote|http|request|query|dao)\./i.test(text)) {
    candidates.push(candidate('loop_remote_or_db_call', rel, 'Loop appears to call remote or database dependency.'));
  }
  if (/(submit|confirm|pay|order|commit)/i.test(text) && !/(debounce|disabled|loading|idempot|duplicate|Mutex|throttle)/i.test(text)) {
    candidates.push(candidate('submit_without_duplicate_guard_signal', rel, 'Submit-like code lacks obvious debounce/loading/idempotency guard signal.'));
  }
  if (/(withContext\(Dispatchers\.Main\)|MainScope|runBlocking)/.test(text) && /(Room|Sql|Database|Dao|FileInputStream|readBytes|writeBytes)/.test(text)) {
    candidates.push(candidate('main_thread_io_candidate', rel, 'Main dispatcher scope appears near IO or database APIs.'));
  }
  if (/(retry|while\s*\(true\)|repeat\()/i.test(text) && !/(timeout|backoff|delay|limit|max)/i.test(text)) {
    candidates.push(candidate('unbounded_retry_candidate', rel, 'Retry-like code lacks obvious timeout/backoff/limit signal.'));
  }

  return candidates;
}

function summarizeCandidates(candidates) {
  return candidates.reduce((summary, entry) => {
    summary[entry.type] = (summary[entry.type] || 0) + 1;
    return summary;
  }, {});
}

function candidate(type, file, summary) {
  return {
    type,
    file,
    summary,
    status: 'candidate',
    needs_semantic_review: true,
    evidence: [evidence('engineering_quality', file, summary)],
  };
}

if (require.main === module) {
  try {
    const options = parseCommonArgs(process.argv.slice(2));
    writeJsonOutput(extractEngineeringQuality(options), options.output);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  extractEngineeringQuality,
  inspectEngineeringQuality,
};
