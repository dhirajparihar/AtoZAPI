# @atozapi/nextjs

> FastAPI-style request validation and OpenAPI metadata wrapper for Next.js App Router route handlers.

[![npm version](https://img.shields.io/npm/v/@atozapi/nextjs.svg?style=flat-square&color=2563EB)](https://www.npmjs.com/package/@atozapi/nextjs)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)

---

## ⚡ Overview

`@atozapi/nextjs` brings the developer experience of **FastAPI** to **Next.js App Router** (`app/api/**/route.js|ts`):

- 🛡️ **Declarative Schema Validation**: Enforce required fields, string constraints, numbers, and regex patterns.
- 🚫 **FastAPI-Standard 422 Errors**: Standardized RFC-compliant error payloads (`detail: [{ loc, msg, type }]`).
- ⚡ **Native Web Request Support**: Compatible with native Web standard `Request` and `Response` streams.
- 📖 **Zero-Code OpenAPI Extraction**: Exposes route metadata for automatic scanning by `@atozapi/cli`.

---

## 📦 Installation

```bash
npm install @atozapi/nextjs
```

---

## 🚀 Quick Start

In your Next.js route handler (e.g. `app/api/users/route.js`):

```javascript
import { NextResponse } from 'next/server';
import { nextAtozapi } from '@atozapi/nextjs';

const UserCreateSchema = {
  username: { type: 'string', minLength: 3, maxLength: 30 },
  email: { type: 'string', pattern: '^[^@]+@[^@]+\\.[^@]+$' },
  age: { type: 'integer', minimum: 18, optional: true }
};

export const POST = nextAtozapi(UserCreateSchema, async (req, { validatedBody }) => {
  // validatedBody is strictly typed, validated, and sanitized
  return NextResponse.json({
    status: 'success',
    user: validatedBody
  }, { status: 201 });
});
```

### Automatic 422 Error Response

When invalid or missing data is sent, `@atozapi/nextjs` immediately responds with HTTP 422:

```json
{
  "detail": [
    {
      "loc": ["body", "username"],
      "msg": "String should have at least 3 characters",
      "type": "string_too_short",
      "ctx": { "min_length": 3 }
    },
    {
      "loc": ["body", "email"],
      "msg": "Field required",
      "type": "missing"
    }
  ]
}
```

---

## 📚 OpenAPI Documentation

Use the `@atozapi/cli` scanner to automatically inspect your Next.js routes and serve interactive Swagger UI docs:

```bash
npx @atozapi/cli serve
```

---

## 📄 License

MIT © [AtoZAPI Maintainers](https://github.com/dhirajparihar/AtoZAPI)
