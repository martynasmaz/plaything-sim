import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,stepDay} from '../src/sim.js';
import {HOMESTEAD_RULES} from '../src/config.js';
import {assessNeeds} from '../src/needs.js';
import {canExperiment,practiceWork,practices} from '../src/practices.js';
import {serialize,deserialize} from '../src/save.js';

function calm(){
  const s=createState({...HOMESTEAD_RULES,traits:false,illness:{chance:0},
    weather:{chances:{normal:100,rain:0,drought:0,cold:0}}},4);
  s.local.healerId=999;s.food=90;s.wood=30;s.fireKnown=true;
  s.lastUsed.godzilla=0;s.gameAnimals=0;s.natural.weather='normal';s.natural.illness=false;
  for(const v of s.villagers){delete v.herbalist;v.traits=[];v.fullness=v.warmth=v.health=v.happiness=100;}
  return s;
}

test('needs rank physiology, security, belonging, competence and growth',()=>{
  const s=calm(),v=s.villagers[0];
  assert.equal(assessNeeds(s,v).need,'esteem');
  v.practice.used.cordage=3;assert.equal(assessNeeds(s,v).need,'growth');
  s.day=8;assert.equal(assessNeeds(s,v).need,'belonging');
  s.wood=0;assert.equal(assessNeeds(s,v).need,'fuel');
  s.food=0;assert.equal(assessNeeds(s,v).need,'provisions');
  v.fullness=10;assert.equal(assessNeeds(s,v).need,'food');
  s.food=90;v.warmth=10;assert.equal(assessNeeds(s,v).need,'warmth');
  v.warmth=100;v.illnessDays=2;assert.equal(assessNeeds(s,v).need,'recovery');
});

test('local preserved meals count as security but another camp’s cache does not',()=>{
  const s=calm(),v=s.villagers[0];s.food=0;
  s.local.campStores[0]={saved:18,rack:0};
  assert.ok(assessNeeds(s,v).level>=3);
  v.tribe=1;assert.equal(assessNeeds(s,v).need,'provisions');
  v.travelMeals=3;assert.ok(assessNeeds(s,v).level>=3);
});

test('personality changes social rhythm without overriding urgent needs',()=>{
  const s=calm(),v=s.villagers[0];s.day=5;
  v.traits=['Sociable'];assert.equal(assessNeeds(s,v).need,'belonging');
  v.traits=['Loner'];assert.equal(assessNeeds(s,v).need,'esteem');
  v.traits=['Brave','Scatterbrained'];v.warmth=10;
  const next=stepDay(s);
  assert.equal(next.lastDay.actions.find(a=>a.id===v.id).action,'Warm up');
  assert.equal(next.villagers.find(p=>p.id===v.id).motivation.need,'warmth');
});

test('urgent warmth and recovery cannot be replaced by crafting or experiments',()=>{
  const s=calm();for(const v of s.villagers)v.warmth=20;
  const next=stepDay(s);
  assert.ok(next.lastDay.actions.every(a=>a.action==='Warm up'));
  const sick=calm();sick.villagers[0].illnessDays=3;
  assert.equal(stepDay(sick).lastDay.actions.find(a=>a.id===1).action,'Rest');
});

test('a hungry villager harvests ripe crops before searching depleted ground',()=>{
  const s=calm();s.food=0;s.local.deposits.berries=0;s.local.seasonOffset=60;
  s.farming.known=true;s.farming.plots=[6,null,null,null];
  for(const v of s.villagers)v.fullness=35;
  const next=stepDay(s);
  assert.equal(next.lastDay.actions[0].action,'Harvest');
  assert.ok(next.lastDay.meals.length>0);
});

test('established farmers plant before the full foraging target, with seed and supper reserved',()=>{
  for(const [known,winter] of [[true,false],[false,false],[true,true]]){
    const s=calm();s.food=20;s.farming.known=known;
    s.farming.plots=known?[null,null,null,null]:[];
    if(winter)s.local.seasonOffset=60;
    const next=stepDay(s);
    assert.equal(next.lastDay.plantings>0,known&&!winter);
  }
});

test('experiments wait for security and retain their material and knowledge prerequisites',()=>{
  const s=calm(),v=s.villagers[0],p=v.practice,r=practices.baskets;
  p.properties=['flexible'];p.known.cordage=1;p.limitedTrips=2;s.local.stock.fibre=4;
  assert.ok(canExperiment(s,v,r));
  s.food=0;assert.equal(canExperiment(s,v,r),false);
  s.food=90;delete p.known.cordage;assert.equal(canExperiment(s,v,r),false);
});

