import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const PORT = 4321;
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(`${BASE_URL}/api/license/status`);
      if (res.ok) return;
    } catch {
      // server not ready yet
    }
    await sleep(500);
  }
  throw new Error("Connector server did not start in time");
}

async function post(pathname, payload) {
  const res = await fetch(`${BASE_URL}${pathname}`, {
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

async function main() {
  const cliPath = path.resolve("dist/cli.js");
  await fs.access(cliPath);

  const tmpRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "lobester-smoke-"),
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
    path.join(skillSourceDir, "lobester.json"),
    JSON.stringify(
      {
        name: "Smoke Skill",
        openclawKey: "smoke_skill",
      },
      null,
      2,
    ),
    "utf8",
  );

  const child = spawn(
    process.execPath,
    [cliPath, "start", "--port", String(PORT)],
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
    await waitForServer();

    const install = await post("/api/skills/install", {
      source: { kind: "local", ref: skillSourceDir },
    });

    const preset = await post("/api/presets", {
      name: "smoke",
      skillIds: [install.skill.id],
    });

    const apply = await post("/api/openclaw/applyPreset", {
      presetRef: preset.preset.id,
    });

    await fs.access(apply.generatedConfigPath);
    await fs.access(apply.overlayPath);

    console.log("Smoke apply succeeded.");
  } finally {
    child.kill("SIGTERM");
    await fs.rm(tmpRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});


