import test from 'node:test';
import assert from 'node:assert/strict';
import {familyTreeLayout,familyConnectorPaths} from '../src/family-tree-layout.js';
import {familyPortraitPerson,drawVillagerPortrait} from '../src/villager-portrait.js';
import {rememberPerson,recordLifeDay} from '../src/genealogy.js';
import {createFamilyTreeView} from '../src/family-tree-view.js';
import {familyTreeFixture} from './fixtures/family-tree.js';
import {familyDom} from './fixtures/family-dom.js';

test('a drawn family includes actual ancestors, siblings, co-parents and grandchildren with no invented links',()=>{
  const s=familyTreeFixture(),p=s.local.genealogy.people,tree=familyTreeLayout(p,7),ids=tree.nodes.map(n=>n.id);
  assert.ok([1,2,7,8,9,10,11,13,14,16].every(id=>ids.includes(id)));assert.equal(new Set(ids).size,ids.length);
  for(const group of tree.unions)for(const child of group.children)for(const parent of group.parents)assert.ok(p[child].parents.includes(parent));
  const byId=new Map(tree.nodes.map(n=>[n.id,n]));for(const n of tree.nodes)for(const parent of n.parents)assert.ok(byId.get(parent).y+tree.metrics.cardHeight<n.y);
  assert.equal(byId.get(7).rank,byId.get(8).rank,'co-parents align despite a married-in branch');
  const siblings=tree.unions.find(u=>u.parents.includes(7)&&u.parents.includes(8));assert.deepEqual(siblings.children.sort((a,b)=>a-b),[9,10]);
  for(const union of tree.unions)assert.ok(familyConnectorPaths(union).every(path=>!path.includes('NaN')));
});
test('ancestry is shared without duplicating a person, and unrelated roots stay outside a branch',()=>{
  const s=familyTreeFixture(),p=s.local.genealogy.people;p[90]={id:90,name:'Unrelated arrival',parents:[],origin:'arrival'};
  const tree=familyTreeLayout(p,13);assert.equal(tree.nodes.filter(n=>n.id===5).length,1);assert.ok(!tree.nodes.some(n=>n.id===90));
  const ancestors=familyTreeLayout(p,7,{mode:'ancestors'});assert.deepEqual(ancestors.nodes.map(n=>n.id).sort((a,b)=>a-b),[1,2,7]);
  const descendants=familyTreeLayout(p,7,{mode:'descendants'});assert.ok(descendants.nodes.some(n=>n.id===13));assert.ok(!descendants.nodes.some(n=>n.id===1));
});
test('layouts handle missing records, cyclic legacy data and bounded long histories without mutating ancestry',()=>{
  const records={1:{id:1,name:'Child',parents:[2]},2:{id:2,name:'Parent',parents:[1,3]}};const before=JSON.stringify(records),tree=familyTreeLayout(records,1);
  assert.ok(tree.cycle);assert.ok(tree.nodes.find(n=>n.id===3).person.placeholder);assert.equal(JSON.stringify(records),before);
  const long={};for(let id=1;id<=400;id++)long[id]={id,name:'Person '+id,parents:id>1?[id-1]:[]};
  const bounded=familyTreeLayout(long,400);assert.equal(bounded.nodes.length,240);assert.ok(bounded.omitted>0);
  const earlier=familyTreeLayout(long,161);assert.ok(earlier.nodes.some(n=>n.id===1));
});
test('cards do not overlap even with shared ancestry and several unions',()=>{
  const p=familyTreeFixture().local.genealogy.people;for(const id of [1,7,9,13]){
    const tree=familyTreeLayout(p,id);for(const a of tree.nodes)for(const b of tree.nodes)if(a.id!==b.id){
      const separated=a.x+tree.metrics.cardWidth<=b.x||b.x+tree.metrics.cardWidth<=a.x||a.y+tree.metrics.cardHeight<=b.y||b.y+tree.metrics.cardHeight<=a.y;assert.ok(separated);
    }
  }
});
test('appearance is recorded before death and retained after the living villager disappears',()=>{
  const s=familyTreeFixture(),v=s.villagers.find(v=>v.id===8);s.config.start={ages:Array(6).fill(40)};
  rememberPerson(s,v);const appearance=structuredClone(s.local.genealogy.people[v.id].appearance);recordLifeDay(s,[v],{deaths:[{id:v.id,causes:['illness']}],birth:null});s.villagers=s.villagers.filter(p=>p.id!==v.id);
  const roundTrip=JSON.parse(JSON.stringify(s)),portrait=familyPortraitPerson(roundTrip,roundTrip.local.genealogy.people[8]);
  assert.equal(portrait.gender,appearance.gender);assert.equal(portrait.age,appearance.age);assert.equal(portrait.practice.gear['wool wrap'],true);assert.equal(portrait.dead,true);assert.equal(portrait.approximate,false);
});
test('legacy portraits use known age/identity while genuinely unknown ancestors remain unknown',()=>{
  const s=familyTreeFixture(),old={id:91,name:'Old record',gender:'male',birthDay:-20,deathDay:250,parents:[]};
  const portrait=familyPortraitPerson(s,old);assert.equal(portrait.age,270);assert.equal(portrait.approximate,true);
  assert.equal(familyPortraitPerson(s,{id:99,placeholder:true,parents:[]}).placeholder,true);
  assert.equal(familyPortraitPerson(s,{id:92,name:'Untraced old record',birthDay:0,parents:[]}).lifeUnknown,true);
});
test('the viewer navigates portraits, zooms, expands and returns without changing the world',()=>{
  const s=familyTreeFixture(),before=JSON.stringify(s),dom=familyDom(),oldDoc=globalThis.document,oldOption=globalThis.Option;
  globalThis.document=dom.doc;globalThis.Option=dom.OptionClass;
  try{
    const view=createFamilyTreeView(dom.doc.body,()=>s);view.setPerson(13);view.open();assert.equal(dom.doc.body.querySelectorAll('.family-person').find(c=>c.getAttribute('aria-pressed')==='true').dataset.personId,'13');view.open(7);
    const viewport=dom.doc.body.querySelector('.family-atlas-viewport'),cards=()=>dom.doc.body.querySelectorAll('.family-person'),button=text=>dom.doc.body.querySelectorAll('button').find(b=>b.textContent===text);
    assert.ok(cards().every(c=>c.querySelector('canvas')));assert.equal(cards().filter(c=>c.getAttribute('aria-pressed')==='true')[0].dataset.personId,'7');
    cards().find(c=>c.dataset.personId==='1').click();assert.equal(cards().filter(c=>c.getAttribute('aria-pressed')==='true')[0].dataset.personId,'1');
    button('←').click();assert.equal(cards().filter(c=>c.getAttribute('aria-pressed')==='true')[0].dataset.personId,'7');
    const chart=dom.doc.body.querySelector('.family-atlas-chart'),previous=chart.style.transform;button('+').click();assert.notEqual(chart.style.transform,previous);button('Fit').click();button('Center').click();
    button('Expand').click();assert.equal(view.isExpanded(),true);button('Close').click();assert.equal(view.isExpanded(),false);assert.equal(dom.doc.activeElement,button('Expand'));
    view.setPerson(13);assert.equal(cards().filter(c=>c.getAttribute('aria-pressed')==='true')[0].dataset.personId,'13');
    viewport.emit('pointerdown',{pointerType:'mouse',button:0,pointerId:1,clientX:100,clientY:100,preventDefault(){}});viewport.emit('pointermove',{pointerId:1,clientX:70,clientY:60});viewport.emit('pointerup',{pointerId:1});
    assert.equal(JSON.stringify(s),before);
  }finally{globalThis.document=oldDoc;globalThis.Option=oldOption;}
});
test('portraits and chart navigation remain display-only for a living child and missing ancestor',()=>{
  const s=familyTreeFixture(),before=JSON.stringify(s),dom=familyDom(350,420);const canvas=dom.doc.createElement('canvas'),g=canvas.getContext('2d');
  drawVillagerPortrait(g,familyPortraitPerson(s,s.local.genealogy.people[14]),144,144);drawVillagerPortrait(g,familyPortraitPerson(s,{id:99,placeholder:true}),144,144);assert.equal(JSON.stringify(s),before);
});
