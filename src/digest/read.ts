import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, Night, ReadNight, RunStatus } from './types.js';

// One parsed line of runs/<night>.jsonl. Anything that doesn't fit this shape is a bad line.
type RunLine = { at: string; job: string; status: RunStatus; owner: string | null; error?: string };

const STATUSES: readonly string[] = ['ok', 'retry', 'fail'];

export function parseLine(line: string): RunLine | null {
  let v: unknown;
  try {
    v = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.at !== 'string' || typeof o.job !== 'string') return null;
  if (typeof o.status !== 'string' || !STATUSES.includes(o.status)) return null;
  if (o.owner !== null && typeof o.owner !== 'string') return null;
  if (o.error !== undefined && typeof o.error !== 'string') return null;
  return { at: o.at, job: o.job, status: o.status as RunStatus, owner: o.owner, error: o.error as string | undefined };
}

export function digest(night: string, text: string): Night {
  const byJob = new Map<string, DigestRow>();
  let badLines = 0;
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    const r = parseLine(line);
    if (!r) {
      badLines++;
      continue;
    }
    const row = byJob.get(r.job);
    if (!row) {
      byJob.set(r.job, {
        job: r.job,
        owner: r.owner,
        runs: 1,
        retries: r.status === 'retry' ? 1 : 0,
        lastStatus: r.status,
        lastError: r.error ?? null,
        firstAt: r.at,
        lastAt: r.at,
      });
      continue;
    }
    // Lines are in log order, so the latest line wins for last status and last time.
    row.runs++;
    if (r.status === 'retry') row.retries++;
    row.lastStatus = r.status;
    if (r.error !== undefined) row.lastError = r.error;
    row.lastAt = r.at;
    if (row.owner === null) row.owner = r.owner;
  }
  const rows = [...byJob.values()].sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  return { night, rows, badLines };
}

export const readNight: ReadNight = (runsDir, night) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) return null;
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch {
    return null;
  }
  return digest(night, text);
};
