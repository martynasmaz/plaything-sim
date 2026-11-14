import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,stepDay,preservationWork,improveBridge,readyToInvent} from '../src/sim.js';
import {HOMESTEAD_RULES} from '../src/config.js';
import {practices,canExperiment,makePracticeProduct,planLessons,practiceWork,campSites,worldTrees,buildingSiteTree} from '../src/practices.js';
import {granaryRules,granaryFinished,storageCapacity,chooseStorageSite} from '../src/storage.js';
import {bridgeProtection,bridgeFallChance,riverCrossingRoll} from '../src/river.js';
import {walkRiver} from '../src/clearing.js';
import {inBuildingPatch} from '../src/ecology.js';
import {serialize,deserialize} from '../src/save.js';

const rules={...HOMESTEAD_RULES,traits:false,illness:{chance:0},learning:{...HOMESTEAD_RULES.learning,seasonLength:1000},weather:{chances:{normal:100,rain:0,drought:0,cold:0}}};
function established(){
  const s=createState(rules,4);s.day=100;s.food=100;s.wood=80;s.fireKnown=s.fireLit=true;s.settlementWork=15;
  s.local.lastWinterFood={home:0,east:0};s.local.season='Summer';s.local.climate={mm:0};
  s.toolkit=['hammer stone','hand axe','mallet & chisel'];s.local.stock.fibre=40;s.local.stock.stone=30;
  for(const v of s.villagers){
    v.fullness=v.warmth=v.health=v.happiness=v.practice.energy=100;v.lastCompanyDay=s.day;v.outdoors=false;
    Object.assign(v.practice.known,{housing:1,cordage:1,drying:1});
    Object.assign(v.practice.skills,{wood:6,fibre:3,berries:6});v.practice.used.drying=3;v.practice.used.cordage=2;
    v.practice.properties=['rigid','flexible','perishable'];
  }
  s.local.campStores[0]={built:true,racks:1,batches:3,saved:24,rack:0,rackSites:[[330,120]]};
  return s;
}
const report=()=>({actions:[],gatheredWood:0,gatheredFood:0});
function clearSite(s,site){
  s.local.stumps??={};worldTrees(s).forEach((tree,id)=>{if(inBuildingPatch(tree,site,'granary'))s.local.stumps[id]=s.day;});
}

test('storage and bridge discoveries require their crafts, infrastructure and personal experience',()=>{
  for(const id of ['granaries','bridgecraft']){
    const s=established(),v=s.villagers[0],r=practices[id];
    assert.ok(canExperiment(s,v,r));assert.ok(readyToInvent(s,r.product));
    for(const missing of ['housing','cordage','skill','infrastructure','experience','material']){
      const x=structuredClone(s),p=x.villagers[0];
      if(['housing','cordage'].includes(missing))delete p.practice.known[missing];
      if(missing==='skill')p.practice.skills.wood=1;
      if(missing==='material')x.local.stock.fibre=0;
      if(missing==='infrastructure'){if(id==='granaries')x.local.campStores={};else x.settlementWork=5;}
      if(missing==='experience'){if(id==='granaries')p.practice.used.drying=0;else {p.practice.used.cordage=0;p.practice.skills.fibre=0;}}
      assert.equal(canExperiment(x,p,r),false,id+': '+missing);
    }
    v.practice.known[id]=1;assert.equal(makePracticeProduct(s,v,id,report()),false,'knowledge cannot craft a free building');
  }
});

test('teaching cannot bypass new construction prerequisites',()=>{
  for(const id of ['granaries','bridgecraft']){
    const s=established(),[teacher,student]=s.villagers;s.villagers=[teacher,student];
    teacher.practice.known[id]=1;teacher.practice.used[id]=3;
    delete student.practice.known.housing;planLessons(s,s.villagers);
    assert.notEqual(student.practice.lessonToday?.id,id);
    student.practice.lessonToday={teacher:teacher.id,id,key:teacher.id+'-'+id};
    for(let i=0;i<5;i++)practiceWork(s,student,1,report());
    assert.equal(student.practice.known[id],undefined);
    student.practice.known.housing=1;
    for(let day=102;day<108&&!student.practice.known[id];day++){
      s.day=day;for(const p of s.villagers){delete p.practice.lessonToday;p.practice.energy=100;p.lastCompanyDay=day;}
      planLessons(s,s.villagers);if(student.practice.lessonToday?.id===id)practiceWork(s,student,1,report());
    }
    assert.ok(student.practice.known[id],'experienced pupils learn through repeated lessons once dependencies exist');
  }
});

