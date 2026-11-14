import {createRequire} from 'node:module';
import {writeFileSync,readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createState} from '../src/sim.js';
import {HOMESTEAD_RULES} from '../src/config.js';
import {createClearing} from '../src/clearing.js';
import {fieldSite} from '../src/development.js';
import {worldTrees} from '../src/practices.js';
const require=createRequire(import.meta.url),{createCanvas,Path2D}=require(process.argv[2]||'@napi-rs/canvas');
globalThis.Path2D=Path2D;globalThis.devicePixelRatio=1;globalThis.Image=class {set src(value){}};
for(const [phone,width,height] of [[true,390,844],[false,1600,900]]){
  const canvases=[],events=new Map(),element=()=>({style:{},dataset:{},children:[],setAttribute(){},append(...nodes){this.children.push(...nodes);},
    addEventListener(name,fn){events.set(name,fn);},getBoundingClientRect(){return {left:0,top:0,width,height};}});
  globalThis.window={matchMedia:()=>({matches:phone})};
  globalThis.document={createElement(tag){if(tag!=='canvas')return element();const c=createCanvas(width,height);Object.assign(c,element(),{clientWidth:width,clientHeight:height,setPointerCapture(){}});canvases.push(c);return c;}};
  const s=createState(HOMESTEAD_RULES,4);s.villagers=[];s.day=140;s.settlementWork=5;
  s.farming.known=true;s.farming.plots=Array.from({length:18},(_,i)=>i%4===0?null:5+i%12);s.farming.crops={};s.farming.sites={};
  for(let i=4;i<18;i++){s.farming.sites[i]=fieldSite(s,i);if(i%2)s.farming.crops[i]='wheat';}
  for(let i=0;i<18;i++)if(!s.farming.crops[i]&&s.farming.plots[i]!==null)s.farming.plots[i]=Math.min(6,s.farming.plots[i]);
  // This controlled fixture represents already prepared beds, including the
  // recorded clearing that real NPC expansion performs before completion.
  s.local.stumps??={};for(let i=0;i<18;i++){const [x,y]=fieldSite(s,i);worldTrees(s).forEach(([tx,ty],id)=>{if(Math.hypot((tx-x)/12,(ty-y)/9)<1)s.local.stumps[id]=100;});}
  s.farming.expansion={index:18,site:fieldSite(s,18),work:1,camp:0,clearedTrees:[]};
  s.local.campStores[0]={saved:25,rack:6,built:true,racks:2,rackWork:1};s.local.campStores[1]={saved:0,rack:0,rackWork:1};
  const before=JSON.stringify(s),scene=createClearing(element(),()=>s);scene.draw(0);
  assert.equal(JSON.stringify(s),before,'drawing cannot expand a field, finish a rack, or move materials');
  writeFileSync(new URL('../reports/development-'+(phone?'phone':'desktop')+'.png',import.meta.url),canvases[0].toBuffer('image/png'));
}
const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
for(const block of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(block[1]);
console.log('Rendered expanded fields and unfinished drying racks on phone/desktop; state unchanged; offline bundle parsed.');
