import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,stepDay,shouldPlanHut,unrelated} from '../src/sim.js';
import {HOMESTEAD_RULES} from '../src/config.js';
import {communityOf,familyFoodReady,mainFoodRequired,foodDaysFor,familyFoodStable,foodLedger,recordFoodBalance,winterStorageTarget} from '../src/provisions.js';
import {neighborWork,crossVillageParents,recentVillagePartner} from '../src/neighbors.js';
import {beginSettlementDay} from '../src/practices.js';
import {serialize,deserialize} from '../src/save.js';

const rules={...HOMESTEAD_RULES,traits:false,illness:{chance:0},learning:{...HOMESTEAD_RULES.learning,experimentChance:0,spoilage:0},
  weather:{chances:{normal:100,rain:0,drought:0,cold:0}}};
function settled(){
  const s=createState(rules,4);s.food=100;s.wood=40;s.fireKnown=true;s.settlementWork=5;s.local.healerId=999;s.gameAnimals=0;s.lastUsed.godzilla=0;
  for(const v of s.villagers){v.fullness=v.warmth=v.health=v.happiness=v.practice.energy=100;v.practice.curiosity=0;v.traits=[];}
  return s;
}
function neighbors(){
  const s=settled();s.villagers=s.villagers.slice(0,4);s.tribeCount=2;
  s.villagers.forEach((v,i)=>{v.tribe=i<2?0:1;v.gender=i<2?'female':'male';v.parents=i<2?[100,101]:[200,201];v.household=v.id;});
  return s;
}
function visitDay(s){
  s.day++;beginSettlementDay(s);const report={actions:[],weather:'normal'};
  neighborWork(s,s.villagers,report,{unrelated,readyToInvent:()=>true});return report;
}
function meetTwice(s){
  visitDay(s);const first={...s.local.campVisit};visitDay(s);visitDay(s);
  s.day=s.local.nextNeighborDay-1;visitDay(s);const second=visitDay(s);return {first,second};
}
test('finished local provisions support family readiness without spending or duplicating food',()=>{
  const s=settled(),mother=s.villagers[1];s.food=0;s.local.campStores[0]={saved:16,rack:0};
  const before=structuredClone(s);assert.equal(mainFoodRequired(s,0),0);assert.equal(familyFoodReady(s,mother),true);assert.deepEqual(s,before);
  s.local.campStores[0]={saved:0,rack:100};assert.equal(familyFoodReady(s,mother),false);assert.equal(foodDaysFor(s,mother),0);
  s.local.campStores[1]={saved:100};assert.equal(familyFoodReady(s,mother),false,'abandoned caches cannot feed this camp');
});
test('a camp cannot pay for another occupied camp from its inaccessible preserved stock',()=>{
  const s=settled();s.villagers.forEach((v,i)=>v.tribe=i<3?0:1);s.food=0;s.local.campStores[0]={saved:100};
  assert.equal(mainFoodRequired(s,0),6);assert.equal(familyFoodReady(s,s.villagers[1]),false);
  s.food=6;assert.equal(familyFoodReady(s,s.villagers[1]),true);assert.equal(familyFoodReady(s,s.villagers[3]),false);
});
test('the eastern village uses its own supplies and is not blocked by the main pantry',()=>{
  const s=settled(),mother=s.villagers[3];s.food=0;s.local.daughter={members:[3,4],food:10,settled:true,site:[1140,175]};
  assert.equal(communityOf(s,mother),'east');assert.equal(familyFoodReady(s,mother),true);assert.equal(familyFoodReady(s,s.villagers[1]),false);
  s.local.daughter.food=9;assert.equal(familyFoodReady(s,mother),false);
});
test('shared provisions first support camps with fewer private stores, without claiming inaccessible food',()=>{
  const s=settled();s.villagers.forEach((v,i)=>v.tribe=i<4?0:1);s.local.campStores[0]={saved:20};s.food=12;
  assert.equal(foodDaysFor(s,s.villagers[0]),32/6);assert.equal(foodDaysFor(s,s.villagers[5]),32/6);
  s.food=0;assert.equal(foodDaysFor(s,s.villagers[5]),0);assert.equal(foodDaysFor(s,s.villagers[0]),5);
});
test('a well-stocked camp does not take the shared meals needed by a camp without stores',()=>{
  let s=settled();
  for(const id of [7,8]){const extra=structuredClone(s.villagers[0]);extra.id=id;extra.household=id;s.villagers.push(extra);}s.nextId=9;s.tribeCount=2;
  s.villagers.forEach(v=>{v.tribe=v.id<=6?0:1;v.fullness=40;v.warmth=5;});
  s.food=2;s.local.campStores[0]={saved:18,rack:0};s.local.seasonOffset=60;s.local.deposits.berries=0;s.local.wildPatches=[];
  s=stepDay(s);assert.ok(s.lastDay.meals.includes(7));assert.ok(s.lastDay.meals.includes(8));assert.equal(s.lastDay.meals.length,8);
  assert.equal(s.food,0);assert.equal(s.local.campStores[0].saved,12);assert.equal(s.villagers.length,8);
});
test('actual births use stored meals while retaining the three-day check and maternal recovery',()=>{
  let s=settled();s.food=0;s.local.campStores[0]={saved:70,rack:0};s.local.deposits.berries=0;s.local.deposits.fish=0;s.local.wildPatches=[];s.local.seasonOffset=60;
  for(let day=1;day<=3;day++){s=stepDay(s);assert.equal(s.stats.births,day===3?1:0);}
  const child=s.villagers.find(v=>v.id===s.lastDay.birth),mother=s.villagers.find(v=>v.id===child.parents[0]);
  assert.equal(mother.recoveryUntil,s.day+7);assert.ok(s.local.campStores[0].saved<70,'meals really consume the preserved stock');
});
test('early housing plans create physical work before a split village hits its birth cap',()=>{
  let s=settled();s.villagers.forEach((v,i)=>v.tribe=i<4?0:1);s.tribeCount=2;
  assert.equal(shouldPlanHut(s),true);s.settlementWork=4;assert.equal(shouldPlanHut(s),false);s.settlementWork=5;
  s.toolkit=['hammer stone','stone blades','digging stick','hand axe','mallet & chisel'];s.fireTools=['fire stick','bow drill','blowpipe','wooden tongs','burn bowl'];
  for(const v of s.villagers){v.gear='spear';v.fishTrap=true;}
  s=stepDay(s);assert.ok(s.huts?.length||s.hutProject?.clearingWork||s.hutProject?.work,'a real construction or clearing day, not free beds');
});
test('hungry, cold villagers do not get locked onto early construction',()=>{
  let s=settled();s.food=0;s.local.deposits.berries=0;s.local.wildPatches=[];for(const v of s.villagers)v.warmth=5;
  s=stepDay(s);assert.equal(s.hutProject,undefined);assert.equal(s.huts,undefined);assert.ok(s.lastDay.actions.every(a=>a.action==='Warm up'));
});
test('an old food stockpile does not permit births while current production runs below consumption',()=>{
  const s=settled(),mother=s.villagers[1];s.local.campStores[0]={saved:100};
  s.local.provisionHistory=Array.from({length:7},(_,i)=>({day:i+1,home:-1,east:0,hungryHome:false,hungryEast:false}));
  assert.equal(familyFoodReady(s,mother),true);assert.equal(familyFoodStable(s,mother),false);
  for(const day of s.local.provisionHistory)day.home=1;assert.equal(familyFoodStable(s,mother),true);
  for(const day of s.local.provisionHistory)day.home=0;assert.equal(familyFoodStable(s,mother),true,'full stores need not keep increasing');
  s.local.provisionHistory[0].hungryHome=true;assert.equal(familyFoodStable(s,mother),false,'recent hunger protects existing villagers first');
});
test('moving meals into a camp store or a travel packet is not food production',()=>{
  const s=settled(),before=foodLedger(s);s.food-=8;s.local.campStores[0]={saved:5,rack:2};s.villagers[0].travelMeals=1;
  assert.deepEqual(foodLedger(s),before);recordFoodBalance(s,{foodAtDawn:before,meals:[]});
  assert.equal(s.local.provisionHistory[0].home,0);
});
test('winter storage planning requires experienced living preservers and learned winter yields',()=>{
  const s=settled(),mother=s.villagers[1];s.food=30;s.local.lastWinterFood={home:1,east:0};
  assert.equal(winterStorageTarget(s,s.villagers,10),24,'without a trained food preserver the normal storage practice remains');
  mother.practice.known.drying=1;mother.practice.winterFoodDays=7;
  assert.ok(winterStorageTarget(s,s.villagers,10)>24,'past winter experience justifies paid storage expansion');
  assert.equal(familyFoodStable(s,mother),true,'planning storage does not impose a hidden population cap');
});
test('observing a winter records food income once and keeps experience through a save',()=>{
  const s=settled(),v=s.villagers[0];v.practice.known.drying=1;s.local.season='Winter';s.day=61;
  for(let day=0;day<7;day++){s.day++;const dawn=foodLedger(s);s.food+=2;recordFoodBalance(s,{foodAtDawn:dawn,meals:[v.id]});}
  assert.equal(v.practice.winterFoodDays,7);assert.equal(s.local.winterFoodObservation.days,7);
  s.local.season='Spring';recordFoodBalance(s,{foodAtDawn:foodLedger(s),meals:[]});
  assert.equal(s.local.lastWinterFood.home,3);assert.equal(s.local.winterFoodObservation,undefined);
  const loaded=deserialize(serialize(s),rules);assert.equal(loaded.villagers[0].practice.winterFoodDays,7);assert.equal(loaded.local.lastWinterFood.home,3);
});
test('cross-village families require two paid meetings and residence changes at the visited community',()=>{
  const s=neighbors(),beforePeople=s.villagers.length,beforeFood=s.food;
  const first=visitDay(s);assert.equal(first.actions.length,1);const trip={...s.local.campVisit};
  assert.equal(s.food,beforeFood-3);assert.ok(s.villagers.find(v=>v.id===trip.traveler).campJourney);
  visitDay(s);assert.equal(s.local.communication.meetings,1);assert.equal(s.local.communication.householdMoves,0);
  assert.equal(s.villagers.find(v=>v.id===trip.traveler).tribe,trip.from);
  visitDay(s);s.day=s.local.nextNeighborDay-1;visitDay(s);visitDay(s);
  const traveler=s.villagers.find(v=>v.id===trip.traveler),host=s.villagers.find(v=>v.id===trip.host);
  assert.equal(s.local.communication.householdMoves,1);assert.equal(traveler.tribe,trip.to);assert.equal(traveler.household,host.household);
  assert.deepEqual(crossVillageParents(traveler,host),[trip.from,trip.to]);assert.equal(s.villagers.length,beforePeople);
  assert.equal(s.food+s.villagers.reduce((n,v)=>n+(v.travelMeals||0),0),beforeFood,'packing moves meals rather than creating food');
  assert.ok(s.villagers.every(v=>(v.travelMeals||0)<=3),'repeat visits top up the same small travel packet');
});
test('children of a couple introduced through visits retain both parents and their communities',()=>{
  let s=neighbors();const {first}=meetTwice(s);s=deserialize(serialize(s),rules);
  const joined=s.villagers.find(v=>v.id===first.traveler);assert.equal(joined.tribe,first.to);
  s.birthCounter=2;s=stepDay(s);const child=s.villagers.find(v=>v.id===s.lastDay.birth);
  assert.ok(child);assert.deepEqual(new Set(child.parents),new Set([first.traveler,first.host]));
  assert.deepEqual(child.parentCommunities,[first.from,first.to]);assert.equal(s.local.communication.crossVillageBirths,1);
});
test('parents can remain in different villages after actual visits, with one family opportunity per fresh meeting',()=>{
  let s=neighbors();const dependent=structuredClone(s.villagers[2]);dependent.id=9;dependent.age=2;dependent.carers=[3];dependent.household=3;
  s.villagers.push(dependent);s.nextId=10;
  const {first}=meetTwice(s);assert.equal(s.local.communication.householdMoves,0,'the host keeps caring for their existing child');
  visitDay(s);s.day+=2;s.birthCounter=2;
  const mother=s.villagers.find(v=>v.id===first.traveler),father=s.villagers.find(v=>v.id===first.host);
  assert.equal(recentVillagePartner(s,mother,father),true);
  s=stepDay(s);const child=s.villagers.find(v=>v.id===s.lastDay.birth);assert.ok(child);
  assert.deepEqual(child.parents,[first.traveler,first.host]);assert.equal(child.tribe,first.from);
  assert.notEqual(s.villagers.find(v=>v.id===first.traveler).tribe,s.villagers.find(v=>v.id===first.host).tribe);
  assert.equal(recentVillagePartner(s,s.villagers.find(v=>v.id===first.traveler),s.villagers.find(v=>v.id===first.host)),false);
});
test('neighbor communication does not permit siblings to form a reproductive household',()=>{
  const s=neighbors();for(const v of s.villagers)v.parents=[100,101];meetTwice(s);
  assert.equal(s.local.communication.householdMoves,0);assert.equal(s.local.communication.meetings,2);
});
test('a neighbor can teach a practised technique through repeated meetings, with recipe prerequisites',()=>{
  const s=neighbors(),student=s.villagers[0],teacher=s.villagers[2];student.practice.properties=['flexible'];teacher.practice.known.cordage=1;teacher.practice.used.cordage=3;
  visitDay(s);visitDay(s);assert.equal(student.practice.known.cordage,undefined);visitDay(s);
  s.day=s.local.nextNeighborDay-1;visitDay(s);visitDay(s);assert.equal(student.practice.known.cordage,1);assert.equal(s.local.communication.lessons,1);
  const gated=neighbors();gated.villagers[2].practice.known.cordage=1;gated.villagers[2].practice.used.cordage=3;meetTwice(gated);
  assert.equal(gated.villagers[0].practice.known.cordage,undefined,'a missing material property cannot be skipped by teaching');
});
test('urgent needs, floods and sole childcare duties take priority over optional trips',()=>{
  for(const reason of ['food','cold','illness','energy','flood']){
    const s=neighbors();
    for(const v of s.villagers){if(reason==='food'){s.food=0;v.fullness=5;}if(reason==='cold')v.warmth=5;if(reason==='illness')v.illnessDays=2;if(reason==='energy')v.practice.energy=0;}
    if(reason==='flood')s.lastUsed.flood=s.day+1;const report=visitDay(s);assert.equal(report.actions.length,0,reason);assert.equal(s.local.campVisit,undefined);
  }
  const s=neighbors(),child=structuredClone(s.villagers[0]);child.id=9;child.age=2;child.carers=[1];s.villagers.push(child);visitDay(s);
  assert.notEqual(s.local.campVisit?.traveler,1,'a sole carer may host a healthy visitor but cannot leave the child');
});
test('a saved journey resumes deterministically; a missing host does not conjure a meeting',()=>{
  const s=neighbors();visitDay(s);const loaded=deserialize(serialize(s),rules);visitDay(s);visitDay(loaded);
  assert.deepEqual(loaded.local.campVisit,s.local.campVisit);assert.deepEqual(loaded.local.communication,s.local.communication);
  const abandoned=neighbors();visitDay(abandoned);const host=abandoned.local.campVisit.host;abandoned.villagers=abandoned.villagers.filter(v=>v.id!==host);visitDay(abandoned);
  assert.equal(abandoned.local.campVisit,undefined);assert.equal(abandoned.local.communication,undefined);assert.ok(abandoned.villagers.every(v=>!v.campJourney));
});
