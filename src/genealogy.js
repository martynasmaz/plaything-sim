import {createFamilyTreeView} from './family-tree-view.js';
export function rememberPerson(s,v,origin){
  if(!s.local)return;
  const people=(s.local.genealogy??={people:{},recordedFrom:s.day}).people;
  let record=people[v.id];
  if(!record||record.placeholder){
    record=people[v.id]={id:v.id,name:v.name,gender:v.gender,birthDay:s.day-v.age,
      origin:origin||(v.parents?.length?'born':v.arrivalDay!==undefined?'arrival':v.id<=s.config.start.ages.length?'founder':'unknown'),
      parents:[...(v.parents||[])],...(v.arrivalDay!==undefined?{arrivalDay:v.arrivalDay}:{})};
  }
  record.appearance={age:v.age,gender:v.gender??null,tribe:v.tribe||0,furWraps:!!s.furWraps,woolWrap:!!v.practice?.gear['wool wrap']};
  if(v.parents?.length&&!record.parents.length)record.parents=[...v.parents];
  for(const [i,id] of (v.parents||[]).entries())people[id]??={id,name:v.parentNames?.[i]||'Unknown ancestor',parents:[],origin:'unknown',placeholder:true};
  return record;
}
export function initGenealogy(s){
  if(!s.local)return;
  for(const v of s.villagers)rememberPerson(s,v);
  const g=s.local.genealogy;if(!g||g.version===1)return;
  g.version=1;
  for(const e of s.local.birthHistory||[]){
    if(!Number.isInteger(e.id)||!e.name)continue;
    const old=g.people[e.id];
    if(!old||old.placeholder)g.people[e.id]={id:e.id,name:e.name,birthDay:e.day,parents:[],origin:'born',parentNames:e.parentNames||[]};
  }
  const byName=new Map();
  for(const p of Object.values(g.people)){const ids=byName.get(p.name)||[];ids.push(p.id);byName.set(p.name,ids);}
  for(const p of Object.values(g.people))if(!p.parents.length&&p.parentNames?.length){
    for(const name of p.parentNames){
      const ids=byName.get(name),candidate=ids?.length===1?g.people[ids[0]]:null;
      // A later person can reuse an ancestor's name. Names alone cannot make
      // that younger person into a parent in a legacy record.
      if(candidate&&candidate.id!==p.id&&Number.isFinite(candidate.birthDay)&&candidate.birthDay<p.birthDay)p.parents.push(candidate.id);
      else p.ancestryIncomplete=true;
    }
  }
  for(const e of s.local.deathHistory||[]){
    const name=e.name||e.text?.split(' died')[0],ids=e.id!==undefined?[e.id]:byName.get(name);
    if(ids?.length!==1||!g.people[ids[0]])continue;
    const p=g.people[ids[0]];p.deathDay??=e.day;p.causes??=['cause not recorded'];
  }
}
export function recordLifeDay(s,before,report){
  if(!s.local)return;
  for(const v of before)rememberPerson(s,v);
  for(const dead of report.deaths||[]){
    const r=s.local.genealogy.people[dead.id];
    if(r){r.deathDay=s.day;r.causes=[...dead.causes];}
  }
  for(const v of s.villagers)rememberPerson(s,v,v.id===report.birth?'born':undefined);
}
export function familyOf(s,id){
  const people=s.local?.genealogy?.people||{},person=people[id];
  return {person,parents:(person?.parents||[]).map(id=>people[id]).filter(Boolean),
    children:Object.values(people).filter(p=>p.parents.includes(Number(id)))};
}
export function createFamilyTree(host,readState){return createFamilyTreeView(host,readState);}
