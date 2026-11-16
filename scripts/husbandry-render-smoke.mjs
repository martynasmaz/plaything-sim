import {createRequire} from 'node:module';
import {writeFileSync,readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createState} from '../src/sim.js';
import {HOMESTEAD_RULES} from '../src/config.js';
import {createClearing} from '../src/clearing.js';
import {drawCollectionPicture} from '../src/encyclopedia.js';
import {worldTrees,hutBuildingSite,campSites} from '../src/practices.js';
import {chooseLivestockSite} from '../src/husbandry.js';
import {buildingPatches,inBuildingPatch} from '../src/ecology.js';
const require=createRequire(import.meta.url),{createCanvas,Path2D}=require(process.argv[2]||'@napi-rs/canvas');
const reportPrefix=process.argv[3]||'husbandry';assert.match(reportPrefix,/^[a-z0-9-]+$/);
globalThis.Path2D=Path2D;globalThis.devicePixelRatio=1;globalThis.Image=class {set src(value){}};
for(const [phone,width,height,regional=false,grown=false] of [[true,390,844],[false,1600,900],[false,2560,1080],[true,390,844,true],[false,1600,900,true],[false,2560,1080,true],[true,390,844,false,true],[false,1600,900,false,true],[false,2560,1080,false,true]]){
  const canvases=[],events=new Map(),element=()=>({style:{},dataset:{},children:[],setAttribute(){},append(...nodes){this.children.push(...nodes);},
    addEventListener(name,fn){events.set(name,fn);},getBoundingClientRect(){return {left:0,top:0,width,height};}});
  globalThis.window={matchMedia:()=>({matches:phone})};
  globalThis.document={createElement(tag){if(tag!=='canvas')return element();const c=createCanvas(width,height);Object.assign(c,element(),{clientWidth:width,clientHeight:height,setPointerCapture(){}});canvases.push(c);return c;}};
  const s=createState(HOMESTEAD_RULES,4);s.day=140;s.elapsedMs=s.config.dayMs*.42;s.settlementWork=5;s.speed=0;
  if(grown){s.huts=[...Array(9).fill(0),1,1,2,2];s.hutDetails=s.huts.map((_,i)=>({shape:['dome hut','gabled roof hut','A-frame hut'][i%3],wall:'mud wall'}));}
  s.local.husbandry.contacts.herders={day:100};
  const pen={id:'pen-0',camp:0,site:grown?chooseLivestockSite(s,0):[332,174],work:4,shelterWork:5,ownerId:1,keeperId:1,careDay:139,grass:30,mast:25,dung:5};
  const unfinished={id:'pen-1',camp:1,site:[698,385],work:2,shelterWork:0,ownerId:2,keeperId:2,grass:30,mast:25,dung:0};
  s.local.husbandry.pens=[pen,unfinished];
  if(grown){const proposal=hutBuildingSite(s,s.villagers[0]);s.huts.push(proposal.camp);s.hutDetails.push({shape:'dome hut',wall:'mud wall',site:proposal.site});}
  for(const [i,a] of s.local.husbandry.animals.filter((a,i)=>[0,2,4,8].includes(i)).entries())Object.assign(a,{location:'village',penId:pen.id,ownerId:1,keeperId:1,age:i===1?12:180,motherId:i===1?1:null});
  if(regional){
    const adults=s.local.husbandry.animals.filter(a=>a.location==='regional');
    for(let i=0;i<14;i++){const mother=adults[i%adults.length];s.local.husbandry.animals.push({...mother,id:100+i,age:i<8?3+i:180,motherId:mother.id});}
  }
  s.local.husbandry.batches=[{site:pen.site,day:139,dryDays:1,wetDays:0,amount:8}];s.local.husbandry.compost=[{site:[375,184],day:130,readyDay:150,amount:2}];
  s.local.stumps??={};for(const p of s.local.husbandry.pens)worldTrees(s).forEach(([x,y],id)=>{if(Math.hypot((x-p.site[0])/39,(y-p.site[1])/28)<1)s.local.stumps[id]=100;});
  if(grown)worldTrees(s).forEach((tree,id)=>{if(buildingPatches(s,campSites).some(p=>inBuildingPatch(tree,p.site,p.kind)))s.local.stumps[id]=100;});
  const before=JSON.stringify(s),scene=createClearing(element(),()=>s);scene.draw(0);scene.draw(8);
  if(regional||grown){
    const initial=phone?2.2:1.25,z=grown?3:(phone?4:3),origin=phone?[.227,222/640]:[.5,.5],target=regional?[1.39,175/640]:[.27,.35];
    const event=(x,y)=>({clientX:x*width,clientY:y*height,pointerId:1,pointerType:'mouse',button:0,preventDefault(){}});
    events.get('wheel')({...event(.5,.5),deltaY:-Math.log(z/initial)/.002,deltaX:0,deltaMode:0});
    events.get('pointerdown')(event(.5,.5));
    events.get('pointermove')(event(.5-(target[0]-origin[0])*z,.5-(target[1]-origin[1])*z));
    events.get('pointerup')(event(.5,.5));scene.draw(0);
  }
  assert.equal(JSON.stringify(s),before,'drawing cannot feed, breed, construct, move stocks or advance animal dice');
  writeFileSync(new URL('../reports/'+reportPrefix+'-'+(regional?'regional-':grown?'grown-':'')+(phone?'phone':width===2560?'ultrawide':'desktop')+'.png',import.meta.url),canvases[0].toBuffer('image/png'));
}
const reference=createCanvas(720,300),g=reference.getContext('2d');
for(const [i,name] of ['animal enclosure','livestock shelter','sheep flock','pig herd','cattle herd','stored hay','milk curds','wool cloth','wooden cattle yoke','clean fleece','wool yarn','compost heap'].entries()){
  const card=createCanvas(180,100);drawCollectionPicture(card.getContext('2d'),name);g.drawImage(card,i%4*180,Math.floor(i/4)*100);
}
writeFileSync(new URL('../reports/'+reportPrefix+'-collection.png',import.meta.url),reference.toBuffer('image/png'));
const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
for(const block of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(block[1]);
console.log('Rendered village pens and a dense regional herd, including young animals, on phone, desktop and ultrawide; state unchanged; encyclopedia artwork rendered; offline bundle parsed.');
