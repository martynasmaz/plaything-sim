import test from 'node:test';
import assert from 'node:assert/strict';
import {HOMESTEAD_RULES} from '../src/config.js';
import {SCENARIO,validateScenario} from '../src/scenario.js';
import {createState,stepDay} from '../src/sim.js';
import {practices,canExperiment,makePracticeProduct,finishOrdinaryWork,takeDeposit,initSettlement,practiceWork} from '../src/practices.js';
import {regularWorkSafe} from '../src/development.js';
import {hearthRules,ovenWork,ovenFinished,cookingFuel,ovenStudyReady} from '../src/hearths.js';
import {cerealFoodWork} from '../src/farming.js';
import {serialize,deserialize} from '../src/save.js';
import {rememberCollection} from '../src/collection.js';
import {buildingPatches} from '../src/ecology.js';
import {hasFoodReserve} from '../src/provisions.js';
import {chooseStorageSite} from '../src/storage.js';
import {builtHutSite} from '../src/settlement-layout.js';
import {campSites} from '../src/practices.js';
const rules={...HOMESTEAD_RULES,traits:false,illness:{chance:0},weather:{chances:{normal:100,rain:0,drought:0,cold:0}},learning:{...HOMESTEAD_RULES.learning,climate:false}};
function village(){
  const s=createState(rules,4);s.day=500;s.villagers=s.villagers.slice(0,1);s.config.tribeThresholds=[];
  s.food=100;s.wood=60;s.fireKnown=s.fireLit=true;s.settlementWork=15;s.local.healerId=999;
  Object.assign(s.local.stock,{clay:20,stone:20,charcoal:0,wheat:24,flour:8});
  s.farming.known=true;s.farming.plots=[];s.farming.querns=[{camp:0}];
  const v=s.villagers[0];v.fullness=v.warmth=v.health=v.happiness=v.practice.energy=100;v.lastCompanyDay=s.day;
  Object.assign(v.practice.known,{gathering:1,'crude tools':1,'fire tending':1,milling:1,breadmaking:1,shaping:1});
  Object.assign(v.practice.skills,{clay:3,wood:4});v.practice.properties=['mouldable','rigid','perishable','fractures'];v.practice.used.breadmaking=2;
  return {s,v};
}
const report=()=>({actions:[],meals:[],gatheredFood:0});
test('new oven sites use actual homes rather than reserving eight future house rings',()=>{
  const {s}=village();s.huts=[0,0,0];s.hutDetails=[];
  const site=chooseStorageSite(s,campSites,0,[],[],'oven');assert.ok(site);
  assert.ok(Math.min(...[0,1,2].map(i=>Math.hypot(site[0]-builtHutSite(s,campSites,0,i)[0],site[1]-builtHutSite(s,campSites,0,i)[1])))<=100);
});
const helpers={safe:regularWorkSafe,foodReady:hasFoodReserve,finish:finishOrdinaryWork,take:takeDeposit,site:()=>[350,100],tree:()=>null,canClear:()=>false,clear:()=>assert.fail('no tree in fixture'),materialSite:()=>[196,185]};
test('charcoal discovery requires controlled fire, basic knowledge, wood experience and a genuine surplus',()=>{
  const {s,v}=village();assert.ok(canExperiment(s,v,practices.charcoal));
  for(const missing of ['fire','foundation','experience','wood','food']){
    const x=structuredClone(s),p=x.villagers[0];
    if(missing==='fire')x.fireKnown=false;if(missing==='foundation')delete p.practice.known['fire tending'];
    if(missing==='experience')p.practice.skills.wood=0;if(missing==='wood')x.wood=4;if(missing==='food')x.food=0;
    assert.equal(canExperiment(x,p,practices.charcoal),false,missing);
  }
});
test('charcoal is paid wood conversion and improved production cannot create fuel energy',()=>{
  const {s,v}=village();v.practice.known.charcoal=1;s.fireLit=false;const wood=s.wood;
  assert.ok(makePracticeProduct(s,v,'charcoal'));assert.equal(s.wood,wood-4);assert.equal(s.local.stock.charcoal,1);
  v.practice.gear['efficient kiln']=true;assert.ok(makePracticeProduct(s,v,'charcoal'));
  assert.equal(s.wood,wood-8);assert.equal(s.local.stock.charcoal,3);
  assert.ok(hearthRules.improvedCharcoalYield*hearthRules.charcoalHeat<=hearthRules.charcoalWood);
});
test('mixed cooking fuel uses actual charcoal and spare wood without touching the reserve',()=>{
  const {s,v}=village();v.practice.known.charcoal=1;s.wood=4;s.local.stock.charcoal=.5;
  assert.deepEqual(cookingFuel(s,v,2),{charcoal:.5,wood:1});assert.equal(cookingFuel(s,v,3),null);
  delete v.practice.known.charcoal;assert.equal(cookingFuel(s,v,2),null);
});
test('simple oven discovery still requires personal baking, clay experience, shaping and controlled fire',()=>{
  const {s,v}=village();assert.ok(canExperiment(s,v,practices.clayovens));assert.equal(v.practice.known.pottery,undefined);assert.equal(v.practice.known.charcoal,undefined);
  for(const missing of ['bread practice','clay practice','shaping','fire']){
    const x=structuredClone(s),p=x.villagers[0];
    if(missing==='bread practice')p.practice.used.breadmaking=0;if(missing==='clay practice')p.practice.skills.clay=0;
    if(missing==='shaping')delete p.practice.known.shaping;if(missing==='fire')x.fireKnown=false;
    assert.equal(canExperiment(x,p,practices.clayovens),false,missing);
  }
});
test('knowledge alone creates no oven or collection entry; construction pays every material and workday',()=>{
  const {s,v}=village();v.practice.known.clayovens=1;
  assert.equal(makePracticeProduct(s,v,'clayovens'),false);initSettlement(s);rememberCollection(s,practices);
  assert.deepEqual(s.local.ovens,{});assert.equal(s.local.collection['earthen oven'],undefined);
  s.food=0;assert.equal(ovenWork(s,v,report(),helpers),false,'empty food stores cannot fund optional construction');s.food=100;
  const before={wood:s.wood,clay:s.local.stock.clay,stone:s.local.stock.stone};
  for(let i=1;i<=4;i++){
    assert.ok(ovenWork(s,v,report(),helpers));assert.equal(s.local.ovens[0].work,i);assert.equal(ovenFinished(s.local.ovens[0]),i===4);s.day++;v.practice.energy=100;
  }
  assert.equal(before.wood-s.wood,2);assert.equal(before.clay-s.local.stock.clay,6);assert.equal(before.stone-s.local.stock.stone,0);
  assert.deepEqual(s.local.ovens[0].spent,hearthRules.ovenCost);assert.equal(ovenWork(s,v,report(),helpers),false);
  rememberCollection(s,practices);assert.ok(s.local.collection['earthen oven']);
});
test('unfinished ovens and paid supplies persist through builder death and save/load',()=>{
  const {s,v}=village();v.practice.known.clayovens=1;s.local.stock.clay=0;
  assert.ok(ovenWork(s,v,report(),helpers));assert.equal(s.local.ovens[0].work,0);assert.equal(s.local.ovens[0].supplies.clay,2);
  const successor=structuredClone(v);successor.id=99;s.villagers=[successor];
  const loaded=deserialize(serialize(s),s.config);assert.ok(loaded);assert.equal(loaded.local.ovens[0].founderId,v.id);
  assert.equal(loaded.local.ovens[0].supplies.clay,2);assert.ok(ovenWork(loaded,loaded.villagers[0],report(),helpers));
  assert.equal(loaded.local.ovens[0].work,1);assert.equal(loaded.local.ovens[0].supplies.clay,.5);
});
test('a finished local oven halves fuel and can bake from charcoal without a separate bonfire',()=>{
  const {s,v}=village();s.food=0;s.wood=0;s.fireLit=false;s.local.stock.charcoal=1;v.practice.known.charcoal=1;
  s.local.ovens[0]={camp:0,site:[350,100],work:4,finishedDay:490};
  assert.equal(cerealFoodWork(s,v,makePracticeProduct,report()),'Bake hearth flatbread');
  assert.equal(s.food,16);assert.equal(s.local.stock.charcoal,.5);assert.equal(s.wood,0);assert.equal(s.local.stock.flour,0);
});
test('unfinished or remote ovens do not grant a fuel discount or a free lit hearth',()=>{
  const {s,v}=village();s.food=0;s.wood=20;s.local.ovens[0]={camp:0,site:[350,100],work:3};s.fireLit=false;
  assert.equal(makePracticeProduct(s,v,'breadmaking'),false);
  s.fireLit=true;const wood=s.wood;assert.ok(makePracticeProduct(s,v,'breadmaking'));assert.equal(s.wood,wood-2);
  s.local.stock.flour=8;s.local.ovens[0].work=4;v.tribe=1;s.campFires={1:true};s.farming.querns=[{camp:1}];
  const nextWood=s.wood;assert.ok(makePracticeProduct(s,v,'breadmaking'));assert.equal(s.wood,nextWood-2);
});
test('charcoal campfire debits and partial bread action reports reflect physical quantities',()=>{
  let {s,v}=village();s.wood=0;s.local.stock.charcoal=3;v.practice.known.charcoal=1;
  let next=stepDay(s);assert.equal(next.lastDay.burnedCharcoal,.5);assert.equal(next.lastDay.burnedWood,0);assert.equal(next.fireLit,true);
  ({s,v}=village());s.food=0;s.local.stock.flour=1;v.fullness=5;
  next=stepDay(s);const bake=next.lastDay.baking?.find(b=>b.id===v.id);assert.ok(bake);assert.equal(bake.food,2);
  assert.equal(next.lastDay.actions.find(a=>a.id===v.id).gained,2);
});
test('hungry bakers request usable cooking timber instead of resting beside flour',()=>{
  const {s,v}=village();s.food=0;s.wood=3;v.fullness=5;s.local.stock.flour=8;
  const next=stepDay(s);assert.equal(next.lastDay.actions.find(a=>a.id===v.id).action,'Gather wood');assert.ok(next.wood>2);
});
test('oven footprint remains maintained ground while in use',()=>{
  const {s}=village();s.local.ovens[0]={camp:0,site:[350,100],work:4};
  assert.ok(buildingPatches(s,[[227,222],[802,433],[702,153]]).some(p=>p.site[0]===350&&p.site[1]===100));
});
test('the real daily scheduler builds an oven on a saved NPC-chosen site',()=>{
  let {s,v}=village();v.practice.known.clayovens=1;const actions=[];
  for(let i=0;i<12&&!ovenFinished(s.local.ovens[0]);i++){
    s=stepDay(s);actions.push(...s.lastDay.actions.map(a=>a.action));
  }
  assert.ok(ovenFinished(s.local.ovens[0]),actions.join(', '));assert.ok(actions.includes('Build earthen oven'));
  assert.ok(s.local.ovens[0].site.every(Number.isFinite));assert.deepEqual(s.local.ovens[0].spent,hearthRules.ovenCost);
});
test('scenario prevents fuel-multiplying charcoal settings',()=>{
  assert.deepEqual(validateScenario(),[]);
  for(const key of ['charcoalYield','improvedCharcoalYield']){const c=structuredClone(SCENARIO);c.hearths[key]=20;
    assert.ok(validateScenario(c).some(e=>e.includes('fuel heat')));}
});
test('experienced bakers can study paid clay samples without automatically learning ovens',()=>{
  const {s,v}=village();v.practice.skills.clay=0;v.practice.properties=['rigid','perishable'];delete v.practice.known.shaping;
  const clay=s.local.stock.clay,energy=v.practice.energy;
  assert.equal(practiceWork(s,v,101,report()),'Inspect clay for an oven');
  assert.equal(s.local.stock.clay,clay-1);assert.equal(v.practice.energy,energy-s.config.learning.workCost);
  assert.equal(v.practice.skills.clay,1);assert.ok(v.practice.properties.includes('mouldable'));
  assert.equal(v.practice.known.clayovens,undefined);assert.equal(v.practice.known.shaping,undefined);
});
test('eligible clay-and-bread experience can discover oven knowledge through paid experiments',()=>{
  const {s,v}=village();v.practice.lastSkill='clay';const clay=s.local.stock.clay,stone=s.local.stock.stone;
  for(let i=0;i<8&&!v.practice.known.clayovens;i++){
    s.day++;v.practice.energy=100;v.practice.lastSkill='clay';practiceWork(s,v,0,report());
  }
  assert.ok(v.practice.known.clayovens);assert.ok(s.local.stock.clay<clay);assert.equal(s.local.stock.stone,stone,'clay trials do not require a stone foundation');
  assert.deepEqual(s.local.ovens,{},'discovering a plan cannot construct it');
});

