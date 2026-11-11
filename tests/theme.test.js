import {test,describe} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {THEME,t,spriteManifest,villagerTextureCandidates,commandLabel} from '../src/theme.js';
import {COMMAND_WORDS,resolveCommand} from '../src/commands.js';
import {createState,queueCommand,stepDay,availableCommands,validateCommand} from '../src/sim.js';
import {inlineAssets} from '../scripts/build.mjs';
const cast=(s,word)=>{const r=queueCommand(s,word);assert.equal(r.ok,true,r.message);return stepDay(r.state);};

describe('Approved command names and shared aliases',()=>{
  test('all six name/alias pairs produce precisely the same canonical state and pay once',()=>{
    for(const [id,[name,alias]] of Object.entries(COMMAND_WORDS)){
      const initial=createState();
      assert.equal(resolveCommand(`  ${name.toUpperCase().replaceAll(' ','   ')}  `),id);
      assert.equal(resolveCommand(alias),id);
      const byName=cast(initial,name),byAlias=cast(initial,alias);
      assert.deepEqual(byName,byAlias,id);
      assert.equal(byName.lastUsed[id],1);assert.equal(Object.keys(byName.lastUsed).length,1);
      assert.equal(byName.lastDay.command.command,id);assert.equal(byName.queuedCommand,null);
    }
  });
  test('each pair has ONE cooldown in either direction, including once-per-run teaching',()=>{
    for(const [id,[name,alias]] of Object.entries(COMMAND_WORDS))for(const [first,second] of [[name,alias],[alias,name]]){
      let s=createState();s.power=100;s=cast(s,first);s.power=100;
      const r=queueCommand(s,second);assert.equal(r.ok,false,id);assert.strictEqual(r.state,s);
      assert.equal(s.lastUsed[id],1);assert.equal(s.lastUsed[name],undefined);
      assert.match(r.message,id==='teach fire'?/once per run/:/cooling down/);
    }
  });
  test('hoedown on day 4 blocks bless on day 8 and allows both on day 9',()=>{
    let s=createState();for(let i=0;i<3;i++)s=stepDay(s);s=cast(s,'hoedown');
    for(let i=0;i<3;i++)s=stepDay(s);s.villagers[0].health=90; // Keep a useful blessing target.
    assert.equal(validateCommand(s,'bless',8).ok,false);assert.equal(validateCommand(s,'hoedown',8).ok,false);
    assert.equal(validateCommand(s,'bless',9).ok,true);assert.equal(validateCommand(s,'hoedown',9).ok,true);
  });
  test('aliases share all restrictions, replacement slot and application revalidation',()=>{
    const scenarios=[['rain',s=>{s.weather={type:'rain',daysLeft:3};}],['drought',s=>{s.weather={type:'drought',daysLeft:3};}],
      ['plague',s=>{s.villagers[0].illnessDays=1;}],['harvest',s=>{s.food=100;}],['teach fire',s=>{s.wood=2;}],
      ['bless',s=>{for(const v of s.villagers){v.health=100;v.happiness=100;}}]];
    for(const [id,mutate] of scenarios){
      const s=createState();s.power=100;mutate(s);
      for(const word of COMMAND_WORDS[id]){const r=queueCommand(s,word);assert.equal(r.ok,false,id);assert.strictEqual(r.state,s);}
    }
    let s=queueCommand(createState(),'cloud wrangle').state;
    s=queueCommand(s,'rain').state;assert.equal(s.queuedCommand,'rain');assert.equal(s.power,50);
    s.power=0;s=stepDay(s);assert.equal(s.lastDay.command.ok,false);assert.equal(s.lastUsed.rain,undefined);
  });
  test('plague switch removes both wordings from help and rejects both',()=>{
    const s=createState({enablePlague:false});assert.ok(!availableCommands(s).includes('plague'));
    for(const word of ['sick hex','plague']){
      const r=queueCommand(s,word);assert.equal(r.ok,false);
      assert.ok(!r.message.includes('sick hex'));assert.ok(!r.message.includes('plague'));
    }
  });
  test('unknown suggestions show name (alias); later words/help parentheses are not accepted',()=>{
    const s=createState(),r=queueCommand(s,'not a command');
    for(const id of availableCommands(s))assert.ok(r.message.includes(commandLabel(id)));
    for(const word of ['teach tinkering','teach bronze','shake off','teach sowing','cloud wrangle (rain)','please hoedown'])assert.equal(queueCommand(s,word).ok,false);
    assert.match(t('help.plague',{duration:3}),/can kill Gourdlings/);
  });
});

