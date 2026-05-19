'use strict';

const SUPPORTED_SCHEMA_KEYWORDS = [
  'type',
  'enum',
  'const',
  'required',
  'properties',
  'items',
  'additionalProperties',
  'anyOf',
  'oneOf',
  'allOf',
  'if',
  'then',
  'else',
  'minItems',
  'maxItems',
  'minLength',
  'maxLength',
  'pattern',
  'minimum',
  'maximum',
];

function getExpectedTypes(schema) {
  if (!schema.type) return [];
  return Array.isArray(schema.type) ? schema.type : [schema.type];
}

function schemaAllowsType(schema, typeName) {
  return getExpectedTypes(schema).includes(typeName);
}

function validateAgainstSchema(schema, value, pointer = 'root', errors = []) {
  if (!schema || typeof schema !== 'object') {
    return { valid: false, errors: [`${pointer}: missing schema`] };
  }

  if (Array.isArray(schema.allOf)) {
    for (const childSchema of schema.allOf) {
      validateAgainstSchema(childSchema, value, pointer, errors);
    }
  }

  if (Array.isArray(schema.anyOf)) {
    const matches = schema.anyOf
      .map((childSchema) => validateAgainstSchema(childSchema, value, pointer, []))
      .filter((result) => result.valid);
    if (matches.length === 0) {
      errors.push(`${pointer}: value did not match anyOf`);
    }
  }

  if (Array.isArray(schema.oneOf)) {
    const matches = schema.oneOf
      .map((childSchema) => validateAgainstSchema(childSchema, value, pointer, []))
      .filter((result) => result.valid);
    if (matches.length !== 1) {
      errors.push(`${pointer}: value matched ${matches.length} oneOf schemas`);
    }
  }

  if (schema.if && typeof schema.if === 'object') {
    const condition = validateAgainstSchema(schema.if, value, pointer, []);
    if (condition.valid && schema.then && typeof schema.then === 'object') {
      validateAgainstSchema(schema.then, value, pointer, errors);
    }
    if (!condition.valid && schema.else && typeof schema.else === 'object') {
      validateAgainstSchema(schema.else, value, pointer, errors);
    }
  }

  const expectedTypes = getExpectedTypes(schema);
  if (expectedTypes.length > 0) {
    const actualType = Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value;
    const typeMatches = expectedTypes.some((typeName) => {
      if (typeName === 'number') return typeof value === 'number' && Number.isFinite(value);
      if (typeName === 'integer') return Number.isInteger(value);
      if (typeName === 'array') return Array.isArray(value);
      if (typeName === 'object') return value && typeof value === 'object' && !Array.isArray(value);
      if (typeName === 'null') return value === null;
      return actualType === typeName;
    });
    if (!typeMatches) {
      errors.push(`${pointer}: expected ${expectedTypes.join('|')}, received ${actualType}`);
      return { valid: false, errors };
    }
  }

  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${pointer}: value ${JSON.stringify(value)} not in enum`);
  }

  if (Object.prototype.hasOwnProperty.call(schema, 'const') && value !== schema.const) {
    errors.push(`${pointer}: value ${JSON.stringify(value)} does not equal const ${JSON.stringify(schema.const)}`);
  }

  if (schemaAllowsType(schema, 'object') && value && typeof value === 'object' && !Array.isArray(value)) {
    const required = Array.isArray(schema.required) ? schema.required : [];
    for (const key of required) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) {
        errors.push(`${pointer}: missing required key ${key}`);
      }
    }

    const properties = schema.properties || {};
    for (const [key, propertySchema] of Object.entries(properties)) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        validateAgainstSchema(propertySchema, value[key], `${pointer}.${key}`, errors);
      }
    }

    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!Object.prototype.hasOwnProperty.call(properties, key)) {
          errors.push(`${pointer}.${key}: unexpected additional key`);
        }
      }
    } else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
      for (const [key, child] of Object.entries(value)) {
        if (!Object.prototype.hasOwnProperty.call(properties, key)) {
          validateAgainstSchema(schema.additionalProperties, child, `${pointer}.${key}`, errors);
        }
      }
    }
  }

  if (schemaAllowsType(schema, 'array') && Array.isArray(value) && schema.items) {
    value.forEach((item, index) => {
      validateAgainstSchema(schema.items, item, `${pointer}[${index}]`, errors);
    });
  }

  if (schemaAllowsType(schema, 'array') && Array.isArray(value)) {
    if (Number.isInteger(schema.minItems) && value.length < schema.minItems) {
      errors.push(`${pointer}: expected at least ${schema.minItems} item(s), received ${value.length}`);
    }
    if (Number.isInteger(schema.maxItems) && value.length > schema.maxItems) {
      errors.push(`${pointer}: expected at most ${schema.maxItems} item(s), received ${value.length}`);
    }
  }

  if (schemaAllowsType(schema, 'string') && typeof value === 'string') {
    if (Number.isInteger(schema.minLength) && value.length < schema.minLength) {
      errors.push(`${pointer}: expected string length at least ${schema.minLength}, received ${value.length}`);
    }
    if (Number.isInteger(schema.maxLength) && value.length > schema.maxLength) {
      errors.push(`${pointer}: expected string length at most ${schema.maxLength}, received ${value.length}`);
    }
    if (typeof schema.pattern === 'string' && !(new RegExp(schema.pattern).test(value))) {
      errors.push(`${pointer}: value ${JSON.stringify(value)} does not match pattern ${schema.pattern}`);
    }
  }

  if ((schemaAllowsType(schema, 'number') || schemaAllowsType(schema, 'integer')) && typeof value === 'number') {
    if (typeof schema.minimum === 'number' && value < schema.minimum) {
      errors.push(`${pointer}: expected number >= ${schema.minimum}, received ${value}`);
    }
    if (typeof schema.maximum === 'number' && value > schema.maximum) {
      errors.push(`${pointer}: expected number <= ${schema.maximum}, received ${value}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

module.exports = {
  SUPPORTED_SCHEMA_KEYWORDS,
  validateAgainstSchema,
};
