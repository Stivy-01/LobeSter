import type { FastifyInstance } from "fastify";
import type {
  PresetCreateRequest,
  PresetCreateResponse,
  PresetDeleteResponse,
  PresetListResponse,
  PresetUpdateRequest,
  PresetUpdateResponse,
} from "@lobester/shared";
import { PresetStore } from "../services/presetStore.js";
import { sendApiError } from "../services/apiError.js";

export async function registerPresetRoutes(app: FastifyInstance) {
  const store = new PresetStore();

  app.get(
    "/api/presets",
    async (): Promise<PresetListResponse> => {
      const presets = await store.list();
      return { ok: true, presets };
    },
  );

  app.post<{ Body: PresetCreateRequest }>(
    "/api/presets",
    async (
      req,
      reply,
    ): Promise<PresetCreateResponse | unknown> => {
      const body = req.body;
      if (
        !body?.name ||
        !Array.isArray(body.skillIds) ||
        body.name.trim().length === 0
      ) {
        return sendApiError(
          req,
          reply,
          400,
          "invalid_preset_payload",
          "Preset name and skillIds are required",
        );
      }

      const preset = await store.create({
        name: body.name,
        skillIds: body.skillIds,
        graph: body.graph,
      });
      return { ok: true, preset };
    },
  );

  app.patch<{
    Params: { id: string };
    Body: PresetUpdateRequest;
  }>(
    "/api/presets/:id",
    async (
      req,
      reply,
    ): Promise<PresetUpdateResponse | unknown> => {
      const updated = await store.update(req.params.id, req.body);
      if (!updated) {
        return sendApiError(
          req,
          reply,
          404,
          "preset_not_found",
          `Preset not found: ${req.params.id}`,
        );
      }
      return { ok: true, preset: updated };
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/api/presets/:id",
    async (
      req,
      reply,
    ): Promise<PresetDeleteResponse | unknown> => {
      const removed = await store.remove(req.params.id);
      if (!removed) {
        return sendApiError(
          req,
          reply,
          404,
          "preset_not_found",
          `Preset not found: ${req.params.id}`,
        );
      }
      return { ok: true, removedId: req.params.id };
    },
  );
}

