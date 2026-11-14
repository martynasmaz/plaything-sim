import {encyclopediaCatalog} from './sim.js';
import {drawHouseholdHut,drawHealerHome} from './settlement-view.js';
import {drawSaddleQuern,drawWheat} from './farming-view.js';
import {drawFishingMesh,drawWickerFishingTrap,drawCarriedFishingGear} from './fishing-view.js';
import {drawRockRecord} from './paintings-view.js';

function drawWorkbenchObject(g,name){
  const stroke=(x,y,a,b,color='#705337',w=3)=>{g.beginPath();g.moveTo(x,y);g.lineTo(a,b);g.strokeStyle=color;g.lineWidth=w;g.stroke();};
  const oval=(x,y,rx,ry,color)=>{g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);g.fillStyle=color;g.fill();};
  const poly=(points,color)=>{g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.fillStyle=color;g.fill();};
  oval(90,82,43,5,'#72694722');g.lineCap='round';
  if(/plot markers|cultivated field/.test(name)){
    for(let i=0;i<4;i++){stroke(59+i*21,72,59+i*21,30,'#a78b59',4);}
    stroke(59,35,122,35,'#cabb94',1.5);stroke(59,64,122,64,'#cabb94',1.5);
    for(let y=49;y<72;y+=6)stroke(66,y,117,y,'#96754e',2);
  }else if(/drying rack/.test(name)){
    stroke(52,80,57,25);stroke(127,80,122,25);stroke(48,24,131,24,'#9d7c50',4);
    for(let i=0;i<4;i++)stroke(65+i*15,24,65+i*15,44,'#c3b18c',1);
  }else if(/bread/.test(name)){
    oval(90,58,35,17,'#88613a');oval(90,53,35,17,'#c99e60');for(let i=0;i<19;i++)oval(65+(i*19)%51,43+(i*11)%22,1.5,1,'#88613a');
  }else if(/flour|bone meal/.test(name)){
    oval(90,62,31,15,'#947248');oval(90,56,31,12,'#e0d3ad');poly([[66,54],[85,37],[111,54]],'#e8dec5');
    if(/bone/.test(name)){stroke(123,35,140,25,'#d2c5a6',6);oval(124,36,4,4,'#ddd2b8');oval(139,25,4,4,'#ddd2b8');}
  }else if(/drying|dried food/.test(name)){
    stroke(52,80,57,25);stroke(127,80,122,25);stroke(48,24,131,24,'#9d7c50',4);
    for(let i=0;i<4;i++){const x=65+i*15;stroke(x,24,x,38,'#c3b18c',1);oval(x,49,5,13,'#a06b4b');stroke(x-2,40,x+1,59,'#c08a5c',1);}
  }else if(/basket/.test(name)){
    poly([[53,41],[127,41],[119,77],[62,77]],'#a57d49');oval(90,41,37,10,'#695033');
    for(let y=49;y<78;y+=5)stroke(59,y,121,y,'#d0af71',1.5);
    for(let x=63;x<124;x+=7)stroke(x,45,x-2,76,'#765936',1.4);
    if(/coil/.test(name))for(let i=0;i<4;i++){g.beginPath();g.ellipse(90,43,29-i*5,7-i,0,0,Math.PI*2);g.strokeStyle='#c8aa76';g.lineWidth=1;g.stroke();}
  }else if(/loom/.test(name)){
    for(const [a,b,c,d] of [[53,80,53,20],[127,80,127,20],[53,23,127,23],[53,73,127,73]])stroke(a,b,c,d,'#91744e',5);
    for(let x=61;x<124;x+=6)stroke(x,24,x,72,'#c9b892',1);
    for(let y=47;y<72;y+=4)stroke(57,y,123,y,y%3?'#9c6b4e':'#b9a477',2);
  }else if(/spindle/.test(name)){
    stroke(94,17,85,83,'#9f7b4e',4);oval(88,67,17,6,'#ad8952');oval(91,43,8,19,'#d0c39d');stroke(95,24,125,17,'#c2b18a',1);
  }else if(/sandals/.test(name)){
    for(const x of [72,110]){oval(x,56,13,27,'#9b754b');stroke(x-9,48,x+9,65,'#d6c097',3);stroke(x+9,48,x-9,65,'#d6c097',3);}
  }else if(/cord/.test(name)){
    for(let j=0;j<3;j++){g.beginPath();g.moveTo(48,62+j*3);g.bezierCurveTo(64,17,126,17,127,53);g.bezierCurveTo(127,87,70,87,69,57);g.strokeStyle=j%2?'#a98d5b':'#d6c496';g.lineWidth=3;g.stroke();}
  }else if(/kiln/.test(name)){
    poly([[49,80],[54,44],[71,24],[111,24],[128,43],[134,80]],'#96724f');oval(91,75,16,17,'#43382b');stroke(61,45,122,45,'#b38e68',2);stroke(56,61,127,61,'#b38e68',2);
  }else if(/jar|vessel|clay/.test(name)){
    g.beginPath();g.moveTo(77,23);g.lineTo(77,38);g.bezierCurveTo(49,47,55,80,76,81);g.lineTo(105,81);g.bezierCurveTo(128,76,126,47,103,38);g.lineTo(103,23);g.closePath();g.fillStyle='#b4845b';g.fill();oval(90,23,13,4,'#5b4635');stroke(64,58,116,58,'#d3a679',2);
  }else if(/shelter|shed|bed/.test(name)){
    stroke(52,80,59,30,'#80633e',5);stroke(128,80,121,30,'#80633e',5);poly([[43,32],[91,12],[139,34],[130,58],[50,57]],'#b09a69');
    for(let x=57;x<130;x+=8)stroke(x,34,x-6,54,'#d1bb84',1.2);if(/bed/.test(name))oval(91,73,28,7,'#997b4e');
  }else if(/bridge/.test(name)){
    stroke(48,76,133,59,'#765738',5);stroke(47,40,132,23,'#765738',5);for(let i=0;i<9;i++)stroke(48+i*10,43-i*2,48+i*10,72-i*2,'#b39361',6);
  }else if(/remedy|herb/.test(name)){
    for(let i=0;i<5;i++){stroke(90,78,74+i*8,24,'#657448',2);oval(77+i*6,43,7,3,'#7c8b51');oval(87+i*4,32,6,3,'#596e42');}
    oval(111,77,17,6,'#898a75');oval(111,75,10,3,'#536040');
  }else if(/charcoal/.test(name)){
    for(let i=0;i<6;i++)poly([[60+i*9,70-i%3*9],[65+i*9,56-i%3*9],[77+i*9,62-i%3*9],[73+i*9,75-i%3*9]],i%2?'#50483b':'#302f29');
  }else if(/sling/.test(name)){
    stroke(61,22,84,64,'#b6a077',2);stroke(119,22,98,64,'#b6a077',2);oval(91,65,12,6,'#836345');oval(90,62,6,4,'#929080');
  }else if(/bow/.test(name)&&!/drill/.test(name)){
    g.beginPath();g.moveTo(74,17);g.quadraticCurveTo(133,49,74,84);g.strokeStyle='#947147';g.lineWidth=4;g.stroke();stroke(74,17,74,84,'#d1c19a',1);stroke(51,51,128,51,'#b1976b',2);poly([[128,51],[117,47],[117,55]],'#a3a28e');
  }else if(/spear/.test(name)){
    stroke(60,80,120,23,'#9c794b',4);poly([[118,25],[129,14],[124,32]],'#aaa997');stroke(68,74,102,68,'#735235',6);
  }else if(/fire stick|bow drill|controlled fire/.test(name)){
    stroke(62,78,118,64,'#8f6940',6);stroke(81,75,86,23,'#b09261',3);oval(87,72,5,3,'#cf8c47');
    if(/bow/.test(name)){g.beginPath();g.moveTo(52,31);g.quadraticCurveTo(84,61,127,29);g.strokeStyle='#92734f';g.lineWidth=3;g.stroke();stroke(52,31,127,29,'#d5c69f',1);}
  }else if(/tongs/.test(name)){
    stroke(65,22,75,78,'#a27f50',5);stroke(69,22,103,72,'#b99b67',5);stroke(65,28,74,30,'#ccb88e',2);
  }else if(/blowpipe/.test(name)){
    stroke(53,25,121,68,'#a48859',6);oval(125,73,11,5,'#615343');oval(121,70,4,2,'#c27f41');
  }else if(/bowl/.test(name)){
    oval(91,61,31,17,'#987346');oval(91,53,31,11,'#564130');oval(91,52,23,6,'#6b5137');
  }else if(/digging/.test(name)){
    stroke(66,80,107,22,'#a78b59',6);stroke(65,80,61,84,'#785a35',3);
  }else if(/axe|hafted|chisel/.test(name)){
    stroke(76,81,99,28,'#a88451',6);poly([[82,29],[100,23],[118,33],[112,45],[92,40]],'#929280');
    if(/chisel/.test(name)){stroke(121,77,136,47,'#a6a394',5);stroke(67,28,92,40,'#765735',9);}
  }else{
    const hammer=/hammer/.test(name);
    poly(hammer?[[65,49],[73,31],[99,26],[116,44],[110,66],[82,70]]:[[65,68],[80,24],[117,44],[96,70]],'#989984');
    stroke(78,48,94,37,'#c0c0a4',2);if(!hammer)stroke(84,61,106,47,'#777c6b',1.5);
  }
}
export function drawCollectionPicture(g,name){
  g.clearRect(0,0,180,100);g.fillStyle='#e3d7b6';g.fillRect(0,0,180,100);
  if(/paint/.test(name))drawRockRecord(g,90,83,{topic:'hunting'});
  else if(/healer|herb drying/.test(name))drawHealerHome(g,78,77,2,true,{work:6,rackWork:name==='healer hut'?0:2,markerWork:name==='healer marker'?2:0});
  else if(/hut|wall|chimney|ondol/.test(name))drawHouseholdHut(g,90,78,{shape:name.includes('hut')?name:'round hut',wall:name.includes('wall')?name:'mud wall',chimney:name==='chimney',ondol:name==='ondol'},1.8,true);
  else if(/quern|milling/i.test(name)){g.save();g.translate(90,70);g.scale(3,3);drawSaddleQuern(g,0,0);g.restore();}
  else if(/wheat|cultivation|farming/.test(name)){g.save();g.translate(90,80);g.scale(2.2,2.2);drawWheat(g,0,0,24,24);g.restore();}
  else if(/fish trap/.test(name)){g.save();g.translate(65,57);g.scale(1.6,1.6);drawWickerFishingTrap(g,0,0);g.restore();}
  else if(/net/.test(name))drawFishingMesh(g,50,25,80,50);
  else if(name==='hook and line'){g.save();g.translate(73,106);g.scale(2,2);drawCarriedFishingGear(g,0,0,'line');g.beginPath();g.moveTo(21,-30);g.lineTo(21,-14);g.quadraticCurveTo(14,-5,14,-16);g.strokeStyle='#b8a880';g.lineWidth=1.5;g.stroke();g.restore();}
  else if(/fishing/.test(name)){g.save();g.translate(65,105);g.scale(1.65,1.65);drawCarriedFishingGear(g,0,0,name==='fishing pole'?'pole':'spear');g.restore();}
  else drawWorkbenchObject(g,name);
}
export function createEncyclopedia(host,readState){
  const details=document.createElement('details'),summary=document.createElement('summary'),note=document.createElement('p'),filter=document.createElement('select'),grid=document.createElement('div');
  summary.textContent='Encyclopedia & collection';note.textContent='Reference drawings. Collected means villagers have actually made or practised it; learning alone does not count. Materials shown are per craft or work step.';
  for(const [value,label] of [['all','Everything'],['missing','Still to collect'],['made','Collected']])filter.append(new Option(label,value));
  filter.setAttribute('aria-label','Collection filter');grid.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(min(165px,100%),1fr));gap:8px;margin:12px 0';
  details.append(summary,note,filter,grid);host.append(details);let key='';
  function draw(){
    if(!details.open)return;
    const s=readState(),next=[s.seed,s.day,s.castCount,s.villagers.length,filter.value].join('/');if(key===next)return;key=next;
    const all=encyclopediaCatalog(s);summary.textContent='Encyclopedia · '+all.filter(e=>e.built).length+' / '+all.length+' collected';
    grid.replaceChildren(...all.filter(e=>filter.value==='all'||(filter.value==='made')===e.built).map(entry=>{
      const card=document.createElement('article'),canvas=document.createElement('canvas'),title=document.createElement('strong'),status=document.createElement('p'),needs=document.createElement('p'),materials=document.createElement('p');
      card.style.cssText='padding:8px;background:#f8efd9;border:1px solid #cebea1;border-radius:5px';
      canvas.width=180;canvas.height=100;canvas.style.cssText='width:100%;height:auto';canvas.setAttribute('role','img');canvas.setAttribute('aria-label',entry.name+' illustration');drawCollectionPicture(canvas.getContext('2d'),entry.product);
      title.textContent=entry.name;status.textContent=entry.built?'✓ Collected':entry.known?'Known · not yet made':'Not yet learned';
      needs.textContent='Needs: '+entry.needs.join('; ')+'.'+(!entry.available?' Earlier infrastructure is missing.':'')+(entry.experienced===false?' No villager currently has the required experience and opportunity.':'');
      const stageCosts={'cultivated field':{wood:1},'drying rack':{wood:3,fibre:1},'healer hut':{wood:6,fibre:2,stone:1},'herb drying rack':{wood:2,fibre:2},'healer marker':{wood:2,fibre:2},
        'communal shelter':{wood:s.config.settlement.shelterWork},footbridge:{wood:s.config.settlement.bridgeWork},'plank shed':{wood:s.config.shed.wood},'camp kiln':{clay:2,wood:2},farming:{food:s.config.farming.plantCost}};
      const cost=entry.cost||stageCosts[entry.name];
      const amounts=cost?Object.entries(cost).filter(([,n])=>n>0).map(([k,n])=>k+' '+n+(((k==='wood'||k==='food')?s[k]:s.local.stock[k]||0)<n?' (short)':'')).join(', '):'';
      materials.textContent=cost?(stageCosts[entry.name]?'Stage materials: ':'Materials: ')+(amounts||'working material and a workday'):'Requires a real workday and the materials for the relevant building stage.';
      const stageWork={'cultivated field':3,'drying rack':2,'healer hut':6,'herb drying rack':2,'healer marker':2,'communal shelter':s.config.settlement.shelterWork,footbridge:s.config.settlement.bridgeWork};
      if(stageWork[entry.name])materials.textContent+=' · '+stageWork[entry.name]+' work units, plus any site clearing.';
      for(const p of [status,needs,materials])p.style.cssText='font-size:12px;margin:6px 0';
      card.append(canvas,title,status,materials,needs);return card;
    }));
  }
  details.ontoggle=draw;filter.onchange=()=>{key='';draw();};return {draw};
}
