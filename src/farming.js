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
  if(!s.config.learning||!soil||soil.readyDay>s.day||soil.remaining<=0)return 0;
  soil.remaining--;return boneSoilRules.yieldBonus;
}

// A later cereal crop supplements the existing kitchen gardens. Days are game
// pacing, not historical dates; successful observation and crafts still matter.
export const wheatRules={earliestDay:360,observedSeasons:6,ripeAt:24,harvest:24,batch:4,bread:8};
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
  (s.farming.crops?.[i]!=='wheat'||s.local.stock.wheat<grainCapacity(s)));}
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
export function cerealReady(s,v,id){
  if(cerealCamp(s,v)===null)return false;
  const p=v.practice;
  if(id==='wheatgrowing')return cerealDependencies(s,'wheat cultivation')&&
    ((p.farmingDays||0)>=3||(p.skills.berries||0)>=8);
  if(id==='quernmaking')return cerealDependencies(s,'saddle quern')&&(p.skills.stone||0)>=2;
  if(id==='milling')return hasLocalQuern(s,v)&&s.local.stock.wheat>=wheatRules.batch+seedReserve(s)&&
    s.local.stock.flour<Math.max(12,s.villagers.length*2);
  if(id==='breadmaking')return cerealDependencies(s,'hearth flatbread')&&s.fireLit&&
    (cerealCamp(s,v)===0||s.campFires?.[v.tribe||0])&&s.wood>s.config.settlement.fuelReserve&&
    s.food<=s.config.limits.stock-wheatRules.bread&&s.local.stock.flour>=wheatRules.batch;
  return false;
}
export function seedReserve(s){return Math.max(2,s.farming.plots.length);}
export const cerealRecipes=[
  ['wheatgrowing','Wheat cultivation','berries','perishable',['gathering','crude tools'],{wheat:1},'wheat cultivation',(s,v)=>cerealReady(s,v,'wheatgrowing')],
  ['quernmaking','Saddle-quern making','stone','fractures',['wheatgrowing','crude tools'],{quernStone:1},'saddle quern',(s,v)=>cerealReady(s,v,'quernmaking')],
  ['milling','Whole-grain milling','berries','perishable',['quernmaking'],{wheat:wheatRules.batch},'wholemeal flour',(s,v)=>cerealReady(s,v,'milling')],
  ['breadmaking','Hearth flatbread','berries','perishable',['milling','fire tending'],{flour:wheatRules.batch,wood:1},'hearth flatbread',(s,v)=>cerealReady(s,v,'breadmaking')]
];
export function gatherWildWheat(s,v,report){
  if(!s.config.learning||!['Summer','Autumn'].includes(s.local.season))return;
  const index=Math.floor(Math.max(0,s.day-1+(s.local.seasonOffset||0))/s.config.learning.seasonLength);
  if(!s.farming.seedSeasons.includes(index))s.farming.seedSeasons.push(index);
  // Mixed gathering trips bring a small, finite sample of wild grain home.
  if(s.day<240||(s.local.seedFinds||0)%8!==0||s.local.stock.wheat>=16||s.local.deposits.wheat<1)return;
  s.local.deposits.wheat--;s.local.stock.wheat++;
  if(report)(report.wildWheat??=[]).push(v.id);
}
export function finishCerealProduct(s,v,id,report){
  if(id==='quernmaking')s.farming.querns.push({camp:cerealCamp(s,v),builder:v.id,day:s.day});
  if(id==='milling'){s.local.stock.flour+=wheatRules.batch;s.farming.milled=(s.farming.milled||0)+wheatRules.batch;}
  if(id==='breadmaking'){
    s.food+=wheatRules.bread;s.farming.breadBaked=(s.farming.breadBaked||0)+wheatRules.bread;
    if(report){report.gatheredFood=(report.gatheredFood||0)+wheatRules.bread;(report.baking??=[]).push({id:v.id,food:wheatRules.bread});}
  }
}
// Food work can proceed while reserves are low, but never at the expense of
// urgent hunger, cold, illness or exhaustion. No multi-day task locks an actor.
export function cerealFoodWork(s,v,make,report){
  if(cerealCamp(s,v)===null||v.age<s.config.life.adult||v.illnessDays||
    v.fullness<s.config.needs.emergencyFullness||v.warmth<s.config.needs.warmUpBelow||
    v.health<s.config.needs.unwellBelow||v.practice.energy<32)return null;
  if(s.food>=Math.min(s.config.limits.stock-wheatRules.bread,s.villagers.length*4))return null;
  for(const [id,action] of [['breadmaking','Bake hearth flatbread'],['milling','Grind wheat into flour']]){
    if(v.practice.known[id]&&make(s,v,id,report))return action;
  }
  return null;
}
export function cerealStudyReady(s,v){
  return cerealIds.some(id=>!v.practice.known[id]&&cerealReady(s,v,id))||
    !!v.practice.known.quernmaking&&!hasLocalQuern(s,v);
}
