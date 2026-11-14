# Local development version — 14 November 2026

These changes remain local. The published GitHub Pages version is still commit `b66d844f5213e30658ba8ce2a444afbc1fcf457f`, containing the earlier widescreen and storm presentation fixes.

The subsequent food-surplus/development update is now implemented as well. See [the current growth results](growth-development-results-20261114.md) for paid field expansion, seasonal planning, recurring work roles and earlier household planning, validated through day 1,000 on 50 comparison seeds and 100 fresh seeds.

## Climate basis and limits

The live homestead now samples precipitation from the Lithuanian Hydrometeorological Service's **Kaunas 1991–2020 normals**, using monthly wet-day frequencies (at least 0.1 mm), heavy-day frequencies (at least 10 mm), precipitation totals and mean temperatures. Sources: [LHMT standard climate normals](https://www.meteo.lt/app/uploads/2023/11/standartine-klimato-norma-1991-2020.pdf), [LHMT agrometeorological reference, tables 2.2.1–2.2.3](https://www.meteo.lt/app/uploads/2024/03/AGROMETEOROLOGINIU-RODIKLIU-LIETUVOJE-ZINYNAS.pdf).

The observed annual reference is roughly 175 wet days, 15.4 days with at least 10 mm, 3.23 days with at least 20 mm, and 651 mm precipitation. Monthly rounded figures can differ slightly from the annual figures. The sampler fits the monthly totals and >=10 mm frequencies; an exponential heavy-rain tail fits the annual >=20/10 ratio. That tail's monthly distribution is an inference, not an observed monthly >=20 mm table.

Game categories are drizzle (<2 mm per representative day), steady (2–10), heavy (10–20) and downpour (>=20). The 2 mm division and within-bin amounts are fitted presentation choices. **Daily amounts are not hourly intensity measurements**, and “downpour” is not a calibrated meteorological cloudburst threshold.

Three calendar months fit into each 20-day season, beginning with March. An 80-day game year is a compressed sample of representative real days. Temperature anomalies, day-to-day sequencing, snow accumulation/melt, soil evaporation and ice formation remain illustrative game rules. This is a modern regional climate approximation, not an ancient Kaunas climate reconstruction or hydrological river model. Explicit custom weather distributions remain available for controlled simulations.

Soil moisture carries between days; rain and snowmelt replenish it, dry weather removes it, and repeated saturation slows growth. Gardens and wheat use the same soil conditions and their existing distinct maturation thresholds. Winter/frozen conditions pause growth. Heavy rain pauses exposed fishing (including short weekly checks), gathering riverbank materials and outdoor food drying. Light rain has a smaller warmth penalty; stronger rain has a larger one. Wet tinder protection still depends on existing fire tools. God weather overrides still work. This version does not assign an unsupported real-world probability to a catastrophic river flood.

## Local behavior and interface changes

- New arrivals begin with the same base practice knowledge and energy as founders. Their social clock starts at arrival, preventing an immediate “lonely since day zero” rest decision. Adults can learn practical basics by observing more skilled neighbors when they were otherwise ready to rest; immediate needs still take precedence.
- Milling requires a local quern and basic personal tool/gathering knowledge. Knowing how to construct a quern is a separate craft. A practiced miller or baker can supervise one pupil during actual production; the pupil spends a workday and real ingredients, and learns only after repeated work. Gardens remain alongside experimental wheat rather than all beds turning into grain before processing is established.
- Hunting interception uses a travel budget consistent with the longer presentation day, independent of playback speed. A successful passing-game hunt raises modest personal confidence and shows the deer being carried home. Food retains the existing provision accounting; there is no newly invented protein calorie multiplier.
- River crossings commit to their destination bank, including the tributary. A swept person is drawn swimming rather than walking. Landings vary by seed, villager and saved fall count. Each recorded fall has a 0.1% fatal chance using separate deterministic accident dice; deaths persist in life records. Camera movement and drawing while paused do not generate accident draws. Headless daily population runs do not render walkers and therefore do not include presentation-triggered river falls.
- Observe hides undiscovered current resources, remembers them after depletion, and leaves the encyclopedia's resource requirements visible. Family records preserve parent IDs, deaths and arrivals. Older saves recover reliable recorded links; missing ancestry stays unknown.
- The encyclopedia distinguishes learned techniques from actual completed making, with reference illustrations and materials/prerequisites. Its images do not construct world objects. The malformed A-frame roof is corrected; the orange heating marker is now a small base vent.
- Rock paintings require explored sheltered rock, working-stone experience, relevant subsistence experience, personal knapping/charcoal knowledge, pigment materials and paid work. A later reading is a real activity. A picture gives a limited experiment clue and never grants a recipe or bypasses its prerequisites. Only discovered paintings appear in Observe.
- Inspiration occurs rarely after suitable experience or through the god command `inspire` (optionally followed by a villager name). It selects a feasible question about counting, measurement, levers, falling objects or seasons. A five-day, relevant experiment-chance bonus grants no knowledge, materials or personality changes. Inspiration cannot stack and never overrides hunger, warmth or recovery decisions.
- Desktop Up recalls the last submitted text. Mobile repeats recognized speech as well as powers/time actions; unrecognized text does not replace the previous action. Manual `magic` remains a typed unlock. Completed one-time teaching shortcuts disappear and can return after rewinding to a state before discovery.

## Verification

The final full automated suite passed **295 tests**. Native Canvas checks cover phone/desktop/ultrawide house proportions, storm rendering, pointer inspection, all five hut shapes and all 83 encyclopedia entries; the final offline bundle is parsed as JavaScript. These checks do not claim a browser HTML/CSS screenshot review.

Population outcomes are recorded separately in `population-local-final-50-20261114.*` and `sustainability-local-final-10-20261114.json`. All runs start with six founders, no god actions and optional magic disabled. They measure survival through day 3,000, not guaranteed permanent survival. Multiple simulation changes are included together, so a before/after comparison does not isolate the contribution of any single change.

After those source snapshots were sealed, a legacy family-name migration guard and stricter resource-display discovery tracking were added. These affect old-save record recovery and Observe visibility, respectively; they do not change fresh-world food, reproduction or decision rules. The audited source hashes and snapshots remain intact.

The later growth update uses day 1,000 as its first checkpoint, measuring food surplus and regular work alongside population. Farms can now expand beyond four plots through paid NPC projects. Base fertility and wheat timing remain unchanged; no free plot expansion or automatic outsider rescue was added. The earlier results above describe the previous local snapshot; the linked growth report records the newer comparison.
