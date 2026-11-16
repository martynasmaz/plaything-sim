import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createState,stepDay,buildPlankShed,buildTributaryBridge,preservationWork,localShelterPlaces} from '../src/sim.js';
import {HOMESTEAD_RULES} from './fixtures/eating-profile.js';
import {practices,practiceWork,makePracticeProduct,completePracticeLessons,canExperiment,valleySeason} from '../src/practices.js';
import {serialize,deserialize} from '../src/save.js';
import {beginWorkJourney,workRoute} from '../src/journeys.js';
import {riverFrozen,riverWaterAt} from '../src/river.js';
import {equipmentRecipe,equipmentAffordable,payEquipment} from '../src/equipment.js';

// Exercise the real scheduler's small private account boundaries without
// exporting test-only methods from the game's public API.
const root=new URL('../src/',import.meta.url);
let source=readFileSync(new URL('sim.js',root),'utf8').replace(/from '(\.\/[^']+)'/g,(_,p)=>'from '+JSON.stringify(new URL(p,root).href));
source+='\nexport {doWork,weeklyWork,householdCare,meals,resolveLivesAndDiscovery,tendDaughter,nextHutImprovement,healerWork,chooseAction};\n//# sourceURL=mechanics-probe.js';
const probe=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
function village(){
  const s=createState({...HOMESTEAD_RULES,traits:false,illness:{chance:0},learning:{...HOMESTEAD_RULES.learning,climate:false}},4);
  s.villagers=s.villagers.slice(0,2);s.config.tribeThresholds=[];s.food=100;s.wood=80;
  s.fireKnown=s.fireLit=true;s.settlementWork=15;s.local.season='Spring';
  for(const v of s.villagers){v.age=60;v.traits=[];v.fullness=v.warmth=v.health=v.happiness=v.practice.energy=100;v.lastCompanyDay=s.day;v.household=v.id;}
  return s;
}
const report=()=>({actions:[],meals:[],beforeMeals:[],traitEvents:[],traitCandidates:[],traitLines:0,gatheredFood:0,gatheredWood:0,harvests:0,plantings:0,damage:[],deaths:[],weather:'normal'});

test('an unknown timber bridge cannot reserve the workday and suppress its earlier discoveries',()=>{
  const s=village(),v=s.villagers[0];s.settlementWork=5;v.practice.used.gathering=3;
  v.practice.watersideVisits=3;v.practice.skills.stone=3;v.practice.properties=['fractures'];
  s.local.crossingDelays={0:{count:2,lastDay:s.day}};
  assert.notEqual(probe.chooseAction(s,v,'normal',s.villagers.length,0,true),'bridge');
  assert.equal(practiceWork(s,v,0,report()),'Experiment with stone');
  assert.ok(v.practice.progress.fordbuilding>0);assert.equal(s.settlementWork,5);
});

test('a hut in another camp cannot be selected for a local improvement',()=>{
  const s=village(),v=s.villagers[0];s.huts=[1];s.hutDetails=[{shape:'dome hut'}];
  Object.assign(v.practice.known,{housing:1,cordage:1});
  assert.equal(probe.nextHutImprovement(s,0,v),null);
  assert.ok(probe.nextHutImprovement(s,1,v));
});

test('seed 209 records every worker through the formerly crashing day 86',()=>{
  let s=createState(HOMESTEAD_RULES,209);
  while(!s.ended&&s.day<86){const before=s;s=stepDay(s);
    assert.deepEqual(s.lastDay.actions.map(a=>a.id).sort((a,b)=>a-b),before.villagers.map(v=>v.id).sort((a,b)=>a-b));
    assert.ok(s.villagers.every(v=>typeof v.activity==='string'));
  }
  assert.equal(s.day,86,'the regression fixture must reach the formerly crashing day');
});

test('a recovering healer apprentice cannot also be recruited for building that day',()=>{
  const s=village(),[teacher,pupil]=s.villagers;
  teacher.herbalist={leaves:0,doses:2,visits:3};teacher.traits=['Loner'];teacher.practice.known.herbalism=3;
  pupil.healerApprentice={mentorId:teacher.id,plantDays:0,remedyDays:0,patientDays:0};pupil.practice.energy=28;
  Object.assign(pupil.practice.known,{housing:1,cordage:1});pupil.practice.skills.wood=4;pupil.practice.gear['hafted tool']=true;
  s.local.healerHome={home:[388,87],ownerId:teacher.id,work:1,rackWork:0,markerWork:0,stock:{leaves:0,doses:2},spent:{}};
  const r=report();probe.healerWork(s,s.villagers,r);
  assert.deepEqual(r.actions.filter(a=>a.id===pupil.id).map(a=>a.action),['Rest before healing work']);
  assert.equal(s.local.healerHome.work,1);
});

