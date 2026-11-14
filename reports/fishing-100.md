# Fishing adoption in the current local version

100 hands-off villages, seeds 0–99, observed until extinction or day 1,000.
All simulation rules were left unchanged, including the needs hierarchy.
The source hash matches the completed survival batch, and the populations at
day 1,000 match that batch for all 100 seeds.

## Results

- All 100 villages took up fishing. The median first fishing day was day 9.
- Of 5,694 villagers observed for at least 20 adult days, 2,388 (41.9%) fished
  at least once and 2,070 (36.4%) became regular fishers.
- A regular fisher completed at least five fishing workdays within a rolling
  20-day window. This measures repeated behavior rather than merely owning a trap.
- 1,805 regular fishers were born in the village, so adoption continued after
  the founders. Of all regular fishers, 1,648 had observed fishing as children.
  This is an observed association, not a controlled test of teaching's effect.
- Main fishing work produced 243,847 food; weekly trap checks added 8,341.
  Together they supplied 252,188 of 1,744,010 tracked food, or **14.5%**.
- Fishing produced an average of **2.59 food per observed village-day**.
  All 67,226 main fishing actions caught at least some food.

Average activity among villages still alive at each checkpoint:

| Day | Living villages | Population | Trap owners | Fished in last 20 days | Regular in last 20 days |
| --- | ---: | ---: | ---: | ---: | ---: |
| 100 | 100 | 9.55 | 2.33 | 2.14 | 0.82 |
| 300 | 100 | 16.62 | 3.24 | 2.98 | 1.44 |
| 1,000 | 90 | 15.90 | 2.99 | 2.77 | 1.29 |

At day 1,000, 88 of 90 surviving villages had someone fish in the last 20 days;
74 had at least one regular fisher. Regular recent fishers were 9.1% of living
adults. The lifetime adoption percentage is higher because the role changes
hands across generations and people can alternate fishing with other work.

## Interpretation and limits

Fishing is already a recurring food source, typically practiced by a few
villagers at a time. The simulation aims for roughly one trap owner per six
residents. The shared fish deposit replenishes three food per day under the
current abundance setting, so assigning more fishers alone would have limited
scope to increase sustained production. Flooding, frozen water, illness,
warmth, energy, and competing work also affect when they fish.

The food percentage uses `lastDay.gatheredFood`: main village production,
including weekly chores. Separate eastern-household food is not included in
that counter. There were 277 eastern food-production actions across the batch;
these are counted separately rather than assigned an estimated yield.
No daily fishing action with zero food was counted as a successful catch.
Weekly checks contribute food but do not count as main fishing workdays for
the adoption threshold. Adults with fewer than 20 observed adult days are
excluded from the lifetime adoption denominator to limit end-of-run censoring.

## Reproduce

```powershell
node scripts/fishing-report.mjs 100 1000 fishing-100
```

Outputs: `fishing-100.csv` (villages), `fishing-100-people.csv` (individuals),
`fishing-100-snapshots.csv` (checkpoints), and `fishing-100.json` (summary and
source hash). The report checks that individual food and action counts
reconcile with village totals and refuses to summarize if simulation sources
changed during the run. Nothing was published.
