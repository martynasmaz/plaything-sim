// Pure, deterministic simulation. No Phaser, DOM, clock or I/O. The only
// "randomness" is a seeded dice generator stored IN the state, so the same
// seed + the same commands on the same days always replays the same run.
// Every transition returns a new state; failed command checks return the old one.
import { makeConfig } from './config.js';
import { THEME, t, commandLabel } from './theme.js';
import { normalizeWords, resolveCommand, matchCommand } from './commands.js';

const clamp = (n, max) => Math.max(0, Math.min(max, n));
const averageHappiness = s => s.villagers.length
  ? s.villagers.reduce((sum, v) => sum + v.happiness, 0) / s.villagers.length : 0;
const adult = (v, c) => v.age >= c.life.adult && v.age < c.life.elder;
const changeNeed = (v, key, amount, c) => { v[key] = clamp(v[key] + amount, c.limits.need); };
const changeStock = (s, key, amount) => { s[key] = clamp(s[key] + amount, s.config.limits.stock); };
function log(s, text, type = 'info') {
  s.log.push({ day: s.day, text, type });
  s.log = s.log.slice(-s.config.limits.log);
}

// ---- Seeded dice (same generator as the reference sim) ----------------------
// Unsigned 32-bit LCG. A roll is a whole number 0..99.
const TWO_32 = 4294967296;
const lcg = n => (1664525 * n + 1013904223) % TWO_32;
function rollNight(s) {
  // Exactly three draws every night, even when a command will override the
  // weather or nobody can fall ill, so commands never shift later dice.
  const c = s.config;
  s.rng = lcg(s.rng); const weatherRoll = Math.floor(s.rng * 100 / TWO_32);
  s.rng = lcg(s.rng); const illnessRoll = Math.floor(s.rng * 100 / TWO_32);
  s.rng = lcg(s.rng); const target = s.rng;
  let weather = 'cold', total = 0;
  for (const [type, chance] of Object.entries(c.weather.chances)) {
    total += chance;
    if (weatherRoll < total) { weather = type; break; }
  }
  s.natural = { weather, illness: illnessRoll < c.illness.chance, target };
}
// Today's (or, between days, tomorrow's) weather: command weather wins.
export function forecastWeather(s) {
  return s.weather.daysLeft > 0 ? s.weather.type : s.natural.weather;
}

// What the HUD shows as tomorrow: a queued weather command that would pass
// today's checks overrides the natural roll, exactly as it will at day start.
export function tomorrowWeather(s) {
  const q = s.queuedCommand;
  if ((q === 'rain' || q === 'drought') && validateCommand(s, q).ok) return q;
  return forecastWeather(s);
}

// ---- Personality dice (v0.2) ------------------------------------------------
// A second generator, seeded with (run seed XOR 0x5EED7A17) and warmed up the
// same way. Only traits use it, so the three nightly rolls never move.
const traitStep = s => (s.traitRng = lcg(s.traitRng));
const traitRoll = s => Math.floor(traitStep(s) * 100 / TWO_32) + 1;
export const hasTrait = (s, v, trait) => s.config.traits && v.traits.includes(trait);
// Two steps per Gourdling: one of 10 traits, then one of the 8 left after
// removing the first and its opposite (pairs sit side by side in the list).
function assignTraits(s, v) {
  const list = s.config.personality.list;
  const first = Math.floor(traitStep(s) * list.length / TWO_32);
  const rest = list.filter((_, i) => i !== first && i !== (first ^ 1));
  v.traits = [list[first], rest[Math.floor(traitStep(s) * rest.length / TWO_32)]];
}
const isV02 = s => s.config.version === 'v0.2';
// Population cap = Plank-shed places: 8, then 12 once the second shed stands.
export const shelterPlaces = s => s.config.limits.shelter + (s.shed.built ? s.config.shed.places : 0);
export const populationCap = s => s.config.limits.population + (s.shed.built ? s.config.shed.places : 0);
// Fuel target: 20 while saving for the second shed, otherwise 6.
export function fuelTarget(s, n = s.villagers.length) {
  const c = s.config;
  return isV02(s) && s.farming.known && !s.shed.built && !s.shed.pending && n >= c.shed.population
    ? c.shed.woodTarget : c.work.woodTarget;
}
function unlockFarming(s) {
  s.farming.known = true; s.farming.plots = Array(s.config.farming.plots).fill(null); s.stats.farmDay = s.day;
}

