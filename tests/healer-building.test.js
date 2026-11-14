import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,stepDay,findHomesteadHealer,shelterPlaces} from '../src/sim.js';
import {HOMESTEAD_RULES} from '../src/config.js';
import {practices,canExperiment,worldTrees,campSites} from '../src/practices.js';
import {healerHomeView,healerMedicineStore,chooseQuietHealerSite,healerNeighbors} from '../src/healer-home.js';
import {inBuildingPatch} from '../src/ecology.js';
import {serialize,deserialize} from '../src/save.js';

const rules={...HOMESTEAD_RULES,traits:false,illness:{chance:0},learning:{...HOMESTEAD_RULES.learning,seasonLength:1000},
  weather:{chances:{normal:100,rain:0,drought:0,cold:0}}};
function candidate(){
  const s=createState(rules,4),v=s.villagers[0];s.villagers=[v];
  s.food=100;s.wood=80;s.settlementWork=5;
  Object.assign(s.local.stock,{herbs:12,fibre:20,stone:20});
  v.traits=['Loner'];v.fullness=v.warmth=v.health=v.happiness=100;v.practice.energy=100;
  Object.assign(v.practice.known,{herbalism:2,cordage:1,housing:1});
  Object.assign(v.practice.skills,{berries:4,wood:4,fibre:3});
  v.practice.careExperience=2;v.remedyDoses=2;
  // These tests isolate building/material stages after site preparation.
  // Physical tree clearing, tools and workdays are tested in site-clearing.
  const site=chooseQuietHealerSite(campSites[0],healerNeighbors(s,campSites,true),worldTrees(s));
  s.local.stumps=Object.fromEntries(worldTrees(s).flatMap((tree,id)=>inBuildingPatch(tree,site,'healer')?[[id,s.day]]:[]));
  return s;
}
function until(s,predicate,days=100){
  while(!predicate(s)&&days--&&!s.ended)s=stepDay(s);
  assert.ok(predicate(s),'expected NPC project stage within the controlled workdays');return s;
}
function built(){let s=candidate();findHomesteadHealer(s);return until(s,s=>!!s.villagers[0].herbalist.home);}

