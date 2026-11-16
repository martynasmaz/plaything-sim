import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {lithuanianNames} from '../src/names.js';
import {SCENARIO,validateScenario} from '../src/scenario.js';
import {storageCapacity} from '../src/storage.js';
import {createState,assignIdentity} from '../src/sim.js';
import {HOMESTEAD_RULES} from '../src/config.js';
import {serialize,deserialize} from '../src/save.js';
test('name pools contain every annual top-ten name for 1995–2020 without duplicate weighting',()=>{
  const data=JSON.parse(readFileSync(new URL('../reports/lithuanian-name-rankings-1995-2020.json',import.meta.url)));
  assert.equal(Object.keys(data.annual).length,26);
  for(const sex of ['male','female']){
    assert.ok(lithuanianNames[sex].length>20);assert.equal(new Set(lithuanianNames[sex]).size,lithuanianNames[sex].length);
    assert.deepEqual(new Set(lithuanianNames[sex]),new Set(Object.values(data.annual).flatMap(y=>y[sex].map(r=>r.name))));
  }
});
test('saved people retain names while new arrivals use the expanded pool',()=>{
  const s=createState(HOMESTEAD_RULES,60),v=s.villagers[0];v.name='Paulius';assignIdentity(s,v);assert.equal(v.name,'Paulius');
  assert.equal(deserialize(serialize(s),s.config).villagers[0].name,'Paulius');
  const next={id:100};assignIdentity(s,next);assert.ok(lithuanianNames[next.gender].includes(next.name));
});
test('storage settings change paid buildings capacity, preserve stock and reject invalid limits',()=>{
  const old={...SCENARIO.storage},store={built:true,racks:1,tradeJars:1,saved:100,granary:{work:8,bins:2}};
  try{
    assert.equal(storageCapacity(store),24+12+96+2*48);
    SCENARIO.storage.granaryCapacity=192;SCENARIO.storage.granaryBinCapacity=96;
    assert.equal(storageCapacity(store),24+12+192+2*96);assert.equal(store.saved,100);
  }finally{Object.assign(SCENARIO.storage,old);}
  const bad=structuredClone(SCENARIO);bad.storage.granaryCapacity=0;
  assert.ok(validateScenario(bad).some(e=>e.includes('granaryCapacity')));
});
