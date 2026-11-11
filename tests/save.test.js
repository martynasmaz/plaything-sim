import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createState, stepDay, queueCommand, queueText } from '../src/sim.js';
import { CONFIG } from '../src/config.js';
import { matchCommand } from '../src/commands.js';
import { serialize, deserialize, createSaveSlot, createFreshStart } from '../src/save.js';
import { chooseCommand } from './strategies.js';

const reload = s => deserialize(serialize(s));
// One line per day: everything a player or the build check could see.
const dayLine = s => JSON.stringify({ day: s.day, ended: s.ended, villagers: s.villagers, food: s.food, wood: s.wood,
  power: s.power, rng: s.rng, traitRng: s.traitRng, natural: s.natural, weather: s.weather, fire: [s.fireKnown, s.fireLit],
  farming: s.farming, shed: s.shed, lastUsed: s.lastUsed, stats: s.stats, report: s.lastDay,
  log: s.log.filter(e => e.day === s.day), traitLog: s.traitLog.filter(e => e.day === s.day) });
function play(seed, mode, { reloadAfterQueueOn = null, reloadAtDayEnd = null, days = 60 } = {}) {
  let s = createState({}, seed); const lines = [];
  while (s.day < days && !s.ended) {
    const command = chooseCommand(mode, s);
    if (command) s = queueCommand(s, command).state;
    if (s.day === reloadAfterQueueOn) s = reload(s); // the queued command is saved too
    s = stepDay(s);
    lines.push(dayLine(s));
    if (s.day === reloadAtDayEnd) s = reload(s); // the page reopens at the start of the next day
  }
  return { s, lines };
}

describe('Save and load', () => {
  test('a save holds every run field and round-trips exactly', () => {
    const s = play(11, 'helped', { days: 30 }).s, back = reload(s);
    const saved = JSON.parse(serialize(s));
    assert.equal(saved.version, CONFIG.save.version);
    for (const key of ['seed', 'day', 'villagers', 'nextId', 'food', 'wood', 'fireKnown', 'farming', 'shed', 'birthCounter',
      'fireCounter', 'weather', 'natural', 'rng', 'traitRng', 'power', 'lastUsed', 'queuedCommand', 'ended', 'stats'])
      assert.ok(key in saved.run, key);
    for (const key of Object.keys(saved.run)) assert.deepEqual(back[key], s[key], key);
    assert.ok(s.villagers.every(v => v.traits.length === 2));
    assert.equal(back.speed, 0); assert.equal(back.elapsedMs, 0); assert.equal(back.lastDay, null);
  });
  test('reload mid-run then play to day 60: the day log equals an uninterrupted run (several seeds and strategies)', () => {
    for (const [seed, mode] of [[0, 'helped'], [7, 'helped'], [42, 'none'], [123, 'helped'], [48, 'cruel'], [199, 'cruel']]) {
      const whole = play(seed, mode).lines;
      assert.ok(whole.length > 10, `${seed} ${mode}`);
      for (const at of [1, 13, 30]) {
        assert.deepEqual(play(seed, mode, { reloadAtDayEnd: at }).lines, whole, `${mode} seed ${seed}, reload after day ${at}`);
        assert.deepEqual(play(seed, mode, { reloadAfterQueueOn: at }).lines, whole, `${mode} seed ${seed}, reload with a queued command on day ${at}`);
      }
    }
  });
  test('the queued command, Wonder and cooldowns survive a reload', () => {
    let s = createState({}, 3); s.power = 60;
    s = queueText(s, 'please make it rain').state;
    s = stepDay(s); s = queueText(s, 'hoedown').state;
    const back = reload(s);
    assert.equal(back.queuedCommand, 'bless');
    assert.equal(back.power, s.power);
    assert.deepEqual(back.lastUsed, s.lastUsed);
    assert.deepEqual(back.weather, s.weather);
  });
  test('an ended run reloads ended (the page shows its end screen)', () => {
    const { s } = play(48, 'cruel');
    assert.ok(s.ended);
    const back = reload(s);
    assert.ok(back.ended);
    assert.equal(stepDay(back), back);
    assert.equal(back.day, s.day);
  });
  test('no save, an unreadable save or an older save format gives null (a new run starts)', () => {
    const good = JSON.parse(serialize(createState({}, 9)));
    const bad = [undefined, null, '', 'not json{', '[]', '{}', JSON.stringify({ ...good, version: 0 }),
      JSON.stringify({ version: good.version }),
      JSON.stringify({ ...good, run: { ...good.run, traitRng: undefined } }),
      JSON.stringify({ ...good, run: { ...good.run, villagers: 'x' } }),
      JSON.stringify({ ...good, run: { ...good.run, villagers: [{ id: 1 }] } }),
      JSON.stringify({ ...good, run: { ...good.run, seed: -1 } })];
    for (const text of bad) assert.equal(deserialize(text), null, String(text).slice(0, 60));
    assert.ok(deserialize(JSON.stringify(good)));
  });
  test('the slot uses one key and never throws when storage fails', () => {
    const store = new Map(), storage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: k => store.delete(k) };
    const slot = createSaveSlot(storage, CONFIG.save.key);
    assert.equal(slot.load(), null);
    const s = createState({}, 77);
    assert.ok(slot.save(s));
    assert.deepEqual([...store.keys()], [CONFIG.save.key]);
    assert.equal(slot.load().seed, 77);
    slot.save(createState({}, 78)); // a new run overwrites the one slot
    assert.equal(slot.load().seed, 78); assert.equal(store.size, 1);
    const broken = createSaveSlot({ getItem() { throw new Error('denied'); }, setItem() { throw new Error('full'); } }, 'k');
    assert.equal(broken.save(s), false); assert.equal(broken.load(), null);
    assert.equal(createSaveSlot(null, 'k').load(), null);
  });
});

