import http from "node:http";
import { URL } from "node:url";
import { validateOpenClawConfig } from "./validator.mjs";

function printHelp() {
  console.log("FakeOpenClaw");
  console.log("");
  console.log("Commands:");
  console.log("  validate [--config <path>] [--strict-env] [--json]");
  console.log(
    "  start [--port <port>] [--config <path>] [--strict-env]",
  );
  console.log("");
  console.log(
    "Defaults to OPENCLAW_CONFIG_PATH when --config is omitted.",
  );
}

function parseArgs(argv) {
  const args = [...argv];
  const command = args.shift();
  const options = {
    json: false,
    strictEnv: false,
    configPath: undefined,
    port: 8787,
    help: false,
  };

  while (args.length > 0) {
    const token = args.shift();
    if (token === "--json") {
      options.json = true;
      continue;
    }
    if (token === "--help") {
      options.help = true;
      continue;
    }
    if (token === "--strict-env") {
      options.strictEnv = true;
      continue;
    }
    if (token === "--config") {
      options.configPath = args.shift();
      continue;
    }
    if (token === "--port") {
      const value = Number(args.shift());
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error("Invalid --port value");
      }
      options.port = value;
      continue;
    }
    throw new Error(`Unknown arg: ${token}`);
  }

  return { command, options };
}

function printValidationResult(result) {
  const status = result.ok ? "PASS" : "FAIL";
  console.log(`FakeOpenClaw validate: ${status}`);
  console.log(`Config: ${result.configPath}`);
  console.log(`Entries: ${result.skillEntryCount}`);
  console.log(`Errors: ${result.errorCount}`);
  console.log(`Warnings: ${result.warningCount}`);
  if (result.issues.length === 0) return;

  console.log("");
  for (const issue of result.issues) {
    const parts = [
      `[${issue.severity}]`,
      issue.code,
      issue.key ? `key=${issue.key}` : null,
      issue.path ? `path=${issue.path}` : null,
      issue.envVar ? `env=${issue.envVar}` : null,
      `message=${issue.message}`,
    ].filter(Boolean);
    console.log(parts.join(" "));
  }
}

async function handleValidate(options) {
  const result = await validateOpenClawConfig({
    configPath: options.configPath,
    strictEnv: options.strictEnv,
  });

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printValidationResult(result);
  }

  process.exitCode = result.ok ? 0 : 1;
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      resolve(body);
    });
    req.on("error", reject);
  });
}

async function handleStart(options) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", "http://localhost");
    const writeJson = (statusCode, payload) => {
      res.statusCode = statusCode;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(payload));
    };

    if (req.method === "GET" && url.pathname === "/health") {
      writeJson(200, {
        ok: true,
        service: "fake-openclaw",
        now: new Date().toISOString(),
      });
      return;
    }

    if (
      (req.method === "GET" || req.method === "POST") &&
      url.pathname === "/validate"
    ) {
      try {
        let body = {};
        if (req.method === "POST") {
          const raw = await readRequestBody(req);
          body = raw.trim().length > 0 ? JSON.parse(raw) : {};
        }

        const configPath = body.configPath ||
          url.searchParams.get("config") ||
          options.configPath;
        let strictEnv = Boolean(options.strictEnv);
        if (url.searchParams.has("strictEnv")) {
          strictEnv = url.searchParams.get("strictEnv") === "1";
        }
        if (typeof body.strictEnv === "boolean") {
          strictEnv = body.strictEnv;
        }

        const result = await validateOpenClawConfig({
          configPath,
          strictEnv,
        });
        writeJson(result.ok ? 200 : 422, result);
      } catch (error) {
        writeJson(400, {
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "Validation request failed",
        });
      }
      return;
    }

    writeJson(404, { ok: false, error: "Not found" });
  });

  await new Promise((resolve) => {
    server.listen(options.port, "127.0.0.1", resolve);
  });
  console.log(
    `FakeOpenClaw listening on http://127.0.0.1:${options.port}`,
  );
}

async function main() {
  try {
    const { command, options } = parseArgs(process.argv.slice(2));
    if (
      !command ||
      command === "help" ||
      command === "--help" ||
      options.help
    ) {
      printHelp();
      return;
    }
    if (command === "validate") {
      await handleValidate(options);
      return;
    }
    if (command === "start") {
      await handleStart(options);
      return;
    }

    throw new Error(`Unknown command: ${command}`);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    console.error(message);
    printHelp();
    process.exitCode = 1;
  }
}

main();
