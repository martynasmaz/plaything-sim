import test from 'node:test';
import assert from 'node:assert/strict';
import {riverWaterAt,riverBankPoint,streamY,riverHalfWidth,tributaryCourse,tributaryCrossingBanks} from '../src/river.js';
import {walkRiver} from '../src/clearing.js';
import {nerisX} from '../src/practices.js';

const person={id:1,warmth:100,illnessDays:0};
const bridges={built:true,tributary:{built:true}};
test('cross-map journeys finish both bridges in order without entering the tributary downstream',()=>{
  // Includes approaches aligned with the main bridge while still upstream
  // of the small crossing, in both directions and four viewport shapes.
  for(const [w,h] of [[1000,640],[1920,4155],[3413,1920],[4551,1920]])for(let i=0;i<160;i++){
    const start=riverBankPoint((.15+(i*37%70)/100)*w,(.05+(i*23%85)/100)*h,w,h,false,true);
    const goal=riverBankPoint((.15+(i*43%70)/100)*w,(.05+(i*31%85)/100)*h,w,h,false,true);
    const p={x:start[0],y:start[1],goal,leg:0,travel:0};let falls=0;
    for(let frame=0;frame<6000&&p.goal&&!p.swept;frame++)walkRiver(p,p.goal,4,w,h,false,person,false,bridges,null,false,w*3,true,()=>{falls++;return {};});
    assert.equal(falls,0,JSON.stringify({w,h,start,goal}));
    assert.equal(p.goal,null,'a safe route must actually arrive, rather than avoid falls by stopping');
  }
});
test('unsafe main-river fords wait on the bank and resume when a deck is built',()=>{
  for(const [flood,child] of [[true,false],[false,true]]){
    const w=1000,h=640,x=w*.43,y=streamY(x,w,h)-riverHalfWidth(x,w,flood)-6;
    const goal=[x,streamY(x,w,h)+100],p={x,y,goal,leg:0,travel:0};let falls=0;
    const fall=()=>{falls++;return {};};
    for(let i=0;i<100;i++)walkRiver(p,goal,4,w,h,flood,person,child,false,null,false,w*3,true,fall);
    assert.equal(p.waitingCrossing,'main');assert.equal(p.y,y);assert.equal(falls,0);
    for(let i=0;i<300&&p.goal;i++)walkRiver(p,p.goal,4,w,h,false,person,child,bridges,null,false,w*3,true,fall);
    assert.equal(p.goal,null);assert.equal(falls,0);
  }
});
test('resizing during either bridge crossing preserves the deck and reaches the far bank',()=>{
  for(const channel of ['main','tributary'])for(const [from,to] of [[[1920,4155],[4551,1920]],[[4551,1920],[1920,4155]]]){
    const [w,h]=from,[nw,nh]=to;
    const p={x:channel==='main'?w*.43:tributaryCrossingBanks(w,h,true).center[0],
      y:channel==='main'?streamY(w*.43,w,h):h*.24,leg:0,travel:0,
      waterGeometry:{width:w,height:h,flood:false,frozen:false,kaunas:true}};
    if(channel==='main')p.crossing=1;else p.tributaryCrossing=1;
    p.x*=nw/w;p.y*=nh/h;
    const goal=channel==='main'?[nw*.43,streamY(nw*.43,nw,nh)+120]:tributaryCrossingBanks(nw,nh,true).right;
    p.goal=goal;let falls=0;
    for(let i=0;i<1000&&p.goal;i++)walkRiver(p,p.goal,4,nw,nh,false,person,false,bridges,null,false,nw*3,true,()=>{falls++;return {};});
    assert.equal(falls,0,channel);assert.equal(p.goal,null,channel);
  }
});
test('dry land at the tributary bend cannot trigger a fall',()=>{
  // The old straight-channel approximation treated these grass points as water.
  for(const [x,y] of [[403.75,249.75],[403.5,250.5],[403.25,251.25]]){
    assert.deepEqual(riverWaterAt(x,y,1000,640,false,true),{main:false,tributary:false});
    const p={x,y,travel:0,leg:0,seed:4};let falls=0;
    walkRiver(p,[x-30,y-30],.1,1000,640,false,person,false,true,null,false,2000,true,()=>{falls++;return {};});
    assert.equal(falls,0);assert.ok(!p.swept);
  }
});

test('standing at either main bank does not trigger falls, including cold children',()=>{
  for(const flood of [false,true])for(const x of [200,310,430,600,850])for(const side of [-1,1]){
    const y=streamY(x,1000,640)+side*(riverHalfWidth(x,1000,flood)+.5),p={x,y,travel:0,leg:0};let falls=0;
    walkRiver(p,[x,y+side*20],.1,1000,640,flood,{...person,warmth:10},true,false,null,false,2000,false,()=>{falls++;return {};});
    assert.equal(falls,0,[x,y,flood].join('/'));
  }
});

test('bank placement finds actual dry ground beside both channels at different viewport shapes',()=>{
  for(const [width,height] of [[1000,640],[1920,4155],[3413,1920]])for(const flood of [false,true]){
    const sites=tributaryCourse(width,height,flood).samples.filter((_,i)=>i%7===0);
    sites.push(...[.2,.4,.6,.8].map(t=>[width*t,streamY(width*t,width,height)]));
    for(const [x,y] of sites){
      const bank=riverBankPoint(x,y,width,height,flood,true);
      assert.deepEqual(riverWaterAt(...bank,width,height,flood,true),{main:false,tributary:false},JSON.stringify({width,height,flood,x,y,bank}));
    }
  }
});

