import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { nanoid } from "nanoid";
import * as tar from "tar";
import type {
  Skill,
  SkillInstallBatchResult,
  SkillInstallSource,
} from "@lobester/shared";
import { JsonCollectionStore } from "./jsonStore.js";
import { paths } from "./paths.js";

type SkillMetadata = {
  name?: string;
  openclawKey?: string;
  version?: string;
};

function stripWrappingQuotes(input: string) {
  let value = input.trim();
  while (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    const isQuotedPair =
      (first === `"` && last === `"`) ||
      (first === `'` && last === `'`);
    if (!isQuotedPair) break;
    value = value.slice(1, -1).trim();
  }
  return value;
}

function slugify(input: string) {
  const v = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return v || "skill";
}

function parseGithubRef(ref: string) {
  const m = ref.match(
    /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:#(.+))?$/,
  );
  if (!m) return null;
  return {
    owner: m[1],
    repo: m[2],
    revision: m[3] || "HEAD",
  };
}

async function readSkillMetadata(
  directoryPath: string,
): Promise<SkillMetadata> {
  const metadataPaths = [path.join(directoryPath, "lobester.json")];

  try {
    for (const metadataPath of metadataPaths) {
      try {
        const raw = await fs.readFile(metadataPath, "utf8");
        const parsed = JSON.parse(raw) as SkillMetadata;
        return parsed;
      } catch {
        // try next metadata file
      }
    }
    return {};
  } catch {
    return {};
  }
}

async function ensureAbsoluteDirectory(targetPath: string) {
  if (!path.isAbsolute(targetPath)) {
    throw new Error("Local path must be absolute");
  }
  const stat = await fs.stat(targetPath).catch(() => null);
  if (!stat || !stat.isDirectory()) {
    throw new Error("Local path must be an existing directory");
  }
}

async function isSkillDirectory(targetPath: string) {
  const markerFiles = ["SKILL.md", "lobester.json"];
  for (const marker of markerFiles) {
    const fullPath = path.join(targetPath, marker);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      // keep checking other markers
    }
  }
  return false;
}

function normalizeLocalPathForCompare(targetPath: string) {
  const normalized = path
    .normalize(path.resolve(targetPath))
    .replace(/[\\/]+$/, "");
  return process.platform === "win32"
    ? normalized.toLowerCase()
    : normalized;
}

async function collectSkillDirectories(rootPath: string) {
  const results: string[] = [];
  const seen = new Set<string>();

  async function walk(dirPath: string, depth: number) {
    const key = normalizeLocalPathForCompare(dirPath);
    if (seen.has(key)) return;
    seen.add(key);

    if (await isSkillDirectory(dirPath)) {
      results.push(path.resolve(dirPath));
      return;
    }

    if (depth <= 0) return;
    const entries = await fs
      .readdir(dirPath, { withFileTypes: true })
      .catch(() => []);
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      await walk(path.join(dirPath, entry.name), depth - 1);
    }
  }

  await walk(rootPath, 3);
  return results;
}

export class SkillStore {
  private readonly store = new JsonCollectionStore<Skill>(
    paths.stateFiles.skills,
  );

  async ensure() {
    await paths.ensureRuntimeDirs();
    await this.store.ensure();
  }

  async list(): Promise<Skill[]> {
    await this.ensure();
    return this.store.readAll();
  }

  async getById(id: string): Promise<Skill | null> {
    await this.ensure();
    return this.store.getById(id);
  }

