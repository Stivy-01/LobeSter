import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";

test("connector routes support local install -> preset -> apply", async () => {
  const tmpRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "lobester-routes-test-"),
  );
  process.env.LOBESTER_HOME = path.join(tmpRoot, ".lobester");
  process.env.OPENCLAW_CONFIG_PATH = path.join(
    tmpRoot,
    "openclaw-base.json",
  );

  await fs.writeFile(
    process.env.OPENCLAW_CONFIG_PATH,
    JSON.stringify({ skills: { entries: {} } }, null, 2),
    "utf8",
  );

  const skillSourceDir = path.join(tmpRoot, "demo-skill");
  await fs.mkdir(skillSourceDir, { recursive: true });
  await fs.writeFile(
    path.join(skillSourceDir, "lobester.json"),
    JSON.stringify(
      {
        name: "Demo Skill",
        openclawKey: "demo_skill",
        version: "0.0.1",
      },
      null,
      2,
    ),
    "utf8",
  );

  const { buildApp } = await import("./server.js");
  const app = await buildApp({ serveStaticUi: false });

  try {
    const installRes = await app.inject({
      method: "POST",
      url: "/api/skills/install",
      payload: {
        source: { kind: "local", ref: skillSourceDir },
      },
    });
    assert.equal(installRes.statusCode, 200);
    const installJson = installRes.json() as {
      ok: true;
      skill: { id: string };
    };

    const presetRes = await app.inject({
      method: "POST",
      url: "/api/presets",
      payload: {
        name: "default",
        skillIds: [installJson.skill.id],
      },
    });
    assert.equal(presetRes.statusCode, 200);

    const presetJson = presetRes.json() as {
      ok: true;
      preset: { id: string };
    };

    const applyRes = await app.inject({
      method: "POST",
      url: "/api/openclaw/applyPreset",
      payload: { presetRef: presetJson.preset.id },
    });

    assert.equal(applyRes.statusCode, 200);
    const applyJson = applyRes.json() as {
      ok: true;
      generatedConfigPath: string;
      overlayPath: string;
    };

    await fs.access(applyJson.generatedConfigPath);
    await fs.access(applyJson.overlayPath);
  } finally {
    await app.close();
    await fs.rm(tmpRoot, { recursive: true, force: true });
  }
});

test("connector routes accept quoted absolute local path on install", async () => {
  const tmpRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "lobester-routes-test-"),
  );
  process.env.LOBESTER_HOME = path.join(tmpRoot, ".lobester");
  process.env.OPENCLAW_CONFIG_PATH = path.join(
    tmpRoot,
    "openclaw-base.json",
  );

  await fs.writeFile(
    process.env.OPENCLAW_CONFIG_PATH,
    JSON.stringify({ skills: { entries: {} } }, null, 2),
    "utf8",
  );

  const skillSourceDir = path.join(tmpRoot, "demo-skill");
  await fs.mkdir(skillSourceDir, { recursive: true });
  await fs.writeFile(
    path.join(skillSourceDir, "lobester.json"),
    JSON.stringify(
      {
        name: "Quoted Path Skill",
        openclawKey: "quoted_path_skill",
        version: "0.0.1",
      },
      null,
      2,
    ),
    "utf8",
  );

  const quotedRef = `"${skillSourceDir}"`;
  const { buildApp } = await import("./server.js");
  const app = await buildApp({ serveStaticUi: false });

  try {
    const installRes = await app.inject({
      method: "POST",
      url: "/api/skills/install",
      payload: {
        source: { kind: "local", ref: quotedRef },
      },
    });
    assert.equal(installRes.statusCode, 200);
    const installJson = installRes.json() as {
      ok: true;
      skill: { source: { ref: string } };
    };
    assert.equal(installJson.skill.source.ref, skillSourceDir);
  } finally {
    await app.close();
    await fs.rm(tmpRoot, { recursive: true, force: true });
  }
});

test("connector routes support local batch install with duplicate skip", async () => {
  const tmpRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "lobester-routes-test-"),
  );
  process.env.LOBESTER_HOME = path.join(tmpRoot, ".lobester");
  process.env.OPENCLAW_CONFIG_PATH = path.join(
    tmpRoot,
    "openclaw-base.json",
  );

  await fs.writeFile(
    process.env.OPENCLAW_CONFIG_PATH,
    JSON.stringify({ skills: { entries: {} } }, null, 2),
    "utf8",
  );

  const bundleRoot = path.join(tmpRoot, "bundle");
  const firstSkillDir = path.join(bundleRoot, "first-skill");
  const secondSkillDir = path.join(bundleRoot, "second-skill");
  await fs.mkdir(firstSkillDir, { recursive: true });
  await fs.mkdir(secondSkillDir, { recursive: true });

  await fs.writeFile(
    path.join(firstSkillDir, "SKILL.md"),
    "# First skill",
    "utf8",
  );
  await fs.writeFile(
    path.join(secondSkillDir, "SKILL.md"),
    "# Second skill",
    "utf8",
  );

  const { buildApp } = await import("./server.js");
  const app = await buildApp({ serveStaticUi: false });

  try {
    const firstBatchRes = await app.inject({
      method: "POST",
      url: "/api/skills/install-local-batch",
      payload: { rootPath: bundleRoot },
    });
    assert.equal(firstBatchRes.statusCode, 200);
    const firstBatchJson = firstBatchRes.json() as {
      ok: true;
      results: Array<{ status: string }>;
    };
    assert.equal(firstBatchJson.results.length, 2);
    assert.equal(
      firstBatchJson.results.filter(
        (result) => result.status === "installed",
      ).length,
      2,
    );

    const secondBatchRes = await app.inject({
      method: "POST",
      url: "/api/skills/install-local-batch",
      payload: { rootPath: bundleRoot },
    });
    assert.equal(secondBatchRes.statusCode, 200);
    const secondBatchJson = secondBatchRes.json() as {
      ok: true;
      results: Array<{ status: string }>;
    };
    assert.equal(secondBatchJson.results.length, 2);
    assert.equal(
      secondBatchJson.results.filter(
        (result) => result.status === "skipped",
      ).length,
      2,
    );
  } finally {
    await app.close();
    await fs.rm(tmpRoot, { recursive: true, force: true });
  }
});


