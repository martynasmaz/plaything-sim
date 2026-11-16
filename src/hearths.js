import {SCENARIO} from './scenario.js';
export const hearthRules=SCENARIO.hearths;
export const ovenFinished=p=>!!p&&(p.work||0)>=hearthRules.ovenWork;
export const localOven=(s,v)=>s.local?.daughter?.members.includes(v?.id)?null:s.local?.ovens?.[v?.tribe||0];
export const hasOven=(s,v)=>ovenFinished(localOven(s,v));
export const knowsCharcoal=(s,v)=>!!v?.practice?.known.charcoal;
export function fuelHeat(s,v){return s.wood+(knowsCharcoal(s,v)?(s.local?.stock.charcoal||0)*hearthRules.charcoalHeat:0);}
// Physical mixed-fuel debit. Charcoal is stored fuel, never free energy.
export function cookingFuel(s,v,heat){
  const charcoal=knowsCharcoal(s,v)?s.local.stock.charcoal||0:0;
  const fromCharcoal=Math.min(charcoal,heat/hearthRules.charcoalHeat);
  const wood=Math.max(0,heat-fromCharcoal*hearthRules.charcoalHeat);
  if(wood>Math.max(0,s.wood-s.config.settlement.fuelReserve)+1e-9)return null;
  return {...(fromCharcoal?{charcoal:fromCharcoal}:{}),...(wood?{wood}: {})};
}
export function charcoalTarget(s){
  const daily=s.villagers.length*(SCENARIO.progression.wheat.fuel/SCENARIO.progression.wheat.bread);
  return Math.min(24,Math.max(4,Math.ceil(daily*hearthRules.reserveDays/hearthRules.charcoalHeat)));
}
export function charcoalReady(s,v,foodReady=false){
  return s.fireKnown&&(v.practice.skills.wood||0)>=2&&foodReady&&
    s.wood>=hearthRules.charcoalWood+s.config.settlement.fuelReserve+(s.tribeCount||1)*s.config.fire.dailyFuel;
}
export const ovenFoodExperience=v=>(v.practice.used.breadmaking||0)>=hearthRules.ovenBakesBeforeStudy||
  (v.practice.used.drying||0)>=hearthRules.ovenDryingBeforeStudy;
export function ovenStudyReady(s,v){
  return s.fireKnown&&ovenFoodExperience(v)&&
    ((v.practice.skills.clay||0)>=hearthRules.ovenClayExperience||(v.practice.used.shaping||0)>=1);
}
export const ovenRecipe=['clayovens','Earthen bread ovens','clay','mouldable',['shaping','fire tending'],
  {clay:hearthRules.ovenTrialClay},'earthen oven',ovenStudyReady];
// Called by the normal scheduler with its existing material/site/work helpers.
export function ovenWork(s,v,report,h){
  const p=v.practice,camp=v.tribe||0;
  if(!p.known.clayovens||s.local.daughter?.members.includes(v.id)||!h.safe(s,v)||!h.foodReady(s,v,2)||
    !ovenRecipe[4].every(id=>p.known[id]))return false;
  const ovens=s.local.ovens??={},existing=ovens[camp];if(ovenFinished(existing))return false;
  const site=existing?.site||h.site(s,camp);if(!site)return false;
  const project=existing||{camp,site,work:0,founderId:v.id,startedDay:s.day,spent:{},supplies:{},clearedTrees:[]};
  project.spent??={};project.supplies??={};
  const tree=h.tree(s,site);
  if(tree!==null){
    if(!h.canClear(s,v))return false;
    ovens[camp]=project;h.clear(s,v,project,site,report);h.finish(s,v,'wood');v.activity='Clear oven site';
  }else{
    // Equal fractions of the configured total are paid on every real workday.
    const cost=Object.fromEntries(Object.entries(hearthRules.ovenCost).map(([k,n])=>[k,n/hearthRules.ovenWork]));
    const reserve=s.config.settlement.fuelReserve+(s.tribeCount||1)*s.config.fire.dailyFuel;
    if(s.wood<reserve+Math.max(0,cost.wood-(project.supplies.wood||0)))return false;
    const missing=['clay','stone'].find(k=>(s.local.stock[k]||0)+(project.supplies[k]||0)<cost[k]);
    if(missing){
      if((s.local.deposits[missing]||0)<1)return false;
      ovens[camp]=project;const amount=h.take(s,missing,Math.ceil(cost[missing]-(project.supplies[missing]||0)));
      project.supplies[missing]=(project.supplies[missing]||0)+amount;
      h.finish(s,v,missing==='clay'?'Gather clay':'invent');v.activity='Collect '+missing+' for oven';
      report.actions.push({id:v.id,action:v.activity,site:h.materialSite(missing),gained:0});return true;
    }
    ovens[camp]=project;
    for(const [key,n] of Object.entries(cost)){
      const held=Math.min(n,project.supplies[key]||0);project.supplies[key]=(project.supplies[key]||0)-held;
      (key==='wood'?s:s.local.stock)[key]-=n-held;project.spent[key]=(project.spent[key]||0)+n;
    }
    project.work++;project.lastBuilder=v.id;project.lastWorkedDay=s.day;
    if(ovenFinished(project))project.finishedDay=s.day;
    p.used.clayovens=(p.used.clayovens||0)+1;h.finish(s,v,'Gather clay');v.activity='Build earthen oven';
  }
  report.actions.push({id:v.id,action:v.activity,site,gained:0});return true;
}
