# @atozapi/express

> FastAPI-style request validation middleware and OpenAPI metadata collector for Express.js.

[![npm version](https://img.shields.io/npm/v/@atozapi/express.svg?style=flat-square&color=2563EB)](https://www.npmjs.com/package/@atozapi/express)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)

---

## ⚡ Overview

`@atozapi/express` brings the declarative, type-checked experience of **FastAPI** to Express:

- 🛡️ **Pydantic-style Validation**: Automatic type casting, string constraints, and numeric ranges.
- 🚫 **FastAPI-Standard 422 Errors**: Standardized RFC-compliant error payloads (`detail: [{ loc, msg, type }]`).
- 📖 **Zero-Code OpenAPI Extraction**: Exposes route metadata for automatic scanning by `@atozapi/cli`.

---

## 📦 Installation

```bash
npm install @atozapi/express
```

---

## 🚀 Quick Start

```javascript
const express = require('express');
const { atozapi } = require('@atozapi/express');

const app = express();
app.use(express.json());

// Define validation schema
const CreateUserSchema = {
  username: { type: 'string', minLength: 3, maxLength: 20 },
  email: { type: 'string', pattern: '^[^@]+@[^@]+\\.[^@]+$' },
  age: { type: 'integer', minimum: 18, optional: true }
};

// Apply atozapi middleware
app.post('/api/users', atozapi(CreateUserSchema), (req, res) => {
  // req.validatedBody is pre-validated, sanitized, and type-coerced
  const { username, email, age } = req.validatedBody;
  
  res.status(201).json({
    id: 1,
    username,
    email,
    age
  });
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

### Automatic 422 Error Response

When invalid or missing data is sent, `@atozapi/express` immediately responds with HTTP 422:

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

Use the `@atozapi/cli` scanner to instantly produce interactive Swagger UI and ReDoc docs:

```bash
npx @atozapi/cli serve
```

---

## 📄 License

MIT © [AtoZAPI Maintainers](https://github.com/dhirajparihar/AtoZAPI)
