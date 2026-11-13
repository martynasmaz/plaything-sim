import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,stepDay,castText} from '../src/sim.js';
import {HOMESTEAD_RULES} from '../src/config.js';
import {serialize,deserialize} from '../src/save.js';

test('population periods reconcile births, settlers, deaths and exposure across a save',()=>{
  let s=createState(HOMESTEAD_RULES,4),exposure=0;
  const founders=s.villagers.length;
  s.villagers[0].age=s.config.life.death-1;
  for(let i=0;i<23;i++){
    if(i===5)s=castText(s,'spawn people 3').state;
    exposure+=s.villagers.length;s=stepDay(s);
    if(i===12)s=deserialize(serialize(s),HOMESTEAD_RULES);
  }
  const h=s.local.populationHistory,sum=k=>h.reduce((n,p)=>n+p[k],0);
  assert.deepEqual(h.map(p=>[p.first,p.last]),[[1,20],[21,23]]);
  assert.ok(sum('oldAge')>=1);assert.equal(sum('personDays'),exposure);
  assert.equal(sum('deaths'),s.stats.deaths);assert.equal(sum('births'),s.stats.births);
  assert.equal(founders+3+sum('births')-sum('deaths'),s.villagers.length);
  delete s.local.populationHistory;
  assert.equal(stepDay(s).local.populationHistory[0].first,24);
});
