// Recovery and winter meal planning. Forecasts grant no food or buildings;
// every actual meal still debits the ordinary physical food accounts.
import {SCENARIO} from './scenario.js';
export const nutritionRules=SCENARIO.nutrition;
export const nutritionEnabled=s=>!!s.config.learning&&nutritionRules.enabled;
export function initNutrition(v){
  const n=v.nutrition??={hungerInjury:0,fedDays:0,winterDays:0,lastMealDay:null};
  n.hungerInjury??=0;n.fedDays??=0;n.winterDays??=0;n.lastMealDay??=null;return n;
}
const appetite=(s,v,after=0)=>v.age+after<(s.config.childhood?.infantUntil||0)?s.config.childhood.infantAppetite:1;
const winterIndex=s=>Math.floor(Math.max(0,s.day-1+(s.local?.seasonOffset||0))/s.config.learning.seasonLength);
export function forecastMeals(s,people,days,{winter=false,today=false}={}){
  if(s.config.needs.eatsFood===false)return 0;
  let food=0;const c=s.config;
  for(const v of people){let fullness=v.fullness;
    const threshold=v.traits?.includes('Grabby')?c.personality.grabbyEatAtOrBelow:c.needs.eatAtOrBelow;
    for(let i=0;i<Math.ceil(days);i++){
      if(i||!today)fullness=Math.max(0,fullness-c.needs.fullnessLoss*appetite(s,v,i+(today?0:1)));
      const index=Math.floor(Math.max(0,s.day-1+(s.local?.seasonOffset||0)+i+(today?0:1))/c.learning.seasonLength)%4;
      const cost=c.needs.mealCost*((winter||index===3)?c.needs.winterMealFraction??1:1);
      if(fullness<=threshold){food+=cost;fullness=Math.min(c.limits.need,fullness+c.needs.mealFullness);}
    }
  }
  return food;
}
const community=(s,v)=>s.local?.daughter?.members.includes(v.id)?'east':v.tribe||0;
function protectedEater(s,v){
  const n=initNutrition(v),c=s.config;
  return v.age<c.life.adult||v.age>=c.life.elder||v.illnessDays>0||v.health<nutritionRules.rationHealthyHealth||
    n.hungerInjury>0||v.practice?.energy<32||v.family?.goal==='care'||!!v.campJourney;
}
export function planWinterMeals(s,report,foodSupply){
  if(s.config.needs.eatsFood===false||!nutritionEnabled(s)||!nutritionRules.winterRationing||winterIndex(s)%4!==3){
    if(s.local)delete s.local.winterRations;return;
  }
  const c=s.config,length=c.learning.seasonLength,remaining=length-(Math.max(0,s.day-1+(s.local.seasonOffset||0))%length);
  const plans={},communities=[...new Set(s.villagers.map(v=>community(s,v)))];
  const homeCount=Math.max(1,s.villagers.filter(v=>community(s,v)!=='east').length),observed=s.local.winterFoodObservation;
  const winterIncome=observed?.days>=3?observed.home/observed.days:s.local.lastWinterFood?.home||0;
  for(const camp of communities){
    const members=s.villagers.filter(v=>community(s,v)===camp),adults=members.filter(v=>v.age>=c.life.adult);
    const experienced=adults.some(v=>initNutrition(v).winterDays>=nutritionRules.rationExperienceDays||
      (v.practice?.winterFoodDays||0)>=nutritionRules.rationExperienceDays);
    const available=foodSupply(s,camp)+members.reduce((n,v)=>n+(v.travelMeals||0),0);
    const demand=forecastMeals(s,members,remaining,{winter:true,today:true});
    // Discount observed output; ingredients, wet racks and a neighboring
    // camp's private reserve cannot be counted as this camp's finished meals.
    const dailyIncome=camp==='east'?0:winterIncome*members.length/homeCount*nutritionRules.rationIncomeConfidence;
    const buffer=forecastMeals(s,members,nutritionRules.rationSafetyDays,{winter:true});
    const active=experienced&&available+dailyIncome*remaining<demand+buffer;
    const participants=members.filter(v=>!protectedEater(s,v)).sort((a,b)=>a.id-b.id);
    plans[camp]={active,remainingDays:remaining,members:members.length,available,projectedIncome:dailyIncome*remaining,
      forecastDemand:demand,safetyBuffer:buffer,experienced,
      mealTurnIds:participants.filter((v,i)=>(s.day+i)%2===0).map(v=>v.id)};
  }
  s.local.winterRations={day:s.day,communities:plans};report.winterRations=structuredClone(s.local.winterRations);
}
export function winterMealThreshold(s,v,ordinary=s.config.needs.eatAtOrBelow){
  if(!nutritionEnabled(s)||protectedEater(s,v))return ordinary;
  const plan=s.local?.winterRations;
  if(plan?.day!==s.day||!plan.communities[community(s,v)]?.active)return ordinary;
  const c=s.config,n=c.needs,local=plan.communities[community(s,v)];
  // A voluntary skip requires yesterday's actual meal and enough stored
  // fullness to remain above the recovery floor after tomorrow's loss.
  // No consecutive skips, and the selected meal group keeps normal access.
  if(initNutrition(v).lastMealDay!==s.day-1||local.mealTurnIds.includes(v.id))return ordinary;
  const safe=Math.max(n.damageAtOrBelow,nutritionRules.rationReserveFullness)+n.fullnessLoss*appetite(s,v);
  return Math.min(ordinary,safe-1e-6);
}
export function resolveNutrition(s,v,report,{hungerDamage=0,otherDamage=0,genericHealing=0}={}){
  if(!nutritionEnabled(s))return;
  const n=initNutrition(v),c=s.config;
  n.hungerInjury=Math.min(c.limits.need-v.health,Math.max(0,n.hungerInjury+hungerDamage-genericHealing));
  if(winterIndex(s)%4===3)n.winterDays++;
  const ate=report.meals.includes(v.id),fed=ate||s.config.needs.eatsFood===false;
  if(ate)n.lastMealDay=s.day;
  const adequatelyFed=fed&&!hungerDamage&&!otherDamage&&!v.illnessDays&&
    v.fullness>=nutritionRules.recoveryFullness&&v.warmth>=nutritionRules.recoveryWarmth;
  n.fedDays=adequatelyFed?n.fedDays+1:0;
  if(v.health>0&&n.fedDays>=nutritionRules.recoveryFedDays&&n.hungerInjury>0){
    const restored=Math.min(n.hungerInjury,c.limits.need-v.health);v.health+=restored;n.hungerInjury-=restored;
    (report.nutritionRecoveries??=[]).push({id:v.id,restored,fedDays:n.fedDays});
  }
  const plan=s.local?.winterRations;
  if(!fed&&plan?.day===s.day&&plan.communities[community(s,v)]?.active&&!protectedEater(s,v)&&
    v.fullness<=c.needs.eatAtOrBelow&&v.fullness>winterMealThreshold(s,v))
    (report.rationDeferrals??=[]).push(v.id);
}
