# Gourdling Barn Dance — Plaything Sim v0.2 (personalities)

A tiny **First Age Homestead** that lives on its own. Six alien Gourdlings gather
provisions, keep warm, rest, grow old and raise children. Vintage folk-Americana
art, simple rules. **No AI, accounts, internet, farming or music simulation.**

## Play — no installation

1. Open the **dist** folder.
2. Double-click **index.html**. It opens in your browser.
3. Read the no-save notice. The Homestead starts **paused**.
4. Click **1×** to watch, **3×** to speed up, or **Next day →** to step one day.

**There is no saved game. Closing, refreshing or restarting loses this Homestead.**
The single `dist/index.html` contains the game, Phaser, the theme and all SVG art.
You can copy just that file to another computer and play offline. The Phaser
license is embedded in its comments. If it opens in an editor, right-click →
Open with → your web browser.

## How to play

- Left alone, the Homestead can usually survive, but it struggles: weather and
  illness are rolled by dice each night, and deaths are permanent. Your help can
  make it flourish. Reaching **day 30 with at least 5 Gourdlings and Bonfire
  known** shows a milestone message; play goes on.
- Commands are optional: Gourdlings can discover the Bonfire on their own
  (from day 20).
- **Tomorrow's weather** is shown above the clearing as soon as it is rolled. If
  you queue cloud wrangle or dry spell, it shows the weather you called instead.
- If the last Gourdling dies, **The Homestead Falls Quiet**: time stops, no more
  commands, and a summary shows days lasted, peak population, births, deaths,
  when the Bonfire was found and the run's **seed**.
- Click a Gourdling, or its name in **Little lives**, for its age, activity and
  five needs. Higher numbers are better. The name buttons also work on a phone.
- Read the **Homestead journal** for important changes; it keeps the latest 10.
- **1×:** one day every 30 seconds. **3×:** one day every 10 seconds.
- **Pause** freezes simulation time. **Next day →** deliberately resolves one
  complete day even while paused; it helps you learn the rules.
- **Restart** immediately returns to a new Homestead at day 0, paused, with a
  new seed. To replay a run exactly, add `?seed=123` to the page address (the
  same seed with the same commands on the same days gives the same story).

### A word from above

Type **either** wording in a row below and press **Enter**, or click **Queue**.
The command applies at the start of the **next day**, not when typed. Queuing is
free: Wonder is paid only when it applies. Enter another valid command to replace
it, or click **Cancel**. Only one command applies per day.

| Name (plain alias) | Wonder | Wait before repeating | Effect |
|---|---:|---|---|
| `cloud wrangle` (`rain`) | 10 | 4 days | Call 3 days of rain: more gathered provisions, extra cold. |
| `dry spell` (`drought`) | 10 | 4 days | Call 3 days of drought: fewer gathered provisions. |
| `hoedown` (`bless`) | 20 | 5 days | Everyone gains up to 25 health and 15 happiness. **Does not cure illness.** |
| `sick hex` (`plague`) | 30 | 8 days | Everyone ill for 3 days: −20 health and −5 happiness/day. **It can kill Gourdlings.** |
| `teach spark` (`teach fire`) | 25 | Once per run | Permanent Bonfire knowledge. Needs 3 firewood: 2 to learn, 1 to burn today. |
| `feast drop` (`harvest`) | 20 | 5 days | Gift up to 12 provisions to the Pantry, not beyond capacity. Normal meals happen later. |
| `shake off` (`heal`) · v0.2 | 25 | 6 days | Cure everyone's illness. Does not restore health. Refused when nobody is ill. |
| `teach sowing` (`teach farming`) · v0.2 | 25 | Once per run | Teach farming: a 4-plot field appears at once. The Homestead can also discover it from day 40. |

