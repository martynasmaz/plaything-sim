// Browser layout check: a TEMPORARY copy starts with 8 Gourdlings (2 children)
// so all slots fill on day 0; we then play days and assert that no sprite or
// name label overlaps another Gourdling or a scene label. Real art, then shapes.
import assert from 'node:assert/strict';
import {mkdtemp,cp,readFile,writeFile,appendFile,rm} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import {build} from './build.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const overlap=(a,b)=>a[0]<b[2]&&b[0]<a[2]&&a[1]<b[3]&&b[1]<a[3];
function check(boxes,where){
  const P=boxes.people;
  for(let i=0;i<P.length;i++){
    for(let j=i+1;j<P.length;j++)for(const a of ['sprite','label'])for(const b of ['sprite','label'])
      assert.ok(!overlap(P[i][a],P[j][b]),`${where}: #${P[i].id} ${a} overlaps #${P[j].id} ${b}`);
    for(const s of boxes.scene)assert.ok(!overlap(P[i].label,s)&&!overlap(P[i].sprite,s),`${where}: #${P[i].id} overlaps a scene label`);
  }
  return P.length;
}
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/google-chrome',args:['--disable-dev-shm-usage']});
const report={passed:false,runs:[]};
try{
  for(const mode of ['art','shapes']){
    const temp=await mkdtemp(path.join(os.tmpdir(),'plaything-layout-'));
    for(const dir of ['src','vendor','assets'])await cp(path.join(root,dir),path.join(temp,dir),{recursive:true});
    await cp(path.join(root,'index.html'),path.join(temp,'index.html'));
    await writeFile(path.join(temp,'package.json'),'{"type":"module"}');
    const configPath=path.join(temp,'src/config.js'),config=await readFile(configPath,'utf8');
    const patched=config.replace(/ages: \[([^\]]*)\]/,(m,list)=>`ages: [${list}, 8, 12]`);
    assert.notEqual(patched,config);await writeFile(configPath,patched);
    if(mode==='shapes')await appendFile(path.join(temp,'src/theme.js'),'\nTHEME.sprites={};\n');
    const result=await build({root:temp});
    const context=await browser.newContext({viewport:{width:1440,height:1200},offline:true});
    const page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    page.setDefaultTimeout(20000);
    await page.goto(pathToFileURL(result.output).href);
    await page.waitForSelector('#village[data-ready="true"]');
    const boxes=async day=>{
      await page.waitForFunction(d=>{const e=document.querySelector('#village');return e.dataset.simDay===String(d)&&e.dataset.walking==='false'&&e.dataset.layoutBoxes;},day);
      await page.waitForTimeout(50);
      return JSON.parse(await page.getAttribute('#village','data-layout-boxes'));
    };
    // Day 0: everyone resting in their slot.
    await page.waitForFunction(()=>document.querySelector('#village').dataset.layoutBoxes);
    const day0=JSON.parse(await page.getAttribute('#village','data-layout-boxes'));
    assert.equal(check(day0,`${mode} day 0`),8);
    await page.locator('#village').screenshot({path:path.join(root,`reports/layout-rest-8-${mode}.png`)});
    if(mode==='art')await page.screenshot({path:path.join(root,'screenshot-resting.png')});
    let checked=1,maxPeople=8;
    for(let day=1;day<=30;day++){
      await page.click('#next-day');
      if(await page.locator('#ended:visible').count())break;
      const b=await boxes(day);maxPeople=Math.max(maxPeople,check(b,`${mode} day ${day}`));checked++;
    }
    assert.deepEqual(errors,[]);
    report.runs.push({mode,daysChecked:checked,maxPeople,consoleErrors:errors});
    await context.close();await rm(temp,{recursive:true,force:true});
  }
  report.passed=true;
}finally{
  await browser.close();
  await writeFile(path.join(root,'reports/layout-smoke.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
}
