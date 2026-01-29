import Fastify from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import multipart from "@fastify/multipart";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import { invoiceRoutes } from "./routes/invoice.routes.js";
import { userRoutes } from "./routes/user.routes.js";
import { documentRoutes } from "./routes/document.routes.js";
import { userDocumentRoutes } from "./routes/user-document.routes.js";
import { authRoutes } from "./routes/auth.routes.js";
import "dotenv/config";
import * as path from "path";
import * as fs from "fs";

// Load OpenAI API key from root .env if not already set
if (!process.env.OPENAI_API_KEY) {
  const rootEnvPath = path.resolve(process.cwd(), "..", ".env");
  if (fs.existsSync(rootEnvPath)) {
    const envContent = fs.readFileSync(rootEnvPath, "utf-8");
    const match = envContent.match(/OPENAI_API_KEY=(.+)/);
    if (match) {
      process.env.OPENAI_API_KEY = match[1].trim();
    }
  }
}

const app = Fastify({
  logger: true,
});

async function main() {
  // Register Swagger documentation
  await app.register(swagger, {
    openapi: {
      info: {
        title: "Invoice Extraction API",
        description:
          "Extract structured data from PDF invoices using AI-powered text and vision extraction",
        version: "1.0.0",
      },
      servers: [
        {
          url: "http://localhost:3000",
          description: "Development server",
        },
      ],
      tags: [
        {
          name: "auth",
          description: "Authentication endpoints",
        },
        {
          name: "invoices",
          description: "Invoice extraction endpoints",
        },
        {
          name: "users",
          description: "User management endpoints",
        },
        {
          name: "documents",
          description: "Document management endpoints",
        },
        {
          name: "user-documents",
          description: "User-Document assignment endpoints",
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
    },
  });

  // Register Swagger UI
  await app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
    },
  });

  // Register CORS
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    credentials: true,
  });

  // Register cookie plugin
  await app.register(cookie, {
    secret: process.env.COOKIE_SECRET || "your-cookie-secret-change-in-production",
  });

  // Register multipart for file uploads
  await app.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB max per file
      files: 10, // Max 10 files per request
    },
  });

  // Register auth routes
  await app.register(authRoutes, { prefix: "/api/v1" });

  // Register invoice routes
  await app.register(invoiceRoutes, { prefix: "/api/v1" });

  // Register user routes
  await app.register(userRoutes, { prefix: "/api/v1" });

  // Register document routes
  await app.register(documentRoutes, { prefix: "/api/v1" });

  // Register user-document routes
  await app.register(userDocumentRoutes, { prefix: "/api/v1" });

  // Health check endpoint
  app.get("/health", {
    schema: {
      summary: "Health check",
      description: "Check if the server is running",
      response: {
        200: {
          type: "object",
          properties: {
            status: { type: "string" },
            timestamp: { type: "string" },
          },
        },
      },
    },
    handler: async () => ({
      status: "ok",
      timestamp: new Date().toISOString(),
    }),
  });

  // Root endpoint
  app.get("/", async () => ({
    name: "Invoice Extraction API",
    version: "1.0.0",
    docs: "/docs",
    health: "/health",
    endpoints: {
      auth: {
        register: "POST /api/v1/auth/register",
        login: "POST /api/v1/auth/login",
        logout: "POST /api/v1/auth/logout",
        refresh: "POST /api/v1/auth/refresh",
        me: "GET /api/v1/auth/me",
      },
      invoices: {
        extract: "POST /api/v1/invoices/extract",
        schema: "GET /api/v1/invoices/schema",
      },
      users: {
        list: "GET /api/v1/users",
        get: "GET /api/v1/users/:id",
        create: "POST /api/v1/users",
        update: "PUT /api/v1/users/:id",
        delete: "DELETE /api/v1/users/:id",
      },
      documents: {
        list: "GET /api/v1/documents",
        get: "GET /api/v1/documents/:id",
        create: "POST /api/v1/documents",
        update: "PUT /api/v1/documents/:id",
        delete: "DELETE /api/v1/documents/:id",
      },
      userDocuments: {
        list: "GET /api/v1/user-documents",
        get: "GET /api/v1/user-documents/:id",
        create: "POST /api/v1/user-documents",
        update: "PUT /api/v1/user-documents/:id",
        delete: "DELETE /api/v1/user-documents/:id",
      },
    },
  }));

  // Start server
  const port = parseInt(process.env.PORT || "3000", 10);
  const host = process.env.HOST || "0.0.0.0";

  try {
    await app.listen({ port, host });
    console.log(`\n🚀 Server running at http://localhost:${port}`);
    console.log(`📚 Swagger docs at http://localhost:${port}/docs`);
    console.log(`\nEndpoints:`);
    console.log(`  POST /api/v1/invoices/extract - Upload PDFs for extraction`);
    console.log(`  GET  /api/v1/invoices/schema  - Get invoice JSON schema`);
    console.log(`  GET  /health                  - Health check\n`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
