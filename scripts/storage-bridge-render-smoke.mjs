import {createRequire} from 'node:module';
import {writeFileSync,readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createState,preservationWork,improveBridge} from '../src/sim.js';
import {HOMESTEAD_RULES} from '../src/config.js';
import {createClearing} from '../src/clearing.js';
import {drawGranary,drawBridgeImprovements} from '../src/settlement-view.js';
import {rememberStorageSites,chooseStorageSite} from '../src/storage.js';
import {campSites,worldTrees} from '../src/practices.js';
import {inBuildingPatch} from '../src/ecology.js';
const require=createRequire(import.meta.url),{createCanvas,Path2D}=require(process.argv[2]||'@napi-rs/canvas');
globalThis.Path2D=Path2D;globalThis.devicePixelRatio=1;globalThis.Image=class {set src(value){}};
const s=createState(HOMESTEAD_RULES,4);s.day=100;s.food=100;s.wood=100;s.fireKnown=s.fireLit=true;s.settlementWork=15;
s.local.lastWinterFood={home:0,east:0};s.local.season='Summer';s.local.climate={mm:0};s.toolkit=['hand axe','mallet & chisel'];
s.local.stock.fibre=30;s.local.stock.stone=20;s.huts=[0,0,0];s.hutDetails=[{},{},{}];
const v=s.villagers[0];v.fullness=v.health=v.warmth=100;
Object.assign(v.practice.known,{housing:1,cordage:1,drying:1,granaries:1,bridgecraft:1});
Object.assign(v.practice.skills,{wood:6,fibre:4});Object.assign(v.practice.used,{drying:3,cordage:2});
s.local.campStores[0]={saved:24,rack:0,built:true,racks:1,batches:3};rememberStorageSites(s,campSites);
const site=chooseStorageSite(s,campSites,0);assert.ok(site);s.local.stumps??={};
worldTrees(s).forEach((tree,id)=>{if(inBuildingPatch(tree,site,'granary'))s.local.stumps[id]=90;});
const stages=[];
for(let i=0;i<8;i++){
  v.practice.energy=100;assert.ok(preservationWork(s,v,{actions:[],gatheredWood:0}));
  if([1,3,5,7].includes(i))stages.push(structuredClone(s.local.campStores[0].granary));
}
const bridges=[{railWork:0,braceWork:0}];
for(let i=0;i<10;i++){
  v.practice.energy=100;assert.ok(improveBridge(s,v,{actions:[],gatheredWood:0}));
  if(i===3||i===9)bridges.push(structuredClone(s.local.bridgeUpgrade));
}
s.local.campStores[0].saved=80;
const sheet=createCanvas(1000,420),g=sheet.getContext('2d');g.fillStyle='#e6d9b7';g.fillRect(0,0,1000,420);
g.font='20px Georgia';g.fillStyle='#493d2e';g.fillText('Raised granary: paid construction stages',28,31);
stages.forEach((p,i)=>{g.save();g.translate(125+i*245,172);g.scale(1.8,1.8);drawGranary(g,0,0,p,80,p.work===8);g.restore();g.fillStyle='#493d2e';g.fillText(p.work+' / 8 workdays',55+i*245,204);});
g.fillText('Footbridge: basic deck, handrails, then bracing',28,250);
bridges.forEach((p,i)=>{
  const x=130+i*325;g.fillStyle='#597d7a';g.fillRect(x-80,270,160,105);
  g.strokeStyle='#a98a57';g.lineWidth=7;
  for(let y=273;y<373;y+=10){g.beginPath();g.moveTo(x-14,y);g.lineTo(x+14,y);g.stroke();}
  drawBridgeImprovements(g,x,275,370,p);g.fillStyle='#493d2e';g.fillText(['Basic','Handrails: 55% fewer flood falls','Braced: 85% fewer flood falls'][i],x-115,405);
});
writeFileSync(new URL('../reports/storage-bridge-stages.png',import.meta.url),sheet.toBuffer('image/png'));
for(const [phone,width,height] of [[false,1600,900],[true,390,844]]){
  const canvases=[],element=()=>({style:{},dataset:{},children:[],setAttribute(){},append(...nodes){this.children.push(...nodes);},addEventListener(){},getBoundingClientRect(){return {left:0,top:0,width,height};}});
  globalThis.window={matchMedia:()=>({matches:phone})};
  globalThis.document={createElement(tag){if(tag!=='canvas')return element();const c=createCanvas(width,height);Object.assign(c,element(),{clientWidth:width,clientHeight:height,setPointerCapture(){}});canvases.push(c);return c;}};
  const before=JSON.stringify(s),scene=createClearing(element(),()=>s);scene.draw(0);assert.equal(JSON.stringify(s),before);
  writeFileSync(new URL('../reports/storage-bridge-'+(phone?'phone':'desktop')+'.png',import.meta.url),canvases[0].toBuffer('image/png'));
}
const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
for(const block of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(block[1]);
console.log('Paid granary and bridge stages rendered; phone/desktop render is read-only; offline bundle parses.');
