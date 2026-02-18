import type {
  ApplyConflict,
  ApplyPresetResponse,
  Skill,
} from "@lobester/shared";

export type LoadoutAdapterApplyInput = {
  skills: Skill[];
  missingSkillConflicts: ApplyConflict[];
};

export interface LoadoutAdapter {
  /** Stable adapter id (for example: "openclaw"). */
  readonly id: string;

  /**
   * Applies an ecosystem-specific loadout and returns the unified API
   * response used by the connector today.
   */
  applyLoadout(
    input: LoadoutAdapterApplyInput,
  ): Promise<ApplyPresetResponse>;
}

export type LoadoutAdapterFactory = () => LoadoutAdapter;

