// v0.2 rules and Gourdling personalities (design section 10, rule
// clarifications, section 11 matcher), checked against the reference sim
// /workspace/sim/gourdling_v02.py via tests/fixtures/python-v02-traits-seeds-0-199.json.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createState as seededState, queueCommand, queueText, stepDay, validateCommand, matchText,
  populationCap, fuelTarget, pickLogLines, creditTrait, mealPlan } from '../src/sim.js';
import { matchCommand, COMMAND_KEYWORDS, cleanWords } from '../src/commands.js';
import { CONFIG } from '../src/config.js';
import { batch, summarise, playRun, digests, V01 } from './strategies.js';

const PY = JSON.parse(readFileSync(new URL('./fixtures/python-v02-traits-seeds-0-199.json', import.meta.url)));
const TRAITS = CONFIG.personality.list;
// Rule tests: fair weather, no natural illness, and traits set by hand.
const FAIR = { weather: { chances: { normal: 100, rain: 0, drought: 0, cold: 0 } }, illness: { chance: 0 } };
const calm = (o = {}, seed = 1) => seededState({ ...FAIR, ...o }, seed);
const withTraits = (s, traits) => { s.villagers.forEach((v, i) => { v.traits = traits[i] ?? []; }); return s; };
const setWeather = (s, type) => { s.weather = { type, daysLeft: 9 }; return s; };

describe('Seeded build checks, v0.2 + traits (seeds 0–199, 60 days)', () => {
  const runs = Object.fromEntries(['none', 'helped', 'cruel'].map(m => [m, batch(m)]));
  test('every run matches the Python reference seed by seed (summary, day log, trait effects, kept log lines and their count, traits)', () => {
    for (const mode of ['none', 'helped', 'cruel']) runs[mode].forEach((r, i) => {
      const d = digests(r);
      const js = [r.wipeout_day, r.population30, r.population60, r.deaths30, r.deaths60, r.births60, r.peak_population,
        r.bonfire_day, r.cap_day, r.farming_day, r.cap12_day, r.shed_built, r.lines.length, d.history, d.events, d.lines, d.traits];
      assert.deepEqual(js, PY.runs[mode][i], `${mode} seed ${i}`);
    });
  });
  test('targets: untouched 94.0% alive, helped 100% alive, cruel 99.5% wiped out on seeds 0–199 (as Python)', () => {
    const r = Object.fromEntries(Object.entries(runs).map(([m, rows]) => [m, summarise(rows)]));
    for (const m of ['none', 'helped', 'cruel']) for (const k of ['survive60_pct', 'wipeout_by60_pct', 'death_by60_pct', 'cap_by60_pct', 'bonfire_by60_pct'])
      assert.equal(r[m][k], PY.results[m][k], `${m} ${k}`);
    assert.equal(r.none.survive60_pct, 94); assert.equal(r.helped.survive60_pct, 100); assert.equal(r.cruel.wipeout_by60_pct, 99.5);
    // v0.1 build-check thresholds still hold with traits on.
    assert.ok(r.none.survive60_pct >= 88 && r.none.wipeout_by60_pct <= 10 && r.none.death_by60_pct >= 65);
    assert.ok(r.helped.survive60_pct >= 95 && r.helped.cap_by60_pct >= 90 && r.cruel.wipeout_by60_pct >= 90);
  });
  test('natural farming never comes before day 44 (day 40 + 5 checks)', () => {
    for (const r of runs.none) assert.ok(r.farming_day === null || r.farming_day >= 44, String(r.farming_day));
  });
});

