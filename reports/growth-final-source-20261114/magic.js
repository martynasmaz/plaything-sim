import {assessNeeds} from './needs.js';

// Optional folk magic. Absence of the god's explicit unlock is always inert.
export const magicPracticeIds=['bonecasting','foretelling','hearthcharms','mendingrites','storewards'];
export const magicActions={foretelling:'Cast the divining bones',hearthcharms:'Whisper a hearth charm',
  mendingrites:'Perform a mending rite',storewards:'Bind a store ward'};
export const magicEnabled=s=>s.local?.magic?.enabled===true;
export function magicDependencies(s,product){
  if(!magicEnabled(s))return false;
  if(product==='casting bones')return s.fireKnown;
  if(product==='weather omen')return s.fireLit&&s.villagers.some(v=>v.practice?.gear['casting bones']);
  if(product==='hearth charm')return s.fireKnown;
  if(product==='mending rite')return s.villagers.some(v=>v.practice?.known.herbalism);
  if(product==='store ward')return s.local.dried>0;
  return false;
}
const fireAt=(s,camp)=>camp===0?s.fireLit:!!s.campFires?.[camp];
const active=(effect,day)=>effect&&effect.until>=day;
function ritualPatient(s,v){
  return s.villagers.filter(p=>p!==v&&(p.tribe||0)===(v.tribe||0)&&
    (p.illnessDays>0||p.health<65)&&s.day-(p.magicMendedDay??-100)>=6)
    .sort((a,b)=>a.health-b.health||a.id-b.id)[0];
}
export function magicPrerequisites(s,v,id){
  if(!magicEnabled(s))return false;
  const p=v.practice,camp=v.tribe||0,m=s.local.magic;
  if(id==='bonecasting')return magicDependencies(s,'casting bones')&&(p.skills.stone||0)>=2;
  if(id==='foretelling')return magicDependencies(s,'weather omen')&&!!p.gear['casting bones']&&
    (p.outdoorDays||0)>=3&&s.day-(p.lastDivinedDay??-100)>=6&&s.day-(m.lastReadings?.[camp]??-100)>=6;
  if(id==='hearthcharms')return magicDependencies(s,'hearth charm')&&fireAt(s,camp)&&(p.skills.wood||0)>=4&&
    !active(m.hearths?.[camp],s.day)&&s.villagers.some(person=>(person.tribe||0)===camp&&person.warmth<65);
  if(id==='mendingrites')return magicDependencies(s,'mending rite')&&(p.skills.berries||0)>=4&&
    (p.careExperience||0)>=3&&((p.used.herbalism||0)>=1||(v.herbalist?.visits||0)>=1)&&!!ritualPatient(s,v);
  if(id==='storewards')return magicDependencies(s,'store ward')&&s.fireLit&&(p.used.drying||0)>=2&&
    !active(m.pantry,s.day)&&s.food>=s.villagers.length*2;
  return false;
}
export const magicRecipes=[
  // A marked set of natural bone fragments needs no drilled holes or woven bag.
  ['bonecasting','Casting bones','stone','fractures',['crude tools'],{bone:1,charcoal:1},'casting bones',
    (s,v)=>magicPrerequisites(s,v,'bonecasting')],
  ['foretelling','Reading omens','stone','fractures',['bonecasting'],{herbs:1,charcoal:1},'weather omen',
    (s,v)=>magicPrerequisites(s,v,'foretelling')],
  ['hearthcharms','Hearth charms','wood','rigid',['fire tending','cordage'],{wood:1,fibre:1,resin:1},'hearth charm',
    (s,v)=>magicPrerequisites(s,v,'hearthcharms')],
  ['mendingrites','Mending rites','berries','perishable',['herbalism'],{herbs:1,resin:1},'mending rite',
    (s,v)=>magicPrerequisites(s,v,'mendingrites')],
  ['storewards','Store wards','berries','perishable',['drying','cordage'],{fibre:1,resin:1,charcoal:1},'store ward',
    (s,v)=>magicPrerequisites(s,v,'storewards')]
];
const magicEvent=(s,text)=>{
  s.local.events.push({day:s.day,text});if(s.local.events.length>100)s.local.events.shift();
};
export function awakenMagic(s){
  if(magicEnabled(s))return false;
  s.local.magic={enabled:true,enabledDay:s.day,casts:0,hearths:{},omens:[],pending:[]};
  magicEvent(s,'The god spoke “magic”. Omens, charms and old rites can now carry real power.');
  return true;
}
export function planRitual(s,v,id){
  const p=v.practice,c=s.config;
  if(!magicActions[id]||!magicPrerequisites(s,v,id)||v.age<c.life.adult||v.illnessDays||
    assessNeeds(s,v).level<3||v.fullness<50||v.warmth<45||v.health<60||
    p.energy<Math.max(40,c.learning.workCost*2+22)||
    s.local.daughter?.members.includes(v.id)||s.local.fieldCamp?.members.includes(v.id))return null;
  if(id==='hearthcharms'&&s.wood<c.settlement.fuelReserve+(s.tribeCount||1)*c.fire.dailyFuel+1)return null;
  return {id:v.id,spell:id,camp:v.tribe||0,day:s.day,
    ...(id==='mendingrites'?{targetId:ritualPatient(s,v).id}:{})};
}
export function performRitual(s,v,plan,report){
  // Reagents are paid by the shared practice recipe before this is called.
  const m=s.local.magic,p=v.practice;
  p.energy=Math.max(0,p.energy-s.config.learning.workCost); // a rite costs two ordinary work efforts
  p.lastMagicDay=s.day;p.lastRitual=plan.spell;m.casts++;
  if(plan.spell==='foretelling'){
    p.lastDivinedDay=s.day;
    (m.lastReadings??={})[plan.camp]=s.day;
    (m.pending??=[]).push({casterId:v.id,casterName:v.name,camp:plan.camp,day:s.day});
  }else if(plan.spell==='hearthcharms'){
    (m.hearths??={})[plan.camp]={until:s.day+2,casterId:v.id};
    for(const person of s.villagers)if((person.tribe||0)===plan.camp&&!person.herbalist?.home)
      person.warmth=Math.min(s.config.limits.need,person.warmth+6);
  }else if(plan.spell==='mendingrites'){
    const patient=s.villagers.find(person=>person.id===plan.targetId);
    patient.health=Math.min(s.config.limits.need,patient.health+6);patient.illnessDays=Math.max(0,patient.illnessDays-1);
    patient.magicMendedDay=s.day;patient.lastCompanyDay=v.lastCompanyDay=s.day;
  }else if(plan.spell==='storewards')m.pantry={until:s.day+3,casterId:v.id};
  if(report)(report.magic??=[]).push(plan);
  magicEvent(s,v.name+' performed '+({foretelling:'a casting of the divining bones',hearthcharms:'a hearth charm',
    mendingrites:'a mending rite for '+s.villagers.find(person=>person.id===plan.targetId)?.name,storewards:'a ward over the food stores'})[plan.spell]+'.');
}
export function magicSpoilageFactor(s){return magicEnabled(s)&&active(s.local.magic.pantry,s.day)?0.5:1;}
export function beginMagicDay(s){
  if(!magicEnabled(s))return;
  const m=s.local.magic;
  for(const [camp,ward] of Object.entries(m.hearths||{})){
    if(!active(ward,s.day)){delete m.hearths[camp];continue;}
    if(fireAt(s,Number(camp)))for(const v of s.villagers)
      if((v.tribe||0)===Number(camp)&&!v.herbalist?.home)v.warmth=Math.min(s.config.limits.need,v.warmth+6);
  }
}
export function finishDivinations(s,weather){
  if(!magicEnabled(s)||!s.local.magic.pending?.length)return;
  const m=s.local.magic,people=[...s.villagers].sort((a,b)=>a.id-b.id);
  const target=s.natural.illness?people[Math.floor(s.natural.target*people.length/4294967296)]:null;
  for(const reading of m.pending){
    const personal=target&&!target.illnessDays?' Sickness threatens '+target.name+'.':' No new sickness is foretold.';
    const omen={...reading,forDay:s.day+1,weather,illnessTarget:target&&!target.illnessDays?target.id:null,
      text:reading.casterName+' foresees '+({normal:'fair weather',cold:'a cold snap',rain:'rain',drought:'a dry spell'})[weather]+' at the next dawn.'+personal+' The god can still change this course.'};
    (m.omens??=[]).push(omen);if(m.omens.length>20)m.omens.shift();magicEvent(s,omen.text);
  }
  m.pending=[];
}
export function coldOmen(s,v){
  return magicEnabled(s)&&s.local.magic.omens?.some(o=>o.camp===(v.tribe||0)&&
    (o.forDay===s.day||o.forDay===s.day+1)&&o.day>=s.day-1&&o.weather==='cold');
}
