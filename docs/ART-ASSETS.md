# v0.1 art handoff — Gourdling barn dance

**Game canvas: 900×480 logical px**, responsively fitted to the browser. No text is
baked into art. Masters: `/workspace/art/v0.1/svg/`; PNG previews: `png/1x/`,
`png/2x/`. The game uses **44 separate SVGs under `assets/`**, no PNGs or atlas.
`assets/manifest.json` preserves the artist's exact source sizes and contact
pivots. Their active copy, display dimensions, fallback drawings, fonts and paths
are all in **`src/theme.js`**. Swap that file to reskin; rebuild the standalone HTML.

## Actual keys, files and sizes

Dimensions are **source/viewBox → canvas display**, before browser scaling.
Pivots below are **source logical px**, measured from top-left; normalized image
origins are calculated from them. Preserve the 2px-ish empty foot margin: do not
trim sprites or put their anchor at the SVG edge instead of the actual feet.

| Theme key | Exact file under `assets/` | Source → displayed px | Pivot / purpose |
|---|---|---|---|
| `villager` / expanded `gourdling_<variant>_<state>_<n>` | `gourdling_{fiddler,banjo,singer,kicker,washboard,jug}_{idle_1,walk_1,walk_2}.svg` (18 files) | 64×96 → **40×60** | **32,94**, feet; variant = `(permanent ID−1) % 6` |
| `villager_child` / `gourdling_child_*` | `gourdling_child_{idle_1,walk_1,walk_2}.svg` (3) | 48×72 → **30×45** | **24,70.7**, feet; ages below 20 |
| `shelter` | `shed.svg` | 128×128 → 128×128 | 64,120; one Plank shed |
| `campfire_lit` | `bonfire_lit.svg` | 64×64 → 64×64 | 32,56; burning Bonfire |
| `campfire_out` | `bonfire_unlit.svg` | 64×64 → 64×64 | 32,56; unlit Bonfire, including knowledge unknown |
| `pantry` | `pantry.svg` | 64×64 → 64×64 | 32,57; supply crate, **not another building** |
| `food_spot` | `gather_food.svg` | 64×64 → 88×88 | 32,55; provisions gathering bush |
| `wood_spot` | `gather_wood.svg` | 64×64 → 80×80 | 32,59; firewood pile, no tool/axe needed |
| `lantern` | `lantern.svg` | 32×64 → 32×64 | 8,61; crooked pole base |
| `corn` | `corn.svg` | 32×64 → 32×64 | 16,62; edge decoration, **not farming** |
| `ground_tile` | `ground.svg` | 64×64 → 64×64, tiled | 0,0; seamless flat green, masked to clearing |
| `fence_tile` | `fence_horizontal.svg` | 64×64 → 64×64 | 32,32; seamless rail ports |
| `fence_vertical` | `fence_vertical.svg` | 64×64 → 64×64 | 32,32; vertical rail |
| `fence_corner` | `fence_corner.svg` | 64×64 → 64×64, rotated as needed | 32,32; north-edge corner |
| `shadow` | `shadow.svg` | 48×16 → 40×13⅓ for adult; scaled for props | 24,8; separate flat ink shape, opacity already 25% |
| `command_panel` | `sign_ui.svg` | 480×72 → flexible-width, minimum 72px-high command sign | 0,0; CSS nine-slice border; **live serif text** |
| `rain` | `overlay_rain.svg` | 64×64 → 64×64 tile over 900×480 | 0,0; renderer opacity **16%** so rain does not obscure Gourdlings |
| `drought` | `overlay_drought.svg` | 64×64 → 64×64 tile over 900×480 | 0,0; renderer alpha 65% of file's own reduced opacity |
| `rain_cue` | `cue_rain.svg` | logical 32×32 / current viewBox 64² → **24×24** | 16,16; weather cue, with text |
| `drought_cue` | `cue_drought.svg` | logical 32×32 / current viewBox 64² → **24×24** | 16,16; dry-spell cue, with text |
| `sick_icon` | `status_sick.svg` | logical 24×24 / current viewBox 64² → **18×18** | 12,12; sick/unwell, retains word label |
| `unhappy_icon` | `status_unhappy.svg` | same → **18×18** | 12,12; unhappy |
| `uneasy_icon` | `status_uneasy.svg` | same → **18×18** | 12,12; uneasy |
| `hoedown_icon` | `status_hoedown.svg` | same → **18×18** | 12,12; grateful reaction, no music mechanic |
| `warming_icon` | `cue_warming.svg` | same → **18×18** | 12,12; warm-up activity |
| `background` (optional, **not shipped or required**) | `background.svg` | 900×480 → 900×480 | 0,0; ground/paths only, no actors, props or UI |

Only creatures use frames: **idle_1** when standing; **walk_1/walk_2** alternate
while decorative travel is active. All other images are static. Shadows stay
under bodies; world objects and Gourdlings sort by their ground-contact y.
The pack's three `gourdling_base_*` files are unused, so not copied.

## Readability / next polish pass

- Increased adult display **32×48 → 40×60**, child **24×36 → 30×45**; widened
  activity spacing to 48px and rows to 60px. **No source canvas resize needed.**
- At normal desktop size, shed, Bonfire, Pantry and gathering spots read clearly.
  Kicker/singer poses are clearer than instrument details: fiddle/banjo/washboard/
  jug can still be hard to distinguish at 40×60. Simplify accessory silhouettes;
  keep species body, long neck, sprout and dot eyes unchanged. No more detail.
- Mobile fitting shrinks adults to roughly 16×24 on a 390px phone. It is an
  overview there; the accessible name buttons and needs panel carry detail.
- **Icons need a redo, not larger files.** Current viewBox-64 drawings scaled
  into 24px logical files lose their thin internal marks. Use native-coordinate
  viewBoxes below, fewer marks, strong silhouette and ink/cream contrast.

### Updated cue/status icon spec

Keep existing filenames and transparent backgrounds. **Weather:** 32×32 SVG,
`viewBox="0 0 32 32"`, pivot 16,16, displayed 24×24. **Status/reaction/warming:**
24×24 SVG, `viewBox="0 0 24 24"`, pivot 12,12, displayed 18×18. One static image
per icon, no atlas or text. Uniform **3px native ink outline**, 2px safe margin;
avoid tiny face features or multiple little symbols. Suggested distinct shapes:
cloud + two rain strokes; cracked sun; sick bent sprout + cross; unhappy broken
music note; uneasy sign/exclamation; grateful star/note; warming rising waves.
Orange only on warming/fire/magic. Keep matching word labels: icons are never the
only explanation. No extra v0.1 assets are blocking; optional background can wait.

## Export rules

Six locked colors only: cream `#EFE3C8`, ink `#2B211C`, forest `#3E5B3A`, red
`#A8432F`, mustard `#D2A23A`, orange `#C4692C`. Flat fills, uniform ink outlines
(3px creatures/props, 4px buildings at native art scale), no gradients, texture,
noise or blur; at most one sparse hatch cluster, never across faces. Transparent
canvas for everything **except the intentionally opaque seamless ground tile**.
Use the separate 25%-ink down-right shadow; never bake a second one into a prop.

Aim **<5 KB per creature/prop**, **<2 KB per icon/tile**, optional background
<30 KB. No embedded raster images, external links/fonts, scripts or foreignObject.
Use system serif text in the game, not SVG text. Keep all creature frame sizes
and pivots identical. Missing/empty sprite maps remain fully playable shapes;
the offline build embeds present files as data URIs and drops missing requests.
