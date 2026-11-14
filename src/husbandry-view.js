import {livestockKinds,livestockPen,villageLivestock,livestockBuildingRules} from './husbandry.js';
import {riverHabitat} from './ecology.js';

function stockOval(g,x,y,rx,ry,color){g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);g.fillStyle=color;g.fill();}
function stockLine(g,x,y,a,b,color,width=2){g.beginPath();g.moveTo(x,y);g.lineTo(a,b);g.strokeStyle=color;g.lineWidth=width;g.stroke();}
export function livestockPosition(s,animal,phase=0,keeper=null){
  const pen=livestockPen(s,animal.camp??s.local.husbandry.pens.find(p=>p.id===animal.penId)?.camp);if(!pen)return null;
  const year=4*s.config.learning.seasonLength,young=animal.age<livestockKinds[animal.species].adult*year;
  const mother=young?villageLivestock(s).find(a=>a.id===animal.motherId):null;
  const id=mother?.id??animal.id,slot=villageLivestock(s).filter(a=>a.penId===pen.id&&!a.motherId).findIndex(a=>a.id===id);
  const index=slot>=0?slot:id%12;
  let x=pen.site[0]-24+(index%4)*16+Math.sin(phase*.45+id*2.3)*2;
  let y=pen.site[1]-7+Math.floor(index/4)*9+Math.cos(phase*.4+id)*1.5;
  if(keeper&&pen.careDay===s.day&&Math.hypot(keeper[0]-pen.site[0],keeper[1]-pen.site[1])<80){
    x=keeper[0]-12-(index%4)*9;y=keeper[1]+Math.floor(index/4)*8;
  }
  if(mother){x+=5+(animal.id%2)*4;y+=5;}
  if(riverHabitat(x,y).water)return [pen.site[0]+index%4*6,pen.site[1]+index%3*5];
  return [x,y];
}
export function drawLivestockAnimal(g,animal,{scale=1,phase=0,young=false,direction=1,grazing=false}={}){
  g.save();g.scale(scale*(young?.58:1)*direction,scale*(young?.58:1));g.lineCap='round';
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
export function drawLivestockPen(g,pen,{front=false}={}){
  const work=pen.work||0;if(!work&&!pen.clearingWork)return;
  g.save();g.lineCap='round';
  const points=[[-37,-23],[-13,-23],[13,-23],[37,-23],[37,0],[37,23],[13,23],[-13,23],[-37,23],[-37,0]];
  const posts=Math.min(points.length,Math.ceil(work/livestockBuildingRules.enclosure.work*points.length));
  for(let i=0;i<posts;i++){
    const [x,y]=points[i],isFront=y>=20;if(isFront!==front)continue;
    stockLine(g,x,y,x,y-9,'#7c603c',2.4);
    if(work>=livestockBuildingRules.enclosure.work*.5&&i>0){const [px,py]=points[i-1];stockLine(g,px,py-5,x,y-5,'#9d8054',1.7);if(work>=livestockBuildingRules.enclosure.work)stockLine(g,px,py-2,x,y-2,'#9d8054',1.5);}
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
