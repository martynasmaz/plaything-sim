import {householdHutSite} from './settlement-layout.js';

export function riverHabitat(x,y){
  const mainY=640*(.51+.078*Math.sin(x*.007+.4)+.037*Math.sin(x*.013));
  const neris=1000*(.54+.055*Math.sin(y/64+1)-.24*y/640);
  const mainDistance=Math.abs(y-mainY),tributaryDistance=y<mainY?Math.abs(x-neris):Infinity;
  return {mainY,mainDistance,tributaryDistance,water:mainDistance<30||tributaryDistance<23,
    wet:mainDistance<72||tributaryDistance<60};
}
function habitatNoise(seed,x,y){
  let h=Math.imul((seed^Math.imul(x+1931,374761393)^Math.imul(y+719,668265263)),1274126177);
  return ((h^(h>>>16))>>>0)/4294967296;
}
export function supplementaryWoodland(seed,camps){
  const trees=[],infill=[],homes=camps.flatMap(c=>Array.from({length:8},(_,i)=>householdHutSite(c,i)));
  for(let row=0;row<72;row++)for(let col=0;col<115;col++){
    const n=habitatNoise(seed,col,row),x=-970+col*26+(n-.5)*16;
    const y=-610+row*26+(habitatNoise(seed+17,col,row)-.5)*16,h=riverHabitat(x,y);
    if(h.water||camps.some(([cx,cy])=>Math.hypot(x-cx,y-cy)<54)||
      Math.hypot((x-680)/72,(y-535)/39)<1||Math.hypot((x-310)/34,(y-168)/28)<1)continue;
    const mosaic=.46+.19*Math.sin(x*.009+seed*.17)*Math.cos(y*.012-1)+.12*Math.sin((x+y)*.024);
    if(n>mosaic+(h.wet?0.08:0))continue;
    const pick=habitatNoise(seed+41,col,row);
    const species=h.wet?(pick<.45?'alder':'willow'):pick<.24?'pine':pick<.45?'birch':'broadleaf';
    // Append trees in formerly reserved house plots after the existing forest,
    // preserving every saved tree ID. New houses must make their own room.
    const list=homes.some(([cx,cy])=>Math.hypot((x-cx)/31,(y-cy)/32)<1)?infill:trees;
    list.push([x,y,.55+habitatNoise(seed+79,col,row)*.77,species]);
  }
  return trees.concat(infill);
}
export function woodlandSpecies(tree,id=0){
  if(tree[3])return tree[3];
  const h=riverHabitat(tree[0],tree[1]);
  return h.wet?(id%2?'willow':'alder'):id%6===0?'pine':id%5===0?'birch':'broadleaf';
}
// Only the house footprint and a little working space, in map coordinates.
// Trees beyond this patch remain, even if their canopy overhangs the roof.
export function inBuildingPatch(tree,site,kind='hut'){
  const [rx,ry]=kind==='healer'?[34,30]:[26,24];
  return Math.hypot((tree[0]-site[0])/rx,(tree[1]-site[1])/ry)<1;
}
export function buildingPatches(s,camps){
  const counts={},patches=[];
  for(const camp of s.huts||[]){
    const index=counts[camp]??0;counts[camp]=index+1;
    patches.push({site:householdHutSite(camps[camp],index),kind:'hut'});
  }
  const project=s.hutProject;
  if(project&&(project.work>0||project.clearingWork>0))patches.push({site:householdHutSite(camps[project.camp],project.index??counts[project.camp]??0),kind:'hut'});
  const home=s.local?.healerHome;
  if(home&&(home.work>0||home.clearingWork>0))patches.push({site:home.home,kind:'healer'});
  return patches;
}
export function treeKeptClear(s,tree,camps){
  return !!tree&&buildingPatches(s,camps).some(p=>inBuildingPatch(tree,p.site,p.kind));
}
