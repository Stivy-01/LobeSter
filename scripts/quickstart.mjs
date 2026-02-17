#!/usr/bin/env node

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

function parsePort(argv) {
  const idx = argv.indexOf("--port");
  if (idx === -1) return 3210;
  const raw = argv[idx + 1];
  if (!raw) {
    throw new Error("Missing value for --port");
  }
  const port = Number(raw);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid --port value: ${raw}`);
  }
  return port;
}

function assertNode20Plus() {
  const major = Number(process.versions.node.split(".")[0]);
  if (Number.isNaN(major) || major < 20) {
    throw new Error(
      `Node.js 20+ is required. Current: ${process.versions.node}`,
    );
  }
}

function hasArg(args, name) {
  return args.includes(name);
}

async function run(command, args, opts = {}) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: opts.shell ?? false,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve(undefined);
        return;
      }
      reject(
        new Error(
          `Command failed (${code}): ${command} ${args.join(" ")}`,
        ),
      );
    });
  });
}

async function runPnpm(args) {
  const npmExecPath = process.env.npm_execpath;
  const execName = npmExecPath
    ? path.basename(npmExecPath).toLowerCase()
    : "";

  if (execName.includes("pnpm")) {
    await run(process.execPath, [npmExecPath, ...args]);
    return;
  }

  if (process.platform === "win32") {
    await run(process.env.ComSpec || "cmd.exe", [
      "/d",
      "/s",
      "/c",
      "pnpm",
      ...args,
    ]);
    return;
  }

  await run("pnpm", args);
}

async function exists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function mtimeMs(targetPath) {
  const stat = await fs.stat(targetPath);
  return stat.mtimeMs;
}

async function latestMtimeForPath(targetPath) {
  const stat = await fs.stat(targetPath);
  if (!stat.isDirectory()) {
    return stat.mtimeMs;
  }

  let latest = stat.mtimeMs;
  const entries = await fs.readdir(targetPath, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(targetPath, entry.name);
    const entryMtime = await latestMtimeForPath(entryPath);
    if (entryMtime > latest) {
      latest = entryMtime;
    }
  }
  return latest;
}

async function latestSourceMtime(paths) {
  let latest = 0;
  for (const sourcePath of paths) {
    if (!(await exists(sourcePath))) continue;
    const current = await latestMtimeForPath(sourcePath);
    if (current > latest) {
      latest = current;
    }
  }
  return latest;
}

async function earliestArtifactMtime(paths) {
  let earliest = Number.POSITIVE_INFINITY;
  for (const artifactPath of paths) {
    if (!(await exists(artifactPath))) {
      return 0;
    }
    const current = await mtimeMs(artifactPath);
    if (current < earliest) {
      earliest = current;
    }
  }
  return Number.isFinite(earliest) ? earliest : 0;
}

async function needsBuild(target) {
  const latestSource = await latestSourceMtime(target.sources);
  const earliestArtifact = await earliestArtifactMtime(target.artifacts);
  if (earliestArtifact === 0) {
    return true;
  }
  return latestSource > earliestArtifact;
}

async function needsInstall() {
  const lockfilePath = path.resolve("pnpm-lock.yaml");
  const modulesStampPath = path.resolve("node_modules/.modules.yaml");

  const hasNodeModules = await exists(path.resolve("node_modules"));
  if (!hasNodeModules) return true;

  const hasModulesStamp = await exists(modulesStampPath);
  if (!hasModulesStamp) return true;

  const hasLockfile = await exists(lockfilePath);
  if (!hasLockfile) return false;

  const lockMtime = await mtimeMs(lockfilePath);
  const modulesStampMtime = await mtimeMs(modulesStampPath);
  return lockMtime > modulesStampMtime;
}

async function buildTarget(target, forceBuild) {
  const stale = forceBuild || (await needsBuild(target));
  if (!stale) {
    console.log(`[quickstart] Skipping ${target.name} build (up-to-date)`);
    return;
  }

  console.log(`[quickstart] Building ${target.name}`);
  await runPnpm(["run", target.script]);
}

async function ensureConnectorBuild() {
  const cliPath = path.resolve("apps/connector/dist/cli.js");
  if (await exists(cliPath)) return;

  throw new Error(
    "Connector build output missing at apps/connector/dist/cli.js. Run `pnpm quickstart:cold`.",
  );
}

async function ensureBaseOpenClawConfig() {
  const openclawDir = path.join(os.homedir(), ".openclaw");
  const openclawPath = path.join(openclawDir, "openclaw.json");

  await fs.mkdir(openclawDir, { recursive: true });

  try {
    await fs.access(openclawPath);
    console.log(`[quickstart] Found existing ${openclawPath}`);
    return;
  } catch {
    // File does not exist, create a minimal base config.
  }

  const minimal = {
    skills: {
      entries: {},
    },
  };
  await fs.writeFile(
    openclawPath,
    `${JSON.stringify(minimal, null, 2)}\n`,
    "utf8",
  );
  console.log(`[quickstart] Created ${openclawPath}`);
}

async function main() {
  assertNode20Plus();

  const argv = process.argv.slice(2);
  const skipInstall = hasArg(argv, "--skip-install");
  const skipBuild = hasArg(argv, "--skip-build");
  const forceInstall = hasArg(argv, "--force-install");
  const forceBuild = hasArg(argv, "--force-build");
  const noStart = hasArg(argv, "--no-start");
  const port = parsePort(argv);

  const localBuildTargets = [
    {
      name: "shared",
      script: "build:shared",
      sources: [
        path.resolve("packages/shared/src"),
        path.resolve("packages/shared/tsconfig.json"),
        path.resolve("packages/shared/package.json"),
      ],
      artifacts: [
        path.resolve("packages/shared/dist/types.js"),
        path.resolve("packages/shared/dist/types.d.ts"),
      ],
    },
    {
      name: "ui",
      script: "build:ui",
      sources: [
        path.resolve("apps/ui/src"),
        path.resolve("apps/ui/public"),
        path.resolve("apps/ui/next.config.ts"),
        path.resolve("apps/ui/package.json"),
      ],
      artifacts: [path.resolve("apps/ui/out/index.html")],
    },
    {
      name: "connector",
      script: "build:connector",
      sources: [
        path.resolve("apps/connector/src"),
        path.resolve("apps/connector/tsconfig.json"),
        path.resolve("apps/connector/package.json"),
      ],
      artifacts: [
        path.resolve("apps/connector/dist/cli.js"),
        path.resolve("apps/connector/dist/server.js"),
      ],
    },
  ];

  console.log("[quickstart] Checking pnpm");
  await runPnpm(["--version"]);

  if (skipInstall) {
    console.log("[quickstart] Skipping dependency install (--skip-install)");
  } else if (forceInstall || (await needsInstall())) {
    console.log("[quickstart] Installing dependencies");
    await runPnpm(["install"]);
  } else {
    console.log("[quickstart] Skipping dependency install (up-to-date)");
  }

  if (skipBuild) {
    console.log("[quickstart] Skipping build (--skip-build)");
  } else {
    for (const target of localBuildTargets) {
      await buildTarget(target, forceBuild);
    }
  }

  await ensureConnectorBuild();
  await ensureBaseOpenClawConfig();

  console.log("[quickstart] Initializing connector state");
  await run(process.execPath, ["apps/connector/dist/cli.js", "init"]);

  if (noStart) {
    console.log("[quickstart] Setup complete (--no-start).");
    return;
  }

  console.log(
    `[quickstart] Starting LobeSter on http://localhost:${port}`,
  );
  await run(process.execPath, [
    "apps/connector/dist/cli.js",
    "start",
    "--port",
    String(port),
  ]);
}

main().catch((error) => {
  console.error(`[quickstart] ${error.message}`);
  process.exit(1);
});
