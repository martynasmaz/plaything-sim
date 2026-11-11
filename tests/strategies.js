// The three seeded build-check strategies from design section 7, written
// against the public sim API. They see only today's state and weather.
import { createState, queueCommand, stepDay, validateCommand, forecastWeather } from '../src/sim.js';

// Returns the command to queue for the next day, or null.
export function chooseCommand(mode, s) {
  if (mode === 'none') return null;
  const ok = command => validateCommand(s, command).ok;
  const n = s.villagers.length, weakest = Math.min(...s.villagers.map(v => v.health));
  if (mode === 'helped') {
    const choices = [];
    if (weakest <= 45) choices.push('hoedown');
    if (!s.fireKnown) choices.push('teach spark');
    if (s.food < n * 2) choices.push('feast drop');
    if (['drought', 'cold'].includes(forecastWeather(s))) choices.push('cloud wrangle');
    if (weakest <= 75) choices.push('hoedown');
    return choices.find(ok) ?? null;
  }
  if (mode === 'cruel') return ['sick hex', 'dry spell'].find(ok) ?? null;
  throw new Error(mode);
}

// Play one seeded run and collect the same per-run facts as the reference sim.
export function playRun(seed, mode, days = 60) {
  let s = createState({}, seed);
  const row = { seed, wipeout_day: null, deaths30: 0, deaths60: 0, population30: 0, population60: 0,
    births60: 0, peak_population: 6, bonfire_day: null, cap_day: null, history: [] };
  for (let d = 0; d < days && !s.ended; d++) {
    const command = chooseCommand(mode, s);
    if (command) s = queueCommand(s, command).state;
    s = stepDay(s);
    if (s.ended && row.wipeout_day === null) row.wipeout_day = s.day;
    if (s.villagers.length === 8 && row.cap_day === null) row.cap_day = s.day;
    if (s.day <= 30) row.deaths30 = s.stats.deaths;
    if (s.day <= 60) row.deaths60 = s.stats.deaths;
    if (s.day === 30) row.population30 = s.villagers.length;
    if (s.day === 60) row.population60 = s.villagers.length;
    row.history.push({ day: s.day, weather: s.lastDay.weather, population: s.villagers.length, food: s.food,
      wood: s.wood, wonder: s.power, births: s.stats.births, deaths: s.stats.deaths, fire: s.fireKnown,
      command: s.lastDay.command?.ok ? s.lastDay.command.command : null });
  }
  Object.assign(row, { births60: s.stats.births, peak_population: s.stats.peak, bonfire_day: s.stats.fireDay });
  return row;
}

const pct = (rows, f) => 100 * rows.filter(f).length / rows.length;
const median = xs => { if (!xs.length) return null; const a = [...xs].sort((x, y) => x - y), m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
export function summarise(rows) {
  return {
    survive60_pct: pct(rows, r => r.population60 > 0),
    wipeout_by60_pct: pct(rows, r => r.wipeout_day !== null && r.wipeout_day <= 60),
    death_by60_pct: pct(rows, r => r.deaths60 > 0),
    bonfire_by60_pct: pct(rows, r => r.bonfire_day !== null),
    median_bonfire_day: median(rows.filter(r => r.bonfire_day !== null).map(r => r.bonfire_day)),
    cap_by60_pct: pct(rows, r => r.cap_day !== null),
    mean_population60: rows.reduce((a, r) => a + r.population60, 0) / rows.length,
    mean_deaths60: rows.reduce((a, r) => a + r.deaths60, 0) / rows.length
  };
}
export function batch(mode, from = 0, to = 199) {
  const rows = [];
  for (let seed = from; seed <= to; seed++) rows.push(playRun(seed, mode));
  return rows;
}
