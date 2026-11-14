import {materialSites,worldTrees,standingTree,explorationSites,nerisX,campSites,valleySeason} from './practices.js';
import {riverHabitat,woodlandSpecies,treeKeptClear} from './ecology.js';
import { spriteManifest } from './theme.js';
import { animalBehavior, currentWeather, sleepingHut, foodCapacity, stepDay, campFireLit } from './sim.js';
import {fishingCrafts,fishingMethod,fishingMethodNames,fishingPhase} from './fishing.js';
import {drawRiverFishing,drawRiverFish,drawFishingMesh,drawWickerFishingTrap,drawCarriedFishingGear} from './fishing-view.js';
import {assessNeeds} from './needs.js';
import {shelterDrawingScale,compactWorkSpot,householdHutSite} from './settlement-layout.js';
import {drawHealerHome} from './settlement-view.js';
import {healerHomeView,healerMedicineStore,healerTrainingComplete} from './healer-home.js';
import {magicEnabled,magicActions} from './magic.js';
import {drawFolkRite} from './magic-view.js';
import {activityEmoji,villagerSpeech,drawEmojiSpeech} from './village-speech.js';
import {phoneLayoutEnabled,createPhoneGesture} from './phone-ui.js';
import {cropRipeAt} from './farming.js';
import {drawWheat,drawSaddleQuern} from './farming-view.js';

// Offset each walker's sequence so the whole meadow gets visited without
// drawing from the simulation's weather or personality dice.
function roamingPoint(id,leg,seed,width,height){
  const fraction=n=>n-Math.floor(n);
  const u=fraction(id*.618034+leg*.754878+(seed%113)/113);
  const v=fraction(id*.414214+leg*.56984+(seed%127)/127);
  return [22+u*(width-44),70+v*(height-80)];
}

