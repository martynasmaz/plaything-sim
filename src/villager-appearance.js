import {CONFIG} from './config.js';
// Shared villager appearance uses the world's life stages, including old saves.
const personTribeColors=['#9c5139','#446c72','#806a96'];
function personLine(g,x,y,a,b,color,width=2){g.beginPath();g.moveTo(x,y);g.lineTo(a,b);g.strokeStyle=color;g.lineWidth=width;g.stroke();}
function personEllipse(g,x,y,rx,ry,color){g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);g.fillStyle=color;g.fill();}
export function villagerDrawingScale(v,child,life=CONFIG.life){
  const adultScale=.94+((Math.imul(v.id,2654435761)>>>0)%15)/100;
  const growth=Math.max(0,Math.min(1,v.age/life.adult));
  return child ? .60+(adultScale-.60)*growth : adultScale;
}
export function villagerHairColor(v,life=CONFIG.life){
  const variant=Math.imul(v.id,2654435761)>>>0;
  return v.age>=life.elder?'#a89d86':['#56402e','#715137','#483a30','#8b653e'][(variant>>>8)%4];
}
export function paintWorker(g,v,x,y,child,walking,sleeping,travel,job,clock,toolkit=[],furWraps=false,life=CONFIG.life){
  g.save();g.translate(x,y);
  const variant=Math.imul(v.id,2654435761)>>>0;
  const scale=villagerDrawingScale(v,child,life);
  g.scale(scale,scale);
  const shoulders=child?4:(v.gender==='male'?5:4)+(variant%5-2)*.55;
  const hair=villagerHairColor(v,life);
  const wearingWool=!!v.practice?.gear['wool wrap'],hide=wearingWool?'#bbae8a':furWraps?'#99764f':personTribeColors[v.tribe||0];
  if(sleeping){
    personEllipse(g,0,-4,12,5,hide);personEllipse(g,10,-6,4.6,4,'#c09b51');
    personLine(g,9,-6,12,-6,'#473723',1);
    g.restore();return;
  }
  const frightened=job==='Flee';
  if(!walking&&!sleeping&&(job.startsWith('Milk ')||job==='Tend and milk livestock'))g.scale(1,.72);
  if(frightened&&!walking)g.scale(1,.68);
  const step=walking?Math.sin(travel*.24)*(frightened?6:4):0,stroke='#382d24';
  personLine(g,-3,-10,-4-step,0,stroke,3);personLine(g,3,-10,4+step,0,stroke,3);
  g.fillStyle=hide;g.strokeStyle=stroke;g.lineWidth=1.7;
  g.beginPath();g.moveTo(-shoulders,-26);g.lineTo(shoulders,-25);g.lineTo(8,-9);g.lineTo(1,-11);g.lineTo(-6,-9);g.closePath();g.fill();g.stroke();
  if(wearingWool){for(let y=-23;y<-10;y+=3)personLine(g,-4,y,5,y+1,'#d0c4a0',.7);}
  else if(furWraps){
    g.fillStyle='#cc9e56';g.beginPath();g.moveTo(-4,-25);g.lineTo(4,-25);g.lineTo(5,-17);g.closePath();g.fill();
    for(let i=-2;i<=2;i++)personLine(g,i*2,-14,i*2-1,-10+i%2,'#705337',1);
  }else personLine(g,-3,-23,5,-13,'#dab77c',2);
  personEllipse(g,0,-30,5.8,6.1,'#d1a651');g.stroke();personEllipse(g,2,-30,1,1,stroke);
  personEllipse(g,-.8,-34.2,5.3,2.6,hair);
  if((variant>>>12)%3===0)personEllipse(g,-5.4,-32,2.8,3.1,hair);
  else personLine(g,-4.8,-34,-5.2,-29-(variant%3),hair,2.3);
  if(!child&&v.gender==='male'&&(variant>>>5)%3!==0){
    g.fillStyle=hair;g.beginPath();g.moveTo(-4,-28);g.lineTo(4,-27);g.lineTo(.4,-22.8);g.closePath();g.fill();
  }
  personLine(g,-1,-36,1,-40,stroke,1.6);personEllipse(g,3,-40,3,1.6,'#687547');
  const reach=!walking&&(job==='Forage'||job==='Plant')?Math.sin(clock*4)*3:0;
  if(frightened){
    personLine(g,-4,-23,-9,-30,stroke,2);personLine(g,4,-23,8,-32,stroke,2);
  }else{
    personLine(g,-4,-23,-8,-16+reach,stroke,2);personLine(g,4,-23,9,-19+reach,stroke,2);
  }
  if((job==='Defend'||job==='Hunt')&&v.gear==='sling'){
    const swing=clock*8+v.id;
    personLine(g,6,-24,8+8*Math.cos(swing),-27+8*Math.sin(swing),'#c6aa78',1.8);
    personEllipse(g,8+8*Math.cos(swing),-27+8*Math.sin(swing),2,2,'#706656');
  }else if(job.startsWith('Craft ')){
    const lift=Math.sin(clock*6)*3;
    personLine(g,-8,-17,8,-15,'#bb965e',2);personEllipse(g,6,-19+lift,3,2,'#a39d88');
  }else if(job==='Chop tree'){
    const swing=walking?0:Math.sin(clock*6);
    const x=14+4*swing,y=-24+9*swing;
    personLine(g,7,-18,x,y,'#9e7848',2.5);personEllipse(g,x,y,4,3,'#a5a18c');
  }else if((v.gear==='digging stick'||toolkit.includes('digging stick'))&&job==='Forage'){
    personLine(g,7,-22,10,-3,'#b79867',2.5);
  }else if((job==='Hunt'||job==='Defend')&&v.gear==='bow'){
    g.beginPath();g.moveTo(9,-30);g.quadraticCurveTo(23,-18,10,-7);g.strokeStyle='#b99261';g.lineWidth=2;g.stroke();
    personLine(g,9,-30,10,-7,'#d0bc92',1);
  }else if((job==='Hunt'||job==='Defend')&&v.gear==='spear thrower'){
    personLine(g,5,-16,15,-21,'#aa8259',3);
    personLine(g,6,-8,14,-34,'#503926',2);
    g.fillStyle='#c2bca7';g.beginPath();g.moveTo(12,-32);g.lineTo(16,-41);g.lineTo(16,-32);g.closePath();g.fill();g.stroke();
  }
  g.restore();
}
