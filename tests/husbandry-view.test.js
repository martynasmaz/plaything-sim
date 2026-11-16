import test from 'node:test';
import assert from 'node:assert/strict';
import {createState} from '../src/sim.js';
import {HOMESTEAD_RULES} from '../src/config.js';
import {chooseLivestockSite} from '../src/husbandry.js';
import {livestockLayout,livestockAppearance,drawLivestockAnimal,drawLivestockPen,livestockDrawingScale,livestockPenHit} from '../src/husbandry-view.js';
import {livestockBuildingRules} from '../src/husbandry.js';
import {worldTrees} from '../src/practices.js';
import {riverWaterAt} from '../src/river.js';

const stockViewports=[[1920,4155],[3413,1920],[4551,1920]];
function stockViewWorld(seed=4){
  const s=createState(HOMESTEAD_RULES,seed),h=s.local.husbandry;h.contacts.herders={day:0};
  // A mature herd plus its offspring, including cattle calves.
  for(const adult of h.animals.slice())h.animals.push({...adult,id:100+adult.id,age:6,motherId:adult.id});
  return s;
}
function stockFootprint(s,a){const k=livestockAppearance(s,a).growthScale;return [(a.species==='cattle'?21:16)*k,(a.species==='cattle'?10:8)*k];}
function assertHerdSpacing(s,positions,width,height){
  const h=s.local.husbandry;
  const animals=h.animals.filter(a=>a.status==='alive'&&(a.location==='regional'?h.contacts.herders:a.location==='village'&&h.pens.some(p=>p.id===a.penId)));
  assert.deepEqual([...positions.keys()].sort((a,b)=>a-b),animals.map(a=>a.id).sort((a,b)=>a-b),'every real, living, visible animal has one position');
  for(let i=0;i<animals.length;i++){
    const a=animals[i],p=positions.get(a.id),[rx,ry]=stockFootprint(s,a),x=p[0]*width/1000,y=p[1]*height/640;
    assert.equal(Object.values(riverWaterAt(x,y,width,height,false,true,-rx)).some(Boolean),false,'whole animal stays ashore');
    for(const [id,t] of worldTrees(s).entries())if(s.local.stumps?.[id]===undefined){
      assert.ok(Math.abs(x-t[0]*width/1000)>=rx+5*t[2]||Math.abs(y-t[1]*height/640)>=ry+5,'body clears tree trunk');
    }
    for(let j=0;j<i;j++){
      const b=animals[j],q=positions.get(b.id),[bx,by]=stockFootprint(s,b);
      assert.ok(Math.hypot((p[0]-q[0])*width/1000/(rx+bx),(p[1]-q[1])*height/640/(ry+by))>=1,'bodies have room to graze');
    }
  }
}
test('dense regional herds avoid animal pile-ups, trees and water across viewport shapes',()=>{
  for(const seed of [4,7,51,59])for(const [width,height] of stockViewports){
    const s=stockViewWorld(seed),before=JSON.stringify(s);
    for(const phase of [0,60])assertHerdSpacing(s,livestockLayout(s,{width,height,phase}),width,height);
    assert.equal(JSON.stringify(s),before,'layout never moves stock or spends simulation randomness');
  }
});
test('grown animals with parents retain separate spaces inside a full village pen',()=>{
  for(const [width,height] of stockViewports){
    const s=stockViewWorld(51),h=s.local.husbandry,pen={id:'pen-0',camp:0,site:chooseLivestockSite(s,0),work:4,shelterWork:5};
    h.pens=[pen];h.contacts={};h.animals=Array.from({length:12},(_,id)=>({...h.animals[0],id:100+id,age:100,motherId:1+id,location:'village',penId:pen.id}));
    s.local.stumps??={};worldTrees(s).forEach((t,id)=>{if(Math.hypot((t[0]-pen.site[0])/39,(t[1]-pen.site[1])/28)<1)s.local.stumps[id]=s.day;});
    const positions=livestockLayout(s,{width,height});assertHerdSpacing(s,positions,width,height);
    for(const a of h.animals){
      const p=positions.get(a.id),[rx,ry]=stockFootprint(s,a);
      assert.ok(Math.abs(p[0]-pen.site[0])*width/1000+rx<37*livestockDrawingScale);
      assert.ok(Math.abs(p[1]-pen.site[1])*height/640+ry<23*livestockDrawingScale,'inside the actual drawn fence, including on portrait phones');
    }
  }
});
test('pen inspection follows the fence and roof instead of an oversized viewport-dependent rectangle',()=>{
  const pen={site:[332,174],shelterWork:5};
  for(const [width,height] of stockViewports){
    const x=pen.site[0]*width/1000,y=pen.site[1]*height/640;
    assert.ok(livestockPenHit(x+60,y+30,pen,width,height));
    assert.ok(livestockPenHit(x,y-100,pen,width,height),'roof can be inspected');
    assert.equal(livestockPenHit(x+110,y,pen,width,height),false,'nearby homes keep their own hover area');
  }
});
test('completed fences close their perimeter and unfinished shelters do not show a finished roof',()=>{
  const segments=[],fills=[],g=new Proxy({moveTo:(...p)=>segments.push([p]),lineTo:(...p)=>segments.at(-1).push(p),fill:()=>fills.push(true)}, {get:(o,k)=>k in o?o[k]:()=>{}});
  const pen={work:livestockBuildingRules.enclosure.work,shelterWork:0};
  drawLivestockPen(g,pen);drawLivestockPen(g,pen,{front:true});
  assert.equal(segments.length,30,'ten posts and two continuous perimeter rails');
  assert.ok(segments.some(([a,b])=>a[0]===-37&&a[1]===-5&&b[0]===-37&&b[1]===-28),'closing section is present');
  drawLivestockPen(g,{...pen,shelterWork:livestockBuildingRules.shelter.work-1});assert.equal(fills.length,0);
  drawLivestockPen(g,{...pen,shelterWork:livestockBuildingRules.shelter.work});assert.equal(fills.length,1);
});
test('young animals grow gradually and adult sprite scale stays independent of viewport width',()=>{
  const s=stockViewWorld(),adult=s.local.husbandry.animals[0],baby=s.local.husbandry.animals.find(a=>a.motherId===adult.id);
  assert.deepEqual(livestockAppearance(s,adult),{young:false,growthScale:1});
  assert.ok(livestockAppearance(s,baby).growthScale<.7);
  const midway={...baby,age:(adult.age+baby.age)/2};assert.ok(livestockAppearance(s,midway).growthScale>livestockAppearance(s,baby).growthScale);
  // Observe the painter's actual transform; the map passes this same appearance.
  for(const a of [adult,baby]){
    const scales=[],g=new Proxy({scale:(...args)=>scales.push(args)},{get:(o,k)=>k in o?o[k]:()=>{}});
    drawLivestockAnimal(g,a,livestockAppearance(s,a));
    assert.deepEqual(scales[0],[livestockAppearance(s,a).growthScale,livestockAppearance(s,a).growthScale]);
  }
});
test('undiscovered and dead regional animals stay absent; save reload reproduces placement',()=>{
  const s=stockViewWorld();s.local.husbandry.animals[0].status='dead';
  const positions=livestockLayout(s,{width:3413,height:1920});assert.equal(positions.has(s.local.husbandry.animals[0].id),false);
  assert.deepEqual(livestockLayout(JSON.parse(JSON.stringify(s)),{width:3413,height:1920}),positions);
  s.local.husbandry.contacts={};assert.equal(livestockLayout(s).size,0);
});