function ellipse(ctx,x,y,rx,ry,fill){
  ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,2*Math.PI);ctx.fillStyle=fill;ctx.fill();
}
function line(ctx,x,y,ex,ey,color,width){
  ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(ex,ey);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
}
function streamY(x,width,height){
  return height*(.51+.078*Math.sin(x/width*7+.4)+.037*Math.sin(x/width*13));
}
function riverHalfWidth(x,width,flood=false){
  return 41+7*Math.sin(x/width*8)+4*Math.cos(x/width*15)+(flood?25:0);
}
const fordFraction=.43,nerisFord=.24;
const camps=campSites;
function hutSite(camp,index){
  return householdHutSite(camps[camp],index);
}
const huntingGround=[385,165],berryPatch=[272,568];
const foodCache=[310,168];
const haulActivities=new Set(['Gather wood','Clear hut site','Clear herb site','Forage','Harvest','Hunt','Fish','Gather reeds']);
export function finishedDailyActivity(job,walker,fraction=0,encounter=null){
  if(walker.job!==job)return false;
  if(job.startsWith('Track '))return encounter!==null&&fraction>=encounter&&!!walker.huntReturned&&!walker.carry;
  return haulActivities.has(job)?walker.leg>=2:walker.leg>0&&walker.wait<=0;
}
export const clearingSeconds=(dt,speed)=>Math.min(1000,Math.max(0,dt))/1000*speed;
function reedSpot(id,width,height,flood){
  const x=width*(.28+.024*(id%5));
  return [x,bankY(x,-1,width,height,flood)-2];
}
function drawFishTrap(g,x,y,spread){
  g.save();g.translate(x,y);g.scale(1,spread);
  ellipse(g,10,4,10,5,'#936e45');
  for(let i=1;i<=4;i++)line(g,i*4,-.5,i*4+1,8,'#cbab78',1);
  ellipse(g,2,4,3,4,'#4f4732');g.restore();
}
function drawFoodCache(g,x,y,food,capacity){
  ellipse(g,x,y,20,5,'#302a2144');
  ellipse(g,x,y-6,17,9,'#865e38');
  ellipse(g,x,y-11,17,5,'#483725');
  const pieces=Math.ceil(food/capacity*18);
  for(let i=0;i<pieces;i++){
    const row=Math.floor(i/6);
    ellipse(g,x-11+(i%6)*4.2+row%2,y-11-row*3,3.4,2.5,i%3?'#bd8654':'#a9573e');
  }
  for(let i=-2;i<=2;i++)line(g,x+i*5-1,y-8,x+i*4,y-1,'#c19762',1.4);
}
const tribeColors=['#9c5139','#446c72','#806a96'];
const godzillaPassSeconds=35;
function godzillaTrack(s,width,height){
  const elapsed=sinceCast(s,'godzilla');
  const defended=s.godzillaDefenders?.length||0;
  const duration=godzillaPassSeconds-Math.min(15,defended*5);
  if(elapsed>=duration)return null;
  return {x:40+(width+30)*elapsed/duration,y:height*.69+2*Math.sin(elapsed*4)};
}
function godzillaCover(p,id,width,height,flood){
  // The roar reaches both banks. Scatter inland and stay clear of the ford.
  const side=Math.sign(p.y-streamY(p.x,width,height))||1;
  const x=Math.max(24,Math.min(width-24,p.x+90*Math.sin(id*2.4)));
  const edge=bankY(x,side,width,height,flood);
  const margin=40+(id%5)*9;
  return [x,side<0?Math.min(edge-12,margin):Math.max(edge+12,height-margin)];
}
function sinceCast(s, command){
  const day=s.lastUsed[command];
  if(day===undefined)return Infinity;
  const start=Math.max(day*s.config.dayMs,s.castAt?.[command]??0);
  return Math.max(0,(s.day*s.config.dayMs+s.elapsedMs-start)/1000);
}
function drawMeteors(g,s,w,h,ground){
  const now=s.day*s.config.dayMs+s.elapsedMs;
  const hits=s.meteors??(s.lastUsed.meteor===undefined?[]:[{x:.83,y:.19,time:now-sinceCast(s,'meteor')*1000}]);
  for(const hit of hits){
    const age=now-hit.time;
    if(age<0||age>=s.config.dayMs)continue;
    const x=w*hit.x,y=h*hit.y,k=Math.max(0,1-age/2800);
    if(k>0&&!ground){
      const mx=x-w*.36*k,my=y-h*.32*k;
      line(g,mx-32,my-25,mx,my,'#ca663b',7);ellipse(g,mx,my,7,6,'#f1bb69');
    }else if(!k&&ground){
      ellipse(g,x,y,30,11,'#5b4a39');ellipse(g,x,y,22,7,'#302e29');
      boulder(g,x+2,y,.65);
    }
  }
}
function disasterScene(g,s,w,h){
  drawMeteors(g,s,w,h,false);
  if(s.lastUsed.volcano===s.day){
    const t=sinceCast(s,'volcano');
    const x=w*.77,y=h*.24;
    g.fillStyle='#56473d';g.beginPath();g.moveTo(x-54,y);g.lineTo(x-10,y-51);g.lineTo(x+7,y-48);g.lineTo(x+45,y);g.closePath();g.fill();
    line(g,x,y-47,x+10,y-21,'#d27642',5);line(g,x+10,y-21,x+4,y-6,'#dd985a',3);
    for(let i=0;i<12;i++){const k=(t*.2+i/12)%1;ellipse(g,x+k*28+Math.sin(i*2+k*5)*8,y-52-k*55,3+k*8,4+k*6,'#6d675a99');}
  }
  if(s.lastUsed['earth crack']===s.day){
    const x=w*fordFraction,y=streamY(x,w,h);
    g.fillStyle='#302d28';g.beginPath();g.moveTo(x+5,y-90);g.lineTo(x+12,y-66);g.lineTo(x+1,y-57);g.lineTo(x+6,y-32);g.lineTo(x-17,y-11);g.lineTo(x-1,y-35);g.lineTo(x-7,y-60);g.lineTo(x+6,y-69);g.closePath();g.fill();
  }
  const monster=godzillaTrack(s,w,h);
  if(monster){
    const t=sinceCast(s,'godzilla');
    const {x,y}=monster;
    g.save();g.translate(x,y);
    if(s.godzillaDefenders?.length){const swipe=Math.max(0,Math.sin(t*2));g.beginPath();g.moveTo(-24,-21);g.quadraticCurveTo(-62,-15,-95,-10-swipe*30);g.lineWidth=8;g.strokeStyle='#344737';g.stroke();}
    g.fillStyle='#344737';g.strokeStyle='#2b3127';g.lineWidth=2;g.beginPath();g.moveTo(-76,-11);g.quadraticCurveTo(-44,0,-24,-35);g.quadraticCurveTo(-13,-62,7,-69);g.lineTo(17,-91);g.lineTo(38,-91);g.lineTo(48,-80);g.lineTo(27,-76);g.quadraticCurveTo(24,-33,9,-18);g.quadraticCurveTo(-12,0,-34,-8);g.closePath();g.fill();g.stroke();
    for(let i=0;i<5;i++){const dx=-40+i*12,dy=-20-i*14;g.fillStyle='#9da882';g.beginPath();g.moveTo(dx,dy);g.lineTo(dx-7,dy-15);g.lineTo(dx+7,dy-6);g.closePath();g.fill();}
    for(const i of [-1,1])line(g,i*9,-23,i*15+Math.sin(t*4)*i*5,0,'#344737',10);
    line(g,16,-49,32,-43,'#344737',6);ellipse(g,32,-85,2,1.6,'#ebc967');g.restore();
  }
}
function paintHare(g,x,y,t){
  const hop=Math.pow(Math.max(0,Math.sin(t)),5)*3;
  ellipse(g,x,y,9,2,'#28372966');
  ellipse(g,x,y-5-hop,7,4,'#ad9371');ellipse(g,x+5,y-8-hop,4,4,'#c0a580');
  line(g,x+4,y-10-hop,x+2,y-17-hop,'#ac906e',2.6);line(g,x+6,y-10-hop,x+7,y-17-hop,'#c0a580',2.5);
  ellipse(g,x+7,y-8-hop,1,1,'#362d25');
}
function paintWorker(g,v,x,y,child,walking,sleeping,travel,job,clock,toolkit=[],furWraps=false){
  g.save();g.translate(x,y);
  const variant=Math.imul(v.id,2654435761)>>>0;
  const scale=child ? .60+.004*v.age : .94+(variant%15)/100;
  g.scale(scale,scale);
  const shoulders=child?4:(v.gender==='male'?5:4)+(variant%5-2)*.55;
  const hair=v.age>=240?'#a89d86':['#56402e','#715137','#483a30','#8b653e'][(variant>>>8)%4];
  const hide=furWraps?'#99764f':tribeColors[v.tribe||0];
  if(sleeping){
    ellipse(g,0,-4,12,5,hide);ellipse(g,10,-6,4.6,4,'#c09b51');
    line(g,9,-6,12,-6,'#473723',1);
    g.restore();return;
  }
  const frightened=job==='Flee';
  if(frightened&&!walking)g.scale(1,.68);
  const step=walking?Math.sin(travel*.24)*(frightened?6:4):0,stroke='#382d24';
  line(g,-3,-10,-4-step,0,stroke,3);line(g,3,-10,4+step,0,stroke,3);
  g.fillStyle=hide;g.strokeStyle=stroke;g.lineWidth=1.7;
  g.beginPath();g.moveTo(-shoulders,-26);g.lineTo(shoulders,-25);g.lineTo(8,-9);g.lineTo(1,-11);g.lineTo(-6,-9);g.closePath();g.fill();g.stroke();
  if(furWraps){
    g.fillStyle='#cc9e56';g.beginPath();g.moveTo(-4,-25);g.lineTo(4,-25);g.lineTo(5,-17);g.closePath();g.fill();
    for(let i=-2;i<=2;i++)line(g,i*2,-14,i*2-1,-10+i%2,'#705337',1);
  }else line(g,-3,-23,5,-13,'#dab77c',2);
  ellipse(g,0,-30,5.8,6.1,'#d1a651');g.stroke();ellipse(g,2,-30,1,1,stroke);
  ellipse(g,-.8,-34.2,5.3,2.6,hair);
  if((variant>>>12)%3===0)ellipse(g,-5.4,-32,2.8,3.1,hair);
  else line(g,-4.8,-34,-5.2,-29-(variant%3),hair,2.3);
  if(!child&&v.gender==='male'&&(variant>>>5)%3!==0){
    g.fillStyle=hair;g.beginPath();g.moveTo(-4,-28);g.lineTo(4,-27);g.lineTo(.4,-22.8);g.closePath();g.fill();
  }
  line(g,-1,-36,1,-40,stroke,1.6);ellipse(g,3,-40,3,1.6,'#687547');
  const reach=!walking&&(job==='Forage'||job==='Plant')?Math.sin(clock*4)*3:0;
  if(frightened){
    line(g,-4,-23,-9,-30,stroke,2);line(g,4,-23,8,-32,stroke,2);
  }else{
    line(g,-4,-23,-8,-16+reach,stroke,2);line(g,4,-23,9,-19+reach,stroke,2);
  }
  if((job==='Defend'||job==='Hunt')&&v.gear==='sling'){
    const swing=clock*8+v.id;
    line(g,6,-24,8+8*Math.cos(swing),-27+8*Math.sin(swing),'#c6aa78',1.8);
    ellipse(g,8+8*Math.cos(swing),-27+8*Math.sin(swing),2,2,'#706656');
  }else if(job.startsWith('Craft ')){
    const lift=Math.sin(clock*6)*3;
    line(g,-8,-17,8,-15,'#bb965e',2);ellipse(g,6,-19+lift,3,2,'#a39d88');
  }else if(job==='Chop tree'){
    const swing=walking?0:Math.sin(clock*6);
    const x=14+4*swing,y=-24+9*swing;
    line(g,7,-18,x,y,'#9e7848',2.5);ellipse(g,x,y,4,3,'#a5a18c');
  }else if((v.gear==='digging stick'||toolkit.includes('digging stick'))&&job==='Forage'){
    line(g,7,-22,10,-3,'#b79867',2.5);
  }else if((job==='Hunt'||job==='Defend')&&v.gear==='bow'){
    g.beginPath();g.moveTo(9,-30);g.quadraticCurveTo(23,-18,10,-7);g.strokeStyle='#b99261';g.lineWidth=2;g.stroke();
    line(g,9,-30,10,-7,'#d0bc92',1);
  }else if((job==='Hunt'||job==='Defend')&&v.gear==='spear thrower'){
    line(g,5,-16,15,-21,'#aa8259',3);
    line(g,6,-8,14,-34,'#503926',2);
    g.fillStyle='#c2bca7';g.beginPath();g.moveTo(12,-32);g.lineTo(16,-41);g.lineTo(16,-32);g.closePath();g.fill();g.stroke();
  }
  g.restore();
}
function bankY(x,side,width,height,flood){
  return streamY(x,width,height)+side*(riverHalfWidth(x,width,flood)+6);
}
// Keep a walker's whole silhouette clear of the small hearth. Follow its
// perimeter until the straight route to the destination opens up again.
function aroundHearth(p,x,y,hearth){
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
export function walkRiver(p,goal,distance,width,height,flood,v,child,bridge,hearth,frozen,worldWidth,kaunas){
  const ford=width*fordFraction;
  const center=streamY(p.x,width,height);
  const side=Math.sign(p.y-center)||1;
  if(frozen){p.swept=0;p.crossing=0;}
  if(p.swept){
    const drift=distance*(flood?4:3);
    p.x=kaunas?Math.max(-width+19,p.x-drift):Math.min(worldWidth-19,p.x+drift);
    p.y=streamY(p.x,width,height)+6*Math.sin(p.x*.06);
    if(kaunas?p.x<=p.landing:p.x>=p.landing){
      p.y=bankY(p.x,p.swept,width,height,flood);p.swept=0;p.goal=null;p.wait=4;
    }
    return distance>0;
  }
  const goalSide=Math.sign(goal[1]-streamY(goal[0],width,height))||1;
  if(!frozen&&!p.crossing&&side!==goalSide&&Math.abs(p.x-ford)<2)p.crossing=goalSide;
  const inWater=Math.abs(p.y-center)<riverHalfWidth(p.x,width,flood);
  if(!frozen&&inWater&&(Math.abs(p.x-ford)>12||flood||(!bridge&&(child||v.illToday||v.illnessDays>0||v.warmth<40)))){
    p.swept=p.crossing||side;p.crossing=0;
    const drift=width*(flood?.40:.23);
    p.landing=kaunas?Math.max(-width+20,p.x-drift):Math.min(worldWidth-20,p.x+drift);return false;
  }
  let x=goal[0],y=goal[1];
  if(p.crossing){x=ford;y=bankY(ford,p.crossing,width,height,flood);}
  else if(!frozen&&side!==goalSide){x=ford;y=bankY(ford,side,width,height,flood);}
  if(kaunas&&!frozen&&p.y<center&&y<streamY(x,width,height)){
    const bank=Math.sign(p.x/width-nerisX(p.y/height))||1;
    if(bank!==(Math.sign(x/width-nerisX(y/height))||1)){
      const fordY=height*nerisFord;
      // Approach a shallow crossing on the near bank, then traverse it.
      if(Math.abs(p.y-fordY)>2){x=(nerisX(nerisFord)+bank*.027)*width;y=fordY;}
      else{x=(nerisX(nerisFord)-bank*.027)*width;y=fordY;}
    }
  }
  if(hearth){
    const detour=aroundHearth(p,x,y,hearth);
    if(detour[0]===p.x&&detour[1]===p.y&&(x!==p.x||y!==p.y))return false;
    [x,y]=detour;
  }
  const dx=x-p.x,dy=y-p.y,d=Math.hypot(dx,dy);
  if(d<1){
    if(p.crossing)p.crossing=0;
    else if(side===goalSide){p.goal=null;p.leg++;p.wait=1.4+v.id%4;}
    return false;
  }
  const inTributary=kaunas&&p.y<center&&Math.abs(p.x/width-nerisX(p.y/height))<(flood?.0155:.0115);
  const wading=!frozen&&(inWater&&!bridge||inTributary);
  const step=Math.min(d,distance*(wading?0.55:1));
  p.x+=dx/d*step;p.y+=dy/d*step;
  if(!frozen&&!p.crossing){
    const edge=bankY(p.x,side,width,height,flood);
    if((p.y-edge)*side<0)p.y=edge;
  }
  p.travel+=step;return step>0;
}
function berryShrub(g,x,y,size,fruit){
  g.save();g.translate(x,y);g.scale(size,size);
  ellipse(g,5,1,17,4,'#29342055');
  for(const [dx,dy] of [[-13,-17],[2,-26],[13,-20]]){
    line(g,0,0,dx,dy,'#503c2c',3);
    line(g,-.7,-1,dx-1,dy,'#ac8658',1);
  }
  for(const [dx,dy,r] of [[-10,-16,10],[9,-17,11],[-2,-23,11],[0,-13,9]]){
    const light=g.createRadialGradient(dx-r*.45,dy-r*.5,1,dx,dy,r);
    light.addColorStop(0,'#859457');light.addColorStop(.55,'#546e40');light.addColorStop(1,'#304a35');
    ellipse(g,dx,dy,r,r*.82,light);
    line(g,dx-5,dy-3,dx-2,dy-5,'#a5ae71',1.1);
  }
  const berries=[[-12,-18],[6,-20],[-4,-26],[0,-12],[14,-16],[-7,-14],[3,-22],[-14,-15],[9,-13]];
  for(const [dx,dy] of berries.slice(0,fruit)){
    ellipse(g,dx,dy,2.4,2.6,'#783e36');
    ellipse(g,dx-.4,dy-.6,1.9,1.8,'#c46c53');
    ellipse(g,dx-1,dy-1.2,.65,.55,'#f1c49a');
  }
  g.restore();
}
function groveTree(g,x,y,size,season,species='broadleaf'){
  g.save();g.translate(x,y);g.scale(size,size);
  ellipse(g,4,-1,25,5,'#25332266');
  if(species==='pine'){
    line(g,0,0,1,-68,'#544536',6);line(g,-1,-2,0,-66,'#a17f53',2);
    for(let i=0;i<4;i++){
      const y=-28-i*14,w=22-i*4;
      g.beginPath();g.moveTo(-w,y+7);g.lineTo(1,y-26);g.lineTo(w,y+7);g.closePath();
      g.fillStyle=i%2?'#38543e':'#486447';g.fill();g.strokeStyle='#2d4335';g.lineWidth=1;g.stroke();
      if(season.name==='Winter')line(g,-w*.5,y-2,0,y-20,'#dce5dc',3);
    }
    g.restore();return;
  }
  if(species==='birch'){
    line(g,0,0,-2,-64,'#e2ddc8',5);
    for(let i=0;i<7;i++)line(g,-2,-7-i*8,2,-9-i*8,'#685d49',1.6);
  }
  if(species==='willow'){
    line(g,0,0,0,-45,'#65533e',6);
    for(let i=-2;i<=2;i++){
      line(g,0,-35,i*12,-55+Math.abs(i)*5,'#756345',2);
      if(season.name!=='Winter'){
        ellipse(g,i*10,-43+Math.abs(i)*3,13,21,season.name==='Autumn'?'#b09b53':'#6e8854');
        for(let j=0;j<3;j++)line(g,i*10+j*3-3,-44,i*11+j*3-4,-20+Math.abs(i)*2,'#97a66c',1.3);
      }
    }
    g.restore();return;
  }
  if(species==='alder')g.scale(.88,.86);
  g.lineJoin='round';if(species!=='birch'){line(g,-2,0,1,-56,'#352e25',9);line(g,-2,-2,1,-56,'#977247',4);}
  for(const [dx,dy,radius] of [[-16,-43,15],[12,-48,19],[-5,-62,21],[3,-74,12]]){
    if(season.name==='Winter'){
      line(g,0,-32,dx,dy,'#534b3e',3);line(g,dx,dy,dx+7,dy-12,'#685b47',1.8);
      line(g,dx,dy,dx-6,dy-9,'#685b47',1.5);
      line(g,dx-5,dy-8,dx,dy-1,'#ecebdd',1+season.strength*2);continue;
    }
    const autumn=season.name==='Autumn',spring=season.name==='Spring';
    const r=spring?radius*(.65+season.strength*.23):radius;
    ellipse(g,dx,dy,r,r*.88,autumn?'#86532f':spring?'#577546':'#2f4837');g.strokeStyle='#293a2d';g.lineWidth=1.7;g.stroke();
    ellipse(g,dx-3,dy-4,r*.77,r*.58,autumn?(dx>0?'#d79943':'#b17139'):spring?'#a7bc74':'#647849');
    line(g,dx-7,dy-5,dx-2,dy-8,'#87955b',1.7);
  }
  g.restore();
}
function boulder(g,x,y,size){
  g.save();g.translate(x,y);g.scale(size,size);ellipse(g,1,0,17,3,'#25332266');
  g.beginPath();g.moveTo(-16,-2);g.lineTo(-11,-13);g.lineTo(-1,-18);g.lineTo(11,-13);g.lineTo(17,-3);g.lineTo(5,0);g.closePath();
  g.fillStyle='#888a76';g.fill();g.strokeStyle='#393e35';g.lineWidth=1.8;g.stroke();
  line(g,-10,-11,-1,-15,'#c3bea1',2);line(g,1,-14,6,-8,'#646956',1.5);g.restore();
}
function skyClock(g,day,hour,speed,darkness,twilight,phone=false,width=390){
  const radius=phone?21:32,orbit=phone?13:22;
  // Dawn is the left horizon, noon the top, dusk the right, and midnight the bottom.
  const angle=(hour-12)*Math.PI/12-Math.PI/2;
  const sunX=orbit*Math.cos(angle),sunY=orbit*Math.sin(angle);
  const phase=hour>=5&&hour<7?'Dawn':hour>=17&&hour<19?'Dusk':hour>=7&&hour<17?'Daylight':'Night';
  const status=speed===0&&phone?'Paused':speed>1?phase+' · '+speed+'×':phase;
  g.save();
  let panelWidth=0;
  if(phone){
    g.font='bold 17px Georgia';const dayWidth=g.measureText('Day '+day).width;
    g.font='bold 13px Georgia';const statusWidth=g.measureText(status).width;
    panelWidth=Math.min(Math.ceil(Math.max(dayWidth,statusWidth))+64,width-144);
    g.save();g.shadowColor='#0c170c77';g.shadowBlur=4;g.shadowOffsetY=1;
    g.fillStyle='#253222e8';g.strokeStyle='#bfa574b8';g.lineWidth=1;
    g.beginPath();g.roundRect(8,8,panelWidth,50,7);g.fill();g.stroke();g.restore();
  }
  g.translate(phone?32:49,phone?33:49);
  ellipse(g,0,1,radius+3,radius+3,'#382f27');
  ellipse(g,0,0,radius,radius,'#d8bc86');
  g.save();
  g.globalAlpha=darkness;
  ellipse(g,0,0,radius,radius,'#28384a');
  g.globalAlpha=twilight*.65;
  ellipse(g,0,0,radius,radius,'#d68e68');
  g.globalAlpha=darkness*(1-twilight);
  for(const [x,y] of [[-9,-18],[7,-23],[19,11],[-21,9]])ellipse(g,x,y,1,1,'#bfc8cd');
  g.restore();
  line(g,-radius,0,radius,0,'#77684c',1.5);
  g.beginPath();g.arc(0,0,orbit,0,Math.PI*2);g.strokeStyle='rgba(134,125,109,.5)';g.lineWidth=.8;g.stroke();

  // Draw both bodies against either half of the face.
  for(let ray=0;ray<8;ray++){
    const direction=ray*Math.PI/4,dx=Math.cos(direction),dy=Math.sin(direction);
    line(g,sunX+dx*5.8,sunY+dy*5.8,sunX+dx*8,sunY+dy*8,'#975b28',1.5);
  }
  ellipse(g,sunX,sunY,5.5,5.5,'#805329');
  ellipse(g,sunX,sunY,4.3,4.3,'#ffcf67');
  g.save();g.translate(-sunX,-sunY);
  g.beginPath();g.arc(0,0,6,Math.PI*.4,Math.PI*1.6);
  g.quadraticCurveTo(-3,0,6*Math.cos(Math.PI*.4),6*Math.sin(Math.PI*.4));
  g.closePath();g.fillStyle='#fff1cd';g.fill();g.strokeStyle='#625b51';g.lineWidth=1;g.stroke();
  g.restore();
  g.textAlign='left';g.fillStyle=phone?'#fff3d6':'#f4e6c7';g.font=phone?'bold 17px Georgia':'15px Georgia';
  const labelX=phone?30:43,textWidth=phone?panelWidth-64:undefined;
  if(phone){g.strokeStyle='#13200f';g.lineWidth=2;g.strokeText('Day '+day,labelX,-2,textWidth);}
  if(phone)g.fillText('Day '+day,labelX,-2,textWidth);else g.fillText('Day '+day,labelX,-3);
  g.font=phone?'bold 13px Georgia':'12px Georgia';
  if(phone)g.strokeText(status,labelX,16,textWidth);
  if(phone)g.fillText(status,labelX,16,textWidth);else g.fillText(status,labelX,13);
  g.restore();
}
function riverBands(width,height,baseWidth,flood,kaunas){
  const tributary=new Path2D();
  if(kaunas){
    for(let j=-151;j<=95;j++){
      const v=j/150,x=nerisX(v)*baseWidth,y=v*height;
      if(j===-151)tributary.moveTo(x,y);else tributary.lineTo(x,y);
      if(y>=streamY(x,baseWidth,height)-riverHalfWidth(x,baseWidth,flood)*1.45){
        const join=x-baseWidth*.055,mid=streamY(join,baseWidth,height);
        tributary.bezierCurveTo(x-baseWidth*.01,y+30,join+baseWidth*.015,mid,join,mid);
        break;
      }
    }
  }
  const first=-Math.ceil(baseWidth/5)*5-5,edge=Math.ceil((width-baseWidth)/5)*5+5;
  function paintBand(g,color,margin){
    g.beginPath();
    if(kaunas){
      g.lineJoin='round';g.lineCap='round';g.lineWidth=Math.max(3,baseWidth*(.023+(flood?.008:0))+margin*1.7);
      g.strokeStyle=color;g.stroke(tributary);
    }
    for(let x=first;x<=edge;x+=5){
      const y=streamY(x,baseWidth,height)-riverHalfWidth(x,baseWidth,flood)-margin;
      if(x===first)g.moveTo(x,y);else g.lineTo(x,y);
    }
    for(let x=edge;x>=first;x-=5)g.lineTo(x,streamY(x,baseWidth,height)+riverHalfWidth(x,baseWidth,flood)+margin);
    g.closePath();g.fillStyle=color;g.fill();
  }
  return {first,edge,paintBand};
}
function landscape(canvas,width,height,flood,baseWidth,season,kaunas){
  const g=canvas.getContext('2d');
  g.scale(canvas.width/width,canvas.height/(3*height));
  g.translate(baseWidth,height);
  let seed=8121;
  const rand=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  const grass=g.createLinearGradient(0,0,width,height);
  const winter=season.name==='Winter';
  const ground={Spring:['#95a468','#738c58','#a1af6a'],Summer:['#667a46','#40583c','#738552'],Autumn:['#aa8b52','#796c46','#998153'],Winter:season.strength>.64?['#dee5df','#b5c6c6','#e3e7db']:['#a1a791','#828f83','#b5ba9f']}[season.name];
  ground.forEach((color,i)=>grass.addColorStop(i/2,color));

  g.fillStyle=grass;g.fillRect(-baseWidth,-height,width,3*height);
  for(const [cx,cy,rx,ry] of [[.24,.26,.14,.09],[.73,.17,.1,.06]]){
    ellipse(g,baseWidth*cx,height*cy,baseWidth*rx,height*ry,winter?'#aab5a9':ground[1]);
    for(let i=0;i<16;i++){const a=.15+i*.17;boulder(g,baseWidth*(cx+rx*Math.cos(a)),height*(cy+ry*Math.sin(a)),.35+rand()*.45);}
  }
  for(let i=0;i<width*height/200;i++){
    const x=rand()*width-baseWidth,y=(rand()*3-1)*height,n=2+rand()*7;
    line(g,x,y,x+n,y+n*.76,winter?'#9daaa14d':rand()<.55?'#30432c66':'#52624488',.85);
    if(i%3===0)line(g,x+3,y-2,x+3+n,y-2+n*.76,'#31412e',.8);
  }
  for(let i=0;i<width*height/60;i++){
    g.fillStyle=i%2?'#503c2410':'#fff6d325';
    g.fillRect(rand()*width-baseWidth,(rand()*3-1)*height,1+rand(),1);
  }
  for(let i=0;i<width*height*(.5+season.strength)/3700;i++){
    const x=rand()*width-baseWidth,y=(rand()*3-1)*height;
    if(winter)ellipse(g,x,y,5+rand()*18,2+rand()*5,'#f1f2e777');
    else if(season.name==='Autumn')ellipse(g,x,y,3,1.4,i%2?'#b47e3e':'#955f32');
    else if(season.name==='Spring')ellipse(g,x,y,2.4,2,i%3?'#efe9bd':'#b7a7c4');
    else line(g,x,y,x+2,y-5,'#aeb66d',1.6);
  }
  if(kaunas){
    for(const [cx,cy,rx,ry] of [[.16,.15,.19,.14],[.72,.19,.24,.18],[.83,.79,.25,.14],[.20,.87,.20,.14],[1.45,.72,.30,.17]]){
      g.save();g.translate(cx*baseWidth,cy*height);g.scale(rx*baseWidth,ry*height);g.rotate(-.18);
      const relief=g.createLinearGradient(-.6,-1,.5,1);
      relief.addColorStop(0,'rgba(220,217,151,.16)');relief.addColorStop(.5,'rgba(133,132,96,.04)');relief.addColorStop(.83,'rgba(75,72,53,.16)');relief.addColorStop(1,'rgba(65,73,48,.02)');
      ellipse(g,0,0,1,.83,relief);g.restore();
    }
    // Damp alluvial margins and sparse reeds, before the water covers its bed.
    for(let i=0;i<1100;i++){
      const x=(rand()*3-1)*baseWidth,y=(rand()*3-1)*height;
      const h=riverHabitat(x/baseWidth*1000,y/height*640);
      if(h.water||!h.wet)continue;
      ellipse(g,x,y,8+rand()*17,3+rand()*6,winter?'#8d9e8b33':'#3e60422b');
      const reed=h.mainDistance<47||h.tributaryDistance<38;
      for(let blade=0;blade<3;blade++){
        const tall=reed?13+rand()*10:5+rand()*7;
        line(g,x+blade*3,y,x+blade*3-3+rand()*6,y-tall,winter?'#a99c77':'#6f8956',1.3);
        if(reed)line(g,x+blade*3-1,y-tall,x+blade*3-1,y-tall-4,'#897445',2);
      }
    }
  }
  // Carry each band of colour through both channels before drawing the next.
  // This keeps the bank and shoal contours outside the mouth of the tributary.
  const {first,edge,paintBand}=riverBands(width,height,baseWidth,flood,kaunas);
  for(const [color,margin] of [['#576044',5],['#b3a57a',3],[season.frozen?'#e3ece4':'#86a99a',0],[season.frozen?'#b2cbd0':'#547e78',-6],[season.frozen?'#9fbcc5':'#355e65',-17]]){
    paintBand(g,color,margin);
  }
  for(let x=first;x<edge;x+=4+rand()*9){
    const offset=(rand()*2-1)*.85;
    const y=streamY(x,baseWidth,height)+riverHalfWidth(x,baseWidth)*offset;
    const end=x+3+rand()*9;
    line(g,x,y,end,streamY(end,baseWidth,height)+riverHalfWidth(end,baseWidth)*offset,'#a7bfb1',.9);
  }
  if(kaunas){
    const y=height*nerisFord,x=baseWidth*nerisX(nerisFord),half=baseWidth*.014;
    for(let i=-5;i<=5;i++){
      const px=x+half*i/5,py=y+Math.sin(i*.7)*3;
      ellipse(g,px,py+1,5,2,season.frozen?'#b8c9c7':'#93a59a');
      if(!flood)boulder(g,px,py,.28+(i%2===0?.08:0));
    }
  }
  const ford=baseWidth*fordFraction,half=riverHalfWidth(ford,baseWidth);
  for(let i=-half;i<=half;i+=12)boulder(g,ford+4*Math.sin(i),streamY(ford,baseWidth,height)+i,.45);
}

// Route on a coarse land grid. Existing worn ground is cheaper, so trips out
// of the same camp share a trail before branching toward their destination.
function paintFootpaths(layer,s,width,height,span,flood,season){
  const g=layer.getContext('2d');
  g.setTransform(layer.width/(width*span),0,0,layer.height/(height*3),layer.width/3,layer.height/3);
  const step=18,cols=Math.ceil(1000*span/step)+1,rows=Math.ceil(1920/step)+1;
  const used=new Set(),trees=new Set();
  const cell=(x,y)=>Math.max(0,Math.min(rows-1,Math.round((y+640)/step)))*cols+Math.max(0,Math.min(cols-1,Math.round((x+1000)/step)));
  worldTrees(s).forEach(([x,y],i)=>{if(standingTree(s,i))trees.add(cell(x,y));});
  const noise=(n)=>{let h=Math.imul(n^s.seed,1597334677);return ((h^(h>>>16))>>>0)/4294967296;};
  const world=id=>[(id%cols+(noise(id*7)-.5)*.65-1000/step)*step*width/1000,
    (Math.floor(id/cols)+(noise(id*11+1)-.5)*.65-640/step)*step*height/640];
  const kaunas=s.local?.terrain==='kaunas';
  const region=([x,y])=>{
    if(y>=streamY(x,width,height))return 1;
    return kaunas&&x>nerisX(y/height)*width?-2:-1;
  };
  const land=id=>{
    const [x,y]=world(id);
    if(Math.abs(y-streamY(x,width,height))<=riverHalfWidth(x,width,flood)+5)return 0;
    if(kaunas&&y<streamY(x,width,height)&&Math.abs(x-nerisX(y/height)*width)<width*(flood?.0155:.0115)+5)return 0;
    return region([x,y]);
  };
  const nearest=(x,y,side)=>{
    const center=cell(x,y);let best=null,cost=Infinity;
    for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){
      const id=center+dy*cols+dx;if(id<0||id>=rows*cols||land(id)!==side)continue;
      const [px,py]=world(id),d=Math.hypot(px/width*1000-x,py/height*640-y);
      if(d<cost){cost=d;best=id;}
    }return best;
  };
  function route(from,to,side){
    const start=nearest(...from,side),end=nearest(...to,side);
    if(start==null||end==null)return [];
    const queue=[start],prev=new Map([[start,null]]),dist=new Map([[start,0]]);
    const score=id=>dist.get(id)+.65*Math.hypot(id%cols-end%cols,Math.floor(id/cols)-Math.floor(end/cols));
    while(queue.length){
      let j=0;for(let i=1;i<queue.length;i++)if(score(queue[i])<score(queue[j]))j=i;
      const id=queue.splice(j,1)[0];if(id===end)break;
      for(const dx of [-1,0,1])for(const dy of [-1,0,1]){
        const col=id%cols+dx,row=Math.floor(id/cols)+dy,n=row*cols+col;
        if((!dx&&!dy)||col<0||col>=cols||row<0||row>=rows||land(n)!==side)continue;
        const cost=dist.get(id)+Math.hypot(dx,dy)*(used.has(n)?.66:1+noise(n)*.45)+(trees.has(n)?1.4:0);
        if(cost>=(dist.get(n)??Infinity))continue;
        prev.set(n,id);dist.set(n,cost);if(!queue.includes(n))queue.push(n);
      }
    }
    if(!prev.has(end))return [];
    const result=[];for(let id=end;id!=null;id=prev.get(id)){used.add(id);result.push(world(id));}
    return result.reverse();
  }
  const paths=Object.values(s.local?.paths||{}).filter(p=>p.wear>=3).sort((a,b)=>b.wear-a.wear);
  const sideOf=([x,y])=>region([x*width/1000,y*height/640]);
  const ink=season.name==='Winter'?'105,113,104':'100,83,57';
  for(const p of paths){
    const from=camps[p.camp],to=[p.x,p.y],a=sideOf(from),b=sideOf(to);
    const fordY=streamY(fordFraction*width,width,height)*640/height;
    const mainOffset=(riverHalfWidth(fordFraction*width,width,flood)+7)*640/height;
    const north=[430,fordY-mainOffset],south=[430,fordY+mainOffset];
    const sections=[];
    function approach(start,end){
      const side=sideOf(start);
      if(side===sideOf(end)){sections.push([start,end,side]);return;}
      const direction=side===-2?1:-1;
      const offset=(flood?16:12)+6000/width;
      const bank=d=>[1000*nerisX(nerisFord)+d*offset,640*nerisFord];
      sections.push([start,bank(direction),side],[bank(-direction),end,sideOf(end)]);
    }
    if(a===1&&b<0){approach(from,south);approach(north,to);}
    else if(a<0&&b===1){approach(from,north);approach(south,to);}
    else approach(from,to);
    for(const [start,end,side] of sections){
      const nodes=route(start,end,side);if(!nodes.length)continue;
      const points=[[start[0]*width/1000,start[1]*height/640],...nodes,[end[0]*width/1000,end[1]*height/640]];
      for(let i=1;i<points.length-1;i++){
        const [ax,ay]=points[i-1],[cx,cy]=points[i],[bx,by]=points[i+1];
        const length=Math.hypot(bx-ax,by-ay),steps=Math.max(1,Math.ceil(length/5));
        for(let j=0;j<steps;j++){
          const t=j/steps,u=1-t;
          const x=u*u*(ax+cx)/2+2*u*t*cx+t*t*(cx+bx)/2;
          const y=u*u*(ay+cy)/2+2*u*t*cy+t*t*(cy+by)/2;
          if(Math.abs(y-streamY(x,width,height))<riverHalfWidth(x,width,flood)+6)continue;
          const grain=noise(Math.floor(x)*19+Math.floor(y)*43);
          if(grain>.69+p.wear*.009)continue;
          const r=(1.5+Math.sqrt(p.wear)*.68)*(.55+grain*.8);
          g.fillStyle='rgba('+ink+','+(.045+p.wear*.0025)+')';
          g.beginPath();g.ellipse(x,y,r*1.25,r,0,0,Math.PI*2);g.fill();
        }
      }
    }
  }
  // Remove the full width of every trail mark from both channels and their banks.
  g.save();
  g.globalCompositeOperation='destination-out';
  riverBands(width*span,height,width,flood,kaunas).paintBand(g,'#000',5);
  g.restore();
}

