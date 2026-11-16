import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,stepDay,castText,recordRiverFall,encyclopediaCatalog} from '../src/sim.js';
import {HOMESTEAD_RULES} from '../src/config.js';
import {kaunasNormals,kaunasWeather,beginClimateDay,climateCropGrowth,climateMonth} from '../src/climate.js';
import {riverFallOutcome} from '../src/river.js';
import {walkRiver} from '../src/clearing.js';
import {nerisX,practices,canExperiment,makePracticeProduct,makeSupervisedFood,takeDeposit} from '../src/practices.js';
import {rememberResources,visibleResources} from '../src/resources.js';
import {rememberPerson,recordLifeDay,familyOf} from '../src/genealogy.js';
import {rememberCollection} from '../src/collection.js';
import {discoverPainting} from '../src/paintings.js';
import {serialize,deserialize} from '../src/save.js';
import {inspireVillager,naturalInspiration,inspirationBonus} from '../src/inspiration.js';

test('Kaunas monthly wet/heavy frequencies and rainfall amounts follow the published normals',()=>{
  const s=createState(HOMESTEAD_RULES,0),samples=24000;
  for(let m=0;m<12;m++){
    const day=1+Math.ceil(((m+10)%12)*20/3);assert.equal(climateMonth(s,day),m);
    let wet=0,heavy=0,mm=0;
    for(let i=0;i<samples;i++){s.seed=i;const c=kaunasWeather(s,day,(i+.5)/samples);wet+=c.mm>0;heavy+=c.mm>=10;mm+=c.mm;}
    assert.ok(Math.abs(wet/samples-kaunasNormals.wet[m]/kaunasNormals.days[m])<.0001);
    assert.ok(Math.abs(heavy/samples-kaunasNormals.heavy[m]/kaunasNormals.days[m])<.0001);
    assert.ok(Math.abs(mm/samples-kaunasNormals.mm[m]/kaunasNormals.days[m])<.09,'month '+m);
  }
});
test('soil buffers a dry day, prolonged drying stops growth, and saturation or frost limits crops',()=>{
  const s=createState(HOMESTEAD_RULES,4);s.day=25;s.local.season='Summer';
  s.local.climate={day:24,soil:.8};s.natural.climate={day:25,type:'normal',temperature:18,mm:0,intensity:'dry'};
  beginClimateDay(s,'normal');assert.equal(climateCropGrowth(s,0),1);
  for(let i=0;i<15;i++){s.day++;s.natural.climate={day:s.day,type:'normal',temperature:25,mm:0,intensity:'dry'};beginClimateDay(s,'normal');}
  assert.equal(climateCropGrowth(s,1),0);Object.assign(s.local.climate,{soil:1.4,waterlogged:2});assert.equal(climateCropGrowth(s,2),.5);
  s.local.climate.temperature=-2;assert.equal(climateCropGrowth(s,2),0);
});
test('river exits vary and tributary crossings finish on land without being pulled back into the channel',()=>{
  const v={id:1,warmth:100,illnessDays:0},landings=[];
  for(let count=1;count<=8;count++){
    const x=300,y=640*(.51+.078*Math.sin(x/1000*7+.4)+.037*Math.sin(x/1000*13));
    const p={x,y,leg:0,travel:0,seed:4,falls:count};walkRiver(p,[300,50],5,1000,640,false,v,false,false,null,false,3000,true);assert.ok(p.swept);landings.push(p.landing);
    for(let i=0;i<150&&p.swept;i++)walkRiver(p,[300,50],5,1000,640,false,v,false,false,null,false,3000,true);
    assert.equal(p.swept,0);assert.equal(p.goal,null);
  }
  assert.equal(new Set(landings).size,8);
  const p={x:400,y:100,leg:0,travel:0,goal:[650,250]};
  for(let i=0;i<600&&p.goal;i++)walkRiver(p,p.goal,3,1000,640,false,v,false,false,null,false,3000,true);
  assert.equal(p.swept||0,0);assert.equal(p.goal,null);assert.ok(Math.abs(p.x/1000-nerisX(p.y/640))>.0115);
});
test('river death chance is approximately one per thousand and a fatal fall persists without consuming weather dice',()=>{
  let deaths=0,count;for(let i=1;i<=200000;i++)if(riverFallOutcome(4,i)){deaths++;count??=i;}assert.ok(deaths>145&&deaths<255,deaths);
  assert.ok(count,'the bounded sample must include a fatal outcome');
  const s=createState(HOMESTEAD_RULES,4);
  s.local.riverFalls=count-1;const id=s.villagers[0].id,r=recordRiverFall(s,id);
  assert.equal(r.fatal,true);assert.equal(r.state.stats.deaths,s.stats.deaths+1);assert.equal(r.state.rng,s.rng);
  assert.equal(r.state.local.genealogy.people[id].deathDay,s.day);assert.equal(s.villagers.length,6);
  assert.equal(deserialize(serialize(r.state),HOMESTEAD_RULES).local.riverFalls,count);
});
test('undiscovered current resources stay hidden and depleted discovered resources remain visible',()=>{
  const s=createState(HOMESTEAD_RULES,4);assert.equal('wheat' in visibleResources(s,s.local.deposits),false);
  assert.equal('flour' in visibleResources(s,{...s.local.stock}),false);
  s.farming.seedSeasons=[1];rememberResources(s);assert.equal('wheat' in visibleResources(s,s.local.deposits),false,'season observation alone is not a seed discovery');
  takeDeposit(s,'wheat',1);s.local.stock.wheat=0;rememberResources(s);
  assert.equal('wheat' in visibleResources(s,s.local.stock),true);assert.equal('wheat' in visibleResources(s,s.local.deposits),true);
  assert.ok(encyclopediaCatalog(s).some(e=>e.name==='wholemeal flour'));
});
test('family links survive death, multiple generations and save/load; arrivals remain distinct roots',()=>{
  const s=createState(HOMESTEAD_RULES,4),founder=s.villagers[0];s.day=100;
  const child={...structuredClone(founder),id:100,name:'Child',age:20,parents:[founder.id],parentNames:[founder.name]};rememberPerson(s,child,'born');s.villagers.push(child);
  const grandchild={...structuredClone(child),id:101,name:'Grandchild',age:0,parents:[100],parentNames:['Child']};s.villagers.push(grandchild);
  recordLifeDay(s,[founder],{deaths:[{id:founder.id,causes:['old age']}],birth:101});s.villagers=s.villagers.filter(v=>v!==founder);
  const back=deserialize(serialize(s),HOMESTEAD_RULES);assert.equal(familyOf(back,101).parents[0].id,100);assert.equal(familyOf(back,100).parents[0].deathDay,100);
  const arrival=castText(back,'spawn people').state.villagers.at(-1);assert.equal(arrival.arrivalDay,100);assert.equal(arrival.lastCompanyDay,100);
});
test('legacy records recover dated ancestors but never substitute a younger namesake as a parent',()=>{
  const s=createState(HOMESTEAD_RULES,4);delete s.local.genealogy;s.day=200;
  s.local.birthHistory=[{id:90,name:'Root',day:0,parentNames:[]},{id:91,name:'Child',day:10,parentNames:['Root','Echo']},{id:92,name:'Echo',day:100,parentNames:[]}];
  const loaded=deserialize(serialize(s),HOMESTEAD_RULES),r=loaded.local.genealogy.people[91];
  assert.deepEqual(r.parents,[90]);assert.equal(r.ancestryIncomplete,true);
});
test('milling needs a quern but not building knowledge; supervised work consumes grain and produces actual flour',()=>{
  const s=createState(HOMESTEAD_RULES,4),[teacher,student]=s.villagers;s.day=450;s.food=50;s.wood=30;s.farming.querns=[{camp:0}];s.local.stock.wheat=24;
  for(const v of [teacher,student]){v.tribe=0;v.lastCompanyDay=s.day;v.fullness=v.warmth=v.health=v.happiness=100;v.practice.properties.push('perishable');}
  teacher.practice.known.milling=1;teacher.practice.used.milling=1;
  assert.ok(canExperiment(s,student,practices.milling));assert.equal(student.practice.known.quernmaking,undefined);
  const report={actions:[{id:teacher.id,action:'Grind wheat into flour'}]},grain=s.local.stock.wheat;
  assert.equal(makeSupervisedFood(s,student,'milling',report),true);assert.equal(s.local.stock.wheat,grain-8);assert.equal(s.local.stock.flour,8);
  assert.equal(student.practice.known.milling,undefined);assert.equal(makeSupervisedFood(s,student,'milling',report),false);
});
test('collection requires actual making; discovered paintings provide clues without granting recipe knowledge',()=>{
  const s=createState(HOMESTEAD_RULES,4),v=s.villagers[0];s.local.first.fishtraps=2;rememberCollection(s,practices);assert.equal(s.local.collection['fish trap'],undefined);
  v.practice.gear['fish trap']=true;rememberCollection(s,practices);delete v.practice.gear['fish trap'];assert.ok(s.local.collection['fish trap']);
  Object.assign(v.practice.known,{cavepainting:1,knapping:1,charcoal:1});Object.assign(v.practice.skills,{stone:3,hide:3});
  s.local.reaches=1;s.toolkit=['hammer stone'];s.local.stock.charcoal=2;s.local.stock.resin=2;
  assert.equal(makePracticeProduct(s,v,'cavepainting',{}),true);assert.equal(s.local.stock.charcoal,1);
  const pupil=s.villagers[1];pupil.practice.properties.push('fractures');const q=discoverPainting(s,pupil,practices);
  assert.ok(q.readBy.includes(pupil.id));assert.equal(pupil.practice.known.knapping,undefined);assert.ok(pupil.practice.progress.knapping>0);
});
test('inspiration chooses an experienced question, grants no technology, respects needs, and never stacks',()=>{
  let s=createState(HOMESTEAD_RULES,4);assert.equal(castText(s,'inspire').ok,false);
  const v=s.villagers[0];Object.assign(v.practice.skills,{berries:5,wood:4});v.fullness=v.warmth=v.health=100;
  const known={...v.practice.known},traits=[...v.traits],curiosity=v.practice.curiosity,r=castText(s,'inspire');assert.ok(r.ok);s=r.state;
  const p=s.villagers[0].practice;assert.equal(p.inspiration.topic,'counting');assert.deepEqual(p.known,known);
  assert.equal(p.curiosity,curiosity);assert.deepEqual(s.villagers[0].traits,traits);assert.equal(inspirationBonus(s,s.villagers[0],practices.charcoal),8);
  assert.equal(castText(s,'inspire').ok,false);s.villagers[0].fullness=0;delete p.inspiration;assert.equal(inspireVillager(s),null);
  let found=false;
  for(let seed=0;seed<3000&&!found;seed++){
    const x=createState(HOMESTEAD_RULES,seed),a=x.villagers[0];Object.assign(a.practice.skills,{berries:5,wood:4});a.motivation={level:4};a.fullness=a.warmth=a.health=100;
    const report={actions:[{id:a.id,action:'Forage'}]};naturalInspiration(x,report);found=!!report.inspiration?.length;
  }
  assert.ok(found,'experience can trigger inspiration without a god action');
});
