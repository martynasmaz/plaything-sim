import test from 'node:test';
import assert from 'node:assert/strict';
import {createPhoneControls,phonePowers,phoneLayoutEnabled,createPhoneGesture,phoneTimeCheck} from '../src/phone-ui.js';
import {phoneDom} from './fixtures/phone-dom.js';
import {createState,castText,validateCommand,setSpeed,advanceTime,stepDay} from '../src/sim.js';
import {HOMESTEAD_RULES} from '../src/config.js';
import {serialize} from '../src/save.js';

function fixture(width=390,height=844,coarse=true,options={}){
  const dom=phoneDom(width,height,coarse),calls=[],settings=new Map();let state=setSpeed(createState(HOMESTEAD_RULES,4),3),notebook=false,centered=0;
  const phone=createPhoneControls({...dom,readState:()=>state,
    runCommand:words=>{calls.push(words);const result=castText(state,words);if(result.ok)state=result.state;return result.ok;},
    checkCommand:words=>phoneTimeCheck(state,words)||validateCommand(state,words==='spawn people 5'?'spawn people':words,state.day,true),changeSpeed:speed=>{state=setSpeed(state,speed);},
    openNotebook:()=>{notebook=true;},closeNotebook:()=>{notebook=false;},notebookOpen:()=>notebook,recenter:()=>{centered++;},
    storage:{getItem:k=>settings.get(k)??null,setItem:(k,v)=>settings.set(k,v)},...options});
  return {...dom,phone,calls,settings,advanceDay(){state=stepDay(state);},get state(){return state;},get centered(){return centered;},get notebook(){return notebook;}};
}
test('phone controls activate for small touch screens in both orientations; narrow desktop windows keep desktop controls',()=>{
  for(const [w,h,touch,expected] of [[390,844,true,true],[932,430,true,true],[1440,900,true,false],[390,844,false,false],[1440,900,false,false]]){
    const f=fixture(w,h,touch);assert.equal(f.phone.active,expected);assert.equal(f.doc.documentElement.classList.contains('phone-ui'),expected);
    assert.equal(f.doc.body.querySelector('nav').hidden,!expected);assert.equal(phoneLayoutEnabled(f.browser),expected);
    f.phone.open('powers');assert.equal(f.doc.body.querySelector('dialog').open,expected);
    assert.equal(f.doc.focusedInputs,0);f.phone.close();
  }
  assert.equal(fixture(390,844,true,{enabled:false}).phone.active,false);
});
test('choosing a phone power requires Cast, uses the same simulation command, and never focuses a text input',()=>{
  const f=fixture(),before=structuredClone(f.state);f.findButton('Powers').click();f.findButton('Rain').click();
  assert.deepEqual(f.calls,[]);assert.deepEqual(f.state,before);assert.equal(f.phone.holdClock(),true);
  f.findButton('Cast').click();
  assert.deepEqual(f.calls,['rain']);assert.deepEqual(f.state,castText(before,'rain').state);
  assert.equal(f.phone.holdClock(),false);assert.equal(f.doc.focusedInputs,0);
});
test('destructive powers require an additional deliberate confirmation and respect current command validation',()=>{
  const f=fixture();f.phone.open('powers');f.findButton('Flood').click();
  f.findButton('Continue').click();assert.deepEqual(f.calls,[]);f.findButton('Cast Flood').click();assert.deepEqual(f.calls,['flood']);
  f.phone.open('powers');f.findButton('Heal').click();assert.equal(f.findButton('Cast').disabled,true);
  f.findButton('Cast').click();assert.deepEqual(f.calls,['flood']);assert.match(f.doc.body.querySelector('.phone-reason').textContent,/ill/i);
});
test('the magic unlock is absent from all power buttons and works only through manually entered Speak text',()=>{
  assert.equal(phonePowers.some(p=>p.command==='magic'),false);
  const f=fixture();f.phone.open('powers');assert.equal(f.doc.body.textContent.toLowerCase().includes('magic'),false);assert.equal(f.state.local.magic,undefined);
  f.phone.close();f.findButton('Speak').click();assert.equal(f.doc.focusedInputs,1);
  const input=f.doc.body.querySelector('input');input.value='magic';input.oninput();
  f.doc.body.querySelector('form').onsubmit({preventDefault(){}});
  assert.deepEqual(f.calls,['magic']);assert.equal(f.state.local.magic.enabled,true);
});
test('reading pauses playback without changing world state or the chosen speed; the preference persists separately',()=>{
  const f=fixture(),before=serialize(f.state);f.findButton('Time').click();
  assert.equal(f.phone.holdClock(),true);assert.equal(f.state.speed,3);assert.equal(serialize(f.state),before);
  const advanced=advanceTime(f.state,f.phone.holdClock()?0:1000);assert.equal(advanced.elapsedMs,f.state.elapsedMs);
  f.findButton('1×').click();assert.equal(f.state.speed,1);f.phone.close();assert.equal(f.state.speed,1);assert.equal(f.phone.holdClock(),false);
  f.findButton('Observe').click();assert.equal(f.notebook,true);assert.equal(f.phone.holdClock(),true);
  f.phone.open('time');const checkbox=f.doc.body.querySelector('input');checkbox.checked=false;checkbox.onchange();
  assert.equal(f.phone.holdClock(),false);assert.equal([...f.settings.values()][0],'false');assert.equal(serialize(f.state),before);
});
test('phone pause resumes the last speed, the camera button recenters, and time actions use the shared command route',()=>{
  const f=fixture();f.findButton('Pause').click();assert.equal(f.state.speed,0);f.findButton('Play').click();assert.equal(f.state.speed,3);
  f.doc.body.querySelector('.phone-home').click();assert.equal(f.centered,1);
  f.advanceDay();f.phone.open('time');f.findButton('Back one day').click();assert.deepEqual(f.calls,['back 1']);assert.equal(f.phone.holdClock(),false);
});
test('orientation and keyboard viewport changes keep the phone interface usable; leaving phone mode closes its menus',()=>{
  const f=fixture();f.phone.open('speak');f.browser.visualViewport.height=360;f.browser.visualViewport.offsetTop=12;f.browser.visualViewport.resize();
  assert.equal(f.doc.documentElement.style.getPropertyValue('--phone-height'),'360px');assert.equal(f.doc.documentElement.style.getPropertyValue('--phone-top'),'12px');
  f.resize(932,430);assert.equal(f.phone.active,true);
  f.resize(1440,900,false);assert.equal(f.phone.active,false);assert.equal(f.phone.holdClock(),false);assert.equal(f.doc.body.querySelector('dialog').open,false);
  assert.equal(f.doc.documentElement.style.getPropertyValue('--phone-height'),'');
});
test('a queued native close event does not clear a newly reopened phone menu',async()=>{
  const f=fixture();f.phone.open('speak');f.phone.close();f.phone.open('powers');await Promise.resolve();
  assert.equal(f.phone.holdClock(),true);f.findButton('Rain').click();assert.ok(f.findButton('Cast'));f.phone.close();
});
test('touch inspection tolerates finger jitter but does not mistake dragging, pinching or canceled touches for taps',()=>{
  const g=createPhoneGesture();g.start(1,10,10);assert.equal(g.move(1,13,12),false);assert.equal(g.end(1),true);
  g.start(1,10,10);assert.equal(g.move(1,25,10),true);assert.equal(g.end(1),false);
  g.start(1,0,0);g.start(2,20,20);assert.equal(g.end(1),false);assert.equal(g.end(2),false);
  g.start(1,0,0);g.cancel(1);assert.equal(g.end(1),false);
});

