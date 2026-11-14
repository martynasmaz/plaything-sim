import {createState,stepDay} from '../src/sim.js';
import {HOMESTEAD_RULES} from '../src/config.js';
import {villageLivestock} from '../src/husbandry.js';
import {writeFile} from 'node:fs/promises';
import {serialize} from '../src/save.js';
import {SCENARIO} from '../src/scenario.js';
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';

const count=Number(process.argv[2]||10),days=Number(process.argv[3]||1000),first=Number(process.argv[4]||50),out=process.argv[5]||'reports/husbandry-pilot.json';
const fingerprint=data=>createHash('sha256').update(data).digest('hex');
const metadata={scenario:structuredClone(SCENARIO),settingsHash:fingerprint(JSON.stringify(SCENARIO)),sourceHash:fingerprint(readdirSync(new URL('../src/',import.meta.url)).filter(f=>f.endsWith('.js')).sort().map(f=>f+'\n'+readFileSync(new URL('../src/'+f,import.meta.url),'utf8')).join('\n')),comparison:'identical seeds and settings, husbandry disabled/enabled'};
const runs=[];
for(let seed=first;seed<first+count;seed++){
  const pair={seed};
  for(const enabled of [false,true]){
    let s=createState({...HOMESTEAD_RULES,learning:{...HOMESTEAD_RULES.learning,husbandry:enabled}},seed);
    const actions={},firstDays={},maxAnimals={sheep:0,pig:0,cattle:0};let invalid=null;
    while(s.day<days&&!s.ended){
      s=stepDay(s);
      const ids=s.lastDay?.actions.map(a=>a.id)||[];
      if(new Set(ids).size!==ids.length)throw Error('Duplicate daily action at '+seed+'/'+s.day);
      for(const [key,n] of Object.entries({food:s.food,wood:s.wood,...s.local.stock}))if(!Number.isFinite(n)||n<-.00001)throw Error('Invalid stock '+key+' '+n+' at '+seed+'/'+s.day);
      for(const a of s.lastDay?.actions||[])if(/livestock|herd|hay|Milk |fleece|wool|curds|compost|yoke/.test(a.action)){actions[a.action]=(actions[a.action]||0)+1;firstDays[a.action]??=s.day;}
      for(const species of Object.keys(maxAnimals))maxAnimals[species]=Math.max(maxAnimals[species],villageLivestock(s).filter(a=>a.species===species).length);
    }
    const h=s.local.husbandry;
    pair[enabled?'husbandry':'baseline']={day:s.day,population:s.ended?0:s.villagers.length,births:s.stats.births,deaths:s.stats.deaths,food:s.food,
      contact:h?.contacts.herders?.day,pens:h?.pens.map(p=>({camp:p.camp,work:p.work,shelter:p.shelterWork,grass:p.grass,mast:p.mast,dung:p.dung})),
      maxAnimals,animals:villageLivestock(s).length,stats:h?.stats,actions,firstDays,knowledge:Object.fromEntries(['herding','penbuilding','haymaking','stockshelter','milking','curdling','fleeceworking','woolspinning','woolweaving','woolclothing','composting','oxtraining'].map(id=>[id,s.villagers.filter(v=>v.practice.known[id]).length])),
      regional:h&&Object.fromEntries(['sheep','pig','cattle'].map(k=>[k,h.animals.filter(a=>a.location==='regional'&&a.status==='alive'&&a.species===k).length])),
      animalRecords:h?.animals.filter(a=>a.location==='village').map(a=>({id:a.id,species:a.species,sex:a.sex,age:a.age,acquiredDay:a.acquiredDay,bornDay:a.bornDay,status:a.status,cause:a.deathCause,deathDay:a.deathDay,motherId:a.motherId,fatherId:a.fatherId,condition:a.condition,health:a.health})),invalid};
    if(enabled&&process.argv[6]==='save')await writeFile(out.replace(/\.json$/,'.save.json'),serialize(s));
  }
  runs.push(pair);console.log(JSON.stringify({seed,baseline:pair.baseline.population,population:pair.husbandry.population,contact:pair.husbandry.contact,animals:pair.husbandry.animals,maxAnimals:pair.husbandry.maxAnimals}));
  await writeFile(out,JSON.stringify({metadata,days,first,count,complete:runs.length,runs},null,2)+'\n');
}
