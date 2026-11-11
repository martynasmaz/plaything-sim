// Pure, deterministic simulation. No Phaser, DOM, clock, random numbers or I/O.
// Every transition returns a new state; failed command checks return the old one.
import { makeConfig } from './config.js';

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
function villager(id, name, age, values, c) {
  return { id, name, age, ...values, safety: c.needs.safe,
    illnessDays: 0, illToday: false, activity: 'Waiting', gained: 0, reaction: '' };
}
export function createState(overrides = {}) {
  const c = makeConfig(overrides);
  return {
    config: c, day: 0, age: 'Stone', food: c.start.food, wood: c.start.wood, power: c.start.power,
    villagers: c.start.ages.map((age, i) => villager(i + 1, c.start.names[i] || `Villager ${i + 1}`,
      age, { fullness: c.start.fullness, warmth: c.start.warmth,
        health: c.start.health, happiness: c.start.happiness }, c)),
    nextId: c.start.ages.length + 1, nextFirstId: 1,
    weather: { type: 'normal', daysLeft: 0 }, fireKnown: false, fireLit: false,
    birthCounter: 0, fireCounter: 0, lastUsed: {}, queuedCommand: null,
    speed: 0, elapsedMs: 0, ended: false, milestoneReached: false, lastDay: null,
    log: [{ day: 0, text: 'Six villagers begin a Stone Age village. Paused. No saved game.', type: 'info' }]
  };
}
export function availableCommands(state) {
  return Object.keys(state.config.commands).filter(k => k !== 'plague' || state.config.enablePlague);
}
export const normalizeCommand = text => String(text).trim().replace(/\s+/g, ' ').toLowerCase();
export function nextAllowedDay(state, command) {
  const last = state.lastUsed[command];
  if (last === undefined) return 1;
  const cooldown = state.config.commands[command]?.cooldown;
  return cooldown === null ? Infinity : last + cooldown;
}

// `day` is the day the command would affect, not the day it was typed.
export function validateCommand(s, text, day = s.day + 1) {
  const command = normalizeCommand(text);
  const commands = availableCommands(s);
  const fail = message => ({ ok: false, command, message });
  if (!commands.includes(command)) return fail(`Unknown/unavailable command. Use: ${commands.join(', ')}.`);
  if (s.ended || !s.villagers.length) return fail('The village has ended. Restart to begin again.');
  const c = s.config;
  const rule = c.commands[command];
  const allowed = nextAllowedDay(s, command);
  const conditionFail = message => fail(`${message} Earliest by cooldown: day ${Math.max(day, allowed)}; the condition must also be met.`);
  if (day < allowed) return fail(allowed === Infinity ? 'Teach fire is once per run; fire is already known.'
    : `${command} is cooling down. Next allowed: day ${allowed} (not day ${day}).`);
  if (s.power < rule.cost) return fail(`Not enough power: ${command} needs ${rule.cost}; you have ${s.power}. Next allowed by cooldown: day ${Math.max(day, allowed)}; power is also required.`);
  if (['rain', 'drought'].includes(command) && s.weather.type === command && s.weather.daysLeft > 0)
    return fail(`Already ${command}; wait until it ends or use the opposite weather. Next cooldown-allowed day: ${Math.max(day, allowed)}.`);
  if (command === 'plague' && s.villagers.some(v => v.illnessDays > 0))
    return fail(`Someone is already ill. Next cooldown-allowed day: ${Math.max(day, allowed)}; illness must end first.`);
  if (command === 'harvest' && s.food >= c.limits.stock) return conditionFail('Food is already full. Wait until food is used.');
  if (command === 'teach fire' && s.fireKnown) return fail('Fire is already known. Teaching it again has no effect; no next allowed day this run.');
  if (command === 'teach fire' && s.wood < c.fire.minWood) return conditionFail(`Teach fire needs at least ${c.fire.minWood} wood (${c.fire.discoveryCost} to learn, ${c.fire.dailyFuel} to burn).`);
  if (command === 'bless' && s.villagers.every(v => v.health === c.limits.need && v.happiness === c.limits.need))
    return conditionFail('Everyone already has full health and happiness.');
  return { ok: true, command, message: `${command} can apply on day ${day}.` };
}
export function queueCommand(s, text) {
  const result = validateCommand(s, text);
  if (!result.ok) return { ...result, state: s };
  const state = structuredClone(s);
  state.queuedCommand = result.command;
  return { ...result, state, message: `Queued ${result.command} for day ${s.day + 1}. No power spent yet.` };
}
export function cancelCommand(s) {
  return { ...s, queuedCommand: null };
}
export function setSpeed(s, speed) {
  if (!s.config.speeds.includes(speed)) throw new RangeError('Speed must be 0 (pause), 1 or 3.');
  return { ...s, speed: s.ended ? 0 : speed };
}
export function restart(s) { return createState(s.config); }

