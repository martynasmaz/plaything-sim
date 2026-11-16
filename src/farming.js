import {pantryCapacity,seasonalPantryTarget,grainReserveTarget} from './provisions.js';
import {developmentEnabled} from './development.js';
import {SCENARIO} from './scenario.js';
import {primaryFoodYield} from './food-yields.js';
import {hasOven,cookingFuel,knowsCharcoal,hearthRules} from './hearths.js';
// Coarse ground bone is a delayed soil amendment, independent of magic.
export const boneSoilRules={bonesPerBatch:4,mealPerBatch:2,harvests:3,yieldBonus:2};
export function boneFertilizerReady(s,v){
  return !!s.config.learning&&s.farming.known&&s.toolkit?.includes('hammer stone')&&
    (v.practice.farmingDays||0)>=3&&(v.practice.skills.stone||0)>=2;
}
export function boneSoilPlot(s){
  return s.farming.plots.findIndex((_,i)=>(s.farming.boneSoil?.[i]?.remaining||0)<=0);
}
export const boneMealRecipe=['bonemeal','Ground bone fertilizer','stone','fractures',['crude tools'],
  {bone:boneSoilRules.bonesPerBatch},'bone meal',(s,v)=>boneFertilizerReady(s,v)&&
    boneSoilPlot(s)>=0&&(s.local.stock.boneMeal||0)<s.farming.plots.length];
export function applyBoneFertilizer(s,v,report){
  const i=boneSoilPlot(s);
  if(!v.practice.known.bonemeal||!boneFertilizerReady(s,v)||i<0||s.local.stock.boneMeal<1||s.local.season==='Winter')return false;
  s.local.stock.boneMeal--;
  s.farming.boneSoil??={};
  s.farming.boneSoil[i]={appliedDay:s.day,readyDay:s.day+s.config.learning.seasonLength,remaining:boneSoilRules.harvests};
  if(report)(report.fertilizerApplied??=[]).push({id:v.id,plot:i});
  return true;
}
export function boneHarvestBonus(s,index){
  const soil=s.farming.boneSoil?.[index];
  if(!s.config.learning)return 0;
  let bonus=0;
  if(soil&&soil.readyDay<=s.day&&soil.remaining>0){soil.remaining--;bonus+=boneSoilRules.yieldBonus;}
  const manure=s.farming.manureSoil?.[index];
  if(manure&&manure.readyDay<=s.day&&manure.remaining>0){manure.remaining--;bonus+=SCENARIO.livestock.compostYieldBonus;}
  return bonus;
}

// A later cereal crop supplements the existing kitchen gardens. Days are game
// pacing, not historical dates; successful observation and crafts still matter.
export const wheatRules=SCENARIO.progression.wheat;
export const cerealIds=['wheatgrowing','quernmaking','milling','breadmaking'];
export function initCereals(s){
  if(!s.local)return;
  s.local.stock.wheat??=0;s.local.stock.flour??=0;s.local.stock.quernStone??=0;
  s.farming.crops??={};s.farming.seedSeasons??=[];s.farming.querns??=[];
}
export function cerealCamp(s,v){return s.local?.daughter?.members.includes(v.id)?null:v.tribe||0;}
export function grainCapacity(s){return 24+12*((s.local?.jars||0)+(s.pottery?.jars||0))+8*(s.huts?.length||0);}
export function cropRipeAt(s,index){return s.farming.crops?.[index]==='wheat'?wheatRules.ripeAt:s.config.farming.ripeAt;}
export function ripePlot(s){return s.farming.plots.findIndex((growth,i)=>growth!==null&&growth>=cropRipeAt(s,i)&&
  (!s.config.learning||(s.farming.crops?.[i]==='wheat'?s.local.stock.wheat<grainCapacity(s):s.food<pantryCapacity(s))));}
