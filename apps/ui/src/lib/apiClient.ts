import type {
  ApplyPresetRequest,
  ApplyPresetResponse,
  LicenseSetTokenRequest,
  LicenseSetTokenResponse,
  LicenseStatusResponse,
  PresetCreateRequest,
  PresetCreateResponse,
  PresetDeleteResponse,
  PresetListResponse,
  PresetUpdateRequest,
  PresetUpdateResponse,
  RunCreateRequest,
  RunCreateResponse,
  RunListResponse,
  RunUpdateRequest,
  RunUpdateResponse,
  SkillInstallBatchRequest,
  SkillInstallBatchResponse,
  SkillInstallRequest,
  SkillInstallResponse,
  SkillListResponse,
  SkillRemoveResponse,
} from "@lobester/shared";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const hasBody = init?.body !== undefined;
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      ...(hasBody ? { "content-type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });

  const bodyText = await res.text();
  if (!res.ok) {
    throw new Error(bodyText || `${res.status} ${res.statusText}`);
  }

  return JSON.parse(bodyText) as T;
}

export const apiClient = {
  getLicenseStatus: () =>
    api<LicenseStatusResponse>("/license/status"),
  setLicenseToken: (payload: LicenseSetTokenRequest) =>
    api<LicenseSetTokenResponse>("/license/token", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  listSkills: () => api<SkillListResponse>("/skills"),
  installSkill: (payload: SkillInstallRequest) =>
    api<SkillInstallResponse>("/skills/install", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  installLocalBatch: (payload: SkillInstallBatchRequest) =>
    api<SkillInstallBatchResponse>("/skills/install-local-batch", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  removeSkill: (id: string) =>
    api<SkillRemoveResponse>(`/skills/${id}`, {
      method: "DELETE",
    }),

  listPresets: () => api<PresetListResponse>("/presets"),
  createPreset: (payload: PresetCreateRequest) =>
    api<PresetCreateResponse>("/presets", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updatePreset: (id: string, payload: PresetUpdateRequest) =>
    api<PresetUpdateResponse>(`/presets/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deletePreset: (id: string) =>
    api<PresetDeleteResponse>(`/presets/${id}`, {
      method: "DELETE",
    }),

  listRuns: () => api<RunListResponse>("/runs"),
  createRun: (payload: RunCreateRequest) =>
    api<RunCreateResponse>("/runs", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateRun: (id: string, payload: RunUpdateRequest) =>
    api<RunUpdateResponse>(`/runs/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  applyPreset: (payload: ApplyPresetRequest) =>
    api<ApplyPresetResponse>("/openclaw/applyPreset", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

