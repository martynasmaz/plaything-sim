import test from 'node:test';
import assert from 'node:assert/strict';
import {paintWorker} from '../src/villager-appearance.js';
import {CONFIG,HOMESTEAD_RULES} from '../src/config.js';

function appearance(age,life=HOMESTEAD_RULES.life){
  const scales=[],hair=[],v={id:1,age,gender:'male',tribe:0};let ellipse;
  const g=new Proxy({scale:(...args)=>scales.push(args),ellipse:(...args)=>ellipse=args,
    fill(){if(ellipse?.[0]===-.8&&ellipse[1]===-34.2)hair.push(this.fillStyle);ellipse=null;}},
    {get:(target,key)=>key in target?target[key]:()=>{}});
  const before=JSON.stringify(v);
  paintWorker(g,v,0,0,age<life.adult,false,false,0,'Rest',0,[],true,life);
  assert.equal(JSON.stringify(v),before,'drawing must not alter age or other villager data');
  return {scale:scales[0][0],hair:hair[0]};
}

test('young adult founders keep their hair colour until the configured elder age',()=>{
  const adult=appearance(20).hair;
  assert.notEqual(adult,'#a89d86');
  for(const age of [...HOMESTEAD_RULES.start.ages,240,300,4799])assert.equal(appearance(age).hair,adult);
  assert.equal(appearance(4800).hair,'#a89d86');assert.equal(appearance(6400).hair,'#a89d86');
});

test('old and custom lifespans use their own elder thresholds for drawings',()=>{
  for(const life of [CONFIG.life,{adult:80,elder:800,death:1000}]){
    assert.notEqual(appearance(life.elder-1,life).hair,'#a89d86');
    assert.equal(appearance(life.elder,life).hair,'#a89d86');
  }
});

test('children grow towards their own adult size without a large birthday jump',()=>{
  for(const adult of [20,80,240]){
    const life={adult,elder:4800},ages=[0,adult/4,adult/2,adult-1,adult];
    const sizes=ages.map(age=>appearance(age,life).scale);
    assert.equal(sizes[0],.60);
    assert.ok(sizes.every((size,i)=>i===0||size>sizes[i-1]));
    assert.ok(sizes.at(-1)-sizes.at(-2)<.03,'maturity should not suddenly inflate the character');
    assert.equal(appearance(adult+100,life).scale,sizes.at(-1),'adult height remains stable');
  }
});
