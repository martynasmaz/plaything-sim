import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,stepDay} from '../src/sim.js';
import {HOMESTEAD_RULES} from './fixtures/eating-profile.js';
import {nutritionRules,initNutrition,forecastMeals,planWinterMeals,winterMealThreshold,resolveNutrition} from '../src/nutrition.js';
import {communityFoodSupply,serveLocalMeal} from '../src/provisions.js';
import {serialize,deserialize} from '../src/save.js';
import {SCENARIO,validateScenario} from '../src/scenario.js';
const rules={...HOMESTEAD_RULES,traits:false,illness:{chance:0},weather:{chances:{normal:100,rain:0,drought:0,cold:0}},learning:{...HOMESTEAD_RULES.learning,climate:false}};
function village(){
  const s=createState(rules,60);s.villagers=s.villagers.slice(0,2);s.day=61;s.food=10;s.wood=60;s.fireKnown=s.fireLit=true;s.local.healerId=999;
  for(const v of s.villagers){v.fullness=v.warmth=v.health=v.happiness=v.practice.energy=100;v.illnessDays=0;v.lastCompanyDay=s.day;initNutrition(v).winterDays=3;v.nutrition.lastMealDay=s.day-1;}
  return s;
}
function feedDay(s,v,extra={}){
  const report={meals:[]};v.fullness=30;s.food+=1;assert.ok(serveLocalMeal(s,v,report,s,'food','test pantry'));
  resolveNutrition(s,v,report,extra);s.day++;return report;
}
test('forecasts count actual threshold-based servings, including winter portions',()=>{
  const s=village(),v=s.villagers[0];s.day=0;
  assert.equal(forecastMeals(s,[v],80),70);assert.equal(forecastMeals(s,[v],20,{winter:true}),10);
  v.age=3;const infant=forecastMeals(s,[v],20);v.age=30;
  assert.equal(infant,forecastMeals(s,[v],20),'forecast includes imminent end of infancy');
});

