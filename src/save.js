// Save and load (design section 10, "Save and load (v0.2)"): one slot in the
// browser's local storage, written at every day end and whenever the queued
// command changes, and the "begin anew" fresh start. No rules live here: a
// loaded run continues exactly as it would have without the reload.
import { createState } from './sim.js';
import { cleanWords } from './commands.js';

// Not saved: the config (rebuilt from src/config.js), the previous day's report,
// the play speed and the time inside the current day (an unfinished day is not
// saved; it replays the same way from its start).
const NOT_SAVED = new Set(['config', 'lastDay', 'speed', 'elapsedMs']);
const isCount = n => Number.isInteger(n) && n >= 0;

// The saved record: the format version plus every run field (seed, day, every
// Gourdling, stocks, discoveries, plots, shed, streaks, weather and its days
// left, tomorrow's rolled weather and illness, both dice positions, Wonder,
// cooldowns and once-per-run uses, the queued command, ended flag and stats).
export function serialize(s) {
  const run = {};
  for (const [key, value] of Object.entries(s)) if (!NOT_SAVED.has(key)) run[key] = value;
  return JSON.stringify({ version: s.config.save.version, run });
}

// Returns a playable state, or null when the text is missing, unreadable or
// from another save format (the page then starts a new run).
export function deserialize(text, overrides = {}) {
  if (typeof text !== 'string' || !text) return null;
  let data;
  try { data = JSON.parse(text); } catch { return null; }
  const run = data?.run;
  if (!run || typeof run !== 'object' || !isCount(run.seed)) return null;
  const fresh = createState(overrides, run.seed);
  if (data.version !== fresh.config.save.version) return null;
  // Every field a run has must be present, with the same kind of value.
  for (const [key, value] of Object.entries(fresh)) {
    if (NOT_SAVED.has(key)) continue;
    if (!(key in run)) return null;
    const kind = v => v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v;
    if (value !== null && run[key] !== null && kind(value) !== kind(run[key])) return null;
  }
  if (!isCount(run.day) || !isCount(run.rng) || !isCount(run.traitRng) || !isCount(run.nextId)) return null;
  const need = ['id', 'age', 'fullness', 'warmth', 'health', 'happiness', 'safety'];
  if (!run.villagers.every(v => v && need.every(k => Number.isFinite(v[k])))) return null;
  const s = { ...fresh, ...structuredClone(run), config: fresh.config, lastDay: null, elapsedMs: 0 };
  s.speed = 0;
  return s;
}

// One slot. `storage` is localStorage or a stand-in; failures (private mode,
// storage full, file:// restrictions) never stop the game.
export function createSaveSlot(storage, key) {
  return {
    save(s) { try { storage?.setItem(key, serialize(s)); return true; } catch { return false; } },
    load(overrides = {}) { let text = null; try { text = storage?.getItem(key) ?? null; } catch {} return deserialize(text, overrides); },
    clear() { try { storage?.removeItem(key); } catch {} },
  };
}

// "begin anew": the whole cleaned input must equal the phrase. With
// requireConfirm the first time only asks; the same phrase again within
// confirmSeconds of real time restarts. Any other input cancels the pending
// restart (and is then handled as a normal command). Pending state lives here
// only, never in the save, so a reload cancels it. `now` is injectable for tests.
export function createFreshStart(rule, now = () => Date.now()) {
  let askedAt = null;
  const pending = () => askedAt !== null && now() - askedAt <= rule.confirmSeconds * 1000;
  return {
    isPending: pending,
    // 'ask' (show the faint line), 'restart', 'cancel' (other input while
    // pending: fade the line, then treat the input as a command) or 'pass'.
    handle(text) {
      const wasPending = pending();
      askedAt = null;
      if (cleanWords(text) !== cleanWords(rule.phrase)) return wasPending ? 'cancel' : 'pass';
      if (!rule.requireConfirm || wasPending) return 'restart';
      askedAt = now();
      return 'ask';
    },
    cancel() { askedAt = null; },
  };
}