function applyQueued(s, report) {
  if (!s.queuedCommand) return;
  const command = s.queuedCommand;
  // Revalidation is intentional: queuing neither reserves resources nor guarantees success.
  const check = validateCommand(s, command, s.day);
  s.queuedCommand = null;
  report.command = check;
  if (!check.ok) { log(s, `Command rejected: ${check.message}`, 'failure'); return; }
  const c = s.config, rule = c.commands[command];
  s.power -= rule.cost;
  s.lastUsed[command] = s.day;
  let details = '';
  if (command === 'rain' || command === 'drought') {
    s.weather = { type: command, daysLeft: rule.duration };
    details = `${command} for ${rule.duration} days including today; replaces previous weather. ${command === 'rain' ? 'More food, extra cold.' : 'Lower foraging yields.'}`;
  } else if (command === 'plague') {
    for (const v of s.villagers) { v.illnessDays = rule.duration; v.reaction = 'Sick'; }
    details = `Everyone is ill for ${rule.duration} days including today.`;
  } else if (command === 'bless') {
    details = s.villagers.map(v => {
      const h = v.health, happy = v.happiness;
      changeNeed(v, 'health', rule.health, c); changeNeed(v, 'happiness', rule.happiness, c);
      v.reaction = 'Grateful';
      return `${v.name} +${v.health - h} health/+${v.happiness - happy} happiness`;
    }).join('; ') + '. Illness is not cured.';
  } else if (command === 'harvest') {
    const before = s.food; changeStock(s, 'food', rule.food);
    details = `Gift: +${s.food - before} food (meals still happen after work).`;
  } else if (command === 'teach fire') {
    s.fireKnown = true; s.fireCounter = 0; s.wood -= c.fire.discoveryCost;
    for (const v of s.villagers) v.reaction = 'Learned fire';
    details = `Fire knowledge learned; ${c.fire.discoveryCost} wood spent. Today's fuel check is next.`;
  }
  log(s, `${command} (−${rule.cost} power). ${details}`, 'command');
}

function chooseWork(s, v, report) {
  const c = s.config, n = c.needs;
  const forage = () => {
    v.activity = 'Forage';
    const yields = v.age < c.life.adult ? c.work.childFood : c.work.adultFood;
    const before = s.food; changeStock(s, 'food', yields[s.weather.type]);
    v.gained = s.food - before;
    report.gatheredFood += v.gained;
  };
  if (v.fullness < n.emergencyFullness && s.food < n.mealCost) forage();
  else if (v.warmth < n.warmUpBelow) {
    v.activity = 'Warm up';
    const before = v.warmth;
    changeNeed(v, 'warmth', s.fireLit ? n.warmUpWithFire : n.warmUp, c);
    v.gained = v.warmth - before;
  } else if (s.food < c.work.foodTargetPerPerson * s.villagers.length) forage();
  else if (s.wood < c.work.woodTarget) {
    v.activity = 'Gather wood';
    const before = s.wood;
    changeStock(s, 'wood', v.age < c.life.adult ? c.work.childWood : c.work.adultWood);
    v.gained = s.wood - before; report.gatheredWood += v.gained;
  } else {
    v.activity = 'Rest';
    const before = v.happiness; changeNeed(v, 'happiness', n.restHappiness, c);
    v.gained = v.happiness - before;
  }
  report.actions.push({ id: v.id, action: v.activity, gained: v.gained });
}

