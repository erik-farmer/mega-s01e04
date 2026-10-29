import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Night } from '../src/digest/types.js';

const line = (at: string, job: string, status: string, error?: string) =>
  JSON.stringify({ at, job, status, owner: null, ...(error ? { error } : {}) });

let tmp: string;
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rig-runs-'));
  // Normal night: written out of job order on purpose. mail-flush retries x3 then ok; backup ends in fail.
  fs.writeFileSync(
    path.join(tmp, '2026-01-01.jsonl'),
    [
      line('2026-01-01T02:00:00+01:00', 'mail-flush', 'retry'),
      line('2026-01-01T02:01:00+01:00', 'mail-flush', 'retry'),
      line('2026-01-01T02:02:00+01:00', 'mail-flush', 'retry'),
      line('2026-01-01T02:03:00+01:00', 'mail-flush', 'ok'),
      line('2026-01-01T03:00:00+01:00', 'cleanup', 'ok'),
      line('2026-01-01T01:00:00+01:00', 'backup', 'ok'),
      line('2026-01-01T04:00:00+01:00', 'backup', 'fail', 'disk full'),
    ].join('\n') + '\n',
  );
  fs.writeFileSync(path.join(tmp, '2026-01-02.jsonl'), '');
  fs.writeFileSync(
    path.join(tmp, '2026-01-03.jsonl'),
    [line('2026-01-03T02:00:00+01:00', 'zeta', 'ok'), 'not json at all {', line('2026-01-03T02:05:00+01:00', 'alpha', 'ok')].join('\n') + '\n',
  );
  app = createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: tmp });
});

afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

// The <tr> chunk of the page that mentions this job.
const rowOf = (html: string, job: string) => html.split('<tr').find((r) => r.includes(job)) ?? '';

describe('GET /digest/:night', () => {
  it('200 with a table of jobs sorted by job', async () => {
    const res = await app.request('/digest/2026-01-01');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('<table');
    const at = ['backup', 'cleanup', 'mail-flush'].map((j) => html.indexOf(j));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect(at).toEqual([...at].sort((a, b) => a - b));
  });

  it('marks retries >= 3 and fail as warn, and leaves a clean job alone', async () => {
    const html = await (await app.request('/digest/2026-01-01')).text();
    expect(rowOf(html, 'mail-flush')).toContain('warn');
    expect(rowOf(html, 'backup')).toContain('warn');
    expect(rowOf(html, 'cleanup')).not.toContain('warn');
  });

  it('404 as HTML for a night with no file', async () => {
    const res = await app.request('/digest/2026-02-02');
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('text/html');
  });

  it('renders "nothing ran" for an empty night', async () => {
    const res = await app.request('/digest/2026-01-02');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('still renders 200 with the good jobs when a line is bad', async () => {
    const res = await app.request('/digest/2026-01-03');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('alpha');
    expect(html).toContain('zeta');
  });
});

describe('GET /api/digest/:night', () => {
  it('200 with the Night object, rows sorted by job', async () => {
    const res = await app.request('/api/digest/2026-01-01');
    const night = (await res.json()) as Night;
    expect(res.status).toBe(200);
    expect(night.night).toBe('2026-01-01');
    expect(night.badLines).toBe(0);
    expect(night.rows.map((r) => r.job)).toEqual(['backup', 'cleanup', 'mail-flush']);
    expect(night.rows.find((r) => r.job === 'mail-flush')?.retries).toBe(3);
    expect(night.rows.find((r) => r.job === 'backup')?.lastStatus).toBe('fail');
  });

  it('404 with JSON error for a night with no file', async () => {
    const res = await app.request('/api/digest/2026-02-02');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no run log', night: '2026-02-02' });
  });

  it('empty night gives rows: []', async () => {
    const res = await app.request('/api/digest/2026-01-02');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ night: '2026-01-02', rows: [], badLines: 0 });
  });

  it('counts the bad line and keeps the good rows', async () => {
    const night = (await (await app.request('/api/digest/2026-01-03')).json()) as Night;
    expect(night.badLines).toBe(1);
    expect(night.rows.map((r) => r.job)).toEqual(['alpha', 'zeta']);
  });
});

describe('page and JSON agree', () => {
  it('job order in the JSON equals the order in the page table', async () => {
    for (const n of ['2026-01-01', '2026-01-03']) {
      const night = (await (await app.request(`/api/digest/${n}`)).json()) as Night;
      const html = await (await app.request(`/digest/${n}`)).text();
      const jobs = night.rows.map((r) => r.job);
      const pageOrder = [...jobs].sort((a, b) => html.indexOf(a) - html.indexOf(b));
      expect(pageOrder).toEqual(jobs);
    }
  });
});
