/**
 * Cursor encoding for CP-9 list endpoints.
 *
 * A cursor is an opaque base64url-encoded string carrying the *last seen* row's
 * (created_at, primary_key_uuid). Pagination resumes by selecting rows strictly
 * "older" than the cursor under the canonical ordering:
 *
 *   ORDER BY created_at DESC, id DESC
 *
 * Why opaque base64url:
 *   - Clients shouldn't depend on the format - leaves us free to add fields
 *   - URL-safe out of the box (no +/= escaping in query strings)
 *   - Cheap to validate: a bad cursor returns 400 invalid_cursor, never a 500
 *
 * Why (ts, id) not just ts:
 *   - Multiple rows can share a millisecond (especially in burst tests). Sort
 *     by id as a deterministic tiebreaker so pagination never skips or repeats.
 *
 * Why we don't sign cursors:
 *   - Cursors are tenant-scoped by RLS at query time. Even if a client crafts
 *     a cursor referencing tenant B's data, the resulting SELECT runs under
 *     tenant A's `app.tenant_id` SET LOCAL and the WHERE clause matches
 *     nothing. A signature would add complexity without security benefit.
 *
 * Test anchors: see apps/api/test/unit/cursor.test.ts
 *   TEST-CUR-1  roundtrip preserves ts + id
 *   TEST-CUR-2  decode rejects non-base64 string with thrown Error
 *   TEST-CUR-3  decode rejects payload missing the | separator
 *   TEST-CUR-4  decode rejects payload with invalid uuid in id slot
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface DecodedCursor {
  ts: string; // ISO 8601
  id: string; // uuid
}

/**
 * Encode `(created_at, id)` into an opaque base64url cursor.
 * Used by list routes to mint `next_cursor` for the last row of each page.
 */
export function encodeCursor(ts: string | Date, id: string): string {
  const tsStr = ts instanceof Date ? ts.toISOString() : ts;
  // Buffer.from supports base64url since Node 16
  return Buffer.from(`${tsStr}|${id}`, 'utf8').toString('base64url');
}

/**
 * Decode a cursor minted by `encodeCursor`. Throws if the cursor is
 * malformed (bad base64, missing separator, non-uuid id, non-ISO timestamp).
 * Callers should catch and return 400 invalid_cursor.
 */
export function decodeCursor(cursor: string): DecodedCursor {
  if (typeof cursor !== 'string' || cursor.length === 0) {
    throw new Error('cursor_empty');
  }
  let raw: string;
  try {
    raw = Buffer.from(cursor, 'base64url').toString('utf8');
  } catch {
    throw new Error('cursor_bad_base64');
  }
  const sep = raw.indexOf('|');
  if (sep === -1) throw new Error('cursor_missing_separator');
  const ts = raw.slice(0, sep);
  const id = raw.slice(sep + 1);
  if (!UUID_RE.test(id)) throw new Error('cursor_bad_id');
  // Lightweight ISO 8601 check - Date.parse handles trailing Z, +00:00, etc.
  const parsed = Date.parse(ts);
  if (Number.isNaN(parsed)) throw new Error('cursor_bad_timestamp');
  return { ts, id };
}
