import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { registerLicenseRoutes } from "./routes/license.js";
import { registerPresetRoutes } from "./routes/presets.js";
import { registerSkillRoutes } from "./routes/skills.js";
import { registerOpenClawRoutes } from "./routes/openclaw.js";
import { registerRunRoutes } from "./routes/runs.js";
import { buildApiError } from "./services/apiError.js";
import { paths } from "./services/paths.js";
import { appendConnectorLog } from "./services/runtimeLogger.js";

export async function buildApp(opts?: { serveStaticUi?: boolean }) {
  await paths.ensureRuntimeDirs();

  const app = Fastify({ logger: true });

  app.addHook("onRequest", async (req) => {
    await appendConnectorLog("info", "request.start", {
      requestId: req.id,
      method: req.method,
      url: req.url,
    });
  });

  app.addHook("onResponse", async (req, reply) => {
    await appendConnectorLog("info", "request.end", {
      requestId: req.id,
      method: req.method,
      url: req.url,
      statusCode: reply.statusCode,
    });
  });

  app.setErrorHandler(async (error, req, reply) => {
    const err =
      error instanceof Error
        ? error
        : new Error("Unknown server error");

    await appendConnectorLog("error", "request.error", {
      requestId: req.id,
      method: req.method,
      url: req.url,
      message: err.message,
      stack: err.stack,
    });

    reply
      .code(500)
      .send(
        buildApiError(
          req,
          "internal_error",
          "Internal server error",
        ),
      );
  });

  // API routes
  await registerLicenseRoutes(app);
  await registerSkillRoutes(app);
  await registerPresetRoutes(app);
  await registerOpenClawRoutes(app);
  await registerRunRoutes(app);

  // Static UI
  let hasUi = false;
  if (opts?.serveStaticUi !== false) {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const uiOutDir = path.resolve(__dirname, "../../ui/out");
    hasUi = await fs
      .access(path.join(uiOutDir, "index.html"))
      .then(() => true)
      .catch(() => false);

    if (hasUi) {
      await app.register(fastifyStatic, {
        root: uiOutDir,
        prefix: "/",
        decorateReply: false,
      });
    } else {
      await appendConnectorLog("warn", "ui.out.missing", {
        uiOutDir,
      });
    }
  }

  // SPA fallback: serve index.html for unknown non-API routes
  app.setNotFoundHandler(async (req, reply) => {
    if (req.url.startsWith("/api/")) {
      reply
        .code(404)
        .send(
          buildApiError(
            req,
            "not_found",
            "API route not found",
          ),
        );
      return;
    }
    if (!hasUi) {
      reply
        .code(503)
        .type("text/plain")
        .send(
          "Local UI build is missing. Run `pnpm --filter @lobester/ui build`.",
        );
      return;
    }
    reply.type("text/html").sendFile("index.html");
  });

  return app;
}

export async function startServer(opts: { port: number }) {
  const app = await buildApp({ serveStaticUi: true });
  await app.listen({ port: opts.port, host: "127.0.0.1" });
  app.log.info(`LobeSter running on http://localhost:${opts.port}`);
  await appendConnectorLog("info", "server.started", {
    port: opts.port,
    url: `http://localhost:${opts.port}`,
  });
}

