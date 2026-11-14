import {assessNeeds} from './needs.js';
import {fishingDependencies} from './fishing.js';
import {rememberHealerHome} from './healer-home.js';
import {magicRecipes,magicActions,magicEnabled,magicPrerequisites,planRitual,performRitual,magicSpoilageFactor,beginMagicDay} from './magic.js';
import {boneMealRecipe,boneFertilizerReady,applyBoneFertilizer,boneSoilRules,cerealRecipes,cerealIds,initCereals,finishCerealProduct,hasLocalQuern} from './farming.js';
import {preserveBirthHistory} from './village-events.js';
import {supplementaryWoodland,inBuildingPatch,treeKeptClear,buildingPatches} from './ecology.js';
import {householdHutSite} from './settlement-layout.js';
/* Personal knowledge in the live homestead. A workday is one decision and one
   finished activity. Stocks and finished objects are physical, knowledge isn't. */
export const materialSites={
  stone:{site:[196,185],property:'fractures',capacity:160,renew:0},
  wood:{site:[105,160],property:'rigid',capacity:70,renew:3},
  fibre:{site:[308,305],property:'flexible',capacity:50,renew:3},
  clay:{site:[585,259],property:'mouldable',capacity:100,renew:0},
  resin:{site:[830,485],property:'sticky',capacity:35,renew:.4},
  hide:{site:[385,165],property:'insulating',capacity:18,renew:.4},
  fish:{site:[308,305],property:'perishable',capacity:40,renew:3},
  berries:{site:[272,568],property:'perishable',capacity:60,renew:8},
  wheat:{site:[668,557],property:'perishable',capacity:16,renew:.4},
  quernStone:{site:[196,185],property:'fractures',capacity:24,renew:0}
};
const lean=s=>s.food<s.villagers.length*6;
// Stable map coordinates keep a felled tree in the same place after a reload.
export const valleyTrees=[[45,135,.87],[103,152,1.18],[140,112,.78],[874,106,.89],[936,131,1.1],[766,477,.95],[831,508,1.15],[257,603,.8]];
for(let grove=0;grove<25;grove++){
  const x=40+(grove*173)%920,y=grove%2?480+(grove*29)%120:74+(grove*31)%145;
  for(let i=0;i<8;i++)valleyTrees.push([x+Math.cos(i*2.4)*Math.sqrt(i)*10,y+Math.sin(i*2.4)*Math.sqrt(i)*7,.72+(i%3)*.19]);
}
export const campSites=[[227,222],[802,433],[702,153]];
// Normalized course of the northern tributary down to its confluence.
export function nerisX(y){return .54+.055*Math.sin(y*10+1)-.24*y;}
let cachedForestSeed,cachedForest;
// Preserve the four older eastern site IDs, then range around the founding valley.
const outerSites=[[1140,175],[1390,175],[1640,175],[1890,175],[-320,185],[380,-310],[340,925],[-610,-220],[1620,970],[-500,920],[1430,-370],[520,1160]];
export const explorationSites=outerSites;
export function worldTrees(s){
  const kaunas=s.local?.terrain==='kaunas';
  if(cachedForestSeed===s.seed+':'+kaunas)return cachedForest;
  let state=s.seed>>>0;
  const rand=()=>((state=Math.imul(state,1664525)+1013904223>>>0)/4294967296);
  const trees=kaunas?[]:valleyTrees.slice();
  const woods=[[105,130,107,85],[350,75,125,49],[765,94,154,76],[862,544,137,78],[180,518,118,89],[535,470,89,59],[1135,85,117,59],[1420,475,138,75],[1660,120,113,81],[1890,500,106,95]];
  if(!kaunas)woods.length=0;
  let layout=state;
  for(let row=-1;row<=1;row++)for(let col=-1;col<=1;col++){
    if(row===0&&col>=0)continue;
    for(let i=0;i<5;i++)woods.push([(col+.12+.76*rand())*1000,(row+.13+.74*rand())*640,90+rand()*85,50+rand()*58]);
  }
  state=layout;
  for(const [index,[cx,cy,rx,ry]] of woods.entries()){
    for(let i=0;i<55;i++){
      const a=rand()*Math.PI*2,r=Math.sqrt(rand()),x=cx+rx*r*Math.cos(a),y=cy+ry*r*Math.sin(a);
      const u=x/1000,v=y/640,main=.51+.078*Math.sin(u*7+.4)+.037*Math.sin(u*13);
      if((kaunas&&index<10?(x<8||x>1990||y<8||y>630):(x<-990||x>1990||y<-630||y>1270))||Math.abs(v-main)<.06||
        (v<main&&Math.abs(u-nerisX(v))<.024)||campSites.some(([hx,hy])=>Math.hypot(hx-x,hy-y)<37))continue;
      trees.push([x,y,.65+rand()*.85]);
    }
  }
  trees.legacyCount=trees.length;
  if(kaunas)trees.push(...supplementaryWoodland(s.seed,campSites));
  cachedForestSeed=s.seed+':'+kaunas;cachedForest=trees;return trees;
}
export function standingTree(s,id){
  return !!worldTrees(s)[id]&&s.local?.stumps?.[id]===undefined;
}

