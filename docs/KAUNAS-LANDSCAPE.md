# Kaunas-inspired woodland and waterways

The scene uses a stylized Nemunas with the Neris entering from the north.
Neither its normalized coordinates nor the sizes of individual props are a
survey map. The game has no specified prehistoric year, and this is an informed
landscape illustration rather than an exact reconstruction of one ancient site.

## Water depth and historical limits

The Lithuanian Inland Waterways Authority lists a guaranteed navigation-channel
depth of 1.20 m for the Neris mouth–Kaunas Castle route and the Kaunas–Jurbarkas
Nemunas route. Those are modern navigation-channel specifications, not the depth
of every bank, shoal or historical crossing.
[Authority route descriptions](https://vvkd.lt/en/inland-waterways/).

Direct Neris cross-section research found an average depth of 0.94 m and a
maximum of 1.55 m at the Jonava monitoring profile during the studied 1977–2009
period. The same research describes changing islands, secondary channels and
flood regimes. Jonava is not the Kaunas confluence, and station water-level
changes are not equivalent to water depth everywhere.
[Baubinienė, 2025](https://kirj.ee/wp-content/plugins/kirj/pub/earth-2-2025-133-144_20250908093531.pdf).

The Nemunas was dammed near Kaunas in 1959, creating the reservoir. Modern
regulated conditions cannot simply be projected into the Stone Age.
[Ignitis Gamyba](https://ignitisgamyba.lt/en/our-activities/electricity-generation/kaunas-hydro-power-plant-khpp/4187).
No verified Stone Age bathymetry or exact ford at the game's chosen crossing
was found in these sources. Shoals do not establish a safely fordable route
across an entire channel. We should not describe the northern river as a small
creek that can be crossed anywhere.

The game's existing marked fords remain an explicit gameplay approximation.
Its crossing system is not a reconstruction of a documented ancient ford or
a depth/current simulation. Bridges and the game's frozen state are separate
crossing cases; boats and swimming are not implemented. Wading now moves at
55% of ordinary walking speed, with submerged lower legs and ripples on both
waterways. A built bridge keeps walkers dry. These are presentation changes;
they do not introduce drowning deaths or alter daily needs and food rules.

## Woodland interpretation

Pollen-based research at Petrešiūnai in northeast Lithuania records mixed
temperate broadleaf woodland, including elm, lime and oak, in the Middle
Holocene. That supports a more wooded regional interpretation, but does not
prove exact species percentages at prehistoric Kaunas.
[Petrešiūnai vegetation reconstruction](https://www.sciencedirect.com/science/article/abs/pii/S1040618218301903).
Modern Lithuanian forest-inventory research also provides context for native
pine, birch and alder mixtures and variation among sites.
[National forest-inventory study](https://pmc.ncbi.nlm.nih.gov/articles/PMC11901581/).

The renderer therefore uses connected patches of mixed broadleaf woodland,
birches and pines on drier ground, with alder/willow forms near moist margins,
reeds and damp ground textures. This is a qualitative habitat interpretation,
not a literal pollen reconstruction. Pines stay green through winter while
deciduous trees lose their leaves. Meadow gaps, housing sites, camp centers,
food storage and farming space remain visible and usable.

New harvestable trees are appended after the previous forest array. Earlier
tree coordinates and saved stump IDs are retained. Formerly reserved housing
plots now receive trees too, appended after all earlier IDs. Builders clear
obstructions through actual work; the renderer never hides a tree for a new
project. Loading an older save preserves the ground already occupied by its
built houses and frames through a one-time stump migration. Randomness for
the vegetation is seed-local and does not
consume the village's weather or personality dice. This landscape change can
affect timber availability; older survival reports retain their original source
hashes and do not establish survival rates for this version.

`tests/ecology.test.js` checks deterministic denser woodland, water/camp buffers,
saved tree identities, shelter clearings and wading/bridge/ice movement speeds.

## Small building clearings

House builders cut one obstructing tree per workday before starting the frame.
An adult needs an existing usable hand axe or hafted tool; its earlier craft
prerequisites still apply, and four cuts require axe repair. Each cut provides
the normal finite-stock timber yield and costs the ordinary workday's energy.
No construction materials or frame progress are spent on that clearing day.
Qualified, adequately supplied builders can help the healer with this work.

The ordinary hut patch has radii 26 by 24 map units; the herb hut patch has
radii 34 by 30 to allow its workspace. These are small ellipses around the
chosen house, not forest-wide clearing orders. Trees beyond them remain.
Camp centers, food storage and established farming areas retain their earlier
natural openings. Food, warmth, health and recovery still interrupt a project.

Cut stumps persist inside houses and unfinished projects, even after a builder
dies. Dismantling or removing a project releases its patch: saplings resume
growing, with the normal 30-day regrowth period rather than appearing mature
overnight. Clearing progress, timber, tool wear and regrowth survive saves.
`tests/site-clearing.test.js` covers these physical work and priority rules.
