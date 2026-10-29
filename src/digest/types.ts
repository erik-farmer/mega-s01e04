// Plan morning-digest § 1. The contract every part of § 2 builds against.

export type RunStatus = 'ok' | 'retry' | 'fail';

// One job's night, from its lines in runs/<night>.jsonl. Times keep the log's offset.
export type DigestRow = {
  job: string;
  owner: string | null; // null in the log; views show it as `—`
  runs: number; // lines for this job
  retries: number; // lines with status `retry`
  lastStatus: RunStatus;
  lastError: string | null; // the last `error` seen for this job, if any
  firstAt: string;
  lastAt: string;
};

export type Night = {
  night: string; // YYYY-MM-DD
  rows: DigestRow[]; // sorted by job
  badLines: number; // lines that didn't parse; counted, never thrown
};

// null when runs/<night>.jsonl doesn't exist (routes answer 404). An empty file gives rows: [].
export type ReadNight = (runsDir: string, night: string) => Night | null;
