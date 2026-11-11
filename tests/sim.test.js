import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createState, queueCommand, cancelCommand, stepDay, validateCommand, availableCommands,
  setSpeed, advanceTime, restart, normalizeCommand } from '../src/sim.js';

function cast(s, text) {
  const r = queueCommand(s, text);
  assert.equal(r.ok, true, r.message);
  return stepDay(r.state);
}
function days(s, n) { for (let i=0;i<n;i++) s=stepDay(s); return s; }
function healthy(s) {
  s.food=80;
  for(const v of s.villagers) Object.assign(v,{health:100,fullness:100,warmth:100,happiness:100});
  return s;
}
function checkLimits(s) {
  for(const key of ['food','wood','power']) assert.ok(s[key]>=0&&s[key]<=100,`${key} ${s[key]}`);
  for(const v of s.villagers) for(const key of ['fullness','warmth','health','safety','happiness'])
    assert.ok(v[key]>=0&&v[key]<=100,`${key} ${v[key]}`);
}

describe('Build check 1 · no-command run', () => {
  test('exact starting state and independent state/config objects', () => {
    const s=createState();
    assert.equal(s.day,0); assert.equal(s.speed,0); assert.equal(s.age,'Stone');
    assert.deepEqual([s.food,s.wood,s.power],[18,12,50]);
    assert.deepEqual(s.villagers.map(v=>v.age),[40,50,60,70,80,90]);
    assert.equal(s.fireKnown,false); assert.deepEqual(s.weather,{type:'normal',daysLeft:0});
    assert.ok(s.villagers.every(v=>v.fullness===75&&v.warmth===70&&v.health===100&&v.happiness===60&&v.safety===80));
    s.config.start.food=99;
    assert.equal(createState().config.start.food,18);
  });
  test('day 30 has ≥5 alive and natural fire; original balance unchanged', () => {
    let s=createState(); const rows=[];
    for(let i=0;i<30;i++) {s=stepDay(s);rows.push({day:s.day,population:s.villagers.length,food:s.food,deaths:s.lastDay.deaths});checkLimits(s);}
    assert.ok(s.villagers.length>=5,JSON.stringify(rows));
    assert.equal(s.fireKnown,true,JSON.stringify(rows));
    assert.equal(s.milestoneReached,true);
    assert.equal(s.villagers.length,8); assert.equal(s.food,21);
    assert.equal(s.lastUsed['teach fire'],undefined);
    assert.equal(rows.flatMap(r=>r.deaths).length,0);
  });
  test('same inputs produce identical outputs without mutating any input', () => {
    const original=createState(), before=structuredClone(original);
    assert.deepEqual(days(original,50),days(original,50));
    assert.deepEqual(original,before);
    assert.notEqual(stepDay(original),original);
  });
  test('milestone does not end play and the log keeps the latest 10 entries', () => {
    const s=days(createState(),31);
    assert.equal(s.ended,false);assert.equal(s.day,31);assert.equal(s.log.length,10);
    assert.ok(s.log.some(e=>e.type==='milestone'));
    assert.ok(s.villagers.every(v=>v.id>0));
  });
});

