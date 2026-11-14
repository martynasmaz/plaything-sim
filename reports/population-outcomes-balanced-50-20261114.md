# Local village outcomes — 14 November 2026

50 fresh, independent seeds (0–49), six founders each, up to day 3,000. No god commands, gifts, immigration, magic unlock or rescue rules.

## Observed outcome frequencies

| Outcome at day 3,000 | Villages | Observed frequency | Approx. 95% sampling interval |
|---|---:|---:|---:|
| Extinct | 35/50 | 70% | 56.2–80.9% |
| Alive, but at risk | 1/50 | 2% | 0.4–10.5% |
| Small / recovering | 0/50 | 0% | 0.0–7.1% |
| Continuing generations | 14/50 | 28% | 17.5–41.7% |

**The balance target is not met yet:** most villages still die out in this sample. Better access to food and earlier housing permit more births, but do not establish a sustainable food economy. Continuing generations at the horizon should not be read as a guaranteed successful ending.

These categories are mutually exclusive. Surviving a finite test is not permanent survival. The intervals are binomial sampling guides, assuming the tested seeds are representative; they do not cover future rule changes or other settings. Zero observations do not mean an outcome is impossible.

- **Extinct:** nobody remains at or before the horizon.
- **At risk:** alive, but no birth in the last 300 days or no unrelated opposite-sex pair with overlapping potential reproductive ages. Children who could mature are included in that check.
- **Small / recovering:** fewer than six residents, recent births and a potentially viable next generation.
- **Continuing:** at least six residents, recent births and a potentially viable next generation. This is not a permanent win or proof of a balanced food economy.

## Same ten seeds as the original audit

| Seed | Earlier outcome | Updated outcome | Earlier peak | Updated peak |
|---|---|---|---:|---:|
| 0 | 17 alive | 21 alive | 24 | 34 |
| 1 | Extinct day 1,515 | Extinct day 890 | 26 | 32 |
| 2 | 22 alive | Extinct day 744 | 25 | 33 |
| 3 | Extinct day 720 | 31 alive | 21 | 34 |
| 4 | Extinct day 1,124 | Extinct day 2,105 | 24 | 33 |
| 5 | Extinct day 1,348 | Extinct day 1,208 | 21 | 33 |
| 6 | Extinct day 386 | Extinct day 1,111 | 8 | 34 |
| 7 | 14 alive | 8 alive | 23 | 33 |
| 8 | 17 alive | 10 alive | 22 | 33 |
| 9 | Extinct day 2,435 | Extinct day 513 | 23 | 11 |

Earlier: 4/10 survived day 3,000. Updated: 4/10 survived. These are paired starting seeds, but all implementation changes were tested together, so the comparison does not isolate any single change.

## What is implemented

- Finished local food counts toward family readiness. Each camp's stores cover its own needs; the main pantry covers remaining deficits. Empty and abandoned stores or food still drying do not become available meals.
- During a shared-pantry shortfall, residents who have preserved food use enough of it to leave shared meals for residents without stores. Fresh pantry food is otherwise eaten first. This does not create food or move private stores between camps.
- Household food security follows that same allocation. Recent hunger or declining reserves delay births; stable full stores qualify. Experienced food preservers can plan and pay for more storage using observed winter intake.
- Huts are planned with two places remaining. Completed communal shelter, usable tools, clearing, materials and workdays still matter; plans grant no beds.
- Neighboring settlements exchange paid visits, practiced techniques and family connections. Parents can join a household or remain in separate communities following real recent contact. Close relatives remain excluded. There are no outside rescue settlers.
- Three-day birth readiness, seven-day maternal recovery, lifespan and food yields retain their configured values. These changes do not guarantee that a village discovers effective long-term food management.

## Further observations

Across all 50 updated runs: 11,618 births; 11,595 deaths; 230 neighboring-village meetings; 25 household moves after visits; 25 births linked to parents from different communities; 1 techniques learned on visits.

Deaths involving hunger: 8,598; cold: 43; old age: 2,579. Causes can overlap. Counts span differing amounts of surviving population-time, so raw totals alone are not mortality rates.

Early trial versions produced faster growth but severe famine or excessive reproductive caution. Those experimental logs are separate from this final measured source version; they are not pooled into the odds above. The final version keeps ecological limits and genuine demographic failure rather than forcing successful endings.

## Recommended next balance work

1. Make family planning consider the next lean season and expected dependent mouths, rather than treating a short run of stable stocks as sufficient. Use villagers' observed experience and available stores, preserving independent discoveries and occasional failure.
2. Measure winter production, preservation work and storage separately. Build a reserve before expanding the household; extra empty storage alone cannot supply meals. Audit whether urgent food work interrupts optional tasks early enough.
3. Keep neighboring families and knowledge exchange, but diagnose how often safe visits are unavailable before kinship becomes limiting. These are connections between existing communities, not a source of free rescue settlers.
These are recommendations, not additional unmeasured rule changes in this batch. Repeat the same ten comparison seeds and a separate larger sample after the next balance change.

## Validation and reproduction

Current source SHA-256: `bba692e9e7e48921cab08c4fb68d0412fbdc5023e2ab7c5033b46d34df336789`.
Archived baseline SHA-256: `1aa980f253e9e3aeea5940c17944c66c148590854fadf0417a28fc852900dbbb`.

The runner directly calls the live simulation and verifies population conservation (`6 + births − deaths`) and nonnegative food stocks. It checks that its decision modules did not change during the batch. The original ten-seed audit and its data are preserved. New data is in the CSV and JSON sharing this report's prefix.

```
node scripts/population-followup.mjs population-outcomes-balanced-50-20261114 50 0
```

The separate full unit suite and native Canvas checks cover compatibility, real construction, food accounting, visits, family relationships and save/load behavior. No publishing or player-save changes are part of the audit.
