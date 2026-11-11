# Verification — v0.1 with Gourdling theme, flavour names and approved art

Date: 2026-11-11. No design numbers were tuned.

## Unit tests: 56 passed, 0 failed (10 suites)

`npm test` (Node `node:test`, no dependencies). Full output: `node-tests.txt`.

| Section 7 build check | Result |
| --- | --- |
| No-command run (day 30, ≥5 alive, Bonfire known) | PASS — 8 alive, 21 provisions, 6 firewood, 100 Wonder, no deaths; Bonfire discovered end of day 12, first burns day 13; births days 15 and 30 |
| One normal day | PASS |
| Three-day weather | PASS |
| Command validation | PASS |
| Bonfire in both routes | PASS |
| Illness and death (24 damage) | PASS |
| Birth and population cap | PASS |
| Pause and reset | PASS |

Extra theme/flavour tests (12): each new name and its old alias produce identical
canonical states; shared cooldown in both directions (cast day 4 → ready day 9);
shared restrictions and revalidation; `enablePlague:false` hides/rejects both
`sick hex` and `plague`; later-version words stay unknown; theme copy/manifest/
pivot/variant checks; sim numbers unchanged by the theme; build inliner handles
missing and unsafe asset paths.

Day-by-day no-command data: `no-command.csv`, `no-command.json`, `balance-console.txt`.

## Browser checks (fresh headless Chromium, temporary profile)

| Run | Result |
| --- | --- |
| Local server `http://127.0.0.1:4173/` with art (53 local requests) | PASS, 0 console errors, 0 external requests |
| `dist/index.html` from `file://`, network offline (1 request, 44 SVGs inlined) | PASS, 0 console errors |
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
