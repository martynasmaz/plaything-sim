# Food, homes and neighboring communities

These rules apply to the live homestead. The original v0.1/v0.2 reference
simulations keep their earlier behavior. Existing saves retain people,
knowledge, family histories, stocks, structures and unfinished work.

## Accessible provisions

`src/provisions.js` defines finished food consistently for needs and family
readiness. Main-valley camps share the main pantry. Each occupied camp's
finished preserved stock covers that camp's own food reserve first; the main
pantry must cover remaining deficits. The prospective mother's camp needs the
additional four-meal buffer. Abandoned stores, unfinished drying batches and
another camp's surplus cannot be pooled as freely available meals. The eastern
settlement uses its own supplies and its existing child allowance.

Meals continue consuming real stock. Reading a food reserve never transfers
or creates provisions. Planting still needs its actual seed-food cost in the
main pantry; preserved camp meals can satisfy the separate supper reserve.

Family readiness also checks a seven-day food ledger. Recent hunger or a
declining stockpile delays new births. Flat, full stores qualify; production
does not have to accumulate beyond storage capacity. The ledger includes food
being dried and carried meals so that moving food between counters is not
mistaken for food production. Births still require three consecutive qualifying
days, healthy parents, adequate food and space. Maternal recovery remains seven
days, adulthood 20, reproductive cutoff 240 and maximum simulation age 300.

Food preservers with seven days of actual winter experience can use observed
winter food intake to plan larger drying stores. This changes their storage
goal, not population capacity or food yields. Existing rack construction still
requires full stores, surplus food, three wood and a knowledgeable NPC doing
preservation work. Knowledge and experience can be lost when practitioners die;
there is no knowledge of future weather or guaranteed winter survival.

## Early hut planning

After the communal shelter is complete, villagers consider another hut when
only two sleeping places remain. A site must be prepared through existing tree
clearing work and tools. Building consumes its ordinary materials and workdays.
An active project is prioritized over optional experiments; hunger, cold,
illness, fuel and exhaustion still take priority. A first hut cannot continually
interrupt the communal shelter before the latter reaches completion.

This removes the earlier deadlock where eight people split into smaller camps:
births could not exceed eight places, but neither individual camp was crowded
enough to trigger construction. Population capacity still comes from actual
completed structures; planning never grants free beds.

## Communication and families

`src/neighbors.js` uses the existing inhabited camps and the settled eastern
village. It does not create outside settlers. Visits are ordinary social
behavior along known routes, not an invented later-era technology.

Prerequisites are a completed communal shelter, an inhabited destination,
existing gathering knowledge, safe needs, actual provisions for the journey,
and safe access to the ford. Trips are not started during floods or cold snaps.
Medical care and sick children have priority. A traveler with dependents needs
another local caregiver; a person can host a visitor without leaving a healthy
child. The healer can host when patients do not need treatment, and remains in
the physical herb hut rather than moving it.

A visit costs an outward workday, a paired meeting workday, and a return
workday unless the visitor joins the host's household. Up to three real meals
are packed from the traveler's own supplies. Later trips top up that same
small packet rather than accumulating unlimited rations. Visitors eat their
packed meals and stay at the destination's existing shelter. Urgent needs
release them to the normal needs planner.

Actual meetings create individual records of whom each person knows and
where. Two meetings are needed before a cross-village family connection is
eligible. Healthy, unrelated people can then:

- Join a household at the place visited, if no dependent children or private
  healer residence would be displaced; or
- Remain in their own communities and have a child following recent contact.
  Cross-community contact must be within 20 days and at least the normal
  three-day readiness period in the past. Each new meeting permits at most
  one cross-community birth opportunity; subsequent children require renewed
  contact. Same-household couples retain their normal rules.

Births keep both parent IDs, names and communities. A child lives with the
mother and uses the existing local caregiver system; the distant parent is not
teleported into the household. Parent/child and sibling pairings remain excluded.
The model does not attempt a full genetic simulation.

Visitors may teach practiced techniques over repeated meetings. Teaching uses
the recipes in `src/practices.js`, checks the learner's materials, properties,
experience and dependencies, and calls the cross-craft `readyToInvent` gates.
It creates knowledge rather than free equipment. Medical apprenticeships and
god-enabled magic keep their dedicated requirements.

Journeys, meetings, contacts, food-planning experience and families survive
saving. Regular live-homestead camp changes now happen through visits rather
than an automatic end-of-day partner teleport. Map activity remains brief emoji
chatter; the notebook holds contact and family details.

## Validation and outcome reports

`tests/family-growth.test.js` covers food access, real meal consumption, growing
storage needs, capacity planning, paid trips, cross-community parents, close
relatives, childcare, teaching prerequisites and save continuity. Original
reference replay tests remain part of the full suite.

`scripts/population-followup.mjs` repeats the original seeds 0–9 and can run a
larger sample with a separate filename. Every result is tied to a hash of the
decision modules; it refuses to finish a report if those files changed during
the run. Baseline data in `population-audit-10-20261114.*` is preserved.

At day 3,000, the report classifies each independent village as:

- **Extinct:** no living villagers before or at the horizon.
- **At risk:** alive, but no birth in the last 300 days or no unrelated pair
  whose reproductive ages can overlap, including children who could mature.
- **Recovering:** fewer than six living villagers, with recent births and a
  potentially viable next generation.
- **Continuing:** at least six living villagers, recent births and a
  potentially viable next generation.

These categories are mutually exclusive observations, not permanent game wins.
Survivors are censored at the horizon. A run remains deterministic for its seed;
reported percentages describe the tested set of seeds and rules, not a forced
success/failure roll. No assistance, rescue population, magic unlock or hidden
success guarantee is added to the reported hands-off runs.
