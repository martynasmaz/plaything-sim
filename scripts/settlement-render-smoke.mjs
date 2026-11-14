// Render-only fixtures for compact camp groups and the healer's recognisable
// home. This does not load or alter the user's saved village.
import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createState,stepDay,findHomesteadHealer} from '../src/sim.js';
import {HOMESTEAD_RULES} from '../src/config.js';
import {createClearing} from '../src/clearing.js';
import {drawHealerHome} from '../src/settlement-view.js';
import {healerHomeView} from '../src/healer-home.js';
const require=createRequire(import.meta.url),{createCanvas,Path2D}=require(process.argv[2]||'@napi-rs/canvas');
globalThis.Path2D=Path2D;globalThis.devicePixelRatio=1;globalThis.Image=class {set src(value){}};
const canvases=[],events=new Map();
const element=()=>({style:{},dataset:{},children:[],setAttribute(){},append(...nodes){this.children.push(...nodes);},addEventListener(name,handler){events.set(name,handler);},
  getBoundingClientRect(){return {left:0,top:0,width:1200,height:768};}});
globalThis.document={createElement(tag){
  if(tag!=='canvas')return element();
  const canvas=createCanvas(1200,768);Object.assign(canvas,element(),{clientWidth:1200,clientHeight:768,setPointerCapture(){}});
  canvases.push(canvas);return canvas;
}};
const s=createState({...HOMESTEAD_RULES,traits:false,illness:{chance:0}},4);
s.food=90;s.wood=0;s.fireKnown=false;s.settlementWork=5;s.speed=1;s.natural.weather='normal';s.natural.illness=false;
for(const v of s.villagers){v.fullness=v.health=v.happiness=100;v.warmth=15;}
const before=JSON.stringify(s),host=element(),clearing=createClearing(host,()=>s);
for(let i=0;i<100;i++)clearing.draw(100);
assert.equal(JSON.stringify(s),before,'Drawing must not mutate the village or its priorities');
assert.equal(host.dataset.ready,'true');
const frame=canvases[0];writeFileSync(new URL('../reports/settlement-spacing-scene.png',import.meta.url),frame.toBuffer('image/png'));
const crop=createCanvas(750,540),g=crop.getContext('2d');
g.drawImage(frame,80,120,300,216,0,0,750,540);
writeFileSync(new URL('../reports/settlement-spacing-preview.png',import.meta.url),crop.toBuffer('image/png'));
// Controlled supplies and learned skills are test inputs; every construction
// stage and material debit below is performed by actual NPC simulation work.
const rules={...HOMESTEAD_RULES,traits:false,illness:{chance:0},learning:{...HOMESTEAD_RULES.learning,seasonLength:1000},
  weather:{chances:{normal:100,rain:0,drought:0,cold:0}}};
let clinic=createState(rules,4);const doctor=clinic.villagers[0];clinic.villagers=[doctor];
clinic.food=100;clinic.wood=80;clinic.settlementWork=5;
Object.assign(clinic.local.stock,{herbs:12,fibre:20,stone:20});
doctor.traits=['Loner'];doctor.fullness=doctor.warmth=doctor.health=doctor.happiness=100;doctor.practice.energy=100;
Object.assign(doctor.practice.known,{herbalism:2,cordage:1,housing:1});
Object.assign(doctor.practice.skills,{berries:4,wood:4,fibre:3});doctor.practice.careExperience=2;doctor.remedyDoses=2;
doctor.practice.gear['hafted tool']=1;
findHomesteadHealer(clinic);
const stages={},workLog=[];let unfinishedWorld;
const advance=()=>{
  clinic=stepDay(clinic);const project=clinic.local.healerHome;
  workLog.push({day:clinic.day,actions:clinic.lastDay.actions.filter(a=>a.id===doctor.id),project:structuredClone(project)});
  if(project?.work===2&&!stages.frame){stages.frame=structuredClone(project);unfinishedWorld=structuredClone(clinic);}
  if(project?.work===6&&!stages.hut)stages.hut=structuredClone(project);
};
for(let day=0;day<70&&!clinic.villagers[0].herbalist.home;day++)advance();
assert.ok(clinic.villagers[0].herbalist.home);
const patient=createState(rules,4).villagers[1];clinic.villagers.push(patient);
for(let day=0;day<100&&clinic.local.healerHome.markerWork<2;day++){
  const healer=clinic.villagers.find(v=>v.id===doctor.id);
  const sick=clinic.villagers.find(v=>v.id===patient.id);
  sick.illnessDays=healer.herbalist.visits<3?3:0;
  advance();
}
assert.equal(clinic.local.healerHome.markerWork,2);stages.finished=structuredClone(clinic.local.healerHome);
assert.deepEqual(stages.finished.spent,{wood:10,fibre:6,stone:1});
const hut=createCanvas(640,470),h=hut.getContext('2d');h.fillStyle='#b7bb82';h.fillRect(0,0,640,470);
const permanentLabels=[];
const originalText=h.fillText.bind(h),originalStrokeText=h.strokeText.bind(h);
h.fillText=(...args)=>{permanentLabels.push(args[0]);return originalText(...args);};
h.strokeText=(...args)=>{permanentLabels.push(args[0]);return originalStrokeText(...args);};
h.translate(280,350);h.scale(3.5,3.5);drawHealerHome(h,0,0,clinic.local.healerHome.stock.doses,true,stages.finished);
assert.deepEqual(permanentLabels,[],'The hut artwork must not carry a permanent map label');
writeFileSync(new URL('../reports/healer-hut-preview.png',import.meta.url),hut.toBuffer('image/png'));
const building=createCanvas(1400,410),b=building.getContext('2d');b.fillStyle='#b7bb82';b.fillRect(0,0,1400,410);
for(const [i,key] of ['frame','hut','finished','empty'].entries()){
  const project=key==='empty'?stages.finished:stages[key];
  b.save();b.translate(i*350+140,300);b.scale(2.6,2.6);drawHealerHome(b,0,0,project.stock.doses,key!=='empty',project);b.restore();
  b.fillStyle='#34422c';b.font='20px Georgia';b.textAlign='center';
  b.fillText(['Frame: workday 2','Walls and roof completed','Rack and sign built later','Building after owner dies'][i],i*350+175,365);
}
writeFileSync(new URL('../reports/healer-building-stages.png',import.meta.url),building.toBuffer('image/png'));
writeFileSync(new URL('../reports/healer-building-example.json',import.meta.url),JSON.stringify(workLog,null,2)+'\n');
const site=clinic.local.healerHome.home,clinicHost=element(),clinicScene=createClearing(clinicHost,()=>clinic);
const beforeClinicDraw=JSON.stringify(clinic);
clinicScene.draw(0);
assert.equal(JSON.stringify(clinic),beforeClinicDraw);
const pointAtHut=()=>events.get('pointermove')({pointerId:1,pointerType:'mouse',
  clientX:(site[0]/1000-.1)*1200*1.25,clientY:(site[1]/640-.1)*768*1.25-22});
