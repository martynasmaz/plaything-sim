import test from 'node:test';
import assert from 'node:assert/strict';
import {createVillageCluster,externalPartnerRules,hasUnrelatedPair,hasFutureUnrelatedPair,partnerOptions,beginExternalMigration,advanceExternalJourneys,stepVillageCluster} from '../scripts/multi-village-fixture.mjs';
import {foodLedger} from '../src/provisions.js';
import {serialize,deserialize} from '../src/save.js';

function prepared(){
  const cluster=createVillageCluster(60,true);cluster.day=100;cluster.needDays[0]=externalPartnerRules.needDays;
  for(const [i,s] of cluster.villages.entries()){
    s.day=100;s.food=100;
    for(const v of s.villagers){v.age=50;v.household=v.id;v.health=v.fullness=v.warmth=v.happiness=v.practice.energy=100;if(i===0)v.gender='male';}
  }
  return cluster;
}
const alive=c=>c.villages.reduce((n,s)=>n+s.villagers.length,0)+c.transit.length;
const provisions=c=>c.villages.reduce((n,s)=>{const f=foodLedger(s);return n+f.home+f.east;},0)+c.transit.reduce((n,t)=>n+(t.person.travelMeals||0),0);
test('independent villages start equally capable with separate resources and unrelated founder identities',()=>{
  const c=createVillageCluster(60),[a,b,d]=c.villages;
  assert.equal(new Set(c.villages.flatMap(s=>s.villagers.map(v=>v.id))).size,18);
  for(const s of c.villages){assert.equal(s.villagers.length,6);assert.equal(s.food,a.food);assert.equal(s.wood,a.wood);
    for(let i=0;i<6;i++){assert.deepEqual(s.villagers[i].practice,a.villagers[i].practice);assert.deepEqual(s.villagers[i].traits,a.villagers[i].traits);assert.equal(s.villagers[i].age,a.villagers[i].age);}
    assert.ok(Object.values(s.local.genealogy.people).every(p=>p.origin==='founder'));
  }
  b.food=0;b.local.stock.stone=999;b.villagers[0].practice.known.drying=1;b.huts=[0];
  assert.equal(a.food,38);assert.equal(d.food,38);assert.notEqual(a.local.stock.stone,999);
  assert.equal(a.villagers[0].practice.known.drying,undefined);assert.equal(a.huts,undefined);
});
test('temporary illness, hunger and lack of ready parents do not trigger bloodline rescue',()=>{
  const c=prepared();c.villages[0].villagers[0].gender='female';
  for(const v of c.villages[0].villagers){v.illnessDays=3;v.fullness=0;}
  assert.equal(hasUnrelatedPair(c.villages[0]),true);assert.equal(partnerOptions(c).length,0);
  c.villages[0].villagers.forEach(v=>v.gender='male');c.needDays[0]=externalPartnerRules.needDays-1;
  assert.equal(partnerOptions(c).length,0);
});
test('a donor refuses to lose its last unrelated reproductive pair or abandon dependent children',()=>{
  const c=prepared();for(const s of c.villages.slice(1)){
    s.villagers=s.villagers.slice(0,2);s.villagers[0].gender='male';s.villagers[1].gender='female';
  }
  assert.equal(partnerOptions(c).length,0);
  const d=prepared();for(const s of d.villages.slice(1))for(const v of s.villagers.filter(v=>v.gender==='female')){
    s.villagers.push({id:v.id+500,age:1,parents:[v.id],carers:[v.id],gender:'male'});
  }
  assert.equal(partnerOptions(d).length,0);
});
test('young local bloodlines that can mature together avoid unnecessary outside contact',()=>{
  const c=prepared(),s=c.villages[0],young=s.villagers[0];young.age=s.config.life.adult-2;young.gender='female';
  assert.equal(hasUnrelatedPair(s),false);assert.equal(hasFutureUnrelatedPair(s),true);assert.equal(partnerOptions(c).length,0);
  for(const v of s.villagers.filter(v=>v!==young))v.age=s.config.life.elder-1;
  assert.equal(hasFutureUnrelatedPair(s),false,'they cannot form an adult pair before the others age out');
});
test('an unaffordable nearby donor does not hide a farther willing and affordable donor',()=>{
  const c=prepared(),near=c.villages[1];near.villagers=near.villagers.slice(0,4);near.food=16;
  const before=c.villages.map(serialize),option=partnerOptions(c)[0];
  assert.equal(option.from,2);assert.deepEqual(c.villages.map(serialize),before,'candidate checking cannot move any food');
  const donor=c.villages[option.from],food=donor.food;
  assert.ok(beginExternalMigration(c,{...option,rations:0,days:0}));
  assert.equal(food-donor.food,option.rations*donor.config.needs.mealCost);assert.equal(c.transit[0].remaining,option.days);
});
test('migration uses real rations and lost workdays, retains identity and imports ancestry, not shared stores',()=>{
  const c=prepared(),option=partnerOptions(c)[0],source=c.villages[option.from],target=c.villages[option.to];
  const traveler=source.villagers.find(v=>v.id===option.travelerId),parent=traveler.id+900;
  traveler.parents=[parent];source.local.genealogy.people[traveler.id].parents=[parent];
  source.local.genealogy.people[parent]={id:parent,name:'Earlier ancestor',parents:[],deathDay:20};
  traveler.practice.known.drying=1;source.toolkit=['hand axe'];const food=provisions(c),energy=traveler.practice.energy;
  assert.equal(beginExternalMigration(c,option),true);assert.equal(alive(c),18);assert.equal(provisions(c),food);
  assert.ok(!source.villagers.includes(traveler));assert.ok(!target.villagers.includes(traveler));
  for(let i=0;i<option.days;i++){c.day++;advanceExternalJourneys(c);}
  assert.equal(c.transit.length,0);assert.equal(alive(c),18);assert.ok(target.villagers.includes(traveler));
  assert.equal(source.toolkit[0],'hand axe');assert.ok(!target.toolkit?.includes('hand axe'));
  assert.equal(traveler.practice.known.drying,1);assert.ok(target.villagers.filter(v=>v!==traveler).every(v=>!v.practice.known.drying));
  assert.ok(target.local.genealogy.people[parent]);assert.ok(traveler.practice.energy<energy);
  assert.equal(provisions(c),food-option.days*source.config.needs.mealCost);
  assert.equal(c.arrivals[option.to],1);assert.equal(c.departures[option.from],1);
  const loaded=deserialize(serialize(target),target.config);assert.ok(loaded.local.genealogy.people[parent]);
});
test('failed ration safety checks cannot convert private preserved food into fresh food',()=>{
  const c=prepared(),option=partnerOptions(c)[0],source=c.villages[option.from];source.food=0;
  source.villagers=source.villagers.slice(0,4);source.local.campStores[0]={saved:16,rack:0,built:true};
  const before=serialize(source);assert.equal(beginExternalMigration(c,option),false);assert.equal(serialize(source),before);
});
test('the isolated control never migrates and ordinary daily work and cluster population remain conserved',()=>{
  const c=createVillageCluster(60,false);
  for(let day=0;day<100;day++){
    const reports=stepVillageCluster(c);
    for(const {before,report} of reports)if(report)assert.deepEqual(report.actions.map(a=>a.id).sort((a,b)=>a-b),before.map(v=>v.id).sort((a,b)=>a-b));
    assert.equal(alive(c),18+c.villages.reduce((n,s)=>n+s.stats.births-s.stats.deaths,0));
  }
  assert.equal(c.events.length,0);assert.equal(c.transit.length,0);
});
