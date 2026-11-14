// Draw only physical work recorded in the NPC project. All titles and progress
// belong to clearing.js's corner inspection card, including unfinished frames.
function healerStroke(g,x,y,ex,ey,color,width=1.5){
  g.beginPath();g.moveTo(x,y);g.lineTo(ex,ey);g.strokeStyle=color;g.lineWidth=width;g.stroke();
}
function healerOval(g,x,y,rx,ry,color){
  g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);g.fillStyle=color;g.fill();
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
