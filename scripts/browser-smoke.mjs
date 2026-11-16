// Current playable entry point, real DOM, canvas and save slot. Always uses
// temporary browser contexts; it cannot touch an existing player profile.
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {writeFile} from 'node:fs/promises';
import {build} from './build.mjs';
import {CONFIG,HOMESTEAD_RULES} from '../src/config.js';
import {stepDay,castText} from '../src/sim.js';
import {serialize,deserialize} from '../src/save.js';
import {sourceFingerprint} from './source-fingerprint.mjs';
import {createProjectServer} from './serve.mjs';

const moduleName=process.env.PLAYWRIGHT_MODULE||'playwright-core';
let chromium;
try{({chromium}=await import(moduleName));}
catch{throw Error('Browser checks did not run: install/provide playwright-core with PLAYWRIGHT_MODULE. See docs/TESTING.md.');}
const executablePath=process.env.CHROMIUM_PATH||chromium.executablePath();
if(!existsSync(executablePath))throw Error('Browser checks did not run: set CHROMIUM_PATH to an installed Chrome/Chromium executable. See docs/TESTING.md.');
const fingerprint=sourceFingerprint();
await build(); // Never report success against a stale standalone artifact.
const url=new URL('../dist/index.html',import.meta.url).href;
const browser=await chromium.launch({headless:true,executablePath});
const server=createProjectServer();
const started=Date.now(),checks=[],saveKey=CONFIG.save.key+'.homestead';
const projection=s=>JSON.parse(serialize(s));
// Cast timestamps follow the browser's within-day animation clock. That clock
// is not part of the headless stepDay model; retain it in save/resume checks.
const modelProjection=s=>{const p=projection(s);delete p.run.castAt;return p;};
const state=page=>page.evaluate(()=>window.plaything.getState());
async function ready(page){
  await page.waitForFunction(()=>window.plaything&&document.querySelector('#village[data-ready="true"] canvas'));
}
async function speak(page,text,phone){
  if(phone){
    await page.locator('.phone-toolbar').getByRole('button',{name:'Speak',exact:true}).click();
    const dialog=page.locator('.phone-tray');
    await dialog.locator('input').fill(text);await dialog.getByRole('button',{name:'Speak',exact:true}).click();
  }else{await page.locator('#command-input').fill(text);await page.locator('#command-input').press('Enter');}
}
try{
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const sourceUrl=`http://127.0.0.1:${server.address().port}/`;
  for(const [name,width,height,touch,entry] of [['desktop',1440,900,false,url],['phone',390,844,true,url],['ultrawide',2560,1080,false,url],['module-source',1440,900,false,sourceUrl]]){
    const context=await browser.newContext({viewport:{width,height},hasTouch:touch,isMobile:touch,offline:entry===url,timezoneId:'Europe/Vilnius'});
    try{
      const page=await context.newPage(),errors=[];page.setDefaultTimeout(10000);
      await page.route('**/*',route=>/^(file:|data:)/.test(route.request().url())||route.request().url().startsWith(sourceUrl)?route.continue():route.abort());
      page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
      // Freeze wall time to avoid gameplay advancing while checks are running.
      await page.clock.install({time:new Date('2026-11-15T12:00:00Z')});
      await page.goto(entry+'?seed=4');await page.clock.runFor(100);await ready(page);
      assert.deepEqual(errors,[],name+' startup');
      const initial=await state(page);assert.equal(initial.day,0);assert.equal(initial.villagers.length,6);
      assert.equal(initial.config.learning.discoveryMultiplier,HOMESTEAD_RULES.learning.discoveryMultiplier);
      assert.equal(await page.locator('html').evaluate(n=>n.classList.contains('clearing')),true);
      assert.equal(await page.locator('.phone-toolbar').isVisible(),touch);
      const paint=await page.locator('#village canvas').evaluate(canvas=>{
        const g=canvas.getContext('2d'),pixels=g.getImageData(0,0,canvas.width,canvas.height).data,colors=new Set();
        for(let i=0;i<pixels.length;i+=4*97)if(pixels[i+3])colors.add(`${pixels[i]},${pixels[i+1]},${pixels[i+2]}`);
        return {colors:colors.size,width:canvas.width,height:canvas.height};
      });
      assert.ok(paint.width>0&&paint.height>0&&paint.colors>30,name+' must paint a village, not a blank/solid canvas');
      await speak(page,'teach all',touch);await page.clock.runFor(50);
      let expected=castText(initial,'teach all');assert.equal(expected.ok,true);
      assert.deepEqual(modelProjection(await state(page)),modelProjection(expected.state),name+' command must reach the actual current simulation');
      await speak(page,'skip 1',touch);await page.clock.runFor(100);
      await page.waitForFunction(()=>window.plaything.getState().day===1);
      expected=stepDay(expected.state);
      const played=await state(page);
      assert.deepEqual(modelProjection(played),modelProjection(expected),name+' one-day advance');
      const stored=await page.evaluate(key=>localStorage.getItem(key),saveKey);
      assert.ok(stored,name+' must write the real homestead slot');
      assert.deepEqual(JSON.parse(stored),projection(played),name+' persisted game');
      const resumed=deserialize(stored,HOMESTEAD_RULES);assert.ok(resumed);
      // No explicit seed on resume: a seed query intentionally starts a fresh run.
      await page.goto(entry);await page.clock.runFor(100);await ready(page);
      assert.deepEqual(projection(await state(page)),projection(resumed),name+' resume');
      if(touch)await page.locator('.phone-toolbar').getByRole('button',{name:'Observe',exact:true}).click();
      else await speak(page,'observe',false);
      const notebook=page.locator('.settlement-notebook');await notebook.waitFor({state:'visible'});
      const familyText=await notebook.locator('[data-person]').textContent();
      assert.ok(familyText.includes('Family:')&&familyText.includes('Desire for another child'),name+' Observe must show the real family ambition');
      await notebook.getByRole('button',{name:'Close notebook'}).click();
      assert.deepEqual(projection(await state(page)),projection(resumed),name+' observing cannot change simulation data');
      let winterMeals=false;
      if(process.env.WINTER_MEAL_CHECK==='1'){
        const winter=structuredClone(resumed);winter.day=60;winter.local.seasonOffset=0;winter.local.season='Autumn';winter.food=.5;winter.local.dried=.5;
        const savedWinter=serialize(winter);
        await page.evaluate(({key,value})=>localStorage.setItem(key,value),{key:saveKey,value:savedWinter});
        await page.goto(entry);await page.clock.runFor(100);await ready(page);
        assert.equal((await state(page)).food,.5,name+' half portion survives browser reload');
        if(touch)await page.locator('.phone-toolbar').getByRole('button',{name:'Observe',exact:true}).click();
        else await speak(page,'observe',false);
        await notebook.waitFor({state:'visible'});
        assert.equal(await notebook.locator('dl[aria-label="Camp stores"] > div').filter({hasText:'Food'}).locator('dd').textContent(),'0.5',name+' displays remaining half portion');
        await notebook.getByRole('button',{name:'Close notebook'}).click();
        await speak(page,'skip 1',touch);await page.clock.runFor(100);
        const winterPlayed=await state(page),winterExpected=stepDay(deserialize(savedWinter,HOMESTEAD_RULES));
        assert.equal(winterPlayed.day,61);assert.ok(winterExpected.lastDay.mealServings.length>0);
        assert.ok(winterExpected.lastDay.mealServings.every(m=>m.amount===.5));
        assert.deepEqual(modelProjection(winterPlayed),modelProjection(winterExpected),name+' actual browser uses half winter meals');
        winterMeals=true;
      }
      assert.deepEqual(errors,[],name+' command, advance and reload');
      checks.push({name,width,height,touch,paint,startup:true,command:true,advance:true,saveResume:true,observeFamily:true,winterMeals,errors});
      console.log(`${name}: startup, painted canvas, teach all, day advance, save/resume and family Observe passed`);
    }finally{await context.close();}
  }
  assert.equal(sourceFingerprint().sha256,fingerprint.sha256,'Source changed during browser checks.');
  const result={createdAt:new Date().toISOString(),sourceSha256:fingerprint.sha256,sourceFiles:fingerprint.files,sourceHashFormat:fingerprint.format,method:'Fresh standalone build offline, plus module sources on a temporary loopback server. Isolated browser contexts, fake clock, current HOMESTEAD_RULES; external requests blocked. No player storage touched. Canvas diversity is a blank-screen check, not visual-art approval.',durationMs:Date.now()-started,checks};
  await writeFile(new URL('../reports/browser-smoke-current.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
