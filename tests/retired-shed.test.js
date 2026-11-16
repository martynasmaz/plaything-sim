import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,encyclopediaCatalog,buildPlankShed,populationCap} from '../src/sim.js';
import {HOMESTEAD_RULES} from '../src/config.js';
import {worldTrees} from '../src/practices.js';
import {serialize,deserialize} from '../src/save.js';

test('new homesteads omit the red shed option while saved buildings and paid projects retain capacity',()=>{
  let s=createState(HOMESTEAD_RULES,60);assert.equal(encyclopediaCatalog(s).some(e=>e.name==='plank shed'),false);
  s.farming.known=true;s.config.shed.population=2;s.food=100;s.wood=80;s.fireKnown=s.fireLit=true;
  s.local.stock.fibre=10;s.local.stumps=Object.fromEntries(worldTrees(s).map((_,i)=>[i,s.day]));
  const v=s.villagers[0];v.fullness=v.warmth=v.health=v.happiness=v.practice.energy=100;
  Object.assign(v.practice.known,{housing:1,cordage:1});s.toolkit=['hand axe'];
  assert.equal(buildPlankShed(s,v,{actions:[]}),false);
  const cap=populationCap(s),wood=s.wood,total=s.config.shed.wood;
  s.shed.project={site:[330,120],camp:0,work:4,spent:{wood:Math.ceil(total*.8),fibre:2},clearedTrees:[],founderId:v.id,startedDay:s.day-5};
  for(let i=0;i<30&&!s.shed.built;i++){s.day++;v.practice.energy=100;assert.equal(buildPlankShed(s,v,{actions:[]}),true);}
  assert.equal(s.shed.built,true);assert.equal(s.wood,wood-(total-Math.ceil(total*.8)));
  assert.equal(populationCap(s),cap+s.config.shed.places);
  s=deserialize(serialize(s),s.config);assert.equal(s.shed.built,true);assert.equal(populationCap(s),cap+s.config.shed.places);
  assert.ok(encyclopediaCatalog(s).some(e=>e.name==='plank shed'));
});
