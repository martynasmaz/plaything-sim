import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,stepDay} from '../src/sim.js';
import {HOMESTEAD_RULES} from '../src/config.js';
import {practices,canExperiment,makePracticeProduct,finishOrdinaryWork,valleySeason} from '../src/practices.js';
import {fishingMethod,fishingDependencies,fishingPhase,hasFishingGear} from '../src/fishing.js';
import {serialize,deserialize} from '../src/save.js';

function fresh(){
  const s=createState({...HOMESTEAD_RULES,traits:false,illness:{chance:0}},4);
  s.food=90;s.wood=30;s.local.stock.fibre=20;s.local.stock.stone=20;
  s.local.healerId=999;s.lastUsed.godzilla=0;s.natural.weather='normal';s.natural.illness=false;
  for(const v of s.villagers){delete v.herbalist;v.fullness=v.warmth=v.health=v.happiness=100;}
  return s;
}
test('new traps require the fisher’s binding knowledge, waterside experience and physical materials',()=>{
  const s=fresh(),v=s.villagers[0];v.practice.known.fishtraps=1;delete v.practice.known.gathering;
  assert.equal(makePracticeProduct(s,v,'fishtraps'),false);
  v.practice.known.gathering=1;assert.equal(makePracticeProduct(s,v,'fishtraps'),false);
  v.practice.watersideVisits=2;v.practice.skills.fibre=2;s.local.stock.fibre=1;
  assert.equal(makePracticeProduct(s,v,'fishtraps'),false);
  s.local.stock.fibre=2;const wood=s.wood;
  assert.ok(makePracticeProduct(s,v,'fishtraps'));assert.equal(s.wood,wood-1);
  assert.equal(s.local.stock.fibre,0);assert.ok(v.fishTrap);assert.ok(hasFishingGear(v));
  assert.equal(hasFishingGear(s.villagers[1]),false);
});
test('nets need cordage, fishing and fibre experience, floats and sinkers, with no loom requirement',()=>{
  const s=fresh(),v=s.villagers[0],p=v.practice,r=practices.fishnets;
  p.properties=['flexible'];p.skills.fibre=3;p.skills.fish=3;
  assert.equal(canExperiment(s,v,r),false);
  p.known.cordage=1;assert.ok(canExperiment(s,v,r));
  assert.ok(fishingDependencies(s,'fishing net'));assert.ok(!s.textiles?.includes('loom'));
  s.local.stock.stone=1;assert.equal(canExperiment(s,v,r),false);
  s.local.stock.stone=2;p.known.fishnets=1;
  const before={fibre:s.local.stock.fibre,wood:s.wood};
  assert.ok(makePracticeProduct(s,v,'fishnets'));
  assert.equal(s.local.stock.stone,0);assert.equal(s.local.stock.fibre,before.fibre-4);assert.equal(s.wood,before.wood-1);
  assert.equal(fishingMethod(v),'net');
});
test('spears can develop without cordage or nets; hooks and poles form their own branch',()=>{
  const s=fresh(),v=s.villagers[0],p=v.practice;
  p.watersideVisits=2;p.skills.wood=2;p.known.fishspears=1;
  assert.ok(makePracticeProduct(s,v,'fishspears'));assert.equal(fishingMethod(v),'spear');
  p.known.angling=1;p.known.fishingpoles=1;p.skills.fish=3;
  assert.equal(makePracticeProduct(s,v,'fishingpoles'),false);
  p.known.knapping=p.known.cordage=1;
  assert.equal(makePracticeProduct(s,v,'angling'),false);
  s.local.stock.bone=1;assert.ok(makePracticeProduct(s,v,'angling'));assert.equal(s.local.stock.bone,0);
  assert.ok(makePracticeProduct(s,v,'fishingpoles'));assert.equal(fishingMethod(v),'pole');
  assert.ok(!p.gear['fishing net']);
});
test('actual fishing develops fishing experience rather than fibre-gathering experience',()=>{
  const s=fresh(),v=s.villagers[0],p=v.practice;
  finishOrdinaryWork(s,v,'fish');assert.equal(p.skills.fish,1);assert.equal(p.skills.fibre,undefined);
  assert.equal(p.watersideVisits,1);assert.ok(p.properties.includes('perishable'));
});
test('successful hunts supply bone for hooks',()=>{
  const s=fresh();s.food=0;s.gameAnimals=1;s.villagers[0].gear='bow';
  const next=stepDay(s);assert.ok(next.lastDay.actions.some(a=>a.action==='Hunt'));
  assert.equal(next.local.stock.bone,1);
});
test('existing fishing gear is usable without rediscovering its recipe and remains bounded by fish stocks',()=>{
  const s=fresh();s.food=0;s.gameAnimals=0;
  for(const v of s.villagers)v.practice.gear['fishing net']=true;
  s.local.deposits.fish=0;
  const next=stepDay(s),catches=Object.values(next.lastDay.fishing||{});
  assert.ok(catches.length>0);assert.ok(catches.every(f=>f.method==='net'));
  assert.ok(catches.reduce((n,f)=>n+f.caught,0)<=3);
});
test('an existing set net is checked before the same stock is used by individual spear fishers',()=>{
  const s=fresh();s.food=0;s.gameAnimals=0;s.local.deposits.fish=0;
  for(const v of s.villagers)v.practice.gear['fishing spear']=true;
  s.villagers.at(-1).practice.gear['fishing net']=true;
  const next=stepDay(s),first=next.lastDay.actions.find(a=>a.action==='Fish');
  assert.equal(first.id,s.villagers.at(-1).id);
  assert.equal(next.lastDay.fishing[first.id].method,'net');
  assert.equal(next.lastDay.fishing[first.id].caught,3);
});
test('flooded or frozen water prevents every fishing method, including weekly checks',()=>{
  for(const frozen of [false,true]){
    const s=fresh();s.food=0;s.gameAnimals=0;
    for(const v of s.villagers)v.practice.gear['fishing net']=true;
    if(frozen){let day=61;while(!valleySeason(s,day).frozen)day++;s.day=day-1;}
    else s.lastUsed.flood=s.day;
    const next=stepDay(s);assert.equal(Object.keys(next.lastDay.fishing||{}).length,0);
    assert.ok(!(next.lastDay.weeklyWork||[]).some(w=>w.item==='fishing net'&&w.result==='stored one provision'));
  }
});
test('old trap and misnamed-net saves retain equipment and discoveries while bone stock defaults safely',()=>{
  const s=fresh();delete s.local.stock.bone;
  s.villagers[0].fishingNet=true;s.villagers[1].fishTrap=true;s.local.first.cordage=2;
  const back=deserialize(serialize(s),HOMESTEAD_RULES);
  assert.ok(back.villagers[0].fishTrap&&back.villagers[1].fishTrap);
  assert.equal(back.local.stock.bone,0);assert.equal(back.local.first.cordage,2);
  back.villagers[0].practice.gear['fishing net']=true;
  const twice=deserialize(serialize(back),HOMESTEAD_RULES);
  assert.ok(twice.villagers[0].practice.gear['fishing net']);
});
test('river work is distinct from walking to the bank and carrying fish away',()=>{
  assert.equal(fishingPhase(0,true,0),'approach');
  assert.equal(fishingPhase(1,false,10),'work');
  assert.equal(fishingPhase(1,true,0),'carry');
  assert.equal(fishingPhase(1,false,0),'carry');
  assert.equal(fishingPhase(2,false,0),'delivered');
});
