'use strict';

const { formatValue } = require('../../shared/src/format');

function renderMetricCard(metric) {
  return {
    heading: metric.label,
    body: formatValue(metric.value),
  };
}

module.exports = {
  renderMetricCard,
};
