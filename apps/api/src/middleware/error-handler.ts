import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { MaskBlockedError } from '@mendoraci/mask-policy';

/**
 * Centralised error handler.
 * Returns the common error envelope: `{ error: { code, message, validation_errors[]? } }`
 * Anchored to docs/MendoraCI_APIContractSpec.md — common conventions.
 */
export function errorHandler(
  err: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  // Zod validation errors → 422
  if (err instanceof ZodError) {
    reply.code(422).send({
      error: {
        code: 'validation_failed',
        message: 'request_body_invalid',
        validation_errors: err.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      },
    });
    return;
  }

  // MaskBlockedError → 500 mask_engine_failure (TEST-024)
  if (err instanceof MaskBlockedError) {
    request.log.error({ reason: err.reason }, 'mask engine blocked submission');
    reply.code(500).send({
      error: {
        code: 'mask_engine_failure',
        message: 'We could not safely mask secrets in this artifact. Submission blocked. Engineering notified.',
      },
    });
    return;
  }

  // Fastify HTTP errors (from @fastify/sensible httpErrors.*)
  const httpErr = err as FastifyError;
  if (typeof httpErr.statusCode === 'number' && httpErr.statusCode >= 400) {
    reply.code(httpErr.statusCode).send({
      error: {
        code: (httpErr.code ?? `http_${httpErr.statusCode}`).toLowerCase(),
        message: httpErr.message,
      },
    });
    return;
  }

  request.log.error({ err }, 'unhandled error');
  reply.code(500).send({
    error: { code: 'internal_error', message: 'internal_server_error' },
  });
}
