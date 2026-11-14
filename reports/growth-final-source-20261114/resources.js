// Discovery persists after the last piece is consumed. Deposits being present
// on the map do not mean anyone has identified their use yet.
export function rememberResources(s){
  if(!s.local)return;
  const seen=s.local.discoveredResources??={food:true,wood:true};
  for(const [key,n] of Object.entries(s.local.stock||{}))if(n>0)seen[key]=true;
  for(const v of s.villagers){
    for(const [key,n] of Object.entries(v.practice?.skills||{}))if(n>0)seen[key]=true;
  }
  if(s.farming.wheatHarvests||s.villagers.some(v=>v.practice?.known.wheatgrowing))seen.wheat=true;
  if(s.farming.milled)seen.flour=true;
  if(s.farming.querns?.length)seen.quernStone=true;
  return seen;
}
export function visibleResources(s,amounts){
  const seen=s.local?.discoveredResources||{food:true,wood:true};
  return Object.fromEntries(Object.entries(amounts).filter(([key,n])=>seen[key]||n>0&&amounts===s.local?.stock));
}
