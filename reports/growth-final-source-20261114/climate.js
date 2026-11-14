// LHMT Kaunas 1991–2020 normals. Values describe representative real days;
// an 80-day game year compresses the calendar, not the rain rate in mm/hour.
export const kaunasNormals={
  days:[31,28.25,31,30,31,30,31,31,30,31,30,31],
  wet:[17.1,15.9,14.2,11.7,12.8,14,14.2,13.9,12.8,14.6,16.2,17.1],
  heavy:[.5,.3,.5,.8,1.4,1.8,3.2,2.4,1.3,1.7,.9,.6],
  mm:[48,38,38,38,53,65,88,77,51,61,47,47],
  temperature:[-3,-2.4,1.2,7.6,13,16.3,18.6,17.8,12.9,7.2,2.6,-1.2]
};
function climateNoise(seed,day,salt){let h=Math.imul(seed^Math.imul(day+1,1597334677)^salt,2246822519);h=Math.imul(h^(h>>>16),3266489917);return ((h^(h>>>16))>>>0)/4294967296;}
export function climateMonth(s,day=s.day){
  const length=s.config.learning?.seasonLength||20;
  return (2+Math.floor((Math.max(0,day-1+(s.local?.seasonOffset||0))%(4*length))*3/length))%12;
}
// Exponential tail fits the observed annual >=20 mm / >=10 mm ratio.
// Sub-10 mm amounts fit each monthly total; drizzle/steady split at 2 mm is
// a game presentation choice, not a measured frequency in the source tables.
const rainTail=10/Math.log(15.4/3.23);
const lightMeans=kaunasNormals.mm.map((total,m)=>(total-kaunasNormals.heavy[m]*(10+rainTail))/(kaunasNormals.wet[m]-kaunasNormals.heavy[m]));
const rainLambdas=lightMeans.map(mean=>{
  let low=.001,high=30;
  for(let i=0;i<45;i++){const mid=(low+high)/2,expected=.1+1/mid-9.9/Math.expm1(mid*9.9);if(expected>mean)low=mid;else high=mid;}
  return (low+high)/2;
});
export function kaunasWeather(s,day,roll){
  const month=climateMonth(s,day),n=kaunasNormals;
  const wet=n.wet[month]/n.days[month],heavy=n.heavy[month]/n.days[month];
  const u=Math.min(1-1e-12,climateNoise(s.seed,day,0x4a91));
  let mm=0;
  if(roll<heavy)mm=10-Math.log(1-u)*rainTail;
  else if(roll<wet){const lambda=rainLambdas[month];mm=.1-Math.log(1-u*(1-Math.exp(-lambda*9.9)))/lambda;}
  // Temperature variance and day-to-day sequencing are illustrative. Monthly
  // means are measured; this is not a historical weather reconstruction.
  const temperature=n.temperature[month]+(climateNoise(s.seed,day,0x77ab)-.5)*12;
  const dryRun=mm>0?0:(s.local?.climate?.dryRun||0)+1;
  const type=mm>0?'rain':temperature<0?'cold':dryRun>=4&&temperature>=10?'drought':'normal';
  return {day,month,type,mm,temperature,snow:mm>0&&temperature<1,
    intensity:mm>=20?'downpour':mm>=10?'heavy':mm>=2?'steady':mm>0?'drizzle':'dry',dryRun};
}
export function rainConditions(s,weather){
  const stored=s.local?.climate?.day===s.day?s.local.climate:s.natural?.climate;
  if(stored&&stored.type===weather&&!(s.weather.daysLeft>0))return stored;
  return {type:weather,mm:weather==='rain'?8:0,intensity:weather==='rain'?'steady':'dry',temperature:weather==='cold'?-5:12,snow:false};
}
export function beginClimateDay(s,weather){
  if(!s.config.learning||s.config.learning.climate===false)return;
  const previous=s.local.climate;
  const rolled=s.natural.climate?.day===s.day?s.natural.climate:kaunasWeather(s,s.day,climateNoise(s.seed,s.day,0x938f));
  const forced=s.weather.daysLeft>0||rolled.type!==weather;
  const today=forced?{...rolled,type:weather,mm:weather==='rain'?8:0,snow:weather==='rain'&&rolled.temperature<1,intensity:weather==='rain'?'steady':'dry'}:rolled;
  const dryRun=today.mm>0?0:(previous?.dryRun||0)+1;
  const frostRun=today.temperature<0?(previous?.frostRun||0)+1:0;
  const evaporation=Math.max(.025,today.temperature*.004);
  const snowpack=(previous?.snowpack||0)+(today.snow?today.mm:0);
  const melt=today.temperature>0?Math.min(snowpack,today.temperature*2):0;
  const soil=Math.max(0,Math.min(1.5,(previous?.soil??.65)+(today.snow?0:today.mm)/30+melt/30-evaporation));
  s.local.climate={...today,dryRun,frostRun,soil,snowpack:snowpack-melt,
    waterlogged:soil>1.15?(previous?.waterlogged||0)+1:0};
  return s.local.climate;
}
export function climateCropGrowth(s,fallback){
  const c=s.local?.climate;if(!c)return fallback;
  if(s.local.season==='Winter'||c.temperature<=1)return 0;
  if(c.soil<.16)return 0;
  if(c.waterlogged>=2)return .5;
  return c.mm>=2&&c.mm<20&&c.soil<=1.15?2:1;
}
export function unsafeRiverWeather(s){return (s.local?.climate?.mm||0)>=10;}
