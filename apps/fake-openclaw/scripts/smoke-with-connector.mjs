import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const CONNECTOR_PORT = 4331;
const CONNECTOR_BASE_URL = `http://127.0.0.1:${CONNECTOR_PORT}`;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");
const connectorCliPath = path.join(
  repoRoot,
  "apps",
  "connector",
  "dist",
  "cli.js",
);
const fakeCliPath = path.join(
  repoRoot,
  "apps",
  "fake-openclaw",
  "src",
  "cli.mjs",
);

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForConnector() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(
        `${CONNECTOR_BASE_URL}/api/license/status`,
      );
      if (res.ok) return;
    } catch {
      // still booting
    }
    await sleep(500);
  }
  throw new Error("Connector did not start in time");
}

async function post(pathname, payload) {
  const res = await fetch(`${CONNECTOR_BASE_URL}${pathname}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`${pathname} failed (${res.status}): ${body}`);
  }
  return JSON.parse(body);
}

async function runFakeValidator(configPath) {
  const child = spawn(
    process.execPath,
    [fakeCliPath, "validate", "--config", configPath, "--json"],
    { stdio: "pipe" },
  );

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString("utf8");
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString("utf8");
  });

  const exitCode = await new Promise((resolve) => {
    child.on("close", resolve);
  });

  if (exitCode !== 0) {
    throw new Error(
      `Fake validator failed with exit code ${exitCode}: ${stderr || stdout}`,
    );
  }

  const parsed = JSON.parse(stdout);
  if (!parsed.ok) {
    throw new Error(`Fake validation returned not ok: ${stdout}`);
  }
}

async function main() {
  await fs.access(connectorCliPath);
  await fs.access(fakeCliPath);

  const tmpRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "fake-openclaw-smoke-"),
  );
  const lobesterHome = path.join(tmpRoot, ".lobester");
  const baseConfigPath = path.join(tmpRoot, "openclaw-base.json");
  const skillSourceDir = path.join(tmpRoot, "demo-skill");

  await fs.writeFile(
    baseConfigPath,
    JSON.stringify({ skills: { entries: {} } }, null, 2),
    "utf8",
  );
  await fs.mkdir(skillSourceDir, { recursive: true });
  await fs.writeFile(
    path.join(skillSourceDir, "SKILL.md"),
    [
      "---",
      "name: fake-smoke-skill",
      "version: 0.0.1",
      "---",
      "",
      "# Fake smoke skill",
      "",
    ].join("\n"),
    "utf8",
  );

  const connector = spawn(
    process.execPath,
    [connectorCliPath, "start", "--port", String(CONNECTOR_PORT)],
    {
      env: {
        ...process.env,
        LOBESTER_HOME: lobesterHome,
        OPENCLAW_CONFIG_PATH: baseConfigPath,
      },
      stdio: "inherit",
    },
  );

  try {
    await waitForConnector();

    const install = await post("/api/skills/install", {
      source: { kind: "local", ref: skillSourceDir },
    });
    const preset = await post("/api/presets", {
      name: "fake-smoke",
      skillIds: [install.skill.id],
    });
    const apply = await post("/api/openclaw/applyPreset", {
      presetRef: preset.preset.id,
    });

    await fs.access(apply.generatedConfigPath);
    await runFakeValidator(apply.generatedConfigPath);

    console.log("FakeOpenClaw smoke succeeded.");
  } finally {
    connector.kill("SIGTERM");
    await fs.rm(tmpRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
