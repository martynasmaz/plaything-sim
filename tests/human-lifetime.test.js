import test from 'node:test';
import assert from 'node:assert/strict';
import {CONFIG,HOMESTEAD_RULES} from '../src/config.js';
import {SCENARIO,validateScenario} from '../src/scenario.js';
import {createState,stepDay,unrelated,populationCap} from '../src/sim.js';
import {planFamilyBirths} from '../src/families.js';
import {familyDesire} from '../src/family-motivation.js';
import {regularWorkSafe} from '../src/development.js';
import {serialize,deserialize} from '../src/save.js';

const calm={...HOMESTEAD_RULES,traits:false,illness:{chance:0},weather:{chances:{normal:100,rain:0,drought:0,cold:0}},
  learning:{...HOMESTEAD_RULES.learning,climate:false,experimentChance:0,spoilage:0}};
test('short childhood, long adult life and two-year spacing share the agreed seasonal clock',()=>{
  const c=HOMESTEAD_RULES,year=c.learning.seasonLength*4;
  assert.equal(c.childhood.infantUntil,4);assert.equal(c.childhood.helperUntil,12);assert.equal(c.childhood.careFromAge,5);assert.equal(c.life.adult,20);
  assert.equal(year,80);assert.equal(c.life.elder/year,60);assert.equal(c.life.death/year,80);
  assert.equal(c.birth.recoveryDays+c.birth.consecutiveDays-1,2*year);
});
test('new founders start at the approved adult ages with their original supplies and knowledge',()=>{
  const s=createState(HOMESTEAD_RULES,4);
  assert.deepEqual(s.villagers.map(v=>v.age),[1745,1898,2051,2204,2356,2509]);
  assert.ok(s.villagers.every(v=>v.age>=s.config.life.adult&&v.age<s.config.life.elder));
  assert.equal(s.food,38);assert.equal(s.wood,22);assert.equal(s.huts,undefined);
  assert.ok(s.villagers.every(v=>!v.practice.known.housing));
});
test('a child becomes a working, willing adult at 20 days with the long lifespan enabled',()=>{
  let s=createState({...calm,start:{...calm.start,ages:[19,40,50],food:100,wood:50,fullness:100,warmth:100,happiness:100}},4);
  s.fireKnown=s.fireLit=true;s.config.tribeThresholds=[];
  assert.equal(familyDesire(s,s.villagers[0]),0);assert.equal(regularWorkSafe(s,s.villagers[0]),false);
  s=stepDay(s);const grown=s.villagers.find(v=>v.id===1);
  assert.equal(grown.age,20);assert.ok(familyDesire(s,grown)>0);assert.ok(regularWorkSafe(s,grown));
});
test('the old 300-day threshold no longer kills people; the new maximum still does',()=>{
  let s=createState({...calm,start:{...calm.start,ages:[299,4799,6399],food:100,wood:50,fullness:100,warmth:100,happiness:100}},4);
  s.fireKnown=s.fireLit=true;s.config.tribeThresholds=[];s=stepDay(s);
  assert.equal(s.villagers.find(v=>v.id===1).age,300);assert.equal(s.villagers.find(v=>v.id===2).age,4800);
  assert.equal(s.villagers.some(v=>v.id===3),false);assert.deepEqual(s.lastDay.deaths.find(d=>d.id===3).causes,['old age']);
  assert.equal(familyDesire(s,s.villagers.find(v=>v.id===2)),0,'elders remain alive but leave the reproductive window');
});
test('actual childbirth sets a personal recovery that permits another birth no earlier than day 160',()=>{
  let s=createState({...calm,start:{...calm.start,ages:[40,50],food:100,wood:50}},4);s.fireKnown=s.fireLit=true;s.settlementWork=5;
  s.huts=[0,0];s.hutDetails=[{shape:'dome hut'},{shape:'dome hut'}];s.config.tribeThresholds=[];
  for(const [i,v] of s.villagers.entries()){v.gender=i?'male':'female';v.parents=[];v.health=v.fullness=v.warmth=v.happiness=v.practice.energy=100;}
  for(let i=0;i<3;i++)s=stepDay(s);
  assert.equal(s.lastDay.births.length,1);const birthDay=s.day,mother=s.villagers.find(v=>v.id===1),father=s.villagers.find(v=>v.id===2);
  assert.equal(mother.recoveryUntil,birthDay+158);
  for(let offset=1;offset<=160;offset++){
    s.day=birthDay+offset;mother.health=father.health=mother.happiness=father.happiness=100;mother.illnessDays=father.illnessDays=0;
    const pairs=planFamilyBirths(s,[mother,father],{unrelated,populationCap});
    assert.equal(pairs.length,offset===160?1:0,'offset '+offset);
  }
});
test('older saves retain ages, active recovery, identity, projects and knowledge while adopting future lifespan rules',()=>{
  const legacy={...calm,start:{...calm.start,ages:[40,50,60]},life:{adult:20,elder:240,death:300},birth:{...calm.birth,recoveryDays:7}};
  const s=createState(legacy,4);s.day=120;s.villagers[0].recoveryUntil=123;s.villagers[0].practice.known.housing=1;
  s.huts=[0];s.hutDetails=[{shape:'dome hut'}];s.hutProject={camp:0,site:[340,130],work:2,spent:{wood:2}};
  const loaded=deserialize(serialize(s),HOMESTEAD_RULES);assert.ok(loaded);
  assert.deepEqual(loaded.villagers.map(v=>({id:v.id,name:v.name,age:v.age})),s.villagers.map(v=>({id:v.id,name:v.name,age:v.age})));
  assert.equal(loaded.villagers[0].recoveryUntil,123);assert.equal(loaded.villagers[0].practice.known.housing,1);
  assert.deepEqual(loaded.hutDetails,s.hutDetails);assert.deepEqual(loaded.hutProject,s.hutProject);
  assert.equal(loaded.config.life.death,6400);assert.equal(loaded.config.birth.recoveryDays,158);
  assert.equal(serialize(deserialize(serialize(loaded),HOMESTEAD_RULES)),serialize(loaded));
});
test('care age validation and historical reference lifespans remain separate',()=>{
  for(const age of [3,21,5.5]){const s=structuredClone(SCENARIO);s.simulation.childhood.careFromAge=age;assert.ok(validateScenario(s).some(e=>e.includes('careFromAge')));}
  assert.equal(CONFIG.life.adult,20);assert.equal(CONFIG.life.elder,240);assert.equal(CONFIG.life.death,300);
});