function resolveMealAndNeeds(s, v, sheltered, report) {
  const c = s.config, n = c.needs;
  report.beforeMeals.push({ id: v.id, fullness: v.fullness, warmth: v.warmth });
  if (v.fullness <= n.eatAtOrBelow && s.food >= n.mealCost) {
    s.food -= n.mealCost;
    changeNeed(v, 'fullness', n.mealFullness, c);
    report.meals.push(v.id);
  }
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
    report.deaths.push(death);
    log(s, `${v.name} (#${v.id}) died: ${causes.join(' and ')}.`, 'death');
  }
  s.villagers = s.villagers.filter(v => v.health > 0 && v.age < c.life.death);
  if (!s.villagers.length) {
    s.ended = true; s.speed = 0; s.elapsedMs = 0; s.queuedCommand = null; s.fireLit = false;
    log(s, 'The village has ended. Restart to begin a new village.', 'end');
    return;
  }
  const eligibleAdults = s.villagers.filter(v => adult(v, c) && v.health >= c.birth.health
    && v.fullness >= c.birth.fullness && v.warmth >= c.birth.warmth && v.happiness >= c.birth.happiness);
  const birthEligible = s.villagers.length < c.limits.population
    && s.food >= c.birth.foodPerPerson * s.villagers.length + c.birth.extraFood
    && !s.villagers.some(v => v.illnessDays > 0) && eligibleAdults.length >= c.birth.adults;
  s.birthCounter = birthEligible ? s.birthCounter + 1 : 0;
  if (s.birthCounter >= c.birth.consecutiveDays) {
    const id = s.nextId++;
    const child = villager(id, `Neri ${id}`, 0, c.newborn, c);
    // Newborns are not in today's work/meal/age/timer loop.
    child.activity = 'Newborn';
    if (s.villagers.length >= c.limits.shelter) child.safety = c.needs.unsafe;
    s.villagers.push(child); s.birthCounter = 0;
    report.birth = id;
    log(s, `${child.name} was born. First work and meal tomorrow.`, 'birth');
  }
  if (!s.fireKnown) {
    const adults = s.villagers.filter(v => adult(v, c) && v.happiness >= c.fire.happiness);
    const eligible = s.day >= c.fire.fromDay && adults.length >= c.fire.adults
      && averageHappiness(s) >= c.fire.happiness && !s.villagers.some(v => v.illnessDays > 0)
      && s.wood >= c.fire.minWood;
    s.fireCounter = eligible ? s.fireCounter + 1 : 0;
    if (s.fireCounter >= c.fire.consecutiveDays) {
      s.fireKnown = true; s.wood -= c.fire.discoveryCost; s.fireCounter = 0;
      report.discoveredFire = true;
      log(s, `The village discovered fire! Spent ${c.fire.discoveryCost} wood; first campfire fuel check is tomorrow.`, 'discovery');
    }
  }
}

