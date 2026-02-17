import type {
  ApplyConflict,
  ApplyPresetResponse,
  Run,
} from "@lobester/shared";
import { MergeEngine } from "./mergeEngine.js";
import { OpenClawConfigReader } from "./openclawConfig.js";
import { paths } from "./paths.js";
import { PresetStore } from "./presetStore.js";
import { RunStore } from "./runStore.js";
import { SkillStore } from "./skillStore.js";
import { WrapperSnippets } from "./wrapperSnippets.js";
import { writeFileAtomic } from "./jsonStore.js";

export class ApplyServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode = 400,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export class ApplyService {
  private readonly presetStore = new PresetStore();
  private readonly skillStore = new SkillStore();
  private readonly runStore = new RunStore();
  private readonly configReader = new OpenClawConfigReader();
  private readonly mergeEngine = new MergeEngine();
  private readonly wrappers = new WrapperSnippets();

  async applyPreset(presetRef: string): Promise<{
    response: ApplyPresetResponse;
    run: Run;
  }> {
    if (!presetRef.trim()) {
      throw new ApplyServiceError(
        "Missing preset reference",
        "invalid_preset_ref",
        400,
      );
    }

    const preset = await this.presetStore.getByRef(presetRef.trim());
    if (!preset) {
      throw new ApplyServiceError(
        `Preset not found: ${presetRef}`,
        "preset_not_found",
        404,
      );
    }

    const run = await this.runStore.create({
      title: `Apply ${preset.name}`,
      presetId: preset.id,
    });
    await this.runStore.update(run.id, { status: "running" });

    try {
      const { baseConfigPath, baseConfig } =
        await this.configReader.readBaseConfig();

      const allSkills = await this.skillStore.list();
      const skillById = new Map(allSkills.map((s) => [s.id, s]));
      const selected = [];
      const missingSkillConflicts: ApplyConflict[] = [];

      for (const skillId of preset.skillIds) {
        const skill = skillById.get(skillId);
        if (!skill) {
          missingSkillConflicts.push({
            key: skillId,
            reason: "missing_skill",
            message:
              "Preset references a skill that is no longer installed.",
          });
          continue;
        }
        selected.push(skill);
      }

      const merge = this.mergeEngine.build({
        baseConfig,
        skills: selected,
        managedSkillsDir: paths.skillsDir,
      });

      await paths.ensureRuntimeDirs();
      await writeFileAtomic(
        paths.overlayPath,
        JSON.stringify(merge.overlayConfig, null, 2),
      );
      await writeFileAtomic(
        paths.generatedConfigPath,
        JSON.stringify(merge.generatedConfig, null, 2),
      );

      const conflicts = [
        ...missingSkillConflicts,
        ...merge.conflicts,
      ];
      const response: ApplyPresetResponse = {
        ok: true,
        baseConfigPath,
        generatedConfigPath: paths.generatedConfigPath,
        overlayPath: paths.overlayPath,
        managedSkillsDir: paths.skillsDir,
        openclawEnvVar: {
          key: "OPENCLAW_CONFIG_PATH",
          value: paths.generatedConfigPath,
        },
        wrapperSnippets: this.wrappers.build(
          paths.generatedConfigPath,
        ),
        conflicts,
      };

      await this.runStore.update(run.id, {
        status: "done",
        outputMarkdown: [
          `Applied preset: ${preset.name}`,
          `Generated config: ${paths.generatedConfigPath}`,
          `Overlay: ${paths.overlayPath}`,
          `Conflicts: ${conflicts.length}`,
        ].join("\n"),
      });

      return { response, run: { ...run, status: "done" } };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown apply failure";
      await this.runStore.update(run.id, {
        status: "failed",
        outputMarkdown: message,
      });

      if (error instanceof ApplyServiceError) throw error;
      throw new ApplyServiceError(
        message,
        "apply_failed",
        400,
      );
    }
  }
}

