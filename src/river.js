import {SCENARIO} from './scenario.js';
export function streamY(x,width,height){return height*(.51+.078*Math.sin(x/width*7+.4)+.037*Math.sin(x/width*13));}
export function riverHalfWidth(x,width,flood=false){return 41+7*Math.sin(x/width*8)+4*Math.cos(x/width*15)+(flood?25:0);}
const riverTributaryX=v=>.54+.055*Math.sin(v*10+1)-.24*v;
let tributaryCache;
// The drawn tributary bends west into the main channel. Its mathematical
// continuation below that bend is land, not another invisible water channel.
export function tributaryCourse(width,height,flood=false){
  const key=[width,height,flood].join('/');if(tributaryCache?.key===key)return tributaryCache;
  const points=[];let curve;
  for(let j=-151;j<=95;j++){
    const y=j/150*height,x=riverTributaryX(j/150)*width;points.push([x,y]);
    if(y>=streamY(x,width,height)-riverHalfWidth(x,width,flood)*1.45){
      const join=x-width*.055,mid=streamY(join,width,height);
      curve=[[x-width*.01,y+30],[join+width*.015,mid],[join,mid]];break;
    }
  }
  const samples=points.slice();
  if(curve){const start=points.at(-1);for(let i=1;i<=32;i++){
    const t=i/32,u=1-t;samples.push([0,1].map(k=>u*u*u*start[k]+3*u*u*t*curve[0][k]+3*u*t*t*curve[1][k]+t*t*t*curve[2][k]));
  }}
  return tributaryCache={key,points,curve,samples};
}
function closestTributaryPoint(x,y,width,height,flood,reach){
  const points=tributaryCourse(width,height,flood).samples;let best=null,distance=reach*reach;
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i];if(y<Math.min(a[1],b[1])-reach||y>Math.max(a[1],b[1])+reach)continue;
    const dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy;
    const t=length?Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/length)):0;
    const px=a[0]+t*dx,py=a[1]+t*dy,d=(x-px)**2+(y-py)**2;
    if(d<distance){distance=d;best={x:px,y:py,distance:Math.sqrt(d),dx,dy};}
  }
  return best;
}
export function riverWaterAt(x,y,width,height,flood=false,kaunas=true,inset=0){
  // The main shore is drawn with five-unit line segments; interpolate the
  // same segments rather than testing a slightly different smooth curve.
  const left=Math.floor(x/5)*5,t=(x-left)/5;
  const upper=q=>streamY(q,width,height)-riverHalfWidth(q,width,flood);
  const lower=q=>streamY(q,width,height)+riverHalfWidth(q,width,flood);
  const main=y>upper(left)*(1-t)+upper(left+5)*t+inset&&y<lower(left)*(1-t)+lower(left+5)*t-inset;
  const radius=width*(.023+(flood?.008:0))/2-inset;
  const tributary=kaunas&&radius>0&&!!closestTributaryPoint(x,y,width,height,flood,radius);
  return {main,tributary};
}
export function riverBankPoint(x,y,width,height,flood=false,kaunas=true,margin=6,reference=null){
  for(let i=0;i<6;i++){
    const water=riverWaterAt(x,y,width,height,flood,kaunas,-margin);if(!water.main&&!water.tributary)break;
    if(water.main){
      const side=Math.sign((reference?.[1]??y)-streamY(reference?.[0]??x,width,height))||1;
      y=streamY(x,width,height)+side*(riverHalfWidth(x,width,flood)+margin+1);
    }
    if(water.tributary){
      const radius=width*(.023+(flood?.008:0))/2+margin+1;
      const near=closestTributaryPoint(x,y,width,height,flood,radius);if(!near)continue;
      let nx=x-near.x,ny=y-near.y,length=Math.hypot(nx,ny);
      if(!length){nx=near.dy;ny=-near.dx;length=Math.hypot(nx,ny)||1;}
      if(reference&&(reference[0]-near.x)*nx+(reference[1]-near.y)*ny<0){nx=-nx;ny=-ny;}
      x=near.x+nx/length*radius;y=near.y+ny/length*radius;
    }
  }
  return [x,y];
}
export const bridgeUpgradeRules={railWork:4,braceWork:6};
export const bridgeBuilt=s=>!!s.config.settlement&&s.settlementWork>=s.config.settlement.shelterWork+s.config.settlement.bridgeWork;
export function bridgeStudyReady(s,v){
  const p=v.practice;
  return bridgeBuilt(s)&&(p.skills.wood||0)>=4&&((p.used.cordage||0)>=2||(p.skills.fibre||0)>=3);
}
export const bridgeRecipe=['bridgecraft','Bridge joinery','wood','rigid',['housing','cordage','crude tools'],
  {wood:1,fibre:1},'bridge lashings',bridgeStudyReady];
export function bridgeProtection(s){
  return {built:bridgeBuilt(s),rails:(s.local?.bridgeUpgrade?.railWork||0)>=bridgeUpgradeRules.railWork,
    braced:(s.local?.bridgeUpgrade?.braceWork||0)>=bridgeUpgradeRules.braceWork};
}
export function bridgeFallChance(bridge,flood,vulnerable=false){
  const p=typeof bridge==='object'?bridge:{built:!!bridge};
  if(!p.built)return flood||vulnerable?1:0;
  if(!flood)return 0;
  return p.braced?.15:p.rails?.45:1;
}
export function riverCrossingRoll(seed,id,count){
  let h=Math.imul(seed^Math.imul(id+1,1597334677)^Math.imul(count+1,2246822519)^0x63b1,3266489917);
  return ((h^(h>>>16))>>>0)/4294967296;
}
// A separate saved accident sequence leaves nightly weather/illness dice alone.
// Each fall gets a fresh deterministic draw with a one-in-1,000 fatal chance.
export function riverFallOutcome(seed,count){
  let h=Math.imul(seed^Math.imul(count,1597334677)^0x5c71,2246822519);
  h=Math.imul(h^(h>>>16),3266489917);
  const roll=((h^(h>>>16))>>>0);
  // The low-order bucket preserves the previous default accident sequence.
  return ((roll%1000)+(Math.floor(roll/1000)%1000)/1000)/1000<SCENARIO.river.fatalFallChance;
}
export function riverLandingFraction(seed,id,count){
  let h=Math.imul(seed^Math.imul(id+1,1597334677)^Math.imul(count+1,2246822519),3266489917);
  return ((h^(h>>>16))>>>0)/4294967296;
}
