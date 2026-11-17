import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createState} from '../src/sim.js';
import {HOMESTEAD_RULES} from '../src/config.js';

// Exercise the work boundary without exporting scheduler internals to the game.
const sourceRoot=new URL('../src/',import.meta.url);
const source=readFileSync(new URL('sim.js',sourceRoot),'utf8')
  .replace(/from '(\.\/[^']+)'/g,(_,path)=>'from '+JSON.stringify(new URL(path,sourceRoot).href));
const {doWork}=await import('data:text/javascript;base64,'+Buffer.from(source+'\nexport {doWork};').toString('base64'));
function heatingWork(){
  const s=createState(HOMESTEAD_RULES,60),v=s.villagers[0];
  s.huts=[0,0,1];s.hutDetails=[{wall:'brush wall',shape:'dome hut',chimney:true},{wall:'brush wall',shape:'dome hut'},{wall:'mud wall',shape:'round hut'}];
  s.fireKnown=true;s.wood=20;s.local.stock.stone=10;s.local.stock.clay=10;
  s.shelterIdeas=['drystone wall','mud wall','wattle & daub wall','dome hut','gabled roof hut','A-frame hut','round hut','pyramidal hut'];
  v.practice.known.housing=1;v.practice.known['fire tending']=1;
  const report={actions:[],weather:'normal'};
  return {s,v,report};
}

test('heating improvements pay their recipe once and fit an unheated hut in the worker camp',()=>{
  const {s,v,report}=heatingWork(),before=structuredClone(s.hutDetails);
  doWork(s,v,'improve hut',report,undefined,true);
  assert.equal(s.wood,19);assert.equal(s.local.stock.stone,7);assert.equal(s.local.stock.clay,8);
  assert.deepEqual(s.hutDetails,[before[0],{...before[1],chimney:true},before[2]]);
  assert.deepEqual(report.hutSites[v.id],{camp:0,index:1});
  assert.equal(report.actions.length,1);assert.equal(report.actions[0].action,'Build chimney');
  assert.equal(s.shelterIdeas.filter(idea=>idea==='chimney').length,1);
});

test('unaffordable heating leaves materials, fittings and discoveries unchanged',()=>{
  const {s,v,report}=heatingWork();s.local.stock.stone=2;
  const details=structuredClone(s.hutDetails),ideas=s.shelterIdeas.slice();
  doWork(s,v,'improve hut',report,undefined,true);
  assert.equal(s.wood,20);assert.equal(s.local.stock.stone,2);assert.equal(s.local.stock.clay,10);
  assert.deepEqual(s.hutDetails,details);assert.deepEqual(s.shelterIdeas,ideas);
  assert.equal(report.actions.length,0);assert.equal(report.hutSites,undefined);
});

test('reference-mode improvements retain their two-wood cost without homestead recipe charges',()=>{
  const {s,v,report}=heatingWork();s.config.learning=false;
  doWork(s,v,'improve hut',report,undefined,true);
  assert.equal(s.wood,18);assert.equal(s.local.stock.stone,10);assert.equal(s.local.stock.clay,10);
  assert.equal(s.hutDetails[1].chimney,true);assert.equal(report.actions.length,1);
});
