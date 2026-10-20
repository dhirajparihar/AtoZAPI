# Release v1.0.0 — Initial Public Release

We are proud to announce the **v1.0.0** release of **Fastapify**, bringing Python FastAPI's DX — automatic request validation and interactive Swagger UI / OpenAPI documentation at `/docs` — to Node.js, Next.js, Go, and PHP.

---

## What's in v1.0.0

### 1. Polyglot Framework SDKs
- **Node.js (Express)**: `@fastapify/express` middleware performing zero-dependency JSON schema evaluation and attaching sanitized objects to `req.validatedBody`.
- **Next.js App Router**: `@fastapify/nextjs` higher-order wrapper intercepting standard Fetch `Request` streams and passing validated payloads to route handlers.
- **Go (Gin)**: `github.com/fastapify/sdk-go/gin` reflection-driven `ginfastapify.Guard()` middleware with generic `Body[T](c)` retrieval.
- **PHP (Laravel)**: `fastapify/laravel` native PHP 8 `#[Post]` attribute routing and reflection-based `FastapifyMiddleware`.

### 2. Standardized HTTP 422 Error Format
All four framework SDKs return the exact Pydantic/FastAPI validation failure format:
```json
{
  "detail": [
    {
      "loc": ["body", "fieldName"],
      "msg": "Input should be greater than or equal to 18",
      "type": "greater_than_equal",
      "ctx": { "ge": 18 }
    }
  ]
}
```

### 3. Core Workspace Scanner Engine & Documentation Server (`fastapify`)
- Fast, AST/regex-based static scanner capable of parsing JavaScript, TypeScript, Go struct tags, and PHP attributes without requiring runtime dependencies.
- Compiles valid **OpenAPI 3.0.3** specifications (`openapi.json`).
- Serves embedded **Swagger UI** at `/docs` and **ReDoc** at `/redoc`.
- Single command generation for CI/CD pipelines: `fastapify generate`.

---

## Getting Started

```bash
npm install -g fastapify
fastapify
```

Visit the documentation portal at `/docs` for full guides and API references.
