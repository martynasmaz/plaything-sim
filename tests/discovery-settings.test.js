import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,stepDay,castText,queueCommand} from '../src/sim.js';
import {HOMESTEAD_RULES} from '../src/config.js';
import {discoveryChance,practiceWork,practices,canExperiment,rememberWorldKnowledge} from '../src/practices.js';
import {serialize,deserialize} from '../src/save.js';
import {SCENARIO,validateScenario} from '../src/scenario.js';
function basket(multiplier=1){
  const s=createState({...HOMESTEAD_RULES,learning:{...HOMESTEAD_RULES.learning,discoveryMultiplier:multiplier,experimentChance:40}},4),v=s.villagers[0],p=v.practice;
  s.food=s.wood=100;s.fireKnown=s.fireLit=true;s.huts=[0,0,0];s.local.stock.fibre=20;
  v.fullness=v.warmth=v.health=v.happiness=p.energy=100;v.lastCompanyDay=s.day;v.outdoors=false;
  p.curiosity=0;p.known.cordage=1;p.gear.cord=true;p.properties=['flexible'];p.lastSkill='berries';p.limitedTrips=3;
  return {s,v,p};
}
test('the discovery knob scales eligible odds, caps at 100%, and preserves the old 1x calculation',()=>{
  const {s,v}=basket();const chance=()=>discoveryChance(s,v,practices.baskets);
  assert.equal(chance(),40);s.config.learning.discoveryMultiplier=1.25;assert.equal(chance(),50);
  s.config.learning.discoveryMultiplier=1.5;assert.equal(chance(),60);s.config.learning.discoveryMultiplier=100;assert.equal(chance(),100);
  delete s.config.learning.discoveryMultiplier;assert.equal(chance(),40);
  const rng=s.rng,traitRng=s.traitRng;chance();assert.equal(s.rng,rng);assert.equal(s.traitRng,traitRng);
});
test('higher discovery odds allow a real paid experiment without manufacturing its product',()=>{
  const a=basket(1),b=basket(1.5);practiceWork(a.s,a.v,55);const energy=b.p.energy,stock=b.s.local.stock.fibre;
  practiceWork(b.s,b.v,55);assert.equal(a.p.progress.baskets,undefined);assert.ok(b.p.progress.baskets>0);
  assert.ok(b.p.energy<energy);assert.ok(b.s.local.stock.fibre<stock);assert.equal(b.p.gear.basket,undefined);assert.equal(b.p.known.baskets,undefined);
});
test('zero disables independent experiments even for a low roll and inspired curious people',()=>{
  const {s,v,p}=basket(0);p.curiosity=2;p.inspiration={skill:'berries',until:100};practiceWork(s,v,1);
  assert.equal(discoveryChance(s,v,practices.baskets),0);assert.equal(p.progress.baskets,undefined);assert.equal(p.known.baskets,undefined);
});
test('large discovery odds cannot replace knowledge, material observations, costs, safe needs or the magic unlock',()=>{
  for(const missing of ['foundation','property','materials','energy','food']){
    const {s,v,p}=basket(100);
    if(missing==='foundation')delete p.known.cordage;if(missing==='property')p.properties=[];if(missing==='materials')s.local.stock.fibre=0;
    if(missing==='energy')p.energy=0;if(missing==='food'){s.food=0;v.fullness=0;}
    assert.equal(canExperiment(s,v,practices.baskets),false,missing);
  }
  const {s,v}=basket(100);assert.equal(canExperiment(s,v,practices.bonecasting),false);assert.equal(canExperiment(s,v,practices.wheatgrowing),false);
});
test('discovery settings reject invalid values and persist progress through a changed loaded-world setting',()=>{
  for(const value of [-1,NaN,Infinity,'fast']){const x=structuredClone(SCENARIO);x.simulation.learning.discoveryMultiplier=value;assert.ok(validateScenario(x).some(e=>e.includes('discoveryMultiplier')));}
  const {s,v,p}=basket(1);practiceWork(s,v,1);const progress=p.progress.baskets;
  const loaded=deserialize(serialize(s),{...s.config,learning:{...s.config.learning,discoveryMultiplier:1.5}});
  assert.equal(loaded.config.learning.discoveryMultiplier,1.5);assert.equal(loaded.villagers[0].practice.progress.baskets,progress);
  assert.equal(serialize(stepDay(loaded)),serialize(stepDay(deserialize(serialize(loaded),loaded.config))));
});
test('God-spawned settlers know the union of living and recorded historical knowledge without copied equipment or structures',()=>{
  const s=createState(HOMESTEAD_RULES,4);s.villagers[0].practice.known.fishnets=1;s.villagers[1].practice.known.knapping=1;s.local.first.granaries=0;
  const before=structuredClone(s),next=castText(s,'spawn people 2').state;
  for(const v of next.villagers.filter(v=>v.id>=7)){
    for(const id of ['fishnets','knapping','granaries','gathering'])assert.ok(v.practice.known[id],id);
    assert.deepEqual(v.practice.gear,{});assert.deepEqual(v.practice.skills,{});assert.equal(v.herbalist,undefined);
  }
  for(const key of ['food','wood','farming','huts','hutProject','settlementWork'])assert.deepEqual(next[key],before[key],key);
  assert.deepEqual(next.local.stock,before.local.stock);assert.deepEqual(s,before,'the input world remains unchanged');
});
test('lost practitioners remain in the knowledge archive and older saves recover confirmed discoveries',()=>{
  const s=createState(HOMESTEAD_RULES,4);s.villagers[0].practice.known.pottery=1;rememberWorldKnowledge(s);
  s.villagers.shift();s.stats.deaths++;assert.ok(castText(s,'spawn people').state.villagers.at(-1).practice.known.pottery);
  delete s.local.knownPractices;s.local.first.quernmaking=0;const loaded=deserialize(serialize(s),s.config);
  assert.equal(loaded.local.knownPractices.quernmaking,true);assert.ok(castText(loaded,'spawn people').state.villagers.at(-1).practice.known.quernmaking);
});
test('ordinary children do not inherit the God-spawn archive',()=>{
  let s=createState({...HOMESTEAD_RULES,birth:{...HOMESTEAD_RULES.birth,consecutiveDays:1},illness:{chance:0},weather:{chances:{normal:100,rain:0,drought:0,cold:0}}},4);
  s.food=s.wood=100;s.config.tribeThresholds=[];s.local.first.pottery=0;
  for(const v of s.villagers){v.health=v.fullness=v.warmth=v.happiness=100;v.lastCompanyDay=s.day;}
  s=stepDay(s);assert.ok(s.lastDay.births.length);
  for(const id of s.lastDay.births)assert.equal(s.villagers.find(v=>v.id===id).practice.known.pottery,undefined);
  assert.ok(castText(s,'spawn people').state.villagers.at(-1).practice.known.pottery);
});
test('spawn inheritance cannot awaken magic, but includes previously learned magic after God enables it',()=>{
  let s=createState(HOMESTEAD_RULES,4);s.local.first.bonecasting=0;s.local.first.foretelling=0;
  s=castText(s,'spawn people').state;assert.equal(s.villagers.at(-1).practice.known.foretelling,undefined);assert.notEqual(s.local.magic?.enabled,true);
  s=castText(s,'magic').state;s=castText(s,'spawn people').state;assert.ok(s.villagers.at(-1).practice.known.foretelling);assert.deepEqual(s.villagers.at(-1).practice.gear,{});
});
test('queued God spawning shares historical knowledge through the same arrival path',()=>{
  let s=createState(HOMESTEAD_RULES,4);s.local.first.drying=0;s=queueCommand(s,'spawn people').state;s=stepDay(s);
  for(const v of s.villagers.filter(v=>v.id>=7&&v.arrivalDay!==undefined))assert.ok(v.practice.known.drying);
  assert.equal(s.villagers.filter(v=>v.id>=7&&v.arrivalDay!==undefined).length,2);
});