// Painted props and walkers share the same depth order, using their feet.
export function createClearing(host,getState){
  const canvas=document.createElement('canvas');host.append(canvas);
  const ctx=canvas.getContext('2d'),paper=document.createElement('canvas');
  const images=new Map(),people=new Map();
  for(const [key,url] of Object.entries(spriteManifest())){
    const img=new Image();img.onload=()=>images.set(key,img);img.src=url;
  }
  const paint=(key,x,y,w,h)=>{
    const img=images.get(key);if(img)ctx.drawImage(img,x-w/2,y-h,w,h);
  };
  let clock=0,gustLeft=0,signalLeft=0,refused=false,lastSeed,seenDay=-1,birthId,birthTime=0;
  let fieldWidth=1000,fieldHeight=640,previousFlood,previousSeason;
  let oldPaper,lastTrailKey;
  const trailPaper=document.createElement('canvas');
  let selected=null;
  const card=document.createElement('div');
  card.className='villager-card';card.hidden=true;
  const title=document.createElement('strong'),activity=document.createElement('div'),bioLine=document.createElement('small');
  card.append(title,activity,bioLine);host.append(card);
  const dismissCard=document.createElement('button');dismissCard.type='button';dismissCard.textContent='Close';dismissCard.className='phone-card-close';dismissCard.hidden=true;
  dismissCard.setAttribute('aria-label','Close selection details');dismissCard.onclick=()=>{selected=null;card.hidden=true;};card.append(dismissCard);
  // Camera origin and pointer positions are fractions of the full valley.
  // Keep some terrain outside the frame even before the first expedition.
  const widestView=1/3,homeZoom=phoneLayoutEnabled()?2.2:1.25;
  let zoom=homeZoom,left=phoneLayoutEnabled()?.227-.5/homeZoom:.1,top=phoneLayoutEnabled()?222/640-.5/homeZoom:.1,mapSpan=1;
  const pointers=new Map();
  const phoneGesture=createPhoneGesture();
  canvas.style.touchAction='none';
  canvas.title='Drag or scroll sideways to pan · scroll vertically or pinch to zoom · double-click to return home';
  function frame(z,x,y){
    zoom=z;
    const limit=2-1/z;
    left=Math.max(-1,Math.min(limit,x));top=Math.max(-1,Math.min(limit,y));
    canvas.style.cursor=z>1||mapSpan>1?'grab':'default';
  }
  function localPoint(e){
    const r=canvas.getBoundingClientRect();
    return [(e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height];
  }
  function focusZoom(z,from,to=from){
    z=Math.min(6,Math.max(widestView,z));
    frame(z,left+from[0]/zoom-to[0]/z,top+from[1]/zoom-to[1]/z);
  }
  function inspect(event){
    const [u,v]=localPoint(event);
    const x=(left+u/zoom)*fieldWidth,y=(top+v/zoom)*fieldHeight;
    const touch=event.pointerType==='touch'&&phoneLayoutEnabled();
    const rx=touch?Math.max(17,24*fieldWidth/(canvas.clientWidth*zoom)):17;
    const ry=touch?24*fieldHeight/(canvas.clientHeight*zoom):0;
    let closest=Infinity;selected=null;
    for(const [id,p] of people){
      const height=p.hitHeight||40,dx=x-p.x,dy=y-(p.y-height/2);
      const distance=(dx/rx)**2+(dy/Math.max(height/2+5,ry))**2;
      if(distance<=1&&distance<closest){selected=id;closest=distance;}
    }
    if(selected===null){
      const home=healerHomeView(getState(),camps[0]);
      if(home?.work>0){
        const hx=home.home[0]*fieldWidth/1000,hy=home.home[1]*fieldHeight/640;
        if(x>=hx-Math.max(48,rx)&&x<=hx+Math.max(67,rx)&&y>=hy-Math.max(70,ry)&&y<=hy+Math.max(14,ry))selected='healer-home';
      }
    }
    if(selected===null&&Math.abs(x-foodCache[0]*fieldWidth/1000)<Math.max(23,touch?rx:0)&&Math.abs(y-foodCache[1]*fieldHeight/640+8)<Math.max(14,ry))selected='cache';
    if(touch&&selected===null){
      const s=getState();
      for(const [slot,camp] of (s.huts||[]).entries()){
        const site=hutSite(camp,s.huts.slice(0,slot).filter(c=>c===camp).length),hx=site[0]*fieldWidth/1000,hy=site[1]*fieldHeight/640;
        if(Math.abs(x-hx)<Math.max(48,rx)&&Math.abs(y-hy+25)<Math.max(45,ry)){selected='hut:'+slot;break;}
      }
      if(selected===null&&s.settlementWork>0&&Math.abs(x-227*fieldWidth/1000)<Math.max(40,rx)&&Math.abs(y-217*fieldHeight/640)<Math.max(30,ry))selected='communal';
    }
  }
  canvas.addEventListener('wheel',e=>{
    e.preventDefault();
    const horizontal=!e.ctrlKey&&(e.shiftKey||Math.abs(e.deltaX)>Math.abs(e.deltaY));
    const pageSize=horizontal?canvas.clientWidth:canvas.clientHeight;
    const unit=e.deltaMode===1?16:e.deltaMode===2?pageSize:1;
    if(horizontal){
      const pixels=(e.deltaX||e.deltaY)*unit;
      frame(zoom,left+pixels/(canvas.clientWidth*zoom),top);
    }else focusZoom(zoom*Math.exp(-e.deltaY*unit*.002),localPoint(e));
    inspect(e);
  },{passive:false});
  function recenter(){const z=phoneLayoutEnabled()?2.2:1.25;frame(z,phoneLayoutEnabled()?.227-.5/z:.1,phoneLayoutEnabled()?222/640-.5/z:.1);selected=null;}
  canvas.addEventListener('dblclick',e=>{recenter();inspect(e);});
  canvas.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;
    pointers.set(e.pointerId,localPoint(e));canvas.setPointerCapture(e.pointerId);
    if(e.pointerType==='touch'&&phoneLayoutEnabled())phoneGesture.start(e.pointerId,e.clientX,e.clientY);else inspect(e);
  });
  canvas.addEventListener('pointerup',e=>{
    if(e.pointerType==='touch'&&phoneLayoutEnabled()&&phoneGesture.end(e.pointerId))inspect(e);
    pointers.delete(e.pointerId);
  });
  canvas.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);phoneGesture.cancel(e.pointerId);});
  canvas.addEventListener('lostpointercapture',e=>{pointers.delete(e.pointerId);phoneGesture.cancel(e.pointerId);});
  canvas.addEventListener('pointermove',e=>{
    const old=pointers.get(e.pointerId);
    if(!old){if(e.pointerType==='mouse')inspect(e);return;}
    const pt=localPoint(e);pointers.set(e.pointerId,pt);
    if(e.pointerType==='touch'&&phoneLayoutEnabled()&&!phoneGesture.move(e.pointerId,e.clientX,e.clientY))return;
    if(pointers.size===1)focusZoom(zoom,old,pt);
    else if(pointers.size===2){
      const other=[...pointers].find(([id])=>id!==e.pointerId)[1];
      const dist=p=>Math.hypot((p[0]-other[0])*canvas.clientWidth,(p[1]-other[1])*canvas.clientHeight);
      const mid=p=>[(p[0]+other[0])/2,(p[1]+other[1])/2];
      if(dist(old)>1)focusZoom(zoom*dist(pt)/dist(old),mid(old),mid(pt));
    }
    selected=null;
  });
  canvas.addEventListener('pointerleave',event=>{if(event.pointerType==='mouse')selected=null;});
  let planKey,assignments=new Map(),huntSites=new Map(),huntDay=-1,huntSeed;
  let guides=new Map();
  let patients=new Map();
  let wildlife;
  let foragingPatches={},outing,fieldCamp,daughter,visitSites=new Map();
  let afternoonWork=[],fishingPlan={},urgentPlan=new Map();
  let magicPlan=new Map();
  let stoneWork;
  let woodTargets={},fallTimes=new Map(),forestDay;
  const caught=new Set();
  let hutJobs={};
  function draw(dt){
    const s=getState(),rect=host.getBoundingClientRect(),ratio=Math.min(devicePixelRatio||1,2);
    const w=Math.max(1,Math.round(rect.width*ratio)),h=Math.max(1,Math.round(rect.height*ratio));
    const flood=s.lastUsed.flood===s.day;
    const season=valleySeason(s);
    const blend=season.index?Math.min(1,(season.age+s.elapsedMs/s.config.dayMs)/4):1;
    const prior=blend<1?valleySeason(s,s.day-season.age-1):season;
    const foliage=(id)=>((Math.imul(id+1,2654435761)>>>0)/4294967296)<blend?season:prior;
    const seasonKey=[season.name,season.strength,season.frozen].join();
    const keyForPlan=[s.seed,s.day,s.castCount,s.fireRevision,s.queuedCommand,s.ended].join('|');
    if(planKey!==keyForPlan){
      // stepDay is pure. Preview the same priority decisions that will settle
      // at dawn, including changes caused by a newly queued god command.
      const forecast=s.ended?null:stepDay(s),report=forecast?.lastDay;
      const predicted=new Map((forecast?.villagers||[]).map(v=>[v.id,v]));
      urgentPlan=new Map(s.villagers.map(v=>[v.id,!!s.config.learning&&
        (predicted.get(v.id)?.motivation||assessNeeds(s,v)).level<2]));
      assignments=new Map(report?.actions.map(a=>[a.id,a.action])||[]);
      guides=new Map((report?.actions||[]).filter(a=>a.mentor!=null).map(a=>[a.id,a.mentor]));
      patients=new Map((report?.actions||[]).filter(a=>a.patient!=null).map(a=>[a.id,a.patient]));
      hutJobs=report?.hutSites||{};
      stoneWork=report?.stoneWork;
      wildlife=report?.wildlife;
      foragingPatches=report?.foragingPatches||{};
      outing=report?.outing;
      fieldCamp=report?.fieldCamp;daughter=report?.daughter;
      visitSites=new Map((report?.actions||[]).filter(a=>a.site).map(a=>[a.id,a.site]));
      afternoonWork=report?.weeklyWork||[];
      fishingPlan=report?.fishing||{};
      woodTargets=report?.felledTrees||{};
      magicPlan=new Map((report?.magic||[]).map(r=>[r.id,r]));
      if(forestDay!==s.day||s.seed!==lastSeed){fallTimes.clear();forestDay=s.day;}
      huntSites=new Map((report?.actions||[]).filter(a=>a.action==='Hunt').map((a,i)=>[a.id,i]));
      planKey=keyForPlan;
    }
    const kaunas=s.local?.terrain==='kaunas';
    const span=3;

    if(s.seed!==lastSeed||canvas.width!==w||canvas.height!==h||!canvas.dataset.sized||previousFlood!==flood||mapSpan!==span||previousSeason!==seasonKey||(blend<1&&!oldPaper)){
      previousSeason=seasonKey;
      mapSpan=span;frame(zoom,left,top);
      const unit=Math.min(rect.width,rect.height)/1920 || 1;
      const nextWidth=rect.width/unit,nextHeight=rect.height/unit;
      for(const p of people.values()){
        p.x*=nextWidth/fieldWidth;p.y*=nextHeight/fieldHeight;p.landing*=nextWidth/fieldWidth;p.goal=null;
      }
      fieldWidth=nextWidth;fieldHeight=nextHeight;
      canvas.width=w;canvas.height=h;paper.width=Math.min(4096,w*3);paper.height=Math.min(4096,h*3);
      oldPaper=null;
      if(blend<1){
        oldPaper=document.createElement('canvas');oldPaper.width=paper.width;oldPaper.height=paper.height;
        landscape(oldPaper,fieldWidth*span,fieldHeight,flood,fieldWidth,{...prior,frozen:season.frozen},kaunas);
      }
      landscape(paper,fieldWidth*span,fieldHeight,flood,fieldWidth,season,kaunas);canvas.dataset.sized='1';previousFlood=flood;
    }
    if(s.seed!==lastSeed||s.day<seenDay){people.clear();clock=0;birthTime=0;gustLeft=0;lastSeed=s.seed;}
    if(s.day!==seenDay&&s.lastDay?.birth){birthId=s.lastDay.birth;birthTime=5;}
    seenDay=s.day;
    const worldWidth=fieldWidth*span;
    const seconds=clearingSeconds(dt,s.speed);
    clock+=seconds;gustLeft=Math.max(0,gustLeft-seconds);birthTime=Math.max(0,birthTime-seconds);
    ctx.setTransform(w/fieldWidth*zoom,0,0,h/fieldHeight*zoom,-left*w*zoom,-top*h*zoom);
    ctx.drawImage(paper,-fieldWidth,-fieldHeight,worldWidth,3*fieldHeight);
    if(oldPaper&&blend<1){ctx.globalAlpha=1-blend;ctx.drawImage(oldPaper,-fieldWidth,-fieldHeight,worldWidth,3*fieldHeight);ctx.globalAlpha=1;}
    else oldPaper=null;
    const quakeAge=sinceCast(s,'earthquake');
    if(quakeAge<2.2){
      const strength=3*(1-quakeAge/2.2);
      ctx.translate(Math.sin(clock*39)*strength,Math.cos(clock*46)*strength);
    }
    for(let i=0;!season.frozen&&i<48*span;i++){
      const offset=i*137+clock*(kaunas?-1:1)*(flood?61:32);
      const x=((offset%worldWidth+worldWidth)%worldWidth)-fieldWidth;
      const lane=Math.sin(i*2.4)*.8;
      const level=px=>streamY(px,fieldWidth,fieldHeight)+lane*riverHalfWidth(px,fieldWidth,flood);
      line(ctx,x,level(x),x+9,level(x+9),'#c7e2d599',1.3);
    }
    if(kaunas&&!season.frozen){
      for(let i=0;i<58;i++){
        const v=-1+((i*.037+clock*(flood?.014:.009))%1.7);
        const x=nerisX(v)*fieldWidth+Math.sin(i*8)*fieldWidth*.006,y=v*fieldHeight;
        if(y>streamY(x,fieldWidth,fieldHeight)-riverHalfWidth(x,fieldWidth,flood)*1.6)continue;
        line(ctx,x,y,x+(nerisX(v+.004)-nerisX(v))*fieldWidth,y+.004*fieldHeight,'#c7e2d599',1.3);
      }
    }
    const point=(x,y)=>[x*fieldWidth/1000,y*fieldHeight/640];
    const trailKey=[s.seed,s.day,canvas.width,canvas.height,span,flood].join('|');
    if(trailKey!==lastTrailKey){
      trailPaper.width=paper.width;trailPaper.height=paper.height;
      paintFootpaths(trailPaper,s,fieldWidth,fieldHeight,span,flood,season);
      lastTrailKey=trailKey;
    }
    ctx.drawImage(trailPaper,-fieldWidth,-fieldHeight,worldWidth,3*fieldHeight);
    const hearths=camps.slice(0,s.tribeCount||1).map(site=>{
      const [x,y]=point(...site);return [x+86,y-22];
    });
    const hour=(6+24*s.elapsedMs/s.config.dayMs)%24;
    const sunlight=Math.cos((hour-12)*Math.PI/12);
    const darkness=Math.max(0,Math.min(1,(.25-sunlight)/.85));
    drawMeteors(ctx,s,fieldWidth,fieldHeight,true);
    const layers=[];
    for(const [camp,store] of Object.entries(s.local?.campStores||{})){
      if(!store.built)continue;
      const [cx,cy]=point(...camps[camp]),x=cx+48,y=cy+22;
      for(let index=0;index<(store.racks||1);index++){
        const hanging=Math.max(0,Math.min(4,store.rack-index*4));
        layers.push({y:y+index*12,draw:()=>{
        ctx.save();ctx.translate(index%2*38,index*12);
        for(const dx of [-14,14])line(ctx,x+dx,y,x+dx,y-24,'#694b34',3);
        line(ctx,x-18,y-22,x+18,y-22,'#986e42',3);
        for(let i=0;i<hanging;i++){line(ctx,x-10+i*7,y-22,x-10+i*7,y-16,'#ccb17e',1);ellipse(ctx,x-10+i*7,y-13,2.5,5,'#a2654c');}
        drawFoodCache(ctx,x+32,y,Math.max(0,Math.min(24,store.saved-index*24)),24);
        ctx.restore();
      }});
      }
    }
    const easternSite=daughter||s.local?.daughter;
    if(easternSite){
      const [x,y]=point(...easternSite.site);
      const [hx,hy]=point(...camps[easternSite.origin]);
      for(let i=1;i<=8;i++){
        const sx=hx+(x-hx)*i/9,sy=hy+(y-hy)*i/9;
        if(Math.abs(sy-streamY(sx,fieldWidth,fieldHeight))>riverHalfWidth(sx,fieldWidth,flood))line(ctx,sx,sy,sx-2,sy-9,'#a79468',2);
      }
      layers.push({y,draw:()=>{
        line(ctx,x-20,y,x,y-24,'#684e37',3);
        if(easternSite.shelter>=3){ctx.fillStyle='#ad8c59';ctx.beginPath();ctx.moveTo(x-21,y);ctx.lineTo(x,y-27);ctx.lineTo(x+18,y);ctx.fill();}
        if(easternSite.members.length){
          drawFoodCache(ctx,x+39,y+3,easternSite.food,48);
          paint('campfire_lit',x+64,y,19,19);
          if(easternSite.field)paint('corn',x+90,y,12,12+easternSite.field);
        }
      }});
    }
    if(fieldCamp){
      const [x,y]=point(...fieldCamp.site);
      layers.push({y,draw:()=>{ctx.fillStyle='#997951';ctx.beginPath();ctx.moveTo(x-28,y);ctx.lineTo(x-15,y-22);ctx.lineTo(x+5,y);ctx.fill();line(ctx,x-29,y,x-15,y-24,'#583f2a',2);paint('campfire_lit',x+32,y,18,18+Math.sin(clock*5));}});
    }
    const fraction=s.elapsedMs/s.config.dayMs;
    if(wildlife)for(let i=0;i<wildlife.count;i++){
      const behavior=animalBehavior(wildlife,i,fraction);
      let t=behavior.position;
      const attempt=wildlife.attempts.find(a=>a.animal===i);
      if(t<0||t>1||(attempt?.success&&fraction>=attempt.encounter))continue;
      const fleeing=attempt&&!attempt.success&&fraction>=attempt.encounter;
      if(fleeing)t=Math.max(t,animalBehavior(wildlife,i,attempt.encounter).position+(fraction-attempt.encounter)*5);
      if(t>1)continue;
      const feeding=!fleeing&&behavior.state==='feeding',moving=fleeing||behavior.state==='walking';
      const [x,y]=point(wildlife.origin+wildlife.width*(wildlife.east?t:1-t),wildlife.y+i*2);
      layers.push({y,draw:()=>{
        ctx.save();ctx.translate(x,y);ctx.scale(wildlife.east?1:-1,1);
        if(wildlife.species==='hare'){ctx.scale(1,feeding?.73+.03*Math.sin(clock*3+i):1);paintHare(ctx,0,0,moving?clock*(fleeing?12:8)+i:0);}
        else{
          const step=moving?Math.sin(clock*(fleeing?12:7)+i)*5:0;
          for(const [hip,foot] of [[-9,step],[-6,-step],[6,-step],[9,step]])
            line(ctx,hip,-14,hip+foot,0,'#5b4836',2.2);
          ellipse(ctx,0,-16,13,6,'#a57b51');ctx.translate(8,-17);if(feeding)ctx.rotate(1.68+.09*Math.sin(clock*2+i));ctx.translate(-8,17);line(ctx,8,-17,13,-29,'#a57b51',6);
          ellipse(ctx,16,-29,5,3,'#a57b51');line(ctx,13,-31,9,-37,'#68523b',1.8);
          line(ctx,11,-34,13,-38,'#68523b',1.5);
        }
        ctx.restore();
      }});
    }
    for(let reach=0;reach<(s.local?.reaches||0);reach++){
      const [bx,by]=point(...explorationSites[reach]);
      layers.push({y:by,draw:()=>berryShrub(ctx,bx,by,1,Math.ceil((s.local.wildPatches?.[reach]||0)/2))});
      for(let i=0;i<22;i++){
        if(reach>=4)break;
        const [x,y]=point(1015+reach*250+(i*71)%222,80+(i*97+reach*37)%480);
        if(Math.abs(y-streamY(x,fieldWidth,fieldHeight))<riverHalfWidth(x,fieldWidth,true)+12)continue;
        if(i%4===0)layers.push({y,draw:()=>boulder(ctx,x,y,.85)});
      }
    }
    const awakened=s.local?.lastUnknownDay!==undefined;
    const monument=s.local?.standingStones || stoneWork;
    let haulingSite;
    if(monument){
      const [cx,cy]=point(...camps[monument.camp]);
      for(let index=0;index<5;index++){
        const angle=index*2*Math.PI/5;
        const x=cx-79+24*Math.cos(angle),y=cy+32+14*Math.sin(angle);
        if(index<monument.raised){
          layers.push({y,draw:()=>{ctx.save();ctx.translate(x,y);ctx.scale(.52,2.1);boulder(ctx,0,0,1);ctx.restore();}});
        }else if(index===monument.raised&&(stoneWork||monument.work)){
          const fraction=Math.min(1,(monument.work+(stoneWork?Math.min(1,s.elapsedMs/s.config.dayMs*2):0))/4);
          const sx=x-135*(1-fraction),sy=y-38*(1-fraction);
          haulingSite=[sx,sy];
          layers.push({y:sy,draw:()=>{line(ctx,sx-18,sy+1,sx+16,sy+1,'#6d4f36',5);boulder(ctx,sx,sy,1);}});
        }
      }
    }
    const bankX=fieldWidth*.34,bankTop=bankY(bankX,-1,fieldWidth,fieldHeight,false)-4;
    const bankFood=Math.min(s.food,s.bankFood||0);
    if(bankFood)layers.push({y:bankTop,draw:()=>drawFoodCache(ctx,bankX,bankTop,bankFood,8)});
    const drift=sinceCast(s,'flood');
    if(flood&&s.floodCatchLost&&drift<12){
      const dx=bankX+(kaunas?-1:1)*drift*35,dy=streamY(dx,fieldWidth,fieldHeight)-riverHalfWidth(dx,fieldWidth,true)+12+drift*2;
      drawFoodCache(ctx,dx,dy,s.floodCatchLost,8);
    }
    for(let patch=0;patch<5;patch++){
      const [x,y]=reedSpot(patch,fieldWidth,fieldHeight,flood);
      layers.push({y,draw:()=>{
        for(let j=0;j<5;j++)line(ctx,x+j*3,y+7,x+j*4-4,y-4-(j%3)*3,'#8a8554',1.7);
      }});
    }
    for(const [key,site] of Object.entries(materialSites)){
      const [x,y]=point(...site.site);
      if(key==='resin'||key==='stone'||key==='hide'||key==='clay'){
        layers.push({y,draw:()=>{for(let i=0;i<Math.min(5,Math.ceil((s.local?.deposits[key]||0)/5));i++)ellipse(ctx,x+i*4,y+i%2*3,4,3,({stone:'#97947e',resin:'#b99041',hide:'#966c49',clay:'#a57656'})[key]);}});
      }
    }
    const [cacheX,cacheY]=point(...foodCache);
    layers.push({y:cacheY,draw:()=>drawFoodCache(ctx,cacheX,cacheY,s.food-bankFood,foodCapacity(s))});
    const [hx,hy]=point(...huntingGround);
    if(huntDay!==s.day||s.seed!==huntSeed){caught.clear();huntDay=s.day;huntSeed=s.seed;}
    const hunting=s.config.hunting;
    const animals=hunting?Math.min(hunting.herdSize,(s.gameAnimals??hunting.herdSize)+Number((s.day+1)%hunting.returnEvery===0)):0;
    for(let i=0;i<animals;i++){
      if(caught.has(i))continue;
      const x=hx+i*15+Math.sin(clock*.35+i)*8,y=hy+i%2*10+Math.cos(clock*.25+i)*4;
      layers.push({y,draw:()=>paintHare(ctx,x,y,clock*2+i)});
    }
    const [bx,by]=point(...berryPatch);
    for(let i=0;i<3;i++){
      const x=bx+i*13,y=by+i%2*5;
      const fruit=Math.ceil(Math.max(0,(s.local?.deposits.berries??60)-i)/7);
      layers.push({y,draw:()=>berryShrub(ctx,x,y,.69+i*.06,fruit)});
    }
    for(let i=1;i<(s.tribeCount||1);i++){
      const [x,y]=point(...camps[i]);
      layers.push({y,draw:()=>{line(ctx,x-16,y,x,y-24,'#604d37',3);line(ctx,x,y-24,x+16,y,'#604d37',3);
        ctx.fillStyle=tribeColors[i];ctx.beginPath();ctx.moveTo(x,y-22);ctx.lineTo(x+16,y);ctx.lineTo(x+2,y);ctx.closePath();ctx.fill();}});
    }
    for(const camp of Object.keys(s.shrines||{})){
      const [x,y]=point(...camps[camp]);
      layers.push({y:y+24,draw:()=>{boulder(ctx,x-42,y+24,.7);boulder(ctx,x-43,y+15,.45);boulder(ctx,x-41,y+9,.25);}});
    }
    const project=s.config.settlement;
    const workDone=s.settlementWork||0;
    const shelterSteps=Math.min(workDone,project?.shelterWork||0);
    const bridgeSteps=Math.max(0,workDone-shelterSteps);
    const bridge=!!project&&bridgeSteps>=project.bridgeWork;
    if(s.textiles?.includes('loom')){
      const x=cacheX-31,y=cacheY-9;
      layers.push({y,draw:()=>{
        for(const dx of [-8,8])line(ctx,x+dx,y,x+dx,y-22,'#73563a',2.7);
        for(const dy of [-20,-4])line(ctx,x-8,y+dy,x+8,y+dy,'#936d48',2.5);
        for(let i=-6;i<=6;i+=3)line(ctx,x+i,y-19,x+i,y-5,'#ddcca2',1);
        for(let i=0;i<5;i++)line(ctx,x-7,y-6-i*1.5,x+7,y-6-i*1.5,'#b7956b',1.4);
      }});
    }
    if(s.pottery?.jars||s.pottery?.unfired||s.pottery?.kiln){
      layers.push({y:cacheY+8,draw:()=>{
        for(let i=0;i<Math.min(6,s.pottery.jars+s.pottery.unfired);i++){
          const x=cacheX+24+i*8,y=cacheY+4+i%2*4;
          ellipse(ctx,x,y-6,5,7,i<s.pottery.jars?'#ad6948':'#958274');
          ellipse(ctx,x,y-12,3,1.5,'#534035');
        }
        if(s.pottery.kiln){
          ellipse(ctx,cacheX+42,cacheY-22,14,11,'#96664d');
          ellipse(ctx,cacheX+42,cacheY-18,6,5,'#45352c');
        }
      }});
    }
    const fires=s.hutFires||[];
    for(const fire of fires){
      if(s.day*s.config.dayMs+s.elapsedMs<fire.start)continue;
      const x=fire.x*fieldWidth,y=fire.y*fieldHeight;
      layers.push({y:y+2,draw:()=>paint('campfire_lit',x,y-5,23,30+Math.sin(clock*8)*4)});
    }
    const healerHome=healerHomeView(s,camps[0]);
    if(healerHome?.work>0){
      const [x,y]=point(...healerHome.home);
      layers.push({y,draw:()=>drawHealerHome(ctx,x,y,healerHome.stock?.doses||0,!!healerHome.resident,healerHome)});
    }
    if(shelterSteps){
      const [x,y]=point(227,217);
      layers.push({y,draw:()=>{
        ctx.save();ctx.translate(x,y);ctx.scale(shelterDrawingScale,shelterDrawingScale);ctx.translate(-x,-y);
        for(const dx of [-24,24])line(ctx,x+dx,y,x+dx+3,y-27,'#473a28',5);
        if(shelterSteps>=2)line(ctx,x-25,y-26,x+30,y-28,'#b09058',5);
        const tiles=Math.round(10*shelterSteps/project.shelterWork);
        for(let i=0;i<tiles;i++)line(ctx,x-22+i*5,y-27,x-31+i*5,y-8,i%2?'#c0a164':'#947647',6);
        ctx.restore();
      }});
    }
    if(bridgeSteps){
      const x=fieldWidth*fordFraction,top=bankY(x,-1,fieldWidth,fieldHeight,false),bottom=bankY(x,1,fieldWidth,fieldHeight,false);
      const end=top+(bottom-top)*bridgeSteps/project.bridgeWork;
      for(const dx of [-9,9])line(ctx,x+dx,top,x+dx,end,'#423326',4);
      for(let y=top;y<end;y+=6)line(ctx,x-12,y,x+12,y+1,'#ad8a55',4.5);
    }
    const prop=(key,x,y,width,height)=>{
      const [px,py]=point(x,y);layers.push({y:py,draw:()=>paint(key,px,py,width,height)});
    };
    const hutCounts=new Map();
    for(const [slot,camp] of (s.huts||[]).entries()){
      const index=hutCounts.get(camp)||0;hutCounts.set(camp,index+1);
      const [x,y]=point(...hutSite(camp,index));
      layers.push({y,draw:()=>{
        const hut=s.hutDetails?.[slot]||{};
        if(hut.ruined){line(ctx,x-14,y,x+11,y-4,'#42362e',4);return;}
        ctx.save();ctx.translate(x,y);ctx.scale(shelterDrawingScale,shelterDrawingScale);ctx.translate(-x,-y);
        ctx.fillStyle=hut.scorched?'#685444':hut.wall==='drystone wall'?'#797766':hut.wall==='mud wall'?'#a27a53':'#ad946d';
        ctx.fillRect(x-17,y-14,34,14);
        if(hut.wall==='drystone wall')for(let i=-2;i<=2;i++)line(ctx,x+i*6,y-10,x+i*6+4,y-10,'#504f42',1.5);
        if(hut.wall==='wattle & daub wall')for(let i=-2;i<=2;i++)line(ctx,x+i*6,y-13,x+i*6+4,y-2,'#83674a',1.6);
        if(hut.chimney){ctx.fillStyle='#705e4e';ctx.fillRect(x+9,y-35,6,23);}
        ctx.beginPath();ctx.moveTo(x-22,y-12);
        if(hut.shape==='dome hut')ctx.bezierCurveTo(x-22,y-38,x+22,y-38,x+22,y-12);
        else if(hut.shape==='A-frame hut'){ctx.lineTo(x-21,y);ctx.lineTo(x,y-33);ctx.lineTo(x+21,y);}
        else if(hut.shape==='gabled roof hut'){ctx.lineTo(x-12,y-29);ctx.lineTo(x+10,y-30);ctx.lineTo(x+23,y-12);}
        else{ctx.lineTo(x+(hut.shape==='pyramidal hut'?6:0),y-31);ctx.lineTo(x+23,y-12);}
        ctx.closePath();ctx.fillStyle='#a48758';ctx.fill();ctx.strokeStyle='#52432e';ctx.lineWidth=2;ctx.stroke();
        if(hut.shape==='pyramidal hut')line(ctx,x+6,y-30,x-5,y-12,'#69583f',2);
        if(hut.shape==='round hut')ellipse(ctx,x,y-12,22,3,'#a48758');
        ctx.fillStyle='#4b3b2b';ctx.fillRect(x-4,y-11,8,11);
        if(hut.ondol)ellipse(ctx,x+13,y-3,4,2,campFireLit(s,camp)?'#c97641':'#655247');
        ctx.restore();
      }});
    }
    if(s.shed.built)prop('painted_barn',827,463,112,102);
    const forest=worldTrees(s);
    forest.forEach(([x,y,size],id)=>{
      if(x>2000||x< -1000||y< -640||y>1280)return;
      if(x*fieldWidth/1000<(left-.04)*fieldWidth||x*fieldWidth/1000>(left+1/zoom+.04)*fieldWidth||
         y*fieldHeight/640<(top-.04)*fieldHeight||y*fieldHeight/640>(top+1/zoom+.1)*fieldHeight)return;
      const [px,py]=point(x,y);
      const species=woodlandSpecies(forest[id],id);
      layers.push({y:py,draw:()=>{
        const fallen=s.local?.stumps?.[id]!==undefined;
        const age=clock-(fallTimes.get(id)??Infinity);
        const pendingFall=Object.values(woodTargets).includes(id)&&!fallTimes.has(id);
        if((!fallen||pendingFall)&&age<0){groveTree(ctx,px,py,size,foliage(id),species);return;}
        ctx.fillStyle='#71573b';ctx.fillRect(px-4,py-6,8,6);ellipse(ctx,px,py-6,5,2,'#cfac78');
        const daysSinceCut=s.day-(s.local?.regrowthSince?.[id]??s.local?.stumps?.[id]);
        if(fallen&&daysSinceCut>=6&&!treeKeptClear(s,forest[id],campSites))groveTree(ctx,px,py,size*daysSinceCut/30,foliage(id),species);
        if(age>=0&&age<1.2){
          ctx.save();ctx.translate(px,py);ctx.rotate(Math.min(1,age*age)*1.5);
          groveTree(ctx,0,0,size,foliage(id),species);ctx.restore();
        }
      }});
    });
    for(const [x,y,size] of [[197,185,.9],[220,181,.56],[608,261,1.1],[632,265,.55],[89,484,.8],[705,573,.9]]){
      const [px,py]=point(x,y);
      const quarry=x===197||x===220;
      const remaining=quarry&&s.local?Math.min(1,s.local.deposits.stone/(materialSites.stone.capacity*s.config.learning.abundance||1)):1;
      layers.push({y:py,draw:()=>{
        if(quarry&&remaining<1){
          ellipse(ctx,px,py,7+19*(1-remaining),3+6*(1-remaining),'#827b64');
          for(let chip=0;chip<Math.ceil((1-remaining)*9);chip++)
            ellipse(ctx,px+Math.cos(chip*2.4)*17,py+Math.sin(chip*2.4)*6,2,1,'#b2ab90');
        }
        if(remaining>0)boulder(ctx,px,py,size*Math.sqrt(remaining));
      }});
    }
    if(s.fireKnown)hearths.forEach(([x,y],camp)=>{
      const lit=campFireLit(s,camp);
      layers.push({y,draw:()=>paint(lit?'campfire_lit':'campfire_out',x,y,30,lit?28+Math.sin(clock*6+camp):17)});
    });
    if(!s.farming.known&&s.local?.seedTrial){
      const growth=s.local.seedTrial.growth;ellipse(ctx,...point(650,522),12,4,'#63482f');
      if(growth)prop('corn',650,522,6+growth,6+growth*3);
    }
    if(s.farming.known)s.farming.plots.forEach((growth,i)=>{
      const x=650+i*19,y=522+i%2*6;ellipse(ctx,...point(x,y),10,3,'#5b422c');
      if(growth!==null){
        if(s.farming.crops?.[i]==='wheat')drawWheat(ctx,...point(x,y),growth,cropRipeAt(s,i),clock);
        else prop('corn',x,y,12+growth,13+growth*4);
      }
    });
    for(const quern of s.farming.querns||[]){
      const home=campSites[quern.camp],x=home[0]-25,y=home[1]+25;
      layers.push({y:point(x,y)[1],draw:()=>drawSaddleQuern(ctx,...point(x,y),
        s.villagers.some(v=>(v.tribe||0)===quern.camp&&v.activity==='Grind wheat into flour'),clock)});
    }
    for(const id of people.keys())if(!s.villagers.some(v=>v.id===id))people.delete(id);
    const monster=godzillaTrack(s,fieldWidth,fieldHeight);
    const alarm=!!monster;
    const bubbles=[];
    for(const v of s.villagers){
      let p=people.get(v.id);
      if(!p){
        const home=point(...camps[v.tribe||0]);
        const [x,y]=s.day===0||v.age===0?[home[0]+Math.sin(v.id*2.4)*45,home[1]+Math.cos(v.id*2.4)*22]:roamingPoint(v.id,0,s.seed,fieldWidth,fieldHeight);
        const side=Math.sign(y-streamY(x,fieldWidth,fieldHeight))||1;
        const edge=bankY(x,side,fieldWidth,fieldHeight,flood);
        p={x,y:(y-edge)*side<0?edge:y,leg:1,wait:v.id%3*.25,travel:0,goal:null,landing:0};people.set(v.id,p);
      }
      const child=v.age<s.config.life.adult;
      const eastern=daughter?.members.includes(v.id);
      const home=v.campJourney?.site||(eastern?daughter.site:camps[v.tribe||0]);
      const [fireX,fireY]=eastern?[point(...home)[0]+64,point(...home)[1]]:hearths[v.tribe||0];
      const hearth=s.fireKnown?[fireX,fireY+4]:null;
      const localFire=v.campJourney?.to==='east'?daughter?.wood>0:campFireLit(s,v.campJourney?.to??v.tribe);
      const hutSlot=eastern||v.campJourney?-1:sleepingHut(s,v);
      const hutIndex=hutSlot<0?-1:s.huts.slice(0,hutSlot).filter(c=>c===(v.tribe||0)).length;
      const away=fieldCamp?.members.includes(v.id);
      const sleepSite=v.herbalist?.home||(away?fieldCamp.site:hutIndex<0?home:hutSite(v.tribe||0,hutIndex));
      const domesticSite=v.herbalist?.home||(hutIndex<0?home:hutSite(v.tribe||0,hutIndex));
      const evening=hour>=17&&hour<19;
      const retiring=hour>=19||hour<6;
      const ritual=awakened&&v.outlook!=='Skeptical'&&
        ((s.day===s.local.lastUnknownDay&&hour<17)||(hour>=17&&hour<20));
      const defending=alarm&&s.godzillaDefenders?.includes(v.id);
      const rescue=fires.find(f=>f.helpers.includes(v.id)&&s.day*s.config.dayMs+s.elapsedMs>=f.start);
      const mainJob=assignments.get(v.id)||v.activity;
      const mainPursuit=mainJob.startsWith('Track ')?wildlife?.attempts.find(a=>a.id===v.id):null;
      if(p.workDay===s.day&&finishedDailyActivity(mainJob,p,fraction,mainPursuit?.encounter??null))
        p.completedMain={day:s.day,job:mainJob};
      const mainFinished=p.completedMain?.day===s.day&&p.completedMain.job===mainJob;
      const urgent=urgentPlan.get(v.id);
      const choresToday=hour>=13&&hour<17?afternoonWork.filter(work=>work.id===v.id):[];
      const demonstration=!urgent&&mainFinished?choresToday[Math.floor((hour-13)/4*choresToday.length)]:null;
      const quietEvening=v.herbalist?.home&&(s.day+v.id)%5!==0&&assessNeeds(s,v).need!=='belonging';
      const job=rescue?'Fight fire':defending?'Defend':alarm?'Flee':ritual&&!urgent?'Observance':
        evening&&!quietEvening&&mainFinished&&!urgent?'Camp circle':retiring||evening&&quietEvening&&mainFinished&&!urgent?'Sleep':demonstration?.action||mainJob;
      const using=demonstration?.action===job?demonstration:null;
      const clearingSite=job==='Clear hut site'||job==='Clear herb site';
      const targetTree=job==='Gather wood'||clearingSite?woodTargets[v.id]:undefined;
      const pursuit=job.startsWith('Track ')?wildlife?.attempts.find(a=>a.id===v.id):null;
      if(job!==p.job||(!alarm&&s.day!==p.workDay)){p.job=job;p.workDay=s.day;p.goal=null;p.leg=0;p.wait=0;p.carry=false;p.huntReturned=false;p.standingSpot=null;}
      const standAt=anchor=>{
        const key=anchor.map(n=>Math.round(n)).join(',');
        const side=Math.sign(anchor[1]-streamY(anchor[0],fieldWidth,fieldHeight))||1;
        const safe=([x,y])=>(season.frozen||(y-bankY(x,side,fieldWidth,fieldHeight,flood))*side>=0)&&
          (!hearth||Math.hypot(x-hearth[0],y-hearth[1])>=39);
        if(p.standingSpot?.key!==key||!safe(p.standingSpot.point)){
          const occupied=[...people].filter(([id,q])=>id!==v.id&&!q.swept).map(([,q])=>q.standingSpot?.point||q.goal||[q.x,q.y]);
          p.standingSpot={key,point:compactWorkSpot(anchor,occupied,v.id,safe)};
        }
        return [...p.standingSpot.point];
      };
      if(rescue){p.goal=[rescue.x*fieldWidth+10*Math.sin(v.id),rescue.y*fieldHeight+6];p.wait=0;}else if(alarm&&!p.goal&&p.leg===0){
        if(defending){
          const side=Math.sign(p.y-streamY(p.x,fieldWidth,fieldHeight))||1;
          const x=Math.max(24,Math.min(fieldWidth-24,monster.x+80+12*(v.id%4)));
          p.goal=[x,bankY(x,side,fieldWidth,fieldHeight,flood)+side*15];
        }else p.goal=godzillaCover(p,v.id,fieldWidth,fieldHeight,flood);
      }else if(!alarm&&!p.goal){
        const wood=p.x<fieldWidth*.55?[105,160]:[923,143];
        const chores={'Shape jar':foodCache,'Build kiln':foodCache,'Fire jar':foodCache,Sleep:home,Hunt:huntingGround,'Warm up':s.fireLit?[259,240]:home,Forage:berryPatch,Harvest:[680,539],Plant:[680,539],'Harvest wheat':[680,539],'Sow wheat':[680,539],'Grind wheat into flour':[home[0]-25,home[1]+25],'Make saddle quern':[home[0]-25,home[1]+25],'Bake hearth flatbread':[home[0]+32,home[1]+18],'Gather wood':wood,'Build shelter':[226,225],Rest:v.traits.includes('Loner')?[domesticSite[0]-24,domesticSite[1]+12]:domesticSite};
        const haul=haulActivities.has(job);
        p.carry=haul&&p.leg===1&&!p.swept;
        const deliverySite=job==='Gather wood'||clearingSite||job==='Gather reeds'||p.leg>1?home:foodCache;
        const site=haul&&p.leg>=1?deliverySite:chores[job]||domesticSite;
        p.goal=job==='Build bridge'?[fieldWidth*fordFraction,bankY(fieldWidth*fordFraction,-1,fieldWidth,fieldHeight,flood)-6]:point(...site);
        if(job.startsWith('Collect ')){
          const deposit=materialSites[job.slice(8)];if(deposit)p.goal=point(...deposit.site);
        }
        if(job==='Fish'&&p.leg===1&&!s.storesUphill)p.goal=[bankX,bankTop];
        const hut=hutJobs[v.id];
        if(visitSites.has(v.id)&&job===assignments.get(v.id)&&(!clearingSite||p.leg===0))p.goal=point(...visitSites.get(v.id));
        if(job==='Sow wild seeds')p.goal=point(650,522);
        if(outing?.members.includes(v.id)&&(job==='Scout upriver'||job==='Visit remembered grove'))p.goal=point(outing.x,outing.y);
        if(job==='Forage'&&foragingPatches[v.id]!==undefined&&p.leg===0)p.goal=point(...explorationSites[foragingPatches[v.id]]);
        if(hut&&(!clearingSite||p.leg===0))p.goal=point(...hutSite(hut.camp,hut.index));
        if(job==='Hunt'&&p.leg===0)p.goal[0]+=(huntSites.get(v.id)||0)*15;
        const compact=!!hut||haul&&p.leg>=1||['Rest','Build shelter','Shape jar','Fire jar','Build kiln','Weave trap','Recover energy'].includes(job)||
          /^(Make |Experiment |Learn |Teach |Collect )/.test(job);
        if(compact){
          const anchor=[p.goal[0],p.goal[1]+(hut||site===domesticSite?22:6)];
          p.goal=standAt(anchor);
        }else{if(job!=='Warm up'&&!using)p.standingSpot=null;p.goal[0]+=15*Math.sin(v.id*2);p.goal[1]+=6*Math.cos(v.id);}
        if(targetTree!==undefined&&p.leg===0){
          const [tx,ty]=point(...worldTrees(s)[targetTree]);
          p.goal=[tx-10,ty+2];
        }
        if((job==='Fish'||job==='Gather reeds'||job==='Gather clay'||job==='Gather fibre')&&p.leg===0)p.goal=reedSpot(v.id,fieldWidth,fieldHeight,flood);
        if(ritual){
          const [cx,cy]=point(...home),angle=v.id*2.4;p.goal=[cx-42+36*Math.cos(angle),cy+24+25*Math.sin(angle)];
        }
        if(using){
          const site=using.skill==='fish'&&!using.action.startsWith('Maintain ')?reedSpot(v.id,fieldWidth,fieldHeight,flood):
            using.item==='farming'?point(680,539):using.item==='footbridge'?[fieldWidth*fordFraction,bankY(fieldWidth*fordFraction,-1,fieldWidth,fieldHeight,flood)]:
            point(...home);
          p.goal=using.skill==='fish'&&!using.action.startsWith('Maintain ')?
            [site[0]+20*Math.sin(v.id),site[1]+12*Math.cos(v.id)]:standAt([site[0],site[1]+22]);
        }
        if(job==='Warm up'&&!localFire){const [x,y]=point(...domesticSite);p.goal=standAt([x,y+22]);}
        if(job==='Warm up'&&localFire){
          const angle=Math.PI+(v.id%5-2)*.45;
          p.goal=standAt([fireX+45*Math.cos(angle),fireY+4+45*Math.sin(angle)]);
        }
        if(job==='Camp circle'){
          const [cx,cy]=away?point(...fieldCamp.site):localFire?[fireX,fireY]:point(...home);
          const a=v.id*2.4;p.goal=[cx+48*Math.cos(a),cy+42*Math.sin(a)];
        }
        if(job==='Sleep'){
          const group=s.villagers.filter(member=>(member.tribe||0)===(v.tribe||0));
          const angle=2*Math.PI*group.indexOf(v)/group.length;
          const [cx,cy]=point(...sleepSite);
          p.goal=hutIndex<0?[cx+Math.cos(angle)*32,cy+Math.sin(angle)*17]:[cx+Math.cos(angle)*9,cy+3];
          if(v.herbalist?.home)p.goal=[cx+4,cy+2];
          if(v.outdoors){p.goal[0]-=34;p.goal[1]+=35;}
        }
        const [gx,gy]=p.goal,side=Math.sign(gy-streamY(gx,fieldWidth,fieldHeight))||1;
        const edge=bankY(gx,side,fieldWidth,fieldHeight,flood);
        if((gy-edge)*side<0)p.goal[1]=edge;
        if(hearth&&Math.hypot(p.goal[0]-hearth[0],p.goal[1]-hearth[1])<39){
          const angle=Math.atan2(p.goal[1]-hearth[1],p.goal[0]-hearth[0]);
          p.goal=[hearth[0]+39*Math.cos(angle),hearth[1]+39*Math.sin(angle)];
        }
      }
      const guide=/^(Watch |Learn |Help )/.test(job)?people.get(guides.get(v.id)):null;
      if(job.startsWith('Care for ')||job==='Perform a mending rite'){
        const target=people.get(patients.get(v.id));
        if(target&&!target.swept)p.goal=[target.x+12,target.y+4];
      }
      if(guide&&!guide.swept){const gx=guide.x+14*Math.cos(v.id),gy=guide.y+16;if(Math.hypot(gx-p.x,gy-p.y)>22)p.goal=[gx,gy];else p.goal=null;}
      if(defending&&p.leg>0&&Math.abs(p.x-monster.x)>120){p.leg=0;p.wait=0;}
      if(pursuit){
        if(fraction>=pursuit.sight&&fraction<pursuit.encounter){
          p.goal=point(pursuit.x,wildlife.y+4);p.wait=0;
        }else if(fraction>=pursuit.encounter){
          p.goal=away?point(...fieldCamp.site):pursuit.success?point(...foodCache):point(...home);
          p.carry=pursuit.success&&Math.hypot(p.x-p.goal[0],p.y-p.goal[1])>8;
        }
      }
      const unwell=v.illnessDays>0||v.illToday;
      if(haulingSite&&job.endsWith('standing stone'))p.goal=[haulingSite[0]+10+(v.id%3)*6,haulingSite[1]+6];
      const slower=unwell||v.age>=s.config.life.elder;
      const stride=((child?20:25)+(v.id%5)*1.8)*(slower ? .68 : 1)*(s.textiles?.includes('sandals')?1.12:1);
      let walking=false;
      const previousLeg=p.leg;
      if(p.wait>0)p.wait-=seconds;
      else if(seconds>0&&p.goal)walking=walkRiver(p,p.goal,stride*seconds*(alarm||rescue?2.3:1),fieldWidth,fieldHeight,flood,v,child,bridge,hearth,season.frozen,worldWidth,kaunas);
      if(pursuit&&fraction>=pursuit.encounter){
        const destination=away?point(...fieldCamp.site):point(...(pursuit.success?foodCache:home));
        if(Math.hypot(p.x-destination[0],p.y-destination[1])<8)p.huntReturned=true;
      }
      if(job==='Fish'&&previousLeg===0&&p.leg===1)p.wait=10+v.id%4;
      const fishPhase=fishingPhase(p.leg,walking,p.wait);
      const fishMethod=fishingPlan[v.id]?.method||fishingMethod(v)||'trap';
      if(job==='Fish')p.carry=fishPhase==='carry'&&!p.swept&&(fishingPlan[v.id]?.caught||0)>0;
      if(p.leg>=2)p.carry=false;
      const chopping=targetTree!==undefined&&p.leg===1&&p.wait>0;
      if(targetTree!==undefined&&p.leg>=1&&p.wait<=0&&!fallTimes.has(targetTree))fallTimes.set(targetTree,clock);
      if(job==='Hunt'&&p.leg===1)caught.add(huntSites.get(v.id));
      const [homeX,homeY]=point(...sleepSite);
      const sleeping=job==='Sleep'&&p.leg>0&&!p.swept&&Math.hypot(p.x-homeX,p.y-homeY)<(v.outdoors?90:35);
      p.hitHeight=sleeping?14:child?28:43;
      const atWork=p.leg>0&&!walking;
      const activity={Hunt:'hunting hares',Forage:'gathering berries',Harvest:'harvesting crops',Plant:'planting crops','Warm up':'warming up',Rest:'resting','Gather wood':'gathering wood','Build shelter':'building the lean-to','Build bridge':'building the footbridge'};
      p.caption=p.swept?'swept downstream':alarm?(p.leg>0?'taking cover from Godzilla':'fleeing Godzilla'):ritual?(atWork?'keeping a dusk vigil':'walking to the stones'):sleeping?'sleeping':retiring?'heading home to sleep':
        p.carry?(job==='Gather wood'?'carrying wood home':'bringing food to the cache'):
        (['Hunt','Forage','Harvest','Gather wood'].includes(job)&&p.leg>=2)?'back at camp':
        (job.startsWith('Build ')&&!atWork)?(job==='Build bridge'?'heading to the ford':'heading to the shelter site'):
        activity[job]||job;
      if(sleeping&&hutSlot>=0)p.caption='sleeping in the '+(s.hutDetails?.[hutSlot]?.shape||'hut');
      if(hutJobs[v.id]&&job!=='Build hut')p.caption='working on the '+job.slice(6);
      if(job==='Build kiln')p.caption='building a kiln by the food cache';
      if(job==='Build hut'&&atWork)p.caption='building sleeping places';
      if(job==='Gather reeds')p.caption=p.leg===0?'gathering reeds for a fish trap':p.leg===1?'taking reeds to camp':'back at camp';
      if(job==='Weave trap')p.caption='weaving a fish trap';
      if(targetTree!==undefined)p.caption=chopping?(clearingSite?'clearing a tree from the house site':'chopping a tree'):
        p.leg===0?(clearingSite?'taking an axe to the house site':'taking an axe to the grove'):p.leg===1?'hauling logs home':'delivered the timber';
      if(job==='Fish')p.caption=fishPhase==='approach'?'heading to the fishing bank':fishPhase==='work'?
        fishingMethodNames[fishMethod]:fishPhase==='carry'?'carrying the catch to the cache':'delivered the catch';
      if(job.startsWith('Watch '))p.caption='learning by watching '+job.slice(6);
      if(job==='Camp circle')p.caption=walking?'joining the evening circle':child?'listening to the adults':'sharing news at camp';
      if(rescue)p.caption='putting out a hut fire';
      if(outing?.members.includes(v.id)&&(job==='Scout upriver'||job==='Visit remembered grove'))p.caption=outing.reason;
      if(using)p.caption=using.action+' · '+using.item;
      if(pursuit)p.caption=fraction<pursuit.sight?'watching the treeline':fraction<pursuit.encounter?'pursuing a '+wildlife.species:pursuit.success?(p.carry?'bringing game to the cache':'returned from the hunt'):'the '+wildlife.species+' escaped';
      else if(defending)p.caption='defending the camp with a '+v.gear;
      if(job.startsWith('Craft '))p.caption='crafting '+job.slice(6);
      if(sleeping&&v.herbalist?.home)p.caption='sleeping at the woodland herb shelter';
      else if(sleeping&&eastern)p.caption='sleeping at the eastern settlement';
      else if(sleeping&&away)p.caption='sleeping at the seasonal hunting camp';
      else if(sleeping&&v.outdoors)p.caption='sleeping outside · shelters full';
      const nearby=[...people].some(([id,peer])=>id!==v.id&&!peer.swept&&Math.hypot(peer.x-p.x,peer.y-p.y)<95);
      const emoji=villagerSpeech(p,activityEmoji(job,using?.item),clock,v.id,
        s.speed>0&&nearby&&atWork&&!sleeping&&!urgent&&!unwell&&!alarm&&!rescue&&!p.swept&&bubbles.length<2);
      if(emoji)bubbles.push({x:p.x,y:p.y-(child?28:45)-12,emoji});
      layers.push({y:p.y,draw:()=>{
        if(sleeping&&hutSlot>=0&&!v.outdoors)return; // Occupants are inside, not stacked at the doorway.
        const height=child?28:45,width=height*2/3;
        const onBridge=bridge&&Math.abs(p.x-fieldWidth*fordFraction)<12;
        const inTributary=kaunas&&p.y<streamY(p.x,fieldWidth,fieldHeight)&&
          Math.abs(p.x/fieldWidth-nerisX(p.y/fieldHeight))<(flood?.0155:.0115);
        const wading=!season.frozen&&(!onBridge&&Math.abs(p.y-streamY(p.x,fieldWidth,fieldHeight))<riverHalfWidth(p.x,fieldWidth,flood)||inTributary);
        if(wading){
          ctx.beginPath();ctx.ellipse(p.x,p.y,width*.27+2*Math.sin(clock*4),3,0,0,Math.PI*2);
          ctx.lineWidth=1;ctx.strokeStyle='#cfddd1';ctx.stroke();
        }else ellipse(ctx,p.x,p.y-1,width*.28,3.6,'#20261955');
        const bob=walking?Math.abs(Math.sin(p.travel*.22))*1.2:Math.sin(clock*2+v.id)*.4;
        const chillPhase=(clock+v.id*.73)%4;
        const shiver=v.warmth<40&&chillPhase<1
          ? Math.sin(chillPhase*Math.PI)*Math.sin(chillPhase*Math.PI*6)*.85 : 0;
        ctx.save();
        if(unwell)ctx.filter='sepia(.4) hue-rotate(38deg)';
        if(wading){ctx.beginPath();ctx.rect(p.x-45,p.y-100,90,100);ctx.clip();}
        paintWorker(ctx,v,p.x+shiver,p.y-bob+(wading?7:0),child,walking,sleeping,p.travel,targetTree!==undefined&&p.leg===0||chopping?'Chop tree':job,clock,s.toolkit,s.furWraps);
        ctx.restore();
        const rite=magicPlan.get(v.id);
        if(magicEnabled(s)&&rite&&magicActions[rite.spell]===job&&atWork&&!sleeping&&!p.swept)
          drawFolkRite(ctx,p.x,p.y,rite.spell,clock,v.id);
        if(using){
          const x=p.x+8,y=p.y-18+Math.sin(clock*5)*2;
          if(['bow','sling','spear thrower'].includes(using.item)){
            paintWorker(ctx,v,p.x,p.y,child,walking,false,p.travel,'Hunt',clock,s.toolkit,s.furWraps);
          }else if(fishingCrafts.includes(using.item)){
            const method={'fishing spear':'spear','fish trap':'trap','hook and line':'line','fishing pole':'pole','fishing net':'net'}[using.item];
            if(!walking&&!using.action.startsWith('Maintain '))drawRiverFishing(ctx,{x:p.x,y:p.y,method,clock,id:v.id,caught:using.result==='stored one provision'?1:0});
            else if(method==='net')drawFishingMesh(ctx,x-15,y,30,16,0,clock);
            else if(method==='trap')drawWickerFishingTrap(ctx,x,y);
          }
          else if(using.item.includes('basket')||using.item==='burn bowl')drawFoodCache(ctx,x+6,p.y,2,8);
          else if(using.skill==='clay')ellipse(ctx,x,y,6,5,'#b57e54');
          else if(using.skill==='fibre'){for(let i=0;i<4;i++)line(ctx,x-5,y+i*2,x+8,y+i,'#d6b774',1.6);}
          else{line(ctx,x-4,y+5,x+7,y-7,'#9f794a',3);if(using.skill==='stone'||using.item==='hand axe')ellipse(ctx,x+6,y-7,4,3,'#9c998a');}
        }
        if(job==='Fish'&&(fishPhase==='approach'||fishPhase==='carry')&&!p.swept)drawCarriedFishingGear(ctx,p.x,p.y,fishMethod);
        if(job==='Fish'&&fishPhase==='work'&&!p.swept){
          drawRiverFishing(ctx,{x:p.x,y:p.y,method:fishMethod,clock,id:v.id,caught:fishingPlan[v.id]?.caught||0});
        }else if(job==='Make fishing net'){
          drawFishingMesh(ctx,p.x-16,p.y-10,34,18,0,clock);
        }else if(job==='Weave trap'||job==='Make fish trap'){
          drawWickerFishingTrap(ctx,p.x+7,p.y-12);
        }else if(job==='Make fishing pole'||job==='Make fishing spear'){
          line(ctx,p.x-14,p.y-18,p.x+29,p.y-11,'#c7a16b',2);
        }else if(job==='Make hook and line'){
          line(ctx,p.x+6,p.y-20,p.x+10,p.y-9,'#ded0a7',1.4);
        }else if((job==='Grind bones for fertilizer'||job==='Test crushing old bones')&&atWork){
          ellipse(ctx,p.x+9,p.y-3,8,4,'#90917e');ellipse(ctx,p.x+9,p.y-5,5,2,'#e0d4b3');
          line(ctx,p.x+9,p.y-5,p.x+15,p.y-17+Math.sin(clock*5)*3,'#a7a68d',3);
        }else if(job==='Work ground bone into soil'&&atWork){
          for(let i=0;i<5;i++)ellipse(ctx,p.x+5+i*3,p.y-3+(i%2)*2,1,1,'#ded0ad');
        }else if(p.carry&&!p.swept){
          if(job==='Gather wood'||clearingSite)line(ctx,p.x+2,p.y-12,p.x+14,p.y-19,'#ba905b',4);
          else if(job==='Fish'){
            line(ctx,p.x+8,p.y-21,p.x+9,p.y-9,'#c4ad7a',1);
            drawRiverFish(ctx,p.x+11,p.y-15,.7);drawRiverFish(ctx,p.x+11,p.y-9,.6);
          }else if(job==='Gather reeds'){
            for(let j=0;j<3;j++)line(ctx,p.x+3+j*2,p.y-12,p.x+12+j*2,p.y-25,'#b1a468',1.5);
          }
          else{ellipse(ctx,p.x+8,p.y-14,6,4,'#ad8651');ellipse(ctx,p.x+8,p.y-17,3,2,'#b36442');}
        }
        if(atWork&&!p.swept&&job.startsWith('Build ')&&p.wait>0){
          const lift=Math.sin(clock*9+v.id)*4;
          line(ctx,p.x+4,p.y-18,p.x+12,p.y-24+lift,'#b39261',2);
          line(ctx,p.x+9,p.y-27+lift,p.x+15,p.y-23+lift,'#808075',4);
        }
        if(v.id===birthId&&birthTime>0){
          for(let i=0;i<7;i++){const angle=i*2.4+clock*.7;ellipse(ctx,p.x+Math.cos(angle)*24,p.y-height/2+Math.sin(angle)*24,2,2,'#f2c95d');}
        }
      }});
    }
    layers.sort((a,b)=>a.y-b.y).forEach(layer=>layer.draw());
    for(const bubble of bubbles)drawEmojiSpeech(ctx,bubble.x,bubble.y,bubble.emoji);
    disasterScene(ctx,s,fieldWidth,fieldHeight);
    if(monster)for(const id of s.godzillaDefenders||[]){
      const p=people.get(id);
      if(!p||p.swept||Math.abs(p.x-monster.x)>160)continue;
      const flight=(clock*.8+id*.37)%1;
      if(flight>.70)continue;
      const f=flight/.70;
      const x=p.x+(monster.x-p.x)*f,y=p.y-25+(monster.y-40-p.y+25)*f-70*Math.sin(Math.PI*f);
      if(s.villagers.find(v=>v.id===id)?.gear==='sling')ellipse(ctx,x,y,3,2.5,'#c8c3ad');
      else line(ctx,x-8*Math.sign(monster.x-p.x),y-2,x,y,'#b79869',2);
    }
    const weather=currentWeather(s);
    if(weather==='rain'||gustLeft>0){
      const count=(weather==='rain'?160:28)*span;
      for(let i=0;i<count;i++){
        const period=worldWidth+20,x=((i*197-clock*65)%period+period)%period-fieldWidth,y=(i*241+clock*233)%(3*fieldHeight+20)-fieldHeight-10;
        if(season.name==='Winter'){ellipse(ctx,x,y,2+season.strength,2,'#f3f2e8');continue;}
        line(ctx,x,y,x-3,y+9,weather==='rain'?'#342a254d':'#e2dab370',1.25);
      }
    }else if(weather==='cold'||weather==='drought'){
      ctx.fillStyle=weather==='cold'?'#bddbe235':'#dfad4336';ctx.fillRect(-fieldWidth,-fieldHeight,worldWidth,3*fieldHeight);
    }
    ctx.fillStyle='rgba(14,24,62,'+darkness*.62+')';ctx.fillRect(-fieldWidth,-fieldHeight,worldWidth,3*fieldHeight);
    const twilight=Math.max(0,1-Math.abs(sunlight)*3);
    if(twilight>0){
      const glow=ctx.createLinearGradient(-fieldWidth,-fieldHeight,worldWidth,3*fieldHeight);
      glow.addColorStop(hour<12?0:1,'rgba(238,159,93,'+twilight*.21+')');
      glow.addColorStop(hour<12?1:0,'transparent');ctx.fillStyle=glow;ctx.fillRect(-fieldWidth,-fieldHeight,worldWidth,3*fieldHeight);
    }
    if(darkness>0)hearths.forEach(([x,fireY],camp)=>{
      if(!campFireLit(s,camp))return;
      const y=fireY-9;
      const glow=ctx.createRadialGradient(x,y,2,x,y,36);
      glow.addColorStop(0,'rgba(255,177,75,'+darkness*.55+')');glow.addColorStop(1,'transparent');
      ctx.fillStyle=glow;ctx.fillRect(x-36,y-36,72,72);
    });
    if(awakened&&(s.day===s.local.lastUnknownDay||hour>=17&&hour<20)){
      ctx.save();ctx.setTransform(1,0,0,1,0,0);
      const glow=ctx.createRadialGradient(w*.5,0,0,w*.5,0,h*.75);
      glow.addColorStop(0,'rgba(255,239,173,.77)');glow.addColorStop(.55,'rgba(238,194,138,.23)');glow.addColorStop(1,'transparent');
      ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
      for(let i=0;i<18;i++){
        const x=w*(.08+i*.049),y=h*(.11+.035*Math.cos(i*.7+clock*.1));
        const size=Math.max(2,h*.005)*(1+.28*Math.sin(clock+i));
        line(ctx,x-size,y,x+size,y,'#fff4bc',1.5);line(ctx,x,y-size,x,y+size,'#fff4bc',1.5);
      }
      ctx.restore();
    }
    if(signalLeft>0){
      signalLeft=Math.max(0,signalLeft-dt/1000);
      const sky=ctx.createLinearGradient(0,0,0,fieldHeight*.7);
      sky.addColorStop(0,refused?'#5c554f':'#dc914a');sky.addColorStop(1,'transparent');
      ctx.globalAlpha=.48*Math.sin(Math.PI*signalLeft);ctx.fillStyle=sky;ctx.fillRect(-fieldWidth,-fieldHeight,worldWidth,3*fieldHeight);ctx.globalAlpha=1;
    }
    const phoneClock=phoneLayoutEnabled();
    ctx.save();ctx.setTransform(phoneClock?ratio:3*w/fieldWidth,0,0,phoneClock?ratio:3*h/fieldHeight,0,0);
    skyClock(ctx,s.day,hour,s.speed,darkness,twilight,phoneClock,rect.width);
    ctx.restore();
    const picked=people.get(selected);
    const emptyHome=selected==='healer-home'?healerHome:null;
    const pickedHut=typeof selected==='string'&&selected.startsWith('hut:')?Number(selected.slice(4)):null;
    const pickedStore=selected==='cache',pickedCommunal=selected==='communal';
    card.hidden=!picked&&!emptyHome&&pickedHut===null&&!pickedStore&&!pickedCommunal;
    dismissCard.hidden=!phoneLayoutEnabled();
    if(pickedStore){title.textContent='Uphill cache';activity.textContent=(s.food-bankFood)+' / '+foodCapacity(s)+' provisions';bioLine.textContent='';}
    if(pickedCommunal){title.textContent='Communal shelter';activity.textContent=s.settlementWork>=s.config.settlement.shelterWork?'Completed':'Under construction';bioLine.textContent='A shared shelter for the camp, built and maintained by villagers.';}
    if(pickedHut!==null){
      const detail=s.hutDetails?.[pickedHut],residents=s.villagers.filter(v=>sleepingHut(s,v)===pickedHut);
      title.textContent=detail?.shape||'Village hut';activity.textContent=detail?.ruined?'Burned hut · waiting to be rebuilt':'Camp '+(s.huts[pickedHut]+1)+' · '+s.config.settlement.bedsPerHut+' sleeping places';
      bioLine.textContent=(detail?.wall?'Walls: '+detail.wall+'. ':'')+(residents.length?'Household: '+residents.map(v=>v.name).join(', ')+'.':'No household is sleeping here.');
    }
    if(emptyHome){
      title.textContent=emptyHome.markerBuilt?'Woodland healer’s hut':'Herb shelter';
      activity.textContent=emptyHome.habitable?(emptyHome.resident?'Home of '+emptyHome.resident.name:'Unoccupied'):'Under construction ('+emptyHome.work+'/6)';
      bioLine.textContent='';
    }
    if(picked){
      const person=s.villagers.find(v=>v.id===selected);
      const cold=person.warmth<40?' · Shivering from cold (warmth '+person.warmth+'/100)':'';
      const fishingKit=fishingCrafts.filter(item=>item==='fish trap'?person.fishTrap||person.practice?.gear[item]:person.practice?.gear[item]);
      const label=picked.caption+cold+(person.gear?' · '+person.gear:'')+(fishingKit.length?' · '+fishingKit.join(', '):'')+
        (person.motivation?' · '+person.motivation.reason:'');
      const belief=!awakened?'':person.conviction>=4?' · believer':person.conviction>0?' · wondering':' · unconvinced';
      const bio=(person.herbalist?(person.herbalist.home?'Woodland healer · herb shelter · ':'Healer · lives in camp · '):
        person.healerApprentice?(healerTrainingComplete(person)?'Trained healer apprentice · ':'Healer apprentice · '):'')+person.gender+' · '+(s.local?.daughter?.members.includes(person.id)?'Eastern settlement':'Camp '+((person.tribe||0)+1))+' · '+person.traits.join(', ')+belief+
        (person.herbalist?' · Remedies ready: '+(healerMedicineStore(s,person)?.doses||0):'')+
        (magicEnabled(s)&&person.practice?.gear['casting bones']?' · Carries divining bones':'')+
        (person.healerApprentice?' · Learning from '+person.healerApprentice.mentorName+' · plants '+person.healerApprentice.plantDays+'/2 · remedies '+person.healerApprentice.remedyDays+'/3 · patient care '+person.healerApprentice.patientDays+'/2':'')+
        (person.age<s.config.life.adult&&person.carers?.length?' · Cared for by '+person.carers.map(id=>s.villagers.find(v=>v.id===id)?.name).filter(Boolean).join(' and '):'')+
        (person.stoneIdea&&s.local?.standingStones?.raised<5?' · “'+person.stoneIdea+'”':'');
      if(title.textContent!==person.name)title.textContent=person.name;
      if(activity.textContent!==label)activity.textContent=label;
      if(bioLine.textContent!==bio)bioLine.textContent=bio;
    }
    host.dataset.ready='true';host.dataset.simDay=String(s.day);
  }
  function impactScene(){
    const s=getState(),sites=[];
    const add=(slot,coords)=>sites.push({slot,x:coords[0]/1000,y:coords[1]/640});
    if(s.settlementWork>0)add(-1,[227,217]);
    (s.huts||[]).forEach((camp,i)=>{if(!s.hutDetails?.[i]?.ruined)add(i,hutSite(camp,s.huts.slice(0,i).filter(k=>k===camp).length));});
    return {sites,width:fieldWidth,height:fieldHeight,walkers:s.villagers.flatMap(v=>{
      const p=people.get(v.id);return p&&!p.swept&&v.age>=s.config.life.adult&&!v.illnessDays?[{id:v.id,x:p.x,y:p.y,side:Math.sign(p.y-streamY(p.x,fieldWidth,fieldHeight))}]:[];
    }),bankAt:(x,y)=>Math.sign(y-streamY(x,fieldWidth,fieldHeight))};
  }
  return {draw,impactScene,recenter,gust(){gustLeft=1.6;},signal(error){refused=error;signalLeft=1;}};
}
