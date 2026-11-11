// Seeded balance table (design section 7): seeds 0–199, 60 days, three strategies.
// Writes reports/balance.json and prints JS vs the Python reference values.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { batch, summarise } from '../tests/strategies.js';
const py = JSON.parse(await readFile(new URL('../tests/fixtures/python-seeds-0-199.json', import.meta.url), 'utf8')).results;
const keys = [['survive60_pct','survive60_pct'],['wipeout_by60_pct','wipeout_by60_pct'],['death_by60_pct','death_by60_pct'],
  ['bonfire_by60_pct','bonfire_by60_pct'],['median_bonfire_day','median_bonfire_day_among_discoverers'],['cap_by60_pct','cap_by60_pct'],
  ['mean_deaths60','mean_deaths60'],['mean_population60','mean_population60_all_runs']];
const table = [], report = {};
for (const mode of ['none', 'helped', 'cruel']) {
  const js = summarise(batch(mode)); report[mode] = { js, python: py[mode] };
  for (const [k, pk] of keys) table.push({ strategy: mode, metric: k, js: js[k], python: py[mode][pk], match: js[k] === py[mode][pk] });
}
await mkdir(new URL('../reports/', import.meta.url), { recursive: true });
await writeFile(new URL('../reports/balance.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.table(table);
const ok = table.every(r => r.match);
console.log(ok ? 'MATCH: JS equals the Python reference on every metric.' : 'MISMATCH: see table.');
process.exitCode = ok ? 0 : 1;