test('a fresh world does not spawn a healer, a private home, or altered personalities',()=>{
  const s=createState(rules,4),traits=s.villagers.map(v=>[...v.traits]);
  assert.equal(s.villagers.some(v=>v.herbalist),false);assert.equal(s.local.healerHome,undefined);
  findHomesteadHealer(s);assert.deepEqual(s.villagers.map(v=>v.traits),traits);
});
test('medical discovery requires plants, foraging skill, and experience caring for the sick',()=>{
  const s=createState(rules,4),v=s.villagers[0],p=v.practice;
  p.properties=['perishable'];s.local.stock.herbs=1;
  assert.equal(canExperiment(s,v,practices.herbalism),false);
  p.skills.berries=3;p.careExperience=1;assert.equal(canExperiment(s,v,practices.herbalism),false);
  p.careExperience=2;assert.ok(canExperiment(s,v,practices.herbalism));
  s.local.stock.herbs=0;assert.equal(canExperiment(s,v,practices.herbalism),false);
});
test('choosing healing leaves the existing household, traits, and hut unchanged',()=>{
  const s=candidate(),v=s.villagers[0],household=v.household,traits=[...v.traits],beds=shelterPlaces(s);
  findHomesteadHealer(s);
  assert.ok(v.herbalist);assert.equal(v.herbalist.home,undefined);assert.equal(s.local.healerHome,undefined);
  assert.equal(v.household,household);assert.deepEqual(v.traits,traits);assert.equal(shelterPlaces(s),beds);
});
test('a quiet site is planned before anything is built; work consumes real materials over separate days',()=>{
  let s=candidate();findHomesteadHealer(s);s=stepDay(s);
  assert.equal(s.local.healerHome.work,0);assert.equal(s.lastDay.actions[0].action,'Choose a quiet herb site');
  const wood=s.wood;s=stepDay(s);
  assert.equal(s.local.healerHome.work,1);assert.equal(s.wood,wood-1);
  assert.deepEqual(s.local.healerHome.spent,{wood:1});
  assert.equal(s.villagers[0].herbalist.home,undefined);
  s=until(s,s=>s.local.healerHome.work===6);
  assert.deepEqual(s.local.healerHome.spent,{wood:6,fibre:2,stone:1});
  assert.equal(s.villagers[0].herbalist.home,undefined,'finishing the roof does not teleport its owner');
  s=until(s,s=>!!s.villagers[0].herbalist.home);
  assert.deepEqual(s.villagers[0].herbalist.home,s.local.healerHome.home);
  assert.equal(s.local.healerHome.rackWork,0);assert.equal(s.local.healerHome.markerWork,0);
});
test('construction waits for personal skills and shared shelter experience',()=>{
  for(const missing of ['housing','cordage','communal']){
    let s=candidate();if(missing==='communal')s.settlementWork=0;else delete s.villagers[0].practice.known[missing];
    findHomesteadHealer(s);s=stepDay(s);assert.equal(s.local.healerHome,undefined,missing);
  }
});
test('hunger interrupts a project instead of spending scarce food time on a house',()=>{
  let s=candidate();findHomesteadHealer(s);s=stepDay(s);
  s.food=0;s.villagers[0].fullness=5;
  const next=stepDay(s);assert.equal(next.local.healerHome.work,0);
  assert.equal(next.lastDay.actions.find(a=>a.id===s.villagers[0].id).action,'Forage');
});
test('treating a sick neighbor comes before optional building',()=>{
  let s=candidate();findHomesteadHealer(s);s=stepDay(s);
  const other=createState(rules,4).villagers[1];other.illnessDays=3;other.health=50;s.villagers.push(other);
  const next=stepDay(s);assert.equal(next.local.healerHome.work,0);
  assert.equal(next.lastDay.actions.find(a=>a.id===s.villagers[0].id).action,'Care for '+other.name);
});
test('racks and identifying features require further medical use, resources and work',()=>{
  let s=built(),v=s.villagers[0];
  const other=createState(rules,4).villagers[1];other.illnessDays=3;other.health=70;s.villagers.push(other);
  s=until(s,s=>s.villagers[0].herbalist.visits>=2);s.villagers[1].illnessDays=0;
  s=until(s,s=>s.local.healerHome.rackWork===2);
  assert.equal(s.local.healerHome.markerWork,0);assert.equal(s.local.healerHome.spent.wood,8);
  assert.equal(s.local.healerHome.spent.fibre,4);
  s.villagers[1].illnessDays=3;
  s=until(s,s=>s.villagers[0].herbalist.visits>=3);s.villagers[1].illnessDays=0;
  s=until(s,s=>s.local.healerHome.markerWork===2);
  assert.equal(s.local.healerHome.spent.wood,10);assert.equal(s.local.healerHome.spent.fibre,6);
});
test('built structures and stored medicines survive the owner’s death and save/load',()=>{
  let s=built();const home=structuredClone(s.local.healerHome),v=s.villagers[0];
  assert.ok(healerMedicineStore(s,v).doses>0);
  v.age=s.config.life.death-1;s=stepDay(s);
  assert.equal(s.villagers.length,0);assert.deepEqual(s.local.healerHome,home);
  const view=healerHomeView(s,[227,222]);assert.ok(view.habitable);assert.equal(view.resident,null);
  const loaded=deserialize(serialize(s),rules);assert.deepEqual(loaded.local.healerHome,home);
});
test('dying before planning does not conjure an empty hut later',()=>{
  let s=candidate();findHomesteadHealer(s);s.villagers[0].age=s.config.life.death-1;s.food=0;s.villagers[0].fullness=5;
  s=stepDay(s);assert.equal(s.local.healerHome,undefined);
  assert.equal(deserialize(serialize(s),rules).local.healerHome,undefined);
});
test('unfinished construction remains at the achieved stage after its builder dies',()=>{
  let s=candidate();findHomesteadHealer(s);s=stepDay(stepDay(s));
  assert.equal(s.local.healerHome.work,1);
  s.villagers[0].age=s.config.life.death-1;s=stepDay(s);
  const record=structuredClone(s.local.healerHome);
  assert.ok(record.work>0&&record.work<6);
  assert.deepEqual(stepDay(s).local.healerHome,record);
  assert.deepEqual(deserialize(serialize(s),rules).local.healerHome,record);
});
test('loading a qualified villager does not appoint them or construct anything as a side effect',()=>{
  const s=candidate(),back=deserialize(serialize(s),rules);
  assert.equal(back.villagers[0].herbalist,undefined);assert.equal(back.local.healerHome,undefined);
  const expected=stepDay({...s,speed:0,elapsedMs:0,lastDay:null});
  assert.deepEqual(stepDay(back),expected);
});
test('old role-only saves keep their basic shelter and knowledge, without free upgrades',()=>{
  const s=createState(rules,4),v=s.villagers[0];delete s.local.healerBuildingVersion;
  s.local.healerId=v.id;v.herbalist={home:[143,170],leaves:1,doses:2,visits:3};
  const loaded=deserialize(serialize(s),rules),home=loaded.local.healerHome;
  assert.equal(home.work,3);assert.equal(home.rackWork,0);assert.equal(home.markerWork,0);
  assert.deepEqual(home.stock,{leaves:1,doses:2});assert.ok(loaded.villagers[0].practice.known.herbalism);
  assert.deepEqual(home.home,[143,170]);
});
test('a knowledgeable successor can choose the existing home without rebuilding or getting free upgrades',()=>{
  let s=built();const successor=candidate().villagers[0];
  successor.id=2;successor.name='Successor';s.villagers.push(successor);s.nextId=3;
  const progress=structuredClone(s.local.healerHome);s.villagers[0].age=s.config.life.death-1;s=stepDay(s);
  s=until(s,s=>s.local.healerHome.ownerId===2);
  assert.equal(s.local.healerHome.work,progress.work);assert.deepEqual(s.local.healerHome.spent,progress.spent);
  s=until(s,s=>!!s.villagers.find(v=>v.id===2).herbalist?.home);
  assert.deepEqual(s.villagers.find(v=>v.id===2).herbalist.home,progress.home);
  assert.equal(s.local.healerHome.rackWork,0);assert.equal(s.local.healerHome.markerWork,0);
});
test('a legacy deceased healer retains the old basic landmark, without spawning a new healer',()=>{
  const s=createState(rules,4);delete s.local.healerBuildingVersion;s.local.healerId=1;
  s.villagers=s.villagers.filter(v=>v.id!==1);
  const loaded=deserialize(serialize(s),rules);
  assert.equal(loaded.local.healerHome.work,3);assert.equal(loaded.local.healerHome.ownerId,null);
  assert.equal(loaded.villagers.some(v=>v.herbalist),false);
  assert.equal(loaded.local.healerHome.rackWork,0);assert.equal(loaded.local.healerHome.markerWork,0);
});

