import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,stepDay,readyToInvent,foodCapacity} from '../src/sim.js';
import {HOMESTEAD_RULES} from './fixtures/eating-profile.js';
import {practices,canExperiment,makePracticeProduct,finishOrdinaryWork,buildingSiteTree,clearBuildingTree,completeHusbandryLessons,worldTrees,planLessons,hutBuildingSite} from '../src/practices.js';
import {husbandryWork,beginHusbandryDay,finishHusbandryDay,livestockKinds,villageLivestock,animalRelated,slaughterLivestock,transferLivestockOwnership,cattleFieldWork,husbandryIds,canLeaveLivestock,chooseLivestockSite,livestockBuildingRules,livestockSiteObstructed,livestockPen} from '../src/husbandry.js';
import {householdHutSite,builtHutSite} from '../src/settlement-layout.js';
import {buildingPatches} from '../src/ecology.js';
import {boneHarvestBonus} from '../src/farming.js';
import {serialize,deserialize} from '../src/save.js';
import {rememberCollection} from '../src/collection.js';
import {foodLedger,foodDaysFor} from '../src/provisions.js';

const livestockTestRules={...HOMESTEAD_RULES,traits:false,learning:{...HOMESTEAD_RULES.learning,climate:false,experimentChance:100},limits:{stock:600}};
const livestockDeps={finish:finishOrdinaryWork,recipes:practices,canExperiment,siteTree:()=>null,clear:clearBuildingTree,foodCapacity};
function stockWorld(){
  const s=createState(livestockTestRules,51);s.day=101;s.food=250;s.wood=80;s.fireKnown=s.fireLit=true;
  Object.assign(s.local,{season:'Spring',lastWinterFood:{home:4},reaches:2,harvests:3});
  Object.assign(s.local.stock,{fibre:40,hide:20,wheat:80,hay:200});s.farming.known=true;s.farming.plots=[null,null,null,null];s.farming.wheatHarvests=2;
  s.toolkit=['stone blades','hand axe','hammer stone','mallet & chisel'];s.textiles=['cordage'];
  for(const v of s.villagers){v.fullness=v.warmth=v.health=100;v.lastCompanyDay=s.day;v.illnessDays=0;v.tribe=0;v.practice.energy=100;v.practice.skills={berries:8,wood:8,hide:8,fibre:8,stone:8};v.practice.properties=['rigid','flexible','insulating','perishable','fractures'];
    Object.assign(v.practice.known,{cordage:1,housing:1,knapping:1,shaping:1});v.practice.gear['cutting tool']=true;v.practice.gear['clay vessel']=true;v.practice.herderVisits=1;v.practice.husbandryDays=12;v.practice.farmingDays=10;}
  s.local.husbandry.contacts.herders={day:90,visits:1};
  s.local.husbandry.nextTradeDay=10000;
  return s;
}
function stockPen(s){const p={id:'pen-0',camp:0,ownerId:s.villagers[0].id,keeperId:s.villagers[0].id,site:[120,220],work:4,shelterWork:5,careDay:s.day,dung:0,grass:60,mast:40,mud:0};s.local.husbandry.pens.push(p);return p;}
function stockAnimal(s,pen,species='sheep',sex='female'){
  const a=s.local.husbandry.animals.find(a=>a.species===species&&a.sex===sex&&a.location==='regional');
  Object.assign(a,{location:'village',penId:pen.id,ownerId:pen.ownerId,keeperId:pen.keeperId,acquiredDay:s.day-100,health:100,condition:100,fedDays:5,age:Math.ceil(livestockKinds[species].adult*80)+10});
  return a;
}
function stockReport(s){const r={actions:[],gatheredFood:0,gatheredWood:0};beginHusbandryDay(s,r);return r;}
function knowStock(v,...ids){for(const id of ids)v.practice.known[id]=1;}
test('actual paid care records a pasture journey; winter care stays at the enclosure',()=>{
  for(const season of ['Spring','Winter']){
    const s=stockWorld(),pen=stockPen(s),v=s.villagers[0];stockAnimal(s,pen);knowStock(v,'herding','penbuilding');
    s.local.season=season;pen.careDay=s.day-3;const energy=v.practice.energy,r=stockReport(s);
    assert.ok(husbandryWork(s,v,1000,r,livestockDeps));assert.equal(r.actions.length,1);assert.ok(v.practice.energy<energy);
    if(season==='Spring'){assert.ok(pen.grazing);assert.deepEqual(r.actions[0].site,pen.grazing.site);assert.notDeepEqual(pen.grazing.site,pen.site);}
    else assert.equal(pen.grazing,undefined);
  }
});
function obstructedStockWorld(){
  const s=stockWorld(),pen=stockPen(s),v=s.villagers[0];s.huts=Array(5).fill(0);s.hutDetails=s.huts.map(()=>({shape:'dome hut'}));
  pen.site=[332,174];pen.enclosureMaterials={wood:6,fibre:3};pen.shelterMaterials={wood:8,fibre:4,hide:1};
  knowStock(v,'herding','penbuilding','haymaking','stockshelter');stockAnimal(s,pen);stockAnimal(s,pen,'sheep','male');return s;
}

