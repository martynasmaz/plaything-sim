import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createState} from '../src/sim.js';
import {HOMESTEAD_RULES} from '../src/config.js';
import {createClearing} from '../src/clearing.js';
const require=createRequire(import.meta.url),{createCanvas,Path2D}=require(process.argv[2]||'@napi-rs/canvas');
globalThis.Path2D=Path2D;globalThis.devicePixelRatio=1;globalThis.Image=class {set src(value){}};
const results=[];
for(const [phone,width,height] of [[false,1200,768],[true,390,844],[false,1600,600]]){
  const canvases=[],element=()=>({style:{},dataset:{},children:[],setAttribute(){},append(...nodes){this.children.push(...nodes);},addEventListener(){},getBoundingClientRect(){return {left:0,top:0,width,height};}});
  globalThis.window={matchMedia:()=>({matches:phone})};
  globalThis.document={createElement(tag){if(tag!=='canvas')return element();const c=createCanvas(width,height);Object.assign(c,element(),{clientWidth:width,clientHeight:height,setPointerCapture(){}});canvases.push(c);return c;}};
  const s=createState(HOMESTEAD_RULES,4),template=structuredClone(s.villagers[0]);s.day=100;s.speed=1;s.settlementWork=15;s.elapsedMs=s.config.dayMs*.35;
  s.villagers=Array.from({length:80},(_,i)=>({...structuredClone(template),id:i+1,activity:'Rest',tribe:0}));
  let falls=0;const before=JSON.stringify(s),scene=createClearing(element(),()=>s,{onRiverFall(){falls++;return {fatal:false,count:falls};}});
  scene.draw(0);for(let i=0;i<12;i++)scene.draw(16);
  assert.equal(falls,0,'reopening a populated world must not put villagers in a random river');
  assert.equal(JSON.stringify(s),before,'rendering cannot change needs, structures or daily decisions');
  const jobs=['Forage','Hunt','Fish','Gather wood','Harvest','Gather reeds'];
  s.villagers=s.villagers.slice(0,24);s.tribeCount=2;s.castCount++;s.elapsedMs=s.config.dayMs*.43;
  s.local.tributaryBridge={work:6,completedDay:90};
  for(const v of s.villagers){v.tribe=v.id%2;v.activity=jobs[v.id%jobs.length];v.warmth=v.id%3?100:20;}
  const walkingBefore=JSON.stringify(s);
  // Four minutes of actual animated work: opposite camps, food trips,
  // waterside tasks and vulnerable walkers. No nightly model intervention.
  for(let frame=0;frame<240;frame++)scene.draw(1000);
  assert.equal(falls,0,'ordinary work routes across completed bridges must not cause calm-water falls');
  assert.equal(JSON.stringify(s),walkingBefore,'animation must not alter daily priorities or resources');
  const name=phone?'phone':width>1200?'ultrawide':'desktop';
  writeFileSync(new URL('../reports/river-bank-'+name+'.png',import.meta.url),canvases[0].toBuffer('image/png'));
  results.push({layout:name,width,height,openingVillagers:80,workingVillagers:24,animatedSeconds:240,falls});
}
writeFileSync(new URL('../reports/river-route-render.json',import.meta.url),JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify(results));
