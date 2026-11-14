import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,stepDay,castText,queueText,queueCommand,restart,inventionProgress,tomorrowWeather} from '../src/sim.js';
import {HOMESTEAD_RULES} from '../src/config.js';
import {practices,availablePractices,canExperiment,makePracticeProduct,practiceWork,planLessons,completeMagicLessons,beginSettlementDay} from '../src/practices.js';
import {magicEnabled,magicPracticeIds,planRitual,finishDivinations,coldOmen} from '../src/magic.js';
import {serialize,deserialize} from '../src/save.js';

const rules={...HOMESTEAD_RULES,traits:false,illness:{chance:0},
  learning:{...HOMESTEAD_RULES.learning,seasonLength:1000},weather:{chances:{normal:100,rain:0,drought:0,cold:0}}};
function world(enabled=true){
  let s=createState(rules,4);s.villagers=s.villagers.slice(0,2);s.nextId=3;
  s.food=90;s.wood=40;s.fireKnown=s.fireLit=true;s.settlementWork=5;s.local.reaches=12;
  Object.assign(s.local.stock,{bone:30,fibre:20,herbs:10,charcoal:10,resin:10});
  for(const v of s.villagers){
    v.fullness=v.warmth=v.health=v.happiness=100;v.practice.energy=100;v.gender='female';v.traits=[];
    v.practice.properties=['rigid','flexible','fractures','perishable'];
    Object.assign(v.practice.skills,{wood:5,stone:4,fibre:3,berries:5});
    Object.assign(v.practice.known,{knapping:1,cordage:1,charcoal:1});v.practice.outdoorDays=4;
    v.practice.curiosity=.1;
  }
  if(enabled)s=castText(s,'magic').state;
  return s;
}

