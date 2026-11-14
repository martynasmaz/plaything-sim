# Ground bone in farming

Bone fertilizer is ordinary technology and does not require the god to enable
magic. Its recipe is `bonemeal` in `src/practices.js`; soil bookkeeping is in
`src/farming.js`, and cross-craft infrastructure checks are in `readyToInvent`.

A villager needs an established farming practice, at least three personal
planting/harvesting workdays, basic tool knowledge, experience crushing hard
materials, and an existing hammer stone. A farmer may spend separate workdays
testing old bones against the crushing stone. Those tests consume a bone and
build relevant experience. Material experiments then spend bones before the
villager discovers the method; there is no automatic invention at a set date.

Once learned, one workday grinds four actual bones into two units of bone meal.
Another workday applies one unit to one plot. Prepared meal is separate from raw
bones in the camp stores. Preparation targets field demand rather than grinding
the entire stockpile. Hungry, cold, ill or exhausted villagers attend to their
needs first; ripe harvesting and safe planting retain their existing priority.

An application becomes available after one season (20 default game days). It
adds two food to each of that plot's next three harvested crops. It neither
advances crop growth nor creates planted crops or food immediately. Applying
more to an already amended plot cannot stack the effect; further application
waits until its three beneficial harvests are used. Application pauses in winter.
Prepared stock, applied soil and learned knowledge persist across save/load.
Lessons require the receiving farmer's practical experience and infrastructure.

The real-world basis is that bone meal supplies slowly available nutrients;
[RHS lists bone meal among slow-release fertilizers](https://www.rhs.org.uk/garden-jobs/fertilisers).
The game models a delay and bounded crop response, assuming these plots benefit
from the amendment. It does not model soil phosphorus levels, pH, microbial
activity or all nutrients. Those matter in actual soils, as described by
[Montana State University Extension](https://www.montana.edu/extension/Full_HTML_Pubs/EB0241-MarketVegetableFarmsSoilMicronutrients.html).
The numeric delay and yield bonus are game tuning, not agronomic conversion
rates or a claim of a particular historical invention date.

`tests/bone-fertilizer.test.js` covers discovery gates, real input/output costs,
separate workdays, delayed benefits, harvest limits, needs taking priority,
winter and save compatibility. `scripts/folk-practices-report.mjs` also observes
natural fertilizer adoption with magic both dormant and enabled.

In the ten dormant control runs through day 1,000 or extinction, every village
learned the practice. They ground 872 bones into usable fertilizer, made 428
plot applications and received 2,444 additional food across 1,222 mature treated
harvests. This counts production batches, not extra bones spent on discovery
experiments, and is an observation of those seeds rather than a fixed timeline.
