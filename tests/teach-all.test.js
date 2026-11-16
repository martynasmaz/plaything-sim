import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,castText,queueCommand,stepDay,validateCommand,availableCommands} from '../src/sim.js';
import {HOMESTEAD_RULES} from '../src/config.js';
import {practices,initPractice} from '../src/practices.js';
import {resolveCommand,matchCommand} from '../src/commands.js';
import {magicEnabled} from '../src/magic.js';
import {phonePowers,completedOneTime} from '../src/phone-ui.js';
import {serialize,deserialize} from '../src/save.js';
const fresh=()=>createState(HOMESTEAD_RULES,4);
test('teach all resolves before the other teaching keywords and is homestead-only',()=>{
  for(const text of ['teach all','TEACH EVERYTHING','  Teach   All  '])assert.equal(resolveCommand(text),'teach all');
  assert.equal(matchCommand('teach all fire and farming'),'teach all');
  assert.ok(availableCommands(fresh()).includes('teach all'));assert.equal(availableCommands(createState()).includes('teach all'),false);
});
test('teach all gives every living person all nonmagical practices immediately without paid progress or equipment',()=>{
  const s=fresh();s.villagers[0].age=0;s.villagers[1].practice.known.drying=7;s.villagers[2].practice.known.cordage=0;s.villagers[2].practice.progress.cordage=1.5;
  const before=structuredClone(s),result=castText(s,'teach all');assert.ok(result.ok);const next=result.state;
  for(const v of next.villagers){
    for(const r of Object.values(practices))if(!r.magic)assert.ok(v.practice.known[r.id],r.id);
    assert.deepEqual(v.practice.gear,{});assert.deepEqual(v.practice.skills,{});
    assert.equal(v.herbalist,before.villagers.find(p=>p.id===v.id).herbalist);
  }
  assert.equal(next.villagers[1].practice.known.drying,7);assert.equal(next.villagers[2].practice.progress.cordage,undefined);
  for(const key of ['food','wood','settlementWork','huts','hutProject','shed'])assert.deepEqual(next[key],before[key],key);
  for(const key of ['stock','healerHome','campStores','collection','husbandry','fords','tributaryBridge'])assert.deepEqual(next.local[key],before.local[key],key);
  assert.equal(next.fireKnown,true);assert.equal(next.fireLit,false);assert.equal(next.farming.known,true);assert.ok(next.farming.plots.every(p=>p===null));
  assert.deepEqual(s,before,'the input world must remain unchanged');
});
test('teaching preserves planted crops, physical stations and partial structures',()=>{
  const s=fresh();s.farming.known=true;s.farming.plots=[4,null];s.farming.crops={0:'wheat'};s.farming.querns=[{id:2,camp:0,site:[220,210]}];
  s.hutProject={camp:0,index:0,work:2,site:[260,230]};const before=structuredClone(s),next=castText(s,'teach everything').state;
  assert.deepEqual(next.farming,before.farming);assert.deepEqual(next.hutProject,before.hutProject);assert.deepEqual(next.local.stock,before.local.stock);
});
test('teach all cannot awaken magic; after magic it also teaches magical practices',()=>{
  let s=castText(fresh(),'teach all').state;assert.equal(magicEnabled(s),false);
  for(const v of s.villagers)for(const r of Object.values(practices).filter(r=>r.magic))assert.equal(v.practice.known[r.id],undefined,r.id);
  s=castText(s,'magic').state;s=castText(s,'teach all').state;
  for(const v of s.villagers)for(const r of Object.values(practices))assert.ok(v.practice.known[r.id],r.id);
  assert.ok(s.villagers.every(v=>Object.keys(v.practice.gear).length===0));
});
test('teach all is repeatable, queued correctly, saved, and available from phone powers',()=>{
  let s=fresh();s=queueCommand(s,'teach everything').state;const loaded=deserialize(serialize(s),s.config);
  assert.equal(serialize(stepDay(s)),serialize(stepDay(loaded)));s=stepDay(s);
  const first=structuredClone(s.local.first);assert.ok(validateCommand(s,'teach all').ok);s=castText(s,'teach all').state;assert.deepEqual(s.local.first,first);
  assert.ok(phonePowers.some(p=>p.command==='teach all'));assert.equal(completedOneTime(s,'teach all'),false);
  s.ended=true;const failed=castText(s,'teach all');assert.equal(failed.ok,false);assert.strictEqual(failed.state,s);
});
test('future God arrivals inherit the taught archive while later newborns start with basic knowledge',()=>{
  const s=castText(fresh(),'teach all').state,spawned=castText(s,'spawn people').state;
  for(const v of spawned.villagers.filter(v=>v.id>=7))for(const r of Object.values(practices))if(!r.magic)assert.ok(v.practice.known[r.id],r.id);
  const newborn={id:99,age:0};initPractice(s,newborn);assert.equal(newborn.practice.known.breadmaking,undefined);
});
