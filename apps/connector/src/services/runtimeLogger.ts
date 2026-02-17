import fs from "node:fs/promises";
import { paths } from "./paths.js";

type LogLevel = "info" | "warn" | "error";

export async function appendConnectorLog(
  level: LogLevel,
  message: string,
  meta?: Record<string, unknown>,
) {
  try {
    await paths.ensureRuntimeDirs();
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      level,
      message,
      ...(meta ?? {}),
    });
    await fs.appendFile(paths.connectorLogPath, `${line}\n`, "utf8");
  } catch {
    // never fail request flow due to logger I/O
  }
}
