import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,stepDay,unrelated,populationCap} from '../src/sim.js';
import {HOMESTEAD_RULES} from '../src/config.js';
import {serialize,deserialize} from '../src/save.js';
import {observeEvents,dailyBirthIds} from '../src/village-events.js';
import {planFamilyBirths,canWelcomeFamilyChild} from '../src/families.js';
import {mainFoodRequired} from '../src/provisions.js';

const familyRules={...HOMESTEAD_RULES,traits:false,illness:{chance:0},weather:{chances:{normal:100,rain:0,drought:0,cold:0}},learning:{...HOMESTEAD_RULES.learning,climate:false,spoilage:0,experimentChance:0}};
function families(){
  const s=createState(familyRules,4);s.villagers=s.villagers.slice(0,4);s.food=200;s.wood=80;s.fireKnown=s.fireLit=true;s.settlementWork=15;
  s.huts=[0,0,0];s.hutDetails=s.huts.map(()=>({shape:'round hut'}));s.config.tribeThresholds=[];
  for(const [i,v] of s.villagers.entries()){v.gender=i%2?'male':'female';v.tribe=0;v.parents=[];v.fullness=v.warmth=v.health=v.happiness=100;v.practice.energy=100;v.lastCompanyDay=s.day;}
  return s;
}
function prepared(s){s.food=200;s.wood=80;for(const v of s.villagers){v.fullness=v.warmth=v.health=v.happiness=100;v.practice.energy=100;v.illnessDays=0;v.lastCompanyDay=s.day;}return s;}
function readyMother(s,id,fatherId,days){s.local.familyReadinessVersion=1;s.villagers.find(v=>v.id===id).familyReadiness={fatherId,days,lastDay:s.day};}

