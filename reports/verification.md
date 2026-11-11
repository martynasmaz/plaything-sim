# Verification — v0.1

## Design build checks: all pass

`npm test`: **44 passed, 0 failed, 8 suites**. No third-party test dependencies.

| Section 7 build check | Result | Evidence |
| --- | --- | --- |
| No-command run | PASS | Exact initial values; 8 alive on day 30, 21 food, 6 wood, no deaths. Natural fire at day 12 end, lit on day 13. |
| One normal day | PASS | Fullness 75 → 50 → 80; 2 foragers add 6 food, 6 one-food meals; rest use and all storage/need bounds checked. Rotated work/meal order and priority branches tested. |
| Three-day weather | PASS | Rain cast day 2 affects yields and warmth on days 2, 3, 4 only; day 5 normal. Opposite weather replaces with fresh timer. |
| Command validation | PASS | Exact normalization; unknown, cooldown, power and all condition rejections. Queue/replace/cancel, revalidate on application, one payment/effect, cooldown day 4+5 = day 9, plague-disabled vocabulary. |
| Fire in both routes | PASS | Teach with 3 wood spends 2+1 that day. Natural spends 2 at day end, first burns tomorrow. No-fuel knowledge persists, shelter +20/fire +40 warm-up checked. |
| Illness and death | PASS | Plague damage 8+8+8 = 24, no fourth day, no sick-day recovery. Bless not a cure. Death removed once; combined old-age/illness causes recorded. |
| Birth and population cap | PASS | Child after 15 eligible evenings, exact newborn values, first work/meal tomorrow. Failed day resets. Food-after-meals and adult eligibility checked; cap ≤8 across 500 days. |
| Pause and reset | PASS | Paused time is identity transition. 30s/10s speeds, partial-day preservation, exact restart, zero-population end and all future-command rejection. |

The no-command run succeeded; **no design numbers were tuned**. Full day-by-day
population, food, wood, power, fire, births and deaths: `no-command.csv` and
`no-command.json`. Children were born on days 15 and 30.

## Browser checks: both pass

A fresh isolated headless Chromium process (temporary profile, no accounts) tested:

- editable ES-module game at `http://127.0.0.1:4173/`;
- `file:///workspace/plaything-sim/dist/index.html` with **networking offline**.

Both rendered the Phaser canvas and passed typing/Enter, unknown-command
feedback, free queue/replace/cancel, teach-fire effect, rain timers, clickable
villager circles and roster selection, pause/normal/3× controls, restart,
30 days stepped through visible controls, the milestone, and 390px layout.

**Zero browser console errors; zero external requests.** The server version made
7 local requests; the standalone version made only its own file request.
See `browser-smoke.json` for machine-readable results.

Screenshot of settled movement on day 3: `../screenshot.png`.
Offline-file screenshot: `file-offline.png`. Narrow-layout screenshots:
`local-server-mobile.png` and `double-click-offline-mobile.png`.

No remote has been added. No GitHub publishing, messaging or deployment occurred.
