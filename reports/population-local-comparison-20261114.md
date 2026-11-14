# Population growth and sustainability — local version, 14 November 2026

The local version improves survival to day 3,000 from **9/50 (18%) to 25/50 (50%)**. Half the villages still become extinct; this has not yet reached the desired balance where most villages persist. Reaching day 3,000 does not demonstrate indefinite sustainability.

## Method

The exact same seeds 0–49, six initial founders, hands-off, magic disabled, maximum 3,000 days, with no restarts or discarded outcomes. The earlier wheat-version results remain unchanged in [baseline data](population-wheat-sustainability-50-20261114.json). The [new data](population-local-final-50-20261114.json) and [CSV](population-local-final-50-20261114.csv) record every ending. The original ten seeds also have [before](sustainability-before-weather-10-20261114.json) and [after](sustainability-local-final-10-20261114.json) detailed food/knowledge audits from immutable source snapshots.

New run decision-source SHA-256: f3fd26d3fbe553530a9d6233aeff542326d26bc5c0340ecf725ca908fabedb46. Detailed audit snapshot: af4bb043c638b6f54bc3aa0e38eb0a01410dc30432e30d4de3b629516bf39f17.

This is a combined update: regional weather, food-processing learning, crop mix, hunting interception, observation, new-arrival initialization and occasional inspiration are all included. It does not isolate which individual change caused each outcome. The same nightly dice sequence is preserved, but the climate interpretation changes the conditions. Headless daily runs do not include presentation-triggered river accidents or any god actions. Fifty sequential seeds are a limited sample, not a guaranteed probability for every world; intervals below are descriptive Wilson 95% intervals under a binomial model.

## Ending estimates

| Ending at day 3,000 | Runs | Observed share | Approx. interval |
| --- | ---: | ---: | ---: |
| Extinct | 25 | 50% | 36.6–63.4% |
| Continuing | 24 | 48% | 34.8–61.5% |
| At risk | 1 | 2% | 0.4–10.5% |
| Recovering, fewer than six people | 0 | 0% | 0.0–7.1% |

“Continuing” means alive, a birth in the last 300 days and a viable future unrelated reproductive pair. It is not a promise of permanent survival. “At risk” means no such future pair or no recent birth; the affected run is seed 39 (9 people; last birth day 2988; no viable future unrelated pair). “Recovering” uses the same continuing criteria but ends below the founding population.

| Measure | Earlier version | Local version |
| --- | ---: | ---: |
| Alive at day 1,000 | 31/50 | 32/50 |
| Alive at day 3,000 | 9/50 | 25/50 |
| Mean peak population | 28.1 | 30.08 |
| Births, all runs combined | 8653 | 12438 |
| Hunger-involving deaths, all runs combined | 6518 | 8366 |
| Old-age-involving deaths | 1931 | 3333 |

The earlier survival estimate was 18% (9.8–30.8%); the local estimate is 50% (36.6–63.4%). There are 21 newly surviving seeds, 5 previously surviving seeds that now die, and four that survive both versions. This is not an across-the-board improvement for every particular seed. More births and absolute deaths partly reflect the longer combined lifetime of the new villages; absolute deaths alone do not measure individual risk.

## Findings from the same ten detailed seeds

1. **The grain-processing handoff was a real bottleneck.** Earlier, operating a quern required personally knowing how to construct it. The building could remain while its last knowledgeable maker died, leaving later villagers unable to process their grain. Milling now has separate operational prerequisites, and supervised production pays for the actual ingredients and pupil's work. Days with hunger while usable raw grain/flour remained fell from **1214 to 40** across the ten runs (96.7% fewer). These are summed village-days with at least eight grain or four flour, not individual hungry days.
2. **A cereal monoculture was too fragile.** The earlier growers could replace every bed with slow-maturing wheat before a reliable processing chain existed. The local version preserves kitchen gardens and limits initial wheat beds. Bread production across the ten runs rose from **4248 to 16000 portions**. This is observed combined behavior, not proof that the crop-mix change alone caused the increase.
3. **Winter remains dangerous.** 1398 of the 1540 hunger-involving deaths in the ten-run comparison occurred in winter. Winter hunger-death rates fell from 15.83 to 12.84 per 1,000 winter villager-days, but the remaining seasonal loss is substantial. More storage capacity helps only if villagers actually fill it from genuine surplus before winter.
4. **Some villages die demographically with food left.** In the detailed rerun, seeds 4, 5 and 8 ended with edible reserves after small reproductive cohorts failed to replace themselves. The 50-run table includes several villages with only four to ten lifetime births and no hunger deaths. Moving between camps helps contacts, but those camps share the same original founding population; visits do not create unrelated outsiders.
5. **Early survival barely changes, while later survival improves.** The day-1,000 count rises only from 31 to 32, while the day-3,000 count rises from 9 to 25. The later food-processing chain helps the villages that establish it. It does not rescue every small founding community.
6. **Hunting already happened, but interception underestimated reachable animals.** Across the controlled ten audits, deer-tracking actions rose from 3,386 to 3,637 (the runs also have different total exposure). In a separate controlled reach check with six healthy bow-equipped adults and 300 independent normal-weather days, both versions attempted 70 passing-deer hunts: the earlier timing allowed 26 catches, the corrected timing 44. That fixture tests interception, not natural equipment uptake or survival odds. Deer supplies existing food provisions, with a small confidence benefit; no protein multiplier or free food was added.

## Restrained next recommendations