describe('Build check 2 · one normal day / priorities / rotation', () => {
  test('75 → 50 → 80; exactly one food per meal AFTER all work', () => {
    const initial=createState(), s=stepDay(initial);
    assert.deepEqual(s.lastDay.beforeMeals.map(v=>v.fullness),[50,50,50,50,50,50]);
    assert.ok(s.villagers.every(v=>v.fullness===80&&v.warmth===70));
    assert.equal(s.lastDay.meals.length,6);
    assert.equal(s.lastDay.gatheredFood,6);
    assert.equal(s.food,initial.food+s.lastDay.gatheredFood-s.lastDay.meals.length);
    assert.deepEqual(s.lastDay.actions.map(a=>a.action),['Forage','Forage','Rest','Rest','Rest','Rest']);
  });
  test('full villagers above 75 do not eat; fullness clamps at 100', () => {
    let s=createState();s.food=100;s.config.needs.fullnessLoss=0;
    s.villagers[0].fullness=76;s.villagers[1].fullness=75;
    s=stepDay(s);
    assert.ok(!s.lastDay.meals.includes(1));assert.ok(s.lastDay.meals.includes(2));
    assert.equal(s.villagers[1].fullness,100);
    assert.equal(new Set(s.lastDay.meals).size,s.lastDay.meals.length);
    checkLimits(s);
  });
  test('emergency forage beats warming; rechecking stock lets the next cold person warm up', () => {
    let s=createState();s.food=0;
    for(const v of s.villagers) {v.fullness=30;v.warmth=25;}
    s=stepDay(s);
    assert.deepEqual(s.lastDay.actions.slice(0,2).map(a=>a.action),['Forage','Warm up']);
    assert.equal(s.lastDay.actions[1].gained,20);
    assert.ok(s.food>=0);
  });
  test('food reserve before wood; wood reserve before resting', () => {
    let s=createState();s.food=24;s.wood=0;
    s=stepDay(s);
    assert.deepEqual(s.lastDay.actions.map(a=>a.action),['Gather wood','Gather wood','Gather wood','Rest','Rest','Rest']);
    assert.equal(s.wood,6);
  });
  test('visit order rotates by permanent number and meals use the same order', () => {
    let s=createState();s=stepDay(s);assert.deepEqual(s.lastDay.visitOrder,[1,2,3,4,5,6]);
    s=stepDay(s);assert.deepEqual(s.lastDay.visitOrder,[2,3,4,5,6,1]);
    assert.deepEqual(s.lastDay.meals,s.lastDay.visitOrder);
    s.villagers=s.villagers.filter(v=>v.id!==3);
    s=stepDay(s);assert.deepEqual(s.lastDay.visitOrder,[4,5,6,1,2]);
  });
  test('children gather less; drought child forage can yield honestly zero', () => {
    let s=createState();s.villagers=[s.villagers[0]];s.villagers[0].age=0;s.food=0;
    s.weather={type:'drought',daysLeft:3};s.villagers[0].fullness=30;s.villagers[0].warmth=30;
    s=stepDay(s);
    assert.deepEqual(s.lastDay.actions,[{id:1,action:'Forage',gained:0}]);assert.equal(s.food,0);
    s=createState();s.villagers=[s.villagers[0]];s.villagers[0].age=0;s.food=100;s.wood=0;
    s=stepDay(s);assert.equal(s.lastDay.gatheredWood,1);
  });
  test('health damage is combined; safety AFTER health; recovery is conditional', () => {
    let s=createState();s.food=0;s.weather={type:'drought',daysLeft:3};
    s.villagers=[s.villagers[0]];Object.assign(s.villagers[0],{age:0,health:65,fullness:0,warmth:0,illnessDays:2,happiness:60});
    s=stepDay(s);
    // Emergency forage yields 0 and leaves warmth at 0: 10 hunger + 10 cold + 8 illness.
    assert.equal(s.villagers[0].health,37);assert.equal(s.lastDay.damage[0].amount,28);
    assert.equal(s.villagers[0].safety,40);assert.equal(s.villagers[0].happiness,51);
    s=healthy(createState());s.villagers[0].health=48;s=stepDay(s);
    assert.equal(s.villagers[0].health,52);assert.equal(s.villagers[0].safety,80);
    s=createState();s.food=80;s.villagers[0].warmth=0;s=stepDay(s);
    // Daily loss clamps to 0, shelter adds 10, then warm-up adds 20.
    assert.equal(s.villagers[0].warmth,30);assert.equal(s.villagers[0].health,100);
  });
  test('power bonus uses living average happiness and caps at 100', () => {
    let s=createState();s=stepDay(s);assert.equal(s.power,55);
    s=createState();s.power=99;s=stepDay(s);assert.equal(s.power,100);
    s=createState();for(const v of s.villagers)v.happiness=0;
    s=stepDay(s);assert.equal(s.power,53);
  });
});