describe('"begin anew" (fake clock)', () => {
  const rule = CONFIG.freshStart;
  const clock = () => { const c = { ms: 1_000_000 }; c.now = () => c.ms; return c; };
  test('config: phrase, confirmation and the 10-second window', () => {
    assert.deepEqual(rule, { phrase: 'begin anew', requireConfirm: true, confirmSeconds: 10 });
  });
  test('it is not a keyword synonym, so the matcher alone would ignore it', () => {
    assert.equal(matchCommand('begin anew'), null);
  });
  test('the first time only asks; the game state is untouched and no Wonder is spent', () => {
    const c = clock(), fresh = createFreshStart(rule, c.now), s = createState({}, 5), before = serialize(s);
    assert.equal(fresh.handle('begin anew'), 'ask');
    assert.ok(fresh.isPending());
    assert.equal(serialize(s), before); // the controller never touches the run, so the save has no pending flag
  });
  test('typed again within 10 real seconds restarts (10.000 s still counts)', () => {
    const c = clock(), fresh = createFreshStart(rule, c.now);
    assert.equal(fresh.handle('begin anew'), 'ask');
    c.ms += 9_999; assert.equal(fresh.handle('Begin   ANEW!'), 'restart');
    assert.ok(!fresh.isPending());
    assert.equal(fresh.handle('begin anew'), 'ask'); c.ms += 10_000;
    assert.equal(fresh.handle('begin anew'), 'restart');
  });
  test('after the timeout it cancels quietly; the next "begin anew" asks again', () => {
    const c = clock(), fresh = createFreshStart(rule, c.now);
    fresh.handle('begin anew'); c.ms += 10_001;
    assert.ok(!fresh.isPending());
    assert.equal(fresh.handle('begin anew'), 'ask');
  });
  test('any other input cancels and then runs as a normal command', () => {
    const c = clock(), fresh = createFreshStart(rule, c.now);
    fresh.handle('begin anew');
    assert.equal(fresh.handle('make it rain'), 'cancel');
    assert.ok(!fresh.isPending());
    assert.equal(fresh.handle('begin anew'), 'ask'); // not a restart: the pending one was cancelled
    assert.equal(fresh.handle('hello there'), 'cancel');
    assert.equal(fresh.handle('hello there'), 'pass');
    // The cancelling text is then handled by the matcher as usual.
    const s = createState({}, 5);
    assert.equal(queueText(s, 'make it rain').state.queuedCommand, 'rain');
  });
  test('exact match only: extra words, partial phrases and lookalikes are ordinary input', () => {
    const c = clock(), fresh = createFreshStart(rule, c.now);
    for (const text of ['begin anew please', 'please begin anew', 'begin', 'anew', 'beginanew', 'begin a new'])
      assert.equal(fresh.handle(text), 'pass', text);
    assert.equal(fresh.handle('  "Begin, anew."  '), 'ask');
  });
  test('a reload cancels the pending restart (a new controller starts clean)', () => {
    const c = clock(), first = createFreshStart(rule, c.now);
    first.handle('begin anew');
    const afterReload = createFreshStart(rule, c.now);
    assert.equal(afterReload.handle('begin anew'), 'ask');
  });
  test('with requireConfirm false the first "begin anew" restarts', () => {
    const fresh = createFreshStart({ ...rule, requireConfirm: false }, clock().now);
    assert.equal(fresh.handle('begin anew'), 'restart');
    assert.equal(fresh.handle('begin anew now'), 'pass');
  });
  test('the phrase is configurable', () => {
    const fresh = createFreshStart({ ...rule, phrase: 'let it go' }, clock().now);
    assert.equal(fresh.handle('begin anew'), 'pass');
    assert.equal(fresh.handle('Let it go'), 'ask');
  });
});
