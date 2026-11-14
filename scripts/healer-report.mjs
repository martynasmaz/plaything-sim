// Measure natural healer/home emergence. No interventions or state edits.
import {Worker,isMainThread,workerData,parentPort} from 'node:worker_threads';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {createState,stepDay} from '../src/sim.js';
import {HOMESTEAD_RULES} from '../src/config.js';
import {healerBuildingRules,healerTrainingComplete} from '../src/healer-home.js';

const sourceHash=()=>{
  const hash=createHash('sha256');
  for(const file of ['config.js','needs.js','fishing.js','settlement-layout.js','healer-home.js','magic.js','farming.js','village-events.js','ecology.js','practices.js','sim.js'])
    hash.update(readFileSync(new URL('../src/'+file,import.meta.url)));
  return hash.digest('hex');
};
const distribution=values=>{
  const a=values.filter(Number.isFinite).sort((x,y)=>x-y);
  if(!a.length)return {count:0};
  const median=a.length%2?a[(a.length-1)/2]:(a[a.length/2-1]+a[a.length/2])/2;
  return {count:a.length,earliest:a[0],median,latest:a.at(-1)};
};
if(isMainThread){
  const [countText='100',horizonText='3000',name='healer-timing-100']=process.argv.slice(2);
  const count=Number(countText),horizon=Number(horizonText),hash=sourceHash();
  if(![count,horizon].every(n=>Number.isSafeInteger(n)&&n>0)||!/^[a-zA-Z0-9_-]+$/.test(name))
    throw Error('Usage: node scripts/healer-report.mjs [count] [days] [report-name]');
  const results=[],groups=Array.from({length:Math.min(6,count)},()=>[]);
  for(let seed=0;seed<count;seed++)groups[seed%groups.length].push(seed);
  await Promise.all(groups.map(seeds=>new Promise((resolve,reject)=>{
    const worker=new Worker(new URL(import.meta.url),{workerData:{seeds,horizon}});
    worker.on('message',r=>{results.push(r);if(results.length%10===0)console.log(results.length+'/'+count+' villages measured');});
    worker.on('error',reject);worker.on('exit',code=>code?reject(Error('Worker exit '+code)):resolve());
  })));
  assert.equal(sourceHash(),hash,'Simulation changed during measurement');
  results.sort((a,b)=>a.seed-b.seed);
  for(const r of results){
    if(r.hut_day!==null)assert.ok(r.plan_day<=r.hut_day&&r.healer_day<=r.hut_day);
    if(r.fitted_day!==null)assert.ok(r.hut_day<=r.fitted_day);
  }
  const checkpoints=[100,300,500,1000,2000,horizon].filter((d,i,a)=>d<=horizon&&a.indexOf(d)===i).sort((a,b)=>a-b);
  const summary={sourceSha256:hash,runs:count,firstSeed:0,horizon,
    method:'Fresh HOMESTEAD_RULES worlds, seeds 0 through count-1, no commands or state edits. Timings count first-ever emergence, including structures whose owners later die. Medians include only villages reaching each milestone; unreached runs are censored at extinction or horizon.',
    herbalism:distribution(results.map(r=>r.herbalism_day)),
    healer:distribution(results.map(r=>r.healer_day)),
    plannedSite:distribution(results.map(r=>r.plan_day)),
    completedHut:distribution(results.map(r=>r.hut_day)),
    occupiedHut:distribution(results.map(r=>r.moved_day)),
    completedRack:distribution(results.map(r=>r.rack_day)),
    fullyFittedHut:distribution(results.map(r=>r.fitted_day)),
    apprenticeship:{villagesWithApprentices:results.filter(r=>r.apprentices_seen>0).length,
      villagesWithGraduates:results.filter(r=>r.graduates>0).length,
      villagesWithTrainedSuccession:results.filter(r=>r.trained_successions>0).length,
      apprentices:results.reduce((n,r)=>n+r.apprentices_seen,0),graduates:results.reduce((n,r)=>n+r.graduates,0),
      trainedSuccessions:results.reduce((n,r)=>n+r.trained_successions,0),
      firstApprentice:distribution(results.map(r=>r.apprentice_day)),
      firstGraduation:distribution(results.map(r=>r.graduation_day)),
      firstTrainedSuccession:distribution(results.map(r=>r.succession_day)),
      maxSimultaneousHealers:Math.max(...results.map(r=>r.max_healers)),
      maxSimultaneousActiveApprentices:Math.max(...results.map(r=>r.max_active_apprentices))},
    daysFromPlanToHut:distribution(results.filter(r=>r.hut_day!==null).map(r=>r.hut_day-r.plan_day)),
    checkpoints:checkpoints.map(day=>({day,
      villagesReachingDay:results.filter(r=>r.observed_day>=day).length,
      healerEver:results.filter(r=>r.healer_day!==null&&r.healer_day<=day).length,
      hutEverCompleted:results.filter(r=>r.hut_day!==null&&r.hut_day<=day).length,
      fullyFittedEver:results.filter(r=>r.fitted_day!==null&&r.fitted_day<=day).length})),
    survivedHorizon:results.filter(r=>!r.extinct).length,
    builderHelpDays:results.reduce((n,r)=>n+r.builder_help_days,0),
    plannedButUnfinished:results.filter(r=>r.plan_day!==null&&r.hut_day===null).length};
  const columns=Object.keys(results[0]);
  writeFileSync(new URL('../reports/'+name+'.csv',import.meta.url),columns.join(',')+'\n'+results.map(r=>columns.map(k=>r[k]??'').join(',')).join('\n')+'\n');
  writeFileSync(new URL('../reports/'+name+'.json',import.meta.url),JSON.stringify(summary,null,2)+'\n');
  console.log(JSON.stringify(summary,null,2));
}else{
  for(const seed of workerData.seeds){
    let s=createState(HOMESTEAD_RULES,seed);
    const r={seed,herbalism_day:null,healer_day:null,plan_day:null,hut_day:null,moved_day:null,rack_day:null,fitted_day:null,
      apprentice_day:null,graduation_day:null,succession_day:null};
    const apprentices=new Set(),graduates=new Set(),successors=new Set();let maxHealers=0,maxApprentices=0,builderHelpDays=0;
    while(!s.ended&&s.day<workerData.horizon){
      s=stepDay(s);const home=s.local.healerHome;
      if(s.lastDay.healerBuilder!=null)builderHelpDays++;
      if(s.villagers.some(v=>v.practice?.known.herbalism))r.herbalism_day??=s.day;
      if(s.villagers.some(v=>v.herbalist))r.healer_day??=s.day;
      if(home)r.plan_day??=s.day;
      if(home?.work>=healerBuildingRules.hutWork)r.hut_day??=s.day;
      if(s.villagers.some(v=>v.herbalist?.home))r.moved_day??=s.day;
      if(home?.rackWork>=healerBuildingRules.rackWork)r.rack_day??=s.day;
      if(home?.markerWork>=healerBuildingRules.markerWork)r.fitted_day??=s.day;
      const healers=s.villagers.filter(v=>v.herbalist);
      const activePupils=s.villagers.filter(v=>v.healerApprentice&&healers.some(t=>t.id===v.healerApprentice.mentorId));
      maxHealers=Math.max(maxHealers,healers.length);maxApprentices=Math.max(maxApprentices,activePupils.length);
      assert.ok(healers.length<=1&&activePupils.length<=1,'one healer and at most one active apprentice');
      for(const v of s.villagers){
        if(v.healerApprentice){apprentices.add(v.id);r.apprentice_day??=s.day;}
        if(healerTrainingComplete(v)){graduates.add(v.id);r.graduation_day??=s.day;}
        if(v.herbalist?.trainedById!=null){successors.add(v.id);r.succession_day??=s.day;}
      }
    }
    parentPort.postMessage({...r,observed_day:s.day,extinct:s.ended,population_final:s.villagers.length,
      hut_work:s.local.healerHome?.work??0,rack_work:s.local.healerHome?.rackWork??0,marker_work:s.local.healerHome?.markerWork??0,
      apprentices_seen:apprentices.size,graduates:graduates.size,trained_successions:successors.size,
      max_healers:maxHealers,max_active_apprentices:maxApprentices,builder_help_days:builderHelpDays});
  }
}
