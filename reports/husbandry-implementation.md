# Animal husbandry and editable scenarios

This version is local. No commit, push or deployment was performed.

## The settings file

Edit `src/scenario.js`. The companion `SCENARIO_GUIDE.md` explains the controls, examples, probability units, seed selection and save behavior. Validate with `npm run scenario:check`, then rebuild the offline game with `npm run build`. Reload the local game to apply it.

The file controls starting people/supplies, day and season duration, human lifespan, needs, birth conditions, illness, learning, resource abundance, spoilage, household infrastructure, development features, climate modifiers, wildlife, inspiration, river mortality, cereal progression, field expansion and husbandry. Livestock controls include opportunity probabilities, prerequisites, feed/meadow productivity, construction, species biology, products and risks.

`defaultSeed: null` gives random new worlds. Set it to an integer for a fixed default. An explicit `?seed=123` URL wins and starts fresh; an existing save continues its own seed. The same settings and seed reproduce the same fresh run. Observe shows the scenario name/revision. Report scripts record the complete scenario and settings/source fingerprints.

Initial supplies/population affect new worlds only. Most other edits affect future days in existing saves. Existing discoveries and objects are retained. New worlds are recommended when changing calendars, age limits, capacities, crop timing or construction/recipe proportions.

## Progression

1. An eligible villager spends real workdays and packed meals visiting an initially undiscovered pastoral household beyond the explored valley.
2. Personal observation, gathering experience and the village's winter experience make husbandry study possible. Knowledge still requires the normal recipe prerequisites, materials, experiments or actual teaching.
3. A volunteer learns cordage/enclosure construction, collects materials and clears only the small building footprint. Enclosures and roofs are persistent projects with paid stages.
4. Villagers cut a separate finite hay meadow, dry bundles and prepare actual winter feed before acquiring animals.
5. A paid exchange transfers identifiable animals out of the distant household's finite herd. It does not spawn replacements. Buyers select unrelated pairs; the seller retains a viable breeding pair. Pregnant/nursing mothers are not offered.
6. Care, breeding, dairy, fleece, manure, clothing and cattle traction develop through separate practices. High opportunity odds cannot bypass missing infrastructure or experience.

The distant household is a background stock-and-fodder model, not a second fully simulated human settlement. Its herd ages, breeds and consumes finite forage/stored feed; it has no automatic trade-restock timer. Local villagers, their labor and their households remain the primary simulation.

## Animals

Each animal has an ID, species, sex, age, origin, condition, health, owner, keeper, parental IDs, location and living/dead/escaped status. Pregnancy, lactation, fleece collection, illness and yoke training are recorded individually. Death and slaughter retain ancestry records.

The current default four-season year is 80 game days. These are compressed game biology rules, not a claim that actual domestication or human development took these times.

| Species | Adult age | Gestation | Minimum birth interval | Feed/space units | Full-size meat |
| --- | ---: | ---: | ---: | ---: | ---: |
| Sheep | 64 days | 32 days | 80 days | 1 / 1 | 12 portions |
| Pig | 48 days | 24 days | 52 days | 1.2 / 1 | 18 portions |
| Cattle | 160 days | 56 days | 100 days | 3 / 3 | 40 portions |

Young animals require nursing before weaning. Milk available to people is reduced while a mother nurses. Lactation requires a birth and adequate feeding; it does not run indefinitely. Parent/offspring and full/half-sibling pairings are rejected. This is a basic close-family rule, not a full population-genetics simulation.

Breeding also checks adulthood, condition, health, recent feeding, season, space, existing pregnancies and intervals between births. Already conceived offspring are not erased when space later becomes tight. Herd targets depend on the local human population. Additional unrelated breeding stock can be acquired when needed and available.

## Paid infrastructure and products