**Each pair is ONE command**, not two powers. Same effect, same payment, same
restrictions and **one shared cooldown**. Hoedown on day 4 also blocks bless until
day 9. The plain aliases remain accepted; parentheses are help formatting, not
part of what you type. Extra spaces and capital letters are fine: `CLOUD  WRANGLE`
and `rain` do the same thing. Keywords also work anywhere in a sentence
(`Please make it RAIN!` is cloud wrangle; `brain` is not). The full keyword list
and tie order are in `docs/IMPLEMENTATION.md`. A sentence with no keyword does
nothing and shows no message; a refused command explains why.

Rain and dry spells replace each other (and a cold snap), not stack. Their casting day counts as
the first of 3 days. The HUD separates today's weather from upcoming affected
days. Sick hex is unavailable and hidden under **both names** when plague is
switched off by the developer. No later-era commands are callable.

Commands fail **without spending Wonder** if funds are insufficient, a cooldown
is active, the same weather is already active, someone is already ill, the Pantry
is full, Bonfire is known/less than 3 firewood remains, everyone already has full
health and happiness for hoedown, or the Homestead has ended. Reasons and cooldown
availability are shown. Conditions are checked again when the command applies.

### How the little lives work

Each night three dice are rolled: tomorrow's weather (31% fair, 30% rain, 25% dry
spell, 14% **cold snap**: −40 extra warmth, no command creates it), whether
someone falls ill (13%: one Gourdling, 3 days, the same illness as sick hex) and
who. Nothing else is random.

Commands happen first, then a known Bonfire uses 1 firewood if available. Gourdlings
get hungry and may get cold, then choose **one** activity, in this order:

1. Emergency forage if very hungry and no provisions remain.
2. Warm up if cold.
3. Forage if the shared provision reserve is low.
4. Gather firewood if the fuel reserve is low.
5. Otherwise rest.

v0.2 adds a farming field (harvest a ripe plot, plant an empty one), a second
Plank shed (cap 12) and **personalities**: every Gourdling has 2 of 10 traits
(Smart/Scatterbrained, Brave/Timid, Generous/Grabby, Sociable/Loner,
Hardy/Shivery) from its own seeded dice, shown in the detail panel. The exact
list, with numbers, is in `docs/IMPLEMENTATION.md` ("How a Gourdling decides").
Add `?dev=1` to the address for a developer overlay with stats and the internal
trait log.

All work finishes before meals. Turn order rotates so the same Gourdling does
not always get scarce provisions first. Children gather less. Ill Gourdlings
still work. One **Plank shed** has room for all 8 possible Gourdlings.

Provisions, firewood and Wonder each hold up to 100. Wonder returns daily. Bonfire
knowledge is permanent, but no fuel means an **unlit** Bonfire. A healthy, happy
Homestead can discover it after 3 qualifying evenings, starting day 20. A lit
Bonfire gives +10 warmth a day. A comfortable, well-fed Homestead with nobody ill
has a child after 5 qualifying evenings in a row.
The **Pantry** is the existing supply spot, not a new building. Corn and musical
instruments are decoration, not farming or extra jobs.

Gourdlings can die from poor health or old age; deaths are brief and non-graphic.
At zero population, time stops and **Restart** is offered.

## Run the editable version

Only needed if changing the game. Playing the double-click file above needs
**neither Node nor a terminal**.

With Node.js 20 or newer:
1. Open a terminal in `plaything-sim`.
2. Run `npm start`. **No `npm install` needed.**
3. Open **http://127.0.0.1:4173/**. Keep the terminal open; Ctrl+C stops it.

The top-level `index.html` uses ES modules and needs this server. The `dist`
version does not. If the port is busy, stop an earlier server or, on Linux/macOS,
use `PORT=4174 npm start` and open that port instead.

## Developer map

- **`src/theme.js` — single-file reskin:** six-color palette, system serif fonts,
  CSS, geometry, dimensions/pivots, shape fallbacks, optional sprite map, every
  UI/log/error/help template, resource/age/activity/reaction labels and names.
  Set `THEME.sprites = {}` for the fully playable geometric version.
