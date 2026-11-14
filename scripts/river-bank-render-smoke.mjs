import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createState} from '../src/sim.js';
import {HOMESTEAD_RULES} from '../src/config.js';
import {createClearing} from '../src/clearing.js';
const require=createRequire(import.meta.url),{createCanvas,Path2D}=require(process.argv[2]||'@napi-rs/canvas');
globalThis.Path2D=Path2D;globalThis.devicePixelRatio=1;globalThis.Image=class {set src(value){}};
for(const [phone,width,height] of [[false,1200,768],[true,390,844]]){
  const canvases=[],element=()=>({style:{},dataset:{},children:[],setAttribute(){},append(...nodes){this.children.push(...nodes);},addEventListener(){},getBoundingClientRect(){return {left:0,top:0,width,height};}});
  globalThis.window={matchMedia:()=>({matches:phone})};
  globalThis.document={createElement(tag){if(tag!=='canvas')return element();const c=createCanvas(width,height);Object.assign(c,element(),{clientWidth:width,clientHeight:height,setPointerCapture(){}});canvases.push(c);return c;}};
  const s=createState(HOMESTEAD_RULES,4),template=structuredClone(s.villagers[0]);s.day=100;s.speed=1;s.settlementWork=15;s.elapsedMs=s.config.dayMs*.35;
  s.villagers=Array.from({length:80},(_,i)=>({...structuredClone(template),id:i+1,activity:'Rest',tribe:0}));
  let falls=0;const before=JSON.stringify(s),scene=createClearing(element(),()=>s,{onRiverFall(){falls++;return {fatal:false,count:falls};}});
  scene.draw(0);for(let i=0;i<12;i++)scene.draw(16);
  assert.equal(falls,0,'reopening a populated world must not put villagers in a random river');
  assert.equal(JSON.stringify(s),before,'rendering cannot change needs, structures or daily decisions');
  writeFileSync(new URL('../reports/river-bank-'+(phone?'phone':'desktop')+'.png',import.meta.url),canvases[0].toBuffer('image/png'));
}
console.log('80 restored villagers: no opening-frame falls on desktop or phone; simulation unchanged.');
