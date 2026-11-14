import test from 'node:test';
import assert from 'node:assert/strict';
import {createState} from '../src/sim.js';
import {HOMESTEAD_RULES} from '../src/config.js';
import {worldTrees,standingTree,fellTree,campSites,nerisX,preserveBuiltClearings} from '../src/practices.js';
import {riverHabitat,supplementaryWoodland} from '../src/ecology.js';
import {walkRiver} from '../src/clearing.js';
import {serialize,deserialize} from '../src/save.js';

test('woodland is denser, mixed, deterministic, and keeps added trees out of channels and camp centers',()=>{
  const s=createState(HOMESTEAD_RULES,4),trees=worldTrees(s),extra=trees.slice(trees.legacyCount);
  assert.ok(extra.length>1000);assert.ok(trees.legacyCount>0);
  assert.deepEqual(supplementaryWoodland(s.seed,campSites),extra);
  assert.equal(new Set(extra.map(t=>t[3])).size,5);
  for(const [x,y] of extra){assert.equal(riverHabitat(x,y).water,false);assert.ok(campSites.every(c=>Math.hypot(x-c[0],y-c[1])>=54));}
});
test('existing tree coordinates and felled tree identities survive save/load and another world using the forest cache',()=>{
  const s=createState(HOMESTEAD_RULES,4),tree=fellTree(s,s.villagers[0]),position=[...worldTrees(s)[tree]],count=worldTrees(s).legacyCount;
  assert.equal(standingTree(s,tree),false);worldTrees(createState(HOMESTEAD_RULES,5));
  const back=deserialize(serialize(s),HOMESTEAD_RULES);
  assert.equal(worldTrees(back).legacyCount,count);assert.deepEqual(worldTrees(back)[tree],position);assert.equal(standingTree(back,tree),false);
});
test('new projects do not hide trees; loading old construction preserves its ground without renumbering trees',()=>{
  const s=createState(HOMESTEAD_RULES,4),trees=worldTrees(s),id=trees.legacyCount,point=[...trees[id]];
  assert.equal(standingTree(s,id),true);s.local.healerHome={home:point.slice(0,2),work:1};
  assert.equal(standingTree(s,id),true,'construction cannot cosmetically remove a tree');
  delete s.local.siteClearingVersion;preserveBuiltClearings(s);
  assert.equal(standingTree(s,id),false);assert.equal(s.local.stumps[id],s.day);assert.deepEqual(worldTrees(s)[id],point);
  assert.equal(worldTrees(s).legacyCount,id);
});
test('wading through the game ford is slower than bridge or ice travel and does not change simulation needs',()=>{
  const width=1000,height=640,ford=width*.43;
  const center=height*(.51+.078*Math.sin(ford/width*7+.4)+.037*Math.sin(ford/width*13));
  const person={warmth:100,illnessDays:0},before=structuredClone(person);
  const walker=()=>({x:ford,y:center+20,travel:0,leg:0});
  const wade=walker(),bridge=walker(),ice=walker(),goal=[ford,center-90];
  walkRiver(wade,goal,10,width,height,false,person,false,false,null,false,3000,false);
  walkRiver(bridge,goal,10,width,height,false,person,false,true,null,false,3000,false);
  walkRiver(ice,goal,10,width,height,false,person,false,false,null,true,3000,false);
  assert.equal(wade.travel,5.5);assert.equal(bridge.travel,10);assert.equal(ice.travel,10);assert.deepEqual(person,before);
});
test('the northern tributary crossing also uses wading speed',()=>{
  const width=1000,height=640,y=height*.24,x=width*nerisX(.24),p={x,y,travel:0,leg:0};
  walkRiver(p,[x+80,y],10,width,height,false,{warmth:100,illnessDays:0},false,false,null,false,3000,true);
  assert.equal(p.travel,5.5);
});
