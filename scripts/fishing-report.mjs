// Observe the current rules without interventions or simulation-state edits.
import {Worker,isMainThread,workerData,parentPort} from 'node:worker_threads';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {createState,stepDay} from '../src/sim.js';
import {HOMESTEAD_RULES} from '../src/config.js';
import {fishingCrafts} from '../src/fishing.js';

const sourceHash=()=>{
  const hash=createHash('sha256');
  for(const file of ['config.js','needs.js','fishing.js','settlement-layout.js','healer-home.js','magic.js','farming.js','village-events.js','ecology.js','practices.js','sim.js'])hash.update(readFileSync(new URL('../src/'+file,import.meta.url)));
  return hash.digest('hex');
};
const csv=(name,rows)=>{
  const keys=Object.keys(rows[0]);
  writeFileSync(new URL('../reports/'+name+'.csv',import.meta.url),keys.join(',')+'\n'+
    rows.map(row=>keys.map(k=>row[k]).join(',')).join('\n')+'\n');
};
const sum=(rows,key)=>rows.reduce((n,row)=>n+row[key],0);
const median=values=>{const a=values.slice().sort((a,b)=>a-b),m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;};

if(isMainThread){
  const [countText='100',daysText='1000',name='fishing-100']=process.argv.slice(2);
  const count=Number(countText),horizon=Number(daysText),hash=sourceHash();
  if(![count,horizon].every(n=>Number.isSafeInteger(n)&&n>0)||!/^[a-zA-Z0-9_-]+$/.test(name))
    throw Error('Usage: node scripts/fishing-report.mjs [count] [days] [report-name]');
  const results=[],groups=Array.from({length:Math.min(6,count)},()=>[]);
  for(let seed=0;seed<count;seed++)groups[seed%groups.length].push(seed);
  await Promise.all(groups.map(seeds=>new Promise((resolve,reject)=>{
    const w=new Worker(new URL(import.meta.url),{workerData:{seeds,horizon}});
    w.on('message',r=>{results.push(r);if(results.length%10===0)console.log(results.length+'/'+count+' villages measured');});
    w.on('error',reject);w.on('exit',code=>code?reject(Error('Worker exit '+code)):resolve());
  })));
  assert.equal(sourceHash(),hash,'Simulation sources changed during the measurement');
  results.sort((a,b)=>a.run.seed-b.run.seed);
  const runs=results.map(r=>r.run),people=results.flatMap(r=>r.people),snapshots=results.flatMap(r=>r.snapshots);
  const eligible=people.filter(p=>p.adult_days>=20),regular=eligible.filter(p=>p.max_fishing_days_in_20>=5);
  assert.equal(sum(people,'fishing_days'),sum(runs,'fishing_actions'));
  assert.equal(sum(people,'fish_food'),sum(runs,'fish_food'));
  assert.ok(sum(runs,'fish_food')+sum(runs,'weekly_fish_food')<=sum(runs,'gathered_food'));
  csv(name,runs);csv(name+'-people',people);csv(name+'-snapshots',snapshots);
  const checkpointSummary=[...new Set(snapshots.map(r=>r.day))].map(day=>{
    const rows=snapshots.filter(r=>r.day===day),alive=rows.filter(r=>r.population>0);
    return {day,livingVillages:alive.length,meanPopulation:sum(alive,'population')/Math.max(1,alive.length),
      meanTrapOwners:sum(alive,'trap_owners')/Math.max(1,alive.length),
      meanRecentFishers:sum(alive,'recent_fishers')/Math.max(1,alive.length),
      meanRegularFishers:sum(alive,'regular_fishers')/Math.max(1,alive.length),
      villagesWithRegularFishers:alive.filter(r=>r.regular_fishers>0).length,
      regularShareOfLivingAdults:sum(alive,'regular_fishers')/Math.max(1,sum(alive,'adults'))};
  });
  const summary={sourceSha256:hash,runs:count,horizon,
    definition:'Regular = at least 5 main fishing workdays within any 20-day window. Adoption percentage includes only villagers observed for at least 20 adult days. Weekly trap checks are counted separately as food.',
    villagesEverFished:runs.filter(r=>r.fishing_actions>0).length,
    medianFirstFishingDay:median(runs.filter(r=>r.first_fishing_day>0).map(r=>r.first_fishing_day)),
    eligibleAdults:eligible.length,eligibleAdultsEverFished:eligible.filter(p=>p.fishing_days>0).length,
    regularFishers:regular.length,regularAdoptionShare:regular.length/Math.max(1,eligible.length),
    regularFishersBornInVillage:regular.filter(p=>p.born_in_village).length,
    fishFood:sum(runs,'fish_food'),weeklyFishFood:sum(runs,'weekly_fish_food'),gatheredFood:sum(runs,'gathered_food'),
    fishingFoodShare:(sum(runs,'fish_food')+sum(runs,'weekly_fish_food'))/Math.max(1,sum(runs,'gathered_food')),
    meanFishFoodPerVillageDay:(sum(runs,'fish_food')+sum(runs,'weekly_fish_food'))/sum(runs,'observed_day'),
    childrenObservedFishing:people.filter(p=>p.child_fishing_observations>0).length,
    observedChildrenLaterRegularFishers:regular.filter(p=>p.child_fishing_observations>0).length,
    fishingActionDays:sum(runs,'fishing_actions'),zeroCatchActions:sum(runs,'zero_catch_actions'),
    methods:Object.fromEntries(['spear','trap','line','pole','net'].map(method=>[method,{
      actions:sum(runs,method+'_actions'),villages:runs.filter(r=>r[method+'_actions']>0).length}])),
    easternFoodProductionActions:sum(runs,'eastern_food_actions'),checkpoints:checkpointSummary};
  writeFileSync(new URL('../reports/'+name+'.json',import.meta.url),JSON.stringify(summary,null,2)+'\n');
  console.log(JSON.stringify(summary));
}else{
  for(const seed of workerData.seeds){
    let s=createState(HOMESTEAD_RULES,seed),fishFood=0,weeklyFood=0,totalFood=0,actions=0,zero=0,first=0,eastern=0;
    const methods={spear:0,trap:0,line:0,pole:0,net:0};
    const people=new Map(),snapshots=[],checkpoints=[100,300,workerData.horizon].filter((d,i,a)=>d<=workerData.horizon&&a.indexOf(d)===i).sort((a,b)=>a-b);
    const record=v=>{
      if(!people.has(v.id))people.set(v.id,{seed,id:v.id,born_in_village:v.id>6,adult_days:0,fishing_days:0,fish_food:0,
        first_fishing_day:0,last_fishing_day:0,max_fishing_days_in_20:0,child_fishing_observations:0,trap_owner:false,alive:true,recent:[]});
      return people.get(v.id);
    };
    const snapshot=day=>{
      const alive=s.ended?[]:s.villagers;
      const recent=v=>record(v).recent.filter(d=>d>day-20).length;
      snapshots.push({seed,day,population:alive.length,adults:alive.filter(v=>v.age>=s.config.life.adult).length,
        trap_owners:alive.filter(v=>v.fishTrap).length,recent_fishers:alive.filter(v=>recent(v)>0).length,
        regular_fishers:alive.filter(v=>recent(v)>=5).length});
    };
    for(const v of s.villagers)record(v);
    while(!s.ended&&s.day<workerData.horizon){
      const before=new Map(s.villagers.map(v=>[v.id,v]));
      for(const v of before.values())if(v.age>=s.config.life.adult)record(v).adult_days++;
      s=stepDay(s);
      const jobs=new Map(s.lastDay.actions.map(a=>[a.id,a]));
      totalFood+=s.lastDay.gatheredFood;
      for(const catchReport of Object.values(s.lastDay.fishing||{}))methods[catchReport.method]++;
      for(const a of s.lastDay.actions){
        if(a.action==='Fish'){
          const p=record(before.get(a.id));actions++;fishFood+=a.gained;if(a.gained===0)zero++;
          first ||= s.day;p.first_fishing_day ||= s.day;p.last_fishing_day=s.day;
          p.fishing_days++;p.fish_food+=a.gained;p.recent=p.recent.filter(d=>d>s.day-20);p.recent.push(s.day);
          p.max_fishing_days_in_20=Math.max(p.max_fishing_days_in_20,p.recent.length);
        }
        if(a.mentor&&jobs.get(a.mentor)?.action==='Fish')record(before.get(a.id)).child_fishing_observations++;
        if(a.action==='Harvest eastern plot'||a.action==='Gather eastern berries')eastern++;
      }
      for(const chore of s.lastDay.weeklyWork||[])if(fishingCrafts.includes(chore.item)&&chore.result==='stored one provision')weeklyFood++;
      for(const v of s.villagers){const p=record(v);p.trap_owner=!!v.fishTrap;}
      for(const death of s.lastDay.deaths)people.get(death.id).alive=false;
      if(checkpoints.includes(s.day))snapshot(s.day);
    }
    for(const day of checkpoints)if(!snapshots.some(r=>r.day===day))snapshot(day);
    const rows=[...people.values()].map(({recent,...p})=>p);
    parentPort.postMessage({run:{seed,observed_day:s.day,population_final:s.villagers.length,
      first_fishing_day:first,fishing_actions:actions,fish_food:fishFood,weekly_fish_food:weeklyFood,
      gathered_food:totalFood,zero_catch_actions:zero,eastern_food_actions:eastern,
      ...Object.fromEntries(Object.entries(methods).map(([method,n])=>[method+'_actions',n])),
      regular_fishers_ever:rows.filter(p=>p.adult_days>=20&&p.max_fishing_days_in_20>=5).length},people:rows,snapshots});
  }
}
