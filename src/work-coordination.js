import {SCENARIO} from './scenario.js';
import {communityOf} from './provisions.js';
import {sharedWorkFitsNeeds} from './needs.js';

export const coordinationRules=SCENARIO.coordination;
export const coordinationEnabled=(s,report)=>!!s.config.learning&&!!report&&coordinationRules.enabled;
// Ephemeral daily claims. Persistent construction and resource accounts remain
// authoritative; no assignment or player interface changes anybody's desires.
export function sharedWorkBlocker(s,v,report,job){
  if(!coordinationEnabled(s,report)||!job)return null;
  if(report.workCoordination?.day===s.day&&report.workCoordination.assignments.some(a=>a.id===v.id&&a.status!=='released'))return 'already_assigned';
  if(!sharedWorkFitsNeeds(s,v,job.need))return 'personal_need';
  if(v.age<(job.minAge||0)||job.eligible===false)return 'prerequisites';
  if(!(job.remaining>0))return 'no_remaining_demand';
  const used=report.workCoordination?.day===s.day?report.workCoordination.assignments.filter(a=>a.resource===job.resource&&['claimed','completed'].includes(a.status)).length:0;
  if(used>=(job.slots??Infinity))return 'crew_full';
  return null;
}
export function coordinateWork(s,v,report,job,perform){
  if(!coordinationEnabled(s,report)||!job)return perform();
  const journal=report.workCoordination?.day===s.day?report.workCoordination:
    (report.workCoordination={day:s.day,tasks:[],assignments:[],declined:[]});
  const camp=communityOf(s,v),key=String(camp)+'/'+job.resource;
  let task=journal.tasks.find(t=>t.key===key);
  const description={key,camp,resource:job.resource,kind:job.kind,need:job.need,site:job.site?.slice(),demandAtLastClaim:job.remaining,slots:job.slots??null};
  if(task)Object.assign(task,description);else{task=description;journal.tasks.push(task);}
  const reason=sharedWorkBlocker(s,v,report,job);
  if(reason){journal.declined.push({id:v.id,resource:job.resource,reason});return false;}
  const claim={id:v.id,camp,resource:job.resource,kind:job.kind,status:'claimed'};journal.assignments.push(claim);
  const before=report.actions?.length||0,journeys=report.journeys?.length||0;
  try{
    const result=perform();
    const interrupted=report.journeys?.slice(journeys).some(j=>j.id===v.id&&!j.completed);
    claim.status=interrupted?'interrupted':result||report.actions?.slice(before).some(a=>a.id===v.id)?'completed':'released';
    return result;
  }catch(error){claim.status='released';throw error;}
}
