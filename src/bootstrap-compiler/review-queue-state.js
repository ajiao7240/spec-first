'use strict';

const ALLOWED_TRANSITIONS = {
  open: ['triaged'],
  triaged: ['resolved'],
  resolved: [],
};

function transitionReviewQueueItem(item, nextStatus, {
  reviewer = null,
  timestamp = new Date().toISOString(),
  lastVerified = null,
} = {}) {
  const currentStatus = item && item.status ? item.status : 'open';
  if (!ALLOWED_TRANSITIONS[currentStatus] || !ALLOWED_TRANSITIONS[currentStatus].includes(nextStatus)) {
    throw new Error(`invalid review queue transition: ${currentStatus} -> ${nextStatus}`);
  }

  const nextItem = {
    ...item,
    status: nextStatus,
  };

  if (nextStatus === 'triaged') {
    nextItem.reviewer = reviewer || item.reviewer || null;
    nextItem.triaged_at = timestamp;
  }

  if (nextStatus === 'resolved') {
    nextItem.resolved_at = timestamp;
    nextItem.last_verified = lastVerified || item.last_verified || null;
  }

  return nextItem;
}

module.exports = {
  transitionReviewQueueItem,
};
