# Hut work refactor

The hut branches of `doWork` in [sim.js](../src/sim.js) delegate to three private helpers:

- `improveHouseholdHut`: applies the existing recipe checks, pays materials, selects the local hut, fits the improvement and records knowledge.
- `buildHouseholdHut`: preserves site selection, paid project progress, tree clearing and construction work.
- `finishHutConstruction`: repairs the existing structure or completes a new house, retaining bonfire ownership and household relocation.

The helpers stay in the simulation module because they use its private craft selection, discovery and logging functions. This introduces no public API, new dependency or import cycle. The existing dispatcher remains responsible for journeys, need-related work costs, coordination and the shared final action record.

The two work helpers return whether the dispatcher should append its normal action record. Clearing writes its own action and returns false; blocked or unaffordable work also returns false. Preserve these exits to avoid duplicate work records or accidental material spending. Recipe payment and completion/discovery order are unchanged.

This is a focused extraction, not a rewrite of the complete simulation. Scenario revision22, quarter-size winter meals, existing saves, construction prerequisites and decision rules remain unchanged.

Validation: all619 local tests pass, including three new heating contracts. The new contracts also pass against the published pre-refactor code. Complete states and daily reports match the frozen published revision22 mechanics for seeds60/61 through day1000, plus40 days of the existing117-person saved world (2040 compared days). Both arms pass save replay. Four isolated browser cases pass offline/module startup, desktop/phone/ultrawide behavior and save resume. Measured step time is comparable; these timings are diagnostic rather than a performance benchmark.

The detailed comparison script and reports remain in the local review workspace under `scripts/verify-housing-refactor.mjs` and `reports/refactor-housing-*`. The existing published commit `39caeb2` is the pre-refactor checkpoint. This refactor is developed on `codex/refactor-hut-construction`; publication is a separate action.
