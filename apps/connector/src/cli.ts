import fs from "node:fs/promises";
import { Command } from "commander";
import { startServer } from "./server.js";
import { paths } from "./services/paths.js";
import { SkillStore } from "./services/skillStore.js";
import { PresetStore } from "./services/presetStore.js";
import { RunStore } from "./services/runStore.js";
import { writeFileAtomic } from "./services/jsonStore.js";
import { ApplyService } from "./services/applyService.js";
import type { SkillInstallSource } from "@lobester/shared";

function parseSkillRefs(value?: string) {
  if (!value) return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.replace(/^skill\s+/i, "").trim());
}

type SkillLookup = {
  byId: Map<string, string>;
  byName: Map<string, string[]>;
  byOpenclawKey: Map<string, string[]>;
};

function buildSkillLookup(
  installed: Awaited<ReturnType<SkillStore["list"]>>,
): SkillLookup {
  const byId = new Map<string, string>();
  const byName = new Map<string, string[]>();
  const byOpenclawKey = new Map<string, string[]>();

  for (const skill of installed) {
    byId.set(skill.id, skill.id);

    const nameKey = skill.name.toLowerCase();
    byName.set(nameKey, [...(byName.get(nameKey) ?? []), skill.id]);

    const openclawKey = skill.openclawKey.toLowerCase();
    byOpenclawKey.set(openclawKey, [
      ...(byOpenclawKey.get(openclawKey) ?? []),
      skill.id,
    ]);
  }

  return { byId, byName, byOpenclawKey };
}

async function resolveSkillRefsToIds(skillRefs: string[]) {
  if (skillRefs.length === 0) return [];

  const installed = await new SkillStore().list();
  const lookup = buildSkillLookup(installed);
  const resolved: string[] = [];
  const missing: string[] = [];
  const ambiguous: Array<{ ref: string; ids: string[] }> = [];

  for (const ref of skillRefs) {
    if (lookup.byId.has(ref)) {
      resolved.push(ref);
      continue;
    }

    const key = ref.toLowerCase();
    const byKey = lookup.byOpenclawKey.get(key) ?? [];
    if (byKey.length === 1) {
      resolved.push(byKey[0]);
      continue;
    }
    if (byKey.length > 1) {
      ambiguous.push({ ref, ids: byKey });
      continue;
    }

    const byName = lookup.byName.get(key) ?? [];
    if (byName.length === 1) {
      resolved.push(byName[0]);
      continue;
    }
    if (byName.length > 1) {
      ambiguous.push({ ref, ids: byName });
      continue;
    }

    missing.push(ref);
  }

  if (missing.length > 0 || ambiguous.length > 0) {
    const parts: string[] = [];
    if (missing.length > 0) {
      parts.push(`Unknown skills: ${missing.join(", ")}`);
    }
    if (ambiguous.length > 0) {
      const detail = ambiguous
        .map((entry) => `${entry.ref} -> [${entry.ids.join(", ")}]`)
        .join("; ");
      parts.push(`Ambiguous skills: ${detail}`);
    }
    parts.push(
      "Use an explicit skill ID for ambiguous names (run: lobe skill list).",
    );
    throw new Error(parts.join(" "));
  }

  return resolved;
}

async function initState() {
  await paths.ensureRuntimeDirs();
  await Promise.all([
    new SkillStore().ensure(),
    new PresetStore().ensure(),
    new RunStore().ensure(),
  ]);

  try {
    await fs.access(paths.stateFiles.license);
  } catch {
    await writeFileAtomic(paths.stateFiles.license, "{}");
  }
}

