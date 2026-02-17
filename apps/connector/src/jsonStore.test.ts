import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { JsonCollectionStore } from "./services/jsonStore.js";

test("JsonCollectionStore persists versioned atomic collection", async () => {
  const tmpRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "lobester-store-test-"),
  );
  const filePath = path.join(tmpRoot, "state", "skills.json");

  const store = new JsonCollectionStore<{ id: string; name: string }>(
    filePath,
  );

  await store.ensure();
  await store.upsert({ id: "a", name: "Skill A" });
  const rows = await store.readAll();

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.name, "Skill A");

  const raw = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as {
    version: number;
    items: Array<{ id: string }>;
  };

  assert.equal(parsed.version, 1);
  assert.equal(parsed.items.length, 1);

  await fs.rm(tmpRoot, { recursive: true, force: true });
});