test('one actual bake and clay handling allow a clay-only trial, without guaranteeing discovery',()=>{
  const {s,v}=village();v.practice.used.breadmaking=1;v.practice.skills.clay=1;s.local.stock.stone=0;
  assert.ok(canExperiment(s,v,practices.clayovens));
  v.practice.lastSkill='clay';const clay=s.local.stock.clay;
  practiceWork(s,v,101,report());
  assert.equal(v.practice.known.clayovens,undefined);assert.equal(v.practice.progress.clayovens,undefined);
  assert.deepEqual(s.local.ovens,{});assert.equal(s.local.stock.clay,clay);
  s.food=0;v.fullness=5;assert.equal(canExperiment(s,v,practices.clayovens),false,'urgent food still wins');
});

test('bakers fetch finite trial clay instead of needing leftover communal stone or clay',()=>{
  const {s,v}=village();v.practice.used.breadmaking=1;v.practice.skills.clay=1;
  s.local.stock.clay=s.local.stock.stone=0;s.local.deposits.clay=2;
  const energy=v.practice.energy;
  assert.equal(practiceWork(s,v,0,report()),'Collect clay for an oven');
  assert.equal(s.local.deposits.clay,0);assert.equal(s.local.stock.clay,2);
  assert.equal(v.practice.energy,energy-s.config.learning.workCost);
  assert.equal(v.practice.progress.clayovens,undefined,'collecting a sample is the whole workday');
  v.practice.energy=100;s.day++;
  practiceWork(s,v,0,report());assert.ok(v.practice.progress.clayovens>0);
  assert.equal(s.local.stock.clay,1);assert.equal(s.local.stock.stone,0);assert.deepEqual(s.local.ovens,{});
});

