import {communityOf,communityMembers,foodDaysFor,packLocalMeals,familyFoodReady} from './provisions.js';
import {assessNeeds} from './needs.js';
import {campSites,practices,canExperiment,finishOrdinaryWork,settlementEvent} from './practices.js';

export const neighborRules={interval:12,partnerInterval:6,meetingsToJoin:2,familyContactDays:20,rations:3};
export function communitySite(s,key){return key==='east'?s.local.daughter?.site:campSites[key];}
const label=key=>key==='east'?'the eastern village':'camp '+(key+1);
function dependentChildren(s,v){return s.villagers.filter(child=>child.age<s.config.life.adult&&child.carers?.includes(v.id));}
function canLeaveCare(s,v){return dependentChildren(s,v).every(child=>!child.illnessDays&&child.carers.some(id=>{
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
  const recipe=Object.values(practices).find(r=>!r.magic&&r.id!=='herbalism'&&teacher.practice.known[r.id]&&teacher.practice.used[r.id]>0&&
    canExperiment(s,student,r)&&ready(s,r.product));
  if(!recipe)return false;
  const key='neighbor:'+teacher.id+'-'+recipe.id,p=student.practice;
  p.lessons[key]=(p.lessons[key]||0)+1;
  if(p.lessons[key]<s.config.learning.lessonDays)return false;
  p.known[recipe.id]=1;
  settlementEvent(s,student.name+' learned '+recipe.name+' during visits with '+teacher.name+' from another village.');
  return true;
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
      perform(traveler,'Return from a neighboring village',communitySite(s,trip.from));
      delete traveler.campJourney;delete l.campVisit;l.nextNeighborDay=s.day+r.interval;return busy;
    }
    if(!safe(host)||!safe(traveler)||!canLeaveCare(s,traveler)||host.practice.lessonToday||communityOf(s,host)!==trip.to||s.lastUsed.flood>=s.day-1){
      trip.stage='return';perform(traveler,'Rest after the village journey',communitySite(s,trip.to),true);return busy;
    }
    const stats=l.communication??={meetings:0,householdMoves:0,lessons:0,crossVillageBirths:0};
    for(const [person,peer,from,to] of [[traveler,host,trip.from,trip.to],[host,traveler,trip.to,trip.from]]){
      const contacts=person.practice.neighbors??={},contact=contacts[peer.id]??={name:peer.name,from,to,meetings:0};
      contact.meetings++;contact.lastDay=s.day;person.lastCompanyDay=s.day;person.lastNeighborDay=s.day;
      person.favors??={};person.favors[peer.id]=Math.min(12,(person.favors[peer.id]||0)+1);
      person.happiness=Math.min(c.limits.need,person.happiness+c.needs.restHappiness);
    }
    stats.meetings=(stats.meetings||0)+1;
    stats.lessons=(stats.lessons||0)+Number(shareTechnique(s,traveler,host,readyToInvent))+Number(shareTechnique(s,host,traveler,readyToInvent));
    report.neighborMeeting={traveler:traveler.id,host:host.id,from:trip.from,to:trip.to};
    const acquainted=traveler.practice.neighbors[host.id].meetings>=r.meetingsToJoin;
    const interested=compatible(traveler,host)&&(!localPartner(traveler)||!localPartner(host)||!(traveler.childrenBorn||0)||!(host.childrenBorn||0));
    const canJoin=acquainted&&interested&&!traveler.herbalist&&!host.herbalist&&!dependentChildren(s,traveler).length&&!dependentChildren(s,host).length&&familyFoodReady(s,host);
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
  if(s.day<(l.nextNeighborDay||0)||s.settlementWork<c.settlement.shelterWork||s.lastUsed.flood>=s.day-1||report.weather==='cold')return busy;
  const available=order.filter(v=>safe(v)&&!v.practice.lessonToday&&!v.campJourney&&foodDaysFor(s,v)>=3&&
    s.day-(v.lastNeighborDay??-100)>=r.partnerInterval);
  const choices=[];
  for(const traveler of available.filter(v=>!v.herbalist&&canLeaveCare(s,v)))for(const host of available){
    const from=communityOf(s,traveler),to=communityOf(s,host);if(from===to||to==='east'&&!l.daughter?.settled||from==='east'&&!l.daughter?.settled)continue;
    const contact=traveler.practice.neighbors?.[host.id],courtship=compatible(traveler,host);
    const score=Number(courtship)*20+Number(courtship&&!localPartner(traveler))*40+Number(contact?.meetings===1)*30-
      (traveler.childrenBorn||0)-(host.childrenBorn||0)-Math.hypot(...communitySite(s,from).map((n,i)=>n-communitySite(s,to)[i]))/2000;
    choices.push({traveler,host,from,to,score});
  }
  choices.sort((a,b)=>b.score-a.score);
  const choice=choices[0];if(!choice||!packLocalMeals(s,choice.traveler,Math.max(0,r.rations-(choice.traveler.travelMeals||0))))return busy;
  const {traveler,host,from,to}=choice;
  trip=l.campVisit={traveler:traveler.id,host:host.id,from,to,stage:'meeting',startedDay:s.day};
  traveler.campJourney={site:[...(host.herbalist?.home||communitySite(s,to))],from,to};
  perform(traveler,'Visit '+host.name+' in '+label(to),traveler.campJourney.site);return busy;
}
