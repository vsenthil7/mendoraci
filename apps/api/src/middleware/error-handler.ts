import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

/**
 * Centralised error handler.
 * Returns the common error envelope: `{ error: { code, message, validation_errors[]? } }`
 * Anchored to docs/MendoraCI_APIContractSpec.md — common conventions.
 *
 * CRITICAL: We use *duck typing* on error class names, NOT `instanceof` checks.
 * In a pnpm-workspace + compiled-dist + ESM setup, the `ZodError` class identity
 * imported from `zod` here can differ from the `ZodError` thrown out of
 * `@mendoraci/shared/dist` if a transitive copy of zod resolved to a different
 * location. `err.name === 'ZodError'` is robust across all such cases.
 */
export function errorHandler(
  err: FastifyError | Error | (Error & { issues?: unknown[]; reason?: string }),
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  const e = err as FastifyError & {
    name?: string;
    issues?: Array<{ path: (string | number)[]; message: string }>;
    reason?: string;
  };

  // 1. ZodError → 422 (duck-typed by name + issues array shape)
  if (e.name === 'ZodError' && Array.isArray(e.issues)) {
    reply.code(422).type('application/json').send({
      error: {
        code: 'validation_failed',
        message: 'request_body_invalid',
        validation_errors: e.issues.map((i) => ({
          path: Array.isArray(i.path) ? i.path.join('.') : String(i.path ?? ''),
          message: String(i.message ?? ''),
        })),
      },
    });
    return;
  }

  // 2. MaskBlockedError → 500 mask_engine_failure (TEST-024)
  if (e.name === 'MaskBlockedError') {
    request.log.error({ reason: e.reason }, 'mask engine blocked submission');
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
  if (e.validation) {
    reply.code(422).type('application/json').send({
      error: {
        code: 'validation_failed',
        message: e.message,
        validation_errors: e.validation.map((v) => ({
          path: String(v.instancePath ?? v.schemaPath ?? ''),
          message: String(v.message ?? ''),
        })),
      },
    });
    return;
  }

  // 4. Fastify HTTP errors (e.g. via @fastify/sensible). statusCode in 4xx/5xx.
  if (typeof e.statusCode === 'number' && e.statusCode >= 400 && e.statusCode < 600) {
    const code =
      (e.code && typeof e.code === 'string' && !e.code.startsWith('FST_')
        ? e.code.toLowerCase()
        : '') ||
      httpStatusToCode(e.statusCode) ||
      `http_${e.statusCode}`;
    reply.code(e.statusCode).type('application/json').send({
      error: { code, message: e.message },
    });
    return;
  }

  // 5. Unhandled → 500
  request.log.error({ err: e, name: e.name, message: e.message }, 'unhandled error');
  reply.code(500).type('application/json').send({
    error: {
      code: 'internal_error',
      message: process.env.NODE_ENV === 'production' ? 'internal_server_error' : (e.message ?? 'internal_server_error'),
    },
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
