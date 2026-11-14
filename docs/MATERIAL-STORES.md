# Current material uses and gaps

All displayed camp stocks have at least one consuming recipe, but this is not
yet a complete everyday material economy.

| Stock | Existing consumption |
| --- | --- |
| Food | Meals, travel supplies, sowing, food preservation |
| Wood | Hearth fuel, shelters, tools, fishing gear, pottery and charcoal making |
| Stone | Knapping, hafted tools, net sinkers, repairs, herb-hut grinding stone |
| Fibre | Cord, baskets, traps, lines, nets, repairs and herb-hut construction |
| Clay | Clay vessels, jars and kiln improvements |
| Resin | Hafted tools; charms and rites when magic is enabled |
| Hide | Lined bedding |
| Charcoal | Improved kilns; marked bones, divination and wards when magic is enabled |
| Bone | Bone hooks and handlines; practical bone fertilizer; marked casting bones when magic is enabled |
| Bone meal | Delayed, limited soil amendments for individual plots |
| Herbs | Plant-remedy preparation; incense and rites when magic is enabled |

The recipe costs are in `src/practices.js`; actual crafting and experiments
deduct them. Ordinary repair routines in `src/sim.js` also spend stone/fibre.
Not every named weekly maintenance chore consumes a material: several only
increase experience. Some stocks still have relatively narrow
equipment/upgrade uses, so their existence in a recipe does not imply regular
ongoing demand. Hunts add bone without a storage cap. Previously hooks were
its main use and a stockpile of 450 bone exposed that imbalance. The new bone
fertilizer practice provides a recurring practical use once farming and
crushing prerequisites are met; it does not automatically dispose of stock.

There are also parallel stores: some weaving uses `s.fibre` while personal
recipes use `local.stock.fibre`; the camp pottery workshop keeps its own clay,
apart from `local.stock.clay`. The healer's carried/house leaves are separate
from shared herbs used in personal remedy recipes. Thus the displayed stock
does not feed every activity that could plausibly use the material.

The parallel-store and maintenance gaps above remain. Healer construction
reserves physical supplies for its project; bone fertilizer now consumes raw
bones through grinding and application. Optional magical rites have their own
real reagent costs. These changes do not unify the parallel clay/fibre stores.
