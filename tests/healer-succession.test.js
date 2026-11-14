import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,stepDay,findHomesteadHealer} from '../src/sim.js';
import {HOMESTEAD_RULES} from '../src/config.js';
import {healerTrainingComplete} from '../src/healer-home.js';
import {serialize,deserialize} from '../src/save.js';

const rules={...HOMESTEAD_RULES,traits:false,illness:{chance:0},
  learning:{...HOMESTEAD_RULES.learning,seasonLength:1000},
  weather:{chances:{normal:100,rain:0,drought:0,cold:0}}};
function school(){
  const s=createState(rules,4);s.villagers=s.villagers.slice(0,3);s.nextId=4;
  s.food=100;s.wood=80;s.settlementWork=5;
  for(const [i,v] of s.villagers.entries()){
    v.age=[150,30,60][i];v.gender='female';v.traits=['Sociable'];v.household=v.id;
    v.fullness=v.warmth=v.health=v.happiness=100;v.practice.energy=100;
    v.practice.curiosity=i===1?.8:.1;v.practice.skills.berries=i===0?5:1;
  }
  const teacher=s.villagers[0];teacher.practice.known.herbalism=5;teacher.practice.used.herbalism=4;
  teacher.herbalist={leaves:0,doses:2,visits:3};s.local.healerId=teacher.id;
  return s;
}
function assigned(s){
  const a=s.villagers[1];
  a.healerApprentice={mentorId:1,mentorName:s.villagers[0].name,startedDay:0,plantDays:0,remedyDays:0,patientDays:0};
  return a;
}
function preparedStudent(s){
  const a=assigned(s);a.healerApprentice.plantDays=2;a.healerApprentice.patientDays=2;
  a.practice.skills.berries=3;a.practice.careExperience=2;a.practice.properties=['perishable'];
  return a;
}
function graduate(){
  let s=school();
  for(let day=0;day<100&&!healerTrainingComplete(s.villagers.find(v=>v.id===2));day++){
    // Supply repeated nonfatal cases in this controlled teaching fixture.
    Object.assign(s.villagers.find(v=>v.id===3),{illnessDays:3,health:90,fullness:100,warmth:100});
    s=stepDay(s);
  }
  assert.ok(healerTrainingComplete(s.villagers.find(v=>v.id===2)),'actual supervised work must produce a qualified successor');
  return s;
}

