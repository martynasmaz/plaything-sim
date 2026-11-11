// UI switches (THEME.ui): defaults keep today's screen, the minimal preset
// leaves only the world canvas and the command box, and every flag points at
// real page parts. The browser half lives in scripts/ui-smoke.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {THEME, resolveUi, uiHiddenClasses} from '../src/theme.js';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const showFlags=Object.keys(THEME.ui.defaults).filter(k=>k.startsWith('show'));

test('default flags show everything and keep the sim start speed', ()=>{
  const ui=resolveUi();
  for(const k of showFlags)assert.equal(ui[k],true,k);
  assert.equal(ui.autoPlaySpeed,null);
  assert.deepEqual(uiHiddenClasses(ui),[]);
  assert.deepEqual(resolveUi('no-such-preset'),ui);
  assert.deepEqual(resolveUi(null,{bogus:false}),ui,'unknown flags are dropped');
});

test('minimal preset turns off every HUD and panel flag', ()=>{
  const ui=resolveUi('minimal');
  for(const k of showFlags)assert.equal(ui[k],false,k);
  assert.equal(ui.autoPlaySpeed,1,'no buttons, so the days must run by themselves');
  assert.equal(uiHiddenClasses(ui).length,Object.keys(THEME.ui.targets).length);
  assert.equal(resolveUi('minimal',{showJournal:true}).showJournal,true,'overrides win over the preset');
});

test('every show flag has targets and they exist in index.html', ()=>{
  assert.deepEqual(Object.keys(THEME.ui.targets).sort(),[...showFlags].sort());
  const present=selector=>{
    const last=selector.split(/\s*>\s*|\s+/).pop();
    if(last.startsWith('#'))return html.includes(`id="${last.slice(1)}"`);
    if(last.startsWith('.'))return new RegExp(`class="[^"]*\\b${last.slice(1)}\\b`).test(html);
    if(last.startsWith('['))return html.includes(last.slice(1,-1));
    return html.includes('<'+last);
  };
  for(const [flag,selectors] of Object.entries(THEME.ui.targets))for(const s of selectors)assert.ok(present(s),`${flag}: ${s}`);
  for(const s of [...Object.values(THEME.ui.targets).flat()])
    assert.ok(!/#village\b|#command-input|#command-form|world-stage|#ended\b|#restart-ended/.test(s),`never hide the world, input or end screen: ${s}`);
});

test('the sim and rules never read the UI switches', async ()=>{
  for(const file of ['sim.js','config.js'])
    assert.ok(!/THEME\.ui|resolveUi|showStats/.test(await readFile(new URL('../src/'+file,import.meta.url),'utf8')),file);
});
