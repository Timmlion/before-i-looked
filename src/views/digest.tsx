import type { Digest, DigestRow } from '../digest/types.js';

// A row is marked when it retried three times or more, or ended on a failure. The stylesheet
// already has .warn for that; no new CSS.
const isWarn = (row: DigestRow) => row.retries >= 3 || row.lastStatus === 'fail';

// Missing data is never an empty cell (styleguide): an em dash, muted like the board does.
const dash = () => <span class="mute">—</span>;

export function DigestPage({ digest }: { digest: Digest }) {
  return (
    <>
      <h1>{digest.night}</h1>
      {digest.badLines > 0 && <p class="mute">{digest.badLines} lines did not parse</p>}
      {digest.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>last error</th>
              <th>first at</th>
              <th>last at</th>
            </tr>
          </thead>
          <tbody>
            {digest.rows.map((row) => (
              <tr class={isWarn(row) ? 'warn' : undefined}>
                <td>{row.job}</td>
                <td>{row.owner ?? dash()}</td>
                <td>{row.runs}</td>
                <td>{row.retries}</td>
                <td>{row.lastStatus}</td>
                <td>{row.lastError ?? dash()}</td>
                <td>{row.firstAt}</td>
                <td>{row.lastAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