async function doctor() {
  const checks = await Promise.all([
    fs
      .access(paths.stateDir)
      .then(() => true)
      .catch(() => false),
    fs
      .access(paths.skillsDir)
      .then(() => true)
      .catch(() => false),
    fs
      .access(paths.openclawDir)
      .then(() => true)
      .catch(() => false),
    fs
      .access(paths.getBaseConfigPath() ?? "")
      .then(() => true)
      .catch(() => false),
    fs
      .access(paths.connectorLogPath)
      .then(() => true)
      .catch(() => false),
  ]);

  const baseConfigPath = paths.getBaseConfigPath();
  console.log("LobeSter doctor");
  console.log(`stateDir: ${paths.stateDir} (${checks[0] ? "ok" : "missing"})`);
  console.log(`skillsDir: ${paths.skillsDir} (${checks[1] ? "ok" : "missing"})`);
  console.log(`openclawDir: ${paths.openclawDir} (${checks[2] ? "ok" : "missing"})`);
  console.log(
    `baseConfig: ${baseConfigPath} (${checks[3] ? "ok" : "missing"})`,
  );
  console.log(
    `connectorLog: ${paths.connectorLogPath} (${checks[4] ? "ok" : "not-yet-created"})`,
  );
}

const program = new Command();

program.name("lobe").description("LobeSter local connector");
program.option(
  "--engram <engram>",
  "Engram id or name used by `lobe list`",
);

async function applyEngram(engramRef: string) {
  await initState();
  const service = new ApplyService();
  const { response } = await service.applyPreset(engramRef);

  console.log("Engram set.");
  console.log(`baseConfigPath: ${response.baseConfigPath}`);
  console.log(
    `generatedConfigPath: ${response.generatedConfigPath}`,
  );
  console.log(`overlayPath: ${response.overlayPath}`);
  console.log(`conflicts: ${response.conflicts.length}`);
  if (response.conflicts.length > 0) {
    for (const conflict of response.conflicts) {
      console.log(
        `- [${conflict.reason}] ${conflict.key}: ${conflict.message}`,
      );
    }
  }
}

async function createEngram(opts: {
  name: string;
  skills?: string;
}) {
  await initState();
  const store = new PresetStore();

  const skillIds = await resolveSkillRefsToIds(
    parseSkillRefs(opts.skills),
  );

  const preset = await store.create({
    name: opts.name,
    skillIds,
  });

  console.log("Engram created.");
  console.log(`id: ${preset.id}`);
  console.log(`name: ${preset.name}`);
  console.log(`skillIds: ${preset.skillIds.join(",") || "(none)"}`);
}

async function updateEngram(opts: {
  engram: string;
  add?: string;
  remove?: string;
}) {
  await initState();
  const addRefs = parseSkillRefs(opts.add);
  const removeRefs = parseSkillRefs(opts.remove);
  if (addRefs.length === 0 && removeRefs.length === 0) {
    throw new Error(
      "Nothing to update. Provide --add and/or --remove.",
    );
  }

  const store = new PresetStore();
  const preset = await store.getByRef(opts.engram);
  if (!preset) {
    throw new Error(`Engram not found: ${opts.engram}`);
  }

  const addIds = await resolveSkillRefsToIds(addRefs);
  const removeIds = await resolveSkillRefsToIds(removeRefs);

  const next = new Set(preset.skillIds);
  for (const skillId of addIds) {
    next.add(skillId);
  }
  for (const skillId of removeIds) {
    next.delete(skillId);
  }

  const updated = await store.update(preset.id, {
    skillIds: [...next],
  });
  if (!updated) {
    throw new Error(`Failed to update engram: ${opts.engram}`);
  }

  console.log("Engram updated.");
  console.log(`id: ${updated.id}`);
  console.log(`name: ${updated.name}`);
  console.log(`skillIds: ${updated.skillIds.join(",") || "(none)"}`);
}

async function listEngrams() {
  await initState();
  const rows = await new PresetStore().list();
  if (rows.length === 0) {
    console.log("No engrams.");
    return;
  }

  const skills = await new SkillStore().list();
  const byId = new Map(skills.map((skill) => [skill.id, skill]));

  for (const row of rows) {
    const labels = row.skillIds.map((skillId) => {
      const skill = byId.get(skillId);
      if (!skill) return `${skillId}(missing)`;
      return `${skill.name}[${skill.id}]`;
    });
    console.log(
      `${row.id}\t${row.name}\t${row.skillIds.length} skills\t${labels.join(", ")}`,
    );
  }
}

