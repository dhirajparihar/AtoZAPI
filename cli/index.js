#!/usr/bin/env node

/**
 * Fastapify CLI
 * Core workspace scanner engine, OpenAPI compiler, and localized Swagger UI server.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

// Configuration defaults
const DEFAULT_PORT = 8000;
const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  'coverage',
  '.turbo',
  'cli', // Do not scan CLI engine itself
  'tests',
  '__tests__',
  'docs'
]);

/**
 * Recursively find all source files in a directory.
 */
function findFiles(dir, extensions = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.go', '.php']) {
  let results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) {
        results = results.concat(findFiles(fullPath, extensions));
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      const isTestFile = entry.name.endsWith('_test.go') ||
                         entry.name.includes('.test.') ||
                         entry.name.includes('.spec.');
      if (extensions.includes(ext) && !isTestFile) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

/**
 * Parses Laravel attribute validation rules into Fastapify schema.
 */
function parseLaravelRulesSchema(rulesStr) {
  if (!rulesStr) return null;
  const schema = { body: {} };
  const fieldRegex = /['"]([a-zA-Z0-9_]+)['"]\s*=>\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = fieldRegex.exec(rulesStr)) !== null) {
    const fieldName = match[1];
    const rulesList = match[2].split('|').map(r => r.trim());

    const fieldRule = {};
    if (rulesList.includes('integer') || rulesList.includes('int')) {
      fieldRule.type = 'integer';
    } else if (rulesList.includes('numeric')) {
      fieldRule.type = 'number';
    } else if (rulesList.includes('boolean') || rulesList.includes('bool')) {
      fieldRule.type = 'boolean';
    } else if (rulesList.includes('array')) {
      fieldRule.type = 'array';
    } else {
      fieldRule.type = 'string';
    }

    if (rulesList.includes('required')) {
      fieldRule.required = true;
    }

    for (const rule of rulesList) {
      if (rule.startsWith('min:')) {
        const val = parseFloat(rule.slice(4));
        if (fieldRule.type === 'string') {
          fieldRule.minLength = val;
        } else {
          fieldRule.min = val;
        }
      }
      if (rule.startsWith('max:')) {
        const val = parseFloat(rule.slice(4));
        if (fieldRule.type === 'string') {
          fieldRule.maxLength = val;
        } else {
          fieldRule.max = val;
        }
      }
      if (rule === 'email') fieldRule.format = 'email';
    }

    schema.body[fieldName] = fieldRule;
  }
  return schema;
}

/**
 * Parses Go struct definitions and tags (json, binding) into Fastapify schema.
 */
function parseGoStructSchema(structName, content) {
  const structRegex = new RegExp(`type\\s+${structName}\\s+struct\\s*\\{([\\s\\S]*?)\\}`, 'm');
  const match = structRegex.exec(content);
  if (!match) return null;

  const structBody = match[1];
  const schema = { body: {} };
  const lineRegex = /([a-zA-Z0-9_]+)\s+([a-zA-Z0-9_*\[\]]+)(?:\s+`([^`]+)`)?/g;
  let lineMatch;
  while ((lineMatch = lineRegex.exec(structBody)) !== null) {
    const fieldName = lineMatch[1];
    const goType = lineMatch[2];
    const tag = lineMatch[3] || '';

    // Extract JSON tag
    const jsonMatch = /json:"([^",]+)/.exec(tag);
    const jsonPropName = jsonMatch ? jsonMatch[1] : fieldName.toLowerCase();
    if (jsonPropName === '-') continue;

    // Extract binding tag
    const bindingMatch = /binding:"([^"]+)"/.exec(tag);
    const bindingRules = bindingMatch ? bindingMatch[1].split(',') : [];

    const fieldRule = {};
    if (['string'].includes(goType)) {
      fieldRule.type = 'string';
    } else if (['int', 'int8', 'int16', 'int32', 'int64', 'uint', 'uint8', 'uint16', 'uint32', 'uint64'].includes(goType)) {
      fieldRule.type = 'integer';
    } else if (['float32', 'float64'].includes(goType)) {
      fieldRule.type = 'number';
    } else if (['bool'].includes(goType)) {
      fieldRule.type = 'boolean';
    } else {
      fieldRule.type = 'string';
    }

    if (bindingRules.includes('required')) {
      fieldRule.required = true;
    }

    for (const b of bindingRules) {
      if (b.startsWith('gte=')) fieldRule.min = parseFloat(b.slice(4));
      if (b.startsWith('gt=')) fieldRule.min = parseFloat(b.slice(3));
      if (b.startsWith('lte=')) fieldRule.max = parseFloat(b.slice(4));
      if (b.startsWith('lt=')) fieldRule.max = parseFloat(b.slice(3));
      if (b.startsWith('min=')) fieldRule.minLength = parseInt(b.slice(4), 10);
      if (b.startsWith('max=')) fieldRule.maxLength = parseInt(b.slice(4), 10);
      if (b === 'email') fieldRule.format = 'email';
    }

    schema.body[jsonPropName] = fieldRule;
  }
  return schema;
}

/**
 * Extracts a complete balanced object literal starting from or after startIndex.
 */
function extractObjectLiteral(str, startIndex = 0) {
  let depth = 0;
  let inString = false;
  let stringChar = null;
  let escape = false;
  let start = -1;

  for (let i = startIndex; i < str.length; i++) {
    const char = str[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === '\\') {
      escape = true;
      continue;
    }
    if (inString) {
      if (char === stringChar) {
        inString = false;
      }
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      inString = true;
      stringChar = char;
      continue;
    }
    if (char === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (char === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        return str.slice(start, i + 1);
      }
    }
  }
  return null;
}

/**
 * Safely evaluates an object literal string or resolves variable declarations within file context.
 */
function resolveSchema(schemaExpr, fileContent) {
  if (!schemaExpr || typeof schemaExpr !== 'string') return null;
  const trimmed = schemaExpr.trim();

  // If it's directly an object literal
  if (trimmed.startsWith('{')) {
    const rawLiteral = extractObjectLiteral(trimmed, 0) || trimmed;
    try {
      const fn = new Function(`return (${rawLiteral});`);
      return fn();
    } catch (_) {
      try {
        return JSON.parse(rawLiteral);
      } catch (e) {
        return null;
      }
    }
  }

  // If it's a variable identifier, e.g. userRegistrationSchema or userSchema
  if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(trimmed)) {
    const varName = trimmed;
    const declRegex = new RegExp(`(?:const|let|var)\\s+${varName}\\s*=`, 'm');
    const declMatch = declRegex.exec(fileContent);
    if (declMatch) {
      const objLiteral = extractObjectLiteral(fileContent, declMatch.index + declMatch[0].length);
      if (objLiteral) {
        try {
          const fn = new Function(`return (${objLiteral});`);
          return fn();
        } catch (_) {
          return null;
        }
      }
    }
  }

  return null;
}

/**
 * Normalizes a field definition into OpenAPI 3.0 schema property.
 */
function convertFieldToOpenAPISchema(rule) {
  if (typeof rule === 'string') {
    const type = rule.toLowerCase();
    if (['number', 'int', 'integer', 'float'].includes(type)) {
      return { type: type === 'int' || type === 'integer' ? 'integer' : 'number' };
    }
    if (['boolean', 'bool'].includes(type)) return { type: 'boolean' };
    if (['array', 'list'].includes(type)) return { type: 'array', items: { type: 'string' } };
    return { type: 'string' };
  }

  if (typeof rule !== 'object' || rule === null) {
    return { type: 'string' };
  }

  const type = (rule.type || 'string').toLowerCase();
  const schema = {};

  if (['int', 'integer'].includes(type)) {
    schema.type = 'integer';
  } else if (['number', 'float'].includes(type)) {
    schema.type = 'number';
  } else if (['boolean', 'bool'].includes(type)) {
    schema.type = 'boolean';
  } else if (['array', 'list'].includes(type)) {
    schema.type = 'array';
    schema.items = rule.items ? convertFieldToOpenAPISchema(rule.items) : { type: 'string' };
  } else if (type === 'object') {
    schema.type = 'object';
    schema.properties = {};
    const props = rule.properties || {};
    for (const [key, propRule] of Object.entries(props)) {
      schema.properties[key] = convertFieldToOpenAPISchema(propRule);
    }
  } else {
    schema.type = 'string';
  }

  if (rule.description) schema.description = rule.description;
  if (rule.default !== undefined) schema.default = rule.default;
  if (rule.format) schema.format = rule.format;
  if (typeof rule.min === 'number') schema.minimum = rule.min;
  if (typeof rule.max === 'number') schema.maximum = rule.max;
  if (typeof rule.minLength === 'number') schema.minLength = rule.minLength;
  if (typeof rule.maxLength === 'number') schema.maxLength = rule.maxLength;
  if (rule.pattern) schema.pattern = typeof rule.pattern === 'string' ? rule.pattern : rule.pattern.source;

  return schema;
}

/**
 * Convert user-defined schema object into OpenAPI requestBody schema.
 */
function buildOpenAPIRequestBody(rawSchema, modelName = 'UserPayload') {
  if (!rawSchema) return null;
  const target = rawSchema.body || rawSchema;

  const properties = {};
  const required = [];

  for (const [fieldName, fieldRule] of Object.entries(target)) {
    properties[fieldName] = convertFieldToOpenAPISchema(fieldRule);
    const isRequired = typeof fieldRule === 'string'
      ? true
      : (fieldRule && fieldRule.required !== false && !fieldRule.optional);
    if (isRequired) {
      required.push(fieldName);
    }
  }

  return {
    description: 'JSON request payload validated by fastapify',
    required: true,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties,
          ...(required.length > 0 ? { required } : {})
        }
      }
    }
  };
}

/**
 * Scans Express and Next.js route patterns.
 */
function scanCodebaseForRoutes(rootDir) {
  const files = findFiles(rootDir);
  const routes = [];

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const relativePath = path.relative(rootDir, filePath).replace(/\\/g, '/');

    // 1. Check for Express patterns: app.post('/api/users', fastapify(schema), ...)
    // Or router.post(...)
    const expressRegex = /(?:app|router)\.(post|get|put|delete|patch)\(\s*['"`]([^'"`]+)['"`]\s*,\s*fastapify\(([\s\S]*?)\)\s*(?:,|\))/g;
    let match;
    while ((match = expressRegex.exec(content)) !== null) {
      const method = match[1].toLowerCase();
      const routePath = match[2];
      const rawSchemaExpr = match[3];
      const parsedSchema = resolveSchema(rawSchemaExpr, content);

      routes.push({
        framework: 'express',
        method,
        path: routePath,
        file: relativePath,
        schema: parsedSchema
      });
    }

    // 2. Check for Next.js App Router patterns:
    // Files inside app/**/route.(js|ts)
    if (relativePath.includes('/app/') && /\/route\.(js|ts|mjs)$/.test(relativePath)) {
      const appIndex = relativePath.indexOf('/app/');
      const routeSub = relativePath
        .slice(appIndex + 5)
        .replace(/\/route\.(js|ts|mjs)$/, '');
      const cleanRoutePath = routeSub.startsWith('/') ? routeSub : `/${routeSub}`;

      // Pattern A: (const|export const) POST = nextFastapify({ schema: ..., handler: ... })
      const nextPattern = /(?:export\s+)?(?:const|let|var|async\s+function)\s+(GET|POST|PUT|DELETE|PATCH)\s*=\s*nextFastapify\(\s*\{([\s\S]*?)\}\s*\)/g;
      let nextMatch;
      while ((nextMatch = nextPattern.exec(content)) !== null) {
        const method = nextMatch[1].toLowerCase();
        const innerOptions = nextMatch[2];

        // Extract schema block or identifier inside options
        const schemaExtract = /schema:\s*([^,\n}]+|\{[\s\S]*?\})\s*(?:,|$)/.exec(innerOptions);
        const parsedSchema = schemaExtract ? resolveSchema(schemaExtract[1], content) : null;

        routes.push({
          framework: 'nextjs',
          method,
          path: cleanRoutePath,
          file: relativePath,
          schema: parsedSchema
        });
      }

      // Pattern B: (const|export const) POST = nextFastapify(schema, handler)
      const nextDirectPattern = /(?:export\s+)?(?:const|let|var|async\s+function)\s+(GET|POST|PUT|DELETE|PATCH)\s*=\s*nextFastapify\(\s*([^,\n]+|\{[\s\S]*?\})\s*,\s*(?:async\s*)?\(/g;
      let directMatch;
      while ((directMatch = nextDirectPattern.exec(content)) !== null) {
        const method = directMatch[1].toLowerCase();
        const schemaExpr = directMatch[2];
        const parsedSchema = resolveSchema(schemaExpr, content);

        routes.push({
          framework: 'nextjs',
          method,
          path: cleanRoutePath,
          file: relativePath,
          schema: parsedSchema
        });
      }
    }

    // 3. Check for Go (Gin) patterns: r.POST("/api/users", ginfastapify.Guard(User{}), ...)
    if (filePath.endsWith('.go')) {
      const ginRegex = /(?:r|router|app|engine|group)\.(POST|GET|PUT|DELETE|PATCH)\(\s*["`]([^"`]+)["`]\s*,\s*ginfastapify\.Guard\((?:&)?([a-zA-Z0-9_]+)(?:\{\})?\)/g;
      let ginMatch;
      while ((ginMatch = ginRegex.exec(content)) !== null) {
        const method = ginMatch[1].toLowerCase();
        const routePath = ginMatch[2];
        const structName = ginMatch[3];
        const parsedSchema = parseGoStructSchema(structName, content);

        routes.push({
          framework: 'gin',
          method,
          path: routePath,
          file: relativePath,
          schema: parsedSchema
        });
      }
    }

    // 4. Check for PHP Laravel patterns: #[Post(path: '/api/users', rules: [...])]
    if (filePath.endsWith('.php')) {
      const phpRegex = /#\[Post\(\s*(?:path:\s*)?['"]([^'"]+)['"](?:[\s\S]*?rules:\s*\[([\s\S]*?)\])?[\s\S]*?\)\]/g;
      let phpMatch;
      while ((phpMatch = phpRegex.exec(content)) !== null) {
        const routePath = phpMatch[1];
        const rawRules = phpMatch[2] || '';
        const parsedSchema = parseLaravelRulesSchema(rawRules);

        routes.push({
          framework: 'laravel',
          method: 'post',
          path: routePath,
          file: relativePath,
          schema: parsedSchema
        });
      }
    }
  }

  return routes;
}

/**
 * Compiles detected routes into OpenAPI 3.0.3 specification.
 */
function compileOpenAPISpec(routes, options = {}) {
  const spec = {
    openapi: '3.0.3',
    info: {
      title: options.title || 'Fastapify API Docs',
      version: options.version || '1.0.0',
      description: options.description || 'Interactive API documentation generated automatically by Fastapify across polyglot backends.'
    },
    paths: {},
    components: {
      schemas: {
        ValidationError: {
          title: 'ValidationError',
          type: 'object',
          required: ['loc', 'msg', 'type'],
          properties: {
            loc: {
              title: 'Location',
              type: 'array',
              items: {
                anyOf: [{ type: 'string' }, { type: 'integer' }]
              }
            },
            msg: {
              title: 'Message',
              type: 'string'
            },
            type: {
              title: 'Error Type',
              type: 'string'
            },
            ctx: {
              title: 'Error Context',
              type: 'object'
            }
          }
        },
        HTTPValidationError: {
          title: 'HTTPValidationError',
          type: 'object',
          properties: {
            detail: {
              title: 'Detail',
              type: 'array',
              items: {
                $ref: '#/components/schemas/ValidationError'
              }
            }
          }
        }
      }
    }
  };

  for (const route of routes) {
    const formattedPath = route.path.startsWith('/') ? route.path : `/${route.path}`;
    if (!spec.paths[formattedPath]) {
      spec.paths[formattedPath] = {};
    }

    const tag = formattedPath.split('/')[2] || formattedPath.split('/')[1] || 'default';
    const capitalizedTag = tag.charAt(0).toUpperCase() + tag.slice(1);
    const operationId = `${route.method}_${formattedPath.replace(/[^a-zA-Z0-9]/g, '_')}`;

    if (spec.paths[formattedPath][route.method]) {
      const existing = spec.paths[formattedPath][route.method];
      existing.summary = `${route.method.toUpperCase()} ${formattedPath} (Polyglot)`;
      existing.description = (existing.description || '') +
        `\n\n- Supported in **${route.framework}**: \`${route.file}\``;
      if (route.schema && !existing.requestBody) {
        existing.requestBody = buildOpenAPIRequestBody(route.schema);
      }
      continue;
    }

    const operation = {
      summary: `${route.method.toUpperCase()} ${formattedPath} (${route.framework})`,
      description: `Implemented in **${route.framework}**: \`${route.file}\``,
      operationId,
      tags: [capitalizedTag],
      responses: {
        '200': {
          description: 'Successful Response',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                description: 'JSON response payload'
              }
            }
          }
        },
        '422': {
          description: 'Validation Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/HTTPValidationError'
              }
            }
          }
        }
      }
    };

    if (route.schema && ['post', 'put', 'patch'].includes(route.method)) {
      const requestBody = buildOpenAPIRequestBody(route.schema);
      if (requestBody) {
        operation.requestBody = requestBody;
      }
    }

    spec.paths[formattedPath][route.method] = operation;
  }

  return spec;
}

