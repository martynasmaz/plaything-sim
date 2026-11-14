import {riverHabitat} from './ecology.js';
import {foodDaysFor} from './provisions.js';
import {SCENARIO} from './scenario.js';
import {fieldSite} from './development.js';

// Livestock time follows the compressed four-season year, not human ages.
// Feed units are an abstract ration, not kilograms. No livestock consumes the
// human pantry automatically; pig grain must be beyond both seed and food reserves.
export const livestockRules=SCENARIO.livestock;
export const livestockKinds=livestockRules.species;
export const livestockBuildingRules=livestockRules.buildings;
export const husbandryIds=['herding','penbuilding','haymaking','stockshelter','milking','curdling','fleeceworking','woolspinning','woolweaving','woolclothing','composting','oxtraining'];
export const herderSite=[1390,175];
export const husbandryEnabled=s=>!!s.config.learning?.husbandry;
const livestockYear=s=>4*s.config.learning.seasonLength;
export const animalAlive=a=>a.status==='alive';
export const villageLivestock=s=>(s.local?.husbandry?.animals||[]).filter(a=>animalAlive(a)&&a.location==='village');
export const livestockPen=(s,camp)=>(s.local?.husbandry?.pens||[]).find(p=>p.camp===camp);
const herdAt=(s,pen)=>villageLivestock(s).filter(a=>a.penId===pen.id);
const livestockEvent=(s,text)=>{s.local.events.push({day:s.day,text,type:'livestock'});if(s.local.events.length>100)s.local.events.shift();};
function animalDice(s,id,salt){let h=Math.imul(s.seed^Math.imul(s.day+1,2654435761)^Math.imul(id+7,1597334677)^salt,1274126177);return ((h^(h>>>16))>>>0)/4294967296;}
const unitAge=(s,a)=>a.age/livestockYear(s);
export function livestockFeed(s,a){const k=livestockKinds[a.species];return k.feed*(unitAge(s,a)<k.adult?.5:1)*(a.lactatingUntil>=s.day?1.5:1);}
export function livestockSpace(s,a){return livestockKinds[a.species].space*(unitAge(s,a)<livestockKinds[a.species].adult?.5:1);}
const herdSpace=(s,animals)=>animals.reduce((n,a)=>n+livestockSpace(s,a),0);
const hasVessel=(s,v)=>!!(v.practice.gear['clay vessel']||s.local.jars||s.pottery?.jars);
const canCut=(s,v)=>!!(s.toolkit?.includes('stone blades')||v.practice.known.knapping&&v.practice.gear['cutting tool']);
const animalCamp=(s,v)=>s.local.daughter?.members.includes(v.id)?null:v.tribe||0;
const livestockInvestmentSafe=(s,v,cost=0)=>s.food>=s.villagers.length+cost&&foodDaysFor(s,v)-cost/Math.max(1,s.villagers.length)>=livestockRules.safeReserveDays;
const livestockSafe=(s,v)=>v.age>=s.config.life.adult&&!v.illnessDays&&v.fullness>=40&&v.warmth>=45&&v.health>=50&&v.practice.energy>=32&&!v.herbalist&&animalCamp(s,v)!==null;
const husbandryWinterReady=s=>(s.local.completedWinters??(s.local.lastWinterFood?1:0))>=livestockRules.minimumCompletedWinters;
const livestockFoodSafe=(s,v)=>v.age>=s.config.life.adult&&!v.illnessDays&&v.warmth>=35&&v.health>=30&&v.practice.energy>=22&&animalCamp(s,v)!==null;
function livestockProjectLead(s,camp,report){
  const pen=livestockPen(s,camp),candidates=s.villagers.filter(v=>animalCamp(s,v)===camp&&livestockSafe(s,v)&&!v.practice.lessonToday&&!v.campJourney&&!report.actions.some(a=>a.id===v.id));
  const score=v=>Number(!!v.practice.known.herding)*100+Number(v.id===pen?.keeperId)*20+
    husbandryIds.filter(id=>v.practice.known[id]).length*4+(v.practice.husbandryDays||0)/10+
    Number(!!v.practice.herderVisits)*5+(v.practice.progress.herding||0)+v.practice.curiosity;
  return candidates.sort((a,b)=>score(b)-score(a)||a.id-b.id)[0];
}
const affordLivestock=(s,cost)=>Object.entries(cost).every(([k,n])=>(['wood','food'].includes(k)?s[k]:s.local.stock[k]||0)>=n);
function livestockResourceSeen(s,...keys){const seen=s.local.discoveredResources??={food:true,wood:true};for(const key of keys)seen[key]=true;}
function spendLivestock(s,cost){for(const [k,n] of Object.entries(cost)){if(['wood','food'].includes(k))s[k]-=n;else s.local.stock[k]-=n;if(n>0)livestockResourceSeen(s,k);}}
function newAnimal(s,species,sex,location,extra={}){
  const h=s.local.husbandry,id=h.nextId++;
  const animal={id,name:livestockKinds[species].label+' '+id,species,sex,age:0,bornDay:s.day,origin:'born',status:'alive',location,
    health:100,condition:90,fedDays:0,ownerId:null,keeperId:null,motherId:null,fatherId:null,...extra};
  h.animals.push(animal);return animal;
}
export function initHusbandry(s){
  if(!husbandryEnabled(s)||!s.local)return;
  if(!s.local.husbandry){
    s.local.husbandry={version:1,introducedDay:s.day,nextId:1,animals:[],pens:[],batches:[],compost:[],milkBatches:[],contacts:{},stats:{births:0,deaths:0,slaughtered:0,escaped:0,traded:0,milk:0,curds:0,wool:0,cloth:0,hay:0,manured:0,traction:0}};
    // A finite, initially undiscovered off-map pastoral household. It supplies
    // actual animals, never free daily imports. Its own grazing and winter
    // hay are accounted for below, and a breeding pair is retained in trade.
    const h=s.local.husbandry;
    h.regional={site:herderSite.slice(),name:'Distant herding household',keepers:['Auste','Vidas'],grass:90,mast:55,hay:480,grain:160,hayBatches:[],careDays:0};
    for(const species of Object.keys(livestockKinds))for(let i=0;i<4;i++)newAnimal(s,species,i<2?'male':'female','regional',
      {age:Math.ceil(livestockKinds[species].adult*livestockYear(s))+i*4,bornDay:null,origin:'regional herd',fleeceType:'mixed primitive coat'});
  }
  s.local.husbandry.milkBatches??=[];
  s.local.husbandry.regional.hayBatches??=[];
  for(const pen of s.local.husbandry.pens){
    if(pen.enclosureDay!==undefined)pen.work=Math.max(pen.work,livestockBuildingRules.enclosure.work);
    if(pen.shelterDay!==undefined)pen.shelterWork=Math.max(pen.shelterWork,livestockBuildingRules.shelter.work);
  }
  for(const key of ['hay','milk','curds','wool','woolYarn','woolCloth','manure','compost','fodderGrain'])s.local.stock[key]??=0;
}
export function husbandryDependencies(s,name){
  if(['sheep flock','pig herd','cattle herd'].includes(name))return husbandryEnabled(s)&&!!s.local?.husbandry?.contacts.herders&&s.local.husbandry.pens.some(p=>p.work>=livestockBuildingRules.enclosure.work);
  const id=husbandryRecipes.find(r=>r[0]===name||r[1]===name||r[6]===name)?.[0];
  if(!id)return true;
  if(!husbandryEnabled(s))return false;
  const h=s.local.husbandry,contact=h?.contacts.herders;
  if(['herding','penbuilding','haymaking','stockshelter'].includes(id))return !!contact&&husbandryWinterReady(s);
  if(['milking','curdling','fleeceworking'].includes(id))return villageLivestock(s).length>0;
  if(id==='woolspinning')return s.textiles?.includes('drop spindle');
  if(['woolweaving','woolclothing'].includes(id))return s.textiles?.includes('loom');
  if(id==='composting')return s.farming.known&&villageLivestock(s).length>0;
  if(id==='oxtraining')return s.farming.wheatHarvests>=2&&s.toolkit?.includes('mallet & chisel')&&s.textiles?.includes('cordage');
  return true;
}
export function husbandryReady(s,v,id){
  if(!husbandryDependencies(s,id)||!livestockSafe(s,v))return false;
  const p=v.practice,h=s.local.husbandry,pen=livestockPen(s,animalCamp(s,v)),animals=pen?herdAt(s,pen):[];
  if(id==='herding')return ((p.herderVisits||0)>=1||(p.observedLivestockDays||0)>=2)&&(p.skills.berries||0)>=3;
  if(id==='penbuilding')return p.known.herding&&(p.skills.wood||0)>=2;
  if(id==='haymaking')return p.known.herding&&canCut(s,v)&&s.local.season!=='Winter';
  if(id==='stockshelter')return p.known.penbuilding&&(p.husbandryDays||0)>=3&&(p.skills.wood||0)>=3;
  if(id==='milking')return (p.observedMilking||animals.some(a=>a.lactatingUntil>=s.day&&a.species!=='pig'))&&hasVessel(s,v)&&(p.husbandryDays||0)>=3;
  if(id==='curdling')return s.local.stock.milk>=4&&hasVessel(s,v)&&s.fireLit;
  if(id==='fleeceworking')return animals.some(a=>a.species==='sheep'&&unitAge(s,a)>=livestockKinds.sheep.adult)&&canCut(s,v)&&(p.husbandryDays||0)>=3;
  if(id==='woolspinning')return s.local.stock.wool>=2;
  if(id==='woolweaving')return s.local.stock.woolYarn>=2;
  if(id==='woolclothing')return s.local.stock.woolCloth>=2&&s.local.stock.bone>=1;
  if(id==='composting')return (p.farmingDays||0)>=3&&(pen?.dung||0)>=4;
  if(id==='oxtraining')return (p.husbandryDays||0)>=12&&animals.some(a=>a.species==='cattle'&&a.sex==='male'&&unitAge(s,a)>=livestockKinds.cattle.adult);
  return false;
}
export const husbandryRecipes=[
  ['herding','Animal keeping','berries','perishable',['gathering'],{fibre:1},'herding practice',(s,v)=>husbandryReady(s,v,'herding')],
  ['penbuilding','Livestock enclosures','wood','rigid',['herding','cordage','crude tools'],{wood:1,fibre:1},'animal enclosure',(s,v)=>husbandryReady(s,v,'penbuilding')],
  ['haymaking','Winter haymaking','berries','perishable',['herding','crude tools'],{fibre:1},'stored hay',(s,v)=>husbandryReady(s,v,'haymaking')],
  ['stockshelter','Livestock shelters','wood','insulating',['penbuilding','housing'],{wood:1,hide:1},'livestock shelter',(s,v)=>husbandryReady(s,v,'stockshelter')],
  ['milking','Hand milking','berries','perishable',['herding','gathering'],{fibre:1},'fresh milk',(s,v)=>husbandryReady(s,v,'milking')],
  ['curdling','Heated sour-milk curds','berries','perishable',['milking','fire tending'],{milk:1,wood:1},'milk curds',(s,v)=>husbandryReady(s,v,'curdling')],
  ['fleeceworking','Gathering and cleaning fleece','hide','insulating',['herding','crude tools'],{fibre:1},'clean fleece',(s,v)=>husbandryReady(s,v,'fleeceworking')],
  ['woolspinning','Wool spinning','fibre','flexible',['fleeceworking','cordage'],{wool:1},'wool yarn',(s,v)=>husbandryReady(s,v,'woolspinning')],
  ['woolweaving','Wool weaving','fibre','flexible',['woolspinning'],{woolYarn:1},'wool cloth',(s,v)=>husbandryReady(s,v,'woolweaving')],
  ['woolclothing','Sewn wool wraps','hide','insulating',['woolweaving','knapping'],{fibre:1},'wool wrap',(s,v)=>husbandryReady(s,v,'woolclothing')],
  ['composting','Manure composting','berries','perishable',['herding','gathering'],{wood:1},'compost heap',(s,v)=>husbandryReady(s,v,'composting')],
  ['oxtraining','Cattle traction','wood','rigid',['herding','hafting','cordage'],{wood:1,fibre:1},'wooden cattle yoke',(s,v)=>husbandryReady(s,v,'oxtraining')]
];
export function chooseLivestockSite(s,camp){
  const homes=[[227,222],[802,433],[702,153]],home=homes[camp]||homes[0];
  const candidates=[[105,-48],[105,38],[-104,-32],[-95,48],[65,-89]];
  return candidates.map(([x,y])=>[home[0]+x,home[1]+y]).find(([x,y])=>{
    const habitat=riverHabitat(x,y);return !habitat.wet&&x>30&&y>35&&x<970&&y<610&&Math.hypot((x-680)/110,(y-535)/70)>1;
  })||[home[0]-106,home[1]-75];
}
export function hayMeadowSite(pen){return [[52,0],[-52,0],[0,46],[0,-46]].map(([x,y])=>[pen.site[0]+x,pen.site[1]+y]).find(p=>!riverHabitat(...p).wet)||pen.site;}
export function livestockTarget(s,camp){const n=s.villagers.filter(v=>animalCamp(s,v)===camp).length;return Math.min(livestockRules.maximumTarget,Math.max(livestockRules.minimumTarget,Math.floor(n/livestockRules.targetPeoplePerAnimal)));}
export function livestockWinterNeed(s,pen){
  return Math.ceil(herdAt(s,pen).filter(a=>a.species!=='pig').reduce((n,a)=>n+livestockFeed(s,a),0)*s.config.learning.seasonLength*livestockRules.winterFeedMargin);
}
function livestockUsed(s,v,id){
  const p=v.practice;p.used[id]=(p.used[id]||0)+1;p.known[id]=Math.max(1,p.known[id]||0);s.local.first[id]??=s.day;
  (p.made??={})[id]=(p.made[id]||0)+1;
}
function livestockAction(s,v,report,deps,action,skill='forage',site,id){
  deps.finish(s,v,skill);v.activity=action;v.gained=0;
  v.practice.husbandryDays=(v.practice.husbandryDays||0)+1;
  if(id)livestockUsed(s,v,id);
  if(!['Tend livestock and lead grazing','Tend and milk livestock'].includes(action))(s.local.husbandry.workDays??={})[animalCamp(s,v)]=s.day;
  if(id){const record={id:v.id,name:v.name,day:s.day,item:deps.recipes[id].name,action,skill:deps.recipes[id].skill,result:'completed a paid husbandry workday'};(s.local.weeklyUses??={})[record.item]=record;}
  report.actions.push({id:v.id,action,gained:0,site:site||livestockPen(s,animalCamp(s,v))?.site});
  return true;
}
function studyHusbandry(s,v,id,die,report,deps){
  const recipe=deps.recipes[id];
  if(v.practice.known[id]||!deps.canExperiment(s,v,recipe)||die>s.config.learning.experimentChance+v.practice.curiosity*20)return false;
  spendLivestock(s,recipe.cost);
  const p=v.practice;p.progress[id]=(p.progress[id]||0)+s.config.learning.progress*(.55+p.curiosity+(p.skills[recipe.skill]||0)/16);
  if(p.progress[id]>=recipe.work){p.known[id]=1;delete p.progress[id];s.local.first[id]??=s.day;livestockEvent(s,v.name+' learned '+recipe.name+' through observation and experiments.');}
  // This is a workday and an experiment, not an animal, building or finished product.
  deps.finish(s,v,recipe.skill==='wood'?'wood':recipe.skill==='hide'?'hunt':recipe.skill==='fibre'?'reeds':'forage');
  v.activity='Study '+recipe.name.toLowerCase();v.gained=0;
  (s.local.husbandry.workDays??={})[animalCamp(s,v)]=s.day;
  report.actions.push({id:v.id,action:v.activity,gained:0,site:livestockPen(s,animalCamp(s,v))?.site});return true;
}
function livestockBuild(s,v,pen,kind,report,deps){
  const rules=livestockBuildingRules[kind],key=kind==='enclosure'?'work':'shelterWork',id=kind==='enclosure'?'penbuilding':'stockshelter';
  if(!v.practice.known[id]||!deps.recipes[id].requires.every(k=>v.practice.known[k])||!husbandryReady(s,v,id)||(pen[key]||0)>=rules.work)return false;
  if(deps.siteTree(s,pen.site,'pen')!==null){
    if(!deps.clear(s,v,pen,pen.site,report,'pen'))return false;
    return livestockAction(s,v,report,deps,'Clear livestock building site','wood',pen.site);
  }
  const stage=pen[key]||0,cost=Object.fromEntries(Object.entries(rules.cost).map(([material,total])=>
    [material,Math.ceil(total*(stage+1)/rules.work)-Math.ceil(total*stage/rules.work)]));
  if(!affordLivestock(s,cost)||s.wood-(cost.wood||0)<s.config.settlement.fuelReserve)return false;
  spendLivestock(s,cost);pen.builderId??=v.id;
  const invested=pen[kind+'Materials']??={};for(const [material,n] of Object.entries(cost))invested[material]=(invested[material]||0)+n;
  pen[key]=(pen[key]||0)+1;
  if(pen[key]===rules.work){pen[kind+'Day']=s.day;if(kind==='enclosure')pen.integrity=100;livestockEvent(s,v.name+' completed '+(kind==='enclosure'?'a livestock enclosure':'a livestock shelter')+'.');}
  return livestockAction(s,v,report,deps,kind==='enclosure'?'Build livestock enclosure':'Build livestock shelter','wood',pen.site,id);
}
export function animalRelated(a,b){return a.id===b.id||a.motherId===b.id||a.fatherId===b.id||b.motherId===a.id||b.fatherId===a.id||
  [a.motherId,a.fatherId].filter(n=>n!==null&&n!==undefined).some(n=>n===b.motherId||n===b.fatherId);}
