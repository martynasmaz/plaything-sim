// The one place to tune the simulation. All display choices live in theme.js.
// Values below are copied from the v0.1 design, NOT adjusted to make tests pass.
export const CONFIG = {
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
    fullnessLoss: 25, warmthLoss: 10, rainWarmthLoss: 10,
    shelterWarmth: 10, fireWarmth: 5,
    emergencyFullness: 40, warmUpBelow: 40, warmUp: 20, warmUpWithFire: 40,
    eatAtOrBelow: 75, mealCost: 1, mealFullness: 30,
    damageAtOrBelow: 20, hungerDamage: 10, coldDamage: 10, illnessDamage: 8,
    recovery: 4, recoveryMin: 50,
    safeHealth: 50, safe: 80, unsafe: 40,
    happyMin: 50, happyGain: 2, unhappyBelow: 40, unhappyLoss: 4,
    illnessHappinessLoss: 5, restHappiness: 5, unwellBelow: 50
  },
  work: {
    foodTargetPerPerson: 4, woodTarget: 6,
    adultFood: { normal: 3, rain: 4, drought: 1 },
    childFood: { normal: 1, rain: 2, drought: 0 },
    adultWood: 2, childWood: 1
  },
  fire: { minWood: 3, discoveryCost: 2, dailyFuel: 1, fromDay: 10,
    adults: 2, happiness: 50, consecutiveDays: 3 },
  birth: { adults: 2, health: 70, fullness: 60, warmth: 50, happiness: 50,
    foodPerPerson: 2, extraFood: 4, consecutiveDays: 15 },
  power: { daily: 3, happyBonus: 2, happyAverage: 60 },
  milestone: { day: 30, population: 5 },
  commands: {
    rain: { cost: 10, cooldown: 4, duration: 3 },
    drought: { cost: 10, cooldown: 4, duration: 3 },
    bless: { cost: 20, cooldown: 5, health: 15, happiness: 15 },
    plague: { cost: 30, cooldown: 8, duration: 3 },
    'teach fire': { cost: 25, cooldown: null },
    harvest: { cost: 20, cooldown: 5, food: 12 }
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
