import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,stepDay,castText,advanceTime,shelterPlaces} from '../src/sim.js';
import {HOMESTEAD_RULES} from '../src/config.js';
import {beginSettlementDay,canExperiment,practiceWork,planLessons,practices,takeDeposit} from '../src/practices.js';
const fresh=()=>createState(HOMESTEAD_RULES,4);
test('basket experiments require experience, knowledge, usable materials, and spare energy',()=>{
  const s=fresh(),v=s.villagers[0],p=v.practice,r=practices.baskets;
  p.properties=['flexible'];p.lastSkill='berries';p.limitedTrips=2;
  assert.equal(canExperiment(s,v,r),false);
  p.known.cordage=1;s.local.stock.fibre=1;assert.equal(canExperiment(s,v,r),false);
  s.local.stock.fibre=12;assert(canExperiment(s,v,r));
  for(const [field,n] of [['fullness',10],['energy',10]]){
    const owner=field==='energy'?p:v,old=owner[field];owner[field]=n;assert(!canExperiment(s,v,r));owner[field]=old;
  }
  p.gear.cord=true;p.used.cordage=1;
  practiceWork(s,v,1);assert(p.progress.baskets>0);assert(!p.gear.basket);
  for(let i=0;i<10&&!p.known.baskets;i++)practiceWork(s,v,1);
  assert(p.known.baskets);assert(!p.gear.basket);assert(!s.villagers[1].practice.known.baskets);
  const before=s.local.stock.fibre;practiceWork(s,v,1);assert(p.gear.basket);assert.equal(s.local.stock.fibre,before-2);
});
test('teaching takes repeated joint workdays and actual contact',()=>{
  const s=fresh();s.day=3;
  const [teacher,pupil]=s.villagers;s.villagers=[teacher,pupil];
  teacher.practice.known.cordage=2;teacher.practice.used.cordage=1;
  teacher.practice.site='wood';pupil.practice.site='clay';beginSettlementDay(s);
  planLessons(s,s.villagers);assert.equal(pupil.practice.lessonToday,null);
  pupil.practice.site=teacher.practice.site='camp';
  for(let i=0;i<2;i++){beginSettlementDay(s);planLessons(s,s.villagers);practiceWork(s,teacher,1);practiceWork(s,pupil,1);if(!i)assert(!pupil.practice.known.cordage);}
  assert.equal(pupil.practice.known.cordage,1);assert(!pupil.practice.used.cordage);
});
test('deposits deplete exactly and seeded days replay',()=>{
  const s=fresh();s.local.deposits.clay=1;assert.equal(takeDeposit(s,'clay',3),1);assert.equal(takeDeposit(s,'clay',3),0);
  const run=()=>{let w=fresh();for(let i=0;i<60;i++)w=stepDay(w);return w;};assert.deepEqual(run(),run());
});
test('meteor overlap ignites a shelter and nearby responders can preserve its beds',()=>{
  for(const help of [false,true]){
    const s=fresh();s.huts=[0];s.hutDetails=[{}];s.speed=1;
    const hit=castText(s,'meteor').state.meteors[0];
    const scene={width:3000,height:1920,sites:[{slot:0,x:hit.x,y:hit.y}],bankAt:()=>1,
      walkers:help?[{id:1,x:hit.x*3000,y:hit.y*1920,side:1}]:[]};
    let w=castText(s,'meteor',{impactScene:scene}).state;assert.equal(w.hutFires.length,1);
    w=advanceTime(w,26000);assert.equal(w.hutDetails[0].ruined,!help);assert.equal(shelterPlaces(w),help?11:8);
  }
});
