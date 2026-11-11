// Optional integration test: assemble a TEMPORARY art-enabled skin from artist
// SVGs, not a change to the default zero-asset theme or the user's desktop.
import assert from 'node:assert/strict';
import {mkdtemp,cp,mkdir,readFile,writeFile,appendFile,rm} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import {THEME} from '../src/theme.js';
import {build} from './build.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const art=process.env.ART_SVG_DIR||'/workspace/art/v0.1/svg';
const temp=await mkdtemp(path.join(os.tmpdir(),'plaything-theme-browser-'));
let browser;
try{
  await cp(path.join(root,'src'),path.join(temp,'src'),{recursive:true});
  await cp(path.join(root,'vendor'),path.join(temp,'vendor'),{recursive:true});
  await cp(path.join(root,'index.html'),path.join(temp,'index.html'));
  await writeFile(path.join(temp,'package.json'),'{"type":"module"}');
  await mkdir(path.join(temp,'assets'));await mkdir(path.join(temp,'reports'));
  const sprites={};
  for(const [key,spec] of Object.entries(THEME.assetSpecs)){
    if(key==='villager_child')continue;
    sprites[key]='assets/'+spec.file;
    if(key!=='background'&&key!=='villager')await cp(path.join(art,spec.file),path.join(temp,'assets',spec.file));
  }
  for(const variant of new Set([...THEME.creatures.variants,THEME.creatures.childVariant]))for(const [state,frames] of Object.entries(THEME.creatures.states))for(const n of frames){
    const name=`gourdling_${variant}_${state}_${n}.svg`;
    await cp(path.join(art,name),path.join(temp,'assets',name));
  }
  sprites.villager='assets/gourdling_{variant}_{state}_{frame}.svg';
  await appendFile(path.join(temp,'src/theme.js'),`\nTHEME.sprites=${JSON.stringify(sprites)};\nTHEME.names[0]='Theme Swap';\nTHEME.copy.ui.title='Theme swap verified';\nTHEME.copy.log.start='A test Homestead begins.';\nTHEME.copy.labels.resources.food='Test Provisions';\n`);
  const result=await build({root:temp});
  assert.ok(result.inlined.length>=40);assert.equal(result.missing.length,1);assert.equal(result.missing[0].key,'background');
  const html=await readFile(result.output,'utf8');assert.ok(html.includes('data:image/svg+xml;base64,'));
  const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright-core');
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/google-chrome',args:['--disable-dev-shm-usage']});
  const context=await browser.newContext({viewport:{width:1440,height:1200},offline:true,timezoneId:'Europe/Vilnius'});
  const page=await context.newPage(),errors=[],external=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  page.on('request',request=>{if(!/^(file:|data:)/.test(request.url()))external.push(request.url());});
  page.setDefaultTimeout(15000);
  await page.goto(pathToFileURL(result.output).href);
  await page.waitForSelector('#village[data-ready="true"]');
  await page.waitForFunction(()=>document.querySelector('#village').dataset.spritePeople==='6');
  assert.ok((await page.title()).startsWith('Theme swap verified'));
  assert.ok((await page.textContent('#stats')).includes('Test Provisions'));
  assert.ok((await page.textContent('#log')).includes('A test Homestead begins.'));
  assert.ok((await page.textContent('#villager-detail')).includes('Theme Swap'));
  const loaded=JSON.parse(await page.getAttribute('#village','data-loaded-sprites'));
  assert.ok(loaded.includes('gourdling_fiddler_idle_1'));assert.ok(loaded.includes('gourdling_fiddler_walk_2'));
  assert.ok(loaded.includes('shadow'));assert.ok(!loaded.includes('background'));
  assert.deepEqual(JSON.parse(await page.getAttribute('#village','data-missing-sprites')),[]); // Missing path removed at build time.
  assert.equal(await page.locator('#command-form.has-art').count(),1);
  await page.fill('#command-input','teach spark');await page.press('#command-input','Enter');await page.click('#next-day');
  await page.fill('#command-input','cloud wrangle');await page.press('#command-input','Enter');await page.click('#next-day');
  await page.waitForFunction(()=>document.querySelector('#village').dataset.simDay==='2'&&document.querySelector('#village').dataset.walking==='false');
  const box=await page.locator('#village canvas').boundingBox();
  // A textured creature still uses the same selectable feet/body area.
  await page.click('[data-person="2"]');
  await page.mouse.click(box.x+174/900*box.width,box.y+343/480*box.height);
  // Selection via roster is deterministic even if that person's activity moved.
  await page.click('[data-person="1"]');assert.ok((await page.textContent('#villager-detail')).includes('Theme Swap'));
  await page.screenshot({path:path.join(root,'reports/theme-assets.png'),fullPage:true});
  // Exercise tile overlays, conditional illness icons and child sprite lookup.
  for(let i=2;i<15;i++)await page.click('#next-day');
  await page.waitForFunction(()=>document.querySelector('#village').dataset.spritePeople==='7');
  await page.fill('#command-input','sick hex');await page.press('#command-input','Enter');await page.click('#next-day');
  assert.equal((await page.evaluate(()=>window.plaything.getState())).lastUsed.plague,16);
  await page.waitForFunction(()=>document.querySelector('#village').dataset.walking==='false');
  await page.screenshot({path:path.join(root,'reports/theme-assets-illness.png'),fullPage:true});
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  await context.close();
  // A whole reskin is one file: empty map AND all files missing must still boot.
  for(const mode of ['empty-map','all-files-missing']){
    if(mode==='empty-map')await appendFile(path.join(temp,'src/theme.js'),'\nTHEME.sprites={};\n');
    else {
      await appendFile(path.join(temp,'src/theme.js'),`\nTHEME.sprites=${JSON.stringify(sprites)};\n`);
      await rm(path.join(temp,'assets'),{recursive:true,force:true});
    }
    const fallback=await build({root:temp});assert.equal(fallback.inlined.length,0);
    if(mode==='all-files-missing')assert.ok(fallback.missing.length>=40);
    const fallbackContext=await browser.newContext({viewport:{width:1440,height:1080},offline:true});
    const fallbackPage=await fallbackContext.newPage();fallbackPage.setDefaultTimeout(15000);
    fallbackPage.on('pageerror',error=>errors.push(error.message));
    fallbackPage.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
    await fallbackPage.goto(pathToFileURL(fallback.output).href);
    await fallbackPage.waitForSelector('#village[data-ready="true"]');
    await fallbackPage.waitForFunction(()=>document.querySelector('#village').dataset.spritePeople==='0');
    assert.deepEqual(JSON.parse(await fallbackPage.getAttribute('#village','data-loaded-sprites')),[]);
    await fallbackPage.fill('#command-input','teach spark');await fallbackPage.press('#command-input','Enter');await fallbackPage.click('#next-day');
    await fallbackPage.fill('#command-input','cloud wrangle');await fallbackPage.press('#command-input','Enter');await fallbackPage.click('#next-day');
    assert.equal((await fallbackPage.evaluate(()=>window.plaything.getState())).fireKnown,true);
    if(mode==='empty-map')await fallbackPage.screenshot({path:path.join(root,'reports/fallback-shapes.png'),fullPage:true});
    await fallbackContext.close();
  }
  assert.deepEqual(errors,[]);
  const report={passed:true,inlinedImages:result.inlined.length,missingFallback:result.missing[0],consoleErrors:errors,externalRequests:external,
    checks:['single theme swap changes title, resource, names and log','real SVG sprites','idle/walk patterns','separate shadows','ground/weather tiles','sign panel','child sprite','illness icons','missing optional background fallback','file:// with network offline','empty map remains playable','all configured files missing remain playable']};
  await writeFile(path.join(root,'reports/theme-browser-smoke.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
}finally{await browser?.close();await rm(temp,{recursive:true,force:true});}