- `src/commands.js` — **one authoritative accepted-word table**: approved names
  and original aliases → stable canonical IDs. Resolve before payment/checks.
  Theme labels cannot change parser vocabulary; help always retains actual words.
- `src/config.js` — **all rule/balance numbers**, unchanged from the design.
  `enablePlague: false` hides/rejects both `sick hex` and `plague`.
- `src/sim.js` — immutable simulation; no browser or Phaser. Its only dice are a
  seeded generator kept in the state (3 rolls per night), so runs replay exactly.
- `src/village-view.js` — theme-driven renderer, optional SVG loading, decorative
  travel/idle-walk frames, separate shadows and ground-contact-y sorting.
- `src/main.js` — controls and theme-based readouts.
- `assets/` — 50 approved **SVGs only** (polish pass, incl. cold snap, forecast tag, end sign and Restart button) and the artist manifest.
- `docs/ART-ASSETS.md` — exact filenames, sizes, anchors and icon redo guidance.
- `docs/design-v0.1-flavour.canvas.txt` — latest full supplied design; original
  pre-flavour source is also retained. `docs/IMPLEMENTATION.md` has conventions.
- `vendor/` — local Phaser **3.90.0** and MIT license; never a runtime CDN.

```sh
npm test          # 56 tests: original 8 build checks + aliases, theme and assets
npm run report    # Original 30-day no-command balance evidence, JSON + CSV
npm run build     # Inline code, CSS, Phaser and present SVGs into dist/index.html
npm start         # Serve editable modules locally
```

**Rebuild after every source, theme or art change.** Missing optional files are
replaced by shapes; the standalone build drops missing paths instead of making
broken file requests. Patterns such as `assets/gourdling_{variant}_{state}_{frame}.svg`
expand to separate images, not an atlas. Empty maps require no assets. See the
art handoff for adding approved art without changing renderer code.

Optional separate-profile headless browser regressions, with `playwright-core`
installed outside this repo and a Chromium executable available:

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright-core/index.mjs \
CHROMIUM_PATH=/path/to/chrome node scripts/smoke.mjs
# Also checks a changed theme, empty map, missing art and offline SVG embedding:
PLAYWRIGHT_MODULE=/absolute/path/to/playwright-core/index.mjs \
CHROMIUM_PATH=/path/to/chrome node scripts/theme-smoke.mjs
# UI switches and ?ui=minimal (keyword commands); BASE_REF=<commit> also compares pixels:
PLAYWRIGHT_MODULE=/absolute/path/to/playwright-core/index.mjs \
CHROMIUM_PATH=/path/to/chrome node scripts/ui-smoke.mjs
```

Preview the future minimal screen (world plus command box only) by opening the
page with `?ui=minimal`; the switches live in `THEME.ui` in `src/theme.js`.

The optional theme test reads the artist SVG directory by default; override with
`ART_SVG_DIR=/path/to/svg`. Browser tooling is not needed to play, build or run
`npm test`. It launches its own temporary headless browser, never your desktop
browser or a signed-in account.

`npm test` also checks the docs: every number quoted in
`docs/IMPLEMENTATION.md` → "How a Gourdling decides" must match `src/config.js`.
Change a number in config, update that section in the same commit.

## Verified result

The survival rebalance matches the reference simulator
(`/workspace/sim/gourdling_survival.py`) **seed for seed** on seeds 0–199,
500–699 and 1000–1199. Seeds 0–199, 60 days: untouched 94.5% alive (5.5% wiped
out, 81% lose someone, Bonfire 96%, median day 22); helped 100% alive, 97.5%
reach 8, 8.5% lose someone; cruel 97% wiped out. `npm run report` prints the
table. See `reports/verification.md` for current unit/browser results.

This follow-up used **local git only: no fetch, pull, rebase or push**. The parent
will handle its fresh archive and GitHub history alignment separately.
