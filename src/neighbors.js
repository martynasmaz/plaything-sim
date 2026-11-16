import {communityOf,communityMembers,foodDaysFor,packLocalMeals,familyFoodReady,pantryCapacity} from './provisions.js';
import {storageCapacity} from './storage.js';
import {assessNeeds} from './needs.js';
import {campSites,practices,canExperiment,finishOrdinaryWork,settlementEvent,teachingPriority} from './practices.js';
import {developmentEnabled} from './development.js';
import {unsafeRiverWeather} from './climate.js';
import {canLeaveLivestock} from './husbandry.js';
import {familyPlanningFoundation} from './family-planning.js';
import {rememberFamilyContact} from './family-motivation.js';
import {beginWorkJourney,journeyPossible} from './journeys.js';

export const neighborRules={interval:12,partnerInterval:6,meetingsToJoin:2,familyContactDays:20,rations:3,reliefBatch:6,donorReserve:3};
export function communitySite(s,key){return key==='east'?s.local.daughter?.site:campSites[key];}
const label=key=>key==='east'?'the eastern village':'camp '+(key+1);
function dependentChildren(s,v){return s.villagers.filter(child=>child.age<s.config.life.adult&&child.carers?.includes(v.id));}
function canLeaveCare(s,v){return canLeaveLivestock(s,v)&&dependentChildren(s,v).every(child=>!child.illnessDays&&child.carers.some(id=>{
  const carer=s.villagers.find(p=>p.id===id);return carer&&carer!==v&&carer.age>=s.config.life.adult&&!carer.campJourney&&communityOf(s,carer)===communityOf(s,child);
}));}
export function crossVillageParents(mother,father){
  const maternal=mother.practice?.neighbors?.[father.id],contact=maternal||father.practice?.neighbors?.[mother.id];
  return contact?.meetings>=neighborRules.meetingsToJoin&&contact.from!==contact.to?(maternal?[contact.from,contact.to]:[contact.to,contact.from]):null;
}
export function recentVillagePartner(s,a,b){
  const contact=a.practice?.neighbors?.[b.id]||b.practice?.neighbors?.[a.id];
  return contact?.meetings>=neighborRules.meetingsToJoin&&s.day-contact.lastDay<=neighborRules.familyContactDays&&
    s.day-contact.lastDay>=s.config.birth.consecutiveDays&&contact.lastDay>(contact.familyVisitUsed??-1);
}
export function rememberFamilyVisit(s,a,b){
  for(const [person,peer] of [[a,b],[b,a]]){
    const contact=person.practice?.neighbors?.[peer.id];if(contact)contact.familyVisitUsed=contact.lastDay;
  }
}
function shareTechnique(s,teacher,student,ready){
  const recipe=Object.values(practices).filter(r=>!r.magic&&r.id!=='herbalism'&&teacher.practice.known[r.id]&&teacher.practice.used[r.id]>0&&
    (r.id==='familyplanning'?!student.practice.known[r.id]&&familyPlanningFoundation(s,student):
      canExperiment(s,student,r)&&ready(s,r.product))).sort((a,b)=>teachingPriority(s,b.id,teacher)-teachingPriority(s,a.id,teacher))[0];
  if(!recipe)return false;
  const key='neighbor:'+teacher.id+'-'+recipe.id,p=student.practice;
  p.lessons[key]=(p.lessons[key]||0)+1;
  if(p.lessons[key]<s.config.learning.lessonDays)return false;
  p.known[recipe.id]=1;
  settlementEvent(s,student.name+' learned '+recipe.name+' during visits with '+teacher.name+' from another village.');
  return true;
}
export function packVisitRelief(s,traveler,host,trip,report){
  if(trip.reliefRations)return 0;
  const recipient=communityOf(s,traveler),donor=communityOf(s,host);
  if(recipient===donor||foodDaysFor(s,traveler)-(traveler.travelMeals||0)>=2)return 0;
  const source=donor==='east'?s.local.daughter:s.local.campStores?.[donor],key=donor==='east'?'food':'saved';
  if(!source)return 0;
  const reserve=communityMembers(s,donor).length*neighborRules.donorReserve;
  const amount=Math.floor(Math.min(neighborRules.reliefBatch,(source[key]||0)-reserve));
  if(amount<=0)return 0;
  source[key]-=amount;traveler.travelMeals=(traveler.travelMeals||0)+amount;trip.reliefRations=amount;
  trip.reliefPreserved=key==='saved';
  (report.relief??=[]).push({traveler:traveler.id,donor,recipient,packed:amount});return amount;
}
function deliverVisitRelief(s,traveler,trip,report){
  const amount=Math.min(trip.reliefRations||0,traveler.travelMeals||0);if(!amount)return;
  const camp=communityOf(s,traveler),store=camp==='east'?s.local.daughter:s.local.campStores?.[camp];
  // A fresh gift may feed the pantry, but travel cannot turn it into preserved food.
  const localRoom=camp==='east'?amount:trip.reliefPreserved?Math.max(0,storageCapacity(store)-(store?.saved||0)-(store?.rack||0)):0;
  const local=Math.min(amount,localRoom),key=camp==='east'?'food':'saved';if(local)store[key]=(store[key]||0)+local;
  const shared=camp==='east'?0:Math.min(amount-local,Math.max(0,pantryCapacity(s)-s.food));
  if(shared)s.food+=shared;
  const delivered=local+shared;traveler.travelMeals-=delivered;
  const stats=s.local.communication??={};stats.foodShared=(stats.foodShared||0)+delivered;
  (report.relief??=[]).push({traveler:traveler.id,recipient:camp,delivered});
  if(delivered)settlementEvent(s,traveler.name+' brought '+delivered+' provisions home from a neighboring community.');
}
// A visit has a paid outward journey, a paired meeting, and a return journey
// (or joining the host's household). No new people or buildings are created.
export function neighborWork(s,order,report,{unrelated,readyToInvent}){
  const busy=new Set();if(!s.local||!s.config.learning)return busy;
  const c=s.config,r=neighborRules,l=s.local;
  const safe=v=>v&&!v.healerApprentice&&!(v.herbalist&&s.villagers.some(p=>p.illnessDays))&&v.age>=c.life.adult&&!v.illnessDays&&v.health>=70&&v.fullness>=60&&v.warmth>=50&&
    v.practice.energy>=35&&v.practice.known.gathering&&assessNeeds(s,v).level>=2&&!dependentChildren(s,v).some(child=>child.illnessDays);
  const fertile=v=>v.age>=c.life.adult&&v.age<c.life.elder;
  const compatible=(a,b)=>fertile(a)&&fertile(b)&&a.gender!==b.gender&&unrelated(a,b);
  const localPartner=v=>communityMembers(s,communityOf(s,v)).some(peer=>peer!==v&&compatible(v,peer));
  const perform=(v,action,site,rest=false)=>{
    finishOrdinaryWork(s,v,rest?'rest':'explore');v.activity=action;v.gained=0;busy.add(v.id);
    report.actions.push({id:v.id,action,site,gained:0});
  };
  const cancel=()=>{const traveler=s.villagers.find(v=>v.id===l.campVisit?.traveler);if(traveler)delete traveler.campJourney;delete l.campVisit;l.nextNeighborDay=s.day+r.partnerInterval;};
  let trip=l.campVisit;
  if(trip){
    const traveler=s.villagers.find(v=>v.id===trip.traveler),host=s.villagers.find(v=>v.id===trip.host);
    if(!traveler||!host||!communitySite(s,trip.from)||!communitySite(s,trip.to)){cancel();return busy;}
    // An urgent need releases the workday to the ordinary needs planner.
    if(traveler.illnessDays||traveler.fullness<35||traveler.warmth<40||traveler.health<50||traveler.practice.energy<22){cancel();return busy;}
    if(trip.stage==='return'){
      if(!beginWorkJourney(s,traveler,communitySite(s,trip.from),report,'return from visit',{oneWay:true})){busy.add(traveler.id);return busy;}
      perform(traveler,'Return from a neighboring village',communitySite(s,trip.from));
      deliverVisitRelief(s,traveler,trip,report);
      delete traveler.campJourney;delete l.campVisit;l.nextNeighborDay=s.day+r.interval;return busy;
    }
    const seekingPartner=compatible(traveler,host)&&(!localPartner(traveler)||!localPartner(host));
    if(!safe(host)||!safe(traveler)||!canLeaveCare(s,traveler)||host.practice.lessonToday&&!seekingPartner||communityOf(s,host)!==trip.to||s.lastUsed.flood>=s.day-1){
      trip.stage='return';perform(traveler,'Rest after the village journey',communitySite(s,trip.to),true);return busy;
    }
    const meetingSite=host.herbalist?.home||communitySite(s,trip.to);
    if(!beginWorkJourney(s,traveler,meetingSite,report,'visit meeting',{oneWay:true})){busy.add(traveler.id);return busy;}
    if(!beginWorkJourney(s,host,meetingSite,report,'host visit')){busy.add(host.id);perform(traveler,'Wait for a village meeting',meetingSite,true);return busy;}
    const stats=l.communication??={meetings:0,householdMoves:0,lessons:0,crossVillageBirths:0};
    for(const [person,peer,from,to] of [[traveler,host,trip.from,trip.to],[host,traveler,trip.to,trip.from]]){
      const contacts=person.practice.neighbors??={},contact=contacts[peer.id]??={name:peer.name,from,to,meetings:0};
      contact.meetings++;contact.lastDay=s.day;person.lastCompanyDay=s.day;person.lastNeighborDay=s.day;
      person.favors??={};person.favors[peer.id]=Math.min(12,(person.favors[peer.id]||0)+1);
      person.happiness=Math.min(c.limits.need,person.happiness+c.needs.restHappiness);
    }
    stats.meetings=(stats.meetings||0)+1;
    rememberFamilyContact(s,traveler,host,1);
    stats.lessons=(stats.lessons||0)+Number(shareTechnique(s,traveler,host,readyToInvent))+Number(shareTechnique(s,host,traveler,readyToInvent));
    packVisitRelief(s,traveler,host,trip,report);
    report.neighborMeeting={traveler:traveler.id,host:host.id,from:trip.from,to:trip.to};
    const acquainted=traveler.practice.neighbors[host.id].meetings>=r.meetingsToJoin;
    const interested=compatible(traveler,host)&&(!localPartner(traveler)||!localPartner(host)||!(traveler.childrenBorn||0)||!(host.childrenBorn||0));
    const canJoin=!trip.reliefRations&&acquainted&&interested&&!traveler.herbalist&&!host.herbalist&&!dependentChildren(s,traveler).length&&!dependentChildren(s,host).length&&familyFoodReady(s,host);
    if(canJoin){
      // Leave the old household's remaining occupants together. This changes
      // residence at the place actually visited, never a map-wide teleport.
      for(const person of [traveler,host]){
        const others=s.villagers.filter(v=>v!==traveler&&v!==host&&v.household===person.household&&communityOf(s,v)===communityOf(s,person));
        if(others.length)for(const other of others)other.household=others[0].id;
      }
      if(trip.from==='east')l.daughter.members=l.daughter.members.filter(id=>id!==traveler.id);
      if(trip.to==='east'){l.daughter.members.push(traveler.id);traveler.tribe=l.daughter.origin||0;}
      else traveler.tribe=trip.to;
      traveler.household=host.household=host.id;delete traveler.campJourney;
      traveler.joinedThroughVisit={peerId:host.id,from:trip.from,to:trip.to,day:s.day};
      stats.householdMoves=(stats.householdMoves||0)+1;delete l.campVisit;l.nextNeighborDay=s.day+r.interval;
      perform(traveler,'Join '+host.name+'’s household',communitySite(s,trip.to));perform(host,'Welcome '+traveler.name,communitySite(s,trip.to));
      settlementEvent(s,traveler.name+' joined '+host.name+'’s household in '+label(trip.to)+' after getting acquainted during village visits.');
    }else{
      const meetingSite=host.herbalist?.home||communitySite(s,trip.to);
      perform(traveler,'Meet '+host.name+' in '+label(trip.to),meetingSite);perform(host,'Talk with '+traveler.name+' from '+label(trip.from),meetingSite);
      trip.stage='return';settlementEvent(s,traveler.name+' visited '+host.name+' in '+label(trip.to)+' and exchanged news.');
    }
    return busy;
  }
  if(developmentEnabled(s,'families')&&s.settlementWork>=c.settlement.shelterWork&&report.weather!=='cold'&&!unsafeRiverWeather(s)){
    const young=order.filter(v=>safe(v)&&!v.herbalist&&!v.practice.lessonToday&&!v.campJourney&&!(v.childrenBorn||0)&&
      s.day-(v.lastCourtshipDay??-100)>=14&&foodDaysFor(s,v)>=2&&
      !communityMembers(s,communityOf(s,v)).some(p=>p.household===v.household&&compatible(v,p)));
    const first=young.find(v=>young.some(p=>p!==v&&compatible(v,p)&&communityOf(s,v)===communityOf(s,p)));
    const peer=first&&young.find(p=>p!==first&&compatible(first,p)&&communityOf(s,first)===communityOf(s,p));
    if(peer){
      const former=[first.household,peer.household];
      for(const household of former){const others=s.villagers.filter(p=>p!==first&&p!==peer&&p.household===household);if(others.length)for(const p of others)p.household=others[0].id;}
      first.household=peer.household=first.id;
      for(const [a,b] of [[first,peer],[peer,first]]){a.lastCourtshipDay=a.lastCompanyDay=s.day;a.happiness=Math.min(100,a.happiness+c.needs.restHappiness);perform(a,'Spend time with '+b.name,communitySite(s,communityOf(s,a)),true);}
      (l.communication??={}).localHouseholds=(l.communication.localHouseholds||0)+1;
      settlementEvent(s,first.name+' and '+peer.name+' began a household after spending time together. They still need food and sleeping places for children.');return busy;
    }
  }
  const familyUrgency=developmentEnabled(s,'families')&&order.some(v=>safe(v)&&fertile(v)&&!localPartner(v));
  if(s.day<(l.nextNeighborDay||0)&&!familyUrgency||s.settlementWork<c.settlement.shelterWork||s.lastUsed.flood>=s.day-1||report.weather==='cold'||developmentEnabled(s,'families')&&unsafeRiverWeather(s))return busy;
  const available=order.filter(v=>safe(v)&&(!v.practice.lessonToday||familyUrgency&&fertile(v)&&!localPartner(v))&&!v.campJourney&&foodDaysFor(s,v)>=(familyUrgency?2:3)&&
    s.day-(v.lastNeighborDay??-100)>=r.partnerInterval);
  const choices=[];
  for(const traveler of available.filter(v=>!v.herbalist&&canLeaveCare(s,v)))for(const host of available){
    const from=communityOf(s,traveler),to=communityOf(s,host);if(from===to||to==='east'&&!l.daughter?.settled||from==='east'&&!l.daughter?.settled)continue;
    const contact=traveler.practice.neighbors?.[host.id],courtship=compatible(traveler,host);
    const score=Number(courtship)*20+Number(courtship&&!localPartner(traveler))*40+Number(contact?.meetings===1)*30-
      (traveler.childrenBorn||0)-(host.childrenBorn||0)-Math.hypot(...communitySite(s,from).map((n,i)=>n-communitySite(s,to)[i]))/2000;
    if(journeyPossible(s,traveler,host.herbalist?.home||communitySite(s,to),{oneWay:true}))choices.push({traveler,host,from,to,score});
  }
  choices.sort((a,b)=>b.score-a.score);
  const choice=choices[0];if(!choice||!packLocalMeals(s,choice.traveler,Math.max(0,r.rations-(choice.traveler.travelMeals||0))))return busy;
  const {traveler,host,from,to}=choice;
  if(!beginWorkJourney(s,traveler,host.herbalist?.home||communitySite(s,to),report,'village visit',{oneWay:true})){busy.add(traveler.id);return busy;}
  trip=l.campVisit={traveler:traveler.id,host:host.id,from,to,stage:'meeting',startedDay:s.day};
  traveler.campJourney={site:[...(host.herbalist?.home||communitySite(s,to))],from,to};
  perform(traveler,'Visit '+host.name+' in '+label(to),traveler.campJourney.site);return busy;
}
