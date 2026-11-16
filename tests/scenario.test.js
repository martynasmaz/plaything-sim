import test from 'node:test';
import assert from 'node:assert/strict';
import {SCENARIO,validateScenario,scenarioStartSeed} from '../src/scenario.js';
import {HOMESTEAD_RULES} from '../src/config.js';
import {createState,stepDay,foodCapacity} from '../src/sim.js';
import {kaunasWeather} from '../src/climate.js';
import {riverFallOutcome} from '../src/river.js';
import {naturalInspiration} from '../src/inspiration.js';
import {fieldRules} from '../src/development.js';
import {wheatRules} from '../src/farming.js';
import {husbandryWork,beginHusbandryDay,finishHusbandryDay,livestockKinds,livestockBuildingRules} from '../src/husbandry.js';
import {finishOrdinaryWork,practices,canExperiment} from '../src/practices.js';

const scenarioDeps={finish:finishOrdinaryWork,recipes:practices,canExperiment,foodCapacity,siteTree:()=>null,clear:()=>false};
test('the summary settings drive the playable defaults and progression tables',()=>{
  assert.deepEqual(validateScenario(),[]);assert.deepEqual(HOMESTEAD_RULES.start,SCENARIO.simulation.start);
  assert.deepEqual(HOMESTEAD_RULES.learning,SCENARIO.simulation.learning);assert.equal(fieldRules,SCENARIO.progression.fields);assert.equal(wheatRules,SCENARIO.progression.wheat);assert.equal(livestockKinds,SCENARIO.livestock.species);
});
test('the scenario can fix fresh-world seeds while an explicit URL seed wins',()=>{
  const old=SCENARIO.defaultSeed;let draws=0;const random=()=>{draws++;return 73;};
  try{SCENARIO.defaultSeed=null;assert.equal(scenarioStartSeed(random),73);SCENARIO.defaultSeed=51;assert.equal(scenarioStartSeed(random),51);assert.equal(scenarioStartSeed(random,42),42);assert.equal(scenarioStartSeed(random,0),0);assert.equal(draws,1);}finally{SCENARIO.defaultSeed=old;}
});
test('invalid probabilities, zero timing, NaN inputs and impossible lifespans are rejected clearly',()=>{
  const x=structuredClone(SCENARIO);x.livestock.tradeChance=2;x.livestock.hayDryDays=0;x.simulation.start.food=NaN;x.simulation.life.adult=x.simulation.life.elder+1;
  const errors=validateScenario(x);assert.ok(errors.some(e=>e.includes('tradeChance')));assert.ok(errors.some(e=>e.includes('hayDryDays')));assert.ok(errors.some(e=>e.includes('food')));assert.ok(errors.some(e=>e.includes('life')));
});
test('weather modifiers change the measured baseline without changing the seed',()=>{
  const previous=SCENARIO.weather.wetDayMultiplier,s=createState(HOMESTEAD_RULES,72);
  try{assert.ok(kaunasWeather(s,25,0).mm>0);SCENARIO.weather.wetDayMultiplier=0;assert.equal(kaunasWeather(s,25,0).mm,0);}finally{SCENARIO.weather.wetDayMultiplier=previous;}
});
test('editable husbandry settings reject missing yields, fractional construction days and invalid targets',()=>{
  const settings=structuredClone(SCENARIO);delete settings.livestock.species.sheep.price;
  settings.livestock.buildings.enclosure.work=4.5;settings.livestock.safeReserveDays=-1;
  settings.livestock.minimumTarget=-2;settings.livestock.journeyRations=1.5;
  for(const key of ['sheep.price','enclosure.work','safeReserveDays','minimumTarget','journeyRations'])assert.ok(validateScenario(settings).some(e=>e.includes(key)),key);
  assert.deepEqual(validateScenario(SCENARIO),[]);
});
test('river probabilities support zero and one while default outcomes retain the old sequence',()=>{
  const previous=SCENARIO.river.fatalFallChance;
  try{
    for(let count=1;count<2000;count++){
      let h=Math.imul(31^Math.imul(count,1597334677)^0x5c71,2246822519);h=Math.imul(h^(h>>>16),3266489917);
      assert.equal(riverFallOutcome(31,count),((h^(h>>>16))>>>0)%1000===0);
    }
    SCENARIO.river.fatalFallChance=0;assert.equal(riverFallOutcome(31,10),false);SCENARIO.river.fatalFallChance=1;assert.equal(riverFallOutcome(31,10),true);
  }finally{SCENARIO.river.fatalFallChance=previous;}
});
test('flood crossing probabilities are editable and reject invalid risks',()=>{
  const settings=structuredClone(SCENARIO);
  settings.river.floodCrossingChance.deck=1.1;settings.river.floodCrossingChance.rails=-.01;settings.river.floodCrossingChance.braced=NaN;
  for(const kind of ['deck','rails','braced'])assert.ok(validateScenario(settings).some(e=>e.includes('floodCrossingChance.'+kind)));
});
test('natural inspiration probability can be disabled or made certain for an eligible opportunity',()=>{
  const previous=SCENARIO.inspiration.naturalChance,s=createState(HOMESTEAD_RULES,4),v=s.villagers[0];s.day=90;v.fullness=v.warmth=v.health=100;v.practice.energy=100;v.practice.skills={wood:8,berries:8,stone:8};v.motivation={level:4};
  try{SCENARIO.inspiration.naturalChance=0;const a={actions:[{id:v.id,action:'Rest'}]};naturalInspiration(s,a);assert.equal(a.inspiration,undefined);SCENARIO.inspiration.naturalChance=1;naturalInspiration(s,a);assert.equal(a.inspiration.length,1);}finally{SCENARIO.inspiration.naturalChance=previous;}
});
test('configured contact odds gate an otherwise eligible paid journey',()=>{
  const previous=SCENARIO.livestock.contactChance,s=createState(HOMESTEAD_RULES,51),v=s.villagers[0];s.day=90;s.food=100;s.wood=40;s.local.reaches=2;s.local.harvests=3;s.local.lastWinterFood={home:8};s.local.season='Spring';
  for(const p of s.villagers){p.lastCompanyDay=s.day;p.fullness=p.warmth=p.health=100;p.practice.energy=100;}v.practice.curiosity=2;v.practice.skills.berries=8;
  try{SCENARIO.livestock.contactChance=0;let r={actions:[],gatheredFood:0,gatheredWood:0};beginHusbandryDay(s,r);assert.equal(husbandryWork(s,v,101,r,scenarioDeps),false);assert.equal(s.local.husbandry.journey,undefined);
    SCENARIO.livestock.contactChance=1;assert.ok(husbandryWork(s,v,101,r,scenarioDeps));assert.equal(s.local.husbandry.journey.travelerId,v.id);assert.equal(v.travelMeals,SCENARIO.livestock.journeyRations);
  }finally{SCENARIO.livestock.contactChance=previous;}
});
test('configured breeding probability gates pregnancy without consuming nightly dice',()=>{
  const previous=SCENARIO.livestock.breedingChance,s=createState(HOMESTEAD_RULES,51),v=s.villagers[0];s.day=54;s.local.season='Autumn';s.local.stock.hay=80;v.practice.known.herding=1;
  const pen={id:'test',camp:0,work:4,shelterWork:5,careDay:s.day,grass:60,mast:40,dung:0,mud:0};s.local.husbandry.pens.push(pen);
  const animals=s.local.husbandry.animals.filter(a=>a.species==='sheep').slice(0,3);for(const a of animals)Object.assign(a,{location:'village',penId:pen.id,age:100,health:100,condition:100,fedDays:5});const mother=animals.find(a=>a.sex==='female'),rng=s.rng;
  try{SCENARIO.livestock.breedingChance=0;let r={actions:[]};beginHusbandryDay(s,r);finishHusbandryDay(s,r);assert.equal(mother.pregnancy,undefined);SCENARIO.livestock.breedingChance=1;r={actions:[]};beginHusbandryDay(s,r);finishHusbandryDay(s,r);assert.ok(mother.pregnancy);assert.equal(s.rng,rng);}finally{SCENARIO.livestock.breedingChance=previous;}
});
test('the same settings and seed replay the same simulation, and ordinary overrides still work',()=>{
  const rules={...HOMESTEAD_RULES,start:{...HOMESTEAD_RULES.start,ages:[40,50,60,70],food:60}};let a=createState(rules,73),b=createState(rules,73);
  assert.equal(a.villagers.length,4);assert.equal(a.food,60);for(let i=0;i<50;i++){a=stepDay(a);b=stepDay(b);}assert.deepEqual(a,b);
});
