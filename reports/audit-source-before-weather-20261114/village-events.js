// Typed records plus compatibility with the short event strings in older saves.
export function villageEventKind(event){
  if(event.type)return event.type;
  if(/^.+ was born(?: in the eastern village)?\.$/.test(event.text))return 'birth';
  if(/^[^ ]+ died\.$/.test(event.text))return 'death';
  return 'other';
}
function distinctEvents(events){
  const records=new Map();
  for(const [index,event] of events.entries()){
    const kind=villageEventKind(event),name=event.name||event.text.split(kind==='birth'?' was born':' died')[0];
    const key=kind==='birth'||kind==='death'?kind+'|'+event.day+'|'+name:'other|'+index;
    const old=records.get(key);
    records.set(key,{event:old&&old.event.text.length>event.text.length?old.event:event,index});
  }
  return [...records.values()].sort((a,b)=>a.index-b.index).map(r=>r.event);
}
export function preserveBirthHistory(local){
  if(local.birthHistory)return;
  local.birthHistory=distinctEvents((local.events||[]).filter(e=>villageEventKind(e)==='birth'))
    .map(e=>({...e,type:'birth'}));
}
export function observeEvents(local,mode='all'){
  const recent=local.events||[];
  if(mode==='births'||mode==='deaths'||mode==='life'){
    const kind=mode==='births'?'birth':mode==='deaths'?'death':null;
    return distinctEvents([...recent,...(local.birthHistory||[]),...(local.deathHistory||[])])
      .filter(e=>kind?villageEventKind(e)===kind:['birth','death'].includes(villageEventKind(e)))
      .map((event,index)=>({event,index})).sort((a,b)=>b.event.day-a.event.day||b.index-a.index).map(r=>r.event);
  }
  return distinctEvents(recent).filter(e=>mode!=='other'||villageEventKind(e)!=='death').slice(-16).reverse();
}
