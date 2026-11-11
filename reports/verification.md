# Verification — v0.1 survival rebalance, Gourdling theme and approved art

Date: 2026-11-11. No design numbers were tuned.

## Unit tests: 68 passed, 0 failed

`npm test` (Node `node:test`, no dependencies). Full output: `node-tests.txt`.

| Section 7 build check | Result |
| --- | --- |
| Untouched survival (seeds 0–199) | PASS — 94.5% alive, 5.5% wiped, 81% lose someone, Bonfire 96% (median day 22) |
| Helped strategy | PASS — 100% alive, 97.5% reach cap 8, 8.5% lose someone |
| Cruel strategy | PASS — 97% wiped out by day 60 |
| Seed replay | PASS — identical day-by-day log; restart picks a new seed; 3 rolls/night even under command weather |
| One fair day | PASS |
| Three-day weather (cloud wrangle over a forecast cold snap) | PASS |
| Command validation | PASS |
| Bonfire in both routes (natural day 22 earliest) | PASS |
| Illness and death (100 → 40; all at 60 die day 3) | PASS |
| Birth and cap (5 evenings) | PASS |
| Wipeout and restart | PASS |
| Pause | PASS |

Every JS run equals the Python reference seed by seed (seeds 0–199 in the test
suite; 500–699 and 1000–1199 also checked by hand). Table: `balance-console.txt`,
`balance.json`. Layout: `tests/layout.test.js` + `layout-smoke.json`. Docs drift: `tests/docs.test.js` fails if any number quoted in IMPLEMENTATION.md "How a Gourdling decides" differs from `src/config.js`.

## Browser checks (fresh headless Chromium, temporary profile)

| Run | Result |
| --- | --- |
| Local server `http://127.0.0.1:4173/` with art (53 local requests) | PASS, 0 console errors, 0 external requests |
| `dist/index.html` from `file://`, network offline (1 request, 50 SVGs inlined) | PASS, 0 console errors |
| Theme swap (title, resource name, Gourdling names, log text changed by one file) | PASS |
| Missing optional background → shape fallback | PASS |
| Empty sprite map → plain shapes, fully playable | PASS (`fallback-shapes.png`) |
| All configured art files missing → plain shapes, fully playable | PASS |

Checked in-browser: typing/Enter, unknown phrase, queue/replace/cancel, aliases
(old words) accepted, teach spark, cloud wrangle timers, clickable Gourdlings,
speed controls, restart, 30-day milestone, mobile layout, renamed HUD and the
sick hex "can kill Gourdlings" help line; sprite idle/walk frames, separate
shadows, child sprite, sick icons, ground/weather tiles, sign panel.

Screenshots: `../screenshot.png` (art), `file-offline.png`, `*-mobile.png`,
`theme-assets.png`, `theme-assets-illness.png`, `fallback-shapes.png`.