test('a confirmed phone power can be tapped repeatedly on the map without menus, another confirmation or keyboard focus',()=>{
  const f=fixture(),before=structuredClone(f.state),repeat=f.doc.body.querySelector('.phone-repeat');
  assert.equal(repeat.hidden,true);
  f.phone.open('powers');f.findButton('Falling star').click();f.findButton('Continue').click();
  assert.equal(repeat.hidden,true);assert.deepEqual(f.calls,[]);
  f.findButton('Cast Falling star').click();
  assert.equal(repeat.hidden,false);assert.equal(repeat.textContent,'↻ Cast Falling star');
  for(let i=0;i<8;i++)repeat.click();
  assert.deepEqual(f.calls,Array(9).fill('meteor'));assert.equal(f.state.meteors.length,9);
  let expected=before;for(let i=0;i<9;i++)expected=castText(expected,'meteor').state;
  assert.deepEqual(f.state,expected);assert.equal(f.phone.holdClock(),false);
  assert.equal(f.doc.body.querySelector('dialog').open,false);assert.equal(f.doc.focusedInputs,0);
});

test('repeat keeps real power checks and only changes after another successful cast',()=>{
  const f=fixture();f.phone.open('powers');f.findButton('Food').click();f.findButton('Cast').click();
  const repeat=f.doc.body.querySelector('.phone-repeat');
  for(let i=0;i<20;i++)repeat.click();
  assert.equal(f.state.food,100);assert.equal(repeat.disabled,true);
  assert.match(repeat.getAttribute('aria-label'),/full|capacity/i);
  const casts=f.calls.length;repeat.click();assert.equal(f.calls.length,casts);
  f.phone.open('powers');f.findButton('Heal').click();f.findButton('Cast').click();f.phone.close();
  assert.equal(repeat.textContent,'↻ Cast Food');
  f.phone.open('powers');f.findButton('Teach fire').click();f.findButton('Cast').click();
  assert.equal(repeat.textContent,'↻ Cast Teach fire');assert.equal(repeat.disabled,true);
  f.phone.open('powers');f.findButton('Rain').click();f.findButton('Cast').click();
  assert.equal(repeat.textContent,'↻ Cast Rain');assert.equal(repeat.disabled,true,'already-active weather still applies');
});

