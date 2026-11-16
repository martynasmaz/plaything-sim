import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,stepDay,unrelated,populationCap} from '../src/sim.js';
import {HOMESTEAD_RULES} from '../src/config.js';
import {SCENARIO,validateScenario} from '../src/scenario.js';
import {initPractice,maintainHouseholds,finishOrdinaryWork,canExperiment,practices,planLessons,practiceWork,completePracticeLessons,beginSettlementDay} from '../src/practices.js';
import {serialize,deserialize} from '../src/save.js';
import {assessNeeds} from '../src/needs.js';
import {planFamilyBirths} from '../src/families.js';
import {familyPlan} from '../src/family-planning.js';
import {initFamilyMotivation,beginFamilyDay,finishFamilyDay,familyDesire,familyGoal,familyBond,rememberFamilyContact,
  familyLearningPriority,courtshipWork,familyMealOrder,familyDescription,familyMotivationRules,familyWorkMentor} from '../src/family-motivation.js';

const rules={...HOMESTEAD_RULES,traits:false,illness:{chance:0},weather:{chances:{normal:100,rain:0,drought:0,cold:0}},
  learning:{...HOMESTEAD_RULES.learning,climate:false,spoilage:0}};
function village(){
  const s=createState(rules,4);s.day=50;s.food=100;s.wood=50;s.fireKnown=s.fireLit=true;s.settlementWork=5;s.local.healerId=999;
  s.config.tribeThresholds=[];
  for(const [i,v] of s.villagers.entries()){
    v.gender=i%2?'male':'female';v.age=50;v.parents=[];v.tribe=0;v.household=v.id;
    v.fullness=v.warmth=v.health=v.happiness=v.practice.energy=100;v.lastCompanyDay=s.day;v.traits=[];delete v.herbalist;
  }
  beginFamilyDay(s);return s;
}
function child(s,{age=2,...properties}={}){
  const c={...structuredClone(s.villagers[0]),id:s.nextId++,name:'Child',age,parents:[1,2],carers:[1,2],household:1,gender:'female',...properties};
  delete c.family;delete c.familyReadiness;delete c.childrenBorn;c.practice=undefined;initPractice(s,c);s.villagers.push(c);s.stats.births++;return c;
}
function courtFixture(){
  const s=village();s.villagers=s.villagers.slice(0,3);s.villagers[2].age=s.config.life.elder;
  const report={actions:[]},journey=()=>true;
  const run=()=>courtshipWork(s,s.villagers,report,{finish:finishOrdinaryWork,site:()=>[330,120],journey});
  return {s,report,run};
}

