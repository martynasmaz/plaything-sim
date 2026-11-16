import {communityOf} from './provisions.js';
import {recentVillagePartner} from './neighbors.js';
import {familyPlan,rememberFamilyDecision} from './family-planning.js';
import {parentBirthBlockers} from './population.js';
import {familyPartnerScore} from './family-motivation.js';

// Readiness belongs to a prospective family, never the settlement's clock.
// A birth in another household cannot reset this family's progress.
export function planFamilyBirths(s,eligibleAdults,{unrelated,populationCap}){
  const c=s.config,required=Math.max(1,c.birth.consecutiveDays),local=s.local;
  let legacyCredit=local.familyReadinessVersion?0:Math.min(required-1,Math.max(0,s.birthCounter||0));
  local.familyReadinessVersion=1;s.birthCounter=0;
  const livingChildren=new Map();
  for(const child of s.villagers)for(const id of child.parents||[])livingChildren.set(id,(livingChildren.get(id)||0)+1);
  const children=v=>v.childrenBorn??livingChildren.get(v.id)??0;
  const eligibleParents=eligibleAdults.filter(v=>v.age>=c.life.adult&&v.age<c.life.elder&&parentBirthBlockers(s,v).length===0);
  const fathers=eligibleParents.filter(v=>v.gender==='male').sort((a,b)=>children(a)-children(b)||a.id-b.id);
  const fatherById=new Map(fathers.map(v=>[v.id,v]));
  const continuing=mother=>{
    const father=fatherById.get(mother.familyReadiness?.fatherId);
    return mother.familyReadiness?.lastDay===s.day-1&&father&&unrelated(mother,father)&&
      (communityOf(s,mother)===communityOf(s,father)||recentVillagePartner(s,mother,father));
  };
  const fertile=v=>v.age>=c.life.adult&&v.age<c.life.elder;
  const mothers=s.villagers.filter(v=>v.gender==='female'&&(fertile(v)||v.familyReadiness)).sort((a,b)=>Number(continuing(b))-Number(continuing(a))||children(a)-children(b)||a.id-b.id);
  const eligibleIds=new Set(eligibleParents.map(v=>v.id)),diagnostics={day:s.day,families:[],counts:{},resets:0};
  local.familyDiagnostics=diagnostics;
  const assignments=new Map(),considered=new Set(),ready=[];let possible=0,waiting=0;
  for(const mother of mothers){
    considered.add(mother.id);
    const compatible=father=>unrelated(mother,father)&&
      (communityOf(s,mother)===communityOf(s,father)||recentVillagePartner(s,mother,father));
    const old=mother.familyReadiness;
    const candidates=fathers.filter(compatible).sort((a,b)=>familyPartnerScore(s,mother,b)-familyPartnerScore(s,mother,a)||children(a)-children(b)||a.id-b.id);
    const father=candidates.find(v=>v.id===old?.fatherId)||candidates.reduce((best,v)=>!best||(assignments.get(v.id)||0)<(assignments.get(best.id)||0)?v:best,null);
    const unrelatedFathers=s.villagers.filter(v=>fertile(v)&&v.gender==='male'&&unrelated(mother,v));
    const nearby=unrelatedFathers.filter(v=>communityOf(s,mother)===communityOf(s,v)||recentVillagePartner(s,mother,v));
    const potential=father||nearby.find(v=>v.id===old?.fatherId)||nearby.slice().sort((a,b)=>parentBirthBlockers(s,a).length-parentBirthBlockers(s,b).length||a.id-b.id)[0];
    const reasons=[...parentBirthBlockers(s,mother)];
    if(!fertile(mother))reasons.push('parent_age');
    if(mother.recoveryUntil>s.day)reasons.push('maternal_recovery');
    if(!unrelatedFathers.length)reasons.push('no_unrelated_partner');else if(!nearby.length)reasons.push('separated_partners');
    if(potential)reasons.push(...parentBirthBlockers(s,potential));
    if(s.villagers.length>=populationCap(s))reasons.push('housing_capacity');
    const decision=familyPlan(s,mother,potential);
    const row={motherId:mother.id,fatherId:father?.id??null,potentialFatherId:potential?.id??null,reasons:[...new Set(reasons)],
      previousDays:old?.days||0,days:0,reset:false,resetReasons:[],planning:decision};
    diagnostics.families.push(row);
    const blocked=!eligibleIds.has(mother.id)||!father||!fertile(mother)||mother.recoveryUntil>s.day||!decision.ready;
    if(blocked){
      row.reset=!!old;row.resetReasons=row.reset?row.reasons.filter(r=>r!=='housing_capacity'):[];
      if(row.reset)diagnostics.resets++;
      delete mother.familyReadiness;continue;
    }
    possible++;rememberFamilyDecision(s,mother,father,decision);
    assignments.set(father.id,(assignments.get(father.id)||0)+1);
    let days=old?.fatherId===father.id&&old.lastDay===s.day-1?old.days+1:1;
    // Preserve a legacy save's partly completed check for one actual family.
    // Copying that old village-wide credit to every couple would invent progress.
    if(legacyCredit){days=Math.max(days,legacyCredit+1);legacyCredit=0;}
    mother.familyReadiness={fatherId:father.id,days:Math.min(required,days),lastDay:s.day};
    row.days=mother.familyReadiness.days;
    if(old&&(old.fatherId!==father.id||old.lastDay!==s.day-1)){row.reset=true;row.resetReasons=[old.fatherId!==father.id?'partner_changed':'interrupted_streak'];diagnostics.resets++;}
    if(days>=required)ready.push([mother,father]);else waiting++;
  }
  for(const row of diagnostics.families)for(const reason of row.reasons)diagnostics.counts[reason]=(diagnostics.counts[reason]||0)+1;
  for(const v of s.villagers)if(v.familyReadiness&&!considered.has(v.id))delete v.familyReadiness;
  const limits=[];
  if(s.villagers.length>=populationCap(s))limits.push('population cap reached');
  if(!possible)limits.push('no eligible pair ready');
  if(waiting)limits.push(waiting+' independent '+(waiting===1?'family is':'families are')+' building readiness');
  local.birthConditions=limits.join('; ')||(ready.length?'conditions met for '+ready.length+' independent families':'no eligible pair ready');
  return ready;
}

export function canWelcomeFamilyChild(s,mother,populationCap,father){
  if(!mother||!father||mother===father||!s.villagers.includes(mother)||!s.villagers.includes(father))return false;
  const decision=familyPlan(s,mother,father);rememberFamilyDecision(s,mother,father,decision);
  const healthy=[mother,father].every(v=>v.age>=s.config.life.adult&&v.age<s.config.life.elder&&parentBirthBlockers(s,v).length===0);
  const ready=healthy&&decision.ready&&s.villagers.length<populationCap(s)&&!(mother.recoveryUntil>s.day);
  const diagnostics=s.local.familyDiagnostics,row=diagnostics?.day===s.day&&diagnostics.families.find(r=>r.motherId===mother.id);
  if(row&&!ready){
    const reasons=[...(s.villagers.length>=populationCap(s)?['housing_capacity']:[]),...parentBirthBlockers(s,mother),...parentBirthBlockers(s,father)];
    for(const reason of reasons)if(!row.reasons.includes(reason)){row.reasons.push(reason);diagnostics.counts[reason]=(diagnostics.counts[reason]||0)+1;}
    row.planning=decision;
  }
  return ready;
}