describe('Personality dice', () => {
  test('traits never move the three nightly rolls', () => {
    for (let seed = 0; seed < 50; seed++) {
      let a = seededState({ traits: false }, seed), b = seededState({}, seed);
      for (let d = 0; d < 40 && !a.ended && !b.ended; d++) {
        assert.deepEqual(a.natural, b.natural, `seed ${seed} day ${d}`); assert.equal(a.rng, b.rng);
        a = stepDay(a); b = stepDay(b);
      }
    }
  });
  test('2 trait draws per Gourdling, never both from one pair, all 40 combinations occur', () => {
    const combos = new Set();
    for (let seed = 0; seed < 300; seed++) {
      const r = playRun(seed, 'helped');
      for (const tr of Object.values(r.traitsById)) {
        const [a, b] = tr.map(x => TRAITS.indexOf(x));
        assert.ok(a !== b && (a ^ 1) !== b, tr.join('+')); combos.add([a, b].sort().join());
      }
    }
    assert.equal(combos.size, 40);
    // Seed 7 by hand: XOR seed, 8 warm-up steps, then 2 steps per starter.
    const lcg = n => (1664525 * n + 1013904223) % 4294967296;
    let r = (7 ^ 0x5EED7A17) >>> 0; for (let i = 0; i < 8; i++) r = lcg(r);
    for (const v of seededState({}, 7).villagers) {
      r = lcg(r); const f = Math.floor(r * 10 / 4294967296);
      const rest = TRAITS.filter((_, i) => i !== f && i !== (f ^ 1)); r = lcg(r);
      assert.deepEqual(v.traits, [TRAITS[f], rest[Math.floor(r * 8 / 4294967296)]]);
    }
  });
  test('exactly one behaviour roll per living Gourdling per day, plus 2 per newborn, and none after a wipeout', () => {
    const lcg = n => (1664525 * n + 1013904223) % 4294967296;
    let s = seededState({}, 11);
    for (let d = 0; d < 60 && !s.ended; d++) {
      const before = s.traitRng, living = s.villagers.length, next = stepDay(s);
      let expect = before; const steps = living + 2 * (next.stats.births - s.stats.births);
      for (let i = 0; i < steps; i++) expect = lcg(expect);
      assert.equal(next.lastDay.behaviourRolls.length, living); assert.equal(next.traitRng, expect, `day ${next.day}`);
      s = next;
    }
  });
  test('same seed + same commands → identical day-by-day log, internal log included', () => {
    const play = () => {
      let s = seededState({}, 291); const days = [];
      for (let d = 1; d <= 60 && !s.ended; d++) {
        if (d === 3) s = queueCommand(s, matchText(s, 'Light a fire, please!')).state;
        if (d === 12) s = queueCommand(s, matchText(s, 'let them sow seeds')).state;
        if (d === 20) s = queueCommand(s, 'sick hex').state;
        if (d === 22) s = queueCommand(s, matchText(s, 'cure them')).state;
        s = stepDay(s); days.push({ log: s.log, traitLog: s.traitLog, lastDay: s.lastDay, villagers: s.villagers, rng: s.rng, traitRng: s.traitRng });
      }
      return days;
    };
    const a = play(); assert.deepEqual(a, play());
    assert.ok(a.at(-1).traitLog.length > 6);
    const s = a.at(-1);
    const perDay = {}; for (const e of s.traitLog) if (!['start', 'birth'].includes(e.trait)) perDay[e.day] = (perDay[e.day] || 0) + 1;
    assert.ok(Object.values(perDay).every(n => n <= 3), 'at most 3 trait lines a day');
  });
});