function villager(id, name, age, values, c) {
  return { id, name, age, ...values, safety: c.needs.safe, traits: [],
    illnessDays: 0, illToday: false, activity: 'Waiting', gained: 0, reaction: '' };
}
export function createState(overrides = {}, seed = 0) {
  const c = makeConfig(overrides);
  const s = {
    config: c, day: 0, age: 'Stone', food: c.start.food, wood: c.start.wood, power: c.start.power,
    villagers: c.start.ages.map((age, i) => villager(i + 1, THEME.names[i] || t('labels.nameFallback', {id:i+1}),
      age, { fullness: c.start.fullness, warmth: c.start.warmth,
        health: c.start.health, happiness: c.start.happiness }, c)),
    nextId: c.start.ages.length + 1,
    seed: seed >>> 0, rng: seed >>> 0, natural: null,
    // `weather` is command weather only; natural weather lives in `natural`.
    weather: { type: 'normal', daysLeft: 0 }, fireKnown: false, fireLit: false,
    stats: { peak: c.start.ages.length, births: 0, deaths: 0, fireDay: null, farmDay: null, shedDay: null, traitEvents: {} },
    // v0.2: plots are null (empty) or a growth number 0..ripeAt.
    farming: { known: false, counter: 0, plots: [] }, shed: { pending: false, built: false },
    traitRng: (seed ^ c.personality.seedXor) >>> 0, traitLog: [],
    birthCounter: 0, fireCounter: 0, lastUsed: {}, queuedCommand: null,
    speed: 0, elapsedMs: 0, ended: false, milestoneReached: false, lastDay: null,
    log: [{ day: 0, text: t('log.start', {seed: seed >>> 0}), type: 'info' }]
  };
  for (let i = 0; i < c.rng.warmupSteps; i++) s.rng = lcg(s.rng);
  rollNight(s); // Day 1's weather is rolled and shown before play starts.
  if (c.traits) {
    for (let i = 0; i < c.rng.warmupSteps; i++) traitStep(s);
    for (const v of s.villagers) {
      assignTraits(s, v);
      devLog(s, v, 'start', t('traitLog.start', {name:v.name,traits:traitNames(v)}));
    }
  }
  return s;
}
export function availableCommands(state) {
  const c = state.config;
  return Object.keys(c.commands).filter(k => (k !== 'plague' || c.enablePlague)
    && (!c.commands[k].since || c.commands[k].since === c.version));
}
// Minimal UI: keyword matching (design section 11) for this run's commands.
export const matchText = (state, text) => matchCommand(text, availableCommands(state));
const traitNames = v => v.traits.map(tr => t('labels.traits.'+tr)).join(t('labels.separators.traits'));
// Internal (developer) log: trait effects, at most `logPerDay` lines a day,
// plus the starters' and newborns' traits. Never shown to players.
function devLog(s, v, trait, text) {
  s.traitLog.push({ day: s.day, id: v.id, trait, text });
}
// A trait effect: counted, and offered as a candidate internal-log line.
// flushTraitLog keeps at most `logPerDay` a day by the design's priority.
function traitEvent(s, report, v, key, text) {
  s.stats.traitEvents[key] = (s.stats.traitEvents[key] || 0) + 1;
  report.traitEvents.push({ id: v.id, trait: key });
  report.traitCandidates.push({ priority: s.config.personality.logPriority[key.split('-')[0].replace(/[+]$/, '')],
    seq: report.traitCandidates.length, id: v.id, trait: key, text });
}
// Priority: Generous, Grabby, Smart, Scatterbrained, Brave/Timid, then the
// Sociable/Loner rest lines; ties keep the order they happened in.
export const pickLogLines = (candidates, perDay) =>
  [...candidates].sort((a, b) => a.priority - b.priority || a.seq - b.seq).slice(0, perDay);
function flushTraitLog(s, report) {
  const kept = pickLogLines(report.traitCandidates, s.config.personality.logPerDay);
  for (const e of kept) s.traitLog.push({ day: s.day, id: e.id, trait: e.trait, text: e.text });
  report.traitLines = kept.length;
}
// The trait that decided the final job, or null (design: log rules, credit).
export function creditTrait(s, v, weather, die, action, plain) {
  if (action === plain) return null;
  const P = s.config.personality, has = tr => hasTrait(s, v, tr);
  const wandered = action !== 'warm' && has('Scatterbrained') && die <= P.scatterbrained.chance;
  if ((weather === 'rain' || weather === 'cold') && (has('Brave') || has('Timid'))) {
    const below = has('Brave') ? P.braveWarmUpBelow : P.timidWarmUpBelow;
    // Only when the different threshold itself changed whether it warmed up.
    if ((v.warmth < below) !== (v.warmth < s.config.needs.warmUpBelow) && !wandered) return has('Brave') ? 'Brave' : 'Timid';
  }
  if (wandered) return 'Scatterbrained';
  return has('Smart') ? 'Smart' : null;
}
export const normalizeCommand = normalizeWords;
export function nextAllowedDay(state, command) {
  const last = state.lastUsed[command];
  if (last === undefined) return 1;
  const cooldown = state.config.commands[command]?.cooldown;
  return cooldown === null ? Infinity : last + cooldown;
}