function inheritedFrame(){
  let s=candidate();findHomesteadHealer(s);s=stepDay(stepDay(stepDay(s)));
  assert.equal(s.local.healerHome.work,2);
  delete s.villagers[0].practice.known.housing;delete s.villagers[0].practice.known.cordage;
  s.villagers[0].traits=['Sociable'];s.villagers[0].practice.curiosity=.1;
  return s;
}
test('a successor without construction knowledge can work with a qualified builder at the inherited frame',()=>{
  let s=inheritedFrame();const owner=s.villagers[0],builder=candidate().villagers[0];
  builder.id=2;builder.name='Builder';builder.household=2;builder.gender=owner.gender;s.villagers.push(builder);s.nextId=3;
  const wood=s.wood,fibre=s.local.stock.fibre;s=stepDay(s);
  assert.equal(s.local.healerHome.work,3);assert.equal(s.wood,wood-1);assert.equal(s.local.stock.fibre,fibre-1);
  assert.equal(s.lastDay.actions.filter(a=>a.id===2).length,1);assert.equal(s.lastDay.actions.filter(a=>a.id===1).length,1);
  assert.equal(s.lastDay.actions.find(a=>a.id===2).action,'Build the herb hut');
  assert.equal(s.villagers[0].practice.known.housing,undefined,'helping does not grant unearned construction knowledge');
  assert.ok(s.villagers[1].practice.used.housing,'real construction is usable experience for future teaching');
  s=until(s,s=>s.local.healerHome.work===6);
  assert.deepEqual(s.local.healerHome.spent,{wood:6,fibre:2,stone:1});
});
test('an unqualified or hungry helper cannot advance the project for free',()=>{
  for(const condition of ['knowledge','hunger']){
    let s=inheritedFrame();const helper=candidate().villagers[0];helper.id=2;helper.household=2;
    if(condition==='knowledge')delete helper.practice.known.housing;else helper.fullness=5;
    s.villagers.push(helper);s.nextId=3;s=stepDay(s);
    assert.equal(s.local.healerHome.work,2,condition);
    assert.match(s.lastDay.healerProject.reason,/Waiting for a villager/);
  }
});
test('a caregiver can build during the day but waits for another caregiver before moving out',()=>{
  let s=candidate();const child=createState(rules,4).villagers[1];child.age=6;child.carers=[1];child.household=1;
  child.fullness=child.warmth=child.health=100;s.villagers.push(child);findHomesteadHealer(s);
  s=until(s,s=>s.local.healerHome?.work===6);
  s=stepDay(s);assert.equal(s.villagers[0].herbalist.home,undefined);
  assert.match(s.lastDay.healerProject.reason,/caregiver/);
});
test('an old crowded frame stays in place until NPCs plan and dismantle it, with accounted salvage',()=>{
  let s=candidate();findHomesteadHealer(s);s=stepDay(stepDay(stepDay(s)));
  s.huts=[0];s.local.healerHome.home=[143,170];const wood=s.wood;
  s=stepDay(s);assert.deepEqual(s.local.healerHome.home,[143,170]);assert.equal(s.local.healerHome.work,2);
  assert.ok(s.local.healerHome.relocation);assert.equal(s.wood,wood);
  s=stepDay(s);assert.notDeepEqual(s.local.healerHome.home,[143,170]);assert.equal(s.local.healerHome.work,0);
  assert.equal(s.wood,wood+1);assert.deepEqual(s.local.healerHome.previousSites[0].salvage,{wood:1});
  assert.equal(s.local.healerHome.previousSites[0].status,'dismantled');
  s=until(s,s=>s.local.healerHome.work===6);assert.deepEqual(s.local.healerHome.spent,{wood:6,fibre:2,stone:1});
});
test('completed or roofed shelters do not teleport to a new site',()=>{
  for(const progress of [3,6]){
    let s=candidate();findHomesteadHealer(s);s=until(s,s=>s.local.healerHome?.work===progress);
    s.huts=[0];s.local.healerHome.home=[143,170];s=stepDay(s);
    assert.deepEqual(s.local.healerHome.home,[143,170]);assert.equal(s.local.healerHome.relocation,undefined);
  }
});
test('a relocation plan and its existing frame remain after the owner dies and the save reloads',()=>{
  let s=candidate();findHomesteadHealer(s);s=stepDay(stepDay(stepDay(s)));
  s.huts=[0];s.local.healerHome.home=[143,170];s=stepDay(s);
  s.villagers[0].age=s.config.life.death-1;s.villagers[0].fullness=5;s.food=0;s=stepDay(s);
  assert.equal(s.villagers.length,0);assert.equal(s.local.healerHome.work,2);assert.ok(s.local.healerHome.relocation);
  assert.deepEqual(deserialize(serialize(s),rules).local.healerHome,s.local.healerHome);
});
test('collected building materials stay with the project instead of being repeatedly taken by other recipes',()=>{
  let s=candidate();findHomesteadHealer(s);s=stepDay(stepDay(stepDay(s)));
  s.local.stock.fibre=0;s=stepDay(s);
  assert.equal(s.local.healerHome.work,2);assert.equal(s.local.healerHome.materials.fibre,1);
  assert.equal(s.local.healerHome.materials.wood,1);assert.equal(s.lastDay.actions[0].action,'Collect fibre');
  s.local.stock.fibre=0;const wood=s.wood;s=stepDay(s);
  assert.equal(s.local.healerHome.work,3);assert.equal(s.local.healerHome.materials.fibre,0);
  assert.equal(s.wood,wood,'reserved wood is spent once, not charged again');
  assert.deepEqual(s.local.healerHome.spent,{wood:3,fibre:1});
});
test('construction keeps hearth fuel while avoiding an endless attempt to reach a surplus timber target',()=>{
  let s=candidate();findHomesteadHealer(s);s=stepDay(s);
  s.fireKnown=true;s.fireLit=true;s.wood=5;s=stepDay(s);
  assert.equal(s.local.healerHome.work,0);assert.equal(s.local.healerHome.materials.wood,1);
  assert.ok(s.wood>=s.config.settlement.fuelReserve+s.config.fire.dailyFuel);
  s=stepDay(s);assert.equal(s.local.healerHome.work,1);
  assert.ok(s.wood>=s.config.settlement.fuelReserve+s.config.fire.dailyFuel);
});
test('reserved supplies remain with unfinished construction after death and save/load',()=>{
  let s=candidate();findHomesteadHealer(s);s=stepDay(stepDay(stepDay(s)));
  s.local.stock.fibre=0;s=stepDay(s);const supplies=structuredClone(s.local.healerHome.materials);
  s.villagers[0].age=s.config.life.death-1;s.villagers[0].fullness=5;s.food=0;s=stepDay(s);
  assert.deepEqual(s.local.healerHome.materials,supplies);
  assert.deepEqual(deserialize(serialize(s),rules).local.healerHome.materials,supplies);
});
