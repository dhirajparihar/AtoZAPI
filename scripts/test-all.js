/**
 * AtoZAPI JavaScript/TypeScript Test Runner
 * Validates Express SDK, Next.js SDK, and CLI OpenAPI generator.
 */

const assert = require('assert');
const { atozapi } = require('../sdk-js/express');
const { nextAtozapi } = require('../sdk-js/nextjs');
const { scanCodebaseForRoutes, compileOpenAPISpec } = require('../cli');

async function runTests() {
  console.log('Running test suite...');

  // Express SDK
  const expressSchema = {
    name: { type: 'string', required: true, minLength: 2 },
    age: { type: 'number', required: true, min: 18 }
  };
  const expressMiddleware = atozapi(expressSchema);

  let statusCaptured = null;
  let jsonCaptured = null;
  const mockReqInvalid = { body: { name: 'A', age: 15 } };
  const mockResInvalid = {
    status(code) { statusCaptured = code; return this; },
    json(data) { jsonCaptured = data; }
  };

  expressMiddleware(mockReqInvalid, mockResInvalid, () => {});
  assert.strictEqual(statusCaptured, 422);
  assert.ok(jsonCaptured && Array.isArray(jsonCaptured.detail));
  assert.strictEqual(jsonCaptured.detail.length, 2);
  console.log('PASS: Express rejects invalid payload with 422');

  let nextCalled = false;
  const mockReqValid = { body: { name: 'Alice', age: 25 } };
  const mockResValid = {
    status(code) { statusCaptured = code; return this; },
    json(data) { jsonCaptured = data; }
  };

  expressMiddleware(mockReqValid, mockResValid, () => { nextCalled = true; });
  assert.strictEqual(nextCalled, true);
  assert.strictEqual(mockReqValid.validatedBody.name, 'Alice');
  assert.strictEqual(mockReqValid.validatedBody.age, 25);
  console.log('PASS: Express validates payload and attaches validatedBody');

  // Next.js SDK
  const nextRoute = nextAtozapi({
    schema: expressSchema,
    handler: async (req, { validatedBody }) => {
      return new Response(JSON.stringify({ success: true, data: validatedBody }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  });

  const invalidNextReq = new Request('http://localhost:3000/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Z', age: 10 })
  });
  const invalidNextRes = await nextRoute(invalidNextReq);
  assert.strictEqual(invalidNextRes.status, 422);
  const invalidNextBody = await invalidNextRes.json();
  assert.ok(Array.isArray(invalidNextBody.detail));
  console.log('PASS: Next.js App Router wrapper rejects invalid payload with 422');

  const validNextReq = new Request('http://localhost:3000/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Bob', age: 30 })
  });
  const validNextRes = await nextRoute(validNextReq);
  assert.strictEqual(validNextRes.status, 201);
  const validNextBody = await validNextRes.json();
  assert.strictEqual(validNextBody.data.name, 'Bob');
  assert.strictEqual(validNextBody.data.age, 30);
  console.log('PASS: Next.js App Router wrapper passes validated payload');

  // CLI Scanner & Compiler
  const routes = scanCodebaseForRoutes(process.cwd());
  assert.ok(routes.length >= 1);
  const spec = compileOpenAPISpec(routes);
  assert.strictEqual(spec.openapi, '3.0.3');
  assert.ok(spec.paths['/api/users']);
  assert.ok(spec.components.schemas.HTTPValidationError);
  console.log(`PASS: CLI scanner compiled OpenAPI 3.0.3 with ${routes.length} route(s)`);

  console.log('\nAll tests passed.');
}

runTests().catch(err => {
  console.error('\nTest failed:', err);
  process.exit(1);
});
