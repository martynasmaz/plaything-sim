// Pure, deterministic simulation. No Phaser, DOM, clock, random numbers or I/O.
// Every transition returns a new state; failed command checks return the old one.
import { makeConfig } from './config.js';
import { THEME, t, commandLabel } from './theme.js';
import { normalizeWords, resolveCommand } from './commands.js';

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
    villagers: c.start.ages.map((age, i) => villager(i + 1, THEME.names[i] || t('labels.nameFallback', {id:i+1}),
      age, { fullness: c.start.fullness, warmth: c.start.warmth,
        health: c.start.health, happiness: c.start.happiness }, c)),
    nextId: c.start.ages.length + 1, nextFirstId: 1,
    weather: { type: 'normal', daysLeft: 0 }, fireKnown: false, fireLit: false,
    birthCounter: 0, fireCounter: 0, lastUsed: {}, queuedCommand: null,
    speed: 0, elapsedMs: 0, ended: false, milestoneReached: false, lastDay: null,
    log: [{ day: 0, text: t('log.start'), type: 'info' }]
  };
}
export function availableCommands(state) {
  return Object.keys(state.config.commands).filter(k => k !== 'plague' || state.config.enablePlague);
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
  if (day < allowed) return fail(allowed === Infinity ? t('errors.once')
    : t('errors.cooldown', {command:commandLabel(command),allowed,day}));
  if (s.power < rule.cost) return fail(t('errors.power', {command:commandLabel(command),cost:rule.cost,power:s.power,day:Math.max(day,allowed)}));
  if (['rain', 'drought'].includes(command) && s.weather.type === command && s.weather.daysLeft > 0)
    return fail(t('errors.weather', {command:commandLabel(command),day:Math.max(day,allowed)}));
  if (command === 'plague' && s.villagers.some(v => v.illnessDays > 0))
    return fail(t('errors.illness', {day:Math.max(day,allowed)}));
  if (command === 'harvest' && s.food >= c.limits.stock) return conditionFail(t('errors.foodFull'));
  if (command === 'teach fire' && s.fireKnown) return fail(t('errors.fireKnown'));
  if (command === 'teach fire' && s.wood < c.fire.minWood) return conditionFail(t('errors.fireWood', {min:c.fire.minWood,learn:c.fire.discoveryCost,burn:c.fire.dailyFuel}));
  if (command === 'bless' && s.villagers.every(v => v.health === c.limits.need && v.happiness === c.limits.need))
    return conditionFail(t('errors.blessFull'));
  return { ok: true, command, message: t('feedback.canApply', {command:commandLabel(command),day}) };
}
export function queueCommand(s, text) {
  const result = validateCommand(s, text);
  if (!result.ok) return { ...result, state: s };
  const state = structuredClone(s);
  state.queuedCommand = result.command;
  return { ...result, state, message: t('feedback.queued', {command:commandLabel(result.command),day:s.day+1}) };
}
export function cancelCommand(s) {
  return { ...s, queuedCommand: null };
}
export function setSpeed(s, speed) {
  if (!s.config.speeds.includes(speed)) throw new RangeError(t('errors.speed'));
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
    s.fireKnown = true; s.fireCounter = 0; s.wood -= c.fire.discoveryCost;
    for (const v of s.villagers) v.reaction = 'Learned fire';
    details = t('log.teach', {wood:c.fire.discoveryCost});
  }
  log(s, t('log.command', {command:commandLabel(command),cost:rule.cost,details}), 'command');
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
  const birthEligible = s.villagers.length < c.limits.population
    && s.food >= c.birth.foodPerPerson * s.villagers.length + c.birth.extraFood
    && !s.villagers.some(v => v.illnessDays > 0) && eligibleAdults.length >= c.birth.adults;
  s.birthCounter = birthEligible ? s.birthCounter + 1 : 0;
  if (s.birthCounter >= c.birth.consecutiveDays) {
    const id = s.nextId++;
    const child = villager(id, t('labels.newbornName', {id}), 0, c.newborn, c);
    // Newborns are not in today's work/meal/age/timer loop.
    child.activity = 'Newborn';
    if (s.villagers.length >= c.limits.shelter) child.safety = c.needs.unsafe;
    s.villagers.push(child); s.birthCounter = 0;
    report.birth = id;
    log(s, t('log.birth', {name:child.name}), 'birth');
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
      log(s, t('log.discovery', {wood:c.fire.discoveryCost}), 'discovery');
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
    log(s, t('log.ended'), 'end');
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
