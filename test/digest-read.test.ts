import { describe, expect, it } from 'vitest';
import { digest, readNight } from '../src/digest/read.js';

describe('readNight', () => {
  it('reads 2026-10-28: 5 jobs, 1 bad line', () => {
    const n = readNight('runs', '2026-10-28');
    expect(n).not.toBeNull();
    expect(n!.badLines).toBe(1);
    expect(n!.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    const refresh = n!.rows.find((r) => r.job === 'fixtures/refresh')!;
    expect(refresh).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
    expect(n!.rows.find((r) => r.job === 'notes/backup')!.lastStatus).toBe('fail');
    expect(n!.rows.find((r) => r.job === 'digest/render')!.owner).toBeNull();
  });

  it('returns null for a night with no file', () => {
    expect(readNight('runs', '2026-01-01')).toBeNull();
    expect(readNight('runs', '../package')).toBeNull();
  });

  it('an empty file is an empty night', () => {
    expect(digest('2026-10-30', '')).toEqual({ night: '2026-10-30', rows: [], badLines: 0 });
  });

  it('counts lines of the wrong shape as bad', () => {
    const n = digest('x', '{"at":"t","job":"a","status":"maybe","owner":null}\n[]\n{"at":"t","job":"a","status":"ok","owner":null}');
    expect(n.badLines).toBe(2);
    expect(n.rows).toHaveLength(1);
  });
});
