import type { FastifyInstance } from "fastify";
import type {
  SkillInstallBatchRequest,
  SkillInstallBatchResponse,
  SkillInstallRequest,
  SkillListResponse,
  SkillRemoveResponse,
  SkillInstallResponse,
} from "@lobester/shared";
import { SkillStore } from "../services/skillStore.js";
import { sendApiError } from "../services/apiError.js";

export async function registerSkillRoutes(app: FastifyInstance) {
  const store = new SkillStore();

  app.get("/api/skills", async (): Promise<SkillListResponse> => {
    const skills = await store.list();
    return { ok: true, skills };
  });

  app.post<{ Body: SkillInstallRequest }>(
    "/api/skills/install",
    async (req, reply): Promise<SkillInstallResponse | unknown> => {
      const body = req.body;
      if (!body?.source?.kind || !body?.source?.ref) {
        return sendApiError(
          req,
          reply,
          400,
          "invalid_request",
          "Missing source.kind or source.ref",
        );
      }

      if (
        body.source.kind !== "local" &&
        body.source.kind !== "github"
      ) {
        return sendApiError(
          req,
          reply,
          400,
          "unsupported_source",
          "Only local and public github sources are supported",
        );
      }

      try {
        const skill = await store.install(body.source);
        return { ok: true, skill };
      } catch (error) {
        return sendApiError(
          req,
          reply,
          400,
          "skill_install_failed",
          error instanceof Error
            ? error.message
            : "Skill install failed",
        );
      }
    },
  );

  app.post<{ Body: SkillInstallBatchRequest }>(
    "/api/skills/install-local-batch",
    async (
      req,
      reply,
    ): Promise<SkillInstallBatchResponse | unknown> => {
      const body = req.body;
      if (!body?.rootPath || body.rootPath.trim().length === 0) {
        return sendApiError(
          req,
          reply,
          400,
          "invalid_request",
          "Missing rootPath",
        );
      }

      try {
        const results = await store.installLocalBatch(
          body.rootPath,
        );
        return { ok: true, results };
      } catch (error) {
        return sendApiError(
          req,
          reply,
          400,
          "skill_batch_install_failed",
          error instanceof Error
            ? error.message
            : "Skill batch install failed",
        );
      }
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/api/skills/:id",
    async (req, reply): Promise<SkillRemoveResponse | unknown> => {
      const removed = await store.remove(req.params.id);
      if (!removed) {
        return sendApiError(
          req,
          reply,
          404,
          "skill_not_found",
          `Skill not found: ${req.params.id}`,
        );
      }
      return { ok: true, removedId: req.params.id };
    },
  );
}

