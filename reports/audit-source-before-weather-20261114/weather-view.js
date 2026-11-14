// Map-anchored visual weather. These functions never consume simulation dice
// or change weather, food production, river depth or villager decisions.
const stormWrap=(value,period)=>((value%period)+period)%period;
function stormNoise(seed,index){let h=Math.imul(seed^Math.imul(index+1,1597334677),2654435761);return ((h^(h>>>16))>>>0)/4294967296;}
export function stormRainCells(seed,clock){
  const cells=[];
  for(let row=0;row<3;row++)for(let col=0;col<4;col++){
    const i=row*4+col,n=stormNoise(seed,i);
    cells.push({x:-1.5+stormWrap(col*.95+1.74+(row===1?0:.43)+clock*.005+(n-.5)*.1,3.8),
      y:-.43+row*.78+(stormNoise(seed+5,i)-.5)*.1,
      rx:.44+n*.1,ry:.30+stormNoise(seed+19,i)*.09});
  }
  return cells;
}
export function stormRainStrength(cells,x,y){
  let rain=0;
  for(const cell of cells){const d=((x-cell.x)/cell.rx)**2+((y-cell.y)/cell.ry)**2;
    if(d<1)rain+=(1-d)*1.4;
  }
  return Math.min(1,rain);
}
export function drawStormRain(g,{width,height,left,top,zoom,clock,seed,cells}){
  g.save();
  g.fillStyle='rgba(45,62,78,.035)';g.fillRect(0,0,width,height);
  // Broad, transparent shadows suggest passing clouds without hiding buildings.
  for(const cell of cells){
    const x=(cell.x-left)*width*zoom,y=(cell.y-top)*height*zoom,rx=cell.rx*width*zoom,ry=cell.ry*height*zoom;
    if(x+rx<0||x-rx>width||y+ry<0||y-ry>height)continue;
    g.save();g.translate(x,y);g.scale(rx,ry);
    const cloud=g.createRadialGradient(0,0,.05,0,0,1);
    cloud.addColorStop(0,'rgba(23,37,52,.27)');cloud.addColorStop(.6,'rgba(35,49,61,.14)');cloud.addColorStop(1,'rgba(35,49,61,0)');
    g.fillStyle=cloud;g.fillRect(-1,-1,2,2);g.restore();
  }
  const count=Math.min(1400,Math.max(260,Math.round(width*height/480)));
  const wind=.45+.15*Math.sin(clock*.7);
  // Three batched layers keep downpours visible at every camera zoom without
  // making phone cost proportional to the full offscreen world.
  for(let layer=0;layer<3;layer++){
    g.beginPath();g.strokeStyle=['#c4d6dd45','#c8dfe96b','#d6e9ee8a'][layer];g.lineWidth=.65+layer*.3;
    for(let i=layer;i<count;i+=3){
      const n=stormNoise(seed+37,i),m=stormNoise(seed+83,i);
      const x=stormWrap(n*(width+60)-clock*(130+layer*75),width+60)-30;
      const y=stormWrap(m*(height+90)+clock*(450+layer*170),height+90)-45;
      const strength=stormRainStrength(cells,left+x/(width*zoom),top+y/(height*zoom));
      if(strength<stormNoise(seed+131,i)||strength<.08)continue;
      const length=(12+layer*7+n*7)*Math.min(1,.45+zoom*.3);
      g.moveTo(x,y);g.lineTo(x-length*wind,y+length);
    }g.stroke();
  }
  g.beginPath();g.strokeStyle='#c6dce45c';g.lineWidth=.8;
  for(let i=0;i<70;i++){
    const x=stormNoise(seed+211,i)*width,y=stormNoise(seed+263,i)*height;
    if(stormRainStrength(cells,left+x/(width*zoom),top+y/(height*zoom))<.3)continue;
    const phase=stormWrap(clock*2.7+i*.618,1);if(phase>.32)continue;
    const r=1+phase*9;g.moveTo(x-r,y);g.lineTo(x,y-r*.7);g.lineTo(x+r,y);
  }g.stroke();g.restore();
}
