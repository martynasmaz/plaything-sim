// Browser check for the UI switches (THEME.ui), on the built dist/index.html.
// 1) Default flags: the page renders pixel-for-pixel and box-for-box the same
//    as the build before the switches existed (BASE_REF, default 87c90b0).
// 2) ?ui=minimal: only the world canvas and the command box are visible, no
//    gaps, no errors, and a command typed + Enter is queued and applied.
// Fake timers make both runs deterministic. Screenshot: reports/ui-minimal-preview.png
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import os from 'node:os';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const baseRef=process.env.BASE_REF||'87c90b0';
const temp=await mkdtemp(path.join(os.tmpdir(),'plaything-ui-'));
const baseFile=path.join(temp,'base.html');
await writeFile(baseFile,execFileSync('git',['show',`${baseRef}:dist/index.html`],{cwd:root,maxBuffer:1<<28}));
const current=pathToFileURL(path.join(root,'dist/index.html')).href,base=pathToFileURL(baseFile).href;
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/google-chrome',args:['--disable-dev-shm-usage']});
const report={};
async function open(url,width=1440){
  const context=await browser.newContext({viewport:{width,height:1200},offline:true,timezoneId:'Europe/Vilnius'});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.clock.install({time:new Date('2026-11-11T12:00:00Z')});
  await page.goto(url);await page.clock.runFor(1500);
  await page.waitForFunction(()=>window.plaything&&document.querySelector('#village canvas'));
  await page.clock.runFor(500);
  return {page,context,errors};
}
// Screenshot once two in a row match (CSS border-image art can decode a frame late).
async function settled(page){
  let last=await page.screenshot({fullPage:true});
  for(let i=0;i<8;i++){await page.clock.runFor(250);const next=await page.screenshot({fullPage:true});if(next.equals(last))return next;last=next;}
  return last;
}
const layout=page=>page.evaluate(()=>[...document.querySelectorAll('body *')].map(n=>{const r=n.getBoundingClientRect();
  return `${n.tagName}#${n.id}.${n.className&&n.className.baseVal===undefined?n.className:''} ${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)}x${Math.round(r.height)} ${getComputedStyle(n).display}`;}));
try{
  // Chrome's text anti-aliasing of the input placeholder very occasionally
  // differs between two loads of the SAME file, so each width gets up to 5
  // fresh load pairs and must match exactly on one; the box layout must match
  // on every attempt.
  for(const width of [1440,900,600]){
    let identical=false,attempts=0;
    while(!identical&&attempts<5){
      attempts++;
      const a=await open(base+'?seed=9',width),b=await open(current+'?seed=9',width);
      const [la,lb]=[await layout(a.page),await layout(b.page)];
      assert.deepEqual(lb,la,`default layout differs at ${width}px`);
      const [sa,sb]=[await settled(a.page),await settled(b.page)];
      identical=sa.equals(sb);
      if(!identical){await writeFile(`/tmp/ui-a-${width}.png`,sa);await writeFile(`/tmp/ui-b-${width}.png`,sb);}
      assert.deepEqual(b.errors,[]);
      assert.deepEqual(await b.page.evaluate(()=>[...document.documentElement.classList].filter(c=>c.startsWith('ui-'))),[]);
      report['default'+width]={elements:lb.length,layoutIdentical:true,pixelIdentical:identical,attempts};
      await a.context.close();await b.context.close();
    }
    assert.ok(identical,`default render differs at ${width}px (see /tmp/ui-a-${width}.png and /tmp/ui-b-${width}.png)`);
  }
  for(const width of [1440,600]){
    const {page,context,errors}=await open(current+'?ui=minimal&seed=9',width);
    const visible=await page.evaluate(()=>{
      const keep=[document.querySelector('#village'),document.querySelector('#command-form')];
      const shown=[...document.querySelectorAll('body *')].filter(n=>{const r=n.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(n).visibility!=='hidden';});
      const stray=shown.filter(n=>!keep.some(k=>k.contains(n)||n.contains(k)));
      const inForm=shown.filter(n=>keep[1].contains(n)&&n!==keep[1]).map(n=>n.id||n.className||n.tagName);
      const box=s=>document.querySelector(s).getBoundingClientRect().toJSON();
      return {stray:stray.map(n=>n.tagName+'#'+n.id+'.'+n.className),inForm,text:document.body.innerText.replace(keep[1].innerText,'').trim(),
        buttons:[...document.querySelectorAll('button')].filter(b=>b.getBoundingClientRect().width>0).length,
        canvas:box('#village canvas'),stage:box('.world-stage'),form:box('#command-form'),app:box('.app'),main:box('main')};
    });
    assert.deepEqual(visible.stray,[],'only the world and the command box are visible');
    assert.equal(visible.text,'',`no visible page text outside the canvas: ${JSON.stringify(visible.text)}`);
    assert.equal(visible.buttons,0);
    assert.ok(visible.inForm.includes('command-input')&&visible.inForm.includes('prompt'),visible.inForm.join());
    assert.ok(Math.abs(visible.main.width-(visible.app.width-(width>1000?68:width>760?0:0)))<80,'world takes the full width (no empty aside column)');
    assert.ok(Math.abs(visible.stage.width-visible.main.width)<4,'world spans the main area');
    const gap=visible.form.top-visible.stage.bottom;assert.ok(gap>=0&&gap<=24,`command box sits under the world (gap ${gap}px)`);
    assert.ok(visible.main.top-visible.app.top<=30,'no gap above the world');
    let s=await page.evaluate(()=>plaything.getState());
    assert.equal(s.speed,1,'minimal autoplays at 1x');assert.equal(s.day,0);
    await page.click('#command-input');await page.keyboard.type('not a command');await page.keyboard.press('Enter');
    s=await page.evaluate(()=>plaything.getState());assert.equal(s.queuedCommand,null,'a bad command is refused');
    await page.fill('#command-input','');await page.keyboard.type('cloud wrangle');await page.keyboard.press('Enter');
    s=await page.evaluate(()=>plaything.getState());
    assert.equal(s.queuedCommand,'rain','Enter queues the command');
    assert.equal(await page.inputValue('#command-input'),'','input clears after a queued command');
    if(width===1440)await page.screenshot({path:path.join(root,'reports/ui-minimal-preview.png')});
    await page.clock.runFor(s.config.dayMs+100);
    s=await page.evaluate(()=>plaything.getState());
    assert.equal(s.day,1,'the day advanced without buttons');
    assert.equal(s.lastDay.command.ok,true);assert.equal(s.lastDay.command.command,'rain');assert.equal(s.weather.type??s.weather,'rain');
    assert.deepEqual(errors,[]);
    report['minimal'+width]={visible:'canvas + command box',gapUnderWorld:gap,commandApplied:s.lastDay.command.command,day:s.day};
    await context.close();
  }
  report.passed=true;console.log(JSON.stringify(report,null,2));
}finally{await browser.close();await rm(temp,{recursive:true,force:true});}
