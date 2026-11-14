// Render the actual equipment and full clearing locally with @napi-rs/canvas.
// Pass a bundled Canvas module path as the optional first argument. No browser,
// network, user save, or desktop window is used.
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createState} from '../src/sim.js';
import {HOMESTEAD_RULES} from '../src/config.js';
import {createClearing} from '../src/clearing.js';
const require=createRequire(import.meta.url),{createCanvas,Path2D}=require(process.argv[2]||'@napi-rs/canvas');
const preview=createCanvas(1200,660),elements={sheet:preview,toggle:{},status:{}};
const html=readFileSync(new URL('../reports/fishing-preview.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const context=vm.createContext({Math,document:{getElementById:id=>elements[id]},performance:{now:()=>0},requestAnimationFrame:()=>{}});
vm.runInContext(script,context);vm.runInContext('clock=6.4;frame(0);',context);
writeFileSync(new URL('../reports/fishing-preview.png',import.meta.url),preview.toBuffer('image/png'));
const canvases=[];
const element=()=>({style:{},dataset:{},setAttribute(){},append(){},addEventListener(){},
  getBoundingClientRect(){return {left:0,top:0,width:1200,height:768};}});
globalThis.Path2D=Path2D;globalThis.devicePixelRatio=1;
globalThis.document={createElement(tag){
  if(tag!=='canvas')return element();
  const c=createCanvas(1200,768);Object.assign(c,element(),{clientWidth:1200,clientHeight:768,setPointerCapture(){}});
  canvases.push(c);return c;
}};
globalThis.Image=class {set src(value){}}; // Use the game's procedural worker art.
const s=createState({...HOMESTEAD_RULES,traits:false,illness:{chance:0}},4);
s.food=0;s.gameAnimals=0;s.speed=1;s.local.healerId=999;delete s.lastUsed.godzilla;
for(const v of s.villagers){delete v.herbalist;v.fullness=v.warmth=v.health=v.happiness=100;v.practice.gear['fishing net']=true;}
const host=element(),scene=createClearing(host,()=>s);
for(let i=0;i<180;i++){s.elapsedMs=i*100;scene.draw(100);}
assert.equal(host.dataset.ready,'true');assert.equal(scene.impactScene().walkers.length,6);
writeFileSync(new URL('../reports/fishing-scene.png',import.meta.url),canvases[0].toBuffer('image/png'));
console.log('Rendered all five fishing methods and the full clearing without runtime errors.');
