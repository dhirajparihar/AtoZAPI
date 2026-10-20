/**
 * @fastapify/nextjs
 * FastAPI-style request validation and OpenAPI metadata wrapper for Next.js App Router route handlers.
 */

/**
 * Validates a value against a field schema definition.
 * @param {string[]} loc - Location array for FastAPI error representation
 * @param {any} value - Value to validate
 * @param {object|string} rule - Field validation rule
 * @param {Array} errors - Error collection array
 * @returns {any}
 */
function validateField(loc, value, rule, errors) {
  const config = typeof rule === 'string' ? { type: rule, required: true } : (rule || {});
  const isRequired = config.required !== false && !config.optional;

  if (value === undefined || value === null || value === '') {
    if (isRequired) {
      errors.push({
        loc: [...loc],
        msg: 'Field required',
        type: 'missing'
      });
    }
    return config.default !== undefined ? config.default : value;
  }

  const expectedType = (config.type || 'string').toLowerCase();

  switch (expectedType) {
    case 'string': {
      if (typeof value !== 'string') {
        errors.push({
          loc: [...loc],
          msg: 'Input should be a valid string',
          type: 'string_type'
        });
        return value;
      }
      if (typeof config.minLength === 'number' && value.length < config.minLength) {
        errors.push({
          loc: [...loc],
          msg: `String should have at least ${config.minLength} characters`,
          type: 'string_too_short',
          ctx: { min_length: config.minLength }
        });
      }
      if (typeof config.maxLength === 'number' && value.length > config.maxLength) {
        errors.push({
          loc: [...loc],
          msg: `String should have at most ${config.maxLength} characters`,
          type: 'string_too_long',
          ctx: { max_length: config.maxLength }
        });
      }
      if (config.pattern) {
        const regex = config.pattern instanceof RegExp ? config.pattern : new RegExp(config.pattern);
        if (!regex.test(value)) {
          errors.push({
            loc: [...loc],
            msg: `String should match pattern '${regex.source}'`,
            type: 'string_pattern_mismatch'
          });
        }
      }
      if (config.format === 'email') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          errors.push({
            loc: [...loc],
            msg: 'Input should be a valid email address',
            type: 'value_error.email'
          });
        }
      }
      return value;
    }

    case 'number':
    case 'int':
    case 'integer':
    case 'float': {
      let num = typeof value === 'number' ? value : Number(value);
      if (isNaN(num) || typeof value === 'boolean') {
        errors.push({
          loc: [...loc],
          msg: 'Input should be a valid number',
          type: 'number_type'
        });
        return value;
      }

      if ((expectedType === 'int' || expectedType === 'integer') && !Number.isInteger(num)) {
        errors.push({
          loc: [...loc],
          msg: 'Input should be a valid integer',
          type: 'int_type'
        });
      }

      if (typeof config.min === 'number' && num < config.min) {
        errors.push({
          loc: [...loc],
          msg: `Input should be greater than or equal to ${config.min}`,
          type: 'greater_than_equal',
          ctx: { ge: config.min }
        });
      }

      if (typeof config.max === 'number' && num > config.max) {
        errors.push({
          loc: [...loc],
          msg: `Input should be less than or equal to ${config.max}`,
          type: 'less_than_equal',
          ctx: { le: config.max }
        });
      }
      return num;
    }

    case 'boolean':
    case 'bool': {
      if (typeof value === 'boolean') return value;
      if (value === 'true' || value === 1 || value === '1') return true;
      if (value === 'false' || value === 0 || value === '0') return false;
      errors.push({
        loc: [...loc],
        msg: 'Input should be a valid boolean',
        type: 'bool_type'
      });
      return value;
    }

    case 'array':
    case 'list': {
      if (!Array.isArray(value)) {
        errors.push({
          loc: [...loc],
          msg: 'Input should be a valid array',
          type: 'list_type'
        });
        return value;
      }
      if (typeof config.minItems === 'number' && value.length < config.minItems) {
        errors.push({
          loc: [...loc],
          msg: `Array should have at least ${config.minItems} items`,
          type: 'too_short',
          ctx: { min_length: config.minItems }
        });
      }
      if (config.items) {
        return value.map((item, index) => validateField([...loc, index], item, config.items, errors));
      }
      return value;
    }

    case 'object': {
      if (typeof value !== 'object' || Array.isArray(value) || value === null) {
        errors.push({
          loc: [...loc],
          msg: 'Input should be a valid dictionary or object',
          type: 'dict_type'
        });
        return value;
      }
      const resultObj = {};
      const properties = config.properties || {};
      for (const [key, propRule] of Object.entries(properties)) {
        resultObj[key] = validateField([...loc, key], value[key], propRule, errors);
      }
      return resultObj;
    }

    default:
      return value;
  }
}

