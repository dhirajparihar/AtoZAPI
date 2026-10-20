/**
 * Fastapify Express Example App
 * Demonstrates FastAPI-like automatic request validation and 422 responses in Express.
 */

const http = require('http');
const { fastapify } = require('../../sdk-js/express');

// Helper to allow running with real Express if installed, or built-in zero-dependency mini-Express engine
function createServerApp() {
  try {
    const express = require('express');
    const app = express();
    app.use(express.json());
    return { app, isRealExpress: true };
  } catch (_) {
    // Zero-dependency Express-compatible micro-engine for out-of-the-box instant execution
    const routes = [];
    const middlewares = [];

    const app = {
      use(fn) {
        middlewares.push(fn);
      },
      post(path, ...handlers) {
        routes.push({ method: 'POST', path, handlers });
      },
      get(path, ...handlers) {
        routes.push({ method: 'GET', path, handlers });
      },
      listen(port, callback) {
        const server = http.createServer(async (req, res) => {
          // Response JSON helper
          res.status = function(code) {
            res.statusCode = code;
            return res;
          };
          res.json = function(data) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(data, null, 2));
          };

          // Parse incoming JSON body
          let body = '';
          for await (const chunk of req) {
            body += chunk;
          }
          try {
            req.body = body ? JSON.parse(body) : {};
          } catch (e) {
            req.body = {};
          }

          // Route matching
          const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
          const route = routes.find(r => r.method === req.method && r.path === url.pathname);

          if (!route) {
            res.status(404).json({ error: 'Not Found' });
            return;
          }

          // Pipeline runner
          let idx = 0;
          const pipeline = [...middlewares, ...route.handlers];
          function next() {
            if (idx < pipeline.length) {
              const handler = pipeline[idx++];
              handler(req, res, next);
            }
          }
          next();
        });

        server.listen(port, callback);
        return server;
      }
    };

    return { app, isRealExpress: false };
  }
}

const { app } = createServerApp();

// Define user creation validation schema with mandatory 'name' and number constraint checks for 'age'
const userRegistrationSchema = {
  name: {
    type: 'string',
    required: true,
    minLength: 2,
    description: 'Full legal name of the user'
  },
  age: {
    type: 'number',
    required: true,
    min: 18,
    max: 120,
    description: 'User age in full years (must be between 18 and 120)'
  }
};

// Logging middleware to demonstrate automated endpoint logging
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Incoming ${req.method} ${req.url}`);
  next();
});

// Root welcome route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Fastapify Express API',
    endpoints: {
      createUser: 'POST /api/users'
    },
    note: 'Run `npm run docs` in root to view the Swagger UI documentation.'
  });
});

app.post('/api/users', fastapify(userRegistrationSchema), (req, res) => {
  const { name, age } = req.validatedBody;
  res.status(201).json({
    id: Math.floor(Math.random() * 90000) + 10000,
    name,
    age,
    createdAt: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[express-app] Listening on http://localhost:${PORT}`);
});
