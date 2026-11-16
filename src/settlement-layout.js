// Shared physical house positions; drawing proportions and standing places do
// not change shelter capacity, materials, or the simulation's dice.
export const shelterDrawingScale=1.75;
export function householdHutSite(camp,index){
  const [x,y]=camp,angle=2.4*index,radius=62+16*Math.sqrt(index);
  return [Math.max(30,Math.min(965,x-radius*Math.cos(angle))),Math.max(60,Math.min(594,y-32+radius*.55*Math.sin(angle)))];
}
export function builtHutSite(s,camps,camp,index){
  const slot=(s.huts||[]).map((c,i)=>c===camp?i:-1).filter(i=>i>=0)[index];
  if(slot!==undefined)return s.hutDetails?.[slot]?.site||householdHutSite(camps[camp],index);
  if(s.hutProject?.camp===camp&&(s.hutProject.index??index)===index)return s.hutProject.site||householdHutSite(camps[camp],index);
  return householdHutSite(camps[camp],index);
}
export function householdHutSlot(s,v){
  const camp=v.tribe||0,beds=s.config.settlement.bedsPerHut;
  const residents=s.villagers.filter(p=>!p.herbalist?.home&&(p.tribe||0)===camp&&!p.outdoors)
    .sort((a,b)=>(a.household??a.id)-(b.household??b.id)||a.id-b.id);
  const slots=(s.huts||[]).map((c,i)=>c===camp&&!s.hutDetails?.[i]?.ruined?i:-1).filter(i=>i>=0);
  const assigned=new Map(),used=new Map();
  const put=(p,slot)=>{assigned.set(p.id,slot);used.set(slot,(used.get(slot)||0)+1);};
  for(const p of residents)if(slots.includes(p.homeHut)&&(used.get(p.homeHut)||0)<beds)put(p,p.homeHut);
  for(const p of residents)if(!assigned.has(p.id)){
    const slot=slots.find(i=>(used.get(i)||0)<beds);if(slot!==undefined)put(p,slot);
  }
  return assigned.get(v.id)??-1;
}
// A finished home can draw a household into the neighbouring bonfire's camp.
// This transfers residents, never copies food or creates extra sleeping places.
export function settleBuiltHouse(s,slot,founder){
  if(!founder)return;
  const origin=founder.tribe||0,camp=s.huts[slot];
  const family=s.villagers.filter(p=>(p.tribe||0)===origin&&!p.herbalist?.home&&!p.campJourney&&
    !s.local?.daughter?.members.includes(p.id)&&(p.id===founder.id||founder.household!==undefined&&p.household===founder.household))
    .sort((a,b)=>Number(b.id===founder.id)-Number(a.id===founder.id)||a.age-b.age||a.id-b.id);
  for(const [i,p] of family.entries()){
    p.tribe=camp;
    if(i<s.config.settlement.bedsPerHut){p.homeHut=slot;p.outdoors=false;}
    else if(camp!==origin)delete p.homeHut;
  }
  s.hutDetails[slot].founder=founder.id;
}
export function compactWorkSpot(anchor,occupied,id=0,accept=()=>true){
  let best=anchor,bestRoom=-1;
  for(let i=0;i<90;i++){
    const r=Math.min(48,8*Math.sqrt(i)),angle=i*2.399963+id*.07;
    const point=[anchor[0]+Math.cos(angle)*r,anchor[1]+Math.sin(angle)*r*.85];
    if(!accept(point))continue;
    const room=occupied.reduce((gap,p)=>Math.min(gap,Math.hypot((point[0]-p[0])/22,(point[1]-p[1])/28)),Infinity);
    if(room>=1)return point;
    if(room>bestRoom){best=point;bestRoom=room;}
  }
  return best;
}
