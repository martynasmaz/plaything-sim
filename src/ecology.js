import {householdHutSite,builtHutSite} from './settlement-layout.js';
import {SCENARIO} from './scenario.js';
export const landUseRules=SCENARIO.landUse;

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
export function inBuildingPatch(tree,site,kind='hut',margin=0){
  const [rx,ry]=kind==='pen'?[39,28]:kind==='granary'?[38,32]:kind==='field'?[12,9]:kind==='healer'?[34,30]:[26,24];
  return Math.hypot((tree[0]-site[0])/(rx+margin),(tree[1]-site[1])/(ry+margin))<1;
}
export function buildingPatches(s,camps){
  const counts={},patches=[];
  if(s.settlementWork>0)patches.push({site:camps[0],kind:'hut'});
  if(s.shed?.built||s.shed?.project)patches.push({site:s.shed.site||s.shed.project?.site||[827,463],kind:'hut'});
  for(const post of [...(s.local?.outposts||[]),...(s.local?.daughter?[s.local.daughter]:[])])if(post.shelter>0)patches.push({site:post.site,kind:'hut'});
  for(const camp of s.huts||[]){
    const index=counts[camp]??0;counts[camp]=index+1;
    patches.push({site:builtHutSite(s,camps,camp,index),kind:'hut'});
  }
  const project=s.hutProject;
  if(project&&(project.work>0||project.clearingWork>0))patches.push({site:builtHutSite(s,camps,project.camp,project.index??counts[project.camp]??0),kind:'hut'});
  const home=s.local?.healerHome;
  if(home&&(home.work>0||home.clearingWork>0))patches.push({site:home.home,kind:'healer'});
  for(const site of Object.values(s.farming.sites||{}))patches.push({site,kind:'field'});
  for(const quern of s.farming.querns||[])if(quern.site)patches.push({site:quern.site,kind:'field'});
  for(const oven of Object.values(s.local?.ovens||{}))if(oven.work||oven.clearingWork)patches.push({site:oven.site,kind:'hut'});
  if(s.farming.expansion)patches.push({site:s.farming.expansion.site,kind:'field'});
  for(const pen of s.local?.husbandry?.pens||[])if(pen.dismantledDay===undefined&&(pen.work||pen.clearingWork))patches.push({site:pen.site,kind:'pen'});
  for(const store of Object.values(s.local?.campStores||{})){
    for(const site of store.rackSites||[])patches.push({site,kind:'field'});
    if(store.granary&&(store.granary.work||store.granary.clearingWork))patches.push({site:store.granary.site,kind:'granary'});
  }
  return patches.filter(p=>Array.isArray(p.site)&&p.site.length>=2);
}
export function treeKeptClear(s,tree,camps){
  return !!tree&&buildingPatches(s,camps).some(p=>{
    const record=s.local?.landUse?.[landUseKey(p)];
    if(!record?.abandoned)return inBuildingPatch(tree,p.site,p.kind,SCENARIO.landUse.clearance);
    // Scrub can reclaim the working margin first. A standing roof/fixture
    // still occupies its footprint; trees can enter a house after collapse.
    const counts={};
    const collapsed=(s.huts||[]).some((camp,slot)=>{const index=counts[camp]??0;counts[camp]=index+1;
      const point=builtHutSite(s,camps,camp,index);return s.hutDetails?.[slot]?.ruined&&Math.hypot(point[0]-p.site[0],point[1]-p.site[1])<2;});
    return !collapsed&&inBuildingPatch(tree,p.site,p.kind);
  });
}

