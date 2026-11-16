import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,stepDay,unrelated,populationCap} from '../src/sim.js';
import {HOMESTEAD_RULES} from './fixtures/eating-profile.js';
import {planFamilyBirths,canWelcomeFamilyChild} from '../src/families.js';
import {familyPlan} from '../src/family-planning.js';
import {parentBirthBlockers} from '../src/population.js';
import {serialize,deserialize} from '../src/save.js';
const rules={...HOMESTEAD_RULES,traits:false,illness:{chance:0},weather:{chances:{normal:100,rain:0,drought:0,cold:0}},learning:{...HOMESTEAD_RULES.learning,climate:false,spoilage:0}};
function parents(){
  const s=createState(rules,4);s.day=100;s.villagers=s.villagers.slice(0,2);s.food=0;s.wood=50;s.fireKnown=true;s.settlementWork=5;s.config.tribeThresholds=[];
  s.huts=[0];s.hutDetails=[{shape:'dome hut'}];s.local.familyReadinessVersion=1;
  for(const [i,v] of s.villagers.entries()){
    v.gender=i?'male':'female';v.tribe=0;v.parents=[];v.health=v.happiness=v.fullness=v.warmth=v.practice.energy=100;v.lastCompanyDay=s.day;
    v.practice.known.familyplanning=1;v.practice.familyDecision={day:99,ready:false,reason:'Saving food before another child',available:0,required:40};
  }
  return s;
}
test('birth checks never read the pantry, meal costs, private stores or food history',()=>{
  const s=parents();s.config.birth.consecutiveDays=1;
  for(const [object,key] of [[s,'food'],[s.local,'campStores'],[s.local,'provisionHistory'],[s.config.needs,'mealCost']])Object.defineProperty(object,key,{get(){throw Error('birth check read '+key);},configurable:true});
  const pairs=planFamilyBirths(s,s.villagers,{unrelated,populationCap});assert.equal(pairs.length,1);
  assert.ok(canWelcomeFamilyChild(s,...[pairs[0][0],populationCap,pairs[0][1]]));
  assert.deepEqual(s.local.familyDiagnostics.families[0].reasons,[]);
  assert.equal(s.villagers[0].practice.familyDecision.reason,'Both people are willing to have a child');
});
test('actual daily births accept willing healthy parents without fullness or warmth thresholds',()=>{
  let s=parents();s.config.birth.consecutiveDays=1;
  for(const v of s.villagers){v.fullness=0;v.warmth=0;}
  s=stepDay(s);assert.equal(s.lastDay.births.length,1);
  const mother=s.villagers.find(v=>v.id===1);assert.ok(mother.health>=s.config.birth.health);
  assert.ok(mother.fullness<60||mother.warmth<50,'at least one old direct need gate would reject this parent');
});
test('either person can decline, regardless of food stocks or learned planning',()=>{
  for(const id of [1,2]){
    const s=parents();s.food=10000;const v=s.villagers.find(v=>v.id===id);v.wantsChildren=false;
    assert.equal(familyPlan(s,...s.villagers).ready,false);assert.equal(canWelcomeFamilyChild(s,s.villagers[0],populationCap,s.villagers[1]),false);
    const ready=planFamilyBirths(s,s.villagers,{unrelated,populationCap});assert.equal(ready.length,0);
    assert.ok(s.local.familyDiagnostics.families[0].reasons.includes('parent_unwilling'));
  }
});
test('both parents need health and willingness, with no substitute from wealth or a missing partner',()=>{
  const s=parents(),[mother,father]=s.villagers;s.food=10000;
  assert.equal(canWelcomeFamilyChild(s,mother,populationCap),false);
  for(const v of [mother,father]){
    v.health=69;assert.equal(canWelcomeFamilyChild(s,mother,populationCap,father),false);v.health=100;
    v.illnessDays=1;assert.equal(canWelcomeFamilyChild(s,mother,populationCap,father),false);v.illnessDays=0;
    v.happiness=49;assert.equal(canWelcomeFamilyChild(s,mother,populationCap,father),false);v.happiness=100;
  }
  assert.ok(canWelcomeFamilyChild(s,mother,populationCap,father));
});
test('a readiness streak follows the same willing pair and resets when a person declines',()=>{
  const s=parents(),[mother,father]=s.villagers;s.config.birth.consecutiveDays=3;
  planFamilyBirths(s,s.villagers,{unrelated,populationCap});assert.equal(mother.familyReadiness.days,1);
  s.day++;father.wantsChildren=false;planFamilyBirths(s,s.villagers,{unrelated,populationCap});assert.equal(mother.familyReadiness,undefined);
  const row=s.local.familyDiagnostics.families[0];assert.ok(row.reset);assert.ok(row.resetReasons.includes('parent_unwilling'));
  s.day++;father.wantsChildren=true;planFamilyBirths(s,s.villagers,{unrelated,populationCap});assert.equal(mother.familyReadiness.days,1);
});
test('saved preferences, knowledge and old food decisions load without restoring a food veto',()=>{
  const s=parents();s.villagers[1].wantsChildren=false;let loaded=deserialize(serialize(s),s.config);
  assert.equal(loaded.villagers[1].wantsChildren,false);assert.ok(loaded.villagers[0].practice.known.familyplanning);
  loaded.villagers[1].wantsChildren=true;assert.ok(familyPlan(loaded,...loaded.villagers).ready);
  assert.ok(canWelcomeFamilyChild(loaded,loaded.villagers[0],populationCap,loaded.villagers[1]));
  assert.equal(serialize(stepDay(loaded)),serialize(stepDay(deserialize(serialize(loaded),loaded.config))));
});
test('hunger and cold retain their health consequences even though pantry checks cannot veto births',()=>{
  const s=parents(),mother=s.villagers[0];mother.fullness=0;mother.warmth=0;mother.health=60;
  assert.deepEqual(parentBirthBlockers(s,mother),['parent_health']);
  const next=stepDay(s);assert.ok(next.villagers.find(v=>v.id===mother.id).health<60);assert.equal(next.lastDay.births.length,0);
});