test('family ambitions are individual, deterministic, and consume no dice, supplies or discoveries',()=>{
  const s=village(),copy=village(),before={rng:s.rng,traitRng:s.traitRng,food:s.food,wood:s.wood,huts:s.huts,known:s.villagers.map(v=>v.practice.known)};
  assert.deepEqual(s.villagers.map(v=>v.family),copy.villagers.map(v=>v.family));
  assert.ok(new Set(s.villagers.map(v=>v.family.drive)).size>1);
  for(const v of s.villagers)initFamilyMotivation(s,v);
  assert.deepEqual({rng:s.rng,traitRng:s.traitRng,food:s.food,wood:s.wood,huts:s.huts,known:s.villagers.map(v=>v.practice.known)},before);
});
test('desire remains mutual and independent of pantry, fullness, warmth and meal-cost birth gates',()=>{
  const s=village(),[a,b]=s.villagers;
  for(const [object,key] of [[s,'food'],[s.local,'campStores'],[s.config.needs,'mealCost'],[a,'fullness'],[b,'warmth']])
    Object.defineProperty(object,key,{get(){throw Error('desire read '+key);},configurable:true});
  assert.equal(familyPlan(s,a,b).ready,true);b.wantsChildren=false;assert.equal(familyPlan(s,a,b).ready,false);
});
test('preferred family size is soft, and fatigue and recovery change personal willingness',()=>{
  const s=village(),v=s.villagers[0];v.family.drive=.7;v.family.preferredChildren=2;
  for(let i=0;i<3;i++)child(s,{age:25});
  const desire=familyDesire(s,v);assert.ok(desire>familyMotivationRules.willingnessThreshold);
  v.family.fatigue=1;v.family.griefUntil=s.day+2;assert.ok(familyDesire(s,v)<desire);
  const tired=familyDesire(s,v);s.day+=3;beginFamilyDay(s);assert.ok(familyDesire(s,v)>tired);
});
test('relationships grow only from actual compatible contact, once per day, without a minimum-affection birth gate',()=>{
  const s=village(),[a,b]=s.villagers;
  assert.equal(familyBond(a,b),0);assert.equal(familyPlan(s,a,b).ready,true);
  assert.ok(rememberFamilyContact(s,a,b));assert.equal(rememberFamilyContact(s,a,b),false);
  assert.equal(familyBond(a,b),1);assert.equal(familyBond(b,a),1);
  s.day++;b.parents=[a.id];assert.equal(rememberFamilyContact(s,a,b),false);
  b.parents=[];b.age=1;assert.equal(rememberFamilyContact(s,a,b),false);
});
test('known partners are preferred and continuing readiness is not stolen by a newer connection',()=>{
  const s=village(),[m,a,,b]=s.villagers;s.villagers=[m,a,b];s.config.birth.consecutiveDays=3;
  rememberFamilyContact(s,m,b,4);
  let pairs=planFamilyBirths(s,s.villagers,{unrelated,populationCap});assert.equal(pairs.length,0);assert.equal(m.familyReadiness.fatherId,b.id);
  s.day++;rememberFamilyContact(s,m,a,8);planFamilyBirths(s,s.villagers,{unrelated,populationCap});assert.equal(m.familyReadiness.fatherId,b.id);
});
test('courtship spends two real work slots, produces paired company and leaves resources unchanged',()=>{
  const {s,report,run}=courtFixture(),before={food:s.food,wood:s.wood,rng:s.rng,traitRng:s.traitRng};
  assert.equal(run().size,2);assert.equal(report.actions.length,2);assert.equal(new Set(report.actions.map(a=>a.id)).size,2);
  const [a,b]=s.villagers;assert.equal(familyBond(a,b),1);assert.equal(a.favors[b.id],1);
  assert.deepEqual({food:s.food,wood:s.wood,rng:s.rng,traitRng:s.traitRng},before);
  assert.equal(courtshipWork(s,s.villagers,{actions:[]},{finish:finishOrdinaryWork,site:()=>[0,0],journey:()=>true}).size,0);
});
test('urgent needs, illness, fatigue, lessons, scarce provisions and dependent children prevent optional courtship',()=>{
  for(const issue of ['warmth','hunger','illness','energy','lesson','food','dependent']){
    const {s,report,run}=courtFixture(),a=s.villagers[0];
    if(issue==='warmth')a.warmth=10;if(issue==='hunger')a.fullness=10;if(issue==='illness')a.illnessDays=2;
    if(issue==='energy')a.practice.energy=10;if(issue==='lesson')a.practice.lessonToday={id:'cordage'};
    if(issue==='food')s.food=0;if(issue==='dependent')child(s,{fullness:10});
    assert.equal(run().size,0,issue);assert.equal(report.actions.length,0,issue);
  }
});
test('failed or separate-community journeys cannot grant phantom affection or company',()=>{
  const {s,report}=courtFixture(),[a,b]=s.villagers;a.lastCompanyDay=b.lastCompanyDay=1;
  courtshipWork(s,s.villagers,report,{finish:finishOrdinaryWork,site:()=>[0,0],journey:(_s,v,_site,r)=>{
    if(v===b){r.actions.push({id:v.id,action:'Walk to meeting'});return false;}return true;
  }});
  assert.equal(familyBond(a,b),0);assert.equal(a.lastCompanyDay,1);
  s.day++;b.tribe=1;beginFamilyDay(s);assert.equal(familyGoal(s,a).kind,'seek');
});
test('a child keeps both living caregivers across household numbers; replacement care preserves ancestry',()=>{
  const s=village(),c=child(s);s.villagers[2].household=1;
  maintainHouseholds(s);assert.deepEqual(c.carers,[1,2]);
  s.villagers=s.villagers.filter(v=>v.id!==2);maintainHouseholds(s);
  assert.deepEqual(c.parents,[1,2]);assert.deepEqual(c.carers,[1,3]);
});
test('a cold child receives actual paid parental care while a cold parent still warms up',()=>{
  const s=village(),c=child(s,{warmth:10});s.villagers[0].warmth=10;
  const next=stepDay(s),r=next.lastDay,care=r.actions.find(a=>a.patient===c.id);
  assert.ok(care);assert.equal(care.id,2);assert.equal(r.actions.filter(a=>a.id===2).length,1);
  assert.equal(r.actions.find(a=>a.id===1).action,'Warm up');
  assert.equal(next.villagers.find(v=>v.id===2).family.careDays,1);
});
test('parents defer their ration to a hungrier dependent without displacing starving adults or changing food',()=>{
  const s=village(),c=child(s,{fullness:20});s.villagers[0].fullness=0;s.villagers[1].fullness=70;
  const ids=s.villagers.map(v=>v.id),before=s.food,ordered=familyMealOrder(s,ids);
  assert.ok(ordered.indexOf(1)<ordered.indexOf(c.id));assert.ok(ordered.indexOf(c.id)<ordered.indexOf(2));
  assert.deepEqual([...ordered].sort((a,b)=>a-b),ids);assert.equal(s.food,before);
  s.villagers[1].traits=['Grabby'];assert.deepEqual(familyMealOrder(s,ids),ids);
});
test('nonmedical child warming cannot take scarce food providers or fuel workers away from essential work',()=>{
  const s=village();child(s,{warmth:10});s.food=0;
  const next=stepDay(s);assert.equal(next.lastDay.actions.some(a=>a.patient),false);
  assert.ok(next.lastDay.actions.some(a=>/Forage|Fish|Hunt|Harvest/.test(a.action)));
  const {s:home,report,run}=courtFixture();home.villagers[0].outdoors=true;
  assert.equal(run().size,0);assert.equal(report.actions.length,0);
  const f=courtFixture();assert.equal(courtshipWork(f.s,f.s.villagers,f.report,
    {finish:finishOrdinaryWork,site:()=>[0,0],journey:()=>true,safeToSocialize:()=>false}).size,0);
});
test('learning goals favour practical skills while all discovery prerequisites still apply',()=>{
  const s=village(),v=s.villagers[0];v.family.goal='home';
  assert.ok(familyLearningPriority(s,v,'housing')>familyLearningPriority(s,v,'bonecasting'));
  v.practice.known={};v.practice.skills={};v.practice.properties=[];
  assert.equal(canExperiment(s,v,practices.housing),false);assert.equal(s.huts,undefined);
  v.family.goal='provide';v.family.approach='provider';assert.ok(familyLearningPriority(s,v,'drying')>0);
  const intuitive=familyLearningPriority(s,v,'drying');v.practice.known.familyplanning=1;
  assert.ok(familyLearningPriority(s,v,'drying')>intuitive,'learned planning strengthens useful preparation without a new birth veto');
});
test('a family reserve aspiration cannot exclude secure parents from food lessons and experiments',()=>{
  const s=village(),c=child(s),v=s.villagers[0];s.food=s.villagers.length*s.config.needs.mealCost*2.5;
  c.fullness=c.warmth=100;beginFamilyDay(s);
  assert.equal(v.family.goal,'provide');assert.ok(assessNeeds(s,v).level>=2,'two safe days are still enough for learning');
  assert.ok(familyLearningPriority(s,v,'drying')>0);
  s.food=0;assert.equal(assessNeeds(s,v).need,'provisions');assert.equal(assessNeeds(s,v).level,1);
});
test('actual loss, maturity and care are remembered once, without fabricating history in a loaded world',()=>{
  const s=village(),v=s.villagers[0],c=child(s,{age:19}),dawn=s.villagers.map(p=>structuredClone(p));
  c.age=20;finishFamilyDay(s,dawn,{actions:[],deaths:[]});assert.equal(v.family.confidence,.04);
  finishFamilyDay(s,dawn,{actions:[],deaths:[]});assert.equal(v.family.confidence,.04);
  s.day++;const before=s.villagers.map(p=>structuredClone(p));s.villagers=s.villagers.filter(p=>p!==c);
  finishFamilyDay(s,before,{actions:[{id:v.id,patient:c.id}],deaths:[{id:c.id}]});
  assert.equal(v.family.careDays,1);assert.equal(v.family.griefUntil,s.day+familyMotivationRules.griefDays);
  const old=v.family.fatigue;beginFamilyDay(s);const recovered=v.family.fatigue;beginFamilyDay(s);
  assert.ok(recovered<old);assert.equal(v.family.fatigue,recovered);
});
test('a capable parent is preferred for a real prerequisite-respecting joint lesson',()=>{
  const s=village(),c=child(s,{age:10}),parent=s.villagers[1],other=s.villagers[3];s.day=51;
  for(const teacher of [parent,other]){teacher.practice.known.cordage=1;teacher.practice.used.cordage=2;teacher.practice.site='camp';}
  c.practice.properties=['flexible'];c.practice.site='camp';
  const people=[c,parent,other];beginSettlementDay(s);beginFamilyDay(s);planLessons(s,people);
  assert.equal(c.practice.lessonToday?.teacher,parent.id);
  const report={actions:[]};
  for(const v of [parent,c]){const action=practiceWork(s,v,1,report);report.actions.push({id:v.id,action});}
  assert.equal(report.actions[0].action,'Teach '+practices.cordage.name);
  assert.equal(report.actions[1].action,'Learn from '+parent.name);assert.equal(c.practice.known.cordage,undefined);
  completePracticeLessons(s,report);assert.equal(c.practice.lessons[parent.id+'-cordage'],1);
  assert.equal(c.practice.known.cordage,undefined,'a single family lesson cannot grant the completed practice');
});
test('parental teaching keeps the community fishing-observation pathway available',()=>{
  const s=village(),c=child(s,{age:10}),parent=s.villagers[0],fisher=s.villagers[3];
  parent.activity='Gather wood';fisher.activity='Fish';
  assert.equal(familyWorkMentor(s,c,[parent,fisher]),fisher);
  parent.activity='Fish';assert.equal(familyWorkMentor(s,c,[fisher,parent]),parent);
  parent.activity='Gather wood';fisher.activity='Gather wood';assert.equal(familyWorkMentor(s,c,[fisher,parent]),parent);
  assert.equal(familyWorkMentor(s,c,[]),undefined);
});
test('old saves retain knowledge, structures and preferences and gain no invented relationship history',()=>{
  const s=village();s.huts=[0];s.hutDetails=[{shape:'dome hut',work:6}];s.villagers[0].practice.known.housing=1;s.villagers[0].wantsChildren=false;
  for(const v of s.villagers)delete v.family;
  const loaded=deserialize(serialize(s),rules);assert.ok(loaded);assert.deepEqual(loaded.hutDetails,s.hutDetails);
  assert.equal(loaded.villagers[0].practice.known.housing,1);assert.equal(familyDesire(loaded,loaded.villagers[0]),0);
  assert.deepEqual(loaded.villagers[1].family.bonds,{});assert.equal(loaded.villagers[1].family.careDays,0);
  assert.equal(serialize(deserialize(serialize(loaded),rules)),serialize(loaded));
});
test('Observe reports the real family goal and known connection without granting any state',()=>{
  const s=village(),[a,b]=s.villagers;rememberFamilyContact(s,a,b,3);const before=serialize(s),text=familyDescription(s,a);
  assert.match(text,/Family:/);assert.ok(text.includes(b.name));assert.match(text,/Desire for another child/);assert.equal(serialize(s),before);
});
test('survival priorities outrank family ambitions and the family setting can be disabled',()=>{
  const s=village(),v=s.villagers[0];v.warmth=10;assert.equal(assessNeeds(s,v).need,'warmth');
  v.warmth=100;v.illnessDays=2;assert.equal(assessNeeds(s,v).need,'recovery');
  const enabled=familyMotivationRules.enabled;
  try{familyMotivationRules.enabled=false;assert.equal(familyGoal(s,v),null);assert.equal(familyLearningPriority(s,v,'housing'),0);}
  finally{familyMotivationRules.enabled=enabled;}
});
test('family scenario tuning rejects invalid numbers, intervals and switches',()=>{
  for(const [key,value] of [['driveMultiplier',-1],['willingnessThreshold',1.1],['socialInterval',0],['careFatigue',NaN],['enabled','yes']]){
    const settings=structuredClone(SCENARIO);settings.familyMotivation[key]=value;
    assert.ok(validateScenario(settings).some(e=>e.includes(key)),key);
  }
});
