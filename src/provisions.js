import {developmentEnabled} from './development.js';
import {forecastMeals} from './nutrition.js';
// Finished food only. Main-valley camps share the main pantry, but a camp's
// preserved stores can feed its own residents, not an inaccessible neighbor.
export function communityOf(s,v){return s.local?.daughter?.members.includes(v.id)?'east':v.tribe||0;}
export function communityMembers(s,community){return s.villagers.filter(v=>communityOf(s,v)===community);}
// Safety budgets use finished food actually accessible to this person. Recipe
// ingredients and journey payments still have their own physical accounts.
export const hasFoodReserve=(s,v,portions=2)=>foodDaysFor(s,v)>=portions;
// Read the calendar directly: dawn/care/travel may run before the cached
// season label is refreshed. Honor migrated saves' season offsets too.
export function mealCostFor(s,season=null){
  const c=s.config;
  if(!c.learning)return c.needs.mealCost;
  const index=Math.floor(Math.max(0,s.day-1+(s.local?.seasonOffset||0))/c.learning.seasonLength)%4;
  const winter=season===null?index===3:season==='Winter';
  return c.needs.mealCost*(winter?(c.needs.winterMealFraction??1):1);
}
export function serveLocalMeal(s,v,report,account,key,source){
  if(s.config.needs.eatsFood===false)return false;
  const cost=mealCostFor(s);
  if((report.meals||[]).includes(v.id)||!account||account[key]<cost)return false;
  account[key]-=cost;v.fullness=Math.min(s.config.limits.need,v.fullness+s.config.needs.mealFullness);
  (report.meals??=[]).push(v.id);
  (report.mealServings??=[]).push({id:v.id,amount:cost,source});
  if(account===s){s.local.dried=Math.min(s.local.dried||0,s.food);if(s.bankFood)s.bankFood=Math.min(s.bankFood,s.food);}
  return true;
}
export function pantryCapacity(s){
  const baskets=(s.textiles||[]).filter(name=>name.endsWith('basket')).length;
  return s.config.limits.stock+(s.local?.jars||0)*12+baskets*6+(s.pottery?.jars||0)*12+(s.fireTools?.includes('burn bowl')?8:0);
}
export function seasonalReserveDays(s){
  if(!developmentEnabled(s,'planning'))return 4;
  const length=s.config.learning.seasonLength,offset=Math.max(0,s.day-1+(s.local.seasonOffset||0)),season=Math.floor(offset/length)%4,age=offset%length;
  if(season===0)return 3;
  if(season===1)return 6;
  if(season===2)return 10;
  return Math.max(3,Math.min(10,(length-age)*.65));
}
export function seasonalPantryTarget(s){
  const home=s.villagers.filter(v=>communityOf(s,v)!=='east').length;
  const saved=Object.values(s.local?.campStores||{}).reduce((n,r)=>n+(r.saved||0),0);
  const desired=Math.ceil(s.config.learning?forecastMeals(s,s.villagers.filter(v=>communityOf(s,v)!=='east'),seasonalReserveDays(s)):
    home*s.config.needs.fullnessLoss/s.config.needs.mealFullness*seasonalReserveDays(s));
  // Keep the established founding buffer until real winter stores can take
  // over. Reducing fresh reserves before preservation exists starves the
  // first winter and prevents the tools/skills needed for later expansion.
  const freshFloor=saved>=home*4&&s.local.lastWinterFood?home*2:home*4;
  return Math.min(pantryCapacity(s),Math.max(freshFloor,desired-saved));
}
export function grainReserveTarget(s){
  return Math.max(12,Math.ceil(s.villagers.length*(developmentEnabled(s,'planning')?Math.max(2,seasonalReserveDays(s)/2):2)));
}
export function advanceDryingRacks(s){
  if(!s.config.learning)return;
  for(const v of s.villagers)s.local.campStores[v.tribe||0]??={saved:0,rack:0};
  if((s.local.climate?.mm||0)>=10)return;
  for(const store of Object.values(s.local.campStores)){store.saved+=store.rack||0;store.rack=0;}
}
export function communityFoodSupply(s,community){
  const count=Math.max(1,communityMembers(s,community).length);
  if(community==='east')return s.local.daughter.food;
  const counts=new Map();for(const person of s.villagers){const camp=communityOf(s,person);if(camp!=='east')counts.set(camp,(counts.get(camp)||0)+1);}
  const groups=[...counts].map(([camp,n])=>({n,days:(s.local?.campStores?.[camp]?.saved||0)/n})).sort((a,b)=>a.days-b.days);
  let level=groups[0]?.days||0,covered=0,shared=s.food+(s.local?.stock.curds||0);
  // The shared pantry first raises the least-provisioned camps toward the
  // others. A well-stocked camp uses its own food rather than counting both
  // its private reserve and an equal share of the poorer camp's only meals.
  for(const group of groups){
    const needed=(group.days-level)*covered;
    if(needed>shared){level+=shared/covered;shared=0;break;}
    shared-=needed;level=group.days;covered+=group.n;
  }
  if(covered&&shared)level+=shared/covered;
  return Math.max(s.local?.campStores?.[community]?.saved||0,level*count);
}
export function foodDaysFor(s,v){
  const community=communityOf(s,v),count=Math.max(1,communityMembers(s,community).length);
  return (communityFoodSupply(s,community)/count+(v.travelMeals||0))/mealCostFor(s);
}
export function familyFoodBudget(s,mother,perPerson=s.config.birth.foodPerPerson,extra=s.config.birth.extraFood){
  const community=communityOf(s,mother),count=communityMembers(s,community).length;
  const cost=mealCostFor(s),required=(count*perPerson+extra)*cost;
  if(community==='east')return {available:s.local.daughter.food,required};
  const counts=new Map();for(const v of s.villagers){const camp=communityOf(s,v);if(camp!=='east')counts.set(camp,(counts.get(camp)||0)+1);}
  let protectedFood=0;for(const [camp,n] of counts)if(camp!==community)protectedFood+=Math.max(0,n*perPerson*cost-(s.local.campStores?.[camp]?.saved||0));
  // Protect other camps' existing mouths before allocating communal food to
  // this prospective child. A camp's own private provisions are never pooled.
  const available=(s.local.campStores?.[community]?.saved||0)+Math.max(0,s.food+(s.local.stock.curds||0)-protectedFood);
  return {available,required};
}
export function mainFoodRequired(s,parentCamp,perPerson=s.config.birth.foodPerPerson,extra=s.config.birth.extraFood){
  const counts=new Map();
  for(const v of s.villagers){const camp=communityOf(s,v);if(camp!=='east')counts.set(camp,(counts.get(camp)||0)+1);}
  let needed=0;
  for(const [camp,count] of counts){
    const target=(count*perPerson+(camp===parentCamp?extra:0))*mealCostFor(s);
    needed+=Math.max(0,target-(s.local?.campStores?.[camp]?.saved||0));
  }
  return Math.max(0,needed-(s.local?.stock.curds||0));
}
export function familyFoodReady(s,mother){
  const east=communityOf(s,mother)==='east';
  const budget=familyFoodBudget(s,mother,s.config.birth.foodPerPerson,s.config.birth.extraFood+(east?s.config.birth.foodPerPerson:0));
  return (communityOf(s,mother)!=='east'||s.local.daughter.settled)&&budget.available>=budget.required;
}
export function familyFoodSnapshot(s){
  return Object.fromEntries([...new Set(s.villagers.map(v=>communityOf(s,v)))].map(c=>[c,{available:communityFoodSupply(s,c),members:communityMembers(s,c).length}]));
}
export function familyFoodHistory(s,mother){
  const community=communityOf(s,mother),history=s.local?.provisionHistory||[];
  // Multi-camp saves have no evidence of which camp was hungry before this
  // version. Start observing locally; never attribute somebody else's history.
  const onlyOne=new Set(s.villagers.map(v=>communityOf(s,v))).size===1;
  return history.flatMap(day=>day.communities?.[community]?[day.communities[community]]:
    !day.communities&&onlyOne?[{change:day[community==='east'?'east':'home'],hungry:day[community==='east'?'hungryEast':'hungryHome'],investment:!!day.investment}]:[]);
}
export function foodLedger(s){
  let home=s.food+(s.local?.stock.curds||0),east=(s.local?.daughter?.food||0)+(s.local?.daughter?.returnFood||0);
  for(const store of Object.values(s.local?.campStores||{}))home+=(store.saved||0)+(store.rack||0);
  for(const v of s.villagers){if(communityOf(s,v)==='east')east+=v.travelMeals||0;else home+=v.travelMeals||0;}
  return {home,east};
}
export function recordFoodBalance(s,report){
  if(!report.foodAtDawn)return;
  const now=foodLedger(s),hungry={home:false,east:false};
  for(const v of s.villagers)if(v.fullness<s.config.needs.recoveryMin&&!report.meals.includes(v.id))hungry[communityOf(s,v)==='east'?'east':'home']=true;
  const history=s.local.provisionHistory??=[];
  const investment=developmentEnabled(s,'families')&&report.actions?.some(a=>/^(Build |Prepare a field|Clear field|Make saddle quern)/.test(a.action));
  const communities=familyFoodSnapshot(s);
  for(const [camp,record] of Object.entries(communities)){
    record.change=record.available-(report.familyFoodAtDawn?.[camp]?.available??record.available);
    record.hungry=s.villagers.some(v=>String(communityOf(s,v))===camp&&v.fullness<s.config.needs.recoveryMin&&!report.meals.includes(v.id));
    record.investment=!!investment;
  }
  history.push({day:s.day,home:now.home-report.foodAtDawn.home,east:now.east-report.foodAtDawn.east,hungryHome:hungry.home,hungryEast:hungry.east,communities,...(investment?{investment:true}:{})});
  if(history.length>7)history.shift();
  if(s.local.season==='Winter'){
    const index=Math.floor(Math.max(0,s.day-1+(s.local.seasonOffset||0))/s.config.learning.seasonLength);
    if(s.local.winterFoodObservation?.index!==index)s.local.winterFoodObservation={index,days:0,home:0,east:0};
    const observed=s.local.winterFoodObservation;observed.days++;
    for(const region of ['home','east']){
      const meals=report.meals.filter(id=>{const v=s.villagers.find(v=>v.id===id);return v&&(communityOf(s,v)==='east')===(region==='east');}).length;
      observed[region]+=Math.max(0,now[region]-report.foodAtDawn[region]+meals*mealCostFor(s));
    }
    for(const v of s.villagers)if(v.age>=s.config.life.adult&&v.practice?.known.drying)
      v.practice.winterFoodDays=(v.practice.winterFoodDays||0)+1;
  }else if(s.local.winterFoodObservation){
    const observed=s.local.winterFoodObservation;
    if(observed.days>=7){s.local.completedWinters=(s.local.completedWinters??(s.local.lastWinterFood?1:0))+1;s.local.lastWinterFood={home:observed.home/observed.days,east:observed.east/observed.days};}
    delete s.local.winterFoodObservation;
  }
}
export function familyFoodStable(s,mother){
  return familyFoodStability(s,mother).length===0;
}
export function familyFoodStability(s,mother){
  const history=familyFoodHistory(s,mother),reasons=[];
  if(history.some(day=>day.hungry))reasons.push('recent_local_hunger');
  // A newly loaded or founded world first gathers a week's actual evidence.
  // Stable reserves are sufficient: a full store cannot accumulate more food.
  // A declining stockpile still delays another child until the budget recovers.
  if(history.length>=7&&history.reduce((sum,day)=>sum+day.change,0)<0&&
    !(developmentEnabled(s,'families')&&history.some(day=>day.investment)&&foodDaysFor(s,mother)>=4))reasons.push('declining_food_reserves');
  return reasons;
}
export function rememberCampPeaks(s){
  if(!s.local)return;
  const peaks=s.local.campPeakPopulation??={},counts={};
  for(const v of s.villagers){const camp=communityOf(s,v);counts[camp]=(counts[camp]||0)+1;}
  // Old saves start with their observable local populations. A global peak
  // cannot tell us how many people used to live in any particular camp.
  for(const [camp,count] of Object.entries(counts))peaks[camp]=Math.max(peaks[camp]||0,count);
}
export function winterStorageTarget(s,residents,pantryCapacity){
  const camps=new Set(residents.map(v=>communityOf(s,v)));
  const peak=[...camps].reduce((sum,camp)=>sum+Math.max(s.local?.campPeakPopulation?.[camp]||0,
    s.villagers.filter(v=>communityOf(s,v)===camp).length),0);
  // A full winter at normal portions; neither anticipated gathering nor the
  // winter meal discount reduces the physical reserve we plan to build.
  return Math.ceil(peak*(s.config.learning?.seasonLength||10)*s.config.needs.mealCost);
}
// Packing takes real provisions out of the traveler's own community. The
// carried meals are later eaten, never copied into a second stock counter.
export function packLocalMeals(s,v,amount){
  if(communityOf(s,v)==='east'){
    const post=s.local.daughter;if(post.food<amount)return false;post.food-=amount;
  }else{
    const store=s.local.campStores[v.tribe||0],saved=store?.saved||0;
    if(saved+s.food<amount)return false;
    const local=Math.min(saved,amount);if(store)store.saved-=local;s.food-=amount-local;
    s.local.dried=Math.min(s.local.dried||0,s.food);if(s.bankFood)s.bankFood=Math.min(s.bankFood,s.food);
  }
  v.travelMeals=(v.travelMeals||0)+amount;return true;
}
