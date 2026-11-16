import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,stepDay,unrelated,populationCap,shouldPlanHut} from '../src/sim.js';
import {HOMESTEAD_RULES} from '../src/config.js';
import {familyFoodReady,familyFoodStable,familyFoodBudget,recordFoodBalance,foodLedger,familyFoodSnapshot} from '../src/provisions.js';
import {familyPlan} from '../src/family-planning.js';
import {planFamilyBirths} from '../src/families.js';
import {housingForecast,recordGrowthDay} from '../src/population.js';
import {practices,canExperiment} from '../src/practices.js';
import {serialize,deserialize} from '../src/save.js';
import {SCENARIO,validateScenario} from '../src/scenario.js';
const rules={...HOMESTEAD_RULES,traits:false,illness:{chance:0},weather:{chances:{normal:100,rain:0,drought:0,cold:0}},learning:{...HOMESTEAD_RULES.learning,climate:false,spoilage:0}};
function fixture(){
  const s=createState(rules,4);s.day=100;s.food=100;s.wood=40;s.fireKnown=s.fireLit=true;s.settlementWork=15;s.config.tribeThresholds=[];
  s.villagers=s.villagers.slice(0,4);s.huts=[];s.local.season='Spring';s.local.lastWinterFood={home:3,east:0};
  for(const [i,v] of s.villagers.entries()){v.age=40;v.gender=i%2?'male':'female';v.parents=[];v.tribe=0;v.fullness=v.warmth=v.health=v.happiness=v.practice.energy=100;v.lastCompanyDay=s.day;}
  return s;
}
test('food diagnostics respect private reserves without moving food, while learned willingness remains ready',()=>{
  const s=fixture(),m=s.villagers[0];s.villagers[2].tribe=s.villagers[3].tribe=1;s.food=0;
  s.local.campStores[0]={saved:20};s.local.campStores[1]={saved:0};
  s.local.provisionHistory=Array.from({length:7},(_,i)=>({day:94+i,home:-2,hungryHome:true,communities:{0:{change:0,hungry:false},1:{change:-2,hungry:true}}}));
  const before=structuredClone(s);assert.ok(familyFoodReady(s,m));assert.ok(familyFoodStable(s,m));
  m.practice.known.familyplanning=1;assert.ok(familyPlan(s,m,s.villagers[1]).ready);
  assert.equal(familyFoodReady(s,s.villagers[2]),false);assert.equal(familyFoodStable(s,s.villagers[2]),false);
  assert.equal(s.food,before.food);assert.deepEqual(s.local.campStores,before.local.campStores);
});
test('the relocation food budget accounts for communal diners, private stores and unfinished ingredients',()=>{
  const s=fixture();s.villagers[2].tribe=s.villagers[3].tribe=1;s.food=12;
  assert.ok(familyFoodReady(s,s.villagers[0]));assert.equal(familyFoodBudget(s,s.villagers[0]).available,8);
  s.villagers.push({id:99,age:0,tribe:0});assert.equal(familyFoodReady(s,s.villagers[2]),false);
  s.food=0;s.local.stock.wheat=s.local.stock.flour=1000;s.local.campStores[0]={saved:0,rack:1000};
  assert.equal(familyFoodReady(s,s.villagers[0]),false,'unfinished ingredients do not pay the budget');
});
test('meal costs do not change willingness or add a reserve requirement',()=>{
  const s=fixture(),m=s.villagers[0];s.config.needs.mealCost=2;m.practice.known.familyplanning=1;s.food=34;
  assert.ok(familyPlan(s,m,s.villagers[1]).ready);assert.equal(familyPlan(s,m,s.villagers[1]).required,undefined);
  s.food=0;assert.ok(familyPlan(s,m,s.villagers[1]).ready);
});
test('food history records actual local hunger and shared/private availability without inventing old evidence',()=>{
  const s=fixture();s.villagers[2].tribe=s.villagers[3].tribe=1;s.local.campStores[0]={saved:20};s.local.campStores[1]={saved:0};s.food=0;
  const r={foodAtDawn:foodLedger(s),familyFoodAtDawn:familyFoodSnapshot(s),meals:[1,2],actions:[]};s.villagers[2].fullness=10;
  recordFoodBalance(s,r);assert.equal(s.local.provisionHistory.at(-1).communities[0].hungry,false);assert.equal(s.local.provisionHistory.at(-1).communities[1].hungry,true);
  s.local.provisionHistory=[{home:-10,hungryHome:true}];assert.ok(familyFoodStable(s,s.villagers[0]),'an old multi-camp record cannot identify this camp');
  s.villagers=s.villagers.slice(0,2);assert.equal(familyFoodStable(s,s.villagers[0]),false,'a single-community legacy record remains relevant');
});
test('real birth checks record overlapping blockers and exact personal readiness interruptions',()=>{
  const s=fixture(),m=s.villagers[0];s.local.familyReadinessVersion=1;m.familyReadiness={fatherId:2,days:2,lastDay:99};
  m.health=40;m.illnessDays=2;m.recoveryUntil=105;s.food=0;s.config.limits.population=4;
  s.local.provisionHistory=[{home:-3,hungryHome:true}];
  planFamilyBirths(s,s.villagers.filter(v=>v!==m),{unrelated,populationCap});
  const row=s.local.familyDiagnostics.families.find(r=>r.motherId===m.id);
  for(const reason of ['parent_health','parent_illness','maternal_recovery','housing_capacity'])assert.ok(row.reasons.includes(reason),reason);
  for(const reason of ['insufficient_finished_food','recent_local_hunger','declining_food_reserves'])assert.equal(row.reasons.includes(reason),false,reason);
  assert.equal(row.previousDays,2);assert.ok(row.reset);assert.equal(m.familyReadiness,undefined);
  assert.equal(row.resetReasons.includes('housing_capacity'),false,'housing holds readiness; it does not reset it');
});
test('a sibling-only pool is distinguished from a compatible but sick partner',()=>{
  const s=fixture();s.villagers=s.villagers.slice(0,2);for(const v of s.villagers)v.parents=[90,91];
  planFamilyBirths(s,s.villagers,{unrelated,populationCap});assert.ok(s.local.familyDiagnostics.families[0].reasons.includes('no_unrelated_partner'));
  s.villagers[1].parents=[];s.villagers[1].illnessDays=2;
  planFamilyBirths(s,[s.villagers[0]],{unrelated,populationCap});const row=s.local.familyDiagnostics.families[0];
  assert.ok(row.reasons.includes('parent_illness'));assert.equal(row.reasons.includes('no_unrelated_partner'),false);
});
test('housing anticipates compatible near-adults but never promises unrelatedness, food or free beds',()=>{
  const s=fixture();for(const v of s.villagers)v.age=12;
  const f=housingForecast(s,0);assert.equal(f.expectedChildren,2);assert.equal(f.localDeficit,0);assert.equal(f.capacityDeficit,0);
  s.villagers.push(...structuredClone(s.villagers.slice(0,2)).map((v,i)=>({...v,id:50+i})));
  assert.ok(shouldPlanHut(s));assert.equal(s.huts.length,0);
  for(const v of s.villagers)v.parents=[90,91];assert.equal(housingForecast(s,0).families,0);assert.equal(shouldPlanHut(s),false);
  for(const v of s.villagers)v.parents=[];s.food=0;assert.ok(shouldPlanHut(s),'prospective families no longer need a pantry forecast');
  s.food=100;s.huts=[0];assert.equal(shouldPlanHut(s),false,'completed capacity ends the forecast need');
});
test('a family forecast motivates shelter study without bypassing personal prerequisites or materials',()=>{
  const s=fixture(),v=s.villagers[0];s.villagers.push(...structuredClone(s.villagers.slice(0,2)).map((v,i)=>({...v,id:50+i})));v.warmth=100;v.outdoors=false;
  Object.assign(v.practice.known,{cordage:1});v.practice.gear.cord=true;v.practice.properties.push('insulating');s.local.stock.hide=3;
  assert.ok(canExperiment(s,v,practices.housing));delete v.practice.known.cordage;assert.equal(canExperiment(s,v,practices.housing),false);
});
test('cohort tracking separates births, maturation and child loss and starts honestly in old worlds',()=>{
  const s=fixture();s.day=120;s.local.populationHistory=[{first:120,last:120}];s.local.growth={sinceDay:100,initialPopulation:4,peak:4,births:1,deaths:0,matured:0,bornMatured:0,childDeaths:0,workingAgeDeaths:0,personDays:0,populationDays:0,blockerFamilyDays:{},resetReasons:{},cohorts:[{first:100,births:1,matured:0,childDeaths:0}]};
  s.villagers=s.villagers.slice(0,1);s.villagers[0].age=20;
  recordGrowthDay(s,[{id:1,age:19},{id:2,age:2}],{births:[],deaths:[{id:2}],familyDiagnostics:{families:[]}});
  assert.equal(s.local.growth.matured,1);assert.equal(s.local.growth.bornMatured,1);assert.equal(s.local.growth.childDeaths,1);assert.equal(s.local.growth.cohorts[0].matured,1);
  delete s.local.growth;s.day=200;recordGrowthDay(s,[{id:1,age:19}],{births:[],deaths:[]});assert.equal(s.local.growth.sinceDay,200);assert.equal(s.local.growth.bornMatured,0);
});
test('new diagnostics, food histories and growth cohorts replay identically through saves',()=>{
  let s=fixture();for(let i=0;i<4;i++)s=stepDay(s);
  assert.ok(s.local.growth);assert.ok(s.local.familyDiagnostics);assert.ok(s.local.provisionHistory.at(-1).communities);
  const loaded=deserialize(serialize(s),rules);assert.ok(loaded);assert.equal(serialize(stepDay(s)),serialize(stepDay(loaded)));
  const old=structuredClone(s);delete old.local.growth;delete old.local.familyDiagnostics;
  const migrated=deserialize(serialize(old),rules);assert.ok(migrated);assert.equal(stepDay(migrated).local.growth.sinceDay,s.day+1);
});
test('housing forecast controls reject invalid edits',()=>{
  const settings=structuredClone(SCENARIO);settings.simulation.learning.housingLookAheadDays=-1;settings.simulation.learning.housingExpectedChildren=.5;
  const errors=validateScenario(settings);assert.ok(errors.some(e=>e.includes('housingLookAheadDays')));assert.ok(errors.some(e=>e.includes('housingExpectedChildren')));
});
