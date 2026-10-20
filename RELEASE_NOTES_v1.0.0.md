# Release v1.0.0 — The Polyglot FastAPI Developer Experience

We are proud to announce the **v1.0.0** release of **AtoZAPI**, bringing Python FastAPI's DX — declarative runtime request validation, standardized HTTP 422 `{ detail: [...] }` errors, and interactive Swagger UI / ReDoc at `/docs` — to Express, Next.js, Go (Gin), and PHP (Laravel).

---

## 🚀 Published Packages & Registry Links

| Component | Target Runtime | Package / Registry Link | Published Version |
| :--- | :--- | :--- | :--- |
| **CLI & Scanner** | Node.js / Multi-platform | [`@atozapi/cli`](https://www.npmjs.com/package/@atozapi/cli) | `v0.1.1` |
| **Express SDK** | Express.js | [`@atozapi/express`](https://www.npmjs.com/package/@atozapi/express) | `v0.1.0` |
| **Next.js SDK** | Next.js App Router | [`@atozapi/nextjs`](https://www.npmjs.com/package/@atozapi/nextjs) | `v0.1.0` |
| **Go (Gin) SDK** | Go 1.20+ | [`github.com/dhirajparihar/AtoZAPI/sdk-go/gin`](https://pkg.go.dev/github.com/dhirajparihar/AtoZAPI/sdk-go/gin) | `v1.0.0` |
| **PHP (Laravel) SDK** | PHP 8.1+ / Laravel 10+ | [`atozapi/laravel`](https://packagist.org/packages/atozapi/laravel) | `v1.0.0` |

---

## What's in v1.0.0

### 1. Polyglot Framework SDKs
- **Node.js (Express)**: [`@atozapi/express`](https://www.npmjs.com/package/@atozapi/express) — zero-dependency JSON schema validation attaching typed, sanitized objects to `req.validatedBody`.
- **Next.js (App Router)**: [`@atozapi/nextjs`](https://www.npmjs.com/package/@atozapi/nextjs) — higher-order wrapper intercepting standard Fetch `Request` streams and passing validated payloads to route handlers.
- **Go (Gin)**: [`github.com/dhirajparihar/AtoZAPI/sdk-go/gin`](https://pkg.go.dev/github.com/dhirajparihar/AtoZAPI/sdk-go/gin) — reflection-driven `ginatozapi.Guard()` middleware with generic `Body[T](c)` typed retrieval.
- **PHP (Laravel)**: [`atozapi/laravel`](https://packagist.org/packages/atozapi/laravel) — native PHP 8 `#[Post]` attribute routing and reflection-based `AtozapiMiddleware`.

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

### 3. Core Scanner Engine & Documentation Server (`@atozapi/cli`)
- Static scanner parsing JavaScript, TypeScript, Go struct tags, and PHP attributes without requiring runtime dependencies.
- Generates valid **OpenAPI 3.0.3** specifications (`openapi.json`).
- Serves embedded **Swagger UI** at `/docs` and **ReDoc** at `/redoc`.
- Single command generation for CI/CD pipelines: `atozapi generate`.

---

## Installation

### CLI
```bash
# Run instantly with npx (recommended)
npx @atozapi/cli serve

# Or install globally
npm install -g @atozapi/cli
```

### SDKs
```bash
# Express
npm install @atozapi/express

# Next.js
npm install @atozapi/nextjs

# Go (Gin)
go get github.com/dhirajparihar/AtoZAPI/sdk-go/gin@v1.0.0

# PHP (Laravel)
composer require atozapi/laravel
```

---

## Standalone Native Binaries (Zero-Node)
If you are developing in Go or PHP and don't want to install Node.js/npm, standalone pre-compiled native binaries are available in `cli/dist/`:
- **Windows (x64)**: `atozapi-win-x64.exe` (37.7 MB)
- **Linux (x64)**: `atozapi-linux-x64` (46.3 MB)
- **macOS (x64)**: `atozapi-macos-x64` (51.3 MB)