export function cerealDependencies(s,name){
  if(!s.config.learning||!s.local)return false;
  if(name==='wheat cultivation')return s.farming.known&&s.day>=wheatRules.earliestDay&&
    s.farming.seedSeasons?.length>=wheatRules.observedSeasons&&s.toolkit?.includes('digging stick');
  if(name==='saddle quern')return s.farming.known&&s.toolkit?.includes('hammer stone')&&
    (s.farming.wheatHarvests||0)>0;
  if(name==='wholemeal flour')return s.farming.querns?.length>0;
  if(name==='hearth flatbread')return s.fireKnown&&s.farming.querns?.length>0;
  return true;
}
export function hasLocalQuern(s,v){return s.farming.querns?.some(q=>q.camp===cerealCamp(s,v));}
export function availableLocalQuern(s,v){return s.farming.querns?.find(q=>q.camp===cerealCamp(s,v)&&q.workDay!==s.day);}
export function quernSite(s,quern){
  if(quern.site)return quern.site;
  const home=[[227,222],[802,433],[702,153]][quern.camp],index=s.farming.querns.filter(q=>q.camp===quern.camp).indexOf(quern);
  return [home[0]-25-Math.max(0,index)*17,home[1]+25+Math.max(0,index)%2*14];
}
export function needsLocalQuern(s,v){
  const camp=cerealCamp(s,v);if(camp===null)return false;
  const querns=s.farming.querns.filter(q=>q.camp===camp),residents=s.villagers.filter(p=>cerealCamp(s,p)===camp).length;
  return !querns.length||querns.length<Math.ceil(residents/wheatRules.peoplePerQuern)&&querns.every(q=>q.workDay>=s.day-1)&&s.local.stock.wheat>=wheatRules.batch+seedReserve(s);
}
export function cerealReady(s,v,id){
  if(cerealCamp(s,v)===null)return false;
  const p=v.practice;
  if(id==='wheatgrowing')return cerealDependencies(s,'wheat cultivation')&&
    ((p.farmingDays||0)>=3||(p.skills.berries||0)>=8);
  if(id==='quernmaking')return cerealDependencies(s,'saddle quern')&&(p.skills.stone||0)>=2;
  if(id==='milling')return hasLocalQuern(s,v)&&!!cerealBatch(s,id);
  if(id==='breadmaking')return cerealDependencies(s,'hearth flatbread')&&bakingHeatReady(s,v)&&!!cerealBatch(s,id,v);
  return false;
}
// Plan before paying: the exact same batch is used for debit and output.
// Up to one full batch per workday; small existing stocks remain usable.
export function bakingHeatReady(s,v){return s.fireKnown&&(hasOven(s,v)||s.fireLit&&(cerealCamp(s,v)===0||s.campFires?.[v.tribe||0]));}
export function bakingFuelMissing(s,v){
  return !!v.practice.known.breadmaking&&s.local.stock.flour>=1&&s.fireKnown&&
    pantryCapacity(s)-s.food>=wheatRules.bread/wheatRules.batch&&!cerealBatch(s,'breadmaking',v);
}
export function cerealBatch(s,id,v){
  const maximum=wheatRules.batch;
  if(id==='milling'){
    const target=developmentEnabled(s,'planning')?Math.min(grainCapacity(s),grainReserveTarget(s)):Math.max(12,s.villagers.length*2);
    const amount=Math.min(maximum,Math.floor(s.local.stock.wheat-seedReserve(s)),Math.floor(target-s.local.stock.flour));
    return amount>0?{amount,output:amount,cost:{wheat:amount}}:null;
  }
  if(id==='breadmaking'){
    const outputPerFlour=wheatRules.bread/maximum,fuelPerFlour=wheatRules.fuel/maximum*(hasOven(s,v)?hearthRules.ovenFuelMultiplier:1);
    const capacity=developmentEnabled(s,'planning')?pantryCapacity(s):s.config.limits.stock;
    const charcoalHeat=knowsCharcoal(s,v)?(s.local.stock.charcoal||0)*hearthRules.charcoalHeat:0;
    const available=Math.max(0,s.wood-s.config.settlement.fuelReserve)+charcoalHeat;
    const amount=Math.min(maximum,Math.floor(s.local.stock.flour),Math.floor((capacity-s.food)/outputPerFlour),Math.floor(available/fuelPerFlour));
    const fuel=amount>0?cookingFuel(s,v,amount*fuelPerFlour):null;
    return fuel?{amount,output:amount*outputPerFlour,cost:{flour:amount,...fuel}}:null;
  }
  return null;
}
export function wheatPlotTarget(s){
  const processors=s.villagers.some(p=>p.practice?.known.milling);
  return processors?Math.max(1,Math.floor(s.farming.plots.length/2)):1;
}
export function seedReserve(s){
  const planted=s.farming.plots.filter((x,i)=>x!==null&&s.farming.crops?.[i]==='wheat').length;
  // Reserve the existing cereal beds and the next intended sowing, not seed
  // for every kitchen garden. Two portions retain a small founding seed stock.
  return Math.max(2,planted,s.villagers.some(v=>v.practice?.known.wheatgrowing)?wheatPlotTarget(s):0);
}
export const cerealRecipes=[
  ['wheatgrowing','Wheat cultivation','berries','perishable',['gathering','crude tools'],{wheat:1},'wheat cultivation',(s,v)=>cerealReady(s,v,'wheatgrowing')],
  ['quernmaking','Saddle-quern making','stone','fractures',['wheatgrowing','crude tools'],{quernStone:1},'saddle quern',(s,v)=>cerealReady(s,v,'quernmaking')],
  ['milling','Whole-grain milling','berries','perishable',['gathering','crude tools'],{wheat:wheatRules.batch},'wholemeal flour',(s,v)=>cerealReady(s,v,'milling')],
  ['breadmaking','Hearth flatbread','berries','perishable',['milling','fire tending'],{flour:wheatRules.batch,wood:wheatRules.fuel},'hearth flatbread',(s,v)=>cerealReady(s,v,'breadmaking')]
];
export function gatherWildWheat(s,v,report){
  if(!s.config.learning||!['Summer','Autumn'].includes(s.local.season))return;
  const index=Math.floor(Math.max(0,s.day-1+(s.local.seasonOffset||0))/s.config.learning.seasonLength);
  if(!s.farming.seedSeasons.includes(index))s.farming.seedSeasons.push(index);
  // Mixed gathering trips bring a small, finite sample of wild grain home.
  if(s.day<wheatRules.seedFindFromDay||(s.local.seedFinds||0)%wheatRules.seedFindEvery!==0||s.local.stock.wheat>=16||s.local.deposits.wheat<1)return;
  s.local.deposits.wheat--;s.local.stock.wheat+=primaryFoodYield(s,1);
  if(report)(report.wildWheat??=[]).push(v.id);
}
export function finishCerealProduct(s,v,id,report,batch){
  if(id==='quernmaking'){
    const quern={camp:cerealCamp(s,v),builder:v.id,day:s.day};s.farming.querns.push(quern);quern.site=quernSite(s,quern);
    if(report)(report.quernWork??=[]).push({id:v.id,site:quern.site});
  }
  if(id==='milling'){
    const quern=availableLocalQuern(s,v);if(!quern)return false;
    quern.workDay=s.day;quern.workerId=v.id;
    if(report)(report.milling??=[]).push({id:v.id,site:quernSite(s,quern)});
    const amount=batch.amount;
    s.local.stock.flour+=amount;s.farming.milled=(s.farming.milled||0)+amount;
  }
  if(id==='breadmaking'){
    s.food+=batch.output;s.farming.breadBaked=(s.farming.breadBaked||0)+batch.output;
    if(report){report.gatheredFood=(report.gatheredFood||0)+batch.output;(report.baking??=[]).push({id:v.id,food:batch.output});}
  }
}
// Hunger makes useful meal preparation more urgent. Cold, illness, low health
// and exhaustion still release the workday; every batch is chosen afresh.
export function cerealFoodWork(s,v,make,report,supervise=()=>false){
  if(cerealCamp(s,v)===null||v.age<s.config.life.adult||v.illnessDays||
    v.warmth<s.config.needs.warmUpBelow||
    v.health<s.config.needs.unwellBelow||v.practice.energy<32)return null;
  if(s.food>=(developmentEnabled(s,'planning')?seasonalPantryTarget(s):Math.min(s.config.limits.stock-wheatRules.bread,s.villagers.length*4)))return null;
  for(const [id,action] of [['breadmaking','Bake hearth flatbread'],['milling','Grind wheat into flour']]){
    if(id==='milling'&&v.fullness<s.config.needs.emergencyFullness&&(!bakingHeatReady(s,v)||
      !cookingFuel(s,v,wheatRules.fuel/wheatRules.batch*(hasOven(s,v)?hearthRules.ovenFuelMultiplier:1))||!s.villagers.some(p=>cerealCamp(s,p)===cerealCamp(s,v)&&
      p.practice?.known.breadmaking&&!p.illnessDays&&p.warmth>=s.config.needs.warmUpBelow&&p.health>=s.config.needs.unwellBelow&&p.practice.energy>=32)))continue;
    if(v.practice.known[id]&&make(s,v,id,report)||supervise(s,v,id,report))return action;
  }
  return null;
}
export function shouldSowWheat(s,v){
  if(!v.practice.known.wheatgrowing||s.local.stock.wheat<1)return false;
  const wheat=s.farming.plots.filter((x,i)=>x!==null&&s.farming.crops[i]==='wheat').length;
  // Keep kitchen gardens while the slower grain/processing chain establishes.
  return wheat<wheatPlotTarget(s)&&
    (!s.farming.wheatHarvests||s.local.stock.wheat<(developmentEnabled(s,'planning')?Math.min(grainCapacity(s),grainReserveTarget(s)):grainReserveTarget(s)));
}
export function cerealStudyReady(s,v){
  return cerealIds.some(id=>!v.practice.known[id]&&cerealReady(s,v,id))||
    !!v.practice.known.quernmaking&&needsLocalQuern(s,v);
}