// `day` is the day the command would affect, not the day it was typed.
export function validateCommand(s, text, day = s.day + 1) {
  const command = resolveCommand(text) || normalizeCommand(text);
  const commands = availableCommands(s);
  const fail = message => ({ ok: false, command, message });
  if (!commands.includes(command)) return fail(t('errors.unknown', {commands:commands.map(commandLabel).join(t('labels.separators.list'))}));
  if (s.ended || !s.villagers.length) return fail(t('errors.ended'));
  const c = s.config;
  const rule = c.commands[command];
  const allowed = nextAllowedDay(s, command);
  const conditionFail = message => fail(t('errors.condition', {reason:message,day:Math.max(day,allowed)}));
  if (day < allowed) return fail(allowed === Infinity ? t('errors.once', {command:commandLabel(command)})
    : t('errors.cooldown', {command:commandLabel(command),allowed,day}));
  if (s.power < rule.cost) return fail(t('errors.power', {command:commandLabel(command),cost:rule.cost,power:s.power,day:Math.max(day,allowed)}));
  if (['rain', 'drought'].includes(command) && forecastWeather(s) === command)
    return fail(t('errors.weather', {command:commandLabel(command),day:Math.max(day,allowed)}));
  if (command === 'plague' && s.villagers.some(v => v.illnessDays > 0))
    return fail(t('errors.illness', {day:Math.max(day,allowed)}));
  if (command === 'harvest' && s.food >= c.limits.stock) return conditionFail(t('errors.foodFull'));
  if (command === 'teach fire' && s.fireKnown) return fail(t('errors.fireKnown'));
  if (command === 'teach fire' && s.wood < c.fire.minWood) return conditionFail(t('errors.fireWood', {min:c.fire.minWood,learn:c.fire.discoveryCost,burn:c.fire.dailyFuel}));
  if (command === 'bless' && s.villagers.every(v => v.health === c.limits.need && v.happiness === c.limits.need))
    return conditionFail(t('errors.blessFull'));
  if (command === 'heal' && !s.villagers.some(v => v.illnessDays > 0)) return conditionFail(t('errors.nobodyIll'));
  if (command === 'teach farming' && s.farming.known) return fail(t('errors.farmingKnown'));
  return { ok: true, command, message: t('feedback.canApply', {command:commandLabel(command),day}) };
}
export function queueCommand(s, text) {
  const result = validateCommand(s, text);
  if (!result.ok) return { ...result, state: s };
  const state = structuredClone(s);
  state.queuedCommand = result.command;
  return { ...result, state, message: t('feedback.queued', {command:commandLabel(result.command),day:s.day+1}) };
}
// Typed text (design section 11, on every screen): keywords anywhere pick one
// command, then the normal checks run. No match → { matched: false } and the
// state is untouched. A refusal or no match never clears the queued command;
// only a newly accepted command replaces it.
export function queueText(s, text) {
  const command = matchText(s, text);
  if (command === null) return { ok: false, matched: false, command: null, message: '', state: s };
  return { ...queueCommand(s, command), matched: true };
}
export function cancelCommand(s) {
  return { ...s, queuedCommand: null };
}
export function setSpeed(s, speed) {
  if (!s.config.speeds.includes(speed)) throw new RangeError(t('errors.speed'));
  return { ...s, speed: s.ended ? 0 : speed };
}
// Restart is a fresh day-0 run with a NEW seed (the page passes a random one).
export function restart(s, seed = (s.seed + 1) >>> 0) {
  return createState(s.config, seed === s.seed ? (seed + 1) >>> 0 : seed);
}

