// Bounded hands-off runs: a surviving run is censored at the horizon, never
// reported as immortal or assigned an extinction day. Original reports stay intact.
import {Worker,isMainThread,workerData,parentPort} from 'node:worker_threads';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createState,stepDay} from '../src/sim.js';
import {HOMESTEAD_RULES} from '../src/config.js';

if(isMainThread){
  const [countText='100',horizonText='10000',name='survival-local',startText='0']=process.argv.slice(2);
  const count=Number(countText),horizon=Number(horizonText),start=Number(startText);
  if(![count,horizon,start].every(Number.isSafeInteger)||count<1||horizon<1000||start<0||
    !/^[a-zA-Z0-9_-]+$/.test(name))throw Error('Usage: node scripts/survival-report.mjs [count] [days >= 1000] [report-name] [first-seed]');
  const results=[],groups=Array.from({length:Math.min(6,count)},()=>[]);
  for(let i=0;i<count;i++)groups[i%groups.length].push(start+i);
  const columns=['seed','observed_day','survived_horizon','extinction_day','population_day_1000','population_final',
    'births','deaths','old_age_deaths','hunger_deaths','cold_deaths','illness_deaths','births_final_300_days','harvests'];
  const save=()=>writeFileSync(new URL('../reports/'+name+'.csv',import.meta.url),
    columns.join(',')+'\n'+results.sort((a,b)=>a.seed-b.seed).map(r=>columns.map(k=>r[k]).join(',')).join('\n')+'\n');
  await Promise.all(groups.map(seeds=>new Promise((resolve,reject)=>{
    const worker=new Worker(new URL(import.meta.url),{workerData:{seeds,horizon}});
    worker.on('message',result=>{results.push(result);save();if(results.length%10===0)console.log(results.length+'/'+count+' completed');});
    worker.on('error',reject);worker.on('exit',code=>code?reject(Error('Worker exit '+code)):resolve());
  })));
  const hash=createHash('sha256');
  for(const file of ['config.js','needs.js','fishing.js','settlement-layout.js','healer-home.js','magic.js','farming.js','village-events.js','ecology.js','practices.js','sim.js'])hash.update(readFileSync(new URL('../src/'+file,import.meta.url)));
  const summary={sourceSha256:hash.digest('hex'),runs:count,firstSeed:start,horizon,survivedDay1000:results.filter(r=>r.population_day_1000>0).length,
    survivedHorizon:results.filter(r=>r.survived_horizon).length,
    survivorsWithRecentBirths:results.filter(r=>r.survived_horizon&&r.births_final_300_days>0).length,
    longestObservedDay:Math.max(...results.map(r=>r.observed_day))};
  writeFileSync(new URL('../reports/'+name+'.json',import.meta.url),JSON.stringify(summary,null,2)+'\n');
  console.log(JSON.stringify(summary));
}else{
  for(const seed of workerData.seeds){
    let s=createState(HOMESTEAD_RULES,seed),pop1000=0,harvests=0;
    const causes={},birthDays=[];
    while(!s.ended&&s.day<workerData.horizon){
      s=stepDay(s);harvests+=s.lastDay.harvests;
      if(s.day===1000)pop1000=s.villagers.length;
      if(s.lastDay.birth!=null)birthDays.push(s.day);
      for(const death of s.lastDay.deaths)for(const cause of death.causes)causes[cause]=(causes[cause]||0)+1;
    }
    parentPort.postMessage({seed,observed_day:s.day,survived_horizon:!s.ended,extinction_day:s.ended?s.day:'',
      population_day_1000:pop1000,population_final:s.villagers.length,births:s.stats.births,deaths:s.stats.deaths,
      old_age_deaths:causes['old age']||0,hunger_deaths:causes.hunger||0,cold_deaths:causes.cold||0,
      illness_deaths:causes.illness||0,births_final_300_days:birthDays.filter(day=>day>s.day-300).length,harvests});
  }
}
