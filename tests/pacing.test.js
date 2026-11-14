import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,setSpeed,advanceTime} from '../src/sim.js';
import {HOMESTEAD_RULES} from '../src/config.js';
import {finishedDailyActivity,clearingSeconds} from '../src/clearing.js';
import {serialize,deserialize} from '../src/save.js';

test('normal playback takes four minutes per day, fast playback takes eighty seconds, and pause still holds',()=>{
  const s=createState(HOMESTEAD_RULES,4);assert.equal(s.config.dayMs,240000);
  const normal=advanceTime(setSpeed(s,1),239999);assert.equal(normal.day,0);
  assert.equal(advanceTime(normal,1).day,1);
  const fast=advanceTime(setSpeed(s,3),79999);assert.equal(fast.day,0);
  assert.equal(advanceTime(fast,1).day,1);
  assert.equal(advanceTime(s,240000),s);
});

test('longer playback produces identical daily priorities, food, health, births and deaths',()=>{
  let old=createState({...HOMESTEAD_RULES,dayMs:120000},4),slower=createState(HOMESTEAD_RULES,4);
  old=setSpeed(old,1);slower=setSpeed(slower,1);
  const runState=s=>{const {config,...run}=s;return run;};
  for(let day=0;day<60;day++){
    old=advanceTime(old,120000);slower=advanceTime(slower,240000);
    assert.deepEqual(runState(slower),runState(old),'game day '+(day+1));
    if(old.ended)break;
  }
});

test('low frame rates do not silently discard walking time while the day clock advances',()=>{
  assert.equal(clearingSeconds(500,1),5*clearingSeconds(100,1));
  assert.equal(clearingSeconds(1000,3),3);assert.equal(clearingSeconds(1000,0),0);
});

test('hunger replaces an earlier building activity at either playback pace',()=>{
  for(const dayMs of [120000,240000]){
    const s=createState({...HOMESTEAD_RULES,dayMs,traits:false},4);
    s.food=0;s.local.healerId=999;
    for(const v of s.villagers){delete v.herbalist;v.fullness=5;v.warmth=100;v.activity='Build hut';}
    const next=advanceTime(setSpeed(s,1),dayMs);
    assert.equal(next.lastDay.actions.find(a=>a.id===1).action,'Forage');
    assert.equal(next.villagers.find(v=>v.id===1).motivation.need,'food');
  }
});

test('optional activities wait for the delivery, not merely arrival at a fishing or gathering site',()=>{
  const fisher={job:'Fish',leg:1,wait:0,carry:true};
  assert.equal(finishedDailyActivity('Fish',fisher),false);
  assert.equal(finishedDailyActivity('Fish',{...fisher,leg:2,carry:false}),true);
  assert.equal(finishedDailyActivity('Warm up',fisher),false,'a new survival assignment is never treated as already completed');
  assert.equal(finishedDailyActivity('Warm up',{job:'Warm up',leg:1,wait:2}),false);
  assert.equal(finishedDailyActivity('Warm up',{job:'Warm up',leg:1,wait:0}),true);
});

test('a hunt is not complete until the encounter and return with the catch',()=>{
  const hunter={job:'Track deer',leg:1,wait:0,carry:false,huntReturned:false};
  assert.equal(finishedDailyActivity('Track deer',hunter,.1,.2),false);
  assert.equal(finishedDailyActivity('Track deer',{...hunter,carry:true},.3,.2),false);
  assert.equal(finishedDailyActivity('Track deer',hunter,.3,.2),false,'passing the encounter is insufficient');
  assert.equal(finishedDailyActivity('Track deer',{...hunter,huntReturned:true},.3,.2),true);
});

test('old day lengths migrate without resetting discoveries or expiring active fire and meteor timers',()=>{
  for(const metadata of [true,false]){
    const s=createState({...HOMESTEAD_RULES,dayMs:120000},4);s.day=12;s.elapsedMs=20000;
    s.local.first.cordage=3;s.villagers[0].practice.known.cordage=2;
    const now=s.day*s.config.dayMs+s.elapsedMs;
    s.meteors=[{x:.3,y:.4,time:now-5000}];s.castAt={meteor:now-5000};s.lastUsed.meteor=12;
    s.hutFires=[{slot:-1,x:.3,y:.4,start:now-5000,end:now+17000,helpers:[]}];
    const data=JSON.parse(serialize(s));if(!metadata)delete data.dayMs;
    const back=deserialize(JSON.stringify(data),HOMESTEAD_RULES);
    assert.ok(back);assert.equal(back.day,12);assert.equal(back.elapsedMs,40000);
    const newNow=back.day*back.config.dayMs+back.elapsedMs;
    assert.equal(newNow-back.meteors[0].time,5000);
    assert.equal(newNow-back.castAt.meteor,5000);assert.equal(back.hutFires[0].end-newNow,17000);
    assert.equal(back.local.first.cordage,3);assert.equal(back.villagers[0].practice.known.cordage,2);
  }
});