describe('Build check 3 · three-day weather', () => {
  test('rain cast day 2 affects yields/cold on 2, 3, 4 only; day 5 is normal', () => {
    let s=stepDay(createState());s=cast(s,'rain');
    for(const [day,warmth,left] of [[2,60,2],[3,50,1],[4,40,0]]) {
      if(s.day<day)s=stepDay(s);
      assert.equal(s.lastDay.weather,'rain');assert.equal(s.villagers[0].warmth,warmth);
      assert.equal(s.weather.daysLeft,left);
      assert.ok(s.lastDay.actions.filter(a=>a.action==='Forage').every(a=>a.gained===4));
    }
    s=stepDay(s);assert.equal(s.lastDay.weather,'normal');assert.equal(s.villagers[0].warmth,40);
  });
  test('opposite weather replaces immediately with a fresh timer; same weather fails', () => {
    let s=cast(createState(),'rain');
    const failed=queueCommand(s,'rain');assert.equal(failed.ok,false);assert.strictEqual(failed.state,s);
    s=cast(s,'drought');assert.equal(s.lastDay.weather,'drought');
    assert.deepEqual(s.weather,{type:'drought',daysLeft:2});
    assert.ok(s.lastDay.actions.filter(a=>a.action==='Forage').every(a=>a.gained===1));
    assert.equal(s.villagers[0].warmth,60);
  });
  test('same-weather rejection independent of cooldown', () => {
    const s=createState();s.weather={type:'rain',daysLeft:3};
    assert.match(queueCommand(s,'rain').message,/Already rain/);
  });
});

