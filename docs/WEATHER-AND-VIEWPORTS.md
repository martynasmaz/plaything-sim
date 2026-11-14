# Storms and consistent drawing proportions

Rain in the clearing uses moving bands anchored to the map. Camera movement
and zoom reveal different parts of the same bands rather than starting a new
screen-wide rain pattern. Seeded visual hashes place the bands and droplets;
no simulation dice, world state or saves are changed by drawing them.

Heavy patches have wind-driven streaks in three depth layers, ground splashes,
water ripples and soft cloud shadows. Clear gaps remain between bands. The
clouds darken the scenery transparently rather than covering houses with solid
sprites. Rain particle work is capped by the visible screen area for phones;
zooming out shortens the streaks and reveals the storm's geographic pattern.
Existing winter precipitation remains snow. These are visual changes to the
existing weather rules, not new regional crop, flood or health mechanics.

Household huts use one shared local renderer and a uniform scale on phone,
desktop and ultrawide displays. Round and dome huts have curved bases and roof
eaves expressing their circular footprint in the village's oblique view.
Other learned roof shapes keep their individual designs. Drawing does not
change the saved building, capacity, materials, ownership or construction.
Circular ground patches also use a single radius; they previously used separate
percentages of viewport width and height and became wide ovals on wide monitors.

The compact day/time backing now appears on desktop as well as phone. Its
screen-sized lettering stays independent of map zoom and the viewport shape.

`scripts/weather-render-smoke.mjs` renders the real clearing with controlled
built-world fixtures at phone, desktop and 3440×1440 ultrawide sizes. It checks
the actual round-hut transform and base proportions, verifies rain bands move
and have dry gaps, verifies drawing leaves the world untouched, and parses the
offline build. Zoomed-out previews show the spatial bands. These native Canvas
checks do not claim a real browser/device performance test.