test('care serves one reported meal per day, at the configured cost, and spends helper energy',()=>{
  const s=village(),[helper,patient]=s.villagers;s.config.needs.mealCost=2;patient.illnessDays=2;patient.fullness=20;patient.household=helper.household;
  const r=report(),energy=helper.practice.energy,food=s.food;
  probe.householdCare(s,s.villagers,r);probe.meals(s,s.villagers,r);
  assert.equal(food-s.food,2);assert.equal(patient.fullness,100);assert.deepEqual(r.meals,[patient.id]);
  assert.equal(helper.practice.energy,energy-s.config.learning.workCost);
});
test('meal cost two cannot feed two people from two food units',()=>{
  const s=village();s.config.needs.mealCost=2;s.food=2;for(const v of s.villagers)v.fullness=20;
  const r=report();probe.meals(s,s.villagers,r);assert.equal(r.meals.length,1);assert.equal(s.food,0);
});
test('emergency baking wins over ripe raw wheat',()=>{
  const s=village();s.food=0;s.huts=[0,0,0,0];s.hutDetails=s.huts.map(()=>({shape:'dome hut'}));s.shed.built=true;
  s.farming.known=true;s.farming.plots=[24,24];s.farming.crops={0:'wheat',1:'wheat'};s.farming.querns=[{camp:0}];s.local.stock.flour=8;
  for(const v of s.villagers){v.fullness=5;v.gender='female';Object.assign(v.practice.known,{milling:1,breadmaking:1});}
  const next=stepDay(s);assert.ok(next.lastDay.actions.some(a=>a.action==='Bake hearth flatbread'));assert.equal(next.lastDay.meals.length,2);
  const actions=next.lastDay.actions.map(a=>a.action);
  assert.ok(actions.indexOf('Harvest wheat')<0||actions.indexOf('Bake hearth flatbread')<actions.indexOf('Harvest wheat'));
});
test('a garden harvest retains overflow and does not repeat fertilizer bonuses',()=>{
  const s=village(),v=s.villagers[0];s.food=99;s.farming.known=true;s.farming.plots=[6];s.farming.boneSoil={0:{readyDay:0,remaining:3}};
  probe.doWork(s,v,'harvest',report());const remaining=s.farming.gardenRemaining[0];
  assert.equal(remaining,(s.config.farming.harvestFood+2)*2-1);assert.equal(s.farming.plots[0],s.config.farming.ripeAt);
  assert.equal(s.farming.boneSoil[0].remaining,2);s.food=0;
  probe.doWork(s,v,'harvest',report());assert.equal(s.food,remaining);assert.equal(s.farming.plots[0],null);assert.equal(s.farming.boneSoil[0].remaining,2);
});
test('a missing teacher or foundation cannot credit a generic lesson',()=>{
  const s=village(),[teacher,pupil]=s.villagers;teacher.practice.known.cordage=1;teacher.practice.used.cordage=1;
  pupil.practice.properties=['flexible'];pupil.practice.lessonToday={id:'cordage',teacher:teacher.id,key:'paired'};
  for(let i=0;i<3;i++){const r=report();r.actions.push({id:pupil.id,action:practiceWork(s,pupil,1,r)});completePracticeLessons(s,r);}
  assert.equal(pupil.practice.known.cordage,undefined);assert.equal(pupil.practice.lessons.paired,undefined);
  pupil.practice.properties=[];const r=report();r.actions=[{id:teacher.id,action:'Teach Plant-fiber cordage'},{id:pupil.id,action:'Learn from '+teacher.name}];
  r.practiceLessons=[{id:'cordage',studentId:pupil.id,teacherId:teacher.id,key:'paired'}];completePracticeLessons(s,r);
  assert.equal(pupil.practice.known.cordage,undefined);
});
test('quern experiments reuse one persistent stone and the completed station consumes that prototype',()=>{
  let s=village(),v=s.villagers[0];s.day=400;s.huts=[0,0];s.farming.known=true;s.farming.wheatHarvests=1;s.toolkit=['hammer stone'];s.local.stock.quernStone=1;
  v.practice.known.wheatgrowing=1;v.practice.properties=['fractures'];v.practice.lastSkill='stone';v.practice.skills.stone=5;v.lastCompanyDay=s.day;
  assert.ok(canExperiment(s,v,practices.quernmaking));
  for(let i=0;i<8&&!v.practice.known.quernmaking;i++){s.day++;v.lastCompanyDay=s.day;v.practice.energy=100;practiceWork(s,v,1,report());}
  assert.ok(v.practice.known.quernmaking);assert.equal(s.local.stock.quernStone,0);assert.equal(s.farming.quernProjects[0].stone,1);
  s=deserialize(serialize(s),s.config);v=s.villagers[0];assert.ok(makePracticeProduct(s,v,'quernmaking',report()));
  assert.equal(s.farming.querns.length,1);assert.equal(s.farming.quernProjects[0],undefined);assert.equal(s.local.stock.quernStone,0);
  s.villagers=[];assert.equal(s.farming.querns.length,1);
});
test('stored meals allow bridge work with an empty fresh pantry',()=>{
  const s=village(),v=s.villagers[0];s.food=0;s.local.campStores[0]={saved:80,rack:0,built:true,racks:4};
  s.local.fords={tributary:{channel:'tributary',work:4,spent:{stone:8},completedDay:0,site:[500,154]}};
  Object.assign(v.practice.known,{bridgecraft:1,housing:1,cordage:1});v.practice.skills.wood=6;v.practice.skills.fibre=4;
  s.toolkit=['hand axe'];s.local.stock.fibre=s.local.stock.stone=10;
  assert.equal(buildTributaryBridge(s,v,report()),true);assert.equal(s.local.tributaryBridge.work,1);
});
test('weekly practice has a bounded energy cost and gives no fictitious granary use',()=>{
  const s=village(),v=s.villagers[0];v.practice.known.granaries=1;v.practice.known.cordage=1;v.practice.gear.cord=true;
  const r=report(),energy=v.practice.energy;probe.weeklyWork(s,r);
  assert.equal(v.practice.used.granaries||0,0);
  const tasks=r.weeklyWork.filter(a=>a.id===v.id);
  assert.equal(tasks.length,1,'the fixture must actually exercise a practice session');
  assert.equal(tasks[0].item,practices.cordage.name);assert.ok(tasks[0].action);
  assert.equal(energy-v.practice.energy,Math.max(1,s.config.learning.workCost/4));
});
test('retired sheds are not started or awarded automatically; existing paid projects survive builder loss',()=>{
  let s=village();s.farming.known=true;s.config.shed.population=2;probe.resolveLivesAndDiscovery(s,report());assert.equal(s.shed.pending,false);
  const v=s.villagers[0];Object.assign(v.practice.known,{housing:1,cordage:1});s.toolkit=['hand axe'];
  assert.equal(buildPlankShed(s,v,report()),false);assert.equal(s.shed.project,undefined);assert.equal(s.shed.built,false);
  s.shed.project={site:[330,120],camp:0,work:1,spent:{wood:2,fibre:1},clearedTrees:[],founderId:v.id,startedDay:s.day-1};
  const project=structuredClone(s.shed.project);s.villagers.shift();s=deserialize(serialize(s),s.config);assert.deepEqual(s.shed.project,project);
});
test('a first-year drying rack costs materials and two real construction days',()=>{
  const s=village(),v=s.villagers[0];s.day=3;v.practice.known.drying=1;v.practice.skills.wood=3;s.local.stock.fibre=5;
  const wood=s.wood,fibre=s.local.stock.fibre;
  for(let i=0;i<2;i++){v.practice.energy=100;assert.equal(preservationWork(s,v,report()),true);s.day++;}
  assert.equal(s.local.campStores[0].built,true);assert.equal(wood-s.wood,3);assert.equal(fibre-s.local.stock.fibre,1);
});
test('an infant rests while older household members perform productive work',()=>{
  const s=village(),infant=s.villagers[0];infant.age=1;infant.gender='female';s.villagers[1].gender='female';
  const next=stepDay(s);assert.equal(next.lastDay.actions.find(a=>a.id===infant.id).action,'Rest with household');
  assert.equal(next.lastDay.actions.find(a=>a.id===infant.id).gained,0);
  assert.deepEqual(next.villagers[0].practice.skills,infant.practice.skills);
});
test('needing shelter permits its foundations without bypassing urgent needs',()=>{
  const s=village(),v=s.villagers[0];v.tribe=1;v.outdoors=true;s.local.stock.fibre=s.local.stock.stone=s.local.stock.hide=s.local.stock.resin=15;
  const actions=[];
  for(let day=0;day<60&&!v.practice.gear['hafted tool'];day++){
    s.day++;v.lastCompanyDay=s.day;v.practice.energy=100;
    actions.push(practiceWork(s,v,1,report()));
  }
  assert.ok(v.practice.known.cordage);assert.ok(v.practice.known.knapping);assert.ok(v.practice.known.hafting);assert.ok(v.practice.gear['hafted tool']);
  assert.ok(actions.some(a=>a?.startsWith('Inspect ')));v.fullness=0;s.food=0;
  assert.equal(practiceWork(s,v,1,report()),null,'urgent food still releases the project');
});
test('founding construction does not wait for the full seasonal stock target',()=>{
  const s=village();s.settlementWork=4;s.food=6;s.farming.known=false;
  const next=stepDay(s);assert.ok(next.lastDay.actions.some(a=>a.action==='Build shelter'));
  assert.equal(next.settlementWork>=5,true);
});
test('an unavailable curious pioneer cannot prevent another safe villager testing seeds',()=>{
  const s=village(),[unavailable,learner]=s.villagers;s.local.seedFinds=4;s.local.healerId=999;
  unavailable.tribe=1;unavailable.practice.curiosity=.99;learner.practice.curiosity=.1;
  for(const v of s.villagers)v.gender='female';
  const next=stepDay(s);assert.ok(next.local.seedTrial);
  assert.equal(next.lastDay.actions.find(a=>a.action==='Sow wild seeds')?.id,learner.id);
});
test('remote huts cannot protect residents of a camp with no local beds',()=>{
  const s=village();s.huts=[0,0];s.hutDetails=s.huts.map(()=>({shape:'dome hut'}));s.villagers[1].tribe=1;
  assert.equal(localShelterPlaces(s,1),0);const next=stepDay(s);assert.equal(next.villagers.find(v=>v.id===s.villagers[1].id).outdoors,true);
});
test('eastern workers with urgent needs cannot build or gain free work energy',()=>{
  const s=village();s.local.wildPatches=[18];s.local.daughter={site:[1140,158],patch:0,origin:0,members:s.villagers.map(v=>v.id),food:40,wood:10,started:0,shelter:0,field:0};
  for(const v of s.villagers){v.warmth=0;v.practice.energy=1;}
  const r=report();probe.tendDaughter(s,s.villagers,r);assert.equal(s.local.daughter.shelter,0);assert.ok(r.actions.every(a=>a.action!=='Build eastern shelter'));
});
test('global equipment needs a knowledgeable maker and real materials',()=>{
  const s=village(),v=s.villagers[0];s.local.stock.stone=0;const r=equipmentRecipe(s,v,'hammer stone');assert.ok(r);assert.equal(equipmentAffordable(s,r),false);
  s.local.stock.stone=1;payEquipment(s,r);assert.equal(s.local.stock.stone,0);
  assert.equal(equipmentRecipe(s,v,'hand axe'),null);v.practice.known.hafting=1;assert.ok(equipmentRecipe(s,v,'hand axe'));
});
test('a blocked river journey grants no food, material consumption or work experience',()=>{
  const s=village(),v=s.villagers[0];s.settlementWork=5;s.lastUsed.flood=s.day;s.food=0;
  const before=structuredClone(v.practice),berries=s.local.deposits.berries,r=report();probe.doWork(s,v,'forage',r);
  assert.equal(s.food,0);assert.equal(s.local.deposits.berries,berries);assert.deepEqual(v.practice,before);
  assert.equal(r.actions[0].action,'Wait for a safe crossing');assert.equal(r.journeys[0].completed,false);
});
test('travel geometry, ice and crossing events are deterministic and survive saving',()=>{
  let s=village(),v=s.villagers[0];s.day=65;assert.equal(workRoute(s,v,[272,568]).frozen,valleySeason(s).frozen);assert.equal(riverFrozen(s),valleySeason(s).frozen);
  const r=report();beginWorkJourney(s,v,[272,568],r);s=deserialize(serialize(s),s.config);v=s.villagers[0];
  assert.deepEqual(workRoute(s,v,[272,568]),workRoute(s,v,[272,568]));
  if(v.lastRiverAccident)assert.ok(!Object.values(riverWaterAt(...v.journeyPosition,1000,640,false,true)).some(Boolean));
});
test('a simulated flood-crossing fall interrupts output and replays from a save',()=>{
  let found=false;
  for(let seed=1;seed<=500&&!found;seed++){
    const s=village();s.seed=seed;s.day=10;s.lastUsed.flood=s.day;s.food=0;s.local.tributaryBridge={work:6,completedDay:1};
    const before=deserialize(serialize(s),s.config),r=report();probe.doWork(s,s.villagers[0],'forage',r);
    if(!r.riverAccidents?.length)continue;
    found=true;const replay=report();probe.doWork(before,before.villagers[0],'forage',replay);
    assert.deepEqual(replay.riverAccidents,r.riverAccidents);assert.equal(s.food,0);
    assert.equal(r.actions[0].action,'Recover after a river fall');
    assert.ok(!Object.values(riverWaterAt(...r.riverAccidents[0].landing,1000,640,true,true)).some(Boolean));
  }
  assert.ok(found,'the deterministic seed set exercises a real simulated accident');
});
