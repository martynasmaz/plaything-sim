// Seeded balance tables, JS vs the Python reference values:
//  1. v0.1 rules, personalities off, seeds 0–199 (tests/fixtures/python-seeds-0-199.json)
//  2. v0.2 + personalities, seeds 0–199 (tests/fixtures/python-v02-traits-seeds-0-199.json)
//  3. v0.2 + personalities, seeds 0–499, against PYTHON_V02_500 (default
//     /workspace/sim/results_v02_traits_500.json) when that file exists.
// Writes reports/balance.json.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { batch, summarise, V01 } from '../tests/strategies.js';
const load = async url => JSON.parse(await readFile(url, 'utf8'));
const keys = [['survive60_pct','survive60_pct'],['wipeout_by60_pct','wipeout_by60_pct'],['median_wipeout_day','median_wipeout_day_among_wiped_by60'],
  ['death_by60_pct','death_by60_pct'],['bonfire_by60_pct','bonfire_by60_pct'],['median_bonfire_day','median_bonfire_day_among_discoverers'],
  ['cap_by60_pct','cap_by60_pct'],['mean_deaths60','mean_deaths60'],['mean_population60','mean_population60_all_runs']];
const v02keys = [...keys, ['median_cap_day','median_cap_day_among_reachers'],['farming_by60_pct','farming_by60_pct'],['median_farming_day','median_farming_day'],
  ['shed_by60_pct','shed_by60_pct'],['cap12_by60_pct','cap12_by60_pct'],['median_cap12_day','median_cap12_day']];
const report = {}; let ok = true;
async function compare(name, py, from, to, overrides, list) {
  const table = []; report[name] = {};
  for (const mode of ['none', 'helped', 'cruel']) {
    const js = summarise(batch(mode, from, to, overrides)); report[name][mode] = { js, python: py[mode] };
    for (const [k, pk] of list) if (pk in py[mode]) {
      const match = js[k] === py[mode][pk] || Math.abs(js[k] - py[mode][pk]) < 1e-9; ok &&= match;
      table.push({ strategy: mode, metric: k, js: js[k], python: py[mode][pk], match });
    }
  }
  console.log(`\n${name}`); console.table(table);
}
await compare('v0.1, traits off, seeds 0–199', (await load(new URL('../tests/fixtures/python-seeds-0-199.json', import.meta.url))).results, 0, 199, V01, keys);
await compare('v0.2 + traits, seeds 0–199', (await load(new URL('../tests/fixtures/python-v02-traits-seeds-0-199.json', import.meta.url))).results, 0, 199, {}, v02keys);
const big = process.env.PYTHON_V02_500 || '/workspace/sim/results_v02_traits_500.json';
if (existsSync(big)) await compare('v0.2 + traits, seeds 0–499 (design section 7)', (await load(big)).results, 0, 499, {}, v02keys);
else console.log(`\n(skipped seeds 0–499: ${big} not found)`);
await mkdir(new URL('../reports/', import.meta.url), { recursive: true });
await writeFile(new URL('../reports/balance.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(ok ? 'MATCH: JS equals the Python reference on every metric.' : 'MISMATCH: see tables.');
process.exitCode = ok ? 0 : 1;
