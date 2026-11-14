import {createRequire} from 'node:module';
import {writeFileSync,readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createState} from '../src/sim.js';
import {HOMESTEAD_RULES} from '../src/config.js';
import {createClearing} from '../src/clearing.js';
import {drawCollectionPicture} from '../src/encyclopedia.js';
import {worldTrees} from '../src/practices.js';
const require=createRequire(import.meta.url),{createCanvas,Path2D}=require(process.argv[2]||'@napi-rs/canvas');
globalThis.Path2D=Path2D;globalThis.devicePixelRatio=1;globalThis.Image=class {set src(value){}};
for(const [phone,width,height] of [[true,390,844],[false,1600,900],[false,2560,1080]]){
  const canvases=[],events=new Map(),element=()=>({style:{},dataset:{},children:[],setAttribute(){},append(...nodes){this.children.push(...nodes);},
    addEventListener(name,fn){events.set(name,fn);},getBoundingClientRect(){return {left:0,top:0,width,height};}});
  globalThis.window={matchMedia:()=>({matches:phone})};
  globalThis.document={createElement(tag){if(tag!=='canvas')return element();const c=createCanvas(width,height);Object.assign(c,element(),{clientWidth:width,clientHeight:height,setPointerCapture(){}});canvases.push(c);return c;}};
  const s=createState(HOMESTEAD_RULES,4);s.day=140;s.elapsedMs=s.config.dayMs*.42;s.settlementWork=5;s.speed=0;
  s.local.husbandry.contacts.herders={day:100};
  const pen={id:'pen-0',camp:0,site:[332,174],work:4,shelterWork:5,ownerId:1,keeperId:1,careDay:139,grass:30,mast:25,dung:5};
  const unfinished={id:'pen-1',camp:1,site:[698,385],work:2,shelterWork:0,ownerId:2,keeperId:2,grass:30,mast:25,dung:0};
  s.local.husbandry.pens=[pen,unfinished];
  for(const [i,a] of s.local.husbandry.animals.filter((a,i)=>[0,2,4,8].includes(i)).entries())Object.assign(a,{location:'village',penId:pen.id,ownerId:1,keeperId:1,age:i===1?12:180,motherId:i===1?1:null});
  s.local.husbandry.batches=[{site:pen.site,day:139,dryDays:1,wetDays:0,amount:8}];s.local.husbandry.compost=[{site:[375,184],day:130,readyDay:150,amount:2}];
  s.local.stumps??={};for(const p of s.local.husbandry.pens)worldTrees(s).forEach(([x,y],id)=>{if(Math.hypot((x-p.site[0])/39,(y-p.site[1])/28)<1)s.local.stumps[id]=100;});
  const before=JSON.stringify(s),scene=createClearing(element(),()=>s);scene.draw(0);scene.draw(0);
  assert.equal(JSON.stringify(s),before,'drawing cannot feed, breed, construct, move stocks or advance animal dice');
  writeFileSync(new URL('../reports/husbandry-'+(phone?'phone':width===2560?'ultrawide':'desktop')+'.png',import.meta.url),canvases[0].toBuffer('image/png'));
}
const reference=createCanvas(720,300),g=reference.getContext('2d');
for(const [i,name] of ['animal enclosure','livestock shelter','sheep flock','pig herd','cattle herd','stored hay','milk curds','wool cloth','wooden cattle yoke','clean fleece','wool yarn','compost heap'].entries()){
  const card=createCanvas(180,100);drawCollectionPicture(card.getContext('2d'),name);g.drawImage(card,i%4*180,Math.floor(i/4)*100);
}
writeFileSync(new URL('../reports/husbandry-collection.png',import.meta.url),reference.toBuffer('image/png'));
const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
for(const block of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(block[1]);
console.log('Rendered livestock, young animals, shelters and unfinished enclosures on phone, desktop and ultrawide; state unchanged; encyclopedia artwork rendered; offline bundle parsed.');
