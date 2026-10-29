import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { readNight } from './digest/read.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { DigestPage } from './views/digest.js';
import { Layout } from './views/layout.js';
import { StatusBoard } from './views/status.js';

// The night is a path segment, so it is checked at the edge: never a path anywhere else on disk.
const NIGHT = /^\d{4}-\d{2}-\d{2}$/;

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/', (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config)} />
      </Layout>,
    ),
  );

  app.get('/digest/:night', (c) => {
    const night = c.req.param('night');
    if (!NIGHT.test(night)) return c.notFound();

    const digest = readNight(config.runsDir, night);
    if (digest === null) return c.notFound();

    return c.html(
      <Layout title={`digest ${digest.night}`} lane={lane()}>
        <DigestPage digest={digest} />
      </Layout>,
    );
  });

  // Agents read this one. It is the same Digest the page renders, unsorted and unshaped here, so
  // the two cannot disagree.
  app.get('/api/digest/:night', (c) => {
    const night = c.req.param('night');
    if (!NIGHT.test(night)) return c.notFound();

    const digest = readNight(config.runsDir, night);
    if (digest === null) return c.notFound();

    return c.json(digest);
  });

  return app;
}
