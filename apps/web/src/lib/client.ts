/**
 * Shared client utilities for the MendoraCI web app.
 *
 * `randomIdempotencyKey` exists because crypto.randomUUID() is only available
 * in secure contexts (https / http://localhost). When Playwright loads the
 * page via http://web:3000 inside the docker network it's non-secure and
 * crypto.randomUUID is undefined. CP-3d added a 3-tier fallback.
 */

/** Secure-context-safe UUID v4 idempotency key, prefixed with 'k-'. */
export function randomIdempotencyKey(): string {
  // Tier 1 — secure-context UUID
  try {
    const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
    if (c && typeof c.randomUUID === 'function') {
      return `k-${c.randomUUID()}`;
    }
  } catch {
    /* fall through */
  }
  // Tier 2 — getRandomValues + RFC 4122 v4 assembly (works in non-secure contexts)
  try {
    const c = (globalThis as {
      crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array };
    }).crypto;
    if (c && typeof c.getRandomValues === 'function') {
      const b = new Uint8Array(16);
      c.getRandomValues(b);
      b[6] = (b[6] & 0x0f) | 0x40;
      b[8] = (b[8] & 0x3f) | 0x80;
      const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
      return `k-${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
    }
  } catch {
    /* fall through */
  }
  // Tier 3 — last resort, valid v4 format
  const hex = (n: number) => Math.floor(Math.random() * n).toString(16);
  return `k-${hex(0xffffffff)}-${hex(0xffff)}-4${hex(0xfff)}-${(8 + Math.floor(Math.random() * 4)).toString(16)}${hex(0xfff)}-${hex(0xffffffffffff)}`;
}

/** Tenant ID for dev demos. Real impl pulls from session/JWT. */
export const DEMO_TENANT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
