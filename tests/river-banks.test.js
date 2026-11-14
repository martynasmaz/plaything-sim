import test from 'node:test';
import assert from 'node:assert/strict';
import {riverWaterAt,riverBankPoint,streamY,riverHalfWidth,tributaryCourse} from '../src/river.js';
import {walkRiver} from '../src/clearing.js';
import {nerisX} from '../src/practices.js';

const person={id:1,warmth:100,illnessDays:0};
test('dry land at the tributary bend cannot trigger a fall',()=>{
  // The old straight-channel approximation treated these grass points as water.
  for(const [x,y] of [[403.75,249.75],[403.5,250.5],[403.25,251.25]]){
    assert.deepEqual(riverWaterAt(x,y,1000,640,false,true),{main:false,tributary:false});
    const p={x,y,travel:0,leg:0,seed:4};let falls=0;
    walkRiver(p,[x-30,y-30],.1,1000,640,false,person,false,true,null,false,2000,true,()=>{falls++;return {};});
    assert.equal(falls,0);assert.equal(p.swept,undefined);
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
