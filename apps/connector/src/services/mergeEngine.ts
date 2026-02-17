import type {
  ApplyConflict,
  Skill,
} from "@lobester/shared";

type MergeInput = {
  baseConfig: Record<string, unknown>;
  skills: Skill[];
  managedSkillsDir: string;
};

type MergeResult = {
  overlayConfig: Record<string, unknown>;
  generatedConfig: Record<string, unknown>;
  conflicts: ApplyConflict[];
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object") {
    return value as Record<string, unknown>;
  }
  return {};
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is string => typeof entry === "string",
  );
}

export class MergeEngine {
  build(input: MergeInput): MergeResult {
    const generated = clone(input.baseConfig);
    const generatedSkills = asObject(generated.skills);
    const generatedLoad = asObject(generatedSkills.load);
    const generatedEntries = asObject(generatedSkills.entries);

    const extraDirs = asStringArray(generatedLoad.extraDirs);
    if (!extraDirs.includes(input.managedSkillsDir)) {
      extraDirs.push(input.managedSkillsDir);
    }

    const overlayEntries: Record<string, unknown> = {};
    const conflicts: ApplyConflict[] = [];

    for (const skill of input.skills) {
      if (
        Object.prototype.hasOwnProperty.call(
          generatedEntries,
          skill.openclawKey,
        )
      ) {
        conflicts.push({
          key: skill.openclawKey,
          reason: "existing_entry",
          message:
            "Base config already contains this entry key; kept base value.",
        });
        continue;
      }

      const entry = {
        enabled: true,
        path: skill.localPath,
      };

      generatedEntries[skill.openclawKey] = entry;
      overlayEntries[skill.openclawKey] = entry;
    }

    generatedSkills.load = {
      ...generatedLoad,
      extraDirs,
    };
    generatedSkills.entries = generatedEntries;
    generated.skills = generatedSkills;

    const overlayConfig: Record<string, unknown> = {
      skills: {
        load: {
          extraDirs,
        },
        entries: overlayEntries,
      },
      lobester: {
        generatedAt: new Date().toISOString(),
        managedSkillsDir: input.managedSkillsDir,
      },
    };

    return {
      overlayConfig,
      generatedConfig: generated,
      conflicts,
    };
  }
}

