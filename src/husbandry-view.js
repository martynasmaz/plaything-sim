import {livestockKinds,villageLivestock,livestockBuildingRules} from './husbandry.js';
import {buildingPatches} from './ecology.js';
import {worldTrees,campSites} from './practices.js';
import {riverWaterAt,riverBankPoint} from './river.js';

function stockOval(g,x,y,rx,ry,color){g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);g.fillStyle=color;g.fill();}
function stockLine(g,x,y,a,b,color,width=2){g.beginPath();g.moveTo(x,y);g.lineTo(a,b);g.strokeStyle=color;g.lineWidth=width;g.stroke();}
// Building artwork, like people and houses, uses drawing units rather than
// viewport-dependent map distances. Keep the fence, layout and hit area together.
export const livestockDrawingScale=2;
export const fodderDrawingScale=1.3;
export function livestockPenHit(x,y,pen,width,height,tolerance=0){
  if(pen.dismantledDay!==undefined)return false;
  const dx=x-pen.site[0]*width/1000,dy=y-pen.site[1]*height/640,k=livestockDrawingScale;
  return Math.abs(dx)<=37*k+tolerance&&dy>=-32*k-tolerance&&dy<=23*k+tolerance||
    pen.shelterWork>0&&Math.abs(dx)<=30*k+tolerance&&dy>=-56*k-tolerance&&dy<=-15*k+tolerance;
}
export function livestockAppearance(s,animal){
  const growth=Math.max(0,Math.min(1,animal.age/(livestockKinds[animal.species].adult*4*s.config.learning.seasonLength)));
  return {young:growth<1,growthScale:.58+.42*growth};
}
function stockNoise(seed,id,salt){
  let n=Math.imul(seed^Math.imul(id+1,374761393)^Math.imul(salt+1,668265263),1274126177);
  return ((n^(n>>>16))>>>0)/4294967296;
}
// Positions use map coordinates, but spacing uses the same drawing units as a
// villager. Viewport width must never enlarge an animal relative to a person.
// This is a pure visual layout: no animal, terrain or simulation dice are changed.
export function livestockLayout(s,{width=1000,height=640,phase=0,keepers=new Map(),people=[]}={}){
  const h=s.local?.husbandry,result=new Map();if(!h)return result;
  const sx=width/1000,sy=height/640,flood=s.lastUsed.flood===s.day;
  const trees=worldTrees(s).filter((_,id)=>s.local.stumps?.[id]===undefined);
  const buildings=buildingPatches(s,campSites).filter(p=>p.kind!=='pen');
  const groups=h.pens.map(p=>({pen:p,site:p.site,animals:villageLivestock(s).filter(a=>a.penId===p.id)}));
  if(h.contacts.herders)groups.push({site:h.regional.site,animals:h.animals.filter(a=>a.location==='regional'&&a.status==='alive')});
  for(const {pen,site,animals} of groups){
    const gateClear=(x,y,rx,ry)=>{
      if(!pen||pen.grazing?.day!==s.day)return true;
      const px=site[0]*sx,py=site[1]*sy,bottom=py+23*livestockDrawingScale;
      return !(y<bottom+ry&&(Math.abs(x-px)+rx>36*livestockDrawingScale||y-ry<py-22*livestockDrawingScale))&&
        !(Math.abs(y-bottom)<ry+2&&Math.abs(x-px)+rx>13*livestockDrawingScale-1);
    };
    const placed=[],nearTrees=trees.filter(t=>Math.abs(t[0]-site[0])<150&&Math.abs(t[1]-site[1])<100);
    const safe=(x,y,rx,ry)=>!Object.values(riverWaterAt(x,y,width,height,flood,s.local.terrain==='kaunas',-rx-3)).some(Boolean)&&
      !nearTrees.some(t=>Math.abs(x-t[0]*sx)<rx+5*t[2]+3&&Math.abs(y-t[1]*sy)<ry+7)&&
      !buildings.some(p=>Math.hypot((x/sx-p.site[0])/34,(y/sy-p.site[1])/30)<1);
    // Parents first; grown animals with recorded parents still get their own space.
    const ordered=animals.slice().sort((a,b)=>Number(livestockAppearance(s,a).young)-Number(livestockAppearance(s,b).young)||a.id-b.id);
    for(const animal of ordered){
      const {young,growthScale}=livestockAppearance(s,animal),cow=animal.species==='cattle';
      const rx=(cow?21:16)*growthScale,ry=(cow?10:8)*growthScale;
      const keeper=keepers.get(animal.keeperId),leading=pen&&pen.careDay===s.day&&keeper;
      let center=leading?[keeper[0]*sx-24,keeper[1]*sy+7]:[site[0]*sx,site[1]*sy];
      if(leading&&pen.grazing?.day===s.day){
        const hour=6+24*(s.elapsedMs||0)/s.config.dayMs;
        const delay=ordered.indexOf(animal)*.22;
        const progress=Math.max(0,Math.min(1,(hour-7-delay)/1.5,(18-hour-delay)/1.5));
        const gate=[site[0]*sx,site[1]*sy+23*livestockDrawingScale],home=[site[0]*sx,site[1]*sy];
        const target=[pen.grazing.site[0]*sx,pen.grazing.site[1]*sy];
        const t=progress;
        const a=t<.35?home:gate,b=t<.35?gate:target,u=t<.35?t/.35:(t-.35)/.65;
        center=a.map((x,i)=>x+(b[i]-x)*u);
      }
      const mother=young?placed.find(p=>p.id===animal.motherId):null;
      let best=null,bestCost=Infinity;
      for(let attempt=0;attempt<240;attempt++){
        const angle=stockNoise(s.seed,animal.id,attempt*2)*Math.PI*2,r=Math.sqrt(stockNoise(s.seed,animal.id,attempt*2+1));
        const reach=pen?(leading?[44,27]:[Math.max(0,35*livestockDrawingScale-rx),Math.max(0,20*livestockDrawingScale-ry)]):[Math.max(110,65*sx),Math.max(70,38*sy)];
        const close=mother&&attempt<80;
        const enclosed=pen&&!leading&&!close;
        const x=(close?mother.x:center[0])+(enclosed?stockNoise(s.seed,animal.id,attempt*2)*2-1:Math.cos(angle)*r)*(close?42:reach[0]);
        const y=(close?mother.y:center[1])+(enclosed?stockNoise(s.seed,animal.id,attempt*2+1)*2-1:Math.sin(angle)*r)*(close?28:reach[1]);
        if(pen&&!leading&&(Math.abs(x-center[0])+rx>36*livestockDrawingScale||Math.abs(y-center[1])+ry>22*livestockDrawingScale))continue;
        if(leading&&pen.grazing?.day===s.day){
          const px=site[0]*sx,py=site[1]*sy,bottom=py+23*livestockDrawingScale;
          if(y<bottom+ry&&(Math.abs(x-px)+rx>36*livestockDrawingScale||y-ry<py-22*livestockDrawingScale))continue;
          if(Math.abs(y-bottom)<ry+2&&Math.abs(x-px)+rx>13*livestockDrawingScale-1)continue;
        }
        if(!safe(x,y,rx,ry))continue;
        const cost=placed.reduce((sum,p)=>sum+Math.max(0,1-Math.hypot((x-p.x)/(rx+p.rx+5),(y-p.y)/(ry+p.ry+5))),0);
        if(cost<bestCost){best={id:animal.id,x,y,rx,ry};bestCost=cost;}
        if(cost===0)break;
      }
      // A crowded or obstructed saved pen still displays its real occupants.
      // Use the least crowded dry candidate rather than inventing or hiding stock.
      if(!best){const [x,y]=riverBankPoint(...center,width,height,flood,s.local.terrain==='kaunas',rx+4);best={id:animal.id,x,y,rx,ry};}
      placed.push({...best,center,leading});
    }
    // A full pen needs a little settling: random sequential placement alone
    // leaves gaps too small for the last animal even when the enclosure fits it.
    const settle=(p,x,y)=>{
      if(pen&&!p.leading){x=Math.max(p.center[0]-36*livestockDrawingScale+p.rx,Math.min(p.center[0]+36*livestockDrawingScale-p.rx,x));y=Math.max(p.center[1]-22*livestockDrawingScale+p.ry,Math.min(p.center[1]+22*livestockDrawingScale-p.ry,y));}
      if(safe(x,y,p.rx,p.ry)&&(!p.leading||gateClear(x,y,p.rx,p.ry))){p.x=x;p.y=y;}
    };
    for(let pass=0;pass<60;pass++){
      let crowded=false;
      for(let i=0;i<placed.length;i++)for(let j=0;j<i;j++){
        const a=placed[i],b=placed[j],dx=a.x-b.x||.01,dy=a.y-b.y||.01,d=Math.hypot(dx/(a.rx+b.rx+5),dy/(a.ry+b.ry+5));
        if(d>=1)continue;crowded=true;
        const push=Math.min(.25,(1/d-1)*.52);
        settle(a,a.x+dx*push,a.y+dy*push);settle(b,b.x-dx*push,b.y-dy*push);
      }
      if(!crowded)break;
    }
    for(const p of placed){
      let dx=Math.sin(phase*.22+p.id*2.3)*12,dy=Math.sin(phase*.17+p.id)*8;
      for(const person of people){
        const ax=p.x-person[0]*sx,ay=p.y-person[1]*sy,d=Math.hypot(ax,ay),range=p.rx+16;
        if(d>=range)continue;
        dx+=(d?ax/d:Math.cos(p.id))*12*(1-d/range);dy+=(d?ay/d:Math.sin(p.id))*10*(1-d/range);
      }
      // Gentle walking arcs, checked against the same real obstacles and
      // body footprints as resting positions. Crowded stock takes short steps.
      for(const fraction of [1,.5,.25,.1,0]){
        const x=p.x+dx*fraction,y=p.y+dy*fraction;
        if(pen&&!p.leading&&(Math.abs(x-p.center[0])+p.rx>36*livestockDrawingScale||Math.abs(y-p.center[1])+p.ry>22*livestockDrawingScale))continue;
        if(!safe(x,y,p.rx,p.ry)||p.leading&&!gateClear(x,y,p.rx,p.ry)||placed.some(q=>q!==p&&Math.hypot((x-q.x)/(p.rx+q.rx+1),(y-q.y)/(p.ry+q.ry+1))<1))continue;
        p.x=x;p.y=y;break;
      }
      result.set(p.id,[p.x/sx,p.y/sy]);
    }
  }
  return result;
}
export function livestockPosition(s,animal,phase=0,keeper=null){
  return livestockLayout(s,{phase,keepers:keeper?new Map([[animal.keeperId,keeper]]):new Map()}).get(animal.id)??null;
}
export function drawLivestockAnimal(g,animal,{scale=1,phase=0,young=false,growthScale=young?.58:1,direction=1,grazing=false}={}){
  g.save();g.scale(scale*growthScale*direction,scale*growthScale);g.lineCap='round';
  const cow=animal.species==='cattle',pig=animal.species==='pig',body=cow?'#8a6240':pig?'#9f8065':'#d0c4a2';
  const size=cow?1.45:pig?.94:1,step=Math.sin(phase*2+animal.id)*.7;
  g.scale(size,size);stockOval(g,0,0,10,3,'#30302030');
  for(const x of [-6,-3,4,7])stockLine(g,x,-5,x+step*(x%2?1:-1),0,cow?'#554332':'#685b43',2);
  stockOval(g,0,-8,10,pig?5:6,body);
  if(!cow&&!pig){for(let i=0;i<7;i++)stockOval(g,-7+i*2.4,-9-(i%2)*2,3.2,3,'#d7cdaf');}
  if(cow){stockOval(g,-3,-9,4,3,'#d0ba88');stockLine(g,-10,-9,-13,-5,'#604a33',1.3);}
  const headY=grazing?-5:-11;
  stockOval(g,10,headY,pig?4.4:3.6,pig?3:4,pig?'#b08e73':'#6c5840');
  stockOval(g,8,headY-4,2.2,1.2,body);stockOval(g,12,headY-4,2,1.2,body);
  stockOval(g,11.5,headY-1,.7,.7,'#29271d');
  if(pig){stockOval(g,14,headY+1,2.2,1.7,'#c3a084');stockOval(g,14.5,headY+1,.35,.5,'#685242');}
  if(cow&&!young){stockLine(g,9,headY-4,7,headY-7,'#cabc94',1.3);stockLine(g,12,headY-4,14,headY-7,'#cabc94',1.3);}
  if(animal.yoked){stockLine(g,5,-14,10,-14,'#b28e56',3);stockLine(g,6,-14,6,-7,'#795a36',1);}
  g.restore();
}
export function drawLivestockPen(g,pen,{front=false,gateOpen=false}={}){
  if(pen.dismantledDay!==undefined)return;
  const work=pen.work||0;if(!work&&!pen.clearingWork)return;
  g.save();g.lineCap='round';
  const points=[[-37,-23],[-13,-23],[13,-23],[37,-23],[37,0],[37,23],[13,23],[-13,23],[-37,23],[-37,0]];
  const posts=Math.min(points.length,Math.ceil(work/livestockBuildingRules.enclosure.work*points.length));
  for(let i=0;i<posts;i++){
    const [x,y]=points[i];
    if((y>=20)===front)stockLine(g,x,y,x,y-9,'#7c603c',2.4);
    if(work>=livestockBuildingRules.enclosure.work*.5&&(i>0||posts===points.length)){
      const [px,py]=points[(i+points.length-1)%points.length];
      if(gateOpen&&work>=livestockBuildingRules.enclosure.work&&y===23&&py===23&&x===-13&&px===13){
        if(front){stockLine(g,-13,18,-25,35,'#9d8054',1.7);stockLine(g,-13,21,-25,38,'#9d8054',1.5);}continue;
      }
      if((Math.max(y,py)>=20)===front){stockLine(g,px,py-5,x,y-5,'#9d8054',1.7);if(work>=livestockBuildingRules.enclosure.work)stockLine(g,px,py-2,x,y-2,'#9d8054',1.5);}
    }
  }
  if(!front){
    const roof=(pen.shelterWork||0)/livestockBuildingRules.shelter.work*5;
    if(roof){for(const x of [-23,0,23])stockLine(g,x,-15,x,-40,'#735734',2.5);stockLine(g,-26,-40,26,-40,'#9a7b4d',3);}
    if(roof>=3){stockLine(g,-26,-40,0,-55,'#97754b',2.5);stockLine(g,0,-55,26,-40,'#97754b',2.5);}
    if(roof>=5){g.beginPath();g.moveTo(-30,-39);g.lineTo(0,-56);g.lineTo(30,-39);g.lineTo(20,-27);g.lineTo(-24,-27);g.closePath();g.fillStyle='#a58e58';g.fill();for(let x=-20;x<25;x+=6)stockLine(g,x,-36,x-4,-28,'#c2aa70',1);}
    if(pen.dung>=4)for(let i=0;i<Math.min(6,Math.floor(pen.dung/4));i++)stockOval(g,-28+i*11,9+(i%2)*6,2,1,'#66543a');
  }
  g.restore();
}
export function drawFodderBundle(g,x,y,{dry=false,compost=false}={}){
  stockOval(g,x,y,9,4,compost?'#594832':dry?'#b9a164':'#7c8a4d');
  if(!compost){for(let i=0;i<7;i++)stockLine(g,x-7+i*2,y+1,x-6+i*2,y-5,dry?'#d1bd7d':'#a1ad6a',1);stockLine(g,x,y-6,x,y+3,'#b9a47b',1);}
}
