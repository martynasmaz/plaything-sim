import {livestockSummary,livestockKinds,livestockWinterNeed,animalAlive,livestockBuildingRules} from './husbandry.js';

export function createLivestockNotebook(host,readState){
  const section=document.createElement('details'),summary=document.createElement('summary'),overview=document.createElement('p'),pens=document.createElement('div'),label=document.createElement('label'),select=document.createElement('select'),details=document.createElement('p'),parents=document.createElement('div');
  summary.textContent='Livestock & husbandry';label.append('Animal ',select);section.append(summary,overview,pens,label,details,parents);host.append(section);section.hidden=true;
  select.setAttribute('aria-label','Inspect livestock');let listKey='';
  function draw(){
    const s=readState(),h=s.local?.husbandry,data=livestockSummary(s);section.hidden=!data||!data.contact&&!data.pens.length;
    if(section.hidden||!section.open)return;
    const all=h.animals.filter(a=>a.location==='village'),living=all.filter(animalAlive),year=4*s.config.learning.seasonLength;
    summary.textContent='Livestock · '+living.length+' alive';
    overview.textContent=Object.keys(livestockKinds).map(k=>livestockKinds[k].label+': '+living.filter(a=>a.species===k).length).join(' · ')+
      '. Hay: '+Math.floor(data.hay)+' stored + '+data.hayDrying+' drying; estimated full-winter hay need '+data.winterNeed+'. Pigs need woodland forage or reserved fodder grain; hay cannot feed them.'+
      ' Births: '+data.stats.births+' · acquired through exchange: '+data.stats.traded+' · slaughtered: '+data.stats.slaughtered+' · other deaths: '+(data.stats.deaths-data.stats.slaughtered)+' · escaped: '+data.stats.escaped+'.';
    pens.replaceChildren(...data.pens.map(p=>{
      const row=document.createElement('p'),keeper=s.villagers.find(v=>v.id===p.keeperId),owner=s.villagers.find(v=>v.id===p.ownerId);
      row.textContent='Camp '+(p.camp+1)+' · enclosure '+p.work+'/'+livestockBuildingRules.enclosure.work+' · shelter '+p.shelterWork+'/'+livestockBuildingRules.shelter.work+' · '+(owner?'Household of '+owner.name:'Awaiting a successor')+
        ' · keeper '+(keeper?.name||'needed')+' · winter hay estimate '+livestockWinterNeed(s,p)+' · grazing '+Math.floor(p.grass)+' · woodland forage '+Math.floor(p.mast)+
        ' · manure in pen '+Math.floor(p.dung)+'.'+(p.careDay<s.day-1?' Animals need care.':'');return row;
    }));
    if(h.journey){const row=document.createElement('p');row.textContent=(s.villagers.find(v=>v.id===h.journey.travelerId)?.name||'A villager')+' is visiting distant herders'+(h.journey.species?' to exchange for '+livestockKinds[h.journey.species].label.toLowerCase():'')+'.';pens.append(row);}
    const nextKey=s.seed+'/'+all.map(a=>a.id+':'+a.status).join(',');
    if(nextKey!==listKey){listKey=nextKey;const old=select.value;select.replaceChildren(...all.map(a=>new Option(a.name+(animalAlive(a)?'':' · '+a.status),a.id)));if(all.some(a=>String(a.id)===old))select.value=old;}
    const a=all.find(a=>a.id===Number(select.value));label.hidden=!all.length;
    parents.replaceChildren();
    if(!a){details.textContent='No animals acquired yet. Villagers need personal husbandry knowledge, a completed enclosure, winter feed and a paid exchange with the distant household.';return;}
    const owner=s.villagers.find(v=>v.id===a.ownerId),keeper=s.villagers.find(v=>v.id===a.keeperId);
    details.textContent=a.name+' · '+a.sex+' · '+(a.age/year).toFixed(1)+' game years · '+(animalAlive(a)?'health '+Math.round(a.health)+'/100 · condition '+Math.round(a.condition)+'/100':a.deathCause+' on day '+a.deathDay)+
      ' · '+(a.origin==='born'?'born on day '+a.bornDay:'acquired on day '+a.acquiredDay)+' · owner '+(owner?.name||'no living owner')+' · caretaker '+(keeper?.name||'needed')+'.'+
      (a.lastFed!==undefined?' Last feed: '+Math.round(a.lastFed*100)+'% of ration.':'')+(a.pregnancy?' Young expected around day '+a.pregnancy.due+'.':'')+
      (a.lactatingUntil>=s.day?' Lactating until day '+a.lactatingUntil+'; nursing young receive their share first.':'')+
      (a.sickDays>0?' Ill for up to '+a.sickDays+' more days.':'')+(a.yoked?' Trained to a wooden yoke.':'');
    for(const [label,id] of [['Mother',a.motherId],['Father',a.fatherId]]){
      const parent=h.animals.find(p=>p.id===id),row=document.createElement('p');row.textContent=label+': ';
      if(parent&&all.includes(parent)){const button=document.createElement('button');button.textContent=parent.name;button.onclick=()=>{select.value=String(id);draw();};row.append(button);}
      else row.append(parent?parent.name+' (regional herd)':'Unknown founding ancestry');parents.append(row);
    }
    const children=all.filter(p=>p.motherId===a.id||p.fatherId===a.id);
    if(children.length){const row=document.createElement('p');row.textContent='Offspring: ';for(const child of children){const button=document.createElement('button');button.textContent=child.name;button.onclick=()=>{select.value=String(child.id);draw();};row.append(button,' ');}parents.append(row);}
  }
  select.onchange=draw;section.ontoggle=draw;return {draw};
}
