import type { FastifyInstance } from "fastify";
import type {
  LicenseSetTokenRequest,
  LicenseSetTokenResponse,
  LicenseStatusResponse,
} from "@lobester/shared";
import { sendApiError } from "../services/apiError.js";
import { LicenseValidator } from "../services/licenseValidator.js";
import { paths } from "../services/paths.js";

export async function registerLicenseRoutes(app: FastifyInstance) {
  const validator = new LicenseValidator({
    stateDir: paths.stateDir,
    cloudBaseUrl:
      process.env.LOBESTER_CLOUD_URL ||
      "https://yourapp.vercel.app",
  });

  app.get(
    "/api/license/status",
    async (): Promise<LicenseStatusResponse> => {
      const res = await validator.getEffectiveLimits();
      return { ok: true, ...res };
    },
  );

  app.post<{ Body: LicenseSetTokenRequest }>(
    "/api/license/token",
    async (
      req,
      reply,
    ): Promise<LicenseSetTokenResponse | unknown> => {
      const token = req.body?.token?.trim();
      if (!token) {
        return sendApiError(
          req,
          reply,
          400,
          "invalid_token",
          "Token is required",
        );
      }

      await validator.setToken(token);
      const res = await validator.getEffectiveLimits();
      return { ok: true, ...res };
    },
  );

  // Backward-compatible alias.
  app.post<{ Body: LicenseSetTokenRequest }>(
    "/api/license/setToken",
    async (
      req,
      reply,
    ): Promise<LicenseSetTokenResponse | unknown> => {
      const token = req.body?.token?.trim();
      if (!token) {
        return sendApiError(
          req,
          reply,
          400,
          "invalid_token",
          "Token is required",
        );
      }

      await validator.setToken(token);
      const res = await validator.getEffectiveLimits();
      return { ok: true, ...res };
    },
  );
}

