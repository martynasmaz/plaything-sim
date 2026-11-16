import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createState,stepDay} from '../src/sim.js';
import {HOMESTEAD_RULES} from '../src/config.js';
import {SCENARIO,validateScenario} from '../src/scenario.js';
import {serveLocalMeal} from '../src/provisions.js';
import {forecastMeals} from '../src/nutrition.js';
import {serialize,deserialize} from '../src/save.js';
const root=new URL('../src/',import.meta.url);
let source=readFileSync(new URL('sim.js',root),'utf8').replace(/from '(\.\/[^']+)'/g,(_,p)=>'from '+JSON.stringify(new URL(p,root).href));
source+='\nexport {resolveNeeds,resolveLivesAndDiscovery};';const probe=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const report=()=>({damage:[],deaths:[],meals:[],actions:[],traitEvents:[],births:[]});
const eatingOff={...HOMESTEAD_RULES,needs:{...HOMESTEAD_RULES.needs,eatsFood:false,hungerDeathsEnabled:false}};
function world(){const s=createState(eatingOff,60);s.villagers=s.villagers.slice(0,1);const v=s.villagers[0];
  v.health=5;v.fullness=0;v.warmth=100;v.illnessDays=0;return {s,v};}
test('eating and hunger damage are enabled by default and can be disabled independently',()=>{
  assert.equal(SCENARIO.simulation.needs.eatsFood,true);assert.equal(SCENARIO.simulation.needs.hungerDeathsEnabled,true);
  const {s,v}=world(),r=report();s.config.needs.eatsFood=true;probe.resolveNeeds(s,v,true,r);assert.equal(v.health,5);assert.deepEqual(r.damage[0].causes,[]);
  s.config.needs.hungerDeathsEnabled=true;probe.resolveNeeds(s,v,true,report());assert.equal(v.health,0,'hunger damage resumes when explicitly enabled');
  for(const key of ['eatsFood','hungerDeathsEnabled']){const bad=structuredClone(SCENARIO);bad.simulation.needs[key]='no';assert.ok(validateScenario(bad).some(e=>e.includes(key)));}
});
test('meal routes retain food when eating is disabled and can be switched back on',()=>{
  const {s,v}=world();for(const [account,key] of [[s,'food'],[v,'travelMeals'],[{saved:4},'saved'],[s.local.stock,'curds']]){
    account[key]=4;assert.equal(serveLocalMeal(s,v,report(),account,key,'test'),false);assert.equal(account[key],4);
  }
  assert.equal(forecastMeals(s,[v],80),0);s.config.needs.eatsFood=true;
  assert.ok(serveLocalMeal(s,v,report(),s,'food','pantry'));assert.equal(s.food,3);assert.equal(v.fullness,100);
});
test('no eating maintains fullness and allows stockpiling without hunger injury over normal days',()=>{
  let s=createState({...HOMESTEAD_RULES,traits:false,illness:{chance:0},weather:{chances:{normal:100,rain:0,drought:0,cold:0}},
    needs:{...eatingOff.needs,warmthLoss:0,rainWarmthLoss:0,coldWarmthLoss:0},learning:{...HOMESTEAD_RULES.learning,climate:false}},60);
  const initial=s.food;
  for(let i=0;i<20;i++){s=stepDay(s);assert.ok(s.villagers.length);assert.equal(s.lastDay.meals.length,0);assert.ok(s.villagers.every(v=>v.fullness===100));assert.ok(s.lastDay.damage.every(d=>!d.causes.includes('hunger')));}
  assert.ok(s.food>initial,'they still gather food');assert.equal(serialize(stepDay(s)),serialize(stepDay(deserialize(serialize(s),s.config))));
});
test('cold and illness damage still apply with hunger deaths disabled',()=>{
  for(const cause of ['cold','illness']){const {s,v}=world();if(cause==='cold')v.warmth=0;else v.illnessDays=2;
    const r=report();probe.resolveNeeds(s,v,true,r);assert.equal(v.health,0);assert.deepEqual(r.damage[0].causes,[cause]);}
});
test('saved Yes/No choices override defaults independently when the village reloads',()=>{
  const {s,v}=world();s.local.needSettings={eatsFood:true,hungerDeathsEnabled:false};
  const loaded=deserialize(serialize(s),s.config);assert.equal(loaded.config.needs.eatsFood,true);assert.equal(loaded.config.needs.hungerDeathsEnabled,false);
  assert.equal(loaded.villagers[0].fullness,v.fullness);
  loaded.local.needSettings={eatsFood:false,hungerDeathsEnabled:true};
  const off=deserialize(serialize(loaded),loaded.config);assert.equal(off.config.needs.eatsFood,false);assert.equal(off.config.needs.hungerDeathsEnabled,true);assert.equal(off.villagers[0].fullness,100);
});
