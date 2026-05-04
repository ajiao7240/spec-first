'use strict';

const {
  SUPPORTED_SCHEMA_KEYWORDS,
  validateAgainstSchema,
} = require('../../src/contracts/schema-validator');

describe('lightweight schema validator contracts', () => {
  test('rejects unexpected object keys when additionalProperties is false', () => {
    const result = validateAgainstSchema({
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string' },
      },
      additionalProperties: false,
    }, {
      name: 'spec-first',
      extra: true,
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('root.extra: unexpected additional key');
  });

  test('validates additionalProperties child schemas', () => {
    const result = validateAgainstSchema({
      type: 'object',
      properties: {},
      additionalProperties: { type: 'string' },
    }, {
      supported: 'yes',
      broken: false,
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('root.broken: expected string, received boolean');
  });

  test('enforces anyOf and nested object constraints', () => {
    const schema = {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          required: ['status'],
          properties: {
            status: { enum: ['ready', 'degraded'] },
          },
          additionalProperties: false,
        },
      ],
    };

    expect(validateAgainstSchema(schema, null).errors).toEqual([]);
    expect(validateAgainstSchema(schema, { status: 'ready' }).errors).toEqual([]);
    expect(validateAgainstSchema(schema, { status: 'ready', extra: true }).errors).toEqual([
      'root: value did not match anyOf',
    ]);
    expect(validateAgainstSchema(schema, { status: 'missing' }).errors).toEqual([
      'root: value did not match anyOf',
    ]);
  });

  test('enforces collection, string, and numeric bounds', () => {
    const result = validateAgainstSchema({
      type: 'object',
      required: ['items', 'label', 'score'],
      properties: {
        items: { type: 'array', minItems: 2, maxItems: 3 },
        label: { type: 'string', minLength: 2, maxLength: 4 },
        score: { type: 'number', minimum: 0.2, maximum: 0.8 },
      },
    }, {
      items: ['one'],
      label: 'x',
      score: 1,
    });

    expect(result.errors).toEqual([
      'root.items: expected at least 2 item(s), received 1',
      'root.label: expected string length at least 2, received 1',
      'root.score: expected number <= 0.8, received 1',
    ]);
  });

  test('keeps format advisory and documents supported keywords', () => {
    const result = validateAgainstSchema({
      type: 'string',
      format: 'date-time',
    }, 'not-a-date');

    expect(result.errors).toEqual([]);
    expect(SUPPORTED_SCHEMA_KEYWORDS).toContain('additionalProperties');
    expect(SUPPORTED_SCHEMA_KEYWORDS).toContain('anyOf');
    expect(SUPPORTED_SCHEMA_KEYWORDS).not.toContain('format');
  });
});