export const landUseKey=patch=>patch.kind+':'+patch.site.join(',');
// Observe actual occupation, stock use, crops and construction. Merely having
// a historical building object does not mean somebody maintains its clearing.
export function advanceLandUse(s,camps,activityReport=null){
  if(!s.local)return;
  const rules=SCENARIO.landUse,length=s.config.learning.seasonLength,records=s.local.landUse??={};
  const people=camp=>s.villagers.filter(v=>(v.tribe||0)===camp&&!v.herbalist?.home&&!s.local.daughter?.members.includes(v.id));
  const activeHuts=new Set();
  for(let camp=0;camp<camps.length;camp++){
    const occupants=people(camp).filter(v=>v.outdoors!==true).length;
    let places=0;
    for(const [slot,home] of (s.huts||[]).entries())if(home===camp&&!s.hutDetails?.[slot]?.ruined){
      if(places<occupants)activeHuts.add(slot);places+=s.config.settlement.bedsPerHut;
    }
  }
  const huts=(s.huts||[]).map((camp,slot)=>({site:builtHutSite(s,camps,camp,(s.huts||[]).slice(0,slot).filter(c=>c===camp).length),slot}));
  for(const patch of buildingPatches(s,camps)){
    const {site,kind}=patch,key=landUseKey(patch),record=records[key]??={firstObservedDay:s.day,lastUsedDay:s.day,weathering:0};
    const at=point=>point&&Math.hypot(point[0]-site[0],point[1]-site[1])<2;
    const hut=huts.find(h=>at(h.site)),home=s.local.healerHome;
    const storage=Object.entries(s.local.campStores||{}).find(([,store])=>at(store.granary?.site)||(store.rackSites||[]).some(at));
    const post=[...(s.local.outposts||[]),...(s.local.daughter?[s.local.daughter]:[])].find(p=>at(p.site));
    const pen=(s.local.husbandry?.pens||[]).find(p=>p.dismantledDay===undefined&&at(p.site));
    const plot=Object.entries(s.farming.sites||{}).find(([,point])=>at(point));
    const quern=(s.farming.querns||[]).find(q=>at(q.site));
    const oven=Object.values(s.local.ovens||{}).find(p=>at(p.site));
    const projects=[s.hutProject,s.shed?.project,s.farming.expansion,home,pen,storage?.[1]?.granary,oven].filter(Boolean);
    const project=projects.find(p=>at(p.site||p.home));
    const progress=project?JSON.stringify([project.work,project.clearingWork,project.rackWork,project.markerWork,project.shelterWork]):null;
    const progressed=record.progress!==undefined&&progress!==null&&progress!==record.progress;
    record.progress=progress;
    const recent=activityReport||(s.lastDay?.day===s.day-1?s.lastDay:null);
    const actions=(recent?.actions||[]).map(a=>({...a,site:a.site||recent.hutSites?.[a.id]?.site}));
    const working=progressed||actions.some(a=>a.site&&inBuildingPatch(a.site,site,kind)&&/^(Build|Clear|Prepare|Fit|Move|Inspect|Collect|Help|Harvest|Sow|Plant|Grind|Care|Tend|Repair|Rebuild)/.test(a.action));
    const occupied=hut?activeHuts.has(hut.slot):at(home?.home)?s.villagers.some(v=>v.id===home.ownerId&&v.herbalist?.home):
      storage?people(Number(storage[0])).length>0:post?(post.members||[]).some(id=>s.villagers.some(v=>v.id===id)):
      pen?(s.local.husbandry?.animals||[]).some(a=>a.penId===pen.id&&a.location==='village'&&a.status==='alive'):
      plot?s.villagers.length>0&&s.farming.plots[Number(plot[0])]!=null:quern?people(quern.camp||0).some(v=>v.practice?.known.milling):
      oven?people(oven.camp||0).some(v=>v.practice?.known.breadmaking):
      at(camps[0])&&s.settlementWork>0?people(0).length>0:
      s.shed?.built&&at(s.shed.site||[827,463])?people(s.shed.camp??1).length>0:false;
    if(occupied||progressed)record.lastUsedDay=s.day;
    else if(working)record.lastUsedDay=Math.max(record.lastUsedDay,recent.day);
    const idle=s.day-record.lastUsedDay;
    record.abandoned=idle>=rules.abandonedAfterSeasons*length;
    record.weathering=Math.max(record.weathering,idle>=rules.ruinAfterSeasons*length?2:record.abandoned?1:0);
    // A paid repair/improvement can renew a weathered structure. Occupation
    // alone never rebuilds a ruined house or changes its construction record.
    if(progressed||actions.some(a=>a.site&&inBuildingPatch(a.site,site,kind)&&/^(Build|Repair|Rebuild|Fit)/.test(a.action)))record.weathering=0;
    if(hut&&record.weathering>=2){const detail=(s.hutDetails??=[])[hut.slot]??={};
      if(!detail.ruined)(detail.decayHistory??=[]).push(s.day);
      detail.ruined=true;detail.decayedDay??=s.day;
    }
  }
}