export function transferLivestockOwnership(s){
  const h=s.local?.husbandry;if(!h)return;
  for(const pen of h.pens){
    const owner=s.villagers.find(v=>v.id===pen.ownerId&&animalCamp(s,v)===pen.camp);
    const candidates=s.villagers.filter(v=>animalCamp(s,v)===pen.camp&&v.age>=s.config.life.adult);
    if(!owner){
      const successor=candidates.find(v=>v.parents?.includes(pen.ownerId))||candidates.find(v=>v.practice.known.herding)||candidates[0];
      if(successor){const old=pen.ownerId;pen.ownerId=successor.id;if(old!=null)livestockEvent(s,successor.name+' took responsibility for the surviving livestock and enclosure.');}
      else pen.ownerId=null;
    }
    if(!s.villagers.some(v=>v.id===pen.keeperId&&animalCamp(s,v)===pen.camp&&v.practice.known.herding))pen.keeperId=candidates.find(v=>v.practice.known.herding)?.id??null;
    for(const a of herdAt(s,pen)){a.ownerId=pen.ownerId;a.keeperId=pen.keeperId;}
  }
}
export function canLeaveLivestock(s,v,departing=[v.id]){
  const h=s.local?.husbandry;if(!h)return true;
  for(const pen of h.pens){
    if(animalCamp(s,v)!==pen.camp||!herdAt(s,pen).length)continue;
    if(!s.villagers.some(p=>!departing.includes(p.id)&&animalCamp(s,p)===pen.camp&&p.age>=s.config.life.adult&&p.practice.known.herding&&!p.illnessDays&&!p.herbalist&&!p.campJourney&&h.journey?.travelerId!==p.id))return false;
  }
  return true;
}
export function beginHusbandryDay(s,report){
  if(!husbandryEnabled(s))return;initHusbandry(s);const h=s.local.husbandry;
  transferLivestockOwnership(s);
  const season=s.local.season,seasonIndex=['Spring','Summer','Autumn','Winter'].indexOf(season),climate=s.local.climate,wet=(climate?.mm||0)>=2;
  for(const p of h.pens){
    const factor=climate?.soil<.15?.4:1;
    p.grass=Math.min(livestockRules.pastureCapacity,(p.grass??36)+livestockRules.pastureRegrowth[seasonIndex]*factor);
    p.hayMeadow=Math.min(livestockRules.hayMeadowCapacity,(p.hayMeadow??livestockRules.hayMeadowCapacity)+livestockRules.hayMeadowRegrowth[seasonIndex]*factor);
    p.mast=Math.min(45,(p.mast??24)+(season==='Winter'?0:season==='Autumn'?5:season==='Summer'?2:1)*factor);
    if(wet&&p.dung>4)p.mud=Math.min(12,(p.mud||0)+1);else p.mud=Math.max(0,(p.mud||0)-.5);
  }
  for(const batch of h.batches){
    if(!wet&&season!=='Winter')batch.dryDays++;
    if(wet)batch.wetDays++;
    if(batch.dryDays>=livestockRules.hayDryDays){s.local.stock.hay+=batch.amount;h.stats.hay+=batch.amount;batch.done=true;livestockResourceSeen(s,'hay');}
    else if(batch.wetDays>=livestockRules.hayWetSpoilDays){batch.done=true;livestockEvent(s,'A wet hay bundle spoiled before it could dry.');}
  }
  h.batches=h.batches.filter(b=>!b.done);
  for(const batch of h.compost)if(s.day>=batch.readyDay){s.local.stock.compost+=batch.amount;batch.done=true;livestockResourceSeen(s,'compost');}
  h.compost=h.compost.filter(b=>!b.done);
  // Perishable dairy is never silently counted as finished human meals.
  // Reconcile yesterday's recipe consumption FIFO, then expire each batch.
  let consumed=Math.max(0,h.milkBatches.reduce((n,b)=>n+b.amount,0)-s.local.stock.milk);
  for(const batch of h.milkBatches){const used=Math.min(consumed,batch.amount);batch.amount-=used;consumed-=used;}
  const spoiledMilk=h.milkBatches.filter(b=>s.day-b.day>=3).reduce((n,b)=>n+b.amount,0),spoiledCurds=s.day%5===0?Math.ceil(s.local.stock.curds*.1):0;
  h.milkBatches=h.milkBatches.filter(b=>b.amount>0&&s.day-b.day<3);
  s.local.stock.milk=Math.max(0,s.local.stock.milk-spoiledMilk);s.local.stock.curds=Math.max(0,s.local.stock.curds-spoiledCurds);
  report.livestock={births:[],deaths:[],products:[],feed:{grass:0,mast:0,hay:0,grain:0},spoiledMilk,spoiledCurds};
}
function endAnimal(s,a,cause,report,status='dead'){
  a.status=status;a.deathDay=s.day;a.deathCause=cause;delete a.pregnancy;delete a.milkAvailable;
  const h=s.local.husbandry;if(a.location==='village'){
    h.stats[status==='escaped'?'escaped':'deaths']++;
    report?.livestock?.deaths.push({id:a.id,cause});livestockEvent(s,a.name+(status==='escaped'?' escaped':' died')+' ('+cause+').');
  }
}
export function slaughterLivestock(s,v,a,report,deps){
  const pen=livestockPen(s,animalCamp(s,v));
  if(!pen||!animalAlive(a)||a.penId!==pen.id||a.location!=='village'||!v.practice.known.herding||!canCut(s,v)||
    !(livestockSafe(s,v)||s.food<s.villagers.length&&livestockFoodSafe(s,v)))return false;
  const k=livestockKinds[a.species],yieldFood=Math.max(2,Math.floor(k.meat*Math.min(1,unitAge(s,a)/k.adult)*(a.condition/100)));
  const food=Math.min(yieldFood,Math.max(0,deps.foodCapacity(s)-s.food));if(food<2)return false;
  endAnimal(s,a,'slaughtered',report);s.local.husbandry.stats.slaughtered++;
  s.food+=food;s.local.stock.hide+=k.hide;s.local.stock.bone+=k.bone;report.gatheredFood+=food;
  livestockAction(s,v,report,deps,'Slaughter '+a.name,'hunt',pen.site,'herding');v.gained=food;report.actions.at(-1).gained=food;
  return true;
}
function chooseSlaughter(s,pen,urgent=false){
  const animals=herdAt(s,pen),target=livestockTarget(s,pen.camp),excess=herdSpace(s,animals)>Math.min(12,target+2);
  if(!urgent&&!excess&&animals.every(a=>a.health>35&&unitAge(s,a)<livestockKinds[a.species].life*.8))return null;
  const protectedAnimal=a=>animals.filter(b=>b!==a&&b.species===a.species&&b.sex===a.sex&&unitAge(s,b)>=livestockKinds[b.species].adult).length===0;
  return animals.filter(a=>!a.pregnancy&&unitAge(s,a)>=livestockKinds[a.species].adult&&(!protectedAnimal(a)||urgent))
    .sort((a,b)=>Number(protectedAnimal(a))-Number(protectedAnimal(b))+Number(b.sex==='male')-Number(a.sex==='male')||a.health-b.health||b.age-a.age)[0]||null;
}
function tradeSpeciesReady(s,v,species,pen){
  const h=s.local.husbandry,k=livestockKinds[species],herd=herdAt(s,pen);
  const wanted=livestockTradeSexes(s,herd,species);
  if(!wanted.length||herdSpace(s,herd)+wanted.length*k.space>Math.min(livestockBuildingRules.enclosure.capacity,livestockTarget(s,pen.camp)+2))return false;
  const existingHayNeed=h.pens.reduce((n,p)=>n+livestockWinterNeed(s,p),0),additionalHay=Math.ceil(wanted.length*k.feed*s.config.learning.seasonLength*livestockRules.winterFeedMargin);
  if(species==='cattle')return pen.shelterWork>=livestockBuildingRules.shelter.work&&(v.practice.husbandryDays||0)>=12&&s.farming.wheatHarvests>=2&&s.local.stock.hay>=existingHayNeed+additionalHay;
  if(species==='pig')return (v.practice.skills.berries||0)>=6&&(v.practice.husbandryDays||0)>=5&&pen.shelterWork>=livestockBuildingRules.shelter.work&&pen.mast>=20&&s.local.stock.wheat>=Math.max(12,s.farming.plots.length+8);
  return v.practice.known.haymaking&&s.local.stock.hay>=existingHayNeed+additionalHay;
}
function livestockTradeSexes(s,herd,species){
  const group=herd.filter(a=>a.species===species),k=livestockKinds[species];
  const wanted=['male','female'].filter(sex=>!group.some(a=>a.sex===sex&&a.health>=50&&unitAge(s,a)<k.life*.85));
  const mothers=group.filter(a=>a.sex==='female'),fathers=group.filter(a=>a.sex==='male');
  if(!wanted.length&&mothers.length&&fathers.length&&mothers.every(m=>fathers.every(f=>animalRelated(m,f))))wanted.push('male');
  return wanted;
}
function livestockOffers(s,species){
  const k=livestockKinds[species];return s.local.husbandry.animals.filter(a=>a.location==='regional'&&animalAlive(a)&&a.species===species&&
    unitAge(s,a)>=k.adult&&unitAge(s,a)<k.life*.85&&a.health>=60&&!a.pregnancy&&!(a.nursingUntil>=s.day));
}
function chooseLivestockTrade(s,pen,species){
  const local=herdAt(s,pen).filter(a=>a.species===species),wanted=livestockTradeSexes(s,local,species),offered=livestockOffers(s,species).sort((a,b)=>a.age-b.age);
  const regional=s.local.husbandry.animals.filter(a=>a.location==='regional'&&animalAlive(a)&&a.species===species&&unitAge(s,a)>=livestockKinds[species].adult);
  function choose(index,selected){
    if(index===wanted.length){
      const remaining=regional.filter(a=>!selected.includes(a));
      return remaining.some(m=>m.sex==='female'&&remaining.some(f=>f.sex==='male'&&!animalRelated(m,f)))?selected:null;
    }
    for(const animal of offered.filter(a=>a.sex===wanted[index])){
      if([...local,...selected].some(a=>a.sex!==animal.sex&&animalRelated(a,animal)))continue;
      const result=choose(index+1,[...selected,animal]);if(result)return result;
    }
    return null;
  }
  return wanted.length?choose(0,[])||[]:[];
}
function livestockJourney(s,v,report,deps){
  const h=s.local.husbandry,trip=h.journey;
  if(!trip||trip.travelerId!==v.id)return false;
  if(!livestockSafe(s,v)||s.lastUsed.flood>=s.day-1||(s.local.climate?.mm||0)>=10){h.journey=null;return false;}
  if(trip.stage==='out'){
    trip.stage='meeting';return livestockAction(s,v,report,deps,'Travel to distant herders','explore',herderSite);
  }
  if(trip.stage==='meeting'){
    v.practice.herderVisits=(v.practice.herderVisits||0)+1;
    if(!h.contacts.herders){h.contacts.herders={day:s.day,site:herderSite.slice(),visits:0};livestockEvent(s,v.name+' met distant herders keeping sheep, pigs and cattle.');}
    h.contacts.herders.visits++;
    if(h.animals.some(a=>a.location==='regional'&&animalAlive(a)&&a.species!=='pig'&&a.lactatingUntil>=s.day))v.practice.observedMilking=true;
    v.lastCompanyDay=s.day;v.happiness=Math.min(100,v.happiness+3);
    if(!v.practice.known.herding)v.practice.progress.herding=(v.practice.progress.herding||0)+.6;
    // Seeing practical husbandry supplies relevant observations, not the skill.
    if(!v.practice.properties.includes('perishable'))v.practice.properties.push('perishable');
    trip.stage='return';return livestockAction(s,v,report,deps,'Observe distant livestock keepers','explore',herderSite);
  }
  const pen=livestockPen(s,animalCamp(s,v));
  if(trip.species&&pen?.work>=livestockBuildingRules.enclosure.work){
    const species=trip.species,k=livestockKinds[species];
    const wanted=livestockTradeSexes(s,herdAt(s,pen),species);
    const animals=chooseLivestockTrade(s,pen,species);
    // Reserve animals, food and room at the actual exchange as well as departure.
    // A small regional male surplus is possible only after real births.
    const price=k.price*wanted.length;
    if(animals.length===wanted.length&&animals.length&&livestockInvestmentSafe(s,v,price)&&s.local.stock.fibre>=wanted.length&&
      herdSpace(s,herdAt(s,pen))+animals.length*k.space<=livestockBuildingRules.enclosure.capacity&&tradeSpeciesReady(s,v,species,pen)){
      spendLivestock(s,{food:price,fibre:wanted.length});h.regional.grain+=price;
      for(const a of animals){a.location='village';a.penId=pen.id;a.ownerId=pen.ownerId;a.keeperId=v.id;a.acquiredDay=s.day;a.milkAvailable=0;h.stats.traded++;}
      livestockEvent(s,v.name+' exchanged '+price+' food and '+wanted.length+' fibre for '+animals.length+' '+k.label.toLowerCase()+'.');
      (report.livestock.trades??=[]).push({id:v.id,species,animals:animals.map(a=>a.id),food:price});
    }
  }
  h.journey=null;return livestockAction(s,v,report,deps,report.livestock.trades?.some(t=>t.id===v.id)?'Lead livestock home':'Return from distant herders','explore',pen?.site);
}
function collectLivestockMilk(s,v,herd,report){
  if(!v.practice.known.milking||!hasVessel(s,v))return 0;
  if(s.local.stock.milk>=4||s.local.stock.curds>=12&&s.food>=s.villagers.length*4)return 0;
  const h=s.local.husbandry,milkers=herd.filter(a=>a.milkAvailable>=1&&a.milkDay!==s.day&&a.health>=60);let collected=0;
  for(const animal of milkers){
    const amount=Math.min(Math.floor(animal.milkAvailable),8-collected,12-s.local.stock.milk);if(amount<=0)break;
    s.local.stock.milk+=amount;h.milkBatches.push({amount,day:s.day,animalId:animal.id});animal.milkAvailable-=amount;animal.milkDay=s.day;h.stats.milk+=amount;collected+=amount;report.livestock.products.push({type:'milk',amount,animalId:animal.id});
  }
  if(collected){livestockUsed(s,v,'milking');livestockResourceSeen(s,'milk');}return collected;
}
function trainLivestockOx(s,v,herd,act,deps){
  if(!v.practice.known.oxtraining||!deps.recipes.oxtraining.requires.every(id=>v.practice.known[id])||!husbandryReady(s,v,'oxtraining')||s.wood<=s.config.settlement.fuelReserve+2||s.local.stock.fibre<1)return false;
  const ox=herd.find(a=>a.species==='cattle'&&a.sex==='male'&&unitAge(s,a)>=livestockKinds.cattle.adult&&!a.yoked&&a.health>=70);
  if(!ox)return false;
  ox.training=(ox.training||0)+1;spendLivestock(s,{wood:1,fibre:1});if(ox.training>=4){ox.yoked=true;ox.yokeDay=s.day;}
  return act('Train cattle to a wooden yoke','wood','oxtraining');
}
export function husbandryWork(s,v,die,report,deps,{urgent=false,develop=true,careOnly=false}={}){
  if(!husbandryEnabled(s))return false;
  if(!(livestockSafe(s,v)||urgent&&livestockFoodSafe(s,v))||v.practice.lessonToday){if(s.local.husbandry.journey?.travelerId===v.id)s.local.husbandry.journey=null;return false;}
  const h=s.local.husbandry,camp=animalCamp(s,v);let pen=livestockPen(s,camp);
  if(h.journey?.travelerId===v.id)return livestockJourney(s,v,report,deps);
  // One successor can work beside an actual keeper. This is a second paid
  // person-day, with materials, never passive inheritance of knowledge.
  if(!careOnly&&!v.practice.known.herding&&pen&&herdAt(s,pen).length&&livestockInvestmentSafe(s,v)&&
    (!pen.apprenticeId||pen.apprenticeId===v.id||!s.villagers.some(p=>p.id===pen.apprenticeId&&!p.practice.known.herding))){
    const mentor=report.actions.find(a=>['Tend livestock and lead grazing','Tend and milk livestock'].includes(a.action)&&s.villagers.some(p=>p.id===a.id&&animalCamp(s,p)===camp&&p.practice.known.herding));
    const recipe=deps.recipes.herding;
    if(mentor&&pen.lessonDay!==s.day&&recipe.requires.every(id=>v.practice.known[id])&&v.practice.properties.includes(recipe.property)&&
      (v.practice.skills.berries||0)>=3&&s.local.stock.fibre>=1){
      pen.apprenticeId=v.id;pen.lessonDay=s.day;s.local.stock.fibre--;
      v.practice.observedLivestockDays=(v.practice.observedLivestockDays||0)+1;
      v.practice.progress.herding=(v.practice.progress.herding||0)+1.5;
      if(v.practice.progress.herding>=recipe.work&&husbandryReady(s,v,'herding')){v.practice.known.herding=1;delete v.practice.progress.herding;s.local.first.herding??=s.day;livestockEvent(s,v.name+' learned livestock care by working beside '+s.villagers.find(p=>p.id===mentor.id).name+'.');}
      v.lastCompanyDay=s.day;return livestockAction(s,v,report,deps,'Learn livestock care with '+s.villagers.find(p=>p.id===mentor.id).name,'forage',pen.site);
    }
  }
  if(h.workDays?.[camp]===s.day)return false;
  const act=(action,skill='forage',id='herding')=>{h.workedDay=s.day;h.workedCamp=camp;return livestockAction(s,v,report,deps,action,skill,pen?.site,id);};
  const herd=pen?herdAt(s,pen):[],knows=v.practice.known;
  if(urgent&&s.food<=deps.foodCapacity(s)-2){
    if(knows.milking&&hasVessel(s,v)&&s.fireLit&&s.wood>s.config.settlement.fuelReserve&&
      s.local.stock.milk+herd.filter(a=>a.health>=60&&a.milkDay!==s.day).reduce((n,a)=>n+(a.milkAvailable||0),0)>=2)collectLivestockMilk(s,v,herd,report);
    if(knows.milking&&hasVessel(s,v)&&s.local.stock.milk>=2&&s.fireLit&&s.wood>s.config.settlement.fuelReserve){s.local.stock.milk-=2;s.wood--;s.food+=2;report.gatheredFood+=2;return act('Heat milk for supper','warm','milking');}
  }
  if(pen&&knows.herding){
    const slaughter=chooseSlaughter(s,pen,urgent&&s.food<s.villagers.length);
    const excess=herdSpace(s,herd)>Math.min(livestockBuildingRules.enclosure.capacity,livestockTarget(s,camp)+2);
    if(slaughter&&(urgent||excess||slaughter.health<35||s.food<s.villagers.length*4)&&slaughterLivestock(s,v,slaughter,report,deps))return true;
    // Essential care gets a chance before experiments. One keeper can supply
    // water, lead grazing and load fodder for this enclosure for two days.
    if(herd.length&&pen.careDay<s.day-1){
      pen.careDay=s.day;pen.keeperId=v.id;
      if(herd.some(a=>a.species==='pig')&&(s.local.season==='Winter'||pen.mast<herd.filter(a=>a.species==='pig').length*3)){
        const reserve=Math.max(s.farming.plots.length,s.villagers.length*2,12),needed=Math.max(0,Math.ceil(herd.filter(a=>a.species==='pig').reduce((n,a)=>n+livestockFeed(s,a),0)*3)-s.local.stock.fodderGrain);
        const amount=Math.min(needed,Math.max(0,Math.floor(s.local.stock.wheat-reserve)));
        s.local.stock.wheat-=amount;s.local.stock.fodderGrain+=amount;if(amount>0)livestockResourceSeen(s,'fodderGrain');
      }
      const milk=collectLivestockMilk(s,v,herd,report);
      return act(milk?'Tend and milk livestock':'Tend livestock and lead grazing');
    }
  }
  if(careOnly)return false;
  if(urgent||!develop||!livestockInvestmentSafe(s,v)||s.wood<s.config.settlement.fuelReserve+2)return false;
  // Concentrate a household project in an available, experienced volunteer.
  // Otherwise the rotating work order sends every adult to collect one piece
  // of fibre and nobody gets enough practice to finish the enclosure. Other
  // villagers can still experiment independently through ordinary practice.
  const productWorker=knows.herding&&(['woolspinning','woolweaving','woolclothing'].some(id=>knows[id])&&
    (s.local.stock.wool>=2||s.local.stock.woolYarn>=2||s.local.stock.woolCloth>=2));
  if(livestockProjectLead(s,camp,report)?.id!==v.id&&!productWorker)return false;
  if(!h.contacts.herders){
    if(!h.journey&&s.local.reaches>=livestockRules.minimumExploredReaches&&husbandryWinterReady(s)&&animalDice(s,camp,201)<livestockRules.contactChance&&(s.local.harvests||0)>=livestockRules.minimumHarvests&&(v.practice.skills.berries||0)>=3&&livestockInvestmentSafe(s,v,livestockRules.journeyRations)){
      s.food-=livestockRules.journeyRations;v.travelMeals=(v.travelMeals||0)+livestockRules.journeyRations;h.journey={travelerId:v.id,stage:'out',started:s.day,rations:livestockRules.journeyRations};return livestockJourney(s,v,report,deps);
    }return false;
  }
  if(!v.practice.herderVisits){
    const mentor=!knows.herding&&report.actions.find(a=>['Tend livestock and lead grazing','Tend and milk livestock'].includes(a.action)&&s.villagers.some(p=>p.id===a.id&&animalCamp(s,p)===camp));
    if(mentor){v.practice.observedLivestockDays=(v.practice.observedLivestockDays||0)+1;return livestockAction(s,v,report,deps,'Observe livestock with '+s.villagers.find(p=>p.id===mentor.id).name,'forage',pen?.site);}
    if(!h.journey&&livestockInvestmentSafe(s,v,livestockRules.journeyRations)&&!s.villagers.some(p=>animalCamp(s,p)===camp&&p.practice.known.herding)){
      s.food-=livestockRules.journeyRations;v.travelMeals=(v.travelMeals||0)+livestockRules.journeyRations;h.journey={travelerId:v.id,stage:'out',started:s.day,rations:livestockRules.journeyRations};return livestockJourney(s,v,report,deps);
    }
    // A local teacher, with real experience, is handled by ordinary lessons.
  }
  // A concrete wish to keep animals motivates learning the earlier crafts;
  // personal cordage/housing knowledge is never copied from a camp unlock.
  const safeFibreTrip=s.local.season!=='Winter'&&(s.local.climate?.mm||0)<10&&(s.lastUsed.flood===undefined||s.lastUsed.flood<s.day-1);
  if((v.practice.herderVisits||v.practice.observedLivestockDays)&&safeFibreTrip){
    const developingBasics=!knows.herding||!knows.cordage||!knows.penbuilding||!knows.haymaking||!pen||pen.work<livestockBuildingRules.enclosure.work||pen.shelterWork<livestockBuildingRules.shelter.work;
    const trading=pen?.work>=livestockBuildingRules.enclosure.work&&Object.keys(livestockKinds).some(k=>tradeSpeciesReady(s,v,k,pen));
    const neededFibre=developingBasics?1:trading?2:(pen.integrity??100)<65?1:0;
    if((s.local.stock.fibre<neededFibre||!v.practice.properties.includes('flexible'))&&s.local.deposits.fibre>=1){
      const amount=Math.min(3,Math.floor(s.local.deposits.fibre));s.local.deposits.fibre-=amount;s.local.stock.fibre+=amount;
      return livestockAction(s,v,report,deps,'Gather fibre for livestock work','reeds',[308,305]);
    }
  }
  if(knows.herding&&!knows.cordage&&studyHusbandry(s,v,'cordage',die,report,deps))return true;
  if(knows.herding&&!v.practice.properties.includes('rigid')&&s.wood>s.config.settlement.fuelReserve+1){s.wood--;return livestockAction(s,v,report,deps,'Shape an enclosure peg','wood',pen?.site);}
  if(knows.herding&&pen?.work>=livestockBuildingRules.enclosure.work&&pen.shelterWork<livestockBuildingRules.shelter.work&&s.local.stock.hide<(!knows.housing||!knows.stockshelter?2:1)&&s.local.deposits.hide>=1){
    const amount=Math.min(3,Math.floor(s.local.deposits.hide));s.local.deposits.hide-=amount;s.local.stock.hide+=amount;
    return livestockAction(s,v,report,deps,'Collect hides for livestock shelter','hunt',[385,165]);
  }
  if(knows.herding&&pen?.work>=livestockBuildingRules.enclosure.work&&!v.practice.properties.includes('insulating')&&s.local.stock.hide>=1){return livestockAction(s,v,report,deps,'Inspect shelter hides','hunt',pen.site);}
  if(knows.herding&&pen?.work>=livestockBuildingRules.enclosure.work&&!knows.housing&&studyHusbandry(s,v,'housing',die,report,deps))return true;
  for(const id of ['herding','penbuilding','haymaking'])if(!knows[id]&&studyHusbandry(s,v,id,die,report,deps))return true;
  if(!knows.herding)return false;
  if(!pen&&knows.penbuilding){pen={id:'pen-'+camp,camp,ownerId:v.id,keeperId:v.id,site:chooseLivestockSite(s,camp),work:0,shelterWork:0,careDay:-10,dung:0,grass:36,mast:24,mud:0};h.pens.push(pen);}
  if(pen&&pen.work<livestockBuildingRules.enclosure.work&&livestockBuild(s,v,pen,'enclosure',report,deps))return true;
  if(!pen||pen.work<livestockBuildingRules.enclosure.work)return false;
  if(herd.length&&knows.penbuilding&&(pen.integrity??100)<65&&s.wood>s.config.settlement.fuelReserve&&s.local.stock.fibre>=1){spendLivestock(s,{wood:1,fibre:1});pen.integrity=Math.min(100,(pen.integrity??100)+40);return act('Repair livestock fence','wood','penbuilding');}
  if(pen.shelterWork>=livestockBuildingRules.shelter.work&&die<25){
    for(const id of husbandryIds.slice(4))if(!knows[id]&&studyHusbandry(s,v,id,die,report,deps))return true;
    if(trainLivestockOx(s,v,herd,act,deps))return true;
  }
  if(knows.haymaking&&canCut(s,v)&&s.local.season!=='Winter'&&(s.local.climate?.mm||0)<2){
    const preparingCattle=herd.length>=2&&(v.practice.husbandryDays||0)>=12&&s.farming.wheatHarvests>=2&&livestockTarget(s,camp)>=4;
    const emptyPens=h.pens.filter(p=>p.work>=livestockBuildingRules.enclosure.work&&!herdAt(s,p).length).length;
    const communalNeed=h.pens.reduce((n,p)=>n+livestockWinterNeed(s,p),0);
    const need=communalNeed+Math.max(emptyPens,communalNeed?0:1)*Math.ceil(s.config.learning.seasonLength*2*livestockRules.winterFeedMargin)+(preparingCattle?s.config.learning.seasonLength*6:0),pending=h.batches.reduce((n,b)=>n+b.amount,0);
    if(s.local.stock.hay+pending<Math.min(240*Math.max(1,h.pens.length),need)&&pen.hayMeadow>=livestockRules.hayBundle){
      pen.hayMeadow-=livestockRules.hayBundle;h.batches.push({amount:livestockRules.hayBundle,camp,site:pen.site.slice(),day:s.day,dryDays:0,wetDays:0});return livestockAction(s,v,report,deps,'Cut and bundle winter hay','forage',hayMeadowSite(pen),'haymaking');
    }
  }
  // Roofs are paid for after experience, before pigs/cattle or a winter herd.
  if(!knows.stockshelter&&studyHusbandry(s,v,'stockshelter',die,report,deps))return true;
  if(knows.stockshelter&&pen.shelterWork<livestockBuildingRules.shelter.work&&livestockBuild(s,v,pen,'shelter',report,deps))return true;
  if(!knows.curdling&&studyHusbandry(s,v,'curdling',die,report,deps))return true;
  if(knows.curdling&&hasVessel(s,v)&&s.local.stock.milk>=4&&s.fireLit&&s.wood>s.config.settlement.fuelReserve&&s.local.stock.curds<24){
    s.local.stock.milk-=4;s.wood--;s.local.stock.curds+=3;h.stats.curds+=3;report.gatheredFood+=3;livestockResourceSeen(s,'curds');return act('Make sour-milk curds','warm','curdling');
  }
  if(knows.milking&&hasVessel(s,v)){
    if(s.local.stock.milk>=2&&s.fireLit&&s.wood>s.config.settlement.fuelReserve&&s.food<=deps.foodCapacity(s)-2&&(s.food<s.villagers.length*2||s.local.stock.milk>=6)){
      s.local.stock.milk-=2;s.wood--;s.food+=2;report.gatheredFood+=2;return act('Heat milk for supper','warm','milking');
    }
    if(collectLivestockMilk(s,v,herd,report))return act('Milk the sheep and cattle','forage','milking');
  }
  if(knows.fleeceworking&&canCut(s,v)&&['Spring','Summer'].includes(s.local.season)&&s.local.stock.wool<24){
    const sheep=herd.find(a=>a.species==='sheep'&&unitAge(s,a)>=livestockKinds.sheep.adult&&s.day-(a.fleeceDay??a.acquiredDay??0)>=livestockYear(s)&&a.health>=60);
    if(sheep){sheep.fleeceDay=s.day;s.local.stock.wool+=2;h.stats.wool+=2;livestockResourceSeen(s,'wool');return act('Gather and clean sheep fleece','hunt','fleeceworking');}
  }
  if(knows.woolspinning&&s.textiles?.includes('drop spindle')&&s.local.stock.wool>=2&&s.local.stock.woolYarn<24){s.local.stock.wool-=2;s.local.stock.woolYarn+=2;livestockResourceSeen(s,'woolYarn');return act('Spin wool yarn','reeds','woolspinning');}
  if(knows.woolweaving&&s.textiles?.includes('loom')&&s.local.stock.woolYarn>=2&&s.local.stock.woolCloth<16){s.local.stock.woolYarn-=2;s.local.stock.woolCloth++;h.stats.cloth++;livestockResourceSeen(s,'woolCloth');return act('Weave wool cloth','reeds','woolweaving');}
  if(knows.woolclothing&&s.textiles?.includes('loom')&&s.local.stock.woolCloth>=2&&s.local.stock.bone>=1&&s.local.stock.fibre>=1){
    const wearer=s.villagers.find(p=>animalCamp(s,p)===camp&&!p.practice.gear['wool wrap']);
    if(wearer){spendLivestock(s,{woolCloth:2,bone:1,fibre:1});wearer.practice.gear['wool wrap']=true;return act('Sew a wool wrap for '+wearer.name,'hunt','woolclothing');}
  }
  if(knows.composting&&(pen.dung+s.local.stock.manure)>=livestockRules.compostManure&&s.local.stock.compost+h.compost.reduce((n,b)=>n+b.amount,0)<Math.max(4,s.farming.plots.length)){
    const gathered=Math.min(livestockRules.compostManure,pen.dung);pen.dung-=gathered;pen.mud=Math.max(0,pen.mud-3);s.local.stock.manure+=gathered;
    livestockResourceSeen(s,'manure');
    s.local.stock.manure-=livestockRules.compostManure;h.compost.push({amount:livestockRules.compostOutput,day:s.day,readyDay:s.day+s.config.learning.seasonLength*livestockRules.compostSeasons,camp,site:[pen.site[0]+43,pen.site[1]+10]});return act('Clean pen and compost manure','forage','composting');
  }
  if(knows.composting&&s.farming.known&&s.local.stock.compost>=1&&s.local.season!=='Winter'){
    const i=s.farming.plots.findIndex((_,i)=>!(s.farming.manureSoil?.[i]?.remaining>0));
    if(i>=0){s.local.stock.compost--;s.farming.manureSoil??={};s.farming.manureSoil[i]={remaining:livestockRules.compostHarvests,appliedDay:s.day,readyDay:s.day+4};h.stats.manured++;return livestockAction(s,v,report,deps,'Work compost into a field','plant',fieldSite(s,i),'composting');}
  }
  if(pen.dung>=8){pen.dung-=4;pen.mud=Math.max(0,pen.mud-3);s.local.stock.manure+=4;return act('Clean livestock enclosure');}
  if(trainLivestockOx(s,v,herd,act,deps))return true;
  for(const id of husbandryIds.slice(3))if(!knows[id]&&studyHusbandry(s,v,id,die,report,deps))return true;
  if(!h.journey&&animalDice(s,camp,202)<livestockRules.tradeChance&&s.day>=(h.nextTradeDay||0)&&s.local.season!=='Winter'&&(s.local.climate?.mm||0)<10){
    const species=Object.keys(livestockKinds).find(kind=>tradeSpeciesReady(s,v,kind,pen)&&livestockInvestmentSafe(s,v,2*livestockKinds[kind].price+livestockRules.journeyRations)&&s.local.stock.fibre>=2&&
      chooseLivestockTrade(s,pen,kind).length===livestockTradeSexes(s,herd,kind).length);
    if(species){s.food-=livestockRules.journeyRations;v.travelMeals=(v.travelMeals||0)+livestockRules.journeyRations;h.nextTradeDay=s.day+s.config.learning.seasonLength*livestockRules.tradeIntervalSeasons;h.journey={travelerId:v.id,stage:'out',started:s.day,species,rations:livestockRules.journeyRations};return livestockJourney(s,v,report,deps);}
  }
  return false;
}
function breedLivestock(s,animals,capacity,report,regional=false){
  const h=s.local.husbandry;
  for(const mother of animals.filter(a=>a.sex==='female')){
    const k=livestockKinds[mother.species];
    if(mother.pregnancy&&s.day>=mother.pregnancy.due){
      const pregnancy=mother.pregnancy;delete mother.pregnancy;
      if(mother.condition<40||mother.health<40){if(!regional)livestockEvent(s,mother.name+' lost her pregnancy after poor condition.');continue;}
      const count=k.litter; // A full enclosure cannot erase already conceived offspring.
      for(let i=0;i<count;i++){
        const young=newAnimal(s,mother.species,animalDice(s,mother.id,120+i)>.5?'male':'female',mother.location,
          {motherId:mother.id,fatherId:pregnancy.fatherId,ownerId:mother.ownerId,keeperId:mother.keeperId,penId:mother.penId??null,condition:80,fleeceType:mother.fleeceType});
        animals.push(young);
        if(!regional){h.stats.births++;report.livestock.births.push({id:young.id,motherId:mother.id,fatherId:pregnancy.fatherId});livestockEvent(s,young.name+' was born to '+mother.name+'.');}
      }
      mother.lastBirthDay=s.day;mother.lactatingUntil=s.day+Math.round(livestockYear(s)*(mother.species==='cattle'?.65:.35));
      mother.nursingUntil=s.day+Math.round(livestockYear(s)*.25);mother.milkAvailable=0;
    }
    if(mother.pregnancy||unitAge(s,mother)<k.adult||mother.fedDays<3||mother.condition<75||mother.health<70||
      s.day-(mother.lastBirthDay??-10000)<k.interval*livestockYear(s))continue;
    if(mother.species==='sheep'&&!(s.local.season==='Autumn'&&(s.day-1+(s.local.seasonOffset||0))%s.config.learning.seasonLength>=s.config.learning.seasonLength*.6))continue;
    const reserved=animals.filter(a=>a.pregnancy).reduce((n,a)=>n+livestockKinds[a.species].litter*livestockKinds[a.species].space*.5,0);
    if(s.local.season==='Winter'||herdSpace(s,animals)+reserved+k.litter*k.space*.5>capacity)continue;
    const fathers=animals.filter(a=>a.species===mother.species&&a.sex==='male'&&unitAge(s,a)>=k.adult&&a.health>=70&&a.condition>=75&&!animalRelated(mother,a));
    const father=fathers[(mother.id+s.day)%fathers.length];
    if(father&&animalDice(s,mother.id,203)<livestockRules.breedingChance)mother.pregnancy={fatherId:father.id,conceivedDay:s.day,due:s.day+Math.round(k.gestation*livestockYear(s))};
  }
}
export function finishHusbandryDay(s,report){
  if(!husbandryEnabled(s))return;const h=s.local.husbandry;
  if(h.journey&&!s.villagers.some(v=>v.id===h.journey.travelerId))h.journey=null;
  for(const pen of h.pens){
    const animals=herdAt(s,pen),cared=pen.careDay>=s.day-1&&s.villagers.some(v=>animalCamp(s,v)===pen.camp&&v.practice.known.herding),roofBuilt=pen.shelterWork>=livestockBuildingRules.shelter.work;
    let roofSpace=roofBuilt?livestockBuildingRules.shelter.capacity:0;
    const underRoof=new Set([...animals].sort((a,b)=>Number(b.age<livestockYear(s)*.2)-Number(a.age<livestockYear(s)*.2)||Number(!!b.pregnancy)-Number(!!a.pregnancy)||a.id-b.id).filter(a=>{const space=livestockSpace(s,a);if(space>roofSpace)return false;roofSpace-=space;return true;}).map(a=>a.id));
    if(pen.work>=livestockBuildingRules.enclosure.work&&animals.length)pen.integrity=Math.max(0,(pen.integrity??100)-.04-animals.length*.01-((s.local.climate?.mm||0)>=10?.05:0));
    for(const a of animals){
      const sheltered=underRoof.has(a.id);
      a.age++;a.milkAvailable=0;const k=livestockKinds[a.species],need=livestockFeed(s,a);let eaten=0;
      const unweaned=a.motherId!==null&&a.age<livestockYear(s)*.2;
      if(unweaned){
        const mother=animals.find(m=>m.id===a.motherId&&animalAlive(m)&&m.lactatingUntil>=s.day&&m.lastFed>=.99&&m.health>=40);
        eaten=mother?need:0;
      }else{
        const key=a.species==='pig'?'mast':'grass';
        // Enclosed ruminants graze by themselves. A missed workday cannot
        // make sheep starve beside available grass. Pigs need a keeper to
        // take them to woodland forage; stored winter feed must be delivered.
        const grazing=s.local.season==='Winter'||a.species==='pig'&&!cared?0:Math.min(pen[key],need);pen[key]-=grazing;eaten+=grazing;report.livestock.feed[key]+=grazing;
        const stored=a.species==='pig'?'fodderGrain':'hay',amount=Math.min(s.local.stock[stored],need-eaten);
        if(cared){s.local.stock[stored]-=amount;eaten+=amount;report.livestock.feed[a.species==='pig'?'grain':'hay']+=amount;}
      }
      const fraction=eaten/need;a.lastFed=fraction;a.fedDays=fraction>=.99?a.fedDays+1:0;
      if((!cared||(pen.integrity??100)<20)&&animalDice(s,a.id,90)<livestockRules.risks.cropDamageUnattended){
        const plots=s.farming.plots.map((growth,i)=>growth!==null&&growth>0?i:-1).filter(i=>i>=0);
        if(plots.length){const i=plots[a.id%plots.length];s.farming.plots[i]=Math.max(0,s.farming.plots[i]-2);(report.livestock.cropDamage??=[]).push({animalId:a.id,plot:i});livestockEvent(s,a.name+' damaged an unprotected crop bed.');}
      }
      a.condition=Math.max(0,Math.min(100,a.condition+(fraction>=.99?2:-8*(1-fraction))));
      const cold=s.local.season==='Winter'&&!sheltered?(a.species==='sheep'?3:6):0;
      const thirsty=pen.careDay<s.day-4?4:0;
      a.health=Math.max(0,Math.min(100,a.health+(fraction>=.99?2:-5*(1-fraction))-cold-thirsty-(a.sickDays>0?3:0)));
      pen.dung=Math.min(80,pen.dung+eaten*.2);
      if(a.sickDays>0)a.sickDays--;
      else if(animalDice(s,a.id,70)<livestockRules.risks.illness+Math.min(livestockRules.risks.maxMudIllness,(pen.mud||0)*livestockRules.risks.mudIllnessPerPoint)){a.sickDays=6;livestockEvent(s,a.name+' became ill; clean housing and adequate feed support recovery.');}
      if(a.health<=0||a.condition<=0||unitAge(s,a)>=k.life){endAnimal(s,a,unitAge(s,a)>=k.life?'old age':fraction<.99?'lack of feed':thirsty?'lack of water':cold?'winter exposure':'illness',report);continue;}
      if(!cared&&animalDice(s,a.id,80)<(pen.work>=livestockBuildingRules.enclosure.work&&(pen.integrity??100)>20?livestockRules.risks.escapeIntact:livestockRules.risks.escapeBroken)){endAnimal(s,a,'unattended enclosure',report,'escaped');continue;}
      if(!cared&&!sheltered&&animalDice(s,a.id,81)<livestockRules.risks.predationUnattended){endAnimal(s,a,'predation while unattended',report);continue;}
      if(a.lactatingUntil>=s.day&&fraction>=.99&&a.health>=60&&a.species!=='pig'){
        // Young receive their share first. Milk is replenished once at dusk,
        // can be collected next workday, and never stacks across missed days.
        a.milkAvailable=Math.max(0,k.milk-(a.nursingUntil>=s.day?1:0));
      }
    }
    const living=animals.filter(animalAlive),target=Math.min(livestockBuildingRules.enclosure.capacity,livestockTarget(s,pen.camp)+2);
    if(cared&&(roofBuilt||s.local.season!=='Winter')&&s.local.stock.hay>=living.filter(a=>a.species!=='pig').reduce((n,a)=>n+livestockFeed(s,a),0)*3)
      breedLivestock(s,living,target,report);
  }
  // The experienced distant household works too: one person gathers fodder,
  // the other tends its finite herd. It has no trade restock timer.
  const r=h.regional,regional=h.animals.filter(a=>animalAlive(a)&&a.location==='regional');
  if(regional.length){
    r.careDays++;const winter=s.local.season==='Winter';
    r.grass=Math.min(160,r.grass+(winter?0:30));r.mast=Math.min(120,r.mast+(winter?0:s.local.season==='Autumn'?14:8));
    for(const batch of r.hayBatches){if((s.local.climate?.mm||0)<2&&!winter)batch.dryDays++;else batch.wetDays++;if(batch.dryDays>=livestockRules.hayDryDays){r.hay+=batch.amount;batch.done=true;}else if(batch.wetDays>=livestockRules.hayWetSpoilDays)batch.done=true;}
    r.hayBatches=r.hayBatches.filter(b=>!b.done);
    if(!winter&&(s.local.climate?.mm||0)<2&&r.grass>=16&&r.hay+r.hayBatches.reduce((n,b)=>n+b.amount,0)<560){r.grass-=16;r.hayBatches.push({amount:16,dryDays:0,wetDays:0});}
    else if(!winter&&r.mast>=8&&r.grain<200){r.mast-=8;r.grain+=8;}
    for(const a of regional){
      a.age++;const need=livestockFeed(s,a),key=a.species==='pig'?'mast':'grass',grazing=winter?0:Math.min(r[key],need);r[key]-=grazing;
      const store=a.species==='pig'?'grain':'hay',stored=Math.min(r[store],need-grazing);r[store]-=stored;
      const unweaned=a.motherId!==null&&a.age<livestockYear(s)*.2,mother=unweaned?regional.find(m=>m.id===a.motherId&&animalAlive(m)&&m.lactatingUntil>=s.day&&m.lastFed>=.99):null;
      if(unweaned){r[key]+=grazing;r[store]+=stored;}
      const enough=unweaned?!!mother:grazing+stored>=need-.001;a.lastFed=Number(enough);a.fedDays=enough?a.fedDays+1:0;a.condition=Math.max(0,Math.min(100,a.condition+(enough?2:-6)));a.health=Math.max(0,Math.min(100,a.health+(enough?2:-4)));
      if(a.health<=0||unitAge(s,a)>=livestockKinds[a.species].life)endAnimal(s,a,'regional herd loss',null);
    }
    for(const species of Object.keys(livestockKinds)){
      const group=regional.filter(a=>animalAlive(a)&&a.species===species);
      breedLivestock(s,group,livestockKinds[species].space*(species==='cattle'?6:8),report,true);
      const surplus=group.filter(a=>unitAge(s,a)>=livestockKinds[species].adult&&!a.pregnancy).sort((a,b)=>b.age-a.age);
      for(const a of surplus)if(group.filter(b=>animalAlive(b)&&b.sex===a.sex&&unitAge(s,b)>=livestockKinds[species].adult).length>3){
        endAnimal(s,a,'slaughtered by distant household',null);r.food=(r.food||0)+livestockKinds[species].meat;
      }
    }
  }
}
export function cattleFieldWork(s,v){
  const h=s.local?.husbandry,pen=livestockPen(s,animalCamp(s,v));if(!h||!pen||!v.practice.known.oxtraining)return 0;
  const ox=herdAt(s,pen).find(a=>a.yoked&&a.health>=70&&a.condition>=75&&a.lastFed>=.99&&a.tractionDay!==s.day);
  if(!ox)return 0;ox.tractionDay=s.day;ox.condition=Math.max(0,ox.condition-3);h.stats.traction++;return 1;
}
export function livestockSummary(s){
  const h=s.local?.husbandry;if(!h)return null;
  const animals=villageLivestock(s),pens=h.pens;
  return {animals,pens,contact:h.contacts.herders,hay:s.local.stock.hay,hayDrying:h.batches.reduce((n,b)=>n+b.amount,0),winterNeed:pens.reduce((n,p)=>n+livestockWinterNeed(s,p),0),stats:h.stats};
}
