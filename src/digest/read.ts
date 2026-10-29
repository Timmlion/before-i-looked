import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Digest, DigestRow, ReadNight, RunStatus } from './types.js';

const STATUSES: RunStatus[] = ['ok', 'retry', 'fail'];

type Line = { at: string; job: string; status: RunStatus; owner: string | null; error: string | null };

// Parse one JSONL line at the edge; anything unexpected is a bad line, not a crash.
function parseLine(text: string): Line | null {
  const v: unknown = JSON.parse(text);
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.at !== 'string' || typeof o.job !== 'string') return null;
  if (!STATUSES.includes(o.status as RunStatus)) return null;
  if (o.owner !== null && o.owner !== undefined && typeof o.owner !== 'string') return null;
  if (o.error !== null && o.error !== undefined && typeof o.error !== 'string') return null;
  return {
    at: o.at,
    job: o.job,
    status: o.status as RunStatus,
    owner: (o.owner as string | null | undefined) ?? null,
    error: (o.error as string | null | undefined) ?? null,
  };
}

// A row is the job's final state; retries and runs keep what happened earlier. Lines are taken in
// file order — the log is append-only — so firstAt/lastAt are the first and last line seen.
export const readNight: ReadNight = (runsDir, night) => {
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch {
    return null;
  }

  const rows = new Map<string, DigestRow>();
  let badLines = 0;

  for (const raw of text.split('\n')) {
    if (raw.trim() === '') continue;
    let line: Line | null;
    try {
      line = parseLine(raw);
    } catch {
      line = null;
    }
    if (line === null) {
      badLines += 1;
      continue;
    }

    const row = rows.get(line.job);
    if (row === undefined) {
      rows.set(line.job, {
        job: line.job,
        owner: line.owner,
        runs: 1,
        retries: line.status === 'retry' ? 1 : 0,
        lastStatus: line.status,
        lastError: line.error,
        firstAt: line.at,
        lastAt: line.at,
      });
      continue;
    }
    row.runs += 1;
    if (line.status === 'retry') row.retries += 1;
    row.lastStatus = line.status;
    row.lastError = line.error;
    row.lastAt = line.at;
    if (line.owner !== null) row.owner = line.owner;
  }

  const digest: Digest = { night, rows: [...rows.values()].sort((a, b) => a.job.localeCompare(b.job)), badLines };
  return digest;
};
