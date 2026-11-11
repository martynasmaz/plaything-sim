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
native HTML inputs/buttons for accessibility, and only geometric drawing/text.
No CDN requests occur at runtime. There are no assets, services, AI, save storage,
random game decisions, build dependencies or runtime npm dependencies.

The single-file generator concatenates these small modules in dependency order,
removes imports/exports, and embeds code, styles and vendored Phaser. The editable
sources remain separate ES modules. Rebuild after every source change. The
single-file build uses inline classic scripts to avoid file:// module CORS.

Browser regression uses an optional external Playwright installation and launches
its own fresh **headless** process, not the desktop browser or an existing session.
No user accounts, cookies or credentials are involved.
