// Finished food only. Main-valley camps share the main pantry, but a camp's
// preserved stores can feed its own residents, not an inaccessible neighbor.
export function communityOf(s,v){return s.local?.daughter?.members.includes(v.id)?'east':v.tribe||0;}
export function communityMembers(s,community){return s.villagers.filter(v=>communityOf(s,v)===community);}
export function foodDaysFor(s,v){
  const community=communityOf(s,v),members=communityMembers(s,community),count=Math.max(1,members.length);
  if(community==='east')return s.local.daughter.food/count+(v.travelMeals||0);
  const counts=new Map();for(const person of s.villagers){const camp=communityOf(s,person);if(camp!=='east')counts.set(camp,(counts.get(camp)||0)+1);}
  const groups=[...counts].map(([camp,n])=>({n,days:(s.local?.campStores?.[camp]?.saved||0)/n})).sort((a,b)=>a.days-b.days);
  let level=groups[0]?.days||0,covered=0,shared=s.food;
  // The shared pantry first raises the least-provisioned camps toward the
  // others. A well-stocked camp uses its own food rather than counting both
  // its private reserve and an equal share of the poorer camp's only meals.
  for(const group of groups){
    const needed=(group.days-level)*covered;
    if(needed>shared){level+=shared/covered;shared=0;break;}
    shared-=needed;level=group.days;covered+=group.n;
  }
  if(covered&&shared)level+=shared/covered;
  return Math.max((s.local?.campStores?.[community]?.saved||0)/count,level)+(v.travelMeals||0);
}
export function mainFoodRequired(s,parentCamp,perPerson=s.config.birth.foodPerPerson,extra=s.config.birth.extraFood){
  const counts=new Map();
  for(const v of s.villagers){const camp=communityOf(s,v);if(camp!=='east')counts.set(camp,(counts.get(camp)||0)+1);}
  let needed=0;
  for(const [camp,count] of counts){
    const target=count*perPerson+(camp===parentCamp?extra:0);
    needed+=Math.max(0,target-(s.local?.campStores?.[camp]?.saved||0));
  }
  return needed;
}
export function familyFoodReady(s,mother){
  if(communityOf(s,mother)==='east'){
    const post=s.local.daughter;
    return !!post.settled&&post.food>=s.config.birth.foodPerPerson*(post.members.length+1)+s.config.birth.extraFood;
  }
  return s.food>=mainFoodRequired(s,mother.tribe||0);
}
export function foodLedger(s){
  let home=s.food,east=(s.local?.daughter?.food||0)+(s.local?.daughter?.returnFood||0);
  for(const store of Object.values(s.local?.campStores||{}))home+=(store.saved||0)+(store.rack||0);
  for(const v of s.villagers){if(communityOf(s,v)==='east')east+=v.travelMeals||0;else home+=v.travelMeals||0;}
  return {home,east};
}
export function recordFoodBalance(s,report){
  if(!report.foodAtDawn)return;
  const now=foodLedger(s),hungry={home:false,east:false};
  for(const v of s.villagers)if(v.fullness<s.config.needs.recoveryMin&&!report.meals.includes(v.id))hungry[communityOf(s,v)==='east'?'east':'home']=true;
  const history=s.local.provisionHistory??=[];
  history.push({day:s.day,home:now.home-report.foodAtDawn.home,east:now.east-report.foodAtDawn.east,hungryHome:hungry.home,hungryEast:hungry.east});
  if(history.length>7)history.shift();
  if(s.local.season==='Winter'){
    const index=Math.floor(Math.max(0,s.day-1+(s.local.seasonOffset||0))/s.config.learning.seasonLength);
    if(s.local.winterFoodObservation?.index!==index)s.local.winterFoodObservation={index,days:0,home:0,east:0};
    const observed=s.local.winterFoodObservation;observed.days++;
    for(const region of ['home','east']){
      const meals=report.meals.filter(id=>{const v=s.villagers.find(v=>v.id===id);return v&&(communityOf(s,v)==='east')===(region==='east');}).length;
      observed[region]+=Math.max(0,now[region]-report.foodAtDawn[region]+meals*s.config.needs.mealCost);
    }
    for(const v of s.villagers)if(v.age>=s.config.life.adult&&v.practice?.known.drying)
      v.practice.winterFoodDays=(v.practice.winterFoodDays||0)+1;
  }else if(s.local.winterFoodObservation){
    const observed=s.local.winterFoodObservation;
    if(observed.days>=7)s.local.lastWinterFood={home:observed.home/observed.days,east:observed.east/observed.days};
    delete s.local.winterFoodObservation;
  }
}
export function familyFoodStable(s,mother){
  const history=s.local?.provisionHistory||[],east=communityOf(s,mother)==='east';
  if(history.some(day=>day[east?'hungryEast':'hungryHome']))return false;
  // A newly loaded or founded world first gathers a week's actual evidence.
  // Stable reserves are sufficient: a full store cannot accumulate more food.
  // A declining stockpile still delays another child until the budget recovers.
  if(history.length>=7&&history.reduce((sum,day)=>sum+day[east?'east':'home'],0)<0)return false;
  return true;
}
export function winterStorageTarget(s,residents,pantryCapacity){
  const minimum=residents.length*4,winter=s.local?.lastWinterFood;
  const planner=residents.some(v=>v.age>=s.config.life.adult&&v.practice?.known.drying&&(v.practice.winterFoodDays||0)>=7);
  if(!planner||!winter)return minimum;
  const homeCount=Math.max(1,s.villagers.filter(v=>communityOf(s,v)!=='east').length),share=residents.length/homeCount;
  const dailyDemand=residents.length*s.config.needs.fullnessLoss/s.config.needs.mealFullness*s.config.needs.mealCost;
  // Learn to build adequate winter storage, rather than assuming past yields
  // are a permanent ceiling on the number of people the land can support.
  return Math.max(minimum,Math.ceil(Math.max(0,dailyDemand-winter.home*share)*s.config.learning.seasonLength-pantryCapacity*share));
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
