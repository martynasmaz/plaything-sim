// Seeded build checks from design section 7 (survival rebalance).
// Seeds 0–199, 60 days each, for the untouched, helped and cruel strategies.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createState, queueCommand, stepDay, restart, advanceTime, setSpeed } from '../src/sim.js';
import { batch, summarise, playRun } from './strategies.js';

const PY = JSON.parse(readFileSync(new URL('./fixtures/python-seeds-0-199.json', import.meta.url)));
const runs = { none: batch('none'), helped: batch('helped'), cruel: batch('cruel') };
const result = Object.fromEntries(Object.entries(runs).map(([m, rows]) => [m, summarise(rows)]));

describe('Seeded build checks (seeds 0–199)', () => {
  test('untouched survival: ≥88% alive, ≤10% wiped, ≥65% lose someone, ≥85% Bonfire, median ≥ day 20', () => {
    const r = result.none;
    assert.ok(r.survive60_pct >= 88, JSON.stringify(r));
    assert.ok(r.wipeout_by60_pct <= 10, JSON.stringify(r));
    assert.ok(r.death_by60_pct >= 65, JSON.stringify(r));
    assert.ok(r.bonfire_by60_pct >= 85, JSON.stringify(r));
    assert.ok(r.median_bonfire_day >= 20, JSON.stringify(r));
  });
  test('helped strategy: ≥95% alive, ≥90% reach cap 8, ≤20% lose someone', () => {
    const r = result.helped;
    assert.ok(r.survive60_pct >= 95, JSON.stringify(r));
    assert.ok(r.cap_by60_pct >= 90, JSON.stringify(r));
    assert.ok(r.death_by60_pct <= 20, JSON.stringify(r));
  });
  test('cruel strategy: ≥90% wiped out by day 60', () => {
    assert.ok(result.cruel.wipeout_by60_pct >= 90, JSON.stringify(result.cruel));
  });
  test('every run matches the Python reference sim seed by seed', () => {
    for (const mode of ['none', 'helped', 'cruel']) runs[mode].forEach((row, i) => {
      assert.deepEqual(PY.fields.map(k => row[k]), PY.runs[mode][i], `${mode} seed ${row.seed}`);
    });
    for (const mode of ['none', 'helped', 'cruel']) {
      const p = PY.results[mode], j = result[mode];
      assert.equal(j.survive60_pct, p.survive60_pct); assert.equal(j.wipeout_by60_pct, p.wipeout_by60_pct);
      assert.equal(j.death_by60_pct, p.death_by60_pct); assert.equal(j.cap_by60_pct, p.cap_by60_pct);
    }
  });
});

describe('Seed replay and wipeout', () => {
  test('same seed + same commands on the same days → identical day-by-day log', () => {
    const play = () => {
      let s = createState({}, 291); const days = [];
      for (let d = 1; d <= 60 && !s.ended; d++) {
        if (d === 3) s = queueCommand(s, 'teach spark').state;
        if (d === 9) s = queueCommand(s, 'HOEDOWN').state;
        if (d === 15) s = queueCommand(s, 'sick hex').state;
        s = stepDay(s); days.push({ log: s.log, lastDay: s.lastDay, villagers: s.villagers, rng: s.rng });
      }
      return days;
    };
    assert.deepEqual(play(), play());
    assert.deepEqual(playRun(17, 'helped').history, playRun(17, 'helped').history);
    assert.notDeepEqual(playRun(1, 'none').history, playRun(2, 'none').history);
  });
  test('exactly three rolls every night, whether or not a command overrides', () => {
    let a = createState({}, 5), b = queueCommand(createState({}, 5), 'dry spell').state;
    for (let i = 0; i < 5; i++) { a = stepDay(a); b = stepDay(b); assert.equal(a.rng, b.rng); }
  });
  test('all at 60 health + sick hex: everyone dies on day 3, the loop stops, stats match', () => {
    let s = createState({ weather: { chances: { normal: 100, rain: 0, drought: 0, cold: 0 } }, illness: { chance: 0 } }, 9);
    for (const v of s.villagers) v.health = 60;
    s = queueCommand(s, 'sick hex').state; s = setSpeed(s, 3);
    s = stepDay(s); s = stepDay(s); assert.equal(s.ended, false);
    s = stepDay(s);
    assert.equal(s.ended, true); assert.equal(s.day, 3); assert.equal(s.villagers.length, 0);
    assert.deepEqual(s.stats, { peak: 6, births: 0, deaths: 6, fireDay: null });
    const frozen = structuredClone(s);
    assert.strictEqual(stepDay(s), s); assert.strictEqual(advanceTime(s, 1e9), s);
    assert.equal(queueCommand(s, 'hoedown').ok, false); assert.deepEqual(s, frozen); // no rolls, wonder or days
    const fresh = restart(s);
    assert.equal(fresh.day, 0); assert.equal(fresh.ended, false); assert.notEqual(fresh.seed, s.seed);
    assert.deepEqual(fresh.lastUsed, {}); assert.equal(fresh.fireKnown, false); assert.equal(fresh.villagers.length, 6);
  });
});
