import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,stepDay,preservationWork,preservationPlan,unrelated,readyToInvent} from '../src/sim.js';
import {HOMESTEAD_RULES} from './fixtures/eating-profile.js';
import {worldTrees,campSites,helpPreservation,makePracticeProduct,practices} from '../src/practices.js';
import {chooseStorageSite,storageCapacity} from '../src/storage.js';
import {serialize,deserialize} from '../src/save.js';
import {cerealFoodWork,seedReserve} from '../src/farming.js';
import {foodLedger} from '../src/provisions.js';
import {packVisitRelief,neighborWork} from '../src/neighbors.js';

const rules={...HOMESTEAD_RULES,traits:false,illness:{chance:0},weather:{chances:{normal:100,rain:0,drought:0,cold:0}},
  birth:{consecutiveDays:10000},learning:{...HOMESTEAD_RULES.learning,climate:false,seasonLength:1000,spoilage:0}};
function village(){
  const s=createState(rules,4);s.day=100;s.food=100;s.wood=100;s.fireKnown=s.fireLit=true;s.settlementWork=15;
  s.local.lastWinterFood={home:0,east:0};s.local.season='Summer';s.local.climate={mm:0};
  s.villagers=s.villagers.slice(0,2);s.huts=[0,0,0];s.hutDetails=s.huts.map(()=>({shape:'dome hut'}));s.config.tribeThresholds=[];
  s.toolkit=['hammer stone','stone blades','digging stick','hand axe','mallet & chisel'];s.fireTools=['fire stick','bow drill','blowpipe','wooden tongs','burn bowl'];
  s.local.stock.fibre=30;s.local.stock.stone=20;
  for(const v of s.villagers){
    v.fullness=v.warmth=v.health=v.happiness=v.practice.energy=100;v.lastCompanyDay=s.day;v.outdoors=false;
    v.gear='bow';v.fishTrap=true;v.practice.gear['fish trap']=true;
    Object.assign(v.practice.known,{housing:1,cordage:1,drying:1});
    Object.assign(v.practice.skills,{wood:6,fibre:3,berries:6});v.practice.used.drying=3;v.practice.used.cordage=2;
    v.practice.properties=['rigid','flexible','perishable'];
  }
  s.local.campStores[0]={built:true,saved:24,rack:0,racks:1,batches:3,rackSites:[[330,120]]};
  s.local.stumps=Object.fromEntries(worldTrees(s).map((_,i)=>[i,s.day]));
  return s;
}
const report=()=>({actions:[],gatheredFood:0,gatheredWood:0});
function project(s){const site=chooseStorageSite(s,campSites,0);assert.ok(site);return s.local.campStores[0].granary={site,work:0,bins:0,spent:{},clearedTrees:[]};}