export function hutBuildingSite(s,v){
  const repairSlot=s.hutProject?.index!==undefined?s.hutProject.repairSlot??-1:s.hutDetails?.findIndex(h=>h?.ruined)??-1;
  const camp=repairSlot>=0?s.huts[repairSlot]:(s.hutProject?.camp??(v.tribe||0));
  const index=s.hutProject?.index??(repairSlot>=0?s.huts.slice(0,repairSlot).filter(c=>c===camp).length:(s.huts||[]).filter(c=>c===camp).length);
  return {camp,index,repairSlot,site:householdHutSite(campSites[camp],index)};
}
export function buildingSiteTree(s,site,kind='hut'){
  let nearest=null,distance=Infinity;
  worldTrees(s).forEach((tree,id)=>{
    if(!inBuildingPatch(tree,site,kind)||!standingTree(s,id))return;
    const d=Math.hypot(tree[0]-site[0],tree[1]-site[1]);
    if(d<distance){nearest=id;distance=d;}
  });
  return nearest;
}
export function canFellBuildingTree(s,v){
  return v.age>=s.config.life.adult&&(v.axeWear||0)<4&&
    !!(v.gear==='hand axe'||s.toolkit?.includes('hand axe')||v.practice?.gear['hafted tool']);
}
// The caller pays one ordinary workday. No house work or material spending
// happens on this day; the felled timber enters the same finite camp stock.
export function clearBuildingTree(s,v,project,site,report,kind='hut'){
  const tree=buildingSiteTree(s,site,kind);
  if(tree===null||!canFellBuildingTree(s,v))return false;
  (s.local.stumps??={})[tree]=s.day;
  project.clearingWork=(project.clearingWork||0)+1;
  (project.clearedTrees??=[]).push(tree);
  v.axeWear=(v.axeWear||0)+1;
  if(v.axeWear===4)settlementEvent(s,v.name+' stopped using a damaged axe.');
  const wood=Math.min(s.config.limits.stock-s.wood,s.config.work.adultWood+(v.practice.gear['hafted tool']?4:2));
  s.wood+=Math.max(0,wood);v.gained=Math.max(0,wood);report.gatheredWood+=v.gained;
  (report.felledTrees??={})[v.id]=tree;
  return true;
}

export function preserveBuiltClearings(s){
  if(s.local.siteClearingVersion===1)return;
  s.local.siteClearingVersion=1;
  // Loaded houses already occupy their ground. Preserve their existing space
  // once, including newly appended vegetation, rather than burying old homes.
  const patches=buildingPatches(s,campSites);
  if(!patches.length)return;
  const stumps=s.local.stumps??={};
  worldTrees(s).forEach((tree,id)=>{
    if(patches.some(p=>inBuildingPatch(tree,p.site,p.kind)))stumps[id]??=s.day;
  });
}

