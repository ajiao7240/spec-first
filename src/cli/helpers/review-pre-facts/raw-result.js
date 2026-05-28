'use strict';

const { LIMITS } = require('./constants');

function validateRawResult(raw, queryPlan) {
  if (!raw || raw.schema_version !== 'review-pre-facts-provider-raw-result.v1') {
    return { ok: false, reason_code: 'provider_raw_result_invalid', message: 'raw result schema_version is invalid' };
  }
  if (raw.source !== 'live-mcp') {
    return { ok: false, reason_code: 'provider_raw_result_unsupported_source', message: 'raw result source must be live-mcp' };
  }
  if (raw.query_plan_id !== queryPlan.query_plan_id) {
    return { ok: false, reason_code: 'provider_raw_result_invalid', message: 'raw result query_plan_id does not match query plan' };
  }
  if (!Array.isArray(raw.raw_results)) {
    return { ok: false, reason_code: 'provider_raw_result_invalid', message: 'raw result lacks raw_results[]' };
  }
  const queryById = new Map(queryPlan.queries.map((query) => [query.query_id, query]));
  const requireToolAnnotations = raw.require_tool_annotations === true || raw.tool_annotation_policy === 'required';
  for (const result of raw.raw_results) {
    const query = queryById.get(result.query_id);
    if (!query) {
      return { ok: false, reason_code: 'provider_raw_result_query_mismatch', message: `raw result query_id is not declared: ${result.query_id}` };
    }
    if (result.tool_name !== query.tool_name || result.operation !== query.operation) {
      return { ok: false, reason_code: 'provider_raw_result_query_mismatch', message: 'raw result tool/operation does not match query plan' };
    }
    if (result.arguments !== undefined && !deepEqualJson(result.arguments, query.arguments)) {
      return { ok: false, reason_code: 'provider_raw_result_query_mismatch', message: 'raw result arguments do not match query plan' };
    }
    const toolAnnotations = result.tool_annotations && typeof result.tool_annotations === 'object'
      ? result.tool_annotations
      : null;
    if (requireToolAnnotations && !toolAnnotations) {
      return { ok: false, reason_code: 'tool_annotation_unverified', message: 'required tool annotations are missing' };
    }
    if (toolAnnotations) {
      if (toolAnnotations.read_only !== true || toolAnnotations.destructive !== false) {
        return { ok: false, reason_code: 'tool_annotation_unverified', message: 'raw result tool annotations do not prove a safe read-only call' };
      }
    }
    if (Buffer.byteLength(JSON.stringify(result.response || result.error || {}), 'utf8') > LIMITS.singleQueryRawBytes) {
      return { ok: false, reason_code: 'provider_raw_result_too_large', message: 'single query raw response exceeds v1 limit' };
    }
  }
  return { ok: true };
}

function deepEqualJson(left, right) {
  return stableJson(left) === stableJson(right);
}

function stableJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

module.exports = {
  validateRawResult,
};
