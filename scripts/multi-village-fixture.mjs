// ANALYSIS PROTOTYPE: separate complete simulation states. The only external
// connection is a conservative, needs-driven adult partner migration rule.
// This module is not imported by the playable game.
import {createState,stepDay,unrelated,localShelterPlaces} from '../src/sim.js';
import {HOMESTEAD_RULES} from '../src/config.js';
import {rememberPerson} from '../src/genealogy.js';
import {campSites,beginSettlementDay,valleySeason} from '../src/practices.js';
import {communityOf,communityMembers,foodDaysFor,packLocalMeals} from '../src/provisions.js';
import {canLeaveLivestock} from '../src/husbandry.js';

export const externalPartnerRules={
  villageCount:3,sites:[[0,0],[600,0],[300,700]],unitsPerTravelDay:300,
  needDays:14,checkEvery:7,opportunityChance:.35,cooldownDays:80,rationBufferDays:3,
  hostReserveDays:3,donorReserveDays:3,minimumHealth:80,minimumFullness:70,minimumWarmth:60,minimumEnergy:50,fertilityBufferDays:20
};
const mix=n=>{let h=Math.imul(n^0x45d9f3b,1597334677);return (h^(h>>>16))>>>0;};
export const fertile=(s,v)=>v.age>=s.config.life.adult&&v.age<s.config.life.elder;
export const hasUnrelatedPair=s=>s.villagers.some(a=>fertile(s,a)&&s.villagers.some(b=>fertile(s,b)&&a.gender!==b.gender&&unrelated(a,b)));
export const hasFutureUnrelatedPair=s=>s.villagers.some(a=>a.age<s.config.life.elder&&s.villagers.some(b=>{
  if(a===b||a.gender===b.gender||!unrelated(a,b))return false;
  const wait=Math.max(0,s.config.life.adult-a.age,s.config.life.adult-b.age);
  return a.age+wait<s.config.life.elder&&b.age+wait<s.config.life.elder;
}));
const safe=(s,v)=>fertile(s,v)&&!v.illnessDays&&!v.campJourney&&v.health>=externalPartnerRules.minimumHealth&&
  v.fullness>=externalPartnerRules.minimumFullness&&v.warmth>=externalPartnerRules.minimumWarmth&&v.practice.energy>=externalPartnerRules.minimumEnergy;
const independentAdult=(s,v)=>!v.herbalist&&!v.healerApprentice&&canLeaveLivestock(s,v)&&
  !s.villagers.some(child=>child.age<s.config.life.adult&&(child.parents?.includes(v.id)||child.carers?.includes(v.id)))&&
  !s.villagers.some(p=>p!==v&&p.household===v.household&&fertile(s,p)&&p.gender!==v.gender&&unrelated(v,p));

