// Canvas-native equipment: bark floats, stone sinkers and plant-fibre mesh.
// Coordinates place the fisher on the bank, with the gear below in the water.
function fishingStroke(g,x,y,ex,ey,color='#cbb98b',width=1.3){
  g.beginPath();g.moveTo(x,y);g.lineTo(ex,ey);g.strokeStyle=color;g.lineWidth=width;g.stroke();
}
function fishingOval(g,x,y,rx,ry,color){
  g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);g.fillStyle=color;g.fill();
}
export function drawRiverFish(g,x,y,scale=1){
  g.save();g.translate(x,y);g.scale(scale,scale);
  fishingOval(g,0,0,7,2.6,'#b6c8b3');
  g.beginPath();g.moveTo(-6,0);g.lineTo(-11,-4);g.lineTo(-11,4);g.closePath();g.fillStyle='#809b91';g.fill();
  fishingStroke(g,-2,-1,4,-1,'#e7dec0',.9);fishingOval(g,4,-.4,.8,.8,'#303d36');g.restore();
}
export function drawFishingMesh(g,x,y,width=62,height=30,lift=0,clock=0){
  const sway=Math.sin(clock*2)*1.4;
  g.save();g.translate(x,y);
  g.beginPath();g.moveTo(0,0);g.quadraticCurveTo(width/2,4+sway,width,0);
  g.lineTo(width-5,height-lift);g.quadraticCurveTo(width/2,height+7-lift,5,height-lift);g.closePath();
  g.fillStyle='#d3c69b25';g.fill();
  for(let i=0;i<=8;i++){
    const u=i/8,top=width*u,bottom=5+(width-10)*u;
    fishingStroke(g,top,0,bottom,height-lift,'#d1c39a99',.8);
    if(i<8)fishingStroke(g,top,0,Math.min(width-5,bottom+10),height-lift,'#d1c39a99',.8);
  }
  for(let j=0;j<=4;j++){
    const t=j/4;fishingStroke(g,5*t,(height-lift)*t,width-5*t,(height-lift)*t,'#e0d0a89c',.8);
  }
  for(let i=0;i<=6;i++)fishingOval(g,width*i/6,Math.sin(i)*1.2,3.5,1.7,'#b78752');
  for(let i=0;i<=4;i++)fishingOval(g,5+(width-10)*i/4,height-lift,2.8,2,'#747b70');
  g.restore();
}
export function drawWickerFishingTrap(g,x,y,lift=0){
  g.save();g.translate(x,y-lift);g.rotate(.18);
  g.beginPath();g.ellipse(16,0,20,8,0,0,Math.PI*2);g.fillStyle='#997445';g.fill();
  for(let i=0;i<=6;i++){
    const q=-1+i*5;g.beginPath();g.ellipse(q,0,4,7,0,-Math.PI/2,Math.PI/2);g.strokeStyle='#d0b580';g.lineWidth=1;g.stroke();
  }
  for(const y0 of [-5,-2,2,5])fishingStroke(g,-2,y0,33,y0,'#695037',.8);
  fishingOval(g,-2,0,5,7,'#554b34');fishingOval(g,1,0,2.8,4.5,'#b18e59');
  fishingOval(g,3,0,1.4,2.5,'#3f4536');g.restore();
}
export function drawCarriedFishingGear(g,x,y,method){
  if(method==='spear'||method==='pole'){
    fishingStroke(g,x+8,y-13,x+15,y-48,'#b99768',2.3);
    if(method==='spear')fishingStroke(g,x+15,y-48,x+16,y-54,'#e2d6ad',1.4);
    else fishingStroke(g,x+15,y-48,x+10,y-18,'#ddcda5',.8);
  }else{
    for(let i=0;i<3;i++){
      g.beginPath();g.ellipse(x+8+i,y-17,3,4,0,0,Math.PI*2);
      g.strokeStyle='#c7b38a';g.lineWidth=1;g.stroke();
    }
  }
}
export function drawRiverFishing(g,{x,y,method='trap',clock=0,id=0,caught=1}){
  const cycle=(clock*.12+id*.17)%1,haul=cycle>.52?Math.sin((cycle-.52)/.48*Math.PI):0;
  // Hands visibly reach toward the working gear instead of the walking pose.
  const handX=x+10,handY=y-14+haul*5;
  fishingStroke(g,x+4,y-23,handX,handY,'#382d24',2.4);
  if(method==='net'){
    fishingStroke(g,x-15,y+3,x-15,y+18,'#765c39',2.8);
    fishingStroke(g,x+62,y+5,x+62,y+22,'#765c39',2.8);
    fishingStroke(g,x-15,y+9,x-7,y+19,'#d6c69a',1.5);
    fishingStroke(g,handX,handY,x+8,y+19-haul*10,'#dfcda1',1.6);
    drawFishingMesh(g,x-7,y+19-haul*10,65,30,haul*15,clock);
    if(caught&&haul>.3)drawRiverFish(g,x+24,y+35-haul*22,.8);
  }else if(method==='trap'){
    fishingStroke(g,x-12,y-2,x-12,y+12,'#775839',3);
    fishingStroke(g,x-12,y+4,x+20,y+25-haul*19,'#d9c18e',1.3);
    fishingStroke(g,handX,handY,x+8,y+21-haul*19,'#d9c18e',1.6);
    drawWickerFishingTrap(g,x+8,y+24,haul*19);
    if(caught&&haul>.6)drawRiverFish(g,x+8,y+12-haul*12,.65);
  }else if(method==='spear'){
    const strike=Math.pow(Math.max(0,Math.sin(clock*2+id)),9);
    const tipX=x+26,tipY=y+18+strike*14;
    fishingStroke(g,x+4,y-35+strike*12,tipX,tipY,'#bc9867',2.7);
    for(const q of [-1,1])fishingStroke(g,tipX-3,tipY-7,tipX+q*2,tipY+1,'#ddd1a5',1.2);
    if(caught&&strike>.6)drawRiverFish(g,tipX,tipY-2,.7);
  }else{
    const tipX=method==='pole'?x+40:x+10,tipY=method==='pole'?y-32+haul*9:handY;
    if(method==='pole'){
      g.beginPath();g.moveTo(handX,handY);g.quadraticCurveTo(x+29,y-46,tipX,tipY);
      g.strokeStyle='#c5a271';g.lineWidth=2.3;g.stroke();
    }else{
      fishingOval(g,x+4,y-17,3.3,2,'#ae8b5e');
      fishingStroke(g,x-4,y-23,x+4,y-17,'#382d24',2.2);
    }
    const endX=x+40,endY=y+28-haul*32;
    fishingStroke(g,tipX,tipY,endX,endY,'#e7d8b0',.95);
    fishingOval(g,endX,endY-1,2,3,'#b79761');
    g.beginPath();g.moveTo(endX,endY+2);g.lineTo(endX,endY+6);g.quadraticCurveTo(endX+4,endY+9,endX+4,endY+4);
    g.strokeStyle='#e4d8b7';g.lineWidth=1;g.stroke();
    if(haul<.65)fishingOval(g,endX+3,endY+6,1.7,1,'#a26b4d');
    if(caught&&haul>.65)drawRiverFish(g,endX,endY+6,.75);
  }
  for(let i=0;i<2;i++){
    g.beginPath();g.ellipse(x+27+i*18,y+40+i*6,10+Math.sin(clock*2+i)*3,2.5,0,0,Math.PI*2);
    g.strokeStyle='#d9e1c96b';g.lineWidth=.7;g.stroke();
  }
}
