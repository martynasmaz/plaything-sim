import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const root=new URL('../reports/',import.meta.url),read=name=>JSON.parse(readFileSync(new URL(name,root)));
const matched=read('growth-matched-final-50-20261114.json'),validation=read('growth-validation-final-100-20261114.json');
const archived=read('population-local-final-50-20261114.json').runs;
const mean=a=>a.reduce((n,x)=>n+x,0)/a.length,median=a=>{const s=[...a].sort((x,y)=>x-y);return s.length%2?s[(s.length-1)/2]:(s[s.length/2-1]+s[s.length/2])/2;};
const at=(r,d)=>r.observed_day<d?0:r.snapshots.filter(p=>p.day<=d).at(-1).population;
const baselineMatched=archived.map(r=>({seed:r.seed,population:r.population_day_1000,annualPopulation:mean(Array.from({length:80},(_,i)=>at(r,921+i)))}));
let rng=0x7725ac;const random=()=>((rng=Math.imul(rng,1664525)+1013904223>>>0)/4294967296);
function compare(before,after){
  assert.equal(before.length,after.length);assert.deepEqual([...before.map(r=>r.seed)].sort((a,b)=>a-b),[...after.map(r=>r.seed)].sort((a,b)=>a-b));
  const pairs=after.map(r=>[before.find(p=>p.seed===r.seed),r]),metrics=[];
  for(const key of ['population','annualPopulation']){
    const delta=pairs.map(([b,a])=>a[key]-b[key]),resamples=[];
    for(let i=0;i<100000;i++){let n=0;for(let j=0;j<delta.length;j++)n+=delta[Math.floor(random()*delta.length)];resamples.push(n/delta.length);}
    resamples.sort((a,b)=>a-b);
    metrics.push({key,before:mean(before.map(r=>r[key])),after:mean(after.map(r=>r[key])),difference:mean(delta),bootstrap95:[resamples[2500],resamples[97499]]});
  }
  return {n:before.length,metrics,survivedBefore:before.filter(r=>r.population>0).length,survivedAfter:after.filter(r=>r.population>0).length,
    medianBefore:median(before.map(r=>r.population)),medianAfter:median(after.map(r=>r.population)),
    improved:pairs.filter(([b,a])=>a.population>b.population).length,worse:pairs.filter(([b,a])=>a.population<b.population).length,tied:pairs.filter(([b,a])=>a.population===b.population).length};
}
const holdBefore=validation.runs.filter(r=>r.variant==='baseline'),holdAfter=validation.runs.filter(r=>r.variant==='all');
const oldComparison=compare(baselineMatched,matched.runs),freshComparison=compare(holdBefore,holdAfter);
const total=rows=>rows.reduce((n,r)=>n+Object.values(r.acts||{}).reduce((a,x)=>a+x,0),0);
const craft=rows=>rows.reduce((n,r)=>n+Object.entries(r.acts||{}).filter(([action])=>/^(Craft |Build |Clear hut|Clear herb|Make |Shape jar|Fire jar|Teach |Learn from )/.test(action)&&action!=='Make dried food').reduce((m,[,x])=>m+x,0),0);
const roles={};for(const r of holdAfter)for(const [k,n] of Object.entries(r.occupations))roles[k]=(roles[k]||0)+n;
const alive=holdAfter.filter(r=>r.population>0);
const detail={fieldsMeanAlive:mean(alive.map(r=>r.fields)),foodDaysMeanAlive:mean(alive.map(r=>r.foodDays)),
  finishedFoodBefore:mean(holdBefore.map(r=>r.food)),finishedFoodAfter:mean(holdAfter.map(r=>r.food)),
  specialistWorkPercentBefore:100*craft(holdBefore)/total(holdBefore),specialistWorkPercentAfter:100*craft(holdAfter)/total(holdAfter),roles,
  apprentices:holdAfter.reduce((n,r)=>n+r.apprentices,0),markers:holdAfter.reduce((n,r)=>n+r.markers,0)};