export function createVillageCluster(seed,contact=false){
  const template=createState(HOMESTEAD_RULES,seed),villages=[];
  for(let village=0;village<3;village++){
    const s=createState(HOMESTEAD_RULES,village===0?seed:mix(seed+village*104729)),offset=village*1_000_000;
    s.villagers=template.villagers.map(person=>{
      const v=structuredClone(person);v.id+=offset;v.household+=offset;return v;
    });
    s.nextId=offset+7;s.traitLog=[];
    s.local.genealogy={version:1,people:{},recordedFrom:0};
    for(const v of s.villagers)rememberPerson(s,v,'founder');
    villages.push(s);
  }
  return {seed,contact,day:0,villages,transit:[],events:[],needDays:[0,0,0],lastContact:[-1000,-1000,-1000],
    arrivals:[0,0,0],departures:[0,0,0],transitDeaths:0,travelPersonDays:0,travelHungerDeaths:0,
    noPairVillageDays:0,persistentNeedVillageDays:0,candidateDays:0,failedFunding:0};
}
function importAncestry(source,target,id,seen=new Set()){
  if(seen.has(id))return;seen.add(id);
  const record=source.local.genealogy.people[id];if(!record)return;
  target.local.genealogy.people[id]??=structuredClone(record);
  for(const parent of record.parents||[])importAncestry(source,target,parent,seen);
}
function migrationAffordable(s,v,rations){
  // Clone only accounts that packLocalMeals can mutate. Keep the actual
  // water-filled community budget calculation; ancestry/history need no copy.
  const candidate={...v},preview={...s,villagers:s.villagers.map(p=>p===v?candidate:p),local:{...s.local,
    campStores:Object.fromEntries(Object.entries(s.local.campStores||{}).map(([key,value])=>[key,{...value}])),
    daughter:s.local.daughter?{...s.local.daughter}:undefined}};
  const cost=s.config.needs.mealCost;
  return packLocalMeals(preview,candidate,rations*cost)&&
    foodDaysFor(preview,candidate)-(candidate.travelMeals||0)/cost>=externalPartnerRules.donorReserveDays;
}
export function partnerOptions(cluster){
  const options=[],rules=externalPartnerRules;
  for(const [to,recipient] of cluster.villages.entries()){
    if(!recipient.villagers.length||hasFutureUnrelatedPair(recipient)||cluster.needDays[to]<rules.needDays||
      cluster.day-cluster.lastContact[to]<rules.cooldownDays||cluster.transit.some(t=>t.to===to||t.from===to))continue;
    for(const host of recipient.villagers.filter(v=>safe(recipient,v)&&foodDaysFor(recipient,v)>=rules.hostReserveDays)){
      const camp=communityOf(recipient,host);
      if(localShelterPlaces(recipient,camp)<communityMembers(recipient,camp).length+2)continue;
      for(const [from,donor] of cluster.villages.entries()){
        if(from===to||cluster.day-cluster.lastContact[from]<rules.cooldownDays||cluster.transit.some(t=>t.to===from||t.from===from)||
          valleySeason(donor).name==='Winter'||valleySeason(recipient).name==='Winter')continue;
        const distance=Math.hypot(...rules.sites[to].map((n,i)=>n-rules.sites[from][i])),days=Math.ceil(distance/rules.unitsPerTravelDay);
        for(const traveler of donor.villagers){
          if(!safe(donor,traveler)||!independentAdult(donor,traveler)||traveler.age+days>=donor.config.life.elder-rules.fertilityBufferDays||
            traveler.gender===host.gender||!unrelated(traveler,host)||foodDaysFor(donor,traveler)<rules.donorReserveDays)continue;
          // A donor must keep a viable unrelated pair of its own.
          if(!hasUnrelatedPair({...donor,villagers:donor.villagers.filter(v=>v!==traveler)}))continue;
          if(!migrationAffordable(donor,traveler,days+rules.rationBufferDays))continue;
          options.push({from,to,hostId:host.id,travelerId:traveler.id,distance,days,rations:days+rules.rationBufferDays});
        }
      }
    }
  }
  return options.sort((a,b)=>a.distance-b.distance||a.travelerId-b.travelerId||a.hostId-b.hostId);
}
export function beginExternalMigration(cluster,option){
  const source=cluster.villages[option.from],target=cluster.villages[option.to],v=source.villagers.find(p=>p.id===option.travelerId);
  if(!v)return false;
  const canonical=partnerOptions(cluster).find(o=>o.from===option.from&&o.to===option.to&&o.travelerId===v.id&&o.hostId===option.hostId);
  if(!canonical)return false;option=canonical;
  packLocalMeals(source,v,option.rations*source.config.needs.mealCost);
  source.villagers=source.villagers.filter(p=>p!==v);
  if(source.local.daughter)source.local.daughter.members=source.local.daughter.members.filter(id=>id!==v.id);
  delete v.familyReadiness;v.practice.lessonToday=null;
  const trip={...option,person:v,remaining:option.days,walked:0,departedDay:cluster.day,returning:false};
  cluster.transit.push(trip);cluster.departures[option.from]++;
  cluster.lastContact[option.from]=cluster.lastContact[option.to]=cluster.day;
  cluster.events.push({day:cluster.day,type:'departure',from:option.from,to:option.to,id:v.id,rations:option.rations,distance:option.distance});
  return true;
}
function transitDay(cluster,trip){
  const v=trip.person,s=cluster.villages[trip.from],c=s.config,n=c.needs;
  const change=(key,amount)=>v[key]=Math.max(0,Math.min(c.limits.need,v[key]+amount));
  const weather=s.lastDay?.weather||'normal',traits=v.traits||[];
  v.practice.energy=Math.min(100,v.practice.energy+5);
  change('fullness',-n.fullnessLoss);
  const shivery=traits.includes('Shivery')?c.personality.shiveryExtraLoss:0;
  const climate=s.lastDay?.climate,rainFactor=!climate?1:climate.intensity==='drizzle'?.35:climate.intensity==='steady'?.7:climate.intensity==='heavy'?1:1.3;
  change('warmth',-n.warmthLoss+(v.practice.gear['wool wrap']?3:0)-(weather==='rain'?Math.round(n.rainWarmthLoss*rainFactor)+shivery:weather==='cold'?(traits.includes('Hardy')?c.personality.hardyColdLoss:n.coldWarmthLoss+shivery):0));
  if(v.warmth<n.warmUpBelow){change('warmth',n.warmUp);v.practice.energy=Math.max(0,v.practice.energy-c.learning.workCost);}
  else if(v.practice.energy<22)v.practice.energy=Math.min(100,v.practice.energy+c.learning.restGain);
  else{v.practice.energy=Math.max(0,v.practice.energy-c.learning.workCost);trip.remaining--;trip.walked++;}
  if(v.fullness<=n.eatAtOrBelow&&v.travelMeals>=n.mealCost){v.travelMeals-=n.mealCost;change('fullness',n.mealFullness);}
  const causes=[];let damage=0;
  if(v.fullness<=n.damageAtOrBelow){damage+=n.hungerDamage;causes.push('hunger');}
  if(v.warmth<=n.damageAtOrBelow){damage+=n.coldDamage;causes.push('cold');}
  change('health',-damage);if(!damage&&v.fullness>=n.recoveryMin&&v.warmth>=n.recoveryMin)change('health',n.recovery);
  v.safety=n.unsafe;if(v.warmth<n.unhappyBelow||v.fullness<n.unhappyBelow)change('happiness',-n.unhappyLoss);
  v.age++;cluster.travelPersonDays++;
  if(v.health<=0||v.age>=c.life.death){
    cluster.transitDeaths++;if(causes.includes('hunger'))cluster.travelHungerDeaths++;
    const record=s.local.genealogy.people[v.id];if(record){record.deathDay=cluster.day;record.causes=causes.length?causes:['old age'];}
    cluster.events.push({day:cluster.day,type:'travel-death',id:v.id,from:trip.from,to:trip.to,causes});return false;
  }
  if(trip.remaining>0)return true;
  let target=cluster.villages[trip.to],host=target.villagers.find(p=>p.id===trip.hostId);
  if(!trip.returning&&(!host||!fertile(target,host)||!unrelated(v,host))){
    trip.returning=true;trip.to=trip.from;trip.remaining=Math.max(1,trip.walked);return true;
  }
  if(trip.returning){target=cluster.villages[trip.from];host=null;}
  v.tribe=host?.tribe||0;v.household=host?.household??v.id;
  if(host&&communityOf(target,host)==='east')target.local.daughter.members.push(v.id);
  v.arrivalDay=cluster.day;v.lastCompanyDay=cluster.day;delete v.campJourney;
  v.journeyPosition=[...(host&&communityOf(target,host)==='east'?target.local.daughter.site:campSites[v.tribe])];
  importAncestry(cluster.villages[trip.from],target,v.id);
  target.villagers.push(v);target.ended=false;target.stats.peak=Math.max(target.stats.peak,target.villagers.length);
  cluster.arrivals[trip.to]++;
  cluster.events.push({day:cluster.day,type:trip.returning?'return':'arrival',id:v.id,from:trip.from,to:trip.to,hostId:host?.id});
  return false;
}
export function advanceExternalJourneys(cluster){cluster.transit=cluster.transit.filter(trip=>transitDay(cluster,trip));}
export function stepVillageCluster(cluster){
  cluster.day++;
  const reports=[];
  for(let i=0;i<cluster.villages.length;i++){
    const previous=cluster.villages[i];
    if(!previous.villagers.length){previous.day=cluster.day;beginSettlementDay(previous);reports.push({before:[],report:null});continue;}
    const next=stepDay(previous);cluster.villages[i]=next;reports.push({before:previous.villagers,report:next.lastDay});
  }
  advanceExternalJourneys(cluster);
  for(const [i,s] of cluster.villages.entries())cluster.needDays[i]=s.villagers.length&&!hasFutureUnrelatedPair(s)?cluster.needDays[i]+1:0;
  cluster.noPairVillageDays+=cluster.needDays.filter(n=>n>0).length;
  cluster.persistentNeedVillageDays+=cluster.needDays.filter(n=>n>=externalPartnerRules.needDays).length;
  const options=cluster.needDays.some(n=>n>=externalPartnerRules.needDays)?partnerOptions(cluster):[];
  if(options.length)cluster.candidateDays++;
  if(cluster.contact&&cluster.day%externalPartnerRules.checkEvery===0){
    const roll=mix(cluster.seed^Math.imul(cluster.day,2654435761))/4294967296;
    if(roll<externalPartnerRules.opportunityChance){const option=options[0];if(option&&!beginExternalMigration(cluster,option))cluster.failedFunding++;}
  }
  return reports;
}
