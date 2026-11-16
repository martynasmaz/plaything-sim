// A camp is anchored by a persistent bonfire site, not by whether its flame
// happens to be burning today. Rendering and house ownership share this map.
export const defaultCampHearthSite=(camps,camp)=>[camps[camp][0]+54,camps[camp][1]-14];
export function campHearths(s,camps){
  const found=new Map(Object.entries(s.local?.campHearths||{}).map(([id,h])=>[Number(id),{camp:Number(id),site:h.site}]));
  if(s.fireKnown&&!found.has(0))found.set(0,{camp:0,site:defaultCampHearthSite(camps,0)});
  for(const [id,lit] of Object.entries(s.campFires||{}))if(lit&&camps[id]&&!found.has(Number(id)))found.set(Number(id),{camp:Number(id),site:defaultCampHearthSite(camps,Number(id))});
  return [...found.values()].sort((a,b)=>a.camp-b.camp);
}
export function rememberCampHearth(s,camps,camp){
  if(!s.local||!camps[camp])return;
  const hearths=s.local.campHearths??={};
  hearths[camp]??={site:defaultCampHearthSite(camps,camp),establishedDay:s.day};
}
export function initCampHearths(s,camps){
  if(!s.local)return;
  if(!s.local.hearthRegistryVersion){
    // Old saves stored both burning and extinguished campfire markers here.
    for(const id of Object.keys(s.campFires||{}))if(camps[id]&&Number(id)>0)rememberCampHearth(s,camps,Number(id));
    s.local.hearthRegistryVersion=1;
  }
  // New sites are recorded by the paid fire-tending action. Merely loading a
  // world must not give an existing flame a different establishment date.
}
export function nearestHearthCamp(s,camps,site,fallback=0){
  let owner=fallback,distance=Infinity;
  for(const hearth of campHearths(s,camps)){
    const d=Math.hypot(site[0]-hearth.site[0],site[1]-hearth.site[1]);
    if(d<distance){distance=d;owner=hearth.camp;}
  }
  return owner; // Before the first bonfire, retain the provisional household.
}