test('only the exact typed magic command awakens a living homestead, immediately and idempotently',()=>{
  const s=world(false),rng=s.rng,traits=s.traitRng;
  for(const text of ['magic!','enable magic','magical','no magic','magic rain','magic food']){
    assert.equal(magicEnabled(castText(s,text).state),false,text);
  }
  assert.equal(queueText(s,'magic').matched,false);assert.equal(queueCommand(s,'magic').ok,false);
  const result=castText(s,'  MAGIC  ');assert.ok(result.ok);assert.ok(magicEnabled(result.state));
  assert.equal(result.state.rng,rng);assert.equal(result.state.traitRng,traits);assert.equal(s.local.magic,undefined);
  assert.strictEqual(castText(result.state,'magic').state,result.state);
  assert.equal(magicEnabled(restart(result.state,7)),false);
  for(const version of ['v0.1','v0.2'])assert.equal(castText(createState({version},4),'magic').ok,false);
  const ended=structuredClone(s);ended.ended=true;assert.equal(castText(ended,'magic').ok,false);
});
test('unlocking grants possibility without spells, objects, professions or buildings',()=>{
  const s=world(false),next=castText(s,'magic').state;
  assert.deepEqual(next.villagers,s.villagers);assert.equal(next.local.healerHome,s.local.healerHome);
  assert.deepEqual(next.local.stock,s.local.stock);assert.equal(next.food,s.food);assert.equal(next.wood,s.wood);
});
test('inactive worlds hide magical discoveries and cannot experiment, craft, cast or inherit activation',()=>{
  const s=world(false),v=s.villagers[0];
  Object.assign(v.practice.known,{bonecasting:1,foretelling:1});v.practice.gear['casting bones']=true;
  assert.equal(availablePractices(s).some(r=>r.magic),false);
  assert.equal(inventionProgress(s).missing.includes('Reading omens'),false);
  delete v.practice.known.bonecasting;assert.equal(canExperiment(s,v,practices.bonecasting),false);
  v.practice.known.bonecasting=1;
  const before=structuredClone(s);assert.equal(makePracticeProduct(s,v,'bonecasting'),false);
  assert.equal(makePracticeProduct(s,v,'foretelling'),false);assert.deepEqual(s,before);
  assert.equal(magicEnabled(deserialize(serialize(s),rules)),false);
});
test('marked casting bones require basic tool knowledge, crushing experience, fire and real bone/charcoal',()=>{
  const s=world(),v=s.villagers[0];
  assert.ok(canExperiment(s,v,practices.bonecasting));
  for(const key of ['crude tools']){
    const old=v.practice.known[key];delete v.practice.known[key];assert.equal(canExperiment(s,v,practices.bonecasting),false);v.practice.known[key]=old;
  }
  s.local.stock.bone=0;assert.equal(canExperiment(s,v,practices.bonecasting),false);s.local.stock.bone=30;
  v.practice.known.bonecasting=1;assert.ok(makePracticeProduct(s,v,'bonecasting'));
  assert.equal(s.local.stock.bone,29);assert.equal(s.local.stock.fibre,20);assert.equal(s.local.stock.charcoal,9);
  assert.ok(v.practice.gear['casting bones']);assert.equal(makePracticeProduct(s,v,'bonecasting'),false);
});
test('foretelling needs the actual divining bones and outdoor experience, then spends reagents and a ritual workday',()=>{
  const s=world(),v=s.villagers[0];Object.assign(v.practice.known,{bonecasting:1,foretelling:1});
  assert.equal(makePracticeProduct(s,v,'foretelling'),false);v.practice.gear['casting bones']=true;
  v.practice.outdoorDays=0;assert.equal(makePracticeProduct(s,v,'foretelling'),false);v.practice.outdoorDays=4;
  const report={actions:[]},energy=v.practice.energy;
  assert.equal(practiceWork(s,v,101,report),'Cast the divining bones');
  assert.equal(v.practice.energy,energy-s.config.learning.workCost*2);
  assert.equal(s.local.stock.herbs,9);assert.equal(s.local.stock.charcoal,9);assert.equal(report.magic.length,1);
  assert.equal(makePracticeProduct(s,v,'foretelling'),false,'six-day cooldown');
});
test('an actual omen reads the existing next-dawn rolls without consuming extra randomness',()=>{
  const s=world(),v=s.villagers[0];Object.assign(v.practice.known,{bonecasting:1,foretelling:1});v.practice.gear['casting bones']=true;
  const next=stepDay(s);assert.ok(next.lastDay.magic?.some(r=>r.spell==='foretelling'));
  const omen=next.local.magic.omens.at(-1);assert.equal(omen.forDay,next.day+1);assert.equal(omen.weather,tomorrowWeather(next));
  const control=stepDay(world(false));assert.equal(next.rng,control.rng);assert.equal(next.traitRng,control.traitRng);
  const following=stepDay(next);assert.equal(following.lastDay.weather,omen.weather);
});
test('personal foretelling identifies the rolled illness target, with a conditional prediction',()=>{
  const s=world(),v=s.villagers[0];Object.assign(v.practice.known,{bonecasting:1,foretelling:1});v.practice.gear['casting bones']=true;
  assert.ok(makePracticeProduct(s,v,'foretelling'));s.natural={weather:'cold',illness:true,target:4294967295};
  const rng=s.rng;finishDivinations(s,'cold');const omen=s.local.magic.omens[0];
  assert.equal(omen.illnessTarget,2);assert.match(omen.text,/god can still change/);assert.equal(s.rng,rng);
  assert.ok(coldOmen(s,v));s.day=omen.forDay+1;assert.equal(coldOmen(s,v),false);
});
test('a camp shares its reading instead of paying for repeated identical omens from multiple diviners',()=>{
  const s=world();
  for(const v of s.villagers){Object.assign(v.practice.known,{bonecasting:1,foretelling:1});v.practice.gear['casting bones']=true;}
  assert.ok(makePracticeProduct(s,s.villagers[0],'foretelling'));
  const herbs=s.local.stock.herbs;assert.equal(makePracticeProduct(s,s.villagers[1],'foretelling'),false);
  assert.equal(s.local.stock.herbs,herbs);s.day=6;
  assert.ok(makePracticeProduct(s,s.villagers[1],'foretelling'));
});
test('hearth charms need a real burning hearth, preserve fuel and cannot stack',()=>{
  const s=world(),v=s.villagers[0];v.practice.known.hearthcharms=1;s.villagers[1].warmth=50;
  s.fireLit=false;assert.equal(makePracticeProduct(s,v,'hearthcharms'),false);s.fireLit=true;
  s.wood=4;assert.equal(makePracticeProduct(s,v,'hearthcharms'),false);s.wood=20;
  assert.ok(makePracticeProduct(s,v,'hearthcharms'));assert.equal(s.wood,19);assert.equal(s.villagers[1].warmth,56);
  assert.equal(makePracticeProduct(s,v,'hearthcharms'),false);assert.equal(s.local.magic.hearths[0].until,2);
  s.day=3;beginSettlementDay(s);assert.equal(s.local.magic.hearths[0],undefined);
});
test('mending requires medical experience, consumes herbs/resin and has a per-patient limit',()=>{
  const s=world(),v=s.villagers[0],patient=s.villagers[1];
  Object.assign(v.practice.known,{herbalism:2,mendingrites:1});patient.health=40;patient.illnessDays=3;
  assert.equal(makePracticeProduct(s,v,'mendingrites'),false);
  v.practice.careExperience=3;v.practice.used.herbalism=1;
  assert.ok(makePracticeProduct(s,v,'mendingrites'));assert.equal(patient.health,46);assert.equal(patient.illnessDays,2);
  assert.equal(s.local.stock.herbs,9);assert.equal(s.local.stock.resin,9);assert.equal(makePracticeProduct(s,v,'mendingrites'),false);
});
test('preservation wards require drying practice and existing food, reduce spoilage temporarily, and create none',()=>{
  const s=world(),v=s.villagers[0];Object.assign(v.practice.known,{drying:1,storewards:1});v.practice.used.drying=2;
  assert.equal(makePracticeProduct(s,v,'storewards'),false);s.local.dried=5;
  const food=s.food;assert.ok(makePracticeProduct(s,v,'storewards'));assert.equal(s.food,food);
  const control=structuredClone(s);delete control.local.magic.pantry;s.day=control.day=1;
  beginSettlementDay(s);beginSettlementDay(control);assert.ok(s.food>control.food);
  assert.equal(makePracticeProduct(s,v,'storewards'),false);
  s.day=4;const expired=structuredClone(s);delete expired.local.magic.pantry;
  beginSettlementDay(s);beginSettlementDay(expired);assert.equal(s.food,expired.food);
});
test('own hunger, cold, sickness, exhaustion and childhood prevent optional rituals without charging materials',()=>{
  for(const condition of ['hunger','cold','illness','energy','child']){
    const s=world(),v=s.villagers[0];Object.assign(v.practice.known,{bonecasting:1,foretelling:1});v.practice.gear['casting bones']=true;
    if(condition==='hunger'){s.food=0;v.fullness=5;}
    if(condition==='cold')v.warmth=10;if(condition==='illness')v.illnessDays=2;
    if(condition==='energy')v.practice.energy=25;if(condition==='child')v.age=12;
    const herbs=s.local.stock.herbs;assert.equal(makePracticeProduct(s,v,'foretelling'),false,condition);assert.equal(s.local.stock.herbs,herbs);
  }
});
test('learning magical lore requires prerequisites and two real joint teaching days',()=>{
  const s=world(),teacher=s.villagers[0],student=s.villagers[1];s.day=0;
  teacher.practice.known.bonecasting=2;teacher.practice.used.bonecasting=2;
  for(let day=0;day<2;day++){
    teacher.practice.lessonToday=student.practice.lessonToday=null;planLessons(s,[student,teacher]);
    const report={actions:[]};
    for(const v of [student,teacher]){const action=practiceWork(s,v,101,report);report.actions.push({id:v.id,action});}
    completeMagicLessons(s,report);assert.equal(!!student.practice.known.bonecasting,day===1);s.day++;
  }
  assert.equal(student.practice.gear['casting bones'],undefined,'lessons do not grant the physical tool');
});
test('an interrupted magical lesson does not invent knowledge or reset completed learning',()=>{
  const s=world(),teacher=s.villagers[0],student=s.villagers[1];teacher.practice.used.bonecasting=1;teacher.practice.known.bonecasting=2;
  planLessons(s,[student,teacher]);const report={actions:[]};
  report.actions.push({id:student.id,action:practiceWork(s,student,101,report)},{id:teacher.id,action:'Care for a patient'});
  completeMagicLessons(s,report);assert.equal(student.practice.known.bonecasting,undefined);assert.equal(Object.keys(student.practice.lessons).length,0);
});
test('the healer can pass learned magical lore to their own apprentice on actual joint teaching days',()=>{
  const s=world(),teacher=s.villagers[0],student=s.villagers[1];
  teacher.herbalist={leaves:0,doses:2,visits:3};teacher.practice.known.bonecasting=2;teacher.practice.used.bonecasting=2;
  student.healerApprentice={mentorId:teacher.id,mentorName:teacher.name,plantDays:2,patientDays:2,remedyDays:3};
  for(let day=0;day<2;day++){
    planLessons(s,[student,teacher]);const report={actions:[]};
    for(const v of [student,teacher])report.actions.push({id:v.id,action:practiceWork(s,v,101,report)});
    completeMagicLessons(s,report);s.day++;
  }
  assert.ok(student.practice.known.bonecasting);assert.equal(student.herbalist,undefined);
  assert.equal(student.practice.gear['casting bones'],undefined);
});
test('save/load preserves the unlock, learned lore, tools, omens and temporary effects without granting new lore',()=>{
  const s=world(),v=s.villagers[0];Object.assign(v.practice.known,{bonecasting:1,foretelling:1});v.practice.gear['casting bones']=true;
  makePracticeProduct(s,v,'foretelling');finishDivinations(s,'rain');
  const back=deserialize(serialize(s),rules);assert.ok(magicEnabled(back));assert.deepEqual(back.local.magic,s.local.magic);
  assert.deepEqual(back.villagers[0].practice.known,v.practice.known);
  assert.deepEqual(stepDay(back),stepDay({...s,lastDay:null,speed:0,elapsedMs:0}));
});
