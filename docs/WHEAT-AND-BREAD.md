# Wheat, milling and hearth bread

The live homestead keeps its earlier small kitchen gardens. Wheat is a later
crop, acquired through observation and experimentation. Existing saved fields,
finished harvests and learned techniques remain intact.

The earliest wheat experiment is day 360, with six observed Summer/Autumn
seasons, existing garden cultivation, a digging stick, saved grain and an
experienced grower or plant gatherer. This is a pacing choice aiming for useful
cereal food around day 500, not a scheduled unlock or a historical date.
Gathering parties occasionally collect small wild-grain samples from a finite,
seasonal deposit. Turning 500 grants neither knowledge nor supplies.

The individual recipes live in `src/practices.js`; `readyToInvent` also checks
the cross-craft dependencies in `src/farming.js`. A farmer who knows wheat
cultivation can sow one real grain into an empty existing bed. Other beds keep
their previous crop. Wheat needs 24 growth units rather than the garden's six;
winter pauses growth and adverse weather can delay it. A harvest supplies 24
grain, not finished meals. Bounded bone-fertilizer bonuses still apply.

Grain storage is finite: 24 base places, plus capacity from existing jars and
huts. Uncollected grain stays on the ripe plot when storage fills; fertilizer
cannot be claimed again while finishing that harvest. Grinding and flour do
not count as ready-to-eat food in the family reserve check.

After harvesting wheat, a grower can select grinding stones, practice shaping
them with an existing hammer stone, discover saddle-quern making and construct
a quern. Suitable large grinding stones have their own finite quarry deposit;
they are not an unlimited substitute for the valley's depleted small-tool
stone. Collection, practice, research and construction cost separate workdays.
The physical quern belongs to a camp and stays after its builder dies. Knowledge
alone creates no stone equipment.

A miller needs the learned technique and a quern in their own camp. One workday
turns four wheat into four wholemeal flour, leaving at least four grain for the
next sowing. A baker needs milling knowledge, fire tending and a lit local
hearth. A separate workday consumes four flour and one wood to produce eight
flatbread portions in the normal food stores. The fire reserve is protected.
Flour and grain have their own notebook counters; the bread total records
portions actually baked rather than pretending all past bread still exists.

The chosen dependency chain is one gameplay progression, not a claim that
bread historically required established farming everywhere. This version
models coarse hand-milled, unleavened hearth bread; it adds no watermill,
windmill, metal plough, dedicated bakery or automatic oven.

Villagers reconsider needs every day. Cold, illness, exhaustion and urgent
hunger take priority. Known milling and baking are productive food work even
when reserves are low; optional craft projects no longer replace sowing or
harvesting. Existing fields can briefly yield to relevant research and paired
lessons when needs allow. Cereal lessons require prerequisite skills and real
contact, with two completed paired workdays before a new practitioner learns.
No lesson creates a quern, flour or bread.

The map draws the actual wheat beds and completed querns. Milling happens at
the quern, baking at the hearth, and activity chatter uses grain/bread emoji.
Precise stocks and progress remain in the notebook.

## Verification

`tests/wheat.test.js` checks discovery gates, crop and meal accounting, finite
storage, partial harvests, fertilizer, physical querns, seed reserves, urgent
needs, real generational lessons and old/new save continuity. Reference replay
tests remain in the full suite.

`node scripts/wheat-report.mjs` runs seeds 0–9 hands-off to day 1,200 and records
actual sowing, harvest, milling, baking and lesson dates in
`reports/wheat-progression-10-20261114.json`. Its source hash must remain
unchanged during the batch. These are progression measurements, not permanent
survival odds. Earlier population reports describe their archived source
versions, before wheat was added; their percentages must not be presented as
current wheat-version ending probabilities.
