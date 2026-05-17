import type { FastifyError, FastifyReply, FastifyRequest, FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { MaskBlockedError } from '@mendoraci/mask-policy';

/**
 * Centralised error handler.
 * Returns the common error envelope: `{ error: { code, message, validation_errors[]? } }`
 * Anchored to docs/MendoraCI_APIContractSpec.md — common conventions.
 *
 * Why bound to `this: FastifyInstance` — Fastify v5 passes the instance as `this`
 * when the handler is registered via setErrorHandler. We use it for logging.
 */
export function errorHandler(
  this: FastifyInstance,
  err: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  // 1. ZodError → 422 (deepest match, so check first).
  if (err instanceof ZodError) {
    reply.code(422).type('application/json').send({
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

  // 2. MaskBlockedError → 500 mask_engine_failure (TEST-024).
  if (err instanceof MaskBlockedError) {
    request.log.error({ reason: err.reason }, 'mask engine blocked submission');
    reply.code(500).type('application/json').send({
      error: {
        code: 'mask_engine_failure',
        message:
          'We could not safely mask secrets in this artifact. Submission blocked. Engineering notified.',
      },
    });
    return;
  }

  // 3. Fastify validation error (from JSON-schema layer, if used).
  const fe = err as FastifyError;
  if (fe.validation) {
    reply.code(422).type('application/json').send({
      error: {
        code: 'validation_failed',
        message: fe.message,
        validation_errors: fe.validation.map((v) => ({
          path: String(v.instancePath ?? v.schemaPath ?? ''),
          message: String(v.message ?? ''),
        })),
      },
    });
    return;
  }

  // 4. Fastify HTTP errors from @fastify/sensible (httpErrors.unauthorized, etc.)
  //    These come through with a statusCode in 4xx/5xx.
  if (typeof fe.statusCode === 'number' && fe.statusCode >= 400 && fe.statusCode < 600) {
    // Code precedence: explicit code → lowercase HTTP name → fallback http_NNN
    const code =
      (fe.code && fe.code !== 'FST_ERR_NOT_FOUND' ? fe.code.toLowerCase() : '') ||
      httpStatusToCode(fe.statusCode) ||
      `http_${fe.statusCode}`;

    reply.code(fe.statusCode).type('application/json').send({
      error: { code, message: fe.message },
    });
    return;
  }

  // 5. Unhandled — log + 500
  request.log.error({ err }, 'unhandled error');
  reply.code(500).type('application/json').send({
    error: { code: 'internal_error', message: 'internal_server_error' },
  });
}

function httpStatusToCode(s: number): string {
  switch (s) {
    case 400: return 'bad_request';
    case 401: return 'unauthorized';
    case 403: return 'forbidden';
    case 404: return 'not_found';
    case 409: return 'conflict';
    case 410: return 'gone';
    case 413: return 'payload_too_large';
    case 415: return 'unsupported_media_type';
    case 422: return 'validation_failed';
    case 429: return 'too_many_requests';
    default: return '';
  }
}
