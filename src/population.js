import {communityOf,communityMembers} from './provisions.js';
import {dailyBirthIds} from './village-events.js';
import {familyDesire,familyMotivationEnabled,familyMotivationRules} from './family-motivation.js';

export function parentBirthBlockers(s,v){
  const b=s.config.birth,reasons=[];
  if(v.health<b.health)reasons.push('parent_health');
  if(v.happiness<b.happiness)reasons.push('parent_happiness');
  if(v.wantsChildren===false)reasons.push('parent_unwilling');
  else if(familyMotivationEnabled(s)&&familyDesire(s,v)<familyMotivationRules.willingnessThreshold)reasons.push('parent_family_readiness');
  if(b.healthyParentsOnly&&v.illnessDays)reasons.push('parent_illness');
  if(v.campJourney)reasons.push('parent_travel');
  return reasons;
}
export function housingForecast(s,camp){
  const c=s.config,people=communityMembers(s,camp),lookAhead=c.learning?.housingLookAheadDays??12;
  const related=(a,b)=>a.parents?.includes(b.id)||b.parents?.includes(a.id)||a.parents?.some(id=>b.parents?.includes(id));
  const futureAdult=v=>v.age>=c.life.adult-lookAhead&&v.age<c.life.elder&&!v.herbalist?.home;
  const potential=people.filter(futureAdult),males=potential.filter(v=>v.gender==='male');
  const families=potential.filter(v=>v.gender==='female'&&v.health>=c.birth.health&&!v.illnessDays&&
    v.wantsChildren!==false&&v.happiness>=c.birth.happiness&&!(v.recoveryUntil>s.day+lookAhead)&&males.some(f=>!related(v,f)&&f.health>=c.birth.health&&!f.illnessDays&&f.wantsChildren!==false&&f.happiness>=c.birth.happiness&&
      Math.max(0,c.life.adult-v.age,c.life.adult-f.age)<Math.min(c.life.elder-v.age,c.life.elder-f.age))).length;
  const expectedChildren=Math.min(c.learning?.housingExpectedChildren??3,families);
  const residents=people.filter(v=>!v.herbalist?.home).length;
  const beds=camp==='east'?(s.local.daughter.shelter>=3?c.settlement.bedsPerHut:0):
    (camp===0?c.limits.shelter:0)+(s.shed.built&&(s.shed.camp??1)===camp?c.shed.places:0)+
    (s.huts||[]).filter((home,i)=>home===camp&&!s.hutDetails?.[i]?.ruined).length*c.settlement.bedsPerHut;
  const cap=c.limits.population+(s.shed.built?c.shed.places:0)+(s.huts||[]).filter((_,i)=>!s.hutDetails?.[i]?.ruined).length*c.settlement.bedsPerHut+
    (s.local.daughter?.shelter>=3?c.settlement.bedsPerHut:0);
  const margin=expectedChildren?expectedChildren+1:0;
  return {camp,residents,beds,families,expectedChildren,lookAhead,localDeficit:Math.max(0,residents+margin-beds),
    capacityDeficit:expectedChildren?Math.max(0,s.villagers.length+margin-cap):0};
}
export function growthCensus(s){
  const c=s.config,children=s.villagers.filter(v=>v.age<c.life.adult).length,elders=s.villagers.filter(v=>v.age>=c.life.elder).length;
  return {population:s.villagers.length,children,workingAgeAdults:s.villagers.length-children-elders,dependents:children+elders,
    availableAdults:s.villagers.filter(v=>v.age>=c.life.adult&&!v.illnessDays&&!v.campJourney&&v.health>=c.needs.unwellBelow&&(v.practice?.energy??0)>=22).length};
}
const growthAdd=(o,k,n=1)=>o[k]=(o[k]||0)+n;
export function recordGrowthDay(s,dawn,report){
  const g=s.local.growth??={sinceDay:s.day,initialPopulation:dawn.length,peak:dawn.length,births:0,deaths:0,matured:0,bornMatured:0,childDeaths:0,
    workingAgeDeaths:0,personDays:0,populationDays:0,blockerFamilyDays:{},resetReasons:{},cohorts:[]};
  const born=dailyBirthIds(report),byId=new Map(dawn.map(v=>[v.id,v]));
  const matured=s.villagers.filter(v=>byId.get(v.id)?.age===s.config.life.adult-1&&v.age===s.config.life.adult);
  const cohort=day=>{const first=Math.floor(day/100)*100;let p=g.cohorts.find(p=>p.first===first);if(!p){p={first,births:0,matured:0,childDeaths:0};g.cohorts.push(p);}return p;};
  for(const id of born){const v=s.villagers.find(v=>v.id===id);if(v)cohort(s.day).births++;}
  for(const v of matured)if(s.day-v.age>=g.sinceDay){g.bornMatured++;cohort(s.day-v.age).matured++;}
  for(const d of report.deaths){const v=byId.get(d.id);if(!v)continue;
    if(v.age+1<s.config.life.adult){g.childDeaths++;if(s.day-v.age-1>=g.sinceDay)cohort(s.day-v.age-1).childDeaths++;}
    else if(v.age+1<s.config.life.elder)g.workingAgeDeaths++;
  }
  g.births+=born.length;g.deaths+=report.deaths.length;g.matured+=matured.length;g.personDays+=dawn.length;g.populationDays+=s.villagers.length;g.peak=Math.max(g.peak,s.villagers.length);
  const diagnostics=report.familyDiagnostics;
  if(diagnostics)for(const family of diagnostics.families){
    for(const reason of family.reasons)growthAdd(g.blockerFamilyDays,reason);
    if(family.reset)for(const reason of family.resetReasons)growthAdd(g.resetReasons,reason);
  }
  const census=growthCensus(s),period=s.local.populationHistory.at(-1);
  Object.assign(period,census);period.matured=(period.matured||0)+matured.length;
  period.childDeaths=(period.childDeaths||0)+report.deaths.filter(d=>(byId.get(d.id)?.age??Infinity)+1<s.config.life.adult).length;
  g.current={day:s.day,...census,phase:g.peak<=g.initialPopulation?'not yet expanded':s.villagers.length<g.peak?'expanded, then declined':'at its recorded peak'};
}