test('one experienced healer selects only one younger apprentice without changing homes or traits',()=>{
  const s=school(),extra=structuredClone(s.villagers[1]);extra.id=4;extra.household=4;s.villagers.push(extra);s.nextId=5;
  const original=s.villagers.map(v=>({id:v.id,household:v.household,traits:v.traits}));
  const next=stepDay(s);
  assert.equal(next.villagers.filter(v=>v.herbalist).length,1);
  assert.equal(next.villagers.filter(v=>v.healerApprentice).length,1);
  assert.deepEqual(next.villagers.map(v=>({id:v.id,household:v.household,traits:v.traits})),original);
  assert.equal(next.local.healerHome,undefined);
  assert.ok(next.lastDay.actions.some(a=>a.id===2&&a.mentor===1&&a.healingLesson==='plants'));
});
test('recruitment requires a younger learner with gathering experience and an experienced teacher',()=>{
  for(const missing of ['age','gathering','experience','teacher']){
    const s=school(),student=s.villagers[1];
    if(missing==='age')student.age=145;
    if(missing==='gathering')delete student.practice.known.gathering;
    if(missing==='experience')student.practice.skills.berries=0;
    if(missing==='teacher'){s.villagers[0].herbalist.visits=0;s.villagers[0].practice.used.herbalism=0;}
    assert.equal(stepDay(s).villagers.some(v=>v.healerApprentice),false,missing);
  }
});
test('plant lessons consume real wild plants and do not grant medical knowledge by appointment',()=>{
  const s=school(),next=stepDay(s),student=next.villagers[1];
  assert.equal(student.healerApprentice.plantDays,1);assert.equal(student.practice.skills.berries,2);
  assert.ok(student.practice.properties.includes('perishable'));
  assert.equal(student.practice.known.herbalism,undefined);assert.equal(next.villagers[0].herbalist.leaves,1);
  assert.equal(next.local.deposits.berries,s.local.deposits.berries-1);
});
test('patient experience requires an actual treatment and uses one physical dose',()=>{
  const s=school();assigned(s);s.villagers[2].illnessDays=3;
  const next=stepDay(s),student=next.villagers[1];
  assert.equal(student.healerApprentice.patientDays,1);assert.equal(student.practice.careExperience,1);
  assert.equal(next.villagers[0].herbalist.doses,1);
  assert.equal(next.lastDay.actions.find(a=>a.id===2).healingLesson,'patient');
});
test('guided remedy preparation requires plant and care experience and produces only the paid batch',()=>{
  const s=school();preparedStudent(s);Object.assign(s.villagers[0].herbalist,{leaves:1,doses:0});
  const next=stepDay(s),student=next.villagers[1];
  assert.equal(student.healerApprentice.remedyDays,1);assert.equal(student.practice.known.herbalism,1);
  assert.equal(student.practice.used.herbalism,1);
  assert.equal(next.villagers[0].herbalist.leaves,0);assert.equal(next.villagers[0].herbalist.doses,1);
  assert.equal(next.lastDay.actions.filter(a=>a.id===2).length,1,'a training day cannot also be an ordinary workday');
});
test('watching preparation without the recipe prerequisites does not grant herbalism',()=>{
  const s=school();assigned(s);Object.assign(s.villagers[0].herbalist,{leaves:1,doses:0});
  const next=stepDay(s),student=next.villagers[1];
  assert.equal(student.healerApprentice.remedyDays,0);assert.equal(student.practice.known.herbalism,undefined);
});
test('an absent ingredient causes a gathering day, never a free preparation lesson',()=>{
  const s=school();preparedStudent(s);Object.assign(s.villagers[0].herbalist,{leaves:0,doses:0});
  const next=stepDay(s);
  assert.equal(next.villagers[1].healerApprentice.remedyDays,0);
  assert.equal(next.villagers[0].herbalist.doses,0);assert.equal(next.villagers[0].herbalist.leaves,1);
});
test('a hungry or sick apprentice keeps their place while training pauses for their own needs',()=>{
  for(const condition of ['hunger','illness']){
    const s=school(),student=assigned(s);
    if(condition==='hunger')student.fullness=5;else student.illnessDays=3;
    const next=stepDay(s),a=next.villagers[1].healerApprentice;
    assert.equal(a.plantDays+a.patientDays+a.remedyDays,0);
    assert.equal(next.villagers.filter(v=>v.healerApprentice).length,1);
    assert.equal(next.lastDay.actions.some(a=>a.id===2&&a.healingLesson),false);
  }
});
test('real repeated supervised work qualifies a successor while leaving one practising healer',()=>{
  const s=graduate(),student=s.villagers.find(v=>v.id===2);
  assert.equal(s.villagers.filter(v=>v.herbalist).length,1);assert.equal(student.herbalist,undefined);
  assert.equal(student.healerApprentice.remedyDays,3);assert.ok(student.healerApprentice.readyDay>0);
  findHomesteadHealer(s);assert.equal(s.local.healerId,1);
});
test('a trained adult apprentice takes precedence after the real death of the healer',()=>{
  let s=graduate();const teacher=s.villagers.find(v=>v.id===1),student=s.villagers.find(v=>v.id===2);
  const outsider=s.villagers.find(v=>v.id===3);outsider.illnessDays=0;outsider.practice.known.herbalism=30;
  outsider.practice.skills.berries=30;outsider.practice.curiosity=.99;
  teacher.age=s.config.life.death-1;s=stepDay(s);assert.equal(s.villagers.some(v=>v.id===1),false);
  s=stepDay(s);
  assert.equal(s.local.healerId,2);assert.equal(s.villagers.filter(v=>v.herbalist).length,1);
  const successor=s.villagers.find(v=>v.id===student.id);
  assert.equal(successor.herbalist.trainedBy,teacher.name);assert.equal(successor.healerApprentice,undefined);
  assert.equal(s.local.healerHome,undefined,'succession cannot conjure or transform a house');
});
test('unfinished training survives a mentor dying without automatically qualifying the apprentice',()=>{
  let s=school();const student=assigned(s);student.healerApprentice.plantDays=1;
  s.villagers[0].age=s.config.life.death-1;s=stepDay(s);s=stepDay(s);
  assert.equal(s.villagers.some(v=>v.herbalist),false);
  assert.ok(s.villagers.find(v=>v.id===2).healerApprentice);assert.equal(healerTrainingComplete(s.villagers[0]),false);
});
test('an apprenticeship resumes with a new healer without losing completed work or getting free expertise',()=>{
  const s=school(),student=assigned(s);student.healerApprentice.mentorId=99;student.healerApprentice.mentorName='Former teacher';
  Object.assign(student.healerApprentice,{plantDays:2,patientDays:1,remedyDays:0});
  s.villagers[0].herbalist.doses=2;
  const next=stepDay(s),a=next.villagers[1].healerApprentice;
  assert.equal(a.mentorId,1);assert.equal(a.plantDays,2);assert.equal(a.patientDays,1);assert.equal(a.remedyDays,0);
  assert.equal(next.villagers[1].practice.known.herbalism,undefined);
});
test('training and succession readiness survive save/load without load-time appointment',()=>{
  let s=school();assigned(s);s=stepDay(s);
  const saved=deserialize(serialize(s),rules);
  assert.deepEqual(saved.villagers[1].healerApprentice,s.villagers[1].healerApprentice);
  assert.deepEqual(stepDay(saved),stepDay({...s,lastDay:null,speed:0,elapsedMs:0}));
  const qualified=graduate(),mentorName=qualified.villagers[0].name;
  qualified.villagers=qualified.villagers.filter(v=>v.id!==1);
  const loaded=deserialize(serialize(qualified),rules);
  assert.equal(loaded.villagers.some(v=>v.herbalist),false);
  const next=stepDay(loaded);assert.equal(next.local.healerId,2);assert.equal(next.villagers[0].herbalist.trainedBy,mentorName);
});
test('a successor can teach the next generation and pass on the role again',()=>{
  let s=graduate();s.villagers.find(v=>v.id===1).age=s.config.life.death-1;
  s=stepDay(stepDay(s));assert.equal(s.local.healerId,2);
  const pupil=school().villagers[1];pupil.id=4;pupil.age=12;pupil.household=4;
  s.villagers.push(pupil);s.nextId=5;s.food=100;s.wood=80;
  for(let day=0;day<100&&!healerTrainingComplete(s.villagers.find(v=>v.id===4));day++){
    Object.assign(s.villagers.find(v=>v.id===3),{illnessDays:3,health:90,fullness:100,warmth:100});
    s=stepDay(s);
  }
  const trained=s.villagers.find(v=>v.id===4);assert.ok(healerTrainingComplete(trained));
  assert.ok(trained.age>=s.config.life.adult);assert.equal(trained.healerApprentice.mentorId,2);
  s.villagers.find(v=>v.id===2).age=s.config.life.death-1;s=stepDay(stepDay(s));
  assert.equal(s.local.healerId,4);assert.equal(s.villagers.filter(v=>v.herbalist).length,1);
  assert.equal(s.villagers.find(v=>v.id===4).herbalist.trainedById,2);
});
test('a trained adolescent waits until adulthood to take on the healer role',()=>{
  const s=school(),pupil=preparedStudent(s);pupil.age=19;
  pupil.healerApprentice.remedyDays=3;pupil.practice.known.herbalism=3;
  s.villagers=s.villagers.filter(v=>v.id!==1);
  findHomesteadHealer(s);assert.equal(s.villagers.some(v=>v.herbalist),false);
  pupil.age=20;findHomesteadHealer(s);assert.equal(s.local.healerId,2);assert.ok(pupil.herbalist);
});
