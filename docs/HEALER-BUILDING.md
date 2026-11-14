# Healers and physical buildings

The healer's special home is an NPC construction project, not an appearance
unlocked by a profession. The renderer reads achieved progress and never builds
anything, advances work, gives shelter capacity, or creates medicine.

## Learning and choosing a role

The individual `herbalism` recipe in `src/practices.js` requires gathering
knowledge, experience with perishable plants, at least three foraging skill,
two experiences caring for an ill person, and an actual herb ingredient.
Gathering medicinal plants takes a workday and consumes the wild-plant deposit.
Learning can also spread through the normal lessons system. Knowledge does not
grant a finished remedy; preparing one consumes herbs.

A villager who has actually prepared remedies may choose to treat neighbors,
depending on their existing curiosity or caring/solitary traits. The choice does
not alter their personality, household, address, or house. New worlds do not
automatically receive a designated healer or special hut. Healers can work in camp.

## Apprentices and succession

There is one practising healer at a time and at most one active apprentice.
An experienced healer can take an interested younger villager (at least age 12,
at least ten age-days younger, with gathering knowledge and some foraging skill).
The same apprentice keeps their place when their needs interrupt training.

Training requires two actual plant-gathering workdays, two actual patient-care
workdays, and three supervised remedy preparations. Gathering removes wild
plants; treating a patient spends a dose; preparing a batch spends leaves and
produces one dose shared with the healer. Both participants spend the workday.
Medical knowledge waits for the individual recipe's gathering, plant-property,
foraging-skill and care-experience prerequisites. Appointment grants no skill,
remedy, building or household change. The map shows the apprentice following
their mentor; inspection and the notebook show their training progress.

A trained apprentice remains an apprentice while the healer lives. When the
role is vacant, a qualified adult apprentice has priority over independent
practitioners and can later train their own successor. A younger graduate waits
until adulthood. An interrupted apprenticeship keeps its achieved work and may
resume under a new healer; a mentor's death does not complete training. Other
villagers may retain or independently learn folk remedies without becoming
additional designated healers. Ordinary lessons cannot book a medical mentor
who is already working elsewhere.

## Choosing and building a quiet home

A solitary healer, or an experienced healer seeking quiet work, may choose a
clearing near the trees, 180–210 world units from camp with room beyond the
household huts. Sites stay on the same side of the rivers and leave room for
nearby housing growth. This is privacy within visiting distance, not a change
to the villager's personality. The healer continues visiting patients, teaching
and occasionally joining the camp circle.

They need secure food, health, warmth and energy. Construction requires a worker
with personal housing and cordage knowledge, wood-working experience, and the
village's earlier communal-shelter experience. A healer who lacks those skills
can work alongside an available qualified neighbor; both spend their workday,
and the qualified worker's experience can support ordinary future lessons.
Cross-craft checks are in `readyToInvent`. Having a dependent child does not
forbid daytime building; moving out waits if that would leave no other caregiver.

The persistent record is `local.healerHome`, independently of a living owner:

| NPC work | Requirements and cost | Physical result |
| --- | --- | --- |
| Choose a site | One workday; quiet preference and construction prerequisites | A plan, with no rendered building |
| Build the hut | Six separate construction workdays; 6 wood, 2 fibre, 1 stone total | Posts, frame, roof and walls appear as completed |
| Move in | A separate workday after completion | Address changes; carried medicine moves into the hut's stock |
| Build a drying rack | Built hut, cordage, two patient visits; 2 workdays, 2 wood and 2 fibre | Herb rack; remedy storage target rises from two to four |
| Fit a leaf sign and herb thatch | Completed rack, three patient visits, wood-working experience; 2 workdays, 2 wood and 2 fibre | Identifying sign and greener roof treatment |

Missing fibre, stone or firewood is gathered through actual work. Delivered
materials are held in `healerHome.materials` for the next stage, preventing
unrelated recipes from repeatedly taking them between gathering and building.
Unused supplies survive death and save/load, separately from consumed material
records. Building preserves the hearth's fuel reserve rather than endlessly
chasing a larger optional timber target. Hungry, cold, exhausted, injured or sick
villagers address their own needs first. Treating an ill neighbor comes before
optional construction. Work can pause indefinitely when prerequisites are absent.
There is no fixed date by which every village receives this building.

The artwork has no permanent title or progress counter. Hover/tap inspection
shows the physical stage, builder/resident, reserved materials and the current
reason for waiting. Once a site has been chosen, changing personality or family
circumstances does not invalidate construction on every subsequent workday.
Only moving home needs the caregiver check again.

Old crowded projects with only posts/frame (work below three) can be replanned.
The old frame stays at its original coordinates while the NPC chooses a new site.
A later actual dismantling workday recovers 75% of used wood/fibre (rounded down),
all stone and all unused supplies, records the old site, and starts the new site
at zero. Roofed, occupied and completed homes keep their physical positions.

## Death, successors, and old saves

Death removes the person, not the project. Completed and unfinished structures,
spent-material records, fittings and stored medicines persist across deaths and
save/load. A later healer with the necessary knowledge can choose to inspect,
continue or occupy an existing project. An empty hut does not appoint a healer or
teach medicine automatically. The map and inspection card show whether it is
incomplete, occupied or empty.

Old saves described a solitary healer's basic lean-to without construction
history. Migration preserves that existing basic shelter and medical knowledge
as a legacy record. It does not grant the decorative full hut, rack or sign that
were previously drawn automatically; further improvements need NPC work. Current
worlds carry a schema marker so a healer dying before any project is planned
cannot create a phantom building during a later load.

## Verification

`tests/healer-building.test.js` covers prerequisite gates, separate paid workdays,
camp residence, hunger and medical priorities, upgrade costs, death at different
stages, save/load, and legacy migration. `scripts/settlement-render-smoke.mjs`
renders stages produced by actual NPC decisions in a controlled test world,
records their work/material history, verifies occupied/empty inspection, and
checks that drawing does not mutate the simulation. Its supplied resources,
learned skills and patient conditions are test inputs, not changes to live worlds.

`tests/healer-succession.test.js` also covers actual paid instruction, the single
apprentice place, needs taking priority, incomplete training after death,
adoption by another mentor, adult succession and a second generational handover.
`scripts/healer-report.mjs` measures hands-off emergence and succession while
asserting that simultaneous role counts stay within those limits.

In `reports/healer-succession-20.json`, 20 fresh hands-off worlds were observed
through day 1,000 or extinction: all 20 recruited an apprentice, 15 produced a
graduate, and eight had a trained successor take over (11 handovers total).
The maximum was one practising healer and one active apprentice. These are
observations, not guaranteed survival or inheritance. None of those 20 finished
the hut within observation; the separate construction bottleneck remains.

The earlier survival, fishing and 100-world healer-timing reports predate
apprenticeship. Their source hashes identify those versions; no new long-term
survival rate or hut timing is implied by them for the current rules.

The subsequent clearing/construction update has its own measurement in
`reports/healer-clearings-final-20.json`: 11 of 20 villages finished a usable hut
by day 1,000 or extinction, with seven finishing all fittings. Among the 11
completed huts, the median completion day was 300 (range 240–758). The preceding succession report above
predates help from qualified neighbors, reserved materials and the relaxed
daytime caregiver rule. `reports/healer-project-diagnostic-before.json` captures
overlapping end-of-day constraints before that fix; it does not identify the
exact guard used for every decision. Current reports also record the actual
per-day reason in `lastDay.healerProject`.
