# Local survival work

The original `reports/extinction-100.csv` covers hands-off seeds 0–99: 30
villages reached day 1,000 and all eventually died, with a maximum of 3,002 days.
Those original reports and the user's existing settler/bedding/scouting work
are preserved. This version is local only.

## The transition being modeled

A useful historical inspiration is repeatable, storable surplus coupled with
cooperation and continuity. At Dhra′, purpose-built granaries preceded crop
domestication ([Kuijt and Finlayson, 2009](https://pmc.ncbi.nlm.nih.gov/articles/PMC2700141/)).
Much later, Uruk combined agricultural production with specialization and large
institutions ([Metropolitan Museum](https://www.metmuseum.org/it/essays/uruk-the-first-city)).
This suggests several interacting developments rather than one civilization
unlock or an inevitable technology sequence.

The immediate goal is to let some villages replace generations and maintain
food production without interventions. A village surviving a fixed test
horizon is evidence of resilience, not proof of indefinite survival.

## Decisions in the live homestead

`src/needs.js` assesses the current villager and the supplies they can access:

1. Physiology: secure today's meal, warmth, illness recovery, and energy.
2. Safety: provisions beyond today, hearth fuel, and a sleeping place.
3. Belonging: company when unhappy or after time away from others.
4. Esteem/competence: favor useful repetition of known techniques.
5. Growth: give eligible experiments first consideration, with teaching and
   learning available when immediate needs are secure.

Shared food, that camp's preserved meals, travel meals, and eastern-settlement
supplies are accounted for where applicable. Someone else's isolated cache
does not automatically become available food. Social rhythms depend on
personality; actual company or lessons satisfy contact needs. Existing
recipe, material, experience, and infrastructure prerequisites still apply.

This agenda also gates optional standing-stone work, crafts, lessons,
experiments, and outings. Food-seeking hunts and emergency scouting remain
possible as survival activities. The hover details and notebook show the
priority assessed for the day's decision. Motives are recalculated as earlier
workers change the available supplies.

## Other causes addressed

- Planting no longer waits behind the full four-meals-per-person foraging
  target in established farms. It reserves supper and seed, requires known
  farming and an adult grower, and remains seasonal.
- Hungry villagers can harvest ripe plots; experiments cannot take that job.
- Empty gathering grounds lead to available fishing/hunting, warmth, or fuel
  collection rather than automatically resting.
- Eligible parents with fewer previous children are considered first, avoiding
  repeatedly selecting one father and producing a generation of half-siblings.
- Adults stranded without a possible unrelated partner can join an existing
  camp containing one. Parent/child and sibling exclusions remain in force.

New personal fields are optional in saved worlds. Old saves keep their known
crafts, fields, and discovery history, and infer initial family counts from
surviving children where no lifetime count exists. No save-version reset is
needed. The v0.1/v0.2 reference rules are unchanged.

## Reproduce the measurements

```powershell
node --test tests/*.test.js
node scripts/build.mjs
node scripts/survival-report.mjs 100 5000 survival-needs-100
```

The report arguments are run count, maximum days, report basename, and optional
first seed. CSV rows distinguish extinction from reaching the horizon; the JSON
summary includes a hash of the simulation sources. Recent births are counted
over the final 300 days, one full maximum lifespan. Death causes can overlap.
The runner is bounded, so resilient villages do not leave an extinction-only
script running forever. It never invokes divine powers.

## Results for this version

The original seeds 0–99 were rerun with all the changes above, including the
needs agenda. These figures measure the combined changes, not the isolated
effect of any one rule.

| Observation | Original report | Local version |
| --- | ---: | ---: |
| Alive at day 1,000 | 30 / 100 | 90 / 100 |
| Alive at day 5,000 | 0 / 100 | 6 / 100 |
| Day-5,000 survivors with births in their last 300 days | 0 | 6 |

The surviving seeds were 18, 19, 35, 40, 82, and 92. Results are in
`reports/survival-needs-100.csv` and `.json`.

Two of those seeds were separately rerun to a 10,000-day horizon:

```powershell
node scripts/survival-report.mjs 2 10000 survival-needs-extended 18
```

Seed 18 died on day 6,205 and seed 19 on day 6,177, so neither reached that
horizon. These selected runs test durability rather than estimate the overall
10,000-day survival rate. Most deaths in them were old age; eventual gaps in
replacement generations remain a constraint. The results demonstrate improved
resilience and ongoing reproduction at day 5,000, not indefinite stability.

Validation: all 135 tests pass, including the unchanged seeded v0.1/v0.2
reference checks. The offline build completes with all 51 images embedded,
and both embedded scripts parse successfully. No publishing was performed.

## Further development

Winter reserves, help and trade between camps, retention of essential knowledge,
and sustainable specialist labor are the next foundations for larger settlements.
They should emerge from usable materials, practiced skills, contact, and actual
surplus. This version does not add a civilization stage, new crops, or new crafts.
