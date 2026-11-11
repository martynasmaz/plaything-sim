# Implementation notes (v0.1 rules, v0.2 personalities and farming)

The current design (survival rebalance) is archived in `design-v0.1-flavour.canvas.txt`;
v0.2 follows the live design Page (sections 10 and 11, rule clarifications of
11 Nov 2026) and `/workspace/sim/gourdling_v02.py`. Nothing playable from the
Barn/House Age roadmap is implemented. Simulation numbers live in
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

These are the v0.2 rules with personalities (the game's default, `version:
'v0.2'` and `traits: true` in `src/config.js`). With `version: 'v0.1'` and
`traits: false` the farming, shed, trait and v0.2-command parts switch off and
the v0.1 rules apply unchanged.

Every day, each Gourdling (visited in the rotating number order) loses 25 fullness
and has its warmth changed once: −10, a further −10 in rain or −40 in a cold snap,
+10 for its Plank-shed place and +10 more if the Bonfire is lit. A Hardy Gourdling
loses 35 instead of 40 in a cold snap; a Shivery one loses 10 more in rain and in a
cold snap. Then it picks the FIRST matching job:

1. **Forage if starving and the Pantry is empty**: fullness below 40 and fewer
   than 1 provision. An adult brings 3 provisions (4 in rain, 1 in a dry spell,
   3 in a cold snap); a child brings 1 (2 in rain, 0 in a dry spell).
2. **Warm up** if warmth is below 40: +20 warmth, or +40 when the Bonfire is lit.
   In rain or a cold snap a Brave Gourdling warms up only below 20 and a Timid one
   whenever it is below 60.
3. **Scatterbrained wander**: a Scatterbrained Gourdling whose behaviour roll is
   1–20 skips the rest of the list: 1–7 forage, 8–14 gather firewood, 15–20 rest.
4. **Harvest a ripe plot** (v0.2, any age): +8 provisions, the plot is empty again.
5. **Forage if the Pantry is low**: fewer than 4 provisions per living Gourdling.
6. **Plant an empty plot** (v0.2, adults only) when provisions are at least 2 per
   Gourdling plus 1. Planting costs 1 provision as seed.
7. **Gather firewood** if there are fewer than 6: an adult brings 2, a child 1.
   While the Homestead saves for the second shed the fuel target is 20.
8. **Rest** otherwise: +5 happiness.

A **Smart** Gourdling replaces steps 5 and 7: it compares how far each stock is
below its target, as a share (provisions against 4 per Gourdling, firewood against
the current fuel target), and forages or gathers firewood for the bigger gap
(provisions win a tie). If neither is low it carries on to Plant, then Rest. Rest
happiness is added after everyone has chosen: with 2 or more resting, a Sociable
Gourdling gets +8 and a Loner +2; resting alone, a Sociable one gets +2 and a
Loner +8. Everyone else gets the normal +5.

**Meals and damage.** After all work, each Gourdling at 75 fullness or less eats
1 provision (+30 fullness) if any remain. Grabby Gourdlings eat first (in the
rotating order) and eat at 85 fullness or less. A Generous Gourdling at 50
fullness or more skips its meal when provisions are fewer than the hungry
Gourdlings still waiting, itself included. At 20 fullness or less it loses 10
health; at 20 warmth or less another 10; each illness day costs 20 health and 5
happiness. With no damage, no illness, and fullness and warmth both at 50 or
more, it recovers 4 health. Safety is 80 with health at least 50 and no illness,
otherwise 40. Happiness gains 2 when fullness, warmth and safety are all 50+,
or loses 4 if any is below 40. Health 0 or age 300 means death.

**Day end, in order:** deaths (and wipeout), births, Bonfire discovery, farming
discovery, the second-shed check, crop growth, Wonder, timers, then the nightly
dice.

**Births.** A day counts when there are fewer Gourdlings than the cap (8, or 12
once the second shed stands), at least 2
provisions per Gourdling plus 4, nobody is ill, and at least 2 adults (ages 20 to
239) have health 70+, fullness 60+, warmth 50+ and happiness 50+. After 5
eligible days in a row a child is born (the counter resets on any failed day).
The newborn rolls its own 2 traits.

**Bonfire discovery.** From day 20, a day counts when at least 2 Gourdlings are
20 or older, average happiness is 50+, nobody is ill and there are at least 3
firewood. After 3 such days in a row the Bonfire is known (2 firewood spent);
it first burns the next day, using 1 firewood a day. The earliest natural
discovery is day 22.

**Farming (v0.2).** From day 40, a day counts when the Bonfire is known, at least
3 Gourdlings are 20 or older, average happiness is 55+, provisions are at least 3
per Gourdling and nobody is ill. After 5 such days in a row farming is known (the
earliest natural day is 44), or `teach sowing` teaches it at once. A field of 4
plots appears. Each day end a growing plot gains 1 in fair weather, 2 in rain, 0
in a dry spell and loses 2 in a cold snap (never below 0); it is ripe at 6. A plot
planted today grows today too.

**Second shed (v0.2).** At day end, once farming is known, with at least 7
Gourdlings and 20 firewood, the Homestead spends the 20 firewood. The shed stands
from the next morning with 4 more places, so the cap goes from 8 to 12 (a birth on
the paying day still used the old cap).

**The nightly dice.** Every night the game makes exactly 3 rolls from the run's
seed: tomorrow's weather (31% fair, 30% rain, 25% dry spell, 14% cold snap),
whether someone falls ill (13%), and who (any living Gourdling; someone already
ill is not affected again; the illness lasts 3 days). Cloud wrangle and dry spell
override the weather for 3 days but never skip a roll, so the same seed with the
same commands always replays the same story.

**The personality dice.** Traits use a second generator, seeded with the run seed
XOR 0x5EED7A17 and the same 8 warm-up steps, so the nightly rolls never move. Each
Gourdling gets 2 traits from the 5 opposite pairs (Smart/Scatterbrained,
Brave/Timid, Generous/Grabby, Sociable/Loner, Hardy/Shivery), never both of one
pair: one step picks 1 of 10, a second picks 1 of the 8 left. The 6 starters roll
at the start, in number order; newborns roll at birth. At the start of work there
is exactly 1 behaviour roll (1–100) per living Gourdling, in work order, always
taken; only Scatterbrained reads it.

**Commands.** v0.2 adds `shake off` (alias `heal`, 25 Wonder, 6-day cooldown:
clears everyone's illness, restores no health, refused when nobody is ill) and
`teach sowing` (alias `teach farming`, 25 Wonder, once per run, refused when
farming is known). Every screen, the full one included, reads typed text with
the keyword matcher (section 11; Designer decision of 11 Nov 2026). Exact names
and aliases still work because they are in the synonym table. Lowercase the text, turn every character other than a–z and 0–9
into a space (apostrophes too, so "don't" is "don t"), and look for whole words or
two-word phrases anywhere ("brain" is not rain). If several commands match, the
first of teach spark, teach sowing, shake off, hoedown, feast drop, cloud
wrangle, dry spell, sick hex wins. Then the normal Wonder, cooldown and rejection
checks run. No match queues nothing, spends nothing and shows no message. A
refused match shows its reason on the full screen as before (the minimal preview
hides the feedback line). "Accepted" means the typed text matched and passed the
cost, cooldown and refusal checks at the moment it was typed; only an accepted
command replaces the queued one, so refused or unmatched input clears nothing.
The day start re-checks the queued command as before.

**Internal log.** Every time a trait changes what happens (Smart, Scatterbrained,
Brave, Timid, Generous, Grabby, Sociable, Loner) the sim counts it and offers a
line. The sim keeps at most 3 lines a day in `state.traitLog` (plus each Gourdling's traits
at the start or at birth), kept in this order: Generous, Grabby, Smart,
Scatterbrained, Brave/Timid, then the Sociable/Loner rest lines; ties keep the
order they happened in. A changed job is credited to the trait that decided the
final job: Brave or Timid when its own warm-up threshold changed whether it
warmed up (and it did not wander), else Scatterbrained when its roll fired and
picked a job other than warming up, else Smart. The Grabby line re-runs the meal
with every Grabby treated as normal (normal order, eats at 75 or below); only if
someone who ate in that version goes without in the real meal is a line written,
naming them. Eating early alone is counted but never logged. Hardy and Shivery
change warmth only and write no line. The log is shown only in the developer
overlay (`?dev=1`), never to players. The seeded build check also matches the
kept lines, and their count, seed by seed against the Python reference.

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
- `tests/balance.test.js` runs seeds 0–199 × 3 strategies under the v0.1 rules
  (personalities off) and compares every run with
  `tests/fixtures/python-seeds-0-199.json`; rule tests use a fair-weather,
  no-illness config like the reference self-tests.

## v0.2: personalities, farming, second shed and the minimal-UI logic

- `src/sim.js` ports the RULES of `/workspace/sim/gourdling_v02.py` (v0.2 +
  traits), not its code. `CONFIG.version` (`'v0.2'`) and `CONFIG.traits` (`true`)
  are the switches; `{ version: 'v0.1', traits: false }` gives the v0.1 rules,
  which the v0.1 tests (`sim.test.js`, `theme.test.js`, `balance.test.js`) use.
- Work is chosen by a pure `chooseAction` (the list in "How a Gourdling
  decides"); the trait-free choice is computed alongside it, and a difference is
  a trait effect, attributed like the reference: Brave/Timid when warming up is
  involved, else Scatterbrained when its roll fired, else Smart.
- New state: `farming` (known, counter, plots), `shed` (pending, built),
  `traitRng`, `traitLog`, each Gourdling's `traits`, and `stats.farmDay`,
  `stats.shedDay`, `stats.traitEvents` (uncapped counts per trait effect).
  `lastDay` adds `behaviourRolls`, `traitEvents`, `harvests` and `plantings`.
  `populationCap(s)`, `shelterPlaces(s)` and `fuelTarget(s)` are exported.
- Keyword matcher: `matchCommand` / `COMMAND_KEYWORDS` / `KEYWORD_PRIORITY` in
  `src/commands.js`, and `matchText(state, text)` in `src/sim.js` (only this run's
  commands). It resolves to one command key; `queueCommand` then runs the normal
  checks.
- The page shows each Gourdling's traits in the current detail panel ("Traits: A
  and B"). The command box always goes through `queueText(state, text)` (keyword
  matcher, then the normal checks; `{ matched: false }` for no keyword). With
  `THEME.ui.enterRestarts` (on in `?ui=minimal`) Enter after a wipeout restarts
  with a new seed. The
  minimal visuals (plank text box, day counter, state cues, end fade) are NOT
  built. `?dev=1` (or `THEME.ui.devOverlay`) adds a developer overlay with stats,
  every Gourdling's traits and needs, and the last 30 internal-log lines; it is
  off by default and not in `index.html`.
- **Temporary placeholder:** Gourdlings who harvest or plant are drawn at the
  provisions spot. That is NOT the field's location. The field, the second shed,
  the copper/tin outcrops and the Tinker-shed site (their art and their real
  places in the clearing) come after the Artist's mockup is approved; until then
  the shed and the outcrops appear only as journal lines, and the Plank-shed
  label in the clearing still reads 8 places. Local save/load (also in the v0.2
  draft) is not started; its spec comes later.
- Checks: `tests/v02.test.js` compares all 600 runs (seeds 0–199 × untouched,
  helped, cruel; 60 days) with `tests/fixtures/python-v02-traits-seeds-0-199.json`:
  the summary facts plus SHA-256 digests of the day-by-day history, every trait
  effect and every Gourdling's traits. Rebuild the fixture with
  `python3 tests/fixtures/make_v02_fixture.py` (`SIM_DIR` points at the
  simulator). It also covers the nightly rolls not moving, the trait stream (2
  steps per Gourdling, 1 behaviour roll per living Gourdling per day), forbidden
  pairs (all 40 allowed pairs occur), replay with an identical log, each trait
  effect, the v0.2 rules and every matcher case from the reference self-test.
  `npm run report` prints the JS vs Python tables for v0.1 (seeds 0–199), v0.2 +
  traits (seeds 0–199) and, when `/workspace/sim/results_v02_traits_500.json`
  exists, seeds 0–499 (the design's section 7 numbers).
- The browser smoke test (`scripts/smoke.mjs`) now expects 8 commands and uses
  seed 48 for the wipeout (day 11 under v0.2 + traits); `scripts/ui-smoke.mjs`
  also checks the traits line, the developer overlay and a keyword sentence in
  the minimal preview.

## Save and load (v0.2)

Design section 10, "Save and load (v0.2, scheduled next)". Code: `src/save.js`
(no rules), wired in `src/main.js`; numbers in `CONFIG.save` and
`CONFIG.freshStart`.

- **One slot**, local storage key `plaything-sim.save`, this device only. It is
  written at every day end (after the nightly rolls), whenever the queued
  command changes (accepted command or Cancel), and at once for a new run.
  Nothing is shown on screen.
- **What it holds:** save format version 1 plus every run field: seed, day,
  every Gourdling (number, age, needs, illness days, traits), next number,
  provisions, firewood, Bonfire and farming state with the 4 plots, the shed,
  the birth/Bonfire/farming streaks, command weather and its days left,
  tomorrow's rolled weather and illness, both dice positions, Wonder, every
  cooldown and once-per-run use, the queued command, the ended flag and the run
  stats, plus the journal and internal log. Not saved: the config (rebuilt from
  `src/config.js`), the previous day's report, the play speed and time inside
  the unfinished day (it replays the same way from its start).
- **Opening the page** resumes the save, paused (or at the preset's auto-play
  speed). With no save, an unreadable one, a missing field or another format
  version, a new run starts with a new seed and replaces it. Bump
  `CONFIG.save.version` whenever the saved fields change. `?seed=N` always starts
  that seed fresh (and saves it), for testing and replays.
- **Ended runs** reopen on their end screen. Enter (or Restart) starts a new run
  with a new seed and overwrites the save at once.
- **Fresh start by typing.** After the section 11 cleaning, the whole input must
  equal `begin anew` (`CONFIG.freshStart.phrase`). It is not a keyword synonym
  and is checked before keyword matching; it costs nothing. With
  `requireConfirm: true` (decided by the PM), the first time nothing restarts:
  the feedback line shows the faint text "say it again to let this world go"
  (`feedback.beginAnew` in theme.js; where the feedback line is hidden, as in
  `?ui=minimal`, the input's placeholder shows it instead), the game keeps
  running and no Wonder is spent. Typed again within 10 seconds of real
  (wall-clock) time (`confirmSeconds`), a new run starts with a new seed and
  overwrites the save. Any other input, or the time running out, cancels quietly
  and the faint text fades (`THEME.ui.fadeMs`); other input then runs as a
  normal command. The pending state is never saved, so a reload cancels it.
  With `requireConfirm: false` the first `begin anew` restarts at once.
- The old no-save notice is removed (design section 10): `showNotice` now
  defaults to `false`, and its copy, if switched back on, describes the
  autosave. The start and restart messages no longer say "No saved game".
- Tests: `tests/save.test.js` (round trip; reload after a day end or with a
  queued command on days 1, 13 and 30, then play to day 60, equals an
  uninterrupted run for 6 seed/strategy pairs; ended runs; bad saves; storage
  failures; every "begin anew" case with a fake clock) and
  `scripts/save-smoke.mjs` (the same in the built page with Playwright's fake
  clock; screenshot `reports/save-begin-anew.png`).

## Art in the page (outside the canvas)

The forecast (`#forecast`) renders the live word "Tomorrow", then `tag_tomorrow`
with the forecast cue in its icon slot, then the weather name. The wipeout end
screen is an overlay on the clearing using `sign_endscreen` (nine-slice) and the
Restart button images. All of this is CSS in `src/theme.js`, switched on per file
by `art-<key>` classes after Phaser confirms the file loaded; otherwise the plain
fallback styling applies. Icon files carry their own ink badge, so the renderer
draws no backing behind them.

## UI switches (`THEME.ui`) and the minimal preview

Every HUD and panel element outside the world canvas can be switched off from one
block, `THEME.ui` in `src/theme.js`. This is preparation only: the default screen
is unchanged, and the radically minimal screen (world plus one text box) is a
preview until its mockup and spec are approved.

- `THEME.ui.defaults` holds the flags; all `show…` flags are `true` by default:
  `showHeader`, `showNotice` (off by default since save/load), `showStats`, `showButtons`, `showForecast`,
  `showWorldTitle`, `showWorldCaption`, `showMilestone`, `showCommandList`,
  `showQueueStatus`, `showFeedback`, `showDetailPanel`, `showJournal`,
  `showGoalText`, `showFooter`, `showEndScreenStats`. Three more settings:
  `autoPlaySpeed` is `null` by default (keep the sim's paused start),
  `enterRestarts` is `false` (the full screen restarts with its Restart button)
  and `devOverlay` is
  `false` (`?dev=1` also turns the developer overlay on).
- `THEME.ui.targets` maps each flag to the page parts it hides (CSS selectors into
  `index.html`). The world canvas, the command text box and the end screen's
  title, text and Restart button can never be switched off.
- `THEME.ui.presets.minimal` turns every `show…` flag off, sets
  `autoPlaySpeed: 1`, because with no buttons the days have to run by themselves,
  and sets `enterRestarts: true` (no Restart button, so Enter restarts after a
  wipeout). The keyword matcher is on in every preset.
  Open the page with `?ui=minimal` (it combines with `?seed=`) to preview it.
  Unknown preset names fall back to the defaults.
- `src/main.js` resolves the flags once at load (`resolveUi` in `theme.js`), sets
  `hidden` on each target, then hides any wrapper whose children are all hidden
  (top bar, world heading, weather line, queue row, side column, footer) and adds
  `ui-hide-<flag>` / `ui-empty-<wrapper>` classes on `<html>`. CSS in `theme.js`
  uses those classes to close the space: an empty side column gives the world the
  full width, and a command panel left with only its text box loses its frame.
  `[hidden]` always wins over a display rule (`display:none!important`).
- Render code still writes to hidden elements, which is harmless, so turning a
  flag off cannot throw. The sim and rules never read `THEME.ui`; `autoPlaySpeed`
  only calls the existing `setSpeed` at load and on Restart.
- Commands typed into the box and sent with Enter work in every preset, matching
  keywords anywhere in the text. A sentence with no keyword shows no message; a
  refused command shows its reason only where the feedback line is shown (not in
  the minimal preview). Either way the input text stays and the queued command
  is kept. The placeholder reads "Type a command, then press Enter".

Checks: `tests/ui.test.js` (defaults all on, the minimal preset all off, every flag
targets real parts of `index.html`, the sim never reads the switches) and
`scripts/ui-smoke.mjs` (headless browser on `dist/index.html`). With default
flags nothing is switched off and there is no developer overlay. With
`BASE_REF=<commit>` it also compares the default page at 1440, 900 and 600 px
wide with that commit's build: the box of every element must match on every
load, and the screenshot must match pixel for pixel (up to 5 fresh loads per
width, because Chrome's anti-aliasing of the input placeholder can differ between
two loads of the same file). That check passed for commit `350ac25` against
`87c90b0`; v0.2 changes the default page (traits line, two more commands), so it
is off by default now. For `?ui=minimal` it checks that only the canvas and the
command box are visible, with no buttons and no gaps, that Enter on "Please make
it RAIN!" queues cloud wrangle and the day then applies it with no button
pressed, and it saves `reports/ui-minimal-preview.png`,
`reports/v02-traits-detail.png` and `reports/v02-dev-overlay.png`.
