// Physical NPC project records. The renderer never creates or advances them.
import {householdHutSite} from './settlement-layout.js';
export const healerBuildingRules={hutWork:6,rackWork:2,markerWork:2};
export const healerTrainingRules={minAge:12,ageGap:10,plantDays:2,remedyDays:3,patientDays:2};
export function healerTrainingComplete(v){
  const a=v.healerApprentice,p=v.practice,r=healerTrainingRules;
  return !!a&&a.plantDays>=r.plantDays&&a.remedyDays>=r.remedyDays&&a.patientDays>=r.patientDays&&
    !!p?.known.herbalism&&(p.skills.berries||0)>=3&&(p.careExperience||0)>=2;
}
export function healerSite(camp){return [camp[0]-84,camp[1]-52];}
export function healerNeighbors(s,camps,future=false){
  return camps.flatMap((camp,id)=>{
    const count=(s.huts||[]).filter(c=>c===id).length;
    return [camp,...Array.from({length:future?Math.max(8,count+2):count},(_,i)=>householdHutSite(camp,i))];
  });
}
export function crowdedHealerSite(site,neighbors){
  return neighbors.some(([x,y])=>Math.hypot((site[0]-x)/110,(site[1]-y)/85)<1);
}
export function chooseQuietHealerSite(camp,neighbors,trees){
  const candidates=[];
  const riverY=x=>640*(.51+.078*Math.sin(x*.007+.4)+.037*Math.sin(x*.013));
  const tributaryX=y=>1000*(.54+.055*Math.sin(y/64+1)-.24*y/640);
  for(const radius of [180,195,210])for(let i=0;i<36;i++){
    const a=i*Math.PI/18,site=[camp[0]+radius*Math.cos(a),camp[1]+radius*Math.sin(a)];
    const [x,y]=site;
    if(x<60||x>935||y<85||y>570||Math.abs(y-riverY(x))<90||
      (y-riverY(x))*(camp[1]-riverY(camp[0]))<0||
      y<riverY(x)&&(Math.abs(x-tributaryX(y))<70||(x-tributaryX(y))*(camp[0]-tributaryX(camp[1]))<0)||
      crowdedHealerSite(site,neighbors))continue;
    const forest=trees.filter(([tx,ty])=>Math.hypot(tx-x,ty-y)<85).length;
    const dense=trees.filter(([tx,ty])=>Math.hypot(tx-x,ty-y)<28).length;
    candidates.push({site,score:forest-dense*2-radius*.025});
  }
  candidates.sort((a,b)=>b.score-a.score);
  return candidates[0]?.site.map(Math.round)??null;
}
export function healerHomeView(s,foundingCamp){
  const home=s.local?.healerHome;
  if(!home||!Number.isFinite(home.work))return null;
  const owner=s.villagers.find(v=>v.id===home.ownerId&&v.herbalist);
  return {...home,resident:owner?.herbalist.home?owner:null,builder:owner,
    habitable:home.work>=healerBuildingRules.hutWork,
    rackBuilt:(home.rackWork||0)>=healerBuildingRules.rackWork,
    markerBuilt:(home.markerWork||0)>=healerBuildingRules.markerWork};
}
export function healerMedicineStore(s,v){
  const home=s.local?.healerHome;
  return v.herbalist?.home&&home?.ownerId===v.id&&home.work>=3?home.stock:v.herbalist;
}
export function rememberHealerHome(s,foundingCamp){
  if(!s.local)return;
  if(s.local.healerBuildingVersion===1)return;
  s.local.healerBuildingVersion=1;
  const saved=s.local.healerHome;
  if(saved&&Number.isFinite(saved.work))return;
  const oldHealer=s.villagers.find(v=>v.herbalist?.home);
  const oldId=s.local.healerId;
  const evidence=oldHealer||saved?.home||Number.isInteger(oldId)&&oldId>0&&oldId<s.nextId;
  if(!evidence||s.villagers.some(v=>v.herbalist&&!v.herbalist.home))return;
  // Preserve the basic lean-to already described in an old world, not the
  // decorative full hut, rack and sign previously drawn without construction.
  s.local.healerHome={home:[...(saved?.home||oldHealer?.herbalist.home||healerSite(foundingCamp))],
    ownerId:oldHealer?.id??null,founderId:saved?.founderId??oldHealer?.id??oldId,
    founderName:saved?.founderName??oldHealer?.name??null,
    work:3,rackWork:0,markerWork:0,legacy:true,stock:{leaves:0,doses:0},spent:{}};
  if(oldHealer){
    s.local.healerHome.stock.leaves=oldHealer.herbalist.leaves||0;
    s.local.healerHome.stock.doses=oldHealer.herbalist.doses||0;
    oldHealer.herbalist.leaves=0;oldHealer.herbalist.doses=0;
    oldHealer.practice.known.herbalism??=1;
  }
}
