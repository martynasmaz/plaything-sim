import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,stepDay,readyToInvent,buildTributaryBridge} from '../src/sim.js';
import {HOMESTEAD_RULES} from '../src/config.js';
import {stoneFordWork} from '../src/crossings.js';
import {stoneFordRules,stoneFordBuilt,bridgeProtection,bridgeFallChance,fordStudyReady,mainBridgeReady,tributaryBridgeReady} from '../src/river.js';
import {makePracticeProduct,canExperiment,practices} from '../src/practices.js';
import {serialize,deserialize} from '../src/save.js';
import {drawStoneFord} from '../src/settlement-view.js';

function builders(){
  const s=createState({...HOMESTEAD_RULES,traits:false,illness:{chance:0}},60);s.food=100;s.wood=80;s.local.stock.stone=40;
  s.fireKnown=s.fireLit=true;s.local.climate={mm:0};s.local.season='Spring';s.settlementWork=5;
  s.toolkit=['hammer stone','hand axe'];
  for(const v of s.villagers){v.age=60;v.fullness=v.warmth=v.health=v.happiness=v.practice.energy=100;v.outdoors=false;v.lastCompanyDay=s.day;
    Object.assign(v.practice.known,{housing:1,cordage:1});Object.assign(v.practice.skills,{wood:5,stone:3,fibre:3});
    v.practice.watersideVisits=5;v.practice.properties=['fractures','rigid'];v.practice.used.cordage=2;
  }
  return s;
}
const report=()=>({actions:[]}),materials=()=>null;
test('fresh worlds contain no placed stone crossings, timber bridges or crossing knowledge',()=>{
  const s=createState(HOMESTEAD_RULES,60);assert.equal(s.local.fords,undefined);
  assert.equal(s.villagers.some(v=>v.practice.known.fordbuilding||v.practice.known.bridgecraft),false);
  for(const channel of ['main','tributary'])assert.equal(stoneFordBuilt(s,channel),false);
  assert.equal(bridgeProtection(s).built,false);assert.equal(bridgeProtection(s).tributary.built,false);
  let calls=0;drawStoneFord({save(){calls++;}}, {left:[0,0],right:[0,100]},undefined);assert.equal(calls,0);
});
test('observation, stone skill and a paid personal layout precede surveying or construction',()=>{
  const s=builders(),v=s.villagers[0];assert.ok(canExperiment(s,v,practices.fordbuilding));
  assert.equal(stoneFordWork(s,v,report(),{materials}),false);v.practice.known.fordbuilding=1;
  assert.equal(stoneFordWork(s,v,report(),{materials}),false);
  const stone=s.local.stock.stone;assert.ok(makePracticeProduct(s,v,'fordbuilding',report()));
  assert.equal(s.local.stock.stone,stone-1);assert.equal(s.local.fords,undefined,'a personal prototype creates no river structure');
  v.practice.watersideVisits=0;assert.equal(fordStudyReady(s,v),false);assert.equal(stoneFordWork(s,v,report(),{materials}),false);
});
test('each ford needs its own survey and paid placement days; knowledge cannot complete the other river',()=>{
  let s=builders(),v=s.villagers[0];v.practice.known.fordbuilding=1;v.practice.gear['ford layout']=true;
  const before=s.local.stock.stone;
  assert.ok(stoneFordWork(s,v,report(),{materials}));assert.equal(s.local.fords.main.work,0);assert.equal(s.local.stock.stone,before);
  for(let i=1;i<=stoneFordRules.main.work;i++){
    s.day++;v.practice.energy=100;const r=report();assert.ok(stoneFordWork(s,v,r,{materials}));
    assert.equal(s.local.fords.main.work,i);assert.equal(stoneFordBuilt(s,'main'),i===stoneFordRules.main.work);
    // Other workers may survey the other river, but cannot work this same site twice.
    assert.equal(r.actions.filter(a=>a.channel==='main').length,1);
  }
  assert.equal(before-s.local.stock.stone,stoneFordRules.main.stone);assert.equal(stoneFordBuilt(s,'tributary'),false);
  const project=structuredClone(s.local.fords.main);s.villagers.shift();s=deserialize(serialize(s),s.config);assert.deepEqual(s.local.fords.main,project);
});
test('hunger, cold, illness, fatigue, storms and missing stone stop optional ford placement',()=>{
  for(const need of ['food','warmth','illness','energy','storm']){
    const s=builders(),v=s.villagers[0];v.practice.known.fordbuilding=1;v.practice.gear['ford layout']=true;
    if(need==='food'){s.food=0;v.fullness=5;}if(need==='warmth')v.warmth=5;if(need==='illness')v.illnessDays=2;
    if(need==='energy')v.practice.energy=0;if(need==='storm')s.local.climate={mm:40};
    assert.equal(stoneFordWork(s,v,report(),{materials}),false,need);assert.equal(s.local.fords,undefined);
  }
  const s=builders(),v=s.villagers[0];v.practice.known.fordbuilding=1;v.practice.gear['ford layout']=true;
  stoneFordWork(s,v,report(),{materials});s.local.stock.stone=0;
  assert.equal(stoneFordWork(s,v,report(),{materials}),false);assert.equal(s.local.fords.main.work,0);assert.equal(s.local.stock.stone,0);
});
test('natural wading, completed stepping stones and a timber deck have distinct access rules',()=>{
  const s=builders();assert.equal(bridgeFallChance(bridgeProtection(s),false,false),0,'healthy adults can wade natural shallows');
  assert.equal(bridgeFallChance(bridgeProtection(s),false,true),1);
  s.local.fords={main:{work:stoneFordRules.main.work,spent:{stone:stoneFordRules.main.stone},completedDay:1}};
  assert.equal(bridgeFallChance(bridgeProtection(s),false,true),0);assert.equal(bridgeFallChance(bridgeProtection(s),true,false),1);
});
test('new wooden decks require a completed stone crossing on that river and actual joinery knowledge',()=>{
  const s=builders(),v=s.villagers[0];v.practice.known.bridgecraft=1;
  assert.equal(mainBridgeReady(s,v),false);assert.equal(tributaryBridgeReady(s,v),false);assert.equal(readyToInvent(s,'footbridge'),false);
  s.local.fords={main:{work:stoneFordRules.main.work,spent:{stone:stoneFordRules.main.stone},completedDay:0}};
  assert.ok(mainBridgeReady(s,v));assert.equal(tributaryBridgeReady(s,v),false);assert.equal(buildTributaryBridge(s,v,report()),false);
  delete v.practice.known.bridgecraft;assert.equal(mainBridgeReady(s,v),false);
});
test('old discoveries and partially built timber decks survive loading without conjuring stones',()=>{
  const s=builders(),v=s.villagers[0];v.practice.known.bridgecraft=1;s.settlementWork=8;
  delete s.local.crossingsVersion;delete s.local.legacyCrossingWork;
  const loaded=deserialize(serialize(s),s.config);assert.equal(loaded.settlementWork,8);assert.equal(loaded.local.fords,undefined);
  assert.ok(loaded.villagers[0].practice.known.bridgecraft);assert.ok(mainBridgeReady(loaded,loaded.villagers[0]));
});
test('an old partial tributary deck can continue even without a main deck or invented stone ford',()=>{
  const s=builders(),v=s.villagers[0];v.practice.known.bridgecraft=1;s.settlementWork=5;
  s.local.tributaryBridge={work:2,spent:{wood:2,stone:1,fibre:1},site:[500,154]};
  delete s.local.crossingsVersion;delete s.local.legacyCrossingWork;
  const loaded=deserialize(serialize(s),s.config);assert.equal(loaded.local.fords,undefined);
  assert.ok(tributaryBridgeReady(loaded,loaded.villagers[0]));assert.ok(buildTributaryBridge(loaded,loaded.villagers[0],report()));
  assert.equal(loaded.local.tributaryBridge.work,3);assert.equal(loaded.settlementWork,5);
});
