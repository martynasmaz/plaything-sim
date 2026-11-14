// A display-only pedigree graph. A person is drawn once even when different
// branches lead to the same ancestor. All connectors come from recorded IDs.
export const familyTreeMetrics={cardWidth:136,cardHeight:154,columnGap:30,rowGap:84,padding:34,maxNodes:240};
export function familyTreeLayout(records,focusId,{mode='family',maxNodes=familyTreeMetrics.maxNodes}={}){
  const people=new Map(Object.values(records||{}).map(p=>[Number(p.id),p]));focusId=Number(focusId);
  if(!people.has(focusId))return {nodes:[],unions:[],width:0,height:0,omitted:0,cycle:false,focusId};
  const children=new Map();for(const p of people.values())for(const id of new Set(p.parents||[])){const list=children.get(Number(id))||[];list.push(p.id);children.set(Number(id),list);}
  const selected=new Set(),pending=[focusId];let omitted=0;
  const add=id=>{id=Number(id);if(selected.has(id))return false;if(selected.size>=maxNodes){omitted++;return false;}selected.add(id);if(!people.has(id))people.set(id,{id,name:'Unknown ancestor',parents:[],placeholder:true,origin:'unknown'});return true;};
  // Breadth first preserves nearby family when an exceptionally large history
  // needs a bounded view. Selecting a card opens its own recorded branch.
  if(mode!=='descendants'){
    for(let i=0;i<pending.length;i++){const id=pending[i];if(!add(id))continue;for(const parent of people.get(id).parents||[])pending.push(parent);}
  }else add(focusId);
  if(mode!=='ancestors'){
    const queue=[[focusId,0]],visited=new Set();
    if(mode==='family'){
      // Include siblings, with their actual other parent where applicable.
      for(const parent of people.get(focusId).parents||[])for(const sibling of children.get(Number(parent))||[])add(sibling);
    }
    for(let i=0;i<queue.length;i++){
      const [id,depth]=queue[i];if(visited.has(id))continue;visited.add(id);add(id);
      if(mode==='family'&&depth>=2)continue;
      for(const child of children.get(id)||[]){
        if(!add(child)&&!selected.has(child))continue;
        for(const partner of people.get(child)?.parents||[])add(partner);
        queue.push([child,depth+1]);
      }
    }
    if(mode==='family'){
      const ancestry=[...selected];for(let i=0;i<ancestry.length;i++)for(const parent of people.get(ancestry[i])?.parents||[])if(add(parent))ancestry.push(Number(parent));
    }
  }
  const nodes=[...selected].map(id=>({id,person:people.get(id),parents:[...new Set(people.get(id).parents||[])].map(Number).filter(p=>selected.has(p)&&p!==id),rank:0}));
  const byId=new Map(nodes.map(n=>[n.id,n])),visiting=new Set(),ranked=new Set();let cycle=false;
  function rank(node){
    if(ranked.has(node.id))return node.rank;if(visiting.has(node.id)){cycle=true;return 0;}
    visiting.add(node.id);node.rank=0;
    for(const parent of node.parents){if(visiting.has(parent)){cycle=true;continue;}node.rank=Math.max(node.rank,rank(byId.get(parent))+1);}
    visiting.delete(node.id);ranked.add(node.id);return node.rank;
  }
  for(const n of nodes)rank(n);
  // Corrupt legacy cycles must not create an upward connector or recurse forever.
  for(const n of nodes)n.parents=n.parents.filter(id=>byId.get(id).rank<n.rank);
  // Align co-parents where doing so does not collapse an ancestor into their
  // own descendant. This keeps married-in branches beside their partners.
  const group=new Map(nodes.map(n=>[n.id,n.id]));
  const root=id=>{while(group.get(id)!==id)id=group.get(id);return id;};
  function reaches(from,to){
    const queue=[from],seen=new Set();for(let i=0;i<queue.length;i++){
      const id=queue[i];if(id===to)return true;if(seen.has(id))continue;seen.add(id);
      for(const node of nodes)if(root(node.id)===id)for(const p of node.parents){const next=root(p);if(next!==id)queue.push(next);}
    }return false;
  }
  for(const n of nodes)for(const p of n.parents.slice(1)){
    const a=root(n.parents[0]),b=root(p);if(a!==b&&!reaches(a,b)&&!reaches(b,a))group.set(b,a);
  }
  const groupRank=new Map();
  function alignedRank(id){
    id=root(id);if(groupRank.has(id))return groupRank.get(id);
    let level=0;for(const n of nodes)if(root(n.id)===id)for(const p of n.parents)if(root(p)!==id)level=Math.max(level,alignedRank(p)+1);
    groupRank.set(id,level);return level;
  }
  for(const n of nodes)n.rank=alignedRank(n.id);
  const groupChildren=new Map();for(const n of nodes)for(const p of n.parents){const key=root(p),list=groupChildren.get(key)||new Set();list.add(root(n.id));groupChildren.set(key,list);}
  for(const id of [...groupRank.keys()].sort((a,b)=>groupRank.get(b)-groupRank.get(a))){
    const kids=[...(groupChildren.get(id)||[])];if(kids.length)groupRank.set(id,Math.max(groupRank.get(id),Math.min(...kids.map(k=>groupRank.get(k)))-1));
  }
  for(const n of nodes)n.rank=groupRank.get(root(n.id));
  const rows=new Map();for(const n of nodes){const row=rows.get(n.rank)||[];row.push(n);rows.set(n.rank,row);}
  const ordered=[...rows.keys()].sort((a,b)=>a-b),compare=(a,b)=>(a.person.birthDay??0)-(b.person.birthDay??0)||a.id-b.id;
  for(const row of rows.values())row.sort(compare);
  const positions=()=>{for(const row of rows.values())row.forEach((n,i)=>n.order=i);};positions();
  // Barycentric sweeps bring parents, partners and sibling groups together.
  for(let pass=0;pass<4;pass++)for(const down of [true,false]){
    for(const key of down?ordered:[...ordered].reverse()){
      const row=rows.get(key),score=n=>{
        const links=down?n.parents:(children.get(n.id)||[]).filter(id=>byId.has(id));
        return links.length?links.reduce((sum,id)=>sum+byId.get(id).order,0)/links.length:n.order;
      };
      const blocks=new Map();for(const node of row){const id=root(node.id),block=blocks.get(id)||[];block.push(node);blocks.set(id,block);}
      const average=block=>block.reduce((sum,n)=>sum+score(n),0)/block.length;
      row.splice(0,row.length,...[...blocks.values()].sort((a,b)=>average(a)-average(b)||compare(a[0],b[0])).flatMap(block=>block.sort(compare)));positions();
    }
  }
  const {cardWidth,cardHeight,columnGap,rowGap,padding}=familyTreeMetrics,maxRow=Math.max(...[...rows.values()].map(r=>r.length));
  const width=maxRow*(cardWidth+columnGap)-columnGap+padding*2,height=(ordered.length)*(cardHeight+rowGap)-rowGap+padding*2;
  for(const [level,key] of ordered.entries()){
    const row=rows.get(key),start=(width-(row.length*(cardWidth+columnGap)-columnGap))/2;
    row.forEach((n,i)=>{n.x=start+i*(cardWidth+columnGap);n.y=padding+level*(cardHeight+rowGap);});
  }
  const groups=new Map();for(const n of nodes)if(n.parents.length){
    const parents=[...n.parents].sort((a,b)=>a-b),key=parents.join('/')+'@'+n.rank;
    const union=groups.get(key)||{parents,children:[],rank:n.rank};union.children.push(n.id);groups.set(key,union);
  }
  const rawUnions=[...groups.values()],lanes=new Map();
  for(const u of rawUnions){const list=lanes.get(u.rank)||[];list.push(u);lanes.set(u.rank,list);}
  for(const list of lanes.values())list.sort((a,b)=>Math.min(...a.children.map(id=>byId.get(id).x))-Math.min(...b.children.map(id=>byId.get(id).x)));
  const unions=rawUnions.map((u,index)=>{
    const parents=u.parents.map(id=>byId.get(id)),kids=u.children.map(id=>byId.get(id));
    const list=lanes.get(u.rank),lane=list.indexOf(u),fraction=(lane+1)/(list.length+1),parentY=Math.max(...parents.map(n=>n.y+cardHeight))+10+fraction*12;
    const parentPoints=parents.map(n=>{
      const point={x:n.x+cardWidth/2,y:n.y+cardHeight};
      const blocks=x=>nodes.some(other=>other.y>=point.y&&other.y+cardHeight<parentY&&x>=other.x-8&&x<=other.x+cardWidth+8);
      if(blocks(point.x))point.channelX=[point.x-cardWidth/2-15,point.x+cardWidth/2+15,padding/2,width-padding/2].find(x=>x>5&&x<width-5&&!blocks(x));
      return point;
    });
    return {...u,id:index,parentY,unionX:parents.reduce((n,p)=>n+p.x+cardWidth/2,0)/parents.length,junctionY:Math.min(...kids.map(n=>n.y))-16-fraction*20,
      parentPoints,childPoints:kids.map(n=>({x:n.x+cardWidth/2,y:n.y}))};
  });
  return {nodes,unions,width,height,focusId,omitted,cycle,metrics:familyTreeMetrics};
}
export function familyConnectorPaths(union){
  const y=union.junctionY,parentY=union.parentY,left=Math.min(union.unionX,...union.childPoints.map(p=>p.x)),right=Math.max(union.unionX,...union.childPoints.map(p=>p.x));
  const paths=[`M ${Math.min(...union.parentPoints.map(p=>p.x))} ${parentY} H ${Math.max(...union.parentPoints.map(p=>p.x))}`,
    `M ${union.unionX} ${parentY} V ${y}`,`M ${left} ${y} H ${right}`];
  for(const p of union.parentPoints)paths.push(p.channelX!==undefined?`M ${p.x} ${p.y} V ${p.y+8} H ${p.channelX} V ${parentY} H ${p.x}`:`M ${p.x} ${p.y} V ${parentY}`);
  for(const p of union.childPoints)paths.push(`M ${p.x} ${y} V ${p.y}`);
  return paths;
}
