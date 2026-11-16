import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {HOMESTEAD_RULES} from '../src/config.js';
import {SCENARIO,validateScenario} from '../src/scenario.js';
import {createState,stepDay} from '../src/sim.js';
import {mealCostFor,serveLocalMeal,foodDaysFor,foodLedger,recordFoodBalance,winterStorageTarget} from '../src/provisions.js';
import {serialize,deserialize} from '../src/save.js';
const root=new URL('../src/',import.meta.url);
let source=readFileSync(new URL('sim.js',root),'utf8').replace(/from '(\.\/[^']+)'/g,(_,p)=>'from '+JSON.stringify(new URL(p,root).href));
source+='\nexport {meals,householdCare,resolveNeeds};';
const probe=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
function village(day=61){
  const s=createState({...HOMESTEAD_RULES,traits:false,illness:{chance:0},learning:{...HOMESTEAD_RULES.learning,climate:false}},60);
  s.day=day;s.local.season='Winter';s.food=0;s.config.tribeThresholds=[];s.local.campStores[0]={saved:0,rack:0};
  for(const v of s.villagers){v.fullness=70;v.warmth=100;v.health=80;v.traits=[];}
  return s;
}
const report=()=>({actions:[],meals:[],beforeMeals:[],traitEvents:[],traitCandidates:[],traitLines:0,damage:[]});
test('winter cost follows exact boundaries and migrated offsets, not the cached label',()=>{
  const s=village();
  for(const [day,cost] of [[1,1],[60,1],[61,.25],[80,.25],[81,1],[140,1],[141,.25]]){s.day=day;assert.equal(mealCostFor(s),cost);}
  s.day=1;s.local.seasonOffset=60;s.local.season='Spring';assert.equal(mealCostFor(s),.25);
  s.config.needs.winterMealFraction=1;assert.equal(mealCostFor(s),1);
  delete s.config.needs.winterMealFraction;assert.equal(mealCostFor(s),1);
  s.config.learning=false;assert.equal(mealCostFor(s),1);
});
test('a quarter portion gives the same fullness, health recovery and safety as a full nonwinter meal',()=>{
  const winter=village(),spring=village(81);
  for(const s of [winter,spring]){
    const v=s.villagers[0],r=report();s.food=1;v.fullness=50;
    assert.ok(serveLocalMeal(s,v,r,s,'food','shared pantry'));
    probe.resolveNeeds(s,v,true,r);assert.equal(v.fullness,100);assert.equal(v.health,84);
    assert.equal(serveLocalMeal(s,v,r,s,'food','duplicate'),false);
  }
  assert.equal(winter.food,.75);assert.equal(spring.food,0);
  assert.deepEqual(['fullness','health','safety','happiness'].map(k=>winter.villagers[0][k]),['fullness','health','safety','happiness'].map(k=>spring.villagers[0][k]));
});
test('the scheduler shares one winter ration between four people and rejects less than a quarter',()=>{
  const s=village(),r=report();s.food=1;s.villagers=s.villagers.slice(0,5);
  probe.meals(s,s.villagers,r);assert.equal(r.meals.length,4);assert.equal(s.food,0);
  assert.ok(r.mealServings.every(m=>m.amount===.25));
  s.food=.125;const r2=report();probe.meals(s,s.villagers,r2);assert.equal(r2.meals.length,0);assert.equal(s.food,.125);
});
test('winter camp, eastern, carried, curd and care meals all spend the same quarter portion',()=>{
  for(const route of ['camp','east','travel','curds','care']){
    const s=village(),r=report();s.villagers=s.villagers.slice(0,route==='care'?2:1);const v=s.villagers[0];
    if(route==='camp')s.local.campStores[v.tribe||0].saved=.25;
    if(route==='east')s.local.daughter={members:[v.id],food:.25};
    if(route==='travel')v.travelMeals=.25;
    if(route==='curds')s.local.stock.curds=.25;
    if(route==='care'){
      s.food=.25;v.fullness=20;v.illnessDays=2;v.household=1;
      const helper=s.villagers[1];helper.fullness=100;helper.household=1;
      probe.householdCare(s,s.villagers,r);
    }
    probe.meals(s,s.villagers,r);assert.deepEqual(r.meals,[v.id],route);
    assert.equal(r.mealServings[0].amount,.25,route);assert.equal(foodLedger(s).home+foodLedger(s).east,0,route);
  }
});
test('winter yield observations count physical portions rather than full-sized meals',()=>{
  const s=village(),v=s.villagers[0];s.villagers=[v];s.food=.25;
  const r=report();r.foodAtDawn=foodLedger(s);serveLocalMeal(s,v,r,s,'food','shared pantry');recordFoodBalance(s,r);
  assert.equal(s.local.winterFoodObservation.home,0,'eating existing stock is not new production');
  assert.equal(foodDaysFor({...s,food:1},v),4);
});
test('winter reserve target uses normal portions even when winter meals are discounted',()=>{
  const s=village(50),v=s.villagers[0];s.villagers=[v];v.practice.known.drying=1;v.practice.winterFoodDays=7;
  s.local.lastWinterFood={home:0,homePerPerson:0};
  assert.equal(winterStorageTarget(s,[v],100),s.local.campPeakPopulation[v.tribe||0]*20);
  const target=winterStorageTarget(s,[v],100);s.config.needs.winterMealFraction=1;assert.equal(winterStorageTarget(s,[v],100),target);
});
test('fractional stores survive saving and the winter-to-spring serving transition',()=>{
  const s=village(80);s.food=.25;s.local.campStores[0].saved=1.25;s.local.dried=.25;s.villagers[0].travelMeals=.25;
  const loaded=deserialize(serialize(s),s.config);assert.ok(loaded);assert.equal(loaded.food,.25);
  assert.equal(loaded.local.campStores[0].saved,1.25);assert.equal(mealCostFor(loaded),.25);
  loaded.day=81;assert.equal(mealCostFor(loaded),1);assert.equal(serveLocalMeal(loaded,loaded.villagers[0],report(),loaded,'food','pantry'),false);
  assert.deepEqual(stepDay(deserialize(serialize(s),s.config)),{...stepDay(s),speed:0,elapsedMs:0});
});
test('scenario exposes a positive winter fraction up to one',()=>{
  assert.equal(SCENARIO.simulation.needs.winterMealFraction,.25);assert.deepEqual(validateScenario(),[]);
  for(const value of [0,-.5,1.1,NaN]){const c=structuredClone(SCENARIO);c.simulation.needs.winterMealFraction=value;assert.ok(validateScenario(c).some(e=>e.includes('winterMealFraction')));}
});