  async install(source: SkillInstallSource): Promise<Skill> {
    await this.ensure();
    if (source.kind === "local") {
      const normalizedRef = path.resolve(
        stripWrappingQuotes(source.ref),
      );
      await ensureAbsoluteDirectory(normalizedRef);
      return this.installFromDirectory(normalizedRef, {
        ...source,
        ref: normalizedRef,
      });
    }

    const parsed = parseGithubRef(source.ref);
    if (!parsed) {
      throw new Error(
        "GitHub ref must be owner/repo or owner/repo#ref",
      );
    }

    const tmpRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "lobester-gh-"),
    );
    const archivePath = path.join(tmpRoot, "repo.tar.gz");
    const extractPath = path.join(tmpRoot, "extract");
    await fs.mkdir(extractPath, { recursive: true });

    try {
      const tarUrl = `https://codeload.github.com/${parsed.owner}/${parsed.repo}/tar.gz/${parsed.revision}`;
      const res = await fetch(tarUrl, {
        headers: { "user-agent": "lobester-connector" },
      });
      if (!res.ok) {
        throw new Error(
          `GitHub download failed (${res.status} ${res.statusText})`,
        );
      }
      const buf = Buffer.from(await res.arrayBuffer());
      await fs.writeFile(archivePath, buf);

      await tar.x({
        cwd: extractPath,
        file: archivePath,
        strip: 1,
      });

      return await this.installFromDirectory(extractPath, source);
    } finally {
      await fs.rm(tmpRoot, { recursive: true, force: true });
    }
  }

  async installLocalBatch(rootPath: string) {
    await this.ensure();
    const normalizedRootPath = path.resolve(
      stripWrappingQuotes(rootPath),
    );
    await ensureAbsoluteDirectory(normalizedRootPath);

    const skillDirectories =
      await collectSkillDirectories(normalizedRootPath);
    if (skillDirectories.length === 0) {
      throw new Error(
        "No skill folders found under the provided root path",
      );
    }

    const existingSkills = await this.store.readAll();
    const existingLocalRefs = new Set(
      existingSkills
        .filter((skill) => skill.source.kind === "local")
        .map((skill) =>
          normalizeLocalPathForCompare(skill.source.ref),
        ),
    );

    const results: SkillInstallBatchResult[] = [];
    for (const skillDirectory of skillDirectories) {
      const normalizedRef =
        normalizeLocalPathForCompare(skillDirectory);

      if (existingLocalRefs.has(normalizedRef)) {
        results.push({
          ref: skillDirectory,
          status: "skipped",
        });
        continue;
      }

      try {
        const skill = await this.install({
          kind: "local",
          ref: skillDirectory,
        });
        existingLocalRefs.add(normalizedRef);
        results.push({
          ref: skillDirectory,
          status: "installed",
          skill,
        });
      } catch (error) {
        results.push({
          ref: skillDirectory,
          status: "failed",
          error:
            error instanceof Error
              ? error.message
              : "Batch install failed",
        });
      }
    }

    return results;
  }

  async remove(id: string): Promise<boolean> {
    await this.ensure();
    const skill = await this.store.getById(id);
    if (!skill) return false;

    await fs.rm(skill.localPath, {
      recursive: true,
      force: true,
    });
    return this.store.removeById(id);
  }

  private async installFromDirectory(
    sourcePath: string,
    source: SkillInstallSource,
  ) {
    const current = await this.store.readAll();
    const id = nanoid();
    const destination = path.join(paths.skillsDir, id);

    await fs.cp(sourcePath, destination, { recursive: true });
    const metadata = await readSkillMetadata(destination);
    const sourceName = path.basename(sourcePath);
    const name = metadata.name?.trim() || sourceName || id;
    let openclawKey =
      metadata.openclawKey?.trim() || slugify(name);

    const existingKeys = new Set(
      current.map((entry) => entry.openclawKey),
    );
    if (existingKeys.has(openclawKey)) {
      let idx = 2;
      while (existingKeys.has(`${openclawKey}_${idx}`)) idx += 1;
      openclawKey = `${openclawKey}_${idx}`;
    }

    const now = new Date().toISOString();
    const skill: Skill = {
      id,
      name,
      openclawKey,
      localPath: destination,
      source,
      version: metadata.version,
      installedAt: now,
      updatedAt: now,
    };

    current.push(skill);
    await this.store.writeAll(current);
    return skill;
  }
}

