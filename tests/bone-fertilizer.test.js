import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,stepDay} from '../src/sim.js';
import {HOMESTEAD_RULES} from '../src/config.js';
import {practices,canExperiment,makePracticeProduct,practiceWork} from '../src/practices.js';
import {applyBoneFertilizer,boneHarvestBonus} from '../src/farming.js';
import {magicEnabled} from '../src/magic.js';
import {serialize,deserialize} from '../src/save.js';
const rules={...HOMESTEAD_RULES,traits:false,illness:{chance:0},weather:{chances:{normal:100,rain:0,drought:0,cold:0}}};
function field(){
  const s=createState(rules,4),v=s.villagers[0];s.villagers=[v];s.food=80;s.wood=30;s.toolkit=['hammer stone'];
  s.farming.known=true;s.farming.plots=[1,1,1,1];s.local.stock.bone=450;
  v.fullness=v.warmth=v.health=v.happiness=100;v.practice.energy=100;v.practice.properties=['fractures'];
  v.practice.farmingDays=3;v.practice.skills.stone=2;
  return s;
}
test('bone fertilizer is a practical discovery requiring farming, crushing experience, a hammer and bones',()=>{
  const s=field(),v=s.villagers[0];assert.equal(magicEnabled(s),false);assert.ok(canExperiment(s,v,practices.bonemeal));
  for(const missing of ['farming','experience','tool','bones']){
    const trial=structuredClone(s),p=trial.villagers[0];
    if(missing==='farming')trial.farming.known=false;if(missing==='experience')p.practice.farmingDays=0;
    if(missing==='tool')trial.toolkit=[];if(missing==='bones')trial.local.stock.bone=0;
    assert.equal(canExperiment(trial,p,practices.bonemeal),false,missing);
  }
});
test('grinding consumes four real bones for two units and takes a separate workday from application',()=>{
  const s=field(),v=s.villagers[0];v.practice.known.bonemeal=1;
  assert.equal(practiceWork(s,v,101),'Grind bones for fertilizer');
  assert.equal(s.local.stock.bone,446);assert.equal(s.local.stock.boneMeal,2);assert.equal(s.farming.boneSoil,undefined);
  const food=s.food,growth=[...s.farming.plots];s.day++;
  assert.equal(practiceWork(s,v,101),'Work ground bone into soil');
  assert.equal(s.local.stock.boneMeal,1);assert.equal(s.food,food);assert.deepEqual(s.farming.plots,growth);
});
test('soil amendment matures after a season, adds only two provisions to three harvests, and cannot stack',()=>{
  const s=field(),v=s.villagers[0];v.practice.known.bonemeal=1;s.local.stock.boneMeal=10;
  assert.ok(applyBoneFertilizer(s,v));const first=structuredClone(s.farming.boneSoil[0]);
  assert.ok(applyBoneFertilizer(s,v));assert.deepEqual(s.farming.boneSoil[0],first);
  assert.equal(boneHarvestBonus(s,0),0);s.day=s.config.learning.seasonLength;
  assert.equal(boneHarvestBonus(s,0),2);assert.equal(boneHarvestBonus(s,0),2);assert.equal(boneHarvestBonus(s,0),2);
  assert.equal(boneHarvestBonus(s,0),0);
});
test('fertilizer is not applied in winter or when hungry, and stock is not drained without fields needing it',()=>{
  const s=field(),v=s.villagers[0];v.practice.known.bonemeal=1;s.local.stock.boneMeal=4;
  s.local.season='Winter';assert.equal(applyBoneFertilizer(s,v),false);s.local.season='Spring';
  s.food=0;v.fullness=5;practiceWork(s,v,101);assert.equal(s.local.stock.boneMeal,4);
  s.food=80;v.fullness=100;for(let i=0;i<4;i++)assert.ok(applyBoneFertilizer(s,v));
  assert.equal(applyBoneFertilizer(s,v),false);assert.equal(makePracticeProduct(s,v,'bonemeal'),false);
});
test('real harvesting receives the bounded soil bonus through normal field work',()=>{
  let s=field(),v=s.villagers[0];v.practice.known.bonemeal=1;s.local.stock.boneMeal=1;applyBoneFertilizer(s,v);
  s.day=s.config.learning.seasonLength;s.farming.plots=[6,null,null,null];s.food=1;v.fullness=5;
  s=stepDay(s);assert.equal(s.lastDay.actions[0].action,'Harvest');
  assert.equal(s.lastDay.actions[0].gained,s.config.farming.harvestFood+2);
  assert.equal(s.farming.boneSoil[0].remaining,2);
});
test('old saves retain their fields and discoveries; processed bone and soil progress survive reload',()=>{
  const s=field(),v=s.villagers[0];v.practice.known.bonemeal=1;s.local.stock.boneMeal=2;applyBoneFertilizer(s,v);
  const loaded=deserialize(serialize(s),rules);assert.deepEqual(loaded.farming.boneSoil,s.farming.boneSoil);
  assert.equal(loaded.local.stock.boneMeal,1);assert.equal(loaded.local.magic,undefined);
  const old=field();delete old.local.stock.boneMeal;const back=deserialize(serialize(old),rules);
  assert.equal(back.local.stock.boneMeal,0);assert.deepEqual(back.farming.plots,old.farming.plots);
});
