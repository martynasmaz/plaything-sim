import test from 'node:test';
import assert from 'node:assert/strict';
import {compactWorkSpot} from '../src/settlement-layout.js';
import {chooseQuietHealerSite,healerNeighbors,crowdedHealerSite} from '../src/healer-home.js';
import {campSites,worldTrees} from '../src/practices.js';
import {createState} from '../src/sim.js';
import {HOMESTEAD_RULES} from '../src/config.js';

test('a small working group stays close without sharing the same standing point',()=>{
  const anchor=[100,100],positions=[];
  for(let id=1;id<=8;id++)positions.push(compactWorkSpot(anchor,positions,id));
  for(const p of positions){assert.ok(Math.abs(p[0]-100)<=48);assert.ok(Math.abs(p[1]-100)<=41);}
  for(let i=0;i<positions.length;i++)for(let j=0;j<i;j++)
    assert.ok(Math.hypot((positions[i][0]-positions[j][0])/22,(positions[i][1]-positions[j][1])/28)>=1);
});

test('standing places respect the bank and hearth instead of pushing villagers into hazards',()=>{
  const anchor=[0,0],positions=[];
  const safe=([x,y])=>y<=0&&Math.hypot(x-12,y-8)>=18;
  for(let id=1;id<=6;id++)positions.push(compactWorkSpot(anchor,positions,id,safe));
  assert.ok(positions.every(safe));
});

test('standing-place selection is deterministic and leaves other walkers untouched',()=>{
  const occupied=[[0,0],[23,0]],before=structuredClone(occupied);
  assert.deepEqual(compactWorkSpot([0,0],occupied,12),compactWorkSpot([0,0],occupied,12));
  assert.deepEqual(occupied,before);
});
test('healer clearings leave room beyond household huts while staying a short walk from camp',()=>{
  for(let seed=0;seed<6;seed++){
    const s=createState(HOMESTEAD_RULES,seed),neighbors=healerNeighbors(s,campSites,true),trees=worldTrees(s);
    for(const camp of campSites){
      const site=chooseQuietHealerSite(camp,neighbors,trees);assert.ok(site);
      const distance=Math.hypot(site[0]-camp[0],site[1]-camp[1]);assert.ok(distance>=179&&distance<=211);
      assert.equal(crowdedHealerSite(site,neighbors),false);
      assert.deepEqual(chooseQuietHealerSite(camp,neighbors,trees),site);
    }
  }
});
