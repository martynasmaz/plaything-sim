import {stoneFordRules,stoneFordBuilt,fordStudyReady,tributaryCrossingBanks,streamY,riverHalfWidth,riverFrozen,bridgeBuilt,tributaryBridgeBuilt} from './river.js';
import {campSites,finishOrdinaryWork,settlementEvent} from './practices.js';
import {regularWorkSafe} from './development.js';
import {hasFoodReserve} from './provisions.js';
import {unsafeRiverWeather} from './climate.js';
import {beginWorkJourney} from './journeys.js';

export function fordConstructionSite(s,v,channel){
  const home=campSites[v.tribe||0];
  if(channel==='tributary'){
    const banks=tributaryCrossingBanks(1000,640,false);return [...(home[0]<banks.center[0]?banks.left:banks.right)];
  }
  const y=streamY(430,1000,640),side=home[1]<y?-1:1;return [430,y+side*(riverHalfWidth(430,1000)+12)];
}
export function stoneFordWork(s,v,report,{materials}){
  if(report.actions.some(a=>a.id===v.id))return false;
  if(!regularWorkSafe(s,v)||v.age<s.config.life.adult||v.practice.lessonToday||!hasFoodReserve(s,v,2)||
    !v.practice.known.fordbuilding||!v.practice.gear['ford layout']||!fordStudyReady(s,v)||unsafeRiverWeather(s)||
    s.local.season==='Winter'||riverFrozen(s)||s.lastUsed.flood>=s.day-1||s.local.daughter?.members.includes(v.id))return false;
  const candidates=['main','tributary'].filter(channel=>!stoneFordBuilt(s,channel)&&!report.fordWorked?.[channel]&&
    !s.local.legacyCrossingWork?.[channel]&&!(channel==='main'?bridgeBuilt(s):tributaryBridgeBuilt(s)));
  candidates.sort((a,b)=>{
    const home=campSites[v.tribe||0],distance=channel=>Math.hypot(...fordConstructionSite(s,v,channel).map((n,i)=>n-home[i]));
    return Number(!!s.local.fords?.[b])-Number(!!s.local.fords?.[a])||distance(a)-distance(b);
  });
  const channel=candidates[0];if(!channel)return false;
  const rules=stoneFordRules[channel],project=s.local.fords?.[channel],site=project?.site||fordConstructionSite(s,v,channel);
  const finish=(action,skill)=>{
    finishOrdinaryWork(s,v,skill);v.activity=action;v.gained=0;
    (report.fordWorked??={})[channel]=true;v.practice.watersideVisits=(v.practice.watersideVisits||0)+1;
    v.practice.used.fordbuilding=(v.practice.used.fordbuilding||0)+1;
    report.actions.push({id:v.id,action,site,gained:0,channel});return true;
  };
  if(!project){
    if(!beginWorkJourney(s,v,site,report,'survey a ford'))return true;
    const bank=channel==='main'?(site[1]<streamY(430,1000,640)?'left':'right'):
      site[0]<tributaryCrossingBanks(1000,640,false).center[0]?'left':'right';
    (s.local.fords??={})[channel]={site:[...site],channel,bank,work:0,spent:{},surveyorId:v.id,surveyDay:s.day};
    return finish('Survey '+channel+' ford','explore');
  }
  const stone=Math.ceil(rules.stone*(project.work+1)/rules.work)-Math.ceil(rules.stone*project.work/rules.work);
  const collecting=materials(s,v,{stone},report);if(collecting!==null)return collecting;
  if(s.local.stock.stone<stone)return false;
  if(!beginWorkJourney(s,v,site,report,'place ford stones'))return true;
  s.local.stock.stone-=stone;project.spent.stone=(project.spent.stone||0)+stone;project.work++;project.lastBuilder=v.id;
  if(project.work===rules.work){project.completedDay=s.day;settlementEvent(s,v.name+' completed a stepping-stone crossing on the '+channel+' river.');}
  return finish('Place '+channel+' ford stones','invent');
}
