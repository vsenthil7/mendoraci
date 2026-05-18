import { describe, it, expect } from 'vitest';
import { encodeCursor, decodeCursor } from '../../src/lib/cursor.js';

/**
 * Unit tests for the CP-9.1b opaque cursor helper.
 *
 * Anchors: CP-9 list pagination, no RT row yet (plumbing for RT-007 analytics
 * + the 5 list endpoints).
 *
 * Cycle:
 *   TEST-CUR-1  roundtrip preserves ts + id when passed as ISO string
 *   TEST-CUR-2  roundtrip preserves ts + id when passed as Date
 *   TEST-CUR-3  decode rejects empty string
 *   TEST-CUR-4  decode rejects payload missing the | separator
 *   TEST-CUR-5  decode rejects payload with non-uuid id slot
 *   TEST-CUR-6  decode rejects payload with bad timestamp
 */

describe('cursor (CP-9.1b)', () => {
  const ts = '2026-05-18T03:32:00.000Z';
  const id = '01234567-89ab-4cde-8f01-23456789abcd';

  it('TEST-CUR-1: roundtrip preserves ts + id when ts is a string', () => {
    const cursor = encodeCursor(ts, id);
    expect(cursor).not.toContain('|'); // base64url has no |
    expect(cursor).not.toContain('+');
    expect(cursor).not.toContain('/');
    expect(cursor).not.toContain('=');
    const decoded = decodeCursor(cursor);
    expect(decoded).toEqual({ ts, id });
  });

  it('TEST-CUR-2: roundtrip preserves ts + id when ts is a Date', () => {
    const cursor = encodeCursor(new Date(ts), id);
    const decoded = decodeCursor(cursor);
    expect(decoded.ts).toBe(ts);
    expect(decoded.id).toBe(id);
  });

  it('TEST-CUR-3: decode rejects empty string', () => {
    expect(() => decodeCursor('')).toThrow(/cursor_empty/);
  });

  it('TEST-CUR-4: decode rejects payload missing the | separator', () => {
    const bad = Buffer.from('no-separator-here', 'utf8').toString('base64url');
    expect(() => decodeCursor(bad)).toThrow(/cursor_missing_separator/);
  });

  it('TEST-CUR-5: decode rejects payload with non-uuid id slot', () => {
    const bad = Buffer.from(`${ts}|not-a-uuid`, 'utf8').toString('base64url');
    expect(() => decodeCursor(bad)).toThrow(/cursor_bad_id/);
  });

  it('TEST-CUR-6: decode rejects payload with bad timestamp', () => {
    const bad = Buffer.from(`not-a-date|${id}`, 'utf8').toString('base64url');
    expect(() => decodeCursor(bad)).toThrow(/cursor_bad_timestamp/);
  });
});
