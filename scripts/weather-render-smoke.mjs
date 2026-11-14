// Native Canvas QA of controlled built-world fixtures, without player saves.
import {createRequire} from 'node:module';
import {writeFileSync,readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createState,castText} from '../src/sim.js';
import {HOMESTEAD_RULES} from '../src/config.js';
import {createClearing} from '../src/clearing.js';
import {worldTrees} from '../src/practices.js';
import {stormRainCells,stormRainStrength} from '../src/weather-view.js';
const require=createRequire(import.meta.url),{createCanvas,Path2D}=require(process.argv[2]||'@napi-rs/canvas');
globalThis.Path2D=Path2D;globalThis.devicePixelRatio=1;globalThis.Image=class {set src(value){}};
const checks=[];
for(const [index,[phone,width,height,label]] of [[true,390,844,'phone'],[false,1200,768,'desktop'],[false,3440,1440,'ultrawide']].entries()){
  const canvases=[],events=new Map(),element=()=>({style:{},dataset:{},children:[],setAttribute(){},append(...nodes){this.children.push(...nodes);},
    addEventListener(name,fn){events.set(name,fn);},getBoundingClientRect(){return {left:0,top:0,width,height};}});
  globalThis.window={matchMedia:()=>({matches:phone})};
  globalThis.document={createElement(tag){if(tag!=='canvas')return element();const c=createCanvas(width,height);
    Object.assign(c,element(),{clientWidth:width,clientHeight:height,setPointerCapture(){}});canvases.push(c);return c;}};
  let s=createState(HOMESTEAD_RULES,4);s=castText(s,'rain').state;s.villagers=[];
  s.speed=1;s.elapsedMs=s.config.dayMs*.25;s.settlementWork=5;
  s.huts=[0,0,1];s.hutDetails=[{shape:'round hut',wall:'wattle & daub wall'},{shape:'dome hut'},{shape:'gabled roof hut'}];
  s.local.stumps??={};
  worldTrees(s).forEach(([x,y],id)=>{if(Math.hypot(x-165,y-190)<70)s.local.stumps[id]=0;});
  const before=JSON.stringify(s),scene=createClearing(element(),()=>s),context=canvases[0].getContext('2d');
  const originalEllipse=context.ellipse.bind(context);let houseMatrix;
  context.ellipse=(x,y,rx,ry,...args)=>{
    if(x===0&&y===-1&&rx===17&&ry===4){const m=context.getTransform();assert.ok(Math.abs(m.a-m.d)<1e-8,'house scales must be uniform');houseMatrix??={a:m.a,d:m.d,e:m.e,f:m.f};}
    return originalEllipse(x,y,rx,ry,...args);
  };
  scene.draw(0);for(let frame=0;frame<12;frame++)scene.draw(1000);
  assert.equal(JSON.stringify(s),before,'weather and shape drawing cannot alter simulation state');
  assert.ok(houseMatrix,'the same round footprint was actually rendered');
  const aspect=17*houseMatrix.a/(4*houseMatrix.d);checks.push({viewport:label,houseBaseAspect:aspect});
  assert.ok(Math.abs(aspect-4.25)<1e-8);
  writeFileSync(new URL('../reports/storm-'+label+'.png',import.meta.url),canvases[0].toBuffer('image/png'));
  if(!phone){
    events.get('wheel')({clientX:width/2,clientY:height/2,deltaY:650,deltaX:0,deltaMode:0,preventDefault(){}});
    scene.draw(0);
    writeFileSync(new URL('../reports/storm-'+label+'-wide.png',import.meta.url),canvases[0].toBuffer('image/png'));
  }
}
const bands=stormRainCells(4,12),center=bands[4];assert.equal(stormRainStrength(bands,center.x,center.y),1);
assert.equal(stormRainStrength(bands,center.x,center.y+.5),0,'there are dry gaps between rain bands');
assert.notEqual(stormRainCells(4,90)[4].x,center.x,'the rain bands move through the map');
assert.deepEqual(stormRainCells(4,12),bands,'camera changes cannot move the same world weather');
const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
console.log(JSON.stringify({checks,verified:'moving local storm bands, dry gaps, uniform hut shapes, unchanged worlds and valid offline build'}));