describe('Build check 4 · command validation and effects', () => {
  test('normalization accepts only exact fixed phrases', () => {
    assert.equal(normalizeCommand('  TeAcH   FIRE  '),'teach fire');
    assert.equal(queueCommand(createState(),'  TeAcH   FIRE  ').ok,true);
    for(const text of ['hello','please rain','rain now','teach farming','']) {
      const s=createState(),before=structuredClone(s),r=queueCommand(s,text);
      assert.equal(r.ok,false);assert.strictEqual(r.state,s);assert.deepEqual(s,before);
      for(const name of availableCommands(s))assert.ok(r.message.includes(name));
    }
  });
  test('queue is free; only one slot; replace and cancel', () => {
    const initial=createState();let s=queueCommand(initial,'rain').state;
    assert.equal(s.power,50);assert.deepEqual(s.lastUsed,{});assert.equal(initial.queuedCommand,null);
    s=queueCommand(s,'harvest').state;assert.equal(s.queuedCommand,'harvest');
    s=cancelCommand(s);assert.equal(s.queuedCommand,null);assert.equal(s.power,50);
    s=stepDay(s);assert.deepEqual(s.lastUsed,{});
  });
  test('successful command pays once, has one effect, and clears queue', () => {
    let s=cast(createState(),'harvest');
    assert.equal(s.power,35);assert.equal(s.lastUsed.harvest,1);assert.equal(s.queuedCommand,null);
    assert.equal(s.food,24); // 18 + 12 gift − 6 meals, no forage.
    s=stepDay(s);assert.equal(s.power,40);assert.equal(s.lastDay.command,null);
  });
  test('unaffordable is no mutation/cost/cooldown; conditions checked again on application', () => {
    let s=createState();s.power=9;
    const r=queueCommand(s,'rain');assert.equal(r.ok,false);assert.match(r.message,/Not enough power/);assert.strictEqual(r.state,s);
    s=queueCommand(createState(),'rain').state;s.power=0;s=stepDay(s);
    assert.equal(s.lastDay.command.ok,false);assert.equal(s.lastUsed.rain,undefined);
    assert.equal(s.weather.type,'normal');assert.equal(s.power,5);assert.equal(s.queuedCommand,null);
    assert.ok(s.log.some(e=>e.type==='failure'));
    s=queueCommand(createState(),'harvest').state;s.food=100;s=stepDay(s);
    assert.equal(s.lastDay.command.ok,false);assert.equal(s.lastUsed.harvest,undefined);
    assert.equal(s.power,55);
  });
  test('cooldown of 5 cast on day 4 rejects day 8 but allows day 9', () => {
    let s=days(createState(),3);s=cast(s,'harvest');assert.equal(s.day,4);
    s=days(s,3);assert.equal(s.day,7);
    let r=queueCommand(s,'harvest');assert.equal(r.ok,false);assert.match(r.message,/day 9/);assert.strictEqual(r.state,s);
    s=stepDay(s);assert.equal(s.day,8);
    r=queueCommand(s,'harvest');assert.equal(r.ok,true);s=stepDay(r.state);
    assert.equal(s.lastUsed.harvest,9);
  });
  test('all cooldowns use casting day + specified wait', () => {
    for(const [command,cooldown] of [['rain',4],['drought',4],['bless',5],['plague',8],['harvest',5]]) {
      const s=createState();s.lastUsed[command]=4;s.power=100;s.day=4;
      assert.equal(validateCommand(s,command,4+cooldown-1).ok,false,command);
      assert.equal(validateCommand(s,command,4+cooldown).ok,true,command);
    }
  });
  test('plague, full food, known fire, insufficient wood, full bless are rejected', () => {
    let s=createState();s.villagers[0].illnessDays=1;assert.match(queueCommand(s,'plague').message,/already ill/);
    s=createState();s.food=100;assert.match(queueCommand(s,'harvest').message,/already full/);
    s=createState();s.fireKnown=true;assert.match(queueCommand(s,'teach fire').message,/already known/);
    s=createState();s.wood=2;assert.match(queueCommand(s,'teach fire').message,/at least 3 wood/);
    s=healthy(createState());assert.match(queueCommand(s,'bless').message,/full health and happiness/);
  });
  test('bless clamps, reports actual gains, and does not cure illness', () => {
    let s=healthy(createState());s.villagers[0].health=95;s.villagers[0].happiness=94;s.villagers[0].illnessDays=2;
    s=cast(s,'bless');
    assert.equal(s.villagers[0].health,92);assert.equal(s.villagers[0].illnessDays,1);
    assert.ok(s.log.some(e=>e.text.includes('Ada +5 health/+6 happiness')));
  });
  test('harvest clamps at capacity and uses actual stock gain in log', () => {
    const s=createState();s.food=99;const after=cast(s,'harvest');
    assert.equal(after.food,94);assert.ok(after.log.some(e=>e.text.includes('+1 food')));
  });
  test('plague disabled means unknown/unavailable AND absent from visible vocabulary', () => {
    const s=createState({enablePlague:false});assert.ok(!availableCommands(s).includes('plague'));
    const r=queueCommand(s,'plague');assert.equal(r.ok,false);assert.match(r.message,/Unknown\/unavailable/);
    assert.ok(!r.message.includes('bless, plague'));
  });
});

describe('Build check 5 · fire in both routes', () => {
  test('teach with 3 wood spends 2 to learn, 1 to burn today', () => {
    let s=createState();s.wood=3;s.food=0;s=cast(s,'teach fire');
    assert.equal(s.fireKnown,true);assert.equal(s.fireLit,true);assert.equal(s.wood,0);
    assert.equal(s.lastDay.burnedWood,1);assert.equal(s.villagers[0].warmth,75);
    assert.equal(queueCommand(s,'teach fire').ok,false);
  });
  test('natural discovery uses consecutive days 10–12, costs 2, first burns on 13', () => {
    let s=days(createState(),9);assert.equal(s.fireCounter,0);
    s=stepDay(s);assert.equal(s.fireCounter,1);s=stepDay(s);assert.equal(s.fireCounter,2);
    const wood=s.wood;s=stepDay(s);assert.equal(s.fireKnown,true);assert.equal(s.fireLit,false);assert.equal(s.wood,wood-2);
    assert.equal(s.lastDay.discoveredFire,true);
    s=stepDay(s);assert.equal(s.fireLit,true);assert.equal(s.lastDay.burnedWood,1);
  });
  test('a failed discovery check resets the counter', () => {
    let s=days(createState(),11);assert.equal(s.fireCounter,2);
    s.villagers[0].illnessDays=1;s=stepDay(s);assert.equal(s.fireKnown,false);assert.equal(s.fireCounter,0);
    s=days(s,3);assert.equal(s.fireKnown,true);
  });
  test('no wood preserves knowledge; warm-up uses shelter +20, not fire +40', () => {
    let s=createState();s.fireKnown=true;s.wood=0;s.food=0;
    for(const v of s.villagers){v.warmth=25;v.fullness=75;}
    s=stepDay(s);assert.equal(s.fireKnown,true);assert.equal(s.fireLit,false);
    assert.equal(s.villagers[0].warmth,45);assert.equal(s.lastDay.actions[0].gained,20);
  });
  test('lit fire warms +5 before work and boosts warm-up to +40', () => {
    let s=createState();s.fireKnown=true;s.wood=10;for(const v of s.villagers)v.warmth=25;
    s=stepDay(s);assert.equal(s.villagers[0].warmth,70);assert.equal(s.lastDay.actions[0].gained,40);
  });
});

