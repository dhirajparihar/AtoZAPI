# @atozapi/cli

> Automatic OpenAPI 3.0.3 generation & modern Swagger UI / ReDoc interactive documentation server for polyglot backends (Express, Next.js, Gin, Laravel).

[![npm version](https://img.shields.io/npm/v/@atozapi/cli.svg?style=flat-square&color=2563EB)](https://www.npmjs.com/package/@atozapi/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)

---

## ⚡ What is AtoZAPI CLI?

`@atozapi/cli` gives you the developer experience of **FastAPI** in any framework or polyglot workspace. It statically inspects your route handlers and request schemas, automatically compiles a compliant **OpenAPI 3.0.3 specification**, and serves an interactive, branded documentation platform featuring:

- 🎨 **Swagger UI & ReDoc Documentation** out of the box
- ⚡ **Zero Setup**: Auto-detects Express, Next.js App Router, Go (Gin), and PHP (Laravel)
- 🔄 **Hot-Reloading Watch Mode**: Automatically recompiles specs as you edit handlers
- 🧪 **Interactive Testing Console**: Test your endpoints directly from your browser

---

## 📦 Installation

Run instantly with `npx`:

```bash
npx @atozapi/cli serve
```

Or install globally:

```bash
npm install -g @atozapi/cli
```

---

## 🚀 Usage

### 1. Serve Interactive Docs (`serve`)

Scans your workspace, compiles `openapi.json`, and launches the docs server at `http://localhost:8000`:

```bash
atozapi serve
```

Options:
- `-p, --port <port>`: Port to serve docs on (default: `8000`)
- `-w, --watch`: Watch project files and automatically regenerate OpenAPI specification on changes
- `--open`: Open docs in your default browser automatically

### 2. Export OpenAPI Spec (`generate`)

Compile and export your OpenAPI 3.0.3 specification directly to a JSON file:

```bash
atozapi generate --output ./openapi.json
```

Options:
- `-o, --output <file>`: Output path (default: `openapi.json`)
- `--pretty`: Format JSON with 2-space indentation

### 3. Initialize Configuration (`init`)

Scaffolds an `atozapi.config.json` file in your project root:

```bash
atozapi init
```

---

## 🌐 Supported Frameworks & SDKs

| Framework | SDK Package | Validation Engine |
| :--- | :--- | :--- |
| **Express** | [`@atozapi/express`](https://www.npmjs.com/package/@atozapi/express) | JSON Schema / Zod |
| **Next.js (App Router)** | [`@atozapi/nextjs`](https://www.npmjs.com/package/@atozapi/nextjs) | JSON Schema / Zod |
| **Go (Gin)** | `github.com/dhirajparihar/AtoZAPI/sdk-go/gin` | Go Struct Tags |
| **PHP (Laravel)** | `atozapi/laravel` | PHP 8+ Attributes |

---

## 📄 License

MIT © [AtoZAPI Maintainers](https://github.com/dhirajparihar/AtoZAPI)
