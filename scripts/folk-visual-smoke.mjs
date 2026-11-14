// Native Canvas QA for actual clearing chatter and the transient ritual artwork.
// Controlled test inputs; no browser or player save is touched.
import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createState,castText} from '../src/sim.js';
import {HOMESTEAD_RULES} from '../src/config.js';
import {createClearing} from '../src/clearing.js';
import {drawEmojiSpeech} from '../src/village-speech.js';
import {drawFolkRite} from '../src/magic-view.js';
const require=createRequire(import.meta.url),{createCanvas,Path2D}=require(process.argv[2]||'@napi-rs/canvas');
globalThis.Path2D=Path2D;globalThis.devicePixelRatio=1;globalThis.Image=class {set src(value){}};
const canvases=[],events=new Map();
const element=()=>({style:{},dataset:{},children:[],setAttribute(){},append(...nodes){this.children.push(...nodes);},
  addEventListener(name,handler){events.set(name,handler);},getBoundingClientRect(){return {left:0,top:0,width:1200,height:768};}});
globalThis.document={createElement(tag){
  if(tag!=='canvas')return element();
  const canvas=createCanvas(1200,768);Object.assign(canvas,element(),{clientWidth:1200,clientHeight:768,setPointerCapture(){}});
  canvases.push(canvas);return canvas;
}};
const s=createState({...HOMESTEAD_RULES,traits:false,illness:{chance:0},weather:{chances:{normal:100,rain:0,drought:0,cold:0}}},4);
s.food=100;s.wood=50;s.settlementWork=15;s.huts=[0,0,0];s.fireKnown=s.fireLit=true;
s.speed=1;s.elapsedMs=s.config.dayMs*.5;s.local.reaches=12;
for(const v of s.villagers){v.fullness=v.warmth=v.health=v.happiness=100;v.practice.energy=100;}
const host=element(),scene=createClearing(host,()=>s),frame=canvases[0],g=frame.getContext('2d');
const fillText=g.fillText.bind(g);let spoken=0;
g.fillText=(value,...args)=>{if(value==='👋')spoken++;return fillText(value,...args);};
const before=JSON.stringify(s);
for(let i=0;i<80&&!spoken;i++)scene.draw(1000);
assert.ok(spoken,'Actual NPCs in the camp circle emit a short emoji bubble');assert.equal(JSON.stringify(s),before);
assert.equal(host.children[1].hidden,true);
writeFileSync(new URL('../reports/villager-chatter-scene.png',import.meta.url),frame.toBuffer('image/png'));
const sheet=createCanvas(1000,420),c=sheet.getContext('2d');c.fillStyle='#858c5c';c.fillRect(0,0,1000,420);
for(const [i,emoji] of ['🧺','🪓','🪨','👋','🌿'].entries()){
  c.save();c.translate(90+i*200,95);c.scale(2.5,2.5);drawEmojiSpeech(c,0,0,emoji);c.restore();
}
for(const [i,spell] of ['foretelling','hearthcharms','mendingrites','storewards'].entries()){
  c.save();c.translate(140+i*240,320);c.scale(3,3);drawFolkRite(c,0,0,spell,3.8,i+1);c.restore();
}
writeFileSync(new URL('../reports/folk-visuals.png',import.meta.url),sheet.toBuffer('image/png'));
// One enabled, learned ritual fixture also exercises the clearing's spell path.
const m=castText(s,'magic').state;m.elapsedMs=m.config.dayMs*.1;
const caster=m.villagers[0];caster.practice.known.bonecasting=1;caster.practice.known.foretelling=1;
caster.practice.gear['casting bones']=true;caster.practice.outdoorDays=4;caster.practice.skills.stone=3;
Object.assign(m.local.stock,{herbs:10,charcoal:5});
const magicHost=element(),magicScene=createClearing(magicHost,()=>m),magicBefore=JSON.stringify(m);
for(let i=0;i<30;i++)magicScene.draw(1000);
assert.equal(JSON.stringify(m),magicBefore);
console.log('Verified actual nearby emoji chatter, hidden corner card, ritual rendering, and unchanged simulation state.');
