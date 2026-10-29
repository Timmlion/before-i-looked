import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Digest } from '../src/digest/types.js';

// Every test builds its own config: loadConfig() reads rig.json from the cwd, and runs/ stays read-only.
const config = (runsDir: string) => ({
  adapter: 'shim',
  installed: '2026-10-29T14:06:00+01:00',
  beatEverySeconds: 60,
  runsDir,
});

const tmpRuns = (files: Record<string, string>): string => {
  const dir = mkdtempSync(join(tmpdir(), 'rig-routes-'));
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
  return dir;
};

// The table body as it really rendered: each row's attributes and its raw cell HTML, in order.
const tableRows = (html: string): { attr: string; cells: string[] }[] =>
  [...(html.match(/<tbody>[\s\S]*<\/tbody>/)?.[0] ?? '').matchAll(/<tr([^>]*)>([\s\S]*?)<\/tr>/g)].map((row) => ({
    attr: row[1],
    cells: [...row[2].matchAll(/<td>([\s\S]*?)<\/td>/g)].map((cell) => cell[1]),
  }));

const jobs = (html: string): string[] => tableRows(html).map((row) => row.cells[0]);
const warnedJobs = (html: string): string[] =>
  tableRows(html)
    .filter((row) => row.attr.includes('class="warn"'))
    .map((row) => row.cells[0]);

const get = async (runsDir: string, path: string) => createApp(config(runsDir)).request(path);

const statuses = async (runsDir: string, night: string): Promise<number[]> =>
  Promise.all(
    [`/digest/${night}`, `/api/digest/${night}`].map(async (path) => (await get(runsDir, path)).status),
  );

describe('digest routes', () => {
  it('renders runs/2026-10-28: 5 jobs, 2 warned, a dash for the null owner', async () => {
    const res = await get('runs', '/digest/2026-10-28');
    expect(res.status).toBe(200);
    const html = await res.text();

    expect(jobs(html)).toEqual(['digest/render', 'fixtures/refresh', 'lane/sync', 'notes/backup', 'rig/rotate-logs']);
    expect(warnedJobs(html)).toEqual(['fixtures/refresh', 'notes/backup']);
    expect(tableRows(html)[0].cells[1]).toBe('<span class="mute">—</span>');
  });

  it('answers the JSON with the same 5 jobs, in the same order as the page', async () => {
    const page = await (await get('runs', '/digest/2026-10-28')).text();
    const res = await get('runs', '/api/digest/2026-10-28');
    expect(res.status).toBe(200);
    const digest = (await res.json()) as Digest;

    expect(digest.night).toBe('2026-10-28');
    expect(digest.rows.map((row) => row.job)).toEqual(jobs(page));
    expect(digest.badLines).toBe(1);
  });

  it('404s a night with no file, on both routes', async () => {
    expect(await statuses('runs', '2026-01-01')).toEqual([404, 404]);
  });

  it('404s a path segment that is not a night, on both routes', async () => {
    expect(await statuses('runs', 'not-a-date')).toEqual([404, 404]);
  });

  it('renders the empty night as "nothing ran", not as a failure', async () => {
    const dir = tmpRuns({ '2026-01-02.jsonl': '' });

    const res = await get(dir, '/digest/2026-01-02');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('nothing ran');
    expect(tableRows(html)).toEqual([]);

    const api = await get(dir, '/api/digest/2026-01-02');
    expect(api.status).toBe(200);
    expect(await api.json()).toEqual({ night: '2026-01-02', rows: [], badLines: 0 });
  });

  it('renders a night with a bad line and counts it in the JSON', async () => {
    const dir = tmpRuns({
      '2026-01-03.jsonl': [
        '{"at":"2026-01-03T01:00:00+01:00","job":"a/one","status":"ok","owner":"rook"}',
        'not json',
      ].join('\n'),
    });

    const res = await get(dir, '/digest/2026-01-03');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('lines did not parse');
    expect(jobs(html)).toEqual(['a/one']);

    const api = await get(dir, '/api/digest/2026-01-03');
    expect(api.status).toBe(200);
    const digest = (await api.json()) as Digest;
    expect(digest.badLines).toBe(1);
    expect(digest.rows).toHaveLength(1);
    expect(digest.rows[0].job).toBe('a/one');
  });
});
