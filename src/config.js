// The one place to tune the simulation. All display choices live in theme.js.
// Values below are copied from the v0.1 design (survival rebalance, matching
// /workspace/sim/gourdling_survival.py), NOT adjusted to make tests pass.
export const CONFIG = {
  // v0.2 rules (farming, shake off, teach sowing, second shed) and Gourdling
  // personalities, matching /workspace/sim/gourdling_v02.py. Tests set
  // version 'v0.1' and traits false to check the v0.1 rules unchanged.
  version: 'v0.2',
  traits: true,
  enablePlague: true, // Set false, then run `npm run build` to hide/disable plague.
  dayMs: 30_000,
  speeds: [0, 1, 3],
  start: {
    food: 18, wood: 12, power: 50,
    ages: [40, 50, 60, 70, 80, 90],
    fullness: 75, warmth: 70, health: 100, happiness: 60
  },
  newborn: { fullness: 80, warmth: 60, health: 100, happiness: 60 },
  limits: { need: 100, stock: 100, power: 100, population: 8, shelter: 8, log: 10 },
  life: { adult: 20, elder: 240, death: 300 },
  needs: {
    fullnessLoss: 25, warmthLoss: 10, rainWarmthLoss: 10, coldWarmthLoss: 40,
    shelterWarmth: 10, fireWarmth: 10,
    emergencyFullness: 40, warmUpBelow: 40, warmUp: 20, warmUpWithFire: 40,
    eatAtOrBelow: 75, mealCost: 1, mealFullness: 30,
    damageAtOrBelow: 20, hungerDamage: 10, coldDamage: 10, illnessDamage: 20,
    recovery: 4, recoveryMin: 50,
    safeHealth: 50, safe: 80, unsafe: 40,
    happyMin: 50, happyGain: 2, unhappyBelow: 40, unhappyLoss: 4,
    illnessHappinessLoss: 5, restHappiness: 5, unwellBelow: 50
  },
  work: {
    foodTargetPerPerson: 4, woodTarget: 6,
    adultFood: { normal: 3, rain: 4, drought: 1, cold: 3 },
    childFood: { normal: 1, rain: 2, drought: 0, cold: 1 },
    adultWood: 2, childWood: 1
  },
  fire: { minWood: 3, discoveryCost: 2, dailyFuel: 1, fromDay: 20,
    adults: 2, happiness: 50, consecutiveDays: 3 },
  birth: { adults: 2, health: 70, fullness: 60, warmth: 50, happiness: 50,
    foodPerPerson: 2, extraFood: 4, consecutiveDays: 5 },
  // Seeded dice: exactly 3 rolls every night (weather, illness, who falls ill).
  // Chances are percentages of a 100-sided die, checked in this order.
  weather: { chances: { normal: 31, rain: 30, drought: 25, cold: 14 } },
  illness: { chance: 13, duration: 3 },
  rng: { warmupSteps: 8 },
  power: { daily: 3, happyBonus: 2, happyAverage: 60 },
  milestone: { day: 30, population: 5 },
  commands: {
    rain: { cost: 10, cooldown: 4, duration: 3 },
    drought: { cost: 10, cooldown: 4, duration: 3 },
    bless: { cost: 20, cooldown: 5, health: 25, happiness: 15 },
    plague: { cost: 30, cooldown: 8, duration: 3 },
    'teach fire': { cost: 25, cooldown: null },
    harvest: { cost: 20, cooldown: 5, food: 12 },
    // v0.2 only (hidden and refused under version 'v0.1').
    heal: { cost: 25, cooldown: 6, since: 'v0.2' },
    'teach farming': { cost: 25, cooldown: null, since: 'v0.2' }
  },
  // v0.2 farming: one shared field, natural discovery or teach sowing.
  farming: { fromDay: 40, adults: 3, happiness: 55, foodPerPerson: 3, consecutiveDays: 5,
    plots: 4, ripeAt: 6, growth: { normal: 1, rain: 2, drought: 0, cold: -2 },
    harvestFood: 8, plantCost: 1, plantFoodPerPerson: 2, plantExtraFood: 1 },
  // v0.2 second Plank shed: built once at day end, stands the next day.
  shed: { population: 7, wood: 20, places: 4, woodTarget: 20 },
  // Gourdling personalities (v0.2): 5 opposite pairs, in this table order.
  personality: {
    list: ['Smart', 'Scatterbrained', 'Brave', 'Timid', 'Generous', 'Grabby', 'Sociable', 'Loner', 'Hardy', 'Shivery'],
    seedXor: 0x5EED7A17, perGourdling: 2,
    scatterbrained: { chance: 20, forageUpTo: 7, woodUpTo: 14 },
    braveWarmUpBelow: 20, timidWarmUpBelow: 60,
    generousMinFullness: 50, grabbyEatAtOrBelow: 85,
    restTogether: 8, restAlone: 2,
    hardyColdLoss: 35, shiveryExtraLoss: 10,
    logPerDay: 3,
    // Internal-log priority when more than 3 lines compete (lower is kept first).
    logPriority: { Generous: 0, Grabby: 1, Smart: 2, Scatterbrained: 3, Brave: 4, Timid: 4, Sociable: 5, Loner: 5 }
  }
};

// Allow small nested overrides in tests without accidentally losing other rules.
export function makeConfig(overrides = {}) {
  function merge(base, patch) {
    const result = structuredClone(base);
    for (const [key, value] of Object.entries(patch)) {
      result[key] = value && typeof value === 'object' && !Array.isArray(value)
        ? merge(base[key] || {}, value) : structuredClone(value);
    }
    return result;
  }
  return merge(CONFIG, overrides);
}
