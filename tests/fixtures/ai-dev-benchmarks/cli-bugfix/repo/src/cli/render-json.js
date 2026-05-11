'use strict';

function renderJson(value) {
  return `status: ${JSON.stringify(value)}\n`;
}

module.exports = {
  renderJson,
};
