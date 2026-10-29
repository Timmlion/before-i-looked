import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

const tmpRuns = (files: Record<string, string>): string => {
  const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
  return dir;
};

describe('readNight', () => {
  it('reads runs/2026-10-28.jsonl: 5 jobs, 1 bad line', () => {
    const digest = readNight('runs', '2026-10-28');
    expect(digest).not.toBeNull();
    expect(digest?.rows).toHaveLength(5);
    expect(digest?.badLines).toBe(1);
    expect(digest?.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('keeps a null owner as a row with no owner', () => {
    const row = readNight('runs', '2026-10-28')?.rows.find((r) => r.job === 'digest/render');
    expect(row?.owner).toBeNull();
    expect(row?.runs).toBe(1);
  });

  it('counts runs, retries, the last status and the last error per job', () => {
    const rows = readNight('runs', '2026-10-28')?.rows ?? [];
    const sync = rows.find((r) => r.job === 'lane/sync');
    expect(sync).toMatchObject({ runs: 8, retries: 1, lastStatus: 'ok', firstAt: '2026-10-28T23:00:06+01:00' });
    const refresh = rows.find((r) => r.job === 'fixtures/refresh');
    expect(refresh).toMatchObject({ runs: 4, retries: 3, lastStatus: 'ok', lastError: null });
    expect(rows.find((r) => r.job === 'notes/backup')).toMatchObject({
      lastStatus: 'fail',
      lastError: 'quota exceeded',
    });
  });

  it('returns null for a night with no file', () => {
    expect(readNight(tmpRuns({}), '2026-01-01')).toBeNull();
  });

  it('renders an empty file as an empty night, not a failure', () => {
    expect(readNight(tmpRuns({ '2026-01-02.jsonl': '' }), '2026-01-02')).toEqual({
      night: '2026-01-02',
      rows: [],
      badLines: 0,
    });
  });

  it('counts lines that do not parse and keeps the rest', () => {
    const dir = tmpRuns({
      '2026-01-03.jsonl': [
        '{"at":"2026-01-03T01:00:00+01:00","job":"a/one","status":"ok","owner":"rook"}',
        'not json',
        '{"at":"2026-01-03T01:01:00+01:00","job":"a/two","status":"nope","owner":"rook"}',
        '{"at":"2026-01-03T01:02:00+01:00","job":"a/one","status":"retry","owner":null}',
      ].join('\n'),
    });
    const digest = readNight(dir, '2026-01-03');
    expect(digest?.badLines).toBe(2);
    expect(digest?.rows).toHaveLength(1);
    expect(digest?.rows[0]).toMatchObject({ job: 'a/one', runs: 2, retries: 1, lastStatus: 'retry', owner: 'rook' });
  });
});
