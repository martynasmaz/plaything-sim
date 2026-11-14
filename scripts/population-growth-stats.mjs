// Paired seed resampling: every world counts, including extinct worlds at zero.
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const root=new URL('../reports/',import.meta.url);
const before=JSON.parse(readFileSync(new URL('population-wheat-sustainability-50-20261114.json',root))).runs;
const after=JSON.parse(readFileSync(new URL('population-local-final-50-20261114.json',root))).runs;
assert.equal(new Set(before.map(r=>r.seed)).size,before.length);
assert.equal(new Set(after.map(r=>r.seed)).size,after.length);
assert.deepEqual(before.map(r=>r.seed).sort((a,b)=>a-b),after.map(r=>r.seed).sort((a,b)=>a-b));
const mean=values=>values.reduce((sum,n)=>sum+n,0)/values.length;
function populationAt(r,day){
  if(r.observed_day<day)return 0;
  const snapshot=r.snapshots.filter(p=>p.day<=day).at(-1);
  assert.ok(snapshot);return snapshot.population;
}
function annualMean(r,day){return mean(Array.from({length:80},(_,i)=>populationAt(r,day-79+i)));}
let rng=0x95ab17;
const random=()=>((rng=Math.imul(rng,1664525)+1013904223>>>0)/4294967296);
const samples=100000,metrics=[];
for(const [label,measure] of [
  ['day_100',r=>populationAt(r,100)],['day_300',r=>populationAt(r,300)],
  ['day_1000',r=>populationAt(r,1000)],['year_ending_day_1000',r=>annualMean(r,1000)],
  ['day_3000',r=>populationAt(r,3000)]
]){
  const pairs=after.map(r=>[measure(before.find(p=>p.seed===r.seed)),measure(r)]);
  const differences=pairs.map(([a,b])=>b-a),resampled=[],localMeans=[];
  for(let i=0;i<samples;i++){
    let delta=0,local=0;
    for(let j=0;j<pairs.length;j++){const index=Math.floor(random()*pairs.length);delta+=differences[index];local+=pairs[index][1];}
    resampled.push(delta/pairs.length);localMeans.push(local/pairs.length);
  }
  resampled.sort((a,b)=>a-b);localMeans.sort((a,b)=>a-b);
  const ci=values=>[values[Math.floor(samples*.025)],values[Math.floor(samples*.975)-1]];
  const oldMean=mean(pairs.map(p=>p[0])),newMean=mean(pairs.map(p=>p[1]));
  metrics.push({metric:label,before:oldMean,local:newMean,difference:mean(differences),
    relativeChangePercent:100*(newMean-oldMean)/oldMean,pairedBootstrap95:ci(resampled),localMeanBootstrap95:ci(localMeans)});
}
const curve=[0,100,300,500,750,1000,1500,2000,3000].map(day=>({day,
  before:mean(before.map(r=>populationAt(r,day))),local:mean(after.map(r=>populationAt(r,day)))}));
const result={method:'100,000 paired percentile bootstrap samples of the same 50 seeds. Extinct worlds remain zero. Descriptive uncertainty under seed resampling; no independent holdout validation. The 80-day annual mean controls season phase within the game calendar.',
  startingPopulation:6,metrics,curve};
writeFileSync(new URL('population-growth-statistics-20261114.json',root),JSON.stringify(result,null,2)+'\n');
const f=n=>n.toFixed(2),day=metrics.find(m=>m.metric==='day_1000');
const md=`# Population growth benchmark

The development target is a higher population distribution across many hands-off worlds, supported by lasting food surplus and regular specialist work. Exact progression dates can be tuned later. A growing selected survivor is not enough: extinct villages count as zero.

The first checkpoint is day 1,000. Compare identical seeds, and also average the last 80 days (one compressed game year) to avoid mistaking a seasonal peak for sustained development.

| Measure | Earlier mean | Local mean | Change | Paired bootstrap 95% interval for change |
| --- | ---: | ---: | ---: | --- |
${metrics.map(m=>'| '+m.metric+' | '+f(m.before)+' | '+f(m.local)+' | '+f(m.difference)+' | '+m.pairedBootstrap95.map(f).join(' to ')+' |').join('\n')}

At day 1,000, the mean across **all 50 worlds** rises from ${f(day.before)} to ${f(day.local)} (${day.relativeChangePercent.toFixed(1)}%). The estimated interval for the difference includes zero: this is promising evidence, but the present 50-seed comparison does not establish a clear increase by that checkpoint. The local mean is higher than the founding population of six; that is a different comparison from improvement over the earlier version.

The aggregate curve also needs attention: early growth is followed by seasonal losses and some extinctions. Higher long-run survival does not establish continual population expansion. Before claiming a robust tuning improvement, validate the population and surplus trend on an additional fixed set of seeds that was not used to choose the changes.

## All-world mean population

| Day | Earlier | Local |
| ---: | ---: | ---: |
${curve.map(p=>'| '+[p.day,f(p.before),f(p.local)].join(' | ')+' |').join('\n')}

The intervals are descriptive percentile-bootstrap estimates from 100,000 paired resamples of 50 sequential seeds. These seeds are a limited convenience sample, and the update combines several changes. The analysis does not identify the effect of any one feature or guarantee behavior in every world. Full numerical output is in population-growth-statistics-20261114.json.
`;
writeFileSync(new URL('population-growth-statistics-20261114.md',root),md);
console.log(JSON.stringify(metrics));
