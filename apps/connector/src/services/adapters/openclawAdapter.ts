import type { ApplyPresetResponse } from "@lobester/shared";
import { writeFileAtomic } from "../jsonStore.js";
import { MergeEngine } from "../mergeEngine.js";
import { OpenClawConfigReader } from "../openclawConfig.js";
import { paths } from "../paths.js";
import { WrapperSnippets } from "../wrapperSnippets.js";
import type {
  LoadoutAdapter,
  LoadoutAdapterApplyInput,
} from "./types.js";

export class OpenClawAdapter implements LoadoutAdapter {
  readonly id = "openclaw";

  private readonly configReader = new OpenClawConfigReader();
  private readonly mergeEngine = new MergeEngine();
  private readonly wrappers = new WrapperSnippets();

  async applyLoadout(
    input: LoadoutAdapterApplyInput,
  ): Promise<ApplyPresetResponse> {
    const { baseConfigPath, baseConfig } =
      await this.configReader.readBaseConfig();

    const merge = this.mergeEngine.build({
      baseConfig,
      skills: input.skills,
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

    return {
      ok: true,
      baseConfigPath,
      generatedConfigPath: paths.generatedConfigPath,
      overlayPath: paths.overlayPath,
      managedSkillsDir: paths.skillsDir,
      openclawEnvVar: {
        key: "OPENCLAW_CONFIG_PATH",
        value: paths.generatedConfigPath,
      },
      wrapperSnippets: this.wrappers.build(paths.generatedConfigPath),
      conflicts: [
        ...input.missingSkillConflicts,
        ...merge.conflicts,
      ],
    };
  }
}