test('competence favors useful repetition while growth gives a new experiment priority',()=>{
  for(const [uses,expected] of [[0,'Make cord'],[3,'Experiment with stone']]){
    const s=calm(),v=s.villagers[0],p=v.practice;
    p.known.cordage=1;p.used.cordage=uses;p.lastSkill='stone';p.properties=['fractures'];
    assert.equal(practiceWork(s,v,1),expected);
  }
});

test('safe villagers satisfy belonging through actual company',()=>{
  const s=calm();s.day=8;
  const next=stepDay(s);
  assert.ok(next.lastDay.actions.every(a=>a.action==='Rest'));
  assert.ok(next.villagers.every(v=>v.lastCompanyDay===next.day&&Object.keys(v.favors).length>0));
});

test('empty winter gathering grounds lead to warmth and fuel rather than idle starvation',()=>{
  const s=calm();s.food=0;s.wood=0;s.local.deposits.berries=0;s.local.seasonOffset=60;
  const next=stepDay(s);
  assert.ok(next.lastDay.actions.some(a=>a.action==='Gather wood'));
  assert.ok(next.wood>0);
});

test('adults can leave an isolated camp to find an unrelated partner',()=>{
  const s=calm();s.tribeCount=2;s.settlementWork=5;
  for(const v of s.villagers)v.tribe=v.gender==='male'?0:1;
  let next=stepDay(s);
  assert.equal(next.local.communication?.householdMoves||0,0,'meeting a neighbor takes actual workdays');
  for(let day=0;day<60&&!next.local.communication?.householdMoves;day++){
    next.food=90;next.wood=30;for(const v of next.villagers){v.fullness=v.warmth=v.health=v.happiness=100;v.practice.energy=100;}
    next=stepDay(next);
  }
  assert.ok(next.local.communication?.householdMoves>0);
  assert.ok([0,1].some(camp=>new Set(next.villagers.filter(v=>v.tribe===camp).map(v=>v.gender)).size===2));
});

test('births diversify eligible families without allowing siblings to become parents',()=>{
  let s=calm();s.config.birth.consecutiveDays=1;
  const parents=[];
  for(let i=0;i<2;i++){
    s.food=90;s.wood=30;
    for(const v of s.villagers)v.fullness=v.warmth=v.health=v.happiness=100;
    s=stepDay(s);parents.push(s.villagers.find(v=>v.id===s.lastDay.birth).parents);
  }
  assert.equal(new Set(parents.map(p=>p[0])).size,2);
  assert.equal(new Set(parents.map(p=>p[1])).size,2);
  const siblings=calm();siblings.config.birth.consecutiveDays=1;
  for(const v of siblings.villagers)v.parents=[100,101];
  assert.equal(stepDay(siblings).lastDay.birth,null);
});

test('saves replay new needs and family history deterministically',()=>{
  let s=calm();s.farming.known=true;s.farming.plots=[2,null,null,null];
  s.local.first.cordage=1;s.villagers[0].practice.known.cordage=2;
  for(let i=0;i<30;i++)s=stepDay(s);
  const back=deserialize(serialize(s),{...HOMESTEAD_RULES,traits:false,illness:{chance:0},
    weather:{chances:{normal:100,rain:0,drought:0,cold:0}}});
  assert.ok(back);assert.equal(back.local.first.cordage,1);assert.equal(back.farming.known,true);
  assert.deepEqual(stepDay(back),stepDay({...s,speed:0,elapsedMs:0,lastDay:null}));
});

test('saves from before motivations and family counters retain earlier discoveries',()=>{
  const s=calm();s.farming.known=true;s.farming.plots=[2,null,null,null];
  s.local.first.cordage=1;s.villagers[0].practice.known.cordage=2;
  for(const v of s.villagers){delete v.motivation;delete v.lastCompanyDay;delete v.childrenBorn;}
  const back=deserialize(serialize(s),HOMESTEAD_RULES);
  assert.ok(back);assert.equal(back.local.first.cordage,1);
  assert.equal(back.villagers[0].practice.known.cordage,2);assert.ok(back.farming.known);
  assert.ok(stepDay(back).villagers.every(v=>v.motivation));
});
