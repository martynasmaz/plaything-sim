import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,stepDay,findHomesteadHealer} from '../src/sim.js';
import {HOMESTEAD_RULES} from '../src/config.js';
import {worldTrees,standingTree,hutBuildingSite,buildingSiteTree,beginSettlementDay,campSites,canFellBuildingTree} from '../src/practices.js';
import {inBuildingPatch,treeKeptClear} from '../src/ecology.js';
import {serialize,deserialize} from '../src/save.js';

const rules={...HOMESTEAD_RULES,traits:false,illness:{chance:0},
  learning:{...HOMESTEAD_RULES.learning,experimentChance:0,seasonLength:1000},
  weather:{chances:{normal:100,rain:0,drought:0,cold:0}}};
function builder(healer=false){
  let s=createState(rules,4),v=s.villagers[0];s.villagers=[v];
  s.food=100;s.wood=40;s.settlementWork=5;
  v.traits=['Loner'];v.fullness=v.warmth=v.health=v.happiness=v.practice.energy=100;
  v.practice.curiosity=0;v.practice.gear['hafted tool']=1;
  // Existing equipment keeps unrelated invention and trap-making out of
  // these construction fixtures; cutting still uses the real axe checks.
  v.gear='spear';v.fishTrap=true;
  s.toolkit=['hammer stone','stone blades','digging stick','hand axe','mallet & chisel'];
  s.fireTools=['fire stick','bow drill','blowpipe','wooden tongs','burn bowl'];
  if(healer){
    Object.assign(v.practice.known,{herbalism:2,cordage:1,housing:1});
    Object.assign(v.practice.skills,{berries:4,wood:4,fibre:3});
    Object.assign(s.local.stock,{fibre:20,stone:20,herbs:12});
    v.practice.careExperience=2;v.remedyDoses=2;
    findHomesteadHealer(s);s=stepDay(s);
  }else s.hutProject={camp:0,work:0};
  return s;
}
test('a house builder cuts one obstructing tree in a paid day before spending construction materials',()=>{
  const s=builder(),v=s.villagers[0],site=hutBuildingSite(s,v).site;
  const tree=buildingSiteTree(s,site),before=worldTrees(s).map(t=>[...t]);
  assert.notEqual(tree,null);
  const next=stepDay(s),cut=next.lastDay.actions.find(a=>a.action==='Clear hut site');
  assert.ok(cut);assert.equal(next.hutProject.work,0);assert.equal(next.hutProject.clearingWork,1);
  assert.equal(Object.keys(next.local.stumps).length,1);assert.equal(next.lastDay.felledTrees[v.id],tree);
  assert.equal(next.wood,s.wood+next.lastDay.gatheredWood,'no construction timber spent');
  assert.ok(next.villagers[0].practice.energy<v.practice.energy,'clearing costs energy');
  assert.equal(next.villagers[0].axeWear,1);assert.ok(cut.gained>0);
  assert.deepEqual(worldTrees(next),Object.assign(before,{legacyCount:worldTrees(s).legacyCount}));
  for(let id=0;id<before.length;id++)if(id!==tree)assert.equal(standingTree(next,id),true);
});
test('ordinary houses and herb huts finish their small patch, then build, leaving surrounding trees standing',()=>{
  for(const healer of [false,true]){
    let s=builder(healer),v=s.villagers[0];
    const site=healer?s.local.healerHome.home:hutBuildingSite(s,v).site,kind=healer?'healer':'hut';
    const blockers=worldTrees(s).flatMap((tree,id)=>inBuildingPatch(tree,site,kind)?[id]:[]);
    assert.ok(blockers.length>0&&blockers.length<10);
    // Retain one blocker so this checks the clearing-to-building transition
    // without unrelated tool repair or provisioning decisions.
    s.local.stumps=Object.fromEntries(blockers.slice(1).map(id=>[id,s.day]));
    const outside=worldTrees(s).findIndex(t=>!inBuildingPatch(t,site,kind)&&Math.hypot(t[0]-site[0],t[1]-site[1])<65);
    assert.ok(outside>=0);
    s=stepDay(s);assert.equal(s.lastDay.actions[0].action,healer?'Clear herb site':'Clear hut site');
    const project=healer?s.local.healerHome:s.hutProject;
    assert.equal(project.work,0);assert.deepEqual(project.clearedTrees,[blockers[0]]);
    assert.equal(standingTree(s,outside),true);
    // Another normal need or a learned maintenance task may take a day.
    for(let day=0;day<10&&(healer?s.local.healerHome:s.hutProject)?.work===0;day++)s=stepDay(s);
    assert.ok((healer?s.local.healerHome:s.hutProject).work>0,JSON.stringify(s.lastDay.actions));
    assert.equal(standingTree(s,outside),true);
  }
});
test('clearing waits for a usable cutting tool and never substitutes bare hands or a worn axe',()=>{
  for(const healer of [false,true])for(const worn of [false,true]){
    let s=builder(healer),v=s.villagers[0];
    if(worn){v.axeWear=4;s.local.stock.stone=0;}else{delete v.practice.gear['hafted tool'];s.toolkit=s.toolkit.filter(t=>t!=='hand axe');}
    assert.equal(canFellBuildingTree(s,v),false);
    const site=healer?s.local.healerHome.home:hutBuildingSite(s,v).site,id=buildingSiteTree(s,site,healer?'healer':'hut');
    s=stepDay(s);assert.equal(standingTree(s,id),true);
    assert.equal((healer?s.local.healerHome:s.hutProject).work,0);
    assert.equal(s.lastDay.actions.some(a=>a.action.startsWith('Clear ')),false);
  }
});
test('hunger, cold and exhaustion interrupt site clearing instead of locking a villager onto a project',()=>{
  for(const healer of [false,true])for(const need of ['food','warmth','energy']){
    let s=builder(healer),v=s.villagers[0];
    if(need==='food'){s.food=0;v.fullness=5;}
    if(need==='warmth')v.warmth=5;
    if(need==='energy')v.practice.energy=0;
    s=stepDay(s);
    assert.equal(s.lastDay.actions.some(a=>a.action.startsWith('Clear ')),false,`${healer}/${need}`);
    assert.equal((healer?s.local.healerHome:s.hutProject).work,0);
  }
});
test('a qualified neighbor with an axe can help a healer who lacks a cutting tool',()=>{
  let s=builder(true),owner=s.villagers[0];
  const helper=structuredClone(owner);helper.id=2;helper.name='Builder';delete helper.herbalist;
  helper.household=2;helper.practice.lessonToday=null;
  delete owner.practice.gear['hafted tool'];s.toolkit=s.toolkit.filter(t=>t!=='hand axe');
  s.villagers.push(helper);
  s=stepDay(s);
  assert.equal(s.lastDay.actions.find(a=>a.id===helper.id).action,'Clear herb site');
  assert.match(s.lastDay.actions.find(a=>a.id===owner.id).action,/^Help Builder/);
  assert.equal(s.local.healerHome.clearingWork,1);assert.equal(s.local.healerHome.work,0);
  assert.equal(s.villagers.find(v=>v.id===helper.id).axeWear,1);
});
test('physical clearings survive death and saving; regrowth resumes when an unbuilt project is abandoned',()=>{
  for(const healer of [false,true]){
    let s=stepDay(builder(healer));const id=s.lastDay.felledTrees[s.villagers[0].id];
    const project=healer?s.local.healerHome:s.hutProject,site=healer?project.home:hutBuildingSite(s,s.villagers[0]).site;
    s.villagers=[];
    s=deserialize(serialize(s),rules);assert.equal(standingTree(s,id),false);
    assert.equal(treeKeptClear(s,worldTrees(s)[id],campSites),true);
    s.day+=40;beginSettlementDay(s);assert.equal(standingTree(s,id),false);
    if(healer)delete s.local.healerHome;else s.hutProject=null;
    beginSettlementDay(s);assert.equal(standingTree(s,id),false,'abandonment does not instantly regrow a mature tree');
    s.day+=30;beginSettlementDay(s);assert.equal(standingTree(s,id),true);
    assert.ok(inBuildingPatch(worldTrees(s)[id],site,healer?'healer':'hut'));
  }
});
test('completed houses keep their footprint clear after the temporary construction project is gone',()=>{
  let s=builder();const site=hutBuildingSite(s,s.villagers[0]).site;
  const blockers=worldTrees(s).flatMap((tree,id)=>inBuildingPatch(tree,site)?[id]:[]);
  s.local.stumps=Object.fromEntries(blockers.map(id=>[id,s.day]));
  for(let i=0;i<10&&s.hutProject;i++)s=stepDay(s);
  assert.equal(s.hutProject,null);assert.deepEqual(s.huts,[0]);
  s.day+=40;beginSettlementDay(s);
  assert.ok(blockers.every(id=>!standingTree(s,id)));
});
test('rebuilding works at the existing ruined house instead of clearing a new plot in the worker’s camp',()=>{
  let s=builder();s.hutProject=null;s.huts=[0,1];s.hutDetails=[{}, {ruined:true}];
  const target=hutBuildingSite(s,s.villagers[0]);assert.equal(target.camp,1);assert.equal(target.index,0);
  s.local.stumps=Object.fromEntries(worldTrees(s).flatMap((tree,id)=>inBuildingPatch(tree,target.site)?[[id,s.day]]:[]));
  s=stepDay(s);
  assert.deepEqual(s.lastDay.hutSites[s.villagers[0].id],{camp:1,index:0});
  for(let i=0;i<10&&s.hutDetails[1].ruined;i++)s=stepDay(s);
  assert.equal(s.hutDetails[1].ruined,false);assert.deepEqual(s.huts,[0,1]);
});
