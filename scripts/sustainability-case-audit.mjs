// Observe the real simulation from a frozen source snapshot. No rule patches.
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);
const source=new URL(workerData?.source||process.argv[4]||'../reports/audit-source-before-weather-20261114/',import.meta.url);
const hash=()=>{const h=createHash('sha256');for(const f of readdirSync(source).filter(f=>f.endsWith('.js')).sort())h.update(f).update(readFileSync(new URL(f,source)));return h.digest('hex');};
if(isMainThread){
  const label=process.argv[2]||'before-weather',horizon=Number(process.argv[3]||3000),sourceSha256=hash(),runs=[];
  assert.match(label,/^[a-z0-9-]+$/);
  await Promise.all([[0,2,4,6,8],[1,3,5,7,9]].map(seeds=>new Promise((resolve,reject)=>{
    const w=new Worker(new URL(import.meta.url),{workerData:{seeds,horizon,source:source.href}});
    w.on('message',r=>{runs.push(r);console.log(JSON.stringify({seed:r.seed,day:r.day,population:r.population,bread:r.bread,rawFoodHungerDays:r.rawFoodHungerDays,lessons:r.lessons}));});
    w.on('error',reject);w.on('exit',code=>code?reject(Error('worker '+code)):resolve());
  })));
  assert.equal(hash(),sourceSha256,'Audited source snapshot changed');runs.sort((a,b)=>a.seed-b.seed);
  writeFileSync(new URL('reports/sustainability-'+label+'-10-20261114.json',root),JSON.stringify({source:source.href,sourceSha256,horizon,method:'Seeds 0–9, direct stepDay, no interventions or source instrumentation. Before/after stock and individual knowledge observed separately from decisions.',runs},null,2)+'\n');
}else{
  const {createState,stepDay,populationCap}=await import(new URL('sim.js',source));
  const {HOMESTEAD_RULES}=await import(new URL('config.js',source));
  const {practices,canExperiment}=await import(new URL('practices.js',source));
  const {foodLedger,communityOf}=await import(new URL('provisions.js',source));
  const ids=['wheatgrowing','quernmaking','milling','breadmaking'];
  for(const seed of workerData.seeds){
    let s=createState(HOMESTEAD_RULES,seed),personDays=0,hungryPersonDays=0,rawFoodHungerDays=0,flourHungerDays=0,noBakerHungerDays=0,noMillerHungerDays=0,lessons=0;
    const seasons={},actions={},snapshots=[],losses=[],rawFoodExamples=[],food={gathered:0,meals:0,bread:0,gardens:0,fish:0,forage:0,hunt:0},knownBefore={};
    let postWheatDays=0,childDays=0,capDays=0;
    while(!s.ended&&s.day<workerData.horizon){
      const previous=s,ledger=foodLedger(s);s=stepDay(s);const r=s.lastDay;
      personDays+=previous.villagers.length;childDays+=previous.villagers.filter(v=>v.age<s.config.life.adult).length;
      const season=seasons[s.local.season]??={days:0,personDays:0,births:0,deaths:0,hungerDeaths:0,hungryPersonDays:0,food:0,meals:0};
      season.days++;season.personDays+=previous.villagers.length;season.births+=(r.births??(r.birth!=null?[r.birth]:[])).length;season.deaths+=r.deaths.length;
      season.hungerDeaths+=r.deaths.filter(d=>d.causes.includes('hunger')).length;
      const hungry=r.beforeMeals.filter(v=>v.fullness<=s.config.needs.damageAtOrBelow&&!r.meals.includes(v.id));
      hungryPersonDays+=hungry.length;season.hungryPersonDays+=hungry.length;
      food.gathered+=r.gatheredFood;food.meals+=r.meals.length;season.food+=r.gatheredFood;season.meals+=r.meals.length;
      const knowledge=Object.fromEntries(ids.map(id=>[id,s.villagers.filter(v=>v.practice.known[id]).length]));
      if(s.local.first.wheatgrowing!=null)postWheatDays++;
      if(s.villagers.length>=populationCap(s))capDays++;
      const raw=s.local.stock.wheat>=8,flour=s.local.stock.flour>=4;
      if(hungry.length&&(raw||flour)){
        rawFoodHungerDays++;if(flour)flourHungerDays++;
        if(!knowledge.breadmaking)noBakerHungerDays++;
        if(raw&&!knowledge.milling)noMillerHungerDays++;
        if(rawFoodExamples.length<8)rawFoodExamples.push({day:s.day,season:s.local.season,population:s.villagers.length,hungry:hungry.length,wheat:s.local.stock.wheat,flour:s.local.stock.flour,wood:s.wood,knowledge,actions:r.actions.map(a=>a.action)});
      }
      for(const a of r.actions){actions[a.action]=(actions[a.action]||0)+1;
        if(a.action==='Harvest')food.gardens+=a.gained;
        if(a.action==='Fish')food.fish+=a.gained;
        if(a.action==='Forage')food.forage+=a.gained;
        if(a.action==='Hunt'||a.action.startsWith('Track '))food.hunt+=a.gained;
      }
      food.bread+=(r.baking||[]).reduce((n,b)=>n+b.food,0);
      lessons+=s.local.events.filter(e=>e.day===s.day&&/learned (Wheat cultivation|Saddle-quern making|Whole-grain milling|Hearth flatbread) in lessons/.test(e.text)).length;
      for(const id of ids){
        if(knownBefore[id]>0&&!knowledge[id]){
          const candidates=s.villagers.filter(v=>canExperiment(s,v,practices[id]));
          losses.push({day:s.day,id,population:s.villagers.length,querns:s.farming.querns.length,wheat:s.local.stock.wheat,flour:s.local.stock.flour,quernStone:s.local.stock.quernStone,stoneDeposit:s.local.deposits.quernStone,eligibleToRediscover:candidates.length,
            missingPrerequisites:s.villagers.reduce((n,v)=>n+Number(!practices[id].requires.every(k=>v.practice.known[k])),0)});
        }knownBefore[id]=knowledge[id];
      }
      if(s.day%20===0||s.ended)snapshots.push({day:s.day,population:s.villagers.length,adults:s.villagers.filter(v=>v.age>=s.config.life.adult).length,food:s.food,edible:foodLedger(s).home,wheat:s.local.stock.wheat,flour:s.local.stock.flour,wood:s.wood,knowledge,births:s.stats.births,deaths:s.stats.deaths});
      assert.equal(s.villagers.length,6+s.stats.births-s.stats.deaths);
      assert.ok(ledger.home>=0&&foodLedger(s).home>=0);
    }
    parentPort.postMessage({seed,day:s.day,population:s.villagers.length,peak:s.stats.peak,births:s.stats.births,deaths:s.stats.deaths,bread:s.farming.breadBaked||0,personDays,childDays,hungryPersonDays,postWheatDays,rawFoodHungerDays,flourHungerDays,noBakerHungerDays,noMillerHungerDays,capDays,lessons,food,seasons,actions,losses,rawFoodExamples,snapshots});
  }
}