describe('Trait effects', () => {
  test('Brave warms up only below 20 and Timid below 60 in rain or a cold snap; fair weather uses 40', () => {
    for (const [weather, warmth, brave, timid] of [['rain', 30, 'Forage', 'Warm up'], ['cold', 55, 'Forage', 'Warm up'], ['normal', 35, 'Warm up', 'Warm up']]) {
      let s = setWeather(withTraits(calm(), [['Brave', 'Loner'], ['Timid', 'Loner']]), weather);
      s.food = 0; s.villagers.forEach(v => { v.fullness = 100; });
      // Warmth before work = start + 10 shed − 10 daily − weather loss; set it so it lands on `warmth`.
      const loss = { rain: 10, cold: 40, normal: 0 }[weather];
      s.villagers.slice(0, 2).forEach(v => { v.warmth = warmth + loss; });
      s = stepDay(s);
      assert.equal(s.lastDay.actions.find(a => a.id === 1).action, brave, `Brave ${weather}`);
      assert.equal(s.lastDay.actions.find(a => a.id === 2).action, timid, `Timid ${weather}`);
    }
  });
  test('Hardy loses 35 in a cold snap; Shivery 20 in rain and 50 in a cold snap', () => {
    for (const [weather, hardy, shivery, plain] of [['cold', 35, 50, 40], ['rain', 10, 20, 10]]) {
      let s = setWeather(withTraits(calm(), [['Hardy', 'Smart'], ['Shivery', 'Smart'], []]), weather);
      s.villagers.forEach(v => { v.warmth = 100; });
      s = stepDay(s);
      const before = id => s.lastDay.beforeMeals.find(b => b.id === id).warmth;
      // A Warm-up action would add warmth; these start at 100 so nobody warms up.
      assert.equal(100 - before(1), hardy); assert.equal(100 - before(2), shivery); assert.equal(100 - before(3), plain);
    }
  });
  test('log rule 1: at most 3 lines a day, Generous, Grabby, Smart, Scatterbrained, Brave/Timid, then rest lines', () => {
    const pr = CONFIG.personality.logPriority, c = (trait, seq) => ({ priority: pr[trait], seq, trait });
    const pick = list => pickLogLines(list, 3).map(e => e.trait);
    assert.deepEqual(pick(['Loner', 'Sociable', 'Brave', 'Scatterbrained', 'Smart', 'Grabby', 'Generous'].map(c)), ['Generous', 'Grabby', 'Smart']);
    assert.deepEqual(pickLogLines([c('Sociable', 0), c('Timid', 1), c('Loner', 2), c('Sociable', 3)], 3).map(e => e.seq), [1, 0, 2]);
    assert.deepEqual(pick([c('Loner', 0)]), ['Loner']);
  });
  test('log rule 2: credit the trait that decided the final job (reference cases)', () => {
    const s = calm(), v = s.villagers[0];
    const credit = (traits, warmth, weather, die, action, plain) => { v.traits = traits; v.warmth = warmth; return creditTrait(s, v, weather, die, action, plain); };
    assert.equal(credit(['Brave', 'Scatterbrained'], 30, 'cold', 5, 'forage', 'warm'), 'Scatterbrained');
    assert.equal(credit(['Brave', 'Scatterbrained'], 30, 'cold', 50, 'forage', 'warm'), 'Brave');
    assert.equal(credit(['Brave', 'Smart'], 30, 'cold', 50, 'wood', 'warm'), 'Brave');
    assert.equal(credit(['Timid', 'Hardy'], 50, 'rain', 50, 'warm', 'forage'), 'Timid');
    assert.equal(credit(['Timid', 'Smart'], 30, 'rain', 50, 'warm', 'warm'), null);
    assert.equal(credit(['Brave', 'Smart'], 30, 'normal', 50, 'wood', 'forage'), 'Smart');
    assert.equal(credit(['Scatterbrained', 'Hardy'], 80, 'normal', 3, 'forage', 'forage'), null);
  });
  test('log rule 3: the Grabby line uses a re-run of the meal with every Grabby treated as normal', () => {
    const none = () => false;
    assert.deepEqual(mealPlan([1, 2], { 1: 85, 2: 75 }, { 1: 80, 2: 70 }, 1, none).fed, [1]);
    assert.deepEqual(mealPlan([1, 2], { 1: 75, 2: 75 }, { 1: 80, 2: 70 }, 1, none).fed, [2]); // 2 went without → line
    assert.deepEqual(mealPlan([1, 2], { 1: 85, 2: 75 }, { 1: 60, 2: 70 }, 1, none).fed, [1]);
    assert.deepEqual(mealPlan([1, 2], { 1: 75, 2: 75 }, { 1: 60, 2: 70 }, 1, none).fed, [1]); // same → no line
    // In a full day: a Grabby who takes the last provision names who went without.
    let s = setWeather(withTraits(calm(), [['Grabby', 'Hardy']]), 'drought');
    s.villagers.forEach(v => { v.fullness = 85; v.warmth = 100; });
    s.villagers.slice(1).forEach(v => { v.warmth = 0; }); // only #1 forages: 1 provision at supper
    s.food = 0; s.wood = 50;
    // Day 2 rotation starts at #2, so the normal order would feed #2; Grabby #1 eats first instead.
    s.day = 1; s = stepDay(s);
    assert.deepEqual(s.lastDay.meals, [1]);
    const line = s.traitLog.find(e => e.trait === 'Grabby-others-went-without');
    assert.ok(line && line.id === 1 && /Ada \(Grabby\) was first at the Pantry; Bram went without/.test(line.text), JSON.stringify(s.traitLog.slice(-3)));
    // Plenty of food: eating early logs nothing.
    let p = withTraits(calm(), [['Grabby', 'Hardy']]); p.food = 100; p.wood = 50;
    p.villagers.forEach(v => { v.fullness = 85; v.warmth = 100; }); p = stepDay(p);
    assert.ok(!p.traitLog.some(e => e.trait.startsWith('Grabby')));
  });
  test('Generous goes without when provisions are fewer than the hungry still waiting (self included)', () => {
    const day = food => {
      let s = setWeather(withTraits(calm(), [['Generous', 'Hardy']]), 'drought');
      s.villagers.forEach(v => { v.fullness = 85; v.warmth = 100; }); // 60 at supper: all six hungry
      s.villagers[1].warmth = 0; // one warms up instead of foraging → 5 adults bring 1 each
      s.food = food; s.wood = 50;
      return stepDay(s);
    };
    const short = day(0); // 5 provisions < 6 waiting, Generous at 60 ≥ 50 → skips
    assert.ok(!short.lastDay.meals.includes(1)); assert.equal(short.lastDay.meals.length, 5);
    assert.ok(short.traitLog.some(e => e.trait === 'Generous' && /went without supper/.test(e.text)));
    const enough = day(1); // 6 provisions: nobody needs to go without
    assert.ok(enough.lastDay.meals.includes(1)); assert.equal(enough.lastDay.meals.length, 6);
  });
  test('Sociable and Loner: +8/+2 resting together or alone; everyone else +5', () => {
    let s = withTraits(calm(), [['Sociable', 'Hardy'], ['Loner', 'Hardy']]);
    s.food = 100; s.wood = 50; s.villagers.forEach(v => { v.happiness = 50; v.fullness = 100; v.warmth = 100; });
    s = stepDay(s); // everyone rests together
    const gain = id => s.lastDay.actions.find(a => a.id === id).gained;
    assert.equal(gain(1), 8); assert.equal(gain(2), 2); assert.equal(gain(3), 5);
  });
  test('Smart gathers firewood when its gap is bigger, falls through to Plant then Rest when nothing is low', () => {
    let s = withTraits(calm({ version: 'v0.2' }), [['Smart', 'Hardy']]);
    s.villagers.forEach(v => { v.fullness = 100; v.warmth = 100; });
    s.food = 23; s.wood = 0; // food gap 1/24, wood gap 6/6 (after nothing burns)
    s = stepDay(s);
    assert.equal(s.lastDay.actions.find(a => a.id === 1).action, 'Gather wood');
    assert.ok(s.traitLog.some(e => e.trait === 'Smart'));
  });
  test('Scatterbrained: rolls of 1–20 pick a random job after warming up', () => {
    let found = 0;
    for (let seed = 0; seed < 40; seed++) {
      let s = withTraits(calm({}, seed), [['Scatterbrained', 'Hardy']]);
      s.food = 100; s.wood = 50; s.villagers.forEach(v => { v.fullness = 100; v.warmth = 100; });
      s = stepDay(s);
      const die = s.lastDay.behaviourRolls[s.lastDay.visitOrder.indexOf(1)], act = s.lastDay.actions.find(a => a.id === 1).action;
      assert.equal(act, die <= 7 ? 'Forage' : die <= 14 ? 'Gather wood' : 'Rest', `die ${die}`);
      if (die <= 14) found++;
    }
    assert.ok(found > 0);
  });
});