const components=read('growth-components-final-10-20261114.json').summary;
writeFileSync(new URL('growth-development-results-20261114.json',root),JSON.stringify({matched:oldComparison,validation:freshComparison,detail,sourceSha256:validation.sourceSha256,baselineSha256:validation.baselineSha256},null,2)+'\n');
const f=n=>n.toFixed(2),row=(label,m)=>'| '+label+' | '+f(m.before)+' | '+f(m.after)+' | '+f(m.difference)+' | '+m.bootstrap95.map(f).join(' to ')+' |';
const md=`# Development and population growth — local results

All four requested changes are implemented locally: paid field expansion, seasonal food planning, work habits and apprenticeships, and earlier housing/family opportunities. No publishing, immigration, free population, accelerated births or earlier wheat unlock was used.

## Independent day-1,000 check

The final version was frozen before evaluating **100 validation seeds, 50–149**. The original **50 seeds, 0–49**, were evaluated separately. All worlds start with six founders; extinct villages count as zero. The seasonal check averages days 921–1,000, a full 80-day game year.

| Comparison | Earlier population | New population | Difference | Paired bootstrap 95% interval |
| --- | ---: | ---: | ---: | --- |
${row('Original 50: day 1,000',oldComparison.metrics[0])}
${row('Original 50: final full year',oldComparison.metrics[1])}
${row('Fresh 100: day 1,000',freshComparison.metrics[0])}
${row('Fresh 100: final full year',freshComparison.metrics[1])}

Across the fresh seeds, **${freshComparison.survivedBefore}/100 → ${freshComparison.survivedAfter}/100** villages are alive at day 1,000. Median population across all worlds is **${freshComparison.medianBefore} → ${freshComparison.medianAfter}**. There are ${freshComparison.improved} higher-population seeds, ${freshComparison.worse} lower-population seeds and ${freshComparison.tied} ties. Individual failures remain possible; this is not a guarantee of permanent survival or continual growth beyond the tested horizon.

The intervals use 100,000 paired percentile-bootstrap samples of the same seeds. They describe uncertainty under seed resampling. The original ten seeds were used for development pilots; validation results were not used to select the final simulation rules. The changes are tested together here, so this table does not isolate their individual contributions.

## Individual-feature checks

The final rules were also exercised with each feature enabled separately on the original ten seeds. These small component runs are diagnostic, rather than independent confirmation. The no-feature control reproduces the baseline. Several changes do poorly in isolation: expanding productive capacity, preserving the harvest, staffing work and supporting households need to function together. This does not establish that every individual change has a positive effect in every village.

| Enabled feature | Day-1,000 mean | Final full-year mean | Alive / 10 |
| --- | ---: | ---: | ---: |
${components.map(c=>'| '+c.variant+' | '+f(c.meanPopulation)+' | '+f(c.annualPopulation)+' | '+c.alive+' |').join('\n')}
| Combined, same ten seeds | ${f(mean(matched.runs.filter(r=>r.seed<10).map(r=>r.population)))} | ${f(mean(matched.runs.filter(r=>r.seed<10).map(r=>r.annualPopulation)))} | ${matched.runs.filter(r=>r.seed<10&&r.population>0).length} |

## How growth is paid for

- **More land:** farmers can discover field layout after garden harvests, a digging tool, personal field and wood-working experience, and experience of a winter. They make physical markers from wood/fibre, clear only trees rooted inside a small plot, pay a further wood cost and complete three preparation workdays. The finished field remains empty until somebody spends seed and plants it. Demand follows the population, bounded by the available field area. Unfinished projects and completed fields persist after deaths and reloads.
- **Seasonal reserves:** the village retains its founding food buffer, then uses winter experience to plan food and fuel. Grain/flour processing uses actual storage capacity. A preserver can reserve a workday and handle the real surplus after gatherers return. Rack construction requires two workdays and three wood/one fibre; processing spends fuel and transfers whole existing provisions into drying racks. No food is created by moving it into storage.
- **Regular work:** work habits reflect repeated actual jobs over the last 20 days, with persistence rather than instant reassignment. Experienced millers/bakers act early enough to support paid practical apprenticeships; farmers harvest ripe food before sowing more. Toolmakers and textile/pottery workers get appropriate recurring work. Needs, illness and exhaustion can always interrupt work. A role itself grants no skill, product or building.
- **Families and housing:** after the village has winter experience, housing planning includes a spare household and approaching adulthood. Eligible unrelated adults can spend real workdays meeting and forming a household, with paid neighboring-camp visits when local partners are unavailable. Recent hunger still blocks births. A temporary investment-related decline in stores can be tolerated only with a substantial accessible reserve; an ordinary ongoing food deficit still blocks expansion of a family.

Among surviving validation villages, mean cultivated area is **${f(detail.fieldsMeanAlive)} plots**, compared with the earlier fixed four. Their mean available finished-food reserve is **${f(detail.foodDaysMeanAlive)} provisions per resident** at the checkpoint. This stock ratio is not a measure of lifetime production or exact nutrition-adjusted days.

Mean available finished food across all validation worlds is **${f(detail.finishedFoodBefore)} → ${f(detail.finishedFoodAfter)} provisions**, with extinct settlements counted as zero. Grain and flour are excluded from that finished-food figure. The population gain is accompanied by larger usable reserves, rather than coming solely from a change to reproduction checks.

The share of recorded actions spent on crafts, construction and lessons is **${f(detail.specialistWorkPercentBefore)}% → ${f(detail.specialistWorkPercentAfter)}%** in the validation comparison. It includes supporting infrastructure and is normalized by recorded actions, not adult labor hours. The new version records **${detail.apprentices} actual supervised milling/baking workdays**. Old worlds did specialist work without having the new role labels; their missing role metadata is not counted as an absence of professions.

The increase in craft/construction/lesson share is modest. Most recurring work roles still support food production, so these results demonstrate a substantial population gain and a functioning food economy, rather than a mature economy dominated by non-food specialists. Winter mortality remains a useful next development target.

New role labels among living validation villagers: ${Object.entries(roles).map(([k,n])=>k+' '+n).join(', ')}.

## Verification and limits

- 305 automated tests passed, including recipe/material prerequisites, paid projects, tight tree-clearing boundaries, persistence after death/save, whole nonnegative food accounting, storage capacity, physiological interruptions, harvest priority, conditional birth planning, and unchanged founding priorities before winter experience.
- Native Canvas checks render expanded fields and incomplete racks at phone/desktop sizes without changing the world. The single-file offline build is parsed as JavaScript. A full browser HTML/CSS screenshot review is not claimed.
- Nightly random draws, base fertility, family recovery intervals and wheat timing remain unchanged. Weather can still cause bad harvests; the maps and resources remain finite.
- Headless daily runs do not render walkers and therefore exclude presentation-triggered river falls. No god actions or magic unlocks were applied.
- Early pilots exposed overly early specialization and a fractional-preservation bug. Those pilots were excluded from the final comparison. Final runs assert every day that communal provisions and private caches are whole and nonnegative, along with population conservation.

Audited simulation snapshot: ${validation.source}. SHA-256: ${validation.sourceSha256}. Baseline SHA-256: ${validation.baselineSha256}.

Raw outputs: growth-matched-final-50-20261114.json and growth-validation-final-100-20261114.json. The previous reports are preserved separately.
`;
writeFileSync(new URL('growth-development-results-20261114.md',root),md);
console.log(JSON.stringify({matched:oldComparison,validation:freshComparison,detail}));
