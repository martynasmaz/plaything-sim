# v0.1 implementation notes

The full supplied design is archived in `design-v0.1.canvas.txt`. Nothing from the
Bronze/Iron roadmap is implemented. All default simulation numbers are unchanged.

## Exact day sequencing

`stepDay` clones its input, increments the day label, then performs the design's
six stages (numbered comments in `src/sim.js`). It records an explanatory `lastDay`
report as well as the latest 10 journal entries. Births and fire discovery check
illness **before** the closing timer decrement. Newborns are not in the work/meal
order and do not age on their birthday. A dead villager never returns.

Needs clamp after each separate change: warmth loses its base amount, then any
rain loss, then gains shelter warmth and any fire warmth, before work. Health
damage is deliberately combined before applying it, as specified.

Resource changes are immediate during work. All work finishes before any meals;
work and meals share the same rotated order. Permanent IDs are never recycled.
The order starts with ID 1 on day 1, then the next living ID each day, wrapping.
If tomorrow's intended first person has died, the next greater living ID starts.
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
