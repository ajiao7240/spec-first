'use strict';

function validateAgainstSchema(schema, value, pointer = 'root', errors = []) {
  if (!schema || typeof schema !== 'object') {
    return { valid: false, errors: [`${pointer}: missing schema`] };
  }

  const expectedType = schema.type;
  if (expectedType) {
    const actualType = Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value;
    const expectedTypes = Array.isArray(expectedType) ? expectedType : [expectedType];
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

  if (schema.type === 'object' && value && !Array.isArray(value)) {
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

    if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
      for (const [key, child] of Object.entries(value)) {
        if (!Object.prototype.hasOwnProperty.call(properties, key)) {
          validateAgainstSchema(schema.additionalProperties, child, `${pointer}.${key}`, errors);
        }
      }
    }
  }

  if (schema.type === 'array' && Array.isArray(value) && schema.items) {
    value.forEach((item, index) => {
      validateAgainstSchema(schema.items, item, `${pointer}[${index}]`, errors);
    });
  }

  return { valid: errors.length === 0, errors };
}

module.exports = {
  validateAgainstSchema,
};
