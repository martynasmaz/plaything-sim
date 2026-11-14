// Only draw crops actually sown and querns actually made by villagers.
export function drawWheat(g,x,y,growth,ripeAt,clock=0){
  const stage=Math.min(1,growth/ripeAt),height=5+stage*21;
  g.save();g.lineWidth=1.2;g.strokeStyle=stage<.75?'#798b42':'#b69a4e';
  for(let i=0;i<7;i++){
    const bx=x+(i-3)*3,by=y+(i%2)*2,top=by-height+(i%3)*2,sway=Math.sin(clock*1.4+i)*stage;
    g.beginPath();g.moveTo(bx,by);g.quadraticCurveTo(bx-1,top+8,bx+sway,top);g.stroke();
    g.beginPath();g.moveTo(bx,by-4);g.lineTo(bx-3,by-8);g.stroke();
    if(stage>.45){
      g.fillStyle=stage<.8?'#8e9c4f':'#d3b86c';
      for(let seed=0;seed<4;seed++){
        g.beginPath();g.ellipse(bx+sway+(seed%2?1.4:-1.4),top+seed*1.6,1.7,2.2,seed%2?.5:-.5,0,Math.PI*2);g.fill();
      }
    }
  }g.restore();
}
export function drawSaddleQuern(g,x,y,working=false,clock=0){
  g.save();g.fillStyle='#555549';g.beginPath();g.ellipse(x,y,11,4,0,0,Math.PI*2);g.fill();
  g.fillStyle='#a4a08b';g.beginPath();g.ellipse(x,y-3,10,4,0,0,Math.PI*2);g.fill();
  g.strokeStyle='#6e6b59';g.beginPath();g.ellipse(x,y-3,6,2,0,0,Math.PI*2);g.stroke();
  const shift=working?Math.sin(clock*5)*3:1;
  g.fillStyle='#777567';g.beginPath();g.ellipse(x+shift,y-6,5,2.5,.25,0,Math.PI*2);g.fill();g.restore();
}
