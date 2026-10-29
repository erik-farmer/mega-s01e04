import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseLine } from './read.js';

export type StatusCounts = { ok: number; retry: number; fail: number };

// Lines per status over the whole night (not per job). Bad lines count in no status.
export function countStatuses(runsDir: string, night: string): StatusCounts {
  const counts: StatusCounts = { ok: 0, retry: 0, fail: 0 };
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch {
    return counts;
  }
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    const r = parseLine(line);
    if (r) counts[r.status]++;
  }
  return counts;
}
