import test from "node:test";
import assert from "node:assert/strict";
import { MergeEngine } from "./services/mergeEngine.js";

test("MergeEngine keeps existing entries and reports conflicts", () => {
  const engine = new MergeEngine();
  const result = engine.build({
    baseConfig: {
      skills: {
        entries: {
          alpha: { enabled: true, path: "/existing" },
        },
      },
    },
    skills: [
      {
        id: "1",
        name: "Alpha",
        openclawKey: "alpha",
        localPath: "/managed/alpha",
        source: { kind: "local", ref: "/src/alpha" },
        installedAt: new Date().toISOString(),
      },
      {
        id: "2",
        name: "Beta",
        openclawKey: "beta",
        localPath: "/managed/beta",
        source: { kind: "local", ref: "/src/beta" },
        installedAt: new Date().toISOString(),
      },
    ],
    managedSkillsDir: "/managed",
  });

  const entries = (
    result.generatedConfig.skills as { entries: Record<string, unknown> }
  ).entries;

  assert.equal(Object.prototype.hasOwnProperty.call(entries, "alpha"), true);
  assert.equal(Object.prototype.hasOwnProperty.call(entries, "beta"), true);
  assert.equal(result.conflicts.length, 1);
  assert.equal(result.conflicts[0]?.key, "alpha");
});
