// The contract section 2 builds against (plan.md § 1). Types only: no logic, so every part of
// the digest can start here before the reader is done.
export type RunStatus = 'ok' | 'retry' | 'fail';

// One row per job for one night. Times keep the offset from the log; never converted (styleguide).
export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: RunStatus;
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

export type Digest = {
  night: string;
  rows: DigestRow[];
  // Lines that did not parse. Counted, never thrown: the night still renders.
  badLines: number;
};

// null when runs/<night>.jsonl is not there; the route turns that into a 404.
export type ReadNight = (runsDir: string, night: string) => Digest | null;