test('wood-working experiments can independently discover both construction techniques',()=>{
  const s=established(),v=s.villagers[0];
  Object.assign(v.practice.known,Object.fromEntries(Object.keys(practices).filter(id=>!['granaries','bridgecraft'].includes(id)).map(id=>[id,1])));
  for(let i=0;i<12&&(!v.practice.known.granaries||!v.practice.known.bridgecraft);i++){
    v.practice.energy=100;v.practice.lastSkill='wood';practiceWork(s,v,1,report());
  }
  assert.ok(v.practice.known.granaries);assert.ok(v.practice.known.bridgecraft);
  assert.equal(s.local.campStores[0].granary,undefined);assert.equal(s.local.bridgeUpgrade,undefined,'discoveries create no structures');
});

test('granaries cost eight workdays and real materials, then paid bins add capacity without new racks',()=>{
  const s=established(),v=s.villagers[0],store=s.local.campStores[0];v.practice.known.granaries=1;
  const site=chooseStorageSite(s,campSites,0);assert.ok(site);clearSite(s,site);
  const wood=s.wood,fibre=s.local.stock.fibre,stone=s.local.stock.stone,food=s.food;
  for(let i=1;i<=8;i++){
    v.practice.energy=100;assert.ok(preservationWork(s,v,report()));
    assert.equal(store.granary.work,i);assert.equal(storageCapacity(store),i<8?24:120);
  }
  assert.equal(s.wood,wood-granaryRules.cost.wood);assert.equal(s.local.stock.fibre,fibre-4);assert.equal(s.local.stock.stone,stone-2);
  assert.equal(s.food,food);assert.equal(store.saved,24);assert.equal(store.racks,1);assert.ok(granaryFinished(store));
  // Population-driven reserve demand justifies more covered bins.
  const template=structuredClone(v);for(let i=0;i<15;i++)s.villagers.push({...structuredClone(template),id:100+i});
  s.food=150;store.saved=120;
  for(let i=0;i<4;i++){v.practice.energy=100;assert.ok(preservationWork(s,v,report()));assert.equal(storageCapacity(store),i===3?168:120);}
  assert.equal(store.granary.bins,1);assert.equal(store.racks,1);
});

test('granary clearing is a paid workday and unfinished projects survive hunger, death and reload',()=>{
  let s=established(),v=s.villagers[0];v.practice.known.granaries=1;
  const site=worldTrees(s).find(tree=>tree[0]>50&&tree[0]<400&&tree[1]>80&&tree[1]<230).slice(0,2);
  s.local.campStores[0].granary={site,work:0,bins:0,spent:{},clearedTrees:[],founderId:v.id};
  const wood=s.wood;
  assert.ok(preservationWork(s,v,report()));assert.equal(v.activity,'Clear granary site');
  assert.equal(s.local.campStores[0].granary.work,0);assert.ok(s.wood>wood);
  const project=structuredClone(s.local.campStores[0].granary);v.fullness=0;
  assert.equal(preservationWork(s,v,report()),false);assert.deepEqual(s.local.campStores[0].granary,project);
  s.villagers.shift();s=deserialize(serialize(s),rules);assert.deepEqual(s.local.campStores[0].granary,project);
  const heir=s.villagers[0];heir.practice.known.granaries=1;clearSite(s,site);heir.practice.energy=100;
  assert.ok(preservationWork(s,heir,report()));assert.equal(s.local.campStores[0].granary.work,1);
});

test('old stores, food and discoveries load intact without receiving a free granary',()=>{
  const s=established();s.local.campStores[0]={saved:75,rack:7,built:true,racks:4,rackWork:1,batches:9};s.villagers[0].practice.known.granaries=1;
  const back=deserialize(serialize(s),rules),store=back.local.campStores[0];
  for(const key of ['saved','rack','built','racks','rackWork','batches'])assert.equal(store[key],s.local.campStores[0][key]);
  assert.equal(store.rackSites.length,5);assert.equal(new Set(store.rackSites.map(p=>p.join(','))).size,5);
  assert.equal(store.granary,undefined);assert.equal(back.villagers[0].practice.known.granaries,1);
});

