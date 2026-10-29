import { readdirSync } from 'node:fs';
import type { RigConfig } from './config.js';
import { readNight } from './digest/read.js';
import type { RunStatus } from './digest/types.js';
import { lastBeat, type Beat } from './heartbeat.js';

// One night on the board: where its digest is, and how its jobs ended.
export type Night = { night: string; ok: number; retry: number; fail: number };

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: Night[];
};

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

// Counted through the reader the digest page uses, so the board cannot disagree with the page it
// links to. A file gone since the listing leaves no night to link: it is dropped.
function nightCounts(runsDir: string, night: string): Night | null {
  const digest = readNight(runsDir, night);
  if (digest === null) return null;
  const ended = (status: RunStatus) => digest.rows.filter((row) => row.lastStatus === status).length;
  return { night, ok: ended('ok'), retry: ended('retry'), fail: ended('fail') };
}

export function readStatus(config: RigConfig): Status {
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights: nightsOnDisk(config.runsDir).flatMap((night) => nightCounts(config.runsDir, night) ?? []),
  };
}
