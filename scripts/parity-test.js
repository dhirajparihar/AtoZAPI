/**
 * AtoZAPI Cross-Framework Parity Test Suite
 * Validates that all framework SDKs output identical HTTP 422 error structures
 * conforming strictly to FastAPI / Pydantic specifications.
 */

const assert = require('assert');
const { atozapi, validateSchema } = require('../sdk-js/express');
const { nextAtozapi } = require('../sdk-js/nextjs');

function assertFastAPIErrorStructure(detail, frameworkName) {
  assert.ok(Array.isArray(detail), `[${frameworkName}] Expected 'detail' to be an array`);
  assert.ok(detail.length > 0, `[${frameworkName}] Expected at least 1 validation error item`);

  for (const item of detail) {
    assert.ok(Array.isArray(item.loc), `[${frameworkName}] Error item 'loc' must be an array`);
    assert.strictEqual(item.loc[0], 'body', `[${frameworkName}] 'loc[0]' must be 'body'`);
    assert.strictEqual(typeof item.loc[1], 'string', `[${frameworkName}] 'loc[1]' must be a string field name`);
    assert.strictEqual(typeof item.msg, 'string', `[${frameworkName}] Error item 'msg' must be a string`);
    assert.strictEqual(typeof item.type, 'string', `[${frameworkName}] Error item 'type' must be a string`);
  }
}

async function runParityTests() {
  console.log('Running AtoZAPI cross-framework parity test suite...\n');

  const commonSchema = {
    name: { type: 'string', required: true, minLength: 2 },
    age: { type: 'number', required: true, min: 18 }
  };

  const brokenPayload = { name: 'A', age: 14 };
  const validPayload = { name: 'Alice Smith', age: 24 };

  // 1. Test Express SDK Parity
  console.log('Checking Express SDK parity...');
  const expressMiddleware = atozapi(commonSchema);
  let expressStatus = null;
  let expressBody = null;

  const mockRes = {
    status(code) { expressStatus = code; return this; },
    json(data) { expressBody = data; }
  };

  expressMiddleware({ body: brokenPayload }, mockRes, () => {});
  assert.strictEqual(expressStatus, 422, 'Express must respond with status 422');
  assertFastAPIErrorStructure(expressBody.detail, 'Express');
  console.log('PASS: Express error payload matches FastAPI structure');

  // 2. Test Next.js App Router Parity
  console.log('Checking Next.js App Router SDK parity...');
  const nextHandler = nextAtozapi({
    schema: commonSchema,
    handler: async (req, { validatedBody }) => {
      return new Response(JSON.stringify({ success: true, data: validatedBody }), { status: 200 });
    }
  });

  const nextReq = new Request('http://localhost:3000/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(brokenPayload)
  });

  const nextRes = await nextHandler(nextReq);
  assert.strictEqual(nextRes.status, 422, 'Next.js route must respond with status 422');
  const nextBody = await nextRes.json();
  assertFastAPIErrorStructure(nextBody.detail, 'Next.js');
  console.log('PASS: Next.js error payload matches FastAPI structure');

  // 3. Test Field-level schema parity matching
  console.log('Checking field-level validation parity...');
  const emptyValidation = validateSchema(commonSchema, {});
  assert.strictEqual(emptyValidation.valid, false);
  assert.strictEqual(emptyValidation.errors.length, 2);
  assert.strictEqual(emptyValidation.errors[0].loc[1], 'name');
  assert.strictEqual(emptyValidation.errors[1].loc[1], 'age');
  console.log('PASS: Empty payload triggers missing field errors across all targets');

  // 4. Parity with valid payloads
  let expressNextCalled = false;
  expressMiddleware({ body: validPayload }, mockRes, () => { expressNextCalled = true; });
  assert.strictEqual(expressNextCalled, true, 'Express must pass valid payloads to next middleware');

  const validNextReq = new Request('http://localhost:3000/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validPayload)
  });
  const validNextRes = await nextHandler(validNextReq);
  assert.strictEqual(validNextRes.status, 200, 'Next.js must accept valid payloads');

  console.log('PASS: Valid payloads pass cleanly across all runtimes');

  console.log('\nAll framework parity checks passed successfully.');
}

runParityTests().catch(err => {
  console.error('\nParity test failed:', err);
  process.exit(1);
});