function applyQueued(s, report) {
  if (!s.queuedCommand) return;
  const command = s.queuedCommand;
  // Revalidation is intentional: queuing neither reserves resources nor guarantees success.
  const check = validateCommand(s, command, s.day);
  s.queuedCommand = null;
  report.command = check;
  if (!check.ok) { log(s, t('log.rejected', {reason:check.message}), 'failure'); return; }
  const c = s.config, rule = c.commands[command];
  s.power -= rule.cost;
  s.lastUsed[command] = s.day;
  let details = '';
  if (command === 'rain' || command === 'drought') {
    s.weather = { type: command, daysLeft: rule.duration };
    details = t('log.weather', {command:commandLabel(command),duration:rule.duration,effect:t('log.'+command)});
  } else if (command === 'plague') {
    for (const v of s.villagers) { v.illnessDays = rule.duration; v.reaction = 'Sick'; }
    details = t('log.plague', {duration:rule.duration});
  } else if (command === 'bless') {
    details = s.villagers.map(v => {
      const h = v.health, happy = v.happiness;
      changeNeed(v, 'health', rule.health, c); changeNeed(v, 'happiness', rule.happiness, c);
      v.reaction = 'Grateful';
      return t('log.blessPerson', {name:v.name,health:v.health-h,happiness:v.happiness-happy});
    }).join(t('labels.separators.detail')) + t('log.blessEnd');
  } else if (command === 'harvest') {
    const before = s.food; changeStock(s, 'food', rule.food);
    details = t('log.harvest', {food:s.food-before});
  } else if (command === 'teach fire') {
    s.fireKnown = true; s.fireCounter = 0; s.wood -= c.fire.discoveryCost; s.stats.fireDay = s.day;
    for (const v of s.villagers) v.reaction = 'Learned fire';
    details = t('log.teach', {wood:c.fire.discoveryCost});
  } else if (command === 'heal') {
    for (const v of s.villagers) if (v.illnessDays) { v.illnessDays = 0; v.reaction = 'Cured'; }
    details = t('log.heal');
  } else if (command === 'teach farming') {
    unlockFarming(s);
    details = t('log.sow', {plots:c.farming.plots});
  }
  log(s, t('log.command', {command:commandLabel(command),cost:rule.cost,details}), 'command');
}

// The daily priority list for one Gourdling. Pure: returns an action name.
// useTraits=false gives the plain v0.1/v0.2 choice, used to log trait effects.
function chooseAction(s, v, weather, n, die, useTraits) {
  const c = s.config, N = c.needs, P = c.personality, has = tr => useTraits && hasTrait(s, v, tr);
  if (v.fullness < N.emergencyFullness && s.food < N.mealCost) return 'forage';
  let warmBelow = N.warmUpBelow;
  if (weather === 'rain' || weather === 'cold') {
    if (has('Brave')) warmBelow = P.braveWarmUpBelow;
    else if (has('Timid')) warmBelow = P.timidWarmUpBelow;
  }
  if (v.warmth < warmBelow) return 'warm';
  if (has('Scatterbrained') && die <= P.scatterbrained.chance)
    return die <= P.scatterbrained.forageUpTo ? 'forage' : die <= P.scatterbrained.woodUpTo ? 'wood' : 'rest';
  const v02 = isV02(s), F = c.farming;
  if (v02 && s.farming.plots.some(x => x !== null && x >= F.ripeAt)) return 'harvest';
  const foodTarget = c.work.foodTargetPerPerson * n, woodTarget = fuelTarget(s, n), smart = has('Smart');
  if (smart) {
    // Compare each stock's gap as a share of its target; provisions win a tie.
    const foodGap = s.food < foodTarget ? (foodTarget - s.food) / foodTarget : 0;
    const woodGap = s.wood < woodTarget ? (woodTarget - s.wood) / woodTarget : 0;
    if (foodGap > 0 || woodGap > 0) return foodGap >= woodGap ? 'forage' : 'wood';
  } else if (s.food < foodTarget) return 'forage';
  if (v02 && s.farming.known && v.age >= c.life.adult && s.farming.plots.includes(null)
    && s.food >= F.plantFoodPerPerson * n + F.plantExtraFood) return 'plant';
  if (!smart && s.wood < woodTarget) return 'wood';
  return 'rest';
}
const ACTIVITY = { forage: 'Forage', warm: 'Warm up', wood: 'Gather wood', harvest: 'Harvest', plant: 'Plant', rest: 'Rest' };
const actionWord = action => t('traitLog.actions.'+action);