test('grazing animals visibly walk between phases without spending simulation randomness',()=>{
  const s=stockViewWorld(),before=JSON.stringify(s),options={width:3413,height:1920},a=livestockLayout(s,{...options,phase:0}),b=livestockLayout(s,{...options,phase:14});
  assert.ok([...a].some(([id,p])=>Math.hypot((p[0]-b.get(id)[0])*3.413,(p[1]-b.get(id)[1])*3)>5));
  assertHerdSpacing(s,b,options.width,options.height);assert.equal(JSON.stringify(s),before);
});

test('paid grazing opens a visible gate rather than drawing an unbroken front rail',()=>{
  const lines=[],g=new Proxy({moveTo:(...p)=>lines.push([p]),lineTo:(...p)=>lines.at(-1).push(p)},{get:(o,k)=>k in o?o[k]:()=>{}});
  drawLivestockPen(g,{work:4},{front:true,gateOpen:true});
  assert.ok(lines.some(([a,b])=>a[0]===-13&&b[0]===-25));
  assert.ok(!lines.some(([a,b])=>a[0]===13&&b[0]===-13&&a[1]===18&&b[1]===18));
});

test('animals make room for nearby people without changing simulation stock',()=>{
  const s=stockViewWorld();s.local.husbandry.animals=s.local.husbandry.animals.slice(0,1);
  const options={width:3413,height:1920},before=JSON.stringify(s),base=livestockLayout(s,options),[id,point]=[...base][0];
  const shifted=livestockLayout(s,{...options,people:[[point[0]+2,point[1]]]});
  assert.notDeepEqual(shifted.get(id),point);assert.equal(JSON.stringify(s),before);
});
test('nearby keepers lead their actual animals without changing the simulation',()=>{
  const s=stockViewWorld(),h=s.local.husbandry,site=chooseLivestockSite(s,0),pen={id:'pen-0',camp:0,site,work:4,careDay:s.day};h.pens=[pen];h.contacts={};
  h.animals=h.animals.slice(0,2).map(a=>({...a,location:'village',penId:pen.id,keeperId:1}));
  const before=JSON.stringify(s),options={width:3413,height:1920},resting=livestockLayout(s,options),leading=livestockLayout(s,{...options,keepers:new Map([[1,[site[0]+20,site[1]]]])});
  assert.notDeepEqual(leading,resting);assertHerdSpacing(s,leading,options.width,options.height);assert.equal(JSON.stringify(s),before);
});
