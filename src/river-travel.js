import {streamY,riverHalfWidth,riverWaterAt,riverBankPoint,tributaryCrossingBanks,bridgeFallChance,riverCrossingRoll,riverLandingFraction,riverTributaryX} from './river.js';
const travelFordFraction=.43,travelNerisFord=.24;
function travelBankY(x,side,width,height,flood){return streamY(x,width,height)+side*(riverHalfWidth(x,width,flood)+6);}
// Keep a walker's whole silhouette clear of the small hearth. Follow its
// perimeter until the straight route to the destination opens up again.
function travelAroundHearth(p,x,y,hearth){
  const [cx,cy]=hearth,radius=37;
  const ax=p.x-cx,ay=p.y-cy,start=Math.atan2(ay,ax);
  const dx=x-p.x,dy=y-p.y,length2=dx*dx+dy*dy;
  if(Math.hypot(ax,ay)<radius-.01){
    p.x=cx+radius*Math.cos(start);p.y=cy+radius*Math.sin(start);
    return [p.x,p.y];
  }
  if(!length2)return [x,y];
  const nearest=Math.max(0,Math.min(1,-(ax*dx+ay*dy)/length2));
  if(Math.hypot(ax+dx*nearest,ay+dy*nearest)>=radius-.01)return [x,y];
  const turn=ax*(y-cy)-ay*(x-cx)>=0?1:-1;
  const angle=start+turn*.45;
  return [cx+(radius+5)*Math.cos(angle),cy+(radius+5)*Math.sin(angle)];
}
export function walkRiver(p,goal,distance,width,height,flood,v,child,bridge,hearth,frozen,worldWidth,kaunas,onFall){
  const ford=width*travelFordFraction;
  if(distance<=0)return false;
  p.waitingCrossing=null;
  const previousGeometry=p.waterGeometry;
  const changed=previousGeometry&&(previousGeometry.width!==width||previousGeometry.height!==height||previousGeometry.flood!==flood||previousGeometry.frozen!==frozen||previousGeometry.kaunas!==kaunas);
  p.waterGeometry={width,height,flood,frozen,kaunas};
  if(changed&&!frozen&&!p.swept&&(p.crossing||p.tributaryCrossing)){
    // Preserve progress across the deck when the viewport or shoreline
    // changes. Scaling screen coordinates alone can put a crossing walker
    // in a completely different part of the water.
    const old=previousGeometry,ox=p.x*old.width/width,oy=p.y*old.height/height;
    if(p.tributaryCrossing){
      const before=tributaryCrossingBanks(old.width,old.height,!!bridge?.tributary?.built||old.flood);
      const after=tributaryCrossingBanks(width,height,!!bridge?.tributary?.built||flood);
      const progress=Math.max(0,Math.min(1,(ox-before.left[0])/(before.right[0]-before.left[0])));
      p.x=after.left[0]+progress*(after.right[0]-after.left[0]);p.y=after.center[1];
    }else{
      const progress=(oy-streamY(ox,old.width,old.height))/(riverHalfWidth(ox,old.width,old.flood)+6);
      p.x=ford;p.y=streamY(ford,width,height)+Math.max(-1,Math.min(1,progress))*(riverHalfWidth(ford,width,flood)+6);
    }
  }
  // A viewport resize rescales map positions, while river-bank thickness stays
  // in drawing units. Rising water and thaw also change the painted shoreline.
  // Retreat a bank walker to dry land instead of recording these geometry
  // changes as a new physical entry into deep water.
  if(changed&&!frozen&&!p.swept&&!p.crossing&&!p.tributaryCrossing&&Object.values(riverWaterAt(p.x,p.y,width,height,flood,kaunas,-4)).some(Boolean))
    [p.x,p.y]=riverBankPoint(p.x,p.y,width,height,flood,kaunas,6,[p.x,p.y]);
  const center=streamY(p.x,width,height);
  const side=Math.sign(p.y-center)||1;
  if(!frozen&&!p.swept&&Object.values(riverWaterAt(goal[0],goal[1],width,height,flood,kaunas,-4)).some(Boolean))
    goal=riverBankPoint(goal[0],goal[1],width,height,flood,kaunas);
  if(frozen){p.swept=0;p.crossing=0;p.tributaryCrossing=0;}
  if(p.swept){
    const drift=distance*(flood?4:3);
    if(p.channel==='neris'){
      p.y=Math.min(p.landing,p.y+drift*.65);p.x=riverTributaryX(p.y/height)*width;
      if(p.y>=p.landing){
        const reference=[p.x+p.swept*width*.04,p.y];
        [p.x,p.y]=riverBankPoint(...reference,width,height,flood,kaunas,9,reference);
        p.swept=0;p.goal=null;p.wait=4;
      }
      return true;
    }
    p.x=kaunas?Math.max(-width+19,p.x-drift):Math.min(worldWidth-19,p.x+drift);
    p.y=streamY(p.x,width,height)+6*Math.sin(p.x*.06);
    if(kaunas?p.x<=p.landing:p.x>=p.landing){
      const reference=[p.x,travelBankY(p.x,p.swept,width,height,flood)];
      [p.x,p.y]=riverBankPoint(...reference,width,height,flood,kaunas,9,reference);
      p.swept=0;p.goal=null;p.wait=4;
    }
    return distance>0;
  }
  const goalSide=Math.sign(goal[1]-streamY(goal[0],width,height))||1;
  // Reaching the bridge's longitude is not reaching its entrance: the
  // tributary lies along the approach. Finish that crossing first and arrive
  // at the actual main bank before relaxing the bank-following constraints.
  if(!frozen&&!p.crossing&&!p.tributaryCrossing&&side!==goalSide&&Math.abs(p.x-ford)<2&&Math.abs(p.y-travelBankY(ford,side,width,height,flood))<2){
    const vulnerable=child||v.illToday||v.illnessDays>0||v.warmth<40;
    if(bridgeFallChance(bridge,flood,vulnerable)>=1){p.waitingCrossing='main';p.wait=1;return false;}
    p.crossing=goalSide;p.crossingTrips=(p.crossingTrips||0)+1;delete p.bridgeCrossingRoll;
  }
  const water=riverWaterAt(p.x,p.y,width,height,flood,kaunas),deep=riverWaterAt(p.x,p.y,width,height,flood,kaunas,2);
  const inWater=water.main,inTributary=water.tributary&&!water.main;
  const vulnerable=child||v.illToday||v.illnessDays>0||v.warmth<40;
  const builtBridge=typeof bridge==='object'?bridge.built:bridge;
  const mainChance=bridgeFallChance(bridge,flood,vulnerable);
  const tributary=typeof bridge==='object'?bridge.tributary:null,tributaryChance=bridgeFallChance(tributary||false,flood,vulnerable);
  const atTributaryFord=Math.abs(p.y-height*travelNerisFord)<=12;
  if(inWater&&Math.abs(p.x-ford)<=12&&mainChance>0&&mainChance<1)
    p.bridgeCrossingRoll??=riverCrossingRoll(p.seed||0,v.id||0,p.crossingTrips||0);
  const unsafeMain=deep.main&&(Math.abs(p.x-ford)>12||(p.bridgeCrossingRoll??0)<mainChance);
  if(deep.tributary&&!water.main&&atTributaryFord&&tributaryChance>0&&tributaryChance<1)
    p.tributaryCrossingRoll??=riverCrossingRoll(p.seed||0,v.id||0,(p.tributaryTrips||0)*2+1);
  const unsafeNeris=deep.tributary&&!water.main&&(!atTributaryFord||(p.tributaryCrossingRoll??0)<tributaryChance);
  if(!frozen&&(unsafeMain||unsafeNeris)){
    p.falls=(p.falls||0)+1;
    const event=onFall?.(v.id);p.fatal=!!event?.fatal;
    p.swept=unsafeNeris?(Math.sign(p.x/width-riverTributaryX(p.y/height))||1):(p.crossing||side);
    p.channel=unsafeNeris?'neris':'main';p.crossing=0;p.tributaryCrossing=0;
    const random=riverLandingFraction(p.seed||0,v.id||0,event?.count||p.falls);
    if(unsafeNeris){
      const mouth=height*.43;
      p.landing=p.y+Math.max(5,mouth-p.y)*(.2+.65*random);
    }else{
      const available=kaunas?p.x+width-20:worldWidth-20-p.x;
      const drift=Math.min(width*(flood?.5:.35),Math.max(0,available))*(.3+.7*random);
      p.landing=p.x+(kaunas?-1:1)*drift;
    }
    return false;
  }
  let x=goal[0],y=goal[1];
  if(p.crossing){x=ford;y=travelBankY(ford,p.crossing,width,height,flood);}
  else if(!frozen&&side!==goalSide){x=ford;y=travelBankY(ford,side,width,height,flood);}
  if(kaunas&&!frozen&&p.y<center&&y<streamY(x,width,height)){
    const bank=Math.sign(p.x/width-riverTributaryX(p.y/height))||1;
    if(p.tributaryCrossing||bank!==(Math.sign(x/width-riverTributaryX(y/height))||1)){
      const fordY=height*travelNerisFord;
      const banks=tributaryCrossingBanks(width,height,!!tributary?.built||flood);
      // Approach a shallow crossing on the near bank, then traverse it.
      if(!p.tributaryCrossing&&Math.abs(p.y-fordY)>2){[x,y]=bank<0?banks.left:banks.right;}
      else{
        if(!p.tributaryCrossing){
          if(tributaryChance>=1){p.waitingCrossing='tributary';p.wait=1;return false;}
          p.tributaryCrossing=-bank;p.tributaryTrips=(p.tributaryTrips||0)+1;delete p.tributaryCrossingRoll;
        }
        [x,y]=p.tributaryCrossing<0?banks.left:banks.right;
      }
    }
  }
  if(hearth){
    const detour=travelAroundHearth(p,x,y,hearth);
    if(detour[0]===p.x&&detour[1]===p.y&&(x!==p.x||y!==p.y))return false;
    [x,y]=detour;
  }
  const dx=x-p.x,dy=y-p.y,d=Math.hypot(dx,dy);
  if(d<1){
    if(p.tributaryCrossing)p.tributaryCrossing=0;
    else if(p.crossing)p.crossing=0;
    else if(side===goalSide){p.goal=null;p.leg++;p.wait=1.4+v.id%4;}
    return false;
  }
  const wading=!frozen&&(inWater&&!builtBridge||inTributary&&!tributary?.built);
  const step=Math.min(d,distance*(wading?0.55:1));
  const previous=[p.x,p.y];
  p.x+=dx/d*step;p.y+=dy/d*step;
  if(!frozen&&!p.crossing){
    const edge=travelBankY(p.x,side,width,height,flood);
    if((p.y-edge)*side<0)p.y=edge;
  }
  if(!frozen&&kaunas&&!p.tributaryCrossing&&!p.crossing&&riverWaterAt(p.x,p.y,width,height,flood,true).tributary)
    [p.x,p.y]=riverBankPoint(p.x,p.y,width,height,flood,true,6,previous);
  p.travel+=step;return step>0;
}