function doWork(s, v, action, report) {
  const c = s.config, n = c.needs;
  v.activity = ACTIVITY[action]; v.gained = 0;
  if (action === 'forage') {
    const yields = v.age < c.life.adult ? c.work.childFood : c.work.adultFood;
    const before = s.food; changeStock(s, 'food', yields[report.weather]);
    v.gained = s.food - before; report.gatheredFood += v.gained;
  } else if (action === 'warm') {
    const before = v.warmth;
    changeNeed(v, 'warmth', s.fireLit ? n.warmUpWithFire : n.warmUp, c);
    v.gained = v.warmth - before;
  } else if (action === 'wood') {
    const before = s.wood;
    changeStock(s, 'wood', v.age < c.life.adult ? c.work.childWood : c.work.adultWood);
    v.gained = s.wood - before; report.gatheredWood += v.gained;
  } else if (action === 'harvest') {
    s.farming.plots[s.farming.plots.findIndex(x => x !== null && x >= c.farming.ripeAt)] = null;
    const before = s.food; changeStock(s, 'food', c.farming.harvestFood);
    v.gained = s.food - before; report.gatheredFood += v.gained; report.harvests += 1;
  } else if (action === 'plant') {
    s.farming.plots[s.farming.plots.indexOf(null)] = 0;
    s.food -= c.farming.plantCost; report.plantings += 1;
  }
  report.actions.push({ id: v.id, action: v.activity, gained: v.gained });
}

function work(s, order, report) {
  const c = s.config, P = c.personality, n = s.villagers.length, weather = report.weather;
  // Exactly one behaviour roll per living Gourdling, in work order, always taken.
  const dice = c.traits ? order.map(() => traitRoll(s)) : [];
  report.behaviourRolls = dice;
  const resters = [];
  order.forEach((v, i) => {
    const die = c.traits ? dice[i] : 101;
    const action = chooseAction(s, v, weather, n, die, true);
    if (c.traits) {
      const plain = chooseAction(s, v, weather, n, die, false);
      const trait = creditTrait(s, v, weather, die, action, plain);
      if (trait) {
        traitEvent(s, report, v, trait, t('traitLog.'+trait, {name:v.name,action:actionWord(action),plain:actionWord(plain),
          weather:t('labels.weather.'+weather),place:t(s.fireLit?'labels.resources.fire':'labels.resources.shelter')}));
      }
    }
    doWork(s, v, action, report);
    if (action === 'rest') resters.push(v);
  });
  // Rest happiness for everyone comes after all actions are chosen.
  const together = resters.length >= 2;
  for (const v of resters) {
    let gain = c.needs.restHappiness;
    if (hasTrait(s, v, 'Sociable')) {
      gain = together ? P.restTogether : P.restAlone;
      traitEvent(s, report, v, together ? 'Sociable+' : 'Sociable-', t('traitLog.'+(together?'sociableTogether':'sociableAlone'), {name:v.name,others:resters.length-1}));
    } else if (hasTrait(s, v, 'Loner')) {
      gain = together ? P.restAlone : P.restTogether;
      traitEvent(s, report, v, together ? 'Loner-' : 'Loner+', t('traitLog.'+(together?'lonerTogether':'lonerAlone'), {name:v.name}));
    }
    const before = v.happiness; changeNeed(v, 'happiness', gain, c);
    v.gained = v.happiness - before;
    report.actions.find(a => a.id === v.id).gained = v.gained;
  }
}

// One meal, without changing state: `order` serves in that order, `threshold`
// and `fullness` by id. Returns who ate and who went without as Generous.
export function mealPlan(order, threshold, fullness, food, generousOk) {
  const served = new Set(), fed = [], gave = [];
  for (const id of order) {
    // "Hungry and waiting": not yet served and at or below their own threshold, self included.
    const waiting = order.filter(q => !served.has(q) && fullness[q] <= threshold[q]).length;
    served.add(id);
    if (fullness[id] > threshold[id]) continue;
    if (generousOk(id) && food < waiting) { gave.push(id); continue; }
    if (food >= 1) { food -= 1; fed.push(id); }
  }
  return { fed, gave };
}
// Meals: Grabby Gourdlings first (in rotation order), then everyone else.
function meals(s, order, report) {
  const c = s.config, N = c.needs, P = c.personality, grabby = v => hasTrait(s, v, 'Grabby');
  const byId = Object.fromEntries(order.map(v => [v.id, v]));
  const fullness = Object.fromEntries(order.map(v => [v.id, v.fullness]));
  const generousOk = id => hasTrait(s, byId[id], 'Generous') && fullness[id] >= P.generousMinFullness;
  for (const v of order) report.beforeMeals.push({ id: v.id, fullness: v.fullness, warmth: v.warmth });
  const mealOrder = [...order.filter(grabby), ...order.filter(v => !grabby(v))].map(v => v.id);
  const threshold = Object.fromEntries(order.map(v => [v.id, grabby(v) ? P.grabbyEatAtOrBelow : N.eatAtOrBelow]));
  const foodBefore = s.food;
  const { fed, gave } = mealPlan(mealOrder, threshold, fullness, s.food, generousOk);
  for (const id of gave) traitEvent(s, report, byId[id], 'Generous', t('traitLog.Generous', {name:byId[id].name}));
  for (const id of fed) {
    const v = byId[id];
    s.food -= N.mealCost; changeNeed(v, 'fullness', N.mealFullness, c); report.meals.push(id);
    // Eating early is counted, never logged (design: Grabby line rule).
    if (grabby(v) && fullness[id] > N.eatAtOrBelow) s.stats.traitEvents['Grabby-early'] = (s.stats.traitEvents['Grabby-early'] || 0) + 1;
  }
  if (c.traits && order.some(grabby)) {
    // Re-run the meal with every Grabby treated as normal (rotation order, eats
    // at 75 or below). Anyone fed there who went without here is named.
    const normal = Object.fromEntries(order.map(v => [v.id, N.eatAtOrBelow]));
    const counterfactual = mealPlan(order.map(v => v.id), normal, fullness, foodBefore, generousOk).fed;
    const grabbyEaters = fed.filter(id => grabby(byId[id]));
    for (const id of counterfactual) if (!fed.includes(id) && grabbyEaters.length && !grabbyEaters.includes(id)) {
      const g = byId[grabbyEaters[0]];
      traitEvent(s, report, g, 'Grabby-others-went-without', t('traitLog.grabbyOthers', {name:g.name,other:byId[id].name}));
    }
  }
  flushTraitLog(s, report);
}

