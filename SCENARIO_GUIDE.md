# Editing the simulation

Edit **`src/scenario.js`**. It is the main, commented settings file for the playable homestead. Leave the exported object and field names intact; change the values.

Run `npm run scenario:check`, then `npm run build`. Reload your local game. The offline `dist/index.html` embeds the settings at build time; editing the source alone does not change an already built offline copy. Nothing is published automatically.

## Rules first, seed second

The settings determine the rules, available opportunities and probabilities. The seed determines the particular weather, personalities, encounters and accidents. Use the same settings and a fresh `?seed=123` URL to reproduce a run. Change one group of settings at a time and compare several identical seeds. A favorable probability cannot create missing materials or bypass a villager's prerequisites.

`name` and `revision` appear in Observe. Increase the revision when changing the balance. `npm run scenario:check` prints a fingerprint to identify the exact settings used.

Set `defaultSeed` to an integer to make new worlds use that seed, or leave it `null` for random worlds. An explicit `?seed=123` URL overrides it and starts fresh; an existing save continues its own seed. The simulation-report scripts accept explicit seed ranges, which override this UI default.

## Main controls

| Section | Controls |
| --- | --- |
| `simulation.start` | Initial supplies, initial needs and founder ages. The number of entries in `ages` sets the founder population. |
| `simulation.life` | Human adulthood, elder age and lifespan in game days. |
| `simulation.needs` | Daily hunger/warmth loss, meal size, damage and recovery. |
| `simulation.birth` | Food, health, warmth and happiness requirements; consecutive eligible days; childbirth recovery. These are requirements, not a guaranteed birth date. |
| `simulation.learning` | Resource abundance/regrowth, spoilage, work fatigue, rest, experimentation and teaching. `experimentChance` is a percentage, with personal curiosity/experience bonuses. |
| `simulation.learning.development` | Enable/disable field expansion, seasonal planning, regular roles and family planning independently. |
| `simulation.learning.husbandry` | Enable/disable the husbandry simulation. Existing saved livestock/structures are retained and paused if disabled. |
| `simulation.settlement` | Beds per hut, communal shelter and bridge work, fuel reserve and shelter warmth. |
| `simulation.hunting`, `wildlife` | Resident game replenishment, passing wildlife frequency, deer share and passing group size. |
| `weather` | Kaunas or simple weather; wet-day/heavy-day frequency, precipitation amount and temperature modifiers. Kaunas normals remain the unmodified baseline. |
| `progression.wheat` | Earliest cereal discovery, observed seasons, crop maturation, harvest and milling/bread quantities. Experience and infrastructure are still required. |
| `progression.fields` | Work per extra field and maximum cultivated plots. |
| `inspiration` | Natural opportunity probability, duration, topic cooldown and experimentation bonus. |
| `river` | Fatality probability per recorded fall. These falls are presentation-triggered and are not included in headless population runs. |
| `livestock` | Contact/trade/breeding probabilities, required experience, safety buffers, herd targets, hay, compost and animal risks. |
| `livestock.buildings` | Construction materials, work and enclosure capacity. Costs are paid progressively; clearing trees takes additional workdays. |
| `livestock.species` | Maturity, lifespan, gestation, breeding interval, litter, feed/space needs, products and acquisition price. Animal time uses the four-season game year. |

Probabilities generally use **0–1**: `0` never, `0.25` 25%, `1` every eligible opportunity. Illness, experimentation and `weather.simpleChances` use percentages. The four simple-weather percentages must sum to 100; the rain multipliers apply to the Kaunas model. Trade/contact probabilities are checked on eligible work opportunities; breeding odds are checked on eligible females. These are not unconditional odds of reaching a particular ending.

## Examples

- Earlier wheat: change `progression.wheat.earliestDay` from `360` to `240`. Lower `observedSeasons` only if you also want to shorten the observation requirement. Tools, skills, seed and processing work still matter.
- Easier winters: increase `simulation.start.food` for a founding buffer, reduce `simulation.learning.spoilage`, or increase `learning.abundance` for wild resources. These have different effects; initial food does not solve later winters.
- More livestock opportunities: reduce `livestock.minimumCompletedWinters`, increase the safety of keeping animals by reducing the relevant `risks`, or adjust acquisition prices. Default contact/trade/breeding chances are already `1` when all their prerequisites exist.
- Less reliable husbandry: set `contactChance` or `tradeChance` to `0.3`, or increase animal feed needs. Setting a chance to `0` disables that opportunity without removing saved objects.
- Faster learning: increase `simulation.learning.progress` or `experimentChance`, or reduce `lessonDays`. Discovery still requires personal prerequisites and materials.
- Different weather: set `wetDayMultiplier` to `0.8` for fewer wet days, or `rainAmountMultiplier` to `1.25` for more rain per wet event. Heavy-day probability is capped by wet-day probability.

## Existing saves

Initial population/supplies apply only to new worlds. Most other edits affect future simulated days after reload, because saves use the current rules. Earlier discoveries, ancestry, ownership and physical projects remain. Completed livestock buildings retain completion when their work requirement increases; their original recorded material investments remain.

Use a **new world** when changing season length, age thresholds, capacities, crop timing, recipe proportions or building costs. Those changes can make an existing world's calendar or unfinished projects inconsistent with its earlier rules. Lowering lifespan below an existing person's age can cause their death at the next life check.

For the current defaults, run the full test suite before releasing code. Some tests intentionally assert default balance values; a deliberate scenario change may require updating those expectations. `scenario:check` validates settings without requiring you to preserve the default balance.