test('two ready families in the same camp give birth on the same day, with every record counted',()=>{
  let s=families();for(let i=0;i<3;i++)s=stepDay(prepared(s));
  assert.equal(s.lastDay.births.length,2);assert.equal(s.stats.births,2);assert.equal(s.birthCounter,0);
  assert.equal(s.local.populationHistory.reduce((n,p)=>n+p.births,0),2);assert.equal(s.local.birthHistory.length,2);
  const newborns=s.lastDay.births.map(id=>s.villagers.find(v=>v.id===id));
  assert.equal(new Set(newborns.flatMap(v=>v.parents)).size,4);
  for(const child of newborns){assert.equal(child.age,0);assert.ok(!s.lastDay.meals.includes(child.id));assert.equal(s.local.genealogy.people[child.id].origin,'born');assert.equal(s.villagers.find(v=>v.id===child.parents[0]).recoveryUntil,s.day+s.config.birth.recoveryDays);}
  assert.equal(observeEvents(s.local,'births').length,2);assert.deepEqual(dailyBirthIds(s.lastDay),s.lastDay.births);
});
test('births on consecutive days retain another family’s progress and each mother’s recovery',()=>{
  let s=families();readyMother(s,1,2,2);readyMother(s,3,4,1);
  s=stepDay(prepared(s));assert.equal(s.lastDay.births.length,1);const first=s.villagers.find(v=>v.id===s.lastDay.birth);assert.equal(first.parents[0],1);
  assert.equal(s.villagers.find(v=>v.id===3).familyReadiness.days,2);
  s=stepDay(prepared(s));assert.equal(s.lastDay.births.length,1);assert.equal(s.villagers.find(v=>v.id===s.lastDay.birth).parents[0],3);
  s=stepDay(prepared(s));assert.equal(s.lastDay.births.length,0,'neither recovering mother gives birth again');
});
test('a father has no artificial daily birth quota when two mothers are independently ready',()=>{
  let s=families();s.villagers=s.villagers.filter(v=>v.id!==4);
  for(let i=0;i<3;i++)s=stepDay(prepared(s));
  assert.equal(s.lastDay.births.length,2);
  const children=s.lastDay.births.map(id=>s.villagers.find(v=>v.id===id));
  assert.deepEqual(children.map(v=>v.parents[1]),[2,2]);assert.equal(new Set(children.map(v=>v.parents[0])).size,2);
  assert.equal(s.villagers.find(v=>v.id===2).childrenBorn,2);
});
test('one family’s illness resets only its own readiness',()=>{
  let s=families();s=stepDay(prepared(s));prepared(s);s.villagers.find(v=>v.id===1).happiness=0;
  s=stepDay(s);assert.equal(s.villagers.find(v=>v.id===1).familyReadiness,undefined);assert.equal(s.villagers.find(v=>v.id===3).familyReadiness.days,2);
  s=stepDay(prepared(s));assert.equal(s.lastDay.births.length,1);assert.equal(s.villagers.find(v=>v.id===s.lastDay.birth).parents[0],3);
});
test('simultaneous families cannot overbook the remaining bed; ready families wait independently',()=>{
  let s=families();s.huts=[];s.hutDetails=[];s.config.limits.population=5;readyMother(s,1,2,2);readyMother(s,3,4,2);
  s=stepDay(prepared(s));assert.equal(s.villagers.length,5);assert.equal(s.lastDay.births.length,1);assert.match(s.local.birthConditions,/cap reached/);
  assert.equal(s.villagers.find(v=>v.id===3).familyReadiness.days,3);
  s.config.limits.population=6;s=stepDay(prepared(s));assert.equal(s.lastDay.births.length,1);assert.equal(s.villagers.length,6);
});
test('an additional newborn does not impose a pantry budget on the next willing family',()=>{
  const s=families();s.food=0;const mothers=s.villagers.filter(v=>v.gender==='female'),fathers=s.villagers.filter(v=>v.gender==='male');
  assert.ok(canWelcomeFamilyChild(s,mothers[0],populationCap,fathers[0]));
  s.villagers.push({id:99,age:0,tribe:0,parents:[1,2]});assert.ok(canWelcomeFamilyChild(s,mothers[1],populationCap,fathers[1]));
});
test('parallel family readiness survives reload and a legacy global counter cannot bypass it',()=>{
  let s=stepDay(prepared(families()));const loaded=deserialize(serialize(s),familyRules);assert.ok(loaded);
  assert.equal(serialize(stepDay(s)),serialize(stepDay(loaded)));
  s.birthCounter=10000;s=stepDay(prepared(s));assert.equal(s.lastDay.births.length,0);assert.equal(s.birthCounter,0);
});
test('legacy village progress migrates once to a single real family rather than all families',()=>{
  let s=families();s.birthCounter=2;s=stepDay(prepared(s));assert.equal(s.lastDay.births.length,1);assert.equal(s.local.familyReadinessVersion,1);
  assert.equal(s.villagers.find(v=>v.id===3).familyReadiness.days,1);
  s.birthCounter=2;s=stepDay(prepared(s));assert.equal(s.lastDay.births.length,0);
});
test('new families cannot steal the partner of a family with continuing readiness',()=>{
  const s=families();s.day=5;readyMother(s,3,2,1);s.villagers.find(v=>v.id===3).childrenBorn=2;s.day++;
  const pairs=planFamilyBirths(s,s.villagers,{unrelated,populationCap});assert.equal(pairs.length,0);
  assert.equal(s.villagers.find(v=>v.id===3).familyReadiness.fatherId,2);assert.equal(s.villagers.find(v=>v.id===3).familyReadiness.days,2);
  assert.equal(s.villagers.find(v=>v.id===1).familyReadiness.fatherId,4);
});
test('unrelatedness and adulthood remain necessary with independent family checks',()=>{
  let s=families();s.config.birth.consecutiveDays=1;for(const v of s.villagers)v.parents=[90,91];
  s=stepDay(prepared(s));assert.equal(s.lastDay.births.length,0);
  s=families();s.config.birth.consecutiveDays=1;for(const v of s.villagers)v.age=1;
  s=stepDay(prepared(s));assert.equal(s.lastDay.births.length,0);
});
test('same-day newborns sharing a name retain separate Observe records and legacy entries deduplicate',()=>{
  const a={day:4,type:'birth',id:20,name:'Aiste',text:'Aiste was born to Rasa and Jonas.'},b={...a,id:40,text:'Aiste was born to Ieva and Lukas.'};
  const local={events:[a,b,{day:4,text:'Aiste was born.'}],birthHistory:[a,b]};assert.equal(observeEvents(local,'births').length,2);
});
