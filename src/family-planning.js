import {SCENARIO} from './scenario.js';
import {communityOf} from './provisions.js';
import {familyDesire,familyMotivationEnabled,familyMotivationRules} from './family-motivation.js';

export const familyPlanningRules=SCENARIO.progression.familyPlanning;
// This is remembered experience, not an inherited trait or a village unlock.
// Old saves start observing now; neither famine nor knowledge is invented.
export function recordFamilyExperience(s,report){
  const hungry=v=>v.fullness<s.config.needs.recoveryMin&&
    (!report.meals.includes(v.id)||report.damage.some(d=>d.id===v.id&&d.causes.includes('hunger')));
  const lean=new Set(),leanChildren=new Set();
  for(const v of s.villagers)if(hungry(v)){
    lean.add(communityOf(s,v));if(v.age<s.config.life.adult)leanChildren.add(communityOf(s,v));
  }
  for(const v of s.villagers){
    const p=v.practice,e=p.familyExperience??={careDays:0,shortageDays:0,childShortageDays:0};
    if(e.lastDay===s.day)continue;e.lastDay=s.day;
    const community=communityOf(s,v);
    if(lean.has(community))e.shortageDays++;
    if(leanChildren.has(community))e.childShortageDays++;
    if(v.age>=s.config.life.adult&&s.villagers.some(child=>child.age<s.config.life.adult&&
      communityOf(s,child)===community&&(child.carers||child.parents||[]).includes(v.id)))e.careDays++;
  }
}
export function familyPlanningFoundation(s,v){
  const p=v.practice,store=communityOf(s,v)==='east'?s.local.daughter:s.local.campStores?.[v.tribe||0];
  return v.age>=s.config.life.adult&&!!p.known.gathering&&!!p.known.drying&&
    p.properties.includes('perishable')&&
    (p.skills.berries||0)>=3&&(p.familyExperience?.careDays||0)>=familyPlanningRules.careDays&&
    !!(store?.built||store?.settled);
}
export function familyPlanningStudyReady(s,v){
  const e=v.practice.familyExperience;
  return familyPlanningFoundation(s,v)&&(e?.shortageDays||0)>=familyPlanningRules.shortageDays&&
    (e?.childShortageDays||0)>=familyPlanningRules.childShortageDays;
}
// Independent, seeded reflection opportunities leave weather/illness dice alone.
// Even an eligible survivor may never find the time or complete the practice.
export function familyReflectionOpportunity(s,v){
  let h=Math.imul(s.seed^Math.imul(v.id+1,1597334677)^Math.imul(s.day+1,2246822519)^0x371a,3266489917);
  const roll=((h^(h>>>16))>>>0)/4294967296;
  return roll<familyPlanningRules.reflectionChance;
}
export const familyPlanningRecipe=['familyplanning','Household planning','berries','perishable',
  ['gathering','drying'],{},'household food plan',familyPlanningStudyReady];

export function willingToHaveChild(s,v){
  return !!v&&v.wantsChildren!==false&&v.happiness>=s.config.birth.happiness&&
    (!familyMotivationEnabled(s)||familyDesire(s,v)>=familyMotivationRules.willingnessThreshold);
}
export function familyPlan(s,mother,father){
  const learned=[mother,father].some(v=>v?.practice?.known.familyplanning);
  // Learned knowledge survives. A family decision is mutual willingness,
  // never a forecast of the pantry, harvest or somebody else's hunger.
  const ready=willingToHaveChild(s,mother)&&willingToHaveChild(s,father);
  return {learned,ready,reason:ready?'Both people are willing to have a child':'Waiting for both people to want a child'};
}
export function rememberFamilyDecision(s,mother,father,decision){
  if(!decision.learned)return;
  for(const v of [mother,father])if(v?.practice?.known.familyplanning){
    const p=v.practice;
    if(p.familyDecision?.day!==s.day)p.used.familyplanning=(p.used.familyplanning||0)+1;
    p.familyDecision={day:s.day,...decision};
  }
}