/**
 * Validates request payload against schema.
 */
function validateSchema(schema, payload, rootLoc = 'body') {
  const errors = [];
  const validated = {};

  const targetSchema = schema.body || schema;
  const isTargetObject = typeof targetSchema === 'object' && targetSchema !== null;

  if (!isTargetObject) {
    return { valid: true, errors: [], data: payload || {} };
  }

  const rawPayload = (payload && typeof payload === 'object' && !Array.isArray(payload)) ? payload : {};

  if (Object.keys(targetSchema).length > 0 && (!payload || typeof payload !== 'object')) {
    errors.push({
      loc: [rootLoc],
      msg: 'Input should be a valid dictionary or object',
      type: 'dict_type'
    });
    return { valid: false, errors, data: {} };
  }

  for (const [field, rule] of Object.entries(targetSchema)) {
    const fieldVal = rawPayload[field];
    validated[field] = validateField([rootLoc, field], fieldVal, rule, errors);
  }

  return {
    valid: errors.length === 0,
    errors,
    data: validated
  };
}

/**
 * Creates a standard JSON Response for Next.js / Web Fetch API environments.
 */
function createJsonResponse(data, status = 200) {
  if (typeof Response !== 'undefined') {
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  // Fallback for non-Fetch mock environments
  return {
    status,
    body: data,
    headers: { 'content-type': 'application/json' }
  };
}

/**
 * Next.js App Router higher-order route handler wrapper.
 * Supports both call styles:
 *   nextFastapify({ schema, handler })
 *   nextFastapify(schema, handler)
 *
 * @param {object|Function} optionsOrSchema
 * @param {Function} [maybeHandler]
 * @returns {Function} Next.js route handler (req, context) => Promise<Response>
 */
function nextFastapify(optionsOrSchema, maybeHandler) {
  let schema = {};
  let handler = null;

  if (typeof optionsOrSchema === 'function') {
    handler = optionsOrSchema;
    schema = {};
  } else if (typeof maybeHandler === 'function') {
    schema = optionsOrSchema || {};
    handler = maybeHandler;
  } else if (optionsOrSchema && typeof optionsOrSchema === 'object') {
    schema = optionsOrSchema.schema || {};
    handler = optionsOrSchema.handler;
  }

  if (typeof handler !== 'function') {
    throw new Error('[fastapify] Next.js route handler must be a function.');
  }

  const wrappedRoute = async function fastapifyNextRoute(req, context = {}) {
    let rawBody = {};

    // In Web Request stream (Next.js App Router)
    if (req && typeof req.json === 'function') {
      try {
        const cloned = req.clone ? req.clone() : req;
        rawBody = await cloned.json();
      } catch (err) {
        // If content is empty or unparsable
        rawBody = {};
      }
    } else if (req && req.body) {
      rawBody = req.body;
    }

    const result = validateSchema(schema, rawBody, 'body');

    if (!result.valid) {
      return createJsonResponse({ detail: result.errors }, 422);
    }

    // Attach validatedBody to request and pass directly into execution callback context
    try {
      req.validatedBody = result.data;
    } catch (_) {
      // req might be frozen in some environments
    }

    const enhancedContext = {
      ...context,
      validatedBody: result.data,
      data: result.data
    };

    return await handler(req, enhancedContext);
  };

  // Expose schema metadata for automated CLI scanner reflection
  wrappedRoute.__fastapify = true;
  wrappedRoute._schema = schema;

  return wrappedRoute;
}

module.exports = {
  nextFastapify,
  validateSchema,
  validateField
};