for(let reach=0;reach<4;reach++)for(let i=0;i<22;i++){
  if(i%4===0)continue;
  const x=1015+reach*250+(i*71)%222,y=80+(i*97+reach*37)%480;
  const river=640*(.51+.078*Math.sin(x*.007+.4)+.037*Math.sin(x*.013));
  if(Math.abs(y-river)>34)valleyTrees.push([x,y,.7+(i%3)*.16]);
}
export function wearCampPaths(s,report){
  const paths=s.local.paths??={};
  const places={Forage:'berries',Hunt:'hide','Gather wood':'wood'};
  for(const {id,action} of report.actions){
    const person=s.villagers.find(v=>v.id===id);
    const material=action.startsWith('Collect ')?action.slice(8):places[action];
    const tree=report.felledTrees?.[id];
    const outing=report.outing?.members.includes(id)?report.outing:null;
    const patch=report.foragingPatches?.[id];
    const site=outing?[outing.x,outing.y]:patch!==undefined?explorationSites[patch]:
      tree!==undefined?worldTrees(s)[tree]:materialSites[material]?.site;
    if(!site||!person)continue;
    const camp=person.tribe||0;
    const key=camp+'/'+(outing||patch!==undefined?'east'+site.join(','):tree!==undefined?'grove'+Math.floor(tree/8):material);
    const path=paths[key]??={camp,x:site[0],y:site[1],wear:0};
    path.wear=Math.min(24,path.wear+1);
  }
}
export function fellTree(s,v){
  const [cx,cy]=campSites[v.tribe||0];
  const stumps=s.local.stumps??={};
  let nearest=null,distance=Infinity;
  worldTrees(s).forEach(([x,y],id)=>{
    
    if(!standingTree(s,id))return;
    const d=Math.hypot(x-cx,y-cy);
    if(d<distance){nearest=id;distance=d;}
  });
  if(nearest!==null)stumps[nearest]=s.day;
  return nearest;
}
const surplus=s=>s.food>=s.villagers.length*2;
const projects=[
  ['knapping','Improved stone knapping','stone','fractures',[],{stone:1},'cutting tool',()=>true],
  ['herbalism','Plant remedies','berries','perishable',['gathering'],{herbs:1},'plant remedy',
    (s,v)=>(v.practice.skills.berries||0)>=3&&(v.practice.careExperience||0)>=2],
  // Green withies and bark strips can bind a simple trap before fine cordage.
  ['fishtraps','Wicker fish traps','fibre','flexible',['gathering'],{wood:1,fibre:2},'fish trap',
    (s,v)=>fishingDependencies(s,'fish trap')&&(v.practice.watersideVisits||0)>=2&&(v.practice.skills.fibre||0)>=2],
  ['cordage','Plant-fiber cordage','fibre','flexible',[],{fibre:1},'cord',()=>true],
  ['fishspears','Wooden fishing spears','wood','rigid',['crude tools'],{wood:1},'fishing spear',
    (s,v)=>fishingDependencies(s,'fishing spear')&&(v.practice.watersideVisits||0)>=1&&(v.practice.skills.wood||0)>=2],
  ['angling','Bone hooks and handlines','fish','fractures',['knapping','cordage'],{bone:1,fibre:1},'hook and line',
    (s,v)=>fishingDependencies(s,'hook and line')&&(v.practice.watersideVisits||0)>=2],
  ['fishingpoles','Wooden fishing poles','wood','rigid',['angling'],{wood:1,fibre:1},'fishing pole',
    (s,v)=>fishingDependencies(s,'fishing pole')&&!!v.practice.gear['hook and line']&&(v.practice.skills.fish||0)>=2],
  ['fishnets','Plant-fibre fishing nets','fish','flexible',['cordage'],{fibre:4,wood:1,stone:2},'fishing net',
    (s,v)=>fishingDependencies(s,'fishing net')&&(v.practice.skills.fibre||0)>=3&&(v.practice.skills.fish||0)>=3],
  ['hafting','Hafted stone tools','wood','sticky',['knapping','cordage'],{stone:1,wood:1,resin:1},'hafted tool',()=>true],
  ['baskets','Basket weaving','berries','flexible',['cordage'],{fibre:2},'basket',(s,v)=>v.practice.limitedTrips>=2],
  ['housing','Improved shelter construction','wood','insulating',['cordage'],{hide:1,wood:2},'lined bed',(s,v)=>v.warmth<90||v.outdoors||!!v.herbalist],
  ['drying','Food drying','berries','perishable',[],{food:1,wood:1},'dried food',surplus],
  ['shaping','Clay shaping','clay','mouldable',[],{clay:1},'clay vessel',surplus],
  ['pottery','Fired pottery','clay','mouldable',['shaping'],{clay:2,wood:1},'storage jar',surplus],
  ['charcoal','Charcoal production','wood','rigid',[],{wood:2},'charcoal',surplus],
  ['kilns','Improved kilns','clay','mouldable',['pottery','charcoal'],{clay:2,charcoal:1},'efficient kiln',surplus],
  ...cerealRecipes,boneMealRecipe,...magicRecipes
];
export const practices=Object.fromEntries(projects.map(([id,name,skill,property,requires,cost,product,need])=>[id,{
  id,name,skill,property,requires,cost,product,need,work:3,
  heat:['pottery','drying','charcoal','kilns','breadmaking'].includes(id)
}]));
for(const [id] of magicRecipes){practices[id].magic=magicActions[id]?'ritual':'tool';practices[id].action=magicActions[id];}
practices.bonemeal.action='Grind bones for fertilizer';
practices.milling.action='Grind wheat into flour';practices.breadmaking.action='Bake hearth flatbread';
export function availablePractices(s){return Object.values(practices).filter(r=>!r.magic||magicEnabled(s));}
const byActivity={};
for(const recipe of Object.values(practices))(byActivity[recipe.skill]??=[]).push(recipe);
byActivity.berries.push(practices.bonemeal); // Farmers can connect field observations with earlier crushing work.
byActivity.berries.push(practices.bonecasting,practices.foretelling);
byActivity.berries.push(practices.quernmaking);
byActivity.wood.push(practices.breadmaking);
byActivity.stone.push(practices.milling);
byActivity.wood.push(practices.foretelling); // Woodland observations are an alternate path into reading omens.
export function settlementEvent(s,text){
  s.local.events.push({day:s.day,text});
  if(s.local.events.length>100)s.local.events.shift();
}
export function initPractice(s,v){
  v.practice??={energy:78,curiosity:0.3+((Math.imul(v.id^s.seed,2654435761)>>>0)%68)/100,
    skills:{},properties:[],known:{gathering:1,'crude tools':1,'fire tending':1},progress:{},used:{},lessons:{},gear:{},limitedTrips:0,site:'camp',lastSkill:'',lastPlace:'camp'};
  return v.practice;
}
export function initSettlement(s){
  if(!s.config.learning)return;
  if(!s.local){
    const amount=s.config.learning.abundance;
    const deposits=Object.fromEntries(Object.entries(materialSites).map(([k,d])=>[k,Math.floor(d.capacity*amount)]));
    s.local={siteClearingVersion:1,seasonOffset:0,deposits,stock:{stone:3,fibre:3,clay:2,resin:1,hide:1,charcoal:0},events:[],first:{},jars:0,dried:0,season:'Spring'};
  }
  for(const v of s.villagers)initPractice(s,v);
  s.local.campStores??={};
  s.local.stock.bone??=0;
  s.local.stock.herbs??=0;
  s.local.stock.boneMeal??=0;
  initCereals(s);
  s.local.deposits.wheat??=16;
  s.local.deposits.quernStone??=24;
  preserveBirthHistory(s.local);
  rememberHealerHome(s,campSites[0]);
  preserveBuiltClearings(s);
  maintainHouseholds(s);
}
export function maintainHouseholds(s){
  const adults=s.villagers.filter(v=>!v.herbalist?.home&&v.age>=s.config.life.adult);
  for(const v of adults){
    if(v.household!==undefined)continue;
    const peer=adults.find(p=>p!==v&&p.household!==undefined&&(p.tribe||0)===(v.tribe||0)&&
      adults.filter(a=>a.household===p.household).length===1);
    v.household=peer?.household??v.id;
  }
  for(const child of s.villagers.filter(v=>v.age<s.config.life.adult)){
    let carers=(child.carers||[]).map(id=>adults.find(v=>v.id===id)).filter(Boolean);
    const lead=carers[0]||adults.find(v=>(v.tribe||0)===(child.tribe||0))||adults[0];
    if(!lead){child.carers=[];continue;}
    carers=[lead,...adults.filter(v=>v!==lead&&v.household===lead.household&&(v.tribe||0)===(lead.tribe||0))].slice(0,2);
    child.household=lead.household;child.tribe=lead.tribe||0;child.carers=carers.map(v=>v.id);
  }
}
export function valleySeason(s,day=s.day){
  const length=s.config.learning?.seasonLength||10;
  const offset=Math.max(0,day-1+(s.local?.seasonOffset||0)),index=Math.floor(offset/length);
  let hash=Math.imul(s.seed^(index+1),0x45d9f3b);
  hash=Math.imul(hash^(hash>>>16),0x45d9f3b);
  const strength=((hash^(hash>>>16))>>>0)/4294967296;
  const name=['Spring','Summer','Autumn','Winter'][index%4];
  const age=offset%length;
  const frozen=name==='Winter'&&strength>.64&&age>=Math.ceil(length*.25)&&age<length-2&&
    !(s.lastUsed.flood>=day-1);
  return {name,strength,frozen,age,index};
}
export function beginSettlementDay(s){
  initSettlement(s);
  const regrowth=s.local.regrowthSince??={};
  for(const [tree,day] of Object.entries(s.local.stumps||{})){
    if(treeKeptClear(s,worldTrees(s)[tree],campSites)){regrowth[tree]=s.day;continue;}
    if(s.day-(regrowth[tree]??day)>=30){delete s.local.stumps[tree];delete regrowth[tree];}
  }
  const l=s.local,c=s.config.learning;
  const season=valleySeason(s).index%4;
  l.season=['Spring','Summer','Autumn','Winter'][season];
  if(l.wildPatches&&season!==3)l.wildPatches=l.wildPatches.map(q=>Math.min(18,q+1));
  for(const [key,d] of Object.entries(materialSites)){
    const factor=key==='berries'?[1,1.4,1.1,0][season]:key==='wheat'?([1,2].includes(season)?1:0):1;
    l.deposits[key]=Math.min(Math.floor(d.capacity*c.abundance),l.deposits[key]+d.renew*c.abundance*factor);
  }
  l.dried=Math.min(l.dried,s.food);
  s.food-=Math.floor((s.food-l.dried)*c.spoilage*magicSpoilageFactor(s));
  beginMagicDay(s);
  for(const v of s.villagers){
    const p=v.practice;
    p.lastPlace=p.site;p.lastSkill=p.currentSkill||p.lastSkill;p.lessonToday=null;
    p.energy=Math.min(100,p.energy+ (p.gear['lined bed']?8:5));
  }
}
export function takeDeposit(s,key,wanted){
  const amount=Math.max(0,Math.min(Math.floor(s.local.deposits[key]),wanted));
  s.local.deposits[key]-=amount;
  return amount;
}
function recordWork(v,skill,site){
  const p=v.practice;p.site=site;p.currentSkill=skill;
  p.skills[skill]=Math.min(30,(p.skills[skill]||0)+1);
  const property=materialSites[skill]?.property;
  if(property&&!p.properties.includes(property))p.properties.push(property);
  if(site==='fibre'||skill==='fish')p.watersideVisits=(p.watersideVisits||0)+1;
}
const stockOf=(s,k)=>k==='wood'||k==='food'?s:s.local.stock;
function affordable(s,cost){return Object.entries(cost).every(([k,n])=>stockOf(s,k)[k]>=n);}
function spend(s,cost){for(const [k,n] of Object.entries(cost))stockOf(s,k)[k]-=n;}
export function canExperiment(s,v,r){
  const p=v.practice;
  return assessNeeds(s,v).level>=3&&!p.known[r.id]&&v.fullness>28&&p.energy>=32&&v.health>30&&
    p.properties.includes(r.property)&&r.requires.every(id=>p.known[id])&&
    (!r.heat||s.fireLit)&&r.need(s,v)&&affordable(s,r.cost);
}
export function planLessons(s,order){
  const booked=new Set();
  // Medical mentoring is a paired workday managed by healerWork. Ordinary
  // lessons must not promise a teacher who is treating patients elsewhere.
  const medical=v=>!!v.herbalist||!!(v.healerApprentice&&order.some(t=>t.id===v.healerApprentice.mentorId&&t.herbalist));
  const traveling=new Set([s.local.campVisit?.traveler,s.local.campVisit?.host]);
  const available=order.filter(v=>(!medical(v)||magicEnabled(s))&&!traveling.has(v.id));
  for(const student of available){
    const p=student.practice;
    if(booked.has(student.id)||assessNeeds(s,student).level<2||student.warmth<40||p.energy<35||student.fullness<36||s.food<s.villagers.length*2)continue;
    const teachable=(id,t)=>!p.known[id]&&(!(medical(student)||medical(t))||practices[id]?.magic&&
      (student.healerApprentice?.mentorId===t.id||t.healerApprentice?.mentorId===student.id))&&
      (id!=='bonemeal'||boneFertilizerReady(s,student))&&
      (!cerealIds.includes(id)||practices[id].requires.every(key=>p.known[key])&&practices[id].need(s,student)&&affordable(s,practices[id].cost))&&
      (!practices[id]?.magic||magicEnabled(s)&&magicPrerequisites(s,student,id)&&
      practices[id].requires.every(key=>p.known[key])&&p.properties.includes(practices[id].property));
    const options=available.filter(v=>v!==student&&!booked.has(v.id)&&assessNeeds(s,v).level>=2&&v.warmth>=40&&v.practice.energy>=35&&v.fullness>=36&&
      (v.tribe||0)===(student.tribe||0)&&(v.practice.lastPlace===p.lastPlace||
        Object.keys(v.practice.used).some(id=>cerealIds.includes(id)&&teachable(id,v))))
      .flatMap(teacher=>Object.keys(teacher.practice.used).filter(id=>teachable(id,teacher)).map(id=>({teacher,id})));
    options.sort((a,b)=>cerealIds.indexOf(b.id)-cerealIds.indexOf(a.id));
    if(!options.length)continue;
    const {teacher,id}=options[0];
    const key=teacher.id+'-'+id;
    if((p.lessons[key]||0)===0&&(s.day+student.id+teacher.id)%3!==0)continue;
    p.lessonToday={teacher:teacher.id,id,key};teacher.practice.lessonToday={student:student.id,id};
    booked.add(student.id);booked.add(teacher.id);
  }
}
function useTechnique(s,v,r,report){
  const p=v.practice,stationary=['charcoal','drying','herbalism','bonemeal','milling','breadmaking'].includes(r.id)||r.magic==='ritual';
  if(cerealIds.includes(r.id)&&!r.requires.every(id=>p.known[id]))return false;
  if(r.id==='quernmaking'&&hasLocalQuern(s,v))return false;
  if(r.id==='wheatgrowing')return false; // Knowledge is used when sowing real seed, not as an object.
  if(r.magic&&(!magicEnabled(s)||!r.requires.every(id=>p.known[id])))return false;
  if(r.id==='bonemeal'&&!r.requires.every(id=>p.known[id]))return false;
  if(p.gear[r.product]&&!stationary)return false;
  if(['baskets','hafting','housing'].includes(r.id)&&!p.gear.cord)return false;
  if(r.id==='drying'&&s.food-s.local.dried<4)return false;
  if(r.id==='charcoal'&&s.local.stock.charcoal>=4)return false;
  if(r.id==='herbalism'&&(v.herbalist||(v.remedyDoses||0)>=2))return false;
  if(['fishtraps','fishspears','angling','fishingpoles','fishnets'].includes(r.id)&&!r.requires.every(id=>p.known[id]))return false;
  if(!r.need(s,v)||!affordable(s,r.cost)||(r.heat&&!s.fireLit))return false;
  const ritual=r.magic==='ritual'?planRitual(s,v,r.id):null;
  if(r.magic==='ritual'&&!ritual)return false;
  spend(s,r.cost);if(r.magic!=='ritual'&&r.id!=='bonemeal'&&!['milling','breadmaking'].includes(r.id))p.gear[r.product]=true;
  if(cerealIds.includes(r.id))finishCerealProduct(s,v,r.id,report);
  if(ritual)performRitual(s,v,ritual,report);
  if(r.id==='fishtraps'){v.fishTrap=true;delete v.reedBundle;}
  if(r.id==='drying')s.local.dried=Math.min(s.food,s.local.dried+3);
  if(r.id==='charcoal')s.local.stock.charcoal+=p.gear['efficient kiln']?4:2;
  if(r.id==='bonemeal'){
    s.local.stock.boneMeal+=boneSoilRules.mealPerBatch;
    if(report)(report.fertilizerPrepared??=[]).push({id:v.id,bone:boneSoilRules.bonesPerBatch,meal:boneSoilRules.mealPerBatch});
  }
  if(r.id==='herbalism')v.remedyDoses=(v.remedyDoses||0)+1;
  if(r.id==='pottery'){const jars=p.gear['efficient kiln']?2:1;s.local.jars+=jars;v.spareJars=(v.spareJars||0)+jars;}
  if(!p.used[r.id])settlementEvent(s,v.name+' first used '+r.name.toLowerCase()+'.');
  p.used[r.id]=(p.used[r.id]||0)+1;p.known[r.id]+=1;
  return true;
}
export function makePracticeProduct(s,v,id,report){
  const r=practices[id];
  return !!r&&!!v.practice.known[id]&&useTechnique(s,v,r,report);
}
function experiment(s,v,die,onlyCereals=false){
  const p=v.practice,c=s.config.learning;
  // Experiments follow the material actually worked, with the same recipes and
  // prerequisites whether curiosity or a wish for competence motivates them.
  const candidates=[...(byActivity[p.lastSkill]||[])].sort((a,b)=>Number(cerealIds.includes(b.id))-Number(cerealIds.includes(a.id)));
  for(const r of candidates){
    if(onlyCereals&&!cerealIds.includes(r.id))continue;
    if(!canExperiment(s,v,r)||die>c.experimentChance+p.curiosity*20)continue;
    spend(s,r.cost);p.energy-=c.workCost;p.currentSkill=r.skill;
    p.progress[r.id]=(p.progress[r.id]||0)+c.progress*(.55+p.curiosity+(p.skills[r.skill]||0)/16);
    if(p.progress[r.id]>=r.work){
      p.known[r.id]=1;delete p.progress[r.id];
      const first=s.local.first[r.id]===undefined;s.local.first[r.id]??=s.day;
      settlementEvent(s,v.name+(first?' discovered ':' independently learned ')+r.name+' after working with '+r.skill+'.');
    }
    return 'Experiment with '+r.skill;
  }
  return null;
}
// Return a completed replacement work action, or let ordinary homestead work proceed.
export function practiceWork(s,v,die,report){
  const p=v.practice,c=s.config.learning;
  p.site='camp';p.currentSkill='';
  const motive=assessNeeds(s,v);
  if(motive.level<2||motive.level===2&&!p.lessonToday)return null;
  if(v.warmth<35||v.fullness<=28&&lean(s))return null;
  if(p.energy<22){p.energy=Math.min(100,p.energy+c.restGain);return 'Recover energy';}
  if(v.fullness<=28||p.energy<32||v.health<=30)return null;
  const lesson=p.lessonToday;
  if(lesson){
    p.energy-=c.workCost;
    if(lesson.teacher){
      const t=s.villagers.find(person=>person.id===lesson.teacher);
      if(cerealIds.includes(lesson.id)){
        if(report)(report.cerealLessons??=[]).push({studentId:v.id,teacherId:t.id,id:lesson.id,key:lesson.key});
        return 'Learn from '+t.name;
      }
      if(practices[lesson.id]?.magic){
        if(!magicEnabled(s)||!magicPrerequisites(s,v,lesson.id))return null;
        if(report)(report.magicLessons??=[]).push({studentId:v.id,teacherId:t.id,id:lesson.id,key:lesson.key});
        return 'Learn from '+t.name;
      }
      v.lastCompanyDay=t.lastCompanyDay=s.day;
      const n=(p.lessons[lesson.key]||0)+1;p.lessons[lesson.key]=n;
      if(n>=c.lessonDays){
        p.known[lesson.id]=1;
        settlementEvent(s,v.name+' learned '+practices[lesson.id].name+' in lessons with '+t.name+'.');
      }
      return 'Learn from '+t.name;
    }
    return 'Teach '+practices[lesson.id].name;
  }
  if(s.food<s.villagers.length*1.5||v.age<s.config.life.adult)return null;
  if(p.known.wheatgrowing&&s.farming.wheatHarvests&&!hasLocalQuern(s,v)&&s.toolkit?.includes('hammer stone')&&
    s.local.stock.quernStone<1&&s.local.deposits.quernStone>=1){
    s.local.stock.quernStone+=takeDeposit(s,'quernStone',1);p.energy-=c.workCost;
    recordWork(v,'stone','stone');return 'Collect a grinding stone';
  }
  if(p.known.wheatgrowing&&!hasLocalQuern(s,v)&&s.local.stock.quernStone>0&&s.toolkit?.includes('hammer stone')&&(p.skills.stone||0)<2){
    p.energy-=c.workCost;recordWork(v,'stone','stone');return 'Shape a grinding stone';
  }
  const cerealExperiment=experiment(s,v,die,true);if(cerealExperiment)return cerealExperiment;
  if(p.known.quernmaking&&!hasLocalQuern(s,v)&&useTechnique(s,v,practices.quernmaking,report)){
    p.energy-=c.workCost;return 'Make saddle quern';
  }
  if(magicEnabled(s)&&p.known.bonecasting&&!p.gear['casting bones']&&useTechnique(s,v,practices.bonecasting,report)){
    p.energy-=c.workCost;return 'Make casting bones';
  }
  if(applyBoneFertilizer(s,v,report)){
    p.energy-=c.workCost;p.used.bonemeal=(p.used.bonemeal||0)+1;recordWork(v,'berries','field');
    return 'Work ground bone into soil';
  }
  if(s.farming.known&&(p.farmingDays||0)>=3&&!p.known.bonemeal&&s.toolkit?.includes('hammer stone')&&
    (p.skills.stone||0)<2&&s.local.stock.bone>=1){
    s.local.stock.bone--;p.energy-=c.workCost;recordWork(v,'stone','stone');return 'Test crushing old bones';
  }
  if(p.known.bonemeal&&useTechnique(s,v,practices.bonemeal,report)){
    p.energy-=c.workCost;return practices.bonemeal.action;
  }
  if(magicEnabled(s)&&(p.gear['casting bones']||p.known.mendingrites)&&s.local.stock.herbs<2&&s.local.deposits.berries>=1){
    takeDeposit(s,'berries',1);s.local.stock.herbs++;p.energy-=c.workCost;
    recordWork(v,'berries','berries');return 'Gather ritual herbs';
  }
  // Known rites are performed for a present need; learning them alone never
  // creates their effect. Medical/cold necessities still precede this work.
  if(magicEnabled(s))for(const id of ['mendingrites','hearthcharms','foretelling','storewards']){
    const r=practices[id];
    if(p.known[id]&&useTechnique(s,v,r,report)){p.energy-=c.workCost;return r.action;}
  }
  if((p.skills.berries||0)>=3&&(p.careExperience||0)>=2&&s.local.stock.herbs<1&&s.local.deposits.berries>=1&&
    (!p.known.herbalism||(v.remedyDoses||0)<1&&!v.herbalist)){
    takeDeposit(s,'berries',1);s.local.stock.herbs++;p.energy-=c.workCost;
    recordWork(v,'berries','berries');return 'Gather plants for remedies';
  }
  // Confidence grows through useful repetition; established practitioners give
  // a new idea first consideration, without bypassing any recipe requirement.
  if(motive.level===4){const attempt=experiment(s,v,die);if(attempt)return attempt;}
  if(p.lastSkill==='fish'&&die<55){
    for(const id of ['fishnets','fishingpoles','angling','fishtraps','fishspears']){
      const r=practices[id];
      if(p.known[id]&&!p.gear[r.product]&&r.requires.every(key=>p.known[key])&&r.need(s,v)){
        const material=Object.keys(r.cost).find(key=>['fibre','stone'].includes(key)&&s.local.stock[key]<r.cost[key]&&s.local.deposits[key]>=1);
        if(material&&!(material==='fibre'&&s.lastUsed.flood>=s.day-1)&&!(material==='fibre'&&valleySeason(s).frozen)){
          s.local.stock[material]+=takeDeposit(s,material,3);p.energy-=c.workCost;
          recordWork(v,material,material);return 'Collect '+material;
        }
      }
      if(p.known[id]&&useTechnique(s,v,r)){p.energy-=c.workCost;return 'Make '+r.product;}
    }
  }
  for(const id of Object.keys(p.known)){
    const r=practices[id];
    if(r&&die<55&&useTechnique(s,v,r,report)){p.energy-=c.workCost;return r.action||'Make '+r.product;}
  }
  if(motive.level!==4){const attempt=experiment(s,v,die);if(attempt)return attempt;}
  if(die>48||s.food<s.villagers.length*2)return null;
  const materials=Object.keys(materialSites).filter(k=>!['berries','wood','fish','wheat','quernStone'].includes(k)&&Math.floor(s.local.deposits[k])>0&&
    (!['fibre','clay'].includes(k)||s.lastUsed.flood!==s.day-1));
  materials.sort((a,b)=>Number(p.properties.includes(materialSites[a].property))-Number(p.properties.includes(materialSites[b].property))||
    s.local.stock[a]-s.local.stock[b]);
  const material=materials[0];
  if(!material||s.local.stock[material]>22)return null;
  const amount=takeDeposit(s,material,2+Number(!!p.gear.basket));
  s.local.stock[material]+=amount;p.energy-=c.workCost;
  recordWork(v,material,material);return 'Collect '+material;
}
export function completeMagicLessons(s,report){
  if(!magicEnabled(s))return;
  for(const lesson of report.magicLessons||[]){
    const student=s.villagers.find(v=>v.id===lesson.studentId),teacher=s.villagers.find(v=>v.id===lesson.teacherId),r=practices[lesson.id];
    if(!student||!teacher||!r?.magic||!magicPrerequisites(s,student,lesson.id)||
      !report.actions.some(a=>a.id===teacher.id&&a.action==='Teach '+r.name)||
      !report.actions.some(a=>a.id===student.id&&a.action==='Learn from '+teacher.name))continue;
    const p=student.practice,n=(p.lessons[lesson.key]||0)+1;p.lessons[lesson.key]=n;
    student.lastCompanyDay=teacher.lastCompanyDay=s.day;
    if(n>=s.config.learning.lessonDays&&!p.known[r.id]){
      p.known[r.id]=1;settlementEvent(s,student.name+' learned '+r.name+' in lessons with '+teacher.name+'.');
    }
  }
}
export function completeCerealLessons(s,report){
  for(const lesson of report.cerealLessons||[]){
    const student=s.villagers.find(v=>v.id===lesson.studentId),teacher=s.villagers.find(v=>v.id===lesson.teacherId),r=practices[lesson.id];
    if(!student||!teacher||!cerealIds.includes(lesson.id)||!teacher.practice.known[r.id]||!teacher.practice.used[r.id]||
      !r.requires.every(id=>student.practice.known[id])||
      !report.actions.some(a=>a.id===teacher.id&&a.action==='Teach '+r.name)||
      !report.actions.some(a=>a.id===student.id&&a.action==='Learn from '+teacher.name))continue;
    const p=student.practice;p.lessons[lesson.key]=(p.lessons[lesson.key]||0)+1;
    teacher.lastCompanyDay=student.lastCompanyDay=s.day;
    if(p.lessons[lesson.key]>=s.config.learning.lessonDays&&!p.known[r.id]){
      p.known[r.id]=1;settlementEvent(s,student.name+' learned '+r.name+' in lessons with '+teacher.name+'.');
    }
  }
}
export function finishOrdinaryWork(s,v,action){
  const p=v.practice;
  const skill=({wood:'wood',forage:'berries',fish:'fish',trap:'fibre',reeds:'fibre','Gather fibre':'fibre','Gather clay':'clay',hunt:'hide',invent:'stone',hut:'wood',shelter:'wood',bridge:'wood',warm:'wood'})[action];
  if(skill)recordWork(v,skill,skill);
  if(action==='plant'||action==='harvest'){
    p.farmingDays=(p.farmingDays||0)+1;recordWork(v,'berries','field');
  }
  if(magicEnabled(s)&&['wood','berries','fish'].includes(skill)&&p.lastOutdoorDay!==s.day){
    p.lastOutdoorDay=s.day;p.outdoorDays=(p.outdoorDays||0)+1;
  }
  if(action==='rest')p.energy=Math.min(100,p.energy+s.config.learning.restGain);
  else p.energy=Math.max(0,p.energy-s.config.learning.workCost);
}
