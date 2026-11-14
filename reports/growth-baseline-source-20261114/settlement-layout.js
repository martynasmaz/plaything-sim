// Shared physical house positions; drawing proportions and standing places do
// not change shelter capacity, materials, or the simulation's dice.
export const shelterDrawingScale=1.75;
export function householdHutSite(camp,index){
  const [x,y]=camp,angle=2.4*index,radius=62+16*Math.sqrt(index);
  return [Math.max(30,Math.min(965,x-radius*Math.cos(angle))),Math.max(60,Math.min(594,y-32+radius*.55*Math.sin(angle)))];
}
export function compactWorkSpot(anchor,occupied,id=0,accept=()=>true){
  let best=anchor,bestRoom=-1;
  for(let i=0;i<90;i++){
    const r=Math.min(48,8*Math.sqrt(i)),angle=i*2.399963+id*.07;
    const point=[anchor[0]+Math.cos(angle)*r,anchor[1]+Math.sin(angle)*r*.85];
    if(!accept(point))continue;
    const room=occupied.reduce((gap,p)=>Math.min(gap,Math.hypot((point[0]-p[0])/22,(point[1]-p[1])/28)),Infinity);
    if(room>=1)return point;
    if(room>bestRoom){best=point;bestRoom=room;}
  }
  return best;
}
