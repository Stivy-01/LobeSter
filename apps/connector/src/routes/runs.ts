import type { FastifyInstance } from "fastify";
import type {
  RunCreateRequest,
  RunCreateResponse,
  RunListResponse,
  RunUpdateRequest,
  RunUpdateResponse,
} from "@lobester/shared";
import { sendApiError } from "../services/apiError.js";
import { RunStore } from "../services/runStore.js";

export async function registerRunRoutes(app: FastifyInstance) {
  const store = new RunStore();

  app.get("/api/runs", async (): Promise<RunListResponse> => {
    const runs = await store.list();
    return { ok: true, runs };
  });

  app.post<{ Body: RunCreateRequest }>(
    "/api/runs",
    async (
      req,
      reply,
    ): Promise<RunCreateResponse | unknown> => {
      const body = req.body;
      if (!body?.title || !body?.presetId) {
        return sendApiError(
          req,
          reply,
          400,
          "invalid_run_payload",
          "Run title and presetId are required",
        );
      }

      const run = await store.create(body);
      return { ok: true, run };
    },
  );

  app.patch<{
    Params: { id: string };
    Body: RunUpdateRequest;
  }>(
    "/api/runs/:id",
    async (
      req,
      reply,
    ): Promise<RunUpdateResponse | unknown> => {
      const run = await store.update(req.params.id, req.body);
      if (!run) {
        return sendApiError(
          req,
          reply,
          404,
          "run_not_found",
          `Run not found: ${req.params.id}`,
        );
      }
      return { ok: true, run };
    },
  );
}

