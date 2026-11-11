# Approved provisional v0.1 SVGs

44 SVGs copied from `/workspace/art/v0.1/svg/`; no PNGs or atlas. The pack's unused
base-creature frames are omitted. `manifest.json` retains the artist's original
metadata. Actual active map, exact pivots and canvas display sizes are in
`src/theme.js`; the artist handoff is `docs/ART-ASSETS.md`.

The default theme now uses this art. Set `THEME.sprites = {}` in theme.js to use
all geometric fallbacks. Rebuild with `npm run build` after any theme/art change.
The standalone HTML contains the SVGs as data URIs; no separate assets required.
