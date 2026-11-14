// Repeat the ten audited seeds without interventions. The archived baseline
// remains unchanged; all measured effects come from the current live rules.
import {Worker,isMainThread,workerData,parentPort} from 'node:worker_threads';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {createState,stepDay,populationCap,unrelated} from '../src/sim.js';
import {HOMESTEAD_RULES} from '../src/config.js';
const files=['config','provisions','needs','fishing','settlement-layout','healer-home','magic','farming','village-events','ecology','practices','neighbors','sim'];
function hashSources(){const h=createHash('sha256');for(const f of files)h.update(f+'\n').update(readFileSync(new URL('../src/'+f+'.js',import.meta.url)));return h.digest('hex');}
if(isMainThread){
  const [name='population-followup-10-20261114',countText='10',firstText='0']=process.argv.slice(2);assert.match(name,/^[a-zA-Z0-9_-]+$/);
  const count=Number(countText),first=Number(firstText);assert.ok(Number.isSafeInteger(count)&&count>0&&Number.isSafeInteger(first)&&first>=0);
  const baseline=JSON.parse(readFileSync(new URL('../reports/population-audit-10-20261114.json',import.meta.url),'utf8'));
  const hash=hashSources(),groups=Array.from({length:4},()=>[]),runs=[];
  for(let i=0;i<count;i++)groups[i%4].push(first+i);
  await Promise.all(groups.map(seeds=>new Promise((resolve,reject)=>{
    const w=new Worker(new URL(import.meta.url),{workerData:{seeds,horizon:baseline.horizon}});
    w.on('message',r=>{runs.push(r);console.log('Seed '+r.seed+': '+r.population_final+' alive at day '+r.observed_day+', peak '+r.peak+', visits '+r.meetings+', cross-village births '+r.cross_village_births+' ('+runs.length+'/'+count+')');});
    w.on('error',reject);w.on('exit',code=>code?reject(Error('Worker exit '+code)):resolve());
  })));
  assert.equal(hashSources(),hash,'Source changed during the comparison');runs.sort((a,b)=>a.seed-b.seed);
  const sums=rows=>({runs:rows.length,survived:rows.filter(r=>!r.extinct).length,survivedDay1000:rows.filter(r=>r.population_day_1000>0).length,
    finalPopulation:rows.reduce((n,r)=>n+r.population_final,0),births:rows.reduce((n,r)=>n+r.births,0),deaths:rows.reduce((n,r)=>n+r.deaths,0),
    hungerDeaths:rows.reduce((n,r)=>n+r.hunger_deaths,0),coldDeaths:rows.reduce((n,r)=>n+r.cold_deaths,0),oldAgeDeaths:rows.reduce((n,r)=>n+r.old_age_deaths,0),
    meanPeak:rows.reduce((n,r)=>n+r.peak,0)/rows.length});
  const summary={createdAt:new Date().toISOString(),sourceSha256:hash,sourceFiles:files,baselineSourceSha256:baseline.sourceSha256,
    seeds:runs.map(r=>r.seed),horizon:baseline.horizon,method:'Consecutive starting seeds, current local HOMESTEAD_RULES, no commands, gifts, immigration or magic unlock. Current stepDay is called directly; no observer-instrumented source. Changes tested together: accessible food accounting and experienced food planning, anticipatory physical housing, and paid neighboring-community visits/families. The archived ten seeds are compared separately. This combined comparison does not isolate each change causally. Endings are observations at the horizon, not guarantees of permanent survival.',
    baseline:sums(baseline.runs),matchedTen:sums(runs.filter(r=>baseline.runs.some(b=>b.seed===r.seed))),current:sums(runs),
    endings:Object.fromEntries(['extinct','at_risk','recovering','continuing'].map(key=>[key,runs.filter(r=>r.ending===key).length])),
    meetings:runs.reduce((n,r)=>n+r.meetings,0),householdMoves:runs.reduce((n,r)=>n+r.household_moves,0),
    crossVillageBirths:runs.reduce((n,r)=>n+r.cross_village_births,0),techniquesLearnedOnVisits:runs.reduce((n,r)=>n+r.neighbor_lessons,0),
    runs,baselineRuns:baseline.runs.map(({snapshots,counts,birthRecords,deathRecords,foodLimitedActions,...r})=>r)};
  const keys=Object.keys(runs[0]).filter(k=>k!=='snapshots');
  writeFileSync(new URL('../reports/'+name+'.csv',import.meta.url),keys.join(',')+'\n'+runs.map(r=>keys.map(k=>r[k]??'').join(',')).join('\n')+'\n');
  writeFileSync(new URL('../reports/'+name+'.json',import.meta.url),JSON.stringify(summary,null,2)+'\n');
  console.log(JSON.stringify({...summary,runs:undefined,baselineRuns:undefined},null,2));
}else{
  for(const seed of workerData.seeds){
    let s=createState(HOMESTEAD_RULES,seed),pop1000=0,pop100=0,pop300=0,lastBirth=null,foodBlocked=0,capBlocked=0,storeSupportedBirths=0;
    const causes={},birthDays=[],snapshots=[{day:0,population:s.villagers.length}];let childDeaths=0;
    while(!s.ended&&s.day<workerData.horizon){
      const previous=s;s=stepDay(s);const report=s.lastDay;
      if(s.day===100)pop100=s.villagers.length;if(s.day===300)pop300=s.villagers.length;if(s.day===1000)pop1000=s.villagers.length;
      if(report.birth!=null){lastBirth=s.day;birthDays.push(s.day);if(s.food<s.config.birth.foodPerPerson*(s.villagers.length-1)+s.config.birth.extraFood)storeSupportedBirths++;}
      for(const d of report.deaths){for(const cause of d.causes)causes[cause]=(causes[cause]||0)+1;if(previous.villagers.find(v=>v.id===d.id).age+1<s.config.life.adult)childDeaths++;}
      if(!s.ended&&s.local.birthConditions?.includes('too little stored food'))foodBlocked++;
      if(!s.ended&&s.local.birthConditions?.includes('population cap reached'))capBlocked++;
      if(s.day%10===0||s.ended||report.birth!=null||report.deaths.length)snapshots.push({day:s.day,population:s.villagers.length});
      assert.equal(s.villagers.length,6+s.stats.births-s.stats.deaths);
      assert.ok(s.food>=0&&s.wood>=0&&Object.values(s.local.campStores).every(store=>store.saved>=0));
    }
    const futurePair=s.villagers.some(a=>a.gender==='female'&&s.villagers.some(b=>{
      if(b.gender!=='male'||!unrelated(a,b))return false;
      const wait=Math.max(0,s.config.life.adult-a.age,s.config.life.adult-b.age);
      return a.age+wait<s.config.life.elder&&b.age+wait<s.config.life.elder;
    }));
    const recentBirths=birthDays.filter(d=>d>s.day-300).length;
    const ending=s.ended?'extinct':!futurePair||recentBirths===0?'at_risk':s.villagers.length<6?'recovering':'continuing';
    parentPort.postMessage({seed,ending,observed_day:s.day,extinct:s.ended,population_day_100:pop100,population_day_300:pop300,population_day_1000:pop1000,
      population_final:s.villagers.length,peak:s.stats.peak,births:s.stats.births,deaths:s.stats.deaths,child_deaths:childDeaths,
      old_age_deaths:causes['old age']||0,hunger_deaths:causes.hunger||0,cold_deaths:causes.cold||0,illness_deaths:causes.illness||0,
      last_birth_day:lastBirth,births_final_300:recentBirths,viable_future_pair:futurePair,huts_final:s.huts?.length||0,population_cap:populationCap(s),
      meetings:s.local.communication?.meetings||0,household_moves:s.local.communication?.householdMoves||0,cross_village_births:s.local.communication?.crossVillageBirths||0,
      neighbor_lessons:s.local.communication?.lessons||0,food_blocked_checks:foodBlocked,cap_blocked_checks:capBlocked,births_supported_by_local_stores:storeSupportedBirths,snapshots});
  }
}
