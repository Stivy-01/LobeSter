import type { FastifyInstance } from "fastify";
import type {
  ApplyPresetRequest,
  ApplyPresetResponse,
} from "@lobester/shared";
import {
  ApplyService,
  ApplyServiceError,
} from "../services/applyService.js";
import { sendApiError } from "../services/apiError.js";

export async function registerOpenClawRoutes(app: FastifyInstance) {
  const service = new ApplyService();

  app.post<{ Body: ApplyPresetRequest }>(
    "/api/openclaw/applyPreset",
    async (
      req,
      reply,
    ): Promise<ApplyPresetResponse | unknown> => {
      const presetRef =
        req.body?.presetRef ??
        (req.body as { presetId?: string } | undefined)?.presetId;
      if (!presetRef || typeof presetRef !== "string") {
        return sendApiError(
          req,
          reply,
          400,
          "invalid_request",
          "Missing presetRef",
        );
      }

      try {
        const result = await service.applyPreset(presetRef);
        return result.response;
      } catch (error) {
        if (error instanceof ApplyServiceError) {
          return sendApiError(
            req,
            reply,
            error.statusCode,
            error.code,
            error.message,
            error.details,
          );
        }
        return sendApiError(
          req,
          reply,
          500,
          "internal_error",
          error instanceof Error
            ? error.message
            : "Failed to apply preset",
        );
      }
    },
  );
}

