// Paired natural runs: the only intervention in the enabled arm is typing magic.
import {Worker,isMainThread,workerData,parentPort} from 'node:worker_threads';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {createState,stepDay,castText} from '../src/sim.js';
import {HOMESTEAD_RULES} from '../src/config.js';
import {magicEnabled} from '../src/magic.js';
const sourceHash=()=>{
  const hash=createHash('sha256');
  for(const name of ['config','needs','fishing','settlement-layout','healer-home','magic','farming','village-events','ecology','practices','sim'])
    hash.update(readFileSync(new URL('../src/'+name+'.js',import.meta.url)));
  return hash.digest('hex');
};
if(isMainThread){
  const [countText='10',horizonText='1000',name='folk-practices-10']=process.argv.slice(2);
  const count=Number(countText),horizon=Number(horizonText),hash=sourceHash();
  if(![count,horizon].every(n=>Number.isSafeInteger(n)&&n>0)||!/^[a-zA-Z0-9_-]+$/.test(name))throw Error('Invalid arguments');
  const results=[],groups=Array.from({length:Math.min(6,count)},()=>[]);
  for(let seed=0;seed<count;seed++)groups[seed%groups.length].push(seed);
  await Promise.all(groups.map(seeds=>new Promise((resolve,reject)=>{
    const w=new Worker(new URL(import.meta.url),{workerData:{seeds,horizon}});
    w.on('message',r=>{results.push(r);if(results.length%5===0)console.log(results.length+'/'+(count*2)+' paired runs measured');});
    w.on('error',reject);w.on('exit',code=>code?reject(Error('Worker exit '+code)):resolve());
  })));
  assert.equal(sourceHash(),hash,'Rules changed during measurement');
  results.sort((a,b)=>a.seed-b.seed||Number(a.magic)-Number(b.magic));
  const summary={sourceSha256:hash,seeds:count,horizon,
    method:'Seeds 0 through count-1, each run twice with current HOMESTEAD_RULES. No interventions in controls; only castText(state,"magic") at day 0 in enabled runs. Observe until horizon or extinction. No material, knowledge, population or weather edits.',
    arms:[false,true].map(enabled=>{
      const arm=results.filter(r=>r.magic===enabled);
      return {magic:enabled,runs:arm.length,survived:arm.filter(r=>!r.extinct).length,
        villagesWithDiviningBones:arm.filter(r=>r.bones_day!==null).length,
        villagesWithRites:arm.filter(r=>r.rites>0).length,
        rites:arm.reduce((n,r)=>n+r.rites,0),
        methods:Object.fromEntries(['foretelling','hearthcharms','mendingrites','storewards'].map(id=>[id,arm.reduce((n,r)=>n+r[id],0)])),
        villagesLearningBoneFertilizer:arm.filter(r=>r.bonemeal_day!==null).length,
        bonesGround:arm.reduce((n,r)=>n+r.bones_ground,0),fertilizerApplications:arm.reduce((n,r)=>n+r.applications,0),
        fertilizedHarvests:arm.reduce((n,r)=>n+r.fertilized_harvests,0),bonusFood:arm.reduce((n,r)=>n+r.bonus_food,0)};
    })};
  const keys=Object.keys(results[0]);
  writeFileSync(new URL('../reports/'+name+'.csv',import.meta.url),keys.join(',')+'\n'+results.map(r=>keys.map(k=>r[k]??'').join(',')).join('\n')+'\n');
  writeFileSync(new URL('../reports/'+name+'.json',import.meta.url),JSON.stringify(summary,null,2)+'\n');
  console.log(JSON.stringify(summary,null,2));
}else{
  for(const seed of workerData.seeds)for(const enabled of [false,true]){
    let s=createState(HOMESTEAD_RULES,seed);if(enabled)s=castText(s,'magic').state;
    const r={seed,magic:enabled,bones_day:null,bonemeal_day:null,rites:0,foretelling:0,hearthcharms:0,mendingrites:0,storewards:0,
      bones_ground:0,applications:0,fertilized_harvests:0,bonus_food:0};
    while(!s.ended&&s.day<workerData.horizon){
      s=stepDay(s);assert.equal(magicEnabled(s),enabled);
      if(s.villagers.some(v=>v.practice.gear['casting bones']))r.bones_day??=s.day;
      if(s.villagers.some(v=>v.practice.known.bonemeal))r.bonemeal_day??=s.day;
      for(const rite of s.lastDay.magic||[]){r[rite.spell]++;r.rites++;}
      for(const batch of s.lastDay.fertilizerPrepared||[])r.bones_ground+=batch.bone;
      r.applications+=(s.lastDay.fertilizerApplied||[]).length;
      for(const harvest of s.lastDay.boneFertilizerHarvests||[]){r.fertilized_harvests++;r.bonus_food+=harvest.bonus;}
    }
    if(!enabled)assert.equal(r.rites,0,'magic must remain dormant without its command');
    parentPort.postMessage({...r,observed_day:s.day,extinct:s.ended,population:s.villagers.length});
  }
}