describe('Build check 6 · illness and death', () => {
  test('plague deals exactly 24 over 3 days, never a fourth; no recovery while ill', () => {
    let s=healthy(createState());s=cast(s,'plague');
    assert.equal(s.villagers[0].health,92);assert.equal(s.villagers[0].illnessDays,2);
    s=stepDay(s);assert.equal(s.villagers[0].health,84);assert.equal(s.villagers[0].illnessDays,1);
    s=stepDay(s);assert.equal(s.villagers[0].health,76);assert.equal(s.villagers[0].illnessDays,0);
    assert.equal(s.villagers[0].safety,40); // ill during this day, even though the timer ends tonight.
    s=stepDay(s);assert.equal(s.villagers[0].health,80);assert.equal(s.villagers[0].safety,80);
    assert.equal(s.lastDay.damage[0].amount,0);
  });
  test('illness happiness loss is 5; no happy bonus at safety 40', () => {
    let s=createState();s.food=0;s=cast(s,'plague'); // everyone forages, no rest bonus.
    assert.equal(s.villagers[0].happiness,55);assert.equal(s.villagers[0].safety,40);
  });
  test('health 0 removes once; multiple causes include reaching age 300', () => {
    let s=createState();s.villagers[0].health=8;s.villagers[0].age=299;s=cast(s,'plague');
    assert.equal(s.villagers.length,5);assert.ok(!s.villagers.some(v=>v.id===1));
    assert.deepEqual(s.lastDay.deaths[0].causes,['illness','old age']);
    assert.equal(s.log.filter(e=>e.type==='death'&&e.text.includes('#1')).length,1);
    s=stepDay(s);assert.ok(!s.lastDay.deaths.some(d=>d.id===1));
  });
  test('elder works the same as adult, but dies reaching 300', () => {
    let s=createState();s.food=0;s.villagers[0].age=299;s=stepDay(s);
    assert.equal(s.lastDay.actions[0].gained,3);assert.equal(s.villagers.length,5);
    assert.deepEqual(s.lastDay.deaths[0].causes,['old age']);
  });
});

