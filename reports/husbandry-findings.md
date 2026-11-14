# Husbandry validation findings

Ten paired fresh worlds, seeds 50–59, six founders, day 1,000 horizon. Each pair uses the same scenario and seed with husbandry disabled/enabled. No god commands, repeated gifts or immigration. Extinct worlds count as population zero. Headless runs exclude presentation-triggered river accidents.

| Measure | Husbandry disabled | Husbandry enabled |
| --- | ---: | ---: |
| Mean population | 27.3 | 30.1 |
| Villages alive | 8/10 | 10/10 |

Within the enabled runs: **7/10 acquired livestock**, **4/10 recorded livestock births**, and **2/10 still had a living herd at day 1,000**. Sheep were the common first species; one seed reached five pigs. No fresh run acquired cattle or produced dairy by day 1,000; one produced fleece.

The paired mean population change was 2.8, with an exploratory 95% paired bootstrap interval of -6.4 to 13.8. This small sample does not establish a statistically reliable population improvement. Survival counts are observed results, not calibrated ending probabilities or evidence of permanent survival.

| Seed | Baseline population | Husbandry population | Animals acquired | Animal births | Animals alive at 1,000 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 50 | 45 | 23 | 2 | 0 | 2 |
| 51 | 23 | 12 | 2 | 0 | 0 |
| 52 | 37 | 34 | 4 | 0 | 0 |
| 53 | 20 | 33 | 0 | 0 | 0 |
| 54 | 43 | 38 | 4 | 2 | 0 |
| 55 | 30 | 31 | 4 | 1 | 2 |
| 56 | 39 | 42 | 0 | 0 | 0 |
| 57 | 0 | 42 | 2 | 1 | 0 |
| 58 | 36 | 33 | 6 | 3 | 0 |
| 59 | 0 | 13 | 0 | 0 | 0 |

## What the failures mean

Initial husbandry is a fragile investment. Food shortages can force villagers to eat breeding stock; insufficient winter feed, water or care can destroy a herd. Acquiring animals alone does not imply a sustainable pastoral economy. Cattle and the dairy/textile chain remain later, conditional developments under these defaults.

The new scenario file exposes the relevant controls for future comparisons: food/seed security, resource productivity, learning, acquisition price, herd demand, winter margins, pasture/hay regrowth and animal risks. Increasing opportunities alone does not remove these constraints.

## Controlled integration

A separately labelled established-world fixture ran for 600 days with abundant initial supplies, prior basic knowledge/objects, normal weather, no general spoilage/illness, and a larger herd target. It produced 10 animal births, 110 milk, 27 curd portions, 18 fleece, 5 cloth and 2 completed wool wraps; 1 animal received a completed wooden yoke. These results exercise the product chains and care logic, not fresh-world odds. Field traction is separately covered by a paid-field-work regression test.

## Artifacts

- Full paired data and settings/source fingerprints: `reports/husbandry-final-verified.json`.
- Controlled fixture and explicit overrides: `reports/husbandry-established-integration.json`.
- Tests: `reports/husbandry-release-tests.txt`.
- Implementation details: `reports/husbandry-implementation.md`.
- Editable rules: `src/scenario.js`; guide: `SCENARIO_GUIDE.md`.

Settings SHA-256: 9384c5a90b3e91d457b66d36f441bdc2094ec61bcc74ac5725a084e13d6940f8.
