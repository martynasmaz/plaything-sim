import {householdHutSite} from './settlement-layout.js';
import {riverHabitat} from './ecology.js';
import {developmentEnabled} from './development.js';

export const granaryRules={work:8,capacity:96,cost:{wood:12,fibre:4,stone:2},binWork:4,binCapacity:48,binCost:{wood:6,fibre:2}};
export const granaryFinished=store=>(store?.granary?.work||0)>=granaryRules.work;
export function storageCapacity(store){
  return (store?.built?24*(store.racks||1):0)+12*(store?.tradeJars||0)+
    (granaryFinished(store)?granaryRules.capacity+(store.granary.bins||0)*granaryRules.binCapacity:0);
}
export function granaryStudyReady(s,v){
  const store=s.local?.campStores?.[v.tribe||0],p=v.practice;
  return developmentEnabled(s,'planning')&&!!store?.built&&(store.batches||0)>=3&&
    (p.skills.wood||0)>=4&&(p.used.drying||0)>=2&&s.settlementWork>=s.config.settlement.shelterWork;
}
export const granaryRecipe=['granaries','Raised food storage','wood','rigid',['drying','housing','cordage','crude tools'],
  {wood:1,fibre:1},'granary plan',granaryStudyReady];

// A site is chosen by construction, then saved. Reserve growing households,
// paths and other projects; storage stays on its camp's side of both rivers.
export function chooseStorageSite(s,camps,camp,extra=[],trees=[]){
  const home=camps[camp],bank=riverHabitat(...home),occupied=[...extra];
  camps.forEach((c,id)=>{
    occupied.push({site:c,rx:55,ry:45});
    const count=Math.max(8,(s.huts||[]).filter(n=>n===id).length+2);
    for(let i=0;i<count;i++)occupied.push({site:householdHutSite(c,i),rx:62,ry:55});
  });
  if(s.local.healerHome)occupied.push({site:s.local.healerHome.home,rx:75,ry:65});
  for(const p of s.local.husbandry?.pens||[])occupied.push({site:p.site,rx:80,ry:65});
  for(const site of Object.values(s.farming.sites||{}))occupied.push({site,rx:50,ry:45});
  // The original cultivated beds and shared pantry also need clear space.
  occupied.push({site:[680,535],rx:110,ry:60},{site:[310,168],rx:60,ry:50});
  for(const store of Object.values(s.local.campStores||{})){
    for(const site of store.rackSites||[])occupied.push({site,rx:52,ry:42});
    if(store.granary)occupied.push({site:store.granary.site,rx:70,ry:60});
  }
  for(let radius=95;radius<=310;radius+=20)for(let i=0;i<48;i++){
    const angle=i*Math.PI/24,site=home.map((n,j)=>Math.round(n+radius*(j?Math.sin(angle):Math.cos(angle))));
    const [x,y]=site,h=riverHabitat(x,y);
    if(x<45||x>955||y<90||y>580||h.mainDistance<65||h.tributaryDistance<55||
      Math.sign(y-h.mainY)!==Math.sign(home[1]-bank.mainY)||
      y<h.mainY&&Math.sign(x-1000*(.54+.055*Math.sin(y/64+1)-.24*y/640))!==
        Math.sign(home[0]-1000*(.54+.055*Math.sin(home[1]/64+1)-.24*home[1]/640)))continue;
    if(occupied.some(p=>p.site&&Math.hypot((x-p.site[0])/p.rx,(y-p.site[1])/p.ry)<1))continue;
    if(trees.some(t=>Math.hypot((x-t[0])/24,(y-t[1])/24)<1))continue;
    return site;
  }
  return null;
}
export function storageRackSite(s,camps,camp,index){
  // Old fixtures without saved sites still get a stable, separated layout.
  return s.local.campStores[camp]?.rackSites?.[index]||[camps[camp][0]+90+(index%2)*55,camps[camp][1]-55+Math.floor(index/2)*44];
}
export function rememberStorageSites(s,camps,trees=()=>[]){
  for(const [camp,store] of Object.entries(s.local.campStores||{})){
    const count=(store.built?(store.racks||1):0)+Number(!!store.rackWork);
    store.rackSites??=[];
    for(let i=store.rackSites.length;i<count;i++)store.rackSites.push(chooseStorageSite(s,camps,Number(camp),[],trees())||storageRackSite(s,camps,Number(camp),i));
  }
}
