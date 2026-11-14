// Hands-off progression check; no god commands, seeded unlocks or stock gifts.
import {Worker,isMainThread,workerData,parentPort} from 'node:worker_threads';
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {createState,stepDay} from '../src/sim.js';
import {HOMESTEAD_RULES} from '../src/config.js';
const root=new URL('../',import.meta.url);
function sourceHash(){const h=createHash('sha256');for(const file of readdirSync(new URL('src/',root)).filter(f=>f.endsWith('.js')).sort())h.update(file).update(readFileSync(new URL('src/'+file,root)));return h.digest('hex');}
if(isMainThread){
  const hash=sourceHash(),runs=[],groups=Array.from({length:4},()=>[]);
  for(let seed=0;seed<10;seed++)groups[seed%4].push(seed);
  await Promise.all(groups.map(seeds=>new Promise((resolve,reject)=>{
    const w=new Worker(new URL(import.meta.url),{workerData:{seeds}});
    w.on('message',row=>{runs.push(row);console.log(JSON.stringify(row));});w.on('error',reject);w.on('exit',code=>code?reject(Error('worker '+code)):resolve());
  })));
  assert.equal(sourceHash(),hash,'Source changed during run');runs.sort((a,b)=>a.seed-b.seed);
  const result={sourceSha256:hash,horizon:1200,seeds:runs.map(r=>r.seed),method:'Ten fresh seeds, six founders, live rules, no interventions. Timing of actual work is separate from discovery. This progression sample is not a new estimate of long-term ending odds.',runs};
  writeFileSync(new URL('reports/wheat-progression-10-20261114.json',root),JSON.stringify(result,null,2)+'\n');
  const bakers=runs.filter(r=>r.firstBread!==null),totalBread=runs.reduce((n,r)=>n+r.bread,0);
  const lines=['# Wheat progression — ten hands-off villages','',
    'Fresh seeds 0–9, six founders each, up to day 1,200. No commands, gifts or forced discoveries.',
    '',`${runs.filter(r=>r.cultivation!==null).length}/10 learned wheat cultivation; ${bakers.length}/10 baked bread. First baking in successful chains ranged from day ${Math.min(...bakers.map(r=>r.firstBread))} to ${Math.max(...bakers.map(r=>r.firstBread))}. Total bread: ${totalBread} portions.`,
    '', 'These are progression observations. Villages can die before the cereal transition or lose a technique afterwards. This sample does not establish permanent survival or replace the earlier day-3,000 ending audit.',
    '', '| Seed | Wheat learned | First sowing | First grain | First quern | First milling | First bread | Bread portions | Cereal lessons completed |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|'];
  for(const r of runs)lines.push('| '+[r.seed,r.cultivation??'—',r.sowing??'—',r.firstHarvest??'—',r.quern??'—',r.firstMill??'—',r.firstBread??'—',r.bread,r.lessons].join(' | ')+' |');
  lines.push('', 'Knowledge and physical equipment are measured separately. A quern can remain after its maker dies. Bread portions are cumulative production, not uneaten stock. Completed local cereal lessons require both people to spend actual workdays together.', '', `Source SHA-256: \`${hash}\`.`, '', 'Reproduce with `node scripts/wheat-report.mjs`.');
  writeFileSync(new URL('reports/wheat-progression-10-20261114.md',root),lines.join('\n')+'\n');
}else for(const seed of workerData.seeds){
  let s=createState(HOMESTEAD_RULES,seed),firstHarvest=null,firstBread=null,firstMill=null,foodWorkdays=0,hungerDeaths=0,lessons=0;
  while(!s.ended&&s.day<1200){
    s=stepDay(s);const r=s.lastDay;
    if(r.wheatHarvests?.length)firstHarvest??=s.day;if(r.baking?.length)firstBread??=s.day;
    if(r.actions.some(a=>a.action==='Grind wheat into flour'))firstMill??=s.day;
    foodWorkdays+=r.actions.filter(a=>['Sow wheat','Harvest wheat','Grind wheat into flour','Bake hearth flatbread'].includes(a.action)).length;
    hungerDeaths+=r.deaths.filter(d=>d.causes.includes('hunger')).length;
    lessons+=s.local.events.filter(e=>e.day===s.day&&/learned (Wheat cultivation|Saddle-quern making|Whole-grain milling|Hearth flatbread) in lessons/.test(e.text)).length;
    assert.equal(s.villagers.length,6+s.stats.births-s.stats.deaths);
    assert.ok(s.food>=0&&Object.values(s.local.stock).every(n=>n>=0));
  }
  parentPort.postMessage({seed,day:s.day,population:s.villagers.length,peak:s.stats.peak,extinct:s.ended,
    cultivation:s.local.first.wheatgrowing??null,sowing:s.local.first.wheatSown??null,firstHarvest,
    quern:s.farming.querns[0]?.day??null,firstMill,firstBread,bread:s.farming.breadBaked||0,foodWorkdays,lessons,hungerDeaths,
    wheat:s.local.stock.wheat,flour:s.local.stock.flour,querns:s.farming.querns.length});
}
