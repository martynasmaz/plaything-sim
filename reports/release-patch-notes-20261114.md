# A Village Takes Root

**Plaything Sim · Patch 2026.11.14**

The village has learned that surviving tonight is only the beginning. This update gives growing communities more room to farm, better reasons to prepare for winter, and new ways to pass their knowledge into the future.

## Update highlights

- **Grow beyond four fields.** Experienced farmers can prepare additional land through real work, tools and materials.
- **Build a working food economy.** Seasonal reserves, practical apprenticeships and recurring work roles help support larger villages.
- **Follow every family.** Explore recorded parents, children and deceased ancestors in Observe.
- **Collect the village's creations.** Browse illustrated buildings, tools and practices in the new encyclopedia.
- **Leave a mark on the world.** Villagers can create rock paintings, discover old knowledge and become inspired by everyday questions.

## Village development

### Farming and land

- Cultivated land can now expand beyond the original four plots as the population needs more food.
- Field layout is a practical discovery. Farmers need harvest experience, personal farming and wood-working experience, a digging stick, basic tool knowledge and experience of a winter.
- Plot markers require wood and fibre. Preparing a field then requires another wood payment and three workdays, plus any necessary tree clearing.
- Villagers clear only the small field footprint. The surrounding woodland remains.
- Completed fields still need seed and a planting workday before they produce a crop.
- Unfinished field projects and completed plots remain when their workers die. Qualified successors can continue the work.
- Early wheat planting now leaves room for kitchen gardens while the milling and baking chain becomes established.
- Regular farmers harvest ripe food before sowing another bed.

### Food, fuel and winter preparations

- Established villages use their winter experience to plan seasonal food and fuel reserves.
- Founding villages keep their existing survival priorities while they establish themselves. The new development routines begin after the community has experience of a winter.
- Milling and baking targets account for actual storage capacity and seasonal needs, allowing larger pantries to be used.
- Preservers can reserve a workday and handle the actual surplus after the day's gatherers return.
- New drying-rack construction takes two workdays, three wood and one fibre. Wood-working neighbors can help build racks without becoming food specialists.
- Preserving spends fuel and moves existing whole provisions into a drying rack. Food becomes available from the rack when drying conditions permit.
- Recent hunger continues to delay births. A temporary decline in reserves during productive building work can be tolerated when the household still has a substantial accessible food buffer.

### Work roles and apprenticeships

- Regular work develops from repeated actual jobs. Villagers can become known for farming, fishing, hunting, milling, baking, building, healing, teaching and other crafts.
- Usual work is shown in Observe and can change as a person's working life changes.
- Experienced millers and bakers are considered earlier in the work order, helping production and practical teaching fit together.
- A practiced miller or baker can supervise a pupil during real production. The pupil spends ingredients and a workday, and learns through repeated work.
- Operating a quern no longer requires personally knowing how to construct one. A real local quern, grain and the operational prerequisites are still required.
- Adults can learn practical basics by observing more skilled neighbors when their immediate needs allow it.
- Hunger, cold, illness and exhaustion continue to interrupt regular work and training. A job title grants no free skills, equipment or buildings.

### Homes and families

- Housing planning now considers a spare household and children approaching adulthood, helping villages prepare before every sleeping place is occupied.
- Eligible unrelated adults can spend time together and form a household through actual activities.
- Visits receive greater priority when a fertile adult has no suitable local partner. Journeys, rations and meetings still take time and resources.
- Family formation continues to require eligible parents, food, health and space.
- Base fertility, recovery after childbirth and the existing wheat discovery timing have been retained.

## Knowledge and discovery

### New god action: Inspire

- Type `inspire` to give a ready villager a question suited to their experience. Use `inspire Paulius` to request a particular villager.
- Questions can concern counting stores, measuring shelter poles, levers, falling stones or seasonal shadows.
- Inspiration can also occur naturally after suitable experience.
- Inspiration gives a brief, focused encouragement to relevant experiments. It grants no finished discovery and does not bypass materials, infrastructure or personal prerequisites.
- Inspiration cannot stack, and villagers still attend to immediate needs first.

### Rock paintings

- Villagers can discover how to leave paintings on an explored sheltered rock face.
- Painting requires relevant experience, personal knapping and charcoal knowledge, a hammer stone, charcoal, resin and paid work.
- Later villagers can spend time discovering and reading these records.
- Pictures offer a limited clue toward an experiment. They do not hand out complete recipes.
- Discovered paintings appear in Observe with their maker, date, subject and readers. Undiscovered paintings remain hidden.

## Observe and the encyclopedia

### Family records

- Added a family-tree section with parent and child navigation, including recorded deceased villagers.
- Records preserve names, parent IDs, births, arrivals and deaths across generations.
- Founders and arriving settlers appear as distinct roots. New arrivals are not counted as births.
- Older saves recover reliable links from their existing records. Missing ancestry stays unknown, and a younger namesake is not substituted for an ancestor.

