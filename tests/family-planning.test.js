import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,stepDay,readyToInvent,unrelated,populationCap} from '../src/sim.js';
import {HOMESTEAD_RULES} from '../src/config.js';
import {practices,canExperiment,practiceWork,planLessons,completeFamilyLessons,makePracticeProduct} from '../src/practices.js';
import {familyPlanningRules,recordFamilyExperience,familyPlan,familyPlanningStudyReady} from '../src/family-planning.js';
import {planFamilyBirths,canWelcomeFamilyChild} from '../src/families.js';
import {serialize,deserialize} from '../src/save.js';
import {SCENARIO,validateScenario} from '../src/scenario.js';

const rules={...HOMESTEAD_RULES,traits:false,illness:{chance:0},weather:{chances:{normal:100,rain:0,drought:0,cold:0}},learning:{...HOMESTEAD_RULES.learning,climate:false,spoilage:0}};
function village(){
  const s=createState(rules,4);s.day=100;s.food=150;s.wood=80;s.fireKnown=s.fireLit=true;s.settlementWork=15;
  s.config.tribeThresholds=[];s.huts=[0,0,0,0];s.hutDetails=s.huts.map(()=>({shape:'dome hut'}));
  s.local.season='Spring';s.local.campStores[0]={built:true,saved:0,rack:0,racks:1};
  for(const [i,v] of s.villagers.entries()){
    v.gender=i%2?'male':'female';v.tribe=0;v.fullness=v.warmth=v.health=v.happiness=v.practice.energy=100;
    v.lastCompanyDay=s.day;v.outdoors=false;v.parents=[];v.practice.curiosity=2;
    Object.assign(v.practice.known,{drying:1});v.practice.skills.berries=5;v.practice.properties=['perishable'];
    v.practice.familyExperience={careDays:4,shortageDays:8,childShortageDays:3,lastDay:s.day};
  }
  return s;
}
const report=()=>({actions:[],meals:[],damage:[]});
test('independent planning discovery needs care, real hardship, food skills and a usable store',()=>{
  const s=village(),v=s.villagers[0];assert.ok(canExperiment(s,v,practices.familyplanning));assert.ok(readyToInvent(s,'household food plan'));
  for(const issue of ['care','shortage','children','drying','store','property','age']){
    const x=structuredClone(s),p=x.villagers[0];
    if(issue==='care')p.practice.familyExperience.careDays=0;
    if(issue==='shortage')p.practice.familyExperience.shortageDays=0;
    if(issue==='children')p.practice.familyExperience.childShortageDays=0;
    if(issue==='drying')delete p.practice.known.drying;
    if(issue==='store')delete x.local.campStores[0];
    if(issue==='property')p.practice.properties=[];
    if(issue==='age')p.age=1;
    assert.equal(canExperiment(x,p,practices.familyplanning),false,issue);
  }
  for(const p of s.villagers)delete p.practice.familyExperience;
  s.day=10000;assert.equal(readyToInvent(s,'Household planning'),false,'a date never substitutes for experience');
});
test('eligible survivors still need seeded reflection opportunities and paid safe workdays',()=>{
  const s=village(),v=s.villagers[0],old=familyPlanningRules.reflectionChance;
  Object.assign(v.practice.known,Object.fromEntries(Object.keys(practices).filter(id=>id!=='familyplanning').map(id=>[id,1])));
  v.practice.lastSkill='berries';
  try{
    familyPlanningRules.reflectionChance=0;for(let i=0;i<6;i++){s.day++;v.lastCompanyDay=s.day;v.practice.energy=100;practiceWork(s,v,1,report());}
    assert.equal(v.practice.known.familyplanning,undefined);
    familyPlanningRules.reflectionChance=1;v.practice.energy=100;const before=v.practice.energy;
    assert.equal(practiceWork(s,v,1,report()),'Experiment with berries');assert.ok(v.practice.energy<before);
    assert.ok(v.practice.progress.familyplanning>0);assert.equal(v.practice.known.familyplanning,undefined);
    v.practice.energy=100;practiceWork(s,v,1,report());assert.ok(v.practice.known.familyplanning);
    assert.equal(makePracticeProduct(s,v,'familyplanning',report()),false,'reasoning does not manufacture a physical object');
    assert.equal(v.practice.gear['household food plan'],undefined);
  }finally{familyPlanningRules.reflectionChance=old;}
});
test('daily memories come from witnessed hunger and actual child care, counted once',()=>{
  const s=village(),adult=s.villagers[0],child=s.villagers.at(-1);
  for(const v of s.villagers)delete v.practice.familyExperience;
  child.age=2;child.carers=[adult.id];child.fullness=10;
  recordFamilyExperience(s,report());recordFamilyExperience(s,report());
  assert.equal(adult.practice.familyExperience.careDays,1);assert.equal(adult.practice.familyExperience.shortageDays,1);
  assert.equal(adult.practice.familyExperience.childShortageDays,1);assert.equal(s.villagers[1].practice.familyExperience.careDays,0);
  s.day++;child.fullness=90;recordFamilyExperience(s,report());assert.equal(adult.practice.familyExperience.shortageDays,1);
});
test('experienced teachers transmit planning without requiring the pupil to suffer a famine',()=>{
  const s=village(),[teacher,student]=s.villagers;s.villagers=[teacher,student];
  teacher.practice.known.familyplanning=1;teacher.practice.used={familyplanning:1};student.practice.familyExperience={careDays:4,shortageDays:0,childShortageDays:0};
  assert.equal(familyPlanningStudyReady(s,student),false);
  for(let day=100;day<110&&!student.practice.known.familyplanning;day++){
    s.day=day;for(const v of s.villagers){v.practice.lessonToday=null;v.practice.energy=100;v.lastCompanyDay=day;}
    planLessons(s,s.villagers);if(student.practice.lessonToday?.id!=='familyplanning')continue;
    const r=report();for(const v of [student,teacher])r.actions.push({id:v.id,action:practiceWork(s,v,1,r)});
    completeFamilyLessons(s,r);
  }
  assert.ok(student.practice.known.familyplanning);assert.equal(student.practice.familyExperience.shortageDays,0);
});
test('a teacher diverted to survival cannot grant a phantom planning lesson',()=>{
  const s=village(),[teacher,student]=s.villagers;teacher.practice.known.familyplanning=1;teacher.practice.used.familyplanning=1;
  student.practice.lessonToday={teacher:teacher.id,id:'familyplanning',key:'paired'};teacher.practice.lessonToday={student:student.id,id:'familyplanning'};
  const r=report();r.actions.push({id:student.id,action:practiceWork(s,student,1,r)});teacher.warmth=0;
  r.actions.push({id:teacher.id,action:practiceWork(s,teacher,1,r)});completeFamilyLessons(s,r);
  assert.equal(student.practice.lessons.paired,undefined);
});
test('learned families decide through mutual willingness without imposing a food budget',()=>{
  const s=village();s.villagers=s.villagers.slice(0,4);const [mother,father]=s.villagers;
  s.config.birth.consecutiveDays=1;s.food=14;
  assert.ok(canWelcomeFamilyChild(s,mother,populationCap,father));
  father.practice.known.familyplanning=1;assert.ok(canWelcomeFamilyChild(s,mother,populationCap,father),'learning cannot impose a food veto');
  assert.equal(mother.practice.known.familyplanning,undefined,'a partner does not learn without lessons');
  s.food=17;assert.ok(canWelcomeFamilyChild(s,mother,populationCap,father));
  s.villagers.push({id:99,age:0,tribe:0});assert.ok(canWelcomeFamilyChild(s,mother,populationCap,father));
  s.food=100;for(const v of s.villagers.slice(0,4))v.practice.known.familyplanning=1;
  const pairs=planFamilyBirths(s,s.villagers.slice(0,4),{unrelated,populationCap});assert.equal(pairs.length,2,'secure planners still allow simultaneous births');
  const food=s.food;assert.ok(familyPlan(s,mother,father).ready);assert.equal(s.food,food,'a forecast never consumes fictional food');
});
test('learned willingness is independent of season, ingredients and private provisions',()=>{
  const s=village(),[mother,father]=s.villagers;mother.practice.known.familyplanning=1;s.food=25;
  assert.ok(familyPlan(s,mother,father).ready);s.local.season='Autumn';assert.ok(familyPlan(s,mother,father).ready);
  s.local.stock.wheat=500;s.local.stock.flour=500;s.local.campStores[1]={saved:500,rack:500};
  assert.ok(familyPlan(s,mother,father).ready);
  s.local.campStores[0].saved=40;assert.ok(familyPlan(s,mother,father).ready);
  father.wantsChildren=false;assert.equal(familyPlan(s,mother,father).ready,false,'either person can decline');
});
test('save/load retains learned practice and memory; newborns do not inherit it',()=>{
  let s=village();s.config.birth.consecutiveDays=1;for(const v of s.villagers)v.practice.known.familyplanning=1;
  const loaded=deserialize(serialize(s),s.config);assert.deepEqual(loaded.villagers[0].practice.familyExperience,s.villagers[0].practice.familyExperience);
  assert.ok(loaded.villagers[0].practice.known.familyplanning);assert.equal(serialize(stepDay(s)),serialize(stepDay(loaded)));
  s=stepDay(s);assert.ok(s.lastDay.births.length);for(const id of s.lastDay.births)assert.equal(s.villagers.find(v=>v.id===id).practice.known.familyplanning,undefined);
});
test('planning probabilities and thresholds reject invalid scenario edits',()=>{
  const settings=structuredClone(SCENARIO);settings.progression.familyPlanning.reflectionChance=2;settings.progression.familyPlanning.careDays=.5;
  for(const key of ['reflectionChance','careDays'])assert.ok(validateScenario(settings).some(e=>e.includes(key)));
});
test('remembering an old discovery does not replace a dead teacher or educate the next generation',()=>{
  let s=village();s.villagers=s.villagers.slice(0,2);const [teacher,student]=s.villagers;
  teacher.age=s.config.life.death-1;teacher.practice.known.familyplanning=1;teacher.practice.used.familyplanning=3;
  s.local.first.familyplanning=90;student.practice.familyExperience={careDays:4,shortageDays:0,childShortageDays:0};
  s=stepDay(s);assert.ok(s.lastDay.deaths.some(d=>d.id===teacher.id));s=stepDay(s);
  assert.equal(s.villagers.find(v=>v.id===student.id).practice.known.familyplanning,undefined);
  assert.equal(s.local.first.familyplanning,90,'the earlier discovery remains recorded');
});