function resolveNeeds(s, v, sheltered, report) {
  const c = s.config, n = c.needs;
  const causes = [];
  let damage = 0;
  if (v.fullness <= n.damageAtOrBelow) { damage += n.hungerDamage; causes.push('hunger'); }
  if (v.warmth <= n.damageAtOrBelow) { damage += n.coldDamage; causes.push('cold'); }
  if (v.illnessDays > 0) { damage += n.illnessDamage; causes.push('illness'); }
  changeNeed(v, 'health', -damage, c);
  if (!damage && !v.illnessDays && v.fullness >= n.recoveryMin && v.warmth >= n.recoveryMin)
    changeNeed(v, 'health', n.recovery, c);
  v.safety = sheltered && v.health >= n.safeHealth && !v.illnessDays ? n.safe : n.unsafe;
  if ([v.fullness, v.warmth, v.safety].every(value => value >= n.happyMin)) changeNeed(v, 'happiness', n.happyGain, c);
  else if ([v.fullness, v.warmth, v.safety].some(value => value < n.unhappyBelow)) changeNeed(v, 'happiness', -n.unhappyLoss, c);
  if (v.illnessDays) changeNeed(v, 'happiness', -n.illnessHappinessLoss, c);
  report.damage.push({ id: v.id, amount: damage, causes });
}

