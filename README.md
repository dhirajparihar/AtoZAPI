# Fastapify

[![CI](https://github.com/fastapify/fastapify/actions/workflows/ci.yml/badge.svg)](https://github.com/fastapify/fastapify/actions)
[![NPM Version](https://img.shields.io/npm/v/@fastapify/express?color=blue)](https://www.npmjs.com/package/@fastapify/express)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![OpenAPI 3.0](https://img.shields.io/badge/OpenAPI-3.0.3-teal.svg)](https://swagger.io/specification/)
[![Platforms](https://img.shields.io/badge/Platforms-Express%20%7C%20Next.js%20%7C%20Gin%20%7C%20Laravel-blueviolet.svg)](#monorepo-architecture)

> FastAPI's automatic request validation and interactive Swagger UI / OpenAPI documentation at `/docs`, brought to Express, Next.js, Go (Gin), and PHP (Laravel).

---

## Before vs. After Fastapify

| Traditional Manual Boilerplate | With Fastapify |
| :--- | :--- |
| ```javascript<br>/**<br> * @swagger<br> * /api/users:<br> *   post:<br> *     summary: Create user<br> *     requestBody:<br> *       required: true<br> *       content: ... (30+ lines)<br> */<br>app.post('/api/users', (req, res) => {<br>  if (!req.body.name) return res.status(400)...<br>  if (req.body.name.length < 2) return ...<br>  if (!req.body.age) return res.status(400)...<br>  if (req.body.age < 18) return res.status(400)...<br>  // 20 lines of repetitive validation<br>});<br>``` | ```javascript<br>const schema = {<br>  name: { type: 'string', required: true, minLength: 2 },<br>  age: { type: 'number', required: true, min: 18 }<br>};<br><br>app.post('/api/users', fastapify(schema), (req, res) => {<br>  // 1. Automatic HTTP 422 on invalid input<br>  // 2. Verified payload on req.validatedBody<br>  // 3. Auto-generated /docs interactive Swagger UI<br>  res.status(201).json(req.validatedBody);<br>});<br>``` |

---

## Architecture Flow

```text
Incoming Request
       │
       ▼
[ Fastapify Middleware / Guard ]
       │
       ├─► Invalid Payload? ──► HTTP 422 Unprocessable Entity
       │                        { "detail": [{ "loc": ["body", "field"], "msg": "...", "type": "..." }] }
       │
       ▼ Valid Payload
[ Route Controller ] ─────────► Process Verified Data (req.validatedBody)
       ▲
       │
[ Fastapify CLI Scanner ] ────► Statically compiles openapi.json & serves /docs (Swagger UI)
```

---

## Monorepo Architecture

```text
fastapify/
├── package.json                   # Root monorepo workspace configuration
├── openapi.json                   # Auto-generated OpenAPI 3.0 specification
├── cli/                           # Core workspace scanner engine & Swagger UI server
│   ├── index.js                   # CLI tool that generates openapi.json and hosts /docs
│   └── package.json
├── sdk-js/
│   ├── express/
│   │   ├── index.js               # Express middleware logic (fastapify)
│   │   └── package.json
│   └── nextjs/
│       ├── index.js               # Next.js App Router higher-order wrapper (nextFastapify)
│       └── package.json
├── sdk-go/
│   └── gin/
│       ├── fastapify.go           # Gin middleware logic (ginfastapify.Guard)
│       └── go.mod
├── sdk-php/
│   └── laravel/
│       ├── composer.json          # Composer configuration (fastapify/laravel)
│       └── src/
│           ├── Attributes/Post.php # Native PHP 8 #[Post] attribute
│           └── Middleware/FastapifyMiddleware.php # Laravel reflection & 422 validator
└── examples/
    ├── express-app/
    │   ├── server.js              # Sample Express app
    │   └── package.json
    ├── nextjs-app/
    │   ├── app/api/users/route.js # Sample Next.js App Router API route
    │   └── package.json
    ├── go-app/
    │   ├── main.go                # Sample Gin app
    │   └── go.mod
    └── laravel-app/
        └── app/Http/Controllers/UserController.php # Sample Laravel controller
```

---

## 60-Second Quickstart

```bash
# 1. Install CLI
npm install -g @fastapify/cli

# 2. Run documentation server in any project
fastapify
# -> Interactive Swagger UI live at http://localhost:8000/docs
```

Run the Fastapify CLI to scan the codebase, compile `openapi.json`, and serve the interactive documentation:

```bash
# Generate openapi.json and launch docs server on http://localhost:8000
npm run docs

# Or generate spec without starting the server
npm run generate
```

- **Interactive Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Alternative ReDoc UI**: [http://localhost:8000/redoc](http://localhost:8000/redoc)
- **Raw OpenAPI Spec**: [http://localhost:8000/openapi.json](http://localhost:8000/openapi.json)

---

### 2. Express Integration (`@fastapify/express`)

The `fastapify(schema)` middleware performs runtime structural checks against `req.body`:
- Returns standardized **HTTP 422 Unprocessable Entity** with FastAPI-compatible `{ detail: [...] }` payload on validation failure.
- Attaches the verified, sanitized data to `req.validatedBody` and forwards execution.

```javascript
const express = require('express');
const { fastapify } = require('@fastapify/express');

const app = express();
app.use(express.json());

const userSchema = {
  name: { type: 'string', required: true, minLength: 2 },
  age: { type: 'number', required: true, min: 18, max: 120 }
};

app.post('/api/users', fastapify(userSchema), (req, res) => {
  const { name, age } = req.validatedBody;
  res.status(201).json({ success: true, user: { name, age } });
});

app.listen(3000);
```

#### Run the Express Example:
```bash
npm run example:express
```

Test an invalid request (triggering 422):
```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name": "A", "age": 12}'
```

Response:
```json
{
  "detail": [
    {
      "loc": ["body", "name"],
      "msg": "String should have at least 2 characters",
      "type": "string_too_short",
      "ctx": { "min_length": 2 }
    },
    {
      "loc": ["body", "age"],
      "msg": "Input should be greater than or equal to 18",
      "type": "greater_than_equal",
      "ctx": { "ge": 18 }
    }
  ]
}
```

---

### 3. Next.js App Router Integration (`@fastapify/nextjs`)

The `nextFastapify({ schema, handler })` wrapper intercepts incoming standard Web Fetch `Request` streams:
- Evaluates the payload structure against the schema.
- Throws/returns HTTP 422 response immediately on typing mismatches.
- Passes verified data into `handler(req, { validatedBody })` seamlessly.

`app/api/users/route.js`:
```javascript
const { nextFastapify } = require('@fastapify/nextjs');

const userSchema = {
  name: { type: 'string', required: true, minLength: 2 },
  age: { type: 'number', required: true, min: 18, max: 120 }
};

export const POST = nextFastapify({
  schema: userSchema,
  handler: async (req, { validatedBody }) => {
    return Response.json({
      success: true,
      user: validatedBody
    }, { status: 201 });
  }
});
```

### 4. Go / Gin Integration (`github.com/fastapify/sdk-go/gin`)

The `ginfastapify.Guard(schema)` middleware intercepts incoming Gin requests (`c.ShouldBindJSON`):
- Reflectively instantiates and validates the request body against struct tags (`binding:"required,gte=18"`).
- On validation failure, aborts immediately and returns standardized **HTTP 422 Unprocessable Entity** with FastAPI-compatible `{ detail: [...] }` payload.
- On success, stores the verified struct in the context key `"validatedBody"` (retrievable via `ginfastapify.Body[T](c)` or `ginfastapify.GetValidatedBody(c)`).

```go
package main

import (
    "net/http"
    ginfastapify "github.com/fastapify/sdk-go/gin"
    "github.com/gin-gonic/gin"
)

type User struct {
    Name string `json:"name" binding:"required"`
    Age  int    `json:"age" binding:"required,gte=18"`
}

func main() {
    r := gin.Default()

    r.POST("/api/users", ginfastapify.Guard(User{}), func(c *gin.Context) {
        user, _ := ginfastapify.Body[User](c)
        c.JSON(http.StatusCreated, gin.H{"user": user})
    })

    r.Run(":8080")
}
```

---

### 5. PHP 8+ / Laravel Integration (`fastapify/laravel`)

Use the native PHP 8 attribute `#[Post]` to tag controller methods with route paths and validation rules:
- `FastapifyMiddleware` uses PHP's `ReflectionMethod` to discover attributes on incoming requests.
- Validates `$request->all()` via Laravel's `Validator`.
- If validation fails, halts processing and returns an **HTTP 422 Unprocessable Entity** response array mimicking FastAPI.
- If successful, merges verified properties into the `$request` parameters and passes execution to the controller.

```php
namespace App\Http\Controllers;

use Fastapify\Laravel\Attributes\Post;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserController
{
    #[Post(
        path: '/api/users',
        summary: 'Register a new user',
        rules: [
            'name' => 'required|string|min:2',
            'age' => 'required|integer|min:18|max:120'
        ]
    )]
    public function store(Request $request): JsonResponse
    {
        $validated = $request->attributes->get('validatedBody');

        return response()->json([
            'success' => true,
            'user' => $validated
        ], 201);
    }
}
```

---

## CLI Options

```text
fastapify [command] [options]

Commands:
  serve       Scan codebase, compile openapi.json, and launch docs server (default)
  generate    Scan codebase and compile openapi.json file only

Options:
  -p, --port <number>   Docs server port (default: 8000)
  -d, --dir <path>      Directory to scan for route handlers (default: .)
  -o, --out <path>      Path to output openapi.json (default: ./openapi.json)
```

## License
MIT
