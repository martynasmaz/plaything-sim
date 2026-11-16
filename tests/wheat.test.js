import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,stepDay} from '../src/sim.js';
import {HOMESTEAD_RULES} from './fixtures/eating-profile.js';
import {practices,canExperiment,makePracticeProduct,practiceWork,planLessons,beginSettlementDay,completeCerealLessons} from '../src/practices.js';
import {wheatRules,cerealDependencies,cerealFoodWork,cropRipeAt,ripePlot,grainCapacity,gatherWildWheat,needsLocalQuern,quernSite,seedReserve} from '../src/farming.js';
import {serialize,deserialize} from '../src/save.js';
const rules={...HOMESTEAD_RULES,traits:false,illness:{chance:0},weather:{chances:{normal:100,rain:0,drought:0,cold:0}}};
function field(){
  const s=createState(rules,4),v=s.villagers[0];s.villagers=[v];s.day=440;s.food=60;s.wood=30;
  s.fireKnown=s.fireLit=true;s.toolkit=['hammer stone','digging stick'];s.settlementWork=15;
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
  assert.equal(s.local.stock.wheat,2);assert.equal(s.local.deposits.wheat,before-1);
  s.local.season='Winter';gatherWildWheat(s,v,{});assert.equal(s.local.stock.wheat,2);
  s.local.season='Summer';s.local.deposits.wheat=0;gatherWildWheat(s,v,{});assert.equal(s.local.stock.wheat,2);
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
  assert.equal(s.lastDay.actions[0].gained,0);assert.equal(s.local.stock.wheat,24);assert.ok(s.food<=2);
});
test('a full grain store leaves the rest of the crop standing without repeated fertilizer bonuses',()=>{
  let {s,v}=field();s.day=400;s.food=1;v.fullness=5;s.farming.plots=[24,null,null,null];s.farming.crops[0]='wheat';
  s.local.stock.wheat=grainCapacity(s)-2;s.farming.boneSoil={0:{readyDay:0,remaining:3}};
  s=stepDay(s);assert.equal(s.local.stock.wheat,grainCapacity(s));assert.equal(s.farming.wheatRemaining[0],50);
  assert.equal(s.farming.plots[0],24);assert.equal(s.farming.boneSoil[0].remaining,2);
  // Once meals are available, finish gathering the raw ingredient. Hunger
  // should choose an immediately edible source before this unprocessed wheat.
  s.local.stock.wheat=0;s.local.jars=4;s.villagers[0].fullness=100;s.food=12;s=stepDay(s);
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
  assert.ok(makePracticeProduct(s,v,'milling'));assert.equal(s.local.stock.wheat,grain-8);assert.equal(s.local.stock.flour,8);assert.equal(s.food,food);
  assert.ok(makePracticeProduct(s,v,'breadmaking'));assert.equal(s.local.stock.flour,0);assert.equal(s.food,food+16);assert.equal(s.wood,wood-2);
  s.day++;s.local.stock.wheat=seedReserve(s);assert.equal(makePracticeProduct(s,v,'milling'),false,'keep actual sowing reserve even with an idle station');
  s.local.stock.flour=4;s.fireLit=false;assert.equal(makePracticeProduct(s,v,'breadmaking'),false);
  s.fireLit=true;v.tribe=1;s.campFires={1:true};assert.equal(makePracticeProduct(s,v,'milling'),false,'no remote quern');
});
test('meal preparation responds to hunger while cold, illness, low health and exhaustion interrupt it',()=>{
  const {s,v}=field();s.food=0;v.practice.known.breadmaking=1;v.practice.known.milling=1;s.farming.querns=[{camp:0}];
  assert.equal(cerealFoodWork(s,v,makePracticeProduct,{}),'Bake hearth flatbread');assert.equal(s.food,16);
  const hungry=structuredClone(s);hungry.food=0;hungry.villagers[0].fullness=5;
  assert.equal(cerealFoodWork(hungry,hungry.villagers[0],makePracticeProduct,{}),'Bake hearth flatbread');assert.equal(hungry.food,8);
  for(const need of ['warmth','health','energy','illness']){
    const x=structuredClone(s),p=x.villagers[0];x.food=0;
    if(need==='energy')p.practice.energy=0;else if(need==='illness')p.illnessDays=1;else p[need]=5;
    assert.equal(cerealFoodWork(x,p,makePracticeProduct,{}),null,need);assert.equal(x.food,0);
  }
});
test('a real quern accepts one milling workday and reports its actual station instead of the camp center',()=>{
  const {s,v}=field();s.local.stock.flour=0;v.practice.known.milling=1;
  const other=structuredClone(v);other.id=99;s.villagers.push(other);s.farming.querns=[{camp:0,builder:v.id}];
  const r={actions:[]},grain=s.local.stock.wheat;
  assert.ok(makePracticeProduct(s,v,'milling',r));assert.equal(makePracticeProduct(s,other,'milling',r),false);
  assert.equal(s.local.stock.wheat,grain-8);assert.equal(s.local.stock.flour,8);
  assert.deepEqual(r.milling,[{id:v.id,site:[202,247]}]);assert.deepEqual(quernSite(s,s.farming.querns[0]),[202,247]);
  s.day++;assert.ok(makePracticeProduct(s,other,'milling',r),'station becomes available the next day');
});
test('small and saved ingredient stocks keep their proportional output without spending seed',()=>{
  const {s,v}=field();s.farming.querns=[{camp:0}];Object.assign(v.practice.known,{milling:1,breadmaking:1});
  s.local.stock.flour=0;s.local.stock.wheat=seedReserve(s)+4;
  const loaded=deserialize(serialize(s),rules),worker=loaded.villagers[0];
  assert.ok(makePracticeProduct(loaded,worker,'milling'));assert.equal(loaded.local.stock.flour,4);
  assert.equal(loaded.local.stock.wheat,seedReserve(loaded));
  const wood=loaded.wood;assert.ok(makePracticeProduct(loaded,worker,'breadmaking'));
  assert.equal(loaded.food,s.food+8);assert.equal(loaded.wood,wood-1);assert.equal(loaded.local.stock.flour,0);
  assert.deepEqual(deserialize(serialize(loaded),rules).farming,loaded.farming);
});