test('an unfinished advanced store does not prevent a capable helper building a paid simple rack',()=>{
  const s=village(),v=s.villagers[0],p=project(s),before={wood:s.wood,fibre:s.local.stock.fibre};
  const copy=structuredClone(s);assert.equal(preservationPlan(s,v).kind,'rack');assert.deepEqual(s,copy,'planning is read-only');
  const r=report();assert.ok(preservationWork(s,v,r));assert.equal(v.activity,'Build a drying rack');assert.equal(s.local.campStores[0].rackWork,1);
  assert.equal(s.wood,before.wood-2);assert.equal(s.local.stock.fibre,before.fibre-1);assert.equal(p.work,0);
  v.practice.energy=100;assert.ok(preservationWork(s,v,report()));assert.equal(storageCapacity(s.local.campStores[0]),48);assert.equal(p.work,0);
});
test('ordinary daily assignment gives the actual next-stage builder priority over an untrained helper',()=>{
  let s=village();project(s);s.villagers[1].practice.known.granaries=1;
  s=stepDay(s);assert.equal(s.local.campStores[0].granary.work,1);
  const jobs=s.lastDay.actions.filter(a=>a.action==='Build a raised granary');assert.equal(jobs.length,1);assert.equal(jobs[0].id,2);
  assert.equal(new Set(s.lastDay.actions.map(a=>a.id)).size,s.lastDay.actions.length);
});
test('real gathered stage supplies stay with a project through shared-stock use, death and reload',()=>{
  let s=village(),v=s.villagers[0];v.practice.known.granaries=1;const p=project(s);
  s.local.stock.fibre=s.local.stock.stone=0;const before={wood:s.wood,fibre:s.local.deposits.fibre,stone:s.local.deposits.stone};
  assert.ok(preservationWork(s,v,report()));assert.equal(v.activity,'Collect fibre for granary');
  assert.deepEqual(p.supplies,{wood:2,fibre:1,stone:0});assert.equal(p.work,0);assert.equal(s.wood,before.wood-2);
  assert.equal(s.local.deposits.fibre,before.fibre-1);assert.equal(s.local.stock.fibre,0);
  // Ordinary public stocks may now be used elsewhere; held supplies are physical.
  s.villagers.shift();s=deserialize(serialize(s),s.config);v=s.villagers[0];v.practice.known.granaries=1;v.practice.energy=100;
  assert.equal(s.local.campStores[0].granary.supplies.fibre,1);
  assert.ok(preservationWork(s,v,report()));assert.equal(v.activity,'Collect stone for granary');assert.equal(s.local.deposits.stone,before.stone-1);
  v.practice.energy=100;assert.ok(preservationWork(s,v,report()));
  const finished=s.local.campStores[0].granary;assert.equal(finished.work,1);assert.deepEqual(finished.spent,{wood:2,fibre:1,stone:1});
  assert.deepEqual(finished.supplies,{wood:0,fibre:0,stone:0});assert.equal(s.wood,before.wood-2,'reserved timber is charged once');
});
test('hunger interrupts a staged project without deleting its real supplies or reserving a workday',()=>{
  const s=village(),v=s.villagers[0],p=project(s);v.practice.known.granaries=1;p.supplies={wood:2,fibre:1,stone:1};v.fullness=0;
  const copy=structuredClone(s),r=report();assert.equal(preservationPlan(s,v),null);assert.equal(preservationWork(s,v,r),false);
  assert.deepEqual(s,copy);assert.equal(r.actions.length,0);
});
test('preservation apprentices learn through repeated real assistance without duplicating food',()=>{
  const s=village(),[teacher,student]=s.villagers;delete student.practice.known.drying;
  for(let i=0;i<3;i++){
    s.day++;s.local.campStores[0].saved=0;s.local.campStores[0].rack=0;
    for(const v of s.villagers){v.practice.energy=100;v.lastCompanyDay=s.day;}
    const r=report();assert.ok(preservationWork(s,teacher,r));assert.equal(teacher.activity,'Preserve winter provisions');
    const food=foodLedger(s);assert.ok(helpPreservation(s,student,r));assert.deepEqual(foodLedger(s),food,'a lesson creates no extra batch');
    assert.equal(r.actions.length,2);assert.equal(helpPreservation(s,student,r),false,'no repeated lesson from the same mentor workday');
    if(i<2)assert.equal(student.practice.known.drying,undefined);
  }
  assert.ok(student.practice.known.drying);
});
test('an unavailable mentor or unsafe pupil cannot grant practical food knowledge',()=>{
  const s=village(),[teacher,student]=s.villagers;delete student.practice.known.drying;
  assert.equal(helpPreservation(s,student,report()),false);
  const r=report();s.local.campStores[0].saved=0;assert.ok(preservationWork(s,teacher,r));
  student.warmth=0;assert.equal(helpPreservation(s,student,r),false);assert.deepEqual(student.practice.lessons,{});
});
test('a granary pupil learns by helping with paid stages without advancing extra construction',()=>{
  const s=village(),[teacher,student]=s.villagers;teacher.practice.known.granaries=1;project(s);
  for(let i=0;i<3;i++){
    s.day++;for(const v of s.villagers)v.practice.energy=100;
    const r=report();assert.ok(preservationWork(s,teacher,r));assert.equal(teacher.activity,'Build a raised granary');
    const supplies={wood:s.wood,fibre:s.local.stock.fibre,stone:s.local.stock.stone};
    assert.ok(helpPreservation(s,student,r));assert.equal(s.local.campStores[0].granary.work,i+1);
    assert.deepEqual({wood:s.wood,fibre:s.local.stock.fibre,stone:s.local.stock.stone},supplies);
  }
  assert.ok(student.practice.known.granaries);assert.equal(storageCapacity(s.local.campStores[0]),24,'learning does not complete the building');
});
test('seed reserve follows cereal beds and intended cereal sowing instead of all gardens',()=>{
  const s=village();s.farming.plots=Array(20).fill(null);s.villagers[0].practice.known.wheatgrowing=1;
  assert.equal(seedReserve(s),2);s.villagers[0].practice.known.milling=1;assert.equal(seedReserve(s),10);
  s.farming.plots.fill(1);s.farming.crops=Object.fromEntries(Array.from({length:14},(_,i)=>[i,'wheat']));assert.equal(seedReserve(s),14,'protect the cereal beds already planted');
});
test('starving villagers can bake real available food while physical safety still takes priority',()=>{
  const s=village(),v=s.villagers[0];s.food=0;s.local.campStores[0].saved=0;s.local.stock.flour=8;s.farming.querns=[{camp:0}];
  Object.assign(v.practice.known,{milling:1,breadmaking:1});v.fullness=5;
  const r=report();assert.equal(cerealFoodWork(s,v,makePracticeProduct,r),'Bake hearth flatbread');assert.equal(s.food,16);assert.equal(s.local.stock.flour,0);
  s.food=0;v.warmth=0;assert.equal(cerealFoodWork(s,v,makePracticeProduct,report()),null);assert.equal(s.local.stock.flour,0);
});
test('a hungry miller needs a plausible baker, real grain and an unoccupied local station',()=>{
  const s=village(),[miller,baker]=s.villagers;s.food=0;s.local.stock.flour=0;s.local.stock.wheat=12;s.farming.querns=[{camp:0}];
  miller.fullness=5;miller.practice.known.milling=1;
  assert.equal(cerealFoodWork(s,miller,makePracticeProduct,report()),null);
  Object.assign(baker.practice.known,{milling:1,breadmaking:1});
  assert.equal(cerealFoodWork(s,miller,makePracticeProduct,report()),'Grind wheat into flour');assert.equal(s.local.stock.flour,8);
  assert.equal(cerealFoodWork(s,miller,makePracticeProduct,report()),null,'one real milling workday per station');
});
test('ordinary daily hunger prioritizes baking and counts one actual workday and meals',()=>{
  let s=village();s.food=0;s.local.campStores[0].saved=0;s.local.stock.flour=8;s.farming.querns=[{camp:0}];
  for(const v of s.villagers){v.fullness=5;Object.assign(v.practice.known,{milling:1,breadmaking:1});}
  s=stepDay(s);assert.ok(s.lastDay.actions.some(a=>a.action==='Bake hearth flatbread'));
  assert.ok(s.lastDay.meals.includes(1));assert.ok(s.lastDay.meals.includes(2));
  assert.equal(new Set(s.lastDay.actions.map(a=>a.id)).size,s.lastDay.actions.length);
});
test('a visit can carry finite surplus home without duplicating food or stripping the donor reserve',()=>{
  const s=village(),[traveler,host]=s.villagers;host.tribe=1;s.tribeCount=2;s.food=0;
  s.local.campStores[0].saved=0;s.local.campStores[1]={built:true,saved:20,rack:0,racks:1};traveler.travelMeals=3;
  const before=foodLedger(s),trip={traveler:traveler.id,host:host.id,from:0,to:1,stage:'meeting'},r=report();
  assert.equal(packVisitRelief(s,traveler,host,trip,r),6);assert.deepEqual(foodLedger(s),before);assert.equal(s.local.campStores[1].saved,14);
  assert.equal(packVisitRelief(s,traveler,host,trip,r),0,'the same visit cannot load a second gift');
  trip.stage='return';s.local.campVisit=trip;neighborWork(s,s.villagers,report(),{unrelated,readyToInvent});
  assert.equal(s.local.campStores[0].saved,6);assert.equal(traveler.travelMeals,3);assert.deepEqual(foodLedger(s),before);
  assert.equal(s.local.communication.foodShared,6);assert.equal(s.local.campVisit,undefined);
});
test('a needy donor or same-community visit cannot create relief supplies',()=>{
  const s=village(),[traveler,host]=s.villagers;s.food=0;s.local.campStores[0].saved=0;host.tribe=1;
  s.local.campStores[1]={saved:3,built:true,racks:1,rack:0};const before=foodLedger(s);
  assert.equal(packVisitRelief(s,traveler,host,{},report()),0);host.tribe=0;
  assert.equal(packVisitRelief(s,traveler,host,{},report()),0);assert.deepEqual(foodLedger(s),before);
});
test('carrying a fresh gift from the eastern village does not preserve it for free',()=>{
  const s=village(),[traveler,host]=s.villagers;s.food=0;s.local.campStores[0].saved=0;traveler.travelMeals=3;
  s.local.daughter={members:[host.id],food:20,returnFood:0,settled:true,site:[1140,175]};
  const before=foodLedger(s),trip={traveler:traveler.id,host:host.id,from:0,to:'east',stage:'meeting'};
  assert.equal(packVisitRelief(s,traveler,host,trip,report()),6);assert.equal(trip.reliefPreserved,false);
  trip.stage='return';s.local.campVisit=trip;neighborWork(s,s.villagers,report(),{unrelated,readyToInvent});
  assert.equal(s.local.campStores[0].saved,0);assert.equal(s.food,6);
  const after=foodLedger(s);assert.equal(after.home+after.east,before.home+before.east);assert.equal(s.local.daughter.food,14);
});
