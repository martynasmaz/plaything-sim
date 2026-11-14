# River fishing in this local version

## Historical basis

Northern European fishing developed overlapping traditions rather than a single
sequence in which rods inevitably preceded nets. Mesolithic plant-fibre nets,
including Antrea, show that sophisticated nets existed well before farming.
The Zamostje research describes northern European nets made from local bast,
roots and other fibres, alongside hooks, points and wooden fishing structures.
[Research on prehistoric nets](https://www.degruyterbrill.com/document/doi/10.1515/opar-2022-0283/html).

Lithuanian Šventoji excavations provide regional evidence for wooden fishing
fences and traps. These coastal-lagoon sites are comparisons for construction
techniques, not direct evidence for every technique in the game's inland river.
[Šventoji fishing stations](https://www.mdpi.com/2571-9408/8/11/442).

Bone hooks and lines are documented in northern European Mesolithic contexts.
Wooden poles preserve poorly. A recent study identifies a Bronze Age Swedish
carving as one of the earliest regional rod depictions; that does not establish
when people first attached lines to poles.
[Northern European hook-and-line research](https://doi.org/10.1080/19442890.2025.2558916).

## Implemented branches

These are material and experience dependencies for this simulation, not asserted
archaeological invention dates. The world has no fixed BCE calendar. Discoveries
can occur in different orders, and existing equipment remains usable.

| Technique | Individual prerequisites | Physical construction |
| --- | --- | --- |
| Wooden fishing spear | Crude tools, waterside visits, wood-working experience | 1 wood |
| Wicker funnel trap | Gathering knowledge, two waterside visits, experience with flexible material | 1 wood for shoots and 2 fibre for bark/withy bindings |
| Bone hook and handline | Knapping, cordage, waterside experience | 1 bone from hunted game and 1 fibre |
| Fixed-line wooden pole | Hook-and-line knowledge, an actual hook/line, fishing experience | 1 wood and 1 fibre |
| Plant-fibre net | Cordage, fishing and fibre-working experience | 4 fibre, 1 wood for floats/stakes, 2 stone for sinkers |

The personal recipes are in `src/practices.js`; cross-craft dependencies are
shared with `readyToInvent` through `src/fishing.js`. Net-making does not require
a loom, spindle, farming, pottery, a pole, or an earlier trap. Simple green-wood
traps can use bark strips and withies before fine cordage. Fishers gather lacking
net materials through work rather than receiving free equipment. Riverbank bait
is implicit in the hook-and-line workday, while fish catches consume the finite
fish deposit. No metal hook or reel is introduced.

Fishing now increases fishing skill. Children can observe fishers and knowledge
can spread through practice and lessons. A learned technique does not grant a
finished tool. Bone defaults to zero in older worlds and comes from successful
hunts, not a renewable collection deposit. Previously saved traps and discoveries
are preserved; the old misnamed `fishingNet` flag retains its original trap meaning.

## Visible behavior

- Fishers approach the bank and spend 10–13 animation seconds working there.
- Wicker traps have a funnel opening and tether; fishers lift them from the water.
- Nets show mesh, bark floats, stone weights, shore stakes and a hauling line.
- Handlines and poles show a line, hook and bait; poles have no reel.
- Spear fishing shows a downward thrust in the shallows.
- Caught fish are carried back on a stringer after the river work finishes.
- Routine gear maintenance takes place ashore when the water is unsafe.

An existing set net is checked early in the workday, so individual spear fishers
do not always exhaust the shared stock first. It still costs one fisher's workday
and consumes the same finite fish supply. Flooding and frozen water prevent
fishing. The render phase explicitly distinguishes bank work from carrying and
delivery; the old animation could show trap work during the delivery phase.

## Validation and reports

Run `node --test tests/*.test.js` and `node scripts/build.mjs`.
`tests/fishing.test.js` covers materials, experience, alternate branches, old saves,
finite catches, safe water, net checking and animation phases. The optional
`scripts/fishing-render-smoke.mjs` uses `@napi-rs/canvas` to render all equipment
and the actual clearing locally without touching a browser or saved game.
`scripts/fishing-visual-preview.mjs` creates an animated local preview page.

The original `survival-needs-100.*` and `fishing-100.*` reports predate this
fishing-progression update. Their source hashes identify that earlier version;
their survival and adoption figures should not be treated as new-version results.
The new 20-village, 1,000-day check is `fishing-progression-20.*`. It is a small
balance check, not a repeat of the previous 100-village long-survival experiment.

The final 20-village check reached day 1,000 with 15 villages alive. Every village
fished; spear fishing occurred in 20, trap fishing in 17, handlining in 11,
pole fishing in five, and net fishing in five. Nets accounted for 313 main work
actions. Fishing supplied 16.2% of tracked main-village food. These are small-
sample results for this new progression, not a controlled estimate of its
effect on long-term survival. Starting gear is no longer instant, so adoption
timing also differs from the old version.

Validation completed with 145 passing tests. Actual Canvas drawing functions
were inspected in `reports/fishing-preview.png`, and the full clearing rendered
without runtime errors in `reports/fishing-scene.png`. Browser inspection of
local files was blocked, so the visual checks used the local Canvas renderer.

Fish fences/weirs, boats and cooperative seine fishing remain future work. A weir
would need shallow-channel geography, stakes, suitable wood-working skills and
ongoing maintenance. A whole-river barrier across this large channel would be
inappropriate as an automatic early-game upgrade. Nothing has been published.

## Playback pacing

Normal days now last four minutes (80 seconds at 3×). Walking and working keep
their existing pace, giving trips more room within the day. Afternoon chores
wait for the main work and any delivery; an unfinished job may continue through
the evening gathering. This is presentation scheduling, not a lock on simulation
decisions: a newly chosen survival action takes over, and urgent needs suppress
optional demonstrations and observances. Hunger, health, aging and work decisions
still advance once per game day. Slow frames now advance walkers by the same
elapsed time as the day clock instead of dropping most of their movement time.

The pacing tests compare 60 days at the old and new playback lengths and obtain
identical daily state and decisions, including health, food, births and deaths.
They also verify that hunger replaces a previous building activity. Saved worlds
keep discoveries and active disaster timers when loaded at the new pace.
