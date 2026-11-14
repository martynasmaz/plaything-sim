import test from 'node:test';
import assert from 'node:assert/strict';
import {createState} from '../src/sim.js';
import {HOMESTEAD_RULES} from '../src/config.js';
import {chooseLivestockSite} from '../src/husbandry.js';
import {livestockLayout,livestockAppearance,drawLivestockAnimal} from '../src/husbandry-view.js';
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
  const animals=s.local.husbandry.animals.filter(a=>positions.has(a.id));
  assert.equal(positions.size,animals.length,'every real, living, visible animal has one position');
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
      assert.ok(Math.abs(p[0]-pen.site[0])*width/1000+rx<37*width/1000);
      assert.ok(Math.abs(p[1]-pen.site[1])*height/640+ry<23*width/1000,'inside the actual drawn fence, including on portrait phones');
    }
  }
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
test('nearby keepers lead their actual animals without changing the simulation',()=>{
  const s=stockViewWorld(),h=s.local.husbandry,site=chooseLivestockSite(s,0),pen={id:'pen-0',camp:0,site,work:4,careDay:s.day};h.pens=[pen];h.contacts={};
  h.animals=h.animals.slice(0,2).map(a=>({...a,location:'village',penId:pen.id,keeperId:1}));
  const before=JSON.stringify(s),options={width:3413,height:1920},resting=livestockLayout(s,options),leading=livestockLayout(s,{...options,keepers:new Map([[1,[site[0]+20,site[1]]]])});
  assert.notDeepEqual(leading,resting);assertHerdSpacing(s,leading,options.width,options.height);assert.equal(JSON.stringify(s),before);
});