- Use day **1,000 as the first development checkpoint** next time. In the current runs 32/50 villages are still alive then; their median population is 24, mean 22.75 and maximum 33, versus a median of 18 in the earlier survivors. Measure accessible finished-food reserve days across seasons, the fraction of work spent securing food, and sustained non-food occupations alongside headcount.
- Allow **paid field expansion**. Cultivated land currently remains fixed at four plots, so food production cannot scale freely with an established population. Experienced farmers could clear modest new patches, acquire seed, plant and maintain them using real work and materials. Dependable surplus should then support more regular millers, bakers, builders, healers and teachers. This expansion is a recommendation, not an implemented feature of the measured version.
- Make autumn decisions compare **accessible finished reserves with expected winter consumption**, and favour filling existing drying racks while there is real surplus. Reserve enough meals for today and enough wood to keep the hearth alive; no automatic grain-to-food conversion.
- Improve **early household and family planning**: begin affordable housing before the first cohort is blocked, and encourage encounters between available unrelated adults while multiple founding lineages are still fertile. Do not relax close-kin restrictions or create births without eligible parents.
- Consider a **rare, conditional outsider visit** to a shrinking but habitable village, using an actual journey, rations and social contact. It could introduce an unrelated adult without guaranteeing rescue every run. This is a proposal; automatic outsider arrivals have not been added.
- Keep operational teaching tied to useful work and spread key food skills across more than one living practitioner. Preserve failure and occasional knowledge loss; test each further change separately on the same seeds before combining it.

## Per-seed outcomes

“Final” is the population at extinction or day 3,000. All extinct runs end at zero.

| Seed | Earlier final | Local final | Last day | Births | Hunger deaths | Local ending |
| ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 0 | 16 | 28 | 3000 | 418 | 268 | continuing |
| 1 | 0 | 20 | 3000 | 444 | 307 | continuing |
| 2 | 0 | 0 | 1093 | 112 | 79 | extinct |
| 3 | 0 | 0 | 331 | 15 | 13 | extinct |
| 4 | 25 | 0 | 542 | 5 | 0 | extinct |
| 5 | 0 | 0 | 513 | 4 | 0 | extinct |
| 6 | 0 | 19 | 3000 | 421 | 285 | continuing |
| 7 | 0 | 30 | 3000 | 417 | 271 | continuing |
| 8 | 0 | 0 | 555 | 10 | 0 | extinct |
| 9 | 0 | 18 | 3000 | 428 | 317 | continuing |
| 10 | 0 | 31 | 3000 | 416 | 260 | continuing |
| 11 | 0 | 0 | 2047 | 231 | 172 | extinct |
| 12 | 0 | 29 | 3000 | 426 | 298 | continuing |
| 13 | 0 | 0 | 558 | 8 | 0 | extinct |
| 14 | 0 | 29 | 3000 | 415 | 290 | continuing |
| 15 | 0 | 0 | 971 | 95 | 61 | extinct |
| 16 | 0 | 0 | 487 | 4 | 0 | extinct |
| 17 | 0 | 31 | 3000 | 422 | 272 | continuing |
| 18 | 0 | 30 | 3000 | 428 | 290 | continuing |
| 19 | 0 | 19 | 3000 | 406 | 296 | continuing |
| 20 | 0 | 21 | 3000 | 437 | 288 | continuing |
| 21 | 0 | 0 | 1148 | 111 | 77 | extinct |
| 22 | 25 | 0 | 492 | 25 | 2 | extinct |
| 23 | 0 | 0 | 548 | 6 | 0 | extinct |
| 24 | 0 | 19 | 3000 | 415 | 283 | continuing |
| 25 | 0 | 0 | 1046 | 78 | 51 | extinct |
| 26 | 0 | 0 | 1972 | 249 | 181 | extinct |
| 27 | 0 | 27 | 3000 | 420 | 260 | continuing |
| 28 | 0 | 29 | 3000 | 432 | 296 | continuing |
| 29 | 0 | 0 | 2350 | 304 | 232 | extinct |
| 30 | 0 | 26 | 3000 | 452 | 318 | continuing |
| 31 | 0 | 32 | 3000 | 409 | 236 | continuing |
| 32 | 0 | 25 | 3000 | 406 | 254 | continuing |
| 33 | 0 | 0 | 354 | 4 | 0 | extinct |
| 34 | 0 | 0 | 560 | 48 | 35 | extinct |
| 35 | 0 | 29 | 3000 | 436 | 297 | continuing |
| 36 | 27 | 0 | 561 | 50 | 34 | extinct |
| 37 | 0 | 0 | 432 | 22 | 1 | extinct |
| 38 | 25 | 0 | 877 | 89 | 57 | extinct |
| 39 | 0 | 9 | 3000 | 420 | 303 | at_risk |
| 40 | 17 | 0 | 521 | 5 | 0 | extinct |
| 41 | 0 | 31 | 3000 | 428 | 295 | continuing |
| 42 | 27 | 30 | 3000 | 414 | 249 | continuing |
| 43 | 0 | 0 | 542 | 6 | 0 | extinct |
| 44 | 13 | 33 | 3000 | 414 | 273 | continuing |
| 45 | 0 | 0 | 398 | 17 | 17 | extinct |
| 46 | 0 | 0 | 342 | 17 | 17 | extinct |
| 47 | 5 | 23 | 3000 | 454 | 314 | continuing |
| 48 | 0 | 31 | 3000 | 443 | 307 | continuing |
| 49 | 0 | 0 | 2492 | 302 | 210 | extinct |
