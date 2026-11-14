# Population growth benchmark

The development target is a higher population distribution across many hands-off worlds, supported by lasting food surplus and regular specialist work. Exact progression dates can be tuned later. A growing selected survivor is not enough: extinct villages count as zero.

The first checkpoint is day 1,000. Compare identical seeds, and also average the last 80 days (one compressed game year) to avoid mistaking a seasonal peak for sustained development.

| Measure | Earlier mean | Local mean | Change | Paired bootstrap 95% interval for change |
| --- | ---: | ---: | ---: | --- |
| day_100 | 10.28 | 10.14 | -0.14 | -1.06 to 0.78 |
| day_300 | 20.56 | 21.22 | 0.66 | -3.28 to 4.60 |
| day_1000 | 10.64 | 14.56 | 3.92 | -0.92 to 8.68 |
| year_ending_day_1000 | 11.33 | 14.45 | 3.12 | -1.39 to 7.60 |
| day_3000 | 3.60 | 12.98 | 9.38 | 4.74 to 13.90 |

At day 1,000, the mean across **all 50 worlds** rises from 10.64 to 14.56 (36.8%). The estimated interval for the difference includes zero: this is promising evidence, but the present 50-seed comparison does not establish a clear increase by that checkpoint. The local mean is higher than the founding population of six; that is a different comparison from improvement over the earlier version.

The aggregate curve also needs attention: early growth is followed by seasonal losses and some extinctions. Higher long-run survival does not establish continual population expansion. Before claiming a robust tuning improvement, validate the population and surplus trend on an additional fixed set of seeds that was not used to choose the changes.

## All-world mean population

| Day | Earlier | Local |
| ---: | ---: | ---: |
| 0 | 6.00 | 6.00 |
| 100 | 10.28 | 10.14 |
| 300 | 20.56 | 21.22 |
| 500 | 15.18 | 15.20 |
| 750 | 11.66 | 14.70 |
| 1000 | 10.64 | 14.56 |
| 1500 | 10.44 | 16.90 |
| 2000 | 4.60 | 11.90 |
| 3000 | 3.60 | 12.98 |

The intervals are descriptive percentile-bootstrap estimates from 100,000 paired resamples of 50 sequential seeds. These seeds are a limited convenience sample, and the update combines several changes. The analysis does not identify the effect of any one feature or guarantee behavior in every world. Full numerical output is in population-growth-statistics-20261114.json.