describe('Single-file theme, zero assets and offline inlining',()=>{
  test('approved art sizes and exact ground-contact pivots match the artist manifest',async()=>{
    const manifest=JSON.parse(await readFile(new URL('../assets/manifest.json',import.meta.url),'utf8'));
    for(const [key,spec] of Object.entries(THEME.assetSpecs)){
      if(key==='background')continue;
      const original=manifest.assets[spec.file.replace('.svg','')];assert.ok(original,key);
      assert.deepEqual(spec.source,original.logical_size,key);assert.deepEqual(spec.pivot,original.anchor,key);
      assert.deepEqual(spec.origin,original.anchor.map((n,i)=>n/original.logical_size[i]),key);
    }
    const variants=['fiddler','banjo','singer','kicker','washboard','jug'];
    for(let i=0;i<6;i++)assert.ok(villagerTextureCandidates({id:i+1},false,false,0).includes(`gourdling_${variants[i]}_idle_1`));
  });
  test('locked six colors, serif fonts, complete geometry and asset manifest',()=>{
    assert.deepEqual(Object.values(THEME.palette),['#EFE3C8','#2B211C','#3E5B3A','#A8432F','#D2A23A','#C4692C']);
    assert.match(THEME.fonts.body,/serif/);assert.deepEqual(THEME.layout.canvas,{width:900,height:480});
    assert.deepEqual(spriteManifest({...THEME,sprites:{}}),{});
    assert.ok(Object.keys(spriteManifest()).length>=40);
    for(const key of ['villager','villager_child','shelter','campfire_lit','campfire_out','food_spot','wood_spot','rain','drought','sick_icon','unhappy_icon','uneasy_icon','background','shadow','lantern','ground_tile','fence_tile','corn','command_panel'])assert.ok(THEME.assetSpecs[key],key);
    assert.equal(typeof THEME.fallbacks.villager,'function');assert.equal(typeof THEME.css,'string');
  });
  test('variant/state/frame patterns expand separately, child and static maps supported',()=>{
    const theme={...THEME,creatures:{...THEME.creatures,variants:['base','banjo']},sprites:{villager:'assets/gourdling_{variant}_{state}_{frame}.svg',shelter:'assets/shed.svg'}};
    const manifest=spriteManifest(theme);
    assert.equal(Object.keys(manifest).length,10); // 3 variants × 3 frames plus shed.
    assert.equal(manifest.gourdling_banjo_walk_2,'assets/gourdling_banjo_walk_2.svg');
    assert.equal(manifest.gourdling_child_idle_1,'assets/gourdling_child_idle_1.svg');
    assert.equal(manifest.shelter,'assets/shed.svg');
    assert.ok(villagerTextureCandidates({id:1},true,false,0).includes('gourdling_child_idle_1'));
    assert.ok(villagerTextureCandidates({id:1},false,true,300).includes('gourdling_fiddler_walk_2'));
  });
  test('changing names, title and log copy changes display only, not 30-day mechanics',()=>{
    const run=()=>{let s=createState();for(let i=0;i<30;i++)s=stepDay(s);return s;};
    const before=run(),name=THEME.names[0],title=THEME.copy.ui.title,log=THEME.copy.log.start;
    try{
      THEME.names[0]='Theme test Gourdling';THEME.copy.ui.title='A different skin';THEME.copy.log.start='A new introduction';
      const after=run();assert.equal(after.villagers[0].name,'Theme test Gourdling');
      assert.equal(t('ui.title'),'A different skin');
      for(const key of ['day','food','wood','power','fireKnown','birthCounter','milestoneReached'])assert.equal(after[key],before[key]);
      assert.deepEqual(after.villagers.map(({name,...rules})=>rules),before.villagers.map(({name,...rules})=>rules));
    }finally{THEME.names[0]=name;THEME.copy.ui.title=title;THEME.copy.log.start=log;}
  });
  test('present local SVG is embedded; missing file becomes a shape fallback',async()=>{
    const root=await mkdtemp(path.join(os.tmpdir(),'plaything-art-'));
    try{
      await mkdir(path.join(root,'assets'));const svg='<svg xmlns="http://www.w3.org/2000/svg" width="64" height="96"><circle cx="32" cy="48" r="10" fill="#D2A23A"/></svg>';
      await writeFile(path.join(root,'assets/test.svg'),svg);
      const result=await inlineAssets({villager:'assets/test.svg',shelter:'assets/not-here.svg'},root);
      assert.ok(result.sprites.villager.startsWith('data:image/svg+xml;base64,'));
      assert.equal(Buffer.from(result.sprites.villager.split(',')[1],'base64').toString(),svg);
      assert.equal(result.sprites.shelter,null);assert.deepEqual(result.inlined,['villager']);assert.equal(result.missing.length,1);
    }finally{await rm(root,{recursive:true,force:true});}
  });
  test('unsafe/external assets do not compromise a self-contained build',async()=>{
    const root=await mkdtemp(path.join(os.tmpdir(),'plaything-art-'));
    try{
      await mkdir(path.join(root,'assets'));
      await writeFile(path.join(root,'assets/linked.svg'),'<svg><image href="https://example.com/raster.png"/></svg>');
      const result=await inlineAssets({background:'https://example.com/file.svg',shadow:'../outside.svg',shelter:'assets/linked.svg'},root);
      assert.deepEqual(result.sprites,{background:null,shadow:null,shelter:null});assert.equal(result.missing.length,3);
    }finally{await rm(root,{recursive:true,force:true});}
  });
});
