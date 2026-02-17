import fs from "node:fs/promises";
import path from "node:path";
import { paths } from "./paths.js";

export class OpenClawConfigReader {
  resolveBaseConfigPath() {
    return paths.getBaseConfigPath();
  }

  async readBaseConfig(): Promise<{
    baseConfigPath: string;
    baseConfig: Record<string, unknown>;
  }> {
    const basePath = this.resolveBaseConfigPath();
    if (!basePath) {
      throw new Error("OpenClaw base config path is not set");
    }

    const resolved = path.resolve(basePath);
    let raw: string;
    try {
      raw = await fs.readFile(resolved, "utf8");
    } catch {
      throw new Error(
        `OpenClaw base config not found at ${resolved}`,
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(
        `OpenClaw base config is not valid JSON: ${resolved}`,
      );
    }

    if (!parsed || typeof parsed !== "object") {
      throw new Error(
        "OpenClaw base config must be a JSON object",
      );
    }

    return {
      baseConfigPath: resolved,
      baseConfig: parsed as Record<string, unknown>,
    };
  }
}