// Explicit one-day tick. Useful for tests and the optional "Next day" button,
// even while paused. Automatic time MUST go through advanceTime (below).
export function stepDay(previous) {
  if (previous.ended) return previous;
  const s = structuredClone(previous), c = s.config;
  if (!s.villagers.length) {
    s.ended = true; s.speed = 0; s.elapsedMs = 0; s.queuedCommand = null;
    log(s, 'The village has ended. Restart to begin a new village.', 'end');
    return s;
  }
  s.day += 1;
  const report = { day: s.day, command: null, visitOrder: [], actions: [], beforeMeals: [], meals: [],
    damage: [], deaths: [], birth: null, discoveredFire: false, gatheredFood: 0, gatheredWood: 0 };
  for (const v of s.villagers) { v.reaction = ''; v.gained = 0; }
  // 1. Apply exactly one queued command.
  applyQueued(s, report);
  // 2. Today's conditions and fire fuel; knowledge survives an unlit day.
  report.weather = s.weather.type;
  s.fireLit = s.fireKnown && s.wood >= c.fire.dailyFuel;
  if (s.fireLit) s.wood -= c.fire.dailyFuel;
  report.fireLit = s.fireLit;
  report.burnedWood = s.fireLit ? c.fire.dailyFuel : 0;
  const sorted = [...s.villagers].sort((a, b) => a.id - b.id);
  const startIndex = sorted.findIndex(v => v.id >= s.nextFirstId);
  const index = startIndex < 0 ? 0 : startIndex;
  const order = [...sorted.slice(index), ...sorted.slice(0, index)];
  report.visitOrder = order.map(v => v.id);
  const shelteredIds = new Set(sorted.slice(0, c.limits.shelter).map(v => v.id));
  // 3. Lower everyone's needs, then recheck stocks after EACH person's one action.
  for (const v of order) {
    v.illToday = v.illnessDays > 0;
    changeNeed(v, 'fullness', -c.needs.fullnessLoss, c);
    // Clamp each change separately, as the design requires. A person at zero
    // warmth cannot borrow negative warmth against today's shelter/fire gains.
    changeNeed(v, 'warmth', -c.needs.warmthLoss, c);
    if (s.weather.type === 'rain') changeNeed(v, 'warmth', -c.needs.rainWarmthLoss, c);
    if (shelteredIds.has(v.id)) changeNeed(v, 'warmth', c.needs.shelterWarmth, c);
    if (s.fireLit) changeNeed(v, 'warmth', c.needs.fireWarmth, c);
  }
  for (const v of order) chooseWork(s, v, report);
  // 4. Work is all finished before any meals. Meals use that same rotated order.
  for (const v of order) resolveMealAndNeeds(s, v, shelteredIds.has(v.id), report);
  // 5. Age, deaths, birth, then natural fire discovery.
  resolveLivesAndDiscovery(s, report);
  s.lastDay = report;
  // Next first is the next living number AFTER today's first, wrapping at the end.
  const ids = s.villagers.map(v => v.id).sort((a, b) => a - b);
  s.nextFirstId = ids.find(id => id > order[0].id) ?? ids[0] ?? 1;
  if (s.ended) return s; // The design ends immediately, before step 6.
  // 6. Power, effect timers, milestones, and a compact daily explanation.
  const powerGain = c.power.daily + (averageHappiness(s) >= c.power.happyAverage ? c.power.happyBonus : 0);
  s.power = clamp(s.power + powerGain, c.limits.power);
  if (s.weather.daysLeft > 0 && --s.weather.daysLeft === 0) s.weather.type = 'normal';
  for (const v of s.villagers) if (v.illnessDays > 0) v.illnessDays -= 1;
  log(s, `Work: +${report.gatheredFood} food, +${report.gatheredWood} wood. ${report.meals.length} meals. ${s.fireKnown ? (s.fireLit ? `Campfire burned ${report.burnedWood} wood.` : 'Fire known, but unlit today.') : 'Fire unknown.'} Power +${powerGain} (cap ${c.limits.power}).`);
  if (!s.milestoneReached && s.day >= c.milestone.day && s.villagers.length >= c.milestone.population && s.fireKnown) {
    s.milestoneReached = true;
    log(s, `Milestone: ${s.villagers.length} villagers alive through day ${s.day}, and fire is known. Keep watching!`, 'milestone');
  }
  return s;
}

// Real time is an input, so playback is deterministic too. Pausing preserves the
// unfinished fraction of a day; it never advances weather, illness or cooldowns.
export function advanceTime(previous, elapsedMs) {
  if (previous.speed === 0 || previous.ended) return previous;
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) throw new RangeError('Time must be a finite nonnegative number.');
  let s = { ...previous, elapsedMs: previous.elapsedMs + elapsedMs * previous.speed };
  while (s.elapsedMs >= s.config.dayMs && !s.ended) {
    s.elapsedMs -= s.config.dayMs;
    s = stepDay(s);
  }
  return s;
}
