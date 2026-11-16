import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,stepDay,prepareField,preservationWork,shouldPlanHut,foodCapacity} from '../src/sim.js';
import {HOMESTEAD_RULES} from './fixtures/eating-profile.js';
import {practices,canExperiment,makePracticeProduct,worldTrees,standingTree,buildingSiteTree} from '../src/practices.js';
import {fieldSite,recordOccupations} from '../src/development.js';
import {advanceDryingRacks,seasonalPantryTarget,familyFoodStable,winterStorageTarget} from '../src/provisions.js';
import {cerealReady,cerealFoodWork} from '../src/farming.js';
import {serialize,deserialize} from '../src/save.js';
import {familyMotivationRules} from '../src/family-motivation.js';
const rules={...HOMESTEAD_RULES,traits:false,illness:{chance:0},weather:{chances:{normal:100,rain:0,drought:0,cold:0}}};
function village(){
  const s=createState(rules,4);s.day=100;s.food=90;s.wood=50;s.fireKnown=s.fireLit=true;s.settlementWork=5;
  s.farming.known=true;s.farming.plots=[2,2,2,2];s.local.harvests=4;s.local.season='Summer';s.toolkit=['hammer stone','digging stick','hand axe'];
  s.local.lastWinterFood={home:3,east:0};
  for(const v of s.villagers){v.fullness=v.warmth=v.health=v.happiness=v.practice.energy=100;v.lastCompanyDay=s.day;v.practice.properties=['perishable','rigid'];v.practice.skills={berries:8,wood:4};v.practice.farmingDays=6;}
  s.local.stock.fibre=20;return s;
}
const report=()=>({actions:[],gatheredFood:0,gatheredWood:0});
test('field layout requires crop experience, tools, personal prerequisites and real markers',()=>{
  const s=village(),v=s.villagers[0];assert.ok(canExperiment(s,v,practices.fieldplanning));
  for(const missing of ['harvest','digging','experience','material','prerequisite']){
    const x=structuredClone(s),p=x.villagers[0];
    if(missing==='harvest')x.local.harvests=0;if(missing==='digging')x.toolkit=[];if(missing==='experience')p.practice.farmingDays=0;
    if(missing==='material')x.local.stock.fibre=0;if(missing==='prerequisite')delete p.practice.known['crude tools'];
    assert.equal(canExperiment(x,p,practices.fieldplanning),false,missing);
  }
  v.practice.known.fieldplanning=1;assert.equal(prepareField(s,v,report()),false,'knowledge alone makes no field');
  const wood=s.wood,fibre=s.local.stock.fibre;assert.ok(makePracticeProduct(s,v,'fieldplanning',report()));
  assert.equal(s.wood,wood-1);assert.equal(s.local.stock.fibre,fibre-1);assert.ok(v.practice.gear['plot markers']);assert.equal(s.farming.plots.length,4);
});
test('winter-dependent development leaves founding work unchanged when independent family ambitions are disabled',()=>{
  const off={fields:false,planning:false,roles:false,families:false};
  const familyEnabled=familyMotivationRules.enabled;familyMotivationRules.enabled=false;
  try{
  let before=createState({...rules,learning:{...rules.learning,development:off}},4),after=createState(rules,4);
  for(let i=0;i<80&&!before.ended;i++){
    before=stepDay(before);after=stepDay(after);
    for(const key of ['food','wood','villagers','stats','farming'])assert.deepEqual(after[key],before[key],key+' on day '+after.day);
  }
  }finally{familyMotivationRules.enabled=familyEnabled;}
  const s=village(),v=s.villagers[0];delete s.local.lastWinterFood;v.practice.known.fieldplanning=1;v.practice.gear['plot markers']=true;
  assert.equal(prepareField(s,v,report()),false);assert.equal(v.practice.known.fieldplanning,1,'loaded discoveries are retained');
});
test('paid field work clears only its small patch, survives a death/load, and finishes as an unplanted plot',()=>{
  const s=village(),v=s.villagers[0];s.villagers.push({...structuredClone(v),id:90},{...structuredClone(v),id:91},{...structuredClone(v),id:92});
  Object.assign(v.practice.known,{fieldplanning:1});v.practice.gear['plot markers']=true;
  const site=fieldSite(s,4),tree=buildingSiteTree(s,site,'field'),before=new Set(Object.keys(s.local.stumps||{})),wood=s.wood;
  assert.ok(prepareField(s,v,report()));assert.equal(s.farming.plots.length,4);
  assert.equal(s.wood,wood-1+(tree===null?0:s.config.work.adultWood+2));
  for(const id of Object.keys(s.local.stumps||{}).filter(id=>!before.has(id))){const t=worldTrees(s)[id];assert.ok(Math.hypot((t[0]-site[0])/12,(t[1]-site[1])/9)<1);}
  const project=structuredClone(s.farming.expansion);s.villagers=s.villagers.filter(p=>p!==v);
  const back=deserialize(serialize(s),rules);assert.deepEqual(back.farming.expansion,project);
  const successor=back.villagers[0];successor.practice.known.fieldplanning=1;successor.practice.gear['plot markers']=true;
  for(let i=0;i<30&&back.farming.plots.length===4;i++){successor.practice.energy=100;successor.axeWear=0;prepareField(back,successor,report());}
  assert.equal(back.farming.plots.length,5);assert.equal(back.farming.plots[4],null);assert.deepEqual(back.farming.sites[4],site);
});
test('hunger, cold, illness and exhaustion interrupt expansion without losing a paid project',()=>{
  const s=village(),v=s.villagers[0];s.villagers.push({...structuredClone(v),id:90},{...structuredClone(v),id:91},{...structuredClone(v),id:92});v.practice.known.fieldplanning=1;v.practice.gear['plot markers']=true;
  assert.ok(prepareField(s,v,report()));
  for(const key of ['fullness','warmth','health','energy','illness']){
    const x=structuredClone(s),p=x.villagers[0],project=structuredClone(x.farming.expansion);
    if(key==='energy')p.practice.energy=0;else if(key==='illness')p.illnessDays=1;else p[key]=0;
    assert.equal(prepareField(x,p,report()),false);assert.deepEqual(x.farming.expansion,project);
  }
});
test('drying racks and preserved food require separate paid work, ingredients and accessible meals',()=>{
  const s=village(),v=s.villagers[0];v.practice.known.drying=1;const food=s.food,wood=s.wood,fibre=s.local.stock.fibre;
  assert.ok(preservationWork(s,v,report()));assert.equal(s.local.campStores[0].built,undefined);assert.equal(s.local.campStores[0].rackWork,1);
  v.practice.energy=100;assert.ok(preservationWork(s,v,report()));assert.equal(s.local.campStores[0].built,true);
  assert.equal(s.wood,wood-3);assert.equal(s.local.stock.fibre,fibre-1);assert.equal(s.food,food);
  v.practice.energy=100;assert.ok(preservationWork(s,v,report()));assert.equal(s.food,food-8);assert.equal(s.local.campStores[0].rack,8);
  const total=s.food+s.local.campStores[0].rack+s.local.campStores[0].saved;advanceDryingRacks(s);
  assert.equal(s.local.campStores[0].saved,8);assert.equal(s.local.campStores[0].rack,0);assert.equal(s.food+s.local.campStores[0].saved,total);
  s.food=5;assert.equal(preservationWork(s,v,report()),false);
});
test('seasonal food targets use actual storage capacity and brewing no free meals',()=>{
  const s=village(),v=s.villagers[0];s.local.jars=10;s.villagers=s.villagers.slice(0,2);s.food=110;s.local.stock.flour=16;s.farming.querns=[{camp:0}];v.practice.known.milling=v.practice.known.breadmaking=1;
  assert.ok(foodCapacity(s)>100);assert.ok(cerealReady(s,v,'breadmaking'),'expanded capacity permits baking above the former 92-food cutoff');
  s.day=55;s.food=0;const autumn=seasonalPantryTarget(s);s.day=5;assert.ok(autumn>seasonalPantryTarget(s));
  const flour=s.local.stock.flour,wood=s.wood;v.fullness=0;
  assert.equal(cerealFoodWork(s,v,makePracticeProduct,report()),'Bake hearth flatbread');assert.equal(s.food,16);
  assert.equal(s.local.stock.flour,flour-8);assert.equal(s.wood,wood-2,'a hungry baker still pays for real ingredients and fuel');
});
test('odd-sized villages preserve whole portions and never consume a fractional cache as a full meal',()=>{
  const s=village(),v=s.villagers[0];s.villagers=s.villagers.slice(0,5);v.practice.known.drying=1;
  s.local.campStores[0]={saved:0,rack:0,built:true,racks:1};s.food=13;
  assert.ok(preservationWork(s,v,report()));assert.equal(s.local.campStores[0].rack,5);assert.equal(s.food,8);
  s.local.campStores[0].rack=0;s.local.campStores[0].saved=.5;s.food=0;
  for(const p of s.villagers){p.fullness=0;p.health=100;}
  const next=stepDay(s);assert.ok(next.local.campStores[0].saved>=0);
});
test('a regular role requires repeated actual work and does not change personal needs or traits',()=>{
  const s=village(),v=s.villagers[0],traits=[...v.traits];
  for(let i=0;i<4;i++){s.day++;recordOccupations(s,{actions:[{id:v.id,action:'Bake hearth flatbread'}]});}
  assert.equal(v.practice.occupation.role,'baker');assert.deepEqual(v.traits,traits);
  v.fullness=0;s.food=0;const next=stepDay(s);assert.notEqual(next.villagers.find(p=>p.id===v.id)?.activity,'Bake hearth flatbread');
});
test('a regular farmer harvests ripe food before sowing another bed',()=>{
  const s=village(),v=s.villagers[0];s.villagers=[v];s.food=4;s.farming.plots=[6,null,null,null];
  v.practice.occupation={role:'farmer',since:90};v.practice.known={gathering:1,'crude tools':1,'fire tending':1};
  const next=stepDay(s);assert.equal(next.lastDay.actions[0].action,'Harvest');assert.equal(next.lastDay.plantings,0);
});
test('housing is anticipated and investment tolerance cannot excuse recent hunger or an ordinary food deficit',()=>{
  const s=village(),mother=s.villagers[1];assert.ok(shouldPlanHut(s));
  s.local.provisionHistory=Array.from({length:7},()=>({home:-1,hungryHome:false}));assert.equal(familyFoodStable(s,mother),false);
  s.local.provisionHistory[0].investment=true;assert.equal(familyFoodStable(s,mother),true);
  s.local.provisionHistory[1].hungryHome=true;assert.equal(familyFoodStable(s,mother),false);
});