test('a single real meal fills empty or partly hungry people to 100 at the seasonal price',()=>{
  for(const [day,cost] of [[21,1],[61,.5]])for(const fullness of [0,20,50,75]){
    const s=village(),v=s.villagers[0],report={meals:[]};s.day=day;s.food=cost;v.fullness=fullness;
    assert.ok(serveLocalMeal(s,v,report,s,'food','test pantry'));assert.equal(v.fullness,100);
    assert.equal(s.food,0);assert.equal(report.mealServings[0].amount,cost);
    assert.equal(serveLocalMeal(s,v,report,s,'food','duplicate'),false);
  }
});
test('three real fed days clear only recorded hunger injury, with physical meal debits',()=>{
  const s=village(),v=s.villagers[0];s.day=100;v.health=40;v.nutrition.hungerInjury=60;const before=s.food;
  feedDay(s,v);feedDay(s,v);assert.equal(v.health,40);
  const r=feedDay(s,v);assert.equal(v.health,100);assert.equal(v.nutrition.hungerInjury,0);assert.equal(r.nutritionRecoveries[0].restored,60);
  assert.equal(s.food,before,'three supplied portions were consumed, not created by recovery');
});
test('nutrition recovery preserves illness/cold deficits and does not count normal healing twice',()=>{
  const s=village(),v=s.villagers[0];s.day=100;v.health=64;v.nutrition.hungerInjury=20;v.nutrition.fedDays=2;
  feedDay(s,v,{genericHealing:4});assert.equal(v.health,80);assert.equal(v.nutrition.hungerInjury,0);
  v.health=40;v.nutrition.hungerInjury=0;v.nutrition.fedDays=2;feedDay(s,v);assert.equal(v.health,40);
});
test('missed meals and new damage interrupt recovery; a meal cannot resurrect someone',()=>{
  const s=village(),v=s.villagers[0];s.day=100;v.health=40;v.nutrition.hungerInjury=60;
  feedDay(s,v);feedDay(s,v);resolveNutrition(s,v,{meals:[]});assert.equal(v.nutrition.fedDays,0);
  feedDay(s,v);feedDay(s,v,{otherDamage:10});assert.equal(v.nutrition.fedDays,0);assert.equal(v.health,40);
  v.health=0;v.nutrition.hungerInjury=100;v.nutrition.fedDays=2;feedDay(s,v);assert.equal(v.health,0);
});
test('hunger injury is tracked separately from simultaneous other damage',()=>{
  const s=village(),v=s.villagers[0];v.health=70;
  resolveNutrition(s,v,{meals:[]},{hungerDamage:10,otherDamage:20});assert.equal(v.nutrition.hungerInjury,10);
});
test('experienced winter camps forecast a shortfall and stagger safe adult meal turns',()=>{
  const s=village();for(const v of s.villagers)v.fullness=75;
  const before=s.food;planWinterMeals(s,{},communityFoodSupply);const plan=s.local.winterRations.communities[0];
  assert.ok(plan.active);assert.equal(plan.remainingDays,20);assert.ok(plan.forecastDemand>plan.available);
  const thresholds=s.villagers.map(v=>winterMealThreshold(s,v)).sort((a,b)=>a-b);
  assert.ok(thresholds[0]<75&&thresholds[0]>74.99);assert.equal(thresholds[1],75);assert.equal(s.food,before);
  s.day++;planWinterMeals(s,{},communityFoodSupply);
  assert.notDeepEqual(s.local.winterRations.communities[0].mealTurnIds,plan.mealTurnIds);
});
test('children, elders, sick people, carers and hunger recovery bypass ration deferrals',()=>{
  const s=village(),v=s.villagers[0];planWinterMeals(s,{},communityFoodSupply);
  for(const kind of ['child','elder','ill','weak','carer','hunger','travel','tired']){
    const x=structuredClone(v);
    if(kind==='child')x.age=5;if(kind==='elder')x.age=s.config.life.elder;if(kind==='ill')x.illnessDays=1;
    if(kind==='weak')x.health=69;if(kind==='carer')x.family={goal:'care'};if(kind==='hunger')x.nutrition.hungerInjury=10;
    if(kind==='travel')x.campJourney={to:1};if(kind==='tired')x.practice.energy=10;
    assert.equal(winterMealThreshold(s,x),75,kind);
  }
  v.fullness=25;assert.ok(v.fullness<=winterMealThreshold(s,v),'hunger always qualifies for food');
});
test('no invented experience, neighbor stores, ingredients or summer rationing',()=>{
  const s=village();for(const v of s.villagers)v.nutrition.winterDays=0;
  planWinterMeals(s,{},communityFoodSupply);assert.equal(s.local.winterRations.communities[0].active,false);
  for(const v of s.villagers)v.nutrition.winterDays=3;
  s.local.stock.flour=s.local.stock.wheat=1000;s.local.campStores[9]={saved:1000,rack:1000};
  planWinterMeals(s,{},communityFoodSupply);assert.equal(s.local.winterRations.communities[0].available,s.food);
  assert.ok(s.local.winterRations.communities[0].active);
  s.food=100;planWinterMeals(s,{},communityFoodSupply);assert.equal(s.local.winterRations.communities[0].active,false);
  s.day=21;planWinterMeals(s,{},communityFoodSupply);assert.equal(s.local.winterRations,undefined);
});
test('actual daily scheduler recovers hunger health after feeding and honors safe ration thresholds',()=>{
  let s=village();s.day=100;s.food=100;const v=s.villagers[0];v.health=40;v.nutrition.hungerInjury=60;v.nutrition.fedDays=2;
  s=stepDay(s);assert.equal(s.villagers.find(p=>p.id===v.id).health,100);assert.ok(s.lastDay.nutritionRecoveries.some(e=>e.id===v.id));
  s=village();s.day=60;for(const p of s.villagers){p.fullness=100;p.nutrition.lastMealDay=60;}
  s=stepDay(s);assert.ok(s.lastDay.winterRations.communities[0].active);
  assert.equal(s.lastDay.meals.length,1);assert.equal(s.lastDay.rationDeferrals.length,1);
  assert.ok(s.villagers.every(p=>p.fullness>s.config.needs.damageAtOrBelow));
});
test('nutrition and planned turns persist on save; old saves do not invent recoverable injury',()=>{
  const s=village(),v=s.villagers[0];v.nutrition.hungerInjury=20;v.nutrition.fedDays=2;planWinterMeals(s,{},communityFoodSupply);
  const loaded=deserialize(serialize(s),s.config);assert.deepEqual(loaded.villagers[0].nutrition,v.nutrition);
  assert.equal(serialize(stepDay(s)),serialize(stepDay(loaded)));
  const old=structuredClone(v);delete old.nutrition;old.health=40;assert.equal(initNutrition(old).hungerInjury,0);assert.equal(old.health,40);
});
test('feature can be disabled and nutrition settings reject invalid recovery/forecast rules',()=>{
  const s=village(),v=s.villagers[0],enabled=nutritionRules.enabled;
  try{nutritionRules.enabled=false;assert.equal(winterMealThreshold(s,v),75);planWinterMeals(s,{},communityFoodSupply);assert.equal(s.local.winterRations,undefined);}
  finally{nutritionRules.enabled=enabled;}
  for(const [key,value] of [['recoveryFedDays',0],['rationExperienceDays',1.5],['rationIncomeConfidence',2],['recoveryWarmth',101],['enabled','yes']]){
    const settings=structuredClone(SCENARIO);settings.nutrition[key]=value;
    assert.ok(validateScenario(settings).some(e=>e.includes(key)),key);
  }
});

test('rationing never voluntarily skips twice or spends tomorrow’s recovery reserve',()=>{
  const s=village(),v=s.villagers[0];v.fullness=75;planWinterMeals(s,{},communityFoodSupply);
  const plan=s.local.winterRations.communities[0];plan.mealTurnIds=[];
  assert.ok(v.fullness>winterMealThreshold(s,v));
  v.fullness=74;assert.ok(v.fullness<=winterMealThreshold(s,v),'insufficient recovery reserve means eat');
  v.fullness=75;v.nutrition.lastMealDay=s.day-2;assert.equal(winterMealThreshold(s,v),75,'previously missed meals take priority');
});
