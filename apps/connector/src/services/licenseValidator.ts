import fs from "node:fs/promises";
import path from "node:path";
import type {
  CloudLicenseValidateResponse,
  Limits,
} from "@lobester/shared";

type LicenseCache = {
  token?: string;
  lastValidatedAt?: string;
  cachedUntil?: string;
  plan?: string;
  status?: string;
  limits?: Limits;
};

const FREE_LIMITS: Limits = {
  maxPresets: 1,
  maxRuns: 10,
  canAutoUpdateSkills: false,
  canCloudBackup: false,
  canConflictWarnings: false,
};

const GRACE_7_DAYS = 7 * 24 * 60 * 60 * 1000;
const GRACE_24_HOURS = 24 * 60 * 60 * 1000;
const GRACE_1_HOUR = 60 * 60 * 1000;

export class LicenseValidator {
  private licensePath: string;
  private cloudBaseUrl: string;

  constructor(opts: { stateDir: string; cloudBaseUrl: string }) {
    this.licensePath = path.join(opts.stateDir, "license.json");
    this.cloudBaseUrl = opts.cloudBaseUrl.replace(/\/$/, "");
  }

  async load(): Promise<LicenseCache> {
    try {
      const raw = await fs.readFile(this.licensePath, "utf8");
      return JSON.parse(raw) as LicenseCache;
    } catch {
      return {};
    }
  }

  async save(cache: LicenseCache) {
    await fs.mkdir(path.dirname(this.licensePath), {
      recursive: true,
    });
    await fs.writeFile(
      this.licensePath,
      JSON.stringify(cache, null, 2),
      "utf8",
    );
  }

  async setToken(token: string) {
    const cache = await this.load();
    cache.token = token;
    delete cache.lastValidatedAt;
    delete cache.cachedUntil;
    await this.save(cache);
  }

  private isWithin(iso?: string) {
    if (!iso) return false;
    return Date.now() < new Date(iso).getTime();
  }

  async getEffectiveLimits(): Promise<{
    isPro: boolean;
    limits: Limits;
    source: "cache" | "cloud" | "free_fallback";
  }> {
    const cache = await this.load();

    // Valid cached grace window â†’ use it
    if (cache.limits && this.isWithin(cache.cachedUntil)) {
      const isPro = (cache.plan ?? "free") !== "free";
      return { isPro, limits: cache.limits, source: "cache" };
    }

    // No token â†’ free
    if (!cache.token) {
      return {
        isPro: false,
        limits: FREE_LIMITS,
        source: "free_fallback",
      };
    }

    // Try cloud validation
    try {
      const res = await fetch(
        `${this.cloudBaseUrl}/api/license/validate`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token: cache.token }),
        },
      );

      const data =
        (await res.json()) as CloudLicenseValidateResponse;

      if (!data.valid || !data.limits) {
        const next: LicenseCache = {
          token: cache.token,
          lastValidatedAt: new Date().toISOString(),
          cachedUntil: new Date(
            Date.now() + GRACE_1_HOUR,
          ).toISOString(),
          plan: "free",
          status: "invalid",
          limits: FREE_LIMITS,
        };
        await this.save(next);
        return { isPro: false, limits: FREE_LIMITS, source: "cloud" };
      }

      // Valid â†’ cache with 7-day grace
      const next: LicenseCache = {
        token: cache.token,
        lastValidatedAt: new Date().toISOString(),
        cachedUntil: new Date(
          Date.now() + GRACE_7_DAYS,
        ).toISOString(),
        plan: data.plan,
        status: data.status,
        limits: data.limits,
      };
      await this.save(next);

      const isPro = (data.plan ?? "free") !== "free";
      return { isPro, limits: data.limits, source: "cloud" };
    } catch {
      // Cloud unreachable â†’ keep old limits with short grace
      if (cache.limits) {
        const next = {
          ...cache,
          cachedUntil: new Date(
            Date.now() + GRACE_24_HOURS,
          ).toISOString(),
        };
        await this.save(next);
        const isPro = (next.plan ?? "free") !== "free";
        return { isPro, limits: next.limits!, source: "cache" };
      }

      return {
        isPro: false,
        limits: FREE_LIMITS,
        source: "free_fallback",
      };
    }
  }
}

