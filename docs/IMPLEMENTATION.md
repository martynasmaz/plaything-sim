# v0.1 implementation notes

The current design (survival rebalance) is archived in `design-v0.1-flavour.canvas.txt`.
Nothing from the Barn/House Age roadmap is implemented. Simulation numbers live in
`src/config.js` and match the design and the reference simulator.

## Exact day sequencing

`stepDay` clones its input, increments the day label, then performs the design's
six stages (numbered comments in `src/sim.js`). It records an explanatory `lastDay`
report as well as the latest 10 journal entries. Births and fire discovery check
illness **before** the closing timer decrement. Newborns are not in the work/meal
order and do not age on their birthday. A dead villager never returns.

All of a day's warmth changes (base loss, rain or cold-snap loss, shelter and
Bonfire warmth) are summed, then clamped once, before work. Health damage is
combined before applying it, as specified.

Resource changes are immediate during work. All work finishes before any meals;
work and meals share the same rotated order. Permanent IDs are never recycled.
The order is the living IDs sorted, rotated left by (day − 1) modulo the living
population (the reference simulator's rule).
With the population cap of 8, everyone has a shelter place. For diagnostic or
future configurations exceeding capacity, the lowest permanent IDs get places.

`lastDay.weather`, `fireLit`, and `illToday` describe the **completed day**.
`weather.daysLeft` and `illnessDays` describe **remaining future affected turns**
after closing that day. The UI explicitly separates today's and next day's
weather; a villager remains labeled sick on the last affected day even though
no illness turns remain tomorrow. Safety also describes that completed day.

## Small ambiguities resolved

1. **Names:** the design supplies ages, not names. Starting names are Ada, Bram,
   Cora, Daro, Ena and Finn. Newborns are Neri plus their permanent ID.
2. **Adults for discoveries:** interpret adults as age 20–239 (elders do the same
   work, but are a distinct life stage). Also require at least two contributing
   adults to have happiness ≥50, honoring the needs table's statement that an
   unhappy villager cannot contribute. Average happiness still uses everybody.
3. **Milestone timing:** trigger once on the first qualifying day **on or after
   day 30**, not only at exactly day 30; a village which learns fire later can
   still complete the observation goal. Default play qualifies on day 30.
4. **Pause versus explicit stepping:** automatic time advances only through
   `advanceTime`. An extra visible **Next day** button explicitly ticks one day
   even while paused, for learning/testing. Pausing preserves a partial day's
   progress and does not advance cooldowns or effects.
5. **Hidden tabs:** no background catch-up; hidden tabs freeze automatic progress,
   and a rendering hiccup contributes at most 1 real second per frame. This
   prevents coming back to a vanished village. While actively watching, normal
   and fast speeds are exactly 30 and 10 seconds/day.
6. **Rejection order:** unknown/unavailable → ended → cooldown → power → command
   conditions. If multiple reasons apply, report the first; conditions are
   rechecked on application. Failed queuing does not replace an existing valid
   queue. A failure at application consumes the pending slot, not power/cooldown.
7. **Deaths:** log all current-day damaging causes when health reaches zero,
   plus old age if applicable. If a diagnostic state has zero health without
   current-day damage, use “poor health.” At zero population, stop immediately
   in stage 5, without regeneration or timer decrement, as the design directs.

Plague's availability is a single `enablePlague: true` flag in config. Setting it
false removes the command both from validation and from the rendered vocabulary;
it does not secretly change any other rule or disable ordinary death.

## Architecture and delivery

The editable game uses browser ES modules, Phaser 3.90.0 with CANVAS rendering,
native HTML inputs/buttons for accessibility, the approved SVG art pack from
`assets/` (via `src/theme.js`) with plain-shape fallbacks for any missing file.
No CDN requests occur at runtime. There are no services, AI, save storage,
random game decisions, build dependencies or runtime npm dependencies.

The single-file generator concatenates these small modules in dependency order,
removes imports/exports, and embeds code, styles and vendored Phaser. The editable
sources remain separate ES modules. Rebuild after every source change. The
single-file build uses inline classic scripts to avoid file:// module CORS.

Browser regression uses an optional external Playwright installation and launches
its own fresh **headless** process, not the desktop browser or an existing session.
No user accounts, cookies or credentials are involved.

## Gourdling flavour / theme and approved provisional art

The latest full reference is `design-v0.1-flavour.canvas.txt`; the original source
is kept for comparison. Opening UI names are First Age, Homestead, Gourdlings,
Bonfire, Provisions, Firewood, Wonder, Plank shed and Pantry. This changes **no
rule values, day stages, costs, cooldowns, needs or build-check outcomes**.

All presentation is now in `src/theme.js`: palette, fonts, full CSS, layout,
geometry callbacks, source dimensions and exact artist pivots, optional image
map, starting names, activity/reaction labels, HUD/help/error/log templates.
There is no second stylesheet to swap. `village-view.js` is only the generic
loader/renderer; empty maps and missing images use the theme's geometric callbacks.
Simulation imports only pure theme copy/name helpers, never Phaser or browser I/O.

`src/commands.js` is the one accepted-word table. Resolve its normalized wording
to the unchanged canonical ID **before** queueing, validation, cost or cooldown.
Pairs: cloud wrangle/rain, dry spell/drought, hoedown/bless, sick hex/plague,
teach spark/teach fire, feast drop/harvest. Each pair is one command. Both illness
words disappear with `enablePlague:false`. Help shows name (alias), visibly warns
that sick hex can kill Gourdlings, and never offers later-era commands. If a new
theme adds a friendly label, the actual accepted words remain visible too.

The default now maps 44 approved SVGs, with no PNGs. Adult ID order cycles through
fiddler, banjo, singer, kicker, washboard, jug. Children use their own 48×72 art.
Source sizes/contact pivots were copied from the artist manifest into the theme;
actors render at 40×60 (children 30×45), not hard-coded image dimensions in the
renderer. Normalized origins use the actual feet (adult 32,94; child 24,70.7),
not the slightly padded canvas edge. Separate shadows sit underneath. World art
and actors sort by ground-contact y. Idle_1 displays while standing; walk_1/2
alternate during actual position changes, not while waiting or merely queuing.

The Pantry is a supply crate, not a new building or resource. Instruments,
lanterns, corn and fence/ground tiles are decoration only. Weather overlays are
tiled, not stretched; reduced opacity keeps characters readable. Command sign
uses a CSS nine-slice backdrop and live system-serif text. Exact inventory,
readability notes and icon-redraw guidance are in `ART-ASSETS.md`.

Build-time inlining embeds present local images as data URIs and makes missing
paths null (no broken file:// requests). External/outside-project images and
SVG scripts, raster embeds, foreignObject or remote links/fonts are refused as
optional fallbacks. The standalone HTML needs no sidecar art folder.

## How a Gourdling decides

Every day, each Gourdling (visited in the rotating number order) loses 25 fullness
and has its warmth changed once: −10, a further −10 in rain or −40 in a cold snap,
+10 for its Plank-shed place and +10 more if the Bonfire is lit. Then it picks the
FIRST matching job:

1. **Forage if starving and the Pantry is empty**: fullness below 40 and fewer
   than 1 provision. An adult brings 3 provisions (4 in rain, 1 in a dry spell,
   3 in a cold snap); a child brings 1 (2 in rain, 0 in a dry spell).
2. **Warm up** if warmth is below 40: +20 warmth, or +40 when the Bonfire is lit.
3. **Forage if the Pantry is low**: fewer than 4 provisions per living Gourdling.
4. **Gather firewood** if there are fewer than 6: an adult brings 2, a child 1.
5. **Rest** otherwise: +5 happiness.

**Meals and damage.** After all work, each Gourdling at 75 fullness or less eats
1 provision (+30 fullness) if any remain. At 20 fullness or less it loses 10
health; at 20 warmth or less another 10; each illness day costs 20 health and 5
happiness. With no damage, no illness, and fullness and warmth both at 50 or
more, it recovers 4 health. Safety is 80 with health at least 50 and no illness,
otherwise 40. Happiness gains 2 when fullness, warmth and safety are all 50+,
or loses 4 if any is below 40. Health 0 or age 300 means death.

**Births.** A day counts when there are fewer than 8 Gourdlings, at least 2
provisions per Gourdling plus 4, nobody is ill, and at least 2 adults (ages 20 to
239) have health 70+, fullness 60+, warmth 50+ and happiness 50+. After 5
eligible days in a row a child is born (the counter resets on any failed day).

**Bonfire discovery.** From day 20, a day counts when at least 2 Gourdlings are
20 or older, average happiness is 50+, nobody is ill and there are at least 3
firewood. After 3 such days in a row the Bonfire is known (2 firewood spent);
it first burns the next day, using 1 firewood a day. The earliest natural
discovery is day 22.

**The nightly dice.** Every night the game makes exactly 3 rolls from the run's
seed: tomorrow's weather (31% fair, 30% rain, 25% dry spell, 14% cold snap),
whether someone falls ill (13%), and who (any living Gourdling; someone already
ill is not affected again; the illness lasts 3 days). Cloud wrangle and dry spell
override the weather for 3 days but never skip a roll, so the same seed with the
same commands always replays the same story.

## Survival rebalance (seeded dice)

- `src/sim.js` ports the RULES of `/workspace/sim/gourdling_survival.py` (not its code):
  the same unsigned 32-bit LCG (8 warm-up steps), exactly 3 draws every night
  (weather, illness chance, illness target), cold snap (−40 warmth), illness 20/day,
  hoedown +25 health, lit Bonfire +10 warmth, birth after 5 eligible evenings,
  natural Bonfire from day 20, permanent wipeout with stats, new seed on restart.
- Rules aligned with the reference while porting: warmth changes are summed then
  clamped once; the visit order is the sorted living numbers rotated by
  (day − 1) mod population; natural Bonfire discovery counts every Gourdling aged
  20+ (elders included) and uses the average happiness.
- `s.weather` is command weather only; `s.natural` holds last night's roll;
  `forecastWeather(s)` / `tomorrowWeather(s)` give what the HUD shows.
- `tests/balance.test.js` runs seeds 0–199 × 3 strategies and compares every run
  with `tests/fixtures/python-seeds-0-199.json`; rule tests use a fair-weather,
  no-illness config like the reference self-tests.
