'use strict';

const STAGE_TO_PROFILE = {
  plan: 'plan-default',
  work: 'work-default',
  review: 'review-default',
  verify: 'verify-default',
  unknown: 'unknown-default',
};

function normalizeStage(stage) {
  if (typeof stage !== 'string') return 'unknown';
  const normalized = stage.trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(STAGE_TO_PROFILE, normalized) ? normalized : 'unknown';
}

function resolveProfile(stage) {
  return STAGE_TO_PROFILE[normalizeStage(stage)];
}

function preferredMinimalContext(stage) {
  const normalized = normalizeStage(stage);
  if (normalized === 'unknown') return null;
  return `minimal-context/${normalized}.json`;
}

module.exports = {
  normalizeStage,
  preferredMinimalContext,
  resolveProfile,
};