pointAtHut();clinicScene.draw(0);assert.equal(clinicHost.children[1].children[0].textContent,'Woodland healer’s hut');
assert.equal(clinicHost.children[1].children[1].textContent,'Home of '+doctor.name);
assert.equal(clinicHost.children[1].children[2].textContent,'','No builder or work-priority commentary in the hut card');
clinic.villagers.find(v=>v.id===doctor.id).age=clinic.config.life.death-1;
clinic=stepDay(clinic);const persisted=JSON.stringify(clinic.local.healerHome);
pointAtHut();clinicScene.draw(0);
assert.equal(clinicHost.children[1].children[1].textContent,'Unoccupied');
assert.equal(JSON.stringify(clinic.local.healerHome),persisted);
assert.ok(healerHomeView(clinic,[227,222]));
events.get('pointerleave')({pointerType:'mouse'});clinicScene.draw(0);
assert.equal(clinicHost.children[1].hidden,true,'Moving off the hut hides its inspection label');
// The exact unfinished stage reported in the screenshot also uses only the
// same corner card as NPCs, and hides again on pointer leave.
const unfinishedHost=element(),unfinishedScene=createClearing(unfinishedHost,()=>unfinishedWorld);
unfinishedScene.draw(0);const unfinishedCard=unfinishedHost.children[1];
assert.equal(unfinishedCard.hidden,true);assert.equal(unfinishedCard.className,'villager-card');
const unfinishedSite=unfinishedWorld.local.healerHome.home;
events.get('pointermove')({pointerId:1,pointerType:'mouse',
  clientX:(unfinishedSite[0]/1000-.1)*1200*1.25,clientY:(unfinishedSite[1]/640-.1)*768*1.25-12});
unfinishedScene.draw(0);
assert.equal(unfinishedCard.hidden,false);assert.equal(unfinishedCard.children[0].textContent,'Herb shelter');
assert.equal(unfinishedCard.children[1].textContent,'Under construction (2/6)');
events.get('pointerleave')({pointerType:'mouse'});unfinishedScene.draw(0);assert.equal(unfinishedCard.hidden,true);
// Use the home actually built above, including its NPC-cleared woodland,
// for placement QA. Emergence timing is measured by the simulation reports,
// not assumed to happen by a fixed day for one untouched seed.
let natural=structuredClone(clinic);
assert.equal(natural.local.healerHome.work,6);
natural.elapsedMs=natural.config.dayMs*.45;natural.speed=1;
const naturalHost=element(),naturalScene=createClearing(naturalHost,()=>natural),naturalFrame=canvases.at(-3);
const naturalBefore=JSON.stringify(natural);
for(let frame=0;frame<120;frame++)naturalScene.draw(100);
assert.equal(JSON.stringify(natural),naturalBefore);
assert.equal(naturalHost.children[1].hidden,true);
// createClearing allocates its visible canvas, paper and trail paper in order.
writeFileSync(new URL('../reports/healer-clearing-scene.png',import.meta.url),naturalFrame.toBuffer('image/png'));
console.log('Rendered actual NPC construction stages; verified occupied/empty hut selection and persistent physical work.');
