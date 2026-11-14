import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,stepDay} from '../src/sim.js';
import {HOMESTEAD_RULES} from '../src/config.js';
import {practices,canExperiment,makePracticeProduct,practiceWork,planLessons,beginSettlementDay,completeCerealLessons} from '../src/practices.js';
import {wheatRules,cerealDependencies,cerealFoodWork,cropRipeAt,ripePlot,grainCapacity,gatherWildWheat} from '../src/farming.js';
import {serialize,deserialize} from '../src/save.js';
const rules={...HOMESTEAD_RULES,traits:false,illness:{chance:0},weather:{chances:{normal:100,rain:0,drought:0,cold:0}}};
function field(){
  const s=createState(rules,4),v=s.villagers[0];s.villagers=[v];s.day=440;s.food=60;s.wood=30;
  s.fireKnown=s.fireLit=true;s.toolkit=['hammer stone','digging stick'];s.settlementWork=5;
  s.farming.known=true;s.farming.plots=[null,null,null,null];s.farming.seedSeasons=[1,2,5,6,9,10];
  s.local.stock.wheat=24;s.local.stock.flour=12;s.local.stock.quernStone=10;
  v.fullness=v.warmth=v.health=v.happiness=100;v.lastCompanyDay=s.day;v.practice.energy=100;
  v.practice.properties=['perishable','fractures','rigid'];v.practice.skills={berries:8,stone:3,wood:4};
  v.practice.lastSkill='berries';v.practice.farmingDays=3;return {s,v};
}
test('wheat is a later discovery requiring observed seasons, garden experience, seed and a digging tool',()=>{
  const {s,v}=field();assert.ok(canExperiment(s,v,practices.wheatgrowing));
  for(const missing of ['time','observations','gardens','tool','seed','personal experience']){
    const x=structuredClone(s),p=x.villagers[0];
    if(missing==='time')x.day=359;if(missing==='observations')x.farming.seedSeasons=[];
    if(missing==='gardens')x.farming.known=false;if(missing==='tool')x.toolkit=['hammer stone'];
    if(missing==='seed')x.local.stock.wheat=0;
    if(missing==='personal experience'){p.practice.farmingDays=0;p.practice.skills.berries=0;}
    assert.equal(canExperiment(x,p,practices.wheatgrowing),false,missing);
  }
  s.day=500;s.local.stock.wheat=0;assert.equal(canExperiment(s,v,practices.wheatgrowing),false,'day 500 grants nothing');
});
test('seed samples come from finite warm-season gathering and observations persist across generations',()=>{
  const {s,v}=field();s.local.stock.wheat=0;s.local.seedFinds=8;s.local.season='Summer';
  const before=s.local.deposits.wheat;gatherWildWheat(s,v,{});
  assert.equal(s.local.stock.wheat,1);assert.equal(s.local.deposits.wheat,before-1);
  s.local.season='Winter';gatherWildWheat(s,v,{});assert.equal(s.local.stock.wheat,1);
  s.local.season='Summer';s.local.deposits.wheat=0;gatherWildWheat(s,v,{});assert.equal(s.local.stock.wheat,1);
});
test('new wheat beds use real seed while existing garden beds retain their crops',()=>{
  let {s,v}=field();s.day=400;s.food=10;v.practice.known.wheatgrowing=1;s.farming.plots=[null,2,null,null];
  const grain=s.local.stock.wheat;s=stepDay(s);
  assert.equal(s.lastDay.actions[0].action,'Sow wheat');assert.equal(s.local.stock.wheat,grain-1);
  assert.equal(s.farming.crops[0],'wheat');assert.equal(s.farming.crops[1],undefined);
  assert.equal(cropRipeAt(s,0),24);assert.equal(cropRipeAt(s,1),6);
});
test('wheat grows over multiple weeks, waits through winter, and yields grain rather than instant meals',()=>{
  let {s,v}=field();s.day=400;s.farming.plots=[6,null,null,null];s.farming.crops[0]='wheat';s.food=0;v.fullness=5;
  assert.equal(ripePlot(s),-1);s=stepDay(s);assert.equal(s.lastDay.harvests,0);
  ({s,v}=field());s.day=60;s.farming.plots=[10,null,null,null];s.farming.crops[0]='wheat';
  s=stepDay(s);assert.equal(s.local.season,'Winter');assert.equal(s.farming.plots[0],10);
  ({s,v}=field());s.day=400;s.farming.plots=[24,null,null,null];s.farming.crops[0]='wheat';s.food=1;v.fullness=5;s.local.stock.wheat=0;
  s=stepDay(s);assert.equal(s.lastDay.actions[0].action,'Harvest wheat');
  assert.equal(s.lastDay.actions[0].gained,0);assert.equal(s.local.stock.wheat,24);assert.ok(s.food<=1);
});
test('a full grain store leaves the rest of the crop standing without repeated fertilizer bonuses',()=>{
  let {s,v}=field();s.day=400;s.food=1;v.fullness=5;s.farming.plots=[24,null,null,null];s.farming.crops[0]='wheat';
  s.local.stock.wheat=grainCapacity(s)-2;s.farming.boneSoil={0:{readyDay:0,remaining:3}};
  s=stepDay(s);assert.equal(s.local.stock.wheat,grainCapacity(s));assert.equal(s.farming.wheatRemaining[0],24);
  assert.equal(s.farming.plots[0],24);assert.equal(s.farming.boneSoil[0].remaining,2);
  s.local.stock.wheat=0;s.villagers[0].fullness=5;s.food=0;s=stepDay(s);
  assert.equal(s.farming.boneSoil[0].remaining,2);assert.equal(s.farming.plots[0],null);
});
test('querns require a harvest, hammer, personal stone work and real stone, and remain after the maker dies',()=>{
  const {s,v}=field();v.practice.known.wheatgrowing=1;
  assert.equal(canExperiment(s,v,practices.quernmaking),false);
  s.farming.wheatHarvests=1;assert.ok(canExperiment(s,v,practices.quernmaking));
  v.practice.known.quernmaking=1;const stone=s.local.stock.quernStone;
  assert.ok(makePracticeProduct(s,v,'quernmaking'));assert.equal(s.local.stock.quernStone,stone-1);
  assert.equal(s.farming.querns.length,1);assert.equal(makePracticeProduct(s,v,'quernmaking'),false);
  s.villagers=[];assert.equal(s.farming.querns.length,1);assert.equal(s.farming.querns[0].builder,v.id);
});
test('milling and baking consume separate batches and workdays, protect seed and need a local quern and hearth',()=>{
  const {s,v}=field();v.practice.known={...v.practice.known,wheatgrowing:1,quernmaking:1,milling:1,breadmaking:1};
  s.local.stock.flour=0;assert.equal(makePracticeProduct(s,v,'milling'),false);
  s.farming.querns=[{camp:0,builder:v.id,day:430}];const grain=s.local.stock.wheat,food=s.food,wood=s.wood;
  assert.ok(makePracticeProduct(s,v,'milling'));assert.equal(s.local.stock.wheat,grain-4);assert.equal(s.local.stock.flour,4);assert.equal(s.food,food);
  assert.ok(makePracticeProduct(s,v,'breadmaking'));assert.equal(s.local.stock.flour,0);assert.equal(s.food,food+8);assert.equal(s.wood,wood-1);
  s.local.stock.wheat=7;assert.equal(makePracticeProduct(s,v,'milling'),false,'keep four seeds');
  s.local.stock.flour=4;s.fireLit=false;assert.equal(makePracticeProduct(s,v,'breadmaking'),false);
  s.fireLit=true;v.tribe=1;s.campFires={1:true};assert.equal(makePracticeProduct(s,v,'milling'),false,'no remote quern');
});
test('food processing is useful work when reserves run low, while urgent needs interrupt it immediately',()=>{
  const {s,v}=field();s.food=0;v.practice.known.breadmaking=1;v.practice.known.milling=1;s.farming.querns=[{camp:0}];
  assert.equal(cerealFoodWork(s,v,makePracticeProduct,{}),'Bake hearth flatbread');assert.equal(s.food,8);
  for(const need of ['fullness','warmth','health','energy','illness']){
    const x=structuredClone(s),p=x.villagers[0];x.food=0;
    if(need==='energy')p.practice.energy=0;else if(need==='illness')p.illnessDays=1;else p[need]=5;
    assert.equal(cerealFoodWork(x,p,makePracticeProduct,{}),null,need);assert.equal(x.food,0);
  }
});
test('lessons respect the new recipe dependencies instead of giving children advanced bread knowledge',()=>{
  const {s,v:teacher}=field(),pupil=structuredClone(teacher);pupil.id=200;pupil.practice.known={gathering:1,'crude tools':1,'fire tending':1};
  teacher.practice.known.breadmaking=1;teacher.practice.used.breadmaking=1;s.villagers.push(pupil);
  for(let i=0;i<6;i++){s.day++;beginSettlementDay(s);teacher.lastCompanyDay=pupil.lastCompanyDay=s.day;
    teacher.practice.energy=pupil.practice.energy=100;planLessons(s,s.villagers);}
  assert.equal(pupil.practice.lessonToday,null);assert.equal(pupil.practice.known.breadmaking,undefined);
});
test('old fields and discoveries survive loading, together with real crop, quern, seed and flour progress',()=>{
  const {s,v}=field();s.farming.crops[0]='wheat';s.farming.plots[0]=16;s.farming.querns=[{camp:0,builder:22,day:420}];
  v.practice.known.wheatgrowing=1;let back=deserialize(serialize(s),rules);
  assert.deepEqual(back.farming,s.farming);assert.equal(back.local.stock.flour,12);
  const old=structuredClone(s);delete old.farming.crops;delete old.farming.querns;delete old.farming.seedSeasons;
  delete old.local.stock.wheat;delete old.local.stock.flour;delete old.local.stock.quernStone;
  back=deserialize(serialize(old),rules);assert.deepEqual(back.farming.plots,old.farming.plots);
  assert.equal(back.villagers[0].practice.known.wheatgrowing,1);assert.deepEqual(back.farming.querns,[]);
  assert.equal(back.local.stock.wheat,0);assert.equal(cerealDependencies(back,'saddle quern'),false);
});
test('a younger generation learns bread only after two actual paired lessons with a practiced baker',()=>{
  const {s,v:teacher}=field(),student=structuredClone(teacher);student.id=200;student.age=20;
  student.practice.known={...student.practice.known,quernmaking:1,milling:1};student.practice.used={};student.practice.lessons={};
  teacher.practice.known.breadmaking=1;teacher.practice.used.breadmaking=2;
  s.farming.querns=[{camp:0,builder:teacher.id,day:420}];s.villagers=[student,teacher];
  for(let day=0;day<3;day++){
    s.day++;student.practice.energy=teacher.practice.energy=100;
    student.practice.lessonToday={teacher:teacher.id,id:'breadmaking',key:'bread-lesson'};
    teacher.practice.lessonToday={student:student.id,id:'breadmaking'};
    const report={actions:[]};const lesson=practiceWork(s,student,100,report);
    report.actions.push({id:student.id,action:lesson});
    if(day)report.actions.push({id:teacher.id,action:practiceWork(s,teacher,100,report)});
    completeCerealLessons(s,report);
    if(day<2)assert.equal(student.practice.known.breadmaking,undefined);
  }
  assert.equal(student.practice.known.breadmaking,1);assert.equal(student.practice.lessons['bread-lesson'],2);
});
