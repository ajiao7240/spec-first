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

  test('enforces string pattern constraints', () => {
    const result = validateAgainstSchema({
      type: 'string',
      pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$',
    }, 'Bad_Value');

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([
      'root: value "Bad_Value" does not match pattern ^[a-z0-9]+(?:-[a-z0-9]+)*$',
    ]);
  });

  test('keeps format advisory and documents supported keywords', () => {
    const result = validateAgainstSchema({
      type: 'string',
      format: 'date-time',
    }, 'not-a-date');

    expect(result.errors).toEqual([]);
    expect(SUPPORTED_SCHEMA_KEYWORDS).toContain('$ref');
    expect(SUPPORTED_SCHEMA_KEYWORDS).toContain('additionalProperties');
    expect(SUPPORTED_SCHEMA_KEYWORDS).toContain('anyOf');
    expect(SUPPORTED_SCHEMA_KEYWORDS).toContain('pattern');
    expect(SUPPORTED_SCHEMA_KEYWORDS).not.toContain('format');
  });

  test('resolves local $defs references instead of ignoring nested constraints', () => {
    const schema = {
      type: 'object',
      required: ['result'],
      properties: {
        result: { $ref: '#/$defs/result' },
      },
      $defs: {
        result: {
          type: 'object',
          required: ['status'],
          properties: {
            status: { enum: ['ready'] },
          },
          additionalProperties: false,
        },
      },
    };

    const result = validateAgainstSchema(schema, {
      result: {
        status: 'unknown',
        extra: true,
      },
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([
      'root.result.status: value "unknown" not in enum',
      'root.result.extra: unexpected additional key',
    ]);
  });

  test('enforces required/properties even when type:object is omitted', () => {
    const schema = {
      required: ['a'],
      properties: { a: { type: 'string' } },
    };

    expect(validateAgainstSchema(schema, {}).errors).toEqual([
      'root: missing required key a',
    ]);
    expect(validateAgainstSchema(schema, { a: 'ok' }).errors).toEqual([]);
    expect(validateAgainstSchema(schema, { a: 1 }).errors).toEqual([
      'root.a: expected string, received number',
    ]);
  });

  test('enforces exclusiveMinimum and exclusiveMaximum bounds', () => {
    expect(validateAgainstSchema({ type: 'integer', exclusiveMinimum: 0 }, 0).errors).toEqual([
      'root: expected number > 0, received 0',
    ]);
    expect(validateAgainstSchema({ type: 'integer', exclusiveMinimum: 0 }, 1).errors).toEqual([]);
    expect(validateAgainstSchema({ type: 'integer', exclusiveMaximum: 10 }, 10).errors).toEqual([
      'root: expected number < 10, received 10',
    ]);
    expect(SUPPORTED_SCHEMA_KEYWORDS).toContain('exclusiveMinimum');
    expect(SUPPORTED_SCHEMA_KEYWORDS).toContain('exclusiveMaximum');
  });

  test('fails closed for unsupported schema references', () => {
    const result = validateAgainstSchema({
      $ref: 'https://example.invalid/schema.json',
    }, 'value');

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([
      'root: unsupported schema ref https://example.invalid/schema.json',
    ]);
  });
});
