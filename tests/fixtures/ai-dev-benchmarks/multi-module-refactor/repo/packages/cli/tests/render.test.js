'use strict';

const { renderMetric } = require('../src/render');

test('renders a CLI metric line', () => {
  expect(renderMetric({ label: 'Coverage', value: 92 })).toBe('Coverage: 92');
});
