// Optional browser smoke test. It launches a NEW HEADLESS browser with a temporary
// profile: never attaches to the desktop browser or uses any signed-in account.
// Requires a locally installed playwright-core; npm test does NOT require it.
import assert from 'node:assert/strict';
import {THEME,slotPosition} from '../src/theme.js';
import {createState,stepDay} from '../src/sim.js';
import {chooseCommand} from '../tests/strategies.js';
// Seed 9: day 1 fair, day 2 a natural cold snap (the design's cloud-wrangle example).
// Seed 39: the cruel strategy wipes the Homestead out on day 11.
const SEED=9,CRUEL_SEED=48; // seed 48: the cruel strategy ends the Homestead on day 11 (v0.2 + traits)
import { writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const moduleName=process.env.PLAYWRIGHT_MODULE||'playwright-core';
const {chromium}=await import(moduleName);
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/google-chrome',
  args:['--disable-dev-shm-usage']});
const allResults=[];
try{
  for(const [name,url,offline] of [
    ['local-server','http://127.0.0.1:4173/',false],
    ['double-click-offline',pathToFileURL(path.join(root,'dist/index.html')).href,true]
  ]){
    const context=await browser.newContext({viewport:{width:1440,height:1080},timezoneId:'Europe/Vilnius',offline});
    const page=await context.newPage();page.setDefaultTimeout(15000);const errors=[],requests=[],external=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});
    page.on('request',r=>{requests.push(r.url());if(!/^(file:|data:|http:\/\/127\.0\.0\.1:4173\/)/.test(r.url()))external.push(r.url());});
    // The test project is the ONLY target. No external page, login or account.
    await page.route('**/*',route=>{
      const u=route.request().url();
      return /^(file:|data:|http:\/\/127\.0\.0\.1:4173\/)/.test(u)?route.continue():route.abort();
    });
    await page.goto(`${url}?seed=${SEED}`);
    await page.waitForSelector('#village[data-ready="true"]');
    assert.equal((await page.evaluate(()=>window.plaything.getState())).seed,SEED);
    assert.match(await page.textContent('#forecast'),/Tomorrow/);
    assert.equal(await page.getAttribute('#forecast','data-weather'),'normal');
    await page.waitForFunction(()=>window.plaything?.getState().day===0,{}, {timeout:15000});
    assert.ok((await page.textContent('#no-save')).includes('closing or reloading resets'));
    assert.equal(await page.locator('canvas').count(),1);
    await page.waitForFunction(()=>document.querySelector('#village').dataset.spritePeople==='6');
    assert.deepEqual(JSON.parse(await page.getAttribute('#village','data-missing-sprites')),[]);
    assert.equal(await page.locator('[data-command]').count(),8); // six v0.1 + shake off, teach sowing (v0.2)
    for(const entry of ['cloud wrangle (rain)','dry spell (drought)','hoedown (bless)','sick hex (plague)','teach spark (teach fire)','feast drop (harvest)','shake off (heal)','teach sowing (teach farming)'])assert.ok((await page.textContent('#command-help')).includes(entry));
    assert.ok((await page.textContent('#command-help')).includes('can kill Gourdlings'));
    for(const label of ['Provisions','Firewood','Wonder'])assert.ok((await page.textContent('#stats')).includes(label));
    // Villagers are also clickable circles (scaled canvas coordinates).
    await page.click('[data-person="2"]');
    const box=await page.locator('#village canvas').boundingBox();
    const ada=slotPosition('rest',0);await page.mouse.click(box.x+ada.x/THEME.layout.canvas.width*box.width,box.y+(ada.y-17)/THEME.layout.canvas.height*box.height);
    assert.ok((await page.textContent('#villager-detail')).includes('Ada'));
    // Invalid command is visible and never alters state.
    await page.fill('#command-input','make a dragon');await page.press('#command-input','Enter');
    assert.ok((await page.textContent('#feedback')).includes('Unknown/unavailable'));
    assert.equal((await page.evaluate(()=>window.plaything.getState())).power,50);
    // Queue, replace and cancel, all through visible controls.
    await page.fill('#command-input','rain');await page.press('#command-input','Enter');
    await page.fill('#command-input','harvest');await page.press('#command-input','Enter');
    assert.ok((await page.textContent('#queued')).includes('harvest'));
    await page.click('#cancel');assert.ok((await page.textContent('#queued')).includes('Nothing'));
    await page.fill('#command-input','  TeAcH   SPARK  ');await page.press('#command-input','Enter');
    assert.equal((await page.evaluate(()=>window.plaything.getState())).power,50);
    await page.click('#next-day');
    let s=await page.evaluate(()=>window.plaything.getState());
    assert.equal(s.day,1);assert.equal(s.fireKnown,true);assert.equal(s.fireLit,true);assert.equal(s.lastUsed['teach fire'],1);
    // Weather is observable, and advances only when a day does. Tomorrow is a
    // natural cold snap; a queued cloud wrangle shows as tomorrow's weather.
    assert.equal(await page.getAttribute('#forecast','data-weather'),'cold');
    if(name==='local-server')assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('.forecast-icon')).backgroundImage.startsWith('url(')),true,'cold snap icon in the tag');
    await page.locator('.world-panel .panel-heading').screenshot({path:path.join(root,`reports/${name}-hud-forecast-cold.png`)});
    await page.fill('#command-input','CLOUD   WRANGLE');await page.press('#command-input','Enter');
    assert.equal(await page.getAttribute('#forecast','data-weather'),'rain');
    await page.locator('.world-panel .panel-heading').screenshot({path:path.join(root,`reports/${name}-hud-forecast.png`)});
    await page.click('#next-day');await page.click('#next-day');
    s=await page.evaluate(()=>window.plaything.getState());
    assert.equal(s.day,3);assert.equal(s.lastDay.weather,'rain');assert.equal(s.weather.daysLeft,1);
    // Needs selection works via both accessible names and a circle on the canvas.
    await page.click('[data-person="2"]');
    assert.ok((await page.textContent('#villager-detail')).includes('Bram'));
    // Wait for the actual cosmetic movement, not simulation time.
    await page.waitForFunction(()=>{
      const village=document.querySelector('#village');return village.dataset.simDay==='3'&&village.dataset.walking==='false';
    });
    await page.screenshot({path:path.join(root,name==='local-server'?'screenshot.png':'reports/file-offline.png'),fullPage:true});
    await page.click('#normal');assert.equal((await page.evaluate(()=>window.plaything.getState())).speed,1);
    await page.click('#fast');assert.equal((await page.evaluate(()=>window.plaything.getState())).speed,3);
    await page.click('#pause');assert.equal((await page.evaluate(()=>window.plaything.getState())).speed,0);
    await page.click('#restart');
    s=await page.evaluate(()=>window.plaything.getState());
    assert.notEqual(s.seed,SEED,'restart picks a new seed');
    assert.equal(s.day,0);assert.equal(s.power,50);assert.equal(s.fireKnown,false);assert.equal(s.queuedCommand,null);
    assert.equal(s.birthCounter,0);assert.equal(s.fireCounter,0);assert.equal(s.speed,0);
    // The page replays exactly what the pure sim does for the same seed.
    let expected=createState({},s.seed);
    for(let i=0;i<30&&!expected.ended;i++){await page.click('#next-day');expected=stepDay(expected);}
    s=await page.evaluate(()=>window.plaything.getState());
    assert.equal(s.day,expected.day);assert.equal(s.villagers.length,expected.villagers.length);assert.equal(s.food,expected.food);
    assert.deepEqual(s.log,expected.log);
    assert.equal(await page.locator('#milestone').isVisible(),expected.milestoneReached);
    // Wipeout: a cruel god on seed 48, typed through the command box.
    await page.goto(`${url}?seed=${CRUEL_SEED}`);await page.waitForSelector('#village[data-ready="true"]');
    for(let i=0;i<60;i++){
      s=await page.evaluate(()=>window.plaything.getState());if(s.ended)break;
      const command=chooseCommand('cruel',s);
      if(command){await page.fill('#command-input',command);await page.press('#command-input','Enter');}
      await page.click('#next-day');
    }
    s=await page.evaluate(()=>window.plaything.getState());
    assert.equal(s.ended,true);assert.equal(s.day,11);
    assert.equal(await page.locator('#ended').isVisible(),true);
    assert.equal(await page.textContent('#end-title'),'The Homestead Falls Quiet');
    assert.equal(await page.textContent('#end-body'),'The last Gourdling is gone. The Homestead lasted 11 days.');
    const endStats=await page.textContent('#end-stats');
    for(const text of ['Days lasted','11','Peak population',String(s.stats.peak),'Births','Deaths',String(s.stats.deaths),'Bonfire discovered'])assert.ok(endStats.includes(text),text);
    assert.equal(await page.textContent('#end-seed'),`Run seed ${CRUEL_SEED}`);
    assert.equal(await page.isDisabled('#command-input'),true);assert.equal(await page.isDisabled('#next-day'),true);
    await page.screenshot({path:path.join(root,`reports/${name}-end-screen.png`),fullPage:true});
    await page.locator('#ended .end-panel').screenshot({path:path.join(root,`reports/${name}-end-panel.png`)});
    await page.click('#restart-ended');
    s=await page.evaluate(()=>window.plaything.getState());
    assert.equal(s.day,0);assert.equal(s.ended,false);assert.notEqual(s.seed,CRUEL_SEED);
    assert.equal(await page.locator('#ended').isVisible(),false);
    // Small-screen layout doesn't introduce a horizontal scroll trap.
    await page.setViewportSize({width:390,height:844});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
    await page.screenshot({path:path.join(root,`reports/${name}-mobile.png`),fullPage:true});
    assert.deepEqual(errors,[],`${name}: browser console errors`);
    assert.deepEqual(external,[],`${name}: unexpected internet requests`);
    allResults.push({name,passed:true,url,offline,consoleErrors:errors,externalRequests:external,
      requests:requests.length,seed:SEED,wipeoutSeed:CRUEL_SEED,wipeoutDay:11,
      checks:['load/render','unknown phrase','queue/replace/cancel','teach fire','rain and days',
        'villager details and clickable circles','speed controls','restart with new seed','30 days identical to the pure sim','forecast (natural and command)','wipeout end screen and restart','mobile layout','approved flavour names and fatal-illness help']});
    await context.close();
  }
  await writeFile(path.join(root,'reports/browser-smoke.json'),JSON.stringify(allResults,null,2)+'\n');
  console.log(JSON.stringify(allResults,null,2));
}finally{await browser.close();}
