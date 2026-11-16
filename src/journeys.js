import {walkRiver} from './river-travel.js';
import {builtHutSite} from './settlement-layout.js';
import {bridgeProtection,bridgeFallChance,riverCrossingRoll,riverFallOutcome,riverLandingFraction,riverBankPoint,streamY,riverTributaryX,riverFrozen} from './river.js';
// One canonical world for every viewport, frame rate, pause and day skip.
const routeCamps=[[227,222],[802,433],[702,153]],routeCache=new Map();
export function journeyHome(s,v){
  if(s.local?.daughter?.members.includes(v.id))return s.local.daughter.site;
  if(v.herbalist?.home)return v.herbalist.home;
  const slot=v.homeHut,camp=v.tribe||0;
  if(Number.isInteger(slot)&&s.huts?.[slot]===camp&&!s.hutDetails?.[slot]?.ruined)
    return builtHutSite(s,routeCamps,camp,s.huts.slice(0,slot).filter(c=>c===camp).length);
  return routeCamps[camp];
}
function canonicalRoute(from,target,flood,frozen,kaunas){
  const key=[...from,...target,flood,frozen,kaunas].join('/');if(routeCache.has(key))return routeCache.get(key);
  const dry=frozen?target:riverBankPoint(...target,1000,640,flood,kaunas,6,from);
  const p={x:from[0],y:from[1],goal:dry,leg:0,travel:0},points=[from];
  const safe={built:true,visualSafe:true,tributary:{built:true,visualSafe:true}};
  for(let i=0;i<1200&&p.goal&&!p.swept;i++){
    walkRiver(p,p.goal,16,1000,640,flood,{id:0,warmth:100},false,safe,null,frozen,3000,kaunas);
    if(i%4===0)points.push([p.x,p.y]);
  }
  const result={arrives:!p.goal&&!p.swept,main:p.crossingTrips||0,tributary:p.tributaryTrips||0,distance:p.travel,points:[...points,[p.x,p.y]],target:[p.x,p.y]};
  if(routeCache.size>512)routeCache.clear();routeCache.set(key,result);return result;
}
export function workRoute(s,v,site,{oneWay=false}={}){
  if(!s.config.learning||!site)return {arrives:true,main:0,tributary:0,distance:0,points:[],target:site};
  const from=v.journeyPosition||journeyHome(s,v),flood=s.lastUsed.flood>=s.day-1,frozen=riverFrozen(s);
  const route=canonicalRoute(from,site,flood,frozen,s.local.terrain==='kaunas'),bridge=bridgeProtection(s);
  const vulnerable=v.age<s.config.life.adult||v.illnessDays>0||v.illToday||v.warmth<40;
  const risks={main:bridgeFallChance(bridge,flood,vulnerable),tributary:bridgeFallChance(bridge.tributary,flood,vulnerable)};
  return {...route,from,flood,frozen,risks,oneWay,arrives:route.arrives&&(!route.main||risks.main<1)&&(!route.tributary||risks.tributary<1)};
}
export function journeyPossible(s,v,site,options){return workRoute(s,v,site,options).arrives;}
// Called BEFORE work spends ingredients, moves supplies or credits output.
// Long expeditions already have explicit outward/meeting/return workdays;
// routine daily work includes its commute in that one daily action.
export function beginWorkJourney(s,v,site,report,label='work',options){
  if(!s.config.learning||!site)return true;
  const previous=report.journeys?.filter(j=>j.id===v.id).at(-1);
  if(previous&&(!previous.completed||previous.site.every((n,i)=>n===site[i])))return previous.completed;
  const home=journeyHome(s,v),returningHome=site.every((n,i)=>n===home[i]);
  const route=workRoute(s,v,site,{...options,oneWay:options?.oneWay||returningHome}),trip={id:v.id,day:s.day,from:[...route.from],site:[...site],distance:route.distance,points:route.points,oneWay:route.oneWay,completed:false};
  (report.journeys??=[]).push(trip);
  if(!route.arrives){
    const delays=s.local.crossingDelays??={},camp=v.tribe||0,previous=delays[camp];
    delays[camp]={count:(previous?.count||0)+1,lastDay:s.day};
    trip.reason='Waiting for a safe river crossing';v.activity='Wait for a safe crossing';v.gained=0;
    report.actions.push({id:v.id,action:v.activity,site:route.from,gained:0});return false;
  }
  for(const channel of ['main','tributary'])for(let i=0;i<route[channel]*(route.oneWay?1:2);i++){
    const count=v.journeyTrips=(v.journeyTrips||0)+1;
    if(route.risks[channel]<=0||riverCrossingRoll(s.seed^0x7a51,v.id,count)>=route.risks[channel])continue;
    const accident=(s.local.riverFalls||0)+1;s.local.riverFalls=accident;
    const fatal=riverFallOutcome(s.seed,accident),random=riverLandingFraction(s.seed,v.id,accident);
    const location=channel==='main'?[430,streamY(430,1000,640)]:[riverTributaryX(.24)*1000,640*.24];
    const side=random>.5?1:-1;
    const downstream=channel==='main'?[location[0]-30-random*150,streamY(location[0]-30-random*150,1000,640)+side*90]:
      [riverTributaryX((location[1]+20+random*90)/640)*1000+side*50,location[1]+20+random*90];
    const bank=riverBankPoint(...downstream,1000,640,route.flood,s.local.terrain==='kaunas',9,downstream);
    const event={id:v.id,day:s.day,channel,location,landing:bank,fatal,count:accident};(report.riverAccidents??=[]).push(event);
    v.journeyPosition=bank;v.lastRiverAccident=event;v.activity='Recover after a river fall';v.gained=0;if(fatal){v.health=0;v.riverFatalDay=s.day;}
    report.actions.push({id:v.id,action:v.activity,site:bank,gained:0});return false;
  }
  trip.completed=true;v.journeyPosition=route.oneWay?route.target:[...route.from];return true;
}
