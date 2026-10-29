import { describe, expect, it } from 'vitest';
import { countStatuses } from '../src/digest/counts.js';

describe('countStatuses', () => {
  it('counts lines by status for 2026-10-28, skipping the bad line', () => {
    expect(countStatuses('runs', '2026-10-28')).toEqual({ ok: 10, retry: 4, fail: 1 });
  });

  it('gives zeros for a missing night', () => {
    expect(countStatuses('runs', '1999-01-01')).toEqual({ ok: 0, retry: 0, fail: 0 });
  });
});
