import {builtHutSite,householdHutSite} from './settlement-layout.js';
import {riverHabitat} from './ecology.js';
import {quernSite} from './farming.js';
import {campHearths} from './camp-hearths.js';

// Centres are separated by a house footprint plus a modest working gap.
// A completed home extends the search; hypothetical future houses do not.
export const housingSiteRules={spacingX:64,spacingY:50,radii:[68,88,112,140],mapStep:16};
const houseSiteCache=new Map();
const near=(a,b,rx,ry)=>Math.hypot((a[0]-b[0])/rx,(a[1]-b[1])/ry)<1;
export function housingSiteOnLand(p){
  if(p[0]<40||p[0]>960||p[1]<65||p[1]>590)return false;
  // A house needs solid ground beneath its footprint, not a river exclusion
  // region or a dry straight-line connection to the original camp.
  for(let i=0;i<9;i++){
    const angle=i*Math.PI/4,x=p[0]+(i===8?0:26*Math.cos(angle)),y=p[1]+(i===8?0:24*Math.sin(angle));
    if(riverHabitat(x,y).water)return false;
  }
  return true;
}

export function housingSiteContext(s,camps,camp){
  const home=camps[camp],anchors=[home],occupied=[],counts={};
  const add=(site,rx,ry)=>{if(site)occupied.push({site,rx,ry});};
  const active=new Set(s.villagers.filter(v=>!s.local?.daughter?.members.includes(v.id)).map(v=>v.tribe||0));
  camps.forEach((point,id)=>{if(active.has(id)||id===0&&s.settlementWork>0)add(point,62,48);});
  (s.huts||[]).forEach((id,slot)=>{
    const index=counts[id]||0;counts[id]=index+1;
    const point=builtHutSite(s,camps,id,index),hut=s.hutDetails?.[slot];
    add(point,housingSiteRules.spacingX,housingSiteRules.spacingY);
    if(id===camp&&!hut?.ruined&&!s.local?.landUse?.['hut:'+point.join(',')]?.abandoned&&housingSiteOnLand(point))anchors.push(point);
  });
  if(s.shed?.built||s.shed?.project)add(s.shed.site||s.shed.project?.site||[827,463],82,68);
  if(s.local?.healerHome)add(s.local.healerHome.home,90,78);
  for(const p of s.local?.husbandry?.pens||[])if(p.dismantledDay===undefined)add(p.site,88,72);
  for(const site of Object.values(s.farming.sites||{}))add(site,50,40);
  if(s.farming.expansion)add(s.farming.expansion.site,50,40);
  if(s.farming.known||s.farming.plots?.length)add([680,535],125,80);
  add([310,168],65,50); // Persistent shared pantry.
  for(const q of s.farming.querns||[])add(quernSite(s,q),42,34);
  for(const p of [...(s.local?.outposts||[]),...(s.local?.daughter?[s.local.daughter]:[])])if(p.shelter>0)add(p.site,64,50);
  for(const store of Object.values(s.local?.campStores||{})){
    for(const site of store.rackSites||[])add(site,58,46);
    if(store.granary)add(store.granary.site,78,68);
  }
  for(const oven of Object.values(s.local?.ovens||{}))add(oven.site,60,50);
  const hearths=campHearths(s,camps);for(const h of hearths)add(h.site,40,34);
  return {home,anchors,occupied,hearths};
}

export function chooseHousingSite(s,camps,camp,index){
  const context=housingSiteContext(s,camps,camp),{home,anchors,occupied}=context;
  const key=JSON.stringify([camp,index,housingSiteRules,context]);
  if(houseSiteCache.has(key)){const site=houseSiteCache.get(key);return site&&site.slice();}
  const seen=new Set();let best=null,bestScore=Infinity;
  const consider=(point,anchor,preference=0)=>{
    const site=point.map(Math.round),id=site.join(',');if(seen.has(id))return;
    if(!housingSiteOnLand(site)||occupied.some(p=>near(site,p.site,p.rx,p.ry)))return;
    seen.add(id);
    const distance=Math.min(...anchors.map(p=>Math.hypot(site[0]-p[0],site[1]-p[1])));
    const score=distance+Math.hypot(site[0]-home[0],site[1]-home[1])*.12+preference;
    if(score<bestScore){best=site;bestScore=score;}
  };
  const preferred=householdHutSite(home,index),nearest=anchors.slice().sort((a,b)=>Math.hypot(a[0]-preferred[0],a[1]-preferred[1])-Math.hypot(b[0]-preferred[0],b[1]-preferred[1]))[0];
  consider(preferred,nearest,-6);
  for(const anchor of anchors)for(const radius of housingSiteRules.radii)for(let i=0;i<24;i++){
    const angle=i*Math.PI/12+camp*.31;
    consider([anchor[0]+radius*Math.cos(angle),anchor[1]+radius*.8*Math.sin(angle)],anchor);
  }
  // Search the whole playable map as well. Distance ranks practical nearby
  // sites but never disqualifies a distant or opposite-bank plot.
  for(let y=65;y<=590;y+=housingSiteRules.mapStep)for(let x=40;x<=960;x+=housingSiteRules.mapStep)consider([x,y],home);
  // Memoize geometry only, without mutating the world or consuming its RNG.
  // New buildings/projects/abandonment change the key immediately.
  if(houseSiteCache.size>=128)houseSiteCache.clear();houseSiteCache.set(key,best);
  return best&&best.slice();
}
