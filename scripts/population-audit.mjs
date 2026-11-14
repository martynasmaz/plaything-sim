// Read-only instrumentation at the actual birth decision. The live source is
// loaded into memory with two observation calls; no game file/rule is edited.
import {Worker,isMainThread,workerData,parentPort} from 'node:worker_threads';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {createState as originalCreate,stepDay as originalStep,populationCap,shelterPlaces,foodCapacity} from '../src/sim.js';
import {HOMESTEAD_RULES} from '../src/config.js';

const sourceFiles=['config','needs','fishing','settlement-layout','healer-home','magic','farming','village-events','ecology','practices','sim'];
function sourceHash(){const hash=createHash('sha256');for(const name of sourceFiles)hash.update(name+'\n').update(readFileSync(new URL('../src/'+name+'.js',import.meta.url)));return hash.digest('hex');}
function csv(rows,keys){const cell=v=>/[",\n]/.test(String(v??''))?'"'+String(v??'').replaceAll('"','""')+'"':String(v??'');return keys.join(',')+'\n'+rows.map(r=>keys.map(k=>cell(r[k])).join(',')).join('\n')+'\n';}
if(isMainThread){
  const [countText='10',horizonText='3000',name='population-audit-10',startText='0']=process.argv.slice(2);
  const count=Number(countText),horizon=Number(horizonText),start=Number(startText),hash=sourceHash();
  assert.ok([count,horizon,start].every(Number.isSafeInteger)&&count>0&&horizon>=300&&start>=0&&/^[a-zA-Z0-9_-]+$/.test(name),'Invalid arguments');
  const groups=Array.from({length:Math.min(4,count)},()=>[]),results=[];
  for(let i=0;i<count;i++)groups[i%groups.length].push(start+i);
  await Promise.all(groups.map(seeds=>new Promise((resolve,reject)=>{
    const w=new Worker(new URL(import.meta.url),{workerData:{seeds,horizon}});
    w.on('message',result=>{results.push(result);console.log('Seed '+result.seed+': day '+result.observed_day+', peak '+result.peak+', births '+result.births+', final '+result.population_final+' ('+results.length+'/'+count+')');});
    w.on('error',reject);w.on('exit',code=>code?reject(Error('Worker exit '+code)):resolve());
  })));
  assert.equal(sourceHash(),hash,'Sources changed during measurement');results.sort((a,b)=>a.seed-b.seed);
  const keys=['seed','observed_day','extinct','population_day_100','population_day_300','population_day_1000','population_final','peak','births','deaths','child_deaths','old_age_deaths','hunger_deaths','cold_deaths','illness_deaths','first_birth_day','last_birth_day','founder_children','later_generation_births','born_reached_adulthood','huts_final','farm_day','healer_day'];
  writeFileSync(new URL('../reports/'+name+'.csv',import.meta.url),csv(results,keys));
  const daily=results.flatMap(r=>r.daily);
  writeFileSync(new URL('../reports/'+name+'-daily.csv',import.meta.url),csv(daily,Object.keys(daily[0])));
  const totals={};for(const r of results)for(const [k,v] of Object.entries(r.counts))totals[k]=(totals[k]||0)+v;
  const actions={};for(const r of results)for(const [k,v] of Object.entries(r.foodLimitedActions))actions[k]=(actions[k]||0)+v;
  const report={createdAt:new Date().toISOString(),sourceSha256:hash,sourceFiles,count,firstSeed:start,horizon,
    method:'Current local HOMESTEAD_RULES, independent deterministic seeds, no god commands, immigration, magic unlocks, resource edits or rule changes. Stop at extinction or the horizon. Birth diagnostics are read immediately before the actual birth-counter update, after meals, health, aging and deaths. Causes overlap. Instantaneous relaxed-condition checks do not simulate changed futures. Instrumentation is verified against the original simulation on seed 0 for 100 days.',
    rules:{birth:originalCreate(HOMESTEAD_RULES,start).config.birth,life:originalCreate(HOMESTEAD_RULES,start).config.life},totals,foodLimitedActions:actions,
    runs:results.map(({daily,...r})=>r)};
  writeFileSync(new URL('../reports/'+name+'.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({sourceSha256:hash,count,horizon,totals,foodLimitedActions:actions},null,2));
}else{
  let source=readFileSync(new URL('../src/sim.js',import.meta.url),'utf8');
  const birthAnchor='  s.birthCounter = birthEligible ? s.birthCounter + 1 : 0;';
  const deathAnchor='  s.villagers = s.villagers.filter(v => v.health > 0 && v.age < c.life.death);';
  assert.equal(source.split(birthAnchor).length,2);assert.equal(source.split(deathAnchor).length,2);
  source=source.replace(birthAnchor,'  globalThis.__populationAudit?.({s,report,eligibleAdults,homePair,easternBirth,birthEligible,parentsAmong});\n'+birthAnchor)
    .replace(deathAnchor,'  globalThis.__populationDeaths?.(s,report);\n'+deathAnchor)
    .replace(/from '(\.\/[^']+)'/g,(_,relative)=>"from '"+new URL('../src/'+relative.slice(2),import.meta.url).href+"'");
  const {createState,stepDay}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  if(workerData.seeds.includes(0)){
    let plain=originalCreate(HOMESTEAD_RULES,0),observed=createState(HOMESTEAD_RULES,0);
    globalThis.__populationAudit=()=>{};globalThis.__populationDeaths=()=>{};
    for(let day=0;day<100&&!plain.ended;day++){plain=originalStep(plain);observed=stepDay(observed);assert.deepEqual(observed,plain);}
  }
  const inc=(object,key,n=1)=>{object[key]=(object[key]||0)+n;};
  for(const seed of workerData.seeds){
    let state=createState(HOMESTEAD_RULES,seed),latest;
    const counts={},daily=[],deaths=[],births=[],snapshots=[],foodLimitedActions={},generations=new Map(state.villagers.map(v=>[v.id,0])),matured=new Set();
    const unrelated=(a,b)=>!a.parents?.includes(b.id)&&!b.parents?.includes(a.id)&&!a.parents?.some(id=>b.parents?.includes(id));
    globalThis.__populationDeaths=(s,report)=>{
      for(const d of report.deaths){const v=s.villagers.find(v=>v.id===d.id);deaths.push({day:s.day,...d,age:v.age,gender:v.gender,tribe:v.tribe||0,generation:generations.get(v.id)||0,fullness:v.fullness,warmth:v.warmth,happiness:v.happiness});}
    };
    globalThis.__populationAudit=({s,report,eligibleAdults,homePair,easternBirth,birthEligible,parentsAmong})=>{
      const c=s.config,B=c.birth,n=s.villagers.length,cap=populationCap(s),threshold=B.foodPerPerson*n+B.extraFood;
      const fertile=s.villagers.filter(v=>v.age>=c.life.adult&&v.age<c.life.elder),post=s.local.daughter;
      const home=people=>people.filter(v=>!post?.members.includes(v.id)),east=people=>people.filter(v=>post?.members.includes(v.id));
      const regionalPair=people=>parentsAmong(home(people)).length===2||!!(post?.settled&&parentsAmong(east(people)).length===2&&post.food>=B.foodPerPerson*(post.members.length+1)+B.extraFood);
      const checks={health:v=>v.health>=B.health,fullness:v=>v.fullness>=B.fullness,warmth:v=>v.warmth>=B.warmth,happiness:v=>v.happiness>=B.happiness,illness:v=>!v.illnessDays};
      const qualifying=(skip=[],overrides={})=>fertile.filter(v=>Object.entries(checks).every(([key,test])=>skip.includes(key)||(overrides[key]??test)(v)));
      const cacheFood=Object.values(s.local.campStores||{}).reduce((sum,r)=>sum+(r.saved||0),0),canPair=homePair.length===2||!!easternBirth;
      const activeCamps=new Set(s.villagers.filter(v=>!post?.members.includes(v.id)).map(v=>v.tribe||0));
      const activeCacheFood=[...activeCamps].reduce((sum,camp)=>sum+(s.local.campStores[camp]?.saved||0),0);
      const chosenPair=easternBirth?parentsAmong(east(eligibleAdults)):homePair;
      const parentCamp=chosenPair[0]?.tribe||0,parentCacheFood=chosenPair.length===2&&!easternBirth?s.local.campStores[parentCamp]?.saved||0:0;
      const hasRoom=n<cap,food=s.food>=threshold,nonfood=hasRoom&&canPair;
      inc(counts,'birth_checks');if(!hasRoom)inc(counts,'blocked_cap');if(!food)inc(counts,'blocked_food');if(!canPair)inc(counts,'blocked_pair');
      if(food&&!hasRoom)inc(counts,'food_ready_but_cap');if(hasRoom&&food&&!canPair)inc(counts,'food_and_room_but_no_pair');
      if(nonfood&&!food)inc(counts,'food_only_blocker');if(nonfood&&!food&&s.food+cacheFood>=threshold)inc(counts,'cache_ignored_food_only_blocker');
      if(nonfood&&!food&&s.food+activeCacheFood>=threshold)inc(counts,'active_camp_cache_food_only_blocker');
      if(nonfood&&!food&&s.food+parentCacheFood>=threshold)inc(counts,'parent_camp_cache_food_only_blocker');
      if(nonfood&&!food&&s.food>=Math.ceil(1.5*n)+B.extraFood)inc(counts,'food_1_5_only_would_pass');
      if(birthEligible){inc(counts,'eligible_days');inc(counts,'would_birth_with_one_day');if(s.birthCounter>=1)inc(counts,'would_birth_with_two_days');}
      if(!birthEligible&&s.birthCounter>0)inc(counts,'broken_streaks');
      if(!birthEligible&&s.birthCounter>0){if(!food)inc(counts,'broken_streak_food');if(!canPair)inc(counts,'broken_streak_pair');if(!hasRoom)inc(counts,'broken_streak_cap');}
      const potential=regionalPair(fertile),withoutRecovery=regionalPair(fertile.map(v=>({...v,recoveryUntil:0})));
      if(!canPair){
        if(!fertile.some(v=>v.gender==='female')||!fertile.some(v=>v.gender==='male'))inc(counts,'no_reproductive_sex_balance');
        else if(!fertile.some(a=>a.gender==='female'&&fertile.some(b=>b.gender==='male'&&unrelated(a,b))))inc(counts,'no_unrelated_pair_anywhere');
        else if(!withoutRecovery)inc(counts,'no_same_camp_or_region_pair');
        else if(!potential)inc(counts,'recovery_blocks_potential_pair');
        else inc(counts,'parent_condition_blocks_pair');
        for(const key of Object.keys(checks))if(regionalPair(qualifying([key]))){inc(counts,'pair_if_relax_'+key);if(hasRoom&&food)inc(counts,'birth_conditions_if_relax_'+key);}
        if(regionalPair(qualifying([],{health:v=>v.health>=60}))&&hasRoom&&food)inc(counts,'birth_conditions_if_health_60');
        if(regionalPair(qualifying([],{happiness:v=>v.happiness>=40}))&&hasRoom&&food)inc(counts,'birth_conditions_if_happiness_40');
      }
      for(const key of Object.keys(checks))inc(counts,'fertile_person_days_failing_'+key,fertile.filter(v=>!checks[key](v)).length);
      inc(counts,'fertile_person_days',fertile.length);inc(counts,'person_days_at_check',n);if(n<6)inc(counts,'below_start_population_days');
      if(n>=8)inc(counts,'at_least_8_days');if(n>=12)inc(counts,'at_least_12_days');
      const row={seed,day:s.day,population:n,food:s.food,birth_food_required:threshold,saved_camp_food:cacheFood,active_camp_saved:activeCacheFood,parent_camp_saved:parentCacheFood,population_cap:cap,huts:(s.huts||[]).length,
        fertile_females:fertile.filter(v=>v.gender==='female').length,fertile_males:fertile.filter(v=>v.gender==='male').length,
        eligible_females:eligibleAdults.filter(v=>v.gender==='female').length,eligible_males:eligibleAdults.filter(v=>v.gender==='male').length,
        parent_pair_ready:canPair,food_ready:food,room_ready:hasRoom,birth_eligible:birthEligible,streak_before:s.birthCounter,
        season:s.local.season,health_mean:Number((s.villagers.reduce((t,v)=>t+v.health,0)/n).toFixed(2)),happiness_mean:Number((s.villagers.reduce((t,v)=>t+v.happiness,0)/n).toFixed(2))};
      daily.push(row);latest=row;
    };
    let firstHealer=null;
    while(!state.ended&&state.day<workerData.horizon){
      const previous=state;state=stepDay(state);const report=state.lastDay;
      if(report.birth!=null){const child=state.villagers.find(v=>v.id===report.birth),generation=1+Math.max(...child.parents.map(id=>generations.get(id)||0));generations.set(child.id,generation);
        births.push({day:state.day,id:child.id,gender:child.gender,parents:child.parents,generation,food:state.food,cap:populationCap(state)});}
      for(const v of state.villagers)if(generations.get(v.id)>0&&v.age>=state.config.life.adult)matured.add(v.id);
      if(firstHealer===null&&state.villagers.some(v=>v.herbalist))firstHealer=state.day;
      if(latest?.day===state.day&&!latest.food_ready)for(const action of report.actions)inc(foodLimitedActions,action.action);
      if(state.day%10===0||state.ended||report.birth!=null||report.deaths.length)snapshots.push({day:state.day,population:state.villagers.length,births:state.stats.births,deaths:state.stats.deaths,cap:populationCap(state)});
      if(state.day%100===0||state.ended){
        // Keep a short demographic tail to explain terminal age/kinship traps.
        snapshots.at(-1).people=state.villagers.map(v=>({id:v.id,age:v.age,gender:v.gender,tribe:v.tribe||0,parents:v.parents||[],health:v.health,happiness:v.happiness}));
      }
      assert.equal(state.stats.births,births.length);assert.equal(state.stats.deaths,deaths.length);
      assert.equal(state.villagers.length,6+births.length-deaths.length);
    }
    const populationAt=day=>{if(state.day<day)return state.ended?0:null;const snap=snapshots.find(r=>r.day===day);return snap?.population??null;};
    parentPort.postMessage({seed,observed_day:state.day,extinct:state.ended,population_day_100:populationAt(100),population_day_300:populationAt(300),population_day_1000:populationAt(1000),population_final:state.villagers.length,
      peak:state.stats.peak,births:births.length,deaths:deaths.length,child_deaths:deaths.filter(d=>d.age<state.config.life.adult).length,
      old_age_deaths:deaths.filter(d=>d.causes.includes('old age')).length,hunger_deaths:deaths.filter(d=>d.causes.includes('hunger')).length,
      cold_deaths:deaths.filter(d=>d.causes.includes('cold')).length,illness_deaths:deaths.filter(d=>d.causes.includes('illness')).length,
      first_birth_day:births[0]?.day??null,last_birth_day:births.at(-1)?.day??null,founder_children:births.filter(b=>b.generation===1).length,later_generation_births:births.filter(b=>b.generation>1).length,
      born_reached_adulthood:matured.size,huts_final:(state.huts||[]).length,farm_day:state.stats.farmDay,healer_day:firstHealer,counts,foodLimitedActions,birthRecords:births,deathRecords:deaths,snapshots,daily});
  }
}
