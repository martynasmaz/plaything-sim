# Development and population growth — local results

All four requested changes are implemented locally: paid field expansion, seasonal food planning, work habits and apprenticeships, and earlier housing/family opportunities. No publishing, immigration, free population, accelerated births or earlier wheat unlock was used.

## Independent day-1,000 check

The final version was frozen before evaluating **100 validation seeds, 50–149**. The original **50 seeds, 0–49**, were evaluated separately. All worlds start with six founders; extinct villages count as zero. The seasonal check averages days 921–1,000, a full 80-day game year.

| Comparison | Earlier population | New population | Difference | Paired bootstrap 95% interval |
| --- | ---: | ---: | ---: | --- |
| Original 50: day 1,000 | 14.56 | 25.24 | 10.68 | 6.06 to 15.30 |
| Original 50: final full year | 14.45 | 25.57 | 11.11 | 6.61 to 15.59 |
| Fresh 100: day 1,000 | 14.25 | 24.96 | 10.71 | 7.13 to 14.27 |
| Fresh 100: final full year | 14.33 | 25.74 | 11.41 | 8.07 to 14.79 |

Across the fresh seeds, **59/100 → 81/100** villages are alive at day 1,000. Median population across all worlds is **17.5 → 31**. There are 72 higher-population seeds, 19 lower-population seeds and 9 ties. Individual failures remain possible; this is not a guarantee of permanent survival or continual growth beyond the tested horizon.

The intervals use 100,000 paired percentile-bootstrap samples of the same seeds. They describe uncertainty under seed resampling. The original ten seeds were used for development pilots; validation results were not used to select the final simulation rules. The changes are tested together here, so this table does not isolate their individual contributions.

## Individual-feature checks

The final rules were also exercised with each feature enabled separately on the original ten seeds. These small component runs are diagnostic, rather than independent confirmation. The no-feature control reproduces the baseline. Several changes do poorly in isolation: expanding productive capacity, preserving the harvest, staffing work and supporting households need to function together. This does not establish that every individual change has a positive effect in every village.

| Enabled feature | Day-1,000 mean | Final full-year mean | Alive / 10 |
| --- | ---: | ---: | ---: |
| control | 15.20 | 13.99 | 6 |
| fields | 12.90 | 14.79 | 5 |
| planning | 10.90 | 12.85 | 6 |
| roles | 15.50 | 14.26 | 6 |
| families | 10.90 | 10.14 | 4 |
| Combined, same ten seeds | 27.60 | 27.34 | 8 |

## How growth is paid for

- **More land:** farmers can discover field layout after garden harvests, a digging tool, personal field and wood-working experience, and experience of a winter. They make physical markers from wood/fibre, clear only trees rooted inside a small plot, pay a further wood cost and complete three preparation workdays. The finished field remains empty until somebody spends seed and plants it. Demand follows the population, bounded by the available field area. Unfinished projects and completed fields persist after deaths and reloads.
- **Seasonal reserves:** the village retains its founding food buffer, then uses winter experience to plan food and fuel. Grain/flour processing uses actual storage capacity. A preserver can reserve a workday and handle the real surplus after gatherers return. Rack construction requires two workdays and three wood/one fibre; processing spends fuel and transfers whole existing provisions into drying racks. No food is created by moving it into storage.
- **Regular work:** work habits reflect repeated actual jobs over the last 20 days, with persistence rather than instant reassignment. Experienced millers/bakers act early enough to support paid practical apprenticeships; farmers harvest ripe food before sowing more. Toolmakers and textile/pottery workers get appropriate recurring work. Needs, illness and exhaustion can always interrupt work. A role itself grants no skill, product or building.
- **Families and housing:** after the village has winter experience, housing planning includes a spare household and approaching adulthood. Eligible unrelated adults can spend real workdays meeting and forming a household, with paid neighboring-camp visits when local partners are unavailable. Recent hunger still blocks births. A temporary investment-related decline in stores can be tolerated only with a substantial accessible reserve; an ordinary ongoing food deficit still blocks expansion of a family.

Among surviving validation villages, mean cultivated area is **21.77 plots**, compared with the earlier fixed four. Their mean available finished-food reserve is **6.56 provisions per resident** at the checkpoint. This stock ratio is not a measure of lifetime production or exact nutrition-adjusted days.

Mean available finished food across all validation worlds is **91.51 → 144.95 provisions**, with extinct settlements counted as zero. Grain and flour are excluded from that finished-food figure. The population gain is accompanied by larger usable reserves, rather than coming solely from a change to reproduction checks.

The share of recorded actions spent on crafts, construction and lessons is **2.69% → 2.84%** in the validation comparison. It includes supporting infrastructure and is normalized by recorded actions, not adult labor hours. The new version records **14043 actual supervised milling/baking workdays**. Old worlds did specialist work without having the new role labels; their missing role metadata is not counted as an absence of professions.

The increase in craft/construction/lesson share is modest. Most recurring work roles still support food production, so these results demonstrate a substantial population gain and a functioning food economy, rather than a mature economy dominated by non-food specialists. Winter mortality remains a useful next development target.

New role labels among living validation villagers: fisher 126, farmer 524, builder 3, healer 53, miller 24, baker 46, hunter 54, teacher 14.

## Verification and limits

- 305 automated tests passed, including recipe/material prerequisites, paid projects, tight tree-clearing boundaries, persistence after death/save, whole nonnegative food accounting, storage capacity, physiological interruptions, harvest priority, conditional birth planning, and unchanged founding priorities before winter experience.
- Native Canvas checks render expanded fields and incomplete racks at phone/desktop sizes without changing the world. The single-file offline build is parsed as JavaScript. A full browser HTML/CSS screenshot review is not claimed.
- Nightly random draws, base fertility, family recovery intervals and wheat timing remain unchanged. Weather can still cause bad harvests; the maps and resources remain finite.
- Headless daily runs do not render walkers and therefore exclude presentation-triggered river falls. No god actions or magic unlocks were applied.
- Early pilots exposed overly early specialization and a fractional-preservation bug. Those pilots were excluded from the final comparison. Final runs assert every day that communal provisions and private caches are whole and nonnegative, along with population conservation.

Audited simulation snapshot: file:///C:/Users/mrmar/OneDrive/Documents/Game/reports/growth-final-priorities-source-20261114/. SHA-256: 398ddbfb5a2b9dbeec6fadbb0048f3ce0897070b328e6b2e461136b068124de3. Baseline SHA-256: 6862ec9b5495ab1a6eb3ffa66fef62084bb57c88268151a4dd432be89dba62bd.

Raw outputs: growth-matched-final-50-20261114.json and growth-validation-final-100-20261114.json. The previous reports are preserved separately.
