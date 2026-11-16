import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,localShelterPlaces,stepDay} from '../src/sim.js';
import {HOMESTEAD_RULES} from '../src/config.js';
import {advanceLandUse,buildingPatches,landUseKey,landUseRules,treeKeptClear,inBuildingPatch} from '../src/ecology.js';
import {campSites,worldTrees,beginSettlementDay,standingTree,hutBuildingSite} from '../src/practices.js';
import {serialize,deserialize} from '../src/save.js';
function home(){
  const s=createState(HOMESTEAD_RULES,60);s.huts=[0];s.hutDetails=[{site:[340,180],shape:'dome hut'}];
  const patch=buildingPatches(s,campSites).find(p=>p.kind==='hut');advanceLandUse(s,campSites);
  return {s,patch,wait:landUseRules.abandonedAfterSeasons*s.config.learning.seasonLength,ruin:landUseRules.ruinAfterSeasons*s.config.learning.seasonLength};
}

test('actual field work is saved on its workday and cannot shift the use date after reload',()=>{
  const s=createState(HOMESTEAD_RULES,60),site=[635,548];s.day=100;s.farming.sites={4:site};s.farming.plots[4]=null;
  advanceLandUse(s,campSites);s.local.landUse['field:'+site.join(',')].lastUsedDay=90;
  const activity={day:100,actions:[{id:1,action:'Harvest',site}]};advanceLandUse(s,campSites,activity);
  assert.equal(s.local.landUse['field:'+site.join(',')].lastUsedDay,100);
  s.lastDay=activity;
  const loaded=deserialize(serialize(s),s.config);assert.equal(serialize(stepDay(s)),serialize(stepDay(loaded)));
});
test('occupied houses suppress stump regrowth in their footprint and a modest extra margin',()=>{
  const {s,patch,ruin}=home(),near=[patch.site[0]+30,patch.site[1]],far=[patch.site[0]+60,patch.site[1]];
  assert.equal(inBuildingPatch(near,patch.site),false);assert.equal(treeKeptClear(s,near,campSites),true);
  assert.equal(treeKeptClear(s,far,campSites),false);
  s.day=ruin+100;advanceLandUse(s,campSites);assert.equal(s.hutDetails[0].ruined,undefined);
  assert.equal(treeKeptClear(s,near,campSites),true);
});
test('abandonment takes several seasons, persists through saves, then permits gradual forest return and ruin',()=>{
  let {s,patch,wait,ruin}=home();s.villagers.forEach(v=>v.tribe=1);
  s.day=wait-1;advanceLandUse(s,campSites);assert.equal(treeKeptClear(s,patch.site,campSites),true);
  s.day=wait;advanceLandUse(s,campSites);assert.equal(treeKeptClear(s,[patch.site[0]+30,patch.site[1]],campSites),false);
  assert.equal(treeKeptClear(s,patch.site,campSites),true,'a standing roof still occupies the footprint');
  assert.equal(s.local.landUse[landUseKey(patch)].weathering,1);assert.equal(s.hutDetails[0].ruined,undefined);
  s=deserialize(serialize(s),s.config);assert.equal(s.local.landUse[landUseKey(patch)].abandoned,true);
  s.day=ruin;advanceLandUse(s,campSites);assert.equal(s.hutDetails[0].ruined,true);
  assert.equal(treeKeptClear(s,patch.site,campSites),false);
  assert.equal(localShelterPlaces(s,0),s.config.limits.shelter);assert.equal(s.huts.length,1);
  assert.equal(hutBuildingSite(s,s.villagers[0]).repairSlot,-1,'another camp does not repeatedly rebuild an unoccupied decayed hut');
  s.villagers[0].tribe=0;assert.equal(hutBuildingSite(s,s.villagers[0]).repairSlot,0,'returning settlers can rebuild the physical ruin');
});
test('returning occupants stop further encroachment but do not restore lost building work',()=>{
  const {s,patch,wait,ruin}=home();s.villagers.forEach(v=>v.tribe=1);s.day=wait;advanceLandUse(s,campSites);
  s.villagers[0].tribe=0;s.day++;advanceLandUse(s,campSites);
  assert.equal(treeKeptClear(s,patch.site,campSites),true);assert.equal(s.local.landUse[landUseKey(patch)].weathering,1);
  s.villagers[0].tribe=1;s.day+=ruin;advanceLandUse(s,campSites);assert.equal(s.hutDetails[0].ruined,true);
  s.villagers[0].tribe=0;s.day++;advanceLandUse(s,campSites);assert.equal(s.hutDetails[0].ruined,true);
});
test('storage remains maintained while its community lives, but a dead healer does not maintain a woodland hut',()=>{
  const {s,wait}=home();s.local.campStores[0]={saved:0,rack:0,built:true,rackSites:[[450,180]]};
  s.local.healerHome={home:[380,100],ownerId:999,work:6,rackWork:0,markerWork:0,stock:{leaves:0,doses:0},spent:{}};
  advanceLandUse(s,campSites);s.day=wait+10;advanceLandUse(s,campSites);
  assert.equal(treeKeptClear(s,[450,180],campSites),true);assert.equal(treeKeptClear(s,[418,100],campSites),false);
  assert.equal(s.local.healerHome.work,6,'abandonment never deletes the physical herb hut');
});
test('trees at an abandoned clearing restart their growth clock rather than instantly becoming mature',()=>{
  const s=createState(HOMESTEAD_RULES,60),id=0,site=worldTrees(s)[id].slice(0,2);
  s.huts=[0];s.hutDetails=[{site,shape:'dome hut'}];s.local.stumps={[id]:0};
  beginSettlementDay(s);s.villagers.forEach(v=>v.tribe=1);
  s.day=landUseRules.ruinAfterSeasons*s.config.learning.seasonLength-1;beginSettlementDay(s);
  s.day++;beginSettlementDay(s);assert.equal(standingTree(s,id),false);
  s.day+=landUseRules.regrowthDays;beginSettlementDay(s);assert.equal(standingTree(s,id),true);
  assert.equal(s.huts.length,1);
});
