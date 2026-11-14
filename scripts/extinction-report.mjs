import {Worker,isMainThread,workerData,parentPort} from 'node:worker_threads';
import {readFileSync,writeFileSync} from 'node:fs';
import {createState,stepDay} from '../src/sim.js';
import {HOMESTEAD_RULES} from '../src/config.js';
const report=new URL('../reports/extinction-100.csv',import.meta.url);
if(isMainThread){
  const baselines=readFileSync(new URL('../reports/hands-off-100.csv',import.meta.url),'utf8').trim().split(/\r?\n/).slice(1).map(line=>line.split(','));
  const results=[];
  function save(){writeFileSync(report,'seed,extinction_day,population_day_1000\n'+results.sort((a,b)=>a.seed-b.seed).map(r=>[r.seed,r.day,r.pop].join(',')).join('\n')+'\n');}
  const groups=Array.from({length:6},()=>[]);
  for(const [seed,day,ended,pop] of baselines)groups[Number(seed)%6].push({seed:+seed,day:+day,ended:ended==='true',pop:+pop});
  await Promise.all(groups.map(group=>new Promise((resolve,reject)=>{
    const w=new Worker(new URL(import.meta.url),{workerData:group});w.on('message',r=>{results.push(r);save();if(results.length%10===0)console.log(results.length,'finished; maximum extinction day so far',Math.max(...results.map(x=>x.day)));});w.on('error',reject);w.on('exit',code=>code?reject(Error('Worker exit '+code)):resolve());
  })));
}else{
  for(const base of workerData){let s=createState(HOMESTEAD_RULES,base.seed),pop=0;
    while(!s.ended){s=stepDay(s);
      if(s.day===base.day&&(s.ended!==base.ended||s.villagers.length!==base.pop))throw Error('Day 650 batch mismatch on seed '+base.seed);
      if(s.day===1000)pop=s.villagers.length;
    }
    if(base.ended&&base.day!==s.day)throw Error('Extinction mismatch');
    parentPort.postMessage({seed:base.seed,day:s.day,pop});
  }
}