test('saved overlapping pens are rebuilt with materials and separate workdays before moving animals and dismantling',()=>{
  const s=obstructedStockWorld(),h=s.local.husbandry,old=h.pens[0],v=s.villagers[0],ids=villageLivestock(s).map(a=>a.id);
  const stores={wood:s.wood,fibre:s.local.stock.fibre,hide:s.local.stock.hide},houses=structuredClone(s.hutDetails),actions=[];
  assert.ok(livestockSiteObstructed(s,old));
  for(let day=0;day<11;day++){
    v.practice.energy=100;old.careDay=s.day;const r=stockReport(s);assert.ok(husbandryWork(s,v,1000,r,livestockDeps));assert.equal(r.actions.length,1);actions.push(v.activity);
    if(day<9){assert.ok(villageLivestock(s).every(a=>a.penId===old.id));assert.equal(old.retiredDay,undefined);}
    s.day++;
  }
  const replacement=livestockPen(s,0);assert.notEqual(replacement.id,old.id);assert.equal(livestockSiteObstructed(s,replacement),false);
  assert.equal(replacement.work,4);assert.equal(replacement.shelterWork,5);assert.equal(old.work,4);assert.equal(old.shelterWork,5,'historical work retained');
  assert.ok(old.dismantledDay);assert.equal(h.relocations.length,1);assert.equal(actions[9],'Lead livestock to replacement enclosure');assert.equal(actions[10],'Dismantle obstructed livestock enclosure');
  assert.equal(s.wood,stores.wood-14+7);assert.equal(s.local.stock.fibre,stores.fibre-7);assert.equal(s.local.stock.hide,stores.hide-1);
  assert.deepEqual(villageLivestock(s).map(a=>a.id),ids);assert.ok(villageLivestock(s).every(a=>a.penId===replacement.id));assert.deepEqual(s.hutDetails,houses);
  assert.ok(!buildingPatches(s,[[227,222],[802,433],[702,153]]).some(p=>p.kind==='pen'&&p.site===old.site));
});
test('replacement construction pauses for hunger and survives save/load and a builder death',()=>{
  let s=obstructedStockWorld(),v=s.villagers[0],old=s.local.husbandry.pens[0];
  assert.ok(husbandryWork(s,v,1000,stockReport(s),livestockDeps));
  s.day++;v.fullness=0;const pausedReport=stockReport(s),project=structuredClone(s.local.husbandry.pens[1]);
  assert.equal(husbandryWork(s,v,1000,pausedReport,livestockDeps),false);assert.deepEqual(s.local.husbandry.pens[1],project);
  s=deserialize(serialize(s),livestockTestRules);assert.equal(s.local.husbandry.pens[1].work,1);assert.ok(s.local.husbandry.pens[1].pending);
  const deadId=s.villagers[0].id;s.villagers=s.villagers.filter(p=>p.id!==deadId);v=s.villagers[0];knowStock(v,'herding','penbuilding','haymaking','stockshelter');
  const ids=villageLivestock(s).map(a=>a.id);
  for(let day=0;day<18&&s.local.husbandry.pens[0].dismantledDay===undefined;day++){s.day++;v.practice.energy=100;s.local.husbandry.pens[0].careDay=s.day;husbandryWork(s,v,1000,stockReport(s),livestockDeps);}
  assert.ok(s.local.husbandry.pens[0].dismantledDay);assert.deepEqual(villageLivestock(s).map(a=>a.id),ids);assert.notEqual(livestockPen(s,0).ownerId,deadId);
});
test('relocation clears actual trees as paid work before constructing and never moves a saved site for free',()=>{
  const s=obstructedStockWorld(),v=s.villagers[0],wood=s.wood;
  const r=stockReport(s);assert.ok(husbandryWork(s,v,1000,r,{...livestockDeps,siteTree:buildingSiteTree}));
  const replacement=s.local.husbandry.pens.find(p=>p.pending);assert.ok(replacement);assert.equal(villageLivestock(s)[0].penId,s.local.husbandry.pens[0].id);
  if(v.activity==='Clear livestock building site'){assert.equal(replacement.work,0);assert.ok(replacement.clearedTrees.length);assert.ok(s.wood>wood);}
  else assert.equal(replacement.work,1);
  const before=structuredClone(replacement.site);s.day++;beginHusbandryDay(s,{actions:[]});assert.deepEqual(replacement.site,before);
});
test('ordinary autonomous days recover an overlapping saved enclosure without god commands',()=>{
  let s=obstructedStockWorld();s.config.birth.consecutiveDays=10000;s.config.illness.chance=0;
  const houses=structuredClone(s.hutDetails),oldId=s.local.husbandry.pens[0].id;
  // The paid recovery competes with fuel, meals and genuine learning. Allow
  // two compressed years, rather than relying on the former free practice.
  for(let day=0;day<8*s.config.learning.seasonLength&&!s.ended&&s.local.husbandry.pens[0].dismantledDay===undefined;day++){
    const before=s;s=stepDay(s);
    for(let i=0;i<houses.length;i++)for(const key of ['shape','wall','chimney','ondol'])if(before.hutDetails[i]?.[key]!==s.hutDetails[i]?.[key]){
      const fitting=key==='shape'||key==='wall'?s.hutDetails[i][key]:key;
      assert.ok(s.lastDay.actions.some(a=>a.action==='Build '+fitting),'houses change only through actual NPC improvements');
    }
  }
  const old=s.local.husbandry.pens.find(p=>p.id===oldId);assert.ok(old.dismantledDay,'existing daily decisions must actually perform the recovery');
  assert.ok(s.local.husbandry.relocations.length);assert.equal(livestockSiteObstructed(s,livestockPen(s,0)),false);
  assert.deepEqual(s.hutDetails.slice(0,houses.length).map(h=>h.site),houses.map(h=>h.site));
});

