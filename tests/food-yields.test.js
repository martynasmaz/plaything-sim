import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createState} from '../src/sim.js';
import {HOMESTEAD_RULES} from '../src/config.js';
import {SCENARIO,validateScenario} from '../src/scenario.js';
import {cerealBatch,wheatRules} from '../src/farming.js';
import {primaryFoodYield} from '../src/food-yields.js';
const root=new URL('../src/',import.meta.url);
let source=readFileSync(new URL('sim.js',root),'utf8').replace(/from '(\.\/[^']+)'/g,(_,p)=>'from '+JSON.stringify(new URL(p,root).href));
source+='\nexport {doWork};';const {doWork}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
function world(){
  const s=createState(HOMESTEAD_RULES,60);s.food=0;s.wood=80;s.settlementWork=15;s.local.jars=20;
  s.local.tributaryBridge={work:6,completedDay:0,railWork:4,braceWork:6};s.local.bridgeUpgrade={railWork:4,braceWork:6};
  s.fireKnown=s.fireLit=true;s.gameAnimals=5;
  const v=s.villagers[0];v.gear='bow';v.fullness=v.warmth=v.health=v.happiness=v.practice.energy=100;
  return s;
}
const report=()=>({actions:[],weather:'normal',gatheredFood:0,gatheredWood:0,harvests:0});
test('food acquisition doubles yields while source depletion and processing ratios remain unchanged',()=>{
  const old=SCENARIO.foodYields.multiplier;
  try{for(const action of ['forage','fish','hunt','harvest','wheat']){
    const run=multiplier=>{SCENARIO.foodYields.multiplier=multiplier;const s=world();
      if(['harvest','wheat'].includes(action)){s.farming.known=true;s.farming.plots=[action==='wheat'?wheatRules.ripeAt:s.config.farming.ripeAt];s.farming.crops={0:action==='wheat'?'wheat':'garden'};}
      const r=report();doWork(s,s.villagers[0],action==='wheat'?'harvest':action,r);return {s,r,output:action==='wheat'?s.local.stock.wheat:s.food};};
    const one=run(1),two=run(2);assert.ok(one.output>0,action+' actually produces food');assert.equal(two.output,one.output*2,action);
    assert.deepEqual(two.s.local.deposits,one.s.local.deposits,action+' consumes the same finite source');
    if(action!=='wheat')assert.equal(two.r.gatheredFood,two.output);
  }
  const s=world();s.local.stock.wheat=24;s.local.stock.flour=8;
  const mill=cerealBatch(s,'milling',s.villagers[0]),bread=cerealBatch(s,'breadmaking',s.villagers[0]);
  assert.equal(mill.output,mill.amount);assert.equal(bread.output,bread.amount*wheatRules.bread/wheatRules.batch);
  assert.equal(primaryFoodYield(createState(),3),3,'reference mode remains unchanged');
  }finally{SCENARIO.foodYields.multiplier=old;}
  const bad=structuredClone(SCENARIO);bad.foodYields.multiplier=0;assert.ok(validateScenario(bad).some(e=>e.includes('foodYields')));
});

test('partial crop harvests retain the already-scaled remainder instead of doubling it again',()=>{
  const s=world(),v=s.villagers[0];s.local.jars=0;s.food=s.config.limits.stock-2;s.farming.known=true;s.farming.plots=[s.config.farming.ripeAt];
  s.farming.crops={0:'garden'};const total=primaryFoodYield(s,s.config.farming.harvestFood);
  doWork(s,v,'harvest',report());assert.equal(s.farming.gardenRemaining[0],total-2);
  s.food=0;v.practice.energy=100;doWork(s,v,'harvest',report());assert.equal(s.food,total-2);assert.equal(s.farming.plots[0],null);
});