### Encyclopedia and collection

- Added illustrated reference entries for buildings, equipment and practices, including requirements and material costs.
- Collection progress distinguishes knowing a technique from actually making or using its product.
- Reference illustrations do not create anything in the world. NPCs still have to do the work.
- Optional magical entries remain hidden until magic is awakened by manually typing `magic`.

### Resources and inspection

- Current resource lists now hide resources the village has not discovered.
- A discovered resource remains listed after its stock reaches zero.
- Encyclopedia requirements can show materials that have not yet been discovered.
- Added clearer bone and herb icons to the resource display.
- Observe now shows cultivated field counts, ongoing field preparation and usual work roles.

## Weather and the river

### A more regional climate

- Weather now draws on monthly rainfall frequencies, precipitation totals and temperature averages from the Lithuanian Hydrometeorological Service's Kaunas 1991–2020 normals.
- Added distinct drizzle, steady-rain, heavy-rain and downpour presentations and effects.
- Soil moisture carries between days. Rain and snowmelt replenish it; dry weather removes it; prolonged saturation slows crops.
- Gardens and wheat share soil conditions while retaining their own maturation requirements. Winter and frozen conditions pause growth.
- Rain and snow are distinguished using the day's modeled temperature.
- Rain strength affects warmth loss and wet tinder. Heavy rain pauses exposed fishing, riverbank material gathering and outdoor food drying.
- Existing god weather powers still override natural weather.

*Climate note: seasons use a compressed game calendar. Rain categories describe representative daily amounts, not measured hourly storm intensities. Temperature variation, ice and soil behavior remain game approximations; this is not a reconstruction of ancient Kaunas weather.*

### River movement

- Improved crossing routes, including tributary crossings that previously pulled walkers back toward the channel.
- Swept villagers now look like they are swimming instead of walking along the riverbed.
- Recovery points vary between falls instead of everyone leaving the water at the same spot.
- Each recorded fall has a **1-in-1,000 fatal chance**. Fatal falls appear in death and family records.
- Paused drawing and camera movement do not generate new accident rolls.

## Hunting and new arrivals

- Corrected passing-game interception timing so reachable deer are less likely to be incorrectly counted as escaped.
- Successful hunters receive a modest confidence benefit, and returning deer hunters visibly carry their game home.
- New settlers start with the same basic practical knowledge and energy as founders.
- Their social clock now starts on arrival, preventing an immediate rest decision caused by being treated as lonely since the founding day.

## Controls and presentation

### Mobile

- Recognized Speak phrases can now become the one-tap repeat action, alongside powers and time actions.
- Unrecognized text leaves the previous repeat action in place.
- Completed one-time teaching shortcuts disappear once the village has learned them. Rewinding before discovery can make them available again.
- The optional `magic` unlock remains a manually typed action and is not promoted to a repeat button.

### Desktop

- Press **Up Arrow** in the command field to recall the last submitted text, then press Enter to submit it again.
- Completed one-time teaching actions are hidden from the command guide.

### Visual fixes

- Fixed the extra diagonal section on A-frame huts.
- Replaced the orange heated-floor marker with a small vent at the base of the hut.
- Added visible field preparation, completed expanded plots and unfinished drying-rack frames.
- Rain presentation now follows the current rain category.

## Balance test results

In a separate validation batch of **100 fresh seeds**, starting with six founders and running hands-off through day 1,000:

| Measure | Previous local baseline | This update |
| --- | ---: | ---: |
| Average population, including extinct villages | 14.25 | **24.96** |
| Median population, including extinct villages | 17.5 | **31** |
| Villages still alive | 59% | **81%** |
| Average available finished food | 91.51 | **144.95** |

The average population gain was **10.71 people**, with a paired bootstrap 95% interval of **7.13–14.27**. The full-year average before day 1,000 also improved.

These results compare the new development system with its previous local baseline. No god actions, immigration, magic unlocks or faster base fertility were used. Extinct villages count as zero. Headless runs do not render river accidents. The results support growth through the tested checkpoint; individual villages can still fail, and indefinite survival has not been established for this version.

Regular food-production roles are emerging more strongly than non-food professions. The measured share of craft, construction and teaching actions increased modestly; a mature specialist economy remains a longer-term development goal.

## Saves and verification

- Existing discoveries, physical buildings, field progress and unfinished work are retained when loading supported saves.
- New records begin from available history; missing older information is not invented.
- **305 automated tests passed**, together with native Canvas and offline-build checks.
- Full statistical methods and per-seed figures are included in the [validation report](docs/GROWTH-VALIDATION-2026-11-14.md).

*Developer's note: this update aims for villages that can support growth through useful work and accumulated resources. Failure remains part of the simulation. Winter survival and the gradual emergence of more non-food professions are still areas for further development.*