describe('v0.2 rules', () => {
  test('teach sowing: field of 4 plots at once, once per run; v0.1 refuses it', () => {
    assert.equal(validateCommand(calm(V01), 'teach sowing').ok, false);
    let s = calm({ version: 'v0.2', traits: false });
    s = stepDay(queueCommand(s, 'teach sowing').state);
    // The field appears at once, so adults already plant on the same day.
    assert.equal(s.farming.known, true); assert.equal(s.farming.plots.length, 4);
    assert.equal(s.farming.plots.filter(x => x !== null).length, s.lastDay.plantings);
    assert.equal(s.power, 50 - 25 + 3 + 2); assert.equal(s.stats.farmDay, 1); // +2: average happiness ≥ 60
    assert.equal(queueCommand(s, 'teach farming').ok, false);
  });
  test('crops: planted today grows today; fair +1, rain +2, dry 0, cold −2 (never below 0); ripe plots are harvested for +8', () => {
    let s = calm({ version: 'v0.2', traits: false }); s.farming.known = true;
    s.farming.plots = [3, 3, 3, 3]; s = stepDay(setWeather(s, 'cold')); assert.deepEqual(s.farming.plots, [1, 1, 1, 1]);
    s.farming.plots = [0, 5, 6, null]; s.food = 30; s = stepDay(setWeather(s, 'rain'));
    assert.ok(!s.farming.plots.includes(6) || s.lastDay.harvests > 0);
    let p = calm({ version: 'v0.2', traits: false }); p.farming.known = true; p.farming.plots = [null, null, null, null];
    p.food = 40; p.wood = 50; p.villagers.forEach(v => { v.fullness = 100; v.warmth = 100; });
    p = stepDay(p);
    assert.ok(p.lastDay.plantings >= 1); assert.ok(p.farming.plots.filter(x => x === 1).length === p.lastDay.plantings);
  });
  test('shake off clears all illness, restores no health, 6-day cooldown; refused when nobody is ill', () => {
    let s = calm({ version: 'v0.2', traits: false });
    assert.equal(validateCommand(s, 'shake off').ok, false);
    s = stepDay(queueCommand(s, 'sick hex').state); s.power = 100;
    const health = s.villagers.map(v => v.health);
    s = stepDay(queueCommand(s, 'heal').state);
    assert.ok(s.villagers.every(v => v.illnessDays === 0));
    assert.deepEqual(s.villagers.map(v => v.health), health.map(h => Math.min(100, h + 4)).map((h, i) => s.villagers[i].health));
    assert.equal(s.lastUsed.heal, 2);
  });
  test('second shed: paid after births at day end, stands next day, cap 8 → 12', () => {
    let s = calm({ version: 'v0.2', traits: false }); s.farming.known = true; s.farming.plots = [null, null, null, null]; s.wood = 40;
    s.villagers.push({ ...structuredClone(s.villagers[0]), id: 100, age: 30 });
    s = stepDay(s);
    assert.equal(s.shed.pending, true); assert.equal(s.shed.built, false); assert.equal(populationCap(s), 8);
    s = stepDay(s);
    assert.equal(s.shed.built, true); assert.equal(populationCap(s), 12);
  });
  test('fuel target is 20 only while saving for the shed (farming known, 7+ Gourdlings)', () => {
    const s = calm({ version: 'v0.2' }); assert.equal(fuelTarget(s), 6);
    s.farming.known = true; assert.equal(fuelTarget(s), 6); assert.equal(fuelTarget(s, 7), 20);
    s.shed.pending = true; assert.equal(fuelTarget(s, 7), 6);
  });
});