test('bridge upgrades consume separate workdays and materials and wait for tools, weather and health',()=>{
  let s=established(),v=s.villagers[0];v.practice.known.bridgecraft=1;const wood=s.wood,fibre=s.local.stock.fibre,stone=s.local.stock.stone;
  for(let i=1;i<=4;i++){
    v.practice.energy=100;assert.ok(improveBridge(s,v,report()));assert.equal(s.local.bridgeUpgrade.railWork,i);
    assert.equal(bridgeFallChance(bridgeProtection(s),true),i<4?1:.45);
  }
  s.toolkit=[];assert.equal(improveBridge(s,v,report()),false);s.toolkit=['mallet & chisel'];
  for(let i=1;i<=6;i++){
    v.practice.energy=100;assert.ok(improveBridge(s,v,report()));assert.equal(s.local.bridgeUpgrade.braceWork,i);
    assert.equal(bridgeFallChance(bridgeProtection(s),true),i<6?.45:.15);
  }
  assert.equal(s.wood,wood-16);assert.equal(s.local.stock.fibre,fibre-4);assert.equal(s.local.stock.stone,stone-6);
  assert.equal(improveBridge(s,v,report()),false);
  const saved=structuredClone(s.local.bridgeUpgrade);s.villagers.shift();s=deserialize(serialize(s),rules);assert.deepEqual(s.local.bridgeUpgrade,saved);
  s.settlementWork=10;assert.equal(bridgeProtection(s).built,false);assert.equal(bridgeFallChance(bridgeProtection(s),true),1,'damaged base removes protection');
  for(const issue of ['illness','cold','hunger','rain']){
    const x=established(),p=x.villagers[0];p.practice.known.bridgecraft=1;
    if(issue==='illness')p.illnessDays=1;if(issue==='cold')p.warmth=0;if(issue==='hunger')p.fullness=0;if(issue==='rain')x.local.climate.mm=12;
    assert.equal(improveBridge(x,p,report()),false);assert.equal(x.local.bridgeUpgrade,undefined);
  }
});

test('ordinary NPC daily work can select a learned bridge improvement',()=>{
  const s=established();s.villagers=s.villagers.slice(0,2);s.huts=[0,0,0];s.hutDetails=[{},{},{}];
  for(const v of s.villagers){v.practice.known.bridgecraft=1;v.traits=['Loner'];v.gear='bow';v.fishTrap=true;v.practice.gear['fish trap']=true;}
  const next=stepDay(s);assert.ok(next.lastDay.actions.some(a=>a.action==='Build bridge handrails'),JSON.stringify(next.lastDay.actions));
  assert.equal(next.local.bridgeUpgrade.railWork,1,'one improvement worker per day');
});

test('flood falls use one stable roll per crossing; rails and bracing reduce falls across the same walkers',()=>{
  const x=430,center=640*(.51+.078*Math.sin(.43*7+.4)+.037*Math.sin(.43*13));
  const totals=[];
  for(const protection of [true,{built:true,rails:true},{built:true,rails:true,braced:true}]){
    let falls=0;
    for(let id=1;id<=1000;id++){
      const p={x,y:center,seed:4,crossing:1,crossingTrips:1,travel:0},v={id,warmth:100};
      walkRiver(p,[x,center+90],.01,1000,640,true,v,false,protection,null,false,2000,false,()=>{falls++;return {fatal:false};});
      if(!p.swept)for(let i=0;i<30;i++)walkRiver(p,[x,center+90],.01,1000,640,true,v,false,protection,null,false,2000,false,()=>{falls++;return {};});
    }
    totals.push(falls);
  }
  assert.equal(totals[0],1000);assert.ok(totals[1]>400&&totals[1]<500,totals.join(','));assert.ok(totals[2]>110&&totals[2]<190,totals.join(','));
  assert.equal(bridgeFallChance({built:true,rails:true,braced:true},false),0);
  assert.equal(riverCrossingRoll(4,7,1),riverCrossingRoll(4,7,1));assert.notEqual(riverCrossingRoll(4,7,1),riverCrossingRoll(4,7,2));
});
