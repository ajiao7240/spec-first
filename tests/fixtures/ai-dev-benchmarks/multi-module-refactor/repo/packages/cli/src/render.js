'use strict';

const { formatValue } = require('../../shared/src/format');

function renderMetric(metric) {
  return `${metric.label}: ${formatValue(metric.value)}`;
}

module.exports = {
  renderMetric,
};
