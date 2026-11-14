import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);
const source=workerData?.source||new URL(process.argv[6]||'../src/',import.meta.url).href;
function sourceHash(url){const h=createHash('sha256');for(const f of readdirSync(new URL(url)).filter(f=>f.endsWith('.js')).sort())h.update(f).update(readFileSync(new URL(f,url)));return h.digest('hex');}
if(isMainThread){
  const [name='growth-pilot',countText='10',firstText='0',variantsText='baseline,control,fields,planning,roles,families,all']=process.argv.slice(2);
  assert.match(name,/^[a-z0-9-]+$/);const count=Number(countText),first=Number(firstText),variants=variantsText.split(','),jobs=[];
  for(const variant of variants)for(let seed=first;seed<first+count;seed++)jobs.push({variant,seed});
  const hash=sourceHash(source),baselineSource=new URL('../reports/growth-baseline-source-20261114/',import.meta.url).href;
  const baselineHash=sourceHash(baselineSource),runs=[];
  const groups=Array.from({length:4},(_,i)=>jobs.filter((_,j)=>j%4===i));
  await Promise.all(groups.map(jobs=>new Promise((resolve,reject)=>{
    const worker=new Worker(new URL(import.meta.url),{workerData:{jobs,source,baselineSource}});
    worker.on('message',row=>{runs.push(row);console.log(JSON.stringify({variant:row.variant,seed:row.seed,population:row.population,fields:row.fields,births:row.births,day:row.day}));});
    worker.on('error',reject);worker.on('exit',code=>code?reject(Error('Worker '+code)):resolve());
  })));
  assert.equal(hash,sourceHash(source));assert.equal(baselineHash,sourceHash(baselineSource));
  runs.sort((a,b)=>a.variant.localeCompare(b.variant)||a.seed-b.seed);
  const summary=variants.map(variant=>{const rows=runs.filter(r=>r.variant===variant),mean=k=>rows.reduce((n,r)=>n+r[k],0)/rows.length;return {variant,runs:rows.length,alive:rows.filter(r=>r.population>0).length,meanPopulation:mean('population'),annualPopulation:mean('annualPopulation'),meanFields:mean('fields'),meanBirths:mean('births'),meanHungerDeaths:mean('hungerDeaths'),meanFoodDays:mean('foodDays'),specialists:mean('specialists')};});
  const result={horizon:1000,source,sourceSha256:hash,baselineSource,baselineSha256:baselineHash,seeds:[first,first+count-1],method:'Hands-off; six founders; all worlds counted, extinct worlds zero. Annual population averages days 921–1000. No source instrumentation, immigration, god actions or magic.',summary,runs};
  writeFileSync(new URL('reports/'+name+'.json',root),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(summary));
}else{
  const cache=new Map();
  for(const {variant,seed} of workerData.jobs){
    const url=variant==='baseline'?workerData.baselineSource:source;
    if(!cache.has(url))cache.set(url,{sim:await import(new URL('sim.js',url)),rules:(await import(new URL('config.js',url))).HOMESTEAD_RULES});
    const {sim,rules}=cache.get(url),flags=Object.fromEntries(['fields','planning','roles','families'].map(k=>[k,variant==='all'||variant===k]));
    let s=sim.createState(variant==='baseline'?rules:{...rules,learning:{...rules.learning,development:flags}},seed);
    const snapshots=[{day:0,population:6}],occupations={},acts={};let annual=0,hungerDeaths=0,foodBlocked=0,capBlocked=0,apprentices=0;
    for(let day=1;day<=1000;day++){
      if(!s.ended){s=sim.stepDay(s);const r=s.lastDay;
        hungerDeaths+=r.deaths.filter(d=>d.causes.includes('hunger')).length;
        foodBlocked+=Number(s.local.birthConditions?.includes('food'));capBlocked+=Number(s.local.birthConditions?.includes('cap'));
        apprentices+=(r.apprenticeships||[]).length;
        for(const a of r.actions)acts[a.action]=(acts[a.action]||0)+1;
        assert.equal(s.villagers.length,6+s.stats.births-s.stats.deaths);
        assert.ok(Number.isInteger(s.food)&&s.food>=0&&s.wood>=0&&Object.values(s.local.stock).every(n=>n>=0));
        assert.ok(Object.values(s.local.campStores).every(r=>Number.isInteger(r.saved)&&r.saved>=0&&Number.isInteger(r.rack)&&r.rack>=0),'preserved meals must remain whole and nonnegative');
      }
      if(day>=921)annual+=s.villagers.length;
      if(day%20===0)snapshots.push({day,population:s.villagers.length,fields:s.farming.plots.length});
    }
    for(const v of s.villagers)if(v.practice.occupation)occupations[v.practice.occupation.role]=(occupations[v.practice.occupation.role]||0)+1;
    const food=s.food+Object.values(s.local.campStores).reduce((n,r)=>n+r.saved,0)+(s.local.daughter?.food||0);
    parentPort.postMessage({variant,seed,day:s.day,population:s.villagers.length,annualPopulation:annual/80,births:s.stats.births,deaths:s.stats.deaths,hungerDeaths,
      fields:s.farming.plots.length,markers:s.villagers.filter(v=>v.practice.gear['plot markers']).length,fieldKnowledge:s.villagers.filter(v=>v.practice.known.fieldplanning).length,
      food:s.villagers.length?food:0,foodDays:s.villagers.length?food/s.villagers.length:0,wheat:s.local.stock.wheat,flour:s.local.stock.flour,bread:s.farming.breadBaked||0,
      specialists:Object.values(occupations).reduce((n,x)=>n+x,0),occupations,foodBlocked,capBlocked,apprentices,acts,snapshots});
  }
}
