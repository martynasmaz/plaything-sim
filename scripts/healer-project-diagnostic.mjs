// Observe stalls with the current rules, without commands or state edits.
import {createState,stepDay} from '../src/sim.js';
import {HOMESTEAD_RULES} from '../src/config.js';
import {assessNeeds} from '../src/needs.js';
import {writeFileSync} from 'node:fs';
const results=[];
const name=process.argv[2]||'healer-project-diagnostic-local';
if(!/^[a-zA-Z0-9_-]+$/.test(name))throw Error('Invalid report name');
for(const seed of [1,4,18]){
  let s=createState(HOMESTEAD_RULES,seed);const blocks={},actions={},decisions={};
  const count=(obj,key)=>obj[key]=(obj[key]||0)+1;
  while(!s.ended&&s.day<1000){
    s=stepDay(s);const home=s.local.healerHome;if(!home||home.work>=6)continue;
    const healer=s.villagers.find(v=>v.herbalist);
    if(!healer){count(blocks,'no living healer');continue;}
    const p=healer.practice,job=s.lastDay.actions.find(a=>a.id===healer.id)?.action;
    count(actions,job);
    if(s.lastDay.healerProject)count(decisions,s.lastDay.healerProject.reason);
    // End-of-day snapshots of potentially overlapping conditions, not an
    // assertion that a particular guard fired at the start of work.
    if(assessNeeds(s,healer).level<2)count(blocks,'food/fuel/warmth/health/shelter need');
    if(healer.health<65)count(blocks,'health below construction threshold');
    if(p.energy<32)count(blocks,'low energy');
    if(!p.known.housing||!p.known.cordage||p.skills.wood<3)count(blocks,'missing construction knowledge/skill');
    if(s.villagers.some(v=>v.age<s.config.life.adult&&v.carers?.includes(healer.id)))count(blocks,'dependent child');
    if(!healer.traits.includes('Loner')&&!(p.curiosity>=.65&&healer.herbalist.visits>=3))count(blocks,'quiet preference absent');
  }
  results.push({seed,observedDay:s.day,project:s.local.healerHome,blocks,actions,decisions});
}
writeFileSync(new URL('../reports/'+name+'.json',import.meta.url),JSON.stringify({
  note:'Conditions overlap and were sampled after work; actions are actual completed workdays. Quiet preference and child care apply to choosing/moving home, not continuing paid construction.',results},null,2)+'\n');
console.log(JSON.stringify(results.map(({seed,project,decisions})=>({seed,work:project?.work,decisions})),null,2));
