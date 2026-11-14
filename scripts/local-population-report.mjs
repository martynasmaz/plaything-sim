import {readFileSync,writeFileSync} from 'node:fs';
const read=name=>JSON.parse(readFileSync(new URL('../reports/'+name,import.meta.url)));
const before=read('population-wheat-sustainability-50-20261114.json'),after=read('population-local-final-50-20261114.json');
const casesBefore=read('sustainability-before-weather-10-20261114.json'),casesAfter=read('sustainability-local-final-10-20261114.json');
const sum=(rows,key)=>rows.reduce((n,r)=>n+(r[key]||0),0);
function interval(k,n){const z=1.96,p=k/n,d=1+z*z/n,mid=(p+z*z/(2*n))/d,half=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d;return ((mid-half)*100).toFixed(1)+'–'+((mid+half)*100).toFixed(1)+'%';}
const rows=after.runs.map(r=>{const b=before.runs.find(p=>p.seed===r.seed);return '| '+[r.seed,b.population_final,r.population_final,r.observed_day,r.births,r.hunger_deaths,r.ending].join(' | ')+' |';});
const beforeHungry=sum(casesBefore.runs,'rawFoodHungerDays'),afterHungry=sum(casesAfter.runs,'rawFoodHungerDays');
const winter=a=>a.runs.reduce((n,r)=>n+r.seasons.Winter.hungerDeaths,0);
const winterDays=a=>a.runs.reduce((n,r)=>n+(r.seasons.Winter.personDays||r.seasons.Winter.exposure),0);
const hungerTotal=a=>a.runs.reduce((n,r)=>n+Object.values(r.seasons).reduce((total,p)=>total+p.hungerDeaths,0),0);
const won=after.runs.filter(r=>r.population_final>0&&!before.runs.find(b=>b.seed===r.seed).population_final).length;
const lost=after.runs.filter(r=>!r.population_final&&before.runs.find(b=>b.seed===r.seed).population_final>0).length;
const risk=after.runs.filter(r=>r.ending==='at_risk').map(r=>'seed '+r.seed+' ('+r.population_final+' people; last birth day '+r.last_birth_day+'; no viable future unrelated pair)').join(', ');
const md=`# Population growth and sustainability — local version, 14 November 2026

The local version improves survival to day 3,000 from **9/50 (18%) to 25/50 (50%)**. Half the villages still become extinct; this has not yet reached the desired balance where most villages persist. Reaching day 3,000 does not demonstrate indefinite sustainability.

## Method

The exact same seeds 0–49, six initial founders, hands-off, magic disabled, maximum 3,000 days, with no restarts or discarded outcomes. The earlier wheat-version results remain unchanged in [baseline data](population-wheat-sustainability-50-20261114.json). The [new data](population-local-final-50-20261114.json) and [CSV](population-local-final-50-20261114.csv) record every ending. The original ten seeds also have [before](sustainability-before-weather-10-20261114.json) and [after](sustainability-local-final-10-20261114.json) detailed food/knowledge audits from immutable source snapshots.

New run decision-source SHA-256: ${after.sourceSha256}. Detailed audit snapshot: ${casesAfter.sourceSha256}.

This is a combined update: regional weather, food-processing learning, crop mix, hunting interception, observation, new-arrival initialization and occasional inspiration are all included. It does not isolate which individual change caused each outcome. The same nightly dice sequence is preserved, but the climate interpretation changes the conditions. Headless daily runs do not include presentation-triggered river accidents or any god actions. Fifty sequential seeds are a limited sample, not a guaranteed probability for every world; intervals below are descriptive Wilson 95% intervals under a binomial model.

## Ending estimates

| Ending at day 3,000 | Runs | Observed share | Approx. interval |
| --- | ---: | ---: | ---: |
| Extinct | 25 | 50% | ${interval(25,50)} |
| Continuing | 24 | 48% | ${interval(24,50)} |
| At risk | 1 | 2% | ${interval(1,50)} |
| Recovering, fewer than six people | 0 | 0% | ${interval(0,50)} |

“Continuing” means alive, a birth in the last 300 days and a viable future unrelated reproductive pair. It is not a promise of permanent survival. “At risk” means no such future pair or no recent birth; the affected run is ${risk}. “Recovering” uses the same continuing criteria but ends below the founding population.

| Measure | Earlier version | Local version |
| --- | ---: | ---: |
| Alive at day 1,000 | ${before.current.survivedDay1000}/50 | ${after.current.survivedDay1000}/50 |
| Alive at day 3,000 | ${before.current.survived}/50 | ${after.current.survived}/50 |
| Mean peak population | ${before.current.meanPeak} | ${after.current.meanPeak} |
| Births, all runs combined | ${before.current.births} | ${after.current.births} |
| Hunger-involving deaths, all runs combined | ${before.current.hungerDeaths} | ${after.current.hungerDeaths} |
| Old-age-involving deaths | ${before.current.oldAgeDeaths} | ${after.current.oldAgeDeaths} |

The earlier survival estimate was 18% (${interval(9,50)}); the local estimate is 50% (${interval(25,50)}). There are ${won} newly surviving seeds, ${lost} previously surviving seeds that now die, and four that survive both versions. This is not an across-the-board improvement for every particular seed. More births and absolute deaths partly reflect the longer combined lifetime of the new villages; absolute deaths alone do not measure individual risk.

## Findings from the same ten detailed seeds

1. **The grain-processing handoff was a real bottleneck.** Earlier, operating a quern required personally knowing how to construct it. The building could remain while its last knowledgeable maker died, leaving later villagers unable to process their grain. Milling now has separate operational prerequisites, and supervised production pays for the actual ingredients and pupil's work. Days with hunger while usable raw grain/flour remained fell from **${beforeHungry} to ${afterHungry}** across the ten runs (${(100*(1-afterHungry/beforeHungry)).toFixed(1)}% fewer). These are summed village-days with at least eight grain or four flour, not individual hungry days.
2. **A cereal monoculture was too fragile.** The earlier growers could replace every bed with slow-maturing wheat before a reliable processing chain existed. The local version preserves kitchen gardens and limits initial wheat beds. Bread production across the ten runs rose from **${sum(casesBefore.runs,'bread')} to ${sum(casesAfter.runs,'bread')} portions**. This is observed combined behavior, not proof that the crop-mix change alone caused the increase.
3. **Winter remains dangerous.** ${winter(casesAfter)} of the ${hungerTotal(casesAfter)} hunger-involving deaths in the ten-run comparison occurred in winter. Winter hunger-death rates fell from ${(1000*winter(casesBefore)/winterDays(casesBefore)).toFixed(2)} to ${(1000*winter(casesAfter)/winterDays(casesAfter)).toFixed(2)} per 1,000 winter villager-days, but the remaining seasonal loss is substantial. More storage capacity helps only if villagers actually fill it from genuine surplus before winter.
4. **Some villages die demographically with food left.** In the detailed rerun, seeds 4, 5 and 8 ended with edible reserves after small reproductive cohorts failed to replace themselves. The 50-run table includes several villages with only four to ten lifetime births and no hunger deaths. Moving between camps helps contacts, but those camps share the same original founding population; visits do not create unrelated outsiders.
5. **Early survival barely changes, while later survival improves.** The day-1,000 count rises only from 31 to 32, while the day-3,000 count rises from 9 to 25. The later food-processing chain helps the villages that establish it. It does not rescue every small founding community.
6. **Hunting already happened, but interception underestimated reachable animals.** Across the controlled ten audits, deer-tracking actions rose from 3,386 to 3,637 (the runs also have different total exposure). In a separate controlled reach check with six healthy bow-equipped adults and 300 independent normal-weather days, both versions attempted 70 passing-deer hunts: the earlier timing allowed 26 catches, the corrected timing 44. That fixture tests interception, not natural equipment uptake or survival odds. Deer supplies existing food provisions, with a small confidence benefit; no protein multiplier or free food was added.

## Restrained next recommendations

- Use day **1,000 as the first development checkpoint** next time. In the current runs 32/50 villages are still alive then; their median population is 24, mean 22.75 and maximum 33, versus a median of 18 in the earlier survivors. Measure accessible finished-food reserve days across seasons, the fraction of work spent securing food, and sustained non-food occupations alongside headcount.
- Allow **paid field expansion**. Cultivated land currently remains fixed at four plots, so food production cannot scale freely with an established population. Experienced farmers could clear modest new patches, acquire seed, plant and maintain them using real work and materials. Dependable surplus should then support more regular millers, bakers, builders, healers and teachers. This expansion is a recommendation, not an implemented feature of the measured version.
- Make autumn decisions compare **accessible finished reserves with expected winter consumption**, and favour filling existing drying racks while there is real surplus. Reserve enough meals for today and enough wood to keep the hearth alive; no automatic grain-to-food conversion.
- Improve **early household and family planning**: begin affordable housing before the first cohort is blocked, and encourage encounters between available unrelated adults while multiple founding lineages are still fertile. Do not relax close-kin restrictions or create births without eligible parents.
- Consider a **rare, conditional outsider visit** to a shrinking but habitable village, using an actual journey, rations and social contact. It could introduce an unrelated adult without guaranteeing rescue every run. This is a proposal; automatic outsider arrivals have not been added.
- Keep operational teaching tied to useful work and spread key food skills across more than one living practitioner. Preserve failure and occasional knowledge loss; test each further change separately on the same seeds before combining it.

## Per-seed outcomes

“Final” is the population at extinction or day 3,000. All extinct runs end at zero.

| Seed | Earlier final | Local final | Last day | Births | Hunger deaths | Local ending |
| ---: | ---: | ---: | ---: | ---: | ---: | --- |
${rows.join('\n')}
`;
writeFileSync(new URL('../reports/population-local-comparison-20261114.md',import.meta.url),md);
console.log('Wrote population-local-comparison-20261114.md');
