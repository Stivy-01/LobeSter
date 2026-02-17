export type Plan = "free" | "pro_monthly" | "pro_yearly";

export type Limits = {
  maxPresets: number;
  maxRuns: number;
  canAutoUpdateSkills: boolean;
  canCloudBackup: boolean;
  canConflictWarnings: boolean;
};

export type Preset = {
  id: string;
  name: string;
  skillIds: string[];
  graph?: PresetGraph;
  createdAt: string;
  updatedAt: string;
};

export type SkillSource =
  | { kind: "github"; ref: string }
  | { kind: "zip"; ref: string }
  | { kind: "local"; ref: string };

export type Skill = {
  id: string;
  name: string;
  openclawKey: string;
  localPath: string;
  source: SkillSource;
  version?: string;
  installedAt: string;
  updatedAt?: string;
};

export type RunStatus = "queued" | "running" | "done" | "failed";

export type Run = {
  id: string;
  title: string;
  presetId: string;
  status: RunStatus;
  createdAt: string;
  updatedAt: string;
  outputMarkdown?: string;
};

export type ApplyPresetRequest = {
  presetRef: string;
};

export type ApplyConflict = {
  key: string;
  reason: "existing_entry" | "missing_skill";
  message: string;
};

export type ApplyPresetResponse = {
  ok: true;
  baseConfigPath: string | null;
  generatedConfigPath: string;
  overlayPath: string;
  managedSkillsDir: string;
  openclawEnvVar: { key: "OPENCLAW_CONFIG_PATH"; value: string };
  wrapperSnippets: Record<string, { title: string; snippet: string }>;
  conflicts: ApplyConflict[];
};

export type ApiError = {
  ok: false;
  error: string;
  code: string;
  requestId: string;
  details?: unknown;
};

export type ApiResult<T> = T | ApiError;

export type SkillInstallSource =
  | { kind: "local"; ref: string }
  | { kind: "github"; ref: string };

export type SkillInstallRequest = {
  source: SkillInstallSource;
};

export type SkillInstallResponse = {
  ok: true;
  skill: Skill;
};

export type SkillInstallBatchRequest = {
  rootPath: string;
};

export type SkillInstallBatchResult = {
  ref: string;
  status: "installed" | "skipped" | "failed";
  skill?: Skill;
  error?: string;
};

export type SkillInstallBatchResponse = {
  ok: true;
  results: SkillInstallBatchResult[];
};

export type SkillListResponse = {
  ok: true;
  skills: Skill[];
};

export type SkillRemoveResponse = {
  ok: true;
  removedId: string;
};

export type PresetListResponse = {
  ok: true;
  presets: Preset[];
};

export type PresetCreateRequest = {
  name: string;
  skillIds: string[];
  graph?: PresetGraph;
};

export type PresetUpdateRequest = {
  name?: string;
  skillIds?: string[];
  graph?: PresetGraph;
};

export type PresetCreateResponse = {
  ok: true;
  preset: Preset;
};

export type PresetUpdateResponse = {
  ok: true;
  preset: Preset;
};

export type PresetDeleteResponse = {
  ok: true;
  removedId: string;
};

export type RunListResponse = {
  ok: true;
  runs: Run[];
};

export type RunCreateRequest = {
  title: string;
  presetId: string;
};

export type RunUpdateRequest = {
  status?: RunStatus;
  outputMarkdown?: string;
};

export type RunCreateResponse = {
  ok: true;
  run: Run;
};

export type RunUpdateResponse = {
  ok: true;
  run: Run;
};

export type LicenseStatusResponse = {
  ok: true;
  isPro: boolean;
  limits: Limits;
  source: "cache" | "cloud" | "free_fallback";
};

export type LicenseSetTokenRequest = {
  token: string;
};

export type LicenseSetTokenResponse = LicenseStatusResponse;

export type CloudLicenseCreateRequest = {
  label?: string;
};

export type CloudLicenseCreateResponse = {
  token: string;
};

export type CloudLicenseValidateRequest = {
  token: string;
};

export type CloudLicenseValidateResponse = {
  valid: boolean;
  plan?: Plan;
  status?: string;
  limits?: Limits;
  currentPeriodEnd?: string | null;
};

export type PresetGraph = {
  nodes: PresetGraphNode[];
  edges: PresetGraphEdge[];
  viewport?: PresetGraphViewport;
};

export type PresetGraphNode = {
  id: string;
  position: { x: number; y: number };
  type?: string;
  data?: {
    label?: string;
    skillId?: string;
  };
};

export type PresetGraphEdge = {
  id: string;
  source: string;
  target: string;
  type?: string;
  label?: string;
};

export type PresetGraphViewport = {
  x: number;
  y: number;
  zoom: number;
};
