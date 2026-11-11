// Browser check for save and load (design section 10) on the built
// dist/index.html, with Playwright's fake clock for the 10-second window.
// - Autosave and auto-resume: next days and a queued command survive a reload,
//   and play continues exactly like an uninterrupted run.
// - No save, an unreadable save or an older format starts a new run.
// - An ended save reopens on the end screen; Enter overwrites it with a new run.
// - "begin anew": ask, confirm within 10 s, timeout, other input, reload.
// Screenshot: reports/save-begin-anew.png
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const url=pathToFileURL(path.join(root,'dist/index.html')).href;
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/google-chrome',args:['--disable-dev-shm-usage']});
const KEY='plaything-sim.save',report={checks:[]};
const ok=name=>report.checks.push(name);
async function context(){
  const ctx=await browser.newContext({viewport:{width:1440,height:1200},offline:true,timezoneId:'Europe/Vilnius'});
  const page=await ctx.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.clock.install({time:new Date('2026-11-11T12:00:00Z')});
  return {ctx,page,errors};
}
async function go(page,query=''){
  await page.goto(url+query);await page.clock.runFor(500);
  await page.waitForFunction(()=>window.plaything&&document.querySelector('#village canvas'));
}
const get=page=>page.evaluate(()=>window.plaything.getState());
const saved=page=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),KEY);
const type=async(page,text)=>{await page.fill('#command-input',text);await page.press('#command-input','Enter');};
const run=s=>{const r={...s};for(const k of ['config','lastDay','speed','elapsedMs'])delete r[k];return r;};
async function playSteps(page,days,from=0){
  for(let d=from;d<days;d++){
    if(d===2)await type(page,'please make it rain');
    if(d===9)await type(page,'hoedown');
    await page.click('#next-day');
  }
}
try{
  // Uninterrupted reference run.
  const A=await context();await go(A.page,'?seed=21');
  await playSteps(A.page,20);const whole=await get(A.page);
  // Same run, reloaded twice (after day 6, and with a command queued on day 9).
  const B=await context();await go(B.page,'?seed=21');
  await playSteps(B.page,6);
  const before=await get(B.page);
  assert.equal((await saved(B.page)).run.day,6,'autosaved at the day end');
  await go(B.page);
  const after=await get(B.page);
  assert.deepEqual(run(after),run(before),'reload resumes the exact run');ok('autosave at day end + auto-resume');
  await playSteps(B.page,9,6);await type(B.page,'hoedown');
  assert.equal((await saved(B.page)).run.queuedCommand,'bless','a queued command is saved at once');
  await go(B.page);
  assert.equal((await get(B.page)).queuedCommand,'bless');ok('queued command saved and restored');
  for(let d=9;d<20;d++)await B.page.click('#next-day');
  const resumed=await get(B.page);
  assert.deepEqual(resumed.log,whole.log,'journal equals the uninterrupted run');
  assert.deepEqual(run(resumed),run(whole),'state equals the uninterrupted run');ok('reloaded run equals the uninterrupted run (day 20)');
  // begin anew: first time asks, faint line, nothing restarts, no Wonder spent.
  const seed=resumed.seed,power=resumed.power;
  await type(B.page,'Begin anew.');
  assert.equal(await B.page.textContent('#feedback'),'say it again to let this world go');
  assert.ok(await B.page.locator('#feedback.faint').count());
  let s=await get(B.page);assert.equal(s.seed,seed);assert.equal(s.power,power);assert.equal(s.day,20);
  await B.page.locator('.command-panel').screenshot({path:path.join(root,'reports/save-begin-anew.png')});
  ok('begin anew asks first (faint line, no restart, no Wonder)');
  // Timeout: the line fades and the next "begin anew" asks again.
  await B.page.clock.runFor(10_100);
  assert.ok(await B.page.locator('#feedback.faint.fading').count(),'fading');
  await B.page.clock.runFor(1000);
  assert.equal(await B.page.textContent('#feedback'),'');
  await type(B.page,'begin anew');assert.equal((await get(B.page)).seed,seed);
  assert.equal(await B.page.textContent('#feedback'),'say it again to let this world go');ok('timeout cancels quietly');
  // Other input cancels, then runs as a command.
  await type(B.page,'drop us a feast');
  s=await get(B.page);assert.equal(s.queuedCommand,'harvest');assert.match(await B.page.textContent('#feedback'),/Queued feast drop/);
  await type(B.page,'begin anew');assert.equal((await get(B.page)).seed,seed,'other input cancelled the pending restart');
  ok('other input cancels and runs as a command');
  // A reload cancels the pending restart (it is not saved).
  assert.equal(JSON.stringify(await saved(B.page)).includes('begin'),false);
  await go(B.page);await type(B.page,'begin anew');
  assert.equal((await get(B.page)).seed,seed);ok('reload cancels the pending restart');
  // Typed again within 10 real seconds: new run, new seed, save overwritten.
  await B.page.clock.runFor(9_000);await type(B.page,'begin anew');
  s=await get(B.page);assert.notEqual(s.seed,seed);assert.equal(s.day,0);
  assert.equal((await saved(B.page)).run.seed,s.seed);assert.equal((await saved(B.page)).run.day,0);
  ok('begin anew twice within 10 s starts a new run and overwrites the save');
  // Ended run reopens on its end screen; Enter overwrites it with a new run.
  const ended=await saved(B.page);ended.run.ended=true;ended.run.villagers=[];ended.run.day=33;
  await B.page.evaluate(([k,v])=>localStorage.setItem(k,v),[KEY,JSON.stringify(ended)]);
  await go(B.page);
  assert.ok(await B.page.locator('#ended').isVisible(),'end screen shown');
  assert.equal((await get(B.page)).day,33);
  await B.page.keyboard.press('Enter');
  s=await get(B.page);assert.equal(s.ended,false);assert.equal(s.day,0);assert.notEqual(s.seed,ended.run.seed);
  assert.equal((await saved(B.page)).run.seed,s.seed);ok('ended save reopens on the end screen; Enter overwrites it');
  // No save / unreadable / older format: a new run that replaces it.
  for(const bad of [null,'not json{',JSON.stringify({...ended,version:0})]){
    await B.page.evaluate(([k,v])=>v===null?localStorage.removeItem(k):localStorage.setItem(k,v),[KEY,bad]);
    await go(B.page);s=await get(B.page);
    assert.equal(s.day,0);assert.equal(s.ended,false);
    const now=await saved(B.page);assert.equal(now.version,1);assert.equal(now.run.seed,s.seed);
  }
  ok('no save, unreadable save or old version starts a new run');
  // Minimal preview: the faint line goes in the input's placeholder.
  const C=await context();await go(C.page,'?ui=minimal');
  await type(C.page,'begin anew');
  assert.equal(await C.page.getAttribute('#command-input','placeholder'),'say it again to let this world go');
  await C.page.clock.runFor(12_000);
  assert.equal(await C.page.getAttribute('#command-input','placeholder'),'Type a command, then press Enter');
  ok('minimal preview shows the faint line in the input');
  for(const x of [A,B,C])assert.deepEqual(x.errors,[]);
  for(const x of [A,B,C])await x.ctx.close();
  console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
