export function rememberPerson(s,v,origin){
  if(!s.local)return;
  const people=(s.local.genealogy??={people:{},recordedFrom:s.day}).people;
  let record=people[v.id];
  if(!record||record.placeholder){
    record=people[v.id]={id:v.id,name:v.name,gender:v.gender,birthDay:s.day-v.age,
      origin:origin||(v.parents?.length?'born':v.arrivalDay!==undefined?'arrival':v.id<=s.config.start.ages.length?'founder':'unknown'),
      parents:[...(v.parents||[])],...(v.arrivalDay!==undefined?{arrivalDay:v.arrivalDay}:{})};
  }
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
export function createFamilyTree(host,readState){
  const details=document.createElement('details');details.innerHTML='<summary><strong>Family tree</strong></summary><label>Person <select data-family-person></select></label><p data-life></p><div data-family></div><small>Each parent link opens that person’s family. Unknown ancestry in older saves remains unknown.</small>';
  host.append(details);
  const select=details.querySelector('select'),life=details.querySelector('[data-life]'),tree=details.querySelector('[data-family]');
  function draw(){
    if(!details.open)return;
    const s=readState(),people=Object.values(s.local?.genealogy?.people||{}),old=select.value;
    select.replaceChildren(...people.map(p=>new Option(p.name+(p.deathDay!==undefined?' †':''),p.id)));
    if(people.some(p=>String(p.id)===old))select.value=old;
    const id=Number(select.value),{person,parents,children}=familyOf(s,id);
    if(!person){life.textContent='No family records yet.';tree.replaceChildren();return;}
    life.textContent=person.name+' · '+({founder:'founding villager',arrival:'arriving settler',born:'born in the valley',unknown:'earlier life unknown'})[person.origin]+
      (person.arrivalDay!==undefined?' · arrived day '+person.arrivalDay:'')+
      (person.placeholder?'': ' · born '+(person.birthDay<0?-person.birthDay+' days before the founding':'day '+person.birthDay))+
      (person.deathDay!==undefined?' · died day '+person.deathDay+' ('+person.causes.join(', ')+')':'')+(person.ancestryIncomplete?' · some earlier parent links are missing':'');
    tree.replaceChildren();
    for(const [title,members] of [['Parents',parents],['Children',children]]){
      const row=document.createElement('p');row.textContent=title+': ';
      if(!members.length)row.append(title==='Parents'?(person.origin==='founder'||person.origin==='arrival'?'outside the recorded village':'unknown'):'none recorded');
      for(const relative of members){const button=document.createElement('button');button.textContent=relative.name;button.style.margin='3px';button.onclick=()=>{select.value=String(relative.id);draw();};row.append(button);}
      tree.append(row);
    }
  }
  details.ontoggle=draw;select.onchange=draw;
  return {draw};
}