/**
 * Returns HTML string template rendering Swagger UI.
 */
function renderSwaggerUIHtml(title = 'Fastapify - Swagger UI', specUrl = '/openapi.json') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" type="text/css" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.11.0/swagger-ui.css">
  <style>
    :root {
      --primary: #3159D9;
      --primary-hover: #2343B8;
      --bg: #F8FAFC;
      --text: #0F172A;
      --border: #E2E8F0;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      color: var(--text);
    }
    /* Sleek FastAPIfy Top Header */
    .fastapify-header {
      background: #FFFFFF;
      border-bottom: 1px solid var(--border);
      padding: 0.75rem 2rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: sticky;
      top: 0;
      z-index: 100;
      box-shadow: 0 1px 3px rgba(0,0,0,0.02);
    }
    .brand-wrap {
      display: flex;
      align-items: center;
      gap: 0.65rem;
    }
    .brand-badge {
      width: 28px;
      height: 28px;
      border-radius: 6px;
      background: linear-gradient(135deg, #3159D9, #10B981);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #FFFFFF;
      font-weight: 800;
      font-size: 14px;
    }
    .brand-name {
      font-size: 1.1rem;
      font-weight: 700;
      color: #0F172A;
      letter-spacing: -0.02em;
    }
    .brand-sub {
      font-size: 12px;
      color: #64748B;
      padding-left: 0.5rem;
      border-left: 1px solid var(--border);
    }
    .header-links {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .header-links a {
      font-size: 13px;
      font-weight: 500;
      color: #64748B;
      text-decoration: none;
      padding: 0.35rem 0.65rem;
      border-radius: 6px;
      transition: all 0.15s ease;
    }
    .header-links a:hover {
      color: var(--primary);
      background: #EFF4FF;
    }
    .header-links .active-tab {
      color: var(--primary);
      background: #EFF4FF;
      font-weight: 600;
    }
    
    /* Swagger UI Overrides */
    .swagger-ui .topbar { display: none !important; }
    .swagger-ui {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
      font-family: inherit !important;
    }
    .swagger-ui .info {
      margin: 1.5rem 0 2rem 0 !important;
    }
    .swagger-ui .info .title {
      font-family: inherit !important;
      font-size: 2rem !important;
      font-weight: 700 !important;
      color: #0F172A !important;
      letter-spacing: -0.02em !important;
    }
    .swagger-ui .opblock {
      border-radius: 8px !important;
      box-shadow: 0 1px 3px rgba(0,0,0,0.03) !important;
      border: 1px solid var(--border) !important;
      margin-bottom: 1rem !important;
    }
    .swagger-ui .opblock .opblock-summary {
      padding: 0.85rem 1rem !important;
    }
    .swagger-ui .opblock .opblock-summary-method {
      border-radius: 6px !important;
      font-weight: 700 !important;
      font-size: 12.5px !important;
      padding: 6px 14px !important;
    }
    .swagger-ui .btn.execute {
      background-color: var(--primary) !important;
      border-color: var(--primary) !important;
      border-radius: 6px !important;
      box-shadow: 0 1px 2px rgba(0,0,0,0.05) !important;
      font-weight: 600 !important;
    }
    .swagger-ui .btn.execute:hover {
      background-color: var(--primary-hover) !important;
    }
    .swagger-ui .btn.try-out__btn {
      border-radius: 6px !important;
      font-weight: 600 !important;
    }
    .swagger-ui code, .swagger-ui pre {
      font-family: 'JetBrains Mono', monospace !important;
    }
    .swagger-ui section.models {
      border: 1px solid var(--border) !important;
      border-radius: 8px !important;
      background: #FFFFFF !important;
    }
  </style>
</head>
<body>
  <header class="fastapify-header">
    <div class="brand-wrap">
      <div class="brand-badge">F</div>
      <span class="brand-name">FastAPIfy</span>
      <span class="brand-sub">Interactive Documentation</span>
    </div>
    <div class="header-links">
      <a href="/docs" class="active-tab">Swagger UI</a>
      <a href="/redoc">ReDoc</a>
      <a href="/openapi.json" target="_blank">OpenAPI Spec</a>
    </div>
  </header>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.11.0/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function() {
      window.ui = SwaggerUIBundle({
        url: "${specUrl}",
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis
        ],
        layout: "BaseLayout",
        defaultModelsExpandDepth: 2,
        defaultModelExpandDepth: 2
      });
    };
  </script>
</body>
</html>`;
}

/**
 * Returns HTML string template rendering Redoc alternative.
 */
function renderRedocHtml(title = 'Fastapify - ReDoc', specUrl = '/openapi.json') {
  return `<!DOCTYPE html>
<html>
  <head>
    <title>${title}</title>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <style>
      body { margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', sans-serif; }
      .fastapify-header {
        background: #FFFFFF;
        border-bottom: 1px solid #E2E8F0;
        padding: 0.75rem 2rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
        position: sticky;
        top: 0;
        z-index: 1000;
        box-shadow: 0 1px 3px rgba(0,0,0,0.02);
      }
      .brand-wrap { display: flex; align-items: center; gap: 0.65rem; }
      .brand-badge {
        width: 28px; height: 28px; border-radius: 6px;
        background: linear-gradient(135deg, #3159D9, #10B981);
        display: flex; align-items: center; justify-content: center;
        color: #FFFFFF; font-weight: 800; font-size: 14px;
      }
      .brand-name { font-size: 1.1rem; font-weight: 700; color: #0F172A; }
      .brand-sub { font-size: 12px; color: #64748B; padding-left: 0.5rem; border-left: 1px solid #E2E8F0; }
      .header-links { display: flex; align-items: center; gap: 1rem; }
      .header-links a {
        font-size: 13px; font-weight: 500; color: #64748B; text-decoration: none;
        padding: 0.35rem 0.65rem; border-radius: 6px;
      }
      .header-links a:hover { color: #3159D9; background: #EFF4FF; }
      .header-links .active-tab { color: #3159D9; background: #EFF4FF; font-weight: 600; }
    </style>
  </head>
  <body>
    <header class="fastapify-header">
      <div class="brand-wrap">
        <div class="brand-badge">F</div>
        <span class="brand-name">FastAPIfy</span>
        <span class="brand-sub">API Reference</span>
      </div>
      <div class="header-links">
        <a href="/docs">Swagger UI</a>
        <a href="/redoc" class="active-tab">ReDoc</a>
        <a href="/openapi.json" target="_blank">OpenAPI Spec</a>
      </div>
    </header>
    <redoc spec-url="${specUrl}"></redoc>
    <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
  </body>
</html>`;
}

/**
 * Hosts lightweight localized HTTP server for Swagger UI and raw OpenAPI spec.
 */
function startServer(spec, port = DEFAULT_PORT) {
  const server = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;

    if (pathname === '/openapi.json') {
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify(spec, null, 2));
      return;
    }

    if (pathname === '/docs') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(renderSwaggerUIHtml('Fastapify - Swagger UI', '/openapi.json'));
      return;
    }

    if (pathname === '/redoc') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(renderRedocHtml('Fastapify - ReDoc', '/openapi.json'));
      return;
    }

    if (pathname === '/') {
      res.writeHead(302, { Location: '/docs' });
      res.end();
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
  });

  server.listen(port, () => {
    console.log(`[fastapify] Server running on http://localhost:${port}`);
    console.log(`[fastapify] Docs:     http://localhost:${port}/docs`);
    console.log(`[fastapify] ReDoc:    http://localhost:${port}/redoc`);
    console.log(`[fastapify] Spec:     http://localhost:${port}/openapi.json`);
  });

  return server;
}

/**
 * CLI execution entrypoint
 */
function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'serve';

  let port = DEFAULT_PORT;
  let targetDir = process.cwd();
  let outFile = path.join(process.cwd(), 'openapi.json');

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '-p' || args[i] === '--port') && args[i + 1]) {
      port = parseInt(args[i + 1], 10) || DEFAULT_PORT;
    }
    if ((args[i] === '-d' || args[i] === '--dir') && args[i + 1]) {
      targetDir = path.resolve(args[i + 1]);
    }
    if ((args[i] === '-o' || args[i] === '--out') && args[i + 1]) {
      outFile = path.resolve(args[i + 1]);
    }
  }

  console.log(`[fastapify] Scanning ${targetDir}`);
  const routes = scanCodebaseForRoutes(targetDir);
  console.log(`[fastapify] Discovered ${routes.length} route(s):`);
  routes.forEach(r => {
    console.log(`  ${r.method.toUpperCase().padEnd(6)} ${r.path.padEnd(20)} (${r.framework}) -> ${r.file}`);
  });

  const spec = compileOpenAPISpec(routes);
  fs.writeFileSync(outFile, JSON.stringify(spec, null, 2), 'utf-8');
  console.log(`[fastapify] Saved OpenAPI specification to ${outFile}`);

  if (command === 'generate') {
    process.exit(0);
  } else {
    startServer(spec, port);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  scanCodebaseForRoutes,
  compileOpenAPISpec,
  renderSwaggerUIHtml,
  startServer
};
