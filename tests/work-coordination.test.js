import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,stepDay} from '../src/sim.js';
import {HOMESTEAD_RULES} from '../src/config.js';
import {SCENARIO,validateScenario} from '../src/scenario.js';
import {coordinateWork,sharedWorkBlocker} from '../src/work-coordination.js';
import {worldTrees} from '../src/practices.js';
import {serialize,deserialize} from '../src/save.js';
const report=()=>({actions:[]});
const job=(resource='house:0')=>({kind:'housing',need:'shelter',resource,remaining:5,slots:2});
function world(){
  const s=createState({...HOMESTEAD_RULES,traits:false,illness:{chance:0},learning:{...HOMESTEAD_RULES.learning,climate:false},weather:{chances:{normal:100,rain:0,drought:0,cold:0}}},60);
  s.food=100;s.wood=80;s.fireKnown=s.fireLit=true;s.local.healerId=999;s.config.tribeThresholds=[];
  for(const v of s.villagers){v.fullness=v.warmth=v.health=v.happiness=v.practice.energy=100;v.lastCompanyDay=s.day;}
  return s;
}
test('physical crew slots are shared by helpers while different camp jobs remain independent',()=>{
  const s=world(),r=report(),[a,b,c,d]=s.villagers;c.tribe=d.tribe=1;
  assert.ok(coordinateWork(s,a,r,job(),()=>true));assert.ok(coordinateWork(s,b,r,job(),()=>true));
  let called=false;assert.equal(coordinateWork(s,c,r,job(),()=>{called=true;}),false);assert.equal(called,false);
  assert.ok(coordinateWork(s,c,r,job('house:1'),()=>true));assert.equal(r.workCoordination.tasks.find(t=>t.resource==='house:1').camp,1);
});
test('personal emergencies override shared jobs and coordination never edits desires or randomness',()=>{
  const s=world(),v=s.villagers[0];v.fullness=0;s.food=0;v.wantsChildren=false;
  const before=serialize(s),r=report();assert.equal(sharedWorkBlocker(s,v,r,job()),'personal_need');
  assert.equal(coordinateWork(s,v,r,job(),()=>{throw Error('must not build');}),false);
  assert.ok(coordinateWork(s,v,r,{...job('food'),need:'food',slots:undefined},()=>true));assert.equal(serialize(s),before);
  for(const need of ['warmth','illness','energy']){
    const x=world(),p=x.villagers[0];if(need==='warmth')p.warmth=0;if(need==='illness')p.illnessDays=2;if(need==='energy')p.practice.energy=0;
    assert.equal(sharedWorkBlocker(x,p,report(),job()),'personal_need',need);
  }
});
test('failed plans release slots; a paid interrupted trip frees the job but consumes that workers day',()=>{
  const s=world(),r=report(),[a,b]=s.villagers,j={...job(),slots:1};
  assert.equal(coordinateWork(s,a,r,j,()=>false),false);assert.equal(sharedWorkBlocker(s,b,r,j),null);
  coordinateWork(s,a,r,j,()=>{r.journeys=[{id:a.id,completed:false}];r.actions.push({id:a.id,action:'Wait for crossing'});return false;});
  assert.equal(sharedWorkBlocker(s,b,r,j),null);assert.equal(sharedWorkBlocker(s,a,r,job('another')),'already_assigned');
  assert.ok(coordinateWork(s,b,r,j,()=>true));s.day++;assert.equal(sharedWorkBlocker(s,a,r,j),null);
});
test('live demand closes completed gathering jobs while genuine food demand supports many workers',()=>{
  const s=world(),r=report();let demand=10;
  for(const [i,v] of s.villagers.entries()){const worked=coordinateWork(s,v,r,{kind:'gather',need:'food',resource:'berries',remaining:demand},()=>{demand-=2;return true;});assert.equal(!!worked,i<5);}
  assert.equal(r.workCoordination.assignments.length,5);assert.equal(r.workCoordination.declined.at(-1).reason,'no_remaining_demand');
});
test('the actual scheduler limits a crowded house crew and redirects useful workers without duplicate workdays',()=>{
  const input=world();input.food=36;input.gameAnimals=0;input.settlementWork=15;input.toolkit=['hand axe'];input.local.stumps=Object.fromEntries(worldTrees(input).map((_,i)=>[i,0]));
  input.villagers=Array.from({length:12},(_,i)=>({...structuredClone(input.villagers[i%6]),id:i+1,gender:'male',age:60,gear:'bow',household:i+1}));input.nextId=13;
  const old=SCENARIO.coordination.enabled;
  try{
    SCENARIO.coordination.enabled=false;const before=stepDay(input);SCENARIO.coordination.enabled=true;const after=stepDay(input);
    const builds=s=>s.lastDay.actions.filter(a=>a.action==='Build hut').length;
    assert.ok(builds(before)>2);assert.equal(builds(after),2);assert.equal(after.lastDay.actions.length,12,'other villagers retain their own useful or personal action');
    assert.equal(after.lastDay.actions.length,new Set(after.lastDay.actions.map(a=>a.id)).size);
    assert.equal(serialize(stepDay(after)),serialize(stepDay(deserialize(serialize(after),after.config))));
  }finally{SCENARIO.coordination.enabled=old;}
});
test('coordination can be disabled independently of food yields and invalid crew sizes are rejected',()=>{
  const s=world(),r=report(),old=SCENARIO.coordination.enabled;
  try{SCENARIO.coordination.enabled=false;assert.ok(coordinateWork(s,s.villagers[0],r,{...job(),remaining:0},()=>true));assert.equal(r.workCoordination,undefined);assert.equal(SCENARIO.foodYields.multiplier,2);}
  finally{SCENARIO.coordination.enabled=old;}
  const bad=structuredClone(SCENARIO);bad.coordination.constructionCrew=0;assert.ok(validateScenario(bad).some(e=>e.includes('constructionCrew')));
});
test('a fresh camp can start its communal shelter when progress has never been initialized',()=>{
  let s=world();assert.equal(s.settlementWork,undefined);s.toolkit=['hand axe'];s.local.stumps=Object.fromEntries(worldTrees(s).map((_,i)=>[i,0]));
  for(let i=0;i<12&&!(s.settlementWork>=s.config.settlement.shelterWork);i++)s=stepDay(s);
  assert.ok(s.settlementWork>=s.config.settlement.shelterWork,'coordination must not veto uninitialized shelter progress');
});
