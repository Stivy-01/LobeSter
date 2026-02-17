import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";

const home = os.homedir();
const lobesterHome =
  process.env.LOBESTER_HOME ||
  path.join(home, ".lobester");

export const paths = {
  /** Root LobeSter state directory */
  stateDir: lobesterHome,

  /** Managed skills folder */
  skillsDir: path.join(lobesterHome, "skills"),

  /** Connector logs */
  logsDir: path.join(lobesterHome, "logs"),

  /** Connector log file path */
  connectorLogPath: path.join(lobesterHome, "logs", "connector.log"),

  /** Generated OpenClaw configs */
  openclawDir: path.join(lobesterHome, "openclaw"),

  /** Local state json files */
  stateFiles: {
    skills: path.join(lobesterHome, "state", "skills.json"),
    presets: path.join(lobesterHome, "state", "presets.json"),
    runs: path.join(lobesterHome, "state", "runs.json"),
    license: path.join(lobesterHome, "state", "license.json"),
  },

  /** Overlay config */
  overlayPath: path.join(
    lobesterHome,
    "openclaw",
    "overlay.json",
  ),

  /** Final generated config */
  generatedConfigPath: path.join(
    lobesterHome,
    "openclaw",
    "openclaw.generated.json",
  ),

  /** Default base OpenClaw config location */
  defaultBaseConfigPath: path.join(
    home,
    ".openclaw",
    "openclaw.json",
  ),

  /** Resolve base config: env var takes precedence */
  getBaseConfigPath(): string | null {
    return (
      process.env.OPENCLAW_CONFIG_PATH ??
      this.defaultBaseConfigPath
    );
  },

  async ensureRuntimeDirs() {
    await Promise.all([
      fs.mkdir(this.stateDir, { recursive: true }),
      fs.mkdir(this.skillsDir, { recursive: true }),
      fs.mkdir(this.openclawDir, { recursive: true }),
      fs.mkdir(this.logsDir, { recursive: true }),
      fs.mkdir(path.dirname(this.stateFiles.skills), {
        recursive: true,
      }),
    ]);
  },
};