test('new worlds contain no village animals or free structures; off-map stock is finite',()=>{
  const s=createState(HOMESTEAD_RULES,7);assert.equal(villageLivestock(s).length,0);assert.equal(s.local.husbandry.pens.length,0);
  assert.equal(s.local.husbandry.animals.length,12);assert.equal(s.local.husbandry.contacts.herders,undefined);
  assert.equal(createState({...HOMESTEAD_RULES,learning:{...HOMESTEAD_RULES.learning,husbandry:false}},7).local.husbandry,undefined);
});
test('new pen sites reserve homes, crops and existing buildings instead of using a fixed offset',()=>{
  const s=stockWorld();s.huts=[0,0,0,0,0,1,1,2];
  s.local.healerHome={home:[120,120],work:6};s.local.campStores[0]={built:true,rackSites:[[309,270]]};
  const before=JSON.stringify(s),site=chooseLivestockSite(s,0);assert.ok(site);assert.equal(JSON.stringify(s),before);
  for(let i=0;i<8;i++){const home=householdHutSite([227,222],i);assert.ok(Math.hypot((site[0]-home[0])/62,(site[1]-home[1])/55)>=1);}
  assert.ok(Math.hypot((site[0]-309)/52,(site[1]-270)/42)>=1);
  assert.ok(Math.hypot((site[0]-120)/75,(site[1]-120)/65)>=1);
});
test('due pregnancies resolve without waiting for fresh hay, care or a completed winter roof',()=>{
  for(const problem of ['hay','care','roof']){
    const s=stockWorld(),pen=stockPen(s),mother=stockAnimal(s,pen),father=stockAnimal(s,pen,'sheep','male');knowStock(s.villagers[0],'herding');
    mother.pregnancy={fatherId:father.id,due:s.day};
    if(problem==='hay')s.local.stock.hay=0;
    if(problem==='care')pen.careDay=s.day-3;
    if(problem==='roof'){s.local.season='Winter';pen.shelterWork=0;}
    const r=stockReport(s);finishHusbandryDay(s,r);
    assert.equal(r.livestock.births.length,1,problem);assert.equal(mother.pregnancy,undefined);
    const restored=deserialize(serialize(s),livestockTestRules);assert.equal(restored.local.husbandry.animals.filter(a=>a.motherId===mother.id).length,1);
  }
});
test('urgent human hunger is not displaced by animal care when the herd cannot supply supper',()=>{
  const s=stockWorld(),pen=stockPen(s),v=s.villagers[0],young=stockAnimal(s,pen);knowStock(v,'herding');
  young.age=10;s.food=0;pen.careDay=s.day-3;v.fullness=40;
  const r=stockReport(s),before=pen.careDay;
  assert.equal(husbandryWork(s,v,1000,r,livestockDeps,{careOnly:true,urgent:true}),false);
  assert.equal(pen.careDay,before);assert.equal(r.actions.length,0,'villager remains available for ordinary food work');
});
test('the sole trained keeper cannot leave an existing herd for a trading journey',()=>{
  const s=stockWorld(),pen=stockPen(s),v=s.villagers[0];stockAnimal(s,pen);knowStock(v,...husbandryIds);
  pen.site=[332,174];s.local.husbandry.nextTradeDay=0;pen.careDay=s.day;
  Object.assign(s.local.stock,{wool:24,woolYarn:24,woolCloth:16});for(const person of s.villagers)person.practice.gear['wool wrap']=true;
  const r=stockReport(s),food=s.food;husbandryWork(s,v,1000,r,livestockDeps);
  assert.equal(s.local.husbandry.journey,undefined);assert.equal(s.food,food);
  knowStock(s.villagers[1],'herding');v.practice.energy=100;
  assert.ok(husbandryWork(s,v,1000,stockReport(s),livestockDeps));assert.equal(s.local.husbandry.journey?.travelerId,v.id,'a replacement keeper makes the same trip possible');
});
test('later houses choose and retain a site outside an existing pen; legacy buildings keep their places',()=>{
  const s=stockWorld(),v=s.villagers[0],camps=[[227,222],[802,433],[702,153]];
  s.huts=Array(9).fill(0);s.hutDetails=s.huts.map(()=>({shape:'round hut'}));
  const legacy=householdHutSite(camps[0],4),original=householdHutSite(camps[0],9);
  const pen=stockPen(s);pen.site=original.slice();
  assert.deepEqual(builtHutSite(s,camps,0,4),legacy);
  const proposal=hutBuildingSite(s,v);assert.equal(proposal.blocked,false);assert.notDeepEqual(proposal.site,original);
  assert.ok(Math.hypot((proposal.site[0]-original[0])/68,(proposal.site[1]-original[1])/60)>=1);
  s.hutProject={camp:0,index:9,work:1,site:proposal.site.slice()};
  worldTrees(s).forEach((tree,id)=>{if(Math.hypot((tree[0]-proposal.site[0])/26,(tree[1]-proposal.site[1])/24)<1)(s.local.stumps??={})[id]=s.day;});
  const next=stepDay(s);assert.ok(Object.values(next.lastDay.hutSites||{}).some(job=>job.site?.[0]===proposal.site[0]&&job.site?.[1]===proposal.site[1]),'builder report carries the exact chosen site to the renderer');
  const restored=deserialize(serialize(s),livestockTestRules);assert.deepEqual(hutBuildingSite(restored,restored.villagers[0]).site,proposal.site);
  assert.deepEqual(builtHutSite(restored,camps,0,9),proposal.site);
  assert.ok(buildingPatches(restored,camps).some(p=>p.kind==='hut'&&p.site[0]===proposal.site[0]&&p.site[1]===proposal.site[1]));
  restored.huts.push(0);restored.hutDetails.push({shape:'round hut',site:proposal.site});restored.hutProject=null;
  assert.deepEqual(builtHutSite(restored,camps,0,9),proposal.site);
});
test('surplus management respects the configured enclosure capacity',()=>{
  const s=stockWorld(),pen=stockPen(s),v=s.villagers[0];knowStock(v,'herding');
  const first=stockAnimal(s,pen);for(let i=0;i<3;i++)s.local.husbandry.animals.push({...first,id:100+i,motherId:null});
  const capacity=livestockBuildingRules.enclosure.capacity;livestockBuildingRules.enclosure.capacity=3;
  try {const r=stockReport(s);assert.ok(husbandryWork(s,v,1000,r,livestockDeps));assert.equal(villageLivestock(s).length,3);assert.match(v.activity,/^Slaughter /);}
  finally {livestockBuildingRules.enclosure.capacity=capacity;}
});
test('discovery requires personal observations, prerequisites, real materials and a winter',()=>{
  const s=stockWorld(),v=s.villagers[0];assert.ok(canExperiment(s,v,practices.herding));
  v.practice.herderVisits=0;assert.equal(canExperiment(s,v,practices.herding),false);v.practice.observedLivestockDays=2;assert.ok(canExperiment(s,v,practices.herding));
  s.local.stock.fibre=0;assert.equal(canExperiment(s,v,practices.herding),false);s.local.stock.fibre=40;
  delete s.local.lastWinterFood;assert.equal(readyToInvent(s,'herding practice'),false);
  assert.equal(canExperiment(s,v,practices.herding),false);
});
test('generic crafting never manufactures livestock buildings or dairy from knowledge alone',()=>{
  const s=stockWorld(),v=s.villagers[0],before=structuredClone(s.local.husbandry);
  for(const id of ['herding','penbuilding','stockshelter','milking','curdling','woolweaving','oxtraining']){knowStock(v,id);assert.equal(makePracticeProduct(s,v,id),false);}
  assert.deepEqual(s.local.husbandry,before);assert.equal(s.local.stock.milk,0);
});
test('enclosure construction pays once, takes four real workdays and only collects on completion',()=>{
  const s=stockWorld(),v=s.villagers[0];knowStock(v,'herding','penbuilding','haymaking','stockshelter');
  const initial={wood:s.wood,fibre:s.local.stock.fibre};
  for(let i=0;i<4;i++){v.practice.energy=100;const r=stockReport(s);assert.ok(husbandryWork(s,v,0,r,livestockDeps));assert.equal(r.actions.length,1);rememberCollection(s,practices);if(i<3)assert.equal(s.local.collection['animal enclosure'],undefined);s.day++;}
  const pen=s.local.husbandry.pens[0];assert.equal(pen.work,4);assert.equal(s.wood,initial.wood-6);assert.equal(s.local.stock.fibre,initial.fibre-3);assert.ok(s.local.collection['animal enclosure']);assert.equal(pen.shelterWork,0);
});
test('actual construction clears only its small footprint and preserves unfinished projects after death/load',()=>{
  const s=stockWorld(),v=s.villagers[0];knowStock(v,'herding','penbuilding','haymaking');const r=stockReport(s);
  husbandryWork(s,v,0,r,{...livestockDeps,siteTree:buildingSiteTree});const pen=s.local.husbandry.pens[0];assert.ok(pen);
  for(const tree of pen.clearedTrees||[]){const t=worldTrees(s)[tree];assert.ok(Math.hypot((t[0]-pen.site[0])/39,(t[1]-pen.site[1])/28)<1);}
  s.villagers=s.villagers.filter(p=>p!==v);const restored=deserialize(serialize(s),livestockTestRules);assert.deepEqual(restored.local.husbandry.pens[0],pen);
});
test('hunger, cold, illness and exhaustion interrupt work without destroying a paid project',()=>{
  for(const kind of ['fullness','warmth','health','energy','illness']){
    const s=stockWorld(),v=s.villagers[0],pen=stockPen(s);pen.work=2;knowStock(v,'herding','penbuilding');
    if(kind==='energy')v.practice.energy=0;else if(kind==='illness')v.illnessDays=1;else v[kind]=0;
    const r=stockReport(s),before=structuredClone(pen);assert.equal(husbandryWork(s,v,0,r,livestockDeps),false);assert.deepEqual(pen,before);assert.equal(r.actions.length,0);
  }
});
test('hay consumes finite meadow grass and needs three dry days; wet bundles can fail',()=>{
  const s=stockWorld(),v=s.villagers[0],pen=stockPen(s);knowStock(v,'herding','penbuilding','haymaking','stockshelter');s.local.stock.hay=0;
  const r=stockReport(s),grass=pen.hayMeadow;assert.ok(husbandryWork(s,v,1000,r,livestockDeps));assert.equal(v.activity,'Cut and bundle winter hay');assert.equal(pen.hayMeadow,grass-8);assert.equal(s.local.stock.hay,0);
  for(let i=0;i<3;i++){s.day++;stockReport(s);}assert.equal(s.local.stock.hay,8);
  s.local.husbandry.batches=[{amount:8,site:pen.site,day:s.day,dryDays:0,wetDays:0}];s.local.climate={mm:12};
  for(let i=0;i<7;i++){s.day++;stockReport(s);}assert.equal(s.local.stock.hay,8);assert.equal(s.local.husbandry.batches.length,0);
});
test('winter feeding spends hay and pigs cannot eat hay or the human food and seed reserves',()=>{
  const s=stockWorld(),pen=stockPen(s),v=s.villagers[0];knowStock(v,'herding');const sheep=stockAnimal(s,pen),pig=stockAnimal(s,pen,'pig');s.local.season='Winter';pen.grass=pen.mast=0;s.local.stock.hay=20;s.local.stock.wheat=3;
  const r=stockReport(s),food=s.food;finishHusbandryDay(s,r);assert.equal(s.local.stock.hay,19);assert.equal(sheep.lastFed,1);assert.equal(pig.lastFed,0);assert.equal(s.local.stock.wheat,3);assert.equal(s.food,food);
});
test('sheep still graze when care is missed, but prolonged lack of water damages health',()=>{
  const s=stockWorld(),pen=stockPen(s),a=stockAnimal(s,pen);pen.careDay=s.day-10;const r=stockReport(s);finishHusbandryDay(s,r);assert.equal(a.lastFed,1);assert.ok(a.health<100);
  s.local.season='Winter';s.day++;const winter=stockReport(s);finishHusbandryDay(s,winter);assert.equal(a.lastFed,0);assert.ok(a.condition<100);
});
test('breeding needs adults of both sexes, safe condition, care and capacity; births retain both parents',()=>{
  const s=stockWorld(),pen=stockPen(s),mother=stockAnimal(s,pen),father=stockAnimal(s,pen,'sheep','male');knowStock(s.villagers[0],'herding');s.local.season='Autumn';s.day=54;pen.careDay=s.day;
  let r=stockReport(s);finishHusbandryDay(s,r);assert.equal(mother.pregnancy.fatherId,father.id);assert.equal(mother.milkAvailable,0);
  s.day=mother.pregnancy.due;pen.careDay=s.day;s.local.season='Spring';r=stockReport(s);finishHusbandryDay(s,r);
  const young=villageLivestock(s).find(a=>a.motherId===mother.id);assert.ok(young);assert.equal(young.fatherId,father.id);assert.equal(r.livestock.births.length,1);assert.ok(mother.lactatingUntil>s.day);
  assert.ok(animalRelated(mother,young));assert.ok(animalRelated(father,young));
});
test('milk requires a fed lactating mother, collection work and vessels; it cannot be collected twice',()=>{
  const s=stockWorld(),pen=stockPen(s),a=stockAnimal(s,pen),v=s.villagers[0];knowStock(v,'herding','penbuilding','haymaking','stockshelter','milking');
  let r=stockReport(s);finishHusbandryDay(s,r);assert.equal(a.milkAvailable,0);
  a.lactatingUntil=s.day+12;a.nursingUntil=s.day+3;finishHusbandryDay(s,r);assert.equal(a.milkAvailable,2);
  assert.ok(husbandryWork(s,v,1000,r,livestockDeps));assert.equal(s.local.stock.milk,2);assert.equal(a.milkAvailable,0);
  delete s.local.husbandry.workedDay;v.practice.energy=100;husbandryWork(s,v,1000,r,livestockDeps);assert.equal(s.local.stock.milk,2);
  for(let i=0;i<3;i++){s.day++;stockReport(s);}assert.equal(s.local.stock.milk,0);
});
test('curds consume fresh milk and fuel in a separate workday and enter the finished-food ledger once',()=>{
  const s=stockWorld(),pen=stockPen(s),v=s.villagers[0];stockAnimal(s,pen);knowStock(v,'herding','penbuilding','haymaking','stockshelter','milking','curdling');
  s.local.stock.milk=4;s.local.husbandry.milkBatches=[{amount:4,day:s.day}];let r=stockReport(s),food=s.food,wood=s.wood;
  const ledger=foodLedger(s).home;assert.ok(husbandryWork(s,v,1000,r,livestockDeps));assert.equal(s.local.stock.milk,0);assert.equal(s.local.stock.curds,3);assert.equal(s.food,food);assert.equal(s.wood,wood-1);
  assert.equal(foodLedger(s).home,ledger+3);assert.equal(r.gatheredFood,3);
});
test('slaughter consumes one living animal once, grants finite products and keeps its history',()=>{
  const s=stockWorld(),pen=stockPen(s),a=stockAnimal(s,pen),v=s.villagers[0];knowStock(v,'herding');const r=stockReport(s),food=s.food;
  assert.ok(slaughterLivestock(s,v,a,r,livestockDeps));assert.equal(a.status,'dead');assert.equal(a.deathCause,'slaughtered');assert.equal(s.food,food+24);assert.equal(s.local.stock.bone,2);assert.equal(slaughterLivestock(s,v,a,r,livestockDeps),false);
  assert.ok(s.local.husbandry.animals.includes(a));
});
test('livestock and buildings survive a caretaker death; succession does not confer skill',()=>{
  const s=stockWorld(),pen=stockPen(s),a=stockAnimal(s,pen),owner=s.villagers[0],child=s.villagers[1];child.parents=[owner.id];delete child.practice.known.herding;
  s.villagers=s.villagers.filter(v=>v!==owner);transferLivestockOwnership(s);assert.equal(pen.ownerId,child.id);assert.equal(a.ownerId,child.id);assert.equal(pen.work,4);assert.equal(a.status,'alive');assert.equal(child.practice.known.herding,undefined);
});
test('wool processing requires actual spindle, loom and paid inputs before clothing exists',()=>{
  const s=stockWorld(),pen=stockPen(s),v=s.villagers[0];knowStock(v,'herding','penbuilding','haymaking','stockshelter','woolspinning','woolweaving','woolclothing');s.local.stock.wool=4;
  let r=stockReport(s);husbandryWork(s,v,1000,r,livestockDeps);assert.equal(s.local.stock.woolYarn,0);s.textiles.push('drop spindle');
  s.day++;v.practice.energy=100;r=stockReport(s);husbandryWork(s,v,1000,r,livestockDeps);assert.equal(s.local.stock.woolYarn,2);assert.equal(s.local.stock.wool,2);assert.equal(s.local.stock.woolCloth,0);
  s.textiles.push('loom');s.local.stock.wool=0;s.local.stock.woolYarn=4;
  for(let i=0;i<2;i++){s.day++;v.practice.energy=100;r=stockReport(s);husbandryWork(s,v,1000,r,livestockDeps);}assert.equal(s.local.stock.woolCloth,2);
  s.local.stock.bone=2;s.day++;v.practice.energy=100;r=stockReport(s);husbandryWork(s,v,1000,r,livestockDeps);assert.equal(v.practice.gear['wool wrap'],true);assert.equal(s.local.stock.woolCloth,0);assert.equal(s.local.stock.bone,1);
});
test('manure matures before application and improves only two actual harvests',()=>{
  const s=stockWorld(),pen=stockPen(s),v=s.villagers[0];knowStock(v,'herding','penbuilding','haymaking','stockshelter','composting');pen.dung=4;
  let r=stockReport(s);husbandryWork(s,v,1000,r,livestockDeps);assert.equal(pen.dung,0);assert.equal(s.local.stock.compost,0);assert.equal(s.local.husbandry.compost[0].amount,2);assert.equal(boneHarvestBonus(s,0),0);
  s.day+=20;v.practice.energy=100;r=stockReport(s);husbandryWork(s,v,1000,r,livestockDeps);assert.equal(s.local.stock.compost,1,JSON.stringify(r.actions));assert.equal(boneHarvestBonus(s,0),0);
  s.day+=4;assert.equal(boneHarvestBonus(s,0),1);assert.equal(boneHarvestBonus(s,0),1);assert.equal(boneHarvestBonus(s,0),0);
});
test('lessons require the actual teacher workday and never bypass personal prerequisites',()=>{
  const s=stockWorld(),student=s.villagers[0],teacher=s.villagers[1];knowStock(teacher,'herding');teacher.practice.used.herding=5;
  const lesson={studentId:student.id,teacherId:teacher.id,id:'herding',key:'herding-test'};
  completeHusbandryLessons(s,{husbandryLessons:[lesson],actions:[{id:student.id,action:'Learn from '+teacher.name}]});assert.equal(student.practice.known.herding,undefined);
  const r={husbandryLessons:[lesson],actions:[{id:student.id,action:'Learn from '+teacher.name},{id:teacher.id,action:'Teach Animal keeping'}]};
  completeHusbandryLessons(s,r);completeHusbandryLessons(s,r);assert.equal(student.practice.known.herding,1);
});
test('cattle traction needs trained, healthy, fed cattle and never creates a field or seeds',()=>{
  const s=stockWorld(),pen=stockPen(s),v=s.villagers[0],a=stockAnimal(s,pen,'cattle','male');knowStock(v,'herding','oxtraining');a.age=180;a.lastFed=1;
  assert.equal(cattleFieldWork(s,v),0);a.yoked=true;const plots=s.farming.plots.length;assert.equal(cattleFieldWork(s,v),1);assert.equal(cattleFieldWork(s,v),0);assert.equal(s.farming.plots.length,plots);
});
test('save/load preserves animals, ancestry, pregnancies, projects and the next deterministic day',()=>{
  const s=stockWorld(),pen=stockPen(s),a=stockAnimal(s,pen);knowStock(s.villagers[0],'herding');a.pregnancy={fatherId:2,conceivedDay:90,due:120};pen.shelterWork=3;
  const restored=deserialize(serialize(s),livestockTestRules);assert.ok(restored);assert.deepEqual(restored.local.husbandry,s.local.husbandry);
  const x=stepDay(s),y=stepDay(restored);assert.deepEqual(x.local.husbandry,y.local.husbandry);assert.equal(x.rng,y.rng);assert.equal(x.traitRng,y.traitRng);
  const old=JSON.parse(serialize(s));delete old.run.local.husbandry;const migrated=deserialize(JSON.stringify(old),livestockTestRules);assert.ok(migrated);assert.equal(villageLivestock(migrated).length,0);assert.equal(migrated.local.husbandry.pens.length,0);assert.equal(migrated.villagers[0].practice.known.herding,1);
});
test('a paid three-day exchange transfers real animals, retains a regional breeding pair and cannot duplicate them',()=>{
  const s=stockWorld(),pen=stockPen(s),v=s.villagers[0];knowStock(v,...husbandryIds);s.local.husbandry.nextTradeDay=0;
  const food=s.food,ids=s.local.husbandry.animals.map(a=>a.id);
  for(let i=0;i<3;i++){v.practice.energy=100;const r=stockReport(s);assert.ok(husbandryWork(s,v,1000,r,livestockDeps));assert.equal(r.actions.length,1);if(i<2)assert.equal(villageLivestock(s).length,0);s.day++;}
  assert.equal(villageLivestock(s).length,2);assert.equal(s.food,food-3-10);assert.equal(v.travelMeals,3);assert.deepEqual(s.local.husbandry.animals.map(a=>a.id),ids);
  assert.equal(animalRelated(...villageLivestock(s)),false);
  assert.equal(s.local.husbandry.animals.filter(a=>a.location==='regional'&&a.species==='sheep').length,2);assert.ok(villageLivestock(s).every(a=>a.penId===pen.id));
});
test('failed trade cannot create animals, spend the quoted price or remove pregnancies',()=>{
  const s=stockWorld(),pen=stockPen(s),v=s.villagers[0];knowStock(v,...husbandryIds);
  for(const a of s.local.husbandry.animals.filter(a=>a.species==='sheep'&&a.sex==='female'))a.pregnancy={fatherId:1,due:200};
  s.local.husbandry.journey={travelerId:v.id,stage:'return',species:'sheep'};const food=s.food,r=stockReport(s);
  husbandryWork(s,v,1000,r,livestockDeps);assert.equal(villageLivestock(s).length,0);assert.equal(s.food,food);assert.ok(s.local.husbandry.animals.filter(a=>a.species==='sheep'&&a.sex==='female').every(a=>a.pregnancy));assert.equal(v.activity,'Return from distant herders');
});
test('unweaned offspring need their mother; abundant hay cannot replace nursing automatically',()=>{
  const s=stockWorld(),pen=stockPen(s),mother=stockAnimal(s,pen),v=s.villagers[0];knowStock(v,'herding');
  const baby={...structuredClone(mother),id:s.local.husbandry.nextId++,name:'Lamb',age:1,motherId:mother.id,fatherId:1,lactatingUntil:-1};s.local.husbandry.animals.push(baby);
  mother.lactatingUntil=s.day+20;let r=stockReport(s);finishHusbandryDay(s,r);assert.equal(baby.lastFed,1);
  mother.status='dead';s.day++;pen.careDay=s.day;r=stockReport(s);finishHusbandryDay(s,r);assert.equal(baby.lastFed,0);assert.ok(baby.condition<100);
});
test('a successor learns on two real paired care days with rope materials; normal work is limited per camp',()=>{
  const s=stockWorld(),pen=stockPen(s),teacher=s.villagers[0],pupil=s.villagers[1];knowStock(teacher,'herding');stockAnimal(s,pen);pupil.practice.herderVisits=0;
  const fibre=s.local.stock.fibre;
  for(let i=0;i<2;i++){
    pen.careDay=s.day-2;teacher.practice.energy=pupil.practice.energy=100;const r=stockReport(s);
    assert.ok(husbandryWork(s,teacher,1000,r,livestockDeps,{careOnly:true}));assert.ok(husbandryWork(s,pupil,1000,r,livestockDeps));
    assert.equal(r.actions.length,2);assert.equal(new Set(r.actions.map(a=>a.id)).size,2);s.day++;
  }
  assert.equal(pupil.practice.known.herding,1);assert.equal(s.local.stock.fibre,fibre-2);
});
test('the last available keeper is not booked for lessons when animals need tending',()=>{
  const s=stockWorld(),pen=stockPen(s),keeper=s.villagers[0];knowStock(keeper,'herding');keeper.practice.used.herding=8;stockAnimal(s,pen);pen.careDay=s.day-3;
  for(const v of s.villagers.slice(1)){v.practice.observedLivestockDays=3;v.practice.lastPlace=keeper.practice.lastPlace='berries';}
  planLessons(s,s.villagers);assert.ok(!keeper.practice.lessonToday);
});
test('finished curds feed villagers through the normal meal system and are counted once',()=>{
  const s=stockWorld(),v=s.villagers[0];s.villagers=[v];s.food=0;s.local.stock.curds=4;v.fullness=40;v.warmth=100;v.practice.energy=0;
  s.local.deposits.berries=0;s.local.deposits.fish=0;s.local.wildPatches=[];s.local.harvests=0;s.farming.plots=[];s.toolkit=[];s.gameAnimals=0;s.day=120;s.local.seasonOffset=20;
  assert.equal(foodLedger(s).home,4);assert.equal(foodDaysFor(s,v),4);
  const next=stepDay(s);assert.ok(next.lastDay.meals.includes(v.id));assert.equal(next.local.stock.curds,3.5);assert.equal(next.food,0);assert.equal(foodLedger(next).home,3.5);
});
test('winter pig feed is delivered even while summer mast remains on the ground',()=>{
  const s=stockWorld(),pen=stockPen(s),v=s.villagers[0],pig=stockAnimal(s,pen,'pig');knowStock(v,'herding');s.local.season='Winter';pen.careDay=s.day-3;pen.mast=45;s.local.stock.fodderGrain=0;
  const r=stockReport(s),wheat=s.local.stock.wheat;assert.ok(husbandryWork(s,v,1000,r,livestockDeps,{careOnly:true}));assert.ok(s.local.stock.wheat<wheat);assert.ok(s.local.stock.fodderGrain>=3);
  finishHusbandryDay(s,r);assert.equal(pig.lastFed,1);assert.ok(r.livestock.feed.grain>0);assert.equal(pen.mast,45);
});
test('a migration cannot leave the herd without a remaining trained caretaker',()=>{
  const s=stockWorld(),pen=stockPen(s),a=stockAnimal(s,pen),v=s.villagers[0],other=s.villagers[1];knowStock(v,'herding');
  assert.equal(canLeaveLivestock(s,v),false);knowStock(other,'herding');assert.equal(canLeaveLivestock(s,v),true);assert.equal(canLeaveLivestock(s,v,[v.id,other.id]),false);
  assert.equal(a.penId,pen.id);
});
test('routine tending can collect real available milk in the same paid care day',()=>{
  const s=stockWorld(),pen=stockPen(s),v=s.villagers[0],a=stockAnimal(s,pen,'cattle');knowStock(v,'herding','milking');pen.careDay=s.day-3;a.milkAvailable=3;
  const r=stockReport(s),energy=v.practice.energy;assert.ok(husbandryWork(s,v,1000,r,livestockDeps,{careOnly:true}));assert.equal(r.actions.length,1);assert.equal(v.activity,'Tend and milk livestock');assert.equal(s.local.stock.milk,3);assert.equal(a.milkAvailable,0);assert.equal(v.practice.energy,energy-s.config.learning.workCost);
});
test('an actual yoke needs four training days and four wood/fibre before cattle can pull',()=>{
  const s=stockWorld(),pen=stockPen(s),v=s.villagers[0],a=stockAnimal(s,pen,'cattle','male');knowStock(v,...husbandryIds,'hafting');a.age=180;const wood=s.wood,fibre=s.local.stock.fibre;
  for(let i=0;i<4;i++){v.practice.energy=100;pen.careDay=s.day;const r=stockReport(s);assert.ok(husbandryWork(s,v,0,r,livestockDeps));assert.equal(v.activity,'Train cattle to a wooden yoke');if(i<3)assert.ok(!a.yoked);s.day++;}
  assert.equal(a.yoked,true);assert.equal(s.wood,wood-4);assert.equal(s.local.stock.fibre,fibre-4);
});
test('adult sheep supply a finite seasonal fleece rather than producing wool every day',()=>{
  const s=stockWorld(),pen=stockPen(s),v=s.villagers[0],a=stockAnimal(s,pen);knowStock(v,'herding','penbuilding','haymaking','stockshelter','fleeceworking');
  const r=stockReport(s);assert.ok(husbandryWork(s,v,1000,r,livestockDeps));assert.equal(v.activity,'Gather and clean sheep fleece');assert.equal(s.local.stock.wool,2);assert.equal(a.fleeceDay,s.day);
  s.day++;v.practice.energy=100;pen.careDay=s.day;husbandryWork(s,v,1000,stockReport(s),livestockDeps);assert.equal(s.local.stock.wool,2);
});