test('baking scales to spare fuel and pantry space without overflow or free output',()=>{
  for(const [room,spareFuel,input] of [[100,2,8],[8,2,4],[100,1,4],[2,.25,1]]){
    const {s,v}=field();s.farming.querns=[{camp:0}];v.practice.known.milling=v.practice.known.breadmaking=1;
    s.local.stock.flour=8;s.food=s.config.limits.stock-room;s.wood=s.config.settlement.fuelReserve+spareFuel;
    const food=s.food,wood=s.wood,r={};assert.ok(makePracticeProduct(s,v,'breadmaking',r));
    assert.equal(s.food,food+input*2);assert.equal(s.local.stock.flour,8-input);assert.equal(s.wood,wood-input/4);
    assert.equal(r.gatheredFood,input*2);assert.equal(r.baking[0].food,input*2);
    assert.ok(s.food<=s.config.limits.stock);assert.ok(s.wood>=s.config.settlement.fuelReserve);
  }
});

test('milling fits flour storage and still requires one real local workday',()=>{
  const {s,v}=field();s.farming.querns=[{camp:0}];v.practice.known.milling=1;
  // The small household's flour target is 12: use the last three spaces.
  s.local.stock.flour=9;const grain=s.local.stock.wheat;
  assert.ok(makePracticeProduct(s,v,'milling'));assert.equal(s.local.stock.flour,12);assert.equal(s.local.stock.wheat,grain-3);
  s.day++;assert.equal(makePracticeProduct(s,v,'milling'),false);assert.equal(s.local.stock.wheat,grain-3);
});

test('large batches cannot bypass empty stocks, fuel reserve, personal knowledge or recipe dependencies',()=>{
  for(const missing of ['flour','fuel','knowledge','dependency']){
    const {s,v}=field();s.farming.querns=[{camp:0}];Object.assign(v.practice.known,{milling:1,breadmaking:1});
    if(missing==='flour')s.local.stock.flour=0;
    if(missing==='fuel')s.wood=s.config.settlement.fuelReserve;
    if(missing==='knowledge')delete v.practice.known.breadmaking;
    if(missing==='dependency')delete v.practice.known.milling;
    const before=[s.food,s.wood,s.local.stock.flour];assert.equal(makePracticeProduct(s,v,'breadmaking'),false,missing);
    assert.deepEqual([s.food,s.wood,s.local.stock.flour],before);
  }
});

test('growing households build additional paid querns when existing ones are busy, preserving old stations',()=>{
  const {s,v}=field();v.practice.known={...v.practice.known,wheatgrowing:1,quernmaking:1,milling:1};s.farming.wheatHarvests=1;
  const quern={camp:0,builder:3,day:430,workDay:s.day};s.farming.querns=[quern];
  s.villagers=Array.from({length:9},(_,i)=>({...structuredClone(v),id:i+1}));
  assert.equal(needsLocalQuern(s,v),true);const stone=s.local.stock.quernStone;
  assert.ok(makePracticeProduct(s,v,'quernmaking'));assert.equal(s.farming.querns.length,2);assert.equal(s.local.stock.quernStone,stone-1);
  assert.deepEqual(quernSite(s,quern),[202,247]);assert.notDeepEqual(quernSite(s,s.farming.querns[1]),[202,247]);
  assert.equal(makePracticeProduct(s,v,'quernmaking'),false,'idle stations do not cause endless construction');
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