function resolveLivesAndDiscovery(s, report) {
  const c = s.config;
  for (const v of s.villagers) {
    v.age += 1;
    if (v.health > 0 && v.age < c.life.death) continue;
    const causes = [];
    if (v.health <= 0) causes.push(...report.damage.find(d => d.id === v.id).causes);
    if (v.health <= 0 && !causes.length) causes.push('poor health');
    if (v.age >= c.life.death) causes.push('old age');
    const death = { id: v.id, name: v.name, causes };
    report.deaths.push(death); s.stats.deaths += 1;
    log(s, t('log.death', {name:v.name,id:v.id,causes:causes.map(cause=>t('labels.causes.'+cause)).join(t('labels.separators.cause'))}), 'death');
  }
  s.villagers = s.villagers.filter(v => v.health > 0 && v.age < c.life.death);
  if (!s.villagers.length) {
    s.ended = true; s.speed = 0; s.elapsedMs = 0; s.queuedCommand = null; s.fireLit = false;
    log(s, t('log.ended'), 'end');
    return;
  }
  const eligibleAdults = s.villagers.filter(v => adult(v, c) && v.health >= c.birth.health
    && v.fullness >= c.birth.fullness && v.warmth >= c.birth.warmth && v.happiness >= c.birth.happiness);
  const birthEligible = s.villagers.length < populationCap(s)
    && s.food >= c.birth.foodPerPerson * s.villagers.length + c.birth.extraFood
    && !s.villagers.some(v => v.illnessDays > 0) && eligibleAdults.length >= c.birth.adults;
  s.birthCounter = birthEligible ? s.birthCounter + 1 : 0;
  if (s.birthCounter >= c.birth.consecutiveDays) {
    const id = s.nextId++;
    const child = villager(id, t('labels.newbornName', {id}), 0, c.newborn, c);
    // Newborns are not in today's work/meal/age/timer loop.
    child.activity = 'Newborn';
    if (s.villagers.length >= shelterPlaces(s)) child.safety = c.needs.unsafe;
    s.villagers.push(child); s.birthCounter = 0;
    s.stats.births += 1; s.stats.peak = Math.max(s.stats.peak, s.villagers.length);
    report.birth = id;
    log(s, t('log.birth', {name:child.name}), 'birth');
    // Newborns roll both traits fresh (2 trait-dice steps), at birth.
    if (c.traits) { assignTraits(s, child); devLog(s, child, 'birth', t('traitLog.birth', {name:child.name,traits:traitNames(child)})); }
  }
  if (!s.fireKnown) {
    // Any Gourdling aged 20+ (elders too) counts; happiness is the average.
    const adults = s.villagers.filter(v => v.age >= c.life.adult);
    const eligible = s.day >= c.fire.fromDay && adults.length >= c.fire.adults
      && averageHappiness(s) >= c.fire.happiness && !s.villagers.some(v => v.illnessDays > 0)
      && s.wood >= c.fire.minWood;
    s.fireCounter = eligible ? s.fireCounter + 1 : 0;
    if (s.fireCounter >= c.fire.consecutiveDays) {
      s.fireKnown = true; s.wood -= c.fire.discoveryCost; s.fireCounter = 0; s.stats.fireDay = s.day;
      report.discoveredFire = true;
      log(s, t('log.discovery', {wood:c.fire.discoveryCost}), 'discovery');
    }
  }
  if (!isV02(s)) return;
  // v0.2 day end, after births and the Bonfire: farming discovery, the second
  // shed check, then crop growth (plots planted today grow today too).
  const F = c.farming, n = s.villagers.length;
  if (!s.farming.known) {
    const eligible = s.day >= F.fromDay && s.fireKnown && s.villagers.filter(v => v.age >= c.life.adult).length >= F.adults
      && averageHappiness(s) >= F.happiness && s.food >= F.foodPerPerson * n && !s.villagers.some(v => v.illnessDays > 0);
    s.farming.counter = eligible ? s.farming.counter + 1 : 0;
    if (s.farming.counter >= F.consecutiveDays) {
      unlockFarming(s); report.discoveredFarming = true;
      log(s, t('log.farmingDiscovery', {plots:F.plots}), 'discovery');
    }
  }
  if (s.farming.known && !s.shed.built && !s.shed.pending && n >= c.shed.population && s.wood >= c.shed.wood) {
    s.wood -= c.shed.wood; s.shed.pending = true; report.shedPaid = true;
    log(s, t('log.shedPaid', {wood:c.shed.wood,places:c.shed.places}), 'discovery');
  }
  const growth = F.growth[report.weather];
  s.farming.plots = s.farming.plots.map(x => x === null || x >= F.ripeAt ? x : Math.min(F.ripeAt, Math.max(0, x + growth)));
}