test('new oven-study settings are adjustable, validated, and preserve existing knowledge and projects',()=>{
  const {s,v}=village();v.practice.known.clayovens=1;
  s.local.ovens[0]={camp:0,site:[350,100],work:2,supplies:{clay:1},spent:{clay:3,stone:2,wood:1}};
  const loaded=deserialize(serialize(s),s.config);
  assert.equal(loaded.villagers[0].practice.known.clayovens,1);assert.deepEqual(loaded.local.ovens,s.local.ovens);
  for(const key of ['ovenBakesBeforeStudy','ovenDryingBeforeStudy','ovenClayExperience','ovenTrialClay']){
    const settings=structuredClone(SCENARIO);settings.hearths[key]=0;
    assert.ok(validateScenario(settings).some(e=>e.includes(key)));
  }
  const harder=structuredClone(SCENARIO);harder.hearths.ovenBakesBeforeStudy=2;harder.hearths.ovenClayExperience=2;
  assert.deepEqual(validateScenario(harder),[]);
  const previous=hearthRules.ovenBakesBeforeStudy;
  try{delete v.practice.known.clayovens;hearthRules.ovenBakesBeforeStudy=3;assert.equal(ovenStudyReady(s,v),false);}
  finally{hearthRules.ovenBakesBeforeStudy=previous;}
});

test('experienced hearth food drying provides an independent route before breadmaking',()=>{
  const {s,v}=village();delete v.practice.known.breadmaking;v.practice.used.breadmaking=0;
  v.practice.used.drying=1;assert.equal(canExperiment(s,v,practices.clayovens),false);
  v.practice.used.drying=2;assert.ok(canExperiment(s,v,practices.clayovens));
  delete v.practice.known.shaping;assert.equal(canExperiment(s,v,practices.clayovens),false,'clay shaping remains a real prerequisite');
});
