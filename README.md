# AtoZAPI

<p align="center">
  <strong>FastAPI's developer experience — brought to Express, Next.js, Go (Gin), and Laravel.</strong>
</p>

<p align="center">
  <a href="https://github.com/dhirajparihar/AtoZAPI/actions/workflows/ci.yml"><img src="https://github.com/dhirajparihar/AtoZAPI/actions/workflows/ci.yml/badge.svg" alt="CI Status" /></a>
  <a href="https://www.npmjs.com/package/@atozapi/cli"><img src="https://img.shields.io/npm/v/@atozapi/cli?color=3159D9&label=npm%20cli" alt="NPM CLI Version" /></a>
  <a href="https://packagist.org/packages/atozapi/laravel"><img src="https://img.shields.io/packagist/v/atozapi/laravel?color=F05340&label=packagist" alt="Packagist Version" /></a>
  <a href="https://pkg.go.dev/github.com/dhirajparihar/AtoZAPI/sdk-go/gin"><img src="https://img.shields.io/badge/go.dev-v1.0.0-00ADD8?logo=go&logoColor=white" alt="Go Reference" /></a>
  <a href="https://dhirajparihar.github.io/AtoZAPI/"><img src="https://img.shields.io/badge/docs-live-10B981" alt="Documentation" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT" /></a>
</p>

<p align="center">
  <a href="https://dhirajparihar.github.io/AtoZAPI/">Documentation</a> •
  <a href="#quickstart-in-60-seconds">Quickstart</a> •
  <a href="#integrating-into-an-existing-project">Existing Projects</a> •
  <a href="#schema-reference--rules">Schema Reference</a> •
  <a href="#polyglot-ecosystem-sdks">SDKs</a> •
  <a href="#standalone-native-binaries-zero-node">Standalone Binaries</a>
</p>

---

## Why AtoZAPI?

FastAPI revolutionized the Python world with two core superpowers: **declarative runtime validation** and **instant interactive documentation at `/docs`**.

In other languages, developers are usually stuck maintaining brittle OpenAPI/Swagger YAML annotations, keeping JSDoc comments synchronized, or writing tedious input validation boilerplate.

**AtoZAPI eliminates that friction.** Write your routes with standard schemas or struct tags:
1. **Zero manual Swagger writing**: Your route code is the single source of truth.
2. **Unified HTTP 422 standard**: Every framework returns the exact Pydantic-style `{ detail: [...] }` response.
3. **Interactive documentation**: Embedded Swagger UI and ReDoc live at `http://localhost:8000/docs`.

---

## Before vs. After AtoZAPI

| Traditional Manual Boilerplate (Express) | With AtoZAPI |
| :--- | :--- |
| ```javascript<br>/**<br> * @swagger<br> * /api/users:<br> *   post:<br> *     summary: Create user<br> *     requestBody:<br> *       required: true<br> *       content: ... (30+ lines)<br> */<br>app.post('/api/users', (req, res) => {<br>  if (!req.body.name) return res.status(400)...<br>  if (req.body.name.length < 2) return ...<br>  if (!req.body.age) return res.status(400)...<br>  if (req.body.age < 18) return res.status(400)...<br>  // 25 lines of repetitive checks<br>});<br>``` | ```javascript<br>const schema = {<br>  name: { type: 'string', required: true, minLength: 2 },<br>  age: { type: 'number', required: true, min: 18 }<br>};<br><br>app.post('/api/users', atozapi(schema), (req, res) => {<br>  // 1. Automatic HTTP 422 on invalid input<br>  // 2. Typed, verified data on req.validatedBody<br>  // 3. Auto-generated /docs interactive Swagger UI<br>  res.status(201).json(req.validatedBody);<br>});<br>``` |

---

## Quickstart in 60 Seconds

Run the AtoZAPI scanner anywhere to discover routes, generate `openapi.json`, and host the Swagger UI server:

```bash
# Instant execution with npx
npx @atozapi/cli

# Or install globally
npm install -g @atozapi/cli
atozapi
```

Output:
```text
[atozapi] Scanning /path/to/project
[atozapi] Discovered 4 route(s):
  POST   /api/users           (express) -> server.js
  POST   /api/products        (nextjs)  -> app/api/products/route.js
  POST   /api/v1/orders       (gin)     -> main.go
  POST   /api/v1/checkout     (laravel) -> app/Http/Controllers/CheckoutController.php
[atozapi] Saved OpenAPI specification to openapi.json
[atozapi] Server running on http://localhost:8000
[atozapi] Docs:     http://localhost:8000/docs
[atozapi] ReDoc:    http://localhost:8000/redoc
[atozapi] Spec:     http://localhost:8000/openapi.json
```

---

## Integrating Into an Existing Project

AtoZAPI is non-invasive and supports **incremental, route-by-route adoption**:

1. **Non-Breaking**: Existing unannotated routes in your project remain 100% untouched.
2. **Step 1**: Install the SDK matching your backend (`npm install @atozapi/express`, `composer require atozapi/laravel`, or `go get ...`).
3. **Step 2**: Add `atozapi(schema)` or `ginatozapi.Guard(...)` to one route to replace manual `if (!req.body.name)` checks.
4. **Step 3**: Access validated, typed inputs directly on `req.validatedBody` or `ginatozapi.Body[T](c)`. Invalid requests automatically receive standard FastAPI-style HTTP 422 errors.
5. **Step 4**: Run `npx @atozapi/cli` in your project root to auto-generate `openapi.json` and view your live Swagger UI.

---

## Schema Reference & Rules

AtoZAPI supports declarative validation constraints across all primitive and complex types:

