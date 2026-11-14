import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,stepDay,castText} from '../src/sim.js';
import {HOMESTEAD_RULES} from '../src/config.js';
import {serialize,deserialize} from '../src/save.js';
import {settlementEvent} from '../src/practices.js';
import {observeEvents,preserveBirthHistory,villageEventKind} from '../src/village-events.js';

test('population periods reconcile births, settlers, deaths and exposure across a save',()=>{
  let s=createState(HOMESTEAD_RULES,4),exposure=0;
  const founders=s.villagers.length;
  s.villagers[0].age=s.config.life.death-1;
  for(let i=0;i<23;i++){
    if(i===5)s=castText(s,'spawn people 3').state;
    exposure+=s.villagers.length;s=stepDay(s);
    if(i===12)s=deserialize(serialize(s),HOMESTEAD_RULES);
  }
  const h=s.local.populationHistory,sum=k=>h.reduce((n,p)=>n+p[k],0);
  assert.deepEqual(h.map(p=>[p.first,p.last]),[[1,20],[21,23]]);
  assert.ok(sum('oldAge')>=1);assert.equal(sum('personDays'),exposure);
  assert.equal(sum('deaths'),s.stats.deaths);assert.equal(sum('births'),s.stats.births);
  assert.equal(founders+3+sum('births')-sum('deaths'),s.villagers.length);
  delete s.local.populationHistory;
  assert.equal(stepDay(s).local.populationHistory[0].first,24);
});
test('births have a dated permanent record with parents and survive the recent event limit and save/load',()=>{
  const rules={...HOMESTEAD_RULES,traits:false,birth:{...HOMESTEAD_RULES.birth,consecutiveDays:1},illness:{chance:0},
    weather:{chances:{normal:100,rain:0,drought:0,cold:0}}};
  let s=createState(rules,4);s.food=100;s.wood=40;s.fireKnown=true;
  for(const v of s.villagers)v.health=v.fullness=v.warmth=v.happiness=100;
  s=stepDay(s);assert.ok(s.lastDay.birth);
  const birth=s.local.birthHistory[0];assert.equal(birth.type,'birth');assert.equal(birth.day,1);
  assert.equal(birth.id,s.lastDay.birth);assert.equal(birth.parentNames.length,2);assert.match(birth.text,/was born to/);
  for(let i=0;i<120;i++)settlementEvent(s,'A craft was practised '+i+'.');
  assert.equal(s.local.events.some(e=>e.type==='birth'),false);
  const loaded=deserialize(serialize(s),rules);assert.deepEqual(observeEvents(loaded.local,'births'),[birth]);
  const spawned=castText(loaded,'spawn people 2').state;assert.deepEqual(spawned.local.birthHistory,[birth]);
});
test('birth, death and combined filters return dated life events once, newest first, without mutating history',()=>{
  const birth={day:2,type:'birth',name:'Aiste',text:'Aiste was born to Rasa and Jonas.'};
  const death={day:3,type:'death',text:'Jonas died of old age.'};
  const local={events:[birth,{day:3,text:'The last practitioner of knapping died.'},death,{day:4,text:'A net was made.'}],
    birthHistory:[birth],deathHistory:[death]};
  const before=structuredClone(local);
  assert.deepEqual(observeEvents(local,'births'),[birth]);assert.deepEqual(observeEvents(local,'deaths'),[death]);
  assert.deepEqual(observeEvents(local,'life'),[death,birth]);
  assert.equal(observeEvents(local,'other').some(e=>e.type==='death'),false);
  assert.ok(observeEvents(local,'other').some(e=>e.type==='birth'));
  assert.equal(observeEvents(local,'all').filter(e=>e.type==='birth').length,1);assert.deepEqual(local,before);
});
test('older saves retain available birth entries without duplicating eastern births or fabricating missing history',()=>{
  const s=createState(HOMESTEAD_RULES,4);delete s.local.birthHistory;s.stats.births=20;
  s.local.events=[{day:5,text:'Rasa was born in the eastern village.'},{day:5,text:'Rasa was born.'},
    {day:6,text:'Jonas died.'},{day:7,text:'A household left camp.'}];
  const loaded=deserialize(serialize(s),HOMESTEAD_RULES);
  assert.equal(loaded.local.birthHistory.length,1);assert.match(loaded.local.birthHistory[0].text,/eastern village/);
  assert.equal(observeEvents(loaded.local,'births').length,1);assert.equal(observeEvents(loaded.local,'deaths').length,1);
  assert.equal(villageEventKind({text:'The last practitioner of knapping died.'}),'other');
  preserveBirthHistory(loaded.local);assert.equal(loaded.local.birthHistory.length,1);
});
