// A sheltered rock face is infrastructure, not a building conjured by a job.
export const paintingSite=[1140,175];
export function paintingReady(s,v){
  const p=v.practice;
  return (s.local.reaches||0)>0&&s.toolkit?.includes('hammer stone')&&
    (p.skills.stone||0)>=2&&((p.skills.hide||0)>=3||(p.skills.fish||0)>=3||(p.farmingDays||0)>=3);
}
export const paintingRecipe=['cavepainting','Rock paintings','stone','fractures',['knapping','charcoal'],
  {charcoal:1,resin:1},'rock painting',(s,v)=>paintingReady(s,v)&&(s.local.paintings?.length||0)<8];
export function paintMemory(s,v){
  const p=v.practice,topic=p.used.breadmaking?'breadmaking':p.used.milling?'milling':p.known.wheatgrowing?'wheatgrowing':
    p.used.fishtraps?'fishtraps':p.used.drying?'drying':p.known.knapping?'knapping':null;
  const paintings=s.local.paintings??=[];
  if(!topic||paintings.some(q=>q.author===v.id&&q.topic===topic))return false;
  paintings.push({id:paintings.length+1,author:v.id,authorName:v.name,day:s.day,site:[...paintingSite],
    topic,motif:topic.includes('bread')?'grain, grinding stone and a hearth':topic==='milling'?'hands grinding seed':
      topic==='wheatgrowing'?'seed heads beside planted rows':topic==='fishtraps'?'fish entering a wicker trap':topic==='drying'?'game hanging above smoke':'a deer beside chipped stone',
    discoveredDay:s.day,readBy:[v.id]});
  return true;
}
export function discoverPainting(s,v,recipes){
  const q=s.local.paintings?.find(p=>!p.readBy.includes(v.id));
  if(!q)return null;
  q.readBy.push(v.id);q.discoveredDay??=s.day;
  const p=v.practice,r=recipes[q.topic];
  // A picture is a clue, never a complete recipe or a free product. Practical
  // experimentation must still pass all material and infrastructure gates.
  if(r&&!p.known[r.id]&&r.requires.every(id=>p.known[id])&&p.properties.includes(r.property))
    p.progress[r.id]=Math.min(r.work-.01,(p.progress[r.id]||0)+.35);
  return q;
}