| Property | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| `type` | `string` | Target type (`string`, `number`, `integer`, `boolean`, `array`, `object`) | `{ type: 'string' }` |
| `required` | `boolean` | Whether field is mandatory (default: `true`) | `{ required: true }` |
| `optional` | `boolean` | Skip validation if omitted | `{ optional: true }` |
| `minLength` / `maxLength` | `number` | String length constraints | `{ minLength: 2, maxLength: 50 }` |
| `min` / `max` | `number` | Numeric bounds (inclusive) | `{ min: 18, max: 120 }` |
| `pattern` | `string` | Regex pattern matching | `{ pattern: '^[A-Z0-9]+$' }` |
| `format` | `string` | Semantic string format | `{ format: 'email' }` |
| `items` | `object` | Schema for array elements | `{ items: { type: 'string' } }` |
| `properties` | `object` | Sub-schema for nested objects | `{ properties: { city: { type: 'string' } } }` |
| `description` | `string` | Documentation text for Swagger UI | `{ description: 'User primary email' }` |

👉 *For full details and examples, visit the [Schema Reference Documentation](https://dhirajparihar.github.io/AtoZAPI/schema-reference).*

---

## Polyglot Ecosystem SDKs

### 1. Express (Node.js)
```bash
npm install @atozapi/express
```
```javascript
const express = require('express');
const { atozapi } = require('@atozapi/express');

const app = express();
app.use(express.json());

const schema = {
  name: { type: 'string', required: true, minLength: 2 },
  age: { type: 'number', required: true, min: 18 }
};

app.post('/api/users', atozapi(schema), (req, res) => {
  res.status(201).json({ user: req.validatedBody });
});
```

### 2. Next.js App Router
```bash
npm install @atozapi/nextjs
```
```javascript
// app/api/users/route.js
import { nextAtozapi } from '@atozapi/nextjs';
import { NextResponse } from 'next/server';

const schema = {
  email: { type: 'string', required: true, pattern: '^[^@]+@[^@]+\\.[^@]+$' },
  age: { type: 'number', required: true, min: 18 }
};

export const POST = nextAtozapi({
  schema,
  handler: async (req, { validatedBody }) => {
    return NextResponse.json({ success: true, user: validatedBody }, { status: 201 });
  }
});
```

### 3. Go (Gin)
```bash
go get github.com/dhirajparihar/AtoZAPI/sdk-go/gin@v1.0.0
```
```go
package main

import (
    "net/http"
    ginatozapi "github.com/dhirajparihar/AtoZAPI/sdk-go/gin"
    "github.com/gin-gonic/gin"
)

type CreateUserRequest struct {
    Name string `json:"name" binding:"required,min=2"`
    Age  int    `json:"age"  binding:"required,gte=18"`
}

func main() {
    r := gin.Default()

    r.POST("/api/users", ginatozapi.Guard(CreateUserRequest{}), func(c *gin.Context) {
        user, _ := ginatozapi.Body[CreateUserRequest](c)
        c.JSON(http.StatusCreated, gin.H{"user": user})
    })

    r.Run(":8080")
}
```

### 4. PHP (Laravel)
```bash
composer require atozapi/laravel
```
```php
namespace App\Http\Controllers;

use Atozapi\Laravel\Attributes\Post;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class UserController
{
    #[Post(
        path: '/api/users',
        summary: 'Create user',
        rules: [
            'name' => 'required|string|min:2',
            'age'  => 'required|integer|min:18'
        ]
    )]
    public function store(Request $request): JsonResponse
    {
        $user = $request->attributes->get('validatedBody');
        return response()->json(['user' => $user], 201);
    }
}
```

---

## HTTP 422 Error Parity

When validation fails, all AtoZAPI SDKs intercept the request and return the exact Pydantic/FastAPI error format:

```json
{
  "detail": [
    {
      "loc": ["body", "age"],
      "msg": "Input should be greater than or equal to 18",
      "type": "greater_than_equal",
      "ctx": { "ge": 18 }
    },
    {
      "loc": ["body", "email"],
      "msg": "Input should be a valid email address",
      "type": "value_error.email"
    }
  ]
}
```

---

## Standalone Native Binaries (Zero-Node)

For Go and PHP developers who prefer not to install Node.js or `npm`, single-file standalone native executables are provided for every release:

| Platform | Binary Asset |
| :--- | :--- |
| **Windows (x64)** | `atozapi-win-x64.exe` |
| **Linux (x64)** | `atozapi-linux-x64` |
| **macOS (x64)** | `atozapi-macos-x64` |

Download them directly from the **[GitHub Releases](https://github.com/dhirajparihar/AtoZAPI/releases)** page:

```bash
# Linux / macOS:
curl -LO https://github.com/dhirajparihar/AtoZAPI/releases/latest/download/atozapi-linux-x64
chmod +x atozapi-linux-x64
./atozapi-linux-x64 serve --port 8000

# Windows (PowerShell):
Invoke-WebRequest -Uri "https://github.com/dhirajparihar/AtoZAPI/releases/latest/download/atozapi-win-x64.exe" -OutFile "atozapi.exe"
.\atozapi.exe serve
```

---

## CLI Options

```text
atozapi [command] [options]

Commands:
  serve       Scan codebase, compile openapi.json, and launch docs server (default)
  generate    Scan codebase and compile openapi.json file only (ideal for CI/CD)

Options:
  -p, --port <number>   Docs server port (default: 8000)
  -d, --dir <path>      Directory to scan for route handlers (default: .)
  -o, --out <path>      Path to output openapi.json (default: ./openapi.json)
```

---

## Documentation

Full guides, configuration details, and language SDK references are available on our documentation platform:
👉 **[https://dhirajparihar.github.io/AtoZAPI/](https://dhirajparihar.github.io/AtoZAPI/)**

---

## License

[MIT](LICENSE) © AtoZAPI Authors