describe('Build check 7 · birth and population cap', () => {
  test('15 eligible checks create one age-0 child with exact starting needs; first turn tomorrow', () => {
    let s=days(createState(),14);assert.equal(s.birthCounter,14);assert.equal(s.villagers.length,6);
    s=stepDay(s);assert.equal(s.birthCounter,0);assert.equal(s.villagers.length,7);
    const v=s.villagers.find(v=>v.id===7);
    assert.deepEqual([v.age,v.health,v.fullness,v.warmth,v.happiness,v.safety],[0,100,80,60,60,80]);
    assert.ok(!s.lastDay.visitOrder.includes(7));assert.ok(!s.lastDay.meals.includes(7));
    s=stepDay(s);assert.ok(s.lastDay.visitOrder.includes(7));assert.ok(s.lastDay.meals.includes(7));
    assert.equal(s.villagers.find(v=>v.id===7).age,1);
  });
  test('one illness day resets counter, even though it expires that evening', () => {
    let s=days(createState(),14);s.villagers[0].illnessDays=1;s=stepDay(s);
    assert.equal(s.birthCounter,0);assert.equal(s.villagers.length,6);
    s=stepDay(s);assert.equal(s.birthCounter,1);
  });
  test('children and elders do not count as eligible parents; at least 2 adults needed', () => {
    let s=healthy(createState());s.birthCounter=14;
    for(const v of s.villagers)v.age=240;
    s.villagers[0].age=40;s=stepDay(s);assert.equal(s.birthCounter,0);assert.equal(s.villagers.length,6);
    s=healthy(createState());s.birthCounter=14;for(const v of s.villagers)v.age=0;
    s=stepDay(s);assert.equal(s.birthCounter,0);
  });
  test('insufficient reserves reset the counter after meals, not before', () => {
    let s=createState();s.birthCounter=14;s.food=0;
    s=stepDay(s); // 18 gathered − 6 eaten = 12, below 16 for 6 people.
    assert.equal(s.food,12);assert.equal(s.birthCounter,0);assert.equal(s.villagers.length,6);
  });
  test('cap 8 holds in a long no-command run; identities are never reused', () => {
    let s=createState();for(let i=0;i<500&&!s.ended;i++){s=stepDay(s);assert.ok(s.villagers.length<=8);assert.equal(new Set(s.villagers.map(v=>v.id)).size,s.villagers.length);checkLimits(s);}
    assert.ok(s.nextId>=9);
  });
});

describe('Build check 8 · pause / speed / reset / ending', () => {
  test('initial pause freezes time, effects, cooldowns and queued command', () => {
    let s=queueCommand(createState(),'rain').state;
    assert.strictEqual(advanceTime(s,1_000_000),s);
    s=cast(s,'rain');s=setSpeed(s,0);const before=structuredClone(s);
    assert.strictEqual(advanceTime(s,1_000_000),s);assert.deepEqual(s,before);
  });
  test('normal is 30 seconds/day; 3× is 10; partial day survives pause', () => {
    let s=setSpeed(createState(),1);s=advanceTime(s,29_999);assert.equal(s.day,0);
    s=advanceTime(s,1);assert.equal(s.day,1);assert.equal(s.elapsedMs,0);
    s=advanceTime(s,15_000);s=setSpeed(s,0);s=advanceTime(s,90_000);assert.equal(s.elapsedMs,15_000);
    s=setSpeed(s,3);s=advanceTime(s,5_000);assert.equal(s.day,2);
    s=advanceTime(s,10_000);assert.equal(s.day,3);
    assert.throws(()=>setSpeed(s,2),RangeError);
  });
  test('restart exactly clears every value, timer, discovery and pending command', () => {
    let s=days(createState(),30);s.power=31;s.weather={type:'rain',daysLeft:2};s.villagers[0].illnessDays=2;
    s.queuedCommand='bless';s.birthCounter=7;s.elapsedMs=1000;s=setSpeed(s,3);
    assert.deepEqual(restart(s),createState());
    const noPlague=createState({enablePlague:false});assert.equal(restart(noPlague).config.enablePlague,false);
  });
  test('last death ends before close-of-day; pauses and rejects all future commands', () => {
    let s=createState();s.villagers=[s.villagers[0]];s.villagers[0].age=299;s=setSpeed(s,3);
    s=cast(s,'rain');assert.equal(s.ended,true);assert.equal(s.speed,0);assert.equal(s.villagers.length,0);
    assert.equal(s.power,40); // no day-end regeneration after zero population.
    assert.equal(s.queuedCommand,null);assert.strictEqual(stepDay(s),s);assert.strictEqual(advanceTime(s,999_999),s);
    assert.match(queueCommand(s,'rain').message,/village has ended/);
    assert.equal(s.log.at(-1).text,'The village has ended. Restart to begin a new village.');
  });
  test('empty diagnostic state ends cleanly without NaN averages', () => {
    let s=createState();s.villagers=[];s=stepDay(s);assert.equal(s.ended,true);assert.equal(s.speed,0);
    assert.equal(s.power,50);
  });
});