test('repeat is hidden while reading and on desktop, and returns when phone play resumes',()=>{
  const f=fixture();f.phone.open('powers');f.findButton('Call settlers').click();f.findButton('Cast').click();
  const repeat=f.doc.body.querySelector('.phone-repeat');repeat.click();assert.equal(f.state.villagers.length,16);
  f.findButton('Observe').click();assert.equal(repeat.hidden,true);repeat.click();assert.equal(f.state.villagers.length,16);
  f.phone.open('time');assert.equal(repeat.hidden,true);f.phone.close();assert.equal(repeat.hidden,false);
  f.resize(1440,900,false);assert.equal(repeat.hidden,true);repeat.click();assert.equal(f.state.villagers.length,16);
  assert.equal(f.doc.documentElement.style.getPropertyValue('--phone-repeat-space'),'');
  f.resize(390,844,true);assert.equal(repeat.hidden,false);repeat.click();assert.equal(f.state.villagers.length,21);
  assert.equal(f.doc.documentElement.style.getPropertyValue('--phone-repeat-space'),'56px');
});

test('Speak and time controls do not turn the manual magic unlock into a repeatable button',()=>{
  const f=fixture(),repeat=f.doc.body.querySelector('.phone-repeat');
  f.phone.open('speak');const input=f.doc.body.querySelector('input');input.value='magic';
  f.doc.body.querySelector('form').onsubmit({preventDefault(){}});
  assert.equal(f.state.local.magic.enabled,true);assert.equal(repeat.hidden,true);
  f.phone.open('time');f.findButton('Back one day').click();assert.equal(repeat.hidden,true);
});

test('phone time actions repeat after async completion, serialize rapid taps, and stop rewinding at day zero',async()=>{
  let world=setSpeed(createState(HOMESTEAD_RULES,4),3);
  const history=new Map(),pending=[],calls=[];
  const f=fixture(390,844,true,{
    readState:()=>world,checkCommand:words=>phoneTimeCheck(world,words,{busy:pending.length>0}),
    runCommand:words=>{calls.push(words);return new Promise(resolve=>pending.push({words,resolve}));}
  });
  const complete=async()=>{
    const {words,resolve}=pending.shift(),[kind,countText]=words.split(' '),count=Number(countText);
    if(kind==='skip')for(let i=0;i<count;i++){history.set(world.day,structuredClone(world));world=stepDay(world);}
    else world=history.get(world.day-count);
    resolve(true);await Promise.resolve();
  };
  f.phone.open('time');f.findButton('Back one day').click();assert.deepEqual(calls,[]);
  assert.match(f.doc.body.querySelector('.phone-reason').textContent,/Day 0/);
  f.findButton('Skip 5 days').click();await complete();
  const repeat=f.doc.body.querySelector('.phone-repeat');
  assert.equal(world.day,5);assert.equal(repeat.textContent,'↻ Skip 5 days');assert.equal(repeat.hidden,false);
  repeat.click();assert.equal(repeat.disabled,true);repeat.click();assert.equal(pending.length,1);
  await complete();assert.equal(world.day,10);assert.equal(repeat.disabled,false);
  f.phone.open('time');f.findButton('Back 5 days').click();await complete();assert.equal(world.day,5);
  assert.equal(repeat.textContent,'↻ Back 5 days');repeat.click();await complete();
  assert.equal(world.day,0);assert.equal(repeat.disabled,true);repeat.click();
  assert.deepEqual(calls,['skip 5','skip 5','back 5','back 5']);
  assert.equal(f.phone.holdClock(),false);assert.equal(f.doc.focusedInputs,0);
  world.ended=true;world.day=5;
  assert.equal(phoneTimeCheck(world,'back 5').ok,true,'rewind can restore an extinct village');
  assert.equal(phoneTimeCheck(world,'skip 5').ok,false);assert.equal(phoneTimeCheck(world,'undo skip').ok,false);
});
