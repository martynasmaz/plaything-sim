// Docs are the source of truth: numbers quoted in "How a Gourdling decides"
// (docs/IMPLEMENTATION.md) must match src/config.js. Each check is a phrase
// pattern with ONE captured number and the config value it must equal.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONFIG as c } from '../src/config.js';

const doc = readFileSync(new URL('../docs/IMPLEMENTATION.md', import.meta.url), 'utf8');
const section = doc.split('## How a Gourdling decides')[1]?.split('\n## ')[0] ?? '';
const n = c.needs, w = c.work, ch = c.weather.chances;
const CHECKS = [
  [/loses (\d+) fullness/, n.fullnessLoss],
  [/warmth changed once: −(\d+)/, n.warmthLoss],
  [/a further −(\d+) in rain/, n.rainWarmthLoss],
  [/or −(\d+) in a cold snap/, n.coldWarmthLoss],
  [/\+(\d+) for its Plank-shed place/, n.shelterWarmth],
  [/\+(\d+) more if the Bonfire is lit/, n.fireWarmth],
  [/fullness below (\d+) and fewer/, n.emergencyFullness],
  [/An adult brings (\d+) provisions/, w.adultFood.normal],
  [/\((\d+) in rain, \d+ in a dry spell, \d+ in a cold snap\)/, w.adultFood.rain],
  [/\(\d+ in rain, (\d+) in a dry spell, \d+ in a cold snap\)/, w.adultFood.drought],
  [/\(\d+ in rain, \d+ in a dry spell, (\d+) in a cold snap\)/, w.adultFood.cold],
  [/a child brings (\d+) \(/, w.childFood.normal],
  [/a child brings \d+ \((\d+) in rain/, w.childFood.rain],
  [/(\d+) in a dry spell\)\./, w.childFood.drought],
  [/warmth is below (\d+)/, n.warmUpBelow],
  [/: \+(\d+) warmth, or/, n.warmUp],
  [/or \+(\d+) when the Bonfire is lit/, n.warmUpWithFire],
  [/fewer than (\d+) provisions per living/, w.foodTargetPerPerson],
  [/if there are fewer than (\d+):/, w.woodTarget],
  [/an adult brings (\d+), a child/, w.adultWood],
  [/a child (\d+)\.\n/, w.childWood],
  [/otherwise: \+(\d+) happiness/, n.restHappiness],
  [/at (\d+) fullness or less eats/, n.eatAtOrBelow],
  [/\(\+(\d+) fullness\)/, n.mealFullness],
  [/At (\d+) fullness or less it loses/, n.damageAtOrBelow],
  [/it loses (\d+)\s+health/, n.hungerDamage],
  [/warmth or less another (\d+)/, n.coldDamage],
  [/illness day costs (\d+) health/, n.illnessDamage],
  [/health and (\d+)\s+happiness\. With/, n.illnessHappinessLoss],
  [/it recovers (\d+) health/, n.recovery],
  [/Safety is (\d+)/, n.safe],
  [/otherwise (\d+)\. Happiness/, n.unsafe],
  [/Happiness gains (\d+)/, n.happyGain],
  [/or loses (\d+) if any/, n.unhappyLoss],
  [/or age (\d+) means death/, c.life.death],
  [/fewer than (\d+) Gourdlings, at least/, c.limits.population],
  [/at least (\d+)\s+provisions per Gourdling/, c.birth.foodPerPerson],
  [/per Gourdling plus (\d+)/, c.birth.extraFood],
  [/at least (\d+) adults \(ages/, c.birth.adults],
  [/\(ages (\d+) to/, c.life.adult],
  [/to\s+(\d+)\) have/, c.life.elder - 1],
  [/have health (\d+)\+/, c.birth.health],
  [/fullness (\d+)\+, warmth/, c.birth.fullness],
  [/warmth (\d+)\+ and happiness/, c.birth.warmth],
  [/and happiness (\d+)\+\. After/, c.birth.happiness],
  [/After (\d+)\s+eligible days in a row/, c.birth.consecutiveDays],
  [/From day (\d+), a day counts/, c.fire.fromDay],
  [/at least (\d+) Gourdlings are/, c.fire.adults],
  [/average happiness is (\d+)\+, nobody/, c.fire.happiness],
  [/at least (\d+)\s+firewood\. After/, c.fire.minWood],
  [/After (\d+) such days/, c.fire.consecutiveDays],
  [/known \((\d+) firewood spent\)/, c.fire.discoveryCost],
  [/using (\d+) firewood a day/, c.fire.dailyFuel],
  [/discovery is day (\d+)\./, c.fire.fromDay + c.fire.consecutiveDays - 1],
  [/exactly (\d+) rolls/, 3],
  [/\((\d+)% fair/, ch.normal],
  [/(\d+)% rain,/, ch.rain],
  [/(\d+)% dry spell,/, ch.drought],
  [/(\d+)% cold snap\)/, ch.cold],
  [/falls ill \((\d+)%\)/, c.illness.chance],
  [/the illness lasts (\d+) days/, c.illness.duration],
  [/override the weather for (\d+) days/, c.commands.rain.duration],
];

test('"How a Gourdling decides" exists and every quoted number matches config', () => {
  assert.ok(section.length > 500, 'section missing from docs/IMPLEMENTATION.md');
  for (const [pattern, value] of CHECKS) {
    // Line breaks in the Markdown count as spaces.
    const m = section.match(new RegExp(pattern.source.replace(/ /g, '\\s+')));
    assert.ok(m, `phrase not found: ${pattern}`);
    assert.equal(Number(m[1]), value, `${pattern} says ${m[1]}, config says ${value}`);
  }
});