// Explicit one-day tick. Useful for tests and the optional "Next day" button,
// even while paused. Automatic time MUST go through advanceTime (below).
export function stepDay(previous) {
  if (previous.ended) return previous;
  const s = structuredClone(previous), c = s.config;
  if (!s.villagers.length) {
    s.ended = true; s.speed = 0; s.elapsedMs = 0; s.queuedCommand = null;
    log(s, t('log.ended'), 'end');
    return s;
  }
  s.day += 1;
  const report = { day: s.day, command: null, visitOrder: [], actions: [], beforeMeals: [], meals: [],
    damage: [], deaths: [], birth: null, discoveredFire: false, gatheredFood: 0, gatheredWood: 0,
    harvests: 0, plantings: 0, traitEvents: [], traitCandidates: [], traitLines: 0, behaviourRolls: [] };
  // v0.2: a second shed paid for last night stands from today (cap 12).
  if (s.shed.pending) {
    s.shed.pending = false; s.shed.built = true; s.stats.shedDay = s.day;
    log(s, t('log.shedBuilt', {places:shelterPlaces(s)}), 'milestone');
  }
  for (const v of s.villagers) { v.reaction = ''; v.gained = 0; }
  // 1. Apply exactly one queued command.
  applyQueued(s, report);
  // 2. Today's conditions: command weather, else last night's natural roll;
  // then last night's natural illness roll; then Bonfire fuel.
  report.weather = forecastWeather(s);
  report.naturalWeather = s.natural.weather;
  report.illness = null;
  if (s.natural.illness && s.villagers.length) {
    const targets = [...s.villagers].sort((a, b) => a.id - b.id);
    const v = targets[Math.floor(s.natural.target * targets.length / TWO_32)];
    // Someone already ill is not affected again (no stacking or refreshing).
    if (!v.illnessDays) {
      v.illnessDays = c.illness.duration; v.reaction = 'Sick'; report.illness = v.id;
      log(s, t('log.naturalIllness', {name:v.name,days:c.illness.duration}), 'illness');
    }
  }
  s.fireLit = s.fireKnown && s.wood >= c.fire.dailyFuel;
  if (s.fireLit) s.wood -= c.fire.dailyFuel;
  report.fireLit = s.fireLit;
  report.burnedWood = s.fireLit ? c.fire.dailyFuel : 0;
  // Number order, first place moved along one living Gourdling each day:
  // sorted living numbers rotated left by (day − 1) modulo the population.
  const sorted = [...s.villagers].sort((a, b) => a.id - b.id);
  const index = (s.day - 1) % sorted.length;
  const order = [...sorted.slice(index), ...sorted.slice(0, index)];
  report.visitOrder = order.map(v => v.id);
  const shelteredIds = new Set(sorted.slice(0, shelterPlaces(s)).map(v => v.id));
  // 3. Lower everyone's needs, then recheck stocks after EACH person's one action.
  for (const v of order) {
    v.illToday = v.illnessDays > 0;
    changeNeed(v, 'fullness', -c.needs.fullnessLoss, c);
    // Sum ALL of today's warmth changes, then clamp once (design section 3).
    // Hardy: a smaller cold-snap loss. Shivery: extra loss in rain and cold snaps.
    const P = c.personality, shivery = hasTrait(s, v, 'Shivery') ? P.shiveryExtraLoss : 0;
    const weatherLoss = report.weather === 'rain' ? c.needs.rainWarmthLoss + shivery
      : report.weather === 'cold' ? (hasTrait(s, v, 'Hardy') ? P.hardyColdLoss : c.needs.coldWarmthLoss + shivery) : 0;
    changeNeed(v, 'warmth', -c.needs.warmthLoss - weatherLoss
      + (shelteredIds.has(v.id) ? c.needs.shelterWarmth : 0) + (s.fireLit ? c.needs.fireWarmth : 0), c);
  }
  work(s, order, report);
  // 4. Work is all finished before any meals: meals (Grabby first), then
  // damage, recovery, safety and happiness in the rotated order.
  meals(s, order, report);
  for (const v of order) resolveNeeds(s, v, shelteredIds.has(v.id), report);
  // 5. Age, deaths, birth, then natural fire discovery.
  resolveLivesAndDiscovery(s, report);
  s.lastDay = report;
  // Wipeout stops immediately: no wonder, timers or dice after the last death.
  if (s.ended) return s;
  // 6. Power, effect timers, milestones, and a compact daily explanation.
  const powerGain = c.power.daily + (averageHappiness(s) >= c.power.happyAverage ? c.power.happyBonus : 0);
  s.power = clamp(s.power + powerGain, c.limits.power);
  if (s.weather.daysLeft > 0 && --s.weather.daysLeft === 0) s.weather.type = 'normal';
  for (const v of s.villagers) if (v.illnessDays > 0) v.illnessDays -= 1;
  rollNight(s); // Tomorrow's weather, illness and who falls ill.
  log(s, t('log.day', {food:report.gatheredFood,wood:report.gatheredWood,meals:report.meals.length,
    fire:s.fireKnown ? (s.fireLit?t('log.fireLit',{wood:report.burnedWood}):t('log.fireOut')):t('log.fireUnknown'),
    power:powerGain,cap:c.limits.power}));
  if (!s.milestoneReached && s.day >= c.milestone.day && s.villagers.length >= c.milestone.population && s.fireKnown) {
    s.milestoneReached = true;
    log(s, t('log.milestone', {population:s.villagers.length,day:s.day}), 'milestone');
  }
  return s;
}

// Real time is an input, so playback is deterministic too. Pausing preserves the
// unfinished fraction of a day; it never advances weather, illness or cooldowns.
export function advanceTime(previous, elapsedMs) {
  if (previous.speed === 0 || previous.ended) return previous;
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) throw new RangeError(t('errors.time'));
  let s = { ...previous, elapsedMs: previous.elapsedMs + elapsedMs * previous.speed };
  while (s.elapsedMs >= s.config.dayMs && !s.ended) {
    s.elapsedMs -= s.config.dayMs;
    s = stepDay(s);
  }
  return s;
}
