// Draw only physical work recorded in the NPC project. All titles and progress
// belong to clearing.js's corner inspection card, including unfinished frames.
function healerStroke(g,x,y,ex,ey,color,width=1.5){
  g.beginPath();g.moveTo(x,y);g.lineTo(ex,ey);g.strokeStyle=color;g.lineWidth=width;g.stroke();
}
function healerOval(g,x,y,rx,ry,color){
  g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);g.fillStyle=color;g.fill();
}
// Raised floor, enclosed woven walls and a wide thatched roof distinguish
// food storage from a dwelling. Each stage corresponds to paid NPC work.
export function drawGranary(g,x,y,project,food=0,finished=false){
  if(!project?.work)return;
  g.save();g.translate(x,y);g.lineCap='round';
  healerOval(g,0,5,39,9,'#26362240');
  for(const dx of [-26,26]){
    healerStroke(g,dx,1,dx,-18,'#725435',4);
    if(project.work>=2){healerOval(g,dx,-12,7,2,'#9c9c83');healerStroke(g,dx,-16,dx,-39,'#82613e',3);}
  }
  if(project.work>=3){g.fillStyle='#9d7a4d';g.fillRect(-30,-19,60,6);healerStroke(g,-30,-19,30,-19,'#d0ad72',2);}
  if(project.work>=4){
    g.fillStyle='#aa8756';g.fillRect(-27,-39,54,20);
    for(let yy=-36;yy<-20;yy+=4)healerStroke(g,-26,yy,26,yy,'#715937',1.2);
    for(let xx=-24;xx<=24;xx+=8)healerStroke(g,xx,-38,xx,-21,'#c5a16a',1.1);
  }
  if(project.work>=5){
    healerStroke(g,-35,-38,0,-61,'#775735',3);healerStroke(g,0,-61,35,-38,'#775735',3);
    if(project.work>=6){
      g.beginPath();g.moveTo(-36,-37);g.lineTo(0,-62);g.lineTo(37,-37);g.lineTo(28,-33);g.lineTo(-29,-33);g.closePath();g.fillStyle='#ad955d';g.fill();
      for(let xx=-28;xx<=28;xx+=5)healerStroke(g,xx*.45,-51-Math.abs(xx)*.1,xx,-35,'#d0b578',1.5);
      healerStroke(g,-36,-37,0,-62,'#5c4930',2);healerStroke(g,0,-62,37,-37,'#5c4930',2);
    }
  }
  if(project.work>=7){g.fillStyle='#493b29';g.fillRect(-9,-35,18,16);}
  if(finished){
    g.fillStyle='#8b6b40';g.fillRect(-8,-34,16,14);
    for(let xx=-6;xx<9;xx+=4)healerStroke(g,xx,-33,xx,-21,'#be9d64',1);
    healerStroke(g,-2,-27,5,-27,'#4e402b',2);
    for(let i=0;i<3;i++){healerStroke(g,-12,-14+i*5,8,-14+i*5,'#c2a16b',2);}
    // A sealed inspection bin shows stock without spilling it around the hut.
    healerOval(g,22,-21,5,2,'#5b482e');
    if(food>0)healerOval(g,22,-22,4,1.5,'#d0b475');
    for(let i=0;i<Math.min(3,project.bins||0);i++)healerStroke(g,-23+i*5,-26,-23+i*5,-22,'#d8bd80',2);
  }
  g.restore();
}
export function drawBridgeImprovements(g,x,top,bottom,project){
  if(!project)return;
  const length=bottom-top;
  g.save();g.lineCap='round';
  const railEnd=top+length*Math.min(1,(project.railWork||0)/4);
  for(const dx of [-13,13]){
    for(let y=top;y<railEnd;y+=14)healerStroke(g,x+dx,y,x+dx,y-13,'#6b5239',2.6);
    if(railEnd>top)healerStroke(g,x+dx,top-12,x+dx,railEnd-12,'#c1a270',2.2);
  }
  const sections=Math.min(6,project.braceWork||0);
  for(let i=0;i<sections;i++){
    const side=i%2?1:-1,y=top+length*(Math.floor(i/2)+.5)/3;
    // Piles and triangular supports sit outside the walking surface.
    healerStroke(g,x+side*19,y+9,x+side*19,y-5,'#594735',4);
    healerStroke(g,x+side*13,y-4,x+side*19,y+7,'#997348',3);
    healerStroke(g,x+side*13,y+7,x+side*19,y+7,'#705035',3);
    healerOval(g,x+side*19,y-5,3,2,'#beb697');
  }
  g.restore();
}
// One local, uniformly scaled shape for every viewport. The rounded base is a
// circular footprint in the same oblique view used for the rest of the village.
export function drawHouseholdHut(g,x,y,hut={},scale=1.75,lit=false){
  g.save();g.translate(x,y);g.scale(scale,scale);
  if(hut.ruined){healerStroke(g,-14,0,11,-4,'#42362e',4);g.restore();return;}
  const round=['round hut','dome hut'].includes(hut.shape);
  const wall=hut.scorched?'#685444':hut.wall==='drystone wall'?'#797766':hut.wall==='mud wall'?'#a27a53':'#ad946d';
  healerOval(g,0,3,24,5,'#25332233');
  g.fillStyle=wall;g.fillRect(-17,-14,34,14);
  if(round)healerOval(g,0,-1,17,4,wall);
  if(hut.wall==='drystone wall')for(let i=-2;i<=2;i++)healerStroke(g,i*6,-10,i*6+4,-10,'#504f42',1.5);
  if(hut.wall==='wattle & daub wall')for(let i=-2;i<=2;i++)healerStroke(g,i*6,-13,i*6+4,-2,'#83674a',1.6);
  if(hut.chimney){g.fillStyle='#705e4e';g.fillRect(9,-35,6,23);}
  g.beginPath();g.moveTo(hut.shape==='A-frame hut'?-21:-22,hut.shape==='A-frame hut'?0:-12);
  if(hut.shape==='dome hut')g.bezierCurveTo(-22,-38,22,-38,22,-12);
  else if(hut.shape==='A-frame hut'){g.lineTo(0,-33);g.lineTo(21,0);}
  else if(hut.shape==='gabled roof hut'){g.lineTo(-12,-29);g.lineTo(10,-30);g.lineTo(23,-12);}
  else{g.lineTo(hut.shape==='pyramidal hut'?6:0,-31);g.lineTo(23,-12);}
  if(round)g.quadraticCurveTo(0,-4,-22,-12);
  g.closePath();g.fillStyle='#a48758';g.fill();g.strokeStyle='#52432e';g.lineWidth=2;g.stroke();
  if(hut.shape==='pyramidal hut')healerStroke(g,6,-30,-5,-12,'#69583f',2);
  g.fillStyle='#4b3b2b';g.fillRect(-4,-11,8,round?14:11);
  if(hut.ondol){healerStroke(g,10,0,15,0,'#655247',3);if(lit)healerStroke(g,11,0,14,0,'#b97943',1);}
  g.restore();
}
export function drawHealerHome(g,x,y,remedies=0,occupied=true,project){
  if(!project||project.work<=0)return;
  g.save();g.translate(x,y);
  healerOval(g,0,2,39,8,'#25332244');
  if(project.work<6){
    healerStroke(g,-24,0,24,0,'#8e7148',3);
    healerStroke(g,-23,0,-21,-31,'#745b3c',4);
    if(project.work>=2){healerStroke(g,23,0,21,-31,'#745b3c',4);healerStroke(g,-22,-31,22,-31,'#ab8a55',4);}
    if(project.work>=3)for(let i=0;i<8;i++)healerStroke(g,-24+i*7,-32,-31+i*7,-12,i%2?'#b39761':'#8e784d',6);
    if(project.work>=4){g.fillStyle='#ac9067';g.fillRect(-22,-24,17,24);}
    if(project.work>=5){g.fillStyle='#ac9067';g.fillRect(7,-24,17,24);}
    g.restore();return;
  }
  const rackBuilt=project.rackWork>=2,markerBuilt=project.markerWork>=2;
  g.fillStyle='#b09468';g.fillRect(-25,-28,50,28);
  for(let i=-22;i<=22;i+=7)healerStroke(g,i,-26,i,-1,'#80684a',1);
  g.beginPath();g.moveTo(-34,-25);g.quadraticCurveTo(-20,-57,0,-61);
  g.quadraticCurveTo(22,-53,34,-25);g.quadraticCurveTo(0,-18,-34,-25);
  g.fillStyle=markerBuilt?'#52683e':'#9c875b';g.fill();g.strokeStyle='#3c4830';g.lineWidth=2;g.stroke();
  for(let i=-25;i<=25;i+=6)healerStroke(g,i*.45,-53-Math.abs(i)*.05,i,-25,markerBuilt?'#89915b':'#c1ab74',1.5);
  g.fillStyle='#443c2c';g.fillRect(-8,-22,15,22);
  healerStroke(g,-9,-23,8,-23,'#d4b786',2.5);
  healerStroke(g,-29,-20,-29,4,'#765c3d',2.8);
  healerStroke(g,29,-20,29,4,'#765c3d',2.8);
  // Herb bunches hang from a small drying rack next to the door.
  if(project.rackWork>=1)healerStroke(g,37,4,37,-25,'#765c3d',2.5);
  if(rackBuilt){
  healerStroke(g,64,4,64,-25,'#765c3d',2.5);healerStroke(g,35,-24,66,-24,'#a18051',2.3);
  for(const dx of [42,51,60]){
    healerStroke(g,dx,-24,dx,-15,'#c2ac78',1);
    for(let k=-1;k<=1;k++)healerStroke(g,dx,-16,dx+k*4,-5+Math.abs(k)*2,'#6b804a',2.4);
    healerStroke(g,dx-3,-13,dx+3,-13,'#d1b781',1);
  }
  }
  // A wooden leaf sign identifies the hut without a modern medical symbol.
  if(project.markerWork>=1)healerStroke(g,-35,4,-35,-25,'#785b3c',2.8);
  if(markerBuilt){
  g.fillStyle='#d3bb85';g.fillRect(-46,-24,22,17);
  g.strokeStyle='#765d3e';g.lineWidth=1.5;g.strokeRect(-46,-24,22,17);
  healerOval(g,-36,-16,6,3.5,'#536b3c');healerStroke(g,-41,-12,-31,-19,'#405230',1.2);
  }
  // A grinding stone and wooden remedy cups match her existing work.
  healerOval(g,15,8,7,4,'#8e927a');healerOval(g,15,7,4,2,'#4b5c39');
  healerStroke(g,15,6,20,0,'#c1bca0',2.3);
  for(let i=0;i<Math.min(2,remedies);i++){
    healerOval(g,1-i*9,8,3.5,3,'#947342');healerOval(g,1-i*9,6,3.5,1.4,'#667c42');
  }
  g.restore();
}