async function listEngramSkills(engramRef: string) {
  await initState();
  const store = new PresetStore();
  const engram = await store.getByRef(engramRef);
  if (!engram) {
    throw new Error(`Engram not found: ${engramRef}`);
  }

  const skills = await new SkillStore().list();
  const byId = new Map(skills.map((skill) => [skill.id, skill]));

  console.log(`Engram: ${engram.name} (${engram.id})`);
  if (engram.skillIds.length === 0) {
    console.log("No skills in engram.");
    return;
  }

  for (const skillId of engram.skillIds) {
    const skill = byId.get(skillId);
    if (!skill) {
      console.log(`${skillId}\tMISSING`);
      continue;
    }
    console.log(
      `${skill.id}\t${skill.name}\t${skill.openclawKey}`,
    );
  }
}

program
  .command("start")
  .option("-p, --port <port>", "Port", "3210")
  .action(async (opts) => {
    await initState();
    const port = Number(opts.port);
    await startServer({ port });
  });

program.command("init").action(async () => {
  await initState();
  console.log("LobeSter initialized.");
});

program.command("doctor").action(async () => {
  await doctor();
});

program.command("list").action(async () => {
  const opts = program.opts<{ engram?: string }>();
  if (!opts.engram) {
    throw new Error(
      "Missing --engram. Usage: lobe --engram <name-or-id> list",
    );
  }
  await listEngramSkills(opts.engram);
});

program
  .command("set")
  .requiredOption("--engram <engram>", "Engram id or name")
  .action(async (opts: { engram: string }) => {
    await applyEngram(opts.engram);
  });

program
  .command("update")
  .requiredOption("--engram <engram>", "Engram id or name")
  .option(
    "--add <skillRefs>",
    "Comma-separated skill refs (id, name, or openclaw key)",
  )
  .option(
    "--remove <skillRefs>",
    "Comma-separated skill refs (id, name, or openclaw key)",
  )
  .action(
    async (opts: {
      engram: string;
      add?: string;
      remove?: string;
    }) => {
      await updateEngram(opts);
    },
  );

const skillCommand = program.command("skill");

skillCommand
  .command("install")
  .requiredOption("--source <source>", "local|github")
  .requiredOption("--ref <ref>", "absolute path or owner/repo[#ref]")
  .action(
    async (opts: {
      source: string;
      ref: string;
    }) => {
      await initState();
      const kind = opts.source.trim().toLowerCase();
      if (kind !== "local" && kind !== "github") {
        throw new Error(
          "Invalid --source. Use local or github.",
        );
      }

      const store = new SkillStore();
      const skill = await store.install({
        kind: kind as SkillInstallSource["kind"],
        ref: opts.ref,
      });

      console.log("Skill installed.");
      console.log(`id: ${skill.id}`);
      console.log(`name: ${skill.name}`);
      console.log(`openclawKey: ${skill.openclawKey}`);
      console.log(`localPath: ${skill.localPath}`);
    },
  );

skillCommand.command("list").action(async () => {
  await initState();
  const rows = await new SkillStore().list();
  if (rows.length === 0) {
    console.log("No installed skills.");
    return;
  }
  for (const row of rows) {
    console.log(`${row.id}\t${row.name}\t${row.openclawKey}`);
  }
});

const createCommand = program.command("create");

createCommand
  .command("engram")
  .requiredOption("--name <name>", "engram name")
  .option(
    "--skills <skillRefs>",
    "Comma-separated skill refs (id, name, or openclaw key)",
  )
  .action(async (opts: { name: string; skills?: string }) => {
    await createEngram(opts);
  });

const engramCommand = program.command("engram");

engramCommand.command("list").action(async () => {
  await listEngrams();
});

program.parseAsync(process.argv);

