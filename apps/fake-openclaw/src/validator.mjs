import fs from "node:fs/promises";
import path from "node:path";

function toObject(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value;
  }
  return null;
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function parseRequiredEnvVarsFromSkillMd(raw) {
  const envVars = [];
  const seen = new Set();

  const start = raw.startsWith("---\n") || raw.startsWith("---\r\n");
  if (!start) return envVars;

  const parts = raw.split(/\r?\n---\r?\n/);
  if (parts.length < 2) return envVars;
  const frontmatter = parts[0].replace(/^---\r?\n/, "");

  const lines = frontmatter.split(/\r?\n/);
  let inEnvList = false;
  let envIndent = -1;

  for (const line of lines) {
    const envMatch = /^(\s*)env:\s*$/.exec(line);
    if (envMatch) {
      inEnvList = true;
      envIndent = envMatch[1].length;
      continue;
    }

    if (!inEnvList) continue;

    const itemMatch = /^(\s*)-\s*([A-Za-z_][A-Za-z0-9_]*)\s*$/.exec(
      line,
    );
    if (itemMatch && itemMatch[1].length > envIndent) {
      const key = itemMatch[2];
      if (!seen.has(key)) {
        seen.add(key);
        envVars.push(key);
      }
      continue;
    }

    if (line.trim().length === 0 || /^\s*#/.test(line)) {
      continue;
    }

    const currentIndent = line.match(/^(\s*)/)?.[1].length ?? 0;
    if (currentIndent <= envIndent) {
      inEnvList = false;
    }
  }

  return envVars;
}

async function validateSkillEntry({
  key,
  entry,
  strictEnv,
  issues,
  checkedSkills,
}) {
  const entryObj = toObject(entry);
  if (!entryObj) {
    issues.push({
      severity: "error",
      code: "invalid_entry",
      key,
      message: "Skill entry must be an object",
    });
    return;
  }

  const skillPathRaw = entryObj.path;
  if (typeof skillPathRaw !== "string" || skillPathRaw.trim().length === 0) {
    issues.push({
      severity: "error",
      code: "invalid_skill_path",
      key,
      message: "Skill entry is missing a non-empty 'path' string",
    });
    return;
  }

  const skillPath = path.resolve(skillPathRaw);
  checkedSkills.push({ key, path: skillPath });

  if (!path.isAbsolute(skillPathRaw)) {
    issues.push({
      severity: "warn",
      code: "non_absolute_skill_path",
      key,
      path: skillPathRaw,
      message: "Skill path is not absolute; FakeOpenClaw resolved it",
    });
  }

  const stat = await fs.stat(skillPath).catch(() => null);
  if (!stat || !stat.isDirectory()) {
    issues.push({
      severity: "error",
      code: "missing_skill_directory",
      key,
      path: skillPath,
      message: "Skill directory does not exist",
    });
    return;
  }

  const skillMdPath = path.join(skillPath, "SKILL.md");
  const lobesterJsonPath = path.join(skillPath, "lobester.json");

  const hasSkillMd = await pathExists(skillMdPath);
  const hasAnyManifest =
    hasSkillMd ||
    (await pathExists(lobesterJsonPath));

  if (!hasAnyManifest) {
    issues.push({
      severity: "error",
      code: "missing_skill_manifest",
      key,
      path: skillPath,
      message: "Expected SKILL.md or lobester.json in skill directory",
    });
    return;
  }

  if (!hasSkillMd) return;

  const rawSkillMd = await fs.readFile(skillMdPath, "utf8");
  const requiredEnvVars = parseRequiredEnvVarsFromSkillMd(rawSkillMd);
  for (const envVar of requiredEnvVars) {
    if (process.env[envVar]?.trim()) continue;
    issues.push({
      severity: strictEnv ? "error" : "warn",
      code: "missing_required_env",
      key,
      envVar,
      message: `Missing required env var declared by skill: ${envVar}`,
    });
  }
}

export async function validateOpenClawConfig({
  configPath,
  strictEnv = false,
} = {}) {
  const resolvedConfigPath = path.resolve(
    configPath || process.env.OPENCLAW_CONFIG_PATH || "",
  );

  if (!resolvedConfigPath || resolvedConfigPath === path.resolve("")) {
    throw new Error(
      "Missing config path. Provide --config or set OPENCLAW_CONFIG_PATH.",
    );
  }

  const issues = [];
  let parsed;
  let rawConfig;

  try {
    rawConfig = await fs.readFile(resolvedConfigPath, "utf8");
  } catch {
    throw new Error(
      `Config file not found at ${resolvedConfigPath}`,
    );
  }

  try {
    parsed = JSON.parse(rawConfig);
  } catch {
    throw new Error(
      `Config is not valid JSON: ${resolvedConfigPath}`,
    );
  }

  const configObj = toObject(parsed);
  if (!configObj) {
    throw new Error("Config root must be a JSON object");
  }

  const skillsObj = toObject(configObj.skills);
  if (!skillsObj) {
    issues.push({
      severity: "error",
      code: "missing_skills_section",
      message: "Config is missing skills section",
    });
  }

  const loadObj = toObject(skillsObj?.load);
  const extraDirs = toArray(loadObj?.extraDirs).filter(
    (v) => typeof v === "string",
  );
  for (const dirRaw of extraDirs) {
    const dirResolved = path.resolve(dirRaw);
    const stat = await fs.stat(dirResolved).catch(() => null);
    if (!stat || !stat.isDirectory()) {
      issues.push({
        severity: "warn",
        code: "invalid_extra_dir",
        path: dirRaw,
        message: "skills.load.extraDirs path does not exist",
      });
    }
  }

  const entriesObj = toObject(skillsObj?.entries);
  if (!entriesObj) {
    issues.push({
      severity: "error",
      code: "missing_entries_section",
      message: "Config is missing skills.entries object",
    });
  }

  const checkedSkills = [];
  for (const [key, entry] of Object.entries(entriesObj || {})) {
    await validateSkillEntry({
      key,
      entry,
      strictEnv,
      issues,
      checkedSkills,
    });
  }

  const pathToKeys = new Map();
  for (const item of checkedSkills) {
    const normalized = process.platform === "win32"
      ? item.path.toLowerCase()
      : item.path;
    const keys = pathToKeys.get(normalized) || [];
    keys.push(item.key);
    pathToKeys.set(normalized, keys);
  }
  for (const [skillPath, keys] of pathToKeys.entries()) {
    if (keys.length <= 1) continue;
    issues.push({
      severity: "warn",
      code: "duplicate_skill_path",
      path: skillPath,
      message: `Multiple entries map to the same skill path: ${keys.join(", ")}`,
    });
  }

  const errorCount = issues.filter(
    (issue) => issue.severity === "error",
  ).length;
  const warningCount = issues.filter(
    (issue) => issue.severity === "warn",
  ).length;

  return {
    ok: errorCount === 0,
    checkedAt: new Date().toISOString(),
    configPath: resolvedConfigPath,
    skillEntryCount: Object.keys(entriesObj || {}).length,
    errorCount,
    warningCount,
    strictEnv,
    issues,
  };
}
