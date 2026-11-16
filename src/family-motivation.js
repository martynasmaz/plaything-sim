import {SCENARIO} from './scenario.js';
import {communityOf,communityMembers,foodDaysFor} from './provisions.js';

export const familyMotivationRules=SCENARIO.familyMotivation;
export const familyMotivationEnabled=s=>!!s.config.learning&&s.config.learning.development!==false&&
  s.config.learning.development?.families!==false&&familyMotivationRules.enabled;
const bounded=(n,min=0,max=1)=>Math.max(min,Math.min(max,n));
function familySeed(s,id,salt){
  const h=Math.imul(s.seed^Math.imul(id+1,1597334677)^salt,2246822519);
  return ((h^(h>>>16))>>>0)/4294967296;
}
export function initFamilyMotivation(s,v){
  if(!familyMotivationEnabled(s))return;
  // Migration adds intentions, never remembered relationships or past care.
  if(!v.family||typeof v.family!=='object'||Array.isArray(v.family))v.family={};
  const f=v.family;
  if(!Number.isFinite(f.drive))f.drive=.7+familySeed(s,v.id,31)*.25;
  if(!Number.isInteger(f.preferredChildren)||f.preferredChildren<1)f.preferredChildren=2+Math.floor(familySeed(s,v.id,73)*3);
  f.approach??=v.traits?.includes('Sociable')?'teacher':v.traits?.includes('Smart')?'preserver':v.traits?.includes('Brave')?'provider':
    ['provider','builder','preserver','teacher'][Math.floor(familySeed(s,v.id,97)*4)];
  if(!f.bonds||typeof f.bonds!=='object'||Array.isArray(f.bonds))f.bonds={};
  for(const key of ['fatigue','confidence','careDays'])if(!Number.isFinite(f[key]))f[key]=0;
  return f;
}
export function familyDependents(s,v){
  return s.villagers.filter(child=>child.age<s.config.life.adult&&
    (child.parents?.includes(v.id)||child.carers?.includes(v.id)));
}
export function familyDesire(s,v){
  if(!v||v.wantsChildren===false||v.age<s.config.life.adult||v.age>=s.config.life.elder)return 0;
  if(!familyMotivationEnabled(s)||!v.family)return 1;
  const f=v.family,living=s.villagers.filter(child=>child.parents?.includes(v.id)).length;
  // Preferred size is a soft influence, not a fertility cap. Personal fatigue
  // comes from work actually performed; pantry/fullness never enter this check.
  return bounded(f.drive*familyMotivationRules.driveMultiplier+(f.confidence||0)-
    Math.max(0,living-f.preferredChildren)*familyMotivationRules.additionalChildReluctance-
    (f.fatigue||0)*familyMotivationRules.fatigueInfluence-(f.griefUntil>s.day ? .2 : 0));
}
export function familyBond(a,b){return a.family?.bonds?.[b.id]?.strength||0;}
export function familyCompatible(s,a,b){
  return a!==b&&[a,b].every(v=>v.age>=s.config.life.adult&&v.age<s.config.life.elder&&v.wantsChildren!==false)&&
    a.gender!==b.gender&&!a.parents?.includes(b.id)&&!b.parents?.includes(a.id)&&!a.parents?.some(id=>b.parents?.includes(id));
}
export function familyPartnerScore(s,a,b){
  return familyMotivationEnabled(s)?familyBond(a,b)+familySeed(s,a.id^Math.imul(b.id,73),139)*.2:0;
}
export function rememberFamilyContact(s,a,b,amount=1){
  if(!familyMotivationEnabled(s)||!familyCompatible(s,a,b))return false;
  initFamilyMotivation(s,a);initFamilyMotivation(s,b);
  if(a.family.bonds[b.id]?.lastDay===s.day)return false;
  for(const [person,peer] of [[a,b],[b,a]]){
    const old=person.family.bonds[peer.id];
    person.family.bonds[peer.id]={strength:bounded((old?.strength||0)+amount,0,8),lastDay:s.day,meetings:(old?.meetings||0)+1};
  }
  return true;
}
export function familyGoal(s,v){
  if(!familyMotivationEnabled(s)||!v.family)return null;
  const f=v.family,children=familyDependents(s,v),adult=v.age>=s.config.life.adult;
  if(!adult)return {kind:'childhood',reason:'Grow, play and learn from carers'};
  if(f.griefUntil>s.day)return {kind:'grieving',reason:'Recover after losing a family member'};
  const dependent=children.find(child=>child.illnessDays||child.health<45||child.warmth<s.config.needs.warmUpBelow);
  if(dependent)return {kind:'care',reason:'Help '+dependent.name+' recover and stay warm',childId:dependent.id};
  if(children.length&&foodDaysFor(s,v)<familyMotivationRules.reserveDays)
    return {kind:'provide',reason:'Provide reliable meals for '+children.length+' dependent '+(children.length===1?'child':'children')};
  if(v.age>=s.config.life.elder||v.wantsChildren===false)return children.length?
    {kind:'teach',reason:'Help the next generation become capable'}:{kind:'legacy',reason:'Pass useful skills to the community'};
  if(familyDesire(s,v)<familyMotivationRules.willingnessThreshold)return {kind:'recover',reason:'Regain strength before considering another child'};
  const partners=s.villagers.filter(peer=>familyCompatible(s,v,peer)&&communityOf(s,v)===communityOf(s,peer));
  partners.sort((a,b)=>familyPartnerScore(s,v,b)-familyPartnerScore(s,v,a));
  const partner=partners[0];
  if(!partner)return {kind:'seek',reason:'Hope to meet an unrelated partner in another community'};
  if(familyBond(v,partner)<familyMotivationRules.familiarity)
    return {kind:'court',reason:'Get to know '+partner.name,partnerId:partner.id};
  const camp=communityOf(s,v),residents=communityMembers(s,camp).filter(p=>!p.herbalist?.home).length;
  const beds=camp==='east'?(s.local.daughter?.shelter>=3?s.config.settlement.bedsPerHut:0):
    (camp===0?s.config.limits.shelter:0)+(s.huts||[]).filter((home,i)=>home===camp&&!s.hutDetails?.[i]?.ruined).length*s.config.settlement.bedsPerHut+
    (s.shed.built&&(s.shed.camp??1)===camp?s.config.shed.places:0);
  if(beds<residents+1)return {kind:'home',reason:'Make room for a growing family',partnerId:partner.id};
  if(children.length)return {kind:'teach',reason:'Raise and teach the children already here',partnerId:partner.id};
  return {kind:'prepare',reason:'Build a useful livelihood before starting a family',partnerId:partner.id};
}
export function beginFamilyDay(s){
  if(!familyMotivationEnabled(s))return;
  for(const v of s.villagers){
    const f=initFamilyMotivation(s,v);
    if(f.lastDay!==s.day){f.fatigue=bounded((f.fatigue||0)-familyMotivationRules.fatigueRecovery);f.lastDay=s.day;}
    const goal=familyGoal(s,v);f.goal=goal.kind;f.reason=goal.reason;
  }
}
export function familyLearningPriority(s,v,id){
  if(!familyMotivationEnabled(s)||!v.family||v.age<s.config.life.adult||v.family.goal==='grieving')return 0;
  const f=v.family,food=['drying','fishtraps','fishspears','fishnets','angling','fishingpoles','wheatgrowing','milling','granaries','fieldplanning','quernmaking','breadmaking','herding'];
  const planning=Number(!!v.practice?.known.familyplanning);
  if(f.goal==='home'&&['housing','cordage','hafting','knapping'].includes(id))return familyMotivationRules.learningBias+planning;
  if(food.includes(id)&&(planning||f.approach==='provider'||f.approach==='preserver'||f.goal==='provide'))return familyMotivationRules.learningBias+planning;
  return 0;
}
export function familyWorkMentor(s,child,mentors){
  const parent=v=>child.parents?.includes(v.id)||child.carers?.includes(v.id);
  // Preserve the existing deliberate fishing-observation route. A parent's
  // unrelated wood task must not crowd out a ready community food mentor.
  return (familyMotivationEnabled(s)?mentors.find(v=>v.activity==='Fish'&&parent(v)):null)||
    mentors.find(v=>v.activity==='Fish')||(familyMotivationEnabled(s)?mentors.find(parent):null)||
    mentors[(s.day+child.id)%mentors.length];
}
// One optional paired social day per camp at most, with real work/energy costs.
// Survival, medical care, existing lessons and active travel keep their slots.
export function courtshipWork(s,order,report,{finish,site,journey,safeToSocialize=()=>true}){
  const busy=new Set();if(!familyMotivationEnabled(s))return busy;
  const safe=v=>v.age>=s.config.life.adult&&v.age<s.config.life.elder&&!v.herbalist&&!v.healerApprentice&&!v.illnessDays&&
    !v.campJourney&&!v.outdoors&&!v.practice.lessonToday&&safeToSocialize(v)&&v.health>=s.config.birth.health&&v.fullness>=60&&v.warmth>=50&&v.practice.energy>=40&&
    foodDaysFor(s,v)>=familyMotivationRules.socialReserveDays&&familyDesire(s,v)>=familyMotivationRules.willingnessThreshold&&
    !familyDependents(s,v).some(child=>child.fullness<45||child.warmth<40||child.illnessDays)&&
    s.day-(v.family.lastCourtshipDay??-1000)>=familyMotivationRules.socialInterval;
  const camps=new Set();
  for(const a of order){
    const camp=communityOf(s,a);if(camps.has(camp)||busy.has(a.id)||!safe(a)||a.family.goal!=='court')continue;
    const spare=order.filter(v=>communityOf(s,v)===camp&&v.age>=s.config.life.adult&&!v.illnessDays&&v.health>=50&&v.warmth>=40&&v.practice.energy>=22&&!v.practice.lessonToday);
    if(spare.length<3)continue;
    const b=order.filter(v=>v!==a&&!busy.has(v.id)&&communityOf(s,v)===camp&&familyCompatible(s,a,v)&&safe(v)&&familyBond(a,v)<familyMotivationRules.familiarity)
      .sort((x,y)=>familyPartnerScore(s,a,y)-familyPartnerScore(s,a,x))[0];
    if(!b)continue;
    const meeting=site(s,a);camps.add(camp);
    for(const [person,peer] of [[a,b],[b,a]]){
      busy.add(person.id);
      if(!journey(s,person,meeting,report,'meet a prospective partner'))continue;
      finish(s,person,'rest');person.activity='Spend time with '+peer.name;person.gained=0;
      person.family.lastCourtshipDay=s.day;
      report.actions.push({id:person.id,action:person.activity,site:meeting,partner:peer.id,gained:0});
    }
    // Both must actually attend; an unfinished trip grants no remote affection.
    if(report.actions.some(x=>x.id===a.id&&x.partner===b.id)&&report.actions.some(x=>x.id===b.id&&x.partner===a.id)){
      rememberFamilyContact(s,a,b,1);(report.familyContacts??=[]).push({a:a.id,b:b.id,kind:'courtship'});
      for(const [person,peer] of [[a,b],[b,a]]){
        person.lastCompanyDay=s.day;person.happiness=Math.min(s.config.limits.need,person.happiness+s.config.needs.restHappiness);
        person.favors??={};person.favors[peer.id]=Math.min(12,(person.favors[peer.id]||0)+1);
      }
    }
  }
  return busy;
}
export function finishFamilyDay(s,previousPeople,report){
  if(!familyMotivationEnabled(s))return;
  for(const v of s.villagers){
    const f=initFamilyMotivation(s,v),action=report.actions.find(a=>a.id===v.id);
    if(f.finishedDay===s.day)continue;f.finishedDay=s.day;
    const childrenBefore=previousPeople.filter(child=>child.parents?.includes(v.id)||child.carers?.includes(v.id));
    if(action?.patient&&childrenBefore.some(child=>child.id===action.patient)){
      f.careDays++;f.fatigue=bounded(f.fatigue+familyMotivationRules.careFatigue);
    }
    if(report.deaths.some(d=>childrenBefore.some(child=>child.id===d.id))||
      report.deaths.some(d=>familyBond(v,{id:d.id})>=familyMotivationRules.familiarity))f.griefUntil=s.day+familyMotivationRules.griefDays;
    if(childrenBefore.some(child=>child.age<s.config.life.adult&&s.villagers.some(p=>p.id===child.id&&p.age>=s.config.life.adult)))
      f.confidence=bounded(f.confidence+.04,0,.2);
  }
  // Shared work can build familiarity without taking another job slot or
  // granting a relationship with someone working in a different community.
  const jobs=report.actions.filter(a=>/^(Forage|Fish|Gather wood|Harvest|Rest)$/.test(a.action));
  for(let i=0;i<jobs.length;i++)for(let j=0;j<i;j++){
    const a=s.villagers.find(v=>v.id===jobs[i].id),b=s.villagers.find(v=>v.id===jobs[j].id);
    if(a&&b&&jobs[i].action===jobs[j].action&&communityOf(s,a)===communityOf(s,b)&&
      (!jobs[i].site||!jobs[j].site||Math.hypot(jobs[i].site[0]-jobs[j].site[0],jobs[i].site[1]-jobs[j].site[1])<50))rememberFamilyContact(s,a,b,.25);
  }
}
export function familyDescription(s,v){
  const goal=familyGoal(s,v);if(!goal)return '';
  const desire=Math.round(familyDesire(s,v)*100),bond=Object.entries(v.family.bonds).filter(([id])=>s.villagers.some(p=>p.id===Number(id))).sort((a,b)=>b[1].strength-a[1].strength)[0];
  const peer=bond&&s.villagers.find(p=>p.id===Number(bond[0]));
  return 'Family: '+goal.reason+'.'+(v.age>=s.config.life.adult&&v.age<s.config.life.elder?' Desire for another child '+desire+'%.':'')+
    (peer?' Closest connection: '+peer.name+'.':'')+' Care days: '+v.family.careDays+'.';
}
export function familyMealOrder(s,ids){
  if(!familyMotivationEnabled(s))return ids;
  const result=[...ids],people=new Map(s.villagers.map(v=>[v.id,v]));
  for(const id of ids){
    const child=people.get(id);if(child.age>=s.config.life.adult||child.fullness>s.config.needs.eatAtOrBelow)continue;
    const parents=s.villagers.filter(v=>(child.carers?.includes(v.id)||child.parents?.includes(v.id))&&
      communityOf(s,v)===communityOf(s,child)&&!v.traits?.includes('Grabby')&&v.fullness>=s.config.needs.emergencyFullness&&v.fullness>child.fullness);
    for(const parent of parents){
      const a=result.indexOf(parent.id),b=result.indexOf(child.id);
      if(a>=0&&a<b){result.splice(b,1);result.splice(a,0,child.id);}
    }
  }
  return result;
}
