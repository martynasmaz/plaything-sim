// Real Canvas and pointer handlers, with controlled worlds. This checks map
// rendering and selection; it does not claim to render browser HTML/CSS.
import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createState} from '../src/sim.js';
import {HOMESTEAD_RULES} from '../src/config.js';
import {createClearing} from '../src/clearing.js';
const require=createRequire(import.meta.url),{createCanvas,Path2D}=require(process.argv[2]||'@napi-rs/canvas');
globalThis.Path2D=Path2D;globalThis.devicePixelRatio=1;globalThis.Image=class {set src(value){}};
for(const [phone,width,height] of [[false,1200,768],[true,390,844],[true,320,568],[true,932,430]]){
  const canvases=[],events=new Map();
  const element=()=>({style:{},dataset:{},children:[],setAttribute(){},append(...nodes){this.children.push(...nodes);},
    addEventListener(name,fn){events.set(name,fn);},getBoundingClientRect(){return {left:0,top:0,width,height};}});
  globalThis.window={matchMedia:()=>({matches:phone})};
  globalThis.document={createElement(tag){if(tag!=='canvas')return element();
    const c=createCanvas(width,height);Object.assign(c,element(),{clientWidth:width,clientHeight:height,setPointerCapture(){}});canvases.push(c);return c;
  }};
  const s=createState(HOMESTEAD_RULES,4);s.villagers=[];s.food=35;s.bankFood=5;s.huts=[0];s.hutDetails=[{shape:'round hut',wall:'woven wall'}];s.settlementWork=5;
  if(width===320){s.day=12345;s.speed=3;}
  const before=JSON.stringify(s),host=element(),scene=createClearing(host,()=>s),card=host.children[1];
  const labels=[],context=canvases[0].getContext('2d'),fillText=context.fillText.bind(context);
  context.fillText=(text,...args)=>{labels.push(String(text));return fillText(text,...args);};
  scene.draw(0);assert.equal(card.hidden,true);
  const zoom=phone?2.2:1.25,left=phone?.227-.5/zoom:.1,top=phone?222/640-.5/zoom:.1;
  const cache={pointerId:1,pointerType:phone?'touch':'mouse',button:0,clientX:(.31-left)*width*zoom,clientY:(.2625-top)*height*zoom-4};
  if(phone){
    events.get('pointerdown')(cache);scene.draw(0);assert.equal(card.hidden,true,'touch waits for a completed tap');
    events.get('pointermove')({...cache,clientX:cache.clientX+2});events.get('pointerup')({...cache,clientX:cache.clientX+2});
  }else events.get('pointermove')(cache);
  scene.draw(0);assert.equal(card.hidden,false);assert.equal(card.children[0].textContent,'Uphill cache');assert.match(card.children[1].textContent,/30 \/ /);
  if(!phone){
    for(let i=0;i<2;i++){events.get('wheel')({...cache,deltaY:-350,deltaX:0,deltaMode:0,preventDefault(){}});scene.draw(0);assert.equal(card.children[0].textContent,'Uphill cache');}
    events.get('pointerleave')({pointerType:'mouse'});scene.draw(0);assert.equal(card.hidden,true);
  }else{
    card.children[3].onclick();assert.equal(card.hidden,true);scene.recenter();scene.draw(0);
    const hut={...cache,clientX:(.165-left)*width*zoom,clientY:(190/640-top)*height*zoom-10};
    events.get('pointerdown')(hut);events.get('pointerup')(hut);scene.draw(0);
    assert.equal(card.children[0].textContent,'round hut');assert.equal(card.children[3].hidden,false);
    events.get('pointerdown')(cache);events.get('pointermove')({...cache,clientX:cache.clientX+30});events.get('pointerup')({...cache,clientX:cache.clientX+30});scene.draw(0);
    assert.equal(card.hidden,true,'panning does not open a selection');scene.recenter();scene.draw(0);
  }
  assert.equal(labels.some(text=>/Uphill cache/.test(text)),false,'cache text belongs to the DOM card, never the zoomed canvas');
  assert.equal(JSON.stringify(s),before,'phone and desktop drawing cannot mutate the simulation');
  const output=phone?(width===390?'phone-map-preview.png':'phone-map-'+width+'x'+height+'.png'):'cache-map-preview.png';
  writeFileSync(new URL('../reports/'+output,import.meta.url),canvases[0].toBuffer('image/png'));
}
delete globalThis.window;
console.log('Verified phone taps, drag cancellation, house cards and recentering; cache uses a corner card at multiple desktop zoom levels.');
