import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,preservationPlan,preservationWork,sleepingHut} from '../src/sim.js';
import {HOMESTEAD_RULES} from '../src/config.js';
import {rememberCampPeaks,winterStorageTarget,foodLedger} from '../src/provisions.js';
import {storageCapacity,refreshHouseStorage} from '../src/storage.js';
import {serialize,deserialize} from '../src/save.js';

function village(){
  const s=createState(HOMESTEAD_RULES,60),v=s.villagers[0];
  s.day=25;s.food=100;s.wood=80;s.fireKnown=s.fireLit=true;s.local.season='Summer';s.natural.weather='normal';
  s.huts=[0,0];s.hutDetails=[{shape:'round hut'},{shape:'round hut'}];
  Object.assign(v.practice.known,{housing:1,cordage:1,drying:1});v.practice.skills.wood=4;v.practice.used.drying=1;
  v.fullness=v.health=v.warmth=v.happiness=v.practice.energy=100;s.local.stock.fibre=10;
  return {s,v};
}
const report=()=>({actions:[],meals:[]});
function workAtSite(s,v){const plan=preservationPlan(s,v);assert.ok(plan);v.practice.position=plan.site.slice();v.practice.site='camp';return preservationWork(s,v,report());}

test('each camp retains its own peak and plans an undiscounted full winter',()=>{
  const {s}=village();delete s.local.campPeakPopulation;
  s.villagers.forEach((v,i)=>v.tribe=i<4?0:1);rememberCampPeaks(s);
  const camp0=s.villagers.filter(v=>!v.tribe),camp1=s.villagers.filter(v=>v.tribe);
  assert.equal(winterStorageTarget(s,camp0,999),80);assert.equal(winterStorageTarget(s,camp1,999),40);
  s.villagers=s.villagers.filter(v=>v!==camp0[0]);rememberCampPeaks(s);
  s.local.lastWinterFood={home:1000};s.config.needs.winterMealFraction=.1;
  assert.equal(winterStorageTarget(s,s.villagers.filter(v=>!v.tribe),999),80);
  const loaded=deserialize(serialize(s),s.config);assert.equal(loaded.local.campPeakPopulation[0],4);
  delete loaded.local.campPeakPopulation;rememberCampPeaks(loaded);assert.equal(loaded.local.campPeakPopulation[0],3,'legacy save uses local evidence');
});

test('house capacity requires completed paid fittings and keeps a single food account',()=>{
  const {s,v}=village(),slot=sleepingHut(s,v),food=foodLedger(s),wood=s.wood,fibre=s.local.stock.fibre;
  refreshHouseStorage(s);assert.equal(storageCapacity(s.local.campStores[0]),0);
  // Work journeys are paid separately; arrive before the two fitting days.
  for(let i=0;i<20&&(s.hutDetails[slot].foodStore?.work||0)<2;i++)workAtSite(s,v);
  assert.equal(s.hutDetails[slot].foodStore.work,2);assert.equal(s.wood,wood-2);assert.equal(s.local.stock.fibre,fibre-2);
  assert.equal(storageCapacity(s.local.campStores[0]),12);assert.deepEqual(foodLedger(s),food);
  const loaded=deserialize(serialize(s),s.config);loaded.villagers=[];refreshHouseStorage(loaded);
  assert.equal(storageCapacity(loaded.local.campStores[0]),12,'fittings remain after household dies');
  loaded.hutDetails[slot].ruined=true;refreshHouseStorage(loaded);assert.equal(storageCapacity(loaded.local.campStores[0]),0);
});

test('hungry or untrained villagers do not fit house stores',()=>{
  const {s,v}=village();delete v.practice.known.cordage;assert.notEqual(preservationPlan(s,v)?.kind,'house');
  v.practice.known.cordage=1;v.fullness=0;assert.equal(preservationPlan(s,v),null);
  assert.equal(s.hutDetails.some(h=>h.foodStore),false);
});