| Item/practice | Current default |
| --- | --- |
| Enclosure | 6 wood + 3 fibre; 4 workdays, plus actual tree clearing |
| Livestock shelter | 8 wood + 4 fibre + 1 hide; 5 workdays |
| Winter hay | Cut 8 feed units from the hay meadow; 3 dry days; prolonged wet bundles spoil |
| Milk | Collect from healthy, fed, lactating mothers into an existing vessel; tending and milking can share one paid care day |
| Heated milk | 2 milk + 1 wood at a lit hearth become 2 food portions |
| Sour-milk curds | 4 milk + 1 wood become 3 finished food portions; served through the normal meal system |
| Fleece | A modest, limited spring/summer collection from adult sheep, not continuous wool production |
| Yarn | 2 fleece become 2 yarn with personal wool-spinning knowledge and a real spindle |
| Cloth | 2 yarn become 1 cloth with personal weaving knowledge and a real loom |
| Wool wrap | 2 cloth + 1 bone + 1 fibre; a completed garment provides 3 warmth and is visibly worn |
| Compost | 4 actual manure become 2 compost after a season; application uses a workday and benefits two harvests |
| Cattle yoke | Adult male cattle, existing tools/cordage and experienced training; 4 workdays, 4 wood and 4 fibre |

Yoked, healthy, fed cattle can contribute an additional work unit when their trained handler prepares a new field. They do not create fields or seed. Construction costs are distributed across paid stages, and unfinished projects remain after death.

## Decisions, food and succession

- Personal hunger, cold, illness and exhaustion can interrupt nonessential husbandry. A physically capable hungry villager can slaughter for emergency food rather than being barred because they are hungry.
- Essential care is planned before optional projects. The last available keeper is protected from teaching bookings, and migrations/outpost departures must leave a trained caretaker.
- A routine care day and one additional planned husbandry workday may occur in a camp. This avoids an entire village simultaneously chasing the same project. A selected apprentice can learn through actual paired care with materials and personal prerequisites.
- Sheep/cattle graze available pasture without needing a person to tell them to eat. Water, winter fodder and woodland pig forage still require care. Pasture and the hay meadow have separate finite stocks/regrowth.
- Pig grain comes from surplus beyond the human/seed reserve. Pigs cannot eat hay. Winter feeding does not rely on summer mast being accessible.
- Winter hay targets account for the combined herd across camps. Additional stock is required before acquiring more ruminants.
- Milk expires by individual batch. Curds are counted once in the finished-food ledger and birth-food checks, and consumed once at meals. Preparing, serving and slaughtering do not duplicate food.
- Knowledge, ownership and buildings are separate. A successor may inherit animals and a pen without gaining husbandry skills. Practical teaching supplies those skills.
- Animals can suffer illness, neglected water/feed, winter exposure, escape and predation. Damaged fences require materials and repair work. Poorly controlled animals can damage planted crops.

## Observation and visuals

Observe contains a livestock section with living/lost animals, parent/offspring navigation, owner/caretaker, health, condition, pregnancy/lactation, feeding, enclosure progress and winter feed estimates. Resource discovery remains persistent even if an item is immediately processed or consumed.

The encyclopedia includes husbandry practices, animal groups, products, shelters and yokes. Collection progress follows actual work and existing objects. Learning a practice alone does not create a building or animal.

The map draws sheep, pigs, cattle and young animals, grazing/following movement, construction stages, hay bundles and compost heaps. Hover/tap details use the corner card. Milking vessels, carried hay, wool work and completed wool garments are visible. Rendering does not breed, feed, construct or consume resources.

## Validation and practical limits

- Full automated regression suite: see `reports/husbandry-release-tests.txt`.
- Phone, desktop and ultrawide render checks; encyclopedia drawings; offline bundle parsing; draw-time state immutability: `scripts/husbandry-render-smoke.mjs`.
- Ten matched fresh seeds 50–59 through day 1,000, comparing husbandry disabled/enabled: `reports/husbandry-final-verified.json`. All worlds, including extinctions, are included. No god commands or repeated gifts are used. River falls are presentation-triggered and excluded from these headless runs.
- A separate 600-day established-world fixture exercises all product chains and cattle training: `reports/husbandry-established-integration.json`. It deliberately supplies earlier infrastructure, basic experience, initial food/feed, normal weather and a larger herd target. It is an integration test, not evidence of fresh-world adoption odds.

The fresh runs show that husbandry can be adopted and breeding can occur, but the first millennium remains fragile. Do not interpret a small ten-seed result as permanent survival or proof that every species/dairy/textile chain is reached naturally by day 1,000. Cattle are deliberately expensive and later developments are conditional. The scenario file exposes the relevant levers for future balance experiments.
