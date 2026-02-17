import type { FastifyReply, FastifyRequest } from "fastify";
import type { ApiError } from "@lobester/shared";

export function buildApiError(
  req: FastifyRequest,
  code: string,
  error: string,
  details?: unknown,
): ApiError {
  return {
    ok: false,
    code,
    error,
    requestId: req.id,
    ...(details === undefined ? {} : { details }),
  };
}

export function sendApiError(
  req: FastifyRequest,
  reply: FastifyReply,
  statusCode: number,
  code: string,
  error: string,
  details?: unknown,
) {
  return reply
    .code(statusCode)
    .send(buildApiError(req, code, error, details));
}