describe('Keyword matcher (Minimal UI, section 11)', () => {
  test('every reference-sim matcher case', () => {
    const cases = [['Please make it RAIN!', 'rain'], ['brain', null], ['hello there', null], ['make it rain fire', 'teach fire'],
      ["don't rain", 'rain'], ['  teach   FIRE ', 'teach fire'], ['make it sunny', 'drought'], ['sick hex', 'plague'],
      ['heal them', 'heal'], ['teach farming', 'teach farming'], ['feast drop', 'harvest'], ['hoedown', 'bless'], ['rain and plague', 'rain'],
      ['xyzzy', null]];
    for (const [text, want] of cases) assert.equal(matchCommand(text), want, text);
    const v01 = Object.keys(COMMAND_KEYWORDS).filter(k => k !== 'heal' && k !== 'teach farming');
    assert.equal(matchCommand('heal them', v01), null); assert.equal(matchCommand('teach sowing', v01), null);
    const names = { rain: ['cloud wrangle', 'rain'], drought: ['dry spell', 'drought'], bless: ['hoedown', 'bless'], plague: ['sick hex', 'plague'],
      'teach fire': ['teach spark', 'teach fire'], harvest: ['feast drop', 'harvest'], heal: ['shake off', 'heal'], 'teach farming': ['teach sowing', 'teach farming'] };
    for (const [cmd, ws] of Object.entries(names)) for (const w of ws) assert.equal(matchCommand(w), cmd, w);
    const flat = Object.values(COMMAND_KEYWORDS).flat(); assert.equal(flat.length, new Set(flat).size, 'a keyword belongs to two commands');
    assert.equal(cleanWords("Don’t RAIN!!"), 'don t rain');
  });
  test('priority order: teach spark, teach sowing, shake off, hoedown, feast drop, cloud wrangle, dry spell, sick hex', () => {
    const order = ['spark', 'sow', 'cure', 'dance', 'feast', 'rain', 'drought', 'plague'];
    const keys = ['teach fire', 'teach farming', 'heal', 'bless', 'harvest', 'rain', 'drought', 'plague'];
    for (let i = 0; i < order.length; i++) assert.equal(matchCommand(order.slice(i).reverse().join(' ')), keys[i]);
  });
  test('no match spends nothing; a match runs the normal checks', () => {
    const s = calm();
    assert.equal(matchText(s, 'xyzzy'), null);
    assert.equal(matchText(s, 'please cure them'), 'heal');
    assert.equal(validateCommand(s, matchText(s, 'please cure them')).ok, false, 'nobody ill');
    assert.equal(matchText(calm(V01), 'please cure them'), null, 'v0.1 has no shake off');
  });
  test('typed text: refused or unmatched input clears nothing; only a newly accepted command replaces the queue', () => {
    let s = calm({ version: 'v0.2' });
    let r = queueText(s, 'Please make it RAIN!'); assert.equal(r.ok, true); s = r.state; assert.equal(s.queuedCommand, 'rain');
    r = queueText(s, 'make a dragon');           // no keyword
    assert.equal(r.matched, false); assert.equal(r.message, ''); assert.strictEqual(r.state, s);
    r = queueText(s, 'please cure them');         // matched, refused: nobody is ill
    assert.equal(r.matched, true); assert.equal(r.ok, false); assert.match(r.message, /Nobody is ill/);
    assert.strictEqual(r.state, s); assert.equal(s.queuedCommand, 'rain'); assert.equal(s.power, 50);
    r = queueText(s, 'throw a party');            // accepted: replaces
    assert.equal(r.ok, true); assert.equal(r.state.queuedCommand, 'bless');
    // Exact names and aliases still work, because they are in the synonym table.
    for (const word of ['cloud wrangle', 'CLOUD   WRANGLE', 'rain', 'teach spark', 'feast drop', 'shake off', 'teach sowing'])
      assert.equal(queueText(calm({ version: 'v0.2' }), word).matched, true, word);
  });
});
