export function drawRockRecord(g,x,y,record){
  g.save();g.translate(x,y);
  g.fillStyle='#827d67';g.beginPath();g.moveTo(-33,6);g.lineTo(-28,-32);g.lineTo(-9,-44);g.lineTo(25,-38);g.lineTo(35,5);g.closePath();g.fill();
  g.fillStyle='#494b3b';g.beginPath();g.ellipse(2,-3,14,9,0,Math.PI,Math.PI*2);g.fill();
  if(record){
    g.strokeStyle='#b57a4b';g.lineWidth=1.4;
    g.beginPath();
    if(/grain|seed|wheat|bread|milling/.test(record.topic)){
      for(let i=0;i<4;i++){const dx=-17+i*6;g.moveTo(dx,-15);g.lineTo(dx,-31);g.moveTo(dx,-23);g.lineTo(dx-3,-27);g.moveTo(dx,-26);g.lineTo(dx+3,-30);}
    }else{
      g.moveTo(-20,-23);g.lineTo(3,-22);g.lineTo(11,-28);g.lineTo(17,-26);
      g.moveTo(-15,-23);g.lineTo(-18,-14);g.moveTo(0,-22);g.lineTo(4,-14);
      g.moveTo(10,-28);g.lineTo(8,-34);g.lineTo(5,-35);g.moveTo(8,-32);g.lineTo(12,-35);
    }g.stroke();
  }g.restore();
}
