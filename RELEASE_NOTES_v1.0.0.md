# Release v1.0.0 — The Polyglot FastAPI Developer Experience

We are proud to announce the **v1.0.0** release of **Fastapify**, bringing Python FastAPI's DX — declarative runtime request validation, standardized HTTP 422 `{ detail: [...] }` errors, and interactive Swagger UI / ReDoc at `/docs` — to Express, Next.js, Go (Gin), and PHP (Laravel).

---

## What's in v1.0.0

### 1. Polyglot Framework SDKs
- **Node.js (Express)**: [`@fastapify/express`](https://www.npmjs.com/package/@fastapify/express) — zero-dependency JSON schema validation attaching typed, sanitized objects to `req.validatedBody`.
- **Next.js (App Router)**: [`@fastapify/nextjs`](https://www.npmjs.com/package/@fastapify/nextjs) — higher-order wrapper intercepting standard Fetch `Request` streams and passing validated payloads to route handlers.
- **Go (Gin)**: [`github.com/dhirajparihar/FastAPIfy/sdk-go/gin`](https://pkg.go.dev/github.com/dhirajparihar/FastAPIfy/sdk-go/gin) — reflection-driven `ginfastapify.Guard()` middleware with generic `Body[T](c)` typed retrieval.
- **PHP (Laravel)**: [`fastapify/laravel`](https://packagist.org/packages/fastapify/laravel) — native PHP 8 `#[Post]` attribute routing and reflection-based `FastapifyMiddleware`.

### 2. Strict HTTP 422 Error Parity
All framework SDKs return the exact Pydantic/FastAPI validation failure format:
```json
{
  "detail": [
    {
      "loc": ["body", "age"],
      "msg": "Input should be greater than or equal to 18",
      "type": "greater_than_equal",
      "ctx": { "ge": 18 }
    }
  ]
}
```

### 3. Core Scanner Engine & Documentation Server (`@fastapify/cli`)
- Static scanner parsing JavaScript, TypeScript, Go struct tags, and PHP attributes without requiring runtime dependencies.
- Generates valid **OpenAPI 3.0.3** specifications (`openapi.json`).
- Serves embedded **Swagger UI** at `/docs` and **ReDoc** at `/redoc`.
- Single command generation for CI/CD pipelines: `fastapify generate`.

---

## Installation & Packages

### CLI
```bash
# Run instantly with npx (recommended)
npx @fastapify/cli

# Or install globally
npm install -g @fastapify/cli
```

### SDKs
```bash
# Express
npm install @fastapify/express

# Next.js
npm install @fastapify/nextjs

# Go (Gin)
go get github.com/dhirajparihar/FastAPIfy/sdk-go/gin@v1.0.0

# PHP (Laravel)
composer require fastapify/laravel
```

---

## Standalone Native Binaries (Zero-Node)
If you are developing in Go or PHP and don't want to install Node.js/npm, download the standalone single-file binary attached below:
- **Windows (x64)**: `fastapify-win-x64.exe`
- **Linux (x64)**: `fastapify-linux-x64`
- **macOS (x64)**: `fastapify-macos-x64`

