# Plaything Sim — v0.1

A tiny Stone Age village that lives on its own. Six villagers follow simple rules:
gather, eat, keep warm, rest, grow old and raise children. No AI, accounts or internet.

## Play it — easiest way (no installation)

1. Open the **dist** folder.
2. Double-click **index.html**. It opens in your web browser.
3. Read the no-save notice. The game starts **paused**.
4. Click **1×** to watch, **3×** to speed up, or **Next day →** to see one day at a time.

**There is no saved game. Closing, refreshing or restarting loses this village.**
The single file `dist/index.html` contains everything, including Phaser. You can
copy just that file to another computer. Its embedded comments include the Phaser license.
If double-clicking opens an editor, right-click the file → Open with → your browser.

## What to do

- The first goal: reach **day 30 with at least 5 villagers alive and fire known**.
  That is a milestone, not the end of the game. You can keep watching.
- You do not have to give commands. Villagers can discover fire on their own.
- Click a villager's circle, or their name in **Little lives**, to see their age,
  activity and five needs. Higher numbers are better.
- Read the **Village journal** for important changes. It keeps the latest 10 entries.
- **1×:** one game day every 30 seconds. **3×:** every 10 seconds.
- **Pause** freezes simulation time. **Next day →** deliberately resolves one full
  day even while paused; it is useful for learning how the rules work.
- **Restart** immediately starts a new village at day 0, paused.

### A word from above

Type one of these commands into the box, then press **Enter** (or click **Queue**).
The command takes effect at the start of the **next game day**, not when typed.
Queuing costs nothing. Enter another valid command to replace the queued one,
or click **Cancel**. Only one can apply per day.

| Command | Power | Wait before repeating | What it does |
| --- | ---: | --- | --- |
| `rain` | 10 | 4 days | Rain for 3 days: more food from foraging, extra cold. |
| `drought` | 10 | 4 days | Drought for 3 days: less food from foraging. |
| `bless` | 20 | 5 days | Everyone gains up to 15 health and 15 happiness. **Not a cure.** |
| `plague` | 30 | 8 days | Everyone is ill for 3 days: −8 health and −5 happiness each day. |
| `teach fire` | 25 | Once per run | Learn fire. Needs 3 wood: 2 to learn and 1 to burn today. |
| `harvest` | 20 | 5 days | Gift up to 12 food, without exceeding 100. |

Capital letters and extra spaces are fine. Other phrases are not understood.
For example, `TEACH   FIRE` works; `please teach fire` does not.

A command cast on day 4 with a 5-day wait can be cast again on day 9.
Rain and drought replace each other, not stack. The casting day counts as day 1
of a 3-day effect. The weather readout separates **today's conditions** from
**the next day's weather and its remaining days**.

Commands fail without spending power if conditions are not met: not enough power,
a repeat too soon, the same weather already active, illness already active,
food already full, fire already known/less than 3 wood, a blessing when everyone
already has full health and happiness, or an ended village. Failures are explained.
Everything is checked again when the queued command applies.

### How the little lives work

Every day, commands apply first. A known fire uses 1 wood if available. Villagers
get hungry and may get cold, then choose **one** action in this order:

1. Emergency forage if very hungry and no food remains.
2. Warm up if cold.
3. Forage if the shared food reserve is low.
4. Gather wood if the fuel reserve is low.
5. Otherwise rest.

Everyone finishes work before meals. Villagers take turns in a rotating order,
so the same person does not always get scarce food first. Children gather less.
Ill villagers still work. The shelter has room for everyone (8 maximum).

Food and wood each hold up to 100. Power returns daily. Fire knowledge is permanent,
but an empty wood stock means an **unlit** campfire. Two happy adults and a healthy
village can discover fire naturally after 3 qualifying evenings, starting day 10.
A comfortable, well-fed village can have a child after 15 qualifying evenings.
Villagers can die from poor health or old age; deaths are brief and non-graphic.
At zero population, time stops and **Restart village** is offered.

## If you want to run the editable version

You only need this section if you or a developer are changing the game. Playing
the double-click file above does **not** need Node or a terminal.

With Node.js 20 or newer installed:

1. Open a terminal in the `plaything-sim` folder.
2. Type `npm start` and press Enter. No `npm install` is necessary.
3. Open **http://127.0.0.1:4173/** in your browser.
4. Keep the terminal open while playing. Press Ctrl+C there to stop the server.

Use the address above for the top-level `index.html`. That editable version uses
JavaScript modules and needs the local server; the version in `dist` does not.
If the port is already busy, stop an earlier server or use `PORT=4174 npm start`
on Linux/macOS, then open that port instead.

## For the developer

- `src/config.js` — **all simulation tuning values**. Defaults match the design.
  `enablePlague: false` disables plague and removes it from the visible list.
- `src/sim.js` — immutable deterministic simulation; no browser, Phaser or randomness.
  `createState`, `queueCommand`, `stepDay`, `advanceTime`, `restart` and helpers.
- `src/village-view.js` — **all village drawing and decorative movement**. Replace
  this when artist assets arrive. Movement never changes simulation results.
- `src/main.js` — controls, HUD and villager readouts.
- `tests/sim.test.js` — Node's built-in test runner; no packages required.
- `docs/design-v0.1.canvas.txt` — complete supplied design source.
- `docs/IMPLEMENTATION.md` — conventions and resolved ambiguities.
- `reports/` — 30-day balance evidence and browser-test results.
- `vendor/` — Phaser **3.90.0**, vendored with its MIT license for offline play.

Useful commands (no dependencies to install):

```sh
npm test          # All 8 design build checks (44 individual assertions/tests)
npm run report    # Exact 30-day no-command run, JSON + CSV evidence
npm run build     # Regenerate the double-clickable dist/index.html
npm start         # Serve the editable modules locally
```

**After changing source or the plague flag, run `npm run build` to update `dist`.**
The simulation APIs never mutate their input. A rejected `queueCommand` returns
the original state plus a reason. `stepDay` is an explicit tick; `advanceTime`
is the playback clock and respects pause.

Optional browser regression: start the server, install `playwright-core` somewhere
outside this project (or in your development setup), then run:

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright-core/index.mjs \
CHROMIUM_PATH=/path/to/chrome node scripts/smoke.mjs
```

This launches a separate temporary-profile **headless** browser, never a signed-in
browser. It tests both the server and the single file with networking offline,
commands, selection, restart, the day-30 milestone and a narrow screen. It writes
`screenshot.png` and `reports/browser-smoke.json`. Optional browser tooling is
not needed by `npm test`, the build or the game itself.

## First verification

All **44 tests in all 8 build-check groups passed**. With no commands and unchanged
design values: fire discovered at the end of **day 12**, first lit **day 13**;
children born **days 15 and 30**; **8 alive, 21 food, 6 wood, no deaths on day 30**.
Local-server and fully offline `file://` browser smoke tests passed with zero
console errors and zero external network requests. See `reports/verification.md`.

Local git history is initialized. **No remote, GitHub repository or deployment
has been created.**
