"use client";

import { useEffect, useMemo, useState } from "react";

function PencilIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}
import type {
  ApplyPresetResponse,
  Preset,
  Run,
  Skill,
  SkillInstallSource,
} from "@lobester/shared";
import { apiClient } from "@/lib/apiClient";

const DRAG_TYPE_SKILL = "application/x-skillui-skill";

export default function HomePage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  const [installKind, setInstallKind] =
    useState<SkillInstallSource["kind"]>("local");
  const [installRef, setInstallRef] = useState("");

  const [selectedPresetRef, setSelectedPresetRef] = useState("");
  const [applyResult, setApplyResult] =
    useState<ApplyPresetResponse | null>(null);
  const [logoUnavailable, setLogoUnavailable] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [renamePresetId, setRenamePresetId] = useState<string | null>(
    null,
  );
  const [renameValue, setRenameValue] = useState("");

  const skillById = useMemo(
    () => new Map(skills.map((skill) => [skill.id, skill])),
    [skills],
  );

  const isInitialLoading =
    busy &&
    !error &&
    skills.length === 0 &&
    presets.length === 0 &&
    runs.length === 0;

  const brandBadge = (
    <div className="brand-badge" aria-hidden="true">
      {logoUnavailable ? (
        "LS"
      ) : (
        <img
          className="brand-logo"
          src="/brand/lobester-logo.png"
          alt=""
          onError={() => setLogoUnavailable(true)}
        />
      )}
    </div>
  );

  async function refreshAll() {
    setBusy(true);
    setError(null);
    try {
      const [s, p, r] = await Promise.all([
        apiClient.listSkills(),
        apiClient.listPresets(),
        apiClient.listRuns(),
      ]);
      setSkills(s.skills);
      setPresets(p.presets);
      setRuns(r.runs);
      if (!selectedPresetRef && p.presets.length > 0) {
        setSelectedPresetRef(p.presets[0].id);
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to load dashboard",
      );
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function installSkill() {
    setInfo(null);
    setError(null);
    try {
      await apiClient.installSkill({
        source: { kind: installKind, ref: installRef.trim() },
      });
      setInstallRef("");
      await refreshAll();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Skill install failed",
      );
    }
  }

  async function installLocalBatch() {
    if (installKind !== "local") return;
    setInfo(null);
    setError(null);
    try {
      const response = await apiClient.installLocalBatch({
        rootPath: installRef.trim(),
      });
      const installed = response.results.filter(
        (result) => result.status === "installed",
      ).length;
      const skipped = response.results.filter(
        (result) => result.status === "skipped",
      ).length;
      const failed = response.results.filter(
        (result) => result.status === "failed",
      ).length;
      setInfo(
        `Batch install complete: ${installed} installed, ${skipped} skipped, ${failed} failed.`,
      );
      await refreshAll();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Skill batch install failed",
      );
    }
  }

  async function deleteSkill(skillId: string) {
    setError(null);
    try {
      await apiClient.removeSkill(skillId);
      await refreshAll();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to remove skill",
      );
    }
  }

  async function createEmptyPreset() {
    setError(null);
    const name = window.prompt("Engram name", "New engram");
    if (!name?.trim()) return;
    try {
      await apiClient.createPreset({
        name: name.trim(),
        skillIds: [],
      });
      await refreshAll();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to create engram",
      );
    }
  }

  async function addSkillToPreset(presetId: string, skillId: string) {
    const preset = presets.find((p) => p.id === presetId);
    if (!preset || preset.skillIds.includes(skillId)) return;
    setError(null);
    try {
      await apiClient.updatePreset(presetId, {
        skillIds: [...preset.skillIds, skillId],
      });
      await refreshAll();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to add skill",
      );
    }
  }

  async function removeSkillFromPreset(presetId: string, skillId: string) {
    const preset = presets.find((p) => p.id === presetId);
    if (!preset) return;
    setError(null);
    try {
      await apiClient.updatePreset(presetId, {
        skillIds: preset.skillIds.filter((id) => id !== skillId),
      });
      await refreshAll();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to remove skill",
      );
    }
  }

  function startRenamePreset(preset: Preset) {
    setRenamePresetId(preset.id);
    setRenameValue(preset.name);
  }

  function cancelRenamePreset() {
    setRenamePresetId(null);
    setRenameValue("");
  }

  async function submitRenamePreset(preset: Preset) {
    const nextName = renameValue.trim();
    if (!nextName || nextName === preset.name) {
      cancelRenamePreset();
      return;
    }
    setError(null);
    try {
      await apiClient.updatePreset(preset.id, { name: nextName });
      cancelRenamePreset();
      await refreshAll();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to update engram",
      );
    }
  }

  async function removePreset(presetId: string) {
    setError(null);
    try {
      await apiClient.deletePreset(presetId);
      await refreshAll();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to delete engram",
      );
    }
  }

  async function applyPreset(presetRef?: string) {
    const targetRef = presetRef ?? selectedPresetRef;
    if (!targetRef) return;
    setError(null);
    setApplyResult(null);
    setSelectedPresetRef(targetRef);
    try {
      const result = await apiClient.applyPreset({
        presetRef: targetRef,
      });
      setApplyResult(result);
      await refreshAll();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Set engram failed",
      );
    }
  }

  if (isInitialLoading) {
    return (
      <main className="dashboard">
        <header className="topbar panel">
          <div className="brandline">
            {brandBadge}
            <div>
              <h1>Local-First Manager</h1>
              <p>Booting workspace...</p>
            </div>
          </div>
        </header>
        <section className="panel skeleton-grid" aria-busy="true">
          <div className="skeleton-card" />
          <div className="skeleton-card" />
          <div className="skeleton-card" />
          <div className="skeleton-card" />
        </section>
      </main>
    );
  }

  return (
    <main className="dashboard">
      <header className="topbar panel">
        <div className="brandline">
          {brandBadge}
          <div>
            <h1>Local-First Manager</h1>
            <p>Skill Manager | Local Runtime</p>
          </div>
        </div>
        <div className="topbar-actions">
          <span className={`status-chip ${busy ? "loading" : "ready"}`}>
            {busy ? "Syncing" : "Ready"}
          </span>
          <button onClick={() => void refreshAll()}>Refresh</button>
        </div>
      </header>

      {error ? <pre className="alert error">{error}</pre> : null}
      {info ? <pre className="alert info">{info}</pre> : null}

      <div className="workspace-grid">
        <aside className="panel sidebar">
          <h2>Installed Skills</h2>
          <div className="form-stack">
            <select
              value={installKind}
              onChange={(e) =>
                setInstallKind(
                  e.target.value as SkillInstallSource["kind"],
                )
              }
            >
              <option value="local">local</option>
              <option value="github">github</option>
            </select>
            <input
              placeholder={
                installKind === "local"
                  ? "C:\\absolute\\path\\to\\skill"
                  : "owner/repo or owner/repo#ref"
              }
              value={installRef}
              onChange={(e) => setInstallRef(e.target.value)}
            />
            <div className="inline-actions">
              <button
                disabled={!installRef.trim()}
                onClick={() => void installSkill()}
              >
                Install
              </button>
              <button
                className="btn-ghost"
                disabled={
                  installKind !== "local" || !installRef.trim()
                }
                onClick={() => void installLocalBatch()}
              >
                Folder
              </button>
            </div>
          </div>

          {skills.length === 0 ? (
            <p className="empty-state">No skills installed.</p>
          ) : (
            <ul className="skill-list">
              {skills.map((skill) => (
                <li
                  key={skill.id}
                  draggable
                  className="skill-list-item-draggable"
                  onDragStart={(e) => {
                    e.dataTransfer.setData(DRAG_TYPE_SKILL, skill.id);
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                >
                  <div>
                    <strong>{skill.name}</strong>
                    <span>{skill.openclawKey}</span>
                  </div>
                  <button
                    className="btn-danger"
                    onClick={() => void deleteSkill(skill.id)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="main-column">
          <section className="panel kanban-panel">
            <div className="kanban-head">
              <h2>Engrams</h2>
              <div className="kanban-head-actions">
                <span className="status-chip ready">#/ACTIVE</span>
                <button
                  type="button"
                  className={`btn-icon ${isEditMode ? "active" : ""}`}
                  onClick={() => setIsEditMode((v) => !v)}
                  title={isEditMode ? "Done editing" : "Edit board"}
                  aria-label={isEditMode ? "Done editing" : "Edit board"}
                >
                  <PencilIcon />
                </button>
                {isEditMode && (
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => void createEmptyPreset()}
                  >
                    + New engram
                  </button>
                )}
              </div>
            </div>

            <div className="kanban-board">
              {presets.length === 0 ? (
                <div className="kanban-empty">
                  <p>No engrams yet.</p>
                  <p className="kanban-empty-hint">
                    {isEditMode
                      ? "Click + New engram to create one."
                      : "Click the pencil to edit and create engrams."}
                  </p>
                </div>
              ) : null}
              {presets.map((preset) => (
                <div
                  key={preset.id}
                  className="kanban-column"
                  data-active={
                    selectedPresetRef === preset.id ? "true" : undefined
                  }
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "copy";
                    e.currentTarget.classList.add("drop-target");
                  }}
                  onDragLeave={(e) => {
                    const related = e.relatedTarget as Node | null;
                    if (!related || !e.currentTarget.contains(related)) {
                      e.currentTarget.classList.remove("drop-target");
                    }
                  }}
                  onDrop={(e) => {
                    e.currentTarget.classList.remove("drop-target");
                    const skillId = e.dataTransfer.getData(DRAG_TYPE_SKILL);
                    if (skillId) void addSkillToPreset(preset.id, skillId);
                  }}
                >
                  <div className="kanban-column-header">
                    <span className="kanban-column-bar" />
                    <div>
                      <h3 className="kanban-column-title">
                        {renamePresetId === preset.id ? (
                          <input
                            className="rename-input"
                            value={renameValue}
                            onChange={(e) =>
                              setRenameValue(e.target.value)
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                void submitRenamePreset(preset);
                              } else if (e.key === "Escape") {
                                cancelRenamePreset();
                              }
                            }}
                            autoFocus
                          />
                        ) : (
                          preset.name
                        )}
                      </h3>
                      <span className="kanban-column-status">
                        <span className="status-dot" /> #/ACTIVE
                      </span>
                    </div>
                  </div>
                  <div className="kanban-column-cards">
                    {preset.skillIds.map((skillId) => (
                      <div
                        key={skillId}
                        className="kanban-skill-chip"
                      >
                        <span>
                          {skillById.get(skillId)?.name ?? skillId}
                        </span>
                        {isEditMode && (
                          <button
                            type="button"
                            className="btn-chip-remove"
                            onClick={() =>
                              void removeSkillFromPreset(preset.id, skillId)
                            }
                            aria-label="Remove skill"
                          >
                            x
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="kanban-column-actions">
                    <button
                      onClick={() => void applyPreset(preset.id)}
                      className="btn-set"
                    >
                      Set
                    </button>
                    {isEditMode && (
                      <>
                        {renamePresetId === preset.id ? (
                          <>
                            <button
                              className="btn-ghost"
                              onClick={() =>
                                void submitRenamePreset(preset)
                              }
                            >
                              Save
                            </button>
                            <button
                              className="btn-ghost"
                              onClick={() => cancelRenamePreset()}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            className="btn-ghost"
                            onClick={() => startRenamePreset(preset)}
                          >
                            Rename
                          </button>
                        )}
                        <button
                          className="btn-danger"
                          onClick={() => void removePreset(preset.id)}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {applyResult ? (
              <div className="apply-result">
                <p>
                  Generated: <code>{applyResult.generatedConfigPath}</code>
                </p>
                <p>
                  Overlay: <code>{applyResult.overlayPath}</code>
                </p>
                <p>Conflicts: {applyResult.conflicts.length}</p>
                <pre className="snippet-block">
                  {Object.values(applyResult.wrapperSnippets)
                    .map(
                      (snippet) =>
                        `${snippet.title}\n${snippet.snippet}`,
                    )
                    .join("\n\n")}
                </pre>
              </div>
            ) : null}
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Recent Commands</h2>
              <p>Local run history</p>
            </div>
            {runs.length === 0 ? (
              <p className="empty-state">No runs recorded yet.</p>
            ) : (
              <ul className="run-list">
                {runs.map((run) => (
                  <li key={run.id}>
                    <code>{run.title}</code>
                    <span>
                      {run.status} | {run.createdAt}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}