test('walking along a curved tributary bank does not cut through the water',()=>{
  const width=1000,height=640;
  for(const side of [-1,1]){
    const start=riverBankPoint(width*nerisX(.14)+side*17,height*.14,width,height,false,true);
    const goal=riverBankPoint(width*nerisX(.34)+side*17,height*.34,width,height,false,true);
    const p={x:start[0],y:start[1],goal,leg:0,travel:0};let falls=0;
    for(let i=0;i<800&&p.goal;i++)walkRiver(p,p.goal,1,width,height,false,person,false,true,null,false,2000,true,()=>{falls++;return {};});
    assert.equal(falls,0);assert.equal(p.goal,null,'bank route reaches its destination');
  }
});

test('real deep-water entry still produces a fall, and paused walking cannot produce one',()=>{
  const x=300,y=streamY(x,1000,640),p={x,y,leg:0,travel:0};let falls=0;
  const fall=()=>{falls++;return {fatal:false,count:1};};
  walkRiver(p,[x,50],0,1000,640,false,person,false,true,null,false,2000,true,fall);assert.equal(falls,0);
  walkRiver(p,[x,50],1,1000,640,false,person,false,true,null,false,2000,true,fall);assert.equal(falls,1);assert.ok(p.swept);
});
test('resizing a portrait viewport cannot turn walking on dry bank into a fall',()=>{
  const from=[1920,4155],to=[3413,1920],x=from[0]*.3,y=streamY(x,...from)-riverHalfWidth(x,from[0])-7;
  const p={x,y,leg:0,travel:0};let falls=0;const fall=()=>{falls++;return {};};
  walkRiver(p,[x-10,y],1,...from,false,person,false,true,null,false,from[0]*3,true,fall);
  p.x*=to[0]/from[0];p.y*=to[1]/from[1];
  assert.equal(riverWaterAt(p.x,p.y,...to,false,true).main,true,'the old resize code projects the bank walker inside the painted channel');
  walkRiver(p,[p.x-20,p.y-100],1,...to,false,person,false,true,null,false,to[0]*3,true,fall);
  assert.equal(falls,0);assert.equal(p.swept,undefined);assert.deepEqual(riverWaterAt(p.x,p.y,...to,false,true),{main:false,tributary:false});
});
test('a changing shoreline lets bank walkers retreat rather than inventing a fall',()=>{
  const w=3413,h=1920,x=w*.3,y=streamY(x,w,h)-riverHalfWidth(x,w)-7;
  for(const thaw of [false,true]){
    const p={x,y,leg:0,travel:0};let falls=0;const fall=()=>{falls++;return {};};
    walkRiver(p,[x-10,y],.1,w,h,false,person,false,true,null,thaw,w*3,true,fall);
    walkRiver(p,[p.x-20,p.y-100],1,w,h,!thaw,person,false,true,null,false,w*3,true,fall);
    assert.equal(falls,0);assert.ok(!p.swept);
  }
});
test('tributary survivors land fully ashore on wide screens and cannot immediately fall in again',()=>{
  for(const [w,h] of [[1000,640],[1920,4155],[3413,1920],[4551,1920]])for(const flood of [false,true])for(const side of [-1,1])for(const t of [.27,.29,.31,.33]){
    const p={x:nerisX(t)*w,y:t*h-1,leg:0,travel:0,swept:side,channel:'neris',landing:t*h};let falls=0;
    const fall=()=>{falls++;return {};};
    walkRiver(p,[0,0],2,w,h,flood,person,false,true,null,false,w*3,true,fall);
    assert.ok(!p.swept);assert.deepEqual(riverWaterAt(p.x,p.y,w,h,flood,true),{main:false,tributary:false},JSON.stringify({w,h,t,side,flood}));
    walkRiver(p,[p.x+side*10,p.y],.1,w,h,flood,person,false,true,null,false,w*3,true,fall);
    assert.equal(falls,0,'leaving the water must not create another fall');
  }
});
test('main-river survivors do not land in the tributary at the confluence',()=>{
  for(const [w,h] of [[1000,640],[1920,4155],[3413,1920],[4551,1920]])for(const flood of [false,true])for(const side of [-1,1])for(const t of [.33,.36,.39,.42,.45,.48]){
    const x=w*t,p={x:x+1,y:streamY(x,w,h),leg:0,travel:0,swept:side,channel:'main',landing:x};let falls=0;
    walkRiver(p,[0,0],2,w,h,flood,person,false,true,null,false,w*3,true,()=>{falls++;return {};});
    assert.ok(!p.swept);assert.deepEqual(riverWaterAt(p.x,p.y,w,h,flood,true),{main:false,tributary:false},JSON.stringify({w,h,t,side,flood}));
    walkRiver(p,[p.x,p.y+side*12],.1,w,h,flood,person,false,true,null,false,w*3,true,()=>{falls++;return {};});
    assert.equal(falls,0);
  }
});
